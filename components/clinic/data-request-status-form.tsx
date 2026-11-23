"use client";

import { useActionState } from "react";
import { transitionDataRequestFormAction, type DataRequestFormState } from "@/lib/data-requests/form-actions";
import { dataRequestStatusLabel } from "@/lib/data-requests/labels";
import type { DataRequestStatus } from "@/lib/data-requests";
import { FormStatusMessage, SubmitButton } from "@/components/ui";

const initialState: DataRequestFormState = {};

export function DataRequestStatusForm({
  dataRequestId,
  nextStatuses
}: {
  dataRequestId: string;
  nextStatuses: DataRequestStatus[];
}) {
  const [state, action, pending] = useActionState(transitionDataRequestFormAction, initialState);

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <form action={action} data-request-id={dataRequestId} className="toolbar stack">
      <input type="hidden" name="dataRequestId" value={dataRequestId} />
      <label>
        Yeni durum
        <select name="status" defaultValue={nextStatuses[0]} disabled={pending}>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {dataRequestStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <FormStatusMessage success={state.success} error={state.error} />
      <SubmitButton className="secondary" pendingLabel="Güncelleniyor...">
        Durumu güncelle
      </SubmitButton>
    </form>
  );
}
