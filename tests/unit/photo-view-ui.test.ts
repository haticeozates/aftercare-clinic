import { describe, expect, it } from "vitest";
import {
  initialPhotoViewState,
  mapClinicPhotoViewError,
  photoViewReducer,
  sanitizeClinicPhotoRecord
} from "@/lib/photos/clinic-view";

describe("clinic secure photo viewer contracts", () => {
  it("sanitizes clinic photo DTOs without storage keys or checksums", () => {
    const dto = sanitizeClinicPhotoRecord({
      id: "photo-1",
      request_label: "Temsili fotoğraf talebi",
      request_required: true,
      day_number: 2,
      uploaded_at: "2026-07-08T09:00:00+00:00",
      width: 800,
      height: 600,
      mime_type: "image/webp",
      final_object_key: "photos/secret.webp",
      checksum_sha256: "abc",
      bucket: "care-photos"
    });

    expect(dto).toEqual({
      id: "photo-1",
      requestLabel: "Temsili fotoğraf talebi",
      requestRequired: true,
      dayNumber: 2,
      uploadedAt: "2026-07-08T09:00:00+00:00",
      width: 800,
      height: 600,
      mimeType: "image/webp"
    });
    expect(JSON.stringify(dto)).not.toMatch(/photos\/|care-photos|checksum|secret/i);
  });

  it("does not request a signed URL until the user asks to view", () => {
    let state = initialPhotoViewState();
    expect(state.status).toBe("idle");
    expect(state.signedUrl).toBeNull();

    state = photoViewReducer(state, { type: "request" });
    expect(state.status).toBe("loading");

    const duplicate = photoViewReducer(state, { type: "request" });
    expect(duplicate).toBe(state);

    state = photoViewReducer(state, {
      type: "success",
      signedUrl: "https://signed.example/photo",
      expiresAt: "2026-07-08T09:01:00+00:00"
    });
    expect(state.status).toBe("open");
    expect(state.signedUrl).toContain("signed.example");

    state = photoViewReducer(state, { type: "close" });
    expect(state).toEqual(initialPhotoViewState());
  });

  it("maps raw errors to safe Turkish messages", () => {
    expect(mapClinicPhotoViewError(new Error("storage key photos/secret.webp"))).toBe("Fotoğraf şu anda görüntülenemiyor. Lütfen tekrar deneyin.");
    expect(mapClinicPhotoViewError("forbidden")).toBe("Fotoğraf kaydı bulunamadı.");
    expect(mapClinicPhotoViewError("expired")).toBe("Görüntüleme bağlantısının süresi doldu. Tekrar açabilirsiniz.");
  });
});
