import { describe, expect, it } from "vitest";
import { defaultLinkExpiry } from "@/lib/secure-links";
import { activePlanStartDate, futureIstanbulDate, istanbulDateForOffset } from "../e2e/helpers/plan-dates";

describe("e2e plan date helpers", () => {
  it("anchors active plan start to portal today in Istanbul", () => {
    const start = activePlanStartDate();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(start).toBe(istanbulDateForOffset(0));
  });

  it("derives later plan dates from the same Istanbul calendar base", () => {
    const start = activePlanStartDate();
    const end = futureIstanbulDate(7);
    expect(end > start).toBe(true);
  });

  it("keeps secure-link expiry in the future for an active plan window", () => {
    const endDate = futureIstanbulDate(7);
    const expiry = new Date(defaultLinkExpiry(endDate));
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });
});
