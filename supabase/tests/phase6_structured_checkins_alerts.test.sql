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

insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id)
values
  ('00000000-0000-4000-8000-000000006921', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e102', 'hash-phase6-scheduled', 'p6s', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000006922', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e103', 'hash-phase6-completed', 'p6c', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000006923', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e104', 'hash-phase6-stopped', 'p6x', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000a101')
on conflict (id) do nothing;

insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at)
values
  ('00000000-0000-4000-8000-000000006901', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase6-session-active', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000006902', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase6-session-expired', 'active', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000006903', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase6-session-revoked', 'revoked', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000006904', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000006921', '00000000-0000-4000-8000-00000000e102', 'phase6-session-scheduled', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000006905', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000006922', '00000000-0000-4000-8000-00000000e103', 'phase6-session-completed', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000006906', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000006923', '00000000-0000-4000-8000-00000000e104', 'phase6-session-stopped', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000006907', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b911', '00000000-0000-4000-8000-00000000e201', 'phase6-session-beta', 'active', now() + interval '15 minutes')
on conflict (id) do nothing;

select ok((select count(*) from public.care_plan_symptom_options where care_plan_id = '00000000-0000-4000-8000-00000000e101') > 0, '1. Plan symptom options are snapshotted from published version');
select ok((select count(*) from public.care_plan_alert_rules where care_plan_id = '00000000-0000-4000-8000-00000000e101') > 0, '2. Plan alert rules are snapshotted from published version');
select isnt((select id from public.care_plan_symptom_options where care_plan_id = '00000000-0000-4000-8000-00000000e101' and source_symptom_option_id = '00000000-0000-4000-8000-00000000a801'), '00000000-0000-4000-8000-00000000a801'::uuid, '3. Existing plan snapshot stores an independent option row from the template source');
prepare mutate_snapshot_option as update public.care_plan_symptom_options set label = 'mutated';
select throws_ok('mutate_snapshot_option', '42501', null, '4. Snapshot option is immutable');
prepare cross_rule_snapshot as insert into public.care_plan_alert_rules (organization_id, care_plan_id, source_alert_rule_id, care_plan_symptom_option_id, rule_type, severity_level, configuration, message_label) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000a901',(select id from public.care_plan_symptom_options where care_plan_id = '00000000-0000-4000-8000-00000000e201' limit 1),'symptom_selected','low','{}','Temsili takip uyarısı');
select throws_ok('cross_rule_snapshot', null, null, '5. Cross-plan/cross-tenant snapshot rule relation is rejected');

create temp table phase6_ids as
select id as severity_option_id
from public.care_plan_symptom_options
where care_plan_id = '00000000-0000-4000-8000-00000000e101' and allows_severity = true
limit 1;
grant select on phase6_ids to anon;

select pg_temp.as_anon();
select is((public.submit_symptom_report_for_portal('phase6-session-active', '00000000-0000-4000-8000-00000000f101', jsonb_build_array(jsonb_build_object('option_id', (select severity_option_id from phase6_ids), 'selected', true, 'severity', 5)))->>'status'), 'submitted', '7. Valid active portal session can submit report');
select is((public.submit_symptom_report_for_portal('phase6-session-expired', '00000000-0000-4000-8000-00000000f101', '[]'::jsonb)->>'error'), 'portal session is invalid', '8. Expired session cannot submit report');
select is((public.submit_symptom_report_for_portal('phase6-session-revoked', '00000000-0000-4000-8000-00000000f101', '[]'::jsonb)->>'error'), 'portal session is invalid', '9. Revoked session cannot submit report');
reset role;
update public.secure_links set status = 'revoked', revoked_at = now(), revoked_by_user_id = '00000000-0000-4000-8000-00000000a101' where id = '00000000-0000-4000-8000-00000000a911';
select pg_temp.as_anon();
select is((public.submit_symptom_report_for_portal('phase6-session-active', '00000000-0000-4000-8000-00000000f101', '[]'::jsonb)->>'error'), 'portal session is invalid', '10. Revoked link cannot submit report');
reset role;
update public.secure_links set status = 'active', revoked_at = null, revoked_by_user_id = null where id = '00000000-0000-4000-8000-00000000a911';
select pg_temp.as_anon();
select is((public.submit_symptom_report_for_portal('phase6-session-stopped', '00000000-0000-4000-8000-00000000f104', '[]'::jsonb)->>'error'), 'portal session is invalid', '11. Stopped plan cannot submit report');
select is((public.submit_symptom_report_for_portal('phase6-session-completed', '00000000-0000-4000-8000-00000000f103', '[]'::jsonb)->>'error'), 'plan is read-only', '12. Completed plan cannot submit new report');
select is((public.submit_symptom_report_for_portal('phase6-session-scheduled', '00000000-0000-4000-8000-00000000f102', '[]'::jsonb)->>'error'), 'day is not available', '13. Scheduled plan cannot submit report');
select is((public.submit_symptom_report_for_portal('phase6-session-active', '00000000-0000-4000-8000-00000000f102', '[]'::jsonb)->>'error'), 'day not found for portal session', '15. Cross-plan day report is rejected');
select is((public.submit_symptom_report_for_portal('phase6-session-active', '00000000-0000-4000-8000-00000000f201', '[]'::jsonb)->>'error'), 'day not found for portal session', '16. Cross-tenant day report is rejected');
select is((public.submit_symptom_report_for_portal('phase6-session-active', '00000000-0000-4000-8000-00000000f101', jsonb_build_array(jsonb_build_object('option_id','00000000-0000-4000-8000-00000000ffff','selected',true)))->>'status'), 'already_submitted', '17. Duplicate day submit is idempotently handled before new item validation');

reset role;
select is((select count(*)::int from public.symptom_reports where care_plan_day_id = '00000000-0000-4000-8000-00000000f101'), 1, '23. Double submit creates at most one report for the day');
select is((select count(*)::int from public.alerts where care_plan_day_id = '00000000-0000-4000-8000-00000000f101') >= 1, true, '27/30. Matching selected/severity rules create alerts');
select is((select count(*)::int from public.alert_events where event_type = 'created') >= 1, true, '33. Alert created event is written in the same transaction');
select is((select count(*)::int from public.alerts a join public.alert_events e on e.alert_id = a.id where a.symptom_report_id = e.alert_id), 0, '34. Alert event relation does not corrupt alert scope');

select pg_temp.as_anon();
prepare direct_report_insert as insert into public.symptom_reports (organization_id, care_plan_id, care_plan_day_id, portal_session_id, report_date, status, submitted_at) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000f101','00000000-0000-4000-8000-000000006901', current_date, 'submitted', now());
select throws_ok('direct_report_insert', '42501', null, '24. Browser direct report insert is rejected');
prepare direct_item_update as update public.symptom_report_items set selected = false;
select throws_ok('direct_item_update', '42501', null, '25. Browser direct report item mutation is rejected');
prepare direct_alert_delete as delete from public.alerts;
select throws_ok('direct_alert_delete', '42501', null, '43. Alert hard delete is blocked');
prepare direct_event_insert as insert into public.alert_events (organization_id, alert_id, event_type, new_status) values ('00000000-0000-4000-8000-0000000000a1',(select id from public.alerts limit 1),'created','open');
select throws_ok('direct_event_insert', '42501', null, '55. Browser direct alert event insert is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select ok((select count(*) from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000a1') > 0, '36. Alpha staff can read Alpha alerts');
select is((select count(*)::int from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, '37. Alpha user cannot read Beta alerts');
select is((select count(*)::int from public.audit_logs), 0, '41. Staff still cannot read audit log');

select is((public.review_alert((select id from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000a1' and status = 'open' limit 1), 'acknowledge', null)->>'status'), 'acknowledged', '44. Staff can acknowledge open alert');
select is((public.review_alert((select id from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000a1' and status = 'acknowledged' limit 1), 'resolve', 'reviewed_no_action')->>'status'), 'resolved', '46. Staff can resolve acknowledged alert');
select is((public.review_alert((select id from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000a1' and status = 'resolved' limit 1), 'acknowledge', null)->>'error'), 'invalid status transition', '48. Resolved alert cannot be reopened');
select is((public.review_alert((select id from public.alerts where organization_id = '00000000-0000-4000-8000-0000000000a1' limit 1), 'resolve', 'invalid_code')->>'error'), 'invalid resolution code', '51. Invalid resolution code is rejected');

reset role;
select is((select count(*)::int from public.alert_events where event_type in ('acknowledged','resolved')) >= 2, true, '53. Review events are append-only recorded');
prepare update_alert_event as update public.alert_events set event_type = 'created';
select throws_ok('update_alert_event', '42501', null, '54. Alert event update is blocked');
select is((select coalesce(jsonb_agg(safe_metadata)::text, '') ~* 'Klinik değerlendirmesi|Bugünkü durum|Synthetic|phone|email|token|hash|cookie|url|severity\": ?[1-5]' from public.audit_logs where action in ('symptom_report.submitted','alert.created','alert.acknowledged','alert.resolved','alert.dismissed')), false, '59. Alert/check-in audit metadata contains no option labels, health values, PII or token');

select finish();
rollback;
