import { redirect } from "next/navigation";
import { getCurrentOrganizationContext } from "@/lib/auth/server";
import { listAlerts } from "@/lib/alerts/service";
import { listClients } from "@/lib/clients/service";
import { listPlans } from "@/lib/plans/service";
import { ButtonLink, Card, EmptyState, PageHeader, StatCard, Badge, statusBadgeVariant } from "@/components/ui";
import { planStatusLabel } from "@/lib/plans";
import { formatDisplayDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function ClinicFoundationPage() {
  const context = await getCurrentOrganizationContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "unauthorized") {
    redirect("/unauthorized");
  }

  const [{ plans }, { clients }, openAlerts] = await Promise.all([
    listPlans(),
    listClients({ status: "active" }),
    listAlerts({ status: "open" })
  ]);
  const today = todayIso();
  const activePlans = plans.filter((plan) => plan.status === "active");
  const todaysPlans = plans.filter((plan) => plan.startDate <= today && plan.endDate >= today && plan.status === "active");
  const upcomingControls = plans.filter((plan) => plan.controlDate && plan.status !== "stopped").slice(0, 4);

  return (
    <section className="page-section stack">
      <PageHeader
        eyebrow="Genel Bakış"
        title="Operasyon özeti"
        description={`${context.organization.name} için bakım planı ve takip bildirimlerinin güncel görünümü.`}
        action={
          <div className="button-row">
            <ButtonLink href="/clinic/clients/new">Yeni danışan</ButtonLink>
            <ButtonLink href="/clinic/plans/new" variant="secondary">
              Yeni bakım planı
            </ButtonLink>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard label="Aktif bakım planları" value={activePlans.length} hint="Devam eden planlar" tone="teal" />
        <StatCard label="Bugünkü takipler" value={todaysPlans.length} hint="Bugün görüntülenebilir planlar" tone="sage" />
        <StatCard label="Açık takip bildirimleri" value={openAlerts.length} hint="Klinik değerlendirmesi bekliyor" tone="gold" />
        <StatCard label="Aktif danışanlar" value={clients.length} hint="Arşivlenmemiş temel kayıtlar" tone="neutral" />
      </div>

      <div className="dashboard-grid">
        <Card className="stack">
          <div className="section-header">
            <h2>Son bakım planları</h2>
            <ButtonLink href="/clinic/plans" variant="ghost" size="sm">
              Tümünü gör
            </ButtonLink>
          </div>
          {plans.length === 0 ? (
            <EmptyState title="Plan yok" description="İlk bakım planınızı oluşturarak takip akışını başlatın." />
          ) : (
            <div className="card-list">
              {plans.slice(0, 5).map((plan) => (
                <article className="item-card compact-card" key={plan.id}>
                  <div>
                    <h2>{plan.clientName}</h2>
                    <p>
                      {plan.procedureName} · {formatDisplayDate(plan.startDate)} - {formatDisplayDate(plan.endDate)}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(plan.status)}>{planStatusLabel(plan.status)}</Badge>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="stack">
          <div className="section-header">
            <h2>Takip bildirimleri</h2>
            <ButtonLink href="/clinic/alerts" variant="ghost" size="sm">
              İncele
            </ButtonLink>
          </div>
          {openAlerts.length === 0 ? (
            <EmptyState title="Açık bildirim yok" description="Yapılandırılmış danışan bildirimleri burada görünür." />
          ) : (
            <div className="card-list">
              {openAlerts.slice(0, 5).map((alert) => (
                <article className="item-card compact-card" key={alert.id}>
                  <div>
                    <h2>{alert.clientName}</h2>
                    <p>Gün {alert.dayNumber} · Klinik değerlendirmesi bekliyor</p>
                  </div>
                  <ButtonLink href={`/clinic/alerts/${alert.id}`} variant="secondary" size="sm">
                    Detay
                  </ButtonLink>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="stack">
          <div className="section-header">
            <h2>Yaklaşan kontroller</h2>
          </div>
          {upcomingControls.length === 0 ? (
            <EmptyState title="Yaklaşan kontrol yok" description="Kontrol tarihi olan planlar burada listelenir." />
          ) : (
            <div className="card-list">
              {upcomingControls.map((plan) => (
                <article className="item-card compact-card" key={plan.id}>
                  <div>
                    <h2>{plan.clientName}</h2>
                    <p>{formatDisplayDate(plan.controlDate)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="stack">
          <div className="section-header">
            <h2>Son eklenen danışanlar</h2>
            <ButtonLink href="/clinic/clients" variant="ghost" size="sm">
              Liste
            </ButtonLink>
          </div>
          {clients.length === 0 ? (
            <EmptyState title="Danışan yok" description="Temel danışan kayıtları oluşturulduğunda burada görünür." />
          ) : (
            <div className="card-list">
              {clients.slice(0, 5).map((client) => (
                <article className="item-card compact-card" key={client.id}>
                  <div>
                    <h2>{client.fullName}</h2>
                    <p>{client.maskedPhone}</p>
                  </div>
                  <ButtonLink href={`/clinic/clients/${client.id}`} variant="secondary" size="sm">
                    Detay
                  </ButtonLink>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
