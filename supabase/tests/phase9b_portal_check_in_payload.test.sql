begin;

select plan(14);

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

insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at)
values
  ('00000000-0000-4000-8000-00000000f951', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase9b-session-active', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000f952', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase9b-session-expired', 'active', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-00000000f953', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase9b-session-revoked', 'revoked', now() + interval '15 minutes')
on conflict (id) do nothing;

create temp table phase9b_checkin_option as
select id as option_id
from public.care_plan_symptom_options
where care_plan_id = '00000000-0000-4000-8000-00000000e101'
  and allows_severity = true
limit 1;
grant select on phase9b_checkin_option to anon, service_role;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');

insert into public.care_template_tasks (
  id,
  organization_id,
  template_day_id,
  title,
  task_type,
  required,
  display_order
)
values (
  '00000000-0000-4000-8000-000000009901',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000a682',
  'Phase9B empty check-in task',
  'information',
  false,
  1
)
on conflict (id) do nothing;

select public.publish_care_template_version('00000000-0000-4000-8000-00000000a582');

create temp table phase9b_empty_plan as
select public.create_care_plan_from_template(
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000d102',
  '00000000-0000-4000-8000-00000000a402',
  '00000000-0000-4000-8000-00000000a582',
  current_date,
  null,
  null
) as plan_id;

select public.create_secure_link_for_plan(
  (select plan_id from phase9b_empty_plan),
  'hash-phase9b-empty-checkin',
  'p9c',
  now() + interval '3 days'
);

set local role service_role;
select public.create_portal_session_for_link(
  'hash-phase9b-empty-checkin',
  'phase9b-session-empty',
  now() + interval '15 minutes'
);

select ok(
  public.get_portal_plan_for_session('phase9b-session-active') ? 'check_in',
  '1. Valid portal session returns check_in payload'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(public.get_portal_plan_for_session('phase9b-session-active')->'check_in') as key
  ),
  array['options', 'submitted_day_ids']::text[],
  '2. check_in exposes only allowlisted top-level keys'
);

select is(
  jsonb_array_length(public.get_portal_plan_for_session('phase9b-session-active')->'check_in'->'submitted_day_ids'),
  0,
  '3. submitted_day_ids is empty before portal check-in mutation'
);

select ok(
  jsonb_array_length(public.get_portal_plan_for_session('phase9b-session-active')->'check_in'->'options') > 0,
  '4. Active plan returns structured check-in options'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(public.get_portal_plan_for_session('phase9b-session-active')->'check_in'->'options'->0) as key
  ),
  array['allows_severity', 'display_order', 'id', 'label']::text[],
  '5. Check-in options expose only allowlisted fields'
);

select is(
  (public.get_portal_plan_for_session('phase9b-session-active')->'check_in')::text ~* 'organization_id|normalized_label|source_symptom_option|allows_note|"active"|session_hash|token|Synthetic Alpha|00000000-0000-4000-8000-0000000000b1',
  false,
  '6. check_in payload excludes internal ids, tokens and cross-tenant data'
);

select is(
  public.get_portal_plan_for_session('phase9b-session-active')->'check_in'->'options'->0->>'label',
  'Klinik değerlendirmesi için temsili durum',
  '7. Structured check-in option label is returned for portal UI'
);

select is(
  (public.submit_symptom_report_for_portal(
    'phase9b-session-active',
    '00000000-0000-4000-8000-00000000f101',
    jsonb_build_array(
      jsonb_build_object(
        'option_id', (select option_id from phase9b_checkin_option),
        'selected', true,
        'severity', 5
      )
    )
  )->>'status'),
  'submitted',
  '8. Portal check-in mutation succeeds for active session'
);

select ok(
  public.get_portal_plan_for_session('phase9b-session-active')->'check_in'->'submitted_day_ids' ? '00000000-0000-4000-8000-00000000f101',
  '9. RPC payload includes submitted day id after portal check-in mutation'
);

select is(
  public.get_portal_plan_for_session('phase9b-session-expired'),
  null,
  '10. Expired portal session cannot read check-in payload'
);

select is(
  public.get_portal_plan_for_session('phase9b-session-revoked'),
  null,
  '11. Revoked portal session cannot read check-in payload'
);

select is(
  public.get_portal_plan_for_session('phase9b-session-empty')->'check_in'->'options',
  '[]'::jsonb,
  '12. Plan without symptom snapshot returns empty options array'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.get_portal_plan_for_session(text, uuid)'::regprocedure
  ),
  '13. get_portal_plan_for_session remains SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.get_portal_plan_for_session(text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_portal_plan_for_session(text, uuid)', 'execute'),
  '14. get_portal_plan_for_session execute is granted to the server role and revoked from anon'
);

select finish();
rollback;
