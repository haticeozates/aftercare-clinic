import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import pg from "pg";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const foundationTables = [
  "organizations",
  "user_profiles",
  "roles",
  "permissions",
  "role_permissions",
  "organization_memberships",
  "audit_logs",
  "clients",
  "procedures",
  "care_templates",
  "care_template_versions",
  "care_template_days",
  "care_template_tasks",
  "symptom_options",
  "alert_rules",
  "care_plans",
  "care_plan_days",
  "care_plan_tasks",
  "care_plan_task_events",
  "secure_links",
  "portal_sessions",
  "care_plan_symptom_options",
  "care_plan_alert_rules",
  "symptom_reports",
  "symptom_report_items",
  "alerts",
  "alert_events",
  "photo_requests",
  "photo_upload_intents",
  "photo_records"
];

const forbiddenFutureTables = [
  "symptom_checks",
  "consent_records",
  "data_requests",
  "notification_records"
];

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function createPhase7ClaimFixture() {
  const db = await connect();
  const organizationId = "00000000-0000-4000-8000-0000000000a1";
  const carePlanId = "00000000-0000-4000-8000-00000000e101";
  const secureLinkId = "00000000-0000-4000-8000-00000000a911";
  const sourceTemplateDayId = "00000000-0000-4000-8000-00000000a601";
  const createdByUserId = "00000000-0000-4000-8000-00000000a101";
  const carePlanDayId = crypto.randomUUID();
  const photoRequestId = crypto.randomUUID();
  const portalSessionHash = `phase7-claim-${crypto.randomUUID()}`;
  const intentId = crypto.randomUUID();

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
      values ($1, $2, $3, $4, $5, current_date, 'Temsili fotoğraf günü', 'available')
    `,
    [carePlanDayId, organizationId, carePlanId, sourceTemplateDayId, Math.floor(20_000 + Math.random() * 1_000_000)]
  );
  await db.query("commit");

  await db.query(
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
      values ($1, $2, $3, $4, 'active', now() + interval '20 minutes', now())
    `,
    [organizationId, secureLinkId, carePlanId, portalSessionHash]
  );

  const session = await db.query<{ id: string }>("select id from public.portal_sessions where session_hash = $1", [
    portalSessionHash
  ]);

  await db.query(
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
    [photoRequestId, organizationId, carePlanId, carePlanDayId, createdByUserId]
  );

  await db.query(
    `
      insert into public.photo_upload_intents (
        id,
        organization_id,
        photo_request_id,
        care_plan_id,
        care_plan_day_id,
        portal_session_id,
        incoming_object_key,
        declared_mime_type,
        declared_size_bytes,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'image/jpeg', 512, now() + interval '5 minutes')
    `,
    [
      intentId,
      organizationId,
      photoRequestId,
      carePlanId,
      carePlanDayId,
      session.rows[0]?.id,
      `incoming/${crypto.randomUUID()}`
    ]
  );

  await db.end();
  return { intentId, portalSessionHash, photoRequestId };
}

async function asAuthenticated(client: pg.Client, userId: string) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
  await client.query("set role authenticated");
}

