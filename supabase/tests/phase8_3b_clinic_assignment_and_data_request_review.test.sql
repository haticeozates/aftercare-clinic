begin;

select plan(32);

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

-- Fixtures
insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values
  ('00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-0000000000a1', 'phase83b-notice', 'Phase 8.3B notice', 'notice', 'phase83b_notice', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b302', '00000000-0000-4000-8000-0000000000a1', 'phase83b-consent', 'Phase 8.3B consent', 'consent', 'phase83b_consent', 'active', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b303', '00000000-0000-4000-8000-0000000000a1', 'phase83b-archived', 'Phase 8.3B archived', 'notice', 'phase83b_archived', 'archived', '00000000-0000-4000-8000-00000000a101');

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
) values
  ('00000000-0000-4000-8000-00000000b311', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b301', 1, 'published', 'Notice v1', 'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b312', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b301', 2, 'published', 'Notice v2', 'Temsili bilgilendirme metni v2 — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b313', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b301', 3, 'draft', 'Notice draft', 'Taslak metin — yalnızca yerel test kullanımı içindir.', null, null, null, '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b321', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b302', 1, 'published', 'Consent v1', 'Temsili tercih metni — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b331', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b303', 1, 'published', 'Archived v1', 'Arşiv belge metni — yalnızca yerel test kullanımı içindir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101');

select has_function('public', 'create_client_document_assignment', array['uuid', 'uuid', 'boolean', 'uuid'], '1. create_client_document_assignment RPC exists');
select has_function('public', 'cancel_client_document_assignment', array['uuid'], '2. cancel_client_document_assignment RPC exists');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b311',
    true,
    '00000000-0000-4000-8000-00000000e101'
  )->>'status'),
  'created',
  '3. Owner can create plan-scoped assignment'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where action = 'consent_assignment.created'
      and entity_type = 'client_document_assignment'
      and result = 'success'
  ),
  '4. Assignment create writes audit'
);

select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b312',
    true,
    '00000000-0000-4000-8000-00000000e101'
  )->>'error'),
  'assignment already exists',
  '5. Cross-version duplicate pending is rejected at document level'
);

select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b311',
    true,
    null
  )->>'error'),
  'assignment already exists',
  '6. Global assignment blocked while plan-scoped pending exists'
);

reset role;
update public.client_document_assignments
set status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_user_id = '00000000-0000-4000-8000-00000000a101'
where organization_id = '00000000-0000-4000-8000-0000000000a1'
  and client_id = '00000000-0000-4000-8000-00000000c101'
  and care_plan_id = '00000000-0000-4000-8000-00000000e101'
  and document_version_id = '00000000-0000-4000-8000-00000000b311'
  and status = 'pending';

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b401',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  '00000000-0000-4000-8000-00000000b321',
  'consent',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b321',
    true,
    '00000000-0000-4000-8000-00000000e101'
  )->>'error'),
  'assignment already exists',
  '7. Plan-scoped assignment blocked while global pending exists'
);

select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-00000000b311',
    true,
    null
  )->>'error'),
  'not found',
  '8. Cross-tenant client create returns generic not found'
);

select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b313',
    true,
    null
  )->>'error'),
  'document version is not published',
  '9. Draft version assignment is denied'
);

select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b331',
    true,
    null
  )->>'error'),
  'document is archived',
  '10. Archived document assignment is denied'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is(
  (public.create_client_document_assignment(
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000b311',
    true,
    null
  )->>'error'),
  'permission denied',
  '11. Staff cannot create assignment'
);
reset role;

prepare direct_assignment_insert as insert into public.client_document_assignments (
  organization_id, client_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000b311',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select throws_ok('direct_assignment_insert', '42501', null, '12. Authenticated cannot insert assignments directly');

select is(
  (public.cancel_client_document_assignment('00000000-0000-4000-8000-00000000b401')->>'status'),
  'cancelled',
  '13. Owner can cancel pending global assignment'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where action = 'consent_assignment.cancelled'
      and entity_id = '00000000-0000-4000-8000-00000000b401'
      and result = 'success'
  ),
  '14. Cancel writes audit'
);
select is(
  (public.cancel_client_document_assignment('00000000-0000-4000-8000-00000000b401')->>'status'),
  'cancelled',
  '15. Cancel is idempotent for already cancelled assignment'
);

reset role;
insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id, completed_at
) values (
  '00000000-0000-4000-8000-00000000b402',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  '00000000-0000-4000-8000-00000000b321',
  'consent',
  true,
  'completed',
  '00000000-0000-4000-8000-00000000a101',
  now()
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.cancel_client_document_assignment('00000000-0000-4000-8000-00000000b402')->>'error'),
  'assignment already completed',
  '16. Completed assignment cannot be cancelled'
);

