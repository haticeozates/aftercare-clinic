"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState } from "react";
import type { PortalPhotoRequest } from "@/lib/portal";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { PHOTO_BUCKETS } from "@/lib/photos/contracts";
import {
  createPhotoPreviewUrl,
  initialPhotoUploadState,
  mapPhotoUploadClientError,
  photoUploadReducer,
  validatePhotoFileSelection
} from "@/lib/photos/client-upload";
import type { PhotoUploadCredentialDto } from "@/lib/photos/contracts";
import { PhotoFilePicker } from "@/components/care/photo-file-picker";
import { PhotoUploadStatus } from "@/components/care/photo-upload-status";

type FinalizeResponse = { ok: true; status: "ready" | "already_finalized" } | { error?: string };

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function errorFromBody(body: unknown) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : null;
}

export function PhotoUploadCard({
  request,
  mode,
  availability
}: {
  request: PortalPhotoRequest;
  mode: "scheduled" | "active" | "readonly";
  availability: "available" | "locked" | "readonly";
}) {
  const [state, dispatch] = useReducer(photoUploadReducer, undefined, initialPhotoUploadState);
  const [preview, setPreview] = useState<{ url: string; label: string; sizeLabel: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const errorId = `photo-upload-error-${request.id}`;
  const busy = state.status === "requesting_intent" || state.status === "uploading" || state.status === "finalizing";
  const uploaded = state.status === "success" || Boolean(request.uploadedAt);
  const canUpload = mode === "active" && availability === "available" && request.status === "active" && !uploaded;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!busy) {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [busy]);

  function clearSelection() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    selectedFileRef.current = null;
    setPreview(null);
    dispatch({ type: "clear" });
  }

  function onSelect(files: FileList | null) {
    const validation = validatePhotoFileSelection(files);
    if (!validation.ok) {
      clearSelection();
      dispatch({ type: "error", message: validation.message });
      return;
    }

    const file = files?.[0];
    if (!file) {
      return;
    }

    const nextPreview = createPhotoPreviewUrl(file, {
      createObjectURL: URL.createObjectURL.bind(URL),
      revokeObjectURL: URL.revokeObjectURL.bind(URL),
      previousUrl: previewUrlRef.current
    });
    previewUrlRef.current = nextPreview.url;
    selectedFileRef.current = file;
    setPreview(nextPreview);
    dispatch({ type: "select", file, previewUrl: nextPreview.url });
  }

  async function upload() {
    const file = selectedFileRef.current;
    if (!file || busy || !canUpload) {
      return;
    }

    dispatch({ type: "start_intent" });
    try {
      const intentResponse = await fetch("/care/session/photos/intents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoRequestId: request.id,
          declaredMime: file.type,
          sizeBytes: file.size
        })
      });
      const intentBody = await safeJson<PhotoUploadCredentialDto | { error?: string }>(intentResponse);
      if (!intentResponse.ok || !intentBody || !("uploadCredential" in intentBody)) {
        dispatch({ type: "error", message: errorFromBody(intentBody) ?? mapPhotoUploadClientError("request_invalid") });
        return;
      }

      dispatch({ type: "intent_ready", intentId: intentBody.intentId, uploadCredential: intentBody.uploadCredential });
      dispatch({ type: "uploading" });
      const supabase = createBrowserSupabaseClient();
      const uploadResult = await supabase.storage.from(PHOTO_BUCKETS.incoming).uploadToSignedUrl(intentBody.uploadCredential.path, intentBody.uploadCredential.token, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadResult.error) {
        dispatch({ type: "error", message: mapPhotoUploadClientError("upload_failed") });
        return;
      }

      dispatch({ type: "finalizing" });
      const finalizeResponse = await fetch("/care/session/photos/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: intentBody.intentId })
      });
      const finalizeBody = await safeJson<FinalizeResponse>(finalizeResponse);
      if (!finalizeResponse.ok || !finalizeBody || !("ok" in finalizeBody)) {
        dispatch({ type: "error", message: errorFromBody(finalizeBody) ?? mapPhotoUploadClientError("finalize_failed") });
        return;
      }

      clearSelection();
      dispatch({ type: "success" });
    } catch {
      dispatch({ type: "error", message: mapPhotoUploadClientError("network") });
    }
  }

  return (
    <section className="care-section stack" aria-labelledby={`photo-request-${request.id}`}>
      <div className="row-between">
        <div>
          <p className="eyebrow">Güvenli fotoğraf iletimi</p>
          <h2 id={`photo-request-${request.id}`}>Fotoğraf talebi</h2>
        </div>
        <span className="badge">{request.required ? "Zorunlu" : "Opsiyonel"}</span>
      </div>
      <div className="stack">
        <h3>{request.label}</h3>
        <p>Fotoğrafınız yalnızca kliniğinizin değerlendirmesi için güvenli şekilde iletilir. Bu ekran tıbbi değerlendirme veya teşhis sunmaz.</p>
        <p className="label">JPEG, PNG ve WebP desteklenir. HEIC/HEIF desteklenmez. Maksimum boyut 5 MB.</p>
      </div>

      {uploaded ? (
        <div className="notice success-message" role="status">
          Fotoğrafınız güvenli şekilde iletildi.
          {request.uploadedAt ? <span className="label"> Yükleme kaydı alındı.</span> : null}
        </div>
      ) : null}

      {!uploaded && canUpload ? (
        <div className="stack">
          <PhotoFilePicker disabled={busy} errorId={state.error ? errorId : undefined} onSelect={onSelect} />
          {preview ? (
            <div className="portal-task-card">
              <Image alt="" src={preview.url} width={160} height={120} unoptimized className="photo-preview" />
              <div className="stack">
                <strong>{preview.label}</strong>
                <span className="label">{preview.sizeLabel}</span>
                <div className="button-row">
                  <button className="button secondary" type="button" disabled={busy} onClick={clearSelection}>
                    Kaldır
                  </button>
                  <label className="button secondary" aria-disabled={busy}>
                    Değiştir
                    <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => onSelect(event.target.files)} />
                  </label>
                </div>
              </div>
            </div>
          ) : null}
          <PhotoUploadStatus status={state.status} error={state.error} />
          <button className="button" type="button" disabled={busy || state.status !== "selected"} onClick={upload}>
            {busy ? "Yükleniyor..." : "Güvenli şekilde yükle"}
          </button>
        </div>
      ) : null}

      {!uploaded && !canUpload ? <p className="notice">Bu fotoğraf talebi şu anda yükleme için uygun değil.</p> : null}
    </section>
  );
}
