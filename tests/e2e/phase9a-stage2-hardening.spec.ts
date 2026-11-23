import { expect, test } from "@playwright/test";

const cleanupSecret = "local-rate-limit-cleanup-secret-32";

test.describe("Phase 9A Stage 2 - operational hardening", () => {
  test("rate-limited secure-link responses include baseline security headers", async ({ request }) => {
    const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request.get(`/care/t/invalid-header-${attempt}`, {
        headers: { "x-forwarded-for": clientIp },
        maxRedirects: 0
      });
    }

    const blocked = await request.get("/care/t/invalid-header-final", {
      headers: { "x-forwarded-for": clientIp },
      maxRedirects: 0
    });

    expect(blocked.headers()["x-content-type-options"]).toBe("nosniff");
    expect(blocked.headers()["x-frame-options"]).toBe("DENY");
    expect(blocked.headers()["cache-control"]).toContain("no-store");
    expect(blocked.headers()["strict-transport-security"]).toBeUndefined();
  });

  test("portal session mutation responses are not cacheable", async ({ request }) => {
    const response = await request.post("/care/session/tasks", {
      data: { taskId: "00000000-0000-4000-8000-000000000099", status: "completed" }
    });

    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test("internal rate-limit cleanup rejects browser access without a secret", async ({ request }) => {
    const unauthorized = await request.post("/internal/jobs/rate-limit-cleanup", { data: {} });
    expect(unauthorized.status()).toBe(401);
    expect(unauthorized.headers()["cache-control"]).toContain("no-store");
    expect(JSON.stringify(await unauthorized.json())).not.toMatch(/limiter|bucket_key/i);

    const wrongMethod = await request.get("/internal/jobs/rate-limit-cleanup");
    expect(wrongMethod.status()).toBe(405);
  });

  test("authorized internal rate-limit cleanup returns aggregate counts only", async ({ request }) => {
    const response = await request.post("/internal/jobs/rate-limit-cleanup", {
      headers: {
        authorization: `Bearer ${cleanupSecret}`
      },
      data: {}
    });

    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toMatchObject({
      scanned: expect.any(Number),
      deleted: expect.any(Number),
      skipped: expect.any(Number),
      status: expect.stringMatching(/success|locked|store_unavailable/)
    });
    expect(JSON.stringify(body)).not.toMatch(/limiter|bucket_key|token/i);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
