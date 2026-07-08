create or replace function public.phase8_current_document_decision(target_assignment_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select case
        when bool_or(event_type = 'consent_withdrawn') then 'withdrawn'
        when bool_or(event_type = 'consent_accepted') then 'accepted'
        when bool_or(event_type = 'consent_declined') then 'declined'
        when bool_or(event_type = 'notice_acknowledged') then 'acknowledged'
        else 'not_recorded'
      end
      from public.client_document_events
      where assignment_id = target_assignment_id
    ),
    'not_recorded'
  );
$$;

create or replace function public.phase8_validate_portal_session(target_session_hash text)
returns table (
  organization_id uuid,
  client_id uuid,
  care_plan_id uuid,
  portal_session_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ps.organization_id, cp.client_id, ps.care_plan_id, ps.id
  from public.portal_sessions ps
  join public.secure_links sl
    on sl.id = ps.secure_link_id
   and sl.organization_id = ps.organization_id
   and sl.care_plan_id = ps.care_plan_id
  join public.care_plans cp
    on cp.id = ps.care_plan_id
   and cp.organization_id = ps.organization_id
  where ps.session_hash = target_session_hash
    and ps.status = 'active'
    and ps.expires_at > now()
    and sl.status = 'active'
    and sl.expires_at > now()
    and cp.status in ('scheduled', 'active', 'completed')
  limit 1;
$$;

create or replace function public.get_portal_document_assignments(target_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
begin
  select * into session_row
  from public.phase8_validate_portal_session(target_session_hash);

  if not found then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'assignment_id', a.id,
          'document_kind', d.document_kind,
          'document_code', d.code,
          'title', v.title_snapshot,
          'summary_text', v.summary_text,
          'body_text', v.body_text,
          'version_number', v.version_number,
          'effective_from', v.effective_from,
          'required', a.required,
          'assignment_status', a.status,
          'current_decision', public.phase8_current_document_decision(a.id),
          'completed_at', a.completed_at
        )
        order by a.assigned_at asc, v.version_number asc
      )
      from public.client_document_assignments a
      join public.consent_document_versions v
        on v.id = a.document_version_id
       and v.organization_id = a.organization_id
      join public.consent_documents d
        on d.id = v.consent_document_id
       and d.organization_id = v.organization_id
      where a.organization_id = session_row.organization_id
        and a.client_id = session_row.client_id
        and (a.care_plan_id is null or a.care_plan_id = session_row.care_plan_id)
        and a.status in ('pending', 'completed')
        and v.status = 'published'
        and d.status = 'active'
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.record_portal_document_event(
  target_session_hash text,
  target_assignment_id uuid,
  target_event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
  assignment_row public.client_document_assignments%rowtype;
  version_row public.consent_document_versions%rowtype;
  document_row public.consent_documents%rowtype;
  current_decision text;
  next_decision text;
begin
  select * into session_row
  from public.phase8_validate_portal_session(target_session_hash);

  if not found then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  select * into assignment_row
  from public.client_document_assignments
  where id = target_assignment_id
    and organization_id = session_row.organization_id
    and client_id = session_row.client_id
    and (care_plan_id is null or care_plan_id = session_row.care_plan_id)
    and status in ('pending', 'completed')
  for update;

  if not found then
    return jsonb_build_object('error', 'assignment not found');
  end if;

  select * into version_row
  from public.consent_document_versions
  where id = assignment_row.document_version_id
    and organization_id = assignment_row.organization_id
    and status = 'published';

  if not found then
    return jsonb_build_object('error', 'document version not available');
  end if;

  select * into document_row
  from public.consent_documents
  where id = version_row.consent_document_id
    and organization_id = version_row.organization_id
    and status = 'active';

  if not found then
    return jsonb_build_object('error', 'document not available');
  end if;

  current_decision := public.phase8_current_document_decision(assignment_row.id);

  if document_row.document_kind = 'notice' then
    if target_event_type <> 'notice_acknowledged' then
      return jsonb_build_object('error', 'invalid document event');
    end if;
    next_decision := 'acknowledged';
  elsif document_row.document_kind = 'consent' then
    if target_event_type not in ('consent_accepted', 'consent_declined', 'consent_withdrawn') then
      return jsonb_build_object('error', 'invalid document event');
    end if;
    if target_event_type = 'consent_accepted' and current_decision not in ('not_recorded', 'accepted') then
      return jsonb_build_object('error', 'invalid document transition');
    end if;
    if target_event_type = 'consent_declined' and current_decision not in ('not_recorded', 'declined') then
      return jsonb_build_object('error', 'invalid document transition');
    end if;
    if target_event_type = 'consent_withdrawn' and current_decision not in ('accepted', 'withdrawn') then
      return jsonb_build_object('error', 'invalid document transition');
    end if;
    next_decision := case target_event_type
      when 'consent_accepted' then 'accepted'
      when 'consent_declined' then 'declined'
      else 'withdrawn'
    end;
  end if;

  if current_decision = next_decision then
    return jsonb_build_object('status', 'already_recorded', 'current_decision', current_decision);
  end if;

  insert into public.client_document_events (
    organization_id,
    assignment_id,
    client_id,
    document_version_id,
    event_type,
    source,
    portal_session_id,
    safe_metadata
  )
  values (
    assignment_row.organization_id,
    assignment_row.id,
    assignment_row.client_id,
    assignment_row.document_version_id,
    target_event_type,
    'portal',
    session_row.portal_session_id,
    public.sanitize_audit_metadata(jsonb_build_object('document_kind', document_row.document_kind, 'event_type', target_event_type, 'version_number', version_row.version_number, 'source', 'portal'))
  );

  if target_event_type in ('notice_acknowledged', 'consent_accepted', 'consent_declined', 'consent_withdrawn') then
    update public.client_document_assignments
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where id = assignment_row.id;
  end if;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    assignment_row.organization_id,
    'system',
    'consent.event_recorded',
    'client_document_assignment',
    assignment_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('document_kind', document_row.document_kind, 'event_type', target_event_type, 'version_number', version_row.version_number, 'source', 'portal', 'result', 'success'))
  );

  return jsonb_build_object('status', 'recorded', 'current_decision', next_decision);
