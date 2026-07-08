import { PHOTO_ALLOWED_MIME_TYPES, PHOTO_MAX_UPLOAD_BYTES, type PhotoAllowedMimeType, type PhotoUploadCredentialDto } from "@/lib/photos/contracts";
import { mapPhotoUploadClientError } from "@/lib/photos/client-errors";

export { mapPhotoUploadClientError };

export type PhotoUploadUiStatus = "idle" | "selected" | "requesting_intent" | "uploading" | "finalizing" | "success" | "error";

export type PhotoUploadUiState = {
  status: PhotoUploadUiStatus;
  file: File | null;
  previewUrl: string | null;
  uploadCredential: PhotoUploadCredentialDto["uploadCredential"] | null;
  intentId: string | null;
  error: string | null;
};

export type PhotoUploadAction =
  | { type: "select"; file: File; previewUrl: string }
  | { type: "clear" }
  | { type: "start_intent" }
  | { type: "intent_ready"; intentId: string; uploadCredential: PhotoUploadCredentialDto["uploadCredential"] }
  | { type: "uploading" }
  | { type: "finalizing" }
  | { type: "success" }
  | { type: "error"; message: string };

export function initialPhotoUploadState(): PhotoUploadUiState {
  return {
    status: "idle",
    file: null,
    previewUrl: null,
    uploadCredential: null,
    intentId: null,
    error: null
  };
}

export function photoUploadReducer(state: PhotoUploadUiState, action: PhotoUploadAction): PhotoUploadUiState {
  switch (action.type) {
    case "select":
      if (state.status === "requesting_intent" || state.status === "uploading" || state.status === "finalizing") {
        return state;
      }
      return {
        ...initialPhotoUploadState(),
        status: "selected",
        file: action.file,
        previewUrl: action.previewUrl
      };
    case "clear":
      if (state.status === "requesting_intent" || state.status === "uploading" || state.status === "finalizing") {
        return state;
      }
      return initialPhotoUploadState();
    case "start_intent":
      if (state.status !== "selected") {
        return state;
      }
      return { ...state, status: "requesting_intent", error: null };
    case "intent_ready":
      if (state.status !== "requesting_intent") {
        return state;
      }
      return { ...state, intentId: action.intentId, uploadCredential: action.uploadCredential };
    case "uploading":
      if (state.status !== "requesting_intent" && state.status !== "selected") {
        return state;
      }
      return { ...state, status: "uploading", error: null };
    case "finalizing":
      if (state.status !== "uploading") {
        return state;
      }
      return { ...state, status: "finalizing", error: null };
    case "success":
      return {
        ...initialPhotoUploadState(),
        status: "success"
      };
    case "error":
      return {
        ...state,
        status: "error",
        uploadCredential: null,
        intentId: null,
        error: action.message
      };
  }
}

export function validatePhotoFileSelection(files: File[] | FileList | null): { ok: true } | { ok: false; message: string } {
  const selected = files ? Array.from(files) : [];
  if (selected.length === 0) {
    return { ok: false, message: "Fotoğraf seçilemedi. Lütfen tekrar deneyin." };
  }

  if (selected.length > 1) {
    return { ok: false, message: "Lütfen tek bir fotoğraf seçin." };
  }

  const file = selected[0];
  if (!file || file.size <= 0) {
    return { ok: false, message: "Fotoğraf seçilemedi. Lütfen tekrar deneyin." };
  }

  if (file.size > PHOTO_MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Fotoğraf 5 MB sınırını aşıyor." };
  }

  if (!PHOTO_ALLOWED_MIME_TYPES.includes(file.type as PhotoAllowedMimeType)) {
    return { ok: false, message: "Bu dosya desteklenen fotoğraf formatlarından biri değil." };
  }

  return { ok: true };
}

export function formatPhotoSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function createPhotoPreviewUrl(
  file: File,
  urlApi: {
    createObjectURL(file: File): string;
    revokeObjectURL(url: string): void;
    previousUrl?: string | null;
  }
) {
  if (urlApi.previousUrl) {
    urlApi.revokeObjectURL(urlApi.previousUrl);
  }

  return {
    url: urlApi.createObjectURL(file),
    label: "Seçilen fotoğraf",
    sizeLabel: formatPhotoSize(file.size)
  };
}
