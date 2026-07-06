create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('organization_owner', 'organization_admin', 'staff')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (
    key in (
      'organization.read',
      'organization.update',
      'membership.read',
      'membership.manage',
      'audit.read'
    )
  ),
  description text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_id_idx on public.organization_memberships(user_id);
create index organization_memberships_organization_id_idx on public.organization_memberships(organization_id);
create index organization_memberships_role_id_idx on public.organization_memberships(role_id);

create table public.audit_logs (
  id bigint primary key generated always as identity,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in (
      'auth.login_success',
      'auth.login_failure',
      'organization.viewed',
      'organization.updated',
      'membership.viewed',
      'membership.created',
      'membership.role_updated',
      'membership.deactivated',
      'authorization.denied'
    )
  ),
  entity_type text not null check (entity_type in ('auth', 'organization', 'membership', 'audit_log')),
  entity_id uuid,
  result text not null check (result in ('success', 'failure', 'denied')),
  request_id text,
  session_id text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_safe_metadata_is_object check (jsonb_typeof(safe_metadata) = 'object'),
  constraint audit_logs_safe_metadata_size check (pg_column_size(safe_metadata) <= 4096)
);

create index audit_logs_organization_created_at_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_has_active_membership(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.current_user_has_permission(
  target_organization_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    join public.role_permissions rp on rp.role_id = om.role_id
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and p.key = required_permission
  );
$$;

revoke all on function public.current_user_has_active_membership(uuid) from public;
revoke all on function public.current_user_has_permission(uuid, text) from public;
grant execute on function public.current_user_has_active_membership(uuid) to authenticated;
grant execute on function public.current_user_has_permission(uuid, text) to authenticated;

create or replace function public.sanitize_audit_metadata(input_metadata jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, value)
      from jsonb_each(coalesce(input_metadata, '{}'::jsonb))
      where key in (
        'reason',
        'target_role',
        'previous_role',
        'membership_status',
        'request_path',
        'permission'
      )
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_logs are append-only'
    using errcode = '42501';
end;
$$;

create trigger audit_logs_prevent_update
before update on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create trigger audit_logs_prevent_delete
before delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create or replace function public.write_audit_log(
  target_organization_id uuid,
  actor_type text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  result text,
  request_id text,
  session_id text,
  safe_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id bigint;
begin
  insert into public.audit_logs (
    organization_id,
    actor_type,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    result,
    request_id,
    session_id,
    safe_metadata
  )
  values (
    target_organization_id,
    actor_type,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    result,
    request_id,
    session_id,
    public.sanitize_audit_metadata(safe_metadata)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.sanitize_audit_metadata(jsonb) from public;
revoke all on function public.prevent_audit_log_mutation() from public;
revoke all on function public.write_audit_log(uuid, text, uuid, text, text, uuid, text, text, text, jsonb) from public;
grant execute on function public.sanitize_audit_metadata(jsonb) to service_role;
grant execute on function public.write_audit_log(uuid, text, uuid, text, text, uuid, text, text, text, jsonb) to service_role;

create policy "members can read their organizations"
on public.organizations
for select
to authenticated
using (public.current_user_has_active_membership(id));

create policy "admins can update their organizations"
on public.organizations
for update
to authenticated
using (public.current_user_has_permission(id, 'organization.update'))
with check (public.current_user_has_permission(id, 'organization.update'));

create policy "users can read their own profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy "users can update their own profile"
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "authenticated users can read role metadata"
on public.roles
for select
to authenticated
using (true);

create policy "authenticated users can read permission metadata"
on public.permissions
for select
to authenticated
using (true);

create policy "authenticated users can read role permission metadata"
on public.role_permissions
for select
to authenticated
using (true);

create policy "users can read their own memberships"
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy "admins can read organization memberships"
on public.organization_memberships
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'membership.read'));

create policy "admins can create organization memberships"
on public.organization_memberships
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'membership.manage'));

create policy "admins can update organization memberships"
on public.organization_memberships
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'membership.manage'))
with check (public.current_user_has_permission(organization_id, 'membership.manage'));

create policy "admins can read organization audit logs"
on public.audit_logs
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'audit.read'));

-- audit_logs are append-only for browser clients; controlled server-side writers use the service role.
grant select, update on public.organizations to authenticated;
grant select, update on public.user_profiles to authenticated;
grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select, insert, update on public.organization_memberships to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

revoke all on public.organizations from anon;
revoke all on public.user_profiles from anon;
revoke all on public.roles from anon;
revoke all on public.permissions from anon;
revoke all on public.role_permissions from anon;
revoke all on public.organization_memberships from anon;
revoke all on public.audit_logs from anon;

revoke insert, delete on public.organizations from authenticated;
revoke insert, delete on public.user_profiles from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.roles from authenticated;
revoke insert, update, delete on public.permissions from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
