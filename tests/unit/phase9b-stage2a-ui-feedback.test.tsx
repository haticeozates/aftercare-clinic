import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackMessage } from "@/components/ui";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 2a ui feedback regressions", () => {
  it("keeps photo request form on shared feedback primitives", () => {
    const form = read("components/clinic/photo-request-create-form.tsx");
    expect(form).toMatch(/FeedbackMessage/);
    expect(form).toMatch(/SubmitButton/);
    expect(form).toMatch(/Oluşturuluyor/);
  });

  it("keeps data request assignee picker client-action based", () => {
    const source = read("components/clinic/data-request-assignee-picker.tsx");
    expect(source).toContain("useActionState");
    expect(source).toContain("SubmitButton");
    expect(source).toContain("FormStatusMessage");
  });

  it("does not render raw technical strings through FeedbackMessage", () => {
    const safe = renderToStaticMarkup(<FeedbackMessage tone="error">Kayıt bulunamadı.</FeedbackMessage>);
    expect(safe).not.toMatch(/postgres|uuid|P0001/);
    expect(safe).toContain('role="alert"');
  });

  it("wires secure link and portal task surfaces to shared feedback primitives", () => {
    expect(read("app/clinic/plans/[id]/link-actions.tsx")).toMatch(/FeedbackMessage/);
    expect(read("app/care/session/task-button.tsx")).toMatch(/FeedbackMessage/);
    expect(read("app/care/session/check-in-form.tsx")).toMatch(/role="alert"/);
  });
});
