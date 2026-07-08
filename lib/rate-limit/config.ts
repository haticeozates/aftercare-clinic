import type { RateLimitPolicy, RateLimitScope } from "@/lib/rate-limit/types";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

const DEFAULT_POLICIES: Record<RateLimitScope, Omit<RateLimitPolicy, "route">> = {
  [RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION]: {
    scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
    threshold: readPositiveInt("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD", 30),
    windowSeconds: readPositiveInt("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS", 900)
  },
  [RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION]: {
    scope: RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION,
    threshold: readPositiveInt("RATE_LIMIT_PORTAL_TASK_MUTATION_THRESHOLD", 120),
    windowSeconds: readPositiveInt("RATE_LIMIT_PORTAL_TASK_MUTATION_WINDOW_SECONDS", 900)
  }
};

export function getRateLimitPolicy(scope: RateLimitScope, route: string): RateLimitPolicy {
  const defaults = DEFAULT_POLICIES[scope];
  return {
    route,
    scope: defaults.scope,
    threshold: defaults.threshold,
    windowSeconds: defaults.windowSeconds
  };
}
