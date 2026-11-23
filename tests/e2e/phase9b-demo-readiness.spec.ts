import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type AppEnv = Record<string, string>;

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const demoOwner = "demo-owner@example.test";
const demoPlanId = "00000000-0000-4000-8000-00000000da01";

function loadEnvFile(): AppEnv {
  const output: AppEnv = {};
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    output[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
  return output;
}

function ensureDemoFixture() {
  const env = loadEnvFile();
  const result = spawnSync("node", [resolve(process.cwd(), "scripts/setup-phase9b-demo.mjs")], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`demo:setup failed:\n${result.stdout}\n${result.stderr}`);
  }
  expect(result.stdout).toMatch(/"ok": true/);
  expect(result.stdout).toMatch(/Demo Pilot Clinic/);
  expect(result.stdout).not.toMatch(/service_role|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  expect(result.stdout).not.toMatch(/\/care\/t\/[A-Za-z0-9_-]{20,}/);
  expect(result.stdout).not.toMatch(/signed[_-]?url|care-photos\//i);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createSecureLink(page: Page) {
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const linkLocator = page.getByTestId("plain-secure-link");
  await expect(linkLocator).toBeVisible();
  const link = await linkLocator.textContent();
  expect(link).toMatch(/\/care\/t\//);
  return link ?? "";
}

test.describe("Phase 9B - Demo readiness smoke", () => {
  test.beforeAll(() => {
    ensureDemoFixture();
  });

  test("demo owner can walk the golden clinic and portal surfaces", async ({ page }) => {
    await login(page, demoOwner);
    await expect(page.getByRole("heading", { name: "Demo Pilot Clinic" })).toBeVisible();

    await page.goto("/clinic/clients");
    await expect(page.getByText("Synthetic Demo Client")).toBeVisible();
    await expect(page.getByText("Synthetic Alpha Client One")).toHaveCount(0);
    await expect(page.getByText("Synthetic Beta Client")).toHaveCount(0);

    await page.goto(`/clinic/plans/${demoPlanId}`);
    await expect(page.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
    await expect(page.getByText("Synthetic Demo Client")).toBeVisible();
    await expect(page.getByText("Demo Procedure One")).toBeVisible();
    await expect(page.getByText("Temsili demo fotoğraf talebi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Güvenli bağlantı oluştur" })).toBeVisible();

    const portalLink = await createSecureLink(page);
    await page.goto(portalLink);
    await expect(page).toHaveURL(/\/care\/session$/);
    await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bugünün görevleri" })).toBeVisible();
    await expect(page.getByText("Fotoğraf talebi").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Belgeler ve tercihlerim" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verilerimle ilgili talep oluştur" })).toBeVisible();
  });
});
