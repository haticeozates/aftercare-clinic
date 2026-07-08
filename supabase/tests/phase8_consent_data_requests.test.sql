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

select has_table('public', 'consent_documents', '1. consent_documents table exists');
select has_table('public', 'consent_document_versions', '2. consent_document_versions table exists');
select has_table('public', 'client_document_assignments', '3. client_document_assignments table exists');
select has_table('public', 'client_document_events', '4. client_document_events table exists');
select has_table('public', 'data_requests', '5. data_requests table exists');
select has_table('public', 'data_request_events', '6. data_request_events table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.consent_documents'::regclass), '7. consent_documents RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.consent_document_versions'::regclass), '8. consent_document_versions RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.client_document_assignments'::regclass), '9. client_document_assignments RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.client_document_events'::regclass), '10. client_document_events RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.data_requests'::regclass), '11. data_requests RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.data_request_events'::regclass), '12. data_request_events RLS enabled');

select ok(
  exists (
    select 1 from public.permissions
    where key in ('consent.read', 'consent.manage', 'data_request.read', 'data_request.manage')
    having count(*) = 4
  ),
  '13. Phase 8 permissions are seeded'
);

select has_function('public', 'publish_consent_document_version', array['uuid'], '14. publish_consent_document_version RPC exists');
select has_function('public', 'record_client_document_event', array['uuid', 'text', 'text'], '15. record_client_document_event RPC exists');
select has_function('public', 'transition_data_request_status', array['uuid', 'text', 'text', 'uuid'], '16. transition_data_request_status RPC exists');

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('publish_consent_document_version', 'record_client_document_event', 'transition_data_request_status')
      and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
    having count(*) = 3
  ),
  '17. Phase 8 RPCs are SECURITY DEFINER with explicit search_path'
);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('publish_consent_document_version', 'record_client_document_event', 'transition_data_request_status')
      and coalesce(p.proacl::text, '') like '{=X/%'
  ),
  0,
  '18. PUBLIC execute is not granted on Phase 8 RPCs'
);

insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values
  ('00000000-0000-4000-8000-000000008101', '00000000-0000-4000-8000-0000000000a1', 'alpha-notice', 'Temsili bilgilendirme', 'notice', 'local_notice', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000008201', '00000000-0000-4000-8000-0000000000b1', 'beta-notice', 'Beta temsili bilgilendirme', 'notice', 'local_notice', 'active', '00000000-0000-4000-8000-00000000b101');

prepare duplicate_document_code as insert into public.consent_documents (
  organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-0000000000a1', 'alpha-notice', 'Duplicate', 'notice', 'local_notice', 'active', '00000000-0000-4000-8000-00000000a101'
);
select throws_ok('duplicate_document_code', '23505', null, '19. Document code is unique within organization');

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, created_by_user_id
) values
  ('00000000-0000-4000-8000-000000008111', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000008101', 1, 'draft', 'Temsili bilgilendirme v1', 'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000008211', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000008201', 1, 'draft', 'Beta temsili bilgilendirme v1', 'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', '00000000-0000-4000-8000-00000000b101');

prepare cross_org_version as insert into public.consent_document_versions (
  organization_id, consent_document_id, version_number, status, title_snapshot, body_text, created_by_user_id
) values (
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000008201', 2, 'draft', 'Cross', 'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.', '00000000-0000-4000-8000-00000000a101'
);
select throws_ok('cross_org_version', null, null, '20. Cross-tenant document/version relation is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((public.publish_consent_document_version('00000000-0000-4000-8000-000000008111')->>'status'), 'published', '21. Owner can publish draft consent document version');
reset role;

prepare mutate_published_version as update public.consent_document_versions set body_text = 'mutated' where id = '00000000-0000-4000-8000-000000008111';
select throws_ok('mutate_published_version', '42501', null, '22. Published consent version body is immutable');
prepare delete_published_version as delete from public.consent_document_versions where id = '00000000-0000-4000-8000-000000008111';
select throws_ok('delete_published_version', '42501', null, '23. Published consent version cannot be deleted');

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-000000008301',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-000000008111',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);

prepare cross_assignment as insert into public.client_document_assignments (
  organization_id, client_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c201',
  '00000000-0000-4000-8000-000000008111',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);
