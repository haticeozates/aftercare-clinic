import { expect, test, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

type AppEnv = Record<string, string>;

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const env = loadEnvFile();
const databaseUrl = env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  scheduledPlan: "00000000-0000-4000-8000-00000000e102",
  activePlan: "00000000-0000-4000-8000-00000000e101",
  alphaTemplateDay: "00000000-0000-4000-8000-00000000a601"
};

function loadEnvFile(): AppEnv {
  const output: AppEnv = {};
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    output[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
  return output;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function createIsolatedPlanDay() {
  const db = await connect();
  const dayId = crypto.randomUUID();
  const dayNumber = Math.floor(20_000 + Math.random() * 1_000_000);
  try {
    await db.query("begin");
    await db.query("select set_config('app.creating_care_plan_snapshot', 'on', true)");
    await db.query(
      `
        insert into public.care_plan_days (
          id,
          organization_id,
          care_plan_id,
          source_template_day_id,
          day_number,
          scheduled_date,
          title,
          status
        )
        values ($1, $2, $3, $4, $5, current_date + 2, 'E2E fotoğraf talep günü', 'available')
      `,
      [dayId, ids.alphaOrg, ids.scheduledPlan, ids.alphaTemplateDay, dayNumber]
    );
    await db.query("commit");
    return dayId;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

test.describe("Phase 9B - Clinic photo request creation", () => {
  test("owner creates a photo request and staff cannot", async ({ page }) => {
    const label = `E2E temsili fotoğraf talebi ${Date.now()}`;
    const dayId = await createIsolatedPlanDay();

    await login(page, "alpha-owner@example.test");
    await page.goto(`/clinic/plans/${ids.scheduledPlan}`);

    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toBeVisible();
    await page.getByLabel("Plan günü").selectOption(dayId);
    await page.getByLabel("Talep açıklaması").fill(label);
    await page.getByRole("button", { name: "Talep oluştur" }).click();
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByText("Fotoğraf talebi oluşturuldu.")).toBeVisible();

    const db = await connect();
    try {
      const created = await db.query<{ id: string; status: string }>(
        `
          select id, status
          from public.photo_requests
          where care_plan_day_id = $1
            and label = $2
            and status = 'active'
        `,
        [dayId, label]
      );
      expect(created.rows).toHaveLength(1);

      const audit = await db.query<{ count: number }>(
        `
          select count(*)::int as count
          from public.audit_logs
          where action = 'photo_request.created'
            and entity_id = $1
            and result = 'success'
        `,
        [created.rows[0].id]
      );
      expect(audit.rows[0]?.count).toBeGreaterThan(0);
    } finally {
      await db.end();
    }

    await expect(page.locator("body")).not.toContainText("23505");
    await expect(page.locator("body")).not.toContainText("photo_requests_one_active_per_day");

    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await login(page, "alpha-staff@example.test");
    await page.goto(`/clinic/plans/${ids.activePlan}`);
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Talep oluştur" })).toHaveCount(0);
  });

  test("create form does not expose organization ids in the browser", async ({ page }) => {
    await login(page, "alpha-admin@example.test");
    await page.goto(`/clinic/plans/${ids.activePlan}`);
    await expect(page.getByRole("heading", { name: "Fotoğraf talebi oluştur" })).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(/name=["']organizationId["']/i);
    expect(html).not.toMatch(/name=["']organization_id["']/i);
    expect(html).not.toMatch(/name=["']clientId["']/i);
    expect(html).not.toMatch(/signedUrl|final_object_key|care-photos/i);
  });
});
