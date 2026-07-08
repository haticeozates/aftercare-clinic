import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import crypto from "node:crypto";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
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

async function createDocumentViaInlineForm(page: Page, code: string) {
  await page.goto("/clinic/consent-documents");
  await page.getByLabel("Belge kodu").fill(code);
  await page.getByLabel("Başlık").fill("Temsili bilgilendirme belgesi");
  await page.getByLabel("Belge türü").selectOption("notice");
  await page.getByLabel("Amaç anahtarı").fill("local_notice");
  await page.getByLabel("Versiyon başlığı").fill("Temsili bilgilendirme v1");
  await page.getByLabel("Özet").fill("Bu belge gerçek bir hukuki metin değildir.");
  await page
    .getByLabel("Belge metni")
    .fill("Temsili bilgilendirme metni — gerçek hukuki metin değildir.");
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/consent-documents\/[0-9a-f-]+$/);
}

async function publishCurrentDraft(page: Page) {
  await page.getByRole("button", { name: "Yayınla" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Bu versiyon yayımlandıktan sonra değiştirilemez. Değişiklik için yeni bir taslak versiyon oluşturmanız gerekir.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Evet, yayınla" }).click();
  await expect(page.getByText("Yayınlandı", { exact: true }).first()).toBeVisible();
}

test.describe("Phase 8.3A - Clinic Consent Management", () => {
  test("owner completes draft edit, publish confirmation, new version and archive workflow", async ({ page }) => {
    const code = `e2e-owner-${Date.now()}`;
    await login(page, "alpha-owner@example.test");
    await createDocumentViaInlineForm(page, code);

    await page.getByLabel("Versiyon başlığı").fill("Temsili bilgilendirme v2");
    await page.getByLabel("Belge metni").fill("Bu tercih belgesi yalnız yerel test amacıyla oluşturulmuştur.");
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.getByText("Taslak kaydedildi.")).toBeVisible();

    await publishCurrentDraft(page);
    await expect(page.getByRole("textbox", { name: "Belge metni" })).toHaveCount(0);
    await expect(page.getByText("Bu tercih belgesi yalnız yerel test amacıyla oluşturulmuştur.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Belge metni" })).toHaveCount(0);

    await page.getByRole("button", { name: "Yeni versiyon başlat" }).click();
    await expect(page.getByText("Taslak")).toBeVisible();
    await expect(page.getByRole("heading", { name: "v2 · Temsili bilgilendirme v2" })).toBeVisible();

    await page.getByRole("button", { name: "Belgeyi arşivle" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Evet, arşivle" }).click();
    await expect(page.getByText("Arşivlendi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yeni versiyon başlat" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yayınla" })).toHaveCount(0);
  });

  test("staff can read published content but cannot manage documents", async ({ page }) => {
    const code = `e2e-staff-${Date.now()}`;
    await login(page, "alpha-admin@example.test");
    await createDocumentViaInlineForm(page, code);
    await publishCurrentDraft(page);
    const detailUrl = page.url();

    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await login(page, "alpha-staff@example.test");
    await page.goto("/clinic/consent-documents");
    await expect(page.getByRole("heading", { name: "Onay ve bilgilendirme belgeleri" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Taslak oluştur" })).toHaveCount(0);

    await page.goto(detailUrl);
    await expect(page.getByText("Temsili bilgilendirme metni — gerçek hukuki metin değildir.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Taslağı kaydet" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yayınla" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yeni versiyon başlat" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Belgeyi arşivle" })).toHaveCount(0);
  });

  test("alpha user cannot view beta consent document detail", async ({ page }) => {
    const db = await connect();
    const documentId = crypto.randomUUID();
    await db.query(
      `
        insert into public.consent_documents (id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id)
        values ($1, $2, $3, 'Beta temsili belge', 'notice', 'local_notice', 'active', '00000000-0000-4000-8000-00000000b101')
      `,
      [documentId, ids.betaOrg, `beta-mgmt-${Date.now()}`]
    );
    await db.end();

    await login(page, "alpha-owner@example.test");
    await page.goto(`/clinic/consent-documents/${documentId}`);
    await expect(page).toHaveURL(/\/clinic\/consent-documents$/);
    await expect(page.getByText("Beta temsili belge")).toHaveCount(0);
  });
});
