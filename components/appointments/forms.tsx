"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { saveAppointment, type FormState } from "@/lib/appointments/actions";
import type { appointmentOptions, Appointment, Roster } from "@/lib/appointments/service";

export function BookingForm({ action, children, submit }: {
  action: (previous: FormState, data: FormData) => Promise<FormState>;
  children: ReactNode; submit?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) feedback.current?.focus();
  }, [state]);

  return (
    <form className="form-grid booking-form" action={dispatch} aria-busy={pending}>
      <fieldset className="booking-fields" disabled={pending}>
        {children}
        {submit && <button className="button" type="submit">{pending ? "Kaydediliyor…" : submit}</button>}
      </fieldset>
      {!submit && pending && <p role="status">Kaydediliyor…</p>}
      {state.error && <p ref={feedback} tabIndex={-1} role="alert" className="form-error">{state.error}</p>}
      {state.success && <p role="status" className="form-success">{state.success}</p>}
    </form>
  );
}

type Options = Awaited<ReturnType<typeof appointmentOptions>>;
export function AppointmentEditor({ options, roster, base, start, initialClient, initialPlan }: {
  options: Options; roster: Roster[]; base?: Appointment; start: string;
  initialClient?: string; initialPlan?: string;
}) {
  const plan = options.plans.find((item) => item.id === initialPlan);
  const [client, setClient] = useState(base?.client_id ?? plan?.client_id ?? initialClient ?? "");
  const [procedure, setProcedure] = useState(base?.procedure_id ?? plan?.procedure_id ?? "");
  const [kind, setKind] = useState(base?.kind ?? (plan ? "follow_up" : "procedure"));
  const [minutes, setMinutes] = useState(base
    ? (Date.parse(base.ends_at) - Date.parse(base.starts_at)) / 60_000
    : options.services.find((service) => service.procedure_id === plan?.procedure_id)?.minutes ?? 30);
  const plans = options.plans.filter((candidate) => candidate.client_id === client && candidate.procedure_id === procedure);
  const waitlistRequest = base?.status === "pending" && base.source === "online_demo";
  const boundOnline = base?.source === "online_demo";

  return (
    <BookingForm action={saveAppointment} submit={base ? "Değişiklikleri kaydet" : "Randevuyu oluştur"}>
      {base && <input type="hidden" name="id" value={base.id} />}
      <div className="booking-grid">
        <label htmlFor="appointment-client">Danışan</label>
        <select id="appointment-client" name="client_id" required={!waitlistRequest} value={client}
          onChange={(event) => setClient(event.target.value)}>
          <option value="">Danışan seçin</option>
          {options.clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>
        <label htmlFor="appointment-procedure">İşlem</label>
        <select id="appointment-procedure" name="procedure_id" value={procedure} disabled={boundOnline} required
          onChange={(event) => {
            const id = event.target.value;
            setProcedure(id);
            setMinutes(options.services.find((service) => service.procedure_id === id)?.minutes ?? 30);
          }}>
          <option value="">İşlem seçin</option>
          {options.procedures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {boundOnline && <input type="hidden" name="procedure_id" value={procedure} />}
        <label htmlFor="appointment-specialist">Uzman</label>
        <select id="appointment-specialist" name="membership_id" defaultValue={base?.membership_id ?? roster.find((member) => member.own)?.id}
          required disabled={boundOnline}>
          {roster.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {boundOnline && <input type="hidden" name="membership_id" value={base.membership_id} />}
        <label htmlFor="appointment-start">Başlangıç tarihi ve saati</label>
        <input id="appointment-start" type="datetime-local" name="local_start" defaultValue={start} required />
        <label htmlFor="appointment-length">Süre (dakika)</label>
        <input id="appointment-length" type="number" name="minutes" min={5} max={480} step={5}
          value={minutes} onChange={(event) => setMinutes(event.target.valueAsNumber || 0)} required />
        <label htmlFor="appointment-kind">Randevu türü</label>
        <select id="appointment-kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="procedure">İşlem randevusu</option><option value="follow_up">Kontrol / takip</option>
        </select>
        {kind === "follow_up" ? <>
          <label htmlFor="appointment-plan">İlgili bakım planı</label>
          <select id="appointment-plan" name="care_plan_id" defaultValue={base?.care_plan_id ?? initialPlan ?? ""}>
            <option value="">Plan seçilmedi</option>
            {plans.map((item) => <option key={item.id} value={item.id}>{item.start_date} başlayan plan</option>)}
          </select>
        </> : <input type="hidden" name="care_plan_id" value="" />}
        <label htmlFor="appointment-notes">Randevu notu</label>
        <textarea id="appointment-notes" name="notes" maxLength={1000} defaultValue={base?.notes} rows={3} />
      </div>
    </BookingForm>
  );
}
