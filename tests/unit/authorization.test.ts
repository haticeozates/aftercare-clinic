import { describe, expect, it } from "vitest";
import {
  assertOrganizationPermission,
  canAccessOrganization,
  hasPermission,
  resolveRolePermissions,
  type Membership
} from "@/lib/authorization";

const owner: Membership = {
  organizationId: "org-alpha",
  status: "active",
  roleKey: "organization_owner"
};

const staff: Membership = {
  organizationId: "org-alpha",
  status: "active",
  roleKey: "staff"
};

describe("authorization primitives", () => {
  it("calculates role permissions for seeded roles", () => {
    expect(resolveRolePermissions("organization_owner")).toContain("audit.read");
    expect(resolveRolePermissions("staff")).toEqual([
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
    ]);
    expect(resolveRolePermissions("staff")).not.toContain("photo.request.manage");
  });

  it("allows active membership for the matching organization only", () => {
    expect(canAccessOrganization(owner, "org-alpha")).toBe(true);
    expect(canAccessOrganization(owner, "org-beta")).toBe(false);
  });

  it("does not grant access to inactive memberships", () => {
    expect(
      canAccessOrganization({ ...staff, status: "inactive" }, "org-alpha")
    ).toBe(false);
  });

  it("does not grant staff admin permissions", () => {
    expect(hasPermission(staff, "membership.manage")).toBe(false);
    expect(hasPermission(owner, "membership.manage")).toBe(true);
  });

  it("rejects staff for admin-only server actions", () => {
    expect(assertOrganizationPermission(staff, "org-alpha", "membership.manage")).toEqual({
      allowed: false,
      reason: "permission_denied"
    });
  });

  it("allows owner for permitted server actions", () => {
    expect(assertOrganizationPermission(owner, "org-alpha", "membership.manage")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
  });

  it("rejects request organization tampering even when the user has a valid membership elsewhere", () => {
    expect(assertOrganizationPermission(owner, "org-beta", "membership.manage")).toEqual({
      allowed: false,
      reason: "organization_mismatch_or_inactive"
    });
  });
});
