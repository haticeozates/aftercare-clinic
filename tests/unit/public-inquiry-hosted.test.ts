import { afterEach, expect, it, vi } from "vitest";
import { recordPublicInquiry } from "@/lib/public-site/submit-inquiry";

const actions = vi.hoisted(() => ({ store: vi.fn(), rateLimit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: actions.store }));
vi.mock("@/lib/rate-limit", () => ({ consumeSecurityRateLimit: actions.rateLimit }));

afterEach(() => vi.unstubAllEnvs());

it("rejects a hosted inquiry before contacting storage or the rate limiter", async () => {
  vi.stubEnv("APP_ENV", "preview");
  const form = new FormData();
  form.set("name", "Sentetik Örnek");
  form.set("email", "portfolio@example.test");
  form.set("clinic", "Örnek Klinik");
  await expect(recordPublicInquiry("demo", form, "127.0.0.1")).resolves.toMatchObject({ status: "error" });
  expect(actions.store).not.toHaveBeenCalled();
  expect(actions.rateLimit).not.toHaveBeenCalled();
});
