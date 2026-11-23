import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { addDays, dateLabel, wallDate } from "../../lib/appointments/calendar";
import { isolatedNotificationDatabase } from "../../lib/notifications/local-mail.mjs";

const root = "/clinic/reports";
const origin = "http://localhost:3000";
const alpha = "00000000-0000-4000-8000-0000000000a1";
const beta = "00000000-0000-4000-8000-0000000000b1";
const procedure = "00000000-0000-4000-8000-00000000d101";
const procedureTwo = "00000000-0000-4000-8000-00000000d102";
const today = () => wallDate(new Date(), "Europe/Istanbul");
test.use({ locale: "tr-TR", trace: "off", screenshot: "off", video: "off", navigationTimeout: 20_000, actionTimeout: 12_000 });

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  const password = process.env.E2E_LOCAL_TEST_PASSWORD;
  if (!password) throw new Error("Missing isolated seed fixture");
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function capture(page: Page, prefix: string) {
  const directory = process.env.PHASE15_SCREENSHOTS_DIR;
  if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  await expect(page.getByRole("heading", { name: "Dönem performansı", exact: true })).toBeVisible();
  await expect(page.locator("[data-metric] .report-value")).toHaveCount(8);
  await expect(page.getByText("Operasyon verileri hazırlanıyor…", { exact: true })).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  for (const [label, width, height] of [["desktop",1440,960],["tablet",768,1024],["mobile",390,844]] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.getByRole("heading",{ name: "Raporlar ve Analitik" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), prefix).toBeLessThanOrEqual(width);
    if (directory) await page.screenshot({ path: join(directory, prefix + "-" + label + ".png"), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function fixture(db: pg.Pool, day: string) {
  const { rows: [people] } = await db.query<{ owner: string; staff: string; beta: string }>(
    `select (select id from public.organization_memberships where user_id='00000000-0000-4000-8000-00000000a101') as owner,
      (select id from public.organization_memberships where user_id='00000000-0000-4000-8000-00000000a103') as staff,
      (select id from public.organization_memberships where user_id='00000000-0000-4000-8000-00000000b101') as beta`);
  await db.query(`insert into public.appointments(organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone,notes)
    select $1,'00000000-0000-4000-8000-00000000c101',case when n%5=0 or n%7=0 then $6::uuid else $2::uuid end,
      case when n%3=0 then $3::uuid else $4::uuid end, case when n%4=0 then 'online_demo' else 'clinic' end,
      case when n%9=0 then 'follow_up' else 'procedure' end,
      (array['completed','cancelled','no_show','pending','confirmed','completed','completed'])[1+n%7],
      begins,begins+interval '20 minutes','Europe/Istanbul','SYNTHETIC-PRIVATE-NOTE'
    from generate_series(0,69) n
    cross join lateral (select ((($5::date-n%14)+time '08:00')+((n/14)*96+(n%3)*15)*interval '1 minute') at time zone 'Europe/Istanbul' begins) x`,
    [alpha,procedure,people.owner,people.staff,day,procedureTwo]);
  await db.query(`insert into public.appointments(organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone)
    values($1,'00000000-0000-4000-8000-00000000c201','00000000-0000-4000-8000-00000000d201',$2,'clinic','procedure','completed',
      $3::date+time '09:00',$3::date+time '09:30','Europe/Istanbul')`, [beta,people.beta,day]);
  await db.query(`insert into public.appointments(organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone)
    values($1,'00000000-0000-4000-8000-00000000c101',$2,$3,'clinic','follow_up','confirmed',
      ($4::date+2+time '11:00') at time zone 'Europe/Istanbul',($4::date+2+time '11:30') at time zone 'Europe/Istanbul','Europe/Istanbul')`,
    [alpha,procedureTwo,people.staff,day]);
  return people;
}

test("clinic care activity reaches accurate reports and aggregate CSV while another tenant is denied", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const url = process.env.TEST_DATABASE_URL;
  if (!isolatedNotificationDatabase(url, readFileSync("supabase/config.toml","utf8"))) {
    throw new Error("Use the verified analytics runner");
  }
  const db = new pg.Pool({ connectionString: url });
  const guest = await browser.newContext({ baseURL: origin });
  const visitor = await guest.newPage();
  const day = today();
  const first = addDays(day, -6);
  const metric = (name: string) => page.locator(`[data-metric="${name}"] .report-value`);
  const opts = { headers: { origin } };
  const current = new Intl.NumberFormat("tr-TR");

  try {
    const people = await fixture(db, day);
    await page.setViewportSize({ width: 1440, height: 960 });
    await test.step("Create a care plan for the selected synthetic practitioner and record portal activity", async () => {
      await login(page,"alpha-owner@example.test");
      await page.goto("/clinic/plans/new");
      await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
      await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
      await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
      await page.getByLabel("Sorumlu çalışan").selectOption(people.staff);
      await page.getByLabel("Başlangıç tarihi").fill(day);
      await page.getByRole("button", { name: "Plan oluştur" }).click();
      await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
      const planId = new URL(page.url()).pathname.split("/").at(-1);
      const planDay = await db.query<{ id:string }>("select id from public.care_plan_days where care_plan_id=$1 order by day_number limit 1",[planId]);
      await page.getByLabel("Plan günü").selectOption(planDay.rows[0].id);
      await page.getByLabel("Talep açıklaması").fill("Sentetik analitik fotoğraf talebi");
      await page.getByRole("button", { name: "Talep oluştur" }).click();
      await expect(page.getByText("Fotoğraf talebi oluşturuldu.")).toBeVisible();
      await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
      const link = await page.getByTestId("plain-secure-link").textContent();
      if (!link) throw new Error("Synthetic portal link unavailable");
      await visitor.goto(link);
      await expect(visitor).toHaveURL(/\/care\/session$/);
      const task = visitor.getByRole("button",{ name: "Tamamlandı olarak işaretle", exact: true }).first();
      await task.focus();
      await visitor.keyboard.press("Enter");
      await expect(visitor.getByRole("button",{ name: "Geri al", exact: true }).first()).toBeVisible();
      await visitor.getByLabel("Klinik değerlendirmesi için temsili durum").check();
      await visitor.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi").selectOption("5");
      await visitor.getByRole("button", { name: "Kliniğe gönder" }).click();
      await expect(visitor.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();
      await visitor.getByLabel("Fotoğraf seç").setInputFiles({
        name: "synthetic.png", mimeType: "image/png",
        buffer: await sharp({ create: { width: 48, height: 48, channels: 3, background: "#92aa96" } }).png().toBuffer(),
      });
      await visitor.getByRole("button", { name: "Güvenli şekilde yükle" }).click();
      await expect(visitor.getByText("Fotoğrafınız güvenli şekilde iletildi")).toBeVisible();
      const evidence = await db.query(`select
        (select count(*)::int from public.care_plan_tasks t join public.care_plan_days d on d.id=t.care_plan_day_id
          where d.care_plan_id=$1 and t.status='completed') as tasks,
        (select count(*)::int from public.symptom_reports where care_plan_id=$1) as checkins,
        (select count(*)::int from public.alerts where care_plan_id=$1 and status='open') as alerts,
        (select count(*)::int from public.photo_records where care_plan_id=$1 and processing_status='ready') as photos`,[planId]);
      expect(evidence.rows).toEqual([{ tasks: 1, checkins: 1, alerts: 1, photos: 1 }]);
    });

    await test.step("Compare scoped cards, the daily trend, equal prior range and the downloaded report with independent SQL", async () => {
      await page.getByRole("link",{ name: "Raporlar ve Analitik", exact: true }).click();
      await expect(page.getByRole("heading",{ name: "Raporlar ve Analitik" })).toBeVisible();
      const period = page.getByLabel("Dönem", { exact:true });
      await period.focus();
      await expect(period).toBeFocused();
      await period.selectOption("custom");
      await page.getByLabel("Özel başlangıç").fill(first);
      await page.getByLabel("Özel bitiş").fill(day);
      await page.getByLabel("Grafik aralığı").selectOption("day");
      await page.getByLabel("Uzman", { exact: true }).selectOption(people.staff);
      await page.getByRole("button", { name: "Uygula" }).click();
      await expect(page).toHaveURL(/preset=custom/);
      await expect(page.getByTestId("report-comparison")).toContainText(dateLabel(addDays(first,-7)));

      const query = `select (starts_at at time zone 'Europe/Istanbul')::date::text as day,count(*)::int as n
        from public.appointments where organization_id=$1 and membership_id=$2
        and starts_at >= $3::date::timestamp at time zone 'Europe/Istanbul'
        and starts_at < ($4::date+1)::timestamp at time zone 'Europe/Istanbul' group by 1 order by 1`;
      const [{ rows: daily }, { rows: prior }] = await Promise.all([
        db.query<{ day: string; n: number }>(query, [alpha,people.staff,first,day]),
        db.query<{ day: string; n: number }>(query,[alpha,people.staff,addDays(first,-7),addDays(first,-1)]),
      ]);
      const total = daily.reduce((sum,row) => sum + row.n,0);
      const previous = prior.reduce((sum,row) => sum + row.n,0);
      await expect(metric("appointments")).toHaveText(current.format(total));
      await expect(page.locator('[data-metric="taskAdherence"] .report-fraction')).toHaveText("1 / 2");
      await expect(page.locator('[data-metric="checkinAdherence"] .report-fraction')).toHaveText("1 / 2");
      await expect(page.getByRole("heading", { name: "İnceleme bekleyen bildirim", exact: true }).locator(".."))
        .toContainText("1");
      await expect(page.getByRole("heading", { name: "Yaklaşan kontrol", exact: true }).locator("..")).toContainText("1");
      await expect(page.getByRole("heading", { name: "Fotoğraf talepleri", exact: true }).locator("..")
        .getByRole("listitem").filter({ hasText: "Tamamlandı" })).toHaveText("Tamamlandı1");
      await page.getByText("Grafiğin verilerini tablo olarak göster", { exact: true }).click();
      for (const row of daily) await expect(page.getByRole("row", { name: new RegExp(dateLabel(row.day)) }).getByRole("cell").first())
        .toHaveText(String(row.n));

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "CSV indir" }).click(),
      ]);
      const stream = await download.createReadStream();
      const pieces: Buffer[] = [];
      for await (const chunk of stream) pieces.push(Buffer.from(chunk));
      const csv = Buffer.concat(pieces).toString("utf8");
      expect(download.suggestedFilename()).toBe(`aftercare-operasyon-${first}-${day}.csv`);
      expect(csv).toContain(`"Dönem","Toplam randevu",${total},${previous}`);
      for (const row of daily) expect(csv).toContain(`"Randevu trendi","${row.day}",${row.n}`);
      expect(csv).not.toMatch(/Synthetic Alpha|example\.test|SYNTHETIC-PRIVATE-NOTE|00000000-/);
      expect(await db.query("select member_filter from analytics_private.csv_exports where organization_id=$1",[alpha]))
        .toMatchObject({ rows: [{ member_filter: true }] });
      await page.getByLabel("İşlem", { exact: true }).selectOption(procedureTwo);
      await page.getByLabel("Randevu durumu").selectOption("completed");
      await page.getByLabel("Grafik aralığı").selectOption("month");
      await page.getByRole("button", { name: "Uygula" }).click();
      await expect(page).toHaveURL(/bucket=month/);
      const outcome = await db.query<{ n:number }>(
        `select count(*)::int as n from public.appointments where organization_id=$1 and membership_id=$2
          and procedure_id=$3 and status='completed' and starts_at >= $4::date::timestamp at time zone 'Europe/Istanbul'
          and starts_at < ($5::date+1)::timestamp at time zone 'Europe/Istanbul'`, [alpha,people.staff,procedureTwo,first,day]);
      expect(outcome.rows[0].n).toBeGreaterThan(0);
      await expect(metric("appointments")).toHaveText(current.format(outcome.rows[0].n));
    });

    await test.step("Verify responsive and printable states, blank reports, and permission enforcement", async () => {
      await page.getByRole("link", { name: "Filtreleri sıfırla" }).click();
      await expect(page).toHaveURL(/\/clinic\/reports$/);
      await capture(page,"analitik-dolu");
      await page.emulateMedia({ media: "print" });
      await expect(page.getByRole("button", { name: "CSV indir" })).toBeHidden();
      await expect(page.getByRole("heading", { name: "Dönem performansı" })).toBeVisible();
      await page.emulateMedia({ media: "screen" });

      await page.goto(root + "?preset=custom&from=2001-01-01&to=2001-01-07");
      await expect(page.getByRole("heading", { name: "Bu dönemde kayıt bulunamadı" })).toBeVisible();
      await expect(metric("taskAdherence")).toHaveText("—");
      await capture(page,"analitik-bos");

      await visitor.goto(root);
      await expect(visitor).toHaveURL(/\/login$/);
      await login(visitor,"beta-owner@example.test");
      await visitor.goto(root + "?preset=7");
      await expect(visitor.locator('[data-metric="appointments"] .report-value')).toHaveText("1");
      await visitor.goto(root + "?member=" + people.staff);
      await expect(visitor).toHaveURL(/\/unauthorized$/);
      expect((await visitor.request.post(root + "/csv?member=" + people.staff, opts)).status()).toBe(403);

      await login(page,"alpha-staff@example.test");
      await page.goto(root);
      await expect(page.getByText("Uzman kapsamı · Atamalarım")).toBeVisible();
      await expect(page.getByRole("button", { name: "CSV indir" })).toHaveCount(0);
      expect((await page.request.post(root + "/csv", opts)).status()).toBe(403);
    });
  } finally {
    await Promise.all([guest.close(),db.end()]);
  }
});
