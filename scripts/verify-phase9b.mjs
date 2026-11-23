#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { printSafeIdentity, resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

const root = process.cwd();

const SYNTHETIC_ENV = {
  PHOTO_CLEANUP_SECRET: "local-photo-cleanup-secret-32-chars",
  RATE_LIMIT_CLEANUP_SECRET: "local-rate-limit-cleanup-secret-32",
  PW_REUSE_EXISTING_SERVER: "false"
};

const E2E_ENV = {
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD: "3",
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS: "60"
};

const PORTAL_SUITE_ENV = {
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD: "30",
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS: "900"
};

let resolvedChildEnv = { ...process.env, ...SYNTHETIC_ENV };

function fail(label, message) {
  console.error(`[verify:phase9b] FAIL — ${label}: ${message}`);
  process.exit(1);
}

function refreshResolvedEnv() {
  const bundle = resolveLocalSupabaseEnv({ includeServiceRole: true });
  resolvedChildEnv = {
    ...bundle.resolved,
    ...SYNTHETIC_ENV
  };
  printSafeIdentity(bundle.identity);
  return bundle;
}

function run(label, command, args = [], options = {}) {
  console.log(`[verify:phase9b] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...resolvedChildEnv, ...options.env },
    shell: false
  });
  return result.status ?? 1;
}

function runOrFail(label, command, args = [], options = {}) {
  const status = run(label, command, args, options);
  if (status !== 0) {
    process.exit(status);
  }
}

function runNpm(script, options = {}) {
  return run(script, "npm", ["run", script], options);
}

function runNpmOrFail(script, options = {}) {
  const status = runNpm(script, options);
  if (status !== 0) {
    process.exit(status);
  }
}

function assertReadiness(label = "local supabase readiness") {
  runOrFail(label, "node", ["scripts/assert-local-supabase-readiness.mjs"]);
}

function recoverAuthGatewayAfterReset(reason) {
  console.log(`[verify:phase9b] controlled recovery — ${reason} auth gateway unhealthy after db:reset`);
  runOrFail("supabase:stop", "npm", ["run", "supabase:stop"], { env: process.env });
  runOrFail("supabase:start", "npm", ["run", "supabase:start"], { env: process.env });
  runOrFail("supabase:write-env", "npm", ["run", "supabase:write-env"], { env: process.env });
  refreshResolvedEnv();
  runNpmOrFail("db:reset");
  runOrFail("supabase:write-env", "npm", ["run", "supabase:write-env"], { env: process.env });
  refreshResolvedEnv();
}

function assertReadinessWithRecovery(label) {
  const status = run(label, "node", ["scripts/assert-local-supabase-readiness.mjs"]);
  if (status === 0) {
    return;
  }
  recoverAuthGatewayAfterReset(label);
  runOrFail(`${label} (recovery)`, "node", ["scripts/assert-local-supabase-readiness.mjs"]);
}

function coldBootstrap() {
  console.log("[verify:phase9b] cold bootstrap — stop/start local supabase");
  runOrFail("supabase:stop", "npm", ["run", "supabase:stop"], { env: process.env });
  runOrFail("supabase:start", "npm", ["run", "supabase:start"], { env: process.env });
  runOrFail("supabase:write-env", "npm", ["run", "supabase:write-env"], { env: process.env });
  refreshResolvedEnv();
  assertReadiness("cold bootstrap readiness");
}

function ensureLocalEnvironment() {
  try {
    refreshResolvedEnv();
  } catch (error) {
    console.log(
      `[verify:phase9b] readiness probe could not resolve local env: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    coldBootstrap();
    return;
  }

  const probeStatus = run("readiness probe", "node", ["scripts/assert-local-supabase-readiness.mjs"]);
  if (probeStatus === 0) {
    console.log("[verify:phase9b] warm start — existing local supabase is ready");
    return;
  }

  coldBootstrap();
}

function runDbResetWithReadiness(label = "db:reset") {
  console.log(`[verify:phase9b] ${label}`);
  runNpmOrFail("db:reset");
  runOrFail("supabase:write-env", "npm", ["run", "supabase:write-env"], { env: process.env });
  refreshResolvedEnv();
  assertReadinessWithRecovery(`${label} readiness`);
}

