import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getBaselineSecurityHeaders } from "@/lib/security/headers";

describe("phase 9a stage2 web boundaries", () => {
  it("documents CSP deferral until nonce/hash infrastructure exists", () => {
    const middlewareSource = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

    expect(middlewareSource).toContain("getBaselineSecurityHeaders");
    expect(middlewareSource).not.toContain("unsafe-eval");
    expect(middlewareSource).not.toMatch(/Content-Security-Policy/);
  });

  it("keeps middleware matcher away from static assets", () => {
    const middlewareSource = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(middlewareSource).toContain("_next/static");
    expect(middlewareSource).toContain("favicon.ico");
  });

  it("does not emit HSTS for development-like environments", () => {
    expect(getBaselineSecurityHeaders("development")).not.toHaveProperty("Strict-Transport-Security");
    expect(getBaselineSecurityHeaders("test")).not.toHaveProperty("Strict-Transport-Security");
    expect(getBaselineSecurityHeaders("local")).not.toHaveProperty("Strict-Transport-Security");
  });
});
