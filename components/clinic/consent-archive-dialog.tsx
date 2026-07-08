"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { archiveConsentDocumentFormAction, type ConsentActionState } from "@/lib/consent/actions";
import { trapTabFocus } from "@/lib/consent/clinic-ui";

const initialState: ConsentActionState = {};

export function ConsentArchiveDialog({ documentId }: { documentId: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(archiveConsentDocumentFormAction, initialState);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (dialogRef.current) {
        trapTabFocus(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} className="button secondary" type="button" onClick={() => setOpen(true)}>
        Belgeyi arşivle
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`consent-archive-title-${documentId}`}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Arşiv onayı</p>
                <h2 id={`consent-archive-title-${documentId}`}>Belgeyi arşivle</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Arşiv penceresini kapat" onClick={closeDialog}>
                ×
              </button>
            </div>
            <p>
              Belge arşivlendikten sonra yeni taslak oluşturulamaz veya taslak yayımlanamaz. Mevcut yayımlanmış versiyon
              geçmişi korunur.
            </p>
            <form action={action} className="stack">
              <input type="hidden" name="documentId" value={documentId} />
              {state.error ? (
                <p className="form-error" role="alert" aria-live="polite">
                  {state.error}
                </p>
              ) : null}
              <div className="row-between">
                <button className="button secondary" type="button" onClick={closeDialog}>
                  İptal
                </button>
                <button className="button" type="submit" disabled={pending}>
                  {pending ? "Arşivleniyor..." : "Evet, arşivle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
