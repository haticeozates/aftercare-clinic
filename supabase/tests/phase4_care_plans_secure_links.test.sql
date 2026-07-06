begin;

select no_plan();

create or replace function pg_temp.as_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
end;
$$;

create or replace function pg_temp.as_user(user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.care_plans where organization_id = '00000000-0000-4000-8000-0000000000a1'), 4, 'Alpha owner can read Alpha plans');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select count(*)::int from public.care_plans where organization_id = '00000000-0000-4000-8000-0000000000a1'), 4, 'Alpha admin can read Alpha plans');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.care_plans where organization_id = '00000000-0000-4000-8000-0000000000a1'), 4, 'Alpha staff can read Alpha plans');
select is((select count(*)::int from public.care_plans where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha staff cannot read Beta plans');

select pg_temp.as_anon();
prepare anon_plan_read as select count(*)::int from public.care_plans;
select throws_ok('anon_plan_read', '42501', null, 'Anonymous user cannot read plans');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.care_plans), 0, 'Inactive member cannot read plans');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f001');
select is((select count(*)::int from public.care_plans), 0, 'No-membership user cannot read plans');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.care_plan_days where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha user cannot read Beta plan days');
select is((select count(*)::int from public.care_plan_tasks where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha user cannot read Beta plan tasks');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select lives_ok(
  $$select public.create_care_plan_from_template(
    '00000000-0000-4000-8000-00000000c103',
    '00000000-0000-4000-8000-00000000d101',
    '00000000-0000-4000-8000-00000000a401',
    '00000000-0000-4000-8000-00000000a501',
    current_date,
    null,
    null
  )$$,
  'Staff can create plan from valid published version'
);

select is((select count(*)::int from public.care_plan_days where care_plan_id = (select id from public.care_plans order by created_at desc limit 1)), 1, 'Plan snapshot copies days');
select is((select count(*)::int from public.care_plan_tasks where care_plan_day_id in (select id from public.care_plan_days where care_plan_id = (select id from public.care_plans order by created_at desc limit 1))), 1, 'Plan snapshot copies tasks');
select is((select end_date from public.care_plans order by created_at desc limit 1), current_date, 'Plan end date uses max day number');

select throws_ok(
  $$select public.create_care_plan_from_template(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000d102',
    '00000000-0000-4000-8000-00000000a402',
    '00000000-0000-4000-8000-00000000a582',
    current_date,
    null,
    null
  )$$,
  'P0001',
  'template version must be published',
  'Draft version cannot create plan'
);

select throws_ok(
  $$select public.create_care_plan_from_template(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000d101',
    '00000000-0000-4000-8000-00000000a401',
    '00000000-0000-4000-8000-00000000a502',
    current_date,
    null,
    null
  )$$,
  'P0001',
  'template version must be current published version',
  'Retired version cannot create plan'
);

select throws_ok(
  $$select public.create_care_plan_from_template(
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-00000000d101',
    '00000000-0000-4000-8000-00000000a401',
    '00000000-0000-4000-8000-00000000a501',
    current_date,
    null,
    null
  )$$,
  'P0001',
  'client must be active in organization',
  'Cross-tenant client cannot create plan'
);

select throws_ok(
  $$insert into public.care_plan_days (organization_id, care_plan_id, source_template_day_id, day_number, scheduled_date)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000a601', 99, current_date)$$,
  '42501',
  null,
  'Browser direct plan day insert is blocked'
);

prepare direct_task_update as update public.care_plan_tasks set title = 'Tamper' where organization_id = '00000000-0000-4000-8000-0000000000a1';
select throws_ok('direct_task_update', '42501', null, 'Browser direct task snapshot update is blocked');

prepare status_stopped_to_active as update public.care_plans set status = 'active' where id = '00000000-0000-4000-8000-00000000e104';
select throws_ok('status_stopped_to_active', '42501', null, 'Stopped plan cannot reactivate');

prepare staff_stop_plan as update public.care_plans set status = 'stopped', stopped_at = now(), stopped_by_user_id = '00000000-0000-4000-8000-00000000a103' where id = '00000000-0000-4000-8000-00000000e102';
select lives_ok('staff_stop_plan', 'Staff can stop own organization plan');

prepare source_relation_update as update public.care_plans set client_id = '00000000-0000-4000-8000-00000000c102' where id = '00000000-0000-4000-8000-00000000e101';
select throws_ok('source_relation_update', '42501', null, 'Plan source relations are immutable');

prepare hard_delete_plan as delete from public.care_plans where id = '00000000-0000-4000-8000-00000000e101';
select throws_ok('hard_delete_plan', '42501', null, 'Plan hard delete is blocked');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select lives_ok($$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e101', 'hash-test-a', 'tok', now() + interval '3 days')$$, 'Staff can create secure link for own organization plan');
select is((select count(*)::int from public.secure_links where care_plan_id = '00000000-0000-4000-8000-00000000e101' and status = 'active'), 1, 'Plan has one active link');
select is((select count(*)::int from public.secure_links where token_hash = 'plain-token-value'), 0, 'Plain token is not stored as hash');

select throws_ok($$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e201', 'hash-cross', 'tok', now() + interval '3 days')$$, 'P0001', 'plan not found for organization', 'Cross-tenant plan cannot receive link');
select throws_ok($$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e104', 'hash-stopped', 'tok', now() + interval '3 days')$$, 'P0001', 'stopped plan cannot receive secure link', 'Stopped plan cannot receive link');

select lives_ok($$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e101', 'hash-test-b', 'tok', now() + interval '4 days')$$, 'Second create rotates old link');
select is((select count(*)::int from public.secure_links where care_plan_id = '00000000-0000-4000-8000-00000000e101' and status = 'active'), 1, 'Only one active link per plan');
select is((select status from public.secure_links where token_hash = 'hash-test-a'), 'revoked', 'Old link revoked by rotation');

select is((select public.validate_secure_link_hash('hash-test-b')) is not null, true, 'New token hash validates');
select is((select public.validate_secure_link_hash('hash-test-a')) is null, true, 'Old rotated hash does not validate');

select lives_ok($$select public.revoke_secure_link((select id from public.secure_links where token_hash = 'hash-test-b'))$$, 'Secure link can be revoked');
select is((select public.validate_secure_link_hash('hash-test-b')) is null, true, 'Revoked link does not validate');
select is((select public.validate_secure_link_hash('invalid-hash')) is null, true, 'Invalid hash returns generic null');

select throws_ok($$delete from public.secure_links where token_hash = 'hash-test-b'$$, '42501', null, 'Secure link hard delete is blocked');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.secure_links where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha user cannot read Beta secure links');

select pg_temp.as_anon();
prepare anon_link_read as select count(*)::int from public.secure_links;
select throws_ok('anon_link_read', '42501', null, 'Anon cannot read secure links table');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select lives_ok($$select public.create_portal_session_for_link('hash-seed-beta', 'session-hash-test', now() + interval '15 minutes')$$, 'Valid token can create portal session');
select is((select public.validate_portal_session_hash('session-hash-test')) is not null, true, 'Portal session validates');
select is((select public.validate_portal_session_hash('missing-session')) is null, true, 'Invalid portal session fails');
select pg_temp.as_user('00000000-0000-4000-8000-00000000b101');
select is((select usage_count from public.secure_links where token_hash = 'hash-seed-beta'), 1, 'Validation updates usage count');

select isnt((select safe_metadata::text from public.audit_logs where action in ('plan.created','secure_link.created','secure_link.revoked') order by created_at desc limit 1), '%plain%', 'Audit metadata does not contain raw token text');

prepare audit_update as update public.audit_logs set safe_metadata = '{"tamper":true}'::jsonb where action = 'plan.created';
select throws_ok('audit_update', '42501', null, 'Audit update remains blocked');
prepare audit_insert_browser as insert into public.audit_logs (organization_id, actor_type, action, entity_type, result) values ('00000000-0000-4000-8000-0000000000a1', 'user', 'plan.created', 'plan', 'success');
select throws_ok('audit_insert_browser', '42501', null, 'Browser direct audit insert remains blocked');

select * from finish();

rollback;
