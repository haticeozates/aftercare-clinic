#!/usr/bin/env node

import pg from "pg";
import {
  coreSchemaExpectations,
  printSafeIdentity,
  resolveLocalSupabaseEnv
} from "./lib/local-supabase-env.mjs";

const SEED_LOGIN_EMAIL = "alpha-owner@example.test";
const DEFAULT_PASSWORD = "local-test-password";
const MAX_ATTEMPTS = 120;
const RETRY_DELAY_MS = 1_000;

function fail(stage, message) {
  console.error(`[assert-local-supabase-readiness] FAIL — ${stage}: ${message}`);
  process.exit(1);
}

async function sleep(ms) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function queryCoreSchema(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `
        select
          to_regclass('public.organizations') is not null as organizations,
          to_regclass('public.clients') is not null as clients,
          to_regprocedure($1::text) is not null as create_photo_request,
          to_regprocedure($2::text) is not null as get_portal_plan,
          (select count(*)::int from supabase_migrations.schema_migrations) as migration_count,
          (select version from supabase_migrations.schema_migrations order by version desc limit 1) as latest_migration
      `,
      [
        coreSchemaExpectations.createPhotoRequestSignature,
        coreSchemaExpectations.getPortalPlanSignature
      ]
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

function validateCoreSchemaRow(row) {
  if (!row.organizations) {
    throw new Error("public.organizations is missing");
  }
  if (!row.clients) {
    throw new Error("public.clients is missing");
  }
  if (!row.create_photo_request) {
    throw new Error("public.create_photo_request_for_staff is missing");
  }
  if (!row.get_portal_plan) {
    throw new Error("public.get_portal_plan_for_session is missing");
  }
  if (row.migration_count !== coreSchemaExpectations.expectedMigrationCount) {
    throw new Error(
      `expected ${coreSchemaExpectations.expectedMigrationCount} migrations, found ${row.migration_count}`
    );
  }
  if (row.latest_migration !== coreSchemaExpectations.expectedLatestMigration) {
    throw new Error(
      `expected latest migration ${coreSchemaExpectations.expectedLatestMigration}, found ${row.latest_migration}`
    );
  }
}

async function waitForRestAndAuth(resolved) {
  const supabaseUrl = resolved.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = resolved.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? DEFAULT_PASSWORD;

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
        console.log("[assert-local-supabase-readiness] rest and auth ready");
        return;
      }

      console.log(
        `[assert-local-supabase-readiness] auth not ready (${attempt}/${MAX_ATTEMPTS}): ${loginResponse.status}`
      );
    } catch {
      console.log(`[assert-local-supabase-readiness] readiness not ready (${attempt}/${MAX_ATTEMPTS})`);
    }

    await sleep(RETRY_DELAY_MS);
  }

  fail("auth readiness", "seed login did not succeed in time");
}

async function main() {
  let envBundle;
  try {
    envBundle = resolveLocalSupabaseEnv();
  } catch (error) {
    fail("local identity", error instanceof Error ? error.message : "unknown error");
  }

  printSafeIdentity(envBundle.identity);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const row = await queryCoreSchema(envBundle.resolved.TEST_DATABASE_URL);
      validateCoreSchemaRow(row);
      console.log("[assert-local-supabase-readiness] core schema ready");
      break;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        fail("db readiness", error instanceof Error ? error.message : "unknown error");
      }
      console.log(
        `[assert-local-supabase-readiness] db not ready (${attempt}/${MAX_ATTEMPTS}):`,
        error instanceof Error ? error.message : error
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  await waitForRestAndAuth(envBundle.resolved);
  console.log("[assert-local-supabase-readiness] PASS");
}

main().catch((error) => {
  fail("unexpected", error instanceof Error ? error.message : "unknown error");
});
