import { z } from "zod";
import { dayInput, statuses, uuid } from "@/lib/appointments/contracts";
import { addDays } from "@/lib/appointments/calendar";

export const presets = { today: "Bugün", "7": "Son 7 gün", "30": "Son 30 gün", month: "Bu ay", custom: "Özel aralık" };
export const buckets = { day: "Günlük", week: "Haftalık", month: "Aylık" };

const paramsSchema = z.object({
  preset: z.enum(["today", "7", "30", "month", "custom"]).default("30"),
  bucket: z.enum(["day", "week", "month"]).default("week"),
  from: z.union([dayInput, z.literal("")]).optional(),
  to: z.union([dayInput, z.literal("")]).optional(),
  member: z.union([uuid, z.literal("")]).optional(),
  procedure: z.union([uuid, z.literal("")]).optional(),
  status: z.union([z.enum(statuses), z.literal("")]).optional(),
});

export type ReportFilters = z.infer<typeof paramsSchema>;

export function parseReportFilters(input: Record<string, unknown>) {
  const result = paramsSchema.safeParse(input);
  if (!result.success) return null;
  const { preset, from, to } = result.data;
  if (preset === "custom" && (!from || !to || from < "2000-01-01" || to > "2099-12-31"
    || from > to || to > addDays(from, 365))) return null;
  return result.data;
}

export function reportQuery(filters: ReportFilters) {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
}

export const share = (numerator: number, denominator: number) => denominator > 0 ? 100 * numerator / denominator : null;
export const groupedTotal = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + n, 0);
export const specialistCode = (code: number) => `Uzman ${String(code).padStart(2, "0")}`;
export const procedureCode = (code: number) => `İşlem ${String(code).padStart(2, "0")}`;

type Outcomes = { total: number; pending: number; completed: number; cancelled: number; no_show: number; terminal: number; follow_ups: number };
type Participation = { done: number; due: number };
export type PeriodCounts = { appointments: Outcomes; tasks: Participation; checkins: Participation };
export type ReportData = {
  zone: string; first: string; last: string; priorFirst: string; priorLast: string;
  current: PeriodCounts & {
    trend: [date: string, appointments: number, checkins: number][];
    status: Record<string, number>; source: Record<string, number>; procedure: Record<string, number>;
    member: Record<string, number>; heat: [dow: number, hour: number, count: number][];
    alerts: Record<string, number>; photos: { ready: number; waiting: number; cancelled: number };
  };
  previous: PeriodCounts;
  snapshot: { clients: number; plans: Record<string, number>; alerts: number; follow_ups: number };
  capacity: { minutes: number; reserved: number; members: number } | null;
  members: { id: string; code: number }[];
  procedures: { id: string; code: number; name: string }[];
};

export const alertLabels: Record<string, string> = {
  open: "İnceleme bekliyor", acknowledged: "İncelendi", resolved: "Çözüldü", dismissed: "Kapatıldı",
};
export const planLabels: Record<string, string> = {
  active: "Aktif", scheduled: "Planlanmış", completed: "Tamamlanmış", stopped: "Durdurulmuş",
};
export const sourceLabels: Record<string, string> = { online_demo: "Online demo", clinic: "Klinik içi" };
