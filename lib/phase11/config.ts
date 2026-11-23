import { z } from "zod";
import { isHostedAppEnv } from "@/lib/env";

function loopbackOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

export function phase11Config(env: Record<string, string | undefined> = process.env) {
  if (env.PHASE11_DEMO_ENABLED !== "true" || !["local", "test", "development"].includes(env.APP_ENV ?? "")
      || !loopbackOrigin(env.NEXT_PUBLIC_SUPABASE_URL)) {
    return null;
  }
  const appOrigin = loopbackOrigin(env.PHASE11_APP_ORIGIN);
  const mailOrigin = loopbackOrigin(env.PHASE11_MAILPIT_ORIGIN);
  return appOrigin && mailOrigin ? { appOrigin, mailOrigin } : null;
}

export function clinicManagementEnabled(env: Record<string, string | undefined> = process.env) {
  return isHostedAppEnv(env.APP_ENV ?? "") || Boolean(phase11Config(env));
}

export const demoEmail = z.string().trim().toLowerCase().max(254).pipe(z.email())
  .refine((value) => value.endsWith(".test"));
export const password = z.string().min(12).max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
export const authToken = z.string().regex(/^(?:pkce_)?[a-f0-9]{56}$/i);
export const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const clinicInput = z.object({
  clinic_name: z.string().trim().min(2).max(120),
  profile_name: z.string().trim().min(2).max(120),
  clinic_address: z.string().trim().max(240),
  clinic_phone: z.string().trim().max(40).regex(/^[0-9+ ().-]*$/),
  clinic_zone: z.enum(["Europe/Istanbul", "Europe/London", "Europe/Berlin", "UTC"])
});

export const roleLabels = {
  organization_owner: "İşletme sahibi",
  organization_admin: "Yönetici",
  staff: "Uzman"
};

export type Phase11State = { error?: string; success?: string };
