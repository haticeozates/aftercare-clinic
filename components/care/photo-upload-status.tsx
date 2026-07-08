"use client";

import type { PhotoUploadUiStatus } from "@/lib/photos/client-upload";

const labels: Record<PhotoUploadUiStatus, string> = {
  idle: "",
  selected: "Fotoğraf seçildi.",
  requesting_intent: "Yükleme hazırlanıyor...",
  uploading: "Fotoğraf güvenli alana yükleniyor...",
  finalizing: "Fotoğraf doğrulanıyor ve hazırlanıyor...",
  success: "Fotoğrafınız güvenli şekilde iletildi.",
  error: ""
};

export function PhotoUploadStatus({ status, error }: { status: PhotoUploadUiStatus; error: string | null }) {
  if (error) {
    return (
      <p className="error-message" role="alert">
        {error}
      </p>
    );
  }

  const label = labels[status];
  if (!label) {
    return null;
  }

  return (
    <p className={status === "success" ? "success-message" : "label"} aria-live="polite">
      {label}
    </p>
  );
}
