import { randomInt, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { addDays, wallDate } from "../../lib/appointments/calendar";
import { publicBookingEnabled } from "../../lib/appointments/contracts";

type Mail = { ID: string; Subject: string; To: { Address: string }[] };
test.use({ locale: "tr-TR", trace: "off", screenshot: "off", video: "off", actionTimeout: 12_000, navigationTimeout: 20_000 });

function isolatedFixture() {
  const db = new URL(process.env.TEST_DATABASE_URL ?? "postgres://invalid");
  const mail = new URL(process.env.PHASE11_MAILPIT_ORIGIN ?? "http://invalid");
  if (!publicBookingEnabled() || db.hostname !== "127.0.0.1" || db.port !== "56322"
    || mail.origin !== "http://127.0.0.1:56324" || db.pathname !== "/postgres") {
    throw new Error("Phase 12 requires the isolated Supabase and Mailpit fixtures.");
  }
  return { db: db.href, mail: mail.origin };
}

async function followMail(page: Page, address: string, subject: string) {
  const { mail } = isolatedFixture();
  let latest: Mail | undefined;
  await expect.poll(async () => {
    const { messages } = await (await fetch(mail + "/api/v1/messages")).json() as { messages: Mail[] };
    latest = messages.find((message) => message.Subject.toLowerCase().includes(subject)
      && message.To.some((entry) => entry.Address === address));
    return Boolean(latest);
  }, { timeout: 15_000, message: "Local Mailpit received the synthetic message" }).toBe(true);
  if (!latest) throw new Error("Expected a Mailpit message.");
  const response = await fetch(mail + "/api/v1/message/" + encodeURIComponent(latest.ID));
  const body = await response.json() as { HTML?: string; Text?: string };
  const href = body.HTML?.match(/href="([^"]+)"/)?.[1] ?? body.Text?.match(/https?:\/\/[^\s]+/)?.[0];
  if (!href) throw new Error("Mailpit message had no link.");
  const url = new URL(href.replaceAll("&amp;", "&"));
  if (url.origin !== "http://localhost:3000" || !["/auth/dogrula", "/ekip/davet"].includes(url.pathname) || !url.hash) {
    throw new Error("Unexpected local mail destination.");
  }
  await page.goto(url.pathname);
  await page.evaluate((fragment) => { location.hash = fragment; }, url.hash);
}

async function register(page: Page, address: string) {
  const secret = randomUUID();
  await page.getByLabel("E-posta", { exact: true }).fill(address);
  await page.getByLabel("Yeni parola", { exact: true }).fill(secret);
  await page.getByLabel("Yeni parolayı tekrar girin").fill(secret);
  await page.getByRole("button", { name: "Doğrulama bağlantısı iste" }).click();
  await expect(page.getByRole("status")).toContainText("İstek alındı");
  await followMail(page, address, "e-posta doğrulama");
  await page.getByRole("button", { name: "E-posta adresini doğrula" }).click();
}

