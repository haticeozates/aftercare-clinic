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

export function getRateLimitPolicy(scope: RateLimitScope, route: string): RateLimitPolicy {
  if (scope === RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION) {
    return {
      scope,
      route,
      threshold: readPositiveInt("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_THRESHOLD", 30),
      windowSeconds: readPositiveInt("RATE_LIMIT_SECURE_LINK_TOKEN_VALIDATION_WINDOW_SECONDS", 900)
    };
  }

  if (scope === RATE_LIMIT_SCOPES.APPOINTMENT_DEMO) {
    return { scope, route, threshold: route === "/booking/request" ? 10 : 90, windowSeconds: 900 };
  }

  if (scope === RATE_LIMIT_SCOPES.AUTH_ENTRY) {
    return { scope, route, threshold: route === "/auth/total" ? 120 : 5, windowSeconds: 900 };
  }

  if (scope === RATE_LIMIT_SCOPES.PUBLIC_INQUIRY) {
    return { scope, route, threshold: route === "/inquiry/total" ? 120 : 5, windowSeconds: 900 };
  }

  return {
    scope,
    route,
    threshold: readPositiveInt("RATE_LIMIT_PORTAL_TASK_MUTATION_THRESHOLD", 120),
    windowSeconds: readPositiveInt("RATE_LIMIT_PORTAL_TASK_MUTATION_WINDOW_SECONDS", 900)
  };
}
