-- Phase 8.3B: clinic assignment RPCs, DML hardening, data request assignee events

alter table public.client_document_assignments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id uuid;

alter table public.client_document_assignments drop constraint if exists client_doc_assignments_completion_fields;
alter table public.client_document_assignments add constraint client_doc_assignments_completion_fields check (
  (status = 'completed' and completed_at is not null and cancelled_at is null and cancelled_by_user_id is null)
  or
  (status = 'cancelled' and cancelled_at is not null and cancelled_by_user_id is not null and completed_at is null)
  or
  (status = 'pending' and completed_at is null and cancelled_at is null and cancelled_by_user_id is null)
);

alter table public.client_document_assignments drop constraint if exists client_doc_assignments_cancelled_by_same_org_fk;
alter table public.client_document_assignments add constraint client_doc_assignments_cancelled_by_same_org_fk
  foreign key (organization_id, cancelled_by_user_id)
  references public.organization_memberships (organization_id, user_id);

create unique index if not exists client_doc_assignments_pending_global_unique
on public.client_document_assignments (organization_id, client_id, document_version_id)
where status = 'pending' and care_plan_id is null;

create unique index if not exists client_doc_assignments_pending_plan_unique
on public.client_document_assignments (organization_id, client_id, care_plan_id, document_version_id)
where status = 'pending' and care_plan_id is not null;

alter table public.data_request_events
  add column if not exists assignee_user_id uuid;

alter table public.data_request_events drop constraint if exists data_request_events_assignee_same_org_fk;
alter table public.data_request_events add constraint data_request_events_assignee_same_org_fk
  foreign key (organization_id, assignee_user_id)
  references public.organization_memberships (organization_id, user_id);

alter table public.data_request_events drop constraint if exists data_request_events_assigned_requires_assignee;
alter table public.data_request_events add constraint data_request_events_assigned_requires_assignee check (
  (event_type = 'assigned' and assignee_user_id is not null)
  or (event_type <> 'assigned')
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
    'alert.status_change_denied',
    'photo_request.created',
    'photo_request.cancelled',
    'photo_upload_intent.created',
    'photo.uploaded',
    'photo.upload_denied',
    'photo.view_access_granted',
    'photo.view_denied',
    'photo.view_authorized',
    'photo.cleanup_completed',
    'photo.cleanup_failed',
    'consent_document.created',
    'consent_document.archived',
    'consent_version.created',
    'consent_version.updated',
    'consent_version.published',
    'consent_assignment.created',
    'consent_assignment.cancelled',
    'consent.event_recorded',
    'data_request.created',
    'data_request.status_changed',
    'data_request.assigned'
  )
);

revoke insert, update on public.client_document_assignments from authenticated;

create or replace function public.create_client_document_assignment(
  p_client_id uuid,
  p_document_version_id uuid,
  p_required boolean default true,
  p_care_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_version_row public.consent_document_versions%rowtype;
  v_document_row public.consent_documents%rowtype;
  v_assignment_id uuid;
  v_assignment_type text;
begin
  select organization_id into v_org_id
  from public.clients
  where id = p_client_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_org_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(v_org_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_org_id,
      'consent_assignment.created',
      'client_document_assignment',
      null
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if p_care_plan_id is not null and not exists (
    select 1
    from public.care_plans cp
    where cp.organization_id = v_org_id
      and cp.id = p_care_plan_id
      and cp.client_id = p_client_id
  ) then
    return jsonb_build_object('error', 'invalid care plan');
  end if;

  select v.* into v_version_row
  from public.consent_document_versions v
  where v.id = p_document_version_id
    and v.organization_id = v_org_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_version_row.status <> 'published' then
    return jsonb_build_object('error', 'document version is not published');
  end if;

  select d.* into v_document_row
  from public.consent_documents d
  where d.id = v_version_row.consent_document_id
    and d.organization_id = v_org_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_document_row.status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if v_document_row.status <> 'active' then
    return jsonb_build_object('error', 'not found');
  end if;

  if exists (
    select 1
    from public.client_document_assignments a
    join public.consent_document_versions av
      on av.id = a.document_version_id
     and av.organization_id = a.organization_id
    where a.organization_id = v_org_id
      and a.client_id = p_client_id
      and a.status = 'pending'
      and av.consent_document_id = v_document_row.id
      and (
        (p_care_plan_id is not null and a.care_plan_id = p_care_plan_id)
        or (p_care_plan_id is null and a.care_plan_id is null)
        or (p_care_plan_id is null and a.care_plan_id is not null)
        or (p_care_plan_id is not null and a.care_plan_id is null)
      )
  ) then
    return jsonb_build_object('error', 'assignment already exists');
  end if;

  v_assignment_type := v_document_row.document_kind;

  insert into public.client_document_assignments (
    organization_id,
    client_id,
    care_plan_id,
    document_version_id,
    assignment_type,
    required,
    status,
    assigned_by_user_id
  )
  values (
    v_org_id,
    p_client_id,
    p_care_plan_id,
    p_document_version_id,
    v_assignment_type,
    coalesce(p_required, true),
    'pending',
    auth.uid()
  )
  returning id into v_assignment_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_org_id,
    'user',
    auth.uid(),
    'consent_assignment.created',
    'client_document_assignment',
    v_assignment_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object(
      'document_kind', v_document_row.document_kind,
      'required', coalesce(p_required, true),
      'version_number', v_version_row.version_number,
      'source', 'db_function'
    ))
  );

  return jsonb_build_object('status', 'created', 'assignment_id', v_assignment_id);
