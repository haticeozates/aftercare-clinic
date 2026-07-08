begin;

select plan(28);

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

-- Fixture document for cross-tenant and not-found scenarios
insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d301',
  '00000000-0000-4000-8000-0000000000b1',
  'phase83a-beta-doc',
  'Phase 8.3A beta fixture',
  'notice',
  'phase83a_beta',
  'active',
  '00000000-0000-4000-8000-00000000b101'
);

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d311',
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-00000000d301',
  1,
  'draft',
  'Beta draft v1',
  'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.',
  'Bu belge gerçek bir hukuki metin değildir.',
  '00000000-0000-4000-8000-00000000b101'
);

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d312',
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-00000000d301',
  2,
  'published',
  'Beta published v2',
  'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.',
  'Bu belge gerçek bir hukuki metin değildir.',
  now(),
  '00000000-0000-4000-8000-00000000b101',
  '00000000-0000-4000-8000-00000000b101'
);

-- 1. Owner create success
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-owner-doc',
    'Owner create test',
    'notice',
    'phase83a_owner'
  )->>'status'),
  'success',
  '1. Owner can create consent document via RPC'
);

-- 2. Admin create success
select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is(
  (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-admin-doc',
    'Admin create test',
    'notice',
    'phase83a_admin'
  )->>'status'),
  'success',
  '2. Admin can create consent document via RPC'
);

-- 3. Staff create denied with in-org audit only
select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is(
  (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-staff-doc',
    'Staff create test',
    'notice',
    'phase83a_staff'
  )->>'error'),
  'permission denied',
  '3. Staff cannot create consent document'
);
reset role;
select ok(
  exists (
    select 1
    from public.audit_logs
    where organization_id = '00000000-0000-4000-8000-0000000000a1'
      and action = 'consent_document.created'
      and result = 'denied'
      and actor_user_id = '00000000-0000-4000-8000-00000000a103'
  ),
  '3b. Staff create denial writes audit only in own organization'
);

-- Prepare owner-managed document for staff denial matrix
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');

