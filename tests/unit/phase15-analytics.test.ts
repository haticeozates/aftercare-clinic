import { describe, expect, it } from "vitest";
import { csvCell, reportCsv } from "@/lib/analytics/csv";
import { parseReportFilters, share, type ReportData } from "@/lib/analytics/contracts";

describe("operations analytics exports", () => {
  it("rejects invalid, duplicate and oversized filter inputs", () => {
    expect(parseReportFilters({ preset: "custom", from: "2026-11-01", to: "2026-11-20" })).toMatchObject({ bucket: "week" });
    expect(parseReportFilters({ preset: "custom", from: "2026-11-12", to: "2026-11-05" })).toBeNull();
    expect(parseReportFilters({ preset: "custom", from: "2026-01-01", to: "2027-01-02" })).toBeNull();
    expect(parseReportFilters({ preset: "custom", from: "2026-02-30", to: "2026-03-02" })).toBeNull();
    expect(parseReportFilters({ member: ["", "invalid"], status: "pending" })).toBeNull();
    expect(parseReportFilters({ status: "invalid" })).toBeNull();
    expect(parseReportFilters({ bucket: "year" })).toBeNull();
  });

  it("writes quoted spreadsheet-safe values and missing denominators", () => {
    expect(csvCell("  =1+1")).toBe("\"'  =1+1\"");
    expect(csvCell("\t+14")).toBe("\"'\t+14\"");
    expect(csvCell("＠14")).toBe("\"'＠14\"");
    expect(csvCell('a"b,c')).toBe('"a""b,c"');
    expect(csvCell(-1)).toBe("-1");
    expect(share(0, 0)).toBeNull();
    expect(share(0, 3)).toBe(0);
  });

  it("exports the same aggregate counts and never writes display names or identifiers", () => {
    const previous = { appointments: { total: 2, completed: 1, pending: 1, cancelled: 0, no_show: 0, terminal: 1, follow_ups: 0 },
      tasks: { done: 0, due: 0 }, checkins: { done: 0, due: 0 } };
    const member = { id: "f9c28cfe-edd7-428d-8b4d-cfa757349d09", code: 12 };
    const procedure = { id: "94153250-5168-4adf-a1c3-c76ffe66a711", code: 2, name: "=1+1 private label" };
    const report: ReportData = {
      first: "2026-11-01", last: "2026-11-01", priorFirst: "2026-10-31", priorLast: "2026-10-31", zone: "Europe/Istanbul",
      current: { ...previous, trend: [["2026-11-01", 2, 0]], status: { completed: 1, pending: 1 }, source: { clinic: 2 },
        procedure: { [procedure.id]: 2 }, member: { [member.id]: 2 }, heat: [[7,9,2]], alerts: {}, photos: { ready: 0, waiting: 0, cancelled: 0 } },
      previous, snapshot: { clients: 1, plans: { active: 1 }, alerts: 0, follow_ups: 0 }, capacity: null,
      members: [member], procedures: [procedure],
    };
    const csv = reportCsv(report, { preset: "30", bucket: "day", member: member.id, procedure: procedure.id });
    expect(csv).toContain('"Dönem","Toplam randevu",2,2');
    expect(csv).toContain('"Dönem (%)","Görev tamamlama oranı","","",0,0');
    expect(csv).toContain('"Randevu trendi","2026-11-01",2');
    expect(csv).toContain('"İşlem dağılımı","İşlem 02",2');
    expect(csv).toContain('"Uzman dağılımı","Uzman 12",2');
    expect(csv).not.toContain(procedure.name);
    expect(csv).not.toContain(procedure.id);
    expect(csv).not.toContain(member.id);
  });
});
