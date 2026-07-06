alter table public.permissions drop constraint permissions_key_check;
alter table public.permissions add constraint permissions_key_check check (
  key in (
    'organization.read',
    'organization.update',
    'membership.read',
    'membership.manage',
    'audit.read',
    'client.read',
    'client.create',
    'client.update',
    'client.archive',
    'procedure.read',
    'procedure.manage'
  )
);

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (
  action in (
    'auth.login_success',
    'auth.login_failure',
    'organization.viewed',
    'organization.updated',
    'membership.viewed',
    'membership.created',
    'membership.role_updated',
    'membership.deactivated',
    'authorization.denied',
    'client.created',
    'client.viewed',
    'client.updated',
    'client.archived',
    'client.archive_denied',
    'procedure.created',
    'procedure.viewed',
    'procedure.updated',
    'procedure.deactivated',
    'procedure.manage_denied'
  )
);

alter table public.audit_logs drop constraint audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (
  entity_type in ('auth', 'organization', 'membership', 'audit_log', 'client', 'procedure')
);

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
        'permission',
        'permission_key',
        'source',
        'previous_status',
        'new_status',
        'changed_fields'
      )
    ),
    '{}'::jsonb
  );
$$;

create unique index organization_memberships_organization_id_id_unique
on public.organization_memberships(organization_id, id);

create unique index organization_memberships_organization_id_user_id_unique
on public.organization_memberships(organization_id, user_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null check (full_name = btrim(full_name) and length(full_name) between 2 and 120),
  phone text not null check (length(btrim(phone)) between 10 and 32),
  phone_normalized text not null check (phone_normalized ~ '^\+90[0-9]{10}$'),
  email text check (email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  responsible_membership_id uuid,
  created_by_user_id uuid not null,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by_user_id uuid,
  constraint clients_responsible_membership_same_org_fk
    foreign key (organization_id, responsible_membership_id)
    references public.organization_memberships(organization_id, id),
  constraint clients_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint clients_updated_by_same_org_fk
    foreign key (organization_id, updated_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint clients_archived_by_same_org_fk
    foreign key (organization_id, archived_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint clients_archive_fields_consistent check (
    (status = 'active' and archived_at is null and archived_by_user_id is null)
    or
    (status = 'archived' and archived_at is not null and archived_by_user_id is not null)
  )
);

create unique index clients_active_phone_unique
on public.clients(organization_id, phone_normalized)
where status = 'active';

create index clients_organization_status_created_at_idx
on public.clients(organization_id, status, created_at desc);

create index clients_responsible_membership_id_idx
on public.clients(responsible_membership_id);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (name = btrim(name) and length(name) between 2 and 120),
  normalized_name text not null check (normalized_name = btrim(lower(normalized_name)) and length(normalized_name) between 2 and 120),
  category text check (category is null or length(btrim(category)) between 2 and 80),
  description text check (description is null or length(btrim(description)) between 2 and 280),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by_user_id uuid not null,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint procedures_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint procedures_updated_by_same_org_fk
    foreign key (organization_id, updated_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint procedures_inactive_fields_consistent check (
    (status = 'active' and archived_at is null)
    or
    (status = 'inactive' and archived_at is not null)
  )
);

create unique index procedures_normalized_name_unique
on public.procedures(organization_id, normalized_name);

create index procedures_organization_status_idx
on public.procedures(organization_id, status, created_at desc);

alter table public.clients enable row level security;
alter table public.procedures enable row level security;

create or replace function public.current_user_is_active_member(target_organization_id uuid, target_user_id uuid)
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
      and om.user_id = target_user_id
      and om.status = 'active'
  );
$$;

create or replace function public.membership_is_active_in_organization(target_organization_id uuid, target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_membership_id is null or exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.id = target_membership_id
      and om.status = 'active'
  );
$$;

revoke all on function public.current_user_is_active_member(uuid, uuid) from public;
revoke all on function public.membership_is_active_in_organization(uuid, uuid) from public;
grant execute on function public.current_user_is_active_member(uuid, uuid) to authenticated;
grant execute on function public.membership_is_active_in_organization(uuid, uuid) to authenticated;

create or replace function public.enforce_client_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.current_user_has_permission(new.organization_id, 'client.create') then
      raise exception 'client create permission denied' using errcode = '42501';
    end if;

    if new.created_by_user_id <> auth.uid() then
      raise exception 'created_by_user_id must match authenticated user' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'client organization cannot be changed' using errcode = '42501';
    end if;

    if new.created_by_user_id <> old.created_by_user_id then
      raise exception 'client creator cannot be changed' using errcode = '42501';
    end if;

    if not public.current_user_has_permission(new.organization_id, 'client.update') then
      raise exception 'client update permission denied' using errcode = '42501';
    end if;

    if (
      new.status is distinct from old.status
      or new.archived_at is distinct from old.archived_at
      or new.archived_by_user_id is distinct from old.archived_by_user_id
    ) and not public.current_user_has_permission(new.organization_id, 'client.archive') then
      raise exception 'client archive permission denied' using errcode = '42501';
    end if;
  end if;

  if not public.current_user_is_active_member(new.organization_id, new.created_by_user_id) then
    raise exception 'client creator must be an active organization member' using errcode = '23503';
  end if;

  if new.updated_by_user_id is not null and not public.current_user_is_active_member(new.organization_id, new.updated_by_user_id) then
    raise exception 'client updater must be an active organization member' using errcode = '23503';
  end if;

  if new.archived_by_user_id is not null and not public.current_user_is_active_member(new.organization_id, new.archived_by_user_id) then
    raise exception 'client archiver must be an active organization member' using errcode = '23503';
  end if;

  if not public.membership_is_active_in_organization(new.organization_id, new.responsible_membership_id) then
    raise exception 'responsible membership must be active in organization' using errcode = '23503';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_enforce_rules
before insert or update on public.clients
for each row execute function public.enforce_client_rules();

create or replace function public.enforce_procedure_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.current_user_has_permission(new.organization_id, 'procedure.manage') then
      raise exception 'procedure manage permission denied' using errcode = '42501';
    end if;

    if new.created_by_user_id <> auth.uid() then
      raise exception 'created_by_user_id must match authenticated user' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'procedure organization cannot be changed' using errcode = '42501';
    end if;

    if new.created_by_user_id <> old.created_by_user_id then
      raise exception 'procedure creator cannot be changed' using errcode = '42501';
    end if;

    if not public.current_user_has_permission(new.organization_id, 'procedure.manage') then
      raise exception 'procedure manage permission denied' using errcode = '42501';
    end if;
  end if;

  if not public.current_user_is_active_member(new.organization_id, new.created_by_user_id) then
    raise exception 'procedure creator must be an active organization member' using errcode = '23503';
  end if;

  if new.updated_by_user_id is not null and not public.current_user_is_active_member(new.organization_id, new.updated_by_user_id) then
    raise exception 'procedure updater must be an active organization member' using errcode = '23503';
  end if;

  if new.status = 'inactive' and new.archived_at is null then
    new.archived_at = now();
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger procedures_enforce_rules
before insert or update on public.procedures
for each row execute function public.enforce_procedure_rules();

create or replace function public.audit_clients_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (new.organization_id, 'user', auth.uid(), 'client.created', 'client', new.id, 'success', '{"source":"db_trigger"}'::jsonb);
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      new.organization_id,
      'user',
      auth.uid(),
      case when old.status <> 'archived' and new.status = 'archived' then 'client.archived' else 'client.updated' end,
      'client',
      new.id,
      'success',
      public.sanitize_audit_metadata(jsonb_build_object('source', 'db_trigger', 'previous_status', old.status, 'new_status', new.status))
    );
  end if;

  return new;
end;
$$;

create trigger clients_audit_change
after insert or update on public.clients
for each row execute function public.audit_clients_change();

create or replace function public.audit_procedures_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (new.organization_id, 'user', auth.uid(), 'procedure.created', 'procedure', new.id, 'success', '{"source":"db_trigger"}'::jsonb);
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      new.organization_id,
      'user',
      auth.uid(),
      case when old.status <> 'inactive' and new.status = 'inactive' then 'procedure.deactivated' else 'procedure.updated' end,
      'procedure',
      new.id,
      'success',
      public.sanitize_audit_metadata(jsonb_build_object('source', 'db_trigger', 'previous_status', old.status, 'new_status', new.status))
    );
  end if;

  return new;
