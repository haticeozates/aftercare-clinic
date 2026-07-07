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
    'secure_link.rotate',
    'alert.read',
    'alert.acknowledge',
    'alert.resolve',
    'alert.dismiss'
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
    'secure_link.create_denied',
    'portal.viewed',
    'portal.session_invalid',
    'portal.task_completed',
    'portal.task_reopened',
    'portal.task_change_denied',
    'portal.future_task_denied',
    'portal.plan_inactive_denied',
    'symptom_report.submitted',
    'symptom_report.submit_denied',
    'alert.created',
    'alert.viewed',
    'alert.acknowledged',
    'alert.resolved',
    'alert.dismissed',
    'alert.status_change_denied'
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
    'plan_task_event',
    'secure_link',
    'portal_session',
    'symptom_report',
    'symptom_report_item',
    'alert',
    'alert_event'
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
        'rotated',
        'event_type',
        'day_number',
        'required',
        'selected_option_count',
        'alert_count',
        'resolution_code'
      )
    ),
    '{}'::jsonb
  );
$$;

insert into public.permissions (key, description)
values
  ('alert.read', 'Read rule-based follow-up alerts'),
  ('alert.acknowledge', 'Mark follow-up alerts as reviewed'),
  ('alert.resolve', 'Resolve follow-up alerts'),
  ('alert.dismiss', 'Dismiss follow-up alerts')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('alert.read', 'alert.acknowledge', 'alert.resolve', 'alert.dismiss')
where r.key in ('organization_owner', 'organization_admin', 'staff')
on conflict do nothing;

create unique index if not exists symptom_options_organization_id_id_unique
on public.symptom_options(organization_id, id);

create unique index if not exists alert_rules_organization_id_id_unique
on public.alert_rules(organization_id, id);

create unique index if not exists portal_sessions_org_plan_id_unique
on public.portal_sessions(organization_id, care_plan_id, id);

create table public.care_plan_symptom_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  source_symptom_option_id uuid not null,
  label text not null check (label = btrim(label) and length(label) between 2 and 120 and label !~* '<script'),
  normalized_label text not null check (normalized_label = btrim(lower(normalized_label)) and length(normalized_label) between 2 and 120),
  allows_severity boolean not null default false,
  allows_note boolean not null default true,
  display_order integer not null check (display_order >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint care_plan_symptom_options_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint care_plan_symptom_options_source_same_org_fk
    foreign key (organization_id, source_symptom_option_id)
    references public.symptom_options(organization_id, id),
  constraint care_plan_symptom_options_source_unique unique (care_plan_id, source_symptom_option_id),
  constraint care_plan_symptom_options_label_unique unique (care_plan_id, normalized_label)
);

create unique index care_plan_symptom_options_organization_id_id_unique
on public.care_plan_symptom_options(organization_id, id);

create unique index care_plan_symptom_options_org_plan_id_unique
on public.care_plan_symptom_options(organization_id, care_plan_id, id);

create table public.care_plan_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  source_alert_rule_id uuid not null,
  care_plan_symptom_option_id uuid,
  rule_type text not null check (rule_type in ('symptom_selected', 'severity_threshold', 'task_incomplete', 'photo_missing')),
  severity_level text not null check (severity_level in ('low', 'medium', 'high')),
  configuration jsonb not null default '{}'::jsonb,
  message_label text not null check (message_label = btrim(message_label) and length(message_label) between 2 and 160 and message_label !~* '<script'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint care_plan_alert_rules_configuration_object check (jsonb_typeof(configuration) = 'object'),
  constraint care_plan_alert_rules_configuration_size check (pg_column_size(configuration) <= 2048),
  constraint care_plan_alert_rules_configuration_allowlist check (public.alert_rule_configuration_is_allowed(configuration)),
  constraint care_plan_alert_rules_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint care_plan_alert_rules_source_same_org_fk
    foreign key (organization_id, source_alert_rule_id)
    references public.alert_rules(organization_id, id),
  constraint care_plan_alert_rules_option_same_plan_fk
    foreign key (organization_id, care_plan_id, care_plan_symptom_option_id)
    references public.care_plan_symptom_options(organization_id, care_plan_id, id),
  constraint care_plan_alert_rules_source_unique unique (care_plan_id, source_alert_rule_id)
);

create unique index care_plan_alert_rules_organization_id_id_unique
on public.care_plan_alert_rules(organization_id, id);

