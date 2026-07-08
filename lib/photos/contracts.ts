export const PHOTO_BUCKETS = {
  incoming: "care-photo-incoming",
  final: "care-photos"
} as const;

export const PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const PHOTO_IMAGE_LIMITS = {
  maxInputBytes: PHOTO_MAX_UPLOAD_BYTES,
  maxWidth: 6000,
  maxHeight: 6000,
  maxPixels: 16_000_000,
  maxPages: 1,
  outputFormat: "image/webp",
  outputQuality: 82,
  outputMaxLongEdge: 1600
} as const;

export type PhotoAllowedMimeType = (typeof PHOTO_ALLOWED_MIME_TYPES)[number];

export type PhotoUploadValidationResult =
  | { ok: true }
  | { ok: false; reason: "unsupported_mime_type" | "file_too_large" | "empty_file" };

export interface PhotoUploadCredentialInput {
  intentId: string;
  path: string;
  token: string;
  expiresAt: string;
}

export interface PhotoUploadCredentialDto {
  intentId: string;
  uploadCredential: {
    path: string;
    token: string;
    expiresAt: string;
    maxBytes: number;
    allowedMimeTypes: readonly PhotoAllowedMimeType[];
  };
}

export function validateDeclaredPhotoUpload(input: {
  mimeType: string;
  sizeBytes: number;
}): PhotoUploadValidationResult {
  if (!PHOTO_ALLOWED_MIME_TYPES.includes(input.mimeType as PhotoAllowedMimeType)) {
    return { ok: false, reason: "unsupported_mime_type" };
  }

  if (input.sizeBytes <= 0) {
    return { ok: false, reason: "empty_file" };
  }

  if (input.sizeBytes > PHOTO_MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "file_too_large" };
  }

  return { ok: true };
}

export function buildPhotoUploadCredential(input: PhotoUploadCredentialInput): PhotoUploadCredentialDto {
  return {
    intentId: input.intentId,
    uploadCredential: {
      path: input.path,
      token: input.token,
      expiresAt: input.expiresAt,
      maxBytes: PHOTO_MAX_UPLOAD_BYTES,
      allowedMimeTypes: PHOTO_ALLOWED_MIME_TYPES
    }
  };
}
