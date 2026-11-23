begin;
select no_plan();

create function pg_temp.fixture(tenant text, role_key text default 'organization_owner')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('clinic', o.id,'actor',m.user_id,'member',m.id,'slug',o.slug,
    'client',(select id from public.clients where organization_id=o.id and status='active' order by id limit 1),
    'procedure',(select id from public.procedures where organization_id=o.id and status='active' order by id limit 1))
  from public.organizations o
  join public.organization_memberships m on m.organization_id=o.id
  join public.roles r on r.id=m.role_id
  where o.slug='organization-' || tenant and m.status='active' and r.key=role_key
$$;

create function pg_temp.day_value() returns date language sql stable as $$
  select (now() at time zone 'Europe/Istanbul')::date + 2
$$;

create function pg_temp.when_wall(slot text) returns text language sql stable as $$
  select pg_temp.day_value()::text || 'T' || slot
$$;

create function pg_temp.rule(target jsonb, member text, kind text, starts integer, ends integer) returns void language sql as $$
  select public.phase12_configure((target->>'actor')::uuid,(target->>'clinic')::uuid,'rule',
    jsonb_build_object('membership_id',member,'kind',kind,'start_minute',starts,'end_minute',ends,
      'weekday',case when kind <> 'closed' then extract(isodow from pg_temp.day_value()) end,
      'local_date',case when kind = 'closed' then pg_temp.day_value() end))
$$;

create function pg_temp.write_appt(who jsonb, op text, id uuid, extra jsonb)
returns uuid language sql as $$
  select public.phase12_write((who->>'actor')::uuid,(who->>'clinic')::uuid,op,id,
    jsonb_build_object('client_id',who->>'client','procedure_id',who->>'procedure','membership_id',who->>'member',
      'local_start',pg_temp.when_wall('09:00'),'minutes',30,'kind','procedure') || extra)
$$;

create function pg_temp.provision(target jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.rule(target,null,'work',480,1080);
  perform pg_temp.rule(target,target->>'member','work',480,1080);
  perform public.phase12_configure((target->>'actor')::uuid,(target->>'clinic')::uuid,'service',
    jsonb_build_object('procedure_id',target->>'procedure','minutes',30,'public_demo',true));
  perform public.phase12_configure((target->>'actor')::uuid,(target->>'clinic')::uuid,'public','{"public_demo":true}');
end
$$;

create function pg_temp.find_appointment(tenant text, local_hour text) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.id from public.appointments a
  where a.organization_id = (pg_temp.fixture(tenant)->>'clinic')::uuid
    and a.starts_at = (pg_temp.when_wall(local_hour)::timestamp at time zone 'Europe/Istanbul')
  order by a.created_at desc limit 1
$$;

create function pg_temp.request(target jsonb, local_hour text) returns void language sql as $$
  select public.phase12_request(target->>'slug', jsonb_build_object('procedure_id',target->>'procedure',
    'membership_id',target->>'member','starts_at',pg_temp.when_wall(local_hour)::timestamp at time zone 'Europe/Istanbul',
    'reference','DEMO-1250'))
$$;

set local role service_role;
select lives_ok($$select pg_temp.provision(pg_temp.fixture('alpha'))$$,'Owner configures clinic, staff and service');
select lives_ok($$select pg_temp.provision(pg_temp.fixture('beta'))$$,'Second tenant configures its own same hours');
select throws_ok($$select pg_temp.provision(pg_temp.fixture('alpha','staff'))$$,'42501',null,'Staff cannot configure availability');
select lives_ok($$select pg_temp.rule(pg_temp.fixture('alpha'),null,'break',720,780)$$,'Weekly break is recorded');
select lives_ok($$select pg_temp.rule(pg_temp.fixture('alpha'),pg_temp.fixture('alpha')->>'member','closed',900,960)$$,'Specialist leave is recorded');

select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,
  jsonb_build_object('local_start',pg_temp.when_wall('07:45')))$$,'22023',null,'Start before working hours is rejected');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,
  jsonb_build_object('local_start',pg_temp.when_wall('11:45')))$$,'22023',null,'Appointment cannot cross the start of a break');
select throws_ok($$select pg_temp.request(pg_temp.fixture('alpha'),'15:15')$$,'22023',null,'Online request cannot overlap leave');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,
  jsonb_build_object('membership_id',pg_temp.fixture('beta')->>'member'))$$,'42501',null,'Appointment cannot assign a different clinic specialist');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha','staff'),'create',null,
  jsonb_build_object('membership_id',pg_temp.fixture('alpha')->>'member'))$$,'42501',null,'Staff cannot assign another member');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,'{}')$$,'Clinic confirms staff booking at a valid time');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('beta'),'create',null,'{}')$$,'Different clinic can reserve the same window');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,
  jsonb_build_object('local_start',pg_temp.when_wall('09:15')))$$,'23P01',null,'Same specialist cannot have overlapping reservations');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'create',null,
  jsonb_build_object('local_start',pg_temp.when_wall('09:30')))$$,'Half-open intervals permit adjacent bookings');

