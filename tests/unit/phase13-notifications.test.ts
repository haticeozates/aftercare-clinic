import { describe, expect, it } from "vitest";
import { dateBoundary, noticeHref } from "@/lib/notifications/contracts";
import { isolatedNotificationDatabase, notificationMailConfig } from "@/lib/notifications/local-mail.mjs";

const env = {
  APP_ENV: "test", PHASE13_MAIL_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321",
  PHASE13_MAILPIT_ORIGIN: "http://127.0.0.1:56324", PHASE13_APP_ORIGIN: "http://localhost:3000"
};
const config = `project_id = "aftercare-portfolio-stage2-test"
[api]
port = 56321
[db]
port = 56322
[inbucket]
port = 56324
`;

describe("notification scope", () => {
  it("only exposes Mailpit on the verified local port and local App environment", () => {
    expect(notificationMailConfig(env)).toEqual({ mail: "http://127.0.0.1:56324", app: "http://localhost:3000" });
    for (const APP_ENV of ["production","preview","staging"]) expect(notificationMailConfig({ ...env, APP_ENV })).toBeNull();
    expect(notificationMailConfig({ ...env, PHASE13_MAIL_ENABLED: undefined })).toBeNull();
    expect(notificationMailConfig({ ...env, PHASE13_MAILPIT_ORIGIN: "https://example.test" })).toBeNull();
    expect(notificationMailConfig({ ...env, PHASE13_APP_ORIGIN: "http://localhost:3000/injected" })).toBeNull();
    expect(isolatedNotificationDatabase("postgresql://127.0.0.1:56322/postgres",config)).toBe(true);
    expect(isolatedNotificationDatabase("postgresql://127.0.0.1:54322/postgres",config)).toBe(false);
    expect(isolatedNotificationDatabase("postgresql://127.0.0.1:56322/postgres", config.replace(/^project_id = ".*"$/m, 'project_id = "unrelated-local-project"'))).toBe(false);
  });

  it("links only to same-app protected routes", () => {
    const target = "9d065ab7-e3e6-45ea-b5ef-f4fe858555a6";
    expect(noticeHref("appointment_requested",target)).toBe("/clinic/appointments/" + target);
    expect(noticeHref("alert_review",target)).toBe("/clinic/alerts/" + target);
    expect(noticeHref("data_request_received",target)).toBe("/clinic/data-requests#request-" + target);
    expect(noticeHref("plan_created","https://other.example.test")).toBe("/clinic/notifications");
  });

  it("computes clinic date boundaries across Istanbul and daylight changes", () => {
    expect(dateBoundary("2026-11-20","Europe/Istanbul")).toBe("2026-11-19T21:00:00.000Z");
    expect(dateBoundary("2027-03-28","Europe/London")).toBe("2027-03-28T00:00:00.000Z");
    expect(dateBoundary("2027-03-29","Europe/London")).toBe("2027-03-28T23:00:00.000Z");
  });
});
