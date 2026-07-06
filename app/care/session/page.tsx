import { redirect } from "next/navigation";
import { getPortalPlan } from "@/lib/portal/service";
import { PortalTaskButton } from "@/app/care/session/task-button";

export const dynamic = "force-dynamic";

export default async function CareSessionPage() {
  const plan = await getPortalPlan();
  if (!plan) {
    redirect("/care/invalid");
  }

  const todayDay = plan.days.find((day) => day.scheduledDate === plan.today) ?? plan.days[0];

  return (
    <main className="care-shell">
      <section className="care-hero stack">
        <p className="eyebrow">AfterCare Clinic</p>
        <h1>Bakım Planınız</h1>
        <p>
          {plan.startDate} - {plan.endDate} · Saat dilimi {plan.timezone}
        </p>
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
        {todayDay ? (
          <div className="card-list">
            {todayDay.tasks.map((task) => (
              <article className="portal-task-card" data-testid="portal-task" data-task-id={task.id} key={task.id}>
                <div className="stack">
                  <div className="button-row">
                    <span className="badge">{task.taskType === "information" ? "Bilgilendirme" : "Görev"}</span>
                    {task.required ? <span className="badge">Zorunlu</span> : <span className="badge">Opsiyonel</span>}
                    {task.status === "completed" ? <span className="badge">Tamamlandı</span> : <span className="badge">Bekliyor</span>}
                  </div>
                  <h3>{task.title}</h3>
                  {task.description ? <p>{task.description}</p> : null}
                  {task.completedAt ? <p className="label">Tamamlanma zamanı: {task.completedAt}</p> : null}
                </div>
                <PortalTaskButton mode={plan.mode} task={task} availability={todayDay.availability} />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Bugün için gösterilecek görev bulunmuyor.</div>
        )}
      </section>

      <section className="care-section stack" aria-labelledby="days-heading">
        <h2 id="days-heading">Plan günleri</h2>
        <div className="card-list">
          {plan.days.map((day) => (
            <article className="item-card" key={day.dayNumber}>
              <div>
                <strong>Gün {day.dayNumber}</strong>
                <p>
                  {day.scheduledDate} · {day.availability === "locked" ? "Kilitli" : day.status === "completed" ? "Tamamlandı" : "Görüntülenebilir"}
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
