import pg from "pg";
import { expect, it } from "vitest";

it.runIf(process.env.PHASE12_DB_INTEGRATION === "true")(
  "reserves exactly one of two concurrent requests and allows the same time in another clinic",
  async () => {
    const connectionString = process.env.TEST_DATABASE_URL ?? "";
    const url = new URL(connectionString);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "56322" || url.pathname !== "/postgres") {
      throw new Error("Refusing to write outside the verified isolated runner.");
    }
    const db = new pg.Pool({ connectionString });
    try {
      const { rows } = await db.query<{
        slug: string; clinic: string; actor: string; member: string; procedure: string; slot: Date; weekday: number;
      }>(`select o.slug,o.id clinic,m.user_id actor,m.id member,p.id procedure,
        ((((now() at time zone 'Europe/Istanbul')::date + 10) + time '10:15') at time zone 'Europe/Istanbul') as slot,
        extract(isodow from (now() at time zone 'Europe/Istanbul')::date + 10)::int weekday
        from public.organizations o
        join public.organization_memberships m on m.organization_id=o.id and m.status='active'
        join public.roles r on r.id=m.role_id and r.key='organization_owner'
        join lateral (select id from public.procedures where organization_id=o.id and status='active' order by id limit 1) p on true
        where o.slug in ('organization-alpha','organization-beta') order by o.slug`);
      expect(rows).toHaveLength(2);
      const [alpha, beta] = rows;
      for (const row of rows) {
        for (const member of [null, row.member]) {
          await db.query("select public.phase12_configure($1,$2,'rule',$3)",
            [row.actor, row.clinic, { membership_id: member, kind: "work", weekday: row.weekday, start_minute: 480, end_minute: 1080 }]);
        }
        await db.query("select public.phase12_configure($1,$2,'service',$3)",
          [row.actor, row.clinic, { procedure_id: row.procedure, minutes: 30, public_demo: true }]);
        await db.query("select public.phase12_configure($1,$2,'public',$3)",
          [row.actor, row.clinic, { public_demo: true }]);
      }
      const request = (row: typeof alpha, reference: string) => db.query("select public.phase12_request($1,$2)",
        [row.slug, { membership_id: row.member, procedure_id: row.procedure, starts_at: row.slot.toISOString(), reference }]);
      const [first, second, other] = await Promise.allSettled([
        request(alpha, "DEMO-7011"), request(alpha, "DEMO-7012"), request(beta, "DEMO-7013")
      ]);
      expect(other.status).toBe("fulfilled");
      expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
      const denied = first.status === "rejected" ? first : second;
      expect(denied.status === "rejected" && denied.reason.code).toBe("23P01");
      const result = await db.query("select count(*)::int count from public.appointments where starts_at=$1 and status='pending'", [alpha.slot]);
      expect(result.rows[0].count).toBe(2);
    } finally {
      await db.end();
    }
  }
);
