import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const demoOwner = "demo-owner@example.test";
const demoStaff = "demo-staff@example.test";
const demoPlanId = "00000000-0000-4000-8000-00000000da01";
const demoDayToday = "00000000-0000-4000-8000-00000000da11";
const demoNoticeTitle = "Temsili bilgilendirme v1";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

function ensureDemoFixture() {
  const result = spawnSync("node", [resolve(process.cwd(), "scripts/setup-phase9b-demo.mjs")], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`demo:setup failed:\n${result.stdout}\n${result.stderr}`);
  }
  expect(result.stdout).toMatch(/"ok": true/);
}

async function createSecurePortalLink(page: Page) {
  const createButton = page.getByRole("button", { name: "Güvenli bağlantı oluştur" });
  const rotateButton = page.getByRole("button", { name: "Bağlantıyı yenile" });
  if (await createButton.isVisible()) {
    await createButton.click();
  } else {
    await rotateButton.click();
    await page.getByRole("button", { name: "Evet, bağlantıyı yenile" }).click();
  }
  const linkLocator = page.getByTestId("plain-secure-link");
  await expect(linkLocator).toBeVisible();
  const link = await linkLocator.textContent();
  expect(link).toMatch(/\/care\/t\//);
  expect(link).not.toMatch(/phase9b-demo-fixture-hash-only-not-a-token/);
  return link ?? "";
}

async function writeSyntheticPng() {
  const dir = mkdtempSync(join(tmpdir(), "phase9b-pilot-"));
  const filePath = join(dir, "synthetic-demo.png");
  const buffer = await sharp({
    create: { width: 48, height: 48, channels: 3, background: { r: 96, g: 164, b: 196 } }
  })
    .png()
    .toBuffer();
  writeFileSync(filePath, buffer);
  return filePath;
}

test.describe("Phase 9B - pilot golden journey", () => {
  test.beforeAll(() => {
    ensureDemoFixture();
  });

  test("demo owner walks clinic, portal, and follow-up without cross-tenant leakage", async ({ page }) => {
    test.setTimeout(120_000);
    const photoRequestLabel = `Pilot golden journey talebi ${Date.now()}`;

    await login(page, demoOwner);
    await expect(page.getByRole("heading", { name: "Demo Pilot Clinic" })).toBeVisible();
    await expect(page.getByText("Synthetic Alpha Client One")).toHaveCount(0);

    await page.goto("/clinic/clients");
    await expect(page.getByText("Synthetic Demo Client")).toBeVisible();
    await page.getByRole("row", { name: /Synthetic Demo Client/ }).getByRole("link", { name: "Detay" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/@example\.test/)).toBeVisible();

    await page.goto(`/clinic/plans/${demoPlanId}`);
    await expect(page.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
    await expect(page.getByText("Demo Procedure One")).toBeVisible();
    await expect(page.getByText("Demo takip günü 1")).toBeVisible();

    ensureDemoFixture();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toBeVisible();

    let uploadTargetLabel = "Temsili demo fotoğraf talebi";
    const daySelect = page.locator("#carePlanDayId");
    if ((await daySelect.count()) > 0) {
      const todayOptionAvailable = await daySelect.locator(`option[value="${demoDayToday}"]`).count();
      if (todayOptionAvailable > 0) {
        await daySelect.selectOption(demoDayToday);
        await page.getByLabel("Talep açıklaması").fill(photoRequestLabel);
        await page.getByRole("button", { name: "Talep oluştur" }).click();
        await expect(page.getByRole("status").filter({ hasText: "Fotoğraf talebi oluşturuldu." })).toBeVisible();
        uploadTargetLabel = photoRequestLabel;
      }
    }

    const portalLink = await createSecurePortalLink(page);
    await page.goto(portalLink);
    await expect(page).toHaveURL(/\/care\/session$/);
    await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();

    const completeButton = page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).first();
    if ((await completeButton.count()) > 0) {
      await completeButton.click();
      await expect(page.getByRole("button", { name: "Geri al" }).first()).toBeVisible();
      await page.getByRole("button", { name: "Geri al" }).first().click();
      await expect(page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).first()).toBeVisible();
    }

    const checkInHeading = page.getByRole("heading", { name: "Bugünkü durumunuzu kliniğinizle paylaşın" });
    if ((await checkInHeading.count()) > 0) {
      const alreadySubmitted = page.getByText("Bugün için bildiriminiz kaydedildi.");
      if ((await alreadySubmitted.count()) === 0) {
        await page.getByLabel("Klinik değerlendirmesi için temsili durum").check();
        await page.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi").selectOption("3");
        await page.getByRole("button", { name: "Kliniğe gönder" }).click();
        await expect(page.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();
      } else {
        await expect(alreadySubmitted).toBeVisible();
      }
    }

    const photoCard = page.locator("section.care-section").filter({ hasText: uploadTargetLabel });
    await expect(photoCard).toBeVisible();
    const alreadyUploaded = photoCard.getByText("Fotoğrafınız güvenli şekilde iletildi.");
    if ((await alreadyUploaded.count()) === 0) {
      const notEligible = photoCard.getByText("Bu fotoğraf talebi şu anda yükleme için uygun değil.");
      expect(await notEligible.count()).toBe(0);
      const syntheticImage = await writeSyntheticPng();
      const fileInput = photoCard.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();
      await fileInput.setInputFiles(syntheticImage);
      const uploadButton = photoCard.getByRole("button", { name: "Güvenli şekilde yükle" });
      await expect(uploadButton).toBeEnabled();
      await uploadButton.click();
      await expect(photoCard.getByText("Fotoğrafınız güvenli şekilde iletildi.")).toBeVisible();
    } else {
      await expect(alreadyUploaded).toBeVisible();
    }

    await page.getByRole("button", { name: `${demoNoticeTitle} belgesini görüntüle` }).click();
    const noticeDialog = page.getByRole("dialog");
    await expect(noticeDialog).toContainText("Temsili bilgilendirme metni");
    const acknowledgeButton = noticeDialog.getByRole("button", { name: "Okudum / Görüntüledim" });
    if (await acknowledgeButton.isEnabled()) {
      await acknowledgeButton.click();
    }
    await expect(page.locator("article").filter({ hasText: demoNoticeTitle }).getByText("Görüldü")).toBeVisible();

    const dataRequestRegion = page.getByRole("region", { name: "Verilerimle ilgili talep oluştur" });
    const existingCopyRequest = dataRequestRegion.getByText("Kopya talebi");
    if ((await existingCopyRequest.count()) === 0) {
      await page.getByLabel("Talep türü").selectOption("copy");
      await page.getByLabel("Talebimin incelenmek üzere kliniğe iletileceğini anlıyorum.").check();
      await page.getByRole("button", { name: "Talep oluştur" }).click();
      await expect(page.getByText("Talebiniz incelenmek üzere kaydedildi.")).toBeVisible();
    }

    await login(page, demoOwner);
    await page.goto("/clinic/alerts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Synthetic Alpha Client One")).toHaveCount(0);

    await page.goto(`/clinic/plans/${demoPlanId}`);
    await expect(page.locator("h4", { hasText: uploadTargetLabel })).toBeVisible();
    await page.getByRole("button", { name: "Güvenli görüntüle" }).first().click();
    await expect(page.getByRole("dialog", { name: "Güvenli fotoğraf görüntüleme" })).toBeVisible();
    await expect(page.getByText(/care-photos\/|incoming\//i)).toHaveCount(0);
    await page.getByRole("button", { name: "Kapat" }).click();

    await page.goto("/clinic/data-requests");
    await expect(page.getByRole("heading", { name: "Veri talebi kayıtları" })).toBeVisible();
    await expect(page.getByText(/Erişim talebi|Kopya talebi/)).toBeVisible();
    await expect(page.getByText(/manual_review_|resolution_code/i)).toHaveCount(0);

    await login(page, demoStaff);
    await page.goto(`/clinic/plans/${demoPlanId}`);
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toHaveCount(0);
    await page.goto("/clinic/data-requests");
    await expect(page.getByRole("button", { name: "Personel ata" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Durumu güncelle" })).toHaveCount(0);
  });
});
