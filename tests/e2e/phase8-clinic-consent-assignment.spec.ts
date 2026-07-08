import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createAndPublishNotice(page: Page, code: string) {
  await page.goto("/clinic/consent-documents");
  await page.getByLabel("Belge kodu").fill(code);
  await page.getByLabel("Başlık").fill("Temsili bilgilendirme belgesi");
  await page.getByLabel("Belge türü").selectOption("notice");
  await page.getByLabel("Amaç anahtarı").fill("local_notice");
  await page.getByLabel("Versiyon başlığı").fill("Temsili bilgilendirme v1");
  await page.getByLabel("Özet").fill("Bu belge gerçek bir hukuki metin değildir.");
  await page.getByLabel("Belge metni").fill("Temsili bilgilendirme metni — gerçek hukuki metin değildir.");
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/consent-documents\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Yayınla" }).click();
  await page.getByRole("button", { name: "Evet, yayınla" }).click();
  await expect(page.getByText("Yayınlandı", { exact: true }).first()).toBeVisible();
}

test.describe("Phase 8.3B - Clinic Consent Assignment", () => {
  test("owner creates assignment from client detail and staff is read-only", async ({ page }) => {
    const code = `e2e-assign-${Date.now()}`;
    await login(page, "alpha-owner@example.test");
    await createAndPublishNotice(page, code);

    await page.goto("/clinic/clients");
    await page.getByRole("link", { name: /Synthetic Alpha Client One/i }).first().click();
    await expect(page.getByRole("heading", { name: "Belge atamaları" })).toBeVisible();
    await page.getByLabel("Belge versiyonu").selectOption({ label: `${code} · v1 · Temsili bilgilendirme v1` });
    await page.getByRole("button", { name: "Belge ata" }).click();
    await expect(page.getByText("Belge ataması oluşturuldu.")).toBeVisible();
    await expect(page.getByText("Bekliyor")).toBeVisible();

    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await login(page, "alpha-staff@example.test");
    await page.goto("/clinic/clients");
    await page.getByRole("link", { name: /Synthetic Alpha Client One/i }).first().click();
    await expect(page.getByRole("heading", { name: "Belge atamaları" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Belge ata" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "İptal et" })).toHaveCount(0);
  });

  test("owner cancels pending assignment with confirmation dialog", async ({ page }) => {
    const code = `e2e-cancel-${Date.now()}`;
    await login(page, "alpha-admin@example.test");
    await createAndPublishNotice(page, code);
    await page.goto("/clinic/clients");
    await page.getByRole("link", { name: /Synthetic Alpha Client One/i }).first().click();
    await page.getByLabel("Belge versiyonu").selectOption({ label: `${code} · v1 · Temsili bilgilendirme v1` });
    await page.getByRole("button", { name: "Belge ata" }).click();
    await expect(page.getByText("Belge ataması oluşturuldu.")).toBeVisible();

    await page.getByRole("button", { name: "İptal et" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Evet, iptal et" }).click();
    await expect(page.getByText("Atama iptal edildi.")).toBeVisible();
    await expect(page.getByText("İptal edildi")).toBeVisible();
  });
});
