import Link from "next/link";
import { BookingForm } from "@/components/appointments/forms";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveAvailability } from "@/lib/appointments/actions";
import { minuteLabel, publicBookingEnabled, weekdays } from "@/lib/appointments/contracts";
import { appointmentContext, appointmentOptions, type Rule } from "@/lib/appointments/service";
import "@/components/appointments/appointments.css";

const ruleLabels: Record<Rule["kind"], string> = {
  work: "Çalışma saati", break: "Mola", closed: "İzin / özel kapalı tarih"
};

export default async function AvailabilityPage() {
  await requireOrganizationPermission("organization.update");
  const { organization, roster, zone } = await appointmentContext();
  const db = await createServerSupabaseClient();
  const [options, dateRules, settings] = await Promise.all([
    appointmentOptions(organization.id),
    db.from("appointment_availability").select("id,membership_id,weekday,local_date,kind,start_minute,end_minute")
      .eq("organization_id", organization.id).order("weekday").order("local_date").order("start_minute").returns<Rule[]>(),
    db.from("appointment_settings").select("public_demo").eq("organization_id", organization.id).maybeSingle()
  ]);
  if (dateRules.error || settings.error) throw new Error("Müsaitlik ayarları yüklenemedi.");
  const demoEnabled = publicBookingEnabled();
  const clinicPublic = Boolean(settings.data?.public_demo);

  return (
    <section className="page-section stack booking-page">
      <header className="page-header booking-heading">
        <div><h1>Müsaitlik ayarları</h1><p>Klinik ve uzman programının kesişimine randevu verilir · {zone}</p></div>
        <Link className="button secondary" href="/clinic/appointments">Takvime dön</Link>
      </header>
      <div className="booking-settings-grid">
        <section className="panel stack">
          <h2>Çalışma saati, mola veya izin ekle</h2>
          <p>Haftalık kurallar için gün, tek seferlik izin ve tatiller için tarih seçin. Tam gün kapanış için 00:00–24:00 kullanın.</p>
          <BookingForm action={saveAvailability} submit="Kuralı ekle">
            <input type="hidden" name="operation" value="rule" />
            <div className="booking-grid">
              <label htmlFor="availability-scope">Kural kapsamı</label>
              <select id="availability-scope" name="membership_id">
                <option value="">Klinik geneli</option>{roster.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <label htmlFor="availability-kind">Kural türü</label>
              <select id="availability-kind" name="kind">
                {Object.entries(ruleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label htmlFor="availability-weekday">Haftanın günü</label>
              <select id="availability-weekday" name="weekday">
                {weekdays.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
              <label htmlFor="availability-date">Özel tarih</label>
              <input id="availability-date" type="date" name="local_date" />
              <label htmlFor="availability-start">Başlangıç (SS:DD)</label>
              <input id="availability-start" name="start" defaultValue="09:00" maxLength={5} required />
              <label htmlFor="availability-end">Bitiş (SS:DD)</label>
              <input id="availability-end" name="end" defaultValue="18:00" maxLength={5} required />
            </div>
          </BookingForm>
        </section>
        <section className="panel stack">
          <h2>İşlem süreleri</h2>
          <BookingForm action={saveAvailability} submit="İşlem ayarını kaydet">
            <input type="hidden" name="operation" value="service" />
            <label htmlFor="availability-service">İşlem</label>
            <select id="availability-service" name="procedure_id" required>
              <option value="">İşlem seçin</option>{options.procedures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label htmlFor="availability-length">Varsayılan süre (dakika)</label>
            <input id="availability-length" type="number" name="minutes" min={5} max={480} step={5} defaultValue={30} required />
            {demoEnabled && <label className="booking-slot"><input type="checkbox" name="public_demo" /> İşlemi online demoda göster</label>}
          </BookingForm>
          {options.services.length > 0 && <ul className="booking-rule-list" aria-label="Kayıtlı işlem süreleri">
            {options.services.map((service) => <li key={service.procedure_id}>
              {options.procedures.find((item) => item.id === service.procedure_id)?.name ?? "Arşivli işlem"}
              {" · "}{service.minutes} dk{service.public_demo ? " · Online demo" : ""}
            </li>)}
          </ul>}
        </section>
      </div>
      <section className="panel stack">
        <h2>Kayıtlı müsaitlik kuralları</h2>
        {!dateRules.data.length && <p>Klinik ve her randevu uzmanı için en az bir çalışma aralığı ekleyin.</p>}
        <ul className="booking-rule-list">
          {dateRules.data.map((rule) => <li key={rule.id} className="booking-heading">
            <div><strong>{rule.membership_id ? roster.find((member) => member.id === rule.membership_id)?.name ?? "Önceki ekip üyesi" : "Klinik geneli"}</strong>
              <p>{ruleLabels[rule.kind]} · {rule.weekday ? weekdays[rule.weekday - 1] : rule.local_date}
                {" · "}{minuteLabel(rule.start_minute)}–{minuteLabel(rule.end_minute)}</p></div>
            <BookingForm action={saveAvailability} submit="Kuralı kaldır">
              <input type="hidden" name="operation" value="remove" /><input type="hidden" name="id" value={rule.id} />
            </BookingForm>
          </li>)}
        </ul>
      </section>
      {demoEnabled && <section className="panel stack">
        <h2>Online randevu demosu</h2>
        <p>Bu bağlantıda yalnızca sentetik danışan kodu alınır. İşlemleri yukarıdaki süre ayarından tek tek açabilirsiniz.</p>
        <BookingForm action={saveAvailability} submit="Online görünürlüğü kaydet">
          <input type="hidden" name="operation" value="public" />
          <label className="booking-slot"><input type="checkbox" name="public_demo" defaultChecked={clinicPublic} /> Klinik bağlantısını etkinleştir</label>
        </BookingForm>
        {clinicPublic && <Link href={`/randevu/${organization.slug}`}>Kliniğin online demo bağlantısı</Link>}
      </section>}
    </section>
  );
}
