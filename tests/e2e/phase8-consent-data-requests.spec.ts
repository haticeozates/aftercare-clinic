import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import crypto from "node:crypto";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaClient: "00000000-0000-4000-8000-00000000c101",
  betaClient: "00000000-0000-4000-8000-00000000c201",
  alphaPlan: "00000000-0000-4000-8000-00000000e101",
  alphaOwner: "00000000-0000-4000-8000-00000000a101"
};

async function connect() {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  });
  await client.connect();
  return client;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createDataRequestFixture() {
  const db = await connect();
  const id = crypto.randomUUID();
  await db.query(
    `
      insert into public.data_requests (
        id,
        organization_id,
        client_id,
        care_plan_id,
        request_type,
        status,
        submitted_source,
        submitted_at
      )
      values ($1, $2, $3, $4, 'access', 'submitted', 'clinic', now())
    `,
    [id, ids.alphaOrg, ids.alphaClient, ids.alphaPlan]
  );
  await db.end();
  return id;
}

test("admin creates and publishes a consent document foundation draft", async ({ page }) => {
  await login(page, "alpha-admin@example.test");
  await page.goto("/clinic/consent-documents");

  const code = `notice-${Date.now()}`;
  await page.getByLabel("Belge kodu").fill(code);
  await page.getByLabel("Başlık").fill("Temsili bilgilendirme belgesi");
  await page.getByLabel("Belge türü").selectOption("notice");
  await page.getByLabel("Amaç anahtarı").fill("local_notice");
  await page.getByLabel("Versiyon başlığı").fill("Temsili bilgilendirme v1");
  await page.getByLabel("Özet").fill("Bu belge gerçek bir hukuki metin değildir.");
  await page
    .getByLabel("Belge metni")
    .fill("Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.");
  await page.getByRole("button", { name: "Taslak oluştur" }).click();

  await expect(page).toHaveURL(/\/clinic\/consent-documents\/[0-9a-f-]+$/);
  await expect(page.getByText("Taslak")).toBeVisible();
  await page.getByRole("button", { name: "Yayınla" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Evet, yayınla" }).click();
  await expect(page.getByText("Yayınlandı", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Belge metni" })).toHaveCount(0);
  await page.getByRole("button", { name: "Yeni versiyon başlat" }).click();
  await expect(page.getByText("Taslak")).toBeVisible();
});

test("staff can read consent documents but cannot manage them", async ({ page }) => {
  await login(page, "alpha-staff@example.test");
  await page.goto("/clinic/consent-documents");
  await expect(page.getByRole("heading", { name: "Onay ve bilgilendirme belgeleri" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Taslak oluştur" })).toHaveCount(0);
});

test("admin progresses a data request while staff cannot manage it", async ({ page }) => {
  const requestId = await createDataRequestFixture();

  await login(page, "alpha-admin@example.test");
  await page.goto("/clinic/data-requests");
  const requestCard = page.locator(`article:has(form[data-request-id="${requestId}"])`);
  await expect(requestCard.getByText("Erişim talebi")).toBeVisible();
  await requestCard.getByLabel("Yeni durum").selectOption("under_review");
  await requestCard.getByRole("button", { name: "Durumu güncelle" }).click();
  await expect(requestCard.getByText("İncelemede")).toBeVisible();

  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await login(page, "alpha-staff@example.test");
  await page.goto("/clinic/data-requests");
  await expect(page.getByText("İncelemede").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Durumu güncelle" })).toHaveCount(0);
});

test("alpha user cannot view beta consent document detail", async ({ page }) => {
  const db = await connect();
  const documentId = crypto.randomUUID();
  await db.query(
    `
      insert into public.consent_documents (id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id)
      values ($1, $2, $3, 'Beta temsili belge', 'notice', 'local_notice', 'active', '00000000-0000-4000-8000-00000000b101')
    `,
    [documentId, ids.betaOrg, `beta-foundation-${Date.now()}`]
  );
  await db.end();

  await login(page, "alpha-owner@example.test");
  await page.goto(`/clinic/consent-documents/${documentId}`);
  await expect(page).toHaveURL(/\/clinic\/consent-documents$/);
  await expect(page.getByText("Beta temsili belge")).toHaveCount(0);
});
