import { readFileSync } from "node:fs";
import pg from "pg";
import { expect, it, vi } from "vitest";
import { isolatedNotificationDatabase, notificationMailConfig } from "@/lib/notifications/local-mail.mjs";
import { mailpit } from "@/lib/notifications/mailpit.mjs";
import { runNotificationTick } from "../../scripts/lib/notification-worker.mjs";

it.runIf(process.env.PHASE13_DB_INTEGRATION === "true")(
  "retries a real transport failure, claims a job once, reconciles uncertain delivery and defers quiet hours",
  async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    const config = notificationMailConfig();
    if (!config || !isolatedNotificationDatabase(connectionString, readFileSync("supabase/config.toml","utf8"))) {
      throw new Error("This integration requires the isolated notification runner.");
    }
    const pool = new pg.Pool({ connectionString });
    try {
      const { rows: [fixture] } = await pool.query<{
        clinic: string; actor: string; member: string; client: string; procedure: string; weekday: number; day: string;
      }>(`select o.id clinic,m.user_id actor,m.id member,c.id client,p.id procedure,
        extract(isodow from (now() at time zone 'Europe/Istanbul')::date+27)::int weekday,
        ((now() at time zone 'Europe/Istanbul')::date+27)::text as day
        from public.organizations o
        join public.organization_memberships m on m.organization_id=o.id
        join public.roles r on r.id=m.role_id and r.key='organization_owner'
        join lateral (select id from public.clients where organization_id=o.id and status='active' order by id limit 1) c on true
        join lateral (select id from public.procedures where organization_id=o.id and status='active' order by id limit 1) p on true
        where o.slug='organization-alpha'`);
      const clinicPrefs = { email_enabled:true, reminder_minutes: 60, daily_minute:540 };
      const preferences = (scope: string, payload: object) => pool.query("select public.phase13_preferences($1,$2,$3,$4)",
        [fixture.actor, fixture.clinic, scope, payload]);
      await preferences("clinic", clinicPrefs);
      await preferences("user", { email_enabled: true, reminder_minutes: 45 });
      for (const membership_id of [null, fixture.member]) {
        await pool.query("select public.phase12_configure($1,$2,'rule',$3)",
          [fixture.actor,fixture.clinic,{ membership_id, kind:"work",weekday:fixture.weekday,start_minute:480,end_minute:1000 }]);
      }
      const edit = (id: string | null, hour: string) => pool.query<{ id: string }>(
        "select public.phase12_write($1,$2,$3,$4,$5) id", [fixture.actor,fixture.clinic,id ? "edit" : "create",id,
          { client_id:fixture.client, procedure_id:fixture.procedure, membership_id:fixture.member,
            local_start:fixture.day + "T" + hour, minutes:30 }]);
      const id = (await edit(null,"09:00")).rows[0].id;
      await edit(id,"10:00");
      const { rows: [job] } = await pool.query<{ id:string;status:string }>(`select q.id,q.status
        from notification_private.mail_queue q join public.notification_receipts n on n.id=q.receipt_id
        where n.target_id=$1 and n.kind='appointment_rescheduled'`,[id]);
      expect(job.status).toBe("queued");
      const failures = await runNotificationTick(pool,mailpit({ ...config,mail:"http://127.0.0.1:9" }));
      expect(failures.retry).toBe(1);
      expect((await pool.query("select status,attempts,next_attempt_at>now() as delayed from notification_private.mail_queue where id=$1",[job.id])).rows)
        .toEqual([{ status:"retry",attempts:1,delayed:true }]);

      await pool.query("update notification_private.mail_queue set next_attempt_at=now()-interval '1 second' where id=$1",[job.id]);
      const attempts = await Promise.all([runNotificationTick(pool,mailpit(config)),runNotificationTick(pool,mailpit(config))]);
      expect(attempts.reduce((total,r)=>total+r.accepted,0)).toBe(1);
      const search = new URL("/api/v1/search",config.mail);
      search.searchParams.set("query","message-id:aftercare-" + job.id + "@notification.test");
      const countMail = async () => {
        const response=await fetch(search);
        expect(response.ok).toBe(true);
        const result=await response.json() as { messages: unknown[] };
        return result.messages.length;
      };
      expect(await countMail()).toBe(1);

      await pool.query("update notification_private.mail_queue set status='retry',next_attempt_at=now()-interval '1 second' where id=$1",[job.id]);
      expect((await runNotificationTick(pool,mailpit(config))).accepted).toBe(1);
      expect(await countMail()).toBe(1);
      expect((await pool.query("select result from notification_private.mail_attempts where queue_id=$1 order by attempt",[job.id])).rows)
        .toEqual([{ result:"provider_unavailable" },{ result:"accepted" },{ result:"reconciled" }]);

      const minute = (await pool.query<{ minute:number }>(`select (extract(hour from now() at time zone 'Europe/Istanbul')*60+
        extract(minute from now() at time zone 'Europe/Istanbul'))::int as minute`)).rows[0].minute;
      await preferences("clinic",{...clinicPrefs,quiet_from:(minute+1437)%1440,quiet_until:(minute+6)%1440});
      await edit(id,"11:30");
      expect((await runNotificationTick(pool,mailpit(config))).deferred).toBe(1);
      const postponed = await pool.query<{ id: string; delayed: boolean }>(`select q.id,q.next_attempt_at>now() delayed
        from notification_private.mail_queue q join public.notification_receipts n on n.id=q.receipt_id
        where n.target_id=$1 and n.kind='appointment_rescheduled' and q.status='queued'`, [id]);
      expect(postponed.rows[0].delayed).toBe(true);

      await preferences("user",{email_enabled:false});
      await pool.query("update notification_private.mail_queue set next_attempt_at=now()-interval '1 second' where id=$1",[postponed.rows[0].id]);
      // An unrelated scheduling test may hold this tenant's lock for one worker tick.
      // The regular worker retries such jobs on its next tick.
      let cancelled = 0;
      await vi.waitFor(async () => {
        cancelled += (await runNotificationTick(pool,mailpit(config))).cancelled;
        expect((await pool.query("select status,attempts from notification_private.mail_queue where id=$1",[postponed.rows[0].id])).rows)
          .toEqual([{status:"cancelled",attempts:0}]);
      }, { timeout: 3_000, interval: 50 });
      expect(cancelled).toBe(1);
    } finally {
      await pool.end();
    }
  }
);
