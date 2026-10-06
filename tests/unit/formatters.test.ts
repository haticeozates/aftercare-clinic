import { describe, expect, it } from "vitest";
import {
  APP_TIMEZONE,
  defaultPlanStartDate,
  formatIstanbulIsoDate
} from "@/lib/formatters";
import { defaultLinkExpiry } from "@/lib/secure-links";

describe("Istanbul calendar dates", () => {
  it("uses Europe/Istanbul as the application timezone", () => {
    expect(APP_TIMEZONE).toBe("Europe/Istanbul");
  });

  it("formats today and tomorrow from Istanbul calendar parts", () => {
    const beforeMidnight = new Date("2026-10-06T20:59:00.000Z");
    const afterMidnight = new Date("2026-10-06T21:00:00.000Z");

    expect(formatIstanbulIsoDate(0, beforeMidnight)).toBe("2026-10-06");
    expect(formatIstanbulIsoDate(1, beforeMidnight)).toBe("2026-10-07");
    expect(formatIstanbulIsoDate(0, afterMidnight)).toBe("2026-10-07");
    expect(formatIstanbulIsoDate(1, afterMidnight)).toBe("2026-10-08");
  });

  it("defaults new plans to tomorrow in Istanbul", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    expect(defaultPlanStartDate(now)).toBe("2026-10-07");
    expect(defaultPlanStartDate(now)).not.toBe("2026-07-06");
    expect(defaultPlanStartDate(now) > formatIstanbulIsoDate(0, now)).toBe(true);
  });

  it("keeps default plan expiry in the future for a one-day plan", () => {
    const startDate = defaultPlanStartDate(new Date("2026-10-06T12:00:00.000Z"));
    expect(Date.parse(defaultLinkExpiry(startDate))).toBeGreaterThan(Date.parse("2026-10-06T12:00:00.000Z"));
  });
});
