const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul"
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul"
});

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