async function capture(page: Page, view: string) {
  const directory = process.env.PHASE12_SCREENSHOTS_DIR;
  if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const [label, width, height] of [["desktop", 1440, 960], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), view).toBeLessThanOrEqual(width);
    if (directory) await page.screenshot({ path: join(directory, `${view}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function workHours(page: Page, member: string, weekday: string, kind = "work") {
  const form = page.getByRole("heading", { name: "Çalışma saati, mola veya izin ekle" }).locator("..");
  await form.getByLabel("Kural kapsamı").selectOption({ label: member });
  await form.getByLabel("Haftanın günü").selectOption(weekday);
  await form.getByLabel("Kural türü").selectOption(kind);
  await form.getByLabel("Başlangıç (SS:DD)", { exact: true }).fill(kind === "break" ? "12:00" : "08:00");
  await form.getByLabel("Bitiş (SS:DD)", { exact: true }).fill(kind === "break" ? "13:00" : "17:00");
  await form.getByRole("button", { name: "Kuralı ekle" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Takvim ayarı kaydedildi." })).toBeVisible();
}

async function fixtureAdvanceAppointment(appointmentId: string) {
  const client = new pg.Client({ connectionString: isolatedFixture().db });
  await client.connect();
  try {
    const updated = await client.query(
      `update public.appointments set starts_at=now()-interval '31 minutes',ends_at=now()-interval '1 minute'
        where id=$1 and source='online_demo' and demo_reference='DEMO-7812' and status='confirmed'`,
      [appointmentId]
    );
    expect(updated.rowCount).toBe(1);
  } finally {
    await client.end();
  }
}

test("new clinic and invited specialist can deliver the complete appointment and follow-up journey", async ({ page, browser }) => {
  isolatedFixture();
  test.setTimeout(240_000);
  const suffix = randomUUID().slice(0, 8);
  const operator = `phase12-owner-${suffix}@example.test`;
  const specialist = `phase12-staff-${suffix}@example.test`;
  const clinicName = "Ada Takvim Kliniği";
  const procedureName = "Sentetik Takip İşlemi";
  const clientName = "Sentetik Randevu Danışanı";
  const day = addDays(wallDate(new Date(), "Europe/Istanbul"), 2);
  const weekday = String(new Date(day + "T12:00:00Z").getUTCDay() || 7);
  await page.setViewportSize({ width: 1440, height: 960 });

  await test.step("Create and verify a real local account and clinic", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: /Klinik demo hesabı oluştur/ }).click();
    await expect(page).toHaveURL(/\/kayit$/);
    await register(page, operator);
    await expect(page).toHaveURL(/\/kurulum$/);
    await page.getByLabel("Klinik adı").fill(clinicName);
    await page.getByLabel("Ad soyad").fill("Sentetik Takvim Yöneticisi");
    await page.getByRole("button", { name: "Kliniği oluştur" }).click();
    await expect(page.locator('[aria-current="step"]')).toHaveText("Ekip");
    await page.getByLabel("Ekip üyesinin e-postası").fill(specialist);
    await page.getByRole("button", { name: "Davet gönder" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Davet yerel test posta kutusuna gönderildi" })).toBeVisible();
    await page.getByRole("link", { name: "Kurulum özetine geç" }).click();
    await page.getByRole("button", { name: "Kurulumu tamamla ve kliniğe geç" }).click();
    await expect(page).toHaveURL(/\/clinic$/);
  });

  const staffContext = await browser.newContext();
  const publicContext = await browser.newContext();
  try {
    const staff = await staffContext.newPage();
    await test.step("Accept the specialist invitation and enforce staff administration limits", async () => {
      await followMail(staff, specialist, "ekip daveti");
      await staff.getByRole("button", { name: "Davetle devam et" }).click();
      await staff.getByRole("link", { name: "Hesap oluştur" }).click();
      await expect(staff).toHaveURL(/\/kayit$/);
      await register(staff, specialist);
      await staff.getByRole("button", { name: "Ekip davetini kabul et" }).click();
      await expect(staff).toHaveURL(/\/clinic$/);
      await expect(staff.getByLabel("Klinik kenar çubuğu").getByText("Uzman", { exact: true })).toBeVisible();
      await staff.goto("/clinic/appointments/availability");
      await expect(staff).toHaveURL(/\/unauthorized$/);
    });

    let publicPath = "";
    await test.step("Set both schedules, a break and a public service using the clinic UI", async () => {
      await page.goto("/clinic/procedures");
      await page.getByLabel("İşlem adı").first().fill(procedureName);
      await page.getByRole("button", { name: "İşlem oluştur" }).click();
      await expect(page.getByRole("heading", { name: procedureName })).toBeVisible();

      await page.goto("/clinic/appointments/availability");
      await workHours(page, "Klinik geneli", weekday);
      await workHours(page, "Ekip üyesi", weekday);
      await workHours(page, "Klinik geneli", weekday, "break");
      await page.getByLabel("İşlem", { exact: true }).selectOption({ label: procedureName });
      await page.getByLabel("İşlemi online demoda göster").check();
      await page.getByRole("button", { name: "İşlem ayarını kaydet" }).click();
      await expect(page.getByRole("list", { name: "Kayıtlı işlem süreleri" })).toContainText(procedureName);
      await page.getByLabel("Klinik bağlantısını etkinleştir").check();
      await page.getByRole("button", { name: "Online görünürlüğü kaydet" }).click();
      const link = page.getByRole("link", { name: "Kliniğin online demo bağlantısı" });
      await expect(link).toBeVisible();
      publicPath = await link.getAttribute("href") ?? "";
      expect(publicPath).toMatch(/^\/randevu\/clinic-/);
      await capture(page, "musaitlik");

      await page.goto("/clinic/clients/new");
      await page.getByLabel("Ad soyad").fill(clientName);
      await page.getByLabel("Telefon").fill("+90555" + String(randomInt(1_000_000, 9_999_999)));
      await page.getByRole("button", { name: "Danışan oluştur" }).click();
      await expect(page.getByRole("heading", { name: clientName })).toBeVisible();
    });
    const clientUrl = new URL(page.url()).pathname;

    const visitor = await publicContext.newPage();
    const stale = await publicContext.newPage();
    await test.step("Request an actually available slot and reject a stale duplicate", async () => {
      for (const target of [visitor, stale]) {
        const response = await target.goto(publicPath);
        expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
        expect(response?.headers()["cache-control"]).toContain("no-store");
        await expect(target.getByRole("heading", { name: "Randevu talebi" })).toBeVisible();
        await expect(target.getByText(clientName)).toHaveCount(0);
        await expect(target.getByText("Sentetik Takvim Yöneticisi")).toHaveCount(0);
        await target.getByLabel("Tarih", { exact: true }).fill(day);
        await target.getByRole("button", { name: "Saatleri göster" }).click();
        await expect(target.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
        await expect(target.getByRole("radio", { name: "12:00", exact: true })).toHaveCount(0);
      }
      await capture(visitor, "online-randevu");
      await visitor.setViewportSize({ width: 390, height: 844 });
      await visitor.getByRole("radio", { name: "09:00", exact: true }).check();
      await visitor.getByLabel("Sentetik danışan kodu").fill("DEMO-7812");
      await visitor.getByRole("button", { name: "Randevu talebi gönder" }).click();
      await expect(visitor.getByRole("status")).toContainText("klinik onayı bekliyor");
      await stale.getByRole("radio", { name: "09:00", exact: true }).check();
      await stale.getByLabel("Sentetik danışan kodu").fill("DEMO-7813");
      await stale.getByRole("button", { name: "Randevu talebi gönder" }).click();
      await expect(stale.getByRole("main").getByRole("alert")).toContainText("Talep alınamadı");
    });

    let id = "";
    await test.step("Match the client, approve the request and display the appointment on the agenda", async () => {
      await page.goto("/clinic");
      const upcoming = page.getByRole("heading", { name: "Yaklaşan randevular" }).locator("../..");
      await expect(upcoming.getByRole("link", { name: /Online talep.*Onay bekliyor/ })).toBeVisible();
      await capture(page, "klinik-paneli");
      await upcoming.getByRole("link", { name: /Online talep.*Onay bekliyor/ }).click();
      await expect(page.getByRole("heading", { name: "Randevu detayı" })).toBeVisible();
      id = new URL(page.url()).pathname.split("/").at(-1) ?? "";
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
      await page.getByLabel("Talebi eşleştirilecek danışan").selectOption({ label: clientName });
      await page.getByRole("button", { name: "Randevuyu onayla" }).click();
      await expect(page.locator("[data-booking-status=confirmed]")).toBeVisible();
      await capture(page, "randevu-detayi");

      await page.goto(`/clinic/appointments?view=month&date=${day}`);
      await expect(page.locator('[data-view="month"]')).toBeVisible();
      await capture(page, "takvim");
      const week = page.getByRole("link", { name: "Hafta", exact: true });
      await week.focus();
      await expect(week).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator('[data-view="week"]')).toBeVisible();
      await page.getByRole("link", { name: "Gün", exact: true }).click();
      await expect(page.locator('[data-view="day"]')).toBeVisible();
      await page.getByRole("link", { name: "Ajanda", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('[data-view="agenda"]').getByRole("link", { name: new RegExp(clientName) })).toBeVisible();
      const output = process.env.PHASE12_SCREENSHOTS_DIR;
      if (output) await page.screenshot({ path: join(output, "ajanda-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(clientUrl);
      await expect(page.getByRole("heading", { name: "Randevu geçmişi" })).toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(procedureName) })).toBeVisible();
    });

    await test.step("Complete the appointment, explicitly create the care plan and link a follow-up", async () => {
      await fixtureAdvanceAppointment(id);
      await page.goto(`/clinic/appointments/${id}`);
      await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).click();
      await expect(page.locator("[data-booking-status=completed]")).toBeVisible();

      await page.goto("/clinic/templates/new");
      await page.getByLabel("Şablon adı").fill("Sentetik Randevu Şablonu");
      await page.getByLabel("Bağlı işlem").selectOption({ label: procedureName });
      await page.getByRole("button", { name: "Taslak oluştur" }).click();
      await expect(page).toHaveURL(/\/clinic\/templates\/[0-9a-f-]+\/draft$/);
      await page.getByLabel("Gün başlığı").fill("Sentetik takip günü");
      await page.getByRole("button", { name: "Gün ekle" }).click();
      await expect(page.getByText("Sentetik takip günü")).toBeVisible();
      await page.getByLabel("Görev başlığı").fill("Sentetik takip görevi");
      await page.getByLabel("Görev türü").selectOption("do");
      await page.getByRole("button", { name: "Görev ekle" }).click();
      await expect(page.getByText("Sentetik takip görevi")).toBeVisible();
      await page.getByRole("button", { name: "Yayına al", exact: true }).click();
      await page.getByRole("button", { name: "Evet, yayına al" }).click();
      await expect(page.getByText("Yayınlandı")).toBeVisible();

      await page.goto(`/clinic/appointments/${id}`);
      await page.getByRole("link", { name: "Randevudan bakım planı oluştur" }).click();
      await expect(page).toHaveURL(/\/clinic\/plans\/new\?appointment/);
      await expect(page.getByLabel("Danışan").locator("option:checked")).toHaveText(clientName);
      await expect(page.getByLabel("İşlem").locator("option:checked")).toHaveText(procedureName);
      await page.getByRole("button", { name: "Plan oluştur" }).click();
      await expect(page.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
      const plan = new URL(page.url()).pathname;
      await page.getByRole("link", { name: "Kontrol randevusu oluştur" }).click();
      await expect(page.getByLabel("Randevu türü")).toHaveValue("follow_up");
      await expect(page.getByLabel("İlgili bakım planı")).toHaveValue(plan.split("/").at(-1) ?? "");
      await page.getByLabel("Uzman", { exact: true }).selectOption({ label: "Ekip üyesi" });
      await page.getByLabel("Başlangıç tarihi ve saati").fill(addDays(day, 7) + "T09:30");
      await page.getByRole("button", { name: "Randevuyu oluştur" }).click();
      await expect(page.getByRole("link", { name: "İlgili bakım planını aç" })).toHaveAttribute("href", plan);

      await page.getByRole("link", { name: "Düzenle veya yeniden planla" }).click();
      await page.getByLabel("Başlangıç tarihi ve saati").fill(addDays(day, 7) + "T10:30");
      await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
      await expect(page.getByText("Yeniden planlandı", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Randevuyu iptal et" }).click();
      await expect(page.locator("[data-booking-status=cancelled]")).toBeVisible();
    });

    await test.step("Deny anonymous and another clinic access to the appointment", async () => {
      const details = `/clinic/appointments/${id}`;
      await visitor.goto(details);
      await expect(visitor).toHaveURL(/\/login$/);
      await visitor.getByLabel("E-posta", { exact: true }).fill("beta-owner@example.test");
      await visitor.getByLabel("Parola", { exact: true }).fill(process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password");
      await visitor.getByRole("button", { name: "Giriş yap" }).click();
      await expect(visitor).toHaveURL(/\/clinic$/);
      await visitor.goto(details);
      await expect(visitor.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
      await expect(visitor.getByText(clientName)).toHaveCount(0);
    });
  } finally {
    await Promise.all([staffContext.close(), publicContext.close()]);
  }
});
