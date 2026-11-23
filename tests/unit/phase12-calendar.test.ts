import { describe, expect, it } from "vitest";
import { addDays, calendarDate, calendarRange, clockLabel, daysBetween, wallDate } from "@/lib/appointments/calendar";
import { appointmentInput, minuteOfDay, publicBookingEnabled, transitions, requestInput } from "@/lib/appointments/contracts";

const local = {
  APP_ENV: "development", PHASE12_PUBLIC_DEMO_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321"
};

describe("appointment calendar", () => {
  it("uses the clinic zone when a UTC instant crosses a local day boundary", () => {
    const moment = "2026-11-19T21:30:00Z";
    expect(wallDate(moment, "Europe/Istanbul")).toBe("2026-11-20");
    expect(wallDate(moment, "Europe/London")).toBe("2026-11-19");
    expect(clockLabel(moment, "Europe/Istanbul")).toBe("00:30");
  });

  it("navigates complete Monday-to-Sunday month and week ranges across year boundaries", () => {
    const month = calendarRange("2027-01-15", "month");
    expect(month).toEqual({ start: "2026-12-28", end: "2027-02-01", previous: "2026-12-01", next: "2027-02-01" });
    expect(daysBetween(month.start, month.end)).toHaveLength(35);
    expect(calendarRange("2027-02-01", "week")).toEqual({
      start: "2027-02-01", end: "2027-02-08", previous: "2027-01-25", next: "2027-02-08"
    });
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(calendarDate("2027-02-30", "2027-02-28")).toBe("2027-02-28");
  });

  it("fails closed on hosted, default development, and the existing development database port", () => {
    expect(publicBookingEnabled(local)).toBe(true);
    for (const APP_ENV of ["production", "preview", "staging"]) {
      expect(publicBookingEnabled({ ...local, APP_ENV })).toBe(false);
    }
    expect(publicBookingEnabled({ ...local, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBe(false);
    expect(publicBookingEnabled({ ...local, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:56321/extra" })).toBe(false);
    expect(publicBookingEnabled({ ...local, PHASE12_PUBLIC_DEMO_ENABLED: undefined })).toBe(false);
  });

  it("accepts minute boundaries and keeps terminal workflow states closed", () => {
    expect(minuteOfDay("24:00")).toBe(1440);
    expect(minuteOfDay("08:15")).toBe(495);
    expect(minuteOfDay("24:01")).toBeNaN();
    expect(transitions.cancelled).toEqual([]);
    expect(transitions.completed).toEqual([]);
    expect(transitions.pending).toEqual(["confirmed", "cancelled"]);
    expect(appointmentInput.safeParse({ minutes: 37 }).success).toBe(false);
    expect(requestInput.shape.reference.safeParse("DEMO-1234").success).toBe(true);
    expect(requestInput.shape.reference.safeParse("real@example.test").success).toBe(false);
  });
});
