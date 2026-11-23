import "server-only";

import {
  consumeSecurityRateLimit,
  derivePortalSessionFacet,
  extractRequestClientFacet,
  RATE_LIMIT_SCOPES,
  type RateLimitConsumeResult
} from "@/lib/rate-limit";

function readPortalSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)aftercare_portal_session=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function checkTokenValidationRateLimit(request: Request): Promise<RateLimitConsumeResult> {
  return consumeSecurityRateLimit({
    scope: RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION,
    route: "/care/t/[token]",
    clientFacet: extractRequestClientFacet(request)
  });
}

export async function checkPortalTaskMutationRateLimit(request: Request): Promise<RateLimitConsumeResult> {
  const sessionToken = readPortalSessionToken(request);
  const clientFacet = sessionToken
    ? derivePortalSessionFacet(sessionToken)
    : extractRequestClientFacet(request);

  return consumeSecurityRateLimit({
    scope: RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION,
    route: "/care/session/tasks",
    clientFacet
  });
}
