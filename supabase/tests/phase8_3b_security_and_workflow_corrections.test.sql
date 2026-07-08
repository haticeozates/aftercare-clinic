begin;

select plan(24);

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

insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000c821',
  '00000000-0000-4000-8000-0000000000a1',
  'phase83b-correction-notice',
  'Phase 8.3B correction notice',
  'notice',
  'phase83b_correction',
  'active',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000c822',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c821',
  1,
  'published',
  'Correction notice v1',
  'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.',
  'Bu belge gerçek bir hukuki metin değildir.',
  now(),
  '00000000-0000-4000-8000-00000000a101',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
) values
  (
    '00000000-0000-4000-8000-00000000c801',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-00000000e201',
    'access',
    'submitted',
    'clinic',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000c802',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-00000000e101',
    'copy',
    'under_review',
    'clinic',
    now()
  );

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-00000000c811',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  '00000000-0000-4000-8000-00000000c822',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);

select has_function('public', 'assign_data_request', array['uuid', 'uuid'], '1. assign_data_request RPC exists');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c801',
    'under_review',
    null,
    null
  )->>'error'),
  'not found',
  '2. Foreign organization data request returns generic not found'
);
select ok(
  not exists (
    select 1
    from public.audit_logs
    where organization_id = '00000000-0000-4000-8000-0000000000b1'
      and entity_id = '00000000-0000-4000-8000-00000000c801'
      and result = 'denied'
  ),
  '3. Foreign organization does not receive denied audit on cross-tenant transition'
);

select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c999',
    'under_review',
    null,
    null
  )->>'error'),
  'not found',
  '4. Random missing data request UUID returns generic not found'
);

select is(
  (public.assign_data_request(
    '00000000-0000-4000-8000-00000000c801',
    '00000000-0000-4000-8000-00000000a103'
  )->>'error'),
  'not found',
  '5. Foreign organization assign_data_request returns generic not found'
);

reset role;
insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at, assigned_to_user_id
) values (
  '00000000-0000-4000-8000-00000000c803',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  'access',
  'in_progress',
  'clinic',
  now(),
  '00000000-0000-4000-8000-00000000a103'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.assign_data_request(
    '00000000-0000-4000-8000-00000000c803',
    '00000000-0000-4000-8000-00000000a102'
  )->>'status'),
  'assigned',
  '6. assign_data_request keeps status unchanged'
);
select is(
  (select status from public.data_requests where id = '00000000-0000-4000-8000-00000000c803'),
  'in_progress',
  '7. assign_data_request does not mutate request status'
);
select is(
  (public.assign_data_request(
    '00000000-0000-4000-8000-00000000c803',
    '00000000-0000-4000-8000-00000000a102'
  )->>'status'),
  'assigned',
  '8. assign_data_request same assignee is idempotent'
);
select is(
  (select count(*)::int from public.data_request_events where data_request_id = '00000000-0000-4000-8000-00000000c803' and event_type = 'assigned'),
  1,
  '9. assign_data_request does not duplicate assigned events'
);

reset role;
update public.data_requests
set status = 'in_progress', assigned_to_user_id = '00000000-0000-4000-8000-00000000a103'
where id = '00000000-0000-4000-8000-00000000c802';

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c802',
    'completed',
    null,
    null
  )->>'status'),
  'completed',
  '10. Completed transition derives manual_review_completed resolution code'
);
select is(
  (select resolution_code from public.data_requests where id = '00000000-0000-4000-8000-00000000c802'),
  'manual_review_completed',
  '11. Completed stores manual_review_completed'
);

reset role;
insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
) values (
  '00000000-0000-4000-8000-00000000c804',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  'correction',
  'under_review',
  'clinic',
  now()
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c804',
    'declined',
    null,
    null
  )->>'status'),
  'declined',
  '12. Declined transition derives manual_review_declined resolution code'
);
select is(
  (select resolution_code from public.data_requests where id = '00000000-0000-4000-8000-00000000c804'),
  'manual_review_declined',
  '13. Declined stores manual_review_declined'
);

reset role;
insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
) values (
  '00000000-0000-4000-8000-00000000c805',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  null,
  'deletion',
  'submitted',
  'clinic',
  now()
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c805',
    'cancelled',
    null,
    null
  )->>'status'),
  'cancelled',
  '14. Cancelled transition derives manual_review_cancelled resolution code'
);
select is(
  (select resolution_code from public.data_requests where id = '00000000-0000-4000-8000-00000000c805'),
  'manual_review_cancelled',
  '15. Cancelled stores manual_review_cancelled'
);

select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'presented', 'portal')->>'error'),
  'invalid source',
  '16. Clinic event rejects portal source spoof'
);
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'notice_acknowledged', 'system')->>'error'),
  'invalid source',
  '17. Clinic event rejects system source spoof'
);
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'consent_accepted', 'clinic')->>'error'),
  'invalid event type',
  '18. Clinic event rejects consent_accepted'
);
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'consent_declined', 'clinic')->>'error'),
  'invalid event type',
  '19. Clinic event rejects consent_declined'
);
select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'consent_withdrawn', 'clinic')->>'error'),
  'invalid event type',
  '20. Clinic event rejects consent_withdrawn'
);

select is(
  (public.record_client_document_event('00000000-0000-4000-8000-00000000c811', 'presented', 'clinic')->>'status'),
  'recorded',
  '21. Clinic presented with clinic source succeeds'
);
select is(
  (select source from public.client_document_events where assignment_id = '00000000-0000-4000-8000-00000000c811' and event_type = 'presented' limit 1),
  'clinic',
  '22. Clinic event stores server-side clinic source'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is(
  (public.transition_data_request_status(
    '00000000-0000-4000-8000-00000000c805',
    'cancelled',
    null,
    null
  )->>'error'),
  'permission denied',
  '23. Staff without manage gets permission denied on own-org request'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where organization_id = '00000000-0000-4000-8000-0000000000a1'
      and entity_id = '00000000-0000-4000-8000-00000000c805'
      and result = 'denied'
      and action = 'data_request.status_changed'
  ),
  '24. Own-organization denied audit is written for staff without manage'
);

select * from finish();
rollback;
