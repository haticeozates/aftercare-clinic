import type { RateLimitAdapter, RateLimitConsumeInput, RateLimitConsumeResult } from "@/lib/rate-limit/types";

type BucketState = {
  count: number;
};

const sharedBuckets = new Map<string, BucketState>();

function bucketKey(input: RateLimitConsumeInput) {
  const nowMs = input.now?.getTime() ?? Date.now();
  const windowStartSeconds =
    Math.floor(nowMs / 1000 / input.windowSeconds) * input.windowSeconds;
  return `${input.scope}:${input.limiterKey}:${windowStartSeconds}`;
}

export class MemoryRateLimitAdapter implements RateLimitAdapter {
  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const key = bucketKey(input);
    const nowMs = input.now?.getTime() ?? Date.now();
    const current = sharedBuckets.get(key)?.count ?? 0;
    const nextCount = current + 1;
    sharedBuckets.set(key, { count: nextCount });

    const allowed = nextCount <= input.threshold;
    const windowStartSeconds =
      Math.floor(nowMs / 1000 / input.windowSeconds) * input.windowSeconds;
    const windowEndSeconds = windowStartSeconds + input.windowSeconds;
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, windowEndSeconds - Math.floor(nowMs / 1000));

    return {
      allowed,
      remaining: Math.max(0, input.threshold - nextCount),
      retryAfterSeconds,
      reason: allowed ? "allowed" : "rate_limited",
      strategy: "memory"
    };
  }
}

export function resetMemoryRateLimitAdapterForTests() {
  sharedBuckets.clear();
}

export function getSharedMemoryRateLimitAdapter() {
  return new MemoryRateLimitAdapter();
}
