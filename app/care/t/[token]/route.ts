import { NextResponse } from "next/server";
import { createPortalSessionFromToken } from "@/lib/secure-links/service";
import { checkTokenValidationRateLimit, secureTokenRouteHeaders } from "@/lib/secure-links";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const rateLimit = checkTokenValidationRateLimit({ route: "/care/t/[token]" });
  if (!rateLimit.allowed) {
    return NextResponse.redirect(new URL("/care/invalid", _request.url), {
      headers: secureTokenRouteHeaders()
    });
  }

  const { token } = await params;
  const session = await createPortalSessionFromToken(token);
  const target = session ? "/care/session" : "/care/invalid";
  const response = NextResponse.redirect(new URL(target, _request.url), {
    headers: secureTokenRouteHeaders()
  });

  if (session) {
    response.cookies.set("aftercare_portal_session", session.sessionToken, session.cookieOptions);
  }

  return response;
}
