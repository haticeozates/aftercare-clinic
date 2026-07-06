import { describe, expect, it } from "vitest";
import {
  calculatePlanEndDate,
  canTransitionPlanStatus,
  mapPlanDatabaseError,
  parsePlanCreateInput
} from "@/lib/plans";
import { hasPermission, type Membership } from "@/lib/authorization";
import { sanitizeAuditMetadata } from "@/lib/audit";

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

describe("plan unit rules", () => {
  it("calculates plan end date from start date and max day number", () => {
    expect(calculatePlanEndDate("2026-07-06", 1)).toBe("2026-07-06");
    expect(calculatePlanEndDate("2026-07-06", 3)).toBe("2026-07-08");
  });

  it("allows only safe plan status transitions", () => {
    expect(canTransitionPlanStatus("scheduled", "active")).toBe(true);
    expect(canTransitionPlanStatus("active", "completed")).toBe(true);
    expect(canTransitionPlanStatus("active", "stopped")).toBe(true);
    expect(canTransitionPlanStatus("stopped", "active")).toBe(false);
    expect(canTransitionPlanStatus("completed", "active")).toBe(false);
  });

  it("validates create input without accepting organization_id", () => {
    const parsed = parsePlanCreateInput({
      clientId: "00000000-0000-4000-8000-00000000c101",
      procedureId: "00000000-0000-4000-8000-00000000d101",
      careTemplateId: "00000000-0000-4000-8000-00000000a401",
      templateVersionId: "00000000-0000-4000-8000-00000000a501",
      startDate: "2026-07-06",
      controlDate: "",
      organization_id: "tamper"
    });

    expect(parsed).not.toHaveProperty("organization_id");
    expect(parsed.controlDate).toBeNull();
  });

  it("maps database errors safely", () => {
    expect(mapPlanDatabaseError({ message: "template version must be published" })).toBe(
      "Yalnız yayınlanmış şablon versiyonundan plan oluşturulabilir."
    );
    expect(mapPlanDatabaseError({ code: "42501" })).toBe("Bu işlem için yetkiniz yok.");
  });

  it("adds plan and link permissions to staff", () => {
    expect(hasPermission(staff, "plan.read")).toBe(true);
    expect(hasPermission(staff, "plan.create")).toBe(true);
    expect(hasPermission(staff, "secure_link.rotate")).toBe(true);
    expect(hasPermission(staff, "audit.read")).toBe(false);
  });

  it("keeps plan content out of audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        day_count: 3,
        task_count: 5,
        raw_token: "blocked",
        task_title: "Klinik tarafından yapılandırılmış temsili günlük görev",
        client_name: "Synthetic Client"
      })
    ).toEqual({ day_count: 3, task_count: 5 });
  });
});
