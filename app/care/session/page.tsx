import { redirect } from "next/navigation";
import { getPortalPlan } from "@/lib/portal/service";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatters";
import { PortalTaskButton } from "@/app/care/session/task-button";
import { CheckInForm } from "@/app/care/session/check-in-form";
import { PhotoUploadCard } from "@/components/care/photo-upload-card";
import { PortalDocumentsSection } from "@/components/care/portal-documents-section";
import { PortalDataRequestForm } from "@/components/care/portal-data-request-form";
import { getPortalDocumentAssignments } from "@/lib/consent/portal-service";
import { getPortalDataRequests } from "@/lib/data-requests/portal-service";

export const dynamic = "force-dynamic";

export default async function CareSessionPage() {
  const plan = await getPortalPlan();
  if (!plan) {
    redirect("/care/invalid");
  }

  const [documentAssignments, dataRequests] = await Promise.all([getPortalDocumentAssignments(), getPortalDataRequests()]);
  const todayDay = plan.days.find((day) => day.scheduledDate === plan.today) ?? plan.days[0];
  const actionableTasks = todayDay?.availability === "available"
    ? todayDay.tasks.filter((task) => task.taskType !== "information" && task.status !== "skipped") : [];
  const completedTasks = actionableTasks.filter((task) => task.status === "completed").length;
  const photoRequestDays = plan.days.filter((day) => day.photoRequests.length > 0);

  return (
    <main className="care-shell">
      <section className="care-hero stack">
        <div className="care-brand"><span className="brand-mark" aria-hidden="true">AC</span>
          <p className="eyebrow">AfterCare Clinic</p></div>
        <div><h1>Bakım Planınız</h1>
          <p><time dateTime={plan.startDate}>{formatDisplayDate(plan.startDate)}</time> – <time dateTime={plan.endDate}>{formatDisplayDate(plan.endDate)}</time></p></div>
        {plan.mode === "scheduled" ? <p className="notice">Planınız henüz başlamadı.</p> : null}
        {plan.mode === "readonly" ? <p className="notice">Plan tamamlandı.</p> : null}
      </section>

      <section className="care-section stack" aria-labelledby="today-heading">
        <div className="row-between">
          <div>
            <p className="eyebrow">Bugün</p>
            <h2 id="today-heading">Bugünün görevleri</h2>
          </div>
          {todayDay ? <span className="badge">Gün {todayDay.dayNumber}</span> : null}
        </div>
        {actionableTasks.length > 0 && <div className="care-progress">
          <label htmlFor="care-task-progress"><span id="care-task-progress-label">Bugünkü görev ilerlemesi</span>
            <strong>{completedTasks} / {actionableTasks.length}</strong></label>
          <progress id="care-task-progress" aria-labelledby="care-task-progress-label" value={completedTasks} max={actionableTasks.length} />
        </div>}
        {todayDay?.tasks.length ? (
          <div className="card-list">
            {todayDay.tasks.map((task) => (
              <article className="portal-task-card" data-testid="portal-task" data-task-id={task.id} data-completed={task.status === "completed"} key={task.id}>
                <div className="stack">
                  <div className="button-row">
                    <span className="badge">{task.taskType === "information" ? "Bilgilendirme" : "Görev"}</span>
                    {task.required ? <span className="badge">Zorunlu</span> : <span className="badge">Opsiyonel</span>}
                    {task.status === "completed" ? <span className="badge care-task-complete">✓ Tamamlandı</span> : <span className="badge">Bekliyor</span>}
                  </div>
                  <h3>{task.title}</h3>
                  {task.description ? <p>{task.description}</p> : null}
                  {task.completedAt ? <p className="label">Tamamlanma zamanı: {formatDisplayDateTime(task.completedAt)}</p> : null}
                </div>
                <PortalTaskButton mode={plan.mode} task={task} availability={todayDay.availability} />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Bugün için gösterilecek görev bulunmuyor.</div>
        )}
      </section>

      {todayDay ? (
        <CheckInForm
          dayId={todayDay.id}
          mode={plan.mode}
          availability={todayDay.availability}
          options={plan.checkIn.options}
          alreadySubmitted={plan.checkIn.submittedDayIds.includes(todayDay.id)}
        />
      ) : null}

      {photoRequestDays.length ? (
        <div className="stack">
          {photoRequestDays.flatMap((day) =>
            day.photoRequests.map((photoRequest) => (
              <PhotoUploadCard key={photoRequest.id} request={photoRequest} mode={plan.mode} availability={day.availability} />
            ))
          )}
        </div>
      ) : null}

      <PortalDocumentsSection assignments={documentAssignments} />
      <PortalDataRequestForm initialRequests={dataRequests} />

      <section className="care-section stack care-plan-days" aria-labelledby="days-heading">
        <h2 id="days-heading">Plan günleri</h2>
        <div className="card-list">
          {plan.days.map((day) => (
            <article className="item-card" key={day.dayNumber}>
              <div>
                <strong>Gün {day.dayNumber}</strong>
                <p>
                  {formatDisplayDate(day.scheduledDate)} ·{" "}
                  {day.availability === "locked" ? "Kilitli" : day.status === "completed" ? "Tamamlandı" : "Görüntülenebilir"}
                </p>
              </div>
              {day.availability === "locked" ? (
                <button className="button secondary" type="button" disabled>
                  Kilitli
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
