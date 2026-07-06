import { describe, expect, it } from "vitest";
import { assertOrganizationPermission, type Membership } from "@/lib/authorization";
import { mapTemplateDatabaseError } from "@/lib/templates";

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

describe("phase 3 template authorization decisions", () => {
  it("allows staff to read templates but not manage drafts", () => {
    expect(assertOrganizationPermission(staff, "org-alpha", "template.read")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
    expect(assertOrganizationPermission(staff, "org-alpha", "template.update")).toEqual({
      allowed: false,
      reason: "permission_denied"
    });
  });

  it("allows admin to create, update and publish templates", () => {
    expect(assertOrganizationPermission(admin, "org-alpha", "template.create")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
    expect(assertOrganizationPermission(admin, "org-alpha", "template.publish")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
  });

  it("does not trust request organization ids for template actions", () => {
    expect(assertOrganizationPermission(admin, "org-beta", "template.publish")).toEqual({
      allowed: false,
      reason: "organization_mismatch_or_inactive"
    });
  });

  it("maps immutable mutation failures safely", () => {
    expect(mapTemplateDatabaseError({ code: "42501", message: "published template version is immutable" })).toBe(
      "Bu yayınlanmış versiyon değiştirilemez. Yeni bir taslak oluşturun."
    );
  });
});
