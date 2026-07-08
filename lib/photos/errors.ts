export type PhotoUploadErrorCode =
  | "empty_file"
  | "file_too_large"
  | "unsupported_format"
  | "unsupported_mime_type"
  | "mime_mismatch"
  | "malformed_image"
  | "image_too_large"
  | "too_many_frames"
  | "request_invalid"
  | "upload_failed"
  | "finalize_failed";

export function mapPhotoUploadError(error: unknown) {
  const code = typeof error === "string" ? error : "";

  if (code === "unsupported_format" || code === "unsupported_mime_type" || code === "mime_mismatch") {
    return "Dosya desteklenen bir fotoğraf formatında değil.";
  }

  if (code === "file_too_large" || code === "image_too_large") {
    return "Fotoğraf boyutu izin verilen sınırı aşıyor.";
  }

  if (code === "request_invalid") {
    return "Bu fotoğraf talebi artık geçerli değil.";
  }

  return "Yükleme tamamlanamadı. Lütfen tekrar deneyin.";
}
