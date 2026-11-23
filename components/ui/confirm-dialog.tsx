"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { trapTabFocus } from "@/lib/consent/clinic-ui";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function ConfirmDialog({
  triggerLabel,
  triggerClassName = "button secondary",
  dialogTitle,
  dialogDescription,
  confirmLabel,
  cancelLabel = "İptal",
  destructive = false,
  formAction,
  pending = false,
  error,
  success,
  children
}: {
  triggerLabel: string;
  triggerClassName?: string;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  formAction: (formData: FormData) => void;
  pending?: boolean;
  error?: string;
  success?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [prevSuccess, setPrevSuccess] = useState(false);

  if (success && !prevSuccess) {
    setPrevSuccess(true);
    if (open) {
      setOpen(false);
    }
  } else if (!success && prevSuccess) {
    setPrevSuccess(false);
  }

  const prevOpenRef = useRef(open);

  useLayoutEffect(() => {
    if (prevOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  function closeDialog() {
    setOpen(false);
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
      <button ref={triggerRef} className={triggerClassName} type="button" onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Onay gerekli</p>
                <h2 id={titleId}>{dialogTitle}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Onay penceresini kapat" onClick={closeDialog}>
                ×
              </button>
            </div>
            <p>{dialogDescription}</p>
            <form action={formAction} className="stack">
              {children}
              {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
              <div className="row-between confirm-dialog-actions">
                <button className="button secondary" type="button" onClick={closeDialog} disabled={pending}>
                  {cancelLabel}
                </button>
                <button className={destructive ? "button danger" : "button"} type="submit" disabled={pending}>
                  {pending ? "İşleniyor..." : confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
