import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 3 pilot verification gaps", () => {
  it("requires a dedicated local verify:phase9b gate", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verify:phase9b"]).toMatch(/verify-phase9b/);
    expect(existsSync(join(root, "scripts/verify-phase9b.mjs"))).toBe(true);
  });

  it("keeps verify:phase9b local-only and secret-safe", () => {
    const script = read("scripts/verify-phase9b.mjs");
    const envLib = read("scripts/lib/local-supabase-env.mjs");
    expect(envLib).toMatch(/localhost|127\.0\.0\.1/);
    expect(envLib).toMatch(/refuses remote|must be local|PRODUCTION_SUPABASE_PROJECT_REF/i);
    expect(script).toMatch(/resolveLocalSupabaseEnv/);
    expect(script).toMatch(/process\.exit\(1\)|status !== 0/);
    expect(script).not.toMatch(/\bgit\s+(commit|push|tag|merge|reset|rebase|checkout)\b/);
    expect(script).not.toMatch(/console\.log\([^)]*SERVICE_ROLE|console\.log\([^)]*eyJ[A-Za-z0-9_-]+\./);
  });

  it("composes existing npm scripts instead of embedding long shell", () => {
    const script = read("scripts/verify-phase9b.mjs");
    expect(script).toMatch(/runDbResetWithReadiness/);
    expect(script).toMatch(/test:db/);
    expect(script).toMatch(/test:e2e:phase9b-demo/);
    expect(script).toMatch(/test:e2e:phase9a-rate-limit/);
    expect(script).toMatch(/PORTAL_SUITE_ENV|RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD: "30"/);
    expect(script).toMatch(/assert-local-supabase-readiness/);
    expect(script.length).toBeLessThan(16_000);
  });

  it("does not weaken faz 9a verify:predeploy", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verify:predeploy"]).toMatch(/verify-predeploy/);
    expect(read("scripts/verify-predeploy.mjs")).not.toMatch(/verify:phase9b/);
  });

  it("expects a pilot golden journey e2e separate from module suites", () => {
    expect(existsSync(join(root, "tests/e2e/phase9b-pilot-golden-journey.spec.ts"))).toBe(true);
    const spec = read("tests/e2e/phase9b-pilot-golden-journey.spec.ts");
    expect(spec).toMatch(/setup-phase9b-demo|reset-phase9b-demo/);
    expect(spec).not.toMatch(/phase5-portal\.spec|phase8-portal-decisions/);
  });

  it("requires pilot readiness and user guide playbooks", () => {
    expect(existsSync(join(root, "docs/playbooks/pilot-readiness-checklist.md"))).toBe(true);
    expect(existsSync(join(root, "docs/playbooks/pilot-user-guide.md"))).toBe(true);
  });

  it("requires a phase 9b acceptance matrix reference", () => {
    expect(existsSync(join(root, "docs/references/phase9b-acceptance-matrix.md"))).toBe(true);
  });
});