end;
$$;

create trigger procedures_audit_change
after insert or update on public.procedures
for each row execute function public.audit_procedures_change();

create policy "members can read organization clients"
on public.clients
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'client.read'));

create policy "members can create organization clients"
on public.clients
for insert
to authenticated
with check (
  public.current_user_has_permission(organization_id, 'client.create')
  and created_by_user_id = auth.uid()
);

create policy "members can update organization clients"
on public.clients
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'client.update'))
with check (public.current_user_has_permission(organization_id, 'client.update'));

create policy "members can read organization procedures"
on public.procedures
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'procedure.read'));

create policy "admins can create organization procedures"
on public.procedures
for insert
to authenticated
with check (
  public.current_user_has_permission(organization_id, 'procedure.manage')
  and created_by_user_id = auth.uid()
);

create policy "admins can update organization procedures"
on public.procedures
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'procedure.manage'))
with check (public.current_user_has_permission(organization_id, 'procedure.manage'));

grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.procedures to authenticated;

revoke all on public.clients from anon;
revoke all on public.procedures from anon;
revoke delete on public.clients from authenticated;
revoke delete on public.procedures from authenticated;

grant execute on function public.current_user_is_active_member(uuid, uuid) to authenticated;
grant execute on function public.membership_is_active_in_organization(uuid, uuid) to authenticated;
