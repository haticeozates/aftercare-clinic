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
    'photo.view_denied'
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
        'result_reason_code',
        'rotated',
        'event_type',
        'day_number',
        'required',
        'selected_option_count',
        'alert_count',
        'resolution_code',
        'mime_type',
        'size_bytes',
        'width',
        'height',
        'retry',
        'idempotent_result'
      )
    ),
    '{}'::jsonb
  );
$$;

alter table public.photo_upload_intents
drop constraint photo_upload_intents_status_check;

alter table public.photo_upload_intents
add constraint photo_upload_intents_status_check check (status in ('pending', 'processing', 'consumed', 'expired', 'failed'));

alter table public.photo_upload_intents
drop constraint photo_upload_intents_status_fields_valid;

alter table public.photo_upload_intents
add column processing_started_at timestamptz,
add column processing_claim_id uuid,
add column failed_at timestamptz,
add column failure_reason_code text check (
  failure_reason_code is null or failure_reason_code in (
    'incoming_missing',
    'decode_failed',
    'storage_write_failed',
    'db_finalize_failed',
    'request_invalid',
    'intent_expired'
  )
);

alter table public.photo_upload_intents
add constraint photo_upload_intents_status_fields_valid check (
  (status = 'pending' and consumed_at is null and processing_started_at is null and processing_claim_id is null and failed_at is null and failure_reason_code is null)
  or
  (status = 'processing' and consumed_at is null and processing_started_at is not null and processing_claim_id is not null and failed_at is null and failure_reason_code is null)
  or
  (status = 'consumed' and consumed_at is not null and processing_started_at is not null and processing_claim_id is not null and failed_at is null and failure_reason_code is null)
  or
  (status = 'expired' and consumed_at is null and failed_at is null)
  or
  (status = 'failed' and consumed_at is null and failed_at is not null and failure_reason_code is not null)
);

drop trigger photo_upload_intents_enforce_update_rules on public.photo_upload_intents;

create or replace function public.enforce_photo_upload_intent_update_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'photo upload intents cannot be deleted'
      using errcode = '42501';
  end if;

  if old.status in ('consumed', 'expired', 'failed') then
    raise exception 'photo upload intent is already closed'
      using errcode = '42501';
  end if;

  if new.organization_id <> old.organization_id
    or new.photo_request_id <> old.photo_request_id
    or new.care_plan_id <> old.care_plan_id
    or new.care_plan_day_id <> old.care_plan_day_id
    or new.portal_session_id <> old.portal_session_id
    or new.incoming_bucket_id <> old.incoming_bucket_id
    or new.incoming_object_key <> old.incoming_object_key
    or new.declared_mime_type <> old.declared_mime_type
    or new.declared_size_bytes <> old.declared_size_bytes
    or new.expires_at <> old.expires_at
    or new.created_at <> old.created_at then
    raise exception 'photo upload intent scope is immutable'
      using errcode = '42501';
  end if;

  if old.status = 'pending' and new.status not in ('pending', 'processing', 'expired', 'failed') then
    raise exception 'unsupported photo upload intent transition'
      using errcode = '42501';
  end if;

  if old.status = 'processing' and new.status not in ('processing', 'consumed', 'expired', 'failed') then
    raise exception 'unsupported photo upload intent transition'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger photo_upload_intents_enforce_update_rules
before update or delete on public.photo_upload_intents
for each row execute function public.enforce_photo_upload_intent_update_rules();

create or replace function public.claim_photo_upload_intent_for_portal(
  target_session_hash text,
  target_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
  session_row public.portal_sessions%rowtype;
  intent_row public.photo_upload_intents%rowtype;
  request_row public.photo_requests%rowtype;
  plan_row public.care_plans%rowtype;
  next_claim_id uuid;
  existing_record_id uuid;
begin
  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  select * into session_row from public.portal_sessions where id = session_id;

  select * into intent_row
  from public.photo_upload_intents
  where id = target_intent_id
    and organization_id = session_row.organization_id
    and portal_session_id = session_row.id
    and care_plan_id = session_row.care_plan_id
  for update;

  if not found then
    return jsonb_build_object('error', 'intent not found for portal session');
  end if;

  select id into existing_record_id
  from public.photo_records
  where organization_id = intent_row.organization_id
    and photo_request_id = intent_row.photo_request_id
  limit 1;

  if existing_record_id is not null then
    return jsonb_build_object('status', 'already_finalized', 'photo_record_id', existing_record_id);
  end if;

  select * into request_row
  from public.photo_requests
  where id = intent_row.photo_request_id
    and organization_id = intent_row.organization_id
    and care_plan_id = intent_row.care_plan_id
    and care_plan_day_id = intent_row.care_plan_day_id;

  if not found or request_row.status <> 'active' then
    return jsonb_build_object('error', 'photo request is invalid');
  end if;

  select * into plan_row
  from public.care_plans
  where id = intent_row.care_plan_id
    and organization_id = intent_row.organization_id;

  if not found or plan_row.status in ('stopped', 'completed') then
    return jsonb_build_object('error', 'photo request is invalid');
  end if;

  if intent_row.expires_at <= now() then
    update public.photo_upload_intents
    set status = 'expired'
    where id = intent_row.id;
    return jsonb_build_object('error', 'intent expired');
  end if;

  if intent_row.status = 'processing' and intent_row.processing_started_at > now() - interval '10 minutes' then
    return jsonb_build_object('error', 'intent is already processing');
  end if;

  if intent_row.status not in ('pending', 'processing') then
    return jsonb_build_object('error', 'intent is not pending');
  end if;

  next_claim_id := gen_random_uuid();

  update public.photo_upload_intents
  set status = 'processing',
      processing_started_at = now(),
      processing_claim_id = next_claim_id
  where id = intent_row.id;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    intent_row.organization_id,
    'system',
    'photo_upload_intent.created',
    'photo_upload_intent',
    intent_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'portal_rpc', 'mime_type', intent_row.declared_mime_type, 'size_bytes', intent_row.declared_size_bytes))
  );

  return jsonb_build_object(
    'status', 'processing',
    'claim_id', next_claim_id,
    'incoming_object_key', intent_row.incoming_object_key,
    'declared_mime_type', intent_row.declared_mime_type
  );
