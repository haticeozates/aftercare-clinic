insert into public.roles (key, display_name)
values
  ('organization_owner', 'Organization Owner'),
  ('organization_admin', 'Organization Admin'),
  ('staff', 'Staff')
on conflict (key) do update set display_name = excluded.display_name;

insert into public.permissions (key, description)
values
  ('organization.read', 'Read organization foundation data'),
  ('organization.update', 'Update organization foundation settings'),
  ('membership.read', 'Read organization memberships'),
  ('membership.manage', 'Create or update organization memberships'),
  ('audit.read', 'Read organization audit logs')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'organization.read',
  'organization.update',
  'membership.read',
  'membership.manage',
  'audit.read'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'organization.read'
where r.key = 'staff'
on conflict do nothing;

insert into public.permissions (key, description)
values
  ('client.read', 'Read organization client records'),
  ('client.create', 'Create organization client records'),
  ('client.update', 'Update organization client records'),
  ('client.archive', 'Archive organization client records'),
  ('procedure.read', 'Read organization procedure records'),
  ('procedure.manage', 'Create or update organization procedure records')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'client.read',
  'client.create',
  'client.update',
  'client.archive',
  'procedure.read',
  'procedure.manage'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'client.read',
  'client.create',
  'client.update',
  'procedure.read'
)
where r.key = 'staff'
on conflict do nothing;

insert into public.organizations (id, name, slug, status)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Organization Alpha', 'organization-alpha', 'active'),
  ('00000000-0000-4000-8000-0000000000b1', 'Organization Beta', 'organization-beta', 'active')
