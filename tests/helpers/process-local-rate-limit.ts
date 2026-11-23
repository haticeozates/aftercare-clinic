export interface ProcessLocalConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Representative process-local limiter used to document multi-instance gaps.
 * This is not production-safe shared state.
 */
export class ProcessLocalRateLimitStore {
  private readonly buckets = new Map<string, { count: number }>();

  consume(
    limiterKey: string,
    scope: string,
    threshold: number,
    windowSeconds: number,
    nowMs = Date.now()
  ): ProcessLocalConsumeResult {
    const windowStartSeconds =
      Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
    const bucketKey = `${scope}:${limiterKey}:${windowStartSeconds}`;
    const current = this.buckets.get(bucketKey)?.count ?? 0;
    const nextCount = current + 1;
    this.buckets.set(bucketKey, { count: nextCount });

    const allowed = nextCount <= threshold;
    const windowEndSeconds = windowStartSeconds + windowSeconds;
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, windowEndSeconds - Math.floor(nowMs / 1000));

    return {
      allowed,
      remaining: Math.max(0, threshold - nextCount),
      retryAfterSeconds
    };
  }
}

export async function consumeProcessLocalConcurrently(
  store: ProcessLocalRateLimitStore,
  limiterKey: string,
  scope: string,
  threshold: number,
  windowSeconds: number,
  attempts: number
) {
  return Promise.all(
    Array.from({ length: attempts }, () =>
      Promise.resolve(store.consume(limiterKey, scope, threshold, windowSeconds))
    )
  );
}

/**
 * Intentionally yields between read and write to surface race-prone local counting.
 */
export class RaceProneProcessLocalRateLimitStore {
  private readonly buckets = new Map<string, number>();

  async consume(
    limiterKey: string,
    scope: string,
    threshold: number,
    windowSeconds: number,
    nowMs = Date.now()
  ): Promise<ProcessLocalConsumeResult> {
    const windowStartSeconds =
      Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
    const bucketKey = `${scope}:${limiterKey}:${windowStartSeconds}`;
    const current = this.buckets.get(bucketKey) ?? 0;
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    const nextCount = current + 1;
    this.buckets.set(bucketKey, nextCount);

    const allowed = nextCount <= threshold;
    const windowEndSeconds = windowStartSeconds + windowSeconds;
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, windowEndSeconds - Math.floor(nowMs / 1000));

    return {
      allowed,
      remaining: Math.max(0, threshold - nextCount),
      retryAfterSeconds
    };
  }
}
