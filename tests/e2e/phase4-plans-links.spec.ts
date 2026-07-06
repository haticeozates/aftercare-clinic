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

test("logout protects plan routes", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/clinic/plans");
  await expect(page).toHaveURL(/\/login/);
});
