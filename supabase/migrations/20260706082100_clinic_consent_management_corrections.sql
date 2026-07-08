-- Phase 8.3A corrections: audit allowlist, tenant-safe denied auditing, concurrency, one-active-draft

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
    'consent.event_recorded',
    'data_request.created',
    'data_request.status_changed',
    'data_request.assigned'
  )
);

create unique index if not exists consent_document_one_active_draft
on public.consent_document_versions (consent_document_id)
where status = 'draft';

create or replace function public.write_consent_manage_denied_audit(
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
    public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function'))
  );
end;
$$;

revoke all on function public.write_consent_manage_denied_audit(uuid, text, text, uuid) from public;

create or replace function public.create_consent_document(
  p_organization_id uuid,
  p_code text,
  p_title text,
  p_document_kind text,
  p_purpose_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_id uuid;
begin
  if not public.current_user_has_active_membership(p_organization_id) then
    return jsonb_build_object('error', 'permission denied');
  end if;

  if not public.current_user_has_permission(p_organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      p_organization_id,
      'consent_document.created',
      'consent_document',
      null
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  insert into public.consent_documents (
    organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
  ) values (
    p_organization_id, p_code, p_title, p_document_kind, p_purpose_key, 'active', auth.uid()
  ) returning id into v_document_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    p_organization_id,
    'user',
    auth.uid(),
    'consent_document.created',
    'consent_document',
    v_document_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('document_kind', p_document_kind, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'success', 'document_id', v_document_id);
end;
$$;

create or replace function public.create_consent_document_draft_version(
  p_document_id uuid,
  p_title_snapshot text,
  p_summary_text text,
  p_body_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_row public.consent_documents%rowtype;
  v_version_id uuid;
  v_version_number integer;
begin
  select * into v_document_row
  from public.consent_documents
  where id = p_document_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_document_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_document_row.status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if not public.current_user_has_permission(v_document_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_document_row.organization_id,
      'consent_version.created',
      'consent_document_version',
      null
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if exists (
    select 1
    from public.consent_document_versions
    where consent_document_id = p_document_id
      and status = 'draft'
  ) then
    return jsonb_build_object('error', 'draft already exists');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.consent_document_versions
  where consent_document_id = p_document_id;

  begin
    insert into public.consent_document_versions (
      organization_id, consent_document_id, version_number, status, title_snapshot, summary_text, body_text, created_by_user_id
    ) values (
      v_document_row.organization_id,
      p_document_id,
      v_version_number,
      'draft',
      p_title_snapshot,
      p_summary_text,
      p_body_text,
      auth.uid()
    ) returning id into v_version_id;
  exception
    when unique_violation then
      return jsonb_build_object('error', 'version conflict');
  end;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_document_row.organization_id,
    'user',
    auth.uid(),
    'consent_version.created',
    'consent_document_version',
    v_version_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('version_number', v_version_number, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'success', 'version_id', v_version_id);
end;
$$;

create or replace function public.update_consent_document_draft_version(
  p_version_id uuid,
  p_title_snapshot text,
  p_summary_text text,
  p_body_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_row public.consent_document_versions%rowtype;
  v_document_status text;
begin
  select * into v_version_row
  from public.consent_document_versions
  where id = p_version_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  select status into v_document_status
  from public.consent_documents
  where id = v_version_row.consent_document_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_version_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_document_status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if not public.current_user_has_permission(v_version_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_version_row.organization_id,
      'consent_version.updated',
      'consent_document_version',
      p_version_id
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if v_version_row.status <> 'draft' then
    return jsonb_build_object('error', 'version is not draft');
  end if;

  update public.consent_document_versions
  set title_snapshot = p_title_snapshot,
      summary_text = p_summary_text,
      body_text = p_body_text,
      updated_at = now()
  where id = p_version_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_version_row.organization_id,
    'user',
    auth.uid(),
    'consent_version.updated',
    'consent_document_version',
    p_version_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function'))
  );

  return jsonb_build_object('status', 'success', 'version_id', p_version_id);
end;
$$;

create or replace function public.create_draft_from_published_consent_version(
  p_published_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_row public.consent_document_versions%rowtype;
  v_document_row public.consent_documents%rowtype;
  v_new_version_id uuid;
  v_new_version_number integer;
begin
  select * into v_source_row
  from public.consent_document_versions
  where id = p_published_version_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  select * into v_document_row
  from public.consent_documents
  where id = v_source_row.consent_document_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_document_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_document_row.status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if not public.current_user_has_permission(v_document_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_document_row.organization_id,
      'consent_version.created',
      'consent_document_version',
      null
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if v_source_row.status <> 'published' and v_source_row.status <> 'retired' then
    return jsonb_build_object('error', 'source version must be published or retired');
  end if;

  if exists (
    select 1
    from public.consent_document_versions
    where consent_document_id = v_source_row.consent_document_id
      and status = 'draft'
  ) then
    return jsonb_build_object('error', 'draft already exists');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_new_version_number
  from public.consent_document_versions
  where consent_document_id = v_source_row.consent_document_id;

  begin
    insert into public.consent_document_versions (
      organization_id, consent_document_id, version_number, status, title_snapshot, summary_text, body_text, created_by_user_id
    ) values (
      v_document_row.organization_id,
      v_source_row.consent_document_id,
      v_new_version_number,
      'draft',
      v_source_row.title_snapshot,
      v_source_row.summary_text,
      v_source_row.body_text,
      auth.uid()
    ) returning id into v_new_version_id;
  exception
    when unique_violation then
      return jsonb_build_object('error', 'version conflict');
  end;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_document_row.organization_id,
    'user',
    auth.uid(),
    'consent_version.created',
    'consent_document_version',
    v_new_version_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('version_number', v_new_version_number, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'success', 'version_id', v_new_version_id);
end;
$$;

create or replace function public.archive_consent_document(
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_row public.consent_documents%rowtype;
begin
  select * into v_document_row
  from public.consent_documents
  where id = p_document_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(v_document_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if v_document_row.status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if not public.current_user_has_permission(v_document_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      v_document_row.organization_id,
      'consent_document.archived',
      'consent_document',
      p_document_id
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  update public.consent_documents
  set status = 'archived',
      updated_at = now()
  where id = p_document_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    v_document_row.organization_id,
    'user',
    auth.uid(),
    'consent_document.archived',
    'consent_document',
    p_document_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function'))
  );

  return jsonb_build_object('status', 'success', 'document_id', p_document_id);
end;
$$;

create or replace function public.publish_consent_document_version(target_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  version_row public.consent_document_versions%rowtype;
  document_status text;
begin
  select * into version_row
  from public.consent_document_versions
  where id = target_version_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  select status into document_status
  from public.consent_documents
  where id = version_row.consent_document_id;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_active_membership(version_row.organization_id) then
    return jsonb_build_object('error', 'not found');
  end if;

  if document_status = 'archived' then
    return jsonb_build_object('error', 'document is archived');
  end if;

  if not public.current_user_has_permission(version_row.organization_id, 'consent.manage') then
    perform public.write_consent_manage_denied_audit(
      version_row.organization_id,
      'consent_version.published',
      'consent_document_version',
      version_row.id
    );
    return jsonb_build_object('error', 'permission denied');
  end if;

  if version_row.status <> 'draft' then
    return jsonb_build_object('error', 'version is not draft');
  end if;

  if length(btrim(version_row.body_text)) < 20 or length(btrim(version_row.title_snapshot)) < 2 then
    return jsonb_build_object('error', 'content is required');
  end if;

  update public.consent_document_versions
  set status = 'published',
      published_at = now(),
      published_by_user_id = auth.uid(),
      updated_at = now()
  where id = version_row.id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    version_row.organization_id,
    'user',
    auth.uid(),
    'consent_version.published',
    'consent_document_version',
    version_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('version_number', version_row.version_number, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'published', 'version_id', version_row.id);
end;
$$;

revoke all on function public.create_consent_document(uuid, text, text, text, text) from public;
revoke all on function public.create_consent_document_draft_version(uuid, text, text, text) from public;
revoke all on function public.update_consent_document_draft_version(uuid, text, text, text) from public;
revoke all on function public.create_draft_from_published_consent_version(uuid) from public;
revoke all on function public.archive_consent_document(uuid) from public;
revoke all on function public.publish_consent_document_version(uuid) from public;

grant execute on function public.create_consent_document(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_consent_document_draft_version(uuid, text, text, text) to authenticated;
grant execute on function public.update_consent_document_draft_version(uuid, text, text, text) to authenticated;
grant execute on function public.create_draft_from_published_consent_version(uuid) to authenticated;
grant execute on function public.archive_consent_document(uuid) to authenticated;
grant execute on function public.publish_consent_document_version(uuid) to authenticated;
