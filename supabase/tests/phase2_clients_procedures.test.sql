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
select is((select count(*)::int from public.clients where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha owner can read Alpha clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select count(*)::int from public.clients where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha admin can read Alpha clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.clients where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha staff can read Alpha clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.clients where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha owner cannot read Beta clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.clients where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha staff cannot read Beta clients');

select pg_temp.as_anon();
prepare anon_client_read as select count(*)::int from public.clients;
select throws_ok('anon_client_read', '42501', null, 'Anonymous user cannot read clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f001');
select is((select count(*)::int from public.clients), 0, 'Authenticated user without membership cannot read clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.clients), 0, 'Inactive member cannot read clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_client_insert_alpha as
  insert into public.clients (
    organization_id,
    full_name,
    phone,
    phone_normalized,
    email,
    responsible_membership_id,
    created_by_user_id
  )
  values (
    '00000000-0000-4000-8000-0000000000a1',
    'Synthetic Alpha Client New',
    '+90 555 010 10 10',
    '+905550101010',
    'alpha-client-new@example.test',
    (select id from public.organization_memberships where user_id = '00000000-0000-4000-8000-00000000a103' and organization_id = '00000000-0000-4000-8000-0000000000a1'),
    '00000000-0000-4000-8000-00000000a103'
  );
select lives_ok('staff_client_insert_alpha', 'Staff can create client inside own organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_client_insert_beta as
  insert into public.clients (
    organization_id,
    full_name,
    phone,
    phone_normalized,
    created_by_user_id
  )
  values (
    '00000000-0000-4000-8000-0000000000b1',
    'Synthetic Cross Tenant Client',
    '+90 555 010 10 11',
    '+905550101011',
    '00000000-0000-4000-8000-00000000a103'
  );
select throws_ok('staff_client_insert_beta', '42501', null, 'Staff cannot create client in another organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_client_update as
  update public.clients
  set full_name = 'Synthetic Alpha Client Updated',
      updated_by_user_id = '00000000-0000-4000-8000-00000000a103'
  where phone_normalized = '+905550101010';
select lives_ok('staff_client_update', 'Staff can update client basic fields');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_client_org_move as
  update public.clients
  set organization_id = '00000000-0000-4000-8000-0000000000b1'
  where phone_normalized = '+905550101010';
select throws_ok('staff_client_org_move', '42501', null, 'Staff cannot change client organization_id');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_client_archive as
  update public.clients
  set status = 'archived',
      archived_at = now(),
      archived_by_user_id = '00000000-0000-4000-8000-00000000a103'
  where phone_normalized = '+905550101010';
select throws_ok('staff_client_archive', '42501', null, 'Staff cannot archive client');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_client_archive as
  update public.clients
  set status = 'archived',
      archived_at = now(),
      archived_by_user_id = '00000000-0000-4000-8000-00000000a101',
      updated_by_user_id = '00000000-0000-4000-8000-00000000a101'
  where phone_normalized = '+905550101010';
select lives_ok('owner_client_archive', 'Owner can archive client');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare client_delete as delete from public.clients where phone_normalized = '+905550101010';
select throws_ok('client_delete', '42501', null, 'Browser client cannot hard delete clients');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_active_phone as
  insert into public.clients (organization_id, full_name, phone, phone_normalized, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', 'Duplicate Active Phone', '+90 555 010 00 01', '+905550100001', '00000000-0000-4000-8000-00000000a101');
select throws_ok('duplicate_active_phone', '23505', null, 'Duplicate active normalized phone is rejected in same organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000b101');
prepare same_phone_beta as
  insert into public.clients (organization_id, full_name, phone, phone_normalized, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000b1', 'Beta Same Phone Allowed', '+90 555 010 00 01', '+905550100001', '00000000-0000-4000-8000-00000000b101');
select lives_ok('same_phone_beta', 'Different organizations can use the same normalized phone');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_tenant_responsible_membership as
  insert into public.clients (organization_id, full_name, phone, phone_normalized, responsible_membership_id, created_by_user_id)
  values (
    '00000000-0000-4000-8000-0000000000a1',
    'Cross Tenant Responsible',
    '+90 555 010 10 12',
    '+905550101012',
    '00000000-0000-4000-8000-00000000e203',
    '00000000-0000-4000-8000-00000000a101'
  );
select throws_ok('cross_tenant_responsible_membership', '23503', null, 'Responsible membership must belong to the same organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_tenant_created_by as
  insert into public.clients (organization_id, full_name, phone, phone_normalized, created_by_user_id)
  values (
    '00000000-0000-4000-8000-0000000000a1',
    'Cross Tenant Creator',
    '+90 555 010 10 13',
    '+905550101013',
    '00000000-0000-4000-8000-00000000b101'
  );
select throws_ok('cross_tenant_created_by', '42501', null, 'created_by_user_id cannot be tampered to another tenant user');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.clients), 0, 'Inactive membership loses client access immediately');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.procedures where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha member can read Alpha procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.procedures where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha member cannot read Beta procedures');

select pg_temp.as_anon();
prepare anon_procedure_read as select count(*)::int from public.procedures;
select throws_ok('anon_procedure_read', '42501', null, 'Anonymous user cannot read procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.procedures where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Staff can read procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_procedure_insert as
  insert into public.procedures (organization_id, name, normalized_name, category, description, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', 'Staff Procedure', 'staff procedure', 'Demo', 'Klinik tarafından yapılandırılacak temsili işlem kaydı', '00000000-0000-4000-8000-00000000a103');
select throws_ok('staff_procedure_insert', '42501', null, 'Staff cannot create procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_procedure_update as
  update public.procedures
  set status = 'inactive',
      updated_by_user_id = '00000000-0000-4000-8000-00000000a103'
  where normalized_name = 'alpha procedure one';
select lives_ok('staff_procedure_update', 'Staff procedure update attempt completes without mutating rows');
select is((select status from public.procedures where normalized_name = 'alpha procedure one'), 'active', 'Staff cannot update or deactivate procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_procedure_insert as
  insert into public.procedures (organization_id, name, normalized_name, category, description, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', 'Alpha Procedure New', 'alpha procedure new', 'Demo', 'Klinik tarafından yapılandırılacak temsili işlem kaydı', '00000000-0000-4000-8000-00000000a101');
select lives_ok('owner_procedure_insert', 'Owner can create procedure');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare admin_procedure_update as
  update public.procedures
  set category = 'Updated Demo',
      updated_by_user_id = '00000000-0000-4000-8000-00000000a102'
  where normalized_name = 'alpha procedure new';
select lives_ok('admin_procedure_update', 'Admin can update own organization procedure');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare alpha_update_beta_procedure as
  update public.procedures
  set category = 'Cross Tenant Tamper'
  where normalized_name = 'beta procedure one';
select lives_ok('alpha_update_beta_procedure', 'Alpha owner Beta procedure update affects no visible rows');
select is((select count(*)::int from public.procedures where normalized_name = 'beta procedure one'), 0, 'Alpha owner cannot mutate Beta procedure');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare procedure_delete as delete from public.procedures where normalized_name = 'alpha procedure new';
select throws_ok('procedure_delete', '42501', null, 'Browser client cannot hard delete procedures');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_procedure_name as
  insert into public.procedures (organization_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', 'ALPHA PROCEDURE ONE', 'alpha procedure one', '00000000-0000-4000-8000-00000000a101');
select throws_ok('duplicate_procedure_name', '23505', null, 'Duplicate normalized procedure name is rejected in same organization');

select pg_temp.as_user('00000000-0000-4000-8000-00000000b101');
prepare same_procedure_name_beta as
  insert into public.procedures (organization_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000b1', 'Alpha Procedure One', 'alpha procedure one', '00000000-0000-4000-8000-00000000b101');
select lives_ok('same_procedure_name_beta', 'Different organizations can reuse procedure names');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.procedures), 0, 'Inactive membership loses procedure access');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select ok(exists(select 1 from public.audit_logs where action = 'client.created' and safe_metadata ? 'source'), 'Client create audit is created');
select ok(exists(select 1 from public.audit_logs where action = 'client.updated'), 'Client update audit is created');
select ok(exists(select 1 from public.audit_logs where action = 'client.archived'), 'Client archive audit is created');
select ok(exists(select 1 from public.audit_logs where action in ('procedure.created', 'procedure.updated')), 'Procedure create/update audit is created');
select ok(not exists(select 1 from public.audit_logs where safe_metadata ?| array['full_name', 'phone', 'email', 'description', 'form_payload']), 'Audit metadata does not contain PII fields');

select pg_temp.as_service();
select lives_ok($$
  select public.write_audit_log(
    '00000000-0000-4000-8000-0000000000a1',
    'user',
    '00000000-0000-4000-8000-00000000a103',
    'client.archive_denied',
    'client',
    null,
    'denied',
    null,
    null,
    '{"reason":"permission_denied","permission_key":"client.archive","phone":"blocked"}'::jsonb
  )
$$, 'Denied client archive can be recorded safely by server-side audit');

select is(
  (
    select safe_metadata
    from public.audit_logs
    where action = 'client.archive_denied'
    order by id desc
    limit 1
  ),
  '{"reason":"permission_denied","permission_key":"client.archive"}'::jsonb,
  'Denied audit metadata strips PII'
);

select * from finish();

rollback;