create unique index care_plan_alert_rules_org_plan_id_unique
on public.care_plan_alert_rules(organization_id, care_plan_id, id);

create table public.symptom_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  portal_session_id uuid not null,
  report_date date not null,
  status text not null default 'submitted' check (status in ('submitted')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint symptom_reports_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint symptom_reports_day_same_plan_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id)
    references public.care_plan_days(organization_id, care_plan_id, id),
  constraint symptom_reports_session_same_plan_fk
    foreign key (organization_id, care_plan_id, portal_session_id)
    references public.portal_sessions(organization_id, care_plan_id, id),
  constraint symptom_reports_one_per_day unique (care_plan_day_id)
);

create unique index symptom_reports_organization_id_id_unique
on public.symptom_reports(organization_id, id);

create unique index symptom_reports_org_plan_day_id_unique
on public.symptom_reports(organization_id, care_plan_id, care_plan_day_id, id);

create table public.symptom_report_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  symptom_report_id uuid not null,
  care_plan_symptom_option_id uuid not null,
  selected boolean not null,
  severity integer check (severity between 1 and 5),
  created_at timestamptz not null default now(),
  constraint symptom_report_items_report_same_org_fk
    foreign key (organization_id, symptom_report_id)
    references public.symptom_reports(organization_id, id),
  constraint symptom_report_items_option_same_org_fk
    foreign key (organization_id, care_plan_symptom_option_id)
    references public.care_plan_symptom_options(organization_id, id),
  constraint symptom_report_items_unique_option unique (symptom_report_id, care_plan_symptom_option_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  symptom_report_id uuid not null,
  care_plan_alert_rule_id uuid not null,
  severity_level text not null check (severity_level in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid,
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  resolution_code text check (resolution_code is null or resolution_code in ('reviewed_no_action', 'client_contact_planned', 'follow_up_planned', 'duplicate_report', 'other_internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_report_same_scope_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id, symptom_report_id)
    references public.symptom_reports(organization_id, care_plan_id, care_plan_day_id, id),
  constraint alerts_rule_same_plan_fk
    foreign key (organization_id, care_plan_id, care_plan_alert_rule_id)
    references public.care_plan_alert_rules(organization_id, care_plan_id, id),
  constraint alerts_ack_user_same_org_fk
    foreign key (organization_id, acknowledged_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint alerts_resolved_user_same_org_fk
    foreign key (organization_id, resolved_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint alerts_unique_report_rule unique (symptom_report_id, care_plan_alert_rule_id)
);

create unique index alerts_organization_id_id_unique
on public.alerts(organization_id, id);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  alert_id uuid not null,
  event_type text not null check (event_type in ('created', 'acknowledged', 'resolved', 'dismissed')),
  previous_status text check (previous_status is null or previous_status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  new_status text not null check (new_status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint alert_events_alert_same_org_fk
    foreign key (organization_id, alert_id)
    references public.alerts(organization_id, id),
  constraint alert_events_actor_same_org_fk
    foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id)
);

alter table public.care_plan_symptom_options enable row level security;
alter table public.care_plan_alert_rules enable row level security;
alter table public.symptom_reports enable row level security;
alter table public.symptom_report_items enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;

create or replace function public.prevent_phase6_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'record is immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'record cannot be deleted' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger care_plan_symptom_options_immutable
before update or delete on public.care_plan_symptom_options
for each row execute function public.prevent_phase6_append_only();

create trigger care_plan_alert_rules_immutable
before update or delete on public.care_plan_alert_rules
for each row execute function public.prevent_phase6_append_only();

create trigger symptom_reports_immutable
before update or delete on public.symptom_reports
for each row execute function public.prevent_phase6_append_only();

create trigger symptom_report_items_immutable
before update or delete on public.symptom_report_items
for each row execute function public.prevent_phase6_append_only();

create trigger alert_events_append_only
before update or delete on public.alert_events
for each row execute function public.prevent_phase6_append_only();

create or replace function public.prevent_alert_unsafe_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'alerts cannot be deleted' using errcode = '42501';
  end if;

  if current_setting('app.reviewing_alert', true) is distinct from 'on' then
    raise exception 'alerts can only be changed through review flow' using errcode = '42501';
  end if;

  if old.organization_id <> new.organization_id
    or old.care_plan_id <> new.care_plan_id
    or old.care_plan_day_id <> new.care_plan_day_id
    or old.symptom_report_id <> new.symptom_report_id
    or old.care_plan_alert_rule_id <> new.care_plan_alert_rule_id
    or old.severity_level <> new.severity_level then
    raise exception 'alert scope is immutable' using errcode = '42501';
  end if;

  if old.status in ('resolved', 'dismissed') then
    raise exception 'closed alert is immutable' using errcode = '42501';
  end if;

  if not (
    (old.status = 'open' and new.status in ('acknowledged', 'resolved', 'dismissed'))
    or (old.status = 'acknowledged' and new.status in ('resolved', 'dismissed'))
  ) then
    raise exception 'invalid status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger alerts_controlled_update_only
before update or delete on public.alerts
for each row execute function public.prevent_alert_unsafe_mutation();

create or replace function public.snapshot_care_plan_checkin_configuration(target_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  plan_row public.care_plans%rowtype;
begin
  select * into plan_row from public.care_plans where id = target_plan_id;
  if not found then
    raise exception 'plan not found';
  end if;

  insert into public.care_plan_symptom_options (
    organization_id,
    care_plan_id,
    source_symptom_option_id,
    label,
    normalized_label,
    allows_severity,
    allows_note,
    display_order,
    active
  )
  select
    plan_row.organization_id,
    plan_row.id,
    so.id,
    so.label,
    so.normalized_label,
    so.allows_severity,
    so.allows_note,
    so.display_order,
    so.active
  from public.symptom_options so
  where so.organization_id = plan_row.organization_id
    and so.template_version_id = plan_row.template_version_id
  on conflict (care_plan_id, source_symptom_option_id) do nothing;

  insert into public.care_plan_alert_rules (
    organization_id,
    care_plan_id,
    source_alert_rule_id,
    care_plan_symptom_option_id,
    rule_type,
    severity_level,
    configuration,
    message_label,
    active
  )
  select
    plan_row.organization_id,
    plan_row.id,
    ar.id,
    cpso.id,
    ar.rule_type,
    ar.severity_level,
    ar.configuration,
    ar.message_label,
    ar.active
  from public.alert_rules ar
  left join public.care_plan_symptom_options cpso
    on cpso.organization_id = ar.organization_id
    and cpso.care_plan_id = plan_row.id
    and cpso.source_symptom_option_id = ar.symptom_option_id
  where ar.organization_id = plan_row.organization_id
    and ar.template_version_id = plan_row.template_version_id
  on conflict (care_plan_id, source_alert_rule_id) do nothing;
end;
$$;

create or replace function public.snapshot_care_plan_checkin_configuration_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.snapshot_care_plan_checkin_configuration(new.id);
  return new;
end;
$$;

create trigger care_plans_snapshot_checkin_configuration
after insert on public.care_plans
for each row execute function public.snapshot_care_plan_checkin_configuration_trigger();

create or replace function public.phase6_rule_matches(rule_row public.care_plan_alert_rules, selected_items jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  threshold integer;
begin
  if rule_row.rule_type not in ('symptom_selected', 'severity_threshold') then
    return false;
  end if;

  select value into item
  from jsonb_array_elements(coalesce(selected_items, '[]'::jsonb)) value
  where value->>'option_id' = rule_row.care_plan_symptom_option_id::text
    and coalesce((value->>'selected')::boolean, false)
  limit 1;

  if item is null then
    return false;
  end if;

  if rule_row.rule_type = 'symptom_selected' then
    return true;
  end if;

  threshold := coalesce((rule_row.configuration->>'threshold')::int, (rule_row.configuration->>'minimum')::int);
  if threshold is null or threshold < 1 or threshold > 5 then
    return false;
  end if;

  return (item->>'severity')::int >= threshold;
exception
  when others then
    return false;
end;
$$;

create or replace function public.get_portal_plan_for_session(
  target_session_hash text,
  expected_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
  session_row public.portal_sessions%rowtype;
  plan_row public.care_plans%rowtype;
  today date := public.portal_today();
  response jsonb;
begin
  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return null;
  end if;

  select * into session_row from public.portal_sessions where id = session_id;
  if expected_plan_id is not null and expected_plan_id <> session_row.care_plan_id then
    return null;
  end if;

  select * into plan_row
  from public.care_plans
  where id = session_row.care_plan_id and organization_id = session_row.organization_id;

  if not found or plan_row.status = 'stopped' then
    return null;
  end if;

  response := jsonb_build_object(
    'plan_status', plan_row.status,
    'mode', case
      when plan_row.status = 'completed' then 'readonly'
      when plan_row.status = 'scheduled' or plan_row.start_date > today then 'scheduled'
      else 'active'
    end,
    'start_date', plan_row.start_date,
    'end_date', plan_row.end_date,
    'today', today,
    'timezone', 'Europe/Istanbul',
    'check_in',
      jsonb_build_object(
        'options',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', o.id,
                  'label', o.label,
                  'allows_severity', o.allows_severity,
                  'display_order', o.display_order
                )
                order by o.display_order
              )
              from public.care_plan_symptom_options o
              where o.organization_id = plan_row.organization_id
                and o.care_plan_id = plan_row.id
                and o.active
            ),
            '[]'::jsonb
          ),
        'submitted_day_ids',
          coalesce(
            (
              select jsonb_agg(r.care_plan_day_id)
              from public.symptom_reports r
              where r.organization_id = plan_row.organization_id and r.care_plan_id = plan_row.id
            ),
            '[]'::jsonb
          )
      ),
    'days',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', d.id,
              'day_number', d.day_number,
              'scheduled_date', d.scheduled_date,
              'title', d.title,
              'status', case
                when d.scheduled_date > today then 'locked'
                else d.status
              end,
              'availability', case
                when plan_row.status = 'completed' then 'readonly'
                when d.scheduled_date > today or plan_row.start_date > today then 'locked'
                else 'available'
              end,
              'tasks',
                coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', t.id,
                        'title', t.title,
                        'description', t.description,
                        'task_type', t.task_type,
                        'required', t.required,
                        'status', t.status,
                        'completed_at', t.completed_at
                      )
                      order by t.display_order
                    )
                    from public.care_plan_tasks t
                    where t.organization_id = d.organization_id and t.care_plan_day_id = d.id
                  ),
                  '[]'::jsonb
                )
            )
            order by d.day_number
          )
          from public.care_plan_days d
          where d.organization_id = plan_row.organization_id and d.care_plan_id = plan_row.id
        ),
        '[]'::jsonb
      )
  );

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    plan_row.organization_id,
    'system',
    'portal.viewed',
    'plan',
    plan_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'portal_rpc'))
  );

  return response;
