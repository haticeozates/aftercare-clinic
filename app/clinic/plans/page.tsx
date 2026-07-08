import Link from "next/link";
import { listPlans } from "@/lib/plans/service";
import { planStatusLabel, type PlanStatus } from "@/lib/plans";
import { formatDisplayDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ status?: PlanStatus }> }) {
  const params = await searchParams;
  const status = ["scheduled", "active", "completed", "stopped"].includes(params.status ?? "")
    ? params.status
    : undefined;
  const { plans, canCreate } = await listPlans(status);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Bakım Planları</p>
        <h1>Bakım planları</h1>
        <p>Danışanlara atanmış bakım planlarını ve takip durumlarını görüntüleyin.</p>
        {canCreate ? (
          <Link className="button" href="/clinic/plans/new">
            Yeni plan oluştur
          </Link>
        ) : null}
      </div>

      <form className="toolbar" action="/clinic/plans">
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Tüm durumlar</option>
          <option value="scheduled">Planlandı</option>
          <option value="active">Aktif</option>
          <option value="completed">Tamamlandı</option>
          <option value="stopped">Durduruldu</option>
        </select>
        <button className="button secondary" type="submit">
          Filtrele
        </button>
      </form>

      <div className="panel">
        {plans.length === 0 ? (
          <div className="empty-state">
            <h2>Plan bulunamadı</h2>
            <p>Filtreyi değiştirin veya yeni bakım planı oluşturun.</p>
          </div>
        ) : (
          <div className="card-list">
            {plans.map((plan) => (
              <article className="item-card" key={plan.id}>
                <div>
                  <h2>{plan.clientName}</h2>
                  <p>
                    {plan.procedureName} · {plan.templateName} v{plan.versionNumber}
                  </p>
                  <span className="badge">{planStatusLabel(plan.status)}</span>
                  <span className="badge">{formatDisplayDate(plan.startDate)}</span>
                  <span className="badge">{formatDisplayDate(plan.endDate)}</span>
                </div>
                <Link className="button secondary" href={`/clinic/plans/${plan.id}`}>
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
