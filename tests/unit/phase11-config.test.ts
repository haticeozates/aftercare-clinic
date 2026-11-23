import { describe, expect, it } from "vitest";
import { authToken, clinicInput, clinicManagementEnabled, demoEmail, inviteToken, password, phase11Config } from "@/lib/phase11/config";

const local = {
  PHASE11_DEMO_ENABLED: "true",
  APP_ENV: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321",
  PHASE11_APP_ORIGIN: "http://localhost:3000",
  PHASE11_MAILPIT_ORIGIN: "http://127.0.0.1:56324"
};

describe("Phase 11 deployment boundary", () => {
  it("opens authenticated management on hosted deployments while keeping local delivery closed", () => {
    for (const APP_ENV of ["preview", "staging", "production"]) {
      const hosted = { ...local, APP_ENV };
      expect(clinicManagementEnabled(hosted)).toBe(true);
      expect(phase11Config(hosted)).toBeNull();
    }
    expect(clinicManagementEnabled(local)).toBe(true);
    expect(clinicManagementEnabled({ ...local, PHASE11_DEMO_ENABLED: undefined })).toBe(false);
    expect(clinicManagementEnabled({ APP_ENV: "development" })).toBe(false);
    expect(clinicManagementEnabled({})).toBe(false);
  });

  it("requires explicit opt-in and a completely loopback environment", () => {
    expect(phase11Config(local)).toEqual({
      appOrigin: "http://localhost:3000", mailOrigin: "http://127.0.0.1:56324"
    });
    expect(phase11Config({ ...local, PHASE11_DEMO_ENABLED: undefined })).toBeNull();
    for (const APP_ENV of ["preview", "staging", "production"]) {
      expect(phase11Config({ ...local, APP_ENV })).toBeNull();
    }
    expect(phase11Config({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co" })).toBeNull();
    for (const PHASE11_APP_ORIGIN of [
      "http://localhost.evil.test", "http://localhost@example.test", "http://localhost/?next=https://example.test",
      "http://localhost/#token", "http://localhost/internal", "file://localhost", "//localhost", "http://a:b@localhost"
    ]) expect(phase11Config({ ...local, PHASE11_APP_ORIGIN })).toBeNull();
    expect(phase11Config({ ...local, PHASE11_MAILPIT_ORIGIN: "https://another.test" })).toBeNull();
  });

  it("accepts synthetic recipients and enforces the password byte limit", () => {
    expect(demoEmail.parse(" ADMIN@KLINIK.TEST ")).toBe("admin@klinik.test");
    expect(demoEmail.safeParse("admin@klinik.test.evil").success).toBe(false);
    expect(password.safeParse("x".repeat(11)).success).toBe(false);
    expect(password.safeParse("ç".repeat(36)).success).toBe(true);
    expect(password.safeParse("ç".repeat(37)).success).toBe(false);
  });

  it("separates capability formats and rejects invalid clinic settings", () => {
    expect(authToken.safeParse("pkce_" + "a".repeat(56)).success).toBe(true);
    expect(inviteToken.safeParse("a".repeat(43)).success).toBe(true);
    expect(authToken.safeParse("a".repeat(43)).success).toBe(false);
    expect(inviteToken.safeParse("a".repeat(56)).success).toBe(false);
    const details = {
      clinic_name: " Örnek ", profile_name: "Demo Kullanıcı",
      clinic_address: "", clinic_phone: "0212 555 00 00", clinic_zone: "Europe/Istanbul"
    };
    expect(clinicInput.parse(details).clinic_name).toBe("Örnek");
    expect(clinicInput.safeParse({ ...details, clinic_phone: "hasta" }).success).toBe(false);
    expect(clinicInput.safeParse({ ...details, clinic_zone: "GMT+99" }).success).toBe(false);
  });
});
