import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { activePlanStartDate } from "./helpers/plan-dates";

test.use({ actionTimeout: 10_000 });

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const photoLabel = "Portföy için sentetik fotoğraf";
const taskTitle = "Portföy sentetik takip görevi";
const symptom = "Portföy sentetik durum seçeneği";

async function login(page: Page, role: "alpha-owner" | "alpha-staff" | "beta-owner") {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(`${role}@example.test`);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createPublishedTemplate(page: Page, template: string, alertLabel: string) {
  await page.goto("/clinic/templates/new");
  await page.getByLabel("Şablon adı").fill(template);
  await page.getByLabel("Bağlı işlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/templates\/[\w-]+\/draft$/);

  await page.getByLabel("Gün başlığı").fill("Sentetik takip günü");
  await page.getByRole("button", { name: "Gün ekle" }).click();
  await expect(page.getByText("Sentetik takip günü")).toBeVisible();
  await page.getByLabel("Görev başlığı").fill(taskTitle);
  await page.getByRole("button", { name: "Görev ekle" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await page.getByLabel("Belirti seçeneği").fill(symptom);
  await page.getByRole("button", { name: "Belirti ekle" }).click();
  await expect(page.getByText(symptom)).toBeVisible();
  await page.getByLabel("Kural mesajı").fill(alertLabel);
  await page.getByLabel("Kural türü").selectOption("symptom_selected");
  await page.getByLabel("Önem seviyesi").selectOption("medium");
  await page.getByRole("button", { name: "Kural ekle" }).click();
  await expect(page.getByText(alertLabel)).toBeVisible();

  await page.getByRole("button", { name: "Yayına al", exact: true }).click();
  await page.getByRole("button", { name: "Evet, yayına al" }).click();
  await expect(page).toHaveURL(/\/versions\/[\w-]+$/);
  await expect(page.getByText("Yayınlandı", { exact: true })).toBeVisible();
}

async function publishAndAssignConsent(page: Page, clientPath: string, planId: string, code: string) {
  await page.goto("/clinic/consent-documents");
  await page.getByLabel("Belge kodu").fill(code);
  await page.getByLabel("Başlık").fill("Portföy sentetik onamı");
  await page.getByLabel("Belge türü").selectOption("consent");
  await page.getByLabel("Amaç anahtarı").fill("local_consent");
  await page.getByLabel("Versiyon başlığı").fill("Portföy sentetik onamı v1");
  await page.getByLabel("Özet").fill("Bu belge yalnızca sentetik test için hazırlanmıştır.");
  await page.getByLabel("Belge metni").fill("Sentetik belge içeriği. Yalnızca portföy testi.");
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/consent-documents\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Yayınla", exact: true }).click();
  await page.getByRole("button", { name: "Evet, yayınla" }).click();
  await expect(page.getByText("Yayınlandı", { exact: true }).first()).toBeVisible();

  await page.goto(clientPath);
  await page.getByLabel("Belge versiyonu").selectOption({ label: `${code} · v1 · Portföy sentetik onamı v1` });
  await page.getByLabel("Bakım planı (opsiyonel)").selectOption(planId);
  await page.getByRole("button", { name: "Belge ata" }).click();
  await expect(page.getByText("Belge ataması oluşturuldu.")).toBeVisible();
}

test("portfolio journey performs every required step on a new synthetic plan", async ({ page, browser, baseURL }) => {
  test.setTimeout(150_000);
  const suffix = randomUUID().slice(0, 8);
  const client = `Synthetic Portfolio Client ${suffix}`;
  const phone = `0555${(parseInt(suffix, 16) % 10_000_000).toString().padStart(7, "0")}`;
  const template = `Synthetic Portfolio Template ${suffix}`;
  const alertLabel = `Portföy sentetik uyarısı ${suffix}`;
  const code = `portfolio-${suffix}`;

  const clientPath = await test.step("Klinik girişi ve yeni danışan", async () => {
    await login(page, "alpha-owner");
    await page.goto("/clinic/clients/new");
    await page.getByLabel("Ad soyad").fill(client);
    await page.getByLabel("Telefon").fill(phone);
    await page.getByLabel("E-posta opsiyonel").fill(`portfolio-${suffix}@example.test`);
    await page.getByRole("button", { name: "Danışan oluştur" }).click();
    await expect(page).toHaveURL(/\/clinic\/clients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: client })).toBeVisible();
    return new URL(page.url()).pathname;
  });

  await test.step("Görev, belirti ve uyarı kuralı içeren yeni şablonu yayınla", async () => {
    await createPublishedTemplate(page, template, alertLabel);
  });

  const planPath = await test.step("Bugün başlayan yeni planı ve fotoğraf talebini oluştur", async () => {
    await page.goto("/clinic/plans/new");
    await page.getByLabel("Danışan").selectOption({ label: client });
    await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
    await page.getByLabel("Şablon").selectOption({ label: `${template} v1` });
    await expect(page.getByLabel("Başlangıç tarihi")).toHaveValue(activePlanStartDate());
    await page.getByRole("button", { name: "Plan oluştur" }).click();
    await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Aktif", { exact: true })).toBeVisible();
    await page.getByLabel("Plan günü").selectOption({ index: 1 });
    await page.getByLabel("Talep açıklaması").fill(photoLabel);
    await page.getByRole("button", { name: "Talep oluştur" }).click();
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Fotoğraf talebi oluşturuldu." })).toBeVisible();
    return new URL(page.url()).pathname;
  });

  await test.step("Yeni onam belgesini yayınla ve yeni plana ata", async () => {
    await publishAndAssignConsent(page, clientPath, planPath.split("/").at(-1)!, code);
  });

  const portalLink = await test.step("Güvenli bağlantı üret", async () => {
    await page.goto(planPath);
    await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
    const link = page.getByTestId("plain-secure-link");
    await expect(link).toHaveText(/^\/care\/t\//);
    return (await link.innerText()).trim();
  });

  const portalContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: browser.browserType().name() !== "firefox",
    hasTouch: true
  });
  const portal = await portalContext.newPage();
  try {
    await test.step("Mobil danışan portalında görev, check-in ve fotoğraf yüklemesi", async () => {
      const redirect = await portal.request.get(portalLink, { maxRedirects: 0 });
      expect(redirect.status()).toBe(307);
      expect(redirect.headers()["referrer-policy"]).toBe("no-referrer");
      await portal.goto("/care/session");
      await expect(portal.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
      expect(await portal.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      const task = portal.getByTestId("portal-task").filter({ hasText: taskTitle });
      const complete = task.getByRole("button", { name: "Tamamlandı olarak işaretle" });
      await complete.focus();
      await expect(complete).toBeFocused();
      await portal.keyboard.press("Enter");
      await expect(task.getByRole("button", { name: "Geri al" })).toBeVisible();

      await portal.getByLabel(symptom, { exact: true }).check();
      await portal.getByLabel(`${symptom} şiddet seçimi`).selectOption("3");
      const sendCheckIn = portal.getByRole("button", { name: "Kliniğe gönder" });
      await expect(sendCheckIn).toBeEnabled();
      const [checkInResponse] = await Promise.all([
        portal.waitForResponse((response) =>
          new URL(response.url()).pathname === "/care/session/check-in" && response.request().method() === "POST",
          { timeout: 10_000 }
        ),
        sendCheckIn.tap()
      ]);
      expect(checkInResponse.status()).toBe(200);
      await expect(portal.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();

      const photo = portal.locator("section.care-section").filter({ hasText: photoLabel });
      const image = await sharp({ create: { width: 48, height: 48, channels: 3, background: "#99bbcc" } }).png().toBuffer();
      await photo.locator('input[type="file"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
      await photo.getByRole("button", { name: "Güvenli şekilde yükle" }).click();
      await expect(photo.getByText("Fotoğrafınız güvenli şekilde iletildi.")).toBeVisible();
    });

    await test.step("Klinik uyarısını ve yüklenen gerçek sentetik görüntüyü incele", async () => {
      await page.goto("/clinic/alerts");
      const clientAlert = page.locator("article").filter({ has: page.getByRole("heading", { name: client, exact: true }) });
      await expect(clientAlert.getByText("Seviye: Orta", { exact: true })).toBeVisible();
      await clientAlert.getByRole("link", { name: "Detay" }).click();
      await expect(page.getByRole("heading", { name: "Takip bildirimi detayı" })).toBeVisible();
      const report = page.getByRole("region", { name: "Yapılandırılmış bildirim" });
      await expect(report.getByText(symptom, { exact: true })).toBeVisible();
      await expect(report.getByText("Seçildi", { exact: true })).toBeVisible();
      await page.goto(planPath);
      await page.getByRole("button", { name: "Güvenli görüntüle" }).click();
      const dialog = page.getByRole("dialog", { name: "Güvenli fotoğraf görüntüleme" });
      await expect(dialog).toBeVisible();
      await expect.poll(async () => dialog.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await dialog.getByRole("button", { name: "Kapat" }).click();
    });

    await test.step("Onamı kabul et, veri talebini gönder ve klinik kaydında doğrula", async () => {
      await portal.getByRole("button", { name: /belgesini görüntüle/ }).click();
      const dialog = portal.getByRole("dialog");
      await expect(dialog).toContainText("Sentetik belge içeriği.");
      await dialog.getByRole("button", { name: "Kabul ediyorum" }).click();
      await expect(dialog).toHaveCount(0);
      await portal.reload();
      await expect(portal.locator("article").filter({ hasText: "Portföy sentetik onamı" }).getByText("Kabul edildi")).toBeVisible();

      const request = portal.getByRole("region", { name: "Verilerimle ilgili talep oluştur" });
      await request.getByLabel("Talep türü").selectOption("copy");
      await request.getByRole("checkbox").check();
      await request.getByRole("button", { name: "Talep oluştur" }).click();
      await expect(request.getByText("Talebiniz incelenmek üzere kaydedildi.")).toBeVisible();
      await expect(request.locator("article").filter({ hasText: "Kopya talebi" })).toBeVisible();

      await page.goto("/clinic/data-requests");
      const requestCard = page.locator("article").filter({ hasText: client });
      await expect(requestCard.getByRole("heading", { name: "Kopya talebi" })).toBeVisible();
      await expect(requestCard.getByText("Gönderildi", { exact: true }).first()).toBeVisible();
    });

    await test.step("Rol ayrımı, tenant reddi ve etkin portal oturumunun iptali", async () => {
      const staff = await browser.newContext({ baseURL });
      const otherTenant = await browser.newContext({ baseURL });
      try {
        const staffPage = await staff.newPage();
        await login(staffPage, "alpha-staff");
        await staffPage.goto(planPath);
        await expect(staffPage.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
        await expect(staffPage.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toHaveCount(0);
        const otherPage = await otherTenant.newPage();
        await login(otherPage, "beta-owner");
        await otherPage.goto(planPath);
        await expect(otherPage).toHaveURL(/\/clinic\/plans$/);
        await expect(otherPage.getByText(client, { exact: true })).toHaveCount(0);
      } finally {
        await staff.close();
        await otherTenant.close();
      }

      await page.goto(planPath);
      await page.getByRole("button", { name: "Bağlantıyı iptal et", exact: true }).click();
      await page.getByRole("button", { name: "Evet, bağlantıyı iptal et" }).click();
      await expect(page.getByText("Bağlantı iptal edildi.", { exact: true })).toBeVisible();
      await portal.reload();
      await expect(portal).toHaveURL(/\/care\/invalid$/);
    });
  } finally {
    await portalContext.close();
  }
});