do $$
declare
  v_doc_id uuid;
  v_published_source_id uuid;
  v_active_draft_id uuid;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-staff-actions',
    'Staff action matrix',
    'notice',
    'phase83a_staff_actions'
  )->>'document_id')::uuid into v_doc_id;

  select (public.create_consent_document_draft_version(
    v_doc_id,
    'Draft for staff matrix',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'version_id')::uuid into v_published_source_id;

  perform public.publish_consent_document_version(v_published_source_id);

  select (public.create_draft_from_published_consent_version(v_published_source_id)->>'version_id')::uuid
  into v_active_draft_id;

  perform set_config('phase83a.staff_doc_id', v_doc_id::text, true);
  perform set_config('phase83a.staff_draft_id', v_active_draft_id::text, true);
  perform set_config('phase83a.staff_published_source_id', v_published_source_id::text, true);
end $$;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is(
  (public.update_consent_document_draft_version(
    current_setting('phase83a.staff_draft_id')::uuid,
    'Tampered title',
    'Tampered summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'permission denied',
  '4. Staff cannot update consent draft version'
);
select is(
  (public.publish_consent_document_version(current_setting('phase83a.staff_draft_id')::uuid)->>'error'),
  'permission denied',
  '5. Staff cannot publish consent draft in own organization'
);
select is(
  (public.create_draft_from_published_consent_version(current_setting('phase83a.staff_published_source_id')::uuid)->>'error'),
  'permission denied',
  '6. Staff cannot create draft from published version'
);
select is(
  (public.archive_consent_document(current_setting('phase83a.staff_doc_id')::uuid)->>'error'),
  'permission denied',
  '7. Staff cannot archive consent document'
);

-- 8. Cross-tenant create denied without foreign audit pollution
reset role;
select is(
  (select count(*)::int
   from public.audit_logs
   where organization_id = '00000000-0000-4000-8000-0000000000b1'
     and action like 'consent_%'),
  0,
  '8a. Beta org starts with no clinic consent audit rows'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000b1',
    'phase83a-cross-create',
    'Cross tenant create',
    'notice',
    'phase83a_cross'
  )->>'error'),
  'permission denied',
  '8b. Alpha owner cannot create document in Beta organization'
);
reset role;
select is(
  (select count(*)::int
   from public.audit_logs
   where organization_id = '00000000-0000-4000-8000-0000000000b1'
     and action like 'consent_%'),
  0,
  '8c. Cross-tenant create does not pollute Beta audit logs'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.update_consent_document_draft_version(
    '00000000-0000-4000-8000-00000000d311',
    'Cross tenant update',
    'Cross summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'not found',
  '9. Cross-tenant draft update returns generic not found'
);
select is(
  (public.publish_consent_document_version('00000000-0000-4000-8000-00000000d311')->>'error'),
  'not found',
  '10. Cross-tenant publish returns generic not found'
);
reset role;
select is(
  (select count(*)::int
   from public.audit_logs
   where organization_id = '00000000-0000-4000-8000-0000000000b1'
     and result = 'denied'
     and action like 'consent_%'),
  0,
  '10b. Cross-tenant manage attempts do not write denied audits in Beta'
);

-- 11. Random UUID org id is generic with zero audit rows
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.create_consent_document(
    '00000000-0000-4000-8000-00000000ffff',
    'phase83a-random-org',
    'Random org',
    'notice',
    'phase83a_random'
  )->>'error'),
  'permission denied',
  '11. Random organization id returns generic permission denied'
);
reset role;
select is(
  (select count(*)::int
   from public.audit_logs
   where organization_id = '00000000-0000-4000-8000-00000000ffff'),
  0,
  '11b. Random organization id creates no audit rows'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');

-- 12. Missing document/version returns not found before audit
select is(
  (public.create_consent_document_draft_version(
    '00000000-0000-4000-8000-00000000dead',
    'Missing doc draft',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'not found',
  '12. Missing document id returns not found for draft create'
);
select is(
  (public.update_consent_document_draft_version(
    '00000000-0000-4000-8000-00000000dead',
    'Missing version',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'not found',
  '13. Missing version id returns not found for draft update'
);

-- 14. Published version cannot be updated
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (public.update_consent_document_draft_version(
    '00000000-0000-4000-8000-00000000d312',
    'Published tamper',
    'Published summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'not found',
  '14. Cross-tenant published update returns generic not found'
);

do $$
declare
  v_doc_id uuid;
  v_draft_id uuid;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-publish-matrix',
    'Publish matrix doc',
    'notice',
    'phase83a_publish'
  )->>'document_id')::uuid into v_doc_id;

  select (public.create_consent_document_draft_version(
    v_doc_id,
    'Publish matrix draft',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'version_id')::uuid into v_draft_id;

  perform public.publish_consent_document_version(v_draft_id);
  perform set_config('phase83a.published_in_org_id', v_draft_id::text, true);
end $$;

select is(
  (public.update_consent_document_draft_version(
    current_setting('phase83a.published_in_org_id')::uuid,
    'Published tamper in org',
    'Published summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'version is not draft',
  '15. Published in-org version cannot be updated'
);

-- 16. Archive success and audit action accepted
do $$
declare
  v_doc_id uuid;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-archive-doc',
    'Archive me',
    'notice',
    'phase83a_archive'
  )->>'document_id')::uuid into v_doc_id;
  perform set_config('phase83a.archive_doc_id', v_doc_id::text, true);
end $$;

select is(
  (public.archive_consent_document(current_setting('phase83a.archive_doc_id')::uuid)->>'status'),
  'success',
  '16. Owner can archive consent document'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where organization_id = '00000000-0000-4000-8000-0000000000a1'
      and action = 'consent_document.archived'
      and entity_id = current_setting('phase83a.archive_doc_id')::uuid
      and result = 'success'
  ),
  '16b. Archive success writes consent_document.archived audit action'
);

-- 17. Draft update success writes consent_version.updated audit action
do $$
declare
  v_doc_id uuid;
  v_draft_id uuid;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-update-audit',
    'Update audit doc',
    'notice',
    'phase83a_update_audit'
  )->>'document_id')::uuid into v_doc_id;

  select (public.create_consent_document_draft_version(
    v_doc_id,
    'Audit update draft',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'version_id')::uuid into v_draft_id;

  perform public.update_consent_document_draft_version(
    v_draft_id,
    'Audit update draft v2',
    'Updated summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  );
  perform set_config('phase83a.update_audit_version_id', v_draft_id::text, true);
end $$;

select ok(
  exists (
    select 1
    from public.audit_logs
    where organization_id = '00000000-0000-4000-8000-0000000000a1'
      and action = 'consent_version.updated'
      and entity_id = current_setting('phase83a.update_audit_version_id')::uuid
      and result = 'success'
  ),
  '17. Draft update success writes consent_version.updated audit action'
);

-- 18. Audit metadata redaction
select is(
  (
    select coalesce(jsonb_agg(safe_metadata)::text, '') ~* 'Temsili bilgilendirme|hukuki|phone|email|token|body_text|free_text'
    from public.audit_logs
    where action in ('consent_document.created', 'consent_document.archived', 'consent_version.created', 'consent_version.updated', 'consent_version.published')
      and organization_id = '00000000-0000-4000-8000-0000000000a1'
  ),
  false,
  '18. Clinic consent audit metadata excludes body text and PII'
);

-- 19. One active draft rule
do $$
declare
  v_doc_id uuid;
  v_published_id uuid;
  v_result jsonb;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-one-draft',
    'One draft doc',
    'notice',
    'phase83a_one_draft'
  )->>'document_id')::uuid into v_doc_id;

  select (public.create_consent_document_draft_version(
    v_doc_id,
    'Initial draft',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'version_id')::uuid into v_published_id;

  perform public.publish_consent_document_version(v_published_id);
  perform public.create_draft_from_published_consent_version(v_published_id);

  v_result := public.create_consent_document_draft_version(
    v_doc_id,
    'Second draft attempt',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  );

  if coalesce(v_result->>'error', '') <> 'draft already exists' then
    raise exception 'Expected draft already exists, got %', v_result;
  end if;
end $$;

select pass('19. Only one active draft per document is enforced');

-- 20. Archived document denies draft create and publish
update public.consent_documents
set status = 'archived'
where id = current_setting('phase83a.archive_doc_id')::uuid;

select is(
  (public.create_consent_document_draft_version(
    current_setting('phase83a.archive_doc_id')::uuid,
    'Archived draft attempt',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'error'),
  'document is archived',
  '20. Archived document rejects new draft version'
);

do $$
declare
  v_doc_id uuid;
  v_draft_id uuid;
begin
  select (public.create_consent_document(
    '00000000-0000-4000-8000-0000000000a1',
    'phase83a-archive-publish',
    'Archive publish doc',
    'notice',
    'phase83a_archive_publish'
  )->>'document_id')::uuid into v_doc_id;

  select (public.create_consent_document_draft_version(
    v_doc_id,
    'Draft before archive',
    'Summary',
    'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.'
  )->>'version_id')::uuid into v_draft_id;

  perform public.archive_consent_document(v_doc_id);
  perform set_config('phase83a.archived_publish_id', v_draft_id::text, true);
end $$;

select is(
  (public.publish_consent_document_version(current_setting('phase83a.archived_publish_id')::uuid)->>'error'),
  'document is archived',
  '21. Archived document rejects publish'
);

-- 22. Portal draft invisibility (published-only portal listing)
reset role;
insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d401',
  '00000000-0000-4000-8000-0000000000a1',
  'phase83a-portal-draft-doc',
  'Portal draft invisibility doc',
  'notice',
  'phase83a_portal_draft',
  'active',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, created_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d411',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000d401',
  1,
  'draft',
  'Portal hidden draft',
  'Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
) values (
  '00000000-0000-4000-8000-00000000d421',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000c101',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000d411',
  'notice',
  false,
  'pending',
  '00000000-0000-4000-8000-00000000a101'
);

insert into public.portal_sessions (
  id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at
) values (
  '00000000-0000-4000-8000-00000000d431',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000a911',
  '00000000-0000-4000-8000-00000000e101',
  'phase83a-portal-session-hash',
  'active',
  now() + interval '15 minutes'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(public.get_portal_document_assignments('phase83a-portal-session-hash'))
    where value->>'assignment_id' = '00000000-0000-4000-8000-00000000d421'
  ),
  0,
  '22. Portal document listing excludes draft-only assignments'
);

select finish();
rollback;
