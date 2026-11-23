import { beforeEach, expect, it, vi } from "vitest";

const { consume, insert, from } = vi.hoisted(() => ({
  consume: vi.fn(),
  insert: vi.fn(),
  from: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({
  consumeSecurityRateLimit: consume,
  RATE_LIMIT_SCOPES: { PUBLIC_INQUIRY: "website.inquiry" }
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({ from }) }));

import { recordPublicInquiry } from "@/lib/public-site/submit-inquiry";

function validDemo() {
  const form = new FormData();
  form.set("name", "Sentetik Kullanıcı");
  form.set("email", "synthetic@example.test");
  form.set("clinic", "Sentetik Klinik");
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  consume.mockResolvedValue({ allowed: true });
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

it("reports success only after insert and consumes three distinct non-raw facets", async () => {
  expect(await recordPublicInquiry("demo", validDemo(), "synthetic-client")).toEqual({
    status: "success"
  });
  expect(consume).toHaveBeenCalledTimes(3);
  expect(new Set(consume.mock.calls.map(([input]) => input.clientFacet)).size).toBe(3);
  expect(JSON.stringify(consume.mock.calls)).not.toContain("synthetic@example.test");
  expect(from).toHaveBeenCalledWith("public_inquiries");
  expect(insert).toHaveBeenCalledWith({
    kind: "demo",
    name: "Sentetik Kullanıcı",
    email: "synthetic@example.test",
    clinic: "Sentetik Klinik"
  });
});

it("rejects spam and invalid submissions without touching storage", async () => {
  const trap = validDemo();
  trap.set("website", "bot");
  expect(await recordPublicInquiry("demo", trap, "synthetic-client")).toMatchObject({
    status: "error"
  });
  expect(
    await recordPublicInquiry("demo", new FormData(), "synthetic-client")
  ).toMatchObject({ status: "error", fields: { email: expect.any(String) } });
  expect(consume).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
});

it("rate limits, fails closed on store errors and hides insert error detail", async () => {
  consume.mockResolvedValueOnce({ allowed: false, reason: "rate_limited" });
  expect(await recordPublicInquiry("demo", validDemo(), "limited")).toMatchObject({
    status: "error",
    message: expect.stringContaining("Çok fazla")
  });
  consume.mockRejectedValueOnce(new Error("private backend detail"));
  expect(await recordPublicInquiry("demo", validDemo(), "unavailable")).toMatchObject({
    status: "error",
    message: expect.not.stringContaining("private")
  });
  expect(insert).not.toHaveBeenCalled();
  insert.mockResolvedValueOnce({ error: { message: "private constraint detail" } });
  expect(await recordPublicInquiry("demo", validDemo(), "available")).toMatchObject({
    status: "error",
    message: expect.not.stringContaining("private")
  });
});
