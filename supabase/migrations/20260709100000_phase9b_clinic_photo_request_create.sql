create or replace function public.create_photo_request_for_staff(
  p_care_plan_id uuid,
  p_care_plan_day_id uuid,
  p_label text,
  p_required boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_plan public.care_plans%rowtype;
  v_day public.care_plan_days%rowtype;
  v_label text := btrim(coalesce(p_label, ''));
  v_required boolean := coalesce(p_required, false);
  v_request_id uuid;
begin
  if v_actor is null then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_label is null
    or char_length(v_label) < 2
    or char_length(v_label) > 120
    or v_label <> btrim(v_label)
    or position('<script' in lower(v_label)) > 0
  then
    return jsonb_build_object('error', 'invalid label');
  end if;

  select * into v_plan
  from public.care_plans
  where id = p_care_plan_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_plan.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(v_plan.organization_id, 'photo.request.manage') then
    insert into public.audit_logs (
      organization_id,
      actor_type,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      result,
      safe_metadata
    )
    values (
      v_plan.organization_id,
      'user',
      v_actor,
      'authorization.denied',
      'photo_request',
      null,
      'denied',
      public.sanitize_audit_metadata(jsonb_build_object(
        'source', 'db_function',
        'permission_key', 'photo.request.manage'
      ))
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if v_plan.status not in ('scheduled', 'active') then
    return jsonb_build_object('error', 'plan is not eligible');
  end if;

  select * into v_day
  from public.care_plan_days
  where id = p_care_plan_day_id
    and organization_id = v_plan.organization_id
    and care_plan_id = v_plan.id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  insert into public.photo_requests (
    organization_id,
    care_plan_id,
    care_plan_day_id,
    label,
    required,
    status,
    created_by_user_id
  )
  values (
    v_plan.organization_id,
    v_plan.id,
    v_day.id,
    v_label,
    v_required,
    'active',
    v_actor
  )
  returning id into v_request_id;

  insert into public.audit_logs (
    organization_id,
    actor_type,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    result,
    safe_metadata
  )
  values (
    v_plan.organization_id,
    'user',
    v_actor,
    'photo_request.created',
    'photo_request',
    v_request_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object(
      'source', 'db_function',
      'day_number', v_day.day_number,
      'required', v_required
    ))
  );

  return jsonb_build_object(
    'status', 'created',
    'photo_request_id', v_request_id,
    'care_plan_day_id', v_day.id,
    'label', v_label,
    'required', v_required
  );
exception
  when unique_violation then
    return jsonb_build_object('error', 'photo request already exists');
end;
$$;

revoke all on function public.create_photo_request_for_staff(uuid, uuid, text, boolean) from public;
grant execute on function public.create_photo_request_for_staff(uuid, uuid, text, boolean) to authenticated;