end;
$$;

create or replace function public.submit_symptom_report_for_portal(
  target_session_hash text,
  target_day_id uuid,
  target_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
  session_row public.portal_sessions%rowtype;
  plan_row public.care_plans%rowtype;
  day_row public.care_plan_days%rowtype;
  report_id uuid;
  item jsonb;
  option_row public.care_plan_symptom_options%rowtype;
  normalized_items jsonb := '[]'::jsonb;
  selected_count integer := 0;
  alert_count integer := 0;
  rule_row public.care_plan_alert_rules%rowtype;
  new_alert_id uuid;
  today date := public.portal_today();
begin
  if jsonb_typeof(coalesce(target_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid report payload';
  end if;

  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  select * into session_row from public.portal_sessions where id = session_id;
  select * into plan_row from public.care_plans where id = session_row.care_plan_id and organization_id = session_row.organization_id;

  if not found or plan_row.status = 'stopped' then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;
  if plan_row.status = 'completed' then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (plan_row.organization_id, 'system', 'symptom_report.submit_denied', 'plan', plan_row.id, 'denied', public.sanitize_audit_metadata('{"result_reason":"plan_readonly","source":"portal_rpc"}'::jsonb));
    return jsonb_build_object('error', 'plan is read-only');
  end if;

  select * into day_row
  from public.care_plan_days
  where id = target_day_id
    and organization_id = session_row.organization_id
    and care_plan_id = session_row.care_plan_id;

  if not found then
    return jsonb_build_object('error', 'day not found for portal session');
  end if;

  if plan_row.status = 'scheduled' or plan_row.start_date > today or day_row.scheduled_date > today then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (plan_row.organization_id, 'system', 'symptom_report.submit_denied', 'plan_day', day_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('result_reason', 'day_locked', 'day_number', day_row.day_number, 'source', 'portal_rpc')));
    return jsonb_build_object('error', 'day is not available');
  end if;

  select id into report_id
  from public.symptom_reports
  where organization_id = plan_row.organization_id and care_plan_day_id = day_row.id
  limit 1;

  if report_id is not null then
    return jsonb_build_object('status', 'already_submitted', 'report_id', report_id, 'alert_count', (select count(*) from public.alerts where symptom_report_id = report_id));
  end if;

  for item in select value from jsonb_array_elements(target_items) value loop
    select * into option_row
    from public.care_plan_symptom_options
    where id = nullif(item->>'option_id', '')::uuid
      and organization_id = plan_row.organization_id
      and care_plan_id = plan_row.id
      and active;

    if not found then
      raise exception 'invalid option';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(normalized_items) existing
      where existing->>'option_id' = option_row.id::text
    ) then
      raise exception 'duplicate option';
    end if;

    if coalesce((item->>'selected')::boolean, false) and option_row.allows_severity then
      if not ((item->>'severity') ~ '^[1-5]$') then
        raise exception 'severity required';
      end if;
    elsif item ? 'severity' and item->>'severity' is not null then
      raise exception 'severity not allowed';
    end if;

    if coalesce((item->>'selected')::boolean, false) then
      selected_count := selected_count + 1;
    end if;

    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'option_id', option_row.id,
      'selected', coalesce((item->>'selected')::boolean, false),
      'severity', case when option_row.allows_severity and coalesce((item->>'selected')::boolean, false) then (item->>'severity')::int else null end
    ));
  end loop;

  insert into public.symptom_reports (
    organization_id,
    care_plan_id,
    care_plan_day_id,
    portal_session_id,
    report_date,
    status,
    submitted_at
  )
  values (
    plan_row.organization_id,
    plan_row.id,
    day_row.id,
    session_row.id,
    day_row.scheduled_date,
    'submitted',
    now()
  )
  returning id into report_id;

  insert into public.symptom_report_items (
    organization_id,
    symptom_report_id,
    care_plan_symptom_option_id,
    selected,
    severity
  )
  select
    plan_row.organization_id,
    report_id,
    (value->>'option_id')::uuid,
    (value->>'selected')::boolean,
    case when value->>'severity' is null then null else (value->>'severity')::int end
  from jsonb_array_elements(normalized_items) value;

  for rule_row in
    select *
    from public.care_plan_alert_rules
    where organization_id = plan_row.organization_id
      and care_plan_id = plan_row.id
      and active
      and rule_type in ('symptom_selected', 'severity_threshold')
  loop
    if public.phase6_rule_matches(rule_row, normalized_items) then
      insert into public.alerts (
        organization_id,
        care_plan_id,
        care_plan_day_id,
        symptom_report_id,
        care_plan_alert_rule_id,
        severity_level,
        status
      )
      values (
        plan_row.organization_id,
        plan_row.id,
        day_row.id,
        report_id,
        rule_row.id,
        rule_row.severity_level,
        'open'
      )
      on conflict (symptom_report_id, care_plan_alert_rule_id) do nothing
      returning id into new_alert_id;

      if new_alert_id is not null then
        alert_count := alert_count + 1;
        insert into public.alert_events (organization_id, alert_id, event_type, previous_status, new_status)
        values (plan_row.organization_id, new_alert_id, 'created', null, 'open');
        insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
        values (plan_row.organization_id, 'system', 'alert.created', 'alert', new_alert_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('severity_level', rule_row.severity_level, 'rule_type', rule_row.rule_type, 'day_number', day_row.day_number, 'source', 'portal_rpc')));
      end if;
    end if;
  end loop;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    plan_row.organization_id,
    'system',
    'symptom_report.submitted',
    'symptom_report',
    report_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('selected_option_count', selected_count, 'alert_count', alert_count, 'day_number', day_row.day_number, 'source', 'portal_rpc'))
  );

  return jsonb_build_object('status', 'submitted', 'report_id', report_id, 'alert_count', alert_count);
