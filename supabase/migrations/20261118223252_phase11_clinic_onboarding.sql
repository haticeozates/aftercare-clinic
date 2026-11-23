create table public.phase11_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid unique references public.organizations(id) on delete restrict,
  completed_at timestamptz,
  check (completed_at is null or organization_id is not null)
);

create table public.phase11_clinic_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  address text not null check (length(address) <= 240),
  phone text not null check (length(phone) <= 40),
  time_zone text not null check (length(time_zone) <= 80)
);

create table public.phase11_team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (length(email) <= 254 and email = lower(email) and email like '%@%.test'),
  role_key text not null check (role_key in ('organization_admin', 'staff')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (accepted_at is null or revoked_at is null)
);

create unique index phase11_one_pending_invite_per_recipient
  on public.phase11_team_invites(organization_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.phase11_onboarding enable row level security;
alter table public.phase11_clinic_settings enable row level security;
alter table public.phase11_team_invites enable row level security;
revoke all on public.phase11_onboarding, public.phase11_clinic_settings, public.phase11_team_invites
  from public, anon, authenticated;
grant select, insert, update on public.phase11_onboarding, public.phase11_clinic_settings, public.phase11_team_invites
  to service_role;

create function public.phase11_actor_role(actor uuid, clinic uuid)
returns text
language sql stable set search_path = ''
as $$
  select r.key
  from public.organization_memberships m
  join public.roles r on r.id = m.role_id
  join public.organizations o on o.id = m.organization_id
  where m.user_id = actor and m.organization_id = clinic and m.status = 'active' and o.status = 'active'
$$;

-- Preserve historical management of legacy tenants, with an administrator role ceiling.
-- Phase 11 tenants use the invitation and membership functions below for every write.
create function public.phase11_membership_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  clinic uuid := case when tg_op = 'INSERT' then new.organization_id else old.organization_id end;
  previous_role text;
  next_role text;
  actor_role text;
begin
  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id or old.user_id is distinct from new.user_id then
      raise exception 'Membership identity is immutable' using errcode = '42501';
    end if;
    select key into previous_role from public.roles where id = old.role_id;
  end if;
  select key into next_role from public.roles where id = new.role_id;
  -- Serialize owner removals, including concurrent writes to different membership rows.
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));

  if current_setting('role', true) = 'authenticated' then
    if exists (select 1 from public.phase11_onboarding where organization_id = clinic) then
      raise exception 'Use the controlled membership workflow' using errcode = '42501';
    end if;
    actor_role := public.phase11_actor_role(auth.uid(), clinic);
    if actor_role is distinct from 'organization_owner'
      and not coalesce(actor_role = 'organization_admin' and next_role = 'staff'
        and (tg_op = 'INSERT' or previous_role = 'staff'), false) then
      raise exception 'Role change denied' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' and previous_role = 'organization_owner'
    and (new.status <> 'active' or next_role <> 'organization_owner')
    and not exists (
      select 1 from public.organization_memberships m
      join public.roles r on r.id = m.role_id
      where m.organization_id = clinic and m.id <> old.id and m.status = 'active' and r.key = 'organization_owner'
    ) then
    raise exception 'Last active owner' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger phase11_membership_guard before insert or update on public.organization_memberships
  for each row execute function public.phase11_membership_guard();

create function public.phase11_create_clinic(actor uuid, clinic_name text, profile_name text,
  clinic_address text, clinic_phone text, clinic_zone text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  clinic uuid;
  member uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:user:' || actor::text, 0));
  if not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null
    and lower(email) like '%@%.test') then
    raise exception 'Confirmed demo account required' using errcode = '42501';
  end if;
  select organization_id into clinic from public.phase11_onboarding where user_id = actor for update;
  if not found then
    raise exception 'Not enrolled' using errcode = '42501';
  end if;
  if clinic is not null then
    if public.phase11_actor_role(actor, clinic) is distinct from 'organization_owner' then
      raise exception 'Owner access required' using errcode = '42501';
    end if;
    return clinic;
  end if;
  if exists (select 1 from public.organization_memberships where user_id = actor and status = 'active') then
    raise exception 'Active membership already exists' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = clinic_zone) then
    raise exception 'Invalid time zone' using errcode = '22023';
  end if;

  clinic := gen_random_uuid();
  insert into public.organizations (id, name, slug)
    values (clinic, trim(clinic_name), 'clinic-' || replace(clinic::text, '-', ''));
  insert into public.user_profiles (id, display_name) values (actor, trim(profile_name))
    on conflict (id) do update set display_name = excluded.display_name;
  insert into public.phase11_clinic_settings values (clinic, clinic_address, clinic_phone, clinic_zone);
  insert into public.organization_memberships (organization_id, user_id, role_id)
    select clinic, actor, id from public.roles where key = 'organization_owner' returning id into strict member;
  update public.phase11_onboarding set organization_id = clinic where user_id = actor;
  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result)
    values (clinic, 'user', actor, 'membership.created', 'membership', member, 'success');
  return clinic;
end
$$;

