import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { addDays, wallDate } from "../../lib/appointments/calendar";
import { isolatedNotificationDatabase, notificationMailConfig } from "../../lib/notifications/local-mail.mjs";
import { activePlanStartDate } from "./helpers/plan-dates";

test.use({ locale: "tr-TR", trace: "off", screenshot: "off", video: "off", actionTimeout: 12_000, navigationTimeout: 20_000 });

const runWorker = () => promisify(execFile)(process.execPath, ["scripts/run-notification-worker.mjs", "--once"], { timeout: 30_000 });
const owner = "alpha-owner@example.test";
const clientName = "Synthetic Alpha Client One";
const procedureName = "Alpha Procedure One";
const inbox = "/clinic/notifications";
const bell = (page: Page) => page.getByRole("button", { name: /^Bildirimler,/ });
const card = (page: Page, title: string) => page.getByRole("heading", { name: title, exact: true }).locator("../..");

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  const password = process.env.E2E_LOCAL_TEST_PASSWORD;
  if (!password) throw new Error("Missing isolated seed login fixture");
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function capture(page: Page, view: string, openBell = false) {
  const directory = process.env.PHASE13_SCREENSHOTS_DIR;
  if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const [label, width, height] of [["desktop", 1440, 960], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), view).toBeLessThanOrEqual(width);
    if (openBell) {
      await bell(page).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("region", { name: "Son bildirimler" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Tümünü gör" })).toBeFocused();
    }
    if (directory) await page.screenshot({ path: join(directory, view + "-" + label + ".png"), fullPage: !openBell });
    if (openBell) {
      await page.keyboard.press("Escape");
      await expect(bell(page)).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function mailBody(mailOrigin: string, id: string, subject: string) {
  const search = new URL("/api/v1/search", mailOrigin);
  search.searchParams.set("query", "message-id:aftercare-" + id + "@notification.test");
  const response = await fetch(search);
  expect(response.ok).toBe(true);
  const { messages } = await response.json() as { messages: { ID: string; Subject: string; To: { Address: string }[] }[] };
  expect(messages).toHaveLength(1);
  expect(messages[0].Subject).toBe("AfterCare Clinic · " + subject);
  expect(messages[0].To.map((entry) => entry.Address)).toEqual([owner]);
  const message = await fetch(new URL("/api/v1/message/" + encodeURIComponent(messages[0].ID), mailOrigin));
  expect(message.ok).toBe(true);
  const { HTML, Text } = await message.json() as { HTML: string; Text: string };
  expect(HTML).toContain('href="http://localhost:3000/clinic/notifications"');
  expect(Text).toContain("http://localhost:3000/clinic/notifications");
  expect(HTML + Text).not.toMatch(/Synthetic Alpha|DEMO-|\/care\/t\/|data:image|supabase/i);
  return HTML;
}

test("public request, Mailpit delivery, reminder replacement and private check-in inbox", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const connectionString = process.env.TEST_DATABASE_URL;
  const config = notificationMailConfig();
  if (!config || !isolatedNotificationDatabase(connectionString, readFileSync("supabase/config.toml", "utf8"))) {
    throw new Error("Phase 13 requires the verified isolated notification runner.");
  }
  const db = new pg.Pool({ connectionString });
  const guestContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const visitor = await guestContext.newPage();
  const day = addDays(wallDate(new Date(), "Europe/Istanbul"), 2);
  const weekday = new Date(day + "T12:00:00Z").getUTCDay() || 7;
  let appointmentPath = "";
  let appointmentId = "";
  const jobs = (kind: string, email: string) => db.query<{
    id: string; status: string; invalidated: boolean; due: Date; appointment: Date;
  }>(`select q.id,q.status,e.invalidated_at is not null invalidated,q.next_attempt_at due,e.anchor_at appointment
    from notification_private.mail_queue q join public.notification_receipts n on n.id=q.receipt_id
    join notification_private.events e on e.id=n.event_id join auth.users u on u.id=n.user_id
    where n.target_id=$1 and n.kind=$2 and u.email=$3 order by e.created_at`, [appointmentId, kind, email]);

  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await test.step("Set clinic and personal preferences and prepare the synthetic online schedule", async () => {
      await login(page, owner);
      await page.goto(inbox + "/preferences");
      const personal = page.getByRole("heading", { name: "Kişisel tercihler" }).locator("..");
      const clinic = page.getByRole("heading", { name: "Klinik tercihleri" }).locator("..");
      await expect(page.getByText(/SMS ve WhatsApp · Kapalı/)).toBeVisible();
      await expect(personal.getByLabel("Klinik incelemesi bekliyor")).toBeDisabled();
      await clinic.getByLabel("Yerel randevu e-postalarını etkinleştir").check();
      await clinic.getByLabel("Randevu hatırlatma süresi (dakika)").fill("60");
      await clinic.getByLabel("Günlük bakım hatırlatma saati").fill("00:00");
      await clinic.getByRole("button", { name: "Klinik tercihlerini kaydet" }).click();
      await expect(clinic.getByRole("status")).toContainText("kaydedildi");
      await page.reload();
      await expect(clinic.getByLabel("Yerel randevu e-postalarını etkinleştir")).toBeChecked();
      await personal.getByLabel("Yerel randevu e-postalarını etkinleştir").check();
      const savePersonal = personal.getByRole("button", { name: "Tercihlerimi kaydet" });
      await savePersonal.evaluate((button) => button.scrollIntoView({ block: "center", behavior: "instant" }));
      await savePersonal.focus();
      await savePersonal.click();
      await expect(personal.getByRole("status")).toContainText("kaydedildi");
      await capture(page, "tercihler");

      const { rows: [fixture] } = await db.query<{ clinic:string; actor:string; member:string; procedure:string; admin:string }>(`
        select o.id clinic,m.user_id actor,m.id member,p.id procedure,
          (select id from auth.users where email='alpha-admin@example.test') as admin
        from public.organizations o join public.organization_memberships m on m.organization_id=o.id
        join auth.users u on u.id=m.user_id join public.procedures p on p.organization_id=o.id and p.name=$2
        where o.slug='organization-alpha' and u.email=$1`, [owner, procedureName]);
      for (const membership_id of [null, fixture.member]) {
        await db.query("select public.phase12_configure($1,$2,'rule',$3)", [fixture.actor, fixture.clinic,
          { membership_id, kind: "work", weekday, start_minute: 480, end_minute: 980 }]);
      }
      await db.query("select public.phase12_configure($1,$2,'service',$3)", [fixture.actor, fixture.clinic,
        { procedure_id: fixture.procedure, minutes: 30, public_demo: true }]);
      await db.query("select public.phase12_configure($1,$2,'public',$3)", [fixture.actor, fixture.clinic, { public_demo: true }]);
      await db.query("select public.phase13_preferences($1,$2,'user',$3)", [fixture.admin, fixture.clinic,
        { email_enabled: true, reminder_minutes: 90 }]);
    });

    await test.step("Book online and follow the clinic bell to the protected appointment", async () => {
      await visitor.goto("/randevu/organization-alpha");
      await visitor.getByLabel("Tarih", { exact: true }).fill(day);
      await visitor.getByRole("button", { name: "Saatleri göster" }).click();
      await visitor.getByRole("radio", { name: "09:00", exact: true }).check();
      await visitor.getByLabel("Sentetik danışan kodu").fill("DEMO-" + randomInt(3000, 7000));
      await visitor.getByRole("button", { name: "Randevu talebi gönder" }).click();
      await expect(visitor.getByRole("status")).toContainText("klinik onayı bekliyor");
      await page.goto(inbox);
      await expect(bell(page)).toHaveAccessibleName(/Bildirimler, [1-9]\d* okunmamış/);
      await capture(page, "son-bildirimler", true);
      await bell(page).click();
      await page.getByRole("region", { name: "Son bildirimler" }).getByRole("link", { name: /Online randevu talebi/ }).click();
      await expect(page.getByRole("heading", { name: "Randevu detayı" })).toBeVisible();
      appointmentPath = new URL(page.url()).pathname;
      appointmentId = appointmentPath.split("/").at(-1) ?? "";
      expect(appointmentId).toMatch(/^[a-f0-9-]{36}$/);
    });

    await test.step("Approve the appointment, receive real mail and deliver the reminder from the due queue", async () => {
      await page.getByLabel("Talebi eşleştirilecek danışan").selectOption({ label: clientName });
      await page.getByRole("button", { name: "Randevuyu onayla" }).click();
      await expect(page.locator("[data-booking-status=confirmed]")).toBeVisible();
      const { rows: [reminder] } = await jobs("appointment_reminder", owner);
      expect(reminder.status).toBe("queued");
      expect(reminder.due.getTime()).toBe(reminder.appointment.getTime() - 60 * 60_000);
      expect(reminder.due.getTime()).toBeGreaterThan(Date.now());
      await runWorker();
      const approved = (await jobs("appointment_confirmed", owner)).rows[0];
      expect(approved.status).toBe("sent");
      expect((await jobs("appointment_reminder", owner)).rows[0].status).toBe("queued");
      await visitor.setContent(await mailBody(config.mail, approved.id, "Randevu onaylandı"));
      await capture(visitor, "mailpit-onay");
      // Advance this one synthetic due job while leaving its appointment and the admin job in the future.
      await db.query("update notification_private.mail_queue set next_attempt_at=now()-interval '1 second' where id=$1", [reminder.id]);
      await runWorker();
      await mailBody(config.mail, reminder.id, "Randevu hatırlatması");
      expect((await jobs("appointment_reminder", owner)).rows[0].status).toBe("sent");
    });

    await test.step("Reschedule with automatic stale job invalidation and send change and cancellation mail", async () => {
      await page.getByRole("link", { name: "Düzenle veya yeniden planla" }).click();
      await page.getByLabel("Başlangıç tarihi ve saati").fill(day + "T10:30");
      await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
      await expect(page.getByText("Yeniden planlandı", { exact: true })).toBeVisible();
      const adminReminders = (await jobs("appointment_reminder", "alpha-admin@example.test")).rows;
      expect(adminReminders.map(({ status, invalidated }) => ({ status, invalidated })))
        .toEqual([{ status: "cancelled", invalidated: true }, { status: "queued", invalidated: false }]);
      await runWorker();
      await mailBody(config.mail, (await jobs("appointment_rescheduled", owner)).rows[0].id, "Randevu saati değişti");
      await page.getByRole("button", { name: "Randevuyu iptal et" }).click();
      await expect(page.locator("[data-booking-status=cancelled]")).toBeVisible();
      await runWorker();
      await mailBody(config.mail, (await jobs("appointment_cancelled", owner)).rows[0].id, "Randevu kapatıldı");
      expect((await jobs("appointment_reminder", "alpha-admin@example.test")).rows.every((job) =>
        job.status === "cancelled" && job.invalidated)).toBe(true);
    });

    await test.step("Create a care plan, run its daily task sweep and submit a real portal check-in", async () => {
      await page.goto("/clinic/plans/new");
      await page.getByLabel("Danışan").selectOption({ label: clientName });
      await page.getByLabel("İşlem").selectOption({ label: procedureName });
      await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
      await page.getByLabel("Başlangıç tarihi").fill(activePlanStartDate());
      await page.getByRole("button", { name: "Plan oluştur" }).click();
      await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
      const plan = new URL(page.url()).pathname;
      await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
      const link = await page.getByTestId("plain-secure-link").textContent();
      if (!link) throw new Error("Synthetic portal link unavailable");
      await visitor.goto(link);
      await expect(visitor).toHaveURL(/\/care\/session$/);
      await runWorker();
      await visitor.getByLabel("Klinik değerlendirmesi için temsili durum").check();
      await visitor.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi").selectOption("5");
      await visitor.getByRole("button", { name: "Kliniğe gönder" }).click();
      await expect(visitor.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();
      await page.goto(inbox);
      for (const name of ["Yeni bakım planı", "Günlük bakım görevi", "Danışan check-in bildirimi"]) {
        await expect(card(page, name).getByRole("link", { name: "İlgili kaydı aç" })
          .and(page.locator(`a[href="${plan}"]`))).toBeVisible();
      }
      await expect(card(page, "Klinik incelemesi bekliyor").first().getByRole("link")).toHaveAttribute("href", /\/clinic\/alerts\//);
      await capture(page, "bildirim-merkezi");
    });

    await test.step("Filter and toggle read state, then verify portal and tenant isolation", async () => {
      await page.getByLabel("Tür", { exact: true }).selectOption("checkin_received");
      await page.getByLabel("Öncelik", { exact: true }).selectOption("normal");
      await page.getByLabel("Başlangıç tarihi", { exact: true }).fill(wallDate(new Date(), "Europe/Istanbul"));
      await page.getByRole("button", { name: "Filtrele" }).click();
      await expect(page).toHaveURL(/kind=checkin_received/);
      const checkin = card(page, "Danışan check-in bildirimi");
      await expect(page.getByRole("list", { name: "Bildirimler" }).getByRole("listitem")).toHaveCount(1);
      await expect(checkin).toHaveAttribute("data-unread", "true");
      await checkin.getByRole("button", { name: "Okundu işaretle" }).click();
      await expect(checkin).toHaveAttribute("data-unread", "false");
      await checkin.getByRole("button", { name: "Okunmadı işaretle" }).click();
      await expect(checkin).toHaveAttribute("data-unread", "true");
      await page.getByRole("button", { name: "Tümünü okundu işaretle" }).click();
      await expect(bell(page)).toHaveAccessibleName("Bildirimler, 0 okunmamış");
      await page.getByLabel("Okunmamış", { exact: true }).check();
      await page.getByRole("button", { name: "Filtrele" }).click();
      await expect(page.getByRole("heading", { name: "Bildirim bulunamadı" })).toBeVisible();
      await visitor.goto(inbox);
      await expect(visitor).toHaveURL(/\/login$/);
      await login(visitor, "beta-owner@example.test");
      await visitor.goto(inbox);
      await expect(visitor.getByRole("heading", { name: "Danışan check-in bildirimi" })).toHaveCount(0);
      await visitor.goto(appointmentPath);
      await expect(visitor.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    });
  } finally {
    await Promise.all([guestContext.close(), db.end()]);
  }
});
