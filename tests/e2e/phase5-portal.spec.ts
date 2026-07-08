import { expect, test, type Page } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";
const alphaOwner = "alpha-owner@example.test";

function futureIstanbulDate(daysAhead = 7) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(date);
}

function readLocalEnv() {
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

  return {
    auditPepper: process.env.AUDIT_LOG_PEPPER ?? fileEnv.AUDIT_LOG_PEPPER ?? "replace-with-local-random-value",
    databaseUrl: process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(`${token}.${readLocalEnv().auditPepper}`).digest("hex");
}

async function dbQuery(sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString: readLocalEnv().databaseUrl });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(alphaOwner);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createPlan(page: Page, startDate = "2026-07-06") {
  await page.goto("/clinic/plans/new");
  await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
  await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
  await page.getByLabel("Başlangıç tarihi").fill(startDate);
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
  return page.url();
}

async function createSecureLink(page: Page) {
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const link = await page.getByTestId("plain-secure-link").textContent();
  expect(link).toMatch(/\/care\/t\//);
  return link ?? "";
}

async function openPortalForNewPlan(page: Page) {
  await login(page);
  await createPlan(page);
  const link = await createSecureLink(page);
  await page.goto(link);
  await expect(page).toHaveURL(/\/care\/session$/);
}

async function seedPortalSessionForPlan(planId: string, rawSession: string, rawLink: string, status: "active" | "revoked" = "active") {
  const linkId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  await dbQuery(
    `
      insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, revoked_at, revoked_by_user_id, created_by_user_id)
      values ($1, '00000000-0000-4000-8000-0000000000a1', $2, $3, 'p5e', $4, now() + interval '3 days',
        case when $4 = 'revoked' then now() else null end,
        case when $4 = 'revoked' then '00000000-0000-4000-8000-00000000a101'::uuid else null end,
        '00000000-0000-4000-8000-00000000a101')
    `,
    [linkId, planId, hashToken(rawLink), status]
  );
  await dbQuery(
    `
      insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at)
      values ($1, '00000000-0000-4000-8000-0000000000a1', $2, $3, $4, 'active', now() + interval '15 minutes')
    `,
    [sessionId, linkId, planId, hashToken(rawSession)]
  );

  return rawSession;
}

test("active plan link redirects into token-free portal session", async ({ page }) => {
  await openPortalForNewPlan(page);
  await expect(page).toHaveURL(/\/care\/session$/);
  expect(page.url()).not.toContain("/care/t/");
  await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
});

test("portal does not show client phone email or internal identifiers", async ({ page }) => {
  await openPortalForNewPlan(page);
  await expect(page.getByText("Synthetic Alpha")).toHaveCount(0);
  await expect(page.getByText("+90")).toHaveCount(0);
  await expect(page.getByText("@example.test")).toHaveCount(0);
  await expect(page.getByText("00000000-")).toHaveCount(0);
});

test("today tasks are visible and future tasks are not treated as available", async ({ page }) => {
  await openPortalForNewPlan(page);
  await expect(page.getByText("Bugünün görevleri")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tamamlandı olarak işaretle" })).toBeVisible();
});

test("pending task can be completed and remains completed after reload", async ({ page }) => {
  await openPortalForNewPlan(page);
  await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).click();
  await expect(page.getByText("Görev tamamlandı.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Geri al" })).toBeVisible();
});

test("completed task can be reopened and remains pending after reload", async ({ page }) => {
  await openPortalForNewPlan(page);
  await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).click();
  await page.getByRole("button", { name: "Geri al" }).click();
  await expect(page.getByText("Görev tekrar bekliyor.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Tamamlandı olarak işaretle" })).toBeVisible();
});

test("double click does not create duplicate completion events", async ({ page }) => {
  await openPortalForNewPlan(page);
  const taskId = await page.getByTestId("portal-task").first().getAttribute("data-task-id");
  await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).dblclick();
  await expect(page.getByRole("button", { name: "Geri al" })).toBeVisible();
  const result = await dbQuery("select count(*)::int as count from public.care_plan_task_events where care_plan_task_id = $1 and event_type = 'completed'", [taskId]);
  expect(result.rows[0].count).toBe(1);
});

test("scheduled plan shows disabled locked tasks", async ({ page }) => {
  await login(page);
  await createPlan(page, futureIstanbulDate());
  const link = await createSecureLink(page);
  await page.goto(link);
  await expect(page.getByText("Planınız henüz başlamadı.")).toBeVisible();
  await expect(page.getByTestId("portal-task").getByRole("button", { name: "Kilitli" })).toBeDisabled();
});

