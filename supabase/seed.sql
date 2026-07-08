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

insert into public.permissions (key, description)
values
  ('template.read', 'Read care templates and versions'),
  ('template.create', 'Create care templates'),
  ('template.update', 'Update draft care templates'),
  ('template.publish', 'Publish care template versions'),
  ('template.deactivate', 'Deactivate care templates')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'template.read',
  'template.create',
  'template.update',
  'template.publish',
  'template.deactivate'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'template.read'
where r.key = 'staff'
on conflict do nothing;

insert into public.permissions (key, description)
values
  ('plan.read', 'Read care plans'),
  ('plan.create', 'Create care plans'),
  ('plan.update', 'Update care plan operational fields'),
  ('plan.stop', 'Stop care plans'),
  ('secure_link.create', 'Create secure care links'),
  ('secure_link.revoke', 'Revoke secure care links'),
  ('secure_link.rotate', 'Rotate secure care links')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'plan.read',
  'plan.create',
  'plan.update',
  'plan.stop',
  'secure_link.create',
  'secure_link.revoke',
  'secure_link.rotate'
)
where r.key in ('organization_owner', 'organization_admin', 'staff')
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
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  email_change_token_current = excluded.email_change_token_current,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  updated_at = now();

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-00000000a101',
    'alpha-owner@example.test',
    '00000000-0000-4000-8000-00000000a101',
    '{"sub":"00000000-0000-4000-8000-00000000a101","email":"alpha-owner@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000a102',
    'alpha-admin@example.test',
    '00000000-0000-4000-8000-00000000a102',
    '{"sub":"00000000-0000-4000-8000-00000000a102","email":"alpha-admin@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000a103',
    'alpha-staff@example.test',
    '00000000-0000-4000-8000-00000000a103',
    '{"sub":"00000000-0000-4000-8000-00000000a103","email":"alpha-staff@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000b101',
    'beta-owner@example.test',
    '00000000-0000-4000-8000-00000000b101',
    '{"sub":"00000000-0000-4000-8000-00000000b101","email":"beta-owner@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000b102',
    'beta-admin@example.test',
    '00000000-0000-4000-8000-00000000b102',
    '{"sub":"00000000-0000-4000-8000-00000000b102","email":"beta-admin@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000b103',
    'beta-staff@example.test',
    '00000000-0000-4000-8000-00000000b103',
    '{"sub":"00000000-0000-4000-8000-00000000b103","email":"beta-staff@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000f001',
    'no-membership@example.test',
    '00000000-0000-4000-8000-00000000f001',
    '{"sub":"00000000-0000-4000-8000-00000000f001","email":"no-membership@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-00000000f002',
    'inactive-member@example.test',
    '00000000-0000-4000-8000-00000000f002',
    '{"sub":"00000000-0000-4000-8000-00000000f002","email":"inactive-member@example.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
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

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a101', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into public.care_templates (
  id,
  organization_id,
  procedure_id,
  name,
  normalized_name,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000a401',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000d101',
    'Alpha Template One',
    'alpha template one',
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000a402',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000d102',
    'Alpha Template Two',
    'alpha template two',
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000a403',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000d103',
    'Alpha Template Three',
    'alpha template three',
    '00000000-0000-4000-8000-00000000a101'
  )
on conflict (id) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  updated_by_user_id = '00000000-0000-4000-8000-00000000a101',
  updated_at = now();

insert into public.care_template_versions (
  id,
  organization_id,
  care_template_id,
  version_number,
  status,
  title,
  internal_note,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000a501',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a401',
    1,
    'draft',
    'Temsili yayın versiyonu',
    'Temsili demo içeriği; gerçek bakım talimatı değildir.',
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000a582',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a402',
    1,
    'draft',
    'Görevsiz taslak',
    null,
    '00000000-0000-4000-8000-00000000a101'
  ),
  (
    '00000000-0000-4000-8000-00000000a581',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a403',
    1,
    'draft',
    'Boş taslak',
    null,
    '00000000-0000-4000-8000-00000000a101'
  )
on conflict (id) do nothing;

