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
    'procedure.manage',
    'template.read',
    'template.create',
    'template.update',
    'template.publish',
    'template.deactivate',
    'plan.read',
    'plan.create',
    'plan.update',
    'plan.stop',
    'secure_link.create',
    'secure_link.revoke',
    'secure_link.rotate'
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
    'procedure.manage_denied',
    'template.created',
    'template.updated',
    'template.deactivated',
    'template.viewed',
    'template_draft.created',
    'template_day.created',
    'template_day.updated',
    'template_day.deleted',
    'template_task.created',
    'template_task.updated',
    'template_task.deleted',
    'symptom_option.created',
    'symptom_option.updated',
    'alert_rule.created',
    'alert_rule.updated',
    'template.published',
    'template.publish_denied',
    'template.immutable_change_denied',
    'plan.created',
    'plan.viewed',
    'plan.updated',
    'plan.stopped',
    'plan.status_change_denied',
    'plan.create_denied',
    'secure_link.created',
    'secure_link.rotated',
    'secure_link.revoked',
    'secure_link.validation_succeeded',
    'secure_link.validation_failed',
    'secure_link.create_denied'
  )
);

alter table public.audit_logs drop constraint audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (
  entity_type in (
    'auth',
    'organization',
    'membership',
    'audit_log',
    'client',
    'procedure',
    'template',
    'template_version',
    'template_day',
    'template_task',
    'symptom_option',
    'alert_rule',
    'plan',
    'plan_day',
    'plan_task',
    'secure_link',
    'portal_session'
  )
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
        'changed_fields',
        'version_number',
        'task_type',
        'rule_type',
        'severity_level',
        'day_count',
        'task_count',
        'expiry_category',
        'result_reason',
        'rotated'
      )
    ),
    '{}'::jsonb
  );
$$;

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

create unique index if not exists clients_organization_id_id_unique
on public.clients(organization_id, id);

create unique index if not exists care_template_tasks_organization_id_id_unique
on public.care_template_tasks(organization_id, id);

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  procedure_id uuid not null,
  care_template_id uuid not null,
  template_version_id uuid not null,
  responsible_membership_id uuid,
  status text not null check (status in ('scheduled', 'active', 'completed', 'stopped')),
  start_date date not null,
  end_date date not null,
  control_date timestamptz,
  stopped_at timestamptz,
  stopped_by_user_id uuid,
  created_by_user_id uuid not null,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_plans_client_same_org_fk
    foreign key (organization_id, client_id)
    references public.clients(organization_id, id),
  constraint care_plans_procedure_same_org_fk
    foreign key (organization_id, procedure_id)
    references public.procedures(organization_id, id),
  constraint care_plans_template_same_org_fk
    foreign key (organization_id, care_template_id)
    references public.care_templates(organization_id, id),
  constraint care_plans_version_same_template_fk
    foreign key (organization_id, care_template_id, template_version_id)
    references public.care_template_versions(organization_id, care_template_id, id),
  constraint care_plans_responsible_same_org_fk
    foreign key (organization_id, responsible_membership_id)
    references public.organization_memberships(organization_id, id),
  constraint care_plans_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_plans_updated_by_same_org_fk
    foreign key (organization_id, updated_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_plans_stopped_by_same_org_fk
    foreign key (organization_id, stopped_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_plans_dates_valid check (end_date >= start_date),
  constraint care_plans_stopped_fields_valid check (
    (status = 'stopped' and stopped_at is not null and stopped_by_user_id is not null)
    or
    (status <> 'stopped' and stopped_at is null and stopped_by_user_id is null)
  )
);

create unique index care_plans_organization_id_id_unique
on public.care_plans(organization_id, id);

create index care_plans_org_status_idx
on public.care_plans(organization_id, status, start_date desc);

create table public.care_plan_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  source_template_day_id uuid not null,
  day_number integer not null check (day_number >= 1),
  scheduled_date date not null,
  title text,
  status text not null default 'pending' check (status in ('pending', 'available', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_plan_days_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id)
    on delete restrict,
  constraint care_plan_days_source_same_org_fk
    foreign key (organization_id, source_template_day_id)
    references public.care_template_days(organization_id, id),
  constraint care_plan_days_unique_day unique (care_plan_id, day_number)
);

create unique index care_plan_days_organization_id_id_unique
on public.care_plan_days(organization_id, id);

create unique index care_plan_days_org_plan_id_id_unique
on public.care_plan_days(organization_id, care_plan_id, id);

create table public.care_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_day_id uuid not null,
  source_template_task_id uuid not null,
  title text not null,
  description text,
  task_type text not null check (task_type in ('do', 'avoid', 'check', 'information')),
  required boolean not null default true,
  display_order integer not null check (display_order >= 1),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_plan_tasks_day_same_org_fk
    foreign key (organization_id, care_plan_day_id)
    references public.care_plan_days(organization_id, id)
    on delete restrict,
  constraint care_plan_tasks_source_same_org_fk
    foreign key (organization_id, source_template_task_id)
    references public.care_template_tasks(organization_id, id)
);

