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

select has_table('public', 'photo_requests', '1. photo_requests table exists');
select has_table('public', 'photo_upload_intents', '2. photo_upload_intents table exists');
select has_table('public', 'photo_records', '3. photo_records table exists');
select is((select to_regclass('public.photo_events')), null::regclass, '4. Separate photo_events table is not created');

select ok((select relrowsecurity from pg_class where oid = 'public.photo_requests'::regclass), '5. photo_requests RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.photo_upload_intents'::regclass), '6. photo_upload_intents RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.photo_records'::regclass), '7. photo_records RLS is enabled');
select has_function('public', 'claim_photo_upload_intent_for_portal', array['text', 'uuid'], '7.1. Portal finalize claim RPC exists');
select has_function('public', 'record_finalized_photo_for_portal', array['text', 'uuid', 'uuid', 'text', 'integer', 'integer', 'integer', 'text'], '7.2. Portal finalized photo recording RPC exists');
select has_function('public', 'create_photo_upload_intent_for_portal', array['text', 'uuid', 'text', 'integer', 'text', 'timestamp with time zone'], '7.3. Portal upload intent creation RPC exists');

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_photo_upload_intent_for_portal', 'claim_photo_upload_intent_for_portal', 'record_finalized_photo_for_portal')
      and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
    having count(*) = 3
  ),
  '7.4. Photo upload RPCs are SECURITY DEFINER with explicit search_path'
);

select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('photo_requests', 'photo_upload_intents', 'photo_records', 'portal_sessions', 'care_plans')
      and grantee = 'service_role'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  0,
  '7.5. service_role has no broad direct table DML grant for portal photo route authorization'
);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_photo_upload_intent_for_portal', 'claim_photo_upload_intent_for_portal', 'record_finalized_photo_for_portal')
      and coalesce(p.proacl::text, '') like '%service_role%'
  ),
  3,
  '7.6. service_role can execute only the narrow photo upload RPCs needed by server routes'
);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_photo_upload_intent_for_portal', 'claim_photo_upload_intent_for_portal', 'record_finalized_photo_for_portal')
      and coalesce(p.proacl::text, '') like '{=X/%'
  ),
  0,
  '7.7. PUBLIC execute is not granted on photo upload RPCs'
);

select is(
  (select count(*)::int from storage.buckets where id in ('care-photo-incoming', 'care-photos') and public = false),
  2,
  '8. Incoming and final photo buckets are private'
);
select is(
  (select count(*)::int from storage.buckets where id in ('care-photo-incoming', 'care-photos') and file_size_limit = 5242880),
  2,
  '9. Photo buckets enforce a 5 MB file size limit'
);
select is(
  (select count(*)::int from storage.buckets where id in ('care-photo-incoming', 'care-photos') and allowed_mime_types = array['image/jpeg','image/png','image/webp']),
  2,
  '10. Photo buckets allow only jpeg, png and webp'
);

select ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), '11. Storage objects RLS is enabled');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'), 0, '12. No broad storage object policies expose photo buckets');

insert into storage.objects (id, bucket_id, name, metadata)
values ('00000000-0000-4000-8000-000000007777', 'care-photo-incoming', 'incoming/00000000-0000-4000-8000-000000007777', '{}'::jsonb);

select pg_temp.as_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'care-photo-incoming'), 0, '13. Anonymous browser cannot list incoming storage objects');
prepare anon_storage_object_insert as insert into storage.objects (id, bucket_id, name, metadata) values ('00000000-0000-4000-8000-000000007778', 'care-photo-incoming', 'incoming/00000000-0000-4000-8000-000000007778', '{}'::jsonb);
select throws_ok('anon_storage_object_insert', '42501', null, '14. Anonymous browser cannot directly insert storage objects');
prepare anon_storage_object_delete as delete from storage.objects where id = '00000000-0000-4000-8000-000000007777';
select throws_ok('anon_storage_object_delete', null, null, '15. Anonymous browser cannot directly delete storage objects');
reset role;
select is((select count(*)::int from storage.objects where id = '00000000-0000-4000-8000-000000007777'), 1, '16. Direct delete attempt leaves incoming object intact');

select ok(
  exists (
    select 1
    from public.permissions
    where key in ('photo.read', 'photo.request.manage', 'photo.view')
    having count(*) = 3
  ),
  '11. Photo permissions are seeded'
);

