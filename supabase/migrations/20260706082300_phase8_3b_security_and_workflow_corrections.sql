-- Phase 8.3B controlled correction pass: tenant-safe data requests, assign RPC, resolution codes, clinic event source.

alter table public.data_requests drop constraint if exists data_requests_resolution_code_check;

alter table public.data_requests
add constraint data_requests_resolution_code_check check (
  resolution_code is null
  or resolution_code in (
    'completed_without_export',
    'manual_review_completed',
    'manual_review_declined',
    'manual_review_cancelled',
    'unsupported_request',
    'duplicate_request',
    'cancelled_by_client',
    'other_internal'
  )
);

create or replace function public.phase8_data_request_allowed_resolution_codes()
returns text[]
language sql
immutable
as $$
  select array[
    'completed_without_export',
    'manual_review_completed',
    'manual_review_declined',
    'manual_review_cancelled',
    'unsupported_request',
    'duplicate_request',
    'cancelled_by_client',
    'other_internal'
  ]::text[];
$$;

create or replace function public.phase8_data_request_default_resolution_code(target_status text)
returns text
language sql
immutable
as $$
  select case target_status
    when 'completed' then 'manual_review_completed'
    when 'declined' then 'manual_review_declined'
    when 'cancelled' then 'manual_review_cancelled'
    else null
  end;
$$;

create or replace function public.write_data_request_manage_denied_audit(
  p_target_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_target_organization_id is null then
    return;
  end if;

  if not public.current_user_has_active_membership(p_target_organization_id) then
    return;
  end if;

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
    p_target_organization_id,
    'user',
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    'denied',
    public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'data_request.manage', 'source', 'db_function'))
  );
end;
$$;

revoke all on function public.write_data_request_manage_denied_audit(uuid, text, text, uuid) from public;

create or replace function public.assign_data_request(
  p_request_id uuid,
  p_assigned_to_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.data_requests%rowtype;
begin
  select * into request_row
  from public.data_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(request_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(request_row.organization_id, 'data_request.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      request_row.organization_id,
      'user',
      auth.uid(),
      'data_request.assigned',
      'data_request',
      request_row.id,
      'denied',
      public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'data_request.manage', 'source', 'db_function'))
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if p_assigned_to_user_id is null then
    return jsonb_build_object('error', 'invalid assignee');
  end if;

  if not exists (
    select 1
    from public.organization_memberships
    where organization_id = request_row.organization_id
      and user_id = p_assigned_to_user_id
      and status = 'active'
  ) then
    return jsonb_build_object('error', 'invalid assignee');
  end if;

  if p_assigned_to_user_id is not distinct from request_row.assigned_to_user_id then
    return jsonb_build_object('status', 'assigned');
  end if;

  update public.data_requests
  set assigned_to_user_id = p_assigned_to_user_id,
      updated_at = now()
  where id = request_row.id;

  insert into public.data_request_events (
    organization_id,
    data_request_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    assignee_user_id,
    source,
    safe_metadata
  )
  values (
    request_row.organization_id,
    request_row.id,
    'assigned',
    request_row.status,
    request_row.status,
    auth.uid(),
    p_assigned_to_user_id,
    'clinic',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'source', 'db_function'))
  );

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    request_row.organization_id,
    'user',
    auth.uid(),
    'data_request.assigned',
    'data_request',
    request_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'assigned');
end;
$$;

