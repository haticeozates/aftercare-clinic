import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackMessage, FormStatusMessage, LoadingState, SubmitButton } from "@/components/ui";
import { isSafeUserFeedbackMessage, toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

describe("shared ui feedback contracts", () => {
  it("rejects technical error text from user-facing feedback", () => {
    expect(isSafeUserFeedbackMessage("Kayıt bulunamadı.")).toBe(true);
    expect(isSafeUserFeedbackMessage("duplicate key value violates unique constraint")).toBe(false);
    expect(toSafeUserFeedbackMessage("permission denied for table care_plan_tasks", "Güvenli mesaj")).toBe(
      "Güvenli mesaj"
    );
  });

  it("renders success feedback with status semantics", () => {
    const markup = renderToStaticMarkup(<FeedbackMessage tone="success">İşlem kaydedildi.</FeedbackMessage>);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("form-success");
  });

  it("renders error feedback with alert semantics", () => {
    const markup = renderToStaticMarkup(<FeedbackMessage tone="error">İşlem tamamlanamadı.</FeedbackMessage>);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain("form-error");
  });

  it("renders form status pairs without accepting raw error objects", () => {
    const markup = renderToStaticMarkup(<FormStatusMessage success="Kaydedildi." error="Tekrar deneyin." />);
    expect(markup).toContain("Kaydedildi.");
    expect(markup).toContain("Tekrar deneyin.");
  });

  it("renders loading state with accessible status semantics", () => {
    const markup = renderToStaticMarkup(<LoadingState label="Plan yükleniyor..." />);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Plan yükleniyor...");
  });

  it("renders submit button with pending label contract", () => {
    const markup = renderToStaticMarkup(
      <form>
        <SubmitButton pendingLabel="Kaydediliyor...">Kaydet</SubmitButton>
      </form>
    );
    expect(markup).toContain("Kaydet");
    expect(markup).toContain('type="submit"');
  });
});
