#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function parseStatusEnv(output) {
  const values = {};

  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) {
    throw new Error(`supabase status did not provide ${key}`);
  }
  return value;
}

function main() {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: ".supabase-home"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const status = parseStatusEnv(output);
  const apiUrl = requireValue(status, "API_URL");
  const anonKey = requireValue(status, "ANON_KEY");
  const serviceRoleKey = requireValue(status, "SERVICE_ROLE_KEY");

  const contents = [
    "APP_ENV=development",
    `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
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
