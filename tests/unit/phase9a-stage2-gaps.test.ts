import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";
import {
  buildRateLimitedPortalJsonResponse,
  buildStoreUnavailablePortalJsonResponse
} from "@/lib/rate-limit/responses";

const baseEnv = {
  APP_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_PROJECT_REF: "local-aftercare",
  AUDIT_LOG_PEPPER: "test-audit-pepper-32-characters-min",
  PRODUCTION_SUPABASE_PROJECT_REF: "prod-aftercare"
};

const productionPeppers = {
  AUDIT_LOG_PEPPER: "production-audit-pepper-32-chars-min",
  RATE_LIMIT_PEPPER: "production-rate-limit-pepper-32-chars-min",
  RATE_LIMIT_CLEANUP_SECRET: "production-rate-limit-cleanup-secret"
};

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    ...baseEnv,
    APP_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PROJECT_REF: "prod-aftercare",
    ...productionPeppers,
    ...overrides
  };
}

describe("phase 9a stage2 environment gaps", () => {
  it("rejects production startup when RATE_LIMIT_PEPPER is missing from central env validation", () => {
    const env = productionEnv();
    delete (env as Record<string, string | undefined>).RATE_LIMIT_PEPPER;

    expect(() => parseServerEnv(env)).toThrow(/RATE_LIMIT_PEPPER/);
  });

  it("rejects production placeholder RATE_LIMIT_PEPPER values", () => {
    expect(() =>
      parseServerEnv(
        productionEnv({
          RATE_LIMIT_PEPPER: "replace-with-local-random-value"
        })
      )
    ).toThrow(/placeholder/i);
  });

  it("rejects weak production RATE_LIMIT_PEPPER values", () => {
    expect(() =>
      parseServerEnv(
        productionEnv({
          RATE_LIMIT_PEPPER: "short-pepper"
        })
      )
    ).toThrow(/32/);
  });

  it("rejects production RATE_LIMIT_PEPPER that matches AUDIT_LOG_PEPPER", () => {
    expect(() =>
      parseServerEnv(
        productionEnv({
          AUDIT_LOG_PEPPER: "shared-pepper-value-32-characters-min",
          RATE_LIMIT_PEPPER: "shared-pepper-value-32-characters-min"
        })
      )
    ).toThrow(/differ/i);
  });

  it("rejects production deployments pointed at local Supabase URLs", () => {
    expect(() =>
      parseServerEnv(
        productionEnv({
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321"
        })
      )
    ).toThrow(/local Supabase/i);
  });

  it("rejects production deployments using local project refs", () => {
    expect(() =>
      parseServerEnv(
        productionEnv({
          SUPABASE_PROJECT_REF: "local-aftercare"
        })
      )
    ).toThrow(/local project ref/i);
  });

  it("rejects local development pointed at the production Supabase project ref", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        APP_ENV: "development",
        SUPABASE_PROJECT_REF: "prod-aftercare"
      })
    ).toThrow(/production Supabase project ref/i);
  });

  it("rejects production startup when rate-limit cleanup secret is missing", () => {
    const env = productionEnv();
    delete (env as Record<string, string | undefined>).RATE_LIMIT_CLEANUP_SECRET;

    expect(() => parseServerEnv(env)).toThrow(/RATE_LIMIT_CLEANUP_SECRET/);
  });
});

describe("phase 9a stage2 error and response gaps", () => {
  it("keeps portal rate-limit responses off shared caches", () => {
    const limited = buildRateLimitedPortalJsonResponse({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      reason: "rate_limited",
      strategy: "durable"
    });
    const unavailable = buildStoreUnavailablePortalJsonResponse();

    expect(limited.headers.get("Cache-Control")).toContain("no-store");
    expect(unavailable.headers.get("Cache-Control")).toContain("no-store");
  });

  it("provides a server-only safe logging utility for security-critical operations", async () => {
    const safeLogModule = await import("@/lib/observability/safe-log");
    expect(safeLogModule.createCorrelationId).toBeTypeOf("function");
    expect(safeLogModule.logSafeServerEvent).toBeTypeOf("function");
    expect(safeLogModule.SAFE_INTERNAL_ERROR_CODES).toContain("rate_limit_store_unavailable");
  });
});

describe("phase 9a stage2 web boundary gaps", () => {
  it("applies baseline security headers through Next.js configuration or middleware", () => {
    const nextConfigSource = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const middlewareExists = (() => {
      try {
        readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
        return true;
      } catch {
        return false;
      }
    })();

    const hasHeaderConfig =
      nextConfigSource.includes("X-Content-Type-Options") ||
      nextConfigSource.includes("getBaselineSecurityHeaders");
    const hasMiddlewareHeaders =
      middlewareExists &&
      readFileSync(join(process.cwd(), "middleware.ts"), "utf8").includes("getBaselineSecurityHeaders");

    expect(hasHeaderConfig || hasMiddlewareHeaders).toBe(true);
  });

  it("exposes a protected internal rate-limit cleanup route", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "app/internal/jobs/rate-limit-cleanup/route.ts"),
      "utf8"
    );

    expect(routeSource).toContain("POST");
    expect(routeSource).toContain("RATE_LIMIT_CLEANUP_SECRET");
    expect(routeSource).toMatch(/no-store|SENSITIVE_CACHE_CONTROL/);
  });
});
