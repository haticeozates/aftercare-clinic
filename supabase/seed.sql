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

insert into public.organizations (id, name, slug, status)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Organization Alpha', 'organization-alpha', 'active'),
  ('00000000-0000-4000-8000-0000000000b1', 'Organization Beta', 'organization-beta', 'active')
on conflict (slug) do update set name = excluded.name, status = excluded.status;

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
