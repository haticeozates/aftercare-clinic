import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const users = {
  alphaOwner: "alpha-owner@example.test",
  alphaStaff: "alpha-staff@example.test",
  betaOwner: "beta-owner@example.test"
};

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createPlan(page: Page) {
  await page.goto("/clinic/plans/new");
  await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
  await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
  await page.getByLabel("Başlangıç tarihi").fill("2026-07-06");
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
}

async function createSecureLink(page: Page) {
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const link = await page.getByTestId("plain-secure-link").textContent();
  expect(link).toMatch(/\/care\/t\//);
  return link ?? "";
}

test("owner creates a care plan from current published template", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createPlan(page);
  await expect(page.getByText("Plan özeti")).toBeVisible();
  await expect(page.getByText("Klinik tarafından yapılandırılmış temsili günlük görev")).toBeVisible();
});

test("staff creates a care plan", async ({ page }) => {
  await login(page, users.alphaStaff);
  await createPlan(page);
  await expect(page.getByText("Plan özeti")).toBeVisible();
});

test("plan detail shows read-only snapshot days and tasks", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  await expect(page.getByRole("heading", { name: "Snapshot günleri ve görevleri" })).toBeVisible();
  await expect(page.getByText("Klinik tarafından yapılandırılmış temsili günlük görev")).toBeVisible();
  await expect(page.getByRole("button", { name: "Görev ekle" })).toHaveCount(0);
});

test("draft versions and archived clients are not selectable", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/new");
  await expect(page.getByLabel("Şablon").getByText("Taslak")).toHaveCount(0);
  await expect(page.getByLabel("Danışan").getByText("Archived")).toHaveCount(0);
});

test("staff stops a plan and link creation is hidden", async ({ page }) => {
  await login(page, users.alphaStaff);
  await createPlan(page);
  await page.getByRole("button", { name: "Planı durdur" }).click();
  await expect(page.getByText("Durduruldu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Güvenli bağlantı oluştur" })).toHaveCount(0);
});

test("secure link is shown once and disappears after reload", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  await createSecureLink(page);
  await page.reload();
  await expect(page.getByTestId("plain-secure-link")).toHaveCount(0);
  await expect(page.getByText("Aktif bağlantı")).toBeVisible();
});

test("new template draft does not change an existing plan snapshot", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/templates");
  await page.getByRole("link", { name: "Alpha Template One" }).click();
  await page.getByRole("button", { name: "Yeni taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/templates\/[0-9a-f-]+\/draft$/);
  await page.getByLabel("Görev başlığı").fill("Yeni taslak görevi plana yansımamalı");
  await page.getByLabel("Görev türü").selectOption("do");
  await page.getByRole("button", { name: "Görev ekle" }).click();

  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  await expect(page.getByText("Klinik tarafından yapılandırılmış temsili günlük görev")).toBeVisible();
  await expect(page.getByText("Yeni taslak görevi plana yansımamalı")).toHaveCount(0);
});

test("rotate invalidates old link and new link opens token-free session", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  const oldLink = await createSecureLink(page);
  await page.getByRole("button", { name: "Bağlantıyı yenile" }).click();
  const newLink = (await page.getByTestId("plain-secure-link").textContent()) ?? "";

  await page.goto(oldLink);
  await expect(page).toHaveURL(/\/care\/invalid$/);
  await page.goto(newLink);
  await expect(page).toHaveURL(/\/care\/session$/);
  await expect(page.getByText("Bağlantınız doğrulandı.")).toBeVisible();
  await expect(page.getByText("Synthetic Alpha Client")).toHaveCount(0);
  await expect(page.getByText("Alpha Procedure")).toHaveCount(0);
});

test("token route sets no-store noindex and referrer headers", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  const link = await createSecureLink(page);
  const response = await page.request.get(link, { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["location"]).toContain("/care/session");
});

test("portal session cookie is HttpOnly SameSite Lax and short lived", async ({ page, context }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  const link = await createSecureLink(page);

  await page.goto(link);
  await expect(page).toHaveURL(/\/care\/session$/);
  const cookie = (await context.cookies()).find((item) => item.name === "aftercare_portal_session");
  expect(cookie).toBeTruthy();
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeLessThanOrEqual(15 * 60);
});

test("revoke makes link invalid", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
  const link = await createSecureLink(page);
  await page.getByRole("button", { name: "Bağlantıyı iptal et" }).click();
  await expect(page.getByText("Bağlantı iptal edildi.")).toBeVisible();
  await page.goto(link);
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("expired link is invalid", async ({ page }) => {
  await page.goto("/care/t/expired-seed-token");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("Alpha user cannot view Beta plan detail", async ({ page }) => {
  await login(page, users.betaOwner);
  await page.goto("/clinic/plans");
  await page.getByRole("link", { name: "Detay" }).first().click();
  const betaUrl = page.url();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, users.alphaOwner);
  await page.goto(betaUrl);
  await expect(page).toHaveURL(/\/clinic\/plans$/);
  await expect(page.getByText("Synthetic Beta Client")).toHaveCount(0);
});

test("Alpha user cannot manage a Beta plan link", async ({ page }) => {
  await login(page, users.betaOwner);
  await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e201");
  const betaUrl = page.url();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, users.alphaOwner);
  await page.goto(betaUrl);
  await expect(page).toHaveURL(/\/clinic\/plans$/);
  await expect(page.getByRole("button", { name: "Güvenli bağlantı oluştur" })).toHaveCount(0);
});

test("staff manages plan links but cannot access audit data", async ({ page }) => {
  await login(page, users.alphaStaff);
  await createPlan(page);
  await createSecureLink(page);
  await expect(page.getByTestId("plain-secure-link")).toBeVisible();

  await page.goto("/clinic/audit");
  await expect(page.getByText("plan.created")).toHaveCount(0);
  await expect(page.getByText("secure_link.created")).toHaveCount(0);
});

test("logout protects plan routes", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/clinic/plans");
  await expect(page).toHaveURL(/\/login/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
]) {
  test(`plan and care routes have no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, users.alphaOwner);
    for (const path of ["/clinic/plans", "/clinic/plans/new", "/clinic/plans/00000000-0000-4000-8000-00000000e101"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }

    await page.goto("/clinic/plans/new");
    await expect(page.getByLabel("Danışan")).toBeVisible();
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(["a", "button", "select", "input"]).toContain(focusedTag);

    await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
    await expect(page.getByRole("button", { name: "Güvenli bağlantı oluştur" })).toBeVisible();

    await page.goto("/care/session");
    await expect(page).toHaveURL(/\/care\/invalid$/);
    await page.goto("/care/invalid");
    const careOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(careOverflow).toBe(false);
  });
}
