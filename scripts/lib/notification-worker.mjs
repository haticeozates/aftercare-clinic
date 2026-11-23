import { syntheticEmail } from "../../lib/notifications/mailpit.mjs";

const retryMinutes = [1, 5, 15];

async function inTransaction(pool, work) {
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    const result = await work(connection);
    await connection.query("commit");
    return result;
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
}

export async function runNotificationTick(pool, provider, limit = 20) {
  const scheduled = await inTransaction(pool, async (db) => {
    const { rows: [lock] } = await db.query("select pg_try_advisory_xact_lock(hashtextextended('phase13:daily',0)) as acquired");
    if (!lock.acquired) return 0;
    const { rows: [result] } = await db.query("select notification_private.sweep_tasks(clock_timestamp()) as result");
    return result.result;
  });
  const totals = { scheduled, accepted: 0, retry: 0, failed: 0, cancelled: 0, deferred: 0 };
  if (!provider) return totals;

  for (let processed = 0; processed < limit; processed += 1) {
    const result = await inTransaction(pool, async (db) => {
      const { rows } = await db.query(`select n.organization_id
        from notification_private.mail_queue q join public.notification_receipts n on n.id=q.receipt_id
        where q.status in ('queued','retry') and q.next_attempt_at<=clock_timestamp()
        group by n.organization_id order by min(q.next_attempt_at) limit 24`);
      for (const org of rows) {
        // Phase 12 writers take this same lock before changing an appointment or its reminder.
        const { rows: [lock] } = await db.query(
          "select pg_try_advisory_xact_lock(hashtextextended('phase11:org:' || $1::text,0)) as acquired", [org.organization_id]);
        if (!lock.acquired) continue;

        const { rows: [job] } = await db.query(`
          select q.id, q.attempts, e.kind, lower(a.email) as email, e.anchor_at, clock_timestamp() as current_time,
            e.invalidated_at is null and a.email_confirmed_at is not null
              and coalesce(cp.email_enabled,false) and coalesce(up.email_enabled,false)
              and notification_private.allowed(n.organization_id,n.user_id,e.kind,e.target_id)
              and not notification_private.is_muted(n.organization_id,n.user_id,e.kind)
              and (e.anchor_at is null or e.anchor_at>clock_timestamp())
              and (e.anchor_at is null or exists(select 1 from public.appointments b
                where b.organization_id=n.organization_id and b.id=e.target_id
                  and b.starts_at=e.anchor_at and b.status='confirmed')) as eligible,
            coalesce(cp.quiet_from,-1) as quiet_from, coalesce(cp.quiet_until,-1) as quiet_until,
            public.phase12_zone(n.organization_id) as zone
          from notification_private.mail_queue q
          join public.notification_receipts n on n.id=q.receipt_id
          join notification_private.events e on e.id=n.event_id
          left join auth.users a on a.id=n.user_id
          left join public.notification_clinic_preferences cp on cp.organization_id=n.organization_id
          left join public.notification_user_preferences up on up.organization_id=n.organization_id and up.user_id=n.user_id
          where n.organization_id=$1 and q.status in ('queued','retry') and q.next_attempt_at<=clock_timestamp()
          order by q.next_attempt_at,q.id limit 1 for update of q skip locked`, [org.organization_id]);
        if (!job) continue;
        if (!job.eligible || !syntheticEmail.test(job.email)) {
          await db.query("update notification_private.mail_queue set status='cancelled',completed_at=clock_timestamp() where id=$1", [job.id]);
          return "cancelled";
        }

        const { rows: [quiet] } = await db.query(`
          with wall as (select $1::timestamptz at time zone $2 as local_clock)
          select case
            when $3::int<0 or $4::int<0 then null
            when $3<$4 and local_clock::time >= make_interval(mins=>$3)::time
              and local_clock::time < make_interval(mins=>$4)::time
              then (local_clock::date + make_interval(mins=>$4)) at time zone $2
            when $3>$4 and local_clock::time >= make_interval(mins=>$3)::time
              then (local_clock::date + 1 + make_interval(mins=>$4)) at time zone $2
            when $3>$4 and local_clock::time < make_interval(mins=>$4)::time
              then (local_clock::date + make_interval(mins=>$4)) at time zone $2
            else null end as opens_at from wall`, [job.current_time, job.zone, job.quiet_from, job.quiet_until]);
        if (quiet.opens_at) {
          if (job.anchor_at && job.anchor_at <= quiet.opens_at) {
            await db.query("update notification_private.mail_queue set status='cancelled',completed_at=clock_timestamp() where id=$1", [job.id]);
            return "cancelled";
          }
          await db.query("update notification_private.mail_queue set next_attempt_at=$2 where id=$1", [job.id, quiet.opens_at]);
          return "deferred";
        }

        const delivered = await provider.deliver({ id: job.id, to: job.email, kind: job.kind });
        const attempt = job.attempts + 1;
        await db.query("insert into notification_private.mail_attempts(queue_id,attempt,result) values ($1,$2,$3)",
          [job.id, attempt, delivered.result]);
        if (delivered.id) {
          await db.query(`update notification_private.mail_queue
            set status='sent',attempts=$2,provider_receipt=$3,completed_at=clock_timestamp() where id=$1`,
            [job.id, attempt, delivered.id]);
          return "accepted";
        }
        if (attempt > retryMinutes.length) {
          await db.query("update notification_private.mail_queue set status='failed',attempts=$2,completed_at=clock_timestamp() where id=$1", [job.id, attempt]);
          return "failed";
        }
        await db.query(`update notification_private.mail_queue set status='retry',attempts=$2,
          next_attempt_at=clock_timestamp()+make_interval(mins=>$3) where id=$1`, [job.id, attempt, retryMinutes[attempt - 1]]);
        return "retry";
      }
      return null;
    });
    if (!result) break;
    totals[result] += 1;
  }
  return totals;
}
