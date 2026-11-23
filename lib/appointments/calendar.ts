import { dayInput } from "./contracts";

export const views = ["month", "week", "day", "agenda"] as const;
export type CalendarView = typeof views[number];

export function wallDate(instant: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(instant));
  return ["year", "month", "day"].map((name) => parts.find((part) => part.type === name)?.value).join("-");
}

export function clockLabel(instant: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(instant));
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat("tr-TR", { ...options, timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

export function addDays(date: string, amount: number) {
  const instant = new Date(date + "T12:00:00Z");
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}

export function calendarDate(input: string | string[] | undefined, today: string) {
  return typeof input === "string" && /^[2][0-9]{3}-/.test(input) && dayInput.safeParse(input).success ? input : today;
}

function monday(date: string) {
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function calendarRange(date: string, view: CalendarView) {
  if (view === "month") {
    const first = date.slice(0, 7) + "-01";
    const anchor = new Date(first + "T12:00:00Z");
    anchor.setUTCMonth(anchor.getUTCMonth() + 1);
    const next = anchor.toISOString().slice(0, 10);
    anchor.setUTCMonth(anchor.getUTCMonth() - 2);
    const previous = anchor.toISOString().slice(0, 10);
    const start = monday(first);
    const last = addDays(next, -1);
    const end = addDays(monday(last), 7);
    return { start, end, previous, next };
  }
  const start = view === "week" ? monday(date) : date;
  const count = view === "day" ? 1 : 7;
  return {
    start, end: addDays(start, count), previous: addDays(start, -count), next: addDays(start, count)
  };
}

export function daysBetween(start: string, end: string) {
  const days: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

export function calendarHref(input: Record<string, string | undefined>) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value) values.set(key, value);
  return "/clinic/appointments?" + values.toString();
}