end;
$$;

create or replace function public.submit_portal_data_request(
  target_session_hash text,
  target_request_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
  existing_row public.data_requests%rowtype;
  new_request_id uuid;
begin
  select * into session_row
  from public.phase8_validate_portal_session(target_session_hash);

  if not found then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  if target_request_type not in ('access', 'copy', 'correction', 'deletion', 'restriction', 'objection', 'withdraw_consent', 'other') then
    return jsonb_build_object('error', 'invalid request type');
  end if;

  select * into existing_row
  from public.data_requests
  where organization_id = session_row.organization_id
    and client_id = session_row.client_id
    and care_plan_id is not distinct from session_row.care_plan_id
    and request_type = target_request_type
    and submitted_source = 'portal'
    and submitted_at > now() - interval '1 hour'
  order by submitted_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'already_submitted',
      'request', jsonb_build_object('id', existing_row.id, 'request_type', existing_row.request_type, 'status', existing_row.status, 'submitted_at', existing_row.submitted_at)
    );
  end if;

  insert into public.data_requests (
    organization_id,
    client_id,
    care_plan_id,
    request_type,
    status,
    submitted_source,
    submitted_at
  )
  values (
    session_row.organization_id,
    session_row.client_id,
    session_row.care_plan_id,
    target_request_type,
    'submitted',
    'portal',
    now()
  )
  returning id into new_request_id;

  insert into public.data_request_events (
    organization_id,
    data_request_id,
    event_type,
    from_status,
    to_status,
    source,
    safe_metadata
  )
  values (
    session_row.organization_id,
    new_request_id,
    'submitted',
    null,
    'submitted',
    'portal',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', target_request_type, 'new_status', 'submitted', 'source', 'portal'))
  );

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    session_row.organization_id,
    'system',
    'data_request.created',
    'data_request',
    new_request_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', target_request_type, 'new_status', 'submitted', 'source', 'portal', 'result', 'success'))
  );

  return jsonb_build_object(
    'status', 'submitted',
    'request', jsonb_build_object('id', new_request_id, 'request_type', target_request_type, 'status', 'submitted', 'submitted_at', now())
  );
end;
$$;

create or replace function public.get_portal_data_requests(target_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
begin
  select * into session_row
  from public.phase8_validate_portal_session(target_session_hash);

  if not found then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'request_type', request_type,
          'status', status,
          'submitted_at', submitted_at
        )
        order by submitted_at desc
      )
      from public.data_requests
      where organization_id = session_row.organization_id
        and client_id = session_row.client_id
        and (care_plan_id is null or care_plan_id = session_row.care_plan_id)
        and submitted_source = 'portal'
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.phase8_validate_portal_session(text) from public;
revoke all on function public.get_portal_document_assignments(text) from public;
revoke all on function public.record_portal_document_event(text, uuid, text) from public;
revoke all on function public.submit_portal_data_request(text, text) from public;
revoke all on function public.get_portal_data_requests(text) from public;

grant execute on function public.get_portal_document_assignments(text) to anon, authenticated;
grant execute on function public.record_portal_document_event(text, uuid, text) to anon, authenticated;
grant execute on function public.submit_portal_data_request(text, text) to anon, authenticated;
grant execute on function public.get_portal_data_requests(text) to anon, authenticated;
