import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 2a ui feedback gaps", () => {
  it("ships shared accessible feedback and loading primitives", () => {
    expect(existsSync(join(root, "components/ui/feedback-message.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/submit-button.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/loading-state.tsx"))).toBe(true);
    expect(existsSync(join(root, "lib/ui/feedback-contracts.ts"))).toBe(true);
  });

  it("keeps photo request success feedback screen-reader friendly", () => {
    const form = read("components/clinic/photo-request-create-form.tsx");
    const feedback = read("components/ui/feedback-message.tsx");
    expect(form).toMatch(/FeedbackMessage|FormStatusMessage/);
    expect(feedback).toMatch(/aria-live/);
    expect(form).toMatch(/SubmitButton/);
  });

  it("keeps data request mutations pending-safe with inline feedback", () => {
    const assignee = read("components/clinic/data-request-assignee-picker.tsx");
    const statusForm = read("components/clinic/data-request-status-form.tsx");

    expect(assignee).toMatch(/useActionState/);
    expect(assignee).toMatch(/SubmitButton/);
    expect(statusForm).toMatch(/useActionState/);
    expect(statusForm).toMatch(/SubmitButton/);
  });

  it("keeps secure link actions pending-aware with accessible feedback", () => {
    const links = read("app/clinic/plans/[id]/link-actions.tsx");
    expect(links).toMatch(/Oluşturuluyor|Yenileniyor|İptal ediliyor/);
    expect(links).toMatch(/FeedbackMessage|FormStatusMessage/);
  });

  it("keeps portal mutation feedback accessible and non-technical", () => {
    const taskButton = read("app/care/session/task-button.tsx");
    const checkIn = read("app/care/session/check-in-form.tsx");
    const feedback = read("components/ui/feedback-message.tsx");

    expect(taskButton).toMatch(/FeedbackMessage|FormStatusMessage/);
    expect(feedback).toMatch(/aria-live/);
    expect(checkIn).toMatch(/role=["']alert["']/);
    expect(checkIn).toMatch(/aria-live=["']polite["']/);
  });

  it("sanitizes clinic action errors before returning to the browser", () => {
    const photoAction = read("lib/photos/clinic-request-actions.ts");
    const linkAction = read("lib/secure-links/actions.ts");

    expect(photoAction).toMatch(/toSafeUserFeedbackMessage/);
    expect(linkAction).toMatch(/toSafeUserFeedbackMessage/);
  });

  it("adds loading fallbacks for demo-critical clinic routes", () => {
    expect(existsSync(join(root, "app/clinic/plans/[id]/loading.tsx"))).toBe(true);
    expect(existsSync(join(root, "app/clinic/data-requests/loading.tsx"))).toBe(true);
    expect(existsSync(join(root, "app/care/session/loading.tsx"))).toBe(true);
  });
});
