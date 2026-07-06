"use client";

import { useActionState } from "react";
import { createClientFormAction } from "@/lib/clients/actions";

export function ClientForm() {
  const [state, action, pending] = useActionState(createClientFormAction, {});

  return (
    <form className="panel form-grid" action={action}>
      <label htmlFor="fullName">Ad soyad</label>
      <input id="fullName" name="fullName" required minLength={2} maxLength={120} autoComplete="off" />
      <label htmlFor="phone">Telefon</label>
      <input id="phone" name="phone" required inputMode="tel" placeholder="0555 010 00 01" autoComplete="off" />
      <label htmlFor="email">E-posta opsiyonel</label>
      <input id="email" name="email" type="email" placeholder="sentetik@example.test" autoComplete="off" />
      <input name="responsibleMembershipId" type="hidden" value="" />
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Oluşturuluyor" : "Danışan oluştur"}
      </button>
    </form>
  );
}
