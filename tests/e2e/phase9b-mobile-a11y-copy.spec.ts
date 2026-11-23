import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const viewports = [
  { width: 375, height: 667, label: "375x667" },
  { width: 390, height: 844, label: "390x844" },
  { width: 768, height: 1024, label: "768x1024" },
  { width: 1280, height: 800, label: "1280x800" }
] as const;

async function login(page: Page, email = "alpha-owner@example.test") {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

test.describe("Phase 9B Stage 2B - mobile, accessibility and copy", () => {
  for (const viewport of viewports) {
    test(`clinic shell avoids overflow at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);
      for (const route of ["/clinic", "/clinic/clients", "/clinic/plans", "/clinic/data-requests", "/clinic/consent-documents"]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test("skip link and mobile drawer focus return work on clinic shell", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    const skipLink = page.getByRole("link", { name: "Ana içeriğe geç" });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    const menuButton = page.getByRole("button", { name: "Menüyü aç" });
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Klinik menüsü" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Klinik menüsü" })).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test("login and unauthorized surfaces avoid developer English copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByText("Klinik takip platformu")).toBeVisible();
    await expect(page.getByText(/Clinical care operations|production temel/i)).toHaveCount(0);
    await page.goto("/unauthorized");
    await expect(page.getByRole("heading", { name: "Aktif organizasyon üyeliği bulunamadı" })).toBeVisible();
    await expect(page.getByText(/organization membership|production temel/i)).toHaveCount(0);
  });
});
