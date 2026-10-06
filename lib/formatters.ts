export const APP_TIMEZONE = "Europe/Istanbul";

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIMEZONE
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: APP_TIMEZONE
});

export function formatIstanbulIsoDate(daysFromToday = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + daysFromToday)).toISOString().slice(0, 10);
}

export function defaultPlanStartDate(now = new Date()) {
  return formatIstanbulIsoDate(1, now);
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "Tanımlı değil";
  }

  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00+03:00`);
  return dateFormatter.format(date);
}

export function formatDisplayDateTime(value: string | null | undefined) {
  if (!value) {
    return "Tanımlı değil";
  }

  return dateTimeFormatter.format(new Date(value));
}
