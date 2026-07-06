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
    'template.deactivate'
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
    'template.immutable_change_denied'
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
    'alert_rule'
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
        'severity_level'
      )
    ),
    '{}'::jsonb
  );
$$;

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

create unique index if not exists procedures_organization_id_id_unique
on public.procedures(organization_id, id);

create table public.care_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  procedure_id uuid not null,
  name text not null check (name = btrim(name) and length(name) between 2 and 120),
  normalized_name text not null check (normalized_name = btrim(lower(normalized_name)) and length(normalized_name) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'inactive')),
  current_published_version_id uuid,
  created_by_user_id uuid not null,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint care_templates_procedure_same_org_fk
    foreign key (organization_id, procedure_id)
    references public.procedures(organization_id, id),
  constraint care_templates_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_templates_updated_by_same_org_fk
    foreign key (organization_id, updated_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_templates_inactive_fields_consistent check (
    (status = 'active' and archived_at is null)
    or
    (status = 'inactive' and archived_at is not null)
  )
);

create unique index care_templates_organization_id_id_unique
on public.care_templates(organization_id, id);

create unique index care_templates_name_per_procedure_unique
on public.care_templates(organization_id, procedure_id, normalized_name);

create index care_templates_organization_status_idx
on public.care_templates(organization_id, status, created_at desc);

create table public.care_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_template_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  title text check (title is null or length(btrim(title)) between 2 and 120),
  internal_note text check (internal_note is null or length(btrim(internal_note)) <= 500),
  created_by_user_id uuid not null,
  published_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint care_template_versions_template_same_org_fk
    foreign key (organization_id, care_template_id)
    references public.care_templates(organization_id, id),
  constraint care_template_versions_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_template_versions_published_by_same_org_fk
    foreign key (organization_id, published_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint care_template_versions_publish_fields_consistent check (
    (status = 'draft' and published_at is null and published_by_user_id is null)
    or
    (status in ('published', 'retired') and published_at is not null and published_by_user_id is not null)
  )
);

create unique index care_template_versions_organization_id_id_unique
on public.care_template_versions(organization_id, id);

create unique index care_template_versions_org_template_id_id_unique
on public.care_template_versions(organization_id, care_template_id, id);

create unique index care_template_versions_number_unique
on public.care_template_versions(care_template_id, version_number);

create unique index care_template_versions_one_draft_unique
on public.care_template_versions(care_template_id)
where status = 'draft';

alter table public.care_templates
add constraint care_templates_current_published_version_same_org_fk
foreign key (organization_id, id, current_published_version_id)
references public.care_template_versions(organization_id, care_template_id, id);

create table public.care_template_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_version_id uuid not null,
  day_number integer not null check (day_number >= 1),
  title text check (title is null or length(btrim(title)) between 2 and 120),
  display_order integer not null check (display_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_template_days_version_same_org_fk
    foreign key (organization_id, template_version_id)
    references public.care_template_versions(organization_id, id)
    on delete cascade
);

create unique index care_template_days_organization_id_id_unique
on public.care_template_days(organization_id, id);

create unique index care_template_days_org_version_id_id_unique
on public.care_template_days(organization_id, template_version_id, id);

create unique index care_template_days_number_unique
on public.care_template_days(template_version_id, day_number);

create table public.care_template_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_day_id uuid not null,
  title text not null check (title = btrim(title) and length(title) between 2 and 160 and title !~* '<script'),
  description text check (description is null or (length(btrim(description)) <= 500 and description !~* '<script')),
  task_type text not null check (task_type in ('do', 'avoid', 'check', 'information')),
  required boolean not null default true,
  display_order integer not null check (display_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_template_tasks_day_same_org_fk
    foreign key (organization_id, template_day_id)
    references public.care_template_days(organization_id, id)
    on delete cascade
);

create index care_template_tasks_day_order_idx
on public.care_template_tasks(template_day_id, display_order);

