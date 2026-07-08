import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function loadLocalSupabaseEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const values: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        values[match[1]] = match[2];
      }
    }
  }

  return values;
}

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function consumeAsServiceRole(
  client: pg.Client,
  limiterKey: string,
  scope: string,
  threshold: number,
  windowSeconds: number,
  nowIso: string
) {
  const result = await client.query(
    `
      select public.consume_rate_limit($1, $2, $3, $4, $5::timestamptz) as payload
    `,
    [limiterKey, scope, threshold, windowSeconds, nowIso]
  );

  return result.rows[0].payload as {
    allowed: boolean;
    remaining: number;
    retry_after_seconds: number;
  };
}

describe("durable rate-limit integration", () => {
  const limiterKey = "f".repeat(64);
  const scope = RATE_LIMIT_SCOPES.SECURE_LINK_TOKEN_VALIDATION;
  const threshold = 3;
  const windowSeconds = 60;
  const windowNow = "2026-07-09T10:00:10.000Z";

  beforeAll(() => {
    const localEnv = loadLocalSupabaseEnv();
    vi.stubEnv("APP_ENV", localEnv.APP_ENV ?? "local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", localEnv.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    );
    vi.stubEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      localEnv.SUPABASE_SERVICE_ROLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    );
    vi.stubEnv("SUPABASE_PROJECT_REF", localEnv.SUPABASE_PROJECT_REF ?? "local-aftercare");
    vi.stubEnv("AUDIT_LOG_PEPPER", localEnv.AUDIT_LOG_PEPPER ?? "replace-with-local-random-value");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeAll(async () => {
    const db = await connect();
    await db.query(`delete from public.rate_limit_buckets where limiter_key = $1 and scope = $2`, [
      limiterKey,
      scope
    ]);
    await db.end();
  });

  afterAll(async () => {
    const db = await connect();
    await db.query(`delete from public.rate_limit_buckets where limiter_key in ($1, $2)`, [
      limiterKey,
      "e".repeat(64)
    ]);
    await db.end();
  });

  it("shares counters across separate durable consume calls", async () => {
    const db = await connect();
    const firstResult = await consumeAsServiceRole(
      db,
      limiterKey,
      scope,
      threshold,
      windowSeconds,
      windowNow
    );
    const secondResult = await consumeAsServiceRole(
      db,
      limiterKey,
      scope,
      threshold,
      windowSeconds,
      "2026-07-09T10:00:15.000Z"
    );
    await db.end();

    expect(firstResult.allowed).toBe(true);
    expect(secondResult.remaining).toBe(1);
  });

  it("blocks concurrent durable consumes beyond the threshold", async () => {
    await (await connect()).query(`delete from public.rate_limit_buckets where limiter_key = $1`, [
      "e".repeat(64)
    ]);

    const attempts = 8;
    const results = await Promise.all(
      Array.from({ length: attempts }, async () => {
        const db = await connect();
        try {
          return await consumeAsServiceRole(
            db,
            "e".repeat(64),
            RATE_LIMIT_SCOPES.PORTAL_TASK_MUTATION,
            3,
            60,
            "2026-07-09T11:00:00.000Z"
          );
        } finally {
          await db.end();
        }
      })
    );

    const allowedCount = results.filter((result) => result.allowed).length;
    expect(allowedCount).toBe(3);
  });

  it("does not grant browser roles direct DML privileges on rate_limit_buckets", async () => {
    const db = await connect();
    const result = await db.query(
      `
        select
          has_table_privilege('anon', 'public.rate_limit_buckets', 'INSERT') as anon_insert,
          has_table_privilege('authenticated', 'public.rate_limit_buckets', 'UPDATE') as auth_update
      `
    );
    await db.end();

    expect(result.rows[0]).toEqual({
      anon_insert: false,
      auth_update: false
    });
  });
});
