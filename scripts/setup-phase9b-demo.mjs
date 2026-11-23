#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { isLocalHostname, loadEnvFile, readSupabaseStatusEnv } from "./lib/local-supabase-env.mjs";

const root = process.cwd();
const fixturePath = resolve(root, "supabase/demo/phase9b-demo.sql");

const DEMO_ORG_ID = "00000000-0000-4000-8000-00000000d901";
const DEMO_PLAN_ID = "00000000-0000-4000-8000-00000000da01";

function fail(message) {
  console.error(`demo:setup failed: ${message}`);
  process.exit(1);
}

function assertLocalOnly(env, status) {
  const databaseUrl = env.TEST_DATABASE_URL ?? status.DB_URL;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = env.SUPABASE_PROJECT_REF ?? "";
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF ?? "";

  if (!isLocalHostname(databaseUrl)) {
    fail("database URL must target localhost/127.0.0.1");
  }
  if (supabaseUrl && !isLocalHostname(supabaseUrl)) {
    fail("NEXT_PUBLIC_SUPABASE_URL must be local");
  }
  if (projectRef && !(projectRef === "local-aftercare" || projectRef.startsWith("local-"))) {
    fail("SUPABASE_PROJECT_REF must be a local-* ref");
  }
  if (productionRef && projectRef && projectRef === productionRef) {
    fail("refuses to run against PRODUCTION_SUPABASE_PROJECT_REF");
  }
  if (/supabase\.co|aws|azure|gcp/i.test(databaseUrl) || /supabase\.co/i.test(supabaseUrl)) {
    fail("refuses remote Supabase hosts");
  }

  // Compare endpoints after confirming both hosts are loopback.
  const matchesLocalStack = (value, expected, defaultPort) => {
    if (!isLocalHostname(expected)) return false;
    const current = new URL(value);
    const target = new URL(expected);
    return current.protocol === target.protocol && (current.port || defaultPort) === (target.port || defaultPort)
      && current.pathname === target.pathname;
  };
  if (!matchesLocalStack(databaseUrl, status.DB_URL, "5432") ||
      (supabaseUrl && !matchesLocalStack(supabaseUrl, status.API_URL, "80"))) {
    fail("Supabase and PostgreSQL destinations must match the active local stack");
  }
  if (["preview", "staging", "production"].includes(env.APP_ENV)) {
    fail("fixture setup environment must be local");
  }
  return databaseUrl;
}

function assertFixtureSafety() {
  if (!existsSync(fixturePath)) {
    fail("fixture SQL is missing");
  }
  const source = readFileSync(fixturePath, "utf8");
  if (/service_role|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(source)) {
    fail("fixture must not contain service-role material");
  }
  if (/signed[_-]?url|care-photos\/|incoming\//i.test(source)) {
    fail("fixture must not contain storage paths or signed URLs");
  }
  if (!/@example\.test/.test(source)) {
    fail("fixture must use .test emails");
  }
  const emails = source.match(/[a-z0-9._+-]+@[a-z0-9.-]+/gi) ?? [];
  for (const email of emails) {
    if (!email.endsWith(".test")) {
      fail(`non-.test email in fixture: ${email}`);
    }
  }
}

async function applyFixture(databaseUrl) {
  const sql = readFileSync(fixturePath, "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
    const checks = await client.query(
      `
        select
          (select count(*)::int from public.organizations where id = $1) as orgs,
          (select count(*)::int from public.care_plans where id = $2) as plans,
          (select count(*)::int from public.photo_requests where organization_id = $1 and status = 'active') as photo_requests,
          (select count(*)::int from public.alerts where organization_id = $1) as alerts,
          (select count(*)::int from public.data_requests where organization_id = $1) as data_requests,
          (select count(*)::int from public.organizations where slug in ('organization-alpha','organization-beta')) as base_orgs
      `,
      [DEMO_ORG_ID, DEMO_PLAN_ID]
    );
    const row = checks.rows[0];
    if (row.orgs !== 1 || row.plans !== 1 || row.photo_requests < 1 || row.alerts < 1 || row.data_requests < 1) {
      fail("demo records were not created as expected");
    }
    if (row.base_orgs !== 2) {
      fail("base Alpha/Beta organizations must remain present");
    }
  } finally {
    await client.end();
  }
}

function printSafeSummary() {
  console.log(
    JSON.stringify(
      {
        ok: true,
        clinic: "Demo Pilot Clinic",
        organizationId: DEMO_ORG_ID,
        planId: DEMO_PLAN_ID,
        accounts: [
          { email: "demo-owner@example.test", role: "owner" },
          { email: "demo-admin@example.test", role: "admin" },
          { email: "demo-staff@example.test", role: "staff" }
        ],
        passwordHint: "local-test-password (synthetic only)",
        notes: [
          "Create a live secure portal link through the clinic UI; fixture stores hash-only placeholders.",
          "Do not use real clinic, patient or legal data."
        ]
      },
      null,
      2
    )
  );
}

async function main() {
  assertFixtureSafety();
  const env = { ...loadEnvFile(), ...process.env };
  const databaseUrl = assertLocalOnly(env, readSupabaseStatusEnv());

  await applyFixture(databaseUrl);
  printSafeSummary();
}

main().catch(() => {
  fail("could not verify the local stack or apply the synthetic fixture");
});
