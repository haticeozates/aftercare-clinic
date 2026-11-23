import { expect, test } from "@playwright/test";
import { wallDate } from "../../lib/appointments/calendar";

test.use({ viewport: { width: 320, height: 780 }, locale: "tr-TR" });

test("clinic controls and empty analytics stay usable on a small phone with the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const password = process.env.E2E_LOCAL_TEST_PASSWORD;
  if (!password) throw new Error("Use the isolated demo account");
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("alpha-owner@example.test");
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);

  const menu = page.getByRole("button", { name: "Menüyü aç" });
  const target = await menu.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  });
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
  await menu.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Klinik menüsü" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Menüyü kapat" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();

  const day = wallDate(new Date(), "Europe/Istanbul");
  await page.goto("/clinic/appointments?view=week&date=" + day);
  await expect(page.getByRole("heading", { name: "Randevu takvimi" })).toBeVisible();
  await expect(page.locator(".booking-day[data-today=true][data-selected=true] [aria-current=date]")).toBeVisible();
  await expect(page.getByText("Seçili tarih", { exact: false })).toBeVisible();
  const calendarDate = await page.getByLabel("Tarih", { exact: true }).boundingBox();
  expect(calendarDate?.width).toBeGreaterThanOrEqual(200);
  await page.locator(".mobile-topbar .brand-block strong").evaluate((element) => {
    element.textContent = "SentetikKlinikAdıUzunMetinTaşmaDenetimi".repeat(3);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.goto("/clinic/reports?preset=custom&from=2001-01-01&to=2001-01-07");
  await expect(page.getByRole("heading", { name: "Bu dönemde kayıt bulunamadı" })).toBeVisible();
  await expect(page.locator('[data-metric="taskAdherence"] .report-value')).toHaveText("—");
  const reportDate = await page.getByLabel("Özel başlangıç").boundingBox();
  expect(reportDate?.width).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const contrast = await page.evaluate(() => {
    const values = getComputedStyle(document.documentElement);
    function luminance(hex: string) {
      const channels = hex.trim().slice(1).match(/.{2}/g);
      if (!channels || channels.length !== 3) throw new Error("Expected an opaque board color");
      const [r, g, b] = channels.map((channel) => {
        const number = Number.parseInt(channel, 16) / 255;
        return number <= .04045 ? number / 12.92 : ((number + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    }
    const muted = luminance(values.getPropertyValue("--color-muted"));
    const cream = luminance(values.getPropertyValue("--color-bg"));
    const forest = luminance(values.getPropertyValue("--color-primary-strong"));
    return { muted: (cream + .05) / (muted + .05), primary: 1.05 / (forest + .05) };
  });
  expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
  expect(contrast.primary).toBeGreaterThanOrEqual(4.5);
});