create table public.symptom_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_version_id uuid not null,
  label text not null check (label = btrim(label) and length(label) between 2 and 120 and label !~* '<script'),
  normalized_label text not null check (normalized_label = btrim(lower(normalized_label)) and length(normalized_label) between 2 and 120),
  allows_severity boolean not null default false,
  allows_note boolean not null default true,
  display_order integer not null check (display_order >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptom_options_version_same_org_fk
    foreign key (organization_id, template_version_id)
    references public.care_template_versions(organization_id, id)
    on delete cascade
);

create unique index symptom_options_organization_version_id_unique
on public.symptom_options(organization_id, template_version_id, id);

create unique index symptom_options_label_unique
on public.symptom_options(template_version_id, normalized_label);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_version_id uuid not null,
  symptom_option_id uuid,
  rule_type text not null check (rule_type in ('symptom_selected', 'severity_threshold', 'task_incomplete', 'photo_missing')),
  severity_level text not null check (severity_level in ('low', 'medium', 'high')),
  configuration jsonb not null default '{}'::jsonb,
  message_label text not null check (message_label = btrim(message_label) and length(message_label) between 2 and 160 and message_label !~* '<script'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_rules_configuration_object check (jsonb_typeof(configuration) = 'object'),
  constraint alert_rules_configuration_size check (pg_column_size(configuration) <= 2048),
  constraint alert_rules_version_same_org_fk
    foreign key (organization_id, template_version_id)
    references public.care_template_versions(organization_id, id)
    on delete cascade,
  constraint alert_rules_symptom_same_version_fk
    foreign key (organization_id, template_version_id, symptom_option_id)
    references public.symptom_options(organization_id, template_version_id, id)
);

create or replace function public.alert_rule_configuration_is_allowed(input_configuration jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from jsonb_object_keys(coalesce(input_configuration, '{}'::jsonb)) as config_key
    where config_key not in ('threshold', 'days', 'required')
  );
$$;

alter table public.alert_rules
add constraint alert_rules_configuration_allowlist
check (public.alert_rule_configuration_is_allowed(configuration));

alter table public.care_templates enable row level security;
alter table public.care_template_versions enable row level security;
alter table public.care_template_days enable row level security;
alter table public.care_template_tasks enable row level security;
alter table public.symptom_options enable row level security;
alter table public.alert_rules enable row level security;

