import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { clinicInput, roleLabels } from "./config";
import type { z } from "zod";

export type ClinicDetails = z.infer<typeof clinicInput>;
type Role = keyof typeof roleLabels;

export async function getClinicDetails(organization: { id: string; name: string }, actor: string): Promise<ClinicDetails> {
  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();
  const [{ data: clinic, error: clinicError }, { data: profile, error: profileError }] = await Promise.all([
    admin.from("phase11_clinic_settings").select("address,phone,time_zone")
      .eq("organization_id", organization.id).maybeSingle(),
    supabase.from("user_profiles").select("display_name").eq("id", actor).maybeSingle()
  ]);
  if (clinicError || profileError) throw new Error("Klinik profili yüklenemedi.");
  return {
    clinic_name: organization.name, profile_name: profile?.display_name ?? "",
    clinic_address: clinic?.address ?? "", clinic_phone: clinic?.phone ?? "",
    clinic_zone: clinic?.time_zone ?? "Europe/Istanbul"
  };
}

export async function listInvites(organization: string) {
  const { data, error } = await createAdminSupabaseClient().from("phase11_team_invites")
    .select("id,email,role_key,expires_at,delivered_at,accepted_at,revoked_at")
    .eq("organization_id", organization).order("created_at", { ascending: false }).limit(100)
    .returns<{
      id: string; email: string; role_key: Role; expires_at: string;
      delivered_at: string | null; accepted_at: string | null; revoked_at: string | null;
    }[]>();
  if (error) throw new Error("Davetler yüklenemedi.");
  const now = Date.now();
  return data.map((entry) => ({ ...entry, expired: Date.parse(entry.expires_at) <= now }));
}

export async function listTeam(organization: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("organization_memberships")
    .select("id,user_id,status,roles(key)").eq("organization_id", organization)
    .order("created_at").limit(100).returns<{
      id: string; user_id: string; status: "active" | "inactive"; roles: { key: Role };
    }[]>();
  if (error) throw new Error("Ekip üyeleri yüklenemedi.");
  const ids = data.map((member) => member.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: profileError } = await supabase.from("user_profiles")
    .select("id,display_name").in("id", ids);
  if (profileError) throw new Error("Ekip profilleri yüklenemedi.");
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  return data.map((member) => ({
    id: member.id, status: member.status, role: member.roles.key,
    name: names.get(member.user_id) ?? "Ekip üyesi"
  }));
}
