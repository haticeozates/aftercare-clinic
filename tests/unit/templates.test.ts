import { describe, expect, it } from "vitest";
import {
  canTransitionVersionStatus,
  mapTemplateDatabaseError,
  normalizeTemplateName,
  parseAlertRuleInput,
  parseTemplateTaskInput,
  parseTemplateVersionPublishPreconditions
} from "@/lib/templates";
import { hasPermission, type Membership } from "@/lib/authorization";
import { sanitizeAuditMetadata } from "@/lib/audit";

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

describe("template unit rules", () => {
  it("normalizes template names consistently", () => {
    expect(normalizeTemplateName("  Temsili Şablon  ")).toBe("temsili şablon");
  });

  it("validates task input as plain bounded text", () => {
    expect(
      parseTemplateTaskInput({
        title: "Klinik tarafından tanımlanan günlük bakım görevi",
        description: "<script>alert(1)</script>",
        taskType: "do",
        required: true
      }).description
    ).toBe("scriptalert(1)/script");
  });

  it("validates alert rule configuration allowlist", () => {
    expect(
      parseAlertRuleInput({
        ruleType: "severity_threshold",
        severityLevel: "medium",
        messageLabel: "Temsili takip uyarısı",
        configuration: { threshold: 2, rawSql: "select 1" }
      }).configuration
    ).toEqual({ threshold: 2 });
  });

  it("evaluates publish preconditions", () => {
    expect(
      parseTemplateVersionPublishPreconditions({
        templateActive: true,
        procedureActive: true,
        dayCount: 1,
        taskCount: 1,
        status: "draft"
      })
    ).toEqual({ ok: true });

    expect(
      parseTemplateVersionPublishPreconditions({
        templateActive: true,
        procedureActive: true,
        dayCount: 1,
        taskCount: 0,
        status: "draft"
      })
    ).toEqual({ ok: false, message: "Yayına almak için en az bir görev gerekir." });
  });

  it("allows only safe version status transitions", () => {
    expect(canTransitionVersionStatus("draft", "published")).toBe(true);
    expect(canTransitionVersionStatus("published", "draft")).toBe(false);
    expect(canTransitionVersionStatus("published", "retired")).toBe(true);
  });

  it("maps database errors to Turkish user messages", () => {
    expect(mapTemplateDatabaseError({ code: "23505", message: "duplicate" })).toMatch(/zaten var/i);
    expect(mapTemplateDatabaseError({ code: "42501", message: "immutable" })).toMatch(/yetkiniz/i);
  });

  it("adds template permissions to role mapping", () => {
    expect(hasPermission(admin, "template.publish")).toBe(true);
    expect(hasPermission(staff, "template.read")).toBe(true);
    expect(hasPermission(staff, "template.publish")).toBe(false);
  });

  it("keeps clinical template content out of audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        version_number: 1,
        task_title: "Klinik tarafından tanımlanan günlük bakım görevi",
        description: "Merkez tarafından belirlenecek takip adımı",
        source: "unit"
      })
    ).toEqual({ version_number: 1, source: "unit" });
  });
});
