import crypto from "node:crypto";
import sharp from "sharp";
import type { Metadata } from "sharp";
import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_IMAGE_LIMITS,
  PHOTO_MAX_UPLOAD_BYTES,
  type PhotoAllowedMimeType
} from "@/lib/photos/contracts";

type SharpInputFormat = "jpeg" | "png" | "webp";

const decodedMimeByFormat: Record<SharpInputFormat, PhotoAllowedMimeType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export type PhotoSanitizeResult =
  | {
      ok: false;
      reason:
        | "empty_file"
        | "file_too_large"
        | "unsupported_format"
        | "mime_mismatch"
        | "malformed_image"
        | "image_too_large"
        | "too_many_frames";
    }
  | {
      ok: true;
      outputBytes: Buffer;
      verifiedMimeType: "image/webp";
      verifiedSizeBytes: number;
      width: number;
      height: number;
      checksumSha256: string;
      metadata: Metadata;
    };

export async function inspectAndSanitizePhoto(input: {
  bytes: Buffer;
  declaredMimeType: string;
}): Promise<PhotoSanitizeResult> {
  if (input.bytes.length === 0) {
    return { ok: false, reason: "empty_file" };
  }

  if (input.bytes.length > PHOTO_MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "file_too_large" };
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: PHOTO_IMAGE_LIMITS.maxPixels,
      pages: 1,
      unlimited: false
    }).metadata();
  } catch {
    return { ok: false, reason: "malformed_image" };
  }

  const format = metadata.format as SharpInputFormat | undefined;
  if (!format || !(format in decodedMimeByFormat)) {
    return { ok: false, reason: "unsupported_format" };
  }

  const decodedMime = decodedMimeByFormat[format];
  if (!PHOTO_ALLOWED_MIME_TYPES.includes(input.declaredMimeType as PhotoAllowedMimeType)) {
    return { ok: false, reason: "unsupported_format" };
  }

  if (decodedMime !== input.declaredMimeType) {
    return { ok: false, reason: "mime_mismatch" };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < 1 ||
    height < 1 ||
    width > PHOTO_IMAGE_LIMITS.maxWidth ||
    height > PHOTO_IMAGE_LIMITS.maxHeight ||
    width * height > PHOTO_IMAGE_LIMITS.maxPixels
  ) {
    return { ok: false, reason: "image_too_large" };
  }

  if ((metadata.pages ?? 1) > PHOTO_IMAGE_LIMITS.maxPages) {
    return { ok: false, reason: "too_many_frames" };
  }

  let outputBytes: Buffer;
  let outputMetadata: Metadata;
  try {
    outputBytes = await sharp(input.bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: PHOTO_IMAGE_LIMITS.maxPixels,
      pages: 1,
      unlimited: false
    })
      .rotate()
      .resize({
        width: PHOTO_IMAGE_LIMITS.outputMaxLongEdge,
        height: PHOTO_IMAGE_LIMITS.outputMaxLongEdge,
        fit: "inside",
        withoutEnlargement: true
      })
      .flatten({ background: "#ffffff" })
      .toColorspace("srgb")
      .webp({ quality: PHOTO_IMAGE_LIMITS.outputQuality })
      .toBuffer();

    outputMetadata = await sharp(outputBytes, {
      failOn: "warning",
      limitInputPixels: PHOTO_IMAGE_LIMITS.maxPixels
    }).metadata();
  } catch {
    return { ok: false, reason: "malformed_image" };
  }

  const outputWidth = outputMetadata.width ?? 0;
  const outputHeight = outputMetadata.height ?? 0;
  if (outputBytes.length > PHOTO_MAX_UPLOAD_BYTES || outputWidth < 1 || outputHeight < 1) {
    return { ok: false, reason: "image_too_large" };
  }

  return {
    ok: true,
    outputBytes,
    verifiedMimeType: PHOTO_IMAGE_LIMITS.outputFormat,
    verifiedSizeBytes: outputBytes.length,
    width: outputWidth,
    height: outputHeight,
    checksumSha256: crypto.createHash("sha256").update(outputBytes).digest("hex"),
    metadata: outputMetadata
  };
}
