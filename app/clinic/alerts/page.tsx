import Link from "next/link";
import { alertSeverityLabel, alertStatusLabel, type AlertSeverity, type AlertStatus } from "@/lib/alerts";
import { listAlerts } from "@/lib/alerts/service";

export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ status?: AlertStatus; severity?: AlertSeverity }> }) {
  const params = await searchParams;
  const status = ["open", "acknowledged", "resolved", "dismissed"].includes(params.status ?? "") ? params.status : undefined;
  const severity = ["low", "medium", "high"].includes(params.severity ?? "") ? params.severity : undefined;
  const alerts = await listAlerts({ status, severity });

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Takip Bildirimleri</p>
        <h1>Klinik değerlendirmesi bekleyen bildirimler</h1>
        <p>Bu liste yapılandırılmış portal bildirimlerinden oluşur; sistem tıbbi değerlendirme veya teşhis üretmez.</p>
      </div>

      <form className="toolbar" action="/clinic/alerts">
        <label>
          Durum
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Tüm durumlar</option>
            <option value="open">Klinik değerlendirmesi bekliyor</option>
            <option value="acknowledged">İncelendi</option>
            <option value="resolved">Kapatıldı</option>
            <option value="dismissed">Kapatıldı</option>
          </select>
        </label>
        <label>
          Seviye
          <select name="severity" defaultValue={severity ?? ""}>
            <option value="">Tüm seviyeler</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
          </select>
        </label>
        <button className="button secondary" type="submit">
          Filtrele
        </button>
      </form>

      <div className="panel">
        {alerts.length === 0 ? (
          <div className="empty-state">
            <h2>Takip bildirimi yok</h2>
            <p>Filtreleri değiştirerek tekrar deneyin.</p>
          </div>
        ) : (
          <div className="card-list">
            {alerts.map((alert) => (
              <article className="item-card" key={alert.id}>
                <div>
                  <h2>{alert.clientName}</h2>
                  <p>
                    Gün {alert.dayNumber} · {alert.createdAt}
                  </p>
                  <span className="badge">{alertSeverityLabel(alert.severityLevel)}</span>
                  <span className="badge">{alertStatusLabel(alert.status)}</span>
                </div>
                <Link className="button secondary" href={`/clinic/alerts/${alert.id}`}>
                  Detay
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
