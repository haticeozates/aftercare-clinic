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
