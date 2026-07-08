"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PortalDocumentAssignment, PortalDocumentDecision, PortalDocumentEvent } from "@/lib/consent/portal-contracts";

const decisionLabels: Record<PortalDocumentDecision, string> = {
  not_recorded: "Bekliyor",
  acknowledged: "Görüldü",
  accepted: "Kabul edildi",
  declined: "Reddedildi",
  withdrawn: "Geri çekildi"
};

function eventForDecision(kind: PortalDocumentAssignment["documentKind"], action: "acknowledge" | "accept" | "decline" | "withdraw"): PortalDocumentEvent {
  if (kind === "notice") {
    return "notice_acknowledged";
  }
  if (action === "accept") {
    return "consent_accepted";
  }
  if (action === "decline") {
    return "consent_declined";
  }
  return "consent_withdrawn";
}

export function PortalDocumentCard({ assignment }: { assignment: PortalDocumentAssignment }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<PortalDocumentDecision>(assignment.currentDecision);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogTitle = `document-dialog-title-${assignment.assignmentId}`;

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  async function submit(action: "acknowledge" | "accept" | "decline" | "withdraw") {
    if (isPending) {
      return;
    }

    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/care/session/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.assignmentId,
          eventType: eventForDecision(assignment.documentKind, action)
        })
      });
      const result = (await response.json().catch(() => null)) as { error?: string; currentDecision?: PortalDocumentDecision } | null;
      if (!response.ok || result?.error) {
        setError(result?.error ?? "Tercihiniz kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      if (result?.currentDecision) {
        setDecision(result.currentDecision);
      }
      setMessage("Tercihiniz kaydedildi.");
      setConfirmWithdrawal(false);
      setOpen(false);
    });
  }

  return (
    <article className="portal-task-card">
      <div className="stack">
        <div className="button-row">
          <span className="badge">{assignment.documentKind === "notice" ? "Bilgilendirme" : "Tercih belgesi"}</span>
          <span className="badge">{assignment.required ? "Zorunlu" : "Opsiyonel"}</span>
          <span className="badge">{decisionLabels[decision]}</span>
        </div>
        <h3>{assignment.title}</h3>
        <p className="label">Versiyon {assignment.versionNumber}</p>
        {assignment.summaryText ? <p>{assignment.summaryText}</p> : null}
      </div>
      <button className="button secondary" type="button" onClick={() => setOpen(true)} aria-label={`${assignment.title} belgesini görüntüle`}>
        Belgeyi görüntüle
      </button>
      {message ? <p className="success-message" aria-live="polite">{message}</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitle}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">{assignment.documentKind === "notice" ? "Bilgilendirme" : "Tercih belgesi"}</p>
                <h2 id={dialogTitle}>{assignment.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Kapat">
                ×
              </button>
            </div>
            <p className="label">Versiyon {assignment.versionNumber}</p>
            <pre className="document-body">{assignment.bodyText}</pre>
            {assignment.documentKind === "notice" ? (
              <button className="button" type="button" disabled={isPending || decision === "acknowledged"} onClick={() => submit("acknowledge")}>
                {isPending ? "Kaydediliyor..." : "Okudum / Görüntüledim"}
              </button>
            ) : (
              <div className="stack">
                <div className="button-row">
                  <button className="button" type="button" disabled={isPending || decision !== "not_recorded"} onClick={() => submit("accept")}>
                    Kabul ediyorum
                  </button>
                  <button className="button secondary" type="button" disabled={isPending || decision !== "not_recorded"} onClick={() => submit("decline")}>
                    Kabul etmiyorum
                  </button>
                </div>
                {decision === "accepted" ? (
                  <div className="notice">
                    <p>Geri çekmek verilerinizi otomatik silmez; talebiniz ayrıca klinik tarafından değerlendirilir.</p>
                    {confirmWithdrawal ? (
                      <div className="button-row">
                        <button className="button secondary" type="button" disabled={isPending} onClick={() => submit("withdraw")}>
                          Geri çekmeyi onayla
                        </button>
                        <button className="button ghost" type="button" disabled={isPending} onClick={() => setConfirmWithdrawal(false)}>
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <button className="button secondary" type="button" disabled={isPending} onClick={() => setConfirmWithdrawal(true)}>
                        Geri çek
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
