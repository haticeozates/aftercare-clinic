export const RATE_LIMIT_SCOPES = {
  SECURE_LINK_TOKEN_VALIDATION: "secure_link.token_validation",
  PORTAL_TASK_MUTATION: "portal.task_mutation"
} as const;

export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[keyof typeof RATE_LIMIT_SCOPES];

export type RateLimitReason = "allowed" | "rate_limited" | "store_unavailable" | "invalid_request";

export interface RateLimitConsumeInput {
  limiterKey: string;
  scope: RateLimitScope;
  threshold: number;
  windowSeconds: number;
  now?: Date;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  reason: RateLimitReason;
  strategy: "durable" | "memory";
}

export interface RateLimitAdapter {
  consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult>;
}

export interface RateLimitPolicy {
  scope: RateLimitScope;
  route: string;
  threshold: number;
  windowSeconds: number;
}