insert into public.photo_requests (
  id,
  organization_id,
  care_plan_id,
  care_plan_day_id,
  label,
  required,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-000000007101',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000e101',
    '00000000-0000-4000-8000-00000000f101',
    'Temsili fotoğraf talebi',
    false,
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-000000007201',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-00000000e201',
    '00000000-0000-4000-8000-00000000f201',
    'Temsili fotoğraf talebi',
    false,
    '00000000-0000-4000-8000-00000000b101'
  );

insert into public.portal_sessions (id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at)
values (
  '00000000-0000-4000-8000-00000000f901',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000a911',
  '00000000-0000-4000-8000-00000000e101',
  'phase7-session-active',
  'active',
  now() + interval '15 minutes'
);

insert into public.photo_upload_intents (
  id,
  organization_id,
  photo_request_id,
  care_plan_id,
  care_plan_day_id,
  portal_session_id,
  incoming_object_key,
  declared_mime_type,
  declared_size_bytes,
  expires_at
)
values (
  '00000000-0000-4000-8000-000000007111',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000007101',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000f101',
  '00000000-0000-4000-8000-00000000f901',
  'incoming/00000000-0000-4000-8000-000000007111',
  'image/jpeg',
  4096,
  now() + interval '10 minutes'
);

prepare cross_plan_intent as insert into public.photo_upload_intents (
  organization_id,
  photo_request_id,
  care_plan_id,
  care_plan_day_id,
  portal_session_id,
  incoming_object_key,
  declared_mime_type,
  declared_size_bytes,
  expires_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000007101',
  '00000000-0000-4000-8000-00000000e102',
  '00000000-0000-4000-8000-00000000f101',
  '00000000-0000-4000-8000-00000000f901',
  'incoming/cross-plan',
  'image/jpeg',
  1024,
  now() + interval '5 minutes'
);
select throws_ok('cross_plan_intent', null, null, '15. Upload intent cannot cross plan scope');

prepare non_opaque_key as insert into public.photo_upload_intents (
  organization_id,
  photo_request_id,
  care_plan_id,
  care_plan_day_id,
  portal_session_id,
  incoming_object_key,
  declared_mime_type,
  declared_size_bytes,
  expires_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000007101',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000f101',
  '00000000-0000-4000-8000-00000000f901',
  'incoming/org-00000000-0000-4000-8000-0000000000a1/request-00000000-0000-4000-8000-000000007101',
  'image/jpeg',
  1024,
  now() + interval '5 minutes'
);
select throws_ok('non_opaque_key', '23514', null, '16. Incoming storage key must be opaque and cannot embed organization/request data');

select is(
  (public.claim_photo_upload_intent_for_portal('phase7-session-active', '00000000-0000-4000-8000-000000007111')->>'status'),
  'processing',
  '16.1. Valid portal session can atomically claim pending upload intent'
);
select is(
  (select status from public.photo_upload_intents where id = '00000000-0000-4000-8000-000000007111'),
  'processing',
  '16.2. Claimed upload intent is marked processing'
);
select ok(
  (select processing_claim_id is not null and processing_started_at is not null from public.photo_upload_intents where id = '00000000-0000-4000-8000-000000007111'),
  '16.3. Claim stores a processing lease id and timestamp'
);
select is(
  (public.claim_photo_upload_intent_for_portal('phase7-session-active', '00000000-0000-4000-8000-000000007111')->>'error'),
  'intent is already processing',
  '16.4. Second process cannot claim the same processing intent'
);
select is(
  (public.record_finalized_photo_for_portal(
    'phase7-session-active',
    '00000000-0000-4000-8000-000000007111',
    (select processing_claim_id from public.photo_upload_intents where id = '00000000-0000-4000-8000-000000007111'),
    'photos/00000000-0000-4000-8000-000000007199.webp',
    2048,
    800,
    600,
    repeat('b', 64)
  )->>'status'),
  'ready',
  '16.5. Claimed intent can be finalized into one immutable photo record'
);
select is(
  (select status from public.photo_upload_intents where id = '00000000-0000-4000-8000-000000007111'),
  'consumed',
  '16.6. Finalized upload intent is consumed'
);
select is(
  (public.record_finalized_photo_for_portal(
    'phase7-session-active',
    '00000000-0000-4000-8000-000000007111',
    gen_random_uuid(),
    'photos/00000000-0000-4000-8000-000000007198.webp',
    2048,
    800,
    600,
    repeat('c', 64)
  )->>'status'),
  'already_finalized',
  '16.7. Repeated finalize returns idempotent success when a record already exists'
);

