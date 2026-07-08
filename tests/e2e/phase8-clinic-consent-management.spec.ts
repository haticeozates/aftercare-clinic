import { test, expect } from "@playwright/test";

test.describe("Phase 8.3A - Clinic Consent Management", () => {
  test("owner can create and publish consent document", async ({ page }) => {
    // 1. Owner login
    await page.goto("/login");
    await page.fill('input[name="email"]', "owner@alpha.test");
    await page.fill('input[name="password"]', "testpass123");
    await page.click('button[type="submit"]');

    // 2. Go to clinic consent documents page
    await page.goto("/clinic/consent-documents");
    await expect(page.locator("h1")).toContainText("Belgeler");

    // 3. Should see create new document button
    await expect(page.locator("text=Yeni Belge Ekle")).toBeVisible();
    await page.click("text=Yeni Belge Ekle");

    // 4. Fill and submit form
    await expect(page).toHaveURL(/\/clinic\/consent-documents\/new/);
    await page.fill('input[name="code"]', "e2e-consent-doc");
    await page.fill('input[name="title"]', "E2E Test Consent");
    await page.selectOption('select[name="documentKind"]', "consent");
    await page.fill('input[name="purposeKey"]', "e2e.test");
    await page.fill('input[name="initialDraftTitle"]', "Draft Version 1");
    await page.fill('input[name="initialDraftSummary"]', "Test summary");
    await page.fill('textarea[name="initialDraftBody"]', "This is a body that has more than 20 characters length.");
    
    await page.click('button[type="submit"]');

    // 5. Should redirect to document details
    await expect(page).toHaveURL(/\/clinic\/consent-documents\/[0-9a-fA-F-]+/);
    await expect(page.locator("h1")).toContainText("E2E Test Consent");

    // 6. See draft version and publish button
    await expect(page.locator("text=Taslak")).toBeVisible();
    await page.click("text=Yayınla");

    // 7. Dialog confirmation
    await expect(page.locator("text=Bu işlemi onaylıyor musunuz?")).toBeVisible();
    await page.click('button:has-text("Evet, Yayınla")');

    // 8. Should see published state and NO text inputs
    await expect(page.locator("text=Yayınlandı")).toBeVisible();
    const textareas = await page.locator("textarea").count();
    expect(textareas).toBe(0); // Cannot edit published version

    // 9. Staff login test
    await page.goto("/api/auth/signout");
    await page.goto("/login");
    await page.fill('input[name="email"]', "staff@alpha.test");
    await page.fill('input[name="password"]', "testpass123");
    await page.click('button[type="submit"]');

    await page.goto("/clinic/consent-documents");
    // Staff should NOT see the create button
    await expect(page.locator("text=Yeni Belge Ekle")).not.toBeVisible();
  });
});
