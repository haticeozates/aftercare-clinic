import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";

const cleanupSecret = "local-photo-cleanup-secret-32-chars";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  alphaActivePlan: "00000000-0000-4000-8000-00000000e101",
  alphaTemplateDay: "00000000-0000-4000-8000-00000000a601",
  alphaOwner: "00000000-0000-4000-8000-00000000a101"
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
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY ?? ""
  };
}

async function connect() {
  const client = new Client({ connectionString: readLocalEnv().databaseUrl });
  await client.connect();
  return client;
}

async function imageBytes() {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: "#eef8f4"
    }
  })
    .webp()
    .toBuffer();
}

async function createCarePlanFromSeed(db: Client) {
  const id = crypto.randomUUID();
  await db.query(
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
      where id = $2
    `,
    [id, ids.alphaActivePlan]
  );
  return id;
}

async function createPlanDay(db: Client, carePlanId: string) {
  const id = crypto.randomUUID();
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
      values ($1, $2, $3, $4, $5, current_date, 'Temsili fotoğraf cleanup günü', 'available')
    `,
    [id, ids.alphaOrg, carePlanId, ids.alphaTemplateDay, Math.floor(20_000 + Math.random() * 1_000_000)]
  );
  await db.query("commit");
  return id;
}

async function createPhotoRequest(db: Client, carePlanId: string, carePlanDayId: string) {
  const id = crypto.randomUUID();
  await db.query(
    `
      insert into public.photo_requests (id, organization_id, care_plan_id, care_plan_day_id, label, required, status, created_by_user_id, created_at)
      values ($1, $2, $3, $4, 'Temsili cleanup fotoğraf talebi', true, 'active', $5, now())
    `,
    [id, ids.alphaOrg, carePlanId, carePlanDayId, ids.alphaOwner]
  );
  return id;
}

async function createPortalSession(db: Client, carePlanId: string) {
  const linkId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  await db.query(
    `
      insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id)
      values ($1, $2, $3, $4, 'p7c', 'active', now() + interval '1 day', $5)
    `,
    [linkId, ids.alphaOrg, carePlanId, `phase7-cleanup-link-${crypto.randomUUID()}`, ids.alphaOwner]
  );
  await db.query(
    `
      insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at, created_at)
      values ($1, $2, $3, $4, $5, 'active', now() + interval '20 minutes', now())
    `,
    [sessionId, ids.alphaOrg, linkId, carePlanId, `phase7-cleanup-session-${crypto.randomUUID()}`]
  );
  return sessionId;
}

async function createIntent(db: Client, input: { requestId: string; carePlanId: string; dayId: string; sessionId: string; key: string; status: "expired" | "consumed" }) {
  const id = crypto.randomUUID();
  await db.query(
    `
      insert into public.photo_upload_intents (
        id,
        organization_id,
        photo_request_id,
        care_plan_id,
        care_plan_day_id,
        portal_session_id,
        status,
        incoming_object_key,
        declared_mime_type,
        declared_size_bytes,
        expires_at,
        consumed_at,
        processing_started_at,
        processing_claim_id
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        'image/webp',
        512,
        now() - interval '2 days',
        case when $7 = 'consumed' then now() - interval '2 days' else null end,
        case when $7 = 'consumed' then now() - interval '2 days' else null end,
        case when $7 = 'consumed' then gen_random_uuid() else null end
      )
    `,
    [id, ids.alphaOrg, input.requestId, input.carePlanId, input.dayId, input.sessionId, input.status, input.key]
  );
  return id;
}

async function ageStorageObject(db: Client, bucket: string, key: string) {
  await db.query(
    "update storage.objects set created_at = now() - interval '2 days', updated_at = now() - interval '2 days' where bucket_id = $1 and name = $2",
    [bucket, key]
  );
}

