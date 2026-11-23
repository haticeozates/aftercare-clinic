import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBaselineSecurityHeaders } from "@/lib/security/headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const appEnv = process.env.APP_ENV ?? "development";
  const isCareTokenRoute = request.nextUrl.pathname.startsWith("/care/t/");

  for (const [key, value] of Object.entries(getBaselineSecurityHeaders(appEnv))) {
    if (isCareTokenRoute && key === "Referrer-Policy") {
      continue;
    }
    response.headers.set(key, value);
  }

  if (/^\/(?:clinic|care|login|internal|unauthorized|kayit|sifre-unuttum|sifre-yenile|auth|ekip|kurulum|randevu)(?:\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (/^\/(?:kayit|sifre-unuttum|sifre-yenile|auth|ekip|kurulum|randevu)(?:\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
