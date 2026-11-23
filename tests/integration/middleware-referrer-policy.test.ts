import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../../middleware";
import { secureTokenRouteHeaders } from "@/lib/secure-links";

describe("middleware referrer policy boundaries", () => {
  it("does not apply baseline referrer policy on care token routes", () => {
    const response = middleware(new NextRequest("http://localhost:3000/care/t/example-token"));
    expect(response.headers.get("Referrer-Policy")).toBeNull();
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("keeps baseline referrer policy on clinic routes", () => {
    const response = middleware(new NextRequest("http://localhost:3000/clinic/plans"));
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("keeps care token route headers stricter than baseline", () => {
    const tokenHeaders = secureTokenRouteHeaders();
    expect(tokenHeaders["Referrer-Policy"]).toBe("no-referrer");
    expect(tokenHeaders["Cache-Control"]).toContain("no-store");
    expect(tokenHeaders["X-Robots-Tag"]).toBe("noindex, nofollow");
  });
});