prepare duplicate_photo_record as insert into public.photo_records (
  organization_id,
  photo_request_id,
  upload_intent_id,
  care_plan_id,
  care_plan_day_id,
  portal_session_id,
  final_bucket_id,
  final_object_key,
  verified_mime_type,
  verified_size_bytes,
  width,
  height,
  finalized_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000007101',
  '00000000-0000-4000-8000-000000007111',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000f101',
  '00000000-0000-4000-8000-00000000f901',
  'care-photos',
  'photos/00000000-0000-4000-8000-000000007122.webp',
  'image/webp',
  1024,
  400,
  300,
  now()
);
select throws_ok('duplicate_photo_record', '23505', null, '16.8. A request can have at most one final photo record');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.photo_requests where organization_id = '00000000-0000-4000-8000-0000000000a1'), 1, '17. Alpha staff can read Alpha photo requests');
select is((select count(*)::int from public.photo_requests where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, '18. Alpha staff cannot read Beta photo requests');
select is((select count(*)::int from public.photo_records where organization_id = '00000000-0000-4000-8000-0000000000a1'), 1, '19. Alpha staff can read Alpha photo records');
select is((select count(*)::int from public.audit_logs), 0, '20. Staff still cannot read audit logs after photo permissions');
prepare staff_create_request as insert into public.photo_requests (organization_id, care_plan_id, care_plan_day_id, label, created_by_user_id) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000f101','Staff request','00000000-0000-4000-8000-00000000a103');
select throws_ok('staff_create_request', '42501', null, '21. Staff cannot create photo requests directly');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_direct_create_request as insert into public.photo_requests (organization_id, care_plan_id, care_plan_day_id, label, created_by_user_id) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-00000000e102','00000000-0000-4000-8000-00000000f102','Owner direct request','00000000-0000-4000-8000-00000000a101');
select throws_ok('owner_direct_create_request', '42501', null, '22. Authenticated clinic users cannot directly insert photo requests without a controlled server path');

select pg_temp.as_anon();
prepare anon_read_photo_requests as select count(*)::int from public.photo_requests;
select throws_ok('anon_read_photo_requests', '42501', null, '23. Anonymous portal/browser cannot read photo requests directly');
prepare anon_insert_intent as insert into public.photo_upload_intents (organization_id, photo_request_id, care_plan_id, care_plan_day_id, portal_session_id, incoming_object_key, declared_mime_type, declared_size_bytes, expires_at) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000f101','00000000-0000-4000-8000-00000000f901','incoming/direct-anon','image/jpeg',1024,now() + interval '5 minutes');
select throws_ok('anon_insert_intent', '42501', null, '24. Anonymous browser cannot directly create upload intents');
prepare anon_insert_record as insert into public.photo_records (organization_id, photo_request_id, care_plan_id, care_plan_day_id, portal_session_id, final_bucket_id, final_object_key, verified_mime_type, verified_size_bytes, width, height, finalized_at) values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-00000000e101','00000000-0000-4000-8000-00000000f101','00000000-0000-4000-8000-00000000f901','care-photos','photos/direct.webp','image/webp',1024,400,300,now());
select throws_ok('anon_insert_record', '42501', null, '25. Anonymous browser cannot directly insert photo records');

reset role;
select is((select public.sanitize_audit_metadata('{"mime_type":"image/webp","size_bytes":2048,"storage_path":"photos/secret.webp","signed_url":"https://example.test","original_filename":"face.jpg","portal_session_hash":"hash","phone":"+905550000000"}'::jsonb)::text), '{"mime_type": "image/webp", "size_bytes": 2048}'::jsonb::text, '26. Audit sanitizer keeps only safe photo metadata');
select ok(
  (
    select count(*)::int
    from public.audit_logs
    where action in ('photo_upload_intent.created', 'photo.uploaded')
      and organization_id = '00000000-0000-4000-8000-0000000000a1'
  ) >= 2,
  '27. Photo upload claim and finalize write accepted audit events'
);
select ok(
  (
    select coalesce(jsonb_agg(safe_metadata), '[]'::jsonb)::text
    from public.audit_logs
    where action in ('photo_upload_intent.created', 'photo.uploaded')
  ) !~* 'incoming|photos/|signed|token|filename|phone|email|session',
  '28. Photo audit events do not include path, token, filename, session or PII'
);

select finish();
rollback;
