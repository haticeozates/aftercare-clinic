import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readPackageScripts() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts as Record<string, string>;
}

function readCiWorkflow() {
  return readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
}

describe("phase 9a stage3 ci and release-gate gaps", () => {
  it("exposes a single fail-closed predeploy verification command", () => {
    const scripts = readPackageScripts();
    expect(scripts["verify:predeploy"]).toBeTruthy();
    expect(scripts["verify:predeploy"]).toMatch(/verify-predeploy/);
  });

  it("ships a migration integrity verifier script and frozen manifest", () => {
    expect(existsSync(join(root, "scripts/verify-migration-integrity.mjs"))).toBe(true);
    expect(existsSync(join(root, "supabase/migrations/frozen-manifest.json"))).toBe(true);
  });

  it("ships repository hygiene and next-env validators", () => {
    expect(existsSync(join(root, "scripts/verify-repository-hygiene.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/verify-next-env-dts.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/verify-tracked-worktree.mjs"))).toBe(true);
  });

  it("requires migration integrity in CI", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/verify-migration-integrity/);
  });

  it("requires repository hygiene in CI", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/verify-repository-hygiene/);
  });

  it("requires phase 7, 8 and 9 e2e gates in CI", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/test:e2e:phase7/);
    expect(ci).toMatch(/test:e2e:phase8/);
    expect(ci).toMatch(/test:e2e:phase9a/);
  });

  it("uses Node 24 and npm ci in CI without continue-on-error", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/node-version:\s*["']?24/);
    expect(ci).toMatch(/npm ci/);
    expect(ci).not.toMatch(/continue-on-error:\s*true/);
  });

  it("runs npm audit and post-build tracked file integrity in CI", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/npm audit/);
    expect(ci).toMatch(/verify-tracked-worktree/);
  });

  it("documents Linux Node 24 clean verification", () => {
    const scripts = readPackageScripts();
    expect(scripts["verify:linux-node24-clean"]).toBeTruthy();
  });

  it("uses minimum read-only GitHub permissions in CI", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/permissions:/);
    expect(ci).toMatch(/contents:\s*read/);
  });

  it("runs CI on pull requests to main and pushes to phase branches", () => {
    const ci = readCiWorkflow();
    expect(ci).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    expect(ci).toMatch(/- "phase-\*\*"/);
    expect(ci).toMatch(/workflow_dispatch:/);
  });
});
