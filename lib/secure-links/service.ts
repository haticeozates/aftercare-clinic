import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { requireActiveMembership } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildCareTokenPath,
  createSecureToken,
  defaultLinkExpiry,
  hashSecureToken,
  mapSecureLinkDatabaseError,
  parsePortalSessionCookieOptions
} from "@/lib/secure-links";

export async function createOrRotateSecureLink(planId: string, endDate: string) {
  const context = await requireActiveMembership();
  if (!hasPermission(context.membership, "secure_link.create")) {
    redirect("/unauthorized");
  }

  const token = createSecureToken();
  const env = getServerEnv();
  const tokenHash = hashSecureToken(token, env.AUDIT_LOG_PEPPER);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_secure_link_for_plan", {
    target_plan_id: planId,
    target_token_hash: tokenHash,
    target_token_prefix: token.slice(0, 6),
    target_expires_at: defaultLinkExpiry(endDate)
  });

  if (error) {
    throw new Error(mapSecureLinkDatabaseError(error));
  }

  return {
    id: String(data),
    link: buildCareTokenPath(token)
  };
}

export async function revokeSecureLink(linkId: string) {
  const context = await requireActiveMembership();
  if (!hasPermission(context.membership, "secure_link.revoke")) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("revoke_secure_link", { target_link_id: linkId });
  if (error) {
    throw new Error(mapSecureLinkDatabaseError(error));
  }
}

export async function exchangeTokenForPortalSession(rawToken: string) {
  const session = await createPortalSessionFromToken(rawToken);
  if (!session) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set("aftercare_portal_session", session.sessionToken, session.cookieOptions);
  return true;
}

export async function createPortalSessionFromToken(rawToken: string) {
  const env = getServerEnv();
  const tokenHash = hashSecureToken(rawToken, env.AUDIT_LOG_PEPPER);
  const sessionToken = createSecureToken();
  const sessionHash = hashSecureToken(sessionToken, env.AUDIT_LOG_PEPPER);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_portal_session_for_link", {
    target_token_hash: tokenHash,
    target_session_hash: sessionHash,
    target_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });

  if (error || !data) {
    return null;
  }

  return {
    sessionToken,
    cookieOptions: parsePortalSessionCookieOptions(env.APP_ENV)
  };
}

export async function hasValidPortalSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("aftercare_portal_session")?.value;
  if (!sessionToken) {
    return false;
  }

  const env = getServerEnv();
  const sessionHash = hashSecureToken(sessionToken, env.AUDIT_LOG_PEPPER);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("validate_portal_session_hash", {
    target_session_hash: sessionHash
  });

  return !error && Boolean(data);
}
