"use server";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { redirect } from "next/navigation";
import { authToken, demoEmail, password, type Phase11State } from "./config";
import {
  clearRecoveryCookie, getInviteCookie, getOnboarding, getRecoveryCookie, requirePhase11, setRecoveryCookie
} from "./server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { consumeSecurityRateLimit } from "@/lib/rate-limit/consume";
import { deriveRateLimitClientFacet } from "@/lib/rate-limit/keys";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";

const requestReceived = "İstek alındı. Adres bu işlem için uygunsa yerel test posta kutusuna bir bağlantı gönderilir.";
const linkError = "Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir bağlantı isteyin.";

async function throttle(route: string, email?: string) {
  const scope = RATE_LIMIT_SCOPES.AUTH_ENTRY;
  const total = await consumeSecurityRateLimit({ scope, route: "/auth/total", clientFacet: "phase11-local-demo" });
  if (!total.allowed || !email) return total.allowed;
  const result = await consumeSecurityRateLimit({ scope, route, clientFacet: deriveRateLimitClientFacet(email) });
  return result.allowed;
}

export async function signUpAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const email = demoEmail.safeParse(form.get("email"));
  const secret = password.safeParse(form.get("password"));
  if (!email.success) return { error: "Yerel demo için .test ile biten bir e-posta adresi kullanın." };
  if (!secret.success || secret.data !== form.get("confirm")) {
    return { error: "Parolalar aynı olmalı ve 12–72 bayt uzunluğunda olmalıdır." };
  }
  if (form.get("website")) return { success: requestReceived };
  if (!await throttle("/auth/signup", email.data)) return { success: requestReceived };

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.signUp({ email: email.data, password: secret.data });
  if (data.session) {
    // Refuse misconfigured Auth instances that issue a session before confirmation.
    await supabase.auth.signOut();
    return { error: "Hesap kaydı şu anda kullanılamıyor." };
  }
  if (data.user?.identities?.length && !data.user.email_confirmed_at) {
    const { error } = await createAdminSupabaseClient().from("phase11_onboarding").upsert(
      { user_id: data.user.id }, { onConflict: "user_id", ignoreDuplicates: true }
    );
    if (error) return { error: "Hesap kaydı şu anda tamamlanamadı. Daha sonra tekrar deneyin." };
  }
  return { success: requestReceived };
}

export async function recoveryAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const email = demoEmail.safeParse(form.get("email"));
  if (!email.success) return { error: "Yerel demo için .test ile biten bir e-posta adresi kullanın." };
  if (!form.get("website") && await throttle("/auth/recovery", email.data)) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.resetPasswordForEmail(email.data);
  }
  return { success: requestReceived };
}

export async function confirmAuthAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const mode = form.get("mode");
  const token = authToken.safeParse(form.get("token"));
  if ((mode !== "signup" && mode !== "recovery") || !token.success || !await throttle("/auth/confirm")) {
    return { error: linkError };
  }

  if (mode === "recovery") {
    await setRecoveryCookie(token.data);
    redirect("/sifre-yenile");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: token.data, type: "signup" });
  if (error || !data.user?.email_confirmed_at) return { error: linkError };
  if (!demoEmail.safeParse(data.user.email).success) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: linkError };
  }

  const onboarding = await getOnboarding(data.user.id);
  if (await getInviteCookie()) redirect("/ekip/davet");
  if (onboarding && !onboarding.completed_at) redirect("/kurulum");
  redirect("/clinic");
}

export async function resetPasswordAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const secret = password.safeParse(form.get("password"));
  if (!secret.success || secret.data !== form.get("confirm")) {
    return { error: "Parolalar aynı olmalı ve 12–72 bayt uzunluğunda olmalıdır." };
  }
  const token = await getRecoveryCookie();
  if (!token || !await throttle("/auth/confirm")) return { error: linkError };
  await clearRecoveryCookie();

  // Verify the recovery OTP and use its session exclusively on the server.
  const env = getServerEnv();
  const recovery = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error: invalid } = await recovery.auth.verifyOtp({ token_hash: token, type: "recovery" });
  if (invalid || !data.user?.email_confirmed_at || !demoEmail.safeParse(data.user.email).success) {
    redirect("/sifre-yenile?durum=gecersiz");
  }

  const { error } = await recovery.auth.updateUser({ password: secret.data });
  await recovery.auth.signOut({ scope: "global" });
  if (error) redirect("/sifre-yenile?durum=yeni-baglanti");

  const browser = await createServerSupabaseClient();
  await browser.auth.signOut({ scope: "local" });
  redirect("/login?parola=guncellendi");
}
