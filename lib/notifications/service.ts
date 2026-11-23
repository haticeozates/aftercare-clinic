import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/appointments/calendar";
import { dateBoundary, type Notice, type NoticeKind, type Priority } from "./contracts";

const receiptFields = "id,kind,priority,target_id,visible_at,read_at";

export async function notificationPreview(clinic: string, actor: string) {
  const db = await createServerSupabaseClient();
  const [latest, count] = await Promise.all([
    db.from("notification_receipts").select(receiptFields).eq("organization_id", clinic).eq("user_id", actor)
      .order("visible_at", { ascending: false }).order("id").limit(5).returns<Notice[]>(),
    db.from("notification_receipts").select("id", { count: "exact", head: true })
      .eq("organization_id", clinic).eq("user_id", actor).is("read_at", null)
  ]);
  return { items: latest.data ?? [], unread: count.count ?? 0, unavailable: Boolean(latest.error || count.error) };
}

export async function notificationPage(clinic: string, actor: string, options: {
  kind?: NoticeKind; priority?: Priority; from?: string; to?: string; zone: string; page: number; unread: boolean;
}) {
  const db = await createServerSupabaseClient();
  let query = db.from("notification_receipts").select(receiptFields)
    .eq("organization_id", clinic).eq("user_id", actor)
    .order("visible_at", { ascending: false }).order("id");
  if (options.kind) query = query.eq("kind", options.kind);
  if (options.priority) query = query.eq("priority", options.priority);
  if (options.from) query = query.gte("visible_at", dateBoundary(options.from, options.zone));
  if (options.to) query = query.lt("visible_at", dateBoundary(addDays(options.to, 1), options.zone));
  if (options.unread) query = query.is("read_at", null);
  const offset = (options.page - 1) * 20;
  const { data, error } = await query.range(offset, offset + 20).returns<Notice[]>();
  if (error) throw new Error("Bildirimler yüklenemedi.");
  return { items: data.slice(0, 20), older: data.length > 20 };
}

export type Preference = { email_enabled: boolean; muted: NoticeKind[]; reminder_minutes: number | null };
export type ClinicPreference = Preference & {
  reminder_minutes: number; daily_minute: number; quiet_from: number | null; quiet_until: number | null;
};

export async function readPreferences(clinic: string, actor: string) {
  const db = await createServerSupabaseClient();
  const [user, settings] = await Promise.all([
    db.from("notification_user_preferences").select("email_enabled,muted,reminder_minutes")
      .eq("organization_id", clinic).eq("user_id", actor).maybeSingle<Preference>(),
    db.from("notification_clinic_preferences").select("email_enabled,muted,reminder_minutes,daily_minute,quiet_from,quiet_until")
      .eq("organization_id", clinic).maybeSingle<ClinicPreference>()
  ]);
  if (user.error || settings.error) throw new Error("Bildirim tercihleri yüklenemedi.");
  return {
    user: user.data ?? { email_enabled: false, muted: [] as NoticeKind[], reminder_minutes: null },
    clinic: settings.data ?? {
      email_enabled: false, muted: [] as NoticeKind[], reminder_minutes: 1440,
      daily_minute: 540, quiet_from: null, quiet_until: null
    }
  };
}