create function public.phase11_update_clinic(actor uuid, clinic uuid, clinic_name text, profile_name text,
  clinic_address text, clinic_phone text, clinic_zone text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  if not coalesce(public.phase11_actor_role(actor, clinic) in ('organization_owner', 'organization_admin'), false) then
    raise exception 'Settings access denied' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = clinic_zone) then
    raise exception 'Invalid time zone' using errcode = '22023';
  end if;
  update public.organizations set name = trim(clinic_name) where id = clinic;
  insert into public.user_profiles (id, display_name) values (actor, trim(profile_name))
    on conflict (id) do update set display_name = excluded.display_name;
  insert into public.phase11_clinic_settings values (clinic, clinic_address, clinic_phone, clinic_zone)
    on conflict (organization_id) do update set address = excluded.address, phone = excluded.phone,
      time_zone = excluded.time_zone;
  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result)
    values (clinic, 'user', actor, 'organization.updated', 'organization', clinic, 'success');
end
$$;

create function public.phase11_manage_invite(actor uuid, clinic uuid, operation text,
  invite uuid, recipient text, requested_role text, hashed_token text)
returns table (id uuid, email text, role_key text)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_role text;
  entry public.phase11_team_invites%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  actor_role := public.phase11_actor_role(actor, clinic);
  if not coalesce(actor_role in ('organization_owner', 'organization_admin'), false) then
    raise exception 'Invitation access denied' using errcode = '42501';
  end if;
  if operation = 'create' then
    if not coalesce(requested_role in ('staff', 'organization_admin') and
      (actor_role = 'organization_owner' or requested_role = 'staff'), false) then
      raise exception 'Invitation role denied' using errcode = '42501';
    end if;
    insert into public.phase11_team_invites as i (organization_id, email, role_key, token_hash, expires_at)
      values (clinic, recipient, requested_role, hashed_token, now() + interval '48 hours')
      returning i.* into entry;
  elsif operation in ('resend', 'revoke') then
    select i.* into entry from public.phase11_team_invites i
    where i.id = invite and i.organization_id = clinic and i.accepted_at is null and i.revoked_at is null for update;
    if not found or (actor_role = 'organization_admin' and entry.role_key <> 'staff') then
      raise exception 'Invitation access denied' using errcode = '42501';
    end if;
    if operation = 'resend' then
      update public.phase11_team_invites i set token_hash = hashed_token, expires_at = now() + interval '48 hours',
        delivered_at = null where i.id = entry.id;
    else
      update public.phase11_team_invites i set revoked_at = now() where i.id = entry.id;
    end if;
  else
    raise exception 'Invalid invitation operation' using errcode = '22023';
  end if;
  return query select entry.id, entry.email, entry.role_key;
end
$$;

create function public.phase11_accept_invite(actor uuid, hashed_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  clinic uuid;
  entry public.phase11_team_invites%rowtype;
  member uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:user:' || actor::text, 0));
  select organization_id into clinic from public.phase11_team_invites where token_hash = hashed_token;
  if clinic is null then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  select * into entry from public.phase11_team_invites
    where token_hash = hashed_token and expires_at > now() and accepted_at is null and revoked_at is null
    for update;
  if not found or not exists (select 1 from auth.users
    where id = actor and email_confirmed_at is not null and lower(email) = entry.email)
    or not exists (select 1 from public.organizations where id = clinic and status = 'active')
    or exists (select 1 from public.organization_memberships where user_id = actor and status = 'active') then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  insert into public.user_profiles (id, display_name) values (actor, 'Ekip üyesi')
    on conflict (id) do nothing;
  insert into public.organization_memberships as m (organization_id, user_id, role_id)
    select clinic, actor, id from public.roles where key = entry.role_key
    on conflict (organization_id, user_id) do update set role_id = excluded.role_id, status = 'active'
    where m.status = 'inactive' returning id into strict member;
  update public.phase11_team_invites set accepted_at = now() where id = entry.id;
  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result)
    values (clinic, 'user', actor, 'membership.created', 'membership', member, 'success');
  return clinic;
end
$$;

create function public.phase11_change_membership(actor uuid, clinic uuid, member uuid, requested_role text,
  deactivate boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_role text;
  old_role text;
  new_role uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  actor_role := public.phase11_actor_role(actor, clinic);
  select r.key into old_role
    from public.organization_memberships m join public.roles r on r.id = m.role_id
    where m.id = member and m.organization_id = clinic and m.status = 'active';
  if not found or not coalesce(actor_role = 'organization_owner' or
    (actor_role = 'organization_admin' and old_role = 'staff' and (deactivate or requested_role = 'staff')), false) then
    raise exception 'Membership change denied' using errcode = '42501';
  end if;
  if deactivate then
    update public.organization_memberships set status = 'inactive' where id = member and organization_id = clinic;
  else
    select id into strict new_role from public.roles where key = requested_role;
    update public.organization_memberships set role_id = new_role where id = member and organization_id = clinic;
  end if;
  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result)
    values (clinic, 'user', actor, case when deactivate then 'membership.deactivated' else 'membership.role_updated' end,
      'membership', member, 'success');
end
$$;

revoke all on function public.phase11_actor_role(uuid,uuid), public.phase11_membership_guard(),
  public.phase11_create_clinic(uuid,text,text,text,text,text),
  public.phase11_update_clinic(uuid,uuid,text,text,text,text,text),
  public.phase11_manage_invite(uuid,uuid,text,uuid,text,text,text),
  public.phase11_accept_invite(uuid,text),
  public.phase11_change_membership(uuid,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.phase11_create_clinic(uuid,text,text,text,text,text),
  public.phase11_update_clinic(uuid,uuid,text,text,text,text,text),
  public.phase11_manage_invite(uuid,uuid,text,uuid,text,text,text),
  public.phase11_accept_invite(uuid,text),
  public.phase11_change_membership(uuid,uuid,uuid,text,boolean) to service_role;
