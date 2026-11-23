import Link from "next/link";
import { AppointmentBadge } from "@/components/appointments/display";
import { BookingForm } from "@/components/appointments/forms";
import { updateAppointmentStatus } from "@/lib/appointments/actions";
import { clockLabel, dateLabel, wallDate } from "@/lib/appointments/calendar";
import { eventLabels, transitions, type AppointmentStatus } from "@/lib/appointments/contracts";
import { appointmentContext, appointmentOptions, appointmentStarted, getAppointment } from "@/lib/appointments/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/authorization";

const actionLabels: Partial<Record<AppointmentStatus, string>> = {
  confirmed: "Randevuyu onayla", completed: "Tamamlandı olarak işaretle", cancelled: "Randevuyu iptal et", no_show: "Gelmedi olarak işaretle"
};

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [context, { id }] = await Promise.all([appointmentContext(), params]);
  const item = await getAppointment(context.organization.id, id);
  const db = await createServerSupabaseClient();
  const { data: history, error } = await db.from("appointment_events").select("id,event,starts_at,ends_at,happened_at,membership_id")
    .eq("organization_id", context.organization.id).eq("appointment_id", id).order("id", { ascending: false });
  if (error) throw new Error("Randevu geçmişi yüklenemedi.");
  const canManage = context.manager || context.roster.some((member) => member.own && member.id === item.membership_id);
  const allTransitions = canManage ? transitions[item.status] : [];
  const started = appointmentStarted(item.starts_at);
  const options = allTransitions.includes("confirmed") && !item.client_id ? await appointmentOptions(context.organization.id) : null;
  const canPlan = item.status === "completed" && item.kind === "procedure" && item.client_id && hasPermission(context.membership, "plan.create");
  const specialist = context.roster.find((member) => member.id === item.membership_id)?.name ?? "Önceki ekip üyesi";

  return (
    <section className="page-section stack booking-page">
      <header className="page-header booking-heading">
        <div><p className="eyebrow">{item.kind === "follow_up" ? "Kontrol / takip" : "İşlem randevusu"}</p><h1>Randevu detayı</h1><AppointmentBadge status={item.status} /></div>
        <div className="button-row">
          <Link className="button secondary" href="/clinic/appointments">Takvime dön</Link>
          {allTransitions.length > 0 && <Link className="button secondary" href={`/clinic/appointments/${id}/edit`}>Düzenle veya yeniden planla</Link>}
        </div>
      </header>
      <section className="panel stack">
        <h2>{item.procedures?.name ?? "İşlem"}</h2>
        <dl className="booking-detail">
          <div><dt>Danışan</dt><dd>{item.client_id
            ? <Link href={`/clinic/clients/${item.client_id}`}>{item.clients?.full_name ?? "Danışan kaydı"}</Link>
            : (item.demo_reference ?? "Online talep")}</dd></div>
          <div><dt>Uzman</dt><dd>{specialist}</dd></div>
          <div><dt>Tarih</dt><dd>{dateLabel(wallDate(item.starts_at, context.zone))}</dd></div>
          <div><dt>Saat · {context.zone}</dt><dd>{clockLabel(item.starts_at, context.zone)}–{clockLabel(item.ends_at, context.zone)}</dd></div>
          <div><dt>Kaynak</dt><dd>{item.source === "online_demo" ? "Online demo" : "Klinik"}</dd></div>
        </dl>
        {item.notes && <div><h3>Randevu notu</h3><p className="booking-note">{item.notes}</p></div>}
        {item.care_plan_id && <Link href={`/clinic/plans/${item.care_plan_id}`}>İlgili bakım planını aç</Link>}
        {canPlan && <Link className="button" href={`/clinic/plans/new?appointment=${id}`}>Randevudan bakım planı oluştur</Link>}
      </section>
      {allTransitions.length > 0 && <section className="panel stack">
        <h2>Randevu durumu</h2>
        {item.status === "confirmed" && !started && <p>Tamamlandı ve gelmedi durumları randevu saati geldiğinde açılır.</p>}
        {allTransitions.includes("confirmed") && !started && <BookingForm action={updateAppointmentStatus}>
          <input type="hidden" name="id" value={id} />
          {options && <label htmlFor="confirmation-client">Talebi eşleştirilecek danışan
            <select id="confirmation-client" name="client_id" required>
              <option value="">Danışan seçin</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
            </select>
          </label>}
          <button className="button" type="submit" name="status" value="confirmed">Randevuyu onayla</button>
        </BookingForm>}
        <BookingForm action={updateAppointmentStatus}>
          <input type="hidden" name="id" value={id} />
          <div className="booking-actions">
            {allTransitions.filter((state) => state === "cancelled" || (state !== "confirmed" && started)).map((state) => (
              <button key={state} className="button secondary" type="submit" name="status" value={state}>
                {state === "cancelled" && item.status === "pending" && item.source === "online_demo" ? "Online talebi reddet" : actionLabels[state]}
              </button>
            ))}
          </div>
        </BookingForm>
      </section>}
      <section className="panel stack">
        <h2>İşlem geçmişi</h2>
        <ol className="booking-rule-list">
          {history.map((event) => <li key={event.id}>
            <strong>{eventLabels[event.event]}</strong> · {dateLabel(wallDate(event.happened_at, context.zone))}
            {" "}{clockLabel(event.happened_at, context.zone)} · Randevu:
            {" "}{dateLabel(wallDate(event.starts_at, context.zone), { day: "numeric", month: "short" })}
            {" "}{clockLabel(event.starts_at, context.zone)}–{clockLabel(event.ends_at, context.zone)}
          </li>)}
        </ol>
      </section>
    </section>
  );
}
