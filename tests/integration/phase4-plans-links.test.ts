import { describe, expect, it } from "vitest";
import { assertOrganizationPermission, type Membership } from "@/lib/authorization";
import { mapPlanDatabaseError } from "@/lib/plans";
import { mapSecureLinkDatabaseError } from "@/lib/secure-links";

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

describe("phase 4 plan and secure link authorization", () => {
  it("allows staff operational plan and secure link permissions", () => {
    expect(assertOrganizationPermission(staff, "org-alpha", "plan.create")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
    expect(assertOrganizationPermission(staff, "org-alpha", "secure_link.revoke")).toEqual({
      allowed: true,
      organizationId: "org-alpha"
    });
  });

  it("does not trust request organization ids for plan actions", () => {
    expect(assertOrganizationPermission(staff, "org-beta", "plan.create")).toEqual({
      allowed: false,
      reason: "organization_mismatch_or_inactive"
    });
  });

  it("maps plan and link errors to safe messages", () => {
    expect(mapPlanDatabaseError({ message: "client must be active" })).toBe(
      "Plan yalnız aktif danışan için oluşturulabilir."
    );
    expect(mapSecureLinkDatabaseError({ message: "stopped plan cannot receive secure link" })).toBe(
      "Durdurulan plan için güvenli bağlantı oluşturulamaz."
    );
  });
});
