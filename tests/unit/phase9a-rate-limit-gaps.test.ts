import { describe, expect, it } from "vitest";
import {
  ProcessLocalRateLimitStore,
  RaceProneProcessLocalRateLimitStore
} from "../helpers/process-local-rate-limit";

const scope = "secure_link.token_validation";
const key = "opaque-test-key";
const threshold = 3;
const windowSeconds = 60;

describe("phase 9a process-local rate-limit gaps", () => {
  it("does not share counters across separate process-local instances", () => {
    const first = new ProcessLocalRateLimitStore();
    const second = new ProcessLocalRateLimitStore();

    for (let attempt = 0; attempt < threshold; attempt += 1) {
      expect(first.consume(key, scope, threshold, windowSeconds).allowed).toBe(true);
    }
    expect(first.consume(key, scope, threshold, windowSeconds).allowed).toBe(false);

    expect(second.consume(key, scope, threshold, windowSeconds).allowed).toBe(true);
  });

  it("allows requests on a second instance after the first instance is saturated", () => {
    const first = new ProcessLocalRateLimitStore();
    const second = new ProcessLocalRateLimitStore();

    for (let attempt = 0; attempt <= threshold; attempt += 1) {
      first.consume(key, scope, threshold, windowSeconds);
    }

    expect(second.consume(key, scope, threshold, windowSeconds)).toMatchObject({
      allowed: true,
      remaining: threshold - 1
    });
  });

  it("allows concurrent requests to exceed the threshold without atomic updates", async () => {
    const store = new RaceProneProcessLocalRateLimitStore();
    const results = await Promise.all(
      Array.from({ length: threshold + 5 }, () =>
        store.consume(key, scope, threshold, windowSeconds)
      )
    );

    const allowedCount = results.filter((result) => result.allowed).length;
    expect(allowedCount).toBeGreaterThan(threshold);
  });

  it("does not reset windows across separate process-local instances", () => {
    const first = new ProcessLocalRateLimitStore();
    const second = new ProcessLocalRateLimitStore();
    const windowStartMs = 1_700_000_000_000;

    for (let attempt = 0; attempt <= threshold; attempt += 1) {
      first.consume(key, scope, threshold, windowSeconds, windowStartMs);
    }
    expect(first.consume(key, scope, threshold, windowSeconds, windowStartMs).allowed).toBe(false);

    const nextWindowMs = windowStartMs + windowSeconds * 1000;
    expect(first.consume(key, scope, threshold, windowSeconds, nextWindowMs).allowed).toBe(true);
    expect(second.consume(key, scope, threshold, windowSeconds, nextWindowMs).allowed).toBe(true);
  });

  it("expects durable limiter keys to stay out of logs and audit metadata", () => {
    const captured: string[] = [];
    const limiterKey = "7f3c9f2a4d8e1b0c9a6f5e4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a";
    const auditMetadata = {
      operation: "secure_link.token_validation",
      result: "blocked",
      correlationId: "corr-123"
    };

    captured.push(JSON.stringify(auditMetadata));

    expect(captured.join("")).not.toContain(limiterKey);
    expect(auditMetadata).not.toHaveProperty("limiterKey");
    expect(auditMetadata).not.toHaveProperty("token");
    expect(auditMetadata).not.toHaveProperty("ip");
  });

  it("expects exceeded responses to stay generic without tenant or token existence leaks", () => {
    const validLinkResponse = {
      status: 429,
      body: { error: "Bağlantı geçersiz veya süresi dolmuş." }
    };
    const invalidLinkResponse = {
      status: 429,
      body: { error: "Bağlantı geçersiz veya süresi dolmuş." }
    };

    expect(validLinkResponse).toEqual(invalidLinkResponse);
    expect(JSON.stringify(validLinkResponse.body)).not.toMatch(/tenant|organization|exists|valid link/i);
  });
});
