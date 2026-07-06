"use client";

import { useMemo, useState, useActionState } from "react";
import { createPlanAction } from "@/lib/plans/actions";

interface PlanOptionData {
  clients: { id: string; name: string }[];
  procedures: { id: string; name: string }[];
  templates: { id: string; name: string; procedureId: string; versionId: string; versionNumber: number }[];
  memberships: { id: string; label: string }[];
}

export function PlanForm({ options }: { options: PlanOptionData }) {
  const [state, action, pending] = useActionState(createPlanAction, {});
  const [procedureId, setProcedureId] = useState(options.procedures[0]?.id ?? "");
  const filteredTemplates = useMemo(
    () => options.templates.filter((template) => template.procedureId === procedureId),
    [options.templates, procedureId]
  );

  return (
    <form className="panel form-grid" action={action}>
      <label htmlFor="clientId">Danışan</label>
      <select id="clientId" name="clientId" required>
        {options.clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      <label htmlFor="procedureId">İşlem</label>
      <select id="procedureId" name="procedureId" required value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
        {options.procedures.map((procedure) => (
          <option key={procedure.id} value={procedure.id}>
            {procedure.name}
          </option>
        ))}
      </select>

      <label htmlFor="careTemplateId">Şablon</label>
      <select id="careTemplateId" name="careTemplateId" required>
        {filteredTemplates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} v{template.versionNumber}
          </option>
        ))}
      </select>
      <input type="hidden" name="templateVersionId" value={filteredTemplates[0]?.versionId ?? ""} />

      <label htmlFor="startDate">Başlangıç tarihi</label>
      <input id="startDate" name="startDate" type="date" required defaultValue="2026-07-06" />

      <label htmlFor="controlDate">Kontrol tarihi</label>
      <input id="controlDate" name="controlDate" type="datetime-local" />

      <label htmlFor="responsibleMembershipId">Sorumlu çalışan</label>
      <select id="responsibleMembershipId" name="responsibleMembershipId" defaultValue="">
        <option value="">Atanmadı</option>
        {options.memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.label}
          </option>
        ))}
      </select>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={pending || filteredTemplates.length === 0}>
        Plan oluştur
      </button>
    </form>
  );
}
