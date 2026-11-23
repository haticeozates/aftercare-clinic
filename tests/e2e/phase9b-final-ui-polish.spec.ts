import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

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

test.describe("Phase 9B Stage 2C - final UI polish", () => {
  test("plan stop confirmation cancels without stopping the plan", async ({ page }) => {
    await login(page);
    await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
    const stopButton = page.getByRole("button", { name: "Planı durdur" });
    await expect(stopButton).toBeVisible();
    await stopButton.click();
    await expect(page.getByRole("dialog", { name: /Bakım planını durdur/i })).toBeVisible();
    await page.getByRole("button", { name: "İptal" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Planı durdur" })).toBeVisible();
  });

  test("secure link revoke confirmation opens and closes with Escape", async ({ page }) => {
    await login(page);
    await page.goto("/clinic/plans/00000000-0000-4000-8000-00000000e101");
    await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
    await expect(page.getByTestId("plain-secure-link")).toBeVisible();
    const revokeButton = page.getByRole("button", { name: "Bağlantıyı iptal et", exact: true });
    await revokeButton.click();
    await expect(page.getByRole("dialog", { name: /Güvenli bağlantıyı iptal et/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(revokeButton).toBeFocused();
  });

  test("not-found screen uses safe Turkish copy", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-phase9b");
    await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    await expect(page.getByText(/organization_id|stack trace|P0001/i)).toHaveCount(0);
  });

  test("tablet viewport keeps clinic plan detail without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto("/clinic/plans");
    await page.getByRole("link", { name: "Detay" }).first().click();
    await expect(page.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("data request review avoids raw resolution code labels", async ({ page }) => {
    await login(page);
    await page.goto("/clinic/data-requests");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/manual_review_declined|unsupported_request|resolution_code/i)).toHaveCount(0);
  });
});
