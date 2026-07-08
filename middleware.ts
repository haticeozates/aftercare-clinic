import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBaselineSecurityHeaders } from "@/lib/security/headers";

export function middleware(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  const appEnv = process.env.APP_ENV ?? "development";

  for (const [key, value] of Object.entries(getBaselineSecurityHeaders(appEnv))) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
