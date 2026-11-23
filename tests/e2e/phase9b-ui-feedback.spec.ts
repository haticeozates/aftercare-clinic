import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const demoOwner = "demo-owner@example.test";
const demoStaff = "demo-staff@example.test";
const demoPlanId = "00000000-0000-4000-8000-00000000da01";
const demoDayWithoutRequest = "00000000-0000-4000-8000-00000000da12";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

function ensureDemoFixture() {
  const result = spawnSync("node", ["scripts/setup-phase9b-demo.mjs"], { encoding: "utf8" });
  expect(result.status).toBe(0);
}

test.describe("Phase 9B Stage 2A - UI feedback", () => {
  test.beforeAll(() => {
    ensureDemoFixture();
  });

  test("photo request create shows accessible success feedback", async ({ page }) => {
    const label = `E2E UI feedback talebi ${Date.now()}`;

    await login(page, demoOwner);
    await page.goto(`/clinic/plans/${demoPlanId}`);
    await page.getByLabel("Plan günü").selectOption(demoDayWithoutRequest);
    await page.getByLabel("Talep açıklaması").fill(label);
    await page.getByRole("button", { name: "Talep oluştur" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Fotoğraf talebi oluşturuldu." })).toBeVisible();
    await expect(page.getByText(label)).toBeVisible();
  });

  test("photo request create form is hidden for staff", async ({ page }) => {
    await login(page, demoStaff);
    await page.goto(`/clinic/plans/${demoPlanId}`);
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Talep oluştur" })).toHaveCount(0);
  });
});