function controlledRecovery(reason) {
  console.log(`[verify:phase9b] controlled recovery — ${reason}`);
  recoverAuthGatewayAfterReset(reason);
  assertReadiness("controlled recovery readiness");
}

function runNpmWithRecovery(script, options = {}) {
  const status = runNpm(script, options);
  if (status === 0) {
    return;
  }
  controlledRecovery(`${script} failed with exit ${status}`);
  console.log(`[verify:phase9b] ${script} (retry)`);
  const retryStatus = runNpm(script, options);
  if (retryStatus !== 0) {
    fail(script, `failed after controlled recovery (exit ${retryStatus})`);
  }
}

function main() {
  console.log("[verify:phase9b] start — local demo/pilot verification only");

  console.log("[verify:phase9b] bootstrap — local identity");
  ensureLocalEnvironment();

  console.log("[verify:phase9b] A — static/repository checks");
  runOrFail("repository hygiene", "node", ["scripts/verify-repository-hygiene.mjs"]);
  runOrFail("migration integrity", "node", ["scripts/verify-migration-integrity.mjs"]);
  runOrFail("next-env canonical", "node", ["scripts/verify-next-env-dts.mjs"]);
  runNpmOrFail("test:env-contract");
  runOrFail("demo fixture contracts", "npx", ["vitest", "run", "tests/unit/phase9b-demo-fixture.test.ts"]);
  runOrFail("git diff --check", "git", ["diff", "--check"]);

  console.log("[verify:phase9b] B — clean database contract");
  runDbResetWithReadiness();
  runNpmOrFail("db:lint");
  runNpmOrFail("test:db");
  runNpmOrFail("test:rls:local");

  console.log("[verify:phase9b] C — unit/static application validation");
  runNpmOrFail("test");
  runNpmOrFail("lint");
  runNpmOrFail("typecheck");
  runOrFail("normalize next-env for production build", "node", ["scripts/verify-next-env-dts.mjs", "--fix"]);
  runNpmOrFail("build");
  runOrFail("dependency audit", "npm", ["audit", "--audit-level=high"]);

  console.log("[verify:phase9b] D — base-state e2e");
  runDbResetWithReadiness("phase5 pre-reset");
  runNpmWithRecovery("test:e2e:phase5", { env: PORTAL_SUITE_ENV });
  runNpmOrFail("test:auth");
  runDbResetWithReadiness();
  runNpmWithRecovery("test:e2e:phase6", { env: PORTAL_SUITE_ENV });
  runDbResetWithReadiness();
  runNpmWithRecovery("test:e2e:phase7", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase7-ui", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase7-view", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase7-cleanup", { env: E2E_ENV });
  runDbResetWithReadiness();
  runNpmWithRecovery("test:e2e:phase8", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:design", { env: PORTAL_SUITE_ENV });
  runNpmWithRecovery("test:e2e:phase9a-rate-limit", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase9b-photo-request");
  runDbResetWithReadiness();
  runNpmWithRecovery("test:e2e:phase9b-mobile-a11y", { env: PORTAL_SUITE_ENV });
  runNpmWithRecovery("test:e2e:phase9b-final-ui", { env: PORTAL_SUITE_ENV });

  console.log("[verify:phase9b] E — demo-state verification");
  runDbResetWithReadiness();
  runNpmOrFail("demo:setup");
  assertReadiness("demo setup readiness");
  runNpmOrFail("test:db");
  runNpmOrFail("test:rls:local");
  runNpmWithRecovery("test:e2e:phase9b-demo", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase9b-pilot-golden-journey", { env: E2E_ENV });
  runNpmWithRecovery("test:e2e:phase9b-ui", { env: E2E_ENV });
  runOrFail("demo setup idempotency", "node", ["scripts/setup-phase9b-demo.mjs"]);
  runNpmOrFail("demo:reset");
  runDbResetWithReadiness("final clean reset");

  runOrFail("restore next-env after build", "git", ["restore", "next-env.d.ts"]);
  runOrFail("tracked worktree integrity", "node", ["scripts/verify-tracked-worktree.mjs"]);
  console.log("[verify:phase9b] PASS — local demo/pilot verification completed");
}

main();