create or replace function public.care_template_version_status(target_version_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from public.care_template_versions where id = target_version_id;
$$;

create or replace function public.care_template_day_version_status(target_day_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select v.status
  from public.care_template_days d
  join public.care_template_versions v on v.id = d.template_version_id
  where d.id = target_day_id;
$$;

revoke all on function public.care_template_version_status(uuid) from public;
revoke all on function public.care_template_day_version_status(uuid) from public;
grant execute on function public.care_template_version_status(uuid) to authenticated;
grant execute on function public.care_template_day_version_status(uuid) to authenticated;

create or replace function public.ensure_template_manage_permission(target_organization_id uuid, permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_has_permission(target_organization_id, permission_key) then
    raise exception 'template permission denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.ensure_template_manage_permission(uuid, text) from public;
grant execute on function public.ensure_template_manage_permission(uuid, text) to authenticated;

create or replace function public.enforce_care_template_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.ensure_template_manage_permission(new.organization_id, 'template.create');
    if new.created_by_user_id <> auth.uid() then
      raise exception 'created_by_user_id must match authenticated user' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'template organization cannot be changed' using errcode = '42501';
    end if;
    if new.created_by_user_id <> old.created_by_user_id then
      raise exception 'template creator cannot be changed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and new.status = 'inactive' then
      perform public.ensure_template_manage_permission(new.organization_id, 'template.deactivate');
      if new.archived_at is null then
        new.archived_at = now();
      end if;
    else
      perform public.ensure_template_manage_permission(new.organization_id, 'template.update');
    end if;
  end if;

  if not public.current_user_is_active_member(new.organization_id, new.created_by_user_id) then
    raise exception 'template creator must be an active organization member' using errcode = '23503';
  end if;
  if new.updated_by_user_id is not null and not public.current_user_is_active_member(new.organization_id, new.updated_by_user_id) then
    raise exception 'template updater must be an active organization member' using errcode = '23503';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger care_templates_enforce_rules
before insert or update on public.care_templates
for each row execute function public.enforce_care_template_rules();

create or replace function public.enforce_template_version_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  publish_context text;
  retire_context text;
begin
  if tg_op = 'INSERT' then
    perform public.ensure_template_manage_permission(new.organization_id, 'template.update');
    if new.created_by_user_id <> auth.uid() then
      raise exception 'created_by_user_id must match authenticated user' using errcode = '42501';
    end if;
    if new.status <> 'draft' then
      raise exception 'new template versions must start as draft' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.care_template_id <> old.care_template_id or new.version_number <> old.version_number then
      raise exception 'version tenant and number fields cannot be changed' using errcode = '42501';
    end if;

    publish_context := current_setting('app.publishing_template_version', true);
    retire_context := current_setting('app.retiring_template_version', true);
    if old.status = 'draft' and new.status = 'published' then
      if publish_context is distinct from old.id::text then
        raise exception 'publish must use controlled transaction' using errcode = '42501';
      end if;
    elsif old.status = 'published' and new.status = 'retired' then
      if retire_context is distinct from old.id::text then
        raise exception 'retire must use controlled transaction' using errcode = '42501';
      end if;
    elsif old.status <> 'draft' then
      insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
      values (old.organization_id, 'user', auth.uid(), 'template.immutable_change_denied', 'template_version', old.id, 'denied', '{"source":"db_trigger"}'::jsonb);
      raise exception 'published template version is immutable' using errcode = '42501';
    elsif new.status is distinct from old.status then
      raise exception 'unsupported template version status transition' using errcode = '42501';
    end if;

    perform public.ensure_template_manage_permission(new.organization_id, 'template.update');
  elsif tg_op = 'DELETE' then
    raise exception 'template versions cannot be deleted' using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger care_template_versions_enforce_rules
before insert or update or delete on public.care_template_versions
for each row execute function public.enforce_template_version_rules();

create or replace function public.version_is_draft_for_mutation(target_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_template_versions
    where id = target_version_id and status = 'draft'
  );
$$;

create or replace function public.day_is_draft_for_mutation(target_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_template_days d
    join public.care_template_versions v on v.id = d.template_version_id
    where d.id = target_day_id and v.status = 'draft'
  );
$$;

create or replace function public.enforce_template_day_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_version_id uuid;
  target_org_id uuid;
begin
  target_version_id := coalesce(new.template_version_id, old.template_version_id);
  target_org_id := coalesce(new.organization_id, old.organization_id);
  perform public.ensure_template_manage_permission(target_org_id, 'template.update');
  if not public.version_is_draft_for_mutation(target_version_id) then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (target_org_id, 'user', auth.uid(), 'template.immutable_change_denied', 'template_day', coalesce(new.id, old.id), 'denied', '{"source":"db_trigger"}'::jsonb);
    raise exception 'published template version is immutable' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.template_version_id <> old.template_version_id) then
    raise exception 'template day tenant fields cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger care_template_days_enforce_rules
before insert or update or delete on public.care_template_days
for each row execute function public.enforce_template_day_rules();

create or replace function public.enforce_template_task_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_day_id uuid;
  target_org_id uuid;
begin
  target_day_id := coalesce(new.template_day_id, old.template_day_id);
  target_org_id := coalesce(new.organization_id, old.organization_id);
  perform public.ensure_template_manage_permission(target_org_id, 'template.update');
  if not public.day_is_draft_for_mutation(target_day_id) then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (target_org_id, 'user', auth.uid(), 'template.immutable_change_denied', 'template_task', coalesce(new.id, old.id), 'denied', '{"source":"db_trigger"}'::jsonb);
    raise exception 'published template version is immutable' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.template_day_id <> old.template_day_id) then
    raise exception 'template task tenant fields cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger care_template_tasks_enforce_rules
before insert or update or delete on public.care_template_tasks
for each row execute function public.enforce_template_task_rules();

create or replace function public.enforce_template_version_child_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_version_id uuid;
  target_org_id uuid;
  target_entity_type text;
begin
  target_version_id := coalesce(new.template_version_id, old.template_version_id);
  target_org_id := coalesce(new.organization_id, old.organization_id);
  target_entity_type := case
    when tg_table_name = 'symptom_options' then 'symptom_option'
    else 'alert_rule'
  end;
  perform public.ensure_template_manage_permission(target_org_id, 'template.update');
  if not public.version_is_draft_for_mutation(target_version_id) then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (target_org_id, 'user', auth.uid(), 'template.immutable_change_denied', target_entity_type, coalesce(new.id, old.id), 'denied', '{"source":"db_trigger"}'::jsonb);
    raise exception 'published template version is immutable' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.template_version_id <> old.template_version_id) then
    raise exception 'template child tenant fields cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger symptom_options_enforce_rules
