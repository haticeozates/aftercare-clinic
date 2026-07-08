import { describe, expect, it, vi } from "vitest";
import {
  createCorrelationId,
  formatSafeServerLog,
  logSafeServerEvent,
  SAFE_INTERNAL_ERROR_CODES,
  SAFE_LOG_RESULTS
} from "@/lib/observability/safe-log";
import { getBaselineSecurityHeaders, isProductionHttpsEnv, SENSITIVE_CACHE_CONTROL } from "@/lib/security/headers";
import {
  buildRateLimitedPortalJsonResponse,
  buildStoreUnavailablePortalJsonResponse
} from "@/lib/rate-limit/responses";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ rpc })
}));

import { runRateLimitCleanupJob, RATE_LIMIT_CLEANUP_BATCH_LIMIT } from "@/lib/rate-limit/cleanup/job";

describe("phase 9a stage2 operational hardening", () => {
  it("formats correlation ids as uuid values", () => {
    expect(createCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("keeps safe server logs allowlisted and free of raw error payloads", () => {
    const line = formatSafeServerLog({
      operation: "secure_link.validation",
      result: "store_unavailable",
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorCode: "rate_limit_store_unavailable"
    });

    expect(SAFE_LOG_RESULTS).toContain("store_unavailable");
    expect(SAFE_INTERNAL_ERROR_CODES).toContain("rate_limit_store_unavailable");
    expect(line).not.toMatch(/postgres|details|hint|signed url|storage/i);
    expect(JSON.parse(line)).toEqual({
      operation: "secure_link.validation",
      result: "store_unavailable",
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorCode: "rate_limit_store_unavailable"
    });
  });

  it("logs success on info and failures on error without raw input", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logSafeServerEvent({
      operation: "rate_limit.cleanup",
      result: "success",
      correlationId: "22222222-2222-4222-8222-222222222222"
    });
    logSafeServerEvent({
      operation: "rate_limit.cleanup",
      result: "store_unavailable",
      correlationId: "33333333-3333-4333-8333-333333333333",
      errorCode: "cleanup_store_unavailable"
    });

    expect(info).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).not.toMatch(/secret|token|key/i);

    info.mockRestore();
    error.mockRestore();
  });

  it("applies baseline security headers without HSTS outside production", () => {
    const development = getBaselineSecurityHeaders("development");
    const production = getBaselineSecurityHeaders("production");

    expect(development["X-Content-Type-Options"]).toBe("nosniff");
    expect(development["X-Frame-Options"]).toBe("DENY");
    expect(development["Permissions-Policy"]).toContain("camera=()");
    expect(development["Strict-Transport-Security"]).toBeUndefined();
    expect(production["Strict-Transport-Security"]).toContain("max-age=");
    expect(isProductionHttpsEnv("development")).toBe(false);
    expect(isProductionHttpsEnv("production")).toBe(true);
  });

  it("marks sensitive portal rate-limit responses as no-store", () => {
    const limited = buildRateLimitedPortalJsonResponse({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 15,
      reason: "rate_limited",
      strategy: "durable"
    });
    const unavailable = buildStoreUnavailablePortalJsonResponse();

    expect(limited.headers.get("Cache-Control")).toBe(SENSITIVE_CACHE_CONTROL);
    expect(unavailable.headers.get("Cache-Control")).toBe(SENSITIVE_CACHE_CONTROL);
    expect(limited.headers.get("Retry-After")).toBe("15");
  });

  it("returns aggregate cleanup results without limiter keys", async () => {
    rpc.mockReset();
    rpc
      .mockResolvedValueOnce({ data: { status: "acquired", lock_token: "lock-1" }, error: null })
      .mockResolvedValueOnce({ data: 4, error: null })
      .mockResolvedValueOnce({ data: { status: "released" }, error: null });

    const summary = await runRateLimitCleanupJob();

    expect(summary).toEqual({
      status: "success",
      scanned: RATE_LIMIT_CLEANUP_BATCH_LIMIT,
      deleted: 4,
      skipped: RATE_LIMIT_CLEANUP_BATCH_LIMIT - 4
    });
    expect(JSON.stringify(summary)).not.toMatch(/limiter|bucket_key|token/i);
    expect(rpc).toHaveBeenCalledWith("cleanup_expired_rate_limit_buckets", {
      target_batch_limit: RATE_LIMIT_CLEANUP_BATCH_LIMIT
    });
  });

  it("reports locked cleanup runs without deleting buckets", async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: { status: "busy" }, error: null });

    const summary = await runRateLimitCleanupJob();

    expect(summary).toEqual({
      status: "locked",
      scanned: 0,
      deleted: 0,
      skipped: 0
    });
  });
});
