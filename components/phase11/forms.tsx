"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import type { Phase11State } from "@/lib/phase11/config";
import type { ClinicDetails } from "@/lib/phase11/clinic-data";

export function DemoForm({
  action, children, submit, className = "form-grid"
}: {
  action: (state: Phase11State, data: FormData) => Promise<Phase11State>;
  children: ReactNode;
  submit?: string;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.error) form.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [state]);
  return (
    <form ref={form} action={dispatch} className={className} aria-busy={pending}>
      <fieldset className="phase11-fields" disabled={pending}>
        {children}
        {submit && <button className="ui-button ui-button--primary" type="submit">
          {pending ? "İşlem sürüyor…" : submit}
        </button>}
      </fieldset>
      {pending && <p role="status" className="phase11-pending">İşlem sürüyor…</p>}
      {state.error && <p className="form-error" role="alert" tabIndex={-1}>{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
    </form>
  );
}

export function DemoEmailFields() {
  return (
    <>
      <label className="form-field">
        <span>E-posta</span>
        <input type="email" name="email" autoComplete="email" placeholder="ornek@klinik.test" maxLength={254} required />
      </label>
      <div hidden>
        <label>Web sitesi <input type="text" name="website" autoComplete="off" tabIndex={-1} /></label>
      </div>
    </>
  );
}

export function PasswordFields() {
  const field = useId();
  const hint = useId();
  return (
    <>
      <div className="form-field">
        <label htmlFor={field}>Yeni parola</label>
        <input id={field} aria-describedby={hint} type="password" name="password"
          minLength={12} maxLength={72} autoComplete="new-password" required />
        <small id={hint}>En az 12 karakter kullanın.</small>
      </div>
      <label className="form-field">
        <span>Yeni parolayı tekrar girin</span>
        <input type="password" name="confirm" minLength={12} maxLength={72} autoComplete="new-password" required />
      </label>
    </>
  );
}

export function ClinicFields({ defaults }: { defaults?: ClinicDetails }) {
  return (
    <div className="phase11-grid">
      <label className="form-field">
        <span>Klinik adı</span>
        <input name="clinic_name" autoComplete="organization" minLength={2} maxLength={120} defaultValue={defaults?.clinic_name} required />
      </label>
      <label className="form-field">
        <span>Ad soyad</span>
        <input name="profile_name" autoComplete="name" minLength={2} maxLength={120} defaultValue={defaults?.profile_name} required />
      </label>
      <label className="form-field">
        <span>Klinik adresi <small>(isteğe bağlı)</small></span>
        <input name="clinic_address" autoComplete="street-address" maxLength={240} defaultValue={defaults?.clinic_address} />
      </label>
      <label className="form-field">
        <span>Klinik telefonu <small>(isteğe bağlı)</small></span>
        <input name="clinic_phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={defaults?.clinic_phone} />
      </label>
      <label className="form-field">
        <span>Klinik saat dilimi</span>
        <select name="clinic_zone" defaultValue={defaults?.clinic_zone ?? "Europe/Istanbul"}>
          <option value="Europe/Istanbul">İstanbul</option>
          <option value="Europe/London">Londra</option>
          <option value="Europe/Berlin">Berlin</option>
          <option value="UTC">UTC</option>
        </select>
        <small>Mevcut bakım planı tarihleri İstanbul saatini kullanır.</small>
      </label>
    </div>
  );
}
