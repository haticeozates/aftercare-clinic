"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { publishConsentVersionFormAction, type ConsentActionState } from "@/lib/consent/actions";
import { trapTabFocus } from "@/lib/consent/clinic-ui";

const initialState: ConsentActionState = {};

export function ConsentPublishDialog({ versionId, documentId }: { versionId: string; documentId: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(publishConsentVersionFormAction, initialState);

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
      <button ref={triggerRef} className="button" type="button" onClick={() => setOpen(true)}>
        Yayınla
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`consent-publish-title-${versionId}`}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Yayın onayı</p>
                <h2 id={`consent-publish-title-${versionId}`}>Versiyonu yayınla</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Yayın penceresini kapat" onClick={closeDialog}>
                ×
              </button>
            </div>
            <p>
              Bu versiyon yayımlandıktan sonra değiştirilemez. Değişiklik için yeni bir taslak versiyon oluşturmanız
              gerekir.
            </p>
            <form action={action} className="stack">
              <input type="hidden" name="versionId" value={versionId} />
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
                  {pending ? "Yayınlanıyor..." : "Evet, yayınla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
