export interface ClinicPhotoRecordDto {
  id: string;
  requestLabel: string;
  requestRequired: boolean;
  dayNumber: number;
  uploadedAt: string;
  width: number;
  height: number;
  mimeType: "image/webp";
}

export type ClinicPhotoViewStatus = "idle" | "loading" | "open" | "error" | "expired";

export interface ClinicPhotoViewState {
  status: ClinicPhotoViewStatus;
  signedUrl: string | null;
  expiresAt: string | null;
  error: string | null;
}

export type ClinicPhotoViewAction =
  | { type: "request" }
  | { type: "success"; signedUrl: string; expiresAt: string }
  | { type: "expired" }
  | { type: "error"; error: unknown }
  | { type: "close" };

export function sanitizeClinicPhotoRecord(input: Record<string, unknown>): ClinicPhotoRecordDto {
  return {
    id: String(input.id ?? ""),
    requestLabel: String(input.requestLabel ?? input.request_label ?? "Fotoğraf talebi"),
    requestRequired: Boolean(input.requestRequired ?? input.request_required ?? false),
    dayNumber: Number(input.dayNumber ?? input.day_number ?? 0),
    uploadedAt: String(input.uploadedAt ?? input.uploaded_at ?? ""),
    width: Number(input.width ?? 0),
    height: Number(input.height ?? 0),
    mimeType: "image/webp"
  };
}

export function initialPhotoViewState(): ClinicPhotoViewState {
  return {
    status: "idle",
    signedUrl: null,
    expiresAt: null,
    error: null
  };
}

export function mapClinicPhotoViewError(error: unknown) {
  const code = typeof error === "string" ? error : "";

  if (code === "expired") {
    return "Görüntüleme bağlantısının süresi doldu. Tekrar açabilirsiniz.";
  }

  if (code === "forbidden" || code === "not_found" || code === "request_invalid") {
    return "Fotoğraf kaydı bulunamadı.";
  }

  return "Fotoğraf şu anda görüntülenemiyor. Lütfen tekrar deneyin.";
}

export function photoViewReducer(state: ClinicPhotoViewState, action: ClinicPhotoViewAction): ClinicPhotoViewState {
  if (action.type === "request") {
    if (state.status === "loading") {
      return state;
    }

    return {
      status: "loading",
      signedUrl: null,
      expiresAt: null,
      error: null
    };
  }

  if (action.type === "success") {
    return {
      status: "open",
      signedUrl: action.signedUrl,
      expiresAt: action.expiresAt,
      error: null
    };
  }

  if (action.type === "expired") {
    return {
      status: "expired",
      signedUrl: null,
      expiresAt: null,
      error: mapClinicPhotoViewError("expired")
    };
  }

  if (action.type === "error") {
    return {
      status: "error",
      signedUrl: null,
      expiresAt: null,
      error: mapClinicPhotoViewError(action.error)
    };
  }

  return initialPhotoViewState();
}
