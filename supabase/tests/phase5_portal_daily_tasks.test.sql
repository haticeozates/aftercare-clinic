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

reset role;

insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, revoked_at, revoked_by_user_id, created_by_user_id, created_at)
values
  ('00000000-0000-4000-8000-00000000a921', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e102', 'hash-phase5-scheduled', 'p5s', 'active', now() + interval '3 days', null, null, '00000000-0000-4000-8000-00000000a101', now()),
  ('00000000-0000-4000-8000-00000000a922', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e103', 'hash-phase5-completed', 'p5c', 'active', now() + interval '3 days', null, null, '00000000-0000-4000-8000-00000000a101', now()),
  ('00000000-0000-4000-8000-00000000a923', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e104', 'hash-phase5-stopped', 'p5x', 'active', now() + interval '3 days', null, null, '00000000-0000-4000-8000-00000000a101', now()),
  ('00000000-0000-4000-8000-00000000a924', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e101', 'hash-phase5-revoked', 'p5r', 'revoked', now() + interval '3 days', now() - interval '1 minute', '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101', now()),
  ('00000000-0000-4000-8000-00000000a925', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e101', 'hash-phase5-expired', 'p5e', 'expired', now() - interval '1 minute', null, null, '00000000-0000-4000-8000-00000000a101', now() - interval '2 days')
on conflict (id) do nothing;

insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at)
values
  ('00000000-0000-4000-8000-00000000f901', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase5-session-active', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f902', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a921', '00000000-0000-4000-8000-00000000e102', 'phase5-session-scheduled', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f903', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a922', '00000000-0000-4000-8000-00000000e103', 'phase5-session-completed', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f904', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a923', '00000000-0000-4000-8000-00000000e104', 'phase5-session-stopped', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f905', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase5-session-expired', 'active', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-00000000f906', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase5-session-revoked', 'revoked', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f907', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a924', '00000000-0000-4000-8000-00000000e101', 'phase5-session-revoked-link', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f908', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a925', '00000000-0000-4000-8000-00000000e101', 'phase5-session-expired-link', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f909', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b911', '00000000-0000-4000-8000-00000000e201', 'phase5-session-beta', 'active', now() + interval '15 minutes')
on conflict (id) do nothing;

select pg_temp.as_anon();

select is((public.get_portal_plan_for_session('phase5-session-active')->>'plan_status'), 'active', 'Valid portal session opens linked active plan');
select is((public.get_portal_plan_for_session('phase5-session-active', '00000000-0000-4000-8000-00000000e201'::uuid)) is null, true, 'Session cannot be used for another plan');
select is(public.get_portal_plan_for_session('phase5-session-expired') is null, true, 'Expired session cannot open plan');
select is(public.get_portal_plan_for_session('phase5-session-revoked') is null, true, 'Revoked session cannot open plan');
select is(public.get_portal_plan_for_session('phase5-session-revoked-link') is null, true, 'Revoked secure link invalidates linked session');
select is(public.get_portal_plan_for_session('phase5-session-expired-link') is null, true, 'Expired secure link invalidates linked session');
select is(public.get_portal_plan_for_session('phase5-session-stopped') is null, true, 'Stopped plan closes portal access');
select is((public.get_portal_plan_for_session('phase5-session-completed')->>'mode'), 'readonly', 'Completed plan opens read-only');

prepare direct_session_read as select count(*)::int from public.portal_sessions;
select throws_ok('direct_session_read', '42501', null, 'Portal session rows are not browser-readable');

select is((public.get_portal_plan_for_session('phase5-session-active') ? 'client_full_name'), false, 'Portal response excludes client full name');
select is((public.get_portal_plan_for_session('phase5-session-active')::text ~* 'phone|email|Synthetic Alpha|Alpha Procedure|source_template|secure_link|session_hash|token'), false, 'Portal response excludes PII, internal IDs, token and template source fields');
select is(jsonb_array_length(public.get_portal_plan_for_session('phase5-session-active')->'days'), 1, 'Portal returns only linked plan days');
select is((public.get_portal_plan_for_session('phase5-session-active')->'days'->0->>'day_number'), '1', 'Portal returns current plan day');
select is(jsonb_array_length(public.get_portal_plan_for_session('phase5-session-active')->'days'->0->'tasks'), 1, 'Portal returns only linked plan tasks');
select is((public.get_portal_plan_for_session('phase5-session-beta')->>'plan_status'), 'active', 'Beta portal session opens only Beta plan');

select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a711', 'completed')->>'task_status'), 'completed', 'Available current-day task can be completed');
reset role;
select is((select status from public.care_plan_tasks where id = '00000000-0000-4000-8000-00000000a711'), 'completed', 'Completion updates task status');
select isnt((select completed_at from public.care_plan_tasks where id = '00000000-0000-4000-8000-00000000a711'), null, 'Completion sets completed_at');
select pg_temp.as_anon();
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a711', 'pending')->>'task_status'), 'pending', 'Completed task can be reopened to pending');
reset role;
select is((select completed_at from public.care_plan_tasks where id = '00000000-0000-4000-8000-00000000a711'), null, 'Reopen clears completed_at');

select pg_temp.as_anon();
select is((public.set_portal_task_status('phase5-session-scheduled', '00000000-0000-4000-8000-00000000a712', 'completed')->>'error'), 'task is not currently available', 'Scheduled plan task cannot be completed');
select is((public.set_portal_task_status('phase5-session-stopped', '00000000-0000-4000-8000-00000000a714', 'completed')->>'error'), 'portal session is invalid', 'Stopped plan task cannot be completed');
select is((public.set_portal_task_status('phase5-session-completed', '00000000-0000-4000-8000-00000000a713', 'completed')->>'error'), 'plan is read-only', 'Completed plan task cannot be changed');
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000b711', 'completed')->>'error'), 'task not found for portal session', 'Cross-tenant task cannot be changed');
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a712', 'completed')->>'error'), 'task not found for portal session', 'Cross-plan task cannot be changed');
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000ffff', 'completed')->>'error'), 'task not found for portal session', 'Invalid task ID returns generic task error');
select throws_ok($$select public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a711', 'skipped')$$, 'P0001', 'unsupported task status transition', 'Portal cannot set skipped status');

prepare direct_task_update as update public.care_plan_tasks set status = 'completed' where id = '00000000-0000-4000-8000-00000000a711';
select throws_ok('direct_task_update', '42501', null, 'Direct browser task update is rejected');
reset role;
select is((select title from public.care_plan_tasks where id = '00000000-0000-4000-8000-00000000a711'), 'Klinik tarafından yapılandırılmış temsili günlük görev', 'Task immutable title remains unchanged');

select is((select count(*)::int from public.care_plan_task_events where care_plan_task_id = '00000000-0000-4000-8000-00000000a711' and event_type = 'completed'), 1, 'Completion event is created');
select is((select count(*)::int from public.care_plan_task_events where care_plan_task_id = '00000000-0000-4000-8000-00000000a711' and event_type = 'reopened'), 1, 'Reopen event is created');
select is((select bool_and(organization_id = '00000000-0000-4000-8000-0000000000a1' and care_plan_id = '00000000-0000-4000-8000-00000000e101' and care_plan_day_id = '00000000-0000-4000-8000-00000000f101' and portal_session_id = '00000000-0000-4000-8000-00000000f901') from public.care_plan_task_events where care_plan_task_id = '00000000-0000-4000-8000-00000000a711'), true, 'Task events carry correct plan/day/task/session scope');

select pg_temp.as_anon();
prepare direct_event_insert as insert into public.care_plan_task_events (organization_id, care_plan_id, care_plan_day_id, care_plan_task_id, portal_session_id, event_type) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000f101','00000000-0000-4000-8000-00000000a711','00000000-0000-4000-8000-00000000f901','completed');
select throws_ok('direct_event_insert', '42501', null, 'Browser direct task event insert is rejected');
prepare direct_event_update as update public.care_plan_task_events set event_type = 'reopened';
select throws_ok('direct_event_update', '42501', null, 'Task event update is rejected');
prepare direct_event_delete as delete from public.care_plan_task_events;
select throws_ok('direct_event_delete', '42501', null, 'Task event delete is rejected');
reset role;
select is((select count(*)::int from public.care_plan_task_events where event_type in ('completed', 'reopened')), 2, 'Double-submit/idempotent transitions do not create unexpected extra events');
select is((select row_to_json(e)::text ~* 'phone|email|token|cookie|Klinik tarafından' from public.care_plan_task_events e limit 1), false, 'Task event rows contain no PII, token, cookie, or task content');

select is((select status from public.care_plan_days where id = '00000000-0000-4000-8000-00000000f101'), 'available', 'Required task reopen keeps day available');
select pg_temp.as_anon();
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a711', 'completed')->>'day_status'), 'completed', 'All required tasks completed marks day completed');
select is((public.set_portal_task_status('phase5-session-active', '00000000-0000-4000-8000-00000000a711', 'pending')->>'day_status'), 'available', 'Required task reopen marks day available');
reset role;
select is((select status from public.care_plan_days where id = '00000000-0000-4000-8000-00000000f102'), 'pending', 'Future day remains pending');
select is((select status from public.care_plans where id = '00000000-0000-4000-8000-00000000e101'), 'active', 'Portal task completion does not auto-complete plan');

select is((select count(*)::int from public.audit_logs where action = 'portal.viewed' and entity_type = 'plan') >= 3, true, 'portal.viewed audit is created for valid portal data reads');
select is((select count(*)::int from public.audit_logs where action = 'portal.task_completed'), 2, 'portal.task_completed audit is created');
select is((select count(*)::int from public.audit_logs where action = 'portal.task_reopened'), 2, 'portal.task_reopened audit is created');
select is((select count(*)::int from public.audit_logs where action in ('portal.task_change_denied','portal.future_task_denied','portal.plan_inactive_denied')) >= 1, true, 'Denied task mutation creates safe audit event when organization is known');
select is((select coalesce(jsonb_agg(safe_metadata)::text, '') ~* 'Klinik tarafından|Merkez tarafından|Synthetic|phone|email|token|hash|cookie|url' from public.audit_logs where action like 'portal.%'), false, 'Portal audit metadata contains no PII, token, URL, or task content');

select pg_temp.as_anon();
prepare direct_audit_insert as insert into public.audit_logs (organization_id, actor_type, action, entity_type, result) values ('00000000-0000-4000-8000-0000000000a1','system','portal.viewed','plan','success');
select throws_ok('direct_audit_insert', '42501', null, 'Browser direct audit insert remains blocked');
prepare direct_audit_update as update public.audit_logs set action = 'portal.viewed';
select throws_ok('direct_audit_update', '42501', null, 'Browser audit update remains blocked');
prepare direct_audit_delete as delete from public.audit_logs;
select throws_ok('direct_audit_delete', '42501', null, 'Browser audit delete remains blocked');

select finish();
rollback;
