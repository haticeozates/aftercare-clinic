import { describe, expect, it, vi } from "vitest";
import {
  createPhotoPreviewUrl,
  initialPhotoUploadState,
  mapPhotoUploadClientError,
  photoUploadReducer,
  validatePhotoFileSelection
} from "@/lib/photos/client-upload";

function file(input: { type: string; size: number; name?: string }) {
  return new File([new Uint8Array(input.size)], input.name ?? "ignored-name.jpg", { type: input.type });
}

describe("portal photo upload UI contracts", () => {
  it("accepts JPEG, PNG and WebP files within the 5 MB limit", () => {
    expect(validatePhotoFileSelection([file({ type: "image/jpeg", size: 1024 })])).toEqual({ ok: true });
    expect(validatePhotoFileSelection([file({ type: "image/png", size: 1024 })])).toEqual({ ok: true });
    expect(validatePhotoFileSelection([file({ type: "image/webp", size: 1024 })])).toEqual({ ok: true });
  });

  it("rejects missing, empty, oversized, multi-file and HEIC selections with safe messages", () => {
    expect(validatePhotoFileSelection([])).toEqual({
      ok: false,
      message: "Fotoğraf seçilemedi. Lütfen tekrar deneyin."
    });
    expect(validatePhotoFileSelection([file({ type: "image/jpeg", size: 0 })])).toEqual({
      ok: false,
      message: "Fotoğraf seçilemedi. Lütfen tekrar deneyin."
    });
    expect(validatePhotoFileSelection([file({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })])).toEqual({
      ok: false,
      message: "Fotoğraf 5 MB sınırını aşıyor."
    });
    expect(validatePhotoFileSelection([file({ type: "image/jpeg", size: 1024 }), file({ type: "image/png", size: 1024 })])).toEqual({
      ok: false,
      message: "Lütfen tek bir fotoğraf seçin."
    });
    expect(validatePhotoFileSelection([file({ type: "image/heic", size: 1024 })])).toEqual({
      ok: false,
      message: "Bu dosya desteklenen fotoğraf formatlarından biri değil."
    });
  });

  it("creates object URLs without exposing the original filename and revokes stale previews", () => {
    const createObjectURL = vi.fn(() => "blob:preview");
    const revokeObjectURL = vi.fn();

    const preview = createPhotoPreviewUrl(file({ type: "image/png", size: 1024, name: "private-name.png" }), {
      createObjectURL,
      revokeObjectURL
    });
    expect(preview).toEqual({ url: "blob:preview", label: "Seçilen fotoğraf", sizeLabel: "1 KB" });
    expect(JSON.stringify(preview)).not.toContain("private-name");

    const next = createPhotoPreviewUrl(file({ type: "image/webp", size: 2048 }), {
      createObjectURL,
      revokeObjectURL,
      previousUrl: preview.url
    });
    expect(next.url).toBe("blob:preview");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("drives the explicit upload state machine and prevents duplicate starts", () => {
    let state = initialPhotoUploadState();
    state = photoUploadReducer(state, { type: "select", file: file({ type: "image/jpeg", size: 1024 }), previewUrl: "blob:one" });
    expect(state.status).toBe("selected");

    state = photoUploadReducer(state, { type: "start_intent" });
    expect(state.status).toBe("requesting_intent");

    const duplicate = photoUploadReducer(state, { type: "start_intent" });
    expect(duplicate).toBe(state);

    state = photoUploadReducer(state, { type: "uploading" });
    state = photoUploadReducer(state, { type: "finalizing" });
    state = photoUploadReducer(state, { type: "success" });
    expect(state).toMatchObject({ status: "success", file: null, uploadCredential: null, intentId: null });
  });

  it("maps raw client errors to safe Turkish messages", () => {
    expect(mapPhotoUploadClientError(new Error("storage token leaked"))).toBe("Yükleme tamamlanamadı. Lütfen tekrar deneyin.");
    expect(mapPhotoUploadClientError("request_invalid")).toBe("Bu fotoğraf talebi artık geçerli değil.");
    expect(mapPhotoUploadClientError("network")).toBe("Bağlantınız kesildi. Lütfen yeniden deneyin.");
  });
});