insert into public.care_template_days (id, organization_id, template_version_id, day_number, title, display_order)
values
  ('00000000-0000-4000-8000-00000000a601', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a501', 1, 'Temsili takip günü', 1),
  ('00000000-0000-4000-8000-00000000a682', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a582', 1, 'Görevsiz temsili gün', 1)
on conflict (id) do nothing;

insert into public.care_template_tasks (id, organization_id, template_day_id, title, description, task_type, required, display_order)
values
  (
    '00000000-0000-4000-8000-00000000a701',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a601',
    'Klinik tarafından yapılandırılmış temsili günlük görev',
    'Merkez tarafından belirlenecek takip adımı',
    'do',
    true,
    1
  )
on conflict (id) do nothing;

insert into public.symptom_options (id, organization_id, template_version_id, label, normalized_label, allows_severity, display_order)
values
  (
    '00000000-0000-4000-8000-00000000a801',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a501',
    'Klinik değerlendirmesi için temsili durum',
    'klinik değerlendirmesi için temsili durum',
    true,
    1
  )
on conflict (id) do nothing;

insert into public.alert_rules (id, organization_id, template_version_id, symptom_option_id, rule_type, severity_level, configuration, message_label)
values
  (
    '00000000-0000-4000-8000-00000000a901',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a501',
    '00000000-0000-4000-8000-00000000a801',
    'symptom_selected',
    'medium',
    '{}',
    'Temsili takip uyarısı'
  )
on conflict (id) do nothing;

do $$
begin
  if (select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a501') = 'draft' then
    perform public.publish_care_template_version('00000000-0000-4000-8000-00000000a501');
  end if;

  insert into public.care_template_versions (
    id,
    organization_id,
    care_template_id,
    version_number,
    status,
    title,
    internal_note,
    created_by_user_id
  )
  values (
    '00000000-0000-4000-8000-00000000a502',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a401',
    2,
    'draft',
    'Temsili emekli versiyon',
    null,
    '00000000-0000-4000-8000-00000000a101'
  )
  on conflict (id) do nothing;

  insert into public.care_template_days (id, organization_id, template_version_id, day_number, title, display_order)
  values ('00000000-0000-4000-8000-00000000a602', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a502', 1, 'Temsili geçmiş gün', 1)
  on conflict (id) do nothing;

  insert into public.care_template_tasks (id, organization_id, template_day_id, title, description, task_type, required, display_order)
  values (
    '00000000-0000-4000-8000-00000000a702',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-00000000a602',
    'Merkez tarafından belirlenecek takip adımı',
    null,
    'information',
    true,
    1
  )
  on conflict (id) do nothing;

  if (select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a502') = 'draft' then
    perform public.publish_care_template_version('00000000-0000-4000-8000-00000000a502');
    perform set_config('app.retiring_template_version', '00000000-0000-4000-8000-00000000a502', true);
    update public.care_template_versions
    set status = 'retired'
    where id = '00000000-0000-4000-8000-00000000a502';
    update public.care_templates
    set current_published_version_id = '00000000-0000-4000-8000-00000000a501',
        updated_by_user_id = '00000000-0000-4000-8000-00000000a101'
    where id = '00000000-0000-4000-8000-00000000a401';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b101', false);

insert into public.care_templates (
  id,
  organization_id,
  procedure_id,
  name,
  normalized_name,
  created_by_user_id
)
values
  (
    '00000000-0000-4000-8000-00000000b401',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-00000000d201',
    'Beta Template One',
    'beta template one',
    '00000000-0000-4000-8000-00000000b101'
  ),
  (
    '00000000-0000-4000-8000-00000000b402',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-00000000d202',
    'Beta Template Two',
    'beta template two',
    '00000000-0000-4000-8000-00000000b101'
  )
on conflict (id) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  updated_by_user_id = '00000000-0000-4000-8000-00000000b101',
  updated_at = now();

insert into public.care_template_versions (
  id,
  organization_id,
  care_template_id,
  version_number,
  status,
  title,
  created_by_user_id
)
values
  ('00000000-0000-4000-8000-00000000b501', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b401', 1, 'draft', 'Beta yayın versiyonu', '00000000-0000-4000-8000-00000000b101'),
  ('00000000-0000-4000-8000-00000000b502', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b402', 1, 'draft', 'Beta taslak versiyonu', '00000000-0000-4000-8000-00000000b101')
on conflict (id) do nothing;

insert into public.care_template_days (id, organization_id, template_version_id, day_number, title, display_order)
values
  ('00000000-0000-4000-8000-00000000b601', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b501', 1, 'Beta temsili takip günü', 1),
  ('00000000-0000-4000-8000-00000000b602', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b502', 1, 'Beta taslak günü', 1)
on conflict (id) do nothing;

insert into public.care_template_tasks (id, organization_id, template_day_id, title, task_type, required, display_order)
values
  ('00000000-0000-4000-8000-00000000b701', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b601', 'Klinik tarafından yapılandırılmış temsili günlük görev', 'do', true, 1)
on conflict (id) do nothing;

insert into public.symptom_options (id, organization_id, template_version_id, label, normalized_label, display_order)
values
  ('00000000-0000-4000-8000-00000000b801', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b501', 'Klinik değerlendirmesi için temsili durum', 'klinik değerlendirmesi için temsili durum', 1)
on conflict (id) do nothing;

do $$
begin
  if (select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000b501') = 'draft' then
    perform public.publish_care_template_version('00000000-0000-4000-8000-00000000b501');
  end if;
end $$;

reset role;
select set_config('app.creating_care_plan_snapshot', 'on', true);

insert into public.care_plans (
  id,
  organization_id,
  client_id,
  procedure_id,
  care_template_id,
  template_version_id,
  responsible_membership_id,
  status,
  start_date,
  end_date,
  control_date,
  stopped_at,
  stopped_by_user_id,
  created_by_user_id
)
values
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000a401', '00000000-0000-4000-8000-00000000a501', (select id from public.organization_memberships where organization_id = '00000000-0000-4000-8000-0000000000a1' and user_id = '00000000-0000-4000-8000-00000000a103'), 'active', current_date, current_date, now() + interval '7 days', null, null, '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000a401', '00000000-0000-4000-8000-00000000a501', null, 'scheduled', current_date + 1, current_date + 1, null, null, null, '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c103', '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000a401', '00000000-0000-4000-8000-00000000a501', null, 'completed', current_date - 3, current_date - 3, null, null, null, '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000a401', '00000000-0000-4000-8000-00000000a501', null, 'stopped', current_date - 1, current_date - 1, null, now() - interval '1 hour', '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000c201', '00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-00000000b401', '00000000-0000-4000-8000-00000000b501', null, 'active', current_date, current_date, null, null, null, '00000000-0000-4000-8000-00000000b101'),
  ('00000000-0000-4000-8000-00000000e202', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000c202', '00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-00000000b401', '00000000-0000-4000-8000-00000000b501', null, 'scheduled', current_date + 1, current_date + 1, null, null, null, '00000000-0000-4000-8000-00000000b101')
on conflict (id) do nothing;

insert into public.care_plan_days (id, organization_id, care_plan_id, source_template_day_id, day_number, scheduled_date, title)
values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000a601', 1, current_date, 'Temsili takip günü'),
  ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000a601', 1, current_date + 1, 'Temsili takip günü'),
  ('00000000-0000-4000-8000-00000000f103', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-00000000a601', 1, current_date - 3, 'Temsili takip günü'),
  ('00000000-0000-4000-8000-00000000f104', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-00000000a601', 1, current_date - 1, 'Temsili takip günü'),
  ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-00000000b601', 1, current_date, 'Beta temsili takip günü'),
  ('00000000-0000-4000-8000-00000000f202', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000e202', '00000000-0000-4000-8000-00000000b601', 1, current_date + 1, 'Beta temsili takip günü')
on conflict (id) do nothing;

insert into public.care_plan_tasks (id, organization_id, care_plan_day_id, source_template_task_id, title, description, task_type, required, display_order)
values
  ('00000000-0000-4000-8000-00000000a711', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000a701', 'Klinik tarafından yapılandırılmış temsili günlük görev', 'Merkez tarafından belirlenecek takip adımı', 'do', true, 1),
  ('00000000-0000-4000-8000-00000000a712', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000a701', 'Klinik tarafından yapılandırılmış temsili günlük görev', 'Merkez tarafından belirlenecek takip adımı', 'do', true, 1),
  ('00000000-0000-4000-8000-00000000a713', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f103', '00000000-0000-4000-8000-00000000a701', 'Klinik tarafından yapılandırılmış temsili günlük görev', 'Merkez tarafından belirlenecek takip adımı', 'do', true, 1),
  ('00000000-0000-4000-8000-00000000a714', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f104', '00000000-0000-4000-8000-00000000a701', 'Klinik tarafından yapılandırılmış temsili günlük görev', 'Merkez tarafından belirlenecek takip adımı', 'do', true, 1),
  ('00000000-0000-4000-8000-00000000b711', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000b701', 'Klinik tarafından yapılandırılmış temsili günlük görev', null, 'do', true, 1),
  ('00000000-0000-4000-8000-00000000b712', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000f202', '00000000-0000-4000-8000-00000000b701', 'Klinik tarafından yapılandırılmış temsili günlük görev', null, 'do', true, 1)
on conflict (id) do nothing;

insert into public.secure_links (id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id)
values
  ('00000000-0000-4000-8000-00000000a911', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e101', 'hash-seed-active', 'see', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000a101'),
  ('00000000-0000-4000-8000-00000000b911', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000e201', 'hash-seed-beta', 'bet', 'active', now() + interval '3 days', '00000000-0000-4000-8000-00000000b101')
on conflict (id) do nothing;

select set_config('app.creating_care_plan_snapshot', 'off', true);
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

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('alert.read', 'alert.acknowledge', 'alert.resolve', 'alert.dismiss')
where r.key in ('organization_owner', 'organization_admin', 'staff')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.request.manage', 'photo.view')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.view')
where r.key = 'staff'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'consent.manage', 'data_request.read', 'data_request.manage')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'data_request.read')
where r.key = 'staff'
on conflict do nothing;
