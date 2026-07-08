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
              'photo_requests',
                coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', pr.id,
                        'label', pr.label,
                        'required', pr.required,
                        'status', pr.status,
                        'uploaded_at', rec.finalized_at
                      )
                      order by pr.created_at
                    )
                    from public.photo_requests pr
                    left join public.photo_records rec
                      on rec.organization_id = pr.organization_id
                     and rec.photo_request_id = pr.id
                    where pr.organization_id = d.organization_id
                      and pr.care_plan_id = d.care_plan_id
                      and pr.care_plan_day_id = d.id
                      and pr.status = 'active'
                  ),
                  '[]'::jsonb
                ),
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

revoke all on function public.get_portal_plan_for_session(text, uuid) from public;
grant execute on function public.get_portal_plan_for_session(text, uuid) to anon, authenticated;
