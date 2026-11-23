#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
const EXPECTED_PROJECT_ID = "aftercare-clinic-platform";
const EXPECTED_LATEST_MIGRATION = "20261119094234";
const EXPECTED_MIGRATION_COUNT = 30;

export function parseStatusEnv(output) {
  const values = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function isLocalHostname(value) {
  if (!value) {
    return false;
  }
  try {
    const normalized = value.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const hostname = new URL(normalized).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export function readSupabaseStatusEnv() {
  const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: resolve(root, ".supabase-home")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return parseStatusEnv(output);
}

export function loadEnvFile() {
  const output = {};
  if (!existsSync(envPath)) {
    return output;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    output[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
  return output;
}

export function assertLocalOnlyTargets(status) {
  const apiUrl = status.API_URL ?? "";
  const dbUrl = status.DB_URL ?? "";
  if (!isLocalHostname(apiUrl)) {
    throw new Error("API_URL must target localhost/127.0.0.1");
  }
  if (!isLocalHostname(dbUrl)) {
    throw new Error("DB_URL must target localhost/127.0.0.1");
  }
  if (/supabase\.co|pooler\.supabase\.com/i.test(`${apiUrl} ${dbUrl}`)) {
    throw new Error("refuses remote Supabase hosts");
  }
}

export function resolveLocalSupabaseEnv(options = {}) {
  const status = readSupabaseStatusEnv();
  assertLocalOnlyTargets(status);

  const apiUrl = status.API_URL;
  const dbUrl = status.DB_URL;
  const anonKey = status.ANON_KEY;
  if (!apiUrl || !dbUrl || !anonKey) {
    throw new Error("supabase status missing API_URL, DB_URL, or ANON_KEY");
  }

  const fileEnv = loadEnvFile();
  const projectRef = fileEnv.SUPABASE_PROJECT_REF ?? "local-aftercare";
  const productionRef = fileEnv.PRODUCTION_SUPABASE_PROJECT_REF ?? "";
  if (projectRef && !(projectRef === "local-aftercare" || projectRef.startsWith("local-"))) {
    throw new Error("SUPABASE_PROJECT_REF must be a local-* ref");
  }
  if (productionRef && projectRef && projectRef === productionRef) {
    throw new Error("refuses PRODUCTION_SUPABASE_PROJECT_REF");
  }

  const resolved = {
    ...process.env,
    ...fileEnv,
    APP_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    TEST_DATABASE_URL: dbUrl,
    SUPABASE_DB_URL: dbUrl,
    SUPABASE_PROJECT_REF: projectRef
  };

  if (options.includeServiceRole) {
    if (!status.SERVICE_ROLE_KEY) {
      throw new Error("supabase status missing local SERVICE_ROLE_KEY");
    }
    resolved.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  }

  return {
    status,
    resolved,
    identity: {
      projectId: EXPECTED_PROJECT_ID,
      apiHost: new URL(apiUrl).host,
      dbHost: new URL(dbUrl.replace(/^postgresql:/i, "http:")).host,
      database: new URL(dbUrl.replace(/^postgresql:/i, "http:")).pathname.replace(/^\//, "") || "postgres"
    }
  };
}

export function printSafeIdentity(identity) {
  console.log(
    `[local-supabase] project=${identity.projectId} api=${identity.apiHost} db=${identity.dbHost}/${identity.database}`
  );
}

export const coreSchemaExpectations = {
  expectedLatestMigration: EXPECTED_LATEST_MIGRATION,
  expectedMigrationCount: EXPECTED_MIGRATION_COUNT,
  createPhotoRequestSignature: "public.create_photo_request_for_staff(uuid, uuid, text, boolean)",
  getPortalPlanSignature: "public.get_portal_plan_for_session(text, uuid)"
};
