import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveRateLimitKey, getRateLimitPepper } from "@/lib/rate-limit/keys";
import { getRateLimitPolicy } from "@/lib/rate-limit/config";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";

describe("rate-limit foundation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives opaque deterministic keys without embedding raw client material", () => {
    const key = deriveRateLimitKey({
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      route: "/care/t/[token]",
      clientFacet: "facet-a",
      pepper: "test-rate-limit-pepper"
    });

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("facet-a");
    expect(key).not.toContain("token");
  });

  it("isolates keys by scope and client facet", () => {
    const pepper = "test-rate-limit-pepper";
    const base = {
      route: "/care/t/[token]",
      pepper
    };

    const first = deriveRateLimitKey({
      ...base,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      clientFacet: "facet-a"
    });
    const second = deriveRateLimitKey({
      ...base,
      scope: RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION,
      clientFacet: "facet-a"
    });
    const third = deriveRateLimitKey({
      ...base,
      scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
      clientFacet: "facet-b"
    });

    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
  });

  it("uses deterministic local pepper fallback outside production", () => {
    expect(
      getRateLimitPepper({
        APP_ENV: "development"
      })
    ).toBe("local-rate-limit-pepper-deterministic-test-only");
  });

  it("requires pepper in production", () => {
    expect(() =>
      getRateLimitPepper({
        APP_ENV: "production"
      })
    ).toThrow(/RATE_LIMIT_PEPPER/);
  });

  it("exposes default secure-link and portal policies", () => {
    vi.stubEnv("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD", undefined);
    vi.stubEnv("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS", undefined);
    vi.stubEnv("RATE_LIMIT_PORTAL_TASK_MUTATION_THRESHOLD", undefined);
    vi.stubEnv("RATE_LIMIT_PORTAL_TASK_MUTATION_WINDOW_SECONDS", undefined);

    expect(getRateLimitPolicy(RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION, "/care/t/[token]")).toMatchObject({
      threshold: 30,
      windowSeconds: 900
    });
    expect(getRateLimitPolicy(RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION, "/care/session/tasks")).toMatchObject({
      threshold: 120,
      windowSeconds: 900
    });
  });
});
