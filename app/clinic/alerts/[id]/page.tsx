import { reviewAlertAction } from "@/lib/alerts/actions";
import { alertSeverityLabel, alertStatusLabel, resolutionCodeLabel, type AlertResolutionCode } from "@/lib/alerts";
import { getAlertDetail } from "@/lib/alerts/service";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const resolutionCodes: AlertResolutionCode[] = [
  "reviewed_no_action",
  "client_contact_planned",
  "follow_up_planned",
  "duplicate_report",
  "other_internal"
];

function ReviewForm({ alertId, action, label, needsReason = false }: { alertId: string; action: string; label: string; needsReason?: boolean }) {
  return (
    <form action={reviewAlertAction} className="inline-form">
      <input type="hidden" name="alertId" value={alertId} />
      <input type="hidden" name="action" value={action} />
      {needsReason ? (
        <label>
          Kapatma nedeni
          <select name="resolutionCode" defaultValue="reviewed_no_action">
            {resolutionCodes.map((code) => (
              <option value={code} key={code}>
                {resolutionCodeLabel(code)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button className="button secondary" type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alert = await getAlertDetail(id);
  const isOpen = alert.status === "open";
  const canClose = alert.status === "open" || alert.status === "acknowledged";

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Takip Bildirimi</p>
        <h1>Takip bildirimi detayı</h1>
        <p>Bu ekran yapılandırılmış bildirim kaydını gösterir; sistem tıbbi değerlendirme veya teşhis sunmaz.</p>
        <div className="button-row" aria-label="Bildirim durumu">
          <span className="badge">{alertStatusLabel(alert.status)}</span>
          <span className={`severity-badge severity-badge--${alert.severityLevel}`}>
            Seviye: {alertSeverityLabel(alert.severityLevel)}
          </span>
        </div>
      </div>

      <div className="panel stack">
        <div className="detail-grid">
          <div>
            <span className="label">Danışan</span>
            <strong>{alert.clientName}</strong>
          </div>
          <div>
            <span className="label">Plan</span>
            <strong>
              {formatDisplayDate(alert.planStartDate)} - {formatDisplayDate(alert.planEndDate)}
            </strong>
          </div>
          <div>
            <span className="label">Plan günü</span>
            <strong>Gün {alert.dayNumber}</strong>
          </div>
          <div>
            <span className="label">Seviye</span>
            <strong>{alertSeverityLabel(alert.severityLevel)}</strong>
          </div>
        </div>

        <section className="stack" aria-labelledby="structured-items-heading">
          <h2 id="structured-items-heading">Yapılandırılmış bildirim</h2>
          <div className="card-list">
            {alert.reportItems.map((item) => (
              <article className="item-card" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.selected ? "Seçildi" : "Seçilmedi"}</p>
                </div>
                {item.severity ? <span className="badge">Şiddet {item.severity}</span> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="stack" aria-labelledby="alert-events-heading">
          <h2 id="alert-events-heading">Durum geçmişi</h2>
          <div className="card-list">
            {alert.events.map((event) => (
              <article className="item-card" key={`${event.eventType}-${event.occurredAt}`}>
                <div>
                  <strong>{event.eventType}</strong>
                  <p>
                    {event.previousStatus ?? "-"} → {event.newStatus}
                  </p>
                </div>
                <span className="badge">{formatDisplayDateTime(event.occurredAt)}</span>
              </article>
            ))}
          </div>
        </section>

        {isOpen || canClose ? (
          <div className="button-row">
            {isOpen ? <ReviewForm alertId={alert.id} action="acknowledge" label="İncelendi olarak işaretle" /> : null}
            {canClose ? <ReviewForm alertId={alert.id} action="resolve" label="Çözüldü olarak kapat" needsReason /> : null}
            {canClose ? <ReviewForm alertId={alert.id} action="dismiss" label="Bildirimi kapat" needsReason /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
