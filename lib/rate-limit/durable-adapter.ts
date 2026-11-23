import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { RateLimitAdapter, RateLimitConsumeInput, RateLimitConsumeResult } from "@/lib/rate-limit/types";

function mapRpcResult(payload: {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
  reason?: string;
}): RateLimitConsumeResult {
  return {
    allowed: Boolean(payload.allowed),
    remaining: Number(payload.remaining ?? 0),
    retryAfterSeconds: Number(payload.retry_after_seconds ?? 0),
    reason:
      payload.reason === "rate_limited" || payload.reason === "invalid_request"
        ? payload.reason
        : payload.allowed
          ? "allowed"
          : "rate_limited",
    strategy: "durable"
  };
}

export class DurableRateLimitAdapter implements RateLimitAdapter {
  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      target_limiter_key: input.limiterKey,
      target_scope: input.scope,
      target_threshold: input.threshold,
      target_window_seconds: input.windowSeconds,
      target_now: (input.now ?? new Date()).toISOString()
    });

    if (error || !data) {
      throw new Error("rate_limit_store_unavailable");
    }

    return mapRpcResult(data as {
      allowed?: boolean;
      remaining?: number;
      retry_after_seconds?: number;
      reason?: string;
    });
  }
}

export function getDurableRateLimitAdapter() {
  return new DurableRateLimitAdapter();
}
