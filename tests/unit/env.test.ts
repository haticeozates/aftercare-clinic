import { describe, expect, it } from "vitest";
import { getPublicEnv, LOCAL_RATE_LIMIT_PEPPER_FALLBACK, parseServerEnv } from "@/lib/env";

const baseEnv = {
  APP_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_PROJECT_REF: "local-aftercare",
  AUDIT_LOG_PEPPER: "test-audit-pepper",
  PRODUCTION_SUPABASE_PROJECT_REF: "prod-aftercare"
};

const productionEnv = {
  ...baseEnv,
  APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PROJECT_REF: "prod-aftercare",
  AUDIT_LOG_PEPPER: "production-audit-pepper-32-characters-min",
  RATE_LIMIT_PEPPER: "production-rate-limit-pepper-32-chars-min",
  RATE_LIMIT_CLEANUP_SECRET: "production-rate-limit-cleanup-secret"
};

describe("environment validation", () => {
  it("rejects missing required server environment values", () => {
    const env: Record<string, string | undefined> = { ...baseEnv };
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => parseServerEnv(env)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("rejects invalid APP_ENV values", () => {
    expect(() => parseServerEnv({ ...baseEnv, APP_ENV: "qa" })).toThrow(/APP_ENV/);
  });

  it("rejects preview deployments pointed at the production Supabase project ref", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        APP_ENV: "preview",
        SUPABASE_PROJECT_REF: "prod-aftercare"
      })
    ).toThrow(/Preview environment cannot use the production Supabase project ref/);
  });

  it("does not expose the service role key through public environment output", () => {
    const publicEnv = getPublicEnv(baseEnv);

    expect(publicEnv).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key"
    });
    expect(JSON.stringify(publicEnv)).not.toContain("service");
  });

  it("fails fast when token pepper is missing and never exposes it as public env", () => {
    const env: Record<string, string | undefined> = { ...baseEnv };
    delete env.AUDIT_LOG_PEPPER;

    expect(() => parseServerEnv(env)).toThrow(/AUDIT_LOG_PEPPER/);
    expect(JSON.stringify(getPublicEnv(baseEnv))).not.toContain("pepper");
  });

  it("does not expose rate-limit pepper through public environment output", () => {
    const publicEnv = getPublicEnv({
      ...baseEnv,
      RATE_LIMIT_PEPPER: "secret-rate-limit-pepper"
    });

    expect(JSON.stringify(publicEnv)).not.toContain("rate-limit");
    expect(JSON.stringify(publicEnv)).not.toContain("secret-rate-limit-pepper");
  });

  it("rejects production deployments without a dedicated rate-limit pepper", () => {
    const env: Record<string, string | undefined> = { ...productionEnv };
    delete env.RATE_LIMIT_PEPPER;

    expect(() => parseServerEnv(env)).toThrow(/RATE_LIMIT_PEPPER/);
  });

  it("rejects production rate-limit peppers that reuse the audit pepper", () => {
    expect(() =>
      parseServerEnv({
        ...productionEnv,
        AUDIT_LOG_PEPPER: "shared-pepper-value-32-characters-min",
        RATE_LIMIT_PEPPER: "shared-pepper-value-32-characters-min"
      })
    ).toThrow(/differ/i);
  });

  it("rejects local development pointed at the production Supabase project ref", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        SUPABASE_PROJECT_REF: "prod-aftercare"
      })
    ).toThrow(/production Supabase project ref/i);
  });

  it("allows deterministic local rate-limit pepper fallback outside production", () => {
    const env = parseServerEnv(baseEnv);
    expect(env.RATE_LIMIT_PEPPER).toBeUndefined();
    expect(LOCAL_RATE_LIMIT_PEPPER_FALLBACK).toContain("local-rate-limit");
  });
});

describe("hosted portfolio environment", () => {
  const previewRef = "a".repeat(20);
  const liveRef = "b".repeat(20);
  const jwtFor = (ref: string, role: string) =>
    ["fixture", Buffer.from(JSON.stringify({ ref, role })).toString("base64url"), "fixture"].join(".");
  const previewEnv = {
    ...baseEnv,
    APP_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: `https://${previewRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtFor(previewRef, "anon"),
    SUPABASE_SERVICE_ROLE_KEY: jwtFor(previewRef, "service_role"),
    SUPABASE_PROJECT_REF: previewRef,
    PRODUCTION_SUPABASE_PROJECT_REF: liveRef,
    AUDIT_LOG_PEPPER: "fixture-audit-pepper-for-preview-only",
    RATE_LIMIT_PEPPER: "fixture-rate-limit-pepper-for-preview"
  };

  it("accepts isolated preview credentials and rejects a prod URL with preview ref", () => {
    expect(parseServerEnv(previewEnv).APP_ENV).toBe("preview");
    expect(() => parseServerEnv({ ...previewEnv, NEXT_PUBLIC_SUPABASE_URL: `https://${liveRef}.supabase.co` }))
      .toThrow(/origin must match/);
  });

  it("rejects production project in staging and requires the production ref for preview", () => {
    expect(() => parseServerEnv({
      ...previewEnv, APP_ENV: "staging", SUPABASE_PROJECT_REF: liveRef
    })).toThrow(/Staging environment cannot use/);
    expect(() => parseServerEnv({
      ...previewEnv, PRODUCTION_SUPABASE_PROJECT_REF: undefined
    })).toThrow(/require a configured production project ref/);
  });

  it("checks credential scope and project without including secrets in the error", () => {
    const wrongProjectKey = jwtFor(liveRef, "service_role");
    expect(() => parseServerEnv({ ...previewEnv, SUPABASE_SERVICE_ROLE_KEY: wrongProjectKey }))
      .toThrow(/credential must match/);
    expect(() => parseServerEnv({ ...previewEnv, SUPABASE_SERVICE_ROLE_KEY: wrongProjectKey }))
      .not.toThrow(wrongProjectKey);
    expect(() => getPublicEnv({ ...previewEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: wrongProjectKey }))
      .toThrow(/public key must have anon or publishable scope/);
  });

  it("requires loopback locally and rejects shared cleanup secrets", () => {
    expect(() => parseServerEnv({ ...baseEnv, NEXT_PUBLIC_SUPABASE_URL: previewEnv.NEXT_PUBLIC_SUPABASE_URL }))
      .toThrow(/loopback/);
    expect(() => parseServerEnv({
      ...previewEnv, PHOTO_CLEANUP_SECRET: "synthetic-shared-cleanup", RATE_LIMIT_CLEANUP_SECRET: "synthetic-shared-cleanup"
    })).toThrow(/Cleanup secrets must differ/);
  });
});
