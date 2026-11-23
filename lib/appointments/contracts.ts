import { z } from "zod";

export const statuses = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = typeof statuses[number];
export const statusLabels: Record<AppointmentStatus, string> = {
  pending: "Onay bekliyor",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  no_show: "Gelmedi"
};

export const eventLabels: Record<string, string> = {
  created: "Oluşturuldu", requested: "Online talep alındı", updated: "Düzenlendi",
  rescheduled: "Yeniden planlandı", rejected: "Online talep reddedildi", ...statusLabels
};

export const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [], cancelled: [], no_show: []
};

export const dayInput = z.iso.date();
export const uuid = z.uuid();
export const slugInput = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const minutesInput = z.coerce.number().int().min(5).max(480).multipleOf(5);
export const slotSelection = z.object({ procedure_id: uuid, membership_id: uuid, date: dayInput });
const nullableId = z.union([uuid, z.literal(""), z.null()]).transform((value) => value || null);
export const appointmentInput = z.object({
  client_id: nullableId, procedure_id: uuid, membership_id: uuid, care_plan_id: nullableId,
  kind: z.enum(["procedure", "follow_up"]), minutes: minutesInput,
  local_start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .refine((value) => dayInput.safeParse(value.slice(0, 10)).success && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.slice(11))),
  notes: z.string().trim().max(1000)
});
export const requestInput = z.object({
  procedure_id: uuid, membership_id: uuid, starts_at: z.iso.datetime({ offset: true }),
  reference: z.string().trim().regex(/^DEMO-[0-9]{4}$/)
});

export function publicBookingEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.PHASE12_PUBLIC_DEMO_ENABLED !== "true" || !["local", "test", "development"].includes(env.APP_ENV ?? "")) {
    return false;
  }
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && url.port === "56321" && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function minuteOfDay(value: string) {
  if (value === "24:00") return 1440;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return Number.NaN;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function minuteLabel(minute: number) {
  return [Math.floor(minute / 60), minute % 60].map((number) => String(number).padStart(2, "0")).join(":");
}

export const weekdays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
