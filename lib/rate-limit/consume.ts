import "server-only";

import { createRateLimitAdapter } from "@/lib/rate-limit/factory";
import { deriveRateLimitKey } from "@/lib/rate-limit/keys";
import type { RateLimitConsumeResult, RateLimitScope } from "@/lib/rate-limit/types";
import { getRateLimitPolicy } from "@/lib/rate-limit/config";

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
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      reason: "store_unavailable",
      strategy: "durable"
    };
  }
}
