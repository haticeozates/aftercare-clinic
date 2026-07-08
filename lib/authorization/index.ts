import type { PermissionKey, RoleKey, MembershipStatus } from "@/lib/types";

export interface Membership {
  organizationId: string;
  roleKey: RoleKey;
  status: MembershipStatus;
}

const rolePermissions: Record<RoleKey, PermissionKey[]> = {
  organization_owner: [
    "organization.read",
    "organization.update",
    "membership.read",
    "membership.manage",
    "audit.read",
    "client.read",
    "client.create",
    "client.update",
    "client.archive",
    "procedure.read",
    "procedure.manage",
    "template.read",
    "template.create",
    "template.update",
    "template.publish",
    "template.deactivate",
    "plan.read",
    "plan.create",
    "plan.update",
    "plan.stop",
    "secure_link.create",
    "secure_link.revoke",
    "secure_link.rotate",
    "alert.read",
    "alert.acknowledge",
    "alert.resolve",
    "alert.dismiss",
    "photo.read",
    "photo.request.manage",
    "photo.view"
  ],
  organization_admin: [
    "organization.read",
    "organization.update",
    "membership.read",
    "membership.manage",
    "audit.read",
    "client.read",
    "client.create",
    "client.update",
    "client.archive",
    "procedure.read",
    "procedure.manage",
    "template.read",
    "template.create",
    "template.update",
    "template.publish",
    "template.deactivate",
    "plan.read",
    "plan.create",
    "plan.update",
    "plan.stop",
    "secure_link.create",
    "secure_link.revoke",
    "secure_link.rotate",
    "alert.read",
    "alert.acknowledge",
    "alert.resolve",
    "alert.dismiss",
    "photo.read",
    "photo.request.manage",
    "photo.view"
  ],
  staff: [
    "organization.read",
    "client.read",
    "client.create",
    "client.update",
    "procedure.read",
    "template.read",
    "plan.read",
    "plan.create",
    "plan.update",
    "plan.stop",
    "secure_link.create",
    "secure_link.revoke",
    "secure_link.rotate",
    "alert.read",
    "alert.acknowledge",
    "alert.resolve",
    "alert.dismiss",
    "photo.read",
    "photo.view"
  ]
};

export function resolveRolePermissions(roleKey: RoleKey): PermissionKey[] {
  return [...rolePermissions[roleKey]];
}

export function canAccessOrganization(membership: Membership | null, organizationId: string): boolean {
  return (
    membership?.status === "active" &&
    membership.organizationId === organizationId &&
    rolePermissions[membership.roleKey].includes("organization.read")
  );
}

export function hasPermission(membership: Membership | null, permission: PermissionKey): boolean {
  if (!membership || membership.status !== "active") {
    return false;
  }

  return rolePermissions[membership.roleKey].includes(permission);
}

export function assertOrganizationPermission(
  membership: Membership | null,
  requestedOrganizationId: string,
  permission: PermissionKey
) {
  if (!canAccessOrganization(membership, requestedOrganizationId) || !membership) {
    return {
      allowed: false,
      reason: "organization_mismatch_or_inactive" as const
    };
  }

  if (!hasPermission(membership, permission)) {
    return {
      allowed: false,
      reason: "permission_denied" as const
    };
  }

  return {
    allowed: true,
    organizationId: membership.organizationId
  };
}
