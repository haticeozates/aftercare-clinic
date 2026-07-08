export const PHOTO_BUCKETS = {
  incoming: "care-photo-incoming",
  final: "care-photos"
} as const;

export const PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PhotoAllowedMimeType = (typeof PHOTO_ALLOWED_MIME_TYPES)[number];
export type PhotoUploadValidationResult =
  | { ok: true }
  | { ok: false; reason: "unsupported_mime_type" | "file_too_large" | "empty_file" };

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

export function buildOpaquePhotoObjectKey(input: {
  prefix: "incoming" | "photos";
  opaqueId: string;
  extension?: "webp";
}) {
  if (input.prefix === "incoming") {
    return `incoming/${input.opaqueId}`;
  }

  return `photos/${input.opaqueId}.${input.extension ?? "webp"}`;
}

export function sanitizePhotoAuditMetadata(input: Record<string, unknown>) {
  return {
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    result_reason: input.result_reason,
    source: input.source,
    day_number: input.day_number
  };
}
