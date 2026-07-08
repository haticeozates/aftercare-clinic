export {
  RATE_LIMIT_SCOPES,
  type RateLimitAdapter,
  type RateLimitConsumeResult,
  type RateLimitPolicy,
  type RateLimitScope
} from "@/lib/rate-limit/types";
export { deriveRateLimitKey, extractRequestClientFacet, derivePortalSessionFacet } from "@/lib/rate-limit/keys";
export { getRateLimitPolicy } from "@/lib/rate-limit/config";
export { consumeSecurityRateLimit } from "@/lib/rate-limit/consume";
export {
  buildRateLimitedPortalJsonResponse,
  buildRateLimitedSecureLinkRedirect,
  buildStoreUnavailablePortalJsonResponse,
  buildStoreUnavailableSecureLinkRedirect
} from "@/lib/rate-limit/responses";
