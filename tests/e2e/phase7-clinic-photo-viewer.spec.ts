import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaActivePlan: "00000000-0000-4000-8000-00000000e101",
  betaActivePlan: "00000000-0000-4000-8000-00000000e201",
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
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createCarePlanFromSeed(input: { db: Client; sourcePlanId: string; organizationId: string }) {
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
        'active',
        current_date,
        current_date + 2,
        created_by_user_id,
        now()
      from public.care_plans
      where id = $2 and organization_id = $3
    `,
    [id, input.sourcePlanId, input.organizationId]
  );
  return id;
}

async function createPlanDay(input: { db: Client; organizationId: string; carePlanId: string; sourceTemplateDayId: string }) {
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
      values ($1, $2, $3, $4, $5, current_date, 'Temsili fotoğraf günü', 'available')
    `,
    [id, input.organizationId, input.carePlanId, input.sourceTemplateDayId, dayNumber]
  );
  await input.db.query("commit");
  return id;
}

async function createSecureLinkForPlan(input: { db: Client; organizationId: string; carePlanId: string; createdByUserId: string }) {
  const id = crypto.randomUUID();
  await input.db.query(
    `
      insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id)
      values ($1, $2, $3, $4, 'p7v', 'active', now() + interval '1 day', $5)
    `,
    [id, input.organizationId, input.carePlanId, `phase7-view-link-${crypto.randomUUID()}`, input.createdByUserId]
  );
  return id;
}

async function createPortalSession(input: { db: Client; organizationId: string; carePlanId: string; secureLinkId: string }) {
  const rawToken = `phase7-view-session-${crypto.randomUUID()}`;
  await input.db.query(
    `
      insert into public.portal_sessions (organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at, created_at)
      values ($1, $2, $3, $4, 'active', now() + interval '20 minutes', now())
    `,
    [input.organizationId, input.secureLinkId, input.carePlanId, hashPortalSession(rawToken)]
  );
  return rawToken;
}

async function createPhotoRequest(input: { db: Client; organizationId: string; carePlanId: string; carePlanDayId: string; createdByUserId: string }) {
  const id = crypto.randomUUID();
  await input.db.query(
    `
      insert into public.photo_requests (id, organization_id, care_plan_id, care_plan_day_id, label, required, status, created_by_user_id, created_at)
      values ($1, $2, $3, $4, 'Temsili fotoğraf talebi', true, 'active', $5, now())
    `,
    [id, input.organizationId, input.carePlanId, input.carePlanDayId, input.createdByUserId]
  );
  return id;
}

async function syntheticJpeg() {
  return sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: "#dff5ef"
    }
  })
    .jpeg()
    .toBuffer();
}

async function seedPortalUploadedPhoto(organization: "alpha" | "beta" = "alpha") {
  const db = await connect();
  const isAlpha = organization === "alpha";
  const carePlanId = await createCarePlanFromSeed({
    db,
    sourcePlanId: isAlpha ? ids.alphaActivePlan : ids.betaActivePlan,
    organizationId: isAlpha ? ids.alphaOrg : ids.betaOrg
  });
  const dayId = await createPlanDay({
    db,
    organizationId: isAlpha ? ids.alphaOrg : ids.betaOrg,
    carePlanId,
    sourceTemplateDayId: isAlpha ? ids.alphaTemplateDay : ids.betaTemplateDay
  });
  const requestId = await createPhotoRequest({
    db,
    organizationId: isAlpha ? ids.alphaOrg : ids.betaOrg,
    carePlanId,
    carePlanDayId: dayId,
    createdByUserId: isAlpha ? ids.alphaOwner : ids.betaOwner
  });
  const linkId = await createSecureLinkForPlan({
    db,
    organizationId: isAlpha ? ids.alphaOrg : ids.betaOrg,
    carePlanId,
    createdByUserId: isAlpha ? ids.alphaOwner : ids.betaOwner
  });
  const rawSession = await createPortalSession({
    db,
    organizationId: isAlpha ? ids.alphaOrg : ids.betaOrg,
    carePlanId,
    secureLinkId: linkId
  });
  await db.end();

  const cookie = `aftercare_portal_session=${rawSession}`;
  const intentResponse = await fetch("http://localhost:3000/care/session/photos/intents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ photoRequestId: requestId, declaredMime: "image/jpeg", sizeBytes: 1024 })
  });
  expect(intentResponse.ok).toBe(true);
  const intent = (await intentResponse.json()) as {
    intentId: string;
    uploadCredential: { path: string; token: string };
  };
  const supabase = createClient(readLocalEnv().supabaseUrl, readLocalEnv().anonKey);
  const upload = await supabase.storage.from("care-photo-incoming").uploadToSignedUrl(intent.uploadCredential.path, intent.uploadCredential.token, await syntheticJpeg(), {
    contentType: "image/jpeg",
    upsert: false
  });
  expect(upload.error).toBeNull();
  const finalizeResponse = await fetch("http://localhost:3000/care/session/photos/finalize", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ intentId: intent.intentId })
  });
  expect(finalizeResponse.ok).toBe(true);

  const verifyDb = await connect();
  const record = await verifyDb.query<{ id: string }>("select id from public.photo_records where photo_request_id = $1", [requestId]);
  await verifyDb.end();
  return { carePlanId, photoRecordId: record.rows[0]?.id };
}

test("authorized clinic staff views a finalized photo through a short-lived signed URL", async ({ page }) => {
  const { carePlanId, photoRecordId } = await seedPortalUploadedPhoto("alpha");
  const viewUrlResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/clinic/photos/")) {
      viewUrlResponses.push(response.url());
    }
  });
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));

  await login(page, "alpha-staff@example.test");
  await page.goto(`/clinic/plans/${carePlanId}`);
  await expect(page.getByRole("heading", { name: "Fotoğraf kayıtları" })).toBeVisible();
  expect(viewUrlResponses).toHaveLength(0);

  await page.getByRole("button", { name: "Güvenli görüntüle" }).click();
  await expect(page.getByRole("dialog", { name: "Güvenli fotoğraf görüntüleme" })).toBeVisible();
  await expect(page.getByAltText("Klinik tarafından iletilen güvenli fotoğraf kaydı")).toBeVisible();

  const db = await connect();
  const audit = await db.query<{ count: number }>(
    "select count(*)::int as count from public.audit_logs where action = 'photo.view_authorized' and entity_id = $1",
    [photoRecordId]
  );
  await db.end();
  expect(audit.rows[0]?.count).toBeGreaterThanOrEqual(1);

  const storageState = await page.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage)
  }));
  expect(storageState.local + storageState.session).not.toMatch(/signed|token|photos\/|care-photos/i);
  expect(messages.join("\n")).not.toMatch(/signed|token|photos\/|care-photos|SUPABASE_SERVICE_ROLE/i);

  await page.getByRole("button", { name: "Kapat" }).click();
  await expect(page.getByRole("dialog", { name: "Güvenli fotoğraf görüntüleme" })).toHaveCount(0);
});

test("cross-tenant clinic user cannot obtain a photo view URL", async ({ page }) => {
  const { photoRecordId } = await seedPortalUploadedPhoto("alpha");
  await login(page, "beta-owner@example.test");
  const response = await page.evaluate(async (targetPhotoRecordId) => {
    const result = await fetch(`/clinic/photos/${targetPhotoRecordId}/view-url`, { method: "POST" });
    return { status: result.status, body: await result.text() };
  }, photoRecordId);
  expect(response.status).toBe(404);
  expect(response.body).not.toMatch(/photos\/|care-photos|final_object|bucket/i);
});
