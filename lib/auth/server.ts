import "server-only";

import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/types";
import { hasPermission, type Membership } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OrganizationContext =
  | { status: "unauthenticated" }
  | { status: "unauthorized" }
  | {
      status: "authorized";
      user: { id: string };
      membership: Membership;
      organization: { id: string; name: string; slug: string };
    };

type MembershipQueryRow = {
  organization_id: string;
  status: "active" | "inactive";
  roles: { key: Membership["roleKey"] } | { key: Membership["roleKey"] }[] | null;
  organizations: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

export async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/login");
  }

  return { id: data.claims.sub };
}

export async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    return { status: "unauthenticated" };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id,status,roles(key),organizations(id,name,slug)")
    .eq("user_id", data.claims.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<MembershipQueryRow>();

  if (!membership) {
    return { status: "unauthorized" };
  }

  const roleKey = Array.isArray(membership.roles)
    ? membership.roles[0]?.key
    : membership.roles?.key;
  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  if (!roleKey || !organization) {
    return { status: "unauthorized" };
  }

  return {
    status: "authorized",
    user: { id: data.claims.sub },
    membership: {
      organizationId: membership.organization_id,
      roleKey,
      status: membership.status
    },
    organization
  };
}

export async function requireActiveMembership() {
  const context = await getCurrentOrganizationContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "unauthorized") {
    redirect("/unauthorized");
  }

  return context;
}

export async function requireOrganizationPermission(permission: PermissionKey) {
  const context = await requireActiveMembership();

  if (!hasPermission(context.membership, permission)) {
    redirect("/unauthorized");
  }

  return context;
}
