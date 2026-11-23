import { describe, expect, it } from "vitest";
import { publicInquiriesEnabled } from "@/lib/public-site/inquiry-config";
import { validateInquiry } from "@/lib/public-site/inquiry";
import { publicMetadata, resolvePublicOrigin } from "@/lib/public-site/seo";
import { publicPages } from "@/lib/public-site/content";
import { getRateLimitPolicy, RATE_LIMIT_SCOPES } from "@/lib/rate-limit";

describe("public website contracts", () => {
  const form = new FormData();
  form.set("name", "  Örnek Kullanıcı  ");
  form.set("email", " UX@EXAMPLE.TEST ");
  form.set("clinic", "  Örnek Klinik ");
  form.set("message", " Sentetik bir iletişim metni. ");

  it("normalizes allowed fields and strips fields from the other form", () => {
    expect(validateInquiry("demo", form)).toMatchObject({
      success: true,
      data: { name: "Örnek Kullanıcı", email: "ux@example.test", clinic: "Örnek Klinik" }
    });
    const contact = validateInquiry("contact", form);
    expect(contact).toMatchObject({
      success: true,
      data: { message: "Sentetik bir iletişim metni." }
    });
    if (contact.success) expect(contact.data).not.toHaveProperty("clinic");
  });

  it("rejects missing, invalid and overlong fields on the server", () => {
    expect(validateInquiry("demo", new FormData()).success).toBe(false);
    const invalid = new FormData();
    invalid.set("name", "Örnek Kullanıcı");
    invalid.set("email", "invalid");
    invalid.set("message", "a".repeat(1001));
    expect(validateInquiry("contact", invalid).success).toBe(false);
  });

  it("uses trusted site origin and restricts metadata paths", () => {
    expect(resolvePublicOrigin("https://portfolio.example.test/")).toBe(
      "https://portfolio.example.test"
    );
    expect(resolvePublicOrigin("http://example.test")).toBeNull();
    expect(resolvePublicOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(resolvePublicOrigin("https://user@example.test")).toBeNull();
    expect(resolvePublicOrigin("https://example.test/clinic")).toBeNull();
    expect(Object.keys(publicPages)).not.toContain("/login");
    expect(publicMetadata("/demo").title).toContain("Demo talep et");
  });

  it("enables inquiry forms only on an explicitly local loopback stack", () => {
    const local = { APP_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
    expect(publicInquiriesEnabled(local)).toBe(true);
    expect(publicInquiriesEnabled({})).toBe(false);
    for (const APP_ENV of ["preview", "staging", "production"]) {
      expect(publicInquiriesEnabled({ ...local, APP_ENV })).toBe(false);
    }
    expect(publicInquiriesEnabled({ ...local, VERCEL: "1" })).toBe(false);
    expect(publicInquiriesEnabled({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toBe(false);
  });

  it("enforces independent scoped form limits", () => {
    expect(
      getRateLimitPolicy(RATE_LIMIT_SCOPES.PUBLIC_INQUIRY, "/inquiry/email")
    ).toMatchObject({ threshold: 5, windowSeconds: 900 });
    expect(
      getRateLimitPolicy(RATE_LIMIT_SCOPES.PUBLIC_INQUIRY, "/inquiry/total")
    ).toMatchObject({ threshold: 120, windowSeconds: 900 });
  });
});