create table public.secure_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  token_hash text not null unique,
  token_prefix text,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  rotated_from_link_id uuid references public.secure_links(id),
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  constraint secure_links_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint secure_links_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint secure_links_revoked_by_same_org_fk
    foreign key (organization_id, revoked_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint secure_links_expiry_future check (expires_at > created_at),
  constraint secure_links_revoke_fields check (
    (status = 'revoked' and revoked_at is not null and revoked_by_user_id is not null)
    or
    (status <> 'revoked')
  )
);

create unique index secure_links_one_active_per_plan
on public.secure_links(care_plan_id)
where status = 'active';

create index secure_links_plan_status_idx
on public.secure_links(organization_id, care_plan_id, status, created_at desc);

create unique index secure_links_organization_id_id_unique
on public.secure_links(organization_id, id);

create table public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  secure_link_id uuid not null,
  care_plan_id uuid not null,
  session_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint portal_sessions_link_same_org_fk
    foreign key (organization_id, secure_link_id)
    references public.secure_links(organization_id, id),
  constraint portal_sessions_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id)
);

alter table public.care_plans enable row level security;
alter table public.care_plan_days enable row level security;
alter table public.care_plan_tasks enable row level security;
alter table public.secure_links enable row level security;
alter table public.portal_sessions enable row level security;

create or replace function public.prevent_plan_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.creating_care_plan_snapshot', true) = 'on' then
    return coalesce(new, old);
  end if;

  raise exception 'plan snapshot is immutable' using errcode = '42501';
end;
$$;

create trigger care_plan_days_snapshot_immutable
before insert or update or delete on public.care_plan_days
for each row execute function public.prevent_plan_snapshot_mutation();

create trigger care_plan_tasks_snapshot_immutable
before insert or update or delete on public.care_plan_tasks
for each row execute function public.prevent_plan_snapshot_mutation();

create or replace function public.enforce_care_plan_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'care plan hard delete is not allowed' using errcode = '42501';
  end if;

  if current_setting('app.creating_care_plan_snapshot', true) = 'on' then
    return new;
  end if;

  if new.organization_id <> old.organization_id
    or new.client_id <> old.client_id
    or new.procedure_id <> old.procedure_id
    or new.care_template_id <> old.care_template_id
    or new.template_version_id <> old.template_version_id
    or new.created_by_user_id <> old.created_by_user_id then
    raise exception 'care plan source fields are immutable' using errcode = '42501';
  end if;

  if old.status in ('completed', 'stopped') and new.status <> old.status then
    raise exception 'terminal care plan status cannot change' using errcode = '42501';
  end if;

  if not (
    new.status = old.status
    or (old.status = 'scheduled' and new.status in ('active', 'stopped'))
    or (old.status = 'active' and new.status in ('completed', 'stopped'))
  ) then
    raise exception 'invalid care plan status transition' using errcode = '42501';
  end if;

  if new.status = 'stopped' and old.status <> 'stopped' then
    new.stopped_at := coalesce(new.stopped_at, now());
    new.stopped_by_user_id := coalesce(new.stopped_by_user_id, auth.uid());
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (new.organization_id, 'user', auth.uid(), 'plan.stopped', 'plan', new.id, 'success', public.sanitize_audit_metadata(jsonb_build_object('previous_status', old.status, 'new_status', new.status, 'source', 'db_trigger')));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger care_plans_enforce_update_rules
before update or delete on public.care_plans
for each row execute function public.enforce_care_plan_update_rules();

