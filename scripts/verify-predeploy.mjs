#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const SYNTHETIC_ENV = {
  PHOTO_CLEANUP_SECRET: "local-photo-cleanup-secret-32-chars",
  RATE_LIMIT_CLEANUP_SECRET: "local-rate-limit-cleanup-secret-32",
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD: "3",
  RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS: "60",
  PW_REUSE_EXISTING_SERVER: "false"
};

function run(label, command, args = []) {
  console.log(`[verify:predeploy] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...SYNTHETIC_ENV },
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  run("repository hygiene", "node", ["scripts/verify-repository-hygiene.mjs"]);
  run("migration integrity", "node", ["scripts/verify-migration-integrity.mjs"]);
  run("next-env canonical", "node", ["scripts/verify-next-env-dts.mjs"]);
  run("environment contract", "npm", ["run", "test:unit", "--", "tests/unit/env.test.ts"]);

  if (process.env.SKIP_NPM_CI !== "true") {
    run("lockfile install", "npm", ["ci"]);
  }

  run("supabase status", "npm", ["run", "supabase:status"]);
  run("database reset (1/2)", "npm", ["run", "db:reset"]);
  run("database reset (2/2)", "npm", ["run", "db:reset"]);
  run("database lint", "npm", ["run", "db:lint"]);
  run("pgtap", "npm", ["run", "test:db"]);
  run("local rls", "npm", ["run", "test:rls:local"]);
  run("rate-limit and stage2 hardening", "npm", ["run", "test:rate-limit"]);
  run("phase 7 e2e upload", "npm", ["run", "test:e2e:phase7"]);
  run("phase 7 e2e portal ui", "npm", ["run", "test:e2e:phase7-ui"]);
  run("phase 7 e2e clinic view", "npm", ["run", "test:e2e:phase7-view"]);
  run("phase 7 e2e cleanup", "npm", ["run", "test:e2e:phase7-cleanup"]);
  run("phase 8 e2e", "npm", ["run", "test:e2e:phase8"]);
  run("phase 9a rate-limit e2e", "npm", ["run", "test:e2e:phase9a-rate-limit"]);
  run("phase 9a stage2 e2e", "npm", ["run", "test:e2e:phase9a-stage2"]);
  run("unit suite", "npm", ["test"]);
  run("lint", "npm", ["run", "lint"]);
  run("typecheck", "npm", ["run", "typecheck"]);
  run("production build", "npm", ["run", "build"]);
  run("dependency audit", "npm", ["audit", "--audit-level=high"]);
  run("tracked worktree integrity", "node", ["scripts/verify-tracked-worktree.mjs"]);

  console.log("[verify:predeploy] pass");
}

main();
