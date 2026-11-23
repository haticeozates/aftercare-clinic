import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 3a local environment orchestration gaps", () => {
  it("requires a shared local supabase readiness helper", () => {
    expect(existsSync(join(root, "scripts/assert-local-supabase-readiness.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/lib/local-supabase-env.mjs"))).toBe(true);
  });

  it("keeps verify:phase9b local-only and secret-safe", () => {
    const script = read("scripts/verify-phase9b.mjs");
    const readiness = read("scripts/assert-local-supabase-readiness.mjs");
    expect(script).toMatch(/resolveLocalSupabaseEnv|local-supabase-env/);
    expect(script).toMatch(/assert-local-supabase-readiness/);
    expect(readiness).toMatch(/organizations|clients|create_photo_request_for_staff/);
    expect(script).toMatch(/restore next-env after build/);
    expect(script).not.toMatch(/\bgit\s+(commit|push|tag|merge|reset|rebase|checkout)\b/);
    expect(script).not.toMatch(/console\.log\([^)]*SERVICE_ROLE|console\.log\([^)]*eyJ[A-Za-z0-9_-]+\./);
  });

  it("resolves database URLs from supabase status into child env", () => {
    const envWriter = read("scripts/write-local-env-from-supabase.mjs");
    const envLib = read("scripts/lib/local-supabase-env.mjs");
    expect(envWriter).toMatch(/TEST_DATABASE_URL/);
    expect(envWriter).toMatch(/SUPABASE_DB_URL/);
    expect(envLib).toMatch(/readSupabaseStatusEnv/);
    expect(envLib).toMatch(/TEST_DATABASE_URL/);
  });

  it("runs readiness after resets and before pgTAP/e2e suites", () => {
    const script = read("scripts/verify-phase9b.mjs");
    expect(script).toMatch(/runDbResetWithReadiness/);
    expect(script).toMatch(/assertReadiness\("demo setup readiness"\)/);
    expect(script).toMatch(/ensureLocalEnvironment|warm start/);
    expect(script).not.toMatch(/wait-local-supabase-auth/);
  });

  it("recovers auth gateway readiness once after db:reset failures", () => {
    const script = read("scripts/verify-phase9b.mjs");
    expect(script).toMatch(/assertReadinessWithRecovery/);
    expect(script).toMatch(/recoverAuthGatewayAfterReset/);
    expect(script).toMatch(/auth gateway unhealthy after db:reset/);
  });

  it("avoids mid-pipeline supabase stop/start except controlled recovery", () => {
    const script = read("scripts/verify-phase9b.mjs");
    const waitScript = read("scripts/wait-local-supabase-auth.mjs");
    expect(script).not.toMatch(/runNpmWithRecovery[\s\S]*supabase:stop/);
    expect(script).toMatch(/function recoverAuthGatewayAfterReset/);
    expect(waitScript).not.toMatch(/restartLocalSupabase|supabase:stop/);
    expect(script).toMatch(/controlledRecovery/);
    expect(script).toMatch(/runNpmWithRecovery/);
  });

  it("requires phase 5 to run after a clean reset with readiness", () => {
    const script = read("scripts/verify-phase9b.mjs");
    const phase5Index = script.indexOf("test:e2e:phase5");
    const phase5ResetIndex = script.indexOf("phase5 pre-reset");
    expect(phase5ResetIndex).toBeGreaterThan(-1);
    expect(phase5ResetIndex).toBeLessThan(phase5Index);
  });

  it("keeps faz 9a verify:predeploy separate", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verify:predeploy"]).toMatch(/verify-predeploy/);
    expect(read("scripts/verify-predeploy.mjs")).not.toMatch(/verify:phase9b/);
  });
});
