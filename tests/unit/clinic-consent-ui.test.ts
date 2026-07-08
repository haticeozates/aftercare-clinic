import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canShowArchiveAction,
  canShowNewDraftAction,
  consentDocumentStatusLabel,
  hasActiveDraftVersion,
  isDraftEditable,
  isPublishedReadonly,
  latestPublishedVersionNumber
} from "@/lib/consent/clinic-ui";

describe("clinic consent UI helpers", () => {
  it("labels document status for list and detail views", () => {
    expect(consentDocumentStatusLabel("active")).toBe("Aktif");
    expect(consentDocumentStatusLabel("inactive")).toBe("Pasif");
    expect(consentDocumentStatusLabel("archived")).toBe("Arşivlendi");
  });

  it("detects active draft and latest published version number", () => {
    const versions = [
      { id: "draft", status: "draft" as const, versionNumber: 3 },
      { id: "published-v2", status: "published" as const, versionNumber: 2 },
      { id: "retired-v1", status: "retired" as const, versionNumber: 1 }
    ];

    expect(hasActiveDraftVersion(versions)).toBe(true);
    expect(latestPublishedVersionNumber(versions)).toBe(2);
  });

  it("shows new draft action only for active documents without an active draft", () => {
    expect(
      canShowNewDraftAction({
        status: "active",
        versions: [{ id: "published", status: "published", versionNumber: 1 }]
      })
    ).toBe(true);

    expect(
      canShowNewDraftAction({
        status: "active",
        versions: [
          { id: "draft", status: "draft", versionNumber: 2 },
          { id: "published", status: "published", versionNumber: 1 }
        ]
      })
    ).toBe(false);

    expect(
      canShowNewDraftAction({
        status: "archived",
        versions: [{ id: "published", status: "published", versionNumber: 1 }]
      })
    ).toBe(false);
  });

  it("shows archive action only for active documents", () => {
    expect(canShowArchiveAction({ status: "active", versions: [] })).toBe(true);
    expect(canShowArchiveAction({ status: "archived", versions: [] })).toBe(false);
  });

  it("keeps draft editable and published versions readonly", () => {
    expect(isDraftEditable("draft", true)).toBe(true);
    expect(isDraftEditable("draft", false)).toBe(false);
    expect(isDraftEditable("draft", true, "archived")).toBe(false);
    expect(isDraftEditable("published", true)).toBe(false);
    expect(isPublishedReadonly("published")).toBe(true);
    expect(isPublishedReadonly("retired")).toBe(true);
    expect(isPublishedReadonly("draft")).toBe(false);
  });
});

describe("clinic consent UI components", () => {
  it("uses semantic publish dialog without details confirmation", () => {
    const source = readFileSync(resolve(process.cwd(), "components/clinic/consent-publish-dialog.tsx"), "utf8");

    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("Bu versiyon yayımlandıktan sonra değiştirilemez");
    expect(source).not.toContain("<details");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses archive confirmation dialog with neutral copy", () => {
    const source = readFileSync(resolve(process.cwd(), "components/clinic/consent-archive-dialog.tsx"), "utf8");

    expect(source).toContain('role="dialog"');
    expect(source).toContain("Belge arşivlendikten sonra yeni taslak oluşturulamaz");
    expect(source).not.toContain("<details");
  });

  it("renders published body as readonly plain text without update form", () => {
    const source = readFileSync(resolve(process.cwd(), "components/clinic/consent-version-panel.tsx"), "utf8");

    expect(source).toContain("consent-body-readonly");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).toContain("Taslağı kaydet");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("updatePublishedConsentVersionAction");
  });

  it("hides manage controls when canManage is false", () => {
    const source = readFileSync(resolve(process.cwd(), "components/clinic/consent-document-detail-actions.tsx"), "utf8");

    expect(source).toContain("canManage");
    expect(source).toContain("canShowNewDraftAction");
    expect(source).toContain("canShowArchiveAction");
  });
});
