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
    'portal.plan_inactive_denied'
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
        'rotated',
        'event_type',
        'day_number',
        'required'
      )
    ),
    '{}'::jsonb
  );
$$;

create unique index if not exists portal_sessions_organization_id_id_unique
on public.portal_sessions(organization_id, id);

create unique index if not exists care_plan_tasks_organization_day_id_unique
on public.care_plan_tasks(organization_id, care_plan_day_id, id);

create table public.care_plan_task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  care_plan_task_id uuid not null,
  portal_session_id uuid not null,
  event_type text not null check (event_type in ('completed', 'reopened')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint care_plan_task_events_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint care_plan_task_events_day_same_plan_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id)
    references public.care_plan_days(organization_id, care_plan_id, id),
  constraint care_plan_task_events_task_same_day_fk
    foreign key (organization_id, care_plan_day_id, care_plan_task_id)
    references public.care_plan_tasks(organization_id, care_plan_day_id, id),
  constraint care_plan_task_events_session_same_org_fk
    foreign key (organization_id, portal_session_id)
    references public.portal_sessions(organization_id, id)
);

create index care_plan_task_events_scope_idx
on public.care_plan_task_events(organization_id, care_plan_id, care_plan_task_id, occurred_at desc);

alter table public.care_plan_task_events enable row level security;

create or replace function public.prevent_task_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'task events are append-only' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'task events cannot be deleted' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger care_plan_task_events_append_only
before update or delete on public.care_plan_task_events
for each row execute function public.prevent_task_event_mutation();

create or replace function public.portal_today()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Europe/Istanbul')::date;
$$;

