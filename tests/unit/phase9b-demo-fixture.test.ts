import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b demo fixture contracts", () => {
  it("ships a separate local demo fixture outside the base seed", () => {
    expect(existsSync(join(root, "supabase/demo/phase9b-demo.sql"))).toBe(true);
    expect(existsSync(join(root, "scripts/setup-phase9b-demo.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/reset-phase9b-demo.mjs"))).toBe(true);

    const seed = read("supabase/seed.sql");
    expect(seed).not.toMatch(/demo-pilot-clinic|demo-owner@example\.test/);
  });

  it("keeps fixture synthetic-only and free of secrets or portal tokens", () => {
    const fixture = read("supabase/demo/phase9b-demo.sql");
    const setup = read("scripts/setup-phase9b-demo.mjs");

    expect(fixture).toMatch(/demo-owner@example\.test/);
    expect(fixture).toMatch(/demo-admin@example\.test/);
    expect(fixture).toMatch(/demo-staff@example\.test/);
    expect(fixture).toMatch(/@example\.test/);
    expect(fixture).not.toMatch(/@gmail\.com|@hotmail\.com|@clinic\.com/i);
    expect(fixture).not.toMatch(/service_role|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(fixture).not.toMatch(/signed[_-]?url|care-photos\/|incoming\//i);
    expect(fixture).toMatch(/phase9b-demo-fixture-hash-only-not-a-token/);
    expect(fixture).not.toMatch(/create_secure_link_for_plan\(/);
    expect(setup).toMatch(/localhost|127\.0\.0\.1/);
    expect(setup).toMatch(/PRODUCTION_SUPABASE_PROJECT_REF/);
    expect(setup).toMatch(/refuses remote Supabase hosts|must be local/);
  });

  it("creates the expected demo relationships without inventing new lifecycles", () => {
    const fixture = read("supabase/demo/phase9b-demo.sql");
    expect(fixture).toMatch(/Demo Pilot Clinic/);
    expect(fixture).toMatch(/Synthetic Demo Client/);
    expect(fixture).toMatch(/photo_requests/);
    expect(fixture).toMatch(/client_document_assignments/);
    expect(fixture).toMatch(/data_requests/);
    expect(fixture).toMatch(/alerts/);
    expect(fixture).toMatch(/symptom_reports/);
    expect(fixture).toMatch(/care_plan_task_events/);
    expect(fixture).toMatch(/00000000-0000-4000-8000-00000000da21/);
    expect(fixture).toMatch(/event_type[\s\S]*'completed'/);
    expect(fixture).toMatch(/00000000-0000-4000-8000-00000000da22[\s\S]*'pending'/);
    expect(fixture).toMatch(/public\.portal_today\(\)/);
    expect(fixture).toMatch(/00000000-0000-4000-8000-00000000da01/);
  });

  it("exposes package scripts for setup, reset, demo readiness e2e, and phase9b verification", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["demo:setup"]).toMatch(/setup-phase9b-demo/);
    expect(pkg.scripts["demo:reset"]).toMatch(/reset-phase9b-demo/);
    expect(pkg.scripts["test:e2e:phase9b-demo"]).toMatch(/phase9b-demo-readiness/);
    expect(pkg.scripts["verify:phase9b"]).toMatch(/verify-phase9b/);
    expect(pkg.scripts["test:e2e:phase9b-pilot-golden-journey"]).toMatch(/phase9b-pilot-golden-journey/);
  });
});
