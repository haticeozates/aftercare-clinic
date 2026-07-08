import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import sharp from "sharp";

type AppEnv = Record<string, string>;

const env = loadEnvFile();
const databaseUrl = env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const auditPepper = env.AUDIT_LOG_PEPPER ?? "test-audit-pepper-at-least-32-characters-long";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaActivePlan: "00000000-0000-4000-8000-00000000e101",
  alphaCompletedPlan: "00000000-0000-4000-8000-00000000e103",
  alphaStoppedPlan: "00000000-0000-4000-8000-00000000e104",
  betaActivePlan: "00000000-0000-4000-8000-00000000e201",
  alphaActiveLink: "00000000-0000-4000-8000-00000000a911",
  betaActiveLink: "00000000-0000-4000-8000-00000000b911",
  alphaTemplateDay: "00000000-0000-4000-8000-00000000a601",
  betaTemplateDay: "00000000-0000-4000-8000-00000000b601",
  alphaOwner: "00000000-0000-4000-8000-00000000a101",
  betaOwner: "00000000-0000-4000-8000-00000000b101"
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

function hashPortalSession(rawToken: string) {
  return crypto.createHash("sha256").update(`${rawToken}.${auditPepper}`).digest("hex");
}

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function createPlanDay(input: {
  db: pg.Client;
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

async function createSecureLinkForPlan(input: {
  db: pg.Client;
  organizationId: string;
  carePlanId: string;
  createdByUserId: string;
}) {
  const existing = await input.db.query<{ id: string }>(
    `
      select id
      from public.secure_links
      where organization_id = $1
        and care_plan_id = $2
        and status = 'active'
        and expires_at > now()
      order by created_at desc
      limit 1
    `,
    [input.organizationId, input.carePlanId]
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

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
      values ($1, $2, $3, $4, 'p7t', 'active', now() + interval '1 day', $5)
    `,
    [id, input.organizationId, input.carePlanId, `phase7-link-${crypto.randomUUID()}`, input.createdByUserId]
  );
  return id;
}

async function createPortalSession(input: {
  db: pg.Client;
  organizationId: string;
  secureLinkId: string;
  carePlanId: string;
  status?: "active" | "revoked";
  expiresAtSql?: string;
}) {
  const rawToken = `phase7-session-${crypto.randomUUID()}`;
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
      values ($1, $2, $3, $4, $5, ${input.expiresAtSql ?? "now() + interval '20 minutes'"}, now())
    `,
    [
      input.organizationId,
      input.secureLinkId,
      input.carePlanId,
      hashPortalSession(rawToken),
      input.status ?? "active"
    ]
  );
  return rawToken;
}

async function createPhotoRequest(input: {
  db: pg.Client;
  organizationId: string;
  carePlanId: string;
  carePlanDayId: string;
  createdByUserId: string;
  status?: "active" | "cancelled";
}) {
  const id = crypto.randomUUID();
  if (input.status === "cancelled") {
    await input.db.query(
      `
        insert into public.photo_requests (
          id,
          organization_id,
          care_plan_id,
          care_plan_day_id,
          label,
          required,
          created_by_user_id,
          status,
          cancelled_at,
          cancelled_by_user_id,
          created_at
        )
        values ($1, $2, $3, $4, 'Temsili fotoğraf talebi', false, $5, 'cancelled', now(), $5, now())
      `,
      [id, input.organizationId, input.carePlanId, input.carePlanDayId, input.createdByUserId]
    );
    return id;
  }

  await input.db.query(
    `
      insert into public.photo_requests (
        id,
        organization_id,
        care_plan_id,
        care_plan_day_id,
        label,
        required,
        created_by_user_id,
        status,
        created_at
      )
      values ($1, $2, $3, $4, 'Temsili fotoğraf talebi', false, $5, 'active', now())
    `,
    [id, input.organizationId, input.carePlanId, input.carePlanDayId, input.createdByUserId]
  );
  return id;
}

async function createSyntheticJpeg() {
  return await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 190, g: 210, b: 230 }
    }
  })
    .jpeg()
    .toBuffer();
}

