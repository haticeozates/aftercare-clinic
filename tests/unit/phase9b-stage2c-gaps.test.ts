import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 2c final screen polish gaps", () => {
  it("requires confirmation before stopping a care plan", () => {
    const page = read("app/clinic/plans/[id]/page.tsx");
    expect(page).not.toMatch(/action=\{stopPlanAction\}/);
    expect(page).toMatch(/StopPlanDialog|ConfirmDialog/);
  });

  it("requires confirmation before revoking or rotating secure links", () => {
    const links = read("app/clinic/plans/[id]/link-actions.tsx");
    expect(links).toMatch(/ConfirmDialog|role="dialog"/);
    expect(links).not.toMatch(/<form action=\{revokeAction\}>[\s\S]*?<SubmitButton[\s\S]*?Bağlantıyı iptal et/);
  });

  it("requires confirmation before archiving a client", () => {
    const page = read("app/clinic/clients/[id]/page.tsx");
    expect(page).not.toMatch(/action=\{archiveClientAction\}/);
    expect(page).toMatch(/ArchiveClientDialog|ConfirmDialog/);
  });

  it("requires confirmation before publishing a template draft", () => {
    const editor = read("app/clinic/templates/[id]/draft/draft-editor.tsx");
    expect(editor).not.toMatch(/<form action=\{publish\}>[\s\S]*?Yayına al/);
    expect(editor).toMatch(/TemplatePublishDialog|ConfirmDialog/);
  });

  it("labels data request resolution codes for clinic review", () => {
    expect(read("lib/data-requests/labels.ts")).toMatch(/dataRequestResolutionCodeLabel/);
    const card = read("components/clinic/data-request-review-card.tsx");
    expect(card).toMatch(/dataRequestResolutionCodeLabel/);
    expect(card).not.toMatch(/\{request\.resolutionCode\}/);
  });

  it("ships safe fallback screens for not-found and application errors", () => {
    expect(existsSync(join(root, "app/not-found.tsx"))).toBe(true);
    expect(existsSync(join(root, "app/error.tsx"))).toBe(true);
    const notFound = read("app/not-found.tsx");
    const error = read("app/error.tsx");
    expect(notFound).not.toMatch(/stack trace|Error:|P0001|organization_id/i);
    expect(error).not.toMatch(/digest|stack trace|organization_id/i);
    expect(notFound).toMatch(/bulunamadı/i);
  });

  it("uses structured severity labels on alert detail report items", () => {
    const page = read("app/clinic/alerts/[id]/page.tsx");
    expect(page).toMatch(/structuredSeverityLevelLabel/);
    expect(page).not.toMatch(/Şiddet \{item\.severity\}/);
  });

  it("exposes reusable confirmation dialog primitive", () => {
    expect(existsSync(join(root, "components/ui/confirm-dialog.tsx"))).toBe(true);
    const dialog = read("components/ui/confirm-dialog.tsx");
    expect(dialog).toMatch(/role="dialog"/);
    expect(dialog).toMatch(/trapTabFocus/);
  });
});
