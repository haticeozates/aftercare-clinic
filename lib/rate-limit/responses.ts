import { NextResponse } from "next/server";
import type { RateLimitConsumeResult } from "@/lib/rate-limit/types";

export function buildRateLimitedPortalJsonResponse(result: RateLimitConsumeResult) {
  const headers =
    result.retryAfterSeconds > 0 ? { "Retry-After": String(result.retryAfterSeconds) } : undefined;

  return NextResponse.json(
    { error: "İşlem tamamlanamadı." },
    {
      status: 429,
      headers
    }
  );
}

export function buildRateLimitedSecureLinkRedirect(request: Request, result: RateLimitConsumeResult) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
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
  return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 503 });
}

export function buildStoreUnavailableSecureLinkRedirect(request: Request) {
  return NextResponse.redirect(new URL("/care/invalid", request.url), {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer"
    }
  });
}