select lives_ok($$select pg_temp.request(pg_temp.fixture('alpha'),'10:00')$$,'Synthetic visitor can request available appointment');
select throws_ok($$select pg_temp.request(pg_temp.fixture('alpha'),'10:00')$$,'23P01',null,'Pending online request holds the slot');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'status',pg_temp.find_appointment('alpha','10:00'),
  '{"status":"completed"}')$$,'22023',null,'Pending appointment cannot go directly to completed');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'status',pg_temp.find_appointment('alpha','10:00'),
  '{"status":"confirmed"}')$$,'Matching tenant client and manager confirm incoming request');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'status',pg_temp.find_appointment('alpha','10:00'),
  '{"status":"completed"}')$$,'22023',null,'Future confirmation cannot be marked completed');
select throws_ok($$select pg_temp.write_appt(pg_temp.fixture('beta'),'status',pg_temp.find_appointment('alpha','10:00'),
  '{"status":"cancelled"}')$$,'42501',null,'A different tenant cannot cancel an appointment');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'edit',pg_temp.find_appointment('alpha','10:00'),
  jsonb_build_object('local_start',pg_temp.when_wall('10:30')))$$,'Manager can reschedule to a free slot');
select lives_ok($$select pg_temp.write_appt(pg_temp.fixture('alpha'),'status',pg_temp.find_appointment('alpha','10:30'),
  '{"status":"cancelled"}')$$,'Manager cancels the confirmed rescheduled appointment');
select lives_ok($$select pg_temp.request(pg_temp.fixture('alpha'),'10:30')$$,'Cancellation releases the slot');

select is((public.phase12_catalog(pg_temp.fixture('alpha')->>'slug'))->>'name','Organization Alpha','Public catalog exposes opted-in clinic name');
select ok(not (public.phase12_catalog(pg_temp.fixture('alpha')->>'slug'))::text ~ 'Alpha Owner|client|email|phone|notes',
  'Catalog never returns private clinical or person details');

reset role;
select is((select count(*)::int from public.appointment_events e where e.appointment_id = (
  select a.id from public.appointments a where a.organization_id = (pg_temp.fixture('alpha')->>'clinic')::uuid
    and a.status = 'cancelled' limit 1)),4,'Request, approval, reschedule and cancellation remain in audit history');
select is((select count(*)::int from public.appointments where client_id is null and status = 'pending'),1,'Public request does not manufacture a client');

-- A clinic zone change keeps stored instants intact and changes only interpretation.
set local role service_role;
select lives_ok($$select public.phase11_update_clinic((pg_temp.fixture('alpha')->>'actor')::uuid,
  (pg_temp.fixture('alpha')->>'clinic')::uuid,'Organization Alpha','Alpha Owner','','','Europe/London')$$,
  'Manager can change the calendar time zone');
select is((public.phase12_catalog(pg_temp.fixture('alpha')->>'slug'))->>'zone','Europe/London',
  'The current organization zone is used for new availability');
reset role;
select is((select time_zone from public.appointments where id=pg_temp.find_appointment('alpha','09:00')),
  'Europe/Istanbul','Existing appointment keeps its original stored zone snapshot and instant');

select set_config('request.jwt.claim.sub',pg_temp.fixture('alpha')->>'actor',true);
set local role authenticated;
select is((select count(*)::int from public.appointments where organization_id=(pg_temp.fixture('beta')->>'clinic')::uuid),0,
  'Authenticated RLS excludes other tenants');
select ok((select count(*) from public.appointments)>0,'Authorized tenant can read own appointments');
select throws_ok($$update public.appointments set status='completed'$$,'42501',null,'Direct writes cannot bypass the lifecycle');
select throws_ok($$delete from public.appointment_events$$,'42501',null,'Audit events are read-only');
select throws_ok($$select public.phase12_request(pg_temp.fixture('alpha')->>'slug','{}')$$,'42501',null,'Client role cannot invoke public service wrapper directly');

reset role;
set local role anon;
select throws_ok($$select * from public.appointments$$,'42501',null,'Anonymous cannot query appointment data');
select throws_ok($$select public.phase12_catalog('organization-alpha')$$,'42501',null,'Anonymous Data API cannot access even the curated catalog');
reset role;
select * from finish();
rollback;
