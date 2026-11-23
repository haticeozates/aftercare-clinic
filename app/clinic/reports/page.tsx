import "@/components/analytics/reports.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveMembership } from "@/lib/auth/server";
import { dateLabel } from "@/lib/appointments/calendar";
import { statusLabels } from "@/lib/appointments/contracts";
import { AppointmentHeat, CountBars, ReportTrend } from "@/components/analytics/charts";
import { PrintReport } from "@/components/analytics/print";
import {
  alertLabels, buckets, groupedTotal, parseReportFilters, planLabels, presets, procedureCode, reportQuery,
  share, sourceLabels, specialistCode, type ReportData, type ReportFilters,
} from "@/lib/analytics/contracts";
import { metricValues, periodMetrics } from "@/lib/analytics/metrics";
import { fetchOperationsReport } from "@/lib/analytics/service";

const path = "/clinic/reports";
const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const displayPercent = (value: number | null) => value === null ? "—" : "%" + number.format(value);
const fixed = (labels: Record<string,string>, counts: Record<string,number>) =>
  Object.entries(labels).map(([key, label]) => ({ label, count: counts[key] ?? 0 }));

function FilterSelect({ name, label, value, options }: {
  name: string; label: string; value: string; options: [string, string][];
}) {
  return <div><label htmlFor={`report-${name}`}>{label}</label>
    <select id={`report-${name}`} name={name} defaultValue={value}>
      {options.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
    </select></div>;
}

function ReportFiltersForm({ filters, report, staff }: { filters: ReportFilters; report: ReportData; staff: boolean }) {
  return <form action={path} className="report-filters" key={reportQuery(filters)}>
    <div className="report-filter-fields">
      <FilterSelect name="preset" label="Dönem" value={filters.preset} options={Object.entries(presets)} />
      <div><label htmlFor="report-from">Özel başlangıç</label><input id="report-from" type="date" name="from"
        defaultValue={filters.preset === "custom" ? filters.from : undefined} /></div>
      <div><label htmlFor="report-to">Özel bitiş</label><input id="report-to" type="date" name="to"
        defaultValue={filters.preset === "custom" ? filters.to : undefined} /></div>
      <FilterSelect name="bucket" label="Grafik aralığı" value={filters.bucket} options={Object.entries(buckets)} />
      {staff ? <p className="report-staff-filter">Uzman kapsamı · Atamalarım</p> :
        <FilterSelect name="member" label="Uzman" value={filters.member ?? ""}
          options={[["", "Tüm uzmanlar"], ...report.members.map(({ id, code }): [string,string] => [id, specialistCode(code)])]} />}
      <FilterSelect name="procedure" label="İşlem" value={filters.procedure ?? ""}
        options={[["", "Tüm işlemler"], ...report.procedures.map(({ id, code, name }): [string,string] => [id, `${procedureCode(code)} · ${name}`])]} />
      <FilterSelect name="status" label="Randevu durumu" value={filters.status ?? ""}
        options={[["", "Tüm durumlar"], ...Object.entries(statusLabels)]} />
    </div>
    <div className="report-filter-actions"><span>Özel tarih alanları, “Özel aralık” seçildiğinde uygulanır.</span>
      <div className="button-row"><Link className="ui-button ui-button--ghost" href={path}>Filtreleri sıfırla</Link>
        <button className="ui-button ui-button--primary" type="submit">Uygula</button></div>
    </div>
  </form>;
}

function PeriodCard({ metric, current, previous }: {
  metric: keyof typeof periodMetrics; current: ReturnType<typeof metricValues>; previous: ReturnType<typeof metricValues>;
}) {
  const reading = current[metric];
  const reference = previous[metric].value;
  const rate = "denominator" in reading;
  const change = reading.value === null || reference === null ? null : reading.value - reference;
  return <article className="report-kpi" data-metric={metric}>
    <h3>{periodMetrics[metric][0]}</h3>
    <strong className="report-value">{rate ? displayPercent(reading.value) : number.format(reading.count)}</strong>
    {rate && <span className="report-fraction">{number.format(reading.numerator)} / {number.format(reading.denominator)}
      {reading.denominator === 0 ? " · Hesaplanamadı" : ""}</span>}
    <span className="report-change">{change === null ? "Karşılaştırma için veri yok" :
      `${signed.format(change)}${rate ? " puan" : ""} · Önceki döneme göre`}</span>
  </article>;
}

export default async function OperationsReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, params] = await Promise.all([requireActiveMembership(), searchParams]);
  const filters = parseReportFilters(params);
  if (!filters) return <section className="page-section report-page">
    <h1>Raporlar ve Analitik</h1><div className="report-panel" role="alert"><h2>Filtreleri kontrol edin</h2>
      <p>Özel aralık iki geçerli tarih ve en fazla 366 gün içermelidir.</p><Link href={path}>Filtreleri sıfırla</Link></div>
  </section>;
  const response = await fetchOperationsReport(context.organization.id, filters);
  if (response.status === "denied") redirect("/unauthorized");
  if (response.status !== "ok") throw new Error("Geçersiz rapor aralığı.");
  const { report } = response;
  const staff = context.membership.roleKey === "staff";
  const current = metricValues(report.current);
  const previous = metricValues(report.previous);
  const noActivity = current.appointments.count === 0 && current.taskAdherence.denominator === 0
    && current.checkinAdherence.denominator === 0 && groupedTotal(report.current.alerts) === 0
    && groupedTotal(report.current.photos) === 0;
  const snapshot = [
    ["Aktif danışan", report.snapshot.clients], ["Aktif plan", report.snapshot.plans.active ?? 0],
    ["Tamamlanan plan", report.snapshot.plans.completed ?? 0], ["İnceleme bekleyen bildirim", report.snapshot.alerts],
    ["Yaklaşan kontrol", report.snapshot.follow_ups],
  ] as const;
  const groups = <div className="report-grid">
    <CountBars title="Randevu durumları" items={fixed(statusLabels, report.current.status)} />
    <CountBars title="Randevu kaynakları" items={fixed(sourceLabels, report.current.source)} />
    <CountBars title="İşlem dağılımı" items={report.procedures.filter((item) => report.current.procedure[item.id])
      .map(({ id, name, code }) => ({ label: `${procedureCode(code)} · ${name}`, count: report.current.procedure[id] }))} />
    <CountBars title="Uzman yoğunluğu" items={report.members.filter((item) => report.current.member[item.id])
      .map(({ id, code }) => ({ label: specialistCode(code), count: report.current.member[id] }))} />
    <CountBars title="Bakım planı durumları · Anlık" items={fixed(planLabels, report.snapshot.plans)} />
    <CountBars title="Takip bildirimi durumları" items={fixed(alertLabels, report.current.alerts)} />
    <CountBars title="Fotoğraf talepleri" items={fixed({ ready: "Tamamlandı", waiting: "Bekliyor", cancelled: "İptal" }, report.current.photos)} />
    <section className="report-panel">
      <h3>İleri tarihli kapasite tahmini</h3>
      {report.capacity ? <><p className="report-value">{displayPercent(share(report.capacity.reserved, report.capacity.minutes))}</p>
        <p>{number.format(report.capacity.reserved)} / {number.format(report.capacity.minutes)} dakika rezerve</p>
        <p className="report-muted">{report.capacity.members} çalışma saati tanımlı uzman. Geçerli çalışma programı, molalar ve izinler kullanılır.</p></>
        : <p className="report-muted">Tahmin için çalışma saatleri ve yalnız gelecekte kalan en fazla 31 günlük aralık gerekir. İşlem ve randevu durumu filtrelerini boş bırakın. Geçmiş dönemlerin çalışma saati geçmişi tutulmuyor.</p>}
    </section>
  </div>;

  return <section className="page-section report-page">
    <header className="report-hero">
      <div><p className="report-eyebrow">Klinik operasyonu</p><h1>Raporlar ve Analitik</h1>
        <p>Randevu akışını ve bakım katılımını aynı dönemde inceleyin.</p></div>
      <div className="report-output button-row"><PrintReport />
        {!staff && <form action={`${path}/csv?${reportQuery(filters)}`} method="post">
          <button className="ui-button ui-button--primary" type="submit">CSV indir</button>
        </form>}</div>
    </header>
    <ReportFiltersForm filters={filters} report={report} staff={staff} />
    <section className="report-section" aria-labelledby="report-period-heading">
      <div className="report-section-head"><div><h2 id="report-period-heading">Dönem performansı</h2>
        <p data-testid="report-period">{dateLabel(report.first)} – {dateLabel(report.last)}</p></div>
        <p data-testid="report-comparison">Önceki dönem · {dateLabel(report.priorFirst)} – {dateLabel(report.priorLast)}</p></div>
      <p className="report-muted">Randevu · {report.zone} &nbsp; Bakım · Europe/Istanbul. Durum filtresi randevuları etkiler. Durumlar rapor anında okunur.</p>
      {noActivity && <div className="report-panel" role="status"><h3>Bu dönemde kayıt bulunamadı</h3>
        <p>Başka bir tarih veya filtre seçin. Anlık durum kartları güncel kayıtları göstermeye devam eder.</p></div>}
      <div className="report-kpis">{(Object.keys(periodMetrics) as (keyof typeof periodMetrics)[]).map((metric) =>
        <PeriodCard key={metric} metric={metric} current={current} previous={previous} />)}</div>
    </section>
    <section className="report-section" aria-labelledby="report-snapshot-heading">
      <div className="report-section-head"><div><h2 id="report-snapshot-heading">Anlık durum</h2>
        <p>Tarih aralığından bağımsız · Yaklaşan kontroller için 14 takvim günü</p></div></div>
      <div className="report-kpis report-snapshot">{snapshot.map(([title, value]) => <article className="report-kpi" key={title}>
        <h3>{title}</h3><strong className="report-value">{number.format(value)}</strong></article>)}</div>
    </section>
    <section className="report-section" aria-label="Grafikler ve dağılımlar">
      <ReportTrend data={report.current.trend} />
      {groups}
      <AppointmentHeat data={report.current.heat} />
    </section>
    <details className="report-panel report-definitions">
      <summary>Metrikler nasıl hesaplanır?</summary>
      <dl>{Object.values(periodMetrics).map(([label, definition]) => <div key={label}><dt>{label}</dt><dd>{definition}</dd></div>)}
        <div><dt>Anlık durum</dt><dd>Aktif kayıtlar ve güncel plan durumları. Açık klinik incelemeleri ile onaylı, bugünden başlayan 14 takvim günlük penceredeki kontroller sayılır.</dd></div>
        <div><dt>Bakım dağılımları</dt><dd>Takip bildirimleri ve fotoğraf talepleri İstanbul saatine göre açılış gününde sayılır. Fotoğraf içeriği gösterilmez. Görevler ve check-in, plan gününe göre sayılır.</dd></div>
        <div><dt>Karşılaştırma ve sıfır payda</dt><dd>Hemen önceki aynı uzunluktaki dönemle sayı veya yüzde puan farkı gösterilir. Payda sıfırsa oran hesaplanmaz.</dd></div>
        <div><dt>Kapsam</dt><dd>Göstergeler klinik operasyonu ve katılımı ölçer. Uzmanlar atandıkları kayıtların toplulaştırılmış sonuçlarını görür.</dd></div></dl>
    </details>
  </section>;
}
