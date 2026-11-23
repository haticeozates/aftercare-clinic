begin;
select no_plan();

select ok(
  not has_column_privilege('authenticated', 'public.secure_links', 'token_hash', 'SELECT')
  and not has_column_privilege('anon', 'public.secure_links', 'token_hash', 'SELECT')
  and has_column_privilege('authenticated', 'public.secure_links', 'expires_at', 'SELECT'),
  'Link metadata remains readable while token hashes are private'
);

select ok(
  not has_column_privilege('authenticated', 'public.care_plans', 'end_date', 'UPDATE'),
  'Browser cannot extend the plan window used to issue links'
);

select ok(
  not has_function_privilege('anon', sensitive_rpc, 'EXECUTE')
  and not has_function_privilege('authenticated', sensitive_rpc, 'EXECUTE')
  and has_function_privilege('service_role', sensitive_rpc, 'EXECUTE'),
  sensitive_rpc || ' is callable only through the server role'
)
from unnest(array[
  'public.validate_secure_link_hash(text)',
  'public.create_portal_session_for_link(text, text, timestamptz)',
  'public.validate_portal_session_hash(text)',
  'public.get_portal_plan_for_session(text, uuid)',
  'public.set_portal_task_status(text, uuid, text)',
  'public.submit_symptom_report_for_portal(text, uuid, jsonb)',
  'public.get_portal_document_assignments(text)',
  'public.record_portal_document_event(text, uuid, text)',
  'public.submit_portal_data_request(text, text)',
  'public.get_portal_data_requests(text)',
  'public.create_photo_upload_intent_for_portal(text, uuid, text, integer, text, timestamptz)',
  'public.claim_photo_upload_intent_for_portal(text, uuid)',
  'public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text)'
]) as sensitive_rpc;

set local role anon;
select throws_ok(
  $$select public.create_portal_session_for_link('synthetic-hash', 'synthetic-session')$$,
  '42501', null, 'Anon cannot exchange a known hash for a session'
);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select token_hash from public.secure_links$$,
  '42501', null, 'Staff cannot read a credential even inside their own organization'
);
select throws_ok(
  $$select public.get_portal_plan_for_session('synthetic-session')$$,
  '42501', null, 'Staff cannot bypass the portal cookie through the data API'
);
select is(
  (select count(*)::int from public.secure_links where care_plan_id = '00000000-0000-4000-8000-00000000e201'),
  0, 'Staff cannot see metadata for another organization'
);
select lives_ok(
  $$select public.create_secure_link_for_plan(
    '00000000-0000-4000-8000-00000000e102', 'portfolio-test-link', 'p1', now() + interval '100 years'
  )$$,
  'Authorized staff can issue a link even when an old caller supplies an oversized expiry'
);
select is(
  (select expires_at from public.secure_links where token_prefix = 'p1'),
  ((public.portal_today() + 5)::timestamp at time zone 'Europe/Istanbul'),
  'SQL caps link validity at the end of the third Istanbul day after plan end'
);

reset role;
insert into public.photo_requests (
  id, organization_id, care_plan_id, care_plan_day_id, label, required, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b902', '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000f102',
  'Sentetik tarih sınırı fotoğrafı', false, 'active', '00000000-0000-4000-8000-00000000a101'
);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select isnt(public.create_portal_session_for_link('portfolio-test-link', 'portfolio-test-session',
  now() + interval '30 days'), null, 'Server can exchange an authorized link');
reset role;
select is(
  (select expires_at from public.portal_sessions where session_hash = 'portfolio-test-session'),
  now() + interval '15 minutes',
  'SQL caps oversized session expiry at fifteen minutes'
);
set local role service_role;
select is(public.get_portal_plan_for_session('portfolio-test-session')->>'mode', 'scheduled',
  'Future plan stays locked before its Istanbul start date');
select throws_ok(
  $$select public.create_photo_upload_intent_for_portal(
    'portfolio-test-session', '00000000-0000-4000-8000-00000000b902',
    'image/png', 256, 'incoming/00000000-0000-4000-8000-00000000b903', now() + interval '5 minutes'
  )$$, '42501', 'photo upload day is not available',
  'A future plan cannot obtain photo upload intent by calling the server endpoint'
);

select is(public.get_portal_plan_for_session('portfolio-test-session', '00000000-0000-4000-8000-00000000e201'),
  null, 'Valid session cannot read a different plan');

reset role;
-- Move the synthetic snapshot across the date boundary within this rolled-back test transaction.
select set_config('app.creating_care_plan_snapshot', 'on', true);
update public.care_plans set start_date = public.portal_today(), end_date = public.portal_today()
where id = '00000000-0000-4000-8000-00000000e102';
update public.care_plan_days set scheduled_date = public.portal_today()
where id = '00000000-0000-4000-8000-00000000f102';
select set_config('app.creating_care_plan_snapshot', 'off', true);

set local role service_role;
select is((public.set_portal_task_status(
  'portfolio-test-session', '00000000-0000-4000-8000-00000000a712', 'completed'
)->>'task_status'), 'completed', 'First portal mutation after start activates the due plan');
select is(public.get_portal_plan_for_session('portfolio-test-session')->>'mode', 'active',
  'Due plan opens in active mode');
select is(public.get_portal_plan_for_session('portfolio-test-session')->>'plan_status', 'active',
  'Portal and stored plan status agree after activation');
select is(public.create_photo_upload_intent_for_portal(
  'portfolio-test-session', '00000000-0000-4000-8000-00000000b902',
  'image/png', 256, 'incoming/00000000-0000-4000-8000-00000000b903', now() + interval '5 minutes'
)->>'status', 'created', 'The same photo request accepts an intent on its Istanbul day');


reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e102', 'portfolio-rotated-link', 'p2')$$,
  'Link rotation uses the stored date without an expiry from the browser'
);
reset role;
set local role service_role;
select is(public.get_portal_plan_for_session('portfolio-test-session'), null,
  'Rotation invalidates existing session');
select is(public.create_portal_session_for_link('portfolio-test-link', 'portfolio-replay-session'), null,
  'Server rejects exchange with a rotated link');
select isnt(public.create_portal_session_for_link('portfolio-rotated-link', 'portfolio-new-session'), null,
  'Rotated link opens a new session');

reset role;
set local role authenticated;
select lives_ok($$select public.revoke_secure_link((select id from public.secure_links where token_prefix = 'p2'))$$,
  'Staff can still revoke the new link');
reset role;
set local role service_role;
select is(public.get_portal_plan_for_session('portfolio-new-session'), null,
  'Explicit revoke also invalidates existing sessions');

reset role;
update public.care_plans set start_date = public.portal_today() - 5, end_date = public.portal_today() - 5
where id = '00000000-0000-4000-8000-00000000e102';
set local role authenticated;
select throws_ok(
  $$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e102', 'portfolio-past-plan', 'p3')$$,
  'P0001', 'secure link expiry must be in the future', 'A historical plan outside grace cannot issue a link'
);

reset role;
update public.care_plans set end_date = 'infinity'::date
where id = '00000000-0000-4000-8000-00000000e102';
set local role authenticated;
select throws_ok(
  $$select public.create_secure_link_for_plan('00000000-0000-4000-8000-00000000e102', 'portfolio-infinite-plan', 'p4')$$,
  'P0001', 'secure link requires a finite plan end date', 'Infinite plan end cannot grant infinite link validity'
);

reset role;
select * from finish();
rollback;
