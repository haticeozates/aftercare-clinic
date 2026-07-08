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

reset role;

select has_function('public', 'get_portal_document_assignments', array['text'], '1. get_portal_document_assignments RPC exists');
select has_function('public', 'record_portal_document_event', array['text', 'uuid', 'text'], '2. record_portal_document_event RPC exists');
select has_function('public', 'submit_portal_data_request', array['text', 'text'], '3. submit_portal_data_request RPC exists');
select has_function('public', 'get_portal_data_requests', array['text'], '4. get_portal_data_requests RPC exists');

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_portal_document_assignments', 'record_portal_document_event', 'submit_portal_data_request', 'get_portal_data_requests')
      and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
    having count(*) = 4
  ),
  '5. Portal Phase 8 RPCs are SECURITY DEFINER with explicit search_path'
);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_portal_document_assignments', 'record_portal_document_event', 'submit_portal_data_request', 'get_portal_data_requests')
      and coalesce(p.proacl::text, '') like '{=X/%'
  ),
  0,
  '6. PUBLIC execute is not granted on Phase 8 portal RPCs'
);

insert into public.consent_documents (id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id)
values
  ('00000000-0000-4000-8000-000000009101', '00000000-0000-4000-8000-0000000000a1', 'phase8-portal-notice', 'Temsili portal bilgilendirme', 'notice', 'portal_notice', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009102', '00000000-0000-4000-8000-0000000000a1', 'phase8-portal-consent', 'Temsili portal tercih belgesi', 'consent', 'portal_consent', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009103', '00000000-0000-4000-8000-0000000000a1', 'phase8-portal-draft', 'Taslak görünmemeli', 'notice', 'portal_draft', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009201', '00000000-0000-4000-8000-0000000000b1', 'phase8-beta-notice', 'Beta temsili bilgilendirme', 'notice', 'portal_notice', 'active', '00000000-0000-4000-8000-00000000b101');

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
)
values
  ('00000000-0000-4000-8000-000000009111', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000009101', 1, 'published', 'Temsili bilgilendirme v1', 'Temsili bilgilendirme metni — gerçek hukuki metin değildir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009112', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000009102', 1, 'published', 'Temsili tercih v1', 'Bu tercih belgesi yalnız yerel test amacıyla oluşturulmuştur.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009113', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000009103', 1, 'draft', 'Taslak görünmemeli v1', 'Temsili bilgilendirme metni — gerçek hukuki metin değildir.', null, null, null, '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009211', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000009201', 1, 'published', 'Beta temsili v1', 'Temsili bilgilendirme metni — gerçek hukuki metin değildir.', null, now(), '00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b101');

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
)
values
  ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-000000009111', 'notice', true, 'pending', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-000000009112', 'consent', true, 'pending', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009303', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-000000009113', 'notice', false, 'pending', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-000000009401', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000c201', '00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-000000009211', 'notice', true, 'pending', '00000000-0000-4000-8000-00000000b101');

insert into public.portal_sessions (
  id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at
)
values
  ('00000000-0000-4000-8000-000000009501', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase8-session-active', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000009502', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b911', '00000000-0000-4000-8000-00000000e201', 'phase8-session-beta', 'active', now() + interval '15 minutes'),
  ('00000000-0000-4000-8000-000000009503', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-00000000e101', 'phase8-session-expired', 'active', now() - interval '1 minute');

select pg_temp.as_anon();

select is(jsonb_array_length(public.get_portal_document_assignments('phase8-session-active')), 2, '7. Portal sees only own published pending assignments');
select is((public.get_portal_document_assignments('phase8-session-active')::text ~* 'organization_id|client_id|portal_session|published_by|00000000-0000-4000-8000-000000009113|Beta'), false, '8. Portal DTO excludes internal, draft and cross-tenant data');

select is((public.record_portal_document_event('phase8-session-active', '00000000-0000-4000-8000-000000009301', 'notice_acknowledged')->>'status'), 'recorded', '9. Portal can acknowledge a notice');
select is((public.record_portal_document_event('phase8-session-active', '00000000-0000-4000-8000-000000009301', 'consent_accepted')->>'error'), 'invalid document event', '10. Notice cannot be accepted as consent');
select is((public.record_portal_document_event('phase8-session-active', '00000000-0000-4000-8000-000000009302', 'consent_accepted')->>'status'), 'recorded', '11. Portal can accept consent');
select is((public.record_portal_document_event('phase8-session-active', '00000000-0000-4000-8000-000000009302', 'consent_accepted')->>'status'), 'already_recorded', '12. Duplicate exact event is idempotent');
select is((public.record_portal_document_event('phase8-session-active', '00000000-0000-4000-8000-000000009302', 'consent_withdrawn')->>'status'), 'recorded', '13. Portal can withdraw accepted consent');
reset role;
select is((select count(*)::int from public.client_document_events where assignment_id = '00000000-0000-4000-8000-000000009302' and event_type in ('consent_accepted', 'consent_withdrawn')), 2, '14. Withdrawal preserves accepted event history');
select pg_temp.as_anon();
select is((public.record_portal_document_event('phase8-session-beta', '00000000-0000-4000-8000-000000009302', 'consent_declined')->>'error'), 'assignment not found', '15. Cross-tenant portal cannot record events');

select is((public.submit_portal_data_request('phase8-session-active', 'access')->>'status'), 'submitted', '16. Portal can submit scoped data request');
select is((public.submit_portal_data_request('phase8-session-active', 'access')->>'status'), 'already_submitted', '17. Duplicate data request spam is idempotent in short window');
select is(jsonb_array_length(public.get_portal_data_requests('phase8-session-active')), 1, '18. Portal can list own requests');
select is((public.get_portal_data_requests('phase8-session-active')::text ~* 'organization_id|client_id|resolution_code'), false, '19. Portal request DTO excludes internal fields');
select is((public.submit_portal_data_request('phase8-session-expired', 'copy')->>'error'), 'portal session is invalid', '20. Expired session cannot submit data request');

reset role;
select is((select coalesce(jsonb_agg(safe_metadata)::text, '') ~* 'Temsili bilgilendirme|tercih belgesi|phone|email|token|session|body_text|free_text' from public.audit_logs where action in ('consent.event_recorded','data_request.created')), false, '21. Portal Phase 8 audit metadata excludes body text, token and PII');

select finish();
rollback;
