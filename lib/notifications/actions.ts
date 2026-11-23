"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveMembership } from "@/lib/auth/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { minuteOfDay } from "@/lib/appointments/contracts";
import { noticeId, noticeKind, noticeKinds } from "./contracts";
import { notificationMailConfig } from "./local-mail.mjs";

export type NoticeState = { error?: string; success?: string };

export async function markNotification(_state: NoticeState, form: FormData): Promise<NoticeState> {
  const actor = await requireActiveMembership();
  const mark = form.get("mark");
  const id = form.get("id");
  if (!["read","unread","all"].includes(String(mark)) || (mark !== "all" && !noticeId.safeParse(id).success)) {
    return { error: "Geçerli bir bildirim seçin." };
  }
  const { error } = await createAdminSupabaseClient().rpc("phase13_mark", {
    actor: actor.user.id, clinic: actor.organization.id, receipt: mark === "all" ? null : id, mark_read: mark !== "unread"
  });
  if (error) return { error: "Okunma durumu güncellenemedi." };
  revalidatePath("/clinic", "layout");
  return { success: mark === "all" ? "Bildirimler okundu işaretlendi." : "Okunma durumu güncellendi." };
}

export async function saveNoticePreferences(_state: NoticeState, form: FormData): Promise<NoticeState> {
  const actor = await requireActiveMembership();
  const scope = form.get("scope");
  if ((scope !== "clinic" && scope !== "user") || (scope === "clinic" && actor.membership.roleKey === "staff")) {
    return { error: "Bu bildirim tercihlerini değiştirme yetkiniz yok." };
  }
  const selected = z.array(noticeKind).max(noticeKinds.length).safeParse(form.getAll("kind"));
  const rawLead = form.get("reminder_minutes");
  const lead = scope === "user" && rawLead === "" ? null : Number(rawLead);
  if (!selected.success || (lead !== null && (!Number.isInteger(lead) || lead < 5 || lead > 10080))) {
    return { error: "Bildirim türlerini ve 5–10080 dakika arasındaki hatırlatma süresini kontrol edin." };
  }
  const payload: Record<string, string[] | number | boolean | null> = {
    muted: noticeKinds.filter((kind) => kind !== "alert_review" && !selected.data.includes(kind)),
    email_enabled: Boolean(notificationMailConfig()) && form.get("email_enabled") === "on",
    reminder_minutes: lead
  };
  if (scope === "clinic") {
    const daily = minuteOfDay(String(form.get("daily") ?? ""));
    const from = String(form.get("quiet_from") ?? "");
    const until = String(form.get("quiet_until") ?? "");
    const start = from ? minuteOfDay(from) : null;
    const end = until ? minuteOfDay(until) : null;
    if (!(daily >= 0 && daily < 1440) || ((start === null) !== (end === null)) ||
        (start !== null && end !== null && (!(start >= 0 && start < 1440) || !(end >= 0 && end < 1440) || start === end))) {
      return { error: "Günlük saat ve sessiz saatlerin iki ucunu kontrol edin." };
    }
    payload.daily_minute = daily;
    payload.quiet_from = start;
    payload.quiet_until = end;
  }
  const { error } = await createAdminSupabaseClient().rpc("phase13_preferences", {
    actor: actor.user.id, clinic: actor.organization.id, scope, payload
  });
  if (error) return { error: "Bildirim tercihleri kaydedilemedi." };
  revalidatePath("/clinic", "layout");
  return { success: "Bildirim tercihleri kaydedildi." };
}
