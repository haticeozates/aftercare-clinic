#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { readSupabaseStatusEnv } from "./lib/local-supabase-env.mjs";

function requireValue(values, key) {
  const value = values[key];
  if (!value) {
    throw new Error(`supabase status did not provide ${key}`);
  }
  return value;
}

function main() {
  const status = readSupabaseStatusEnv();
  const apiUrl = requireValue(status, "API_URL");
  const dbUrl = requireValue(status, "DB_URL");
  const anonKey = requireValue(status, "ANON_KEY");
  const serviceRoleKey = requireValue(status, "SERVICE_ROLE_KEY");

  const contents = [
    "APP_ENV=development",
    `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `TEST_DATABASE_URL=${dbUrl}`,
    `SUPABASE_DB_URL=${dbUrl}`,
    "SUPABASE_PROJECT_REF=local-aftercare",
    "PRODUCTION_SUPABASE_PROJECT_REF=ci-production-ref-placeholder",
    "AUDIT_LOG_PEPPER=local-audit-pepper-deterministic-ci-only-32",
    "RATE_LIMIT_PEPPER=local-rate-limit-pepper-deterministic-ci-32",
    "RATE_LIMIT_CLEANUP_SECRET=local-rate-limit-cleanup-secret-32",
    "PHOTO_CLEANUP_SECRET=local-photo-cleanup-secret-32-chars",
    ""
  ].join("\n");

  writeFileSync(".env.local", contents, { encoding: "utf8", mode: 0o600 });
  console.log("wrote .env.local from local supabase status (values redacted)");
}

main();
