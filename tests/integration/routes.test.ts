import { describe, expect, it } from "vitest";
import { resolveClinicAccess } from "@/lib/auth/route-access";

describe("clinic route access", () => {
  it("redirects unauthenticated users to login", () => {
    expect(resolveClinicAccess({ user: null, membership: null })).toEqual({
      status: "redirect",
      destination: "/login"
    });
  });

  it("redirects authenticated users without active membership to unauthorized", () => {
    expect(
      resolveClinicAccess({
        user: { id: "user-alpha-owner" },
        membership: null
      })
    ).toEqual({
      status: "redirect",
      destination: "/unauthorized"
    });
  });

  it("allows authenticated users with active membership", () => {
    expect(
      resolveClinicAccess({
        user: { id: "user-alpha-owner" },
        membership: {
          organizationId: "org-alpha",
          roleKey: "organization_owner",
          status: "active"
        }
      })
    ).toEqual({ status: "allow" });
  });
});
