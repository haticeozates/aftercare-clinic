import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaActivePlan: "00000000-0000-4000-8000-00000000e101",
  alphaStoppedPlan: "00000000-0000-4000-8000-00000000e104",
  alphaActiveLink: "00000000-0000-4000-8000-00000000a911",
  alphaTemplateDay: "00000000-0000-4000-8000-00000000a601",
  betaTemplateDay: "00000000-0000-4000-8000-00000000b601",
  alphaOwner: "00000000-0000-4000-8000-00000000a101",
  betaOwner: "00000000-0000-4000-8000-00000000b101"
};

function readLocalEnv() {
  const fileEnv: Record<string, string> = {};
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        fileEnv[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }

  return {
    databaseUrl: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY ?? "",
    auditPepper: process.env.AUDIT_LOG_PEPPER ?? fileEnv.AUDIT_LOG_PEPPER ?? "test-audit-pepper-at-least-32-characters-long"
  };
}

function hashPortalSession(rawToken: string) {
  return crypto.createHash("sha256").update(`${rawToken}.${readLocalEnv().auditPepper}`).digest("hex");
}

async function connect() {
  const client = new Client({ connectionString: readLocalEnv().databaseUrl });
  await client.connect();
  return client;
}

async function createPlanDay(input: {
  db: Client;
  organizationId: string;
  carePlanId: string;
  sourceTemplateDayId: string;
  scheduledDateSql: string;
}) {
  const id = crypto.randomUUID();
  const dayNumber = Math.floor(10_000 + Math.random() * 1_000_000);
  await input.db.query("begin");
  await input.db.query("select set_config('app.creating_care_plan_snapshot', 'on', true)");
  await input.db.query(
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
      values ($1, $2, $3, $4, $5, ${input.scheduledDateSql}, 'Temsili fotoğraf günü', 'available')
    `,
    [id, input.organizationId, input.carePlanId, input.sourceTemplateDayId, dayNumber]
  );
  await input.db.query("commit");
  return id;
}

async function createCarePlanFromSeed(input: { db: Client; sourcePlanId: string; organizationId: string; status?: "active" | "completed" | "stopped" }) {
  const id = crypto.randomUUID();
  await input.db.query(
    `
      insert into public.care_plans (
        id,
        organization_id,
        client_id,
        procedure_id,
        care_template_id,
        template_version_id,
        responsible_membership_id,
        status,
        start_date,
        end_date,
        stopped_at,
        stopped_by_user_id,
        created_by_user_id,
        created_at
      )
      select
        $1,
        organization_id,
        client_id,
        procedure_id,
        care_template_id,
        template_version_id,
        responsible_membership_id,
        $3,
        current_date,
        current_date + 2,
        case when $3 = 'stopped' then now() else null end,
        case when $3 = 'stopped' then created_by_user_id else null end,
        created_by_user_id,
        now()
      from public.care_plans
      where id = $2 and organization_id = $4
    `,
    [id, input.sourcePlanId, input.status ?? "active", input.organizationId]
  );
  return id;
}

async function createSecureLinkForPlan(input: { db: Client; organizationId: string; carePlanId: string; createdByUserId: string }) {
  const id = crypto.randomUUID();
  await input.db.query(
    `
      insert into public.secure_links (
        id,
        organization_id,
        care_plan_id,
        token_hash,
        token_prefix,
        status,
        expires_at,
        created_by_user_id
      )
      values ($1, $2, $3, $4, 'p7u', 'active', now() + interval '1 day', $5)
    `,
    [id, input.organizationId, input.carePlanId, `phase7-ui-link-${crypto.randomUUID()}`, input.createdByUserId]
  );
  return id;
}

async function createPortalSession(input: {
  db: Client;
  carePlanId: string;
  organizationId?: string;
  secureLinkId?: string;
  status?: "active" | "revoked";
}) {
  const rawToken = `phase7-ui-session-${crypto.randomUUID()}`;
  await input.db.query(
    `
      insert into public.portal_sessions (
        organization_id,
        secure_link_id,
        care_plan_id,
        session_hash,
        status,
        expires_at,
        created_at
      )
      values ($1, $2, $3, $4, $5, now() + interval '20 minutes', now())
    `,
    [input.organizationId ?? ids.alphaOrg, input.secureLinkId ?? ids.alphaActiveLink, input.carePlanId, hashPortalSession(rawToken), input.status ?? "active"]
  );
  return rawToken;
}

async function createPhotoRequest(input: {
  db: Client;
  organizationId: string;
  carePlanId: string;
  carePlanDayId: string;
  createdByUserId: string;
  status?: "active" | "cancelled";
}) {
  const id = crypto.randomUUID();
  await input.db.query(
    `
      insert into public.photo_requests (
        id,
        organization_id,
        care_plan_id,
        care_plan_day_id,
        label,
        required,
        status,
        created_by_user_id,
        cancelled_at,
        cancelled_by_user_id,
        created_at
      )
      values ($1, $2, $3, $4, 'Temsili fotoğraf talebi', true, $5, $6,
        case when $5 = 'cancelled' then now() else null end,
        case when $5 = 'cancelled' then $6::uuid else null end,
        now())
    `,
    [id, input.organizationId, input.carePlanId, input.carePlanDayId, input.status ?? "active", input.createdByUserId]
  );
  return id;
}

async function seedActivePortalPhotoRequest() {
  const db = await connect();
  const carePlanId = await createCarePlanFromSeed({
    db,
    sourcePlanId: ids.alphaActivePlan,
    organizationId: ids.alphaOrg,
    status: "active"
  });
  const secureLinkId = await createSecureLinkForPlan({
    db,
    organizationId: ids.alphaOrg,
    carePlanId,
    createdByUserId: ids.alphaOwner
  });
  const dayId = await createPlanDay({
    db,
    organizationId: ids.alphaOrg,
    carePlanId,
    sourceTemplateDayId: ids.alphaTemplateDay,
    scheduledDateSql: "current_date"
  });
  const requestId = await createPhotoRequest({
    db,
    organizationId: ids.alphaOrg,
    carePlanId,
    carePlanDayId: dayId,
    createdByUserId: ids.alphaOwner
  });
  const rawSession = await createPortalSession({ db, carePlanId, secureLinkId });
  await db.end();
  return { rawSession, requestId };
}

async function syntheticPng() {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 3,
      background: "#dff5ef"
    }
  })
    .png()
    .toBuffer();
}

test("portal user uploads a requested photo through the real signed upload UI", async ({ page, context }) => {
  const { rawSession, requestId } = await seedActivePortalPhotoRequest();
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));
  await context.addCookies([{ name: "aftercare_portal_session", value: rawSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/care/session");
  await expect(page.getByRole("heading", { name: "Fotoğraf talebi", exact: true })).toBeVisible();
  await expect(page.getByText("Temsili fotoğraf talebi")).toBeVisible();
  await expect(page.getByText("JPEG, PNG ve WebP")).toBeVisible();

  await page.getByLabel("Fotoğraf seç").setInputFiles({
    name: "not-persisted.png",
    mimeType: "image/png",
    buffer: await syntheticPng()
  });
  await expect(page.getByText("Seçilen fotoğraf")).toBeVisible();
  await page.getByRole("button", { name: "Güvenli şekilde yükle" }).click();
  await expect(page.getByText("Fotoğrafınız güvenli şekilde iletildi")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Fotoğrafınız güvenli şekilde iletildi")).toBeVisible();

  const db = await connect();
  const records = await db.query<{ count: number; verified_mime_type: string }>(
    "select count(*)::int as count, max(verified_mime_type) as verified_mime_type from public.photo_records where photo_request_id = $1",
    [requestId]
  );
  expect(records.rows[0]).toEqual({ count: 1, verified_mime_type: "image/webp" });
  await db.end();

  const storageState = await page.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage)
  }));
  expect(storageState.local + storageState.session).not.toMatch(/incoming\/|signed|token|care-photo/i);
  expect(messages.join("\n")).not.toMatch(/incoming\/|care-photo|token|aftercare_portal_session|SUPABASE_SERVICE_ROLE/i);
});

test("portal photo upload blocks unsafe selections before requesting credentials", async ({ page, context }) => {
  const { rawSession } = await seedActivePortalPhotoRequest();
  await context.addCookies([{ name: "aftercare_portal_session", value: rawSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");

  await page.getByLabel("Fotoğraf seç").setInputFiles({
    name: "unsupported.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("not-an-image")
  });
  await expect(page.getByText("Bu dosya desteklenen fotoğraf formatlarından biri değil.")).toBeVisible();
});

test("cancelled and stopped photo requests cannot start upload from the portal", async ({ page, context }) => {
  const db = await connect();
  const activePlanId = await createCarePlanFromSeed({
    db,
    sourcePlanId: ids.alphaActivePlan,
    organizationId: ids.alphaOrg,
    status: "active"
  });
  const activeLinkId = await createSecureLinkForPlan({
    db,
    organizationId: ids.alphaOrg,
    carePlanId: activePlanId,
    createdByUserId: ids.alphaOwner
  });
  const cancelledDay = await createPlanDay({
    db,
    organizationId: ids.alphaOrg,
    carePlanId: activePlanId,
    sourceTemplateDayId: ids.alphaTemplateDay,
    scheduledDateSql: "current_date"
  });
  await createPhotoRequest({
    db,
    organizationId: ids.alphaOrg,
    carePlanId: activePlanId,
    carePlanDayId: cancelledDay,
    createdByUserId: ids.alphaOwner,
    status: "cancelled"
  });
  const cancelledSession = await createPortalSession({ db, carePlanId: activePlanId, secureLinkId: activeLinkId });
  const stoppedPlanId = await createCarePlanFromSeed({
    db,
    sourcePlanId: ids.alphaActivePlan,
    organizationId: ids.alphaOrg,
    status: "stopped"
  });
  const stoppedLinkId = await createSecureLinkForPlan({
    db,
    organizationId: ids.alphaOrg,
    carePlanId: stoppedPlanId,
    createdByUserId: ids.alphaOwner
  });
  const stoppedSession = await createPortalSession({ db, carePlanId: stoppedPlanId, secureLinkId: stoppedLinkId });
  await db.end();

  await context.addCookies([{ name: "aftercare_portal_session", value: cancelledSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page.getByRole("heading", { name: "Fotoğraf talebi", exact: true })).toHaveCount(0);

  await context.clearCookies();
  await context.addCookies([{ name: "aftercare_portal_session", value: stoppedSession, domain: "localhost", path: "/care", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});