describe("local Postgres RLS integration", () => {
  let client: pg.Client | undefined;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  afterEach(async () => {
    await client?.query("reset role");
  });

  function getClient() {
    if (!client) {
      throw new Error("Local Postgres client is not connected");
    }

    return client;
  }

  it("runs against the real local Supabase/Postgres database", async () => {
    try {
      const result = await getClient().query(
        "select count(*)::int as count from pg_tables where schemaname = 'public'"
      );
      expect(result.rows[0]?.count).toBeGreaterThanOrEqual(foundationTables.length);
    } catch (error) {
      throw new Error(
        `Could not connect to local Supabase/Postgres at ${databaseUrl}. Run npm run supabase:start and npm run db:reset first. Cause: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  it("has only the foundation, phase 2, phase 3 and phase 4 tables needed so far", async () => {
    const result = await getClient().query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'"
    );
    const tableNames = result.rows.map((row) => row.tablename);

    expect(tableNames).toEqual(expect.arrayContaining(foundationTables));
    expect(tableNames).not.toEqual(expect.arrayContaining(forbiddenFutureTables));
  });

  it("enables RLS on every exposed foundation table", async () => {
    const result = await getClient().query<{ relname: string; relrowsecurity: boolean }>(
      `
        select relname, relrowsecurity
        from pg_class
        where relnamespace = 'public'::regnamespace
          and relkind = 'r'
          and relname = any($1::text[])
      `,
      [foundationTables]
    );

    expect(result.rows).toHaveLength(foundationTables.length);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("blocks cross-tenant organization reads through authenticated RLS", async () => {
    const db = getClient();
    await asAuthenticated(db, "00000000-0000-4000-8000-00000000a101");

    const alpha = await db.query(
      "select count(*)::int as count from public.organizations where slug = 'organization-alpha'"
    );
    const beta = await db.query(
      "select count(*)::int as count from public.organizations where slug = 'organization-beta'"
    );

    expect(alpha.rows[0]?.count).toBe(1);
    expect(beta.rows[0]?.count).toBe(0);
  });

  it("does not allow normal authenticated audit inserts", async () => {
    const db = getClient();
    await asAuthenticated(db, "00000000-0000-4000-8000-00000000a101");

    await expect(
      db.query(`
        insert into public.audit_logs (organization_id, actor_type, action, entity_type, result)
        values ('00000000-0000-4000-8000-0000000000a1', 'user', 'authorization.denied', 'organization', 'denied')
      `)
    ).rejects.toThrow(/permission denied|violates row-level security/i);
  });

  it("allows only one real Postgres process to claim a photo upload intent", async () => {
    const fixture = await createPhase7ClaimFixture();
    const first = await connect();
    const second = await connect();

    try {
      const [firstClaim, secondClaim] = await Promise.all([
        first.query("select public.claim_photo_upload_intent_for_portal($1, $2) as result", [
          fixture.portalSessionHash,
          fixture.intentId
        ]),
        second.query("select public.claim_photo_upload_intent_for_portal($1, $2) as result", [
          fixture.portalSessionHash,
          fixture.intentId
        ])
      ]);
      const results = [firstClaim.rows[0]?.result, secondClaim.rows[0]?.result];
      expect(results.filter((result) => result.status === "processing")).toHaveLength(1);
      expect(results.filter((result) => result.error === "intent is already processing")).toHaveLength(1);

      await expect(
        first.query(
          `
            select public.record_finalized_photo_for_portal(
              $1,
              $2,
              gen_random_uuid(),
              $3,
              256,
              16,
              16,
              $4
            ) as result
          `,
          [fixture.portalSessionHash, fixture.intentId, `photos/${crypto.randomUUID()}.webp`, "a".repeat(64)]
        )
      ).resolves.toMatchObject({
        rows: [{ result: { error: "intent claim is invalid" } }]
      });

      const noReclaim = await first.query("select public.claim_photo_upload_intent_for_portal($1, $2) as result", [
        fixture.portalSessionHash,
        fixture.intentId
      ]);
      expect(noReclaim.rows[0]?.result).toMatchObject({ error: "intent is already processing" });

      await first.query(
        "update public.photo_upload_intents set processing_started_at = now() - interval '11 minutes' where id = $1",
        [fixture.intentId]
      );
      const recovered = await first.query("select public.claim_photo_upload_intent_for_portal($1, $2) as result", [
        fixture.portalSessionHash,
        fixture.intentId
      ]);
      expect(recovered.rows[0]?.result.status).toBe("processing");
      expect(recovered.rows[0]?.result.claim_id).toEqual(expect.any(String));

      const records = await first.query("select count(*)::int as count from public.photo_records where photo_request_id = $1", [
        fixture.photoRequestId
      ]);
      expect(records.rows[0]?.count).toBe(0);
    } finally {
      await first.end();
      await second.end();
    }
  });
});
