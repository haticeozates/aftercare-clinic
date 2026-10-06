import { expect, test, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { defaultPlanStartDate } from "../../lib/formatters";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill("alpha-owner@example.test");
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function openFreshPlanPortalLink(page: Page) {
  await login(page);
  await page.goto("/clinic/plans/new");
  await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
  await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
  await expect(page.getByLabel("Başlangıç tarihi")).toHaveValue(defaultPlanStartDate());
  await expect(page.getByLabel("Başlangıç tarihi")).not.toHaveValue("2026-07-06");
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const link = await page.getByTestId("plain-secure-link").textContent();
  expect(link).toMatch(/\/care\/t\//);
  await page.goto(link ?? "");
  await expect(page).toHaveURL(/\/care\/session$/);
}

test.describe("Phase 9A - durable secure-link rate limiting", () => {
  test("valid secure link still opens a portal session", async ({ page }) => {
    await openFreshPlanPortalLink(page);
    await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
  });

  test("repeated failed token attempts are blocked with a generic invalid response", async ({ page }) => {
    const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const responses = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await page.request.get(`/care/t/invalid-${attempt}-${crypto.randomUUID()}`, {
        headers: {
          "x-forwarded-for": clientIp
        },
        maxRedirects: 0
      });
      responses.push(response);
    }

    const blocked = responses.at(-1);
    const earlier = responses.at(0);
    expect(blocked?.status()).toBe(307);
    expect(blocked?.headers()["location"]).toMatch(/\/care\/invalid$/);
    expect(blocked?.headers()["retry-after"]).toBeTruthy();
    expect(earlier?.headers()["location"]).toMatch(/\/care\/invalid$/);
    expect(blocked?.headers()["location"]).toBe(earlier?.headers()["location"]);
  });

  test("another client facet is not blocked by a saturated facet", async ({ page }) => {
    const saturatedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const otherIp = `198.51.100.${Math.floor(Math.random() * 200) + 201}`;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.request.get(`/care/t/block-${attempt}-${crypto.randomUUID()}`, {
        headers: { "x-forwarded-for": saturatedIp },
        maxRedirects: 0
      });
    }

    const isolated = await page.request.get(`/care/t/fresh-${crypto.randomUUID()}`, {
      headers: { "x-forwarded-for": otherIp },
      maxRedirects: 0
    });

    expect(isolated.status()).toBe(307);
    expect(isolated.headers()["location"]).toMatch(/\/care\/invalid$/);
    expect(isolated.headers()["retry-after"]).toBeFalsy();
  });
});