exception
  when others then
    raise;
end;
$$;

create or replace function public.review_alert(
  target_alert_id uuid,
  target_action text,
  target_resolution_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  alert_row public.alerts%rowtype;
  next_status text;
  event_type text;
  required_permission text;
begin
  select om.organization_id into org_id
  from public.organization_memberships om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;

  if org_id is null then
    return jsonb_build_object('error', 'permission denied');
  end if;

  select * into alert_row
  from public.alerts
  where id = target_alert_id and organization_id = org_id;

  if not found then
    return jsonb_build_object('error', 'alert not found');
  end if;

  if target_action = 'acknowledge' then
    required_permission := 'alert.acknowledge';
    next_status := 'acknowledged';
    event_type := 'acknowledged';
  elsif target_action = 'resolve' then
    required_permission := 'alert.resolve';
    next_status := 'resolved';
    event_type := 'resolved';
  elsif target_action = 'dismiss' then
    required_permission := 'alert.dismiss';
    next_status := 'dismissed';
    event_type := 'dismissed';
  else
    return jsonb_build_object('error', 'invalid action');
  end if;

  if not public.current_user_has_permission(org_id, required_permission) then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (org_id, 'user', auth.uid(), 'alert.status_change_denied', 'alert', alert_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', required_permission, 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  if next_status in ('resolved', 'dismissed') and target_resolution_code not in ('reviewed_no_action', 'client_contact_planned', 'follow_up_planned', 'duplicate_report', 'other_internal') then
    return jsonb_build_object('error', 'invalid resolution code');
  end if;

  if not (
    (alert_row.status = 'open' and next_status in ('acknowledged', 'resolved', 'dismissed'))
    or (alert_row.status = 'acknowledged' and next_status in ('resolved', 'dismissed'))
  ) then
    return jsonb_build_object('error', 'invalid status transition');
  end if;

  perform set_config('app.reviewing_alert', 'on', true);
  update public.alerts
  set status = next_status,
      acknowledged_at = case when next_status = 'acknowledged' then now() else acknowledged_at end,
      acknowledged_by_user_id = case when next_status = 'acknowledged' then auth.uid() else acknowledged_by_user_id end,
      resolved_at = case when next_status in ('resolved', 'dismissed') then now() else resolved_at end,
      resolved_by_user_id = case when next_status in ('resolved', 'dismissed') then auth.uid() else resolved_by_user_id end,
      resolution_code = case when next_status in ('resolved', 'dismissed') then target_resolution_code else resolution_code end
  where id = alert_row.id;
  perform set_config('app.reviewing_alert', 'off', true);

  insert into public.alert_events (organization_id, alert_id, event_type, previous_status, new_status, actor_user_id)
  values (org_id, alert_row.id, event_type, alert_row.status, next_status, auth.uid());

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    org_id,
    'user',
    auth.uid(),
    case when next_status = 'acknowledged' then 'alert.acknowledged' when next_status = 'resolved' then 'alert.resolved' else 'alert.dismissed' end,
    'alert',
    alert_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('previous_status', alert_row.status, 'new_status', next_status, 'resolution_code', target_resolution_code, 'source', 'db_function'))
  );

  return jsonb_build_object('status', next_status);
