import { statusLabels } from "@/lib/appointments/contracts";
import { alertLabels, planLabels, procedureCode, sourceLabels, specialistCode, type ReportData, type ReportFilters } from "./contracts";
import { metricValues, periodMetrics } from "./metrics";

export function csvCell(value: string | number | null) {
  if (value === null) return '""';
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : '""';
  const dangerous = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value);
  return '"' + (dangerous ? "'" : "") + value.replaceAll('"', '""') + '"';
}

type Row = [section: string, label: string, current: string | number | null, previous?: string | number | null, numerator?: number, denominator?: number];
const fixedBreakdown = (section: string, labels: Record<string, string>, counts: Record<string, number>): Row[] =>
  Object.entries(labels).map(([key, label]) => [section, label, counts[key] ?? 0]);

export function reportCsv(report: ReportData, filters: ReportFilters) {
  const current = metricValues(report.current);
  const previous = metricValues(report.previous);
  const round = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;
  const member = report.members.find((item) => item.id === filters.member);
  const procedure = report.procedures.find((item) => item.id === filters.procedure);
  const rows: Row[] = [
    ["Kapsam", "Başlangıç", report.first, report.priorFirst],
    ["Kapsam", "Bitiş", report.last, report.priorLast],
    ["Kapsam", "Randevu saat dilimi", report.zone],
    ["Kapsam", "Bakım saat dilimi", "Europe/Istanbul"],
    ["Filtre", "Uzman", member ? specialistCode(member.code) : "Tümü"],
    ["Filtre", "İşlem", procedure ? procedureCode(procedure.code) : "Tümü"],
    ["Filtre", "Randevu durumu", filters.status ? statusLabels[filters.status] : "Tümü"],
    ["Filtre", "Gruplama", { day: "Gün", week: "Hafta", month: "Ay" }[filters.bucket]],
  ];
  for (const key of Object.keys(current) as (keyof typeof current)[]) {
    const metric = current[key];
    rows.push("denominator" in metric
      ? ["Dönem (%)", periodMetrics[key][0], round(metric.value), round(previous[key].value), metric.numerator, metric.denominator]
      : ["Dönem", periodMetrics[key][0], metric.count, previous[key].value]);
  }
  rows.push(
    ["Anlık durum", "Aktif danışan", report.snapshot.clients],
    ["Anlık durum", "Açık takip bildirimi", report.snapshot.alerts],
    ["Anlık durum", "Yaklaşan kontrol randevusu", report.snapshot.follow_ups],
    ...fixedBreakdown("Plan durumu", planLabels, report.snapshot.plans),
    ...fixedBreakdown("Randevu durumu", statusLabels, report.current.status),
    ...fixedBreakdown("Kaynak", sourceLabels, report.current.source),
    ...fixedBreakdown("Takip durumları", alertLabels, report.current.alerts),
    ...fixedBreakdown("Fotoğraf talepleri", { ready: "Tamamlandı", waiting: "Bekliyor", cancelled: "İptal" }, report.current.photos),
  );
  for (const item of report.members) {
    if (item.id in report.current.member) rows.push(["Uzman dağılımı", specialistCode(item.code), report.current.member[item.id]]);
  }
  for (const item of report.procedures) {
    if (item.id in report.current.procedure) rows.push(["İşlem dağılımı", procedureCode(item.code), report.current.procedure[item.id]]);
  }
  for (const [date, bookings, checkins] of report.current.trend) {
    rows.push(["Randevu trendi", date, bookings], ["Check-in trendi", date, checkins]);
  }
  for (const [day, hour, count] of report.current.heat) {
    rows.push(["Başlangıç yoğunluğu", `Gün ${day} · ${String(hour).padStart(2, "0")}:00`, count]);
  }
  if (report.capacity) rows.push(
    ["Kapasite tahmini", "Uygun dakika", round(report.capacity.minutes)],
    ["Kapasite tahmini", "Rezerve dakika", round(report.capacity.reserved)],
    ["Kapasite tahmini", "Çalışma saati tanımlı uzman", report.capacity.members],
  );

  return "\uFEFF" + [
    ["Bölüm", "Ölçüm", "Değer", "Önceki dönem", "Pay", "Payda"].map(csvCell).join(","),
    ...rows.map((row) => Array.from({ length: 6 }, (_, index) => csvCell(row[index] ?? null)).join(",")),
  ].join("\r\n") + "\r\n";
}
