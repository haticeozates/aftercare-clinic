import { describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("local Postgres RLS integration", () => {
  it("runs against a real local Supabase/Postgres database when TEST_DATABASE_URL is provided", async () => {
    const pg = await import("pg");
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(
        "select count(*)::text from pg_tables where schemaname = 'public'"
      );
      expect(Number((result.rows[0] as { count?: string } | undefined)?.count ?? 0)).toBeGreaterThanOrEqual(7);
    } finally {
      await client.end();
    }
  });
});
