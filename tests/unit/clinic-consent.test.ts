import { describe, expect, it } from "vitest";
import { parseCreateConsentDocumentInput } from "@/lib/consent/clinic-contracts";
import { getClinicConsentDocuments } from "@/lib/consent/clinic-service";

describe("Clinic consent management contracts and services", () => {
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

  it("getClinicConsentDocuments fails when function is not implemented", async () => {
    await expect(getClinicConsentDocuments()).rejects.toThrow("Not implemented");
  });
});
