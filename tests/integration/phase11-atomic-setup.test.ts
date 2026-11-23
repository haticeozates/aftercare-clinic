import { randomUUID } from "node:crypto";
import pg from "pg";
import { expect, it } from "vitest";

it.runIf(process.env.PHASE11_DB_INTEGRATION === "true")(
  "concurrent Phase 11 setup creates exactly one tenant and one owner",
  async () => {
    const raw = process.env.TEST_DATABASE_URL;
    if (!raw) throw new Error("The isolated test database is required.");
    const url = new URL(raw);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "56322" || url.pathname !== "/postgres") {
      throw new Error("Refusing to modify an unverified Phase 11 test database.");
    }
    const pool = new pg.Pool({ connectionString: raw });
    const actor = randomUUID();
    try {
      await pool.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())",
        [actor, `concurrent-${actor}@example.test`]);
      await pool.query("insert into public.phase11_onboarding(user_id) values ($1)", [actor]);
      const request = () => pool.query<{ id: string }>(
        "select public.phase11_create_clinic($1, 'Eşzamanlı Demo', 'Sentetik', '', '', 'Europe/Istanbul') id", [actor]
      );
      const [one, two] = await Promise.all([request(), request()]);
      expect(one.rows[0].id).toBe(two.rows[0].id);
      const result = await pool.query(`select m.organization_id, r.key
        from public.organization_memberships m join public.roles r on r.id = m.role_id where user_id = $1`, [actor]);
      expect(result.rows).toEqual([{ organization_id: one.rows[0].id, key: "organization_owner" }]);
    } finally {
      // The test runner resets its disposable database. Audit rows stay append-only.
      await pool.end();
    }
  }
);
