import { describe, expect, it } from "vitest";
import {
  canTransitionConsentVersionStatus,
  consentDecisionEventTypes,
  consentDocumentKindSchema,
  consentVersionStatusSchema,
  isPublishedConsentVersionImmutable,
  noticeEventTypes,
  parseConsentDocumentInput,
  parseConsentVersionInput
} from "@/lib/consent";
import { sanitizeAuditMetadata } from "@/lib/audit";
import { hasPermission, type Membership } from "@/lib/authorization";

const admin: Membership = {
  organizationId: "org-alpha",
  roleKey: "organization_admin",
  status: "active"
};

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

describe("consent document foundation rules", () => {
  it("validates document kinds without treating notice as consent", () => {
    expect(consentDocumentKindSchema.parse("notice")).toBe("notice");
    expect(consentDocumentKindSchema.parse("consent")).toBe("consent");
    expect(() => consentDocumentKindSchema.parse("kvkk")).toThrow();
    expect(noticeEventTypes).toContain("notice_acknowledged");
    expect(consentDecisionEventTypes).toEqual(["consent_accepted", "consent_declined", "consent_withdrawn"]);
    expect(consentDecisionEventTypes).not.toContain("notice_acknowledged");
  });

  it("validates version statuses and safe transitions", () => {
    expect(consentVersionStatusSchema.parse("draft")).toBe("draft");
    expect(canTransitionConsentVersionStatus("draft", "published")).toBe(true);
    expect(canTransitionConsentVersionStatus("published", "draft")).toBe(false);
    expect(canTransitionConsentVersionStatus("published", "retired")).toBe(true);
    expect(isPublishedConsentVersionImmutable("published")).toBe(true);
    expect(isPublishedConsentVersionImmutable("draft")).toBe(false);
  });

  it("normalizes document input and strips browser organization tampering", () => {
    const parsed = parseConsentDocumentInput({
      code: "  privacy-notice ",
      title: "  Temsili bilgilendirme  ",
      documentKind: "notice",
      purposeKey: "local_test",
      organization_id: "tamper"
    });

    expect(parsed).toEqual({
      code: "privacy-notice",
      title: "Temsili bilgilendirme",
      documentKind: "notice",
      purposeKey: "local_test"
    });
  });

  it("requires bounded placeholder document body for draft versions", () => {
    const parsed = parseConsentVersionInput({
      titleSnapshot: "  Temsili belge versiyonu ",
      summaryText: "Bu belge gerçek bir hukuki metin değildir.",
      bodyText: "Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir."
    });

    expect(parsed.titleSnapshot).toBe("Temsili belge versiyonu");
    expect(parsed.bodyText).toContain("Temsili bilgilendirme");
  });

  it("adds consent permissions without granting staff manage access", () => {
    expect(hasPermission(admin, "consent.read")).toBe(true);
    expect(hasPermission(admin, "consent.manage")).toBe(true);
    expect(hasPermission(staff, "consent.read")).toBe(true);
    expect(hasPermission(staff, "consent.manage")).toBe(false);
  });

  it("keeps document body and legal text out of audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        document_kind: "notice",
        version_number: 1,
        body_text: "Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.",
        full_legal_text: "blocked",
        client_name: "Temsili Danışan",
        phone: "+905550000000",
        email: "client@example.test",
        source: "unit"
      })
    ).toEqual({ document_kind: "notice", version_number: 1, source: "unit" });
  });
});