exception
  when others then
    perform set_config('app.reviewing_alert', 'off', true);
    raise;
end;
$$;

create policy care_plan_symptom_options_select_own_org
on public.care_plan_symptom_options
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

create policy care_plan_alert_rules_select_own_org
on public.care_plan_alert_rules
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'plan.read'));

create policy symptom_reports_select_own_org
on public.symptom_reports
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'alert.read'));

create policy symptom_report_items_select_own_org
on public.symptom_report_items
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'alert.read'));

create policy alerts_select_own_org
on public.alerts
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'alert.read'));

create policy alert_events_select_own_org
on public.alert_events
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'alert.read'));

revoke all on public.care_plan_symptom_options from anon;
revoke all on public.care_plan_alert_rules from anon;
revoke all on public.symptom_reports from anon;
revoke all on public.symptom_report_items from anon;
revoke all on public.alerts from anon;
revoke all on public.alert_events from anon;

revoke all on public.care_plan_symptom_options from authenticated;
revoke all on public.care_plan_alert_rules from authenticated;
revoke all on public.symptom_reports from authenticated;
revoke all on public.symptom_report_items from authenticated;
revoke all on public.alerts from authenticated;
revoke all on public.alert_events from authenticated;

grant select on public.care_plan_symptom_options to authenticated;
grant select on public.care_plan_alert_rules to authenticated;
grant select on public.symptom_reports to authenticated;
grant select on public.symptom_report_items to authenticated;
grant select on public.alerts to authenticated;
grant select on public.alert_events to authenticated;

revoke all on function public.snapshot_care_plan_checkin_configuration(uuid) from public;
revoke all on function public.submit_symptom_report_for_portal(text, uuid, jsonb) from public;
revoke all on function public.review_alert(uuid, text, text) from public;
revoke all on function public.phase6_rule_matches(public.care_plan_alert_rules, jsonb) from public;

grant execute on function public.submit_symptom_report_for_portal(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.review_alert(uuid, text, text) to authenticated;
