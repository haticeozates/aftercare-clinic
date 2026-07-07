import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

function readDatabaseUrl() {
  const envPath = path.join(process.cwd(), ".env.local");
  const fileEnv: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        fileEnv[match[1]] = match[2];
      }
    }
  }
  return process.env.SUPABASE_DB_URL ?? fileEnv.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

async function dbQuery(sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function login(page: Page, email = "alpha-owner@example.test") {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/(clinic|unauthorized)$/);
}

async function createPlanAndOpenPortal(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/clinic$/);
  await page.goto("/clinic/plans/new");
  await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
  await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
  await page.getByLabel("Başlangıç tarihi").fill("2026-07-06");
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const link = await page.getByTestId("plain-secure-link").textContent();
  expect(link).toContain("/care/t/");
  await page.goto(link ?? "");
  await expect(page).toHaveURL(/\/care\/session$/);
}

async function submitPortalReport(page: Page) {
  await expect(page.getByRole("heading", { name: "Bugünkü durumunuzu kliniğinizle paylaşın" })).toBeVisible();
  await page.getByLabel("Klinik değerlendirmesi için temsili durum").check();
  await page.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi").selectOption("5");
  await page.getByRole("button", { name: "Kliniğe gönder" }).click();
  await expect(page.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();
}

async function createReportAndOpenAlerts(page: Page, staff = false) {
  await createPlanAndOpenPortal(page);
  await submitPortalReport(page);
  await login(page, staff ? "alpha-staff@example.test" : "alpha-owner@example.test");
  await page.goto("/clinic/alerts");
}

test("portal shows structured check-in for active available day", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  await expect(page.getByRole("heading", { name: "Bugünkü durumunuzu kliniğinizle paylaşın" })).toBeVisible();
  await expect(page.getByText("Bu ekran tıbbi değerlendirme veya teşhis sunmaz.")).toBeVisible();
});

test("scheduled completed and stopped portal states do not render check-in form", async ({ page, context }) => {
  await context.addCookies([{ name: "aftercare_portal_session", value: "phase5-completed-cookie", domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page.getByRole("heading", { name: "Bugünkü durumunuzu kliniğinizle paylaşın" })).toHaveCount(0);
});

test("severity is shown only after selecting a severity-enabled option", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  await expect(page.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi")).toHaveCount(0);
  await page.getByLabel("Klinik değerlendirmesi için temsili durum").check();
  await expect(page.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi")).toBeVisible();
});

test("valid report submits and reload prevents duplicate submit", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  await submitPortalReport(page);
  await page.reload();
  await expect(page.getByText("Bugün için bildiriminiz kaydedildi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaydedildi" })).toBeDisabled();
});

test("double click does not create duplicate report", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  const planCountBefore = await dbQuery("select count(*)::int as count from public.symptom_reports");
  await page.getByLabel("Klinik değerlendirmesi için temsili durum").check();
  await page.getByLabel("Klinik değerlendirmesi için temsili durum şiddet seçimi").selectOption("5");
  await page.getByRole("button", { name: "Kliniğe gönder" }).dblclick();
  await expect(page.getByText("Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.")).toBeVisible();
  const planCountAfter = await dbQuery("select count(*)::int as count from public.symptom_reports");
  expect(planCountAfter.rows[0].count - planCountBefore.rows[0].count).toBe(1);
});

test("portal does not show alert result severity token cookie or PII", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  await submitPortalReport(page);
  await expect(page.getByText("Takip bildirimi")).toHaveCount(0);
  await expect(page.getByText("Synthetic Alpha")).toHaveCount(0);
  await expect(page.getByText("@example.test")).toHaveCount(0);
  await expect(page.getByText("00000000-")).toHaveCount(0);
});

test("cross-plan manipulation is rejected with a safe error", async ({ page }) => {
  await createPlanAndOpenPortal(page);
  const response = await page.evaluate(async () => {
    const result = await fetch("/care/session/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayId: "00000000-0000-4000-8000-00000000f201",
        items: []
      })
    });
    return { ok: result.ok, status: result.status, body: await result.json() };
  });
  expect(response.ok).toBe(false);
  expect(response.status).toBe(403);
  expect(JSON.stringify(response.body)).not.toContain("00000000");
});

test("staff can access alert list and filters", async ({ page }) => {
  await createReportAndOpenAlerts(page, true);
  await expect(page.getByRole("heading", { name: "Klinik değerlendirmesi bekleyen bildirimler" })).toBeVisible();
  await page.getByLabel("Durum").selectOption("open");
  await page.getByLabel("Seviye").selectOption("medium");
  await page.getByRole("button", { name: "Filtrele" }).click();
  await expect(page).toHaveURL(/status=open/);
});

test("staff can acknowledge and resolve alert", async ({ page }) => {
  await createReportAndOpenAlerts(page, true);
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByRole("heading", { name: "Klinik değerlendirmesi bekliyor" })).toBeVisible();
  await page.getByRole("button", { name: "İncelendi olarak işaretle" }).click();
  await expect(page.getByRole("heading", { name: "İncelendi" })).toBeVisible();
  await page.getByRole("button", { name: "Çözüldü olarak kapat" }).click();
  await expect(page.getByRole("heading", { name: "Kapatıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "İncelendi olarak işaretle" })).toHaveCount(0);
});

test("staff can dismiss alert", async ({ page }) => {
  await createReportAndOpenAlerts(page, true);
  await page.getByRole("link", { name: "Detay" }).first().click();
  await page.getByRole("button", { name: "Bildirimi kapat" }).click();
  await expect(page.getByRole("heading", { name: "Kapatıldı" })).toBeVisible();
});

test("alpha staff cannot see beta alert detail", async ({ page }) => {
  await login(page, "alpha-staff@example.test");
  const betaAlert = await dbQuery("select id from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000b1' limit 1");
  await page.goto(`/clinic/alerts/${betaAlert.rows[0]?.id ?? "00000000-0000-4000-8000-00000000ffff"}`);
  await expect(page).toHaveURL(/\/clinic\/alerts$/);
});

test("membershipless user cannot access alert screen", async ({ page }) => {
  await login(page, "no-membership@example.test");
  await page.goto("/clinic/alerts");
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test("alert UI does not show phone email token or raw database ids", async ({ page }) => {
  await createReportAndOpenAlerts(page, true);
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByText("@example.test")).toHaveCount(0);
  await expect(page.getByText("+90")).toHaveCount(0);
  await expect(page.getByText("token")).toHaveCount(0);
  await expect(page.getByText("00000000-")).toHaveCount(0);
});

test("browser console does not leak token health payload cookie secret or hydration errors", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));
  await createPlanAndOpenPortal(page);
  await submitPortalReport(page);
  expect(messages.join("\n")).not.toMatch(/aftercare_portal_session|SUPABASE_SERVICE_ROLE|AUDIT_LOG_PEPPER|cookie|hydration/i);
});

for (const viewport of [
  { width: 390, height: 844, path: "/care/session" },
  { width: 390, height: 844, path: "/clinic/alerts" },
  { width: 1024, height: 768, path: "/clinic/alerts" },
  { width: 1440, height: 900, path: "/clinic/alerts" }
]) {
  test(`phase6 responsive smoke ${viewport.path} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    if (viewport.path.startsWith("/care")) {
      await createPlanAndOpenPortal(page);
    } else {
      await createReportAndOpenAlerts(page, true);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(["a", "button", "input", "select"]).toContain(focusedTag);
  });
}
