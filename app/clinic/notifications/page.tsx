import Link from "next/link";
import { z } from "zod";
import { addDays, wallDate } from "@/lib/appointments/calendar";
import { NoticeIcon } from "@/components/notifications/notice-icon";
import { NoticeForm } from "@/components/notifications/forms";
import { markNotification } from "@/lib/notifications/actions";
import { descriptions, noticeHref, noticeKind, noticeKinds, priorities, priorityLabels } from "@/lib/notifications/contracts";
import { notificationPage } from "@/lib/notifications/service";
import { requireActiveMembership } from "@/lib/auth/server";
import { schedulingRoster } from "@/lib/appointments/service";

const filterSchema = z.object({
  kind: z.union([noticeKind,z.literal("")]).optional().transform((value) => value || undefined),
  priority: z.union([z.enum(priorities),z.literal("")]).optional().transform((value) => value || undefined),
  from: z.union([z.iso.date(),z.literal("")]).optional(), to: z.union([z.iso.date(),z.literal("")]).optional(),
  page: z.coerce.number().int().min(1).max(300).default(1), unread: z.literal("on").optional()
});

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [actor, search] = await Promise.all([requireActiveMembership(), searchParams]);
  const parsed = filterSchema.safeParse(search);
  const filters = parsed.success ? parsed.data : filterSchema.parse({});
  const { zone } = await schedulingRoster(actor.organization.id, actor.user.id);
  const { items, older } = await notificationPage(actor.organization.id, actor.user.id, { ...filters, zone, unread: filters.unread === "on" });
  const time = new Intl.DateTimeFormat("tr-TR", { timeZone: zone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  const today = wallDate(new Date(), zone);
  const yesterday = addDays(today, -1);
  const group = (instant: string) => {
    const date = wallDate(instant, zone);
    return date === today ? "Bugün" : date === yesterday ? "Dün" : "Daha eski";
  };
  const pageUrl = (page: number) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key,value])=>[key,String(value)]));
    query.set("page",String(page));
    return "/clinic/notifications?" + query.toString();
  };

  return (
    <section className="page-section stack notice-page">
      <header className="notice-heading">
        <div className="page-header"><p className="eyebrow">Klinik iletişimi</p><h1>Bildirim merkezi</h1>
          <p>Randevular ve bakım takibiyle ilgili güncellemeler.</p></div>
        <div className="button-row"><Link className="ui-button ui-button--secondary" href="/clinic/notifications/preferences">Bildirim tercihleri</Link>
          <NoticeForm action={markNotification} submit="Tümünü okundu işaretle"><input type="hidden" name="mark" value="all" /></NoticeForm></div>
      </header>
      <form className="panel notice-filter" action="/clinic/notifications">
        <div className="notice-filter-control">
          <label htmlFor="notice-kind">Tür</label>
          <select id="notice-kind" name="kind" defaultValue={filters.kind ?? ""}>
            <option value="">Tüm türler</option>
            {noticeKinds.map((kind) => <option key={kind} value={kind}>{descriptions[kind][0]}</option>)}
          </select>
        </div>
        <div className="notice-filter-control">
          <label htmlFor="notice-priority">Öncelik</label>
          <select id="notice-priority" name="priority" defaultValue={filters.priority ?? ""}>
            <option value="">Tüm öncelikler</option>
            {priorities.map((level) => <option key={level} value={level}>{priorityLabels[level]}</option>)}
          </select>
        </div>
        <div className="notice-filter-control">
          <label htmlFor="notice-from">Başlangıç tarihi</label>
          <input id="notice-from" name="from" type="date" defaultValue={filters.from} />
        </div>
        <div className="notice-filter-control">
          <label htmlFor="notice-to">Bitiş tarihi</label>
          <input id="notice-to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <label className="notice-check"><input type="checkbox" name="unread" defaultChecked={filters.unread === "on"} /> Okunmamış</label>
        <button className="button secondary" type="submit">Filtrele</button>
      </form>
      {items.length ? <ul className="notice-list" aria-label="Bildirimler">
        {items.map((item, index) => {
          const label = group(item.visible_at);
          const startsGroup = index === 0 || group(items[index - 1].visible_at) !== label;
          return <li className="notice-entry" key={item.id}>
            {startsGroup && <h2 className="notice-group">{label}</h2>}
            <article className="notice-card" data-unread={!item.read_at}>
              <div className="notice-body"><NoticeIcon kind={item.kind} />
                <div className="notice-meta"><span className="notice-priority" data-level={item.priority}>{priorityLabels[item.priority]}</span>
                  <span className="notice-read-state">{item.read_at ? "Okundu" : "Okunmadı"}</span>
                  <time dateTime={item.visible_at}>{time.format(new Date(item.visible_at))}</time></div>
                <h3>{descriptions[item.kind][0]}</h3><p>{descriptions[item.kind][1]}</p>
              </div>
              <div className="notice-actions">
                <Link href={noticeHref(item.kind,item.target_id)}>İlgili kaydı aç</Link>
                <NoticeForm action={markNotification} submit={item.read_at ? "Okunmadı işaretle" : "Okundu işaretle"}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="mark" value={item.read_at ? "unread" : "read"} />
                </NoticeForm>
              </div>
            </article>
          </li>;
        })}
      </ul> : <div className="panel"><h2>Bildirim bulunamadı</h2><p>Yeni bildirimler burada görünür. Filtreleri değiştirebilirsiniz.</p></div>}
      {(filters.page > 1 || older) && <nav className="button-row" aria-label="Bildirim sayfaları">
        {filters.page > 1 && <Link href={pageUrl(filters.page - 1)}>Daha yeniler</Link>}
        {older && <Link href={pageUrl(filters.page + 1)}>Daha eskiler</Link>}
      </nav>}
    </section>
  );
}
