import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("phase 9a stage3 ci contract", () => {
  it("defines a fail-closed predeploy command", () => {
    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts;
    expect(scripts["verify:predeploy"]).toBe("node scripts/verify-predeploy.mjs");
  });

  it("triggers on pull requests to main and phase branch pushes", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    expect(ci).toMatch(/push:\s*\n\s*branches:\s*\n\s*- main\s*\n\s*- "phase-\*\*"/);
    expect(ci).toMatch(/workflow_dispatch:/);
    expect(ci).not.toMatch(/paths:/);
    expect(ci).not.toMatch(/paths-ignore:/);
  });

  it("keeps phase9a rate-limit e2e overrides out of workflow, static, and build scopes", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const [workflowPreamble] = ci.split(/^jobs:/m);
    const staticJob = ci.match(/^\s{2}static:[\s\S]*?(?=^\s{2}database:)/m)?.[0] ?? "";
    const buildJob = ci.match(/^\s{2}build:[\s\S]*?(?=^\s{2}predeploy-summary:)/m)?.[0] ?? "";

    for (const section of [workflowPreamble, staticJob, buildJob]) {
      expect(section).not.toMatch(/RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD/);
      expect(section).not.toMatch(/RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS/);
    }

    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts;
    expect(scripts["test:e2e:phase9a-rate-limit"]).toMatch(
      /RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD=3/
    );
    expect(scripts["test:e2e:phase9a-rate-limit"]).toMatch(
      /RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS=60/
    );
  });

  it("keeps the build job free of database-dependent vitest suites", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const buildJob = ci.match(/^\s{2}build:[\s\S]*?(?=^\s{2}predeploy-summary:)/m)?.[0] ?? "";
    const databaseJob = ci.match(/^\s{2}database:[\s\S]*?(?=^\s{2}e2e:)/m)?.[0] ?? "";

    expect(buildJob).toMatch(/npm run test:unit/);
    expect(buildJob).not.toMatch(/(^|\n)\s*- run: npm test\s*(\n|$)/);
    expect(buildJob).not.toMatch(/supabase:start/);
    expect(databaseJob).toMatch(/supabase:start/);
    expect(databaseJob).toMatch(/test:rate-limit/);
    expect(databaseJob).toMatch(/test:rls:local/);
  });

  it("bootstraps e2e with local supabase env and bundled chromium", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const e2eJob = ci.match(/^\s{2}e2e:[\s\S]*?(?=^\s{2}build:)/m)?.[0] ?? "";
    const playwrightConfig = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");
    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts;

    expect(e2eJob).toMatch(/supabase:start/);
    expect(e2eJob).toMatch(/supabase:write-env/);
    expect(e2eJob).toMatch(/playwright install --with-deps chromium/);
    expect(scripts["supabase:write-env"]).toMatch(/write-local-env-from-supabase/);
    expect(playwrightConfig).not.toMatch(/channel:\s*["']chrome["']/);
  });

  it("uses read-only permissions and required CI gates", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(ci).toMatch(/node-version:\s*"24"/);
    expect(ci).toMatch(/npm ci/);
    expect(ci).not.toMatch(/continue-on-error:\s*true/);
    expect(ci).toMatch(/verify-migration-integrity/);
    expect(ci).toMatch(/verify-repository-hygiene/);
    expect(ci).toMatch(/test:e2e:phase7/);
    expect(ci).toMatch(/test:e2e:phase8/);
    expect(ci).toMatch(/test:e2e:phase9a/);
    expect(ci).toMatch(/npm audit/);
    expect(ci).toMatch(/verify-tracked-worktree/);
    expect(ci).toMatch(/needs:\s*\[static, database, e2e, build\]/);
  });
});
