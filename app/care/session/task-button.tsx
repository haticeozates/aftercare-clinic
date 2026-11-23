"use client";

import { useActionState } from "react";
import type { PortalDayAvailability, PortalPlan, PortalTask } from "@/lib/portal";
import {
  completePortalTaskFormAction,
  reopenPortalTaskFormAction,
  type PortalTaskActionState
} from "@/lib/portal/actions";
import { FeedbackMessage, SubmitButton } from "@/components/ui";

export function PortalTaskButton({
  task,
  mode,
  availability
}: {
  task: PortalTask;
  mode: PortalPlan["mode"];
  availability: PortalDayAvailability;
}) {
  const initialState: PortalTaskActionState = {};
  const [completeState, completeAction] = useActionState(completePortalTaskFormAction, initialState);
  const [reopenState, reopenAction] = useActionState(reopenPortalTaskFormAction, initialState);
  const error = completeState.error ?? reopenState.error;
  const localStatus = reopenState.taskStatus === "pending" ? "pending" : completeState.taskStatus === "completed" ? "completed" : task.status;

  if (mode === "readonly") {
    return <FeedbackMessage tone="info">Bu plan şu anda yalnızca görüntülenebilir.</FeedbackMessage>;
  }

  if (mode === "scheduled" || availability === "locked") {
    return (
      <div className="stack">
        <button className="button secondary" type="button" disabled aria-describedby={`locked-${task.id}`}>
          Kilitli
        </button>
        <p className="label" id={`locked-${task.id}`}>
          Henüz açılmadı
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      {localStatus === "completed" ? (
        <form action={reopenAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <SubmitButton className="secondary" pendingLabel="Geri alınıyor...">
            Geri al
          </SubmitButton>
        </form>
      ) : (
        <form action={completeAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <SubmitButton pendingLabel="Kaydediliyor...">
            {task.taskType === "information" ? "Okudum" : "Tamamlandı olarak işaretle"}
          </SubmitButton>
        </form>
      )}
      {completeState.taskStatus === "completed" ? (
        <FeedbackMessage tone="success">Görev tamamlandı.</FeedbackMessage>
      ) : null}
      {reopenState.taskStatus === "pending" ? (
        <FeedbackMessage tone="success">Görev tekrar bekliyor.</FeedbackMessage>
      ) : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
    </div>
  );
}