on conflict (slug) do update set name = excluded.name, status = excluded.status;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000a101',
    'authenticated',
    'authenticated',
    'alpha-owner@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000a102',
    'authenticated',
    'authenticated',
    'alpha-admin@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000a103',
    'authenticated',
    'authenticated',
    'alpha-staff@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000b101',
    'authenticated',
    'authenticated',
    'beta-owner@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000b102',
    'authenticated',
    'authenticated',
    'beta-admin@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000b103',
    'authenticated',
    'authenticated',
    'beta-staff@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000f001',
    'authenticated',
    'authenticated',
    'no-membership@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000f002',
    'authenticated',
    'authenticated',
    'inactive-member@example.test',
    crypt('local-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

insert into public.user_profiles (id, display_name)
values
  ('00000000-0000-4000-8000-00000000a101', 'Alpha Owner'),
  ('00000000-0000-4000-8000-00000000a102', 'Alpha Admin'),
  ('00000000-0000-4000-8000-00000000a103', 'Alpha Staff'),
  ('00000000-0000-4000-8000-00000000b101', 'Beta Owner'),
  ('00000000-0000-4000-8000-00000000b102', 'Beta Admin'),
  ('00000000-0000-4000-8000-00000000b103', 'Beta Staff'),
  ('00000000-0000-4000-8000-00000000f001', 'No Membership User'),
  ('00000000-0000-4000-8000-00000000f002', 'Inactive Member')
on conflict (id) do update set
  display_name = excluded.display_name,
  updated_at = now();

insert into public.organization_memberships (
  id,
  organization_id,
  user_id,
  role_id,
  status
)
select
  membership.id,
  membership.organization_id,
  membership.user_id,
  roles.id,
  membership.status
from (
  values
    (
      '00000000-0000-4000-8000-00000000e101'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      '00000000-0000-4000-8000-00000000a101'::uuid,
      'organization_owner',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e102'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      '00000000-0000-4000-8000-00000000a102'::uuid,
      'organization_admin',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e103'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      '00000000-0000-4000-8000-00000000a103'::uuid,
      'staff',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e201'::uuid,
      '00000000-0000-4000-8000-0000000000b1'::uuid,
      '00000000-0000-4000-8000-00000000b101'::uuid,
      'organization_owner',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e202'::uuid,
      '00000000-0000-4000-8000-0000000000b1'::uuid,
      '00000000-0000-4000-8000-00000000b102'::uuid,
      'organization_admin',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e203'::uuid,
      '00000000-0000-4000-8000-0000000000b1'::uuid,
      '00000000-0000-4000-8000-00000000b103'::uuid,
      'staff',
      'active'
    ),
    (
      '00000000-0000-4000-8000-00000000e301'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      '00000000-0000-4000-8000-00000000f002'::uuid,
      'staff',
      'inactive'
    )
) as membership(id, organization_id, user_id, role_key, status)
join public.roles on roles.key = membership.role_key
on conflict (organization_id, user_id) do update set
  role_id = excluded.role_id,
  status = excluded.status,
  updated_at = now();

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a101', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.clients (
  id,
  organization_id,
  full_name,
  phone,
  phone_normalized,
  email,
  responsible_membership_id,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-4000-8000-0000000000a1',
    'Synthetic Alpha Client One',
    '+90 555 010 00 01',
    '+905550100001',
    'alpha-client-one@example.test',
    (select id from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000a1' and user_id = '00000000-0000-4000-8000-00000000a103'),
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000c102',
    '00000000-0000-4000-8000-0000000000a1',
    'Synthetic Alpha Client Two',
    '+90 555 010 00 02',
    '+905550100002',
    null,
    (select id from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000a1' and user_id = '00000000-0000-4000-8000-00000000a102'),
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000c103',
    '00000000-0000-4000-8000-0000000000a1',
    'Synthetic Alpha Client Three',
    '+90 555 010 00 03',
    '+905550100003',
    'alpha-client-three@example.test',
    null,
    '00000000-0000-4000-8000-00000000a101'
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  phone_normalized = excluded.phone_normalized,
  email = excluded.email,
  responsible_membership_id = excluded.responsible_membership_id,
  updated_by_user_id = '00000000-0000-4000-8000-00000000a101',
  updated_at = now();

insert into public.procedures (
  id,
  organization_id,
  name,
  normalized_name,
  category,
  description,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000d101',
    '00000000-0000-4000-8000-0000000000a1',
    'Alpha Procedure One',
    'alpha procedure one',
    'Demo',
    'Klinik tarafından yapılandırılacak temsili işlem kaydı',
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000d102',
    '00000000-0000-4000-8000-0000000000a1',
    'Alpha Procedure Two',
    'alpha procedure two',
    'Demo',
    'Klinik tarafından yapılandırılacak temsili işlem kaydı',
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000d103',
    '00000000-0000-4000-8000-0000000000a1',
    'Alpha Procedure Three',
    'alpha procedure three',
    'Demo',
    'Klinik tarafından yapılandırılacak temsili işlem kaydı',
    '00000000-0000-4000-8000-00000000a101'
  )
on conflict (id) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  category = excluded.category,
  description = excluded.description,
  updated_by_user_id = '00000000-0000-4000-8000-00000000a101',
  updated_at = now();

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b101', false);

insert into public.clients (
  id,
  organization_id,
  full_name,
  phone,
  phone_normalized,
  email,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-0000000000b1',
    'Synthetic Beta Client One',
    '+90 555 020 00 01',
    '+905550200001',
    'beta-client-one@example.test',
    '00000000-0000-4000-8000-00000000b101'
  ),
  (
    '00000000-0000-4000-8000-00000000c202',
    '00000000-0000-4000-8000-0000000000b1',
    'Synthetic Beta Client Two',
    '+90 555 020 00 02',
    '+905550200002',
    null,
    '00000000-0000-4000-8000-00000000b101'
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  phone_normalized = excluded.phone_normalized,
  email = excluded.email,
  updated_by_user_id = '00000000-0000-4000-8000-00000000b101',
  updated_at = now();

insert into public.procedures (
  id,
  organization_id,
  name,
  normalized_name,
  category,
  description,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000d201',
    '00000000-0000-4000-8000-0000000000b1',
    'Beta Procedure One',
    'beta procedure one',
    'Demo',
    'Klinik tarafından yapılandırılacak temsili işlem kaydı',
    '00000000-0000-4000-8000-00000000b101'
  ),
  (
    '00000000-0000-4000-8000-00000000d202',
    '00000000-0000-4000-8000-0000000000b1',
    'Beta Procedure Two',
    'beta procedure two',
    'Demo',
    'Klinik tarafından yapılandırılacak temsili işlem kaydı',
    '00000000-0000-4000-8000-00000000b101'
  )
on conflict (id) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  category = excluded.category,
  description = excluded.description,
  updated_by_user_id = '00000000-0000-4000-8000-00000000b101',
  updated_at = now();

reset role;

insert into public.audit_logs (
  organization_id,
  actor_type,
  action,
  entity_type,
  entity_id,
  result,
  safe_metadata
)
values
  (
    '00000000-0000-4000-8000-0000000000a1',
    'system',
    'organization.viewed',
    'organization',
    '00000000-0000-4000-8000-0000000000a1',
    'success',
    '{"reason":"synthetic_seed"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-0000000000b1',
    'system',
    'organization.viewed',
    'organization',
    '00000000-0000-4000-8000-0000000000b1',
    'success',
    '{"reason":"synthetic_seed"}'::jsonb
  );