reset role;
insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b403',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  '00000000-0000-4000-8000-00000000b311',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000b403', 'notice_acknowledged', 'clinic')->>'status'),
  'recorded',
  '17. Clinic notice_acknowledged still allowed (8.1 regression)'
);
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000b402', 'consent_accepted', 'clinic')->>'error'),
  'invalid event type',
  '18. Clinic consent_accepted is denied after hardening'
);

insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
) values (
  '00000000-0000-4000-8000-00000000b501',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000e101',
  'access',
  'submitted',
  'clinic',
  now()
);

select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000b501',
    'submitted',
    null,
    '00000000-0000-4000-8000-00000000a103'
  )->>'status'),
  'submitted',
  '19. Assignee-only transition keeps status'
);
select is(
  (select count(*)::int from public.data_request_events where data_request_id = '00000000-0000-4000-8000-00000000b501' and event_type = 'assigned'),
  1,
  '20. Assignee-only transition writes assigned event'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where action = 'data_request.assigned'
      and entity_id = '00000000-0000-4000-8000-00000000b501'
      and result = 'success'
  ),
  '21. Assignee-only transition writes assigned audit'
);
select is(
  (select assignee_user_id from public.data_request_events where data_request_id = '00000000-0000-4000-8000-00000000b501' and event_type = 'assigned' limit 1),
  '00000000-0000-4000-8000-00000000a103'::uuid,
  '22. Assigned event stores assignee_user_id'
);

select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000b501',
    'submitted',
    null,
    '00000000-0000-4000-8000-00000000a103'
  )->>'status'),
  'submitted',
  '23. Same assignee re-submit is idempotent'
);
select is(
  (select count(*)::int from public.data_request_events where data_request_id = '00000000-0000-4000-8000-00000000b501' and event_type = 'assigned'),
  1,
  '24. Same assignee does not duplicate assigned event'
);

select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000b501',
    'submitted',
    null,
    '00000000-0000-4000-8000-00000000b101'
  )->>'error'),
  'invalid assignee',
  '25. Cross-tenant assignee is denied'
);

select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000b501',
    'under_review',
    null,
    '00000000-0000-4000-8000-00000000a102'
  )->>'status'),
  'under_review',
  '26. Combined status and assignee transition succeeds'
);
select is(
  (select count(*)::int from public.data_request_events where data_request_id = '00000000-0000-4000-8000-00000000b501' and event_type in ('assigned', 'review_started')),
  3,
  '27. Combined transition writes separate assigned and status events'
);

reset role;
select ok(
  not exists (
    select 1
    from public.audit_logs
    where action = 'consent_assignment.created'
      and safe_metadata::text ilike '%Temsili%'
  ),
  '28. Assignment audit metadata excludes body text'
);

insert into public.secure_links (
  id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b471',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000e102',
  'hash-phase83b-portal',
  'p83',
  'active',
  now() + interval '3 days',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b351',
  '00000000-0000-4000-8000-0000000000a1',
  'phase83b-portal-notice',
  'Portal visibility notice',
  'notice',
  'phase83b_portal',
  'active',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000b352',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000b351',
  1,
  'published',
  'Portal notice v1',
  'Temsili portal metni — yalnızca yerel test kullanımı içindir.',
  'Bu belge gerçek bir hukuki metin değildir.',
  now(),
  '00000000-0000-4000-8000-00000000a101',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values
  ('00000000-0000-4000-8000-00000000b451', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000b352', 'notice', true, 'pending', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b452', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000b321', 'consent', true, 'pending', '00000000-0000-4000-8000-00000000a101');

insert into public.portal_sessions (
  id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at
) values (
  '00000000-0000-4000-8000-00000000b461',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000b471',
  '00000000-0000-4000-8000-00000000e102',
  'phase83b-session-active',
  'active',
  now() + interval '15 minutes'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  jsonb_array_length(public.get_portal_document_assignments('phase83b-session-active')),
  2,
  '29. Portal regression: published active assignments still visible'
);

reset role;
update public.consent_documents set status = 'archived' where id = '00000000-0000-4000-8000-00000000b351';
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  jsonb_array_length(public.get_portal_document_assignments('phase83b-session-active')),
  1,
  '30. Archived document pending assignment is hidden from portal'
);
reset role;
update public.consent_documents set status = 'active' where id = '00000000-0000-4000-8000-00000000b351';

select ok(
  exists (
    select 1 from pg_indexes
    where indexname = 'client_doc_assignments_pending_global_unique'
  ),
  '31. Global pending partial unique index exists'
);
select ok(
  exists (
    select 1 from pg_indexes
    where indexname = 'client_doc_assignments_pending_plan_unique'
  ),
  '32. Plan pending partial unique index exists'
);

select * from finish();
rollback;
