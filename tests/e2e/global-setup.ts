import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED_LOGIN_EMAIL = "alpha-owner@example.test";
const DEFAULT_PASSWORD = "local-test-password";
const MAX_ATTEMPTS = 90;
const RETRY_DELAY_MS = 1_000;

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return {};
  }

  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    vars[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).trim();
  }

  return vars;
}

function envValue(key: string, fallback?: string): string {
  const local = loadEnvLocal();
  const value = process.env[key] ?? local[key] ?? fallback;
  if (!value) {
    throw new Error(`${key} is required for e2e global setup`);
  }

  return value;
}

async function waitForSupabaseAuthReady(): Promise<void> {
  const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  const anonKey = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? DEFAULT_PASSWORD;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const restResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: anonKey
        }
      });
      if (!restResponse.ok) {
        throw new Error(`rest api returned ${restResponse.status}`);
      }

      const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          email: SEED_LOGIN_EMAIL,
          password
        })
      });

      if (loginResponse.ok) {
        return;
      }

      const body = await loginResponse.text();
      console.log(`[e2e setup] seed login not ready (${attempt}/${MAX_ATTEMPTS}): ${loginResponse.status} ${body}`);
    } catch (error) {
      console.log(`[e2e setup] supabase auth not ready (${attempt}/${MAX_ATTEMPTS}):`, error);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, RETRY_DELAY_MS));
  }

  throw new Error("Supabase auth did not accept seed login credentials in time");
}

export default async function globalSetup(): Promise<void> {
  await waitForSupabaseAuthReady();
}