create or replace function public.transition_data_request_status(
  target_data_request_id uuid,
  target_status text,
  target_resolution_code text,
  target_assigned_to_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.data_requests%rowtype;
  event_name text;
  status_changed boolean;
  assignee_changed boolean;
  resolved_resolution_code text;
begin
  select * into request_row
  from public.data_requests
  where id = target_data_request_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(request_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(request_row.organization_id, 'data_request.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      request_row.organization_id,
      'user',
      auth.uid(),
      'data_request.status_changed',
      'data_request',
      request_row.id,
      'denied',
      public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'data_request.manage', 'source', 'db_function'))
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if target_status not in ('submitted', 'under_review', 'in_progress', 'completed', 'declined', 'cancelled') then
    return jsonb_build_object('error', 'invalid status');
  end if;

  status_changed := target_status is distinct from request_row.status;
  assignee_changed := target_assigned_to_user_id is not null
    and target_assigned_to_user_id is distinct from request_row.assigned_to_user_id;

  if not status_changed and not assignee_changed then
    return jsonb_build_object('status', request_row.status);
  end if;

  if status_changed and not public.phase8_data_request_transition_allowed(request_row.status, target_status) then
    return jsonb_build_object('error', 'invalid status transition');
  end if;

  if target_assigned_to_user_id is not null and not exists (
    select 1
    from public.organization_memberships
    where organization_id = request_row.organization_id
      and user_id = target_assigned_to_user_id
      and status = 'active'
  ) then
    return jsonb_build_object('error', 'invalid assignee');
  end if;

  if status_changed then
    resolved_resolution_code := coalesce(
      target_resolution_code,
      public.phase8_data_request_default_resolution_code(target_status)
    );

    if target_status in ('completed', 'declined', 'cancelled') then
      if resolved_resolution_code is null
        or not (resolved_resolution_code = any (public.phase8_data_request_allowed_resolution_codes())) then
        return jsonb_build_object('error', 'invalid resolution code');
      end if;
    else
      resolved_resolution_code := null;
    end if;
  end if;

  if assignee_changed then
    update public.data_requests
    set assigned_to_user_id = target_assigned_to_user_id,
        updated_at = now()
    where id = request_row.id;

    insert into public.data_request_events (
      organization_id,
      data_request_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      assignee_user_id,
      source,
      safe_metadata
    )
    values (
      request_row.organization_id,
      request_row.id,
      'assigned',
      request_row.status,
      request_row.status,
      auth.uid(),
      target_assigned_to_user_id,
      'clinic',
      public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'source', 'db_function'))
    );

    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      request_row.organization_id,
      'user',
      auth.uid(),
      'data_request.assigned',
      'data_request',
      request_row.id,
      'success',
      public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'source', 'db_function'))
    );
  end if;

  if status_changed then
    event_name := case
      when target_status = 'under_review' then 'review_started'
      when target_status = 'completed' then 'completed'
      when target_status = 'declined' then 'declined'
      when target_status = 'cancelled' then 'cancelled'
      else 'status_changed'
    end;

    update public.data_requests
    set status = target_status,
        assigned_to_user_id = coalesce(target_assigned_to_user_id, assigned_to_user_id),
        resolution_code = case
          when target_status in ('completed', 'declined', 'cancelled') then resolved_resolution_code
          else resolution_code
        end,
        completed_at = case when target_status in ('completed', 'declined', 'cancelled') then now() else null end,
        updated_at = now()
    where id = request_row.id;

    insert into public.data_request_events (
      organization_id,
      data_request_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      assignee_user_id,
      source,
      safe_metadata
    )
    values (
      request_row.organization_id,
      request_row.id,
      event_name,
      request_row.status,
      target_status,
      auth.uid(),
      null,
      'clinic',
      public.sanitize_audit_metadata(jsonb_build_object(
        'request_type', request_row.request_type,
        'previous_status', request_row.status,
        'new_status', target_status,
        'resolution_code', resolved_resolution_code,
        'source', 'db_function'
      ))
    );

    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (
      request_row.organization_id,
      'user',
      auth.uid(),
      'data_request.status_changed',
      'data_request',
      request_row.id,
      'success',
      public.sanitize_audit_metadata(jsonb_build_object(
        'request_type', request_row.request_type,
        'previous_status', request_row.status,
        'new_status', target_status,
        'resolution_code', resolved_resolution_code,
        'source', 'db_function'
      ))
    );
  end if;

  return jsonb_build_object('status', target_status);
end;
$$;

create or replace function public.record_client_document_event(
  target_assignment_id uuid,
  target_event_type text,
  target_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.client_document_assignments%rowtype;
  version_row public.consent_document_versions%rowtype;
  document_row public.consent_documents%rowtype;
begin
  select * into assignment_row
  from public.client_document_assignments
  where id = target_assignment_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(assignment_row.organization_id, 'consent.manage') then
    return jsonb_build_object('error', 'permission denied');
  end if;

  if assignment_row.status = 'cancelled' then
    return jsonb_build_object('error', 'assignment is cancelled');
  end if;

  if target_event_type not in ('presented', 'notice_acknowledged') then
    return jsonb_build_object('error', 'invalid event type');
  end if;

  if target_source is distinct from 'clinic' then
    return jsonb_build_object('error', 'invalid source');
  end if;

  select * into version_row
  from public.consent_document_versions
  where id = assignment_row.document_version_id;

  select * into document_row
  from public.consent_documents
  where id = version_row.consent_document_id;

  if document_row.document_kind = 'consent' and target_event_type = 'notice_acknowledged' then
    return jsonb_build_object('error', 'event incompatible with document kind');
  end if;

  if document_row.document_kind = 'notice' and target_event_type = 'presented' then
    null;
  elsif document_row.document_kind = 'notice' and target_event_type <> 'notice_acknowledged' then
    return jsonb_build_object('error', 'event incompatible with document kind');
  end if;

  insert into public.client_document_events (
    organization_id,
    assignment_id,
    client_id,
    document_version_id,
    event_type,
    source,
    actor_user_id,
    safe_metadata
  )
  values (
    assignment_row.organization_id,
    assignment_row.id,
    assignment_row.client_id,
    assignment_row.document_version_id,
    target_event_type,
    'clinic',
    auth.uid(),
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', 'clinic', 'version_number', version_row.version_number))
  );

  if target_event_type = 'notice_acknowledged' then
    update public.client_document_assignments
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where id = assignment_row.id;
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    assignment_row.organization_id,
    'user',
    auth.uid(),
    'consent.event_recorded',
    'client_document_assignment',
    assignment_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', 'clinic', 'version_number', version_row.version_number))
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

revoke all on function public.assign_data_request(uuid, uuid) from public;
grant execute on function public.assign_data_request(uuid, uuid) to authenticated;
