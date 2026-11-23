import { z } from "zod";

export const descriptions = {
  appointment_requested: ["Online randevu talebi", "Klinik onayı bekleyen yeni bir randevu talebi var."],
  appointment_confirmed: ["Randevu onaylandı", "Randevunun durumu onaylandı."],
  appointment_rescheduled: ["Randevu saati değişti", "Güncel tarih ve saati randevu detayında görün."],
  appointment_cancelled: ["Randevu kapatıldı", "Bir randevu iptal edildi veya online talep reddedildi."],
  appointment_reminder: ["Yaklaşan randevu", "Klinik takviminizde yaklaşan bir randevu var."],
  follow_up_reminder: ["Yaklaşan kontrol randevusu", "Klinik takviminizde bir kontrol randevusu yaklaşıyor."],
  plan_created: ["Yeni bakım planı", "Klinikte yeni bir takip planı oluşturuldu."],
  daily_task_reminder: ["Günlük bakım görevi", "Bugünkü bakım planında bekleyen zorunlu bir görev var."],
  checkin_received: ["Danışan check-in bildirimi", "Danışan günlük durum bildirimini gönderdi."],
  photo_received: ["Yeni fotoğraf", "Klinik incelemesine hazır yeni bir fotoğraf var."],
  alert_review: ["Klinik incelemesi bekliyor", "Bir takip bildirimi klinik incelemesi için açıldı."],
  data_request_received: ["Yeni veri talebi", "Klinik incelemesi için yeni bir veri talebi alındı."]
} as const;

export type NoticeKind = keyof typeof descriptions;
export const noticeKinds = Object.keys(descriptions) as NoticeKind[];
export const priorities = ["high", "normal", "low"] as const;
export type Priority = typeof priorities[number];
export const priorityLabels: Record<Priority, string> = { high: "Yüksek", normal: "Normal", low: "Düşük" };
export const noticeKind = z.enum(noticeKinds);
export const noticeId = z.uuid();

export type Notice = {
  id: string;
  kind: NoticeKind;
  priority: Priority;
  target_id: string;
  visible_at: string;
  read_at: string | null;
};

export function noticeHref(kind: NoticeKind, target: string) {
  if (!noticeId.safeParse(target).success) return "/clinic/notifications";
  if (kind.startsWith("appointment_") || kind === "follow_up_reminder") return "/clinic/appointments/" + target;
  if (kind === "alert_review") return "/clinic/alerts/" + target;
  if (kind === "data_request_received") return "/clinic/data-requests#request-" + target;
  return "/clinic/plans/" + target;
}

export function dateBoundary(date: string, timeZone: string) {
  const anchor = Date.parse(date + "T00:00:00Z");
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  let guess = anchor;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(format.formatToParts(new Date(guess)).map(({ type, value }) => [type, value]));
    const inZone = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute));
    const change = anchor - inZone;
    if (!change) return new Date(guess).toISOString();
    guess += change;
  }
  return new Date(guess).toISOString();
}