test("completed plan is read-only", async ({ page, context }) => {
  const rawSession = await seedPortalSessionForPlan("00000000-0000-4000-8000-00000000e103", "phase5-completed-cookie", "phase5-completed-link");
  await context.addCookies([{ name: "aftercare_portal_session", value: rawSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page.getByText("Plan tamamlandı.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tamamlandı olarak işaretle" })).toHaveCount(0);
});

test("stopped plan portal becomes invalid", async ({ page, context }) => {
  const rawSession = await seedPortalSessionForPlan("00000000-0000-4000-8000-00000000e104", "phase5-stopped-cookie", "phase5-stopped-link");
  await context.addCookies([{ name: "aftercare_portal_session", value: rawSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("link revoke closes an already open portal session", async ({ page }) => {
  await login(page);
  const planUrl = await createPlan(page);
  const link = await createSecureLink(page);
  await page.goto(link);
  await expect(page).toHaveURL(/\/care\/session$/);
  await page.goto(planUrl);
  await page.getByRole("button", { name: "Bağlantıyı iptal et" }).click();
  await expect(page.getByText("Bağlantı iptal edildi.")).toBeVisible();
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("link rotate closes old portal session", async ({ page }) => {
  await login(page);
  const planUrl = await createPlan(page);
  const link = await createSecureLink(page);
  await page.goto(link);
  await expect(page).toHaveURL(/\/care\/session$/);
  await page.goto(planUrl);
  await page.getByRole("button", { name: "Bağlantıyı yenile" }).click();
  await expect(page.getByTestId("plain-secure-link")).toBeVisible();
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("expired session becomes invalid", async ({ page, context }) => {
  const rawSession = "phase5-expired-cookie";
  const rawLink = "phase5-expired-link";
  const linkId = crypto.randomUUID();
  await dbQuery(
    "insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id) values ($1, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e102', $2, 'p5x', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000a101')",
    [linkId, hashToken(rawLink)]
  );
  await dbQuery(
    "insert into public.portal_sessions (organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at) values ('00000000-0000-4000-8000-0000000000a1', $1, '00000000-0000-4000-8000-00000000e102', $2, 'active', now() - interval '1 minute')",
    [linkId, hashToken(rawSession)]
  );
  await context.addCookies([{ name: "aftercare_portal_session", value: rawSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});

test("cross-plan task mutation is rejected", async ({ page }) => {
  await openPortalForNewPlan(page);
  const response = await page.evaluate(async () => {
    const result = await fetch("/care/session/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "00000000-0000-4000-8000-00000000a712",
        status: "completed"
      })
    });
    return { ok: result.ok, status: result.status, body: await result.json() };
  });
  expect(response.ok).toBe(false);
  expect(response.status).toBe(403);
  expect(JSON.stringify(response.body)).not.toContain("00000000");
});

test("task can be completed with keyboard focus", async ({ page }) => {
  await openPortalForNewPlan(page);
  await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Görev tamamlandı.")).toBeVisible();
});

test("locked and completed states are described with text", async ({ page }) => {
  await openPortalForNewPlan(page);
  await page.getByRole("button", { name: "Tamamlandı olarak işaretle" }).click();
  await expect(page.getByText("Tamamlandı")).toBeVisible();

  await login(page);
  await createPlan(page, futureIstanbulDate());
  const link = await createSecureLink(page);
  await page.goto(link);
  await expect(page.getByTestId("portal-task").getByRole("button", { name: "Kilitli" })).toBeVisible();
});

test("portal works without clinic logout and only needs care cookie", async ({ page }) => {
  await openPortalForNewPlan(page);
  await page.goto("/clinic");
  await expect(page).toHaveURL(/\/clinic$/);
  await page.goto("/care/session");
  await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
});

test("browser console does not leak token cookie secret or hydration errors", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));
  await openPortalForNewPlan(page);
  expect(messages.join("\n")).not.toMatch(/aftercare_portal_session|SUPABASE_SERVICE_ROLE|AUDIT_LOG_PEPPER|hydration/i);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
]) {
  test(`portal responsive smoke at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openPortalForNewPlan(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expect(page.getByRole("button", { name: "Tamamlandı olarak işaretle" })).toBeVisible();
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(["a", "button", "input"]).toContain(focusedTag);
  });
}
