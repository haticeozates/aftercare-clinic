"use client";

import { useActionState } from "react";
import { updateClientFormAction } from "@/lib/clients/actions";
import { FeedbackMessage } from "@/components/ui";

export function ClientEditForm({
  client
}: {
  client: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateClientFormAction, {});

  return (
    <div className="panel stack" id="edit-client">
      <h2>Danışan bilgilerini güncelle</h2>
      <form className="form-grid" action={action} noValidate>
        <input type="hidden" name="id" value={client.id} />
        <label htmlFor="fullName">Ad soyad</label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={client.fullName}
          required
          aria-invalid={state.fieldErrors?.fullName ? true : undefined}
          aria-describedby={state.fieldErrors?.fullName ? "fullName-error" : undefined}
        />
        {state.fieldErrors?.fullName ? (
          <p className="form-error" id="fullName-error" role="alert">
            {state.fieldErrors.fullName}
          </p>
        ) : null}
        <label htmlFor="phone">Telefon</label>
        <input
          id="phone"
          name="phone"
          defaultValue={client.phone}
          required
          aria-invalid={state.fieldErrors?.phone ? true : undefined}
          aria-describedby={state.fieldErrors?.phone ? "phone-error" : undefined}
        />
        {state.fieldErrors?.phone ? (
          <p className="form-error" id="phone-error" role="alert">
            {state.fieldErrors.phone}
          </p>
        ) : null}
        <label htmlFor="email">E-posta opsiyonel</label>
        <input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
        <input name="responsibleMembershipId" type="hidden" value="" />
        {state.error ? <FeedbackMessage tone="error">{state.error}</FeedbackMessage> : null}
        {state.success ? <FeedbackMessage tone="success">Danışan bilgileri güncellendi.</FeedbackMessage> : null}
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
