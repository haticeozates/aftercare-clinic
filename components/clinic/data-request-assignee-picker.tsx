"use client";

import { useActionState } from "react";
import { assignDataRequestFormAction, type DataRequestFormState } from "@/lib/data-requests/form-actions";
import type { StaffAssigneeOption } from "@/lib/data-requests/labels";
import { FormStatusMessage, SubmitButton } from "@/components/ui";

const initialState: DataRequestFormState = {};

export function DataRequestAssigneePicker({
  dataRequestId,
  staffOptions,
  currentAssigneeUserId
}: {
  dataRequestId: string;
  staffOptions: StaffAssigneeOption[];
  currentAssigneeUserId: string | null;
}) {
  const [state, action, pending] = useActionState(assignDataRequestFormAction, initialState);

  if (staffOptions.length === 0) {
    return <p className="muted">Atanabilir aktif personel bulunamadı.</p>;
  }

  return (
    <form action={action} className="toolbar stack">
      <input type="hidden" name="dataRequestId" value={dataRequestId} />
      <label>
        Sorumlu personel
        <select
          name="assignedToUserId"
          required
          defaultValue={currentAssigneeUserId ?? ""}
          disabled={pending}
        >
          {!currentAssigneeUserId ? (
            <option value="" disabled>
              Personel seçin
            </option>
          ) : null}
          {staffOptions.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
        </select>
      </label>
      <FormStatusMessage success={state.success} error={state.error} />
      <SubmitButton className="secondary" pendingLabel="Atanıyor...">
        Personel ata
      </SubmitButton>
    </form>
  );
}