test.describe("phase 7 real signed photo upload flow", () => {
  test("creates a signed incoming upload and finalizes a sanitized WebP exactly once", async ({ request }) => {
    const db = await connect();
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const dayId = await createPlanDay({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaActivePlan,
      sourceTemplateDayId: ids.alphaTemplateDay,
      scheduledDateSql: "current_date"
    });
    const rawSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: ids.alphaActiveLink,
      carePlanId: ids.alphaActivePlan
    });
    const photoRequestId = await createPhotoRequest({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaActivePlan,
      carePlanDayId: dayId,
      createdByUserId: ids.alphaOwner
    });
    const image = await createSyntheticJpeg();

    const intentResponse = await request.post("/care/session/photos/intents", {
      headers: { cookie: `aftercare_portal_session=${rawSession}` },
      data: {
        photoRequestId,
        declaredMime: "image/jpeg",
        sizeBytes: image.length
      }
    });

    expect(intentResponse.status()).toBe(200);
    const intentBody = await intentResponse.json();
    expect(Object.keys(intentBody).sort()).toEqual(["intentId", "uploadCredential"]);
    expect(intentBody.uploadCredential).toMatchObject({
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
    });
    expect(intentBody.uploadCredential.path).toMatch(/^incoming\/[0-9a-f-]{36}$/);
    expect(intentBody.uploadCredential.token).toEqual(expect.any(String));
    expect(JSON.stringify(intentBody)).not.toContain("final_object_key");

    const tokenPersistence = await db.query(
      `
        select exists (
          select 1
          from public.photo_upload_intents
          where id = $1 and (row_to_json(photo_upload_intents)::text like '%' || $2 || '%')
        ) as exists
      `,
      [intentBody.intentId, intentBody.uploadCredential.token]
    );
    expect(tokenPersistence.rows[0]?.exists).toBe(false);

    const uploadResult = await anon.storage
      .from("care-photo-incoming")
      .uploadToSignedUrl(intentBody.uploadCredential.path, intentBody.uploadCredential.token, image, {
        contentType: "image/jpeg",
        upsert: false
      });
    expect(uploadResult.error).toBeNull();

    const finalizeResponse = await request.post("/care/session/photos/finalize", {
      headers: { cookie: `aftercare_portal_session=${rawSession}` },
      data: { intentId: intentBody.intentId }
    });
    const finalizeBody = await finalizeResponse.json();
    expect(finalizeResponse.status(), JSON.stringify(finalizeBody)).toBe(200);
    expect(finalizeBody).toEqual({ ok: true, status: "ready" });

    const records = await db.query(
      `
        select id, final_object_key, verified_mime_type, verified_size_bytes, width, height
        from public.photo_records
        where photo_request_id = $1
      `,
      [photoRequestId]
    );
    expect(records.rowCount).toBe(1);
    expect(records.rows[0]?.verified_mime_type).toBe("image/webp");

    const finalObjectKey = records.rows[0].final_object_key as string;
    const finalDownload = await admin.storage.from("care-photos").download(finalObjectKey);
    expect(finalDownload.error).toBeNull();
    const finalBytes = Buffer.from(await finalDownload.data!.arrayBuffer());
    const finalMetadata = await sharp(finalBytes).metadata();
    expect(finalMetadata.format).toBe("webp");
    expect(finalMetadata.exif).toBeUndefined();
    expect(finalMetadata.xmp).toBeUndefined();
    expect(finalMetadata.iptc).toBeUndefined();
    expect(finalMetadata.icc).toBeUndefined();

    const incomingDownload = await admin.storage.from("care-photo-incoming").download(intentBody.uploadCredential.path);
    expect(incomingDownload.error).not.toBeNull();

    const anonFinalDownload = await anon.storage.from("care-photos").download(finalObjectKey);
    expect(anonFinalDownload.error).not.toBeNull();

    const repeatResponse = await request.post("/care/session/photos/finalize", {
      headers: { cookie: `aftercare_portal_session=${rawSession}` },
      data: { intentId: intentBody.intentId }
    });
    expect(repeatResponse.status()).toBe(200);
    await expect(repeatResponse.json()).resolves.toEqual({ ok: true, status: "already_finalized" });

    const revokedSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: ids.alphaActiveLink,
      carePlanId: ids.alphaActivePlan,
      status: "revoked"
    });
    const revokedResponse = await request.post("/care/session/photos/finalize", {
      headers: { cookie: `aftercare_portal_session=${revokedSession}` },
      data: { intentId: intentBody.intentId }
    });
    expect(revokedResponse.ok()).toBe(false);
    expect(JSON.stringify(await revokedResponse.json())).not.toContain("photo_record");

    const expiredSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: ids.alphaActiveLink,
      carePlanId: ids.alphaActivePlan,
      expiresAtSql: "now() - interval '1 minute'"
    });
    const expiredResponse = await request.post("/care/session/photos/finalize", {
      headers: { cookie: `aftercare_portal_session=${expiredSession}` },
      data: { intentId: intentBody.intentId }
    });
    expect(expiredResponse.ok()).toBe(false);
    expect(JSON.stringify(await expiredResponse.json())).not.toContain("photo_record");

    const auditLeak = await db.query(
      `
        select count(*)::int as count
        from public.audit_logs
        where safe_metadata::text like '%' || $1 || '%'
          or safe_metadata::text like '%' || $2 || '%'
          or safe_metadata::text like '%' || $3 || '%'
      `,
      [intentBody.uploadCredential.path, intentBody.uploadCredential.token, finalObjectKey]
    );
    expect(auditLeak.rows[0]?.count).toBe(0);
    await db.end();
  });

  test("rejects cancelled, stopped, completed and cross-tenant photo access", async ({ request }) => {
    const db = await connect();
    const alphaDay = await createPlanDay({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaActivePlan,
      sourceTemplateDayId: ids.alphaTemplateDay,
      scheduledDateSql: "current_date"
    });
    const alphaSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: ids.alphaActiveLink,
      carePlanId: ids.alphaActivePlan
    });
    const cancelledRequest = await createPhotoRequest({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaActivePlan,
      carePlanDayId: alphaDay,
      createdByUserId: ids.alphaOwner,
      status: "cancelled"
    });

    const cancelledIntent = await request.post("/care/session/photos/intents", {
      headers: { cookie: `aftercare_portal_session=${alphaSession}` },
      data: { photoRequestId: cancelledRequest, declaredMime: "image/png", sizeBytes: 128 }
    });
    expect(cancelledIntent.status()).toBe(403);

    const completedLink = await createSecureLinkForPlan({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaCompletedPlan,
      createdByUserId: ids.alphaOwner
    });
    const completedDay = await createPlanDay({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaCompletedPlan,
      sourceTemplateDayId: ids.alphaTemplateDay,
      scheduledDateSql: "current_date - 1"
    });
    const completedSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: completedLink,
      carePlanId: ids.alphaCompletedPlan
    });
    const completedRequest = await createPhotoRequest({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaCompletedPlan,
      carePlanDayId: completedDay,
      createdByUserId: ids.alphaOwner
    });
    const completedIntent = await request.post("/care/session/photos/intents", {
      headers: { cookie: `aftercare_portal_session=${completedSession}` },
      data: { photoRequestId: completedRequest, declaredMime: "image/png", sizeBytes: 128 }
    });
    expect(completedIntent.status()).toBe(403);

    const stoppedLink = await createSecureLinkForPlan({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaStoppedPlan,
      createdByUserId: ids.alphaOwner
    });
    const stoppedDay = await createPlanDay({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaStoppedPlan,
      sourceTemplateDayId: ids.alphaTemplateDay,
      scheduledDateSql: "current_date - 1"
    });
    const stoppedSession = await createPortalSession({
      db,
      organizationId: ids.alphaOrg,
      secureLinkId: stoppedLink,
      carePlanId: ids.alphaStoppedPlan
    });
    const stoppedRequest = await createPhotoRequest({
      db,
      organizationId: ids.alphaOrg,
      carePlanId: ids.alphaStoppedPlan,
      carePlanDayId: stoppedDay,
      createdByUserId: ids.alphaOwner
    });
    const stoppedIntent = await request.post("/care/session/photos/intents", {
      headers: { cookie: `aftercare_portal_session=${stoppedSession}` },
      data: { photoRequestId: stoppedRequest, declaredMime: "image/png", sizeBytes: 128 }
    });
    expect(stoppedIntent.status()).toBe(403);

    const betaDay = await createPlanDay({
      db,
      organizationId: ids.betaOrg,
      carePlanId: ids.betaActivePlan,
      sourceTemplateDayId: ids.betaTemplateDay,
      scheduledDateSql: "current_date"
    });
    const betaRequest = await createPhotoRequest({
      db,
      organizationId: ids.betaOrg,
      carePlanId: ids.betaActivePlan,
      carePlanDayId: betaDay,
      createdByUserId: ids.betaOwner
    });
    const crossTenantIntent = await request.post("/care/session/photos/intents", {
      headers: { cookie: `aftercare_portal_session=${alphaSession}` },
      data: { photoRequestId: betaRequest, declaredMime: "image/png", sizeBytes: 128 }
    });
    expect(crossTenantIntent.status()).toBe(403);
    await db.end();
  });
});
