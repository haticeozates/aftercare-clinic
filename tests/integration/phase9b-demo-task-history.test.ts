import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pg from "pg";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ids = {
  org: "00000000-0000-4000-8000-00000000d901",
  plan: "00000000-0000-4000-8000-00000000da01",
  day: "00000000-0000-4000-8000-00000000da11",
  completedTask: "00000000-0000-4000-8000-00000000da21",
  pendingTask: "00000000-0000-4000-8000-00000000da22",
  portalSession: "00000000-0000-4000-8000-00000000da71",
  completionEvent: "00000000-0000-4000-8000-00000000daa1"
};

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function runDemoSetup() {
  const result = spawnSync("node", [resolve(process.cwd(), "scripts/setup-phase9b-demo.mjs")], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000
  });
  expect(result.status).toBe(0);
}

describe("phase 9b demo task history", () => {
  it(
    "aligns completed demo task status with append-only completion history",
    async () => {
    runDemoSetup();
    const db = await connect();
    try {
      const completedTask = await db.query<{ status: string; completed_at: string | null }>(
        `select status, completed_at from public.care_plan_tasks where id = $1`,
        [ids.completedTask]
      );
      expect(completedTask.rows[0]?.status).toBe("completed");
      expect(completedTask.rows[0]?.completed_at).not.toBeNull();

      const completionEvents = await db.query<{ count: number }>(
        `
          select count(*)::int as count
          from public.care_plan_task_events
          where care_plan_task_id = $1 and event_type = 'completed'
        `,
        [ids.completedTask]
      );
      expect(completionEvents.rows[0]?.count).toBe(1);

      const scopedEvent = await db.query<{
        organization_id: string;
        care_plan_id: string;
        care_plan_day_id: string;
        portal_session_id: string;
      }>(
        `
          select organization_id, care_plan_id, care_plan_day_id, portal_session_id
          from public.care_plan_task_events
          where id = $1
        `,
        [ids.completionEvent]
      );
      expect(scopedEvent.rows[0]).toMatchObject({
        organization_id: ids.org,
        care_plan_id: ids.plan,
        care_plan_day_id: ids.day,
        portal_session_id: ids.portalSession
      });

      const pendingEvents = await db.query<{ count: number }>(
        `
          select count(*)::int as count
          from public.care_plan_task_events
          where care_plan_task_id = $1
        `,
        [ids.pendingTask]
      );
      expect(pendingEvents.rows[0]?.count).toBe(0);
    } finally {
      await db.end();
    }
  }, 60_000);

  it(
    "does not duplicate completion history on repeated demo setup",
    async () => {
    runDemoSetup();
    runDemoSetup();
    const db = await connect();
    try {
      const completionEvents = await db.query<{ count: number }>(
        `
          select count(*)::int as count
          from public.care_plan_task_events
          where care_plan_task_id = $1 and event_type = 'completed'
        `,
        [ids.completedTask]
      );
      expect(completionEvents.rows[0]?.count).toBe(1);
    } finally {
      await db.end();
    }
  }, 120_000);
});
