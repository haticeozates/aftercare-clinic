import { describe, expect, it } from "vitest";
import { assertOrganizationPermission, hasPermission, type Membership } from "@/lib/authorization";

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

const admin: Membership = {
  organizationId: "org-alpha",
  roleKey: "organization_admin",
  status: "active"
};

describe("phase 2 server authorization decisions", () => {
  it("allows staff to create clients but not archive them", () => {
    expect(hasPermission(staff, "client.create")).toBe(true);
    expect(hasPermission(staff, "client.archive")).toBe(false);
  });

  it("allows admin to archive clients and manage procedures", () => {
    expect(hasPermission(admin, "client.archive")).toBe(true);
    expect(hasPermission(admin, "procedure.manage")).toBe(true);
  });

  it("does not trust request organization ids for client actions", () => {
    expect(assertOrganizationPermission(staff, "org-beta", "client.create")).toEqual({
      allowed: false,
      reason: "organization_mismatch_or_inactive"
    });
  });

  it("denies staff procedure management even with a valid organization context", () => {
    expect(assertOrganizationPermission(staff, "org-alpha", "procedure.manage")).toEqual({
      allowed: false,
      reason: "permission_denied"
    });
  });
});
