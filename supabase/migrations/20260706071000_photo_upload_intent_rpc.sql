create or replace function public.create_photo_upload_intent_for_portal(
  target_session_hash text,
  target_photo_request_id uuid,
  target_declared_mime_type text,
  target_declared_size_bytes integer,
  target_incoming_object_key text,
  target_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
  session_row public.portal_sessions%rowtype;
  request_row public.photo_requests%rowtype;
  plan_row public.care_plans%rowtype;
  new_intent_id uuid;
  recent_intent_count integer;
begin
  if target_declared_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    return jsonb_build_object('error', 'unsupported_mime_type');
  end if;

  if target_declared_size_bytes < 1 or target_declared_size_bytes > 5242880 then
    return jsonb_build_object('error', 'file_too_large');
  end if;

  if target_expires_at <= now() or target_expires_at > now() + interval '10 minutes' then
    return jsonb_build_object('error', 'request_invalid');
  end if;

  if target_incoming_object_key !~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('error', 'request_invalid');
  end if;

  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return jsonb_build_object('error', 'request_invalid');
  end if;

  select * into session_row
  from public.portal_sessions
  where id = session_id;

  select * into request_row
  from public.photo_requests
  where id = target_photo_request_id
    and organization_id = session_row.organization_id
    and care_plan_id = session_row.care_plan_id;

  if not found or request_row.status <> 'active' then
    return jsonb_build_object('error', 'request_invalid');
  end if;

  select * into plan_row
  from public.care_plans
  where id = session_row.care_plan_id
    and organization_id = session_row.organization_id;

  if not found or plan_row.status in ('stopped', 'completed') then
    return jsonb_build_object('error', 'request_invalid');
  end if;

  if exists (
    select 1
    from public.photo_records
    where organization_id = request_row.organization_id
      and photo_request_id = request_row.id
  ) then
    return jsonb_build_object('error', 'already_finalized');
  end if;

  select count(*)::integer into recent_intent_count
  from public.photo_upload_intents
  where photo_request_id = request_row.id
    and portal_session_id = session_row.id
    and created_at >= now() - interval '1 hour';

  if recent_intent_count >= 3 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  if exists (
    select 1
    from public.photo_upload_intents
    where photo_request_id = request_row.id
      and portal_session_id = session_row.id
      and status = 'processing'
      and processing_started_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('error', 'intent_processing');
  end if;

  update public.photo_upload_intents
  set status = 'expired'
  where photo_request_id = request_row.id
    and portal_session_id = session_row.id
    and status = 'pending';

  update public.photo_upload_intents
  set status = 'expired'
  where photo_request_id = request_row.id
    and portal_session_id = session_row.id
    and status = 'processing'
    and processing_started_at <= now() - interval '10 minutes';

  insert into public.photo_upload_intents (
    organization_id,
    photo_request_id,
    care_plan_id,
    care_plan_day_id,
    portal_session_id,
    incoming_object_key,
    declared_mime_type,
    declared_size_bytes,
    expires_at
  )
  values (
    request_row.organization_id,
    request_row.id,
    request_row.care_plan_id,
    request_row.care_plan_day_id,
    session_row.id,
    target_incoming_object_key,
    target_declared_mime_type,
    target_declared_size_bytes,
    target_expires_at
  )
  returning id into new_intent_id;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    request_row.organization_id,
    'system',
    'photo_upload_intent.created',
    'photo_upload_intent',
    new_intent_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'portal_rpc', 'mime_type', target_declared_mime_type, 'size_bytes', target_declared_size_bytes))
  );

  return jsonb_build_object(
    'status', 'created',
    'intent_id', new_intent_id,
    'incoming_object_key', target_incoming_object_key,
    'expires_at', target_expires_at
  );
end;
$$;

revoke all on function public.create_photo_upload_intent_for_portal(text, uuid, text, integer, text, timestamptz) from public;
grant execute on function public.create_photo_upload_intent_for_portal(text, uuid, text, integer, text, timestamptz) to service_role;

revoke all on function public.claim_photo_upload_intent_for_portal(text, uuid) from public;
revoke all on function public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text) from public;
grant execute on function public.claim_photo_upload_intent_for_portal(text, uuid) to service_role;
grant execute on function public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text) to service_role;
