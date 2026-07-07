import { describe, expect, it } from "vitest";
import { alertSeverityLabel, alertStatusLabel, mapAlertError, resolutionCodeLabel } from "@/lib/alerts";
import { assertOrganizationPermission, type Membership } from "@/lib/authorization";

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

describe("phase 6 alert helpers", () => {
  it("allows staff alert operations without granting audit read", () => {
    expect(assertOrganizationPermission(staff, "org-alpha", "alert.read")).toEqual({ allowed: true, organizationId: "org-alpha" });
    expect(assertOrganizationPermission(staff, "org-alpha", "alert.resolve")).toEqual({ allowed: true, organizationId: "org-alpha" });
    expect(assertOrganizationPermission(staff, "org-alpha", "audit.read")).toEqual({ allowed: false, reason: "permission_denied" });
  });

  it("uses non-diagnostic Turkish labels", () => {
    expect(alertStatusLabel("open")).toBe("Klinik değerlendirmesi bekliyor");
    expect(alertStatusLabel("acknowledged")).toBe("İncelendi");
    expect(alertStatusLabel("resolved")).toBe("Kapatıldı");
    expect(alertSeverityLabel("high")).toBe("Yüksek");
    expect(resolutionCodeLabel("follow_up_planned")).toBe("Takip planlandı");
  });

  it("maps raw alert errors to safe user messages", () => {
    expect(mapAlertError(new Error("permission denied"))).toBe("Bu işlem için yetkiniz yok.");
    expect(mapAlertError(new Error("invalid resolution code"))).toBe("Geçerli bir kapatma nedeni seçin.");
    expect(mapAlertError(new Error("invalid status transition"))).toBe("Bu takip bildirimi bu durumdan değiştirilemez.");
  });
});
