"use client";

/* eslint-disable @next/next/no-img-element -- Signed photo URLs should stay in browser memory and bypass image optimizer caching. */

import { useEffect, useReducer, useRef } from "react";
import { initialPhotoViewState, photoViewReducer, type ClinicPhotoRecordDto } from "@/lib/photos/clinic-view";
import { formatDisplayDateTime } from "@/lib/formatters";

interface PhotoViewResponse {
  ok?: boolean;
  photo?: {
    id: string;
    signedUrl: string;
    expiresAt: string;
    mimeType: "image/webp";
    width: number;
    height: number;
    uploadedAt: string;
  };
  error?: string;
}

export function SecurePhotoViewer({ photo }: { photo: ClinicPhotoRecordDto }) {
  const [state, dispatch] = useReducer(photoViewReducer, undefined, initialPhotoViewState);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const open = state.status === "open" && Boolean(state.signedUrl);

  useEffect(() => {
    if (!open) {
      return;
    }

    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "close" });
        window.setTimeout(() => buttonRef.current?.focus(), 0);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (state.status !== "idle") {
      return;
    }
    buttonRef.current?.focus();
  }, [state.status]);

  async function requestViewUrl() {
    if (state.status === "loading") {
      return;
    }

    dispatch({ type: "request" });
    try {
      const response = await fetch(`/clinic/photos/${photo.id}/view-url`, {
        method: "POST",
        headers: { "content-type": "application/json" }
      });
      const payload = (await response.json().catch(() => null)) as PhotoViewResponse | null;

      if (!response.ok || !payload?.ok || !payload.photo?.signedUrl) {
        dispatch({ type: "error", error: payload?.error ?? "request_invalid" });
        return;
      }

      dispatch({
        type: "success",
        signedUrl: payload.photo.signedUrl,
        expiresAt: payload.photo.expiresAt
      });
    } catch {
      dispatch({ type: "error", error: "network" });
    }
  }

  function closeDialog() {
    dispatch({ type: "close" });
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        ref={buttonRef}
        className="ui-button ui-button--secondary"
        type="button"
        onClick={requestViewUrl}
        disabled={state.status === "loading"}
        aria-describedby={`photo-status-${photo.id}`}
      >
        {state.status === "loading" ? "Açılıyor..." : "Güvenli görüntüle"}
      </button>
      <p className="muted" id={`photo-status-${photo.id}`} aria-live="polite">
        {state.status === "loading" ? "Kısa süreli görüntüleme bağlantısı hazırlanıyor." : null}
        {state.status === "error" || state.status === "expired" ? state.error : null}
      </p>

      {open ? (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-label="Güvenli fotoğraf görüntüleme"
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Güvenli fotoğraf görüntüleme</p>
                <h2>{photo.requestLabel}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fotoğraf görüntüleme penceresini gizle" onClick={closeDialog}>
                ×
              </button>
            </div>
            <div className="secure-photo-frame">
              <img src={state.signedUrl ?? undefined} alt="Klinik tarafından iletilen güvenli fotoğraf kaydı" />
            </div>
            <div className="metadata-grid">
              <p>
                <span>Yüklenme</span>
                <strong>{formatDisplayDateTime(photo.uploadedAt)}</strong>
              </p>
              <p>
                <span>Plan günü</span>
                <strong>{photo.dayNumber}. gün</strong>
              </p>
              <p>
                <span>Durum</span>
                <strong>Klinik içinde güvenli kayıt</strong>
              </p>
            </div>
            <p className="muted">
              Bu bağlantı kısa sürelidir. Süresi dolarsa fotoğrafı tekrar açmak için yeniden yetkilendirme yapılır.
            </p>
            <button className="ui-button ui-button--secondary" type="button" onClick={closeDialog}>
              Kapat
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
