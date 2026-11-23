import { isLocalSupabaseUrl } from "@/lib/env";

export function publicInquiriesEnabled(env: Record<string, string | undefined> = process.env) {
  return !env.VERCEL
    && !env.VERCEL_ENV
    && ["local", "test", "development"].includes(env.APP_ENV ?? "")
    && isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}
