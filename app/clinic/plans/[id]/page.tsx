import Link from "next/link";
import { planStatusLabel } from "@/lib/plans";
import { getPlanDetail } from "@/lib/plans/service";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatters";
import { PhotoRecordCard } from "@/components/clinic/photo-record-card";
import { PhotoRequestCreateForm } from "@/components/clinic/photo-request-create-form";
import { StopPlanDialog } from "@/components/clinic/stop-plan-dialog";
import { Badge, statusBadgeVariant } from "@/components/ui";
import { LinkActions } from "./link-actions";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { plan, canManageLinks, canStop, canCreatePhotoRequest } = await getPlanDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Bakım planı</p>
        <h1>Plan özeti</h1>
        <p>
          {plan.clientName} · {plan.procedureName} · {plan.templateName} v{plan.versionNumber}
        </p>
        <Badge variant={statusBadgeVariant(plan.status)}>{planStatusLabel(plan.status)}</Badge>
      </div>

      <div className="panel stack">
        <h2>Plan bilgileri</h2>
        <p>Başlangıç: {formatDisplayDate(plan.startDate)}</p>
        <p>Bitiş: {formatDisplayDate(plan.endDate)}</p>
        <p>Kontrol tarihi: {formatDisplayDate(plan.controlDate)}</p>
        <Link href={`/clinic/appointments/new?plan=${plan.id}`}>Kontrol randevusu oluştur</Link>
        {canStop ? <StopPlanDialog planId={plan.id} clientName={plan.clientName} /> : null}
      </div>

      <PhotoRequestCreateForm
        planId={plan.id}
        canCreate={canCreatePhotoRequest}
        days={plan.days.map((day) => ({
          id: day.id,
          dayNumber: day.dayNumber,
          title: day.title,
          scheduledDate: formatDisplayDate(day.scheduledDate),
          hasActiveRequest: day.activePhotoRequests.length > 0
        }))}
      />

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
              {day.activePhotoRequests.length > 0 ? (
                <div className="stack compact-stack">
                  <h4>Fotoğraf talebi</h4>
                  {day.activePhotoRequests.map((request) => (
                    <p key={request.id}>
                      {request.label}
                      {request.required ? " · Zorunlu" : " · Opsiyonel"}
                    </p>
                  ))}
                </div>
              ) : null}
              {day.photos.length > 0 ? (
                <div className="stack compact-stack">
                  <h4>Fotoğraf kayıtları</h4>
                  {day.photos.map((photo) => (
                    <PhotoRecordCard key={photo.id} photo={photo} />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <LinkActions
        planId={plan.id}
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
