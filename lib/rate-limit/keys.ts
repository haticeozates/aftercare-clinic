import "server-only";

import crypto from "node:crypto";
import { getServerEnv } from "@/lib/env";

export function getRateLimitPepper(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const appEnv = source.APP_ENV ?? "development";
  const configured = source.RATE_LIMIT_PEPPER;

  if (configured && configured.trim().length > 0) {
    return configured;
  }

  if (appEnv === "production") {
    throw new Error("RATE_LIMIT_PEPPER is required in production");
  }

  return "local-rate-limit-pepper-deterministic-test-only";
}

export function deriveRateLimitClientFacet(material: string, pepper = getRateLimitPepper()) {
  return crypto.createHmac("sha256", pepper).update(`client:${material}`).digest("hex");
}

export function deriveRateLimitKey(input: {
  scope: string;
  route: string;
  clientFacet: string;
  pepper?: string;
}) {
  const pepper = input.pepper ?? getRateLimitPepper();
  const material = `${input.scope}:${input.route}:${input.clientFacet}`;
  return crypto.createHmac("sha256", pepper).update(material).digest("hex");
}

export function extractRequestClientFacet(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return deriveRateLimitClientFacet(clientIp);
}

export function derivePortalSessionFacet(sessionToken: string, pepper = getRateLimitPepper()) {
  return deriveRateLimitClientFacet(`portal-session:${sessionToken}`, pepper);
}
