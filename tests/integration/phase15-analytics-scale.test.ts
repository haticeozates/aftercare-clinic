import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { expect, it } from "vitest";
import { isolatedNotificationDatabase } from "@/lib/notifications/local-mail.mjs";
import type { ReportData } from "@/lib/analytics/contracts";

it.runIf(process.env.PHASE15_DB_INTEGRATION === "true")(
  "matches independent analytics queries over a large isolated synthetic workload",
  async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!isolatedNotificationDatabase(connectionString, readFileSync("supabase/config.toml","utf8"))) {
      throw new Error("Analytics benchmark requires the verified local runner");
    }
    const pool = new pg.Pool({ connectionString });
    const db = await pool.connect();
    const alpha = "00000000-0000-4000-8000-0000000000a1";
    const actor = "00000000-0000-4000-8000-00000000a101";
    const from = "2026-05-01";
    const to = "2026-06-29";
    try {
      await db.query("begin");
      await db.query("set local statement_timeout='20s'");
      const appointmentFixture = await db.query(`
        insert into public.appointments(organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone)
        select o.id,c.id,p.id,m.id,case when n%4=0 then 'online_demo' else 'clinic' end,'procedure',
          (array['completed','cancelled','no_show'])[1+n%3], begins,begins+interval '15 minutes','Europe/Istanbul'
        from public.organizations o
        join public.organization_memberships m on m.organization_id=o.id and m.status='active'
        join public.roles r on r.id=m.role_id and r.key='organization_owner'
        join lateral (select id from public.clients where organization_id=o.id and status='active' order by id limit 1) c on true
        join lateral (select id from public.procedures where organization_id=o.id and status='active' order by id limit 1) p on true
        cross join lateral generate_series(1,case when o.slug='organization-alpha' then 40000 else 20000 end) n
        cross join lateral (select timestamptz '2026-01-01 09:00+03' + n%180 * interval '1 day' + n%660 * interval '1 minute' as begins) t
        where o.slug in ('organization-alpha','organization-beta')`);
      expect(appointmentFixture.rowCount).toBe(60_000);

      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
      const plans = await db.query<{ generated: number }>(`
        select count(public.create_care_plan_from_template(
          p.client_id,p.procedure_id,p.care_template_id,p.template_version_id,
          date '2026-05-01'+n%59,null,p.responsible_membership_id))::int as generated
        from public.care_plans p cross join generate_series(1,3000) n where p.id='00000000-0000-4000-8000-00000000e101'`);
      expect(plans.rows[0].generated).toBe(3_000);
      await db.query("analyze public.appointments");
      await db.query("analyze public.care_plan_days");
      await db.query("analyze public.care_plan_tasks");

      const scope = `from public.appointments where organization_id=$1
        and starts_at >= $2::date::timestamp at time zone 'Europe/Istanbul'
        and starts_at < ($3::date+1)::timestamp at time zone 'Europe/Istanbul'`;
      const args = [alpha,from,to];
      const count = await db.query<{ total: number; completed: number }>(
        `select count(*)::int total,count(*) filter(where status='completed')::int completed ${scope}`, args);
      const explain = await db.query(`explain(analyze,buffers,format json) select count(*) ${scope}`,args);
      const sample: number[] = [];
      let measured: ReportData | undefined;
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
      for (let run=0; run<6; run+=1) {
        const started = performance.now();
        const result = await db.query<{ report: ReportData }>(
          "select public.phase15_report($1,'custom',$2,$3,null,null,null,'day') as report", args);
        sample.push(performance.now()-started);
        measured = result.rows[0].report;
      }
      if (!measured) throw new Error("No report measured");
      const totals = measured.current.appointments;
      expect(totals).toMatchObject(count.rows[0]);
      expect(measured.current.trend.reduce((sum,[,count])=>sum+count,0)).toBe(totals.total);
      expect(measured.current.tasks).toEqual({ done: 0, due: 3_000 });
      const sorted = sample.slice(1).sort((a,b)=>a-b);
      const baseline = explain.rows[0]["QUERY PLAN"][0];
      const measurement = JSON.stringify({
        appointments: appointmentFixture.rowCount, carePlans:plans.rows[0].generated, careTasks:measured.current.tasks.due,
        selectedAppointments:totals.total, firstMs:Math.round(sample[0]), medianMs:Math.round(sorted[2]),
        maxWarmMs:Math.round(sorted.at(-1) ?? 0), serializedBytes:Buffer.byteLength(JSON.stringify(measured)),
        countQueryExecutionMs:baseline["Execution Time"], countPlanNode:baseline.Plan.Plans[0]["Node Type"],
      });
      const output = process.env.PHASE15_BENCHMARK_OUTPUT;
      if (output) await writeFile(output, measurement + "\n", { mode: 0o600 });
    } finally {
      await db.query("rollback").finally(()=>db.release());
      await pool.end();
    }
  },
  40_000,
);
