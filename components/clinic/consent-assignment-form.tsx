"use client";

import { useActionState } from "react";
import { createAssignmentFormAction, type AssignmentActionState } from "@/lib/consent/assignment-actions";
import type { AssignmentCreateOption, ClientCarePlanOption } from "@/lib/consent/assignment-service-read";

const initialState: AssignmentActionState = {};

export function ConsentAssignmentForm({
  clientId,
  publishedVersions,
  carePlans
}: {
  clientId: string;
  publishedVersions: AssignmentCreateOption[];
  carePlans: ClientCarePlanOption[];
}) {
  const [state, action, pending] = useActionState(createAssignmentFormAction, initialState);

  if (publishedVersions.length === 0) {
    return (
      <p className="muted">Yayımlanmış aktif belge versiyonu bulunamadı. Önce bir belge yayınlayın.</p>
    );
  }

  return (
    <form action={action} className="form-grid">
      <input type="hidden" name="clientId" value={clientId} />
      <label htmlFor={`assignment-version-${clientId}`}>Belge versiyonu</label>
      <select id={`assignment-version-${clientId}`} name="documentVersionId" required defaultValue="">
        <option value="" disabled>
          Versiyon seçin
        </option>
        {publishedVersions.map((version) => (
          <option key={version.versionId} value={version.versionId}>
            {version.label}
          </option>
        ))}
      </select>
      <label htmlFor={`assignment-plan-${clientId}`}>Bakım planı (opsiyonel)</label>
      <select id={`assignment-plan-${clientId}`} name="carePlanId" defaultValue="">
        <option value="">Genel atama</option>
        {carePlans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.label}
          </option>
        ))}
      </select>
      <label className="checkbox-row">
        <input type="checkbox" name="required" defaultChecked />
        Zorunlu atama
      </label>
      {state.error ? (
        <p className="form-error" role="alert" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="form-success" role="status" aria-live="polite">
          {state.success}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Atanıyor..." : "Belge ata"}
      </button>
    </form>
  );
}
