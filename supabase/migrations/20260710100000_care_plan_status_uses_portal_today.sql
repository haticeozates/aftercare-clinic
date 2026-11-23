-- Align care plan initial status with portal_today() so Istanbul-midnight plans are active when portal is.

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

  plan_status := case when target_start_date > public.portal_today() then 'scheduled' else 'active' end;
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
