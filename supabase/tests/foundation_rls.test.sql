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

create or replace function pg_temp.as_service()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  set local role service_role;
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.organizations where slug = 'organization-alpha'), 1, 'Alpha owner can read Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select count(*)::int from public.organizations where slug = 'organization-alpha'), 1, 'Alpha admin can read Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.organizations where slug = 'organization-alpha'), 1, 'Alpha staff can read Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.organizations where slug = 'organization-beta'), 0, 'Alpha owner cannot read Organization Beta');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.organizations where slug = 'organization-beta'), 0, 'Alpha staff cannot read Organization Beta');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f001');
select is((select count(*)::int from public.organizations), 0, 'Authenticated user without membership cannot read organizations');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.organizations), 0, 'Inactive membership user cannot read organizations');

select pg_temp.as_anon();
prepare anon_organization_read as select count(*)::int from public.organizations;
select throws_ok('anon_organization_read', '42501', null, 'Anonymous user cannot read organizations');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_update_alpha as
  update public.organizations set name = 'Organization Alpha Staff Tamper' where slug = 'organization-alpha';
select lives_ok('staff_update_alpha', 'Alpha staff update attempt completes without mutating rows');
select is((select name from public.organizations where slug = 'organization-alpha'), 'Organization Alpha', 'Alpha staff cannot mutate Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_update_alpha as
  update public.organizations set name = 'Organization Alpha Owner Updated' where slug = 'organization-alpha';
select lives_ok('owner_update_alpha', 'Alpha owner can update Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare admin_update_alpha as
  update public.organizations set name = 'Organization Alpha Admin Updated' where slug = 'organization-alpha';
select lives_ok('admin_update_alpha', 'Alpha admin can update Organization Alpha');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_update_beta as
  update public.organizations set name = 'Organization Beta Tamper' where slug = 'organization-beta';
select lives_ok('owner_update_beta', 'Alpha owner update against Beta does not error but affects no visible rows');
select is((select count(*)::int from public.organizations where slug = 'organization-beta'), 0, 'Alpha owner still cannot see or mutate Beta via request tampering');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000a1'), 4, 'Alpha owner can read Alpha memberships');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select count(*)::int from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000a1'), 4, 'Alpha admin can read Alpha memberships');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.organization_memberships), 1, 'Alpha staff only sees own membership');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_membership_insert as
  insert into public.organization_memberships (organization_id, user_id, role_id)
  select '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f001', id
  from public.roles where key = 'staff';
select throws_ok('staff_membership_insert', '42501', null, 'Alpha staff cannot manage memberships');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha owner cannot read Beta memberships');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_membership_insert as
  insert into public.organization_memberships (organization_id, user_id, role_id)
  select '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f001', id
  from public.roles where key = 'staff'
  on conflict do nothing;
select lives_ok('owner_membership_insert', 'Alpha owner can manage Alpha memberships');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare move_membership_to_beta as
  update public.organization_memberships
  set organization_id = '00000000-0000-4000-8000-0000000000b1'
  where user_id = '00000000-0000-4000-8000-00000000a103'
    and organization_id = '00000000-0000-4000-8000-0000000000a1';
select throws_ok('move_membership_to_beta', '42501', null, 'Tenant move attempt is rejected');
select is((select count(*)::int from public.organization_memberships where user_id = '00000000-0000-4000-8000-00000000a103' and organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Membership organization_id cannot be moved to another tenant');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.organization_memberships), 1, 'Inactive user can only see own inactive membership row');
select is((select count(*)::int from public.organizations), 0, 'Inactive membership cannot read organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.roles), 3, 'Authenticated user can read role metadata');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare role_insert as insert into public.roles (key, display_name) values ('staff', 'Duplicate Staff');
select throws_ok('role_insert', '42501', null, 'Browser client cannot insert roles');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare permission_update as update public.permissions set description = 'tamper' where key = 'audit.read';
select throws_ok('permission_update', '42501', null, 'Browser client cannot update permissions');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare role_permission_delete as delete from public.role_permissions;
select throws_ok('role_permission_delete', '42501', null, 'Browser client cannot change role permissions');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.audit_logs where organization_id = '00000000-0000-4000-8000-0000000000a1'), 1, 'Alpha owner can read Alpha audit logs');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.audit_logs), 0, 'Alpha staff cannot read audit logs');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.audit_logs where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha owner cannot read Beta audit logs');

select pg_temp.as_anon();
prepare anon_audit_read as select count(*)::int from public.audit_logs;
select throws_ok('anon_audit_read', '42501', null, 'Anonymous user cannot read audit logs');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare audit_insert as
  insert into public.audit_logs (organization_id, actor_type, action, entity_type, result)
  values ('00000000-0000-4000-8000-0000000000a1', 'user', 'authorization.denied', 'organization', 'denied');
select throws_ok('audit_insert', '42501', null, 'Normal authenticated browser client cannot insert audit logs');

select pg_temp.as_service();
select lives_ok($$
  select public.write_audit_log(
    '00000000-0000-4000-8000-0000000000a1',
    'system',
    null,
    'authorization.denied',
    'organization',
    '00000000-0000-4000-8000-0000000000a1',
    'denied',
    null,
    null,
    '{"reason":"permission_denied","token":"blocked","email":"blocked@example.test","request_body":"blocked"}'::jsonb
  )
$$, 'Controlled server-side audit function can insert');

select is(
  (
    select safe_metadata
    from public.audit_logs
    where action = 'authorization.denied'
    order by id desc
    limit 1
  ),
  '{"reason":"permission_denied"}'::jsonb,
  'Audit function stores only allowlisted safe metadata'
);

select pg_temp.as_service();
select lives_ok($$
  select public.write_audit_log(
    '00000000-0000-4000-8000-0000000000b1',
    'system',
    null,
    'authorization.denied',
    'organization',
    '00000000-0000-4000-8000-0000000000a1',
    'denied',
    null,
    null,
    '{"reason":"cross_tenant_denied"}'::jsonb
  )
$$, 'Service role can write only explicit server-side audit events');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.audit_logs where safe_metadata @> '{"reason":"cross_tenant_denied"}'), 0, 'Alpha owner cannot read Beta audit inserted by server-side function');

select pg_temp.as_service();
prepare audit_update as update public.audit_logs set result = 'success' where action = 'authorization.denied';
select throws_ok('audit_update', '42501', null, 'Audit update is blocked');

select pg_temp.as_service();
prepare audit_delete as delete from public.audit_logs where action = 'authorization.denied';
select throws_ok('audit_delete', '42501', null, 'Audit delete is blocked');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.user_profiles where id = '00000000-0000-4000-8000-00000000a101'), 1, 'User can read own profile');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare own_profile_update as update public.user_profiles set display_name = 'Alpha Owner Updated' where id = '00000000-0000-4000-8000-00000000a101';
select lives_ok('own_profile_update', 'User can update own allowed profile fields');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.user_profiles where id = '00000000-0000-4000-8000-00000000b101'), 0, 'User cannot read another profile');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare other_profile_update as update public.user_profiles set display_name = 'Tamper' where id = '00000000-0000-4000-8000-00000000b101';
select lives_ok('other_profile_update', 'Updating another profile affects no visible rows');
select is((select count(*)::int from public.user_profiles where id = '00000000-0000-4000-8000-00000000b101'), 0, 'Profile update cannot change another auth user profile');

select * from finish();

rollback;