async function setupCleanupFixture() {
  const env = readLocalEnv();
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const bytes = await imageBytes();
  const db = await connect();

  const orphanIncomingKey = `incoming/${crypto.randomUUID()}`;
  const orphanFinalKey = `photos/${crypto.randomUUID()}.webp`;
  const referencedFinalKey = `photos/${crypto.randomUUID()}.webp`;

  const carePlanId = await createCarePlanFromSeed(db);
  const incomingDayId = await createPlanDay(db, carePlanId);
  const referencedDayId = await createPlanDay(db, carePlanId);
  const incomingRequestId = await createPhotoRequest(db, carePlanId, incomingDayId);
  const referencedRequestId = await createPhotoRequest(db, carePlanId, referencedDayId);
  const sessionId = await createPortalSession(db, carePlanId);
  const expiredIntentId = await createIntent(db, {
    requestId: incomingRequestId,
    carePlanId,
    dayId: incomingDayId,
    sessionId,
    key: orphanIncomingKey,
    status: "expired"
  });
  const consumedIntentId = await createIntent(db, {
    requestId: referencedRequestId,
    carePlanId,
    dayId: referencedDayId,
    sessionId,
    key: `incoming/${crypto.randomUUID()}`,
    status: "consumed"
  });

  await admin.storage.from("care-photo-incoming").upload(orphanIncomingKey, bytes, { contentType: "image/webp", upsert: false });
  await admin.storage.from("care-photos").upload(orphanFinalKey, bytes, { contentType: "image/webp", upsert: false });
  await admin.storage.from("care-photos").upload(referencedFinalKey, bytes, { contentType: "image/webp", upsert: false });
  await ageStorageObject(db, "care-photo-incoming", orphanIncomingKey);
  await ageStorageObject(db, "care-photos", orphanFinalKey);
  await ageStorageObject(db, "care-photos", referencedFinalKey);

  await db.query(
    `
      insert into public.photo_records (
        organization_id,
        photo_request_id,
        upload_intent_id,
        care_plan_id,
        care_plan_day_id,
        portal_session_id,
        final_object_key,
        verified_mime_type,
        verified_size_bytes,
        width,
        height,
        checksum_sha256,
        finalized_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'image/webp', 512, 32, 24, $8, now() - interval '2 days')
    `,
    [ids.alphaOrg, referencedRequestId, consumedIntentId, carePlanId, referencedDayId, sessionId, referencedFinalKey, "a".repeat(64)]
  );

  await db.end();
  return { orphanIncomingKey, orphanFinalKey, referencedFinalKey, expiredIntentId };
}

async function callCleanup(mode: "dry_run" | "execute", secret = cleanupSecret) {
  return fetch("http://localhost:3000/internal/jobs/photo-cleanup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`
    },
    body: JSON.stringify({ mode })
  });
}

test("photo cleanup route dry-runs and executes only confirmed storage orphans", async ({ request }) => {
  const fixture = await setupCleanupFixture();
  const env = readLocalEnv();
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const noSecret = await request.post("/internal/jobs/photo-cleanup", { data: { mode: "dry_run" } });
  expect(noSecret.status()).toBe(401);
  const wrongSecret = await callCleanup("dry_run", "wrong-secret-value-that-is-long");
  expect(wrongSecret.status).toBe(401);

  const dryRun = await callCleanup("dry_run");
  expect(dryRun.status).toBe(200);
  const dryRunBody = await dryRun.json();
  expect(dryRunBody.candidates.incoming).toBeGreaterThanOrEqual(1);
  expect(dryRunBody.candidates.final).toBeGreaterThanOrEqual(1);
  expect(dryRunBody.deleted).toEqual({ incoming: 0, final: 0 });
  expect(JSON.stringify(dryRunBody)).not.toMatch(/incoming\/|photos\/|care-photo|token/i);
  await expect(admin.storage.from("care-photo-incoming").download(fixture.orphanIncomingKey)).resolves.toMatchObject({ error: null });
  await expect(admin.storage.from("care-photos").download(fixture.orphanFinalKey)).resolves.toMatchObject({ error: null });

  const execute = await callCleanup("execute");
  expect(execute.status).toBe(200);
  const executeBody = await execute.json();
  expect(executeBody.deleted.incoming).toBeGreaterThanOrEqual(1);
  expect(executeBody.deleted.final).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(executeBody)).not.toMatch(/incoming\/|photos\/|care-photo|token/i);

  expect((await admin.storage.from("care-photo-incoming").download(fixture.orphanIncomingKey)).error).not.toBeNull();
  expect((await admin.storage.from("care-photos").download(fixture.orphanFinalKey)).error).not.toBeNull();
  expect((await admin.storage.from("care-photos").download(fixture.referencedFinalKey)).error).toBeNull();

  const secondExecute = await callCleanup("execute");
  expect(secondExecute.status).toBe(200);
  const secondBody = await secondExecute.json();
  expect(secondBody.deleted.incoming).toBe(0);
  expect(secondBody.deleted.final).toBe(0);

  const db = await connect();
  const audit = await db.query<{ count: number; metadata: string }>(
    "select count(*)::int as count, coalesce(string_agg(safe_metadata::text, ' '), '') as metadata from public.audit_logs where action in ('photo.cleanup_completed', 'photo.cleanup_failed')"
  );
  await db.end();
  expect(audit.rows[0]?.count).toBeGreaterThanOrEqual(1);
  expect(audit.rows[0]?.metadata).not.toMatch(/incoming\/|photos\/|care-photo|token/i);
});
