import "server-only";

import { getServerEnv } from "@/lib/env";
import { getDurableRateLimitAdapter } from "@/lib/rate-limit/durable-adapter";
import { getSharedMemoryRateLimitAdapter } from "@/lib/rate-limit/memory-adapter";
import type { RateLimitAdapter } from "@/lib/rate-limit/types";

export function createRateLimitAdapter(): RateLimitAdapter {
  const env = getServerEnv();
  const requestedAdapter = process.env.RATE_LIMIT_ADAPTER;

  if (requestedAdapter === "memory") {
    if (env.APP_ENV === "production") {
      throw new Error("Memory rate-limit adapter cannot be selected in production");
    }

    return getSharedMemoryRateLimitAdapter();
  }

  return getDurableRateLimitAdapter();
}
