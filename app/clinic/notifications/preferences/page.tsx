import Link from "next/link";
import { NoticeForm } from "@/components/notifications/forms";
import { minuteLabel } from "@/lib/appointments/contracts";
import { requireActiveMembership } from "@/lib/auth/server";
import { descriptions, noticeKinds } from "@/lib/notifications/contracts";
import { notificationMailConfig } from "@/lib/notifications/local-mail.mjs";
import { saveNoticePreferences } from "@/lib/notifications/actions";
import { readPreferences, type Preference, type ClinicPreference } from "@/lib/notifications/service";

function PreferenceFields({ scope, value, mail, clinic }: {
  scope: "user" | "clinic"; value: Preference; mail: boolean; clinic?: ClinicPreference;
}) {
  return <NoticeForm action={saveNoticePreferences} submit={scope === "clinic" ? "Klinik tercihlerini kaydet" : "Tercihlerimi kaydet"} primary>
    <input type="hidden" name="scope" value={scope} />
    <fieldset className="notice-pref-grid">
      <legend>Uygulama içinde göster</legend>
      {noticeKinds.map((kind) => <label className="notice-check" key={kind}>
        <input name="kind" type="checkbox" value={kind} disabled={kind === "alert_review"}
          defaultChecked={kind === "alert_review" || !value.muted.includes(kind)} />
        {descriptions[kind][0]}
      </label>)}
    </fieldset>
    <p>Klinik inceleme bildirimleri her zaman görünür.</p>
    {mail && <div className="notice-pref-channel"><label className="notice-check"><input name="email_enabled" type="checkbox" defaultChecked={value.email_enabled} />
      Yerel randevu e-postalarını etkinleştir</label></div>}
    <div className="notice-fields">
      <label>Randevu hatırlatma süresi (dakika)
        <input name="reminder_minutes" type="number" min={5} max={10080}
          placeholder="Klinik varsayılanı" defaultValue={value.reminder_minutes ?? ""} required={scope === "clinic"} />
      </label>
      {clinic && <>
        <label>Günlük bakım hatırlatma saati<input name="daily" type="time" defaultValue={minuteLabel(clinic.daily_minute)} required /></label>
        <label>Sessiz saat başlangıcı<input name="quiet_from" type="time" defaultValue={clinic.quiet_from === null ? "" : minuteLabel(clinic.quiet_from)} /></label>
        <label>Sessiz saat bitişi<input name="quiet_until" type="time" defaultValue={clinic.quiet_until === null ? "" : minuteLabel(clinic.quiet_until)} /></label>
      </>}
    </div>
  </NoticeForm>;
}

export default async function NotificationPreferencesPage() {
  const actor = await requireActiveMembership();
  const prefs = await readPreferences(actor.organization.id, actor.user.id);
  const mail = Boolean(notificationMailConfig());
  return (
    <section className="page-section stack notice-page">
      <header className="notice-heading"><div className="page-header"><h1>Bildirim tercihleri</h1>
        <p>Klinik takibi için görmek istediğiniz bildirimleri ve hatırlatma zamanlarını seçin.</p></div>
        <Link className="ui-button ui-button--secondary" href="/clinic/notifications">Bildirim merkezine dön</Link></header>
      <div className="panel stack"><h2>Kanallar</h2>
        <p>Uygulama içi · Etkin. E-posta · {mail ? "Yerel Mailpit kullanılabilir. Klinik ve kullanıcı onayı gerekir." : "Bu ortamda kapalı."} SMS ve WhatsApp · Kapalı.</p>
      </div>
      <div className="notice-prefs">
        <section className="panel stack"><h2>Kişisel tercihler</h2>
          <PreferenceFields scope="user" value={prefs.user} mail={mail} /></section>
        {actor.membership.roleKey !== "staff" && <section className="panel stack"><h2>Klinik tercihleri</h2>
          <p>Sessiz saatler, klinik saat diliminde e-postayı erteler.</p>
          <PreferenceFields scope="clinic" value={prefs.clinic} clinic={prefs.clinic} mail={mail} /></section>}
      </div>
    </section>
  );
}
