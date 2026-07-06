import { NextResponse } from "next/server";
import { createPortalSessionFromToken } from "@/lib/secure-links/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await createPortalSessionFromToken(token);
  const target = session ? "/care/session" : "/care/invalid";
  const response = NextResponse.redirect(new URL(target, _request.url));

  if (session) {
    response.cookies.set("aftercare_portal_session", session.sessionToken, session.cookieOptions);
  }

  return response;
}
