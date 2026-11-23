"use server";

import { redirect } from "next/navigation";
import { phase11Config } from "@/lib/phase11/config";
import { clearInviteCookie, clearRecoveryCookie, getInviteCookie, getOnboarding } from "@/lib/phase11/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-posta ve parola zorunludur." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Giriş bilgileri doğrulanamadı." };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (phase11Config()) {
    if (await getInviteCookie()) redirect("/ekip/davet");
    const state = await getOnboarding(data.user.id);
    if (state && !state.completed_at && (state.organization_id || !membership)) redirect("/kurulum");
  }

  if (!membership) {
    redirect("/unauthorized");
  }

  redirect("/clinic");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  if (phase11Config()) {
    await clearInviteCookie();
    await clearRecoveryCookie();
  }
  redirect("/login");
}
