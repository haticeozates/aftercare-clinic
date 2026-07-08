"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { cancelAssignmentFormAction, type AssignmentActionState } from "@/lib/consent/assignment-actions";
import { trapTabFocus } from "@/lib/consent/clinic-ui";
import type { ClientAssignmentListItem } from "@/lib/consent/assignment-service-read";
import { assignmentStatusLabel } from "@/lib/consent/assignment-contracts";
import { formatDisplayDateTime } from "@/lib/formatters";

const initialState: AssignmentActionState = {};

function ConsentAssignmentCancelDialog({
  assignment,
  clientId,
  onClose
}: {
  assignment: ClientAssignmentListItem;
  clientId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState(cancelAssignmentFormAction, initialState);

  useEffect(() => {
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (dialogRef.current) {
        trapTabFocus(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (state.success) {
      onClose();
    }
  }, [state.success, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`assignment-cancel-title-${assignment.id}`}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row-between">
          <div>
            <p className="eyebrow">İptal onayı</p>
            <h2 id={`assignment-cancel-title-${assignment.id}`}>Atamayı iptal et</h2>
          </div>
          <button className="icon-button" type="button" aria-label="İptal penceresini kapat" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          <strong>{assignment.documentCode}</strong> · v{assignment.versionNumber} bekleyen ataması iptal edilecek.
          Portalda artık görünmez; geçmiş kayıtlar korunur.
        </p>
        <form action={action} className="stack">
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input type="hidden" name="clientId" value={clientId} />
          {state.error ? (
            <p className="form-error" role="alert" aria-live="polite">
              {state.error}
            </p>
          ) : null}
          <div className="row-between">
            <button className="button secondary" type="button" onClick={onClose}>
              Vazgeç
            </button>
            <button className="button danger" type="submit" disabled={pending}>
              {pending ? "İptal ediliyor..." : "Evet, iptal et"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConsentAssignmentList({
  clientId,
  assignments,
  canManage
}: {
  clientId: string;
  assignments: ClientAssignmentListItem[];
  canManage: boolean;
}) {
  const [cancelTarget, setCancelTarget] = useState<ClientAssignmentListItem | null>(null);

  if (assignments.length === 0) {
    return (
      <div className="empty-state">
        <h2>Belge ataması yok</h2>
        <p>Bu danışan için henüz onay veya bilgilendirme belgesi atanmadı.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card-list">
        {assignments.map((assignment) => (
          <article className="item-card" key={assignment.id}>
            <div>
              <h2>
                {assignment.documentCode} · v{assignment.versionNumber}
              </h2>
              <p>
                {assignment.versionTitle} · {formatDisplayDateTime(assignment.assignedAt)}
              </p>
              <div className="badge-row">
                <span className="badge">{assignmentStatusLabel(assignment.status)}</span>
                <span className="badge">{assignment.documentKind === "notice" ? "Bilgilendirme" : "Onay"}</span>
                {assignment.required ? <span className="badge">Zorunlu</span> : null}
                {assignment.carePlanLabel ? <span className="badge">{assignment.carePlanLabel}</span> : null}
              </div>
              {assignment.status === "cancelled" && assignment.cancelledAt ? (
                <p className="muted">
                  İptal edildi · {formatDisplayDateTime(assignment.cancelledAt)}
                  {assignment.cancelledByDisplayName
                    ? ` · İptal eden: ${assignment.cancelledByDisplayName}`
                    : null}
                </p>
              ) : null}
            </div>
            {canManage && assignment.status === "pending" ? (
              <button className="button secondary" type="button" onClick={() => setCancelTarget(assignment)}>
                İptal et
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {cancelTarget ? (
        <ConsentAssignmentCancelDialog
          assignment={cancelTarget}
          clientId={clientId}
          onClose={() => setCancelTarget(null)}
        />
      ) : null}
    </>
  );
}
