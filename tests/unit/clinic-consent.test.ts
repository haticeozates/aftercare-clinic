import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { parseCreateConsentDocumentInput } from "@/lib/consent/clinic-contracts";

describe("Clinic consent management security contracts", () => {
  it("validates create document input correctly", () => {
    const input = parseCreateConsentDocumentInput({
      code: "  TEST-CODE  ",
      title: "  Test Title  ",
      documentKind: "consent",
      purposeKey: "  TEST-PURPOSE  ",
      initialDraftTitle: " Initial Draft ",
      initialDraftSummary: " Summary ",
      initialDraftBody: " Body must be at least 20 chars "
    });

    expect(input.code).toBe("test-code");
    expect(input.title).toBe("Test Title");
    expect(input.purposeKey).toBe("test-purpose");
    expect(input.initialDraftTitle).toBe("Initial Draft");
    expect(input.initialDraftSummary).toBe("Summary");
    expect(input.initialDraftBody).toBe("Body must be at least 20 chars");
  });

  it("includes Phase 8.3A clinic consent audit actions in the TypeScript allowlist", () => {
    expect(AUDIT_ACTIONS).toContain("consent_document.archived");
    expect(AUDIT_ACTIONS).toContain("consent_version.updated");
  });
});
