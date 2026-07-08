-- Phase 8.3A: Clinic Consent Management RPCs

create or replace function public.create_consent_document(
  p_organization_id uuid,
  p_code text,
  p_title text,
  p_document_kind text,
  p_purpose_key text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_document_id uuid;
begin
  if not public.current_user_has_permission(p_organization_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, result, safe_metadata)
    values (p_organization_id, 'user', auth.uid(), 'consent_document.created', 'consent_document', 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  insert into public.consent_documents (
    organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
  ) values (
    p_organization_id, p_code, p_title, p_document_kind, p_purpose_key, 'active', auth.uid()
  ) returning id into v_document_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (p_organization_id, 'user', auth.uid(), 'consent_document.created', 'consent_document', v_document_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('document_kind', p_document_kind, 'source', 'db_function')));

  return jsonb_build_object('status', 'success', 'document_id', v_document_id);
end;
$$;

create or replace function public.create_consent_document_draft_version(
  p_document_id uuid,
  p_title_snapshot text,
  p_summary_text text,
  p_body_text text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org_id uuid;
  v_version_id uuid;
  v_version_number integer;
begin
  select organization_id into v_org_id from public.consent_documents where id = p_document_id;

  if not public.current_user_has_permission(v_org_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, result, safe_metadata)
    values (v_org_id, 'user', auth.uid(), 'consent_version.created', 'consent_document_version', 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.consent_document_versions
  where consent_document_id = p_document_id;

  insert into public.consent_document_versions (
    organization_id, consent_document_id, version_number, status, title_snapshot, summary_text, body_text, created_by_user_id
  ) values (
    v_org_id, p_document_id, v_version_number, 'draft', p_title_snapshot, p_summary_text, p_body_text, auth.uid()
  ) returning id into v_version_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (v_org_id, 'user', auth.uid(), 'consent_version.created', 'consent_document_version', v_version_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('version_number', v_version_number, 'source', 'db_function')));

  return jsonb_build_object('status', 'success', 'version_id', v_version_id);
end;
$$;

create or replace function public.update_consent_document_draft_version(
  p_version_id uuid,
  p_title_snapshot text,
  p_summary_text text,
  p_body_text text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_version_row public.consent_document_versions%rowtype;
begin
  select * into v_version_row
  from public.consent_document_versions
  where id = p_version_id for update;

  if not found then return jsonb_build_object('error', 'not found'); end if;

  if not public.current_user_has_permission(v_version_row.organization_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, result, safe_metadata)
    values (v_version_row.organization_id, 'user', auth.uid(), 'consent_version.updated', 'consent_document_version', 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
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
  values (v_version_row.organization_id, 'user', auth.uid(), 'consent_version.updated', 'consent_document_version', p_version_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function')));

  return jsonb_build_object('status', 'success', 'version_id', p_version_id);
end;
$$;

create or replace function public.create_draft_from_published_consent_version(
  p_published_version_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_source_row public.consent_document_versions%rowtype;
  v_new_version_id uuid;
  v_new_version_number integer;
begin
  select * into v_source_row from public.consent_document_versions where id = p_published_version_id;

  if not found then return jsonb_build_object('error', 'not found'); end if;

  if not public.current_user_has_permission(v_source_row.organization_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, result, safe_metadata)
    values (v_source_row.organization_id, 'user', auth.uid(), 'consent_version.created', 'consent_document_version', 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  if v_source_row.status <> 'published' and v_source_row.status <> 'retired' then
    return jsonb_build_object('error', 'source version must be published or retired');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_new_version_number
  from public.consent_document_versions
  where consent_document_id = v_source_row.consent_document_id;

  insert into public.consent_document_versions (
    organization_id, consent_document_id, version_number, status, title_snapshot, summary_text, body_text, created_by_user_id
  ) values (
    v_source_row.organization_id, v_source_row.consent_document_id, v_new_version_number, 'draft', v_source_row.title_snapshot, v_source_row.summary_text, v_source_row.body_text, auth.uid()
  ) returning id into v_new_version_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (v_source_row.organization_id, 'user', auth.uid(), 'consent_version.created', 'consent_document_version', v_new_version_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('version_number', v_new_version_number, 'source', 'db_function', 'base_version_id', p_published_version_id)));

  return jsonb_build_object('status', 'success', 'version_id', v_new_version_id);
end;
$$;

create or replace function public.archive_consent_document(
  p_document_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.consent_documents where id = p_document_id;

  if not found then return jsonb_build_object('error', 'not found'); end if;

  if not public.current_user_has_permission(v_org_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, result, safe_metadata)
    values (v_org_id, 'user', auth.uid(), 'consent_document.archived', 'consent_document', 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  update public.consent_documents
  set status = 'archived',
      updated_at = now()
  where id = p_document_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (v_org_id, 'user', auth.uid(), 'consent_document.archived', 'consent_document', p_document_id, 'success', public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function')));

  return jsonb_build_object('status', 'success', 'document_id', p_document_id);
end;
$$;

revoke all on function public.create_consent_document(uuid, text, text, text, text) from public;
revoke all on function public.create_consent_document_draft_version(uuid, text, text, text) from public;
revoke all on function public.update_consent_document_draft_version(uuid, text, text, text) from public;
revoke all on function public.create_draft_from_published_consent_version(uuid) from public;
revoke all on function public.archive_consent_document(uuid) from public;

grant execute on function public.create_consent_document(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_consent_document_draft_version(uuid, text, text, text) to authenticated;
grant execute on function public.update_consent_document_draft_version(uuid, text, text, text) to authenticated;
grant execute on function public.create_draft_from_published_consent_version(uuid) to authenticated;
grant execute on function public.archive_consent_document(uuid) to authenticated;
