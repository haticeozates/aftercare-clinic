begin;
select no_plan();

create function pg_temp.fixture(suffix text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000' || suffix)::uuid
$$;
create function pg_temp.member(suffix text) returns uuid language sql stable security definer set search_path='' as $$
  select id from public.organization_memberships where user_id=pg_temp.fixture(suffix) and status='active'
$$;
create function pg_temp.report(member_id uuid default null, service_id uuid default null, item_status text default null, download boolean default false)
returns jsonb language sql as $$
  select public.phase15_report(pg_temp.fixture('00a1'),'custom','2030-03-31','2030-03-31',member_id,service_id,item_status,'day',download)
$$;

insert into public.phase11_clinic_settings(organization_id,address,phone,time_zone)
values(pg_temp.fixture('00a1'),'','','Europe/London')
on conflict(organization_id) do update set time_zone=excluded.time_zone;

insert into public.appointments (organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone)
select pg_temp.fixture('00a1'),pg_temp.fixture('c101'),pg_temp.fixture('d101'),pg_temp.member(who),source,kind,status,
  begins,begins+interval '30 minutes','Europe/London'
from (values
  ('a103','clinic','procedure','completed','2030-03-31 00:00Z'::timestamptz),
  ('a103','clinic','follow_up','confirmed','2030-03-31 08:30Z'::timestamptz),
  ('a103','online_demo','procedure','cancelled','2030-03-31 10:00Z'::timestamptz),
  ('a103','clinic','procedure','no_show','2030-03-31 12:00Z'::timestamptz),
  ('a101','online_demo','procedure','pending','2030-03-31 13:00Z'::timestamptz),
  ('a101','clinic','procedure','completed','2030-03-31 23:00Z'::timestamptz),
  ('a101','clinic','procedure','completed','2030-03-30 23:30Z'::timestamptz)
) v(who,source,kind,status,begins);

insert into public.appointments(organization_id,client_id,procedure_id,membership_id,source,kind,status,starts_at,ends_at,time_zone)
values(pg_temp.fixture('00b1'),pg_temp.fixture('c201'),pg_temp.fixture('d201'),pg_temp.member('b101'),'clinic','procedure',
  'completed','2030-03-31 08:30Z','2030-03-31 09:00Z','Europe/Istanbul');

insert into public.appointment_availability(organization_id,membership_id,weekday,kind,start_minute,end_minute)
values(pg_temp.fixture('00a1'),null,7,'work',540,1020),
      (pg_temp.fixture('00a1'),pg_temp.member('a103'),7,'work',540,1020),
      (pg_temp.fixture('00a1'),null,7,'break',720,780);

select set_config('request.jwt.claim.sub',pg_temp.fixture('a101')::text,true);
set local role authenticated;
select is(pg_temp.report()#>>'{current,appointments,total}','5','Clinic zone uses a half-open DST day and excludes the second tenant');
select is(pg_temp.report()#>>'{previous,appointments,total}','1','Equivalent prior day picks only the correct appointment');
select is(pg_temp.report()#>>'{current,appointments,terminal}','3','Only completed, cancelled and no-show form the rate denominator');
select is(pg_temp.report()#>>'{current,appointments,cancelled}','1','Cancelled numerator is exact');
select is(pg_temp.report()#>>'{current,appointments,no_show}','1','No-show numerator is exact');
select is(pg_temp.report()#>>'{current,appointments,pending}','1','Pending count is exact');
select is(pg_temp.report()#>>'{current,appointments,follow_ups}','1','Follow-up cohort remains in the period');
select is(pg_temp.report()#>>'{current,source,online_demo}','2','Online and clinic source groups meet population total');
select is(pg_temp.report()#>>'{current,trend,0,1}','5','Trend totals equal the source cohort');
select is((select (cell->>2)::int from jsonb_array_elements(pg_temp.report()#>'{current,heat}') cell
  where (cell->>0)::int=7 and (cell->>1)::int=9),1,'Hour map uses actual clinic wall time');
select is(pg_temp.report(pg_temp.member('a103'))#>>'{current,appointments,total}','4','Manager can filter by specialist');
select is(pg_temp.report(null,null,'completed')#>>'{current,appointments,total}','1','Appointment status applies to flow counts');
select is((pg_temp.report()#>>'{capacity,minutes}')::numeric,420::numeric,'Capacity intersects clinic and practitioner work then removes breaks');
select is((pg_temp.report()#>>'{capacity,reserved}')::numeric,30::numeric,'Only reserved time within configured capacity counts');
select is(pg_temp.report(null,pg_temp.fixture('d101'))#>>'{capacity}',null,'Procedure-filtered capacity is unavailable rather than misleading');
select ok(pg_temp.report()#>>'{snapshot,plans,active}' is not null,'Snapshot remains available regardless of report dates');
select is(pg_temp.report()#>>'{current,tasks,due}','0','Future plan tasks do not enter the due denominator');
select is(pg_temp.report()#>>'{current,checkins,due}','0','Future plan days are excluded from check-in denominator');
select throws_ok($$select pg_temp.report(pg_temp.member('b101'))$$,'42501',null,'Foreign specialist is rejected');
select throws_ok($$select pg_temp.report(null,pg_temp.fixture('d201'))$$,'42501',null,'Foreign procedure is rejected');
select throws_ok($$select public.phase15_report(pg_temp.fixture('00a1'),'custom','2028-01-01','2030-01-01',null,null,null,'day')$$,
  '22023',null,'Unbounded custom report is rejected in PostgreSQL');
select lives_ok($$select pg_temp.report(null,null,null,true)$$,'Owner may export a filtered aggregate and audit it');
select throws_ok($$select * from analytics_private.csv_exports$$,'42501',null,'Browser cannot read audit rows');
select throws_ok($$select analytics_private.period(pg_temp.fixture('00b1'),'2030-03-31','2030-03-31','Europe/Istanbul',null,null,null,'day',true)$$,
  '42501',null,'Browser cannot call unguarded aggregation internals');

select set_config('request.jwt.claim.sub',pg_temp.fixture('a103')::text,true);
select is(pg_temp.report()#>>'{current,appointments,total}','4','Staff only sees appointments assigned to their membership');
select is(jsonb_array_length(pg_temp.report()->'members'),1,'Staff roster response is limited to their own dimension');
select throws_ok($$select pg_temp.report(pg_temp.member('a101'))$$,'42501',null,'Staff cannot widen their specialist filter');
select throws_ok($$select pg_temp.report(null,null,null,true)$$,'42501',null,'Staff cannot export through direct RPC');

select set_config('request.jwt.claim.sub',pg_temp.fixture('a102')::text,true);
select is(pg_temp.report()#>>'{current,appointments,total}','5','Admin operates on the clinic cohort');
select set_config('request.jwt.claim.sub',pg_temp.fixture('b101')::text,true);
select throws_ok($$select pg_temp.report()$$,'42501',null,'A different tenant cannot request the clinic aggregate');
reset role;
select is((select count(*)::int from analytics_private.csv_exports where organization_id=pg_temp.fixture('00a1')),1,'Audit records only authorized export');

set local role anon;
select throws_ok($$select pg_temp.report()$$,'42501',null,'Anonymous cannot access reports');
reset role;
select * from finish();
rollback;
