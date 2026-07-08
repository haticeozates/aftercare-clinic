import { afterEach, describe, expect, it, vi } from "vitest";
import * as factoryModule from "@/lib/rate-limit/factory";
import { consumeSecurityRateLimit } from "@/lib/rate-limit/consume";
import {
  getSharedMemoryRateLimitAdapter,
  resetMemoryRateLimitAdapterForTests
} from "@/lib/rate-limit/memory-adapter";
import { deriveRateLimitKey } from "@/lib/rate-limit/keys";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";

function stubBaseEnv() {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.stubEnv("SUPABASE_PROJECT_REF", "local-aftercare");
  vi.stubEnv("AUDIT_LOG_PEPPER", "test-audit-pepper");
}

describe("rate-limit adapters", () => {
  afterEach(() => {
    resetMemoryRateLimitAdapterForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows requests under the threshold and blocks at the limit with memory adapter", async () => {
    stubBaseEnv();
    vi.stubEnv("RATE_LIMIT_ADAPTER", "memory");
    vi.stubEnv("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD", "2");
    vi.stubEnv("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS", "60");

    const first = await consumeSecurityRateLimit({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a"
    });
    const second = await consumeSecurityRateLimit({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a"
    });
    const third = await consumeSecurityRateLimit({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a"
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("shares counters across separate memory adapter instances", async () => {
    const first = getSharedMemoryRateLimitAdapter();
    const second = getSharedMemoryRateLimitAdapter();
    const key = deriveRateLimitKey({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "shared-facet",
      pepper: "test-rate-limit-pepper"
    });

    await first.consume({
      limiterKey: key,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      threshold: 1,
      windowSeconds: 60
    });

    const blocked = await second.consume({
      limiterKey: key,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      threshold: 1,
      windowSeconds: 60
    });

    expect(blocked.allowed).toBe(false);
  });

  it("isolates different opaque keys and scopes", async () => {
    const adapter = getSharedMemoryRateLimitAdapter();
    const keyA = deriveRateLimitKey({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a",
      pepper: "test-rate-limit-pepper"
    });
    const keyB = deriveRateLimitKey({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-b",
      pepper: "test-rate-limit-pepper"
    });

    await adapter.consume({
      limiterKey: keyA,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      threshold: 1,
      windowSeconds: 60
    });
    const sameScopeDifferentFacet = await adapter.consume({
      limiterKey: keyB,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      threshold: 1,
      windowSeconds: 60
    });
    const differentScope = await adapter.consume({
      limiterKey: keyA,
      scope: RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION,
      threshold: 1,
      windowSeconds: 60
    });

    expect(sameScopeDifferentFacet.allowed).toBe(true);
    expect(differentScope.allowed).toBe(true);
  });

  it("fails closed when the durable store is unavailable", async () => {
    vi.spyOn(factoryModule, "createRateLimitAdapter").mockReturnValue({
      consume: async () => {
        throw new Error("rate_limit_store_unavailable");
      }
    });

    const result = await consumeSecurityRateLimit({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a"
    });

    expect(result).toMatchObject({
      allowed: false,
      reason: "store_unavailable",
      remaining: 0
    });
  });

  it("prevents selecting the memory adapter in production", () => {
    stubBaseEnv();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PROJECT_REF", "prod-aftercare");
    vi.stubEnv("PRODUCTION_SUPABASE_PROJECT_REF", "prod-aftercare");
    vi.stubEnv("RATE_LIMIT_ADAPTER", "memory");
    vi.stubEnv("RATE_LIMIT_PEPPER", "production-rate-limit-pepper-32-chars-min");
    vi.stubEnv("AUDIT_LOG_PEPPER", "production-audit-pepper-32-characters-min");
    vi.stubEnv("RATE_LIMIT_CLEANUP_SECRET", "production-rate-limit-cleanup-secret");

    expect(() => factoryModule.createRateLimitAdapter()).toThrow(/cannot be selected in production/i);
  });
});