before insert or update or delete on public.symptom_options
for each row execute function public.enforce_template_version_child_rules();

create trigger alert_rules_enforce_rules
before insert or update or delete on public.alert_rules
for each row execute function public.enforce_template_version_child_rules();

create or replace function public.audit_template_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  action_name text;
  entity_name text;
begin
  if tg_table_name = 'care_templates' then
    entity_name := 'template';
    if tg_op = 'INSERT' then
      action_name := 'template.created';
    elsif old.status <> 'inactive' and new.status = 'inactive' then
      action_name := 'template.deactivated';
    else
      action_name := 'template.updated';
    end if;
  elsif tg_table_name = 'care_template_versions' then
    entity_name := 'template_version';
    action_name := 'template_draft.created';
    if tg_op = 'UPDATE' and new.status = 'published' then
      return new;
    end if;
  elsif tg_table_name = 'care_template_days' then
    entity_name := 'template_day';
    action_name := case tg_op when 'INSERT' then 'template_day.created' when 'UPDATE' then 'template_day.updated' else 'template_day.deleted' end;
  elsif tg_table_name = 'care_template_tasks' then
    entity_name := 'template_task';
    action_name := case tg_op when 'INSERT' then 'template_task.created' when 'UPDATE' then 'template_task.updated' else 'template_task.deleted' end;
  elsif tg_table_name = 'symptom_options' then
    entity_name := 'symptom_option';
    action_name := case tg_op when 'INSERT' then 'symptom_option.created' else 'symptom_option.updated' end;
  else
    entity_name := 'alert_rule';
    action_name := case tg_op when 'INSERT' then 'alert_rule.created' else 'alert_rule.updated' end;
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    'user',
    auth.uid(),
    action_name,
    entity_name,
    coalesce(new.id, old.id),
    'success',
    '{"source":"db_trigger"}'::jsonb
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger care_templates_audit_change
after insert or update on public.care_templates
for each row execute function public.audit_template_change();

create trigger care_template_versions_audit_change
after insert or update on public.care_template_versions
for each row execute function public.audit_template_change();

create trigger care_template_days_audit_change
after insert or update or delete on public.care_template_days
for each row execute function public.audit_template_change();

create trigger care_template_tasks_audit_change
after insert or update or delete on public.care_template_tasks
for each row execute function public.audit_template_change();

create trigger symptom_options_audit_change
after insert or update on public.symptom_options
for each row execute function public.audit_template_change();

create trigger alert_rules_audit_change
after insert or update on public.alert_rules
for each row execute function public.audit_template_change();

