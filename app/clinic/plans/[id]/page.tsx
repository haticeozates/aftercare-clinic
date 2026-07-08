import { stopPlanAction } from "@/lib/plans/actions";
import { planStatusLabel } from "@/lib/plans";
import { getPlanDetail } from "@/lib/plans/service";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatters";
import { LinkActions } from "./link-actions";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { plan, canManageLinks, canStop } = await getPlanDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Bakım planı</p>
        <h1>Plan özeti</h1>
        <p>
          {plan.clientName} · {plan.procedureName} · {plan.templateName} v{plan.versionNumber}
        </p>
        <span className="badge">{planStatusLabel(plan.status)}</span>
      </div>

      <div className="panel stack">
        <h2>Plan bilgileri</h2>
        <p>Başlangıç: {formatDisplayDate(plan.startDate)}</p>
        <p>Bitiş: {formatDisplayDate(plan.endDate)}</p>
        <p>Kontrol tarihi: {formatDisplayDate(plan.controlDate)}</p>
        {canStop ? (
          <form action={stopPlanAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <button className="button secondary" type="submit">
              Planı durdur
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel stack">
        <h2>Plan günleri ve görevleri</h2>
        {plan.days.map((day) => (
          <article className="item-card" key={day.id}>
            <div>
              <h3>{day.title ?? `Gün ${day.dayNumber}`}</h3>
              <p>{formatDisplayDate(day.scheduledDate)}</p>
              <ul>
                {day.tasks.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <LinkActions
        planId={plan.id}
        endDate={plan.endDate}
        activeLink={
          plan.activeLink
            ? {
                ...plan.activeLink,
                expiresAt: formatDisplayDateTime(plan.activeLink.expiresAt)
              }
            : null
        }
        canManage={canManageLinks}
      />
    </section>
  );
}
