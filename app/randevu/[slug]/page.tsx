import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingForm } from "@/components/appointments/forms";
import { requestAppointment } from "@/lib/appointments/actions";
import { publicBookingEnabled, slotSelection, slugInput } from "@/lib/appointments/contracts";
import { clockLabel, dateLabel, addDays, wallDate } from "@/lib/appointments/calendar";
import type { PublicCatalog } from "@/lib/appointments/service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { consumeSecurityRateLimit } from "@/lib/rate-limit/consume";
import { deriveRateLimitClientFacet } from "@/lib/rate-limit/keys";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";
import "@/components/appointments/appointments.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Online randevu · AfterCare Clinic", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicAppointmentPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!publicBookingEnabled()) notFound();
  const [{ slug }, selection] = await Promise.all([params, searchParams]);
  if (!slugInput.safeParse(slug).success) notFound();
  const db = createAdminSupabaseClient();
  const { data: catalog, error } = await db.rpc("phase12_catalog", { clinic_slug: slug }).maybeSingle<PublicCatalog>();
  if (error) throw new Error("Online randevu sayfası yüklenemedi.");
  if (!catalog) notFound();
  const today = wallDate(new Date(), catalog.zone);
  const selected = slotSelection.safeParse(selection);
  let slots: { starts_at: string }[] = [];
  let unavailable = false;
  if (selected.success && catalog.services.some((service) => service.id === selected.data.procedure_id)
    && catalog.specialists.some((person) => person.id === selected.data.membership_id)) {
    const limit = await consumeSecurityRateLimit({ scope: RATE_LIMIT_SCOPES.APPOINTMENT_DEMO,
      route: "/booking/slots", clientFacet: deriveRateLimitClientFacet(slug) });
    if (limit.allowed) {
      const result = await db.rpc("phase12_slots", { clinic_slug: slug, procedure: selected.data.procedure_id,
        specialist: selected.data.membership_id, local_day: selected.data.date });
      if (!result.error && Array.isArray(result.data)) slots = result.data;
      else unavailable = true;
    } else unavailable = true;
  }
  return (
    <div className="booking-public">
      <main>
        <Link className="brand-block" href="/"><span className="brand-mark" aria-hidden="true">AC</span><strong>AfterCare Clinic</strong></Link>
        <header className="stack">
          <p className="eyebrow">{catalog.name} · Yerel portföy demosu</p>
          <h1>Randevu talebi</h1>
          <p className="booking-public-intro">İşleminizi ve uygun saati seçin. Randevu klinik onayından sonra kesinleşir. Bu akışta yalnızca sentetik demo kodu kullanın.</p>
        </header>
        {catalog.services.length && catalog.specialists.length ? (
          <section className="panel stack" aria-label="Uygun saat arama">
            <h2>Uygun saatleri bulun</h2>
            <form action={`/randevu/${slug}`} className="booking-filter">
              <label>İşlem<select name="procedure_id" required defaultValue={selected.data?.procedure_id ?? catalog.services[0].id}>
                {catalog.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.minutes} dakika</option>)}
              </select></label>
              <label>Uzman<select name="membership_id" required defaultValue={selected.data?.membership_id ?? catalog.specialists[0].id}>
                {catalog.specialists.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select></label>
              <label>Tarih<input type="date" name="date" min={today} max={addDays(today, 60)} defaultValue={selected.data?.date ?? today} required /></label>
              <button className="button" type="submit">Saatleri göster</button>
            </form>
          </section>
        ) : <section className="panel"><p>Klinik henüz online işlem veya uzman saati açmadı.</p></section>}
        {selected.success && <section className="panel stack">
          <h2>{dateLabel(selected.data.date)} · Müsait saatler</h2>
          <p>Saat dilimi · {catalog.zone}</p>
          {unavailable ? <p role="alert">Saatler şu anda yüklenemedi. Bir süre sonra tekrar deneyin.</p> : slots.length ? (
            <BookingForm action={requestAppointment.bind(null, slug)} submit="Randevu talebi gönder">
              <input type="hidden" name="procedure_id" value={selected.data.procedure_id} />
              <input type="hidden" name="membership_id" value={selected.data.membership_id} />
              <fieldset className="booking-fields">
                <legend>Randevu saati</legend><div className="booking-slots">
                  {slots.map((slot) => <label className="booking-slot" key={slot.starts_at}>
                    <input type="radio" name="starts_at" required value={slot.starts_at} />{clockLabel(slot.starts_at, catalog.zone)}
                  </label>)}
                </div>
              </fieldset>
              <label htmlFor="demo-contact">Sentetik danışan kodu</label>
              <input id="demo-contact" name="reference" placeholder="DEMO-1234" pattern="DEMO-[0-9]{4}" maxLength={9} required />
              <small>İsim, telefon, e-posta ve sağlık bilgisi girmeyin.</small>
              <div hidden><label>Web sitesi<input name="website" autoComplete="off" tabIndex={-1} /></label></div>
            </BookingForm>
          ) : <p>Bu seçim için uygun saat bulunamadı. Farklı bir tarih veya uzman seçin.</p>}
        </section>}
      </main>
    </div>
  );
}
