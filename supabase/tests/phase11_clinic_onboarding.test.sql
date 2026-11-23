begin;
select no_plan();

insert into auth.users (id, email, email_confirmed_at) values
 ('11000000-0000-4000-8000-000000000001', 'phase11-sql-owner@example.test', now()),
 ('11000000-0000-4000-8000-000000000002', 'phase11-sql-staff@example.test', now()),
 ('11000000-0000-4000-8000-000000000003', 'phase11-sql-unconfirmed@example.test', null),
 ('11000000-0000-4000-8000-000000000004', 'phase11-sql-other@example.test', now());

insert into public.phase11_onboarding (user_id) values
 ('11000000-0000-4000-8000-000000000001'),
 ('11000000-0000-4000-8000-000000000003'),
 ('11000000-0000-4000-8000-000000000004');

create function pg_temp.phase11_create(actor uuid) returns uuid language sql as $$
  select public.phase11_create_clinic(actor, 'Sentetik SQL Klinik', 'Demo', '', '', 'Europe/Istanbul')
$$;

set local role service_role;
select throws_ok(
  $$select pg_temp.phase11_create('11000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'Unconfirmed account cannot form a clinic'
);
select lives_ok($$select pg_temp.phase11_create('11000000-0000-4000-8000-000000000001')$$,
  'Verified account creates clinic');
select is(pg_temp.phase11_create('11000000-0000-4000-8000-000000000001'),
  (select organization_id from public.phase11_onboarding where user_id = '11000000-0000-4000-8000-000000000001'),
  'Reusing the setup request returns the same clinic');
select lives_ok($$select pg_temp.phase11_create('11000000-0000-4000-8000-000000000004')$$,
  'Separate clinic belongs to separate account');

reset role;
create function pg_temp.phase11_clinic(actor uuid) returns uuid
language sql security definer set search_path = '' as $$
  select organization_id from public.phase11_onboarding where user_id = actor
$$;
create function pg_temp.phase11_owner() returns uuid language sql as $$
  select '11000000-0000-4000-8000-000000000001'::uuid
$$;
create function pg_temp.phase11_staff() returns uuid language sql as $$
  select '11000000-0000-4000-8000-000000000002'::uuid
$$;
create function pg_temp.phase11_other() returns uuid language sql as $$
  select '11000000-0000-4000-8000-000000000004'::uuid
$$;
create function pg_temp.phase11_member(actor uuid) returns uuid
language sql security definer set search_path = '' as $$
  select id from public.organization_memberships where user_id = actor
$$;
create function pg_temp.phase11_make_invite(actor uuid, hash text) returns uuid language sql as $$
  select id from public.phase11_manage_invite(actor, pg_temp.phase11_clinic(pg_temp.phase11_owner()),
    'create', null, 'phase11-sql-staff@example.test', 'staff', hash)
$$;

set local role service_role;
select lives_ok($$select pg_temp.phase11_make_invite(pg_temp.phase11_owner(), repeat('1',64))$$,
  'Owner can invite staff');
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_other(), repeat('1',64))$$, '42501',
  null, 'Invitation rejects an authenticated wrong recipient');
select lives_ok($$select public.phase11_manage_invite(pg_temp.phase11_owner(), pg_temp.phase11_clinic(pg_temp.phase11_owner()),
  'create', null, 'phase11-sql-other@example.test', 'staff', repeat('4',64))$$,
  'Owner can send an invitation to an address that belongs to another account');
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_other(), repeat('4',64))$$, '42501',
  null, 'Correct recipient cannot attach an already active account to a different tenant');
select throws_ok($$select public.phase11_update_clinic(pg_temp.phase11_other(), pg_temp.phase11_clinic(pg_temp.phase11_owner()),
  'Tampered', 'Tampered', '', '', 'UTC')$$, '42501', null, 'Other tenant cannot change clinic settings even through the service RPC');
update public.phase11_team_invites set expires_at = now() - interval '1 minute' where token_hash = repeat('1',64);
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_staff(), repeat('1',64))$$, '42501',
  null, 'Expired invitation is denied');
select lives_ok($$select public.phase11_manage_invite(pg_temp.phase11_owner(), pg_temp.phase11_clinic(pg_temp.phase11_owner()),
  'resend', (select id from public.phase11_team_invites where token_hash = repeat('1',64)), null, null, repeat('2',64))$$,
  'Resending rotates invitation token');
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_staff(), repeat('1',64))$$, '42501',
  null, 'Rotated token is denied');
select is(public.phase11_accept_invite(pg_temp.phase11_staff(), repeat('2',64)),
  pg_temp.phase11_clinic(pg_temp.phase11_owner()), 'Verified recipient joins the intended tenant');
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_staff(), repeat('2',64))$$, '42501',
  null, 'Accepted link is single use');
select throws_ok($$select pg_temp.phase11_make_invite(pg_temp.phase11_staff(), repeat('3',64))$$, '42501',
  null, 'Staff cannot invite');
select throws_ok($$select public.phase11_change_membership(pg_temp.phase11_owner(), pg_temp.phase11_clinic(pg_temp.phase11_owner()),
  pg_temp.phase11_member(pg_temp.phase11_owner()), 'staff', true)$$, '23514',
  null, 'Owner cannot remove the last active owner');
select throws_ok($$select public.phase11_change_membership(pg_temp.phase11_owner(), pg_temp.phase11_clinic(pg_temp.phase11_owner()),
  pg_temp.phase11_member(pg_temp.phase11_other()), 'staff', false)$$, '42501',
  null, 'Membership identifiers cannot cross tenants');

reset role;
select set_config('request.jwt.claim.sub', pg_temp.phase11_owner()::text, true);
set local role authenticated;
select throws_ok($$select email from public.phase11_team_invites$$, '42501', null, 'Browser cannot inspect invitation records');
select throws_ok($$select * from public.phase11_clinic_settings$$, '42501', null, 'Browser cannot bypass the clinic settings service');
select throws_ok($$select public.phase11_accept_invite(pg_temp.phase11_staff(), repeat('2',64))$$, '42501', null,
  'Browser cannot pass an arbitrary actor ID to the service');
select throws_ok($$update public.organization_memberships set role_id = (select id from public.roles where key = 'organization_owner')
  where user_id = pg_temp.phase11_staff()$$, '42501', null, 'Phase 11 owners must use the controlled role workflow');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a102', true);
set local role authenticated;
select throws_ok($$update public.organization_memberships set role_id = (select id from public.roles where key = 'organization_owner')
  where user_id = '00000000-0000-4000-8000-00000000a103'$$, '42501', null,
  'Legacy admins cannot manufacture a new owner');

reset role;
set local role anon;
select throws_ok($$select * from public.phase11_onboarding$$, '42501', null, 'Anonymous onboarding access is denied');
reset role;

select * from finish();
rollback;
