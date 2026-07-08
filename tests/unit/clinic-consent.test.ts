import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit";
import {
  CONSENT_GENERIC_ERROR,
  mapConsentRpcResult,
  parseCreateConsentDocumentInput,
  selectPublishedVersionForNewDraft
} from "@/lib/consent/clinic-contracts";

describe("Clinic consent management security contracts", () => {
  it("validates create document input with shared strict code and purpose rules", () => {
    const input = parseCreateConsentDocumentInput({
      code: "  test-code  ",
      title: "  Test Title  ",
      documentKind: "consent",
      purposeKey: "  test.purpose  ",
      initialDraftTitle: " Initial Draft ",
      initialDraftSummary: " Summary ",
      initialDraftBody: " Body must be at least 20 chars "
    });

    expect(input.code).toBe("test-code");
    expect(input.title).toBe("Test Title");
    expect(input.purposeKey).toBe("test.purpose");
    expect(input.initialDraftTitle).toBe("Initial Draft");
    expect(input.initialDraftSummary).toBe("Summary");
    expect(input.initialDraftBody).toBe("Body must be at least 20 chars");
  });

  it("rejects invalid clinic document codes and kinds", () => {
    expect(() =>
      parseCreateConsentDocumentInput({
        code: "INVALID CODE!",
        title: "Test Title",
        documentKind: "consent",
        purposeKey: "test.purpose",
        initialDraftTitle: "Initial Draft",
        initialDraftBody: "Body must be at least 20 chars"
      })
    ).toThrow();

    expect(() =>
      parseCreateConsentDocumentInput({
        code: "valid-code",
        title: "Test Title",
        documentKind: "kvkk",
        purposeKey: "test.purpose",
        initialDraftTitle: "Initial Draft",
        initialDraftBody: "Body must be at least 20 chars"
      })
    ).toThrow();
  });

  it("includes Phase 8.3A clinic consent audit actions in the TypeScript allowlist", () => {
    expect(AUDIT_ACTIONS).toContain("consent_document.archived");
    expect(AUDIT_ACTIONS).toContain("consent_version.updated");
  });
});

describe("mapConsentRpcResult", () => {
  it("maps allowlisted RPC error tokens to safe Turkish messages", () => {
    expect(mapConsentRpcResult(null, { error: "permission denied" })).toBe("Bu işlem için yetkiniz yok.");
    expect(mapConsentRpcResult(null, { error: "not found" })).toBe("Belge bulunamadı.");
    expect(mapConsentRpcResult(null, { error: "draft already exists" })).toBe(
      "Bu belge için zaten aktif bir taslak var."
    );
    expect(mapConsentRpcResult(null, { error: "version conflict" })).toBe(
      "Versiyon oluşturulurken bir çakışma oluştu. Lütfen tekrar deneyin."
    );
    expect(mapConsentRpcResult(null, { error: "document is archived" })).toBe(
      "Arşivlenmiş belgelerde değişiklik yapılamaz."
    );
    expect(mapConsentRpcResult(null, { error: "version is not draft" })).toBe(
      "Yalnızca taslak versiyonlar güncellenebilir."
    );
  });

  it("does not treat RPC error payloads as success", () => {
    const message = mapConsentRpcResult(null, { error: "permission denied" });
    expect(message).not.toBe("permission denied");
    expect(message).toBeTruthy();
  });

  it("maps transport errors without leaking raw postgres details", () => {
    const message = mapConsentRpcResult(
      {
        code: "42501",
        message: "permission denied for relation consent_documents",
        details: "Failing row contains (secret)",
        hint: "Check RLS policy"
      },
      null
    );

    expect(message).toBe(CONSENT_GENERIC_ERROR);
    expect(message).not.toContain("consent_documents");
    expect(message).not.toContain("Failing row");
    expect(message).not.toContain("42501");
  });

  it("maps duplicate document transport codes safely", () => {
    expect(mapConsentRpcResult({ code: "23505", message: "duplicate key value violates unique constraint" }, null)).toBe(
      "Bu kodla bir belge zaten var."
    );
  });

  it("returns generic message for unknown RPC errors", () => {
    expect(mapConsentRpcResult(null, { error: "unexpected internal state" })).toBe(CONSENT_GENERIC_ERROR);
  });
});

describe("selectPublishedVersionForNewDraft", () => {
  it("selects the highest published or retired version for a new draft", () => {
    expect(
      selectPublishedVersionForNewDraft([
        { id: "draft-id", status: "draft", versionNumber: 3 },
        { id: "published-v2", status: "published", versionNumber: 2 },
        { id: "published-v1", status: "published", versionNumber: 1 }
      ])
    ).toBe("published-v2");
  });

  it("returns null when no published source version exists", () => {
    expect(selectPublishedVersionForNewDraft([{ id: "draft-id", status: "draft", versionNumber: 1 }])).toBeNull();
  });
});

describe("clinic consent server actions", () => {
  it("preserves existing Phase 8.1 action exports and adds archive/update draft actions", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/consent/actions.ts"), "utf8");

    expect(source).toContain("export async function createConsentDocumentAction");
    expect(source).toContain("export async function updateConsentDraftVersionAction");
    expect(source).toContain("export async function publishConsentVersionAction");
    expect(source).toContain("export async function createConsentDraftVersionAction");
    expect(source).toContain("export async function archiveConsentDocumentAction");
    expect(source).not.toContain("updatePublishedConsentVersionAction");
    expect(source).not.toContain("portal-contracts");
  });
});
