import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 2b mobile accessibility and copy gaps", () => {
  it("ships clinic shell focus and skip-link affordances", () => {
    const shell = read("components/clinic/clinic-shell.tsx");
    expect(shell).toMatch(/skip-link|Ana içeriğe geç/);
    expect(shell).toMatch(/trapTabFocus/);
    expect(shell).toMatch(/menuButtonRef|drawerRef/);
  });

  it("formats plan detail dates before photo request and secure link display", () => {
    const page = read("app/clinic/plans/[id]/page.tsx");
    expect(page).toMatch(/formatDisplayDate\(day\.scheduledDate\)/);
    expect(page).toMatch(/formatDisplayDateTime\(plan\.activeLink\.expiresAt\)/);
  });

  it("uses Turkish labels for alert event history", () => {
    const page = read("app/clinic/alerts/[id]/page.tsx");
    expect(page).toMatch(/alertEventTypeLabel/);
    expect(page).toMatch(/alertEventStatusLabel/);
  });

  it("removes English developer copy from login and unauthorized surfaces", () => {
    expect(read("app/login/page.tsx")).not.toMatch(/Clinical care operations/);
    const unauthorized = read("app/unauthorized/page.tsx");
    expect(unauthorized).not.toMatch(/production temel|organization membership/i);
    expect(unauthorized).toMatch(/organizasyon üyeliği|Yerel test/i);
  });

  it("uses Turkish template version labels instead of Retired", () => {
    expect(read("app/clinic/templates/[id]/page.tsx")).toMatch(/templateVersionStatusLabel/);
    expect(read("app/clinic/templates/[id]/versions/[versionId]/page.tsx")).toMatch(/templateVersionStatusLabel/);
  });

  it("migrates portal data-request form to shared feedback primitives", () => {
    const form = read("components/care/portal-data-request-form.tsx");
    expect(form).toMatch(/FeedbackMessage/);
    expect(form).toMatch(/dataRequestStatusLabel/);
    expect(form).not.toMatch(/request\.status === "submitted" \? "Kaydedildi" : request\.status/);
  });

  it("hardens portal document dialog focus trapping", () => {
    const card = read("components/care/portal-document-card.tsx");
    expect(card).toMatch(/trapTabFocus/);
    expect(card).toMatch(/FeedbackMessage/);
  });

  it("keeps responsive overflow guards for mobile cards", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/portal-task-card[\s\S]*flex-direction:\s*column/);
  });

  it("documents the Turkish product vocabulary reference", () => {
    expect(existsSync(join(root, "docs/product/ui-language-and-accessibility.md"))).toBe(true);
  });
});