create or replace function public.publish_care_template_version(target_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  version_row public.care_template_versions%rowtype;
  template_row public.care_templates%rowtype;
  procedure_status text;
  day_count integer;
  task_count integer;
begin
  select * into version_row
  from public.care_template_versions
  where id = target_version_id
  for update;

  if not found then
    raise exception 'template version not found' using errcode = '02000';
  end if;

  if not public.current_user_has_permission(version_row.organization_id, 'template.publish') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (version_row.organization_id, 'user', auth.uid(), 'template.publish_denied', 'template_version', version_row.id, 'denied', '{"reason":"permission_denied","permission_key":"template.publish"}'::jsonb);
    raise exception 'template publish permission denied' using errcode = '42501';
  end if;

  if version_row.status <> 'draft' then
    raise exception 'only draft versions can be published' using errcode = '23514';
  end if;

  select * into template_row
  from public.care_templates
  where id = version_row.care_template_id and organization_id = version_row.organization_id
  for update;

  select status into procedure_status
  from public.procedures
  where id = template_row.procedure_id and organization_id = template_row.organization_id;

  if template_row.status <> 'active' or procedure_status <> 'active' then
    raise exception 'template and procedure must be active' using errcode = '23514';
  end if;

  select count(*)::int into day_count
  from public.care_template_days
  where template_version_id = version_row.id and organization_id = version_row.organization_id;

  if day_count < 1 then
    raise exception 'publish requires at least one day' using errcode = '23514';
  end if;

  select count(*)::int into task_count
  from public.care_template_tasks t
  join public.care_template_days d on d.id = t.template_day_id
  where d.template_version_id = version_row.id and t.organization_id = version_row.organization_id;

  if task_count < 1 then
    raise exception 'publish requires at least one task' using errcode = '23514';
  end if;

  perform set_config('app.publishing_template_version', version_row.id::text, true);

  update public.care_template_versions
  set status = 'published',
      published_at = now(),
      published_by_user_id = auth.uid()
  where id = version_row.id;

  update public.care_templates
  set current_published_version_id = version_row.id,
      updated_by_user_id = auth.uid(),
      updated_at = now()
  where id = version_row.care_template_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    version_row.organization_id,
    'user',
    auth.uid(),
    'template.published',
    'template_version',
    version_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function', 'version_number', version_row.version_number, 'new_status', 'published'))
  );

  return version_row.id;
end;
$$;

revoke all on function public.publish_care_template_version(uuid) from public;
grant execute on function public.publish_care_template_version(uuid) to authenticated;

create policy "members can read care templates"
on public.care_templates
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can create care templates"
on public.care_templates
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'template.create') and created_by_user_id = auth.uid());

create policy "admins can update care templates"
on public.care_templates
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

create policy "members can read template versions"
on public.care_template_versions
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can create template versions"
on public.care_template_versions
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'template.update') and created_by_user_id = auth.uid());

create policy "admins can update template versions"
on public.care_template_versions
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

create policy "members can read template days"
on public.care_template_days
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can mutate template days"
on public.care_template_days
for all
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

create policy "members can read template tasks"
on public.care_template_tasks
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can mutate template tasks"
on public.care_template_tasks
for all
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

create policy "members can read symptom options"
on public.symptom_options
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can mutate symptom options"
on public.symptom_options
for all
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

create policy "members can read alert rules"
on public.alert_rules
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'template.read'));

create policy "admins can mutate alert rules"
on public.alert_rules
for all
to authenticated
using (public.current_user_has_permission(organization_id, 'template.update'))
with check (public.current_user_has_permission(organization_id, 'template.update'));

grant select, insert, update on public.care_templates to authenticated;
grant select, insert, update on public.care_template_versions to authenticated;
grant select, insert, update, delete on public.care_template_days to authenticated;
grant select, insert, update, delete on public.care_template_tasks to authenticated;
grant select, insert, update, delete on public.symptom_options to authenticated;
grant select, insert, update, delete on public.alert_rules to authenticated;

revoke all on public.care_templates from anon;
revoke all on public.care_template_versions from anon;
revoke all on public.care_template_days from anon;
revoke all on public.care_template_tasks from anon;
revoke all on public.symptom_options from anon;
revoke all on public.alert_rules from anon;
revoke delete on public.care_templates from authenticated;
revoke delete on public.care_template_versions from authenticated;