exception
  when unique_violation then
    return jsonb_build_object('error', 'assignment already exists');
end;
$$;

create or replace function public.cancel_client_document_assignment(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment_row public.client_document_assignments%rowtype;
begin
  select * into v_assignment_row
  from public.client_document_assignments
  where id = p_assignment_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_assignment_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(v_assignment_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_assignment_row.organization_id,
      'consent_assignment.cancelled',
      'client_document_assignment',
      v_assignment_row.id
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if v_assignment_row.status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'assignment_id', v_assignment_row.id);
  end if;

  if v_assignment_row.status = 'completed' then
    return jsonb_build_object('error', 'assignment already completed');
  end if;

  if v_assignment_row.status <> 'pending' then
    return jsonb_build_object('error', 'assignment is not pending');
  end if;

  update public.client_document_assignments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_user_id = auth.uid()
  where id = v_assignment_row.id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_assignment_row.organization_id,
    'user',
    auth.uid(),
    'consent_assignment.cancelled',
    'client_document_assignment',
    v_assignment_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function'))
  );

  return jsonb_build_object('status', 'cancelled', 'assignment_id', v_assignment_row.id);
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

  if target_source not in ('clinic', 'portal', 'system') then
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
    target_source,
    auth.uid(),
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', target_source, 'version_number', version_row.version_number))
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
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', target_source, 'version_number', version_row.version_number))
  );

  return jsonb_build_object('status', 'recorded');
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
begin
  select * into request_row
  from public.data_requests
  where id = target_data_request_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(request_row.organization_id, 'data_request.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (request_row.organization_id, 'user', auth.uid(), 'data_request.status_changed', 'data_request', request_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'data_request.manage', 'source', 'db_function')));
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
    select 1 from public.organization_memberships
    where organization_id = request_row.organization_id
      and user_id = target_assigned_to_user_id
      and status = 'active'
  ) then
    return jsonb_build_object('error', 'invalid assignee');
  end if;

  if status_changed and target_resolution_code is not null and target_resolution_code not in ('completed_without_export', 'manual_review_completed', 'unsupported_request', 'duplicate_request', 'cancelled_by_client', 'other_internal') then
    return jsonb_build_object('error', 'invalid resolution code');
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
        resolution_code = case when target_status in ('completed', 'declined', 'cancelled') then target_resolution_code else resolution_code end,
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
      public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'previous_status', request_row.status, 'new_status', target_status, 'resolution_code', target_resolution_code, 'source', 'db_function'))
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
      public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'previous_status', request_row.status, 'new_status', target_status, 'resolution_code', target_resolution_code, 'source', 'db_function'))
    );
  end if;

  return jsonb_build_object('status', target_status);
end;
$$;

revoke all on function public.create_client_document_assignment(uuid, uuid, boolean, uuid) from public;
revoke all on function public.cancel_client_document_assignment(uuid) from public;
grant execute on function public.create_client_document_assignment(uuid, uuid, boolean, uuid) to authenticated;
grant execute on function public.cancel_client_document_assignment(uuid) to authenticated;
