import type { ReactNode } from "react";
import { dateLabel } from "@/lib/appointments/calendar";
import { weekdays } from "@/lib/appointments/contracts";
import type { ReportData } from "@/lib/analytics/contracts";

const number = new Intl.NumberFormat("tr-TR");
type Point = ReportData["current"]["trend"][number];

export function CountBars({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const ceiling = Math.max(1, ...items.map(({ count }) => count));
  return <section className="report-panel">
    <h3>{title}</h3>
    {items.some(({ count }) => count > 0) ? <ul className="report-bars">
      {items.map(({ label, count }) => <li key={label}>
        <div><span>{label}</span><strong>{number.format(count)}</strong></div>
        <div className="report-bar" aria-hidden="true"><span style={{ width: `${count / ceiling * 100}%` }} /></div>
      </li>)}
    </ul> : <p className="report-muted">Bu kapsamda kayıt yok.</p>}
  </section>;
}

export function ReportTrend({ data }: { data: Point[] }) {
  const width = 720;
  const height = 230;
  const maximum = Math.max(1, ...data.flatMap(([, appt, checkin]) => [appt, checkin]));
  const increment = Math.ceil(maximum / 4);
  const ceiling = increment * Math.ceil(maximum / increment);
  const ticks = Array.from({ length: ceiling / increment + 1 }, (_, index) => index * increment);
  const x = (index: number) => data.length === 1 ? width / 2 : 48 + index * (width - 66) / (data.length - 1);
  const y = (value: number) => height - 20 - value * (height - 40) / ceiling;
  if (!data.some(([, appointments, checkins]) => appointments || checkins)) {
    return <section className="report-panel"><h3>Randevu ve check-in trendi</h3><p className="report-muted">Grafiğe aktarılacak randevu veya check-in yok.</p></section>;
  }
  return <section className="report-panel report-trend">
    <div className="report-chart-head"><h3>Randevu ve check-in trendi</h3>
      <ul className="report-legend"><li>Randevu</li><li>Check-in</li></ul></div>
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {ticks.map((tick) => <g key={tick}>
        <path d={`M 39 ${y(tick)} H ${width}`} className="report-grid-line" />
        <text className="report-y-label" x="32" y={y(tick)}>{number.format(tick)}</text>
      </g>)}
      {([1, 2] as const).map((series) => <g key={series} className={series === 1 ? "report-line-primary" : "report-line-secondary"}>
        <polyline points={data.map((row, i) => `${x(i)},${y(row[series])}`).join(" ")} />
        {data.map((row, i) => <circle key={row[0]} cx={x(i)} cy={y(row[series])} r={data.length > 32 ? 2 : 5}>
          <title>{dateLabel(row[0])} · {series === 1 ? "Randevu" : "Check-in"} · {number.format(row[series])}</title>
        </circle>)}
      </g>)}
    </svg>
    <div className="report-axis" aria-hidden="true">
      {[...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])].map((index) =>
        <span key={data[index][0]}>{dateLabel(data[index][0], { day: "numeric", month: "short" })}</span>)}
    </div>
    <details>
      <summary>Grafiğin verilerini tablo olarak göster</summary>
      <table><thead><tr><th scope="col">Dönem başlangıcı</th><th scope="col">Randevu</th><th scope="col">Check-in</th></tr></thead>
        <tbody>{data.map(([date, bookings, checkins]) => <tr key={date}>
          <th scope="row">{dateLabel(date)}</th><td>{number.format(bookings)}</td><td>{number.format(checkins)}</td>
        </tr>)}</tbody></table>
    </details>
  </section>;
}

export function AppointmentHeat({ data }: { data: ReportData["current"]["heat"] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const readings = new Map(data.map(([day, hour, count]) => [day * 24 + hour, count]));
  const max = Math.max(1, ...data.map(([, , count]) => count));
  return <section className="report-panel">
    <h3>Gün ve saat yoğunluğu</h3>
    <p className="report-muted">Randevu başlangıç sayısı · Klinik saati</p>
    {data.length ? <HeatTable>{weekdays.map((day, index) => <tr key={day}>
      <th scope="row">{day}</th>
      {hours.map((hour) => {
        const count = readings.get((index + 1) * 24 + hour) ?? 0;
        const hourLabel = String(hour).padStart(2, "0") + ":00";
        return <td key={hour} title={`${day} ${hourLabel} · ${count} randevu`}
          data-level={count === 0 ? "0" : count / max < .35 ? "1" : count / max < .7 ? "2" : "3"}>{count}</td>;
      })}
    </tr>)}</HeatTable> : <p className="report-muted">Bu kapsamda randevu yok.</p>}
  </section>;
}

function HeatTable({ children }: { children: ReactNode }) {
  return <>
    <p className="report-muted report-scroll-hint" id="report-heat-help">Tüm saatleri görmek için tabloyu yatay kaydırın.</p>
    <div className="report-heat-scroll" role="region" aria-label="Gün ve saat tablosu" aria-describedby="report-heat-help" tabIndex={0}>
    <table className="report-heat"><thead><tr><th scope="col">Gün</th>
      {Array.from({ length: 24 }, (_, h) => <th scope="col" key={h}>{String(h).padStart(2, "0")}</th>)}
    </tr></thead><tbody>{children}</tbody></table>
    </div>
  </>;
}
