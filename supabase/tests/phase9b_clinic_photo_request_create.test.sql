begin;

select plan(18);

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

select has_function(
  'public',
  'create_photo_request_for_staff',
  array['uuid', 'uuid', 'text', 'boolean'],
  '1. create_photo_request_for_staff RPC exists'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.create_photo_request_for_staff(uuid,uuid,text,boolean)'::regprocedure
  ),
  '2. create_photo_request_for_staff is SECURITY DEFINER'
);

select ok(
  (
    select prosecdef and proconfig::text like '%search_path=public, pg_temp%'
    from pg_proc
    where oid = 'public.create_photo_request_for_staff(uuid,uuid,text,boolean)'::regprocedure
  ),
  '3. create_photo_request_for_staff pins search_path'
);

select ok(
  has_function_privilege('authenticated', 'public.create_photo_request_for_staff(uuid,uuid,text,boolean)', 'execute')
  and not has_function_privilege('public', 'public.create_photo_request_for_staff(uuid,uuid,text,boolean)', 'execute'),
  '4. execute is granted to authenticated and revoked from PUBLIC'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e102',
      '00000000-0000-4000-8000-00000000f102',
      'Temsili klinik fotoğraf talebi',
      true
    )->>'status'
  ),
  'created',
  '5. Owner can create photo request on scheduled plan day'
);

select ok(
  exists (
    select 1
    from public.photo_requests
    where care_plan_day_id = '00000000-0000-4000-8000-00000000f102'
      and status = 'active'
      and required = true
      and label = 'Temsili klinik fotoğraf talebi'
  ),
  '6. Created request persists as active'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'photo_request.created'
      and entity_type = 'photo_request'
      and result = 'success'
      and actor_user_id = '00000000-0000-4000-8000-00000000a101'
      and (safe_metadata->>'day_number')::int = 1
      and (safe_metadata->>'required')::boolean = true
  ),
  '7. Create writes photo_request.created audit in same transaction'
);

select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e102',
      '00000000-0000-4000-8000-00000000f102',
      'İkinci aktif talep',
      false
    )->>'error'
  ),
  'photo request already exists',
  '8. Duplicate active request maps to safe already-exists error'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e101',
      '00000000-0000-4000-8000-00000000f101',
      'Admin temsili fotoğraf talebi',
      false
    )->>'status'
  ),
  'created',
  '9. Admin can create photo request on active plan day'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e102',
      '00000000-0000-4000-8000-00000000f102',
      'Staff denemesi',
      false
    )->>'error'
  ),
  'permission denied',
  '10. Staff without photo.request.manage is denied'
);
reset role;

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'authorization.denied'
      and entity_type = 'photo_request'
      and result = 'denied'
      and actor_user_id = '00000000-0000-4000-8000-00000000a103'
      and safe_metadata->>'permission_key' = 'photo.request.manage'
  ),
  '11. Staff denial writes authorization.denied audit'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e103',
      '00000000-0000-4000-8000-00000000f103',
      'Completed plan talebi',
      false
    )->>'error'
  ),
  'plan is not eligible',
  '12. Completed plan is rejected'
);

select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e104',
      '00000000-0000-4000-8000-00000000f104',
      'Stopped plan talebi',
      false
    )->>'error'
  ),
  'plan is not eligible',
  '13. Stopped plan is rejected'
);

select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e201',
      '00000000-0000-4000-8000-00000000f201',
      'Cross-tenant talebi',
      false
    )->>'error'
  ),
  'not found',
  '14. Cross-tenant plan create returns generic not found'
);

select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e101',
      '00000000-0000-4000-8000-00000000f102',
      'Mismatched day',
      false
    )->>'error'
  ),
  'not found',
  '15. Plan/day mismatch returns not found'
);

select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e101',
      '00000000-0000-4000-8000-00000000f101',
      'x',
      false
    )->>'error'
  ),
  'invalid label',
  '16. Invalid label is rejected'
);

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is(
  (
    public.create_photo_request_for_staff(
      '00000000-0000-4000-8000-00000000e102',
      '00000000-0000-4000-8000-00000000f102',
      'Inactive membership',
      false
    )->>'error'
  ),
  'not found',
  '17. Inactive membership cannot create photo request'
);

prepare direct_photo_request_insert as insert into public.photo_requests (
  organization_id,
  care_plan_id,
  care_plan_day_id,
  label,
  created_by_user_id
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000e102',
  '00000000-0000-4000-8000-00000000f102',
  'Direct insert blocked',
  '00000000-0000-4000-8000-00000000a101'
);
select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select throws_ok('direct_photo_request_insert', '42501', null, '18. Authenticated cannot insert photo_requests directly');

select * from finish();
rollback;
