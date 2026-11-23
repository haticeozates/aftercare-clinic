#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const SEED_LOGIN_EMAIL = "alpha-owner@example.test";
const DEFAULT_PASSWORD = "local-test-password";
const MAX_ATTEMPTS = 120;
const RETRY_DELAY_MS = 1_000;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return {};
  }

  const vars = {};
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

function envValue(key, fallback) {
  const local = loadEnvLocal();
  return process.env[key] ?? local[key] ?? fallback;
}

async function waitForSupabaseAuthReady() {
  const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  const anonKey = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? DEFAULT_PASSWORD;

  if (!anonKey) {
    console.error("[wait-local-supabase-auth] NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
    process.exit(1);
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const restResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: anonKey }
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
        console.log("[wait-local-supabase-auth] ready");
        return;
      }

      console.log(`[wait-local-supabase-auth] not ready (${attempt}/${MAX_ATTEMPTS}): ${loginResponse.status}`);
    } catch {
      console.log(`[wait-local-supabase-auth] not ready (${attempt}/${MAX_ATTEMPTS})`);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, RETRY_DELAY_MS));
  }

  console.error("[wait-local-supabase-auth] timed out waiting for seed login");
  process.exit(1);
}

await waitForSupabaseAuthReady();
