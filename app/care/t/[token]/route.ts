import { NextResponse } from "next/server";
import { createPortalSessionFromToken } from "@/lib/secure-links/service";
import { checkTokenValidationRateLimit, secureTokenRouteHeaders } from "@/lib/secure-links";
import {
  buildRateLimitedSecureLinkRedirect,
  buildStoreUnavailableSecureLinkRedirect
} from "@/lib/rate-limit/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const rateLimit = await checkTokenValidationRateLimit(request);
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "store_unavailable") {
      return buildStoreUnavailableSecureLinkRedirect(request);
    }

    return buildRateLimitedSecureLinkRedirect(request, rateLimit);
  }

  const { token } = await params;
  const session = await createPortalSessionFromToken(token);
  const target = session ? "/care/session" : "/care/invalid";
  const response = NextResponse.redirect(new URL(target, request.url), {
    headers: secureTokenRouteHeaders()
  });

  if (session) {
    response.cookies.set("aftercare_portal_session", session.sessionToken, session.cookieOptions);
  }

  return response;
}