end;
$$;

create or replace function public.record_finalized_photo_for_portal(
  target_session_hash text,
  target_intent_id uuid,
  target_processing_claim_id uuid,
  target_final_object_key text,
  target_verified_size_bytes integer,
  target_width integer,
  target_height integer,
  target_checksum_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
  session_row public.portal_sessions%rowtype;
  intent_row public.photo_upload_intents%rowtype;
  request_row public.photo_requests%rowtype;
  plan_row public.care_plans%rowtype;
  new_record_id uuid;
  existing_record_id uuid;
begin
  session_id := public.validate_portal_session_hash(target_session_hash);
  if session_id is null then
    return jsonb_build_object('error', 'portal session is invalid');
  end if;

  select * into session_row from public.portal_sessions where id = session_id;

  select * into intent_row
  from public.photo_upload_intents
  where id = target_intent_id
    and organization_id = session_row.organization_id
    and portal_session_id = session_row.id
    and care_plan_id = session_row.care_plan_id
  for update;

  if not found then
    return jsonb_build_object('error', 'intent not found for portal session');
  end if;

  select id into existing_record_id
  from public.photo_records
  where organization_id = intent_row.organization_id
    and photo_request_id = intent_row.photo_request_id
  limit 1;

  if existing_record_id is not null then
    return jsonb_build_object('status', 'already_finalized', 'photo_record_id', existing_record_id);
  end if;

  if intent_row.status <> 'processing' or intent_row.processing_claim_id <> target_processing_claim_id then
    return jsonb_build_object('error', 'intent claim is invalid');
  end if;

  if intent_row.expires_at <= now() then
    update public.photo_upload_intents
    set status = 'expired'
    where id = intent_row.id;
    return jsonb_build_object('error', 'intent expired');
  end if;

  select * into request_row
  from public.photo_requests
  where id = intent_row.photo_request_id
    and organization_id = intent_row.organization_id
    and care_plan_id = intent_row.care_plan_id
    and care_plan_day_id = intent_row.care_plan_day_id;

  if not found or request_row.status <> 'active' then
    return jsonb_build_object('error', 'photo request is invalid');
  end if;

  select * into plan_row
  from public.care_plans
  where id = intent_row.care_plan_id
    and organization_id = intent_row.organization_id;

  if not found or plan_row.status in ('stopped', 'completed') then
    return jsonb_build_object('error', 'photo request is invalid');
  end if;

  insert into public.photo_records (
    organization_id,
    photo_request_id,
    upload_intent_id,
    care_plan_id,
    care_plan_day_id,
    portal_session_id,
    final_bucket_id,
    final_object_key,
    verified_mime_type,
    verified_size_bytes,
    width,
    height,
    checksum_sha256,
    finalized_at
  )
  values (
    intent_row.organization_id,
    intent_row.photo_request_id,
    intent_row.id,
    intent_row.care_plan_id,
    intent_row.care_plan_day_id,
    intent_row.portal_session_id,
    'care-photos',
    target_final_object_key,
    'image/webp',
    target_verified_size_bytes,
    target_width,
    target_height,
    target_checksum_sha256,
    now()
  )
  returning id into new_record_id;

  update public.photo_upload_intents
  set status = 'consumed',
      consumed_at = now()
  where id = intent_row.id;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, result, safe_metadata)
  values (
    intent_row.organization_id,
    'system',
    'photo.uploaded',
    'photo_record',
    new_record_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'portal_rpc', 'mime_type', 'image/webp', 'size_bytes', target_verified_size_bytes, 'width', target_width, 'height', target_height))
  );

  return jsonb_build_object('status', 'ready', 'photo_record_id', new_record_id);
end;
$$;

revoke all on function public.claim_photo_upload_intent_for_portal(text, uuid) from public;
revoke all on function public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text) from public;
grant execute on function public.claim_photo_upload_intent_for_portal(text, uuid) to anon, authenticated;
grant execute on function public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text) to anon, authenticated;
