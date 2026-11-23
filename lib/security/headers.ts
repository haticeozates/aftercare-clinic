import type { AppEnv } from "@/lib/types";

export const SENSITIVE_CACHE_CONTROL = "no-store, private";

export function isProductionHttpsEnv(appEnv: AppEnv | string) {
  return appEnv === "production";
}

export function getBaselineSecurityHeaders(appEnv: AppEnv | string = "development") {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site"
  };

  if (isProductionHttpsEnv(appEnv)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

export function mergeResponseHeaders(...headerSets: Array<Record<string, string>>) {
  return Object.assign({}, ...headerSets);
}
