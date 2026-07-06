import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
  "procedures"
];

const forbiddenFutureTables = [
  "care_templates",
  "care_plans",
  "secure_links",
  "photos",
  "symptoms",
  "alerts",
  "consents",
];

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
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

  it("has only the foundation and phase 2 tables needed so far", async () => {
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
});
