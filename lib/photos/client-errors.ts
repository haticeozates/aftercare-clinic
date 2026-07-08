export function mapPhotoUploadClientError(error: unknown) {
  if (error === "request_invalid") {
    return "Bu fotoğraf talebi artık geçerli değil.";
  }

  if (error === "network") {
    return "Bağlantınız kesildi. Lütfen yeniden deneyin.";
  }

  if (error === "unsupported_mime_type") {
    return "Bu dosya desteklenen fotoğraf formatlarından biri değil.";
  }

  if (error === "file_too_large") {
    return "Fotoğraf 5 MB sınırını aşıyor.";
  }

  return "Yükleme tamamlanamadı. Lütfen tekrar deneyin.";
}