create or replace function public.create_care_plan_from_template(
  target_client_id uuid,
  target_procedure_id uuid,
  target_template_id uuid,
  target_template_version_id uuid,
  target_start_date date,
  target_control_date timestamptz,
  target_responsible_membership_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  plan_id uuid;
  max_day integer;
  day_count integer;
  task_count integer;
  plan_status text;
  day_row record;
  new_day_id uuid;
begin
  select om.organization_id into org_id
  from public.organization_memberships om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;

  if org_id is null or not public.current_user_has_permission(org_id, 'plan.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.clients where id = target_client_id and organization_id = org_id and status = 'active') then
    raise exception 'client must be active in organization';
  end if;

  if not exists (select 1 from public.procedures where id = target_procedure_id and organization_id = org_id and status = 'active') then
    raise exception 'procedure must be active in organization';
  end if;

  if not exists (select 1 from public.care_templates where id = target_template_id and organization_id = org_id and procedure_id = target_procedure_id and status = 'active') then
    raise exception 'template must be active in organization';
  end if;

  if exists (select 1 from public.care_template_versions where id = target_template_version_id and organization_id = org_id and care_template_id = target_template_id and status = 'retired') then
    raise exception 'template version must be current published version';
  end if;

  if not exists (select 1 from public.care_template_versions where id = target_template_version_id and organization_id = org_id and care_template_id = target_template_id and status = 'published') then
    raise exception 'template version must be published';
  end if;

  if not exists (select 1 from public.care_templates where id = target_template_id and current_published_version_id = target_template_version_id) then
    raise exception 'template version must be current published version';
  end if;

  if target_responsible_membership_id is not null and not exists (
    select 1 from public.organization_memberships
    where id = target_responsible_membership_id and organization_id = org_id and status = 'active'
  ) then
    raise exception 'responsible membership must be active in organization';
  end if;

  select count(*)::int, max(day_number)::int into day_count, max_day
  from public.care_template_days
  where organization_id = org_id and template_version_id = target_template_version_id;

  if day_count < 1 then
    raise exception 'template version must contain at least one day';
  end if;

  select count(*)::int into task_count
  from public.care_template_tasks t
  join public.care_template_days d on d.id = t.template_day_id
  where d.template_version_id = target_template_version_id and t.organization_id = org_id;

  if task_count < 1 then
    raise exception 'template version must contain at least one task';
  end if;

  plan_status := case when target_start_date > current_date then 'scheduled' else 'active' end;
  perform set_config('app.creating_care_plan_snapshot', 'on', true);

  insert into public.care_plans (
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
    created_by_user_id
  )
  values (
    org_id,
    target_client_id,
    target_procedure_id,
    target_template_id,
    target_template_version_id,
    target_responsible_membership_id,
    plan_status,
    target_start_date,
    target_start_date + (max_day - 1),
    target_control_date,
    auth.uid()
  )
  returning id into plan_id;

  for day_row in
    select id, day_number, title
    from public.care_template_days
    where organization_id = org_id and template_version_id = target_template_version_id
    order by day_number
  loop
    insert into public.care_plan_days (
      organization_id,
      care_plan_id,
      source_template_day_id,
      day_number,
      scheduled_date,
      title
    )
    values (
      org_id,
      plan_id,
      day_row.id,
      day_row.day_number,
      target_start_date + (day_row.day_number - 1),
      day_row.title
    )
    returning id into new_day_id;

    insert into public.care_plan_tasks (
      organization_id,
      care_plan_day_id,
      source_template_task_id,
      title,
      description,
      task_type,
      required,
      display_order
    )
    select org_id, new_day_id, t.id, t.title, t.description, t.task_type, t.required, t.display_order
    from public.care_template_tasks t
    where t.organization_id = org_id and t.template_day_id = day_row.id
    order by t.display_order;
  end loop;

  perform set_config('app.creating_care_plan_snapshot', 'off', true);

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    org_id,
    'user',
    auth.uid(),
    'plan.created',
    'plan',
    plan_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('day_count', day_count, 'task_count', task_count, 'version_number', (select version_number from public.care_template_versions where id = target_template_version_id), 'source', 'db_function'))
  );

  return plan_id;
end;
$$;