create or replace function public.validate_portal_session_hash(target_session_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.portal_sessions%rowtype;
  link_row public.secure_links%rowtype;
  plan_status text;
begin
  select * into session_row
  from public.portal_sessions
  where session_hash = target_session_hash and status = 'active' and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  select * into link_row
  from public.secure_links
  where id = session_row.secure_link_id
    and organization_id = session_row.organization_id
    and care_plan_id = session_row.care_plan_id;

  if not found or link_row.status <> 'active' or link_row.expires_at <= now() then
    return null;
  end if;

  select status into plan_status
  from public.care_plans
  where id = session_row.care_plan_id and organization_id = session_row.organization_id;

  if plan_status is null or plan_status = 'stopped' then
    return null;
  end if;

  update public.portal_sessions set last_used_at = now() where id = session_row.id;
  return session_row.id;
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
    'days',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
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

create or replace function public.recalculate_care_plan_day_status(
  target_day_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  day_row public.care_plan_days%rowtype;
  required_count integer;
  pending_required_count integer;
  next_status text;
begin
  select * into day_row from public.care_plan_days where id = target_day_id;
  if not found then
    raise exception 'plan day not found';
  end if;

  select
    count(*) filter (where required)::int,
    count(*) filter (where required and status <> 'completed')::int
  into required_count, pending_required_count
  from public.care_plan_tasks
  where organization_id = day_row.organization_id and care_plan_day_id = day_row.id;

  next_status := case
    when day_row.scheduled_date > public.portal_today() then 'pending'
    when required_count = 0 then 'completed'
    when pending_required_count = 0 then 'completed'
    else 'available'
  end;

  perform set_config('app.creating_care_plan_snapshot', 'on', true);
  update public.care_plan_days
  set status = next_status,
      updated_at = now()
  where id = day_row.id;
  perform set_config('app.creating_care_plan_snapshot', 'off', true);

  return next_status;
exception
  when others then
    perform set_config('app.creating_care_plan_snapshot', 'off', true);
    raise;
end;
$$;

create or replace function public.set_portal_task_status(
  target_session_hash text,
  target_task_id uuid,
  target_status text
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
  task_row public.care_plan_tasks%rowtype;
  day_row public.care_plan_days%rowtype;
  previous_status text;
  event_type text;
  day_status text;
  today date := public.portal_today();
begin
  if target_status not in ('completed', 'pending') then
    raise exception 'unsupported task status transition';
  end if;

  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  select * into session_row from public.portal_sessions where id = session_id;
  select * into plan_row from public.care_plans where id = session_row.care_plan_id and organization_id = session_row.organization_id;

  if not found or plan_row.status = 'stopped' then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (coalesce(session_row.organization_id, plan_row.organization_id), 'system', 'portal.plan_inactive_denied', 'plan', coalesce(session_row.care_plan_id, plan_row.id), 'denied', public.sanitize_audit_metadata('{"result_reason":"plan_inactive","source":"portal_rpc"}'::jsonb));
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  if plan_row.status = 'completed' then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (plan_row.organization_id, 'system', 'portal.plan_inactive_denied', 'plan', plan_row.id, 'denied', public.sanitize_audit_metadata('{"result_reason":"plan_readonly","source":"portal_rpc"}'::jsonb));
    return jsonb_build_object('error', 'plan is read-only');
  end if;

  select t.* into task_row
  from public.care_plan_tasks t
  join public.care_plan_days d on d.id = t.care_plan_day_id and d.organization_id = t.organization_id
  where t.id = target_task_id
    and t.organization_id = session_row.organization_id
    and d.care_plan_id = session_row.care_plan_id;

  if not found then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (session_row.organization_id, 'system', 'portal.task_change_denied', 'plan', session_row.care_plan_id, 'denied', public.sanitize_audit_metadata('{"result_reason":"task_not_found","source":"portal_rpc"}'::jsonb));
    return jsonb_build_object('error', 'task not found for portal session');
  end if;

  select * into day_row
  from public.care_plan_days
  where id = task_row.care_plan_day_id and organization_id = task_row.organization_id and care_plan_id = session_row.care_plan_id;

  if plan_row.status = 'scheduled' or plan_row.start_date > today or day_row.scheduled_date > today then
    insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
    values (plan_row.organization_id, 'system', 'portal.future_task_denied', 'plan_task', task_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('result_reason', 'day_locked', 'day_number', day_row.day_number, 'source', 'portal_rpc')));
    return jsonb_build_object('error', 'task is not currently available');
  end if;

  previous_status := task_row.status;
  if previous_status = target_status then
    day_status := public.recalculate_care_plan_day_status(day_row.id);
    return jsonb_build_object('task_status', previous_status, 'day_status', day_status);
  end if;

  if not (
    (previous_status = 'pending' and target_status = 'completed')
    or (previous_status = 'completed' and target_status = 'pending')
  ) then
    raise exception 'unsupported task status transition';
  end if;

  event_type := case when target_status = 'completed' then 'completed' else 'reopened' end;

  perform set_config('app.creating_care_plan_snapshot', 'on', true);
  update public.care_plan_tasks
  set status = target_status,
      completed_at = case when target_status = 'completed' then now() else null end,
      updated_at = now()
  where id = task_row.id;
  perform set_config('app.creating_care_plan_snapshot', 'off', true);

  insert into public.care_plan_task_events (
    organization_id,
    care_plan_id,
    care_plan_day_id,
    care_plan_task_id,
    portal_session_id,
    event_type
  )
  values (
    task_row.organization_id,
    plan_row.id,
    day_row.id,
    task_row.id,
    session_row.id,
    event_type
  );

  day_status := public.recalculate_care_plan_day_status(day_row.id);

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    plan_row.organization_id,
    'system',
    case when event_type = 'completed' then 'portal.task_completed' else 'portal.task_reopened' end,
    'plan_task',
    task_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('event_type', event_type, 'task_type', task_row.task_type, 'required', task_row.required, 'day_number', day_row.day_number, 'previous_status', previous_status, 'new_status', target_status, 'source', 'portal_rpc'))
  );

  return jsonb_build_object('task_status', target_status, 'day_status', day_status);
exception
  when others then
    perform set_config('app.creating_care_plan_snapshot', 'off', true);
    raise;
end;
$$;

revoke all on function public.validate_portal_session_hash(text) from public;
revoke all on function public.get_portal_plan_for_session(text, uuid) from public;
revoke all on function public.set_portal_task_status(text, uuid, text) from public;
revoke all on function public.recalculate_care_plan_day_status(uuid) from public;

grant execute on function public.validate_portal_session_hash(text) to anon, authenticated;
grant execute on function public.get_portal_plan_for_session(text, uuid) to anon, authenticated;
grant execute on function public.set_portal_task_status(text, uuid, text) to anon, authenticated;

revoke all on public.care_plan_task_events from anon;
revoke all on public.care_plan_task_events from authenticated;
