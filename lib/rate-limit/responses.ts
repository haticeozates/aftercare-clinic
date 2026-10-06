import { NextResponse } from "next/server";
import type { RateLimitConsumeResult } from "@/lib/rate-limit/types";
import { mergeResponseHeaders, SENSITIVE_CACHE_CONTROL } from "@/lib/security/headers";

function sensitivePortalJson(body: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: mergeResponseHeaders({ "Cache-Control": SENSITIVE_CACHE_CONTROL }, headers ?? {})
  });
}

export function buildRateLimitedPortalJsonResponse(result: RateLimitConsumeResult) {
  const headers =
    result.retryAfterSeconds > 0 ? { "Retry-After": String(result.retryAfterSeconds) } : undefined;

  return sensitivePortalJson({ error: "İşlem tamamlanamadı." }, 429, headers);
}

export function buildRateLimitedSecureLinkRedirect(request: Request, result: RateLimitConsumeResult) {
  const headers: Record<string, string> = {
    "Cache-Control": SENSITIVE_CACHE_CONTROL,
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer"
  };

  if (result.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return NextResponse.redirect(new URL("/care/invalid", request.url), {
    headers
  });
}

export function buildStoreUnavailablePortalJsonResponse() {
  return sensitivePortalJson({ error: "İşlem tamamlanamadı." }, 503);
}

export function buildStoreUnavailableSecureLinkRedirect(request: Request) {
  return NextResponse.redirect(new URL("/care/invalid", request.url), {
    headers: {
      "Cache-Control": SENSITIVE_CACHE_CONTROL,
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer"
    }
  });
}
