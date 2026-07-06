import { describe, expect, it } from "vitest";
import {
  buildCareTokenPath,
  createSecureToken,
  hashSecureToken,
  maskTokenPrefix,
  parsePortalSessionCookieOptions,
  secureTokenRouteHeaders,
  checkTokenValidationRateLimit,
  tokenValidationFailureMessage
} from "@/lib/secure-links";

describe("secure link token rules", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const token = createSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(createSecureToken()).not.toBe(token);
  });

  it("hashes tokens deterministically with pepper", () => {
    expect(hashSecureToken("token-one", "pepper-one")).toBe(hashSecureToken("token-one", "pepper-one"));
    expect(hashSecureToken("token-one", "pepper-one")).not.toBe(hashSecureToken("token-one", "pepper-two"));
  });

  it("builds token-only care paths without plan identifiers", () => {
    const path = buildCareTokenPath("abc123");
    expect(path).toBe("/care/t/abc123");
    expect(path).not.toContain("plan");
  });

  it("shows only a safe prefix mask", () => {
    expect(maskTokenPrefix("abcdef")).toBe("abc...");
  });

  it("uses generic validation failure text", () => {
    expect(tokenValidationFailureMessage()).toBe("Bağlantı geçersiz veya süresi dolmuş.");
  });

  it("sets portal cookie options as httpOnly and sameSite", () => {
    expect(parsePortalSessionCookieOptions("local")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false
    });
    expect(parsePortalSessionCookieOptions("production")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true
    });
    expect(parsePortalSessionCookieOptions("production").maxAge).toBeLessThanOrEqual(15 * 60);
  });

  it("sets token route security headers", () => {
    expect(secureTokenRouteHeaders()).toMatchObject({
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer"
    });
  });

  it("exposes a local token validation rate-limit hook", () => {
    expect(checkTokenValidationRateLimit({ route: "/care/t/[token]" })).toEqual({
      allowed: true,
      strategy: "local-hook"
    });
  });
});
