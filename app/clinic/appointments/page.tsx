import Link from "next/link";
import { AppointmentLine } from "@/components/appointments/display";
import { addDays, calendarDate, calendarHref, calendarRange, dateLabel, daysBetween, views, wallDate, type CalendarView } from "@/lib/appointments/calendar";
import { dayInput, statusLabels, statuses, uuid, type AppointmentStatus } from "@/lib/appointments/contracts";
import { appointmentContext, appointmentOptions, listAppointments } from "@/lib/appointments/service";

const labels: Record<CalendarView, string> = { month: "Ay", week: "Hafta", day: "Gün", agenda: "Ajanda" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [context, params] = await Promise.all([appointmentContext(), searchParams]);
  const today = wallDate(new Date(), context.zone);
  const date = calendarDate(params.date, today);
  const view = views.find((item) => item === params.view) ?? "month";
  const member = uuid.safeParse(params.member).data;
  const client = uuid.safeParse(params.client).data;
  const status = statuses.find((item) => item === params.status) as AppointmentStatus | undefined;
  const range = calendarRange(date, view);
  const list = params.list === "history";
  const historyDate = list ? dayInput.safeParse(params.history_date).data : undefined;
  // Date-filtered history is one day and can be read without jumping over off-zone rows.
  const page = list && !historyDate && /^[1-9][0-9]{0,3}$/.test(params.page ?? "") ? Number(params.page) : 1;
  const [appointments, options] = await Promise.all([
    listAppointments(context.organization.id, { ...(list ? historyDate ? { start: historyDate, end: addDays(historyDate, 1), newest: true }
      : { limit: 51, offset: (page - 1) * 50, newest: true } : range), zone: context.zone, client, member, status }),
    appointmentOptions(context.organization.id)
  ]);
  const filters = { view, date, member, client, status, ...(list ? { list: "history", history_date: historyDate } : {}) };
  const grouped = new Map<string, typeof appointments>();
  for (const item of appointments) {
    const day = wallDate(item.starts_at, context.zone);
    const matches = grouped.get(day) ?? [];
    matches.push(item);
    grouped.set(day, matches);
  }
  const heading = view === "month" ? dateLabel(date, { month: "long", year: "numeric" })
    : view === "day" ? dateLabel(date)
    : `${dateLabel(range.start, { day: "numeric", month: "short" })} – ${dateLabel(addDays(range.end, -1))}`;

  return (
    <section className="page-section stack booking-page">
      <header className="page-header booking-heading">
        <div><p className="eyebrow">Klinik operasyonu</p><h1>Randevu takvimi</h1><p>Klinik saat dilimi · {context.zone}</p></div>
        <div className="button-row">
          {context.manager && <Link className="button secondary" href="/clinic/appointments/availability">Müsaitlik ayarları</Link>}
          <Link className="button" href={`/clinic/appointments/new?date=${date}`}>Yeni randevu</Link>
        </div>
      </header>
      <div className="booking-toolbar">
        <nav aria-label="Takvim görünümü">
          {views.map((item) => <Link className="ui-button ui-button--ghost ui-button--sm" key={item} href={calendarHref({ ...filters, view: item, list: undefined })}
            aria-current={!list && view === item ? "page" : undefined}>{labels[item]}</Link>)}
          <Link className="ui-button ui-button--ghost ui-button--sm" href={calendarHref({ ...filters, list: "history" })}
            aria-current={list ? "page" : undefined}>Randevu geçmişi</Link>
        </nav>
        <form className="booking-filter" action="/clinic/appointments">
          <input type="hidden" name="view" value={view} />
          {list && <input type="hidden" name="list" value="history" />}
          <div className="booking-filter-date"><label htmlFor="booking-filter-day">Tarih</label>
            <input id="booking-filter-day" type="date" lang="tr" name={list ? "history_date" : "date"} defaultValue={list ? historyDate : date} />
          </div>
          <label>Uzman<select name="member" defaultValue={member ?? ""}>
            <option value="">Tüm uzmanlar</option>{context.roster.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Danışan<select name="client" defaultValue={client ?? ""}>
            {client && !options.clients.some((item) => item.id === client) && <option value={client}>Seçili geçmiş kayıt</option>}
            <option value="">Tüm danışanlar</option>{options.clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select></label>
          <label>Durum<select name="status" defaultValue={status ?? ""}>
            <option value="">Tüm durumlar</option>{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
          </select></label>
          <button className="button secondary" type="submit">Filtrele</button>
        </form>
      </div>
      {list ? <div className="panel stack">
        <h2>Randevu geçmişi</h2>
        {!appointments.length && <p>Filtrelere uyan randevu bulunamadı.</p>}
        {(historyDate ? appointments : appointments.slice(0, 50)).map((item) => <AppointmentLine key={item.id} item={item} zone={context.zone} roster={context.roster} showDate />)}
        {!historyDate && <nav className="button-row" aria-label="Randevu geçmişi sayfaları">
          {page > 1 && <Link href={calendarHref({ ...filters, page: String(page - 1) })}>Daha yeni kayıtlar</Link>}
          {appointments.length > 50 && <Link href={calendarHref({ ...filters, page: String(page + 1) })}>Daha eski kayıtlar</Link>}
        </nav>}
      </div> : <>
        <div className="booking-heading">
          <div className="booking-period">
            <h2>{heading}</h2>
            <p>Seçili tarih · <time dateTime={date}>{dateLabel(date, { day: "numeric", month: "long", weekday: "long" })}</time></p>
          </div>
          <nav className="button-row" aria-label="Takvim tarihleri">
            <Link className="ui-button ui-button--secondary ui-button--sm" href={calendarHref({ ...filters, date: range.previous })}>Önceki</Link>
            <Link className="ui-button ui-button--secondary ui-button--sm" href={calendarHref({ ...filters, date: today })}>Bugün</Link>
            <Link className="ui-button ui-button--secondary ui-button--sm" href={calendarHref({ ...filters, date: range.next })}>Sonraki</Link>
          </nav>
        </div>
        <div className="booking-calendar" data-view={view}>
          {daysBetween(range.start, range.end).map((day) => {
            const entries = grouped.get(day) ?? [];
            const visible = view === "month" ? entries.slice(0, 3) : entries;
            return (
              <section key={day} className="booking-day" aria-label={dateLabel(day)} data-today={day === today} data-selected={day === date}
                data-other-month={view === "month" && day.slice(0, 7) !== date.slice(0, 7)}>
                <h3 className="booking-day-heading">
                  <Link href={calendarHref({ ...filters, date: day, view: "day" })} aria-label={`${dateLabel(day)} randevuları`} aria-current={day === date ? "date" : undefined}>
                    {Number(day.slice(8))} <span className="booking-day-name">{dateLabel(day, { weekday: "short" })}</span>
                  </Link>
                  {day === today && <span className="booking-today">Bugün</span>}
                </h3>
                <Link className="booking-add" href={`/clinic/appointments/new?date=${day}`} aria-label={`${dateLabel(day)} için randevu oluştur`}>+ Ekle</Link>
                {entries.length > 0 && <span className="booking-count" aria-label={`${entries.length} randevu`}>{entries.length}</span>}
                {visible.map((item) => <AppointmentLine key={item.id} item={item} zone={context.zone} roster={context.roster} />)}
                {visible.length < entries.length && <Link className="booking-more" href={calendarHref({ ...filters, date: day, view: "day" })}>
                  {entries.length - visible.length} randevu daha
                </Link>}
              </section>
            );
          })}
        </div>
      </>}
    </section>
  );
}
