"use client";

import { useActionState } from "react";
import { createTemplateFormAction } from "@/lib/templates/actions";

export function TemplateForm({ procedures }: { procedures: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createTemplateFormAction, {});

  return (
    <form className="panel form-grid" action={action}>
      <label htmlFor="name">Şablon adı</label>
      <input id="name" name="name" required minLength={2} maxLength={140} autoComplete="off" />

      <label htmlFor="procedureId">Bağlı işlem</label>
      <select id="procedureId" name="procedureId" required defaultValue="">
        <option value="" disabled>
          İşlem seçin
        </option>
        {procedures.map((procedure) => (
          <option key={procedure.id} value={procedure.id}>
            {procedure.name}
          </option>
        ))}
      </select>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? "Oluşturuluyor" : "Taslak oluştur"}
      </button>
    </form>
  );
}
