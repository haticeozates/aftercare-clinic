import "server-only";

import { createRateLimitAdapter } from "@/lib/rate-limit/factory";
import { deriveRateLimitKey } from "@/lib/rate-limit/keys";
import type { RateLimitConsumeResult, RateLimitScope } from "@/lib/rate-limit/types";
import { getRateLimitPolicy } from "@/lib/rate-limit/config";
import { createCorrelationId, logSafeServerEvent } from "@/lib/observability/safe-log";

export async function consumeSecurityRateLimit(input: {
  scope: RateLimitScope;
  route: string;
  clientFacet: string;
}): Promise<RateLimitConsumeResult> {
  const policy = getRateLimitPolicy(input.scope, input.route);
  const limiterKey = deriveRateLimitKey({
    scope: policy.scope,
    route: policy.route,
    clientFacet: input.clientFacet
  });

  try {
    const adapter = createRateLimitAdapter();
    return await adapter.consume({
      limiterKey,
      scope: policy.scope,
      threshold: policy.threshold,
      windowSeconds: policy.windowSeconds
    });
  } catch {
    logSafeServerEvent({
      operation: `rate_limit.${policy.scope}`,
      result: "store_unavailable",
      correlationId: createCorrelationId(),
      errorCode: "rate_limit_store_unavailable"
    });

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      reason: "store_unavailable",
      strategy: "durable"
    };
  }
}
