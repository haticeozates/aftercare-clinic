import { beforeEach, expect, it, vi } from "vitest";
import { createLinkAction } from "@/lib/secure-links/actions";
import { createPortalSessionFromToken } from "@/lib/secure-links/service";
import { getPortalPlan } from "@/lib/portal/service";

const { adminRpc, staffRpc, getCookie } = vi.hoisted(() => ({
  adminRpc: vi.fn(),
  staffRpc: vi.fn(),
  getCookie: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({ rpc: adminRpc }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: () => ({ rpc: staffRpc }) }));
vi.mock("@/lib/auth/server", () => ({
  requireActiveMembership: async () => ({
    membership: { organizationId: "alpha", roleKey: "staff", status: "active" }
  })
}));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/env")>(),
  getServerEnv: () => ({ APP_ENV: "preview", AUDIT_LOG_PEPPER: "synthetic-fixture" })
}));

beforeEach(() => {
  vi.resetAllMocks();
});

it("creates clinic links with the staff client and ignores caller expiry", async () => {
  staffRpc.mockResolvedValue({ data: "test-link-id", error: null });
  const form = new FormData();
  form.set("planId", "test-plan-id");
  form.set("endDate", "2999-01-01");
  const state = await createLinkAction({}, form);

  expect(state.linkId).toBe("test-link-id");
  expect(state.link).toMatch(/^\/care\/t\/[A-Za-z0-9_-]{43}$/);
  expect(staffRpc).toHaveBeenCalledExactlyOnceWith("create_secure_link_for_plan", {
    target_plan_id: "test-plan-id",
    target_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    target_token_prefix: expect.stringMatching(/^[A-Za-z0-9_-]{3}$/)
  });
  expect(adminRpc).not.toHaveBeenCalled();
});

it("exchanges a token through the server client with a database-controlled TTL", async () => {
  adminRpc.mockResolvedValue({ data: "test-session-id", error: null });
  const session = await createPortalSessionFromToken("synthetic-token");

  expect(session?.cookieOptions).toMatchObject({ httpOnly: true, secure: true, maxAge: 900 });
  expect(adminRpc).toHaveBeenCalledExactlyOnceWith("create_portal_session_for_link", {
    target_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    target_session_hash: expect.stringMatching(/^[a-f0-9]{64}$/)
  });
  expect(staffRpc).not.toHaveBeenCalled();
});

it("requires a portal cookie before calling the server RPC and fails closed on rejection", async () => {
  expect(await getPortalPlan()).toBeNull();
  expect(adminRpc).not.toHaveBeenCalled();

  getCookie.mockReturnValue({ value: "synthetic-session-token" });
  adminRpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect(await getPortalPlan()).toBeNull();
  expect(adminRpc).toHaveBeenCalledExactlyOnceWith("get_portal_plan_for_session", {
    target_session_hash: expect.stringMatching(/^[a-f0-9]{64}$/)
  });
});