create or replace function public.create_secure_link_for_plan(
  target_plan_id uuid,
  target_token_hash text,
  target_token_prefix text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  link_id uuid;
  old_link_id uuid;
begin
  select om.organization_id into org_id
  from public.organization_memberships om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;

  if org_id is null or not public.current_user_has_permission(org_id, 'secure_link.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.care_plans where id = target_plan_id and organization_id = org_id) then
    raise exception 'plan not found for organization';
  end if;

  if exists (select 1 from public.care_plans where id = target_plan_id and status in ('stopped', 'completed')) then
    raise exception 'stopped plan cannot receive secure link';
  end if;

  if target_expires_at <= now() then
    raise exception 'secure link expiry must be in the future';
  end if;

  select id into old_link_id
  from public.secure_links
  where care_plan_id = target_plan_id and status = 'active'
  order by created_at desc
  limit 1;

  if old_link_id is not null then
    update public.secure_links
    set status = 'revoked', revoked_at = now(), revoked_by_user_id = auth.uid()
    where id = old_link_id;
  end if;

  insert into public.secure_links (
    organization_id,
    care_plan_id,
    token_hash,
    token_prefix,
    expires_at,
    rotated_from_link_id,
    created_by_user_id
  )
  values (org_id, target_plan_id, target_token_hash, target_token_prefix, target_expires_at, old_link_id, auth.uid())
  returning id into link_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    org_id,
    'user',
    auth.uid(),
    case when old_link_id is null then 'secure_link.created' else 'secure_link.rotated' end,
    'secure_link',
    link_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function', 'rotated', old_link_id is not null, 'expiry_category', 'plan_window'))
  );

  return link_id;
end;
$$;

create or replace function public.revoke_secure_link(target_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_row public.secure_links%rowtype;
begin
  select * into link_row from public.secure_links where id = target_link_id;
  if not found then
    raise exception 'secure link not found';
  end if;

  if not public.current_user_has_permission(link_row.organization_id, 'secure_link.revoke') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.secure_links
  set status = 'revoked', revoked_at = now(), revoked_by_user_id = auth.uid()
  where id = target_link_id and status = 'active';

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (link_row.organization_id, 'user', auth.uid(), 'secure_link.revoked', 'secure_link', target_link_id, 'success', public.sanitize_audit_metadata('{"source":"db_function"}'::jsonb));
end;
$$;

create or replace function public.validate_secure_link_hash(target_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_row public.secure_links%rowtype;
  plan_status text;
begin
  select * into link_row
  from public.secure_links
  where token_hash = target_token_hash
  limit 1;

  if not found or link_row.status <> 'active' or link_row.expires_at <= now() then
    return null;
  end if;

  select status into plan_status from public.care_plans where id = link_row.care_plan_id;
  if plan_status in ('stopped', 'completed') then
    return null;
  end if;

  update public.secure_links
  set usage_count = usage_count + 1,
      last_used_at = now()
  where id = link_row.id;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (link_row.organization_id, 'system', 'secure_link.validation_succeeded', 'secure_link', link_row.id, 'success', public.sanitize_audit_metadata('{"source":"token_validation"}'::jsonb));

  return link_row.id;
end;
$$;

create or replace function public.create_portal_session_for_link(
  target_token_hash text,
  target_session_hash text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_id uuid;
  link_row public.secure_links%rowtype;
  session_id uuid;
begin
  link_id := public.validate_secure_link_hash(target_token_hash);
  if link_id is null then
    return null;
  end if;

  select * into link_row from public.secure_links where id = link_id;

  insert into public.portal_sessions (
    organization_id,
    secure_link_id,
    care_plan_id,
    session_hash,
    expires_at
  )
  values (link_row.organization_id, link_row.id, link_row.care_plan_id, target_session_hash, target_expires_at)
  returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.validate_portal_session_hash(target_session_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.portal_sessions%rowtype;
begin
  select * into session_row
  from public.portal_sessions
  where session_hash = target_session_hash and status = 'active' and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  update public.portal_sessions set last_used_at = now() where id = session_row.id;
  return session_row.id;
end;
$$;

revoke all on function public.create_care_plan_from_template(uuid, uuid, uuid, uuid, date, timestamptz, uuid) from public;
revoke all on function public.create_secure_link_for_plan(uuid, text, text, timestamptz) from public;
revoke all on function public.revoke_secure_link(uuid) from public;
revoke all on function public.validate_secure_link_hash(text) from public;
revoke all on function public.create_portal_session_for_link(text, text, timestamptz) from public;
revoke all on function public.validate_portal_session_hash(text) from public;

grant execute on function public.create_care_plan_from_template(uuid, uuid, uuid, uuid, date, timestamptz, uuid) to authenticated;
grant execute on function public.create_secure_link_for_plan(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_secure_link(uuid) to authenticated;
grant execute on function public.validate_secure_link_hash(text) to anon, authenticated;
grant execute on function public.create_portal_session_for_link(text, text, timestamptz) to anon, authenticated;
grant execute on function public.validate_portal_session_hash(text) to anon, authenticated;

create policy "members can read care plans"
on public.care_plans
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

create policy "members can update operational care plan fields"
on public.care_plans
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.update'))
with check (public.current_user_has_permission(organization_id, 'plan.update'));

create policy "members can read care plan days"
on public.care_plan_days
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

create policy "members can read care plan tasks"
on public.care_plan_tasks
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

create policy "members can read secure link metadata"
on public.secure_links
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

grant select, update on public.care_plans to authenticated;
grant select on public.care_plan_days to authenticated;
grant select on public.care_plan_tasks to authenticated;
grant select on public.secure_links to authenticated;

revoke all on public.care_plans from anon;
revoke all on public.care_plan_days from anon;
revoke all on public.care_plan_tasks from anon;
revoke all on public.secure_links from anon;
revoke all on public.portal_sessions from anon;

revoke insert, delete on public.care_plans from authenticated;
revoke insert, update, delete on public.care_plan_days from authenticated;
revoke insert, update, delete on public.care_plan_tasks from authenticated;
revoke insert, update, delete on public.secure_links from authenticated;
revoke all on public.portal_sessions from authenticated;
