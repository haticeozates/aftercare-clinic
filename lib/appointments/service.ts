import "server-only";

import { notFound } from "next/navigation";
import { requireActiveMembership } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { uuid, type AppointmentStatus } from "./contracts";
import { addDays, wallDate } from "./calendar";

export const appointmentFields = "id,client_id,procedure_id,membership_id,care_plan_id,source,kind,status,starts_at,ends_at,time_zone,notes,demo_reference,clients(full_name),procedures(name)";
export type Appointment = {
  id: string; client_id: string | null; procedure_id: string; membership_id: string; care_plan_id: string | null;
  source: "clinic" | "online_demo"; kind: "procedure" | "follow_up"; status: AppointmentStatus;
  starts_at: string; ends_at: string; time_zone: string; notes: string; demo_reference: string | null;
  clients: { full_name: string } | null; procedures: { name: string } | null;
};
export type Roster = { id: string; name: string; own: boolean; zone: string };
export type Rule = {
  id: string; membership_id: string | null; weekday: number | null; local_date: string | null;
  kind: "work" | "break" | "closed"; start_minute: number; end_minute: number;
};
export type PublicCatalog = {
  name: string; zone: string;
  services: { id: string; name: string; minutes: number }[];
  specialists: { id: string; label: string }[];
};

export async function schedulingRoster(clinic: string, actor: string) {
  const { data, error } = await createAdminSupabaseClient().rpc("phase12_roster", {
    actor, clinic
  });
  if (error || !Array.isArray(data)) throw new Error("Klinik takvimi yüklenemedi.");
  const roster = data as Roster[];
  return { roster, zone: roster[0]?.zone ?? "Europe/Istanbul" };
}

export async function appointmentContext() {
  const context = await requireActiveMembership();
  return { ...context, ...(await schedulingRoster(context.organization.id, context.user.id)),
    manager: context.membership.roleKey !== "staff" };
}

export async function appointmentOptions(clinic: string) {
  const db = await createServerSupabaseClient();
  const [clients, procedures, services, plans] = await Promise.all([
    db.from("clients").select("id,full_name").eq("organization_id", clinic).eq("status", "active").order("full_name"),
    db.from("procedures").select("id,name").eq("organization_id", clinic).eq("status", "active").order("name"),
    db.from("appointment_services").select("procedure_id,minutes,public_demo").eq("organization_id", clinic),
    db.from("care_plans").select("id,client_id,procedure_id,start_date").eq("organization_id", clinic).order("start_date", { ascending: false })
  ]);
  if (clients.error || procedures.error || services.error || plans.error) throw new Error("Randevu seçenekleri yüklenemedi.");
  return { clients: clients.data, procedures: procedures.data, services: services.data, plans: plans.data };
}

type Filters = { client?: string; member?: string; status?: AppointmentStatus };
export async function listAppointments(clinic: string, options: Filters & {
  start?: string; end?: string; zone?: string; upcoming?: boolean; limit?: number; newest?: boolean; offset?: number
} = {}) {
  const db = await createServerSupabaseClient();
  const batch = options.limit ?? 250;
  const items: Appointment[] = [];
  let offset = options.offset ?? 0;
  for (;;) {
    let query = db.from("appointments").select(appointmentFields).eq("organization_id", clinic)
      .order("starts_at", { ascending: !options.newest && (!options.client || Boolean(options.start || options.upcoming)) }).order("id");
    if (options.start) query = query.gte("starts_at", addDays(options.start, -1) + "T00:00:00Z");
    if (options.end) query = query.lt("starts_at", addDays(options.end, 1) + "T00:00:00Z");
    if (options.client) query = query.eq("client_id", options.client);
    if (options.member) query = query.eq("membership_id", options.member);
    if (options.status) query = query.eq("status", options.status);
    if (options.upcoming) query = query.gte("starts_at", new Date().toISOString()).in("status", ["confirmed", "pending"]);
    const { data, error } = await query.range(offset, offset + batch - 1).returns<Appointment[]>();
    if (error) throw new Error("Randevular yüklenemedi.");
    for (const item of data) {
      if (!options.zone || (!options.start && !options.end)) {
        items.push(item);
        continue;
      }
      const date = wallDate(item.starts_at, options.zone);
      if ((!options.start || date >= options.start) && (!options.end || date < options.end)) items.push(item);
    }
    if (data.length < batch || (options.limit && items.length >= options.limit)) return items;
    offset += batch;
  }
}

export async function getAppointment(clinic: string, id: string) {
  if (!uuid.safeParse(id).success) notFound();
  const db = await createServerSupabaseClient();
  const { data, error } = await db.from("appointments").select(appointmentFields)
    .eq("organization_id", clinic).eq("id", id).maybeSingle<Appointment>();
  if (error) throw new Error("Randevu yüklenemedi.");
  if (!data) notFound();
  return data;
}

export function appointmentStarted(instant: string) {
  return Date.parse(instant) <= Date.now();
}
