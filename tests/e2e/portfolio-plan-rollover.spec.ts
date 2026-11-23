import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { futureIstanbulDate } from "./helpers/plan-dates";

test("clinic and portal agree when the Istanbul date arrives before SQL activation", async ({ page, browser, baseURL }) => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!databaseUrl || !apiUrl) throw new Error("Explicit local test endpoints are required");
  for (const endpoint of [databaseUrl, apiUrl]) {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(endpoint).hostname)) {
      throw new Error("Rollover fixture requires loopback endpoints");
    }
  }
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const portalContext = await browser.newContext({ baseURL });
  try {
    await page.goto("/login");
    await page.getByLabel("E-posta").fill("alpha-owner@example.test");
    await page.getByLabel("Parola").fill(process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/\/clinic$/);

    await page.goto("/clinic/plans/new");
    await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
    await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
    await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
    const tomorrow = futureIstanbulDate(1);
    await page.getByLabel("Başlangıç tarihi").fill(tomorrow);
    await page.getByRole("button", { name: "Plan oluştur" }).click();
    await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]{36}$/);
    const path = new URL(page.url()).pathname;
    const id = path.split("/").at(-1);
    await expect(page.getByText("Planlandı", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
    const link = page.getByTestId("plain-secure-link");
    await expect(link).toHaveText(/^\/care\/t\//);

    const portal = await portalContext.newPage();
    await portal.goto((await link.innerText()).trim());
    await expect(portal.getByText("Planınız henüz başlamadı.")).toBeVisible();
    await expect(portal.getByRole("button", { name: "Kilitli" }).first()).toBeDisabled();

    // Change only the synthetic plan this test just created to exercise the midnight boundary.
    await db.query("begin");
    try {
      await db.query("select set_config('app.creating_care_plan_snapshot', 'on', true)");
      const updated = await db.query(
        `update public.care_plans set start_date = public.portal_today(), end_date = public.portal_today()
         where id = $1 and status = 'scheduled' and start_date = $2::date
           and created_at > now() - interval '5 minutes'`,
        [id, tomorrow]
      );
      expect(updated.rowCount).toBe(1);
      const days = await db.query(
        `update public.care_plan_days set scheduled_date = public.portal_today()
         where care_plan_id = $1 and scheduled_date = $2::date`,
        [id, tomorrow]
      );
      expect(days.rowCount).toBe(1);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }

    const storedStatus = async () => (await db.query("select status from public.care_plans where id = $1", [id])).rows[0]?.status;
    await page.goto("/clinic/plans?status=scheduled");
    await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
    await page.goto("/clinic/plans?status=active");
    await expect(page.locator(`a[href="${path}"]`)).toBeVisible();
    await page.goto(path);
    await expect(page.getByText("Aktif", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toBeVisible();
    expect(await storedStatus()).toBe("scheduled");

    await portal.reload();
    await expect(portal.getByText("Planınız henüz başlamadı.")).toHaveCount(0);
    await expect(portal.getByRole("button", { name: "Tamamlandı olarak işaretle" })).toBeEnabled();
    await expect(portal.getByRole("heading", { name: "Bugünkü durumunuzu kliniğinizle paylaşın" })).toBeVisible();
    expect(await storedStatus()).toBe("active");
  } finally {
    await portalContext.close();
    await db.end();
  }
});