select throws_ok('cross_assignment', null, null, '24. Cross-tenant client assignment is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((public.record_client_document_event('00000000-0000-4000-8000-000000008301', 'notice_acknowledged', 'clinic')->>'status'), 'recorded', '25. Notice acknowledgment event can be recorded');
select is((select count(*)::int from public.client_document_events where assignment_id = '00000000-0000-4000-8000-000000008301' and event_type = 'notice_acknowledged'), 1, '26. Notice acknowledgment is stored as its own event');
select is((select count(*)::int from public.client_document_events where assignment_id = '00000000-0000-4000-8000-000000008301' and event_type like 'consent_%'), 0, '27. Notice acknowledgment is not a consent decision');
select is((public.record_client_document_event('00000000-0000-4000-8000-000000008301', 'consent_accepted', 'clinic')->>'error'), 'invalid event type', '27b. Clinic consent decision events are not accepted by record_client_document_event');
reset role;

prepare update_document_event as update public.client_document_events set event_type = 'consent_accepted';
select throws_ok('update_document_event', '42501', null, '28. Client document events are append-only');
prepare delete_document_event as delete from public.client_document_events;
select throws_ok('delete_document_event', '42501', null, '29. Client document events cannot be deleted');

insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
) values (
  '00000000-0000-4000-8000-000000008401',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000e101',
  'access',
  'submitted',
  'clinic',
  now()
);

prepare cross_data_request as insert into public.data_requests (
  organization_id, client_id, request_type, status, submitted_source, submitted_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c201',
  'access',
  'submitted',
  'clinic',
  now()
);
select throws_ok('cross_data_request', null, null, '30. Cross-tenant data request is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare direct_data_request_update as update public.data_requests set status = 'completed', completed_at = now() where id = '00000000-0000-4000-8000-000000008401';
select throws_ok('direct_data_request_update', '42501', null, '30b. Data request status cannot be changed by direct table update');
select is((public.transition_data_request_status('00000000-0000-4000-8000-000000008401', 'under_review', null, null)->>'status'), 'under_review', '31. Owner can transition submitted request to under_review');
select is((public.transition_data_request_status('00000000-0000-4000-8000-000000008401', 'in_progress', null, null)->>'status'), 'in_progress', '32. Owner can transition under_review request to in_progress');
select is((public.transition_data_request_status('00000000-0000-4000-8000-000000008401', 'completed', 'completed_without_export', null)->>'status'), 'completed', '33. Owner can complete in_progress request with safe resolution code');
select is((public.transition_data_request_status('00000000-0000-4000-8000-000000008401', 'under_review', null, null)->>'error'), 'invalid status transition', '34. Final data request status cannot be reopened');
reset role;

select is((select count(*)::int from public.data_request_events where data_request_id = '00000000-0000-4000-8000-000000008401'), 3, '35. Data request transitions write append-only events');
prepare update_data_request_event as update public.data_request_events set event_type = 'submitted';
select throws_ok('update_data_request_event', '42501', null, '36. Data request events are append-only');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select ok((select count(*)::int from public.consent_documents where organization_id = '00000000-0000-4000-8000-0000000000a1') > 0, '37. Staff can read own organization consent documents');
select is((select count(*)::int from public.consent_documents where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, '38. Staff cannot read other organization consent documents');
prepare staff_create_doc as insert into public.consent_documents (organization_id, code, title, document_kind, purpose_key, status, created_by_user_id) values ('00000000-0000-4000-8000-0000000000a1','staff-doc','Staff doc','notice','local','active','00000000-0000-4000-8000-00000000a103');
select throws_ok('staff_create_doc', '42501', null, '39. Staff cannot manage consent documents');
select is((select count(*)::int from public.data_requests where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, '40. Staff cannot read other organization data requests');
select is((public.transition_data_request_status('00000000-0000-4000-8000-000000008401', 'cancelled', null, null)->>'error'), 'permission denied', '41. Staff cannot manage data request transitions');

select pg_temp.as_anon();
prepare anon_select_documents as select count(*)::int from public.consent_documents;
select throws_ok('anon_select_documents', '42501', null, '42. Anon cannot read consent documents directly');
prepare anon_insert_event as insert into public.client_document_events (organization_id, assignment_id, client_id, document_version_id, event_type, source) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000008301','00000000-0000-4000-8000-00000000c101','00000000-0000-4000-8000-000000008111','consent_accepted','portal');
select throws_ok('anon_insert_event', '42501', null, '43. Portal/anon cannot directly insert consent events');
prepare anon_update_data_request as update public.data_requests set status = 'completed';
select throws_ok('anon_update_data_request', '42501', null, '44. Portal/anon cannot directly update data requests');

reset role;
select is((select coalesce(jsonb_agg(safe_metadata)::text, '') ~* 'Temsili bilgilendirme|hukuki|client|phone|email|request_body|free_text' from public.audit_logs where action in ('consent_version.published','consent.event_recorded','data_request.status_changed')), false, '45. Phase 8 audit metadata contains no document body, request free text or PII');

select finish();
rollback;
