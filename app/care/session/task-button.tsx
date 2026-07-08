"use client";

import { useActionState } from "react";
import type { PortalDayAvailability, PortalPlan, PortalTask } from "@/lib/portal";
import {
  completePortalTaskFormAction,
  reopenPortalTaskFormAction,
  type PortalTaskActionState
} from "@/lib/portal/actions";

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
  const [completeState, completeAction, completing] = useActionState(completePortalTaskFormAction, initialState);
  const [reopenState, reopenAction, reopening] = useActionState(reopenPortalTaskFormAction, initialState);
  const pending = completing || reopening;
  const error = completeState.error ?? reopenState.error;
  const localStatus = reopenState.taskStatus === "pending" ? "pending" : completeState.taskStatus === "completed" ? "completed" : task.status;

  if (mode === "readonly") {
    return <p className="notice">Bu plan şu anda yalnızca görüntülenebilir.</p>;
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
          <button className="button secondary" type="submit" disabled={pending}>
            Geri al
          </button>
        </form>
      ) : (
        <form action={completeAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <button className="button" type="submit" disabled={pending}>
            {task.taskType === "information" ? "Okudum" : "Tamamlandı olarak işaretle"}
          </button>
        </form>
      )}
      {completeState.taskStatus === "completed" ? <p className="notice">Görev tamamlandı.</p> : null}
      {reopenState.taskStatus === "pending" ? <p className="notice">Görev tekrar bekliyor.</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
