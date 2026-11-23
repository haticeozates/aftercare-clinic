import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authToken, clinicManagementEnabled, demoEmail, inviteToken, phase11Config } from "./config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const inviteCookie = "aftercare_demo_invite";
const recoveryCookie = "aftercare_demo_recovery";

export function requirePhase11() {
  const config = phase11Config();
  if (!config) notFound();
  return config;
}

export function requireClinicManagement() {
  if (!clinicManagementEnabled()) notFound();
}

export async function getVerifiedUser() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return user?.email_confirmed_at && demoEmail.safeParse(user.email).success ? user : null;
}

export async function requireVerifiedUser() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  return user;
}

export async function getOnboarding(user: string) {
  const { data, error } = await createAdminSupabaseClient().from("phase11_onboarding")
    .select("organization_id,completed_at").eq("user_id", user).maybeSingle();
  if (error) throw new Error("Kurulum durumu yüklenemedi.");
  return data as { organization_id: string | null; completed_at: string | null } | null;
}

export function hashInvite(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export async function getInviteCookie() {
  const result = inviteToken.safeParse((await cookies()).get(inviteCookie)?.value);
  return result.success ? result.data : null;
}

const demoCookieOptions = { httpOnly: true, sameSite: "lax", path: "/" } as const;

export async function setInviteCookie(token: string) {
  (await cookies()).set(inviteCookie, token, { ...demoCookieOptions, maxAge: 1800 });
}

export async function clearInviteCookie() {
  (await cookies()).delete(inviteCookie);
}

export async function getRecoveryCookie() {
  const result = authToken.safeParse((await cookies()).get(recoveryCookie)?.value);
  return result.success ? result.data : null;
}

export async function setRecoveryCookie(token: string) {
  (await cookies()).set(recoveryCookie, token, { ...demoCookieOptions, maxAge: 900 });
}

export async function clearRecoveryCookie() {
  (await cookies()).delete(recoveryCookie);
}
