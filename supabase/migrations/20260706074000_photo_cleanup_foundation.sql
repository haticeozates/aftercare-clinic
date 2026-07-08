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
    'photo.cleanup_failed'
  )
);

create table public.photo_cleanup_locks (
  job_name text primary key,
  lock_token uuid not null,
  locked_until timestamptz not null,
  acquired_at timestamptz not null default now()
);

alter table public.photo_cleanup_locks enable row level security;
revoke all on public.photo_cleanup_locks from anon;
revoke all on public.photo_cleanup_locks from authenticated;

create or replace function public.acquire_photo_cleanup_lock(
  target_job_name text,
  target_locked_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if target_job_name is null or length(target_job_name) < 3 or target_locked_until <= now() then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.photo_cleanup_locks(job_name, lock_token, locked_until)
  values (target_job_name, new_token, target_locked_until)
  on conflict (job_name) do update
    set lock_token = excluded.lock_token,
        locked_until = excluded.locked_until,
        acquired_at = now()
    where public.photo_cleanup_locks.locked_until <= now()
  returning lock_token into acquired_token;

  if acquired_token is null then
    return jsonb_build_object('status', 'already_running');
  end if;

  return jsonb_build_object('status', 'acquired', 'lock_token', acquired_token);
end;
$$;

create or replace function public.release_photo_cleanup_lock(target_lock_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  update public.photo_cleanup_locks
  set locked_until = now()
  where lock_token = target_lock_token;

  get diagnostics updated_count = row_count;
  return jsonb_build_object('status', case when updated_count = 1 then 'released' else 'not_found' end);
end;
$$;

create or replace function public.classify_photo_cleanup_candidate(
  target_bucket_kind text,
  target_object_key text,
  target_object_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intent_row public.photo_upload_intents%rowtype;
  record_exists boolean;
begin
  if target_object_created_at is null or target_object_created_at > now() - interval '24 hours' then
    return jsonb_build_object('action', 'skip', 'reason', 'too_new');
  end if;

  if target_bucket_kind = 'final' then
    select exists (
      select 1 from public.photo_records where final_object_key = target_object_key
    ) into record_exists;

    if record_exists then
      return jsonb_build_object('action', 'skip', 'reason', 'referenced_record');
    end if;

    if target_object_key !~ '^photos/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$' then
      return jsonb_build_object('action', 'skip', 'reason', 'uncertain');
    end if;

    return jsonb_build_object('action', 'delete', 'reason', 'orphan_final');
  end if;

  if target_bucket_kind = 'incoming' then
    if target_object_key !~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return jsonb_build_object('action', 'skip', 'reason', 'uncertain');
    end if;

    select * into intent_row
    from public.photo_upload_intents
    where incoming_object_key = target_object_key
    limit 1;

    if not found then
      return jsonb_build_object('action', 'skip', 'reason', 'uncertain');
    end if;

    select exists (
      select 1
      from public.photo_records
      where organization_id = intent_row.organization_id
        and photo_request_id = intent_row.photo_request_id
    ) into record_exists;

    if record_exists then
      return jsonb_build_object('action', 'delete', 'reason', 'expired_incoming');
    end if;

    if intent_row.status = 'pending' and intent_row.expires_at > now() then
      return jsonb_build_object('action', 'skip', 'reason', 'active_intent');
    end if;

    if intent_row.status = 'processing' and intent_row.processing_started_at > now() - interval '10 minutes' then
      return jsonb_build_object('action', 'skip', 'reason', 'processing');
    end if;

    if intent_row.status = 'processing' then
      return jsonb_build_object('action', 'delete', 'reason', 'expired_processing');
    end if;

    if intent_row.status in ('pending', 'expired', 'failed') then
      return jsonb_build_object('action', 'delete', 'reason', 'expired_incoming');
    end if;

    return jsonb_build_object('action', 'skip', 'reason', 'uncertain');
  end if;

  return jsonb_build_object('action', 'skip', 'reason', 'uncertain');
end;
$$;

create or replace function public.record_photo_cleanup_audit(
  target_mode text,
  target_result text,
  target_scanned_incoming integer,
  target_scanned_final integer,
  target_candidate_incoming integer,
  target_candidate_final integer,
  target_deleted_incoming integer,
  target_deleted_final integer,
  target_failed integer,
  target_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  audit_org_id uuid;
  audit_action text;
begin
  select id into audit_org_id from public.organizations order by created_at, id limit 1;
  if audit_org_id is null then
    return jsonb_build_object('status', 'skipped');
  end if;

  audit_action := case when target_result = 'success' then 'photo.cleanup_completed' else 'photo.cleanup_failed' end;

  insert into public.audit_logs (organization_id, actor_type, action, entity_type, result, safe_metadata)
  values (
    audit_org_id,
    'system',
    audit_action,
    'photo_record',
    case when target_result = 'success' then 'success' else 'failure' end,
    jsonb_build_object(
      'source', 'photo_cleanup_job',
      'mode', target_mode,
      'result', target_result,
      'scanned_incoming', target_scanned_incoming,
      'scanned_final', target_scanned_final,
      'candidate_incoming', target_candidate_incoming,
      'candidate_final', target_candidate_final,
      'deleted_incoming', target_deleted_incoming,
      'deleted_final', target_deleted_final,
      'failed', target_failed,
      'duration_ms', target_duration_ms
    )
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

revoke all on function public.acquire_photo_cleanup_lock(text, timestamptz) from public;
revoke all on function public.release_photo_cleanup_lock(uuid) from public;
revoke all on function public.classify_photo_cleanup_candidate(text, text, timestamptz) from public;
revoke all on function public.record_photo_cleanup_audit(text, text, integer, integer, integer, integer, integer, integer, integer, integer) from public;
grant execute on function public.acquire_photo_cleanup_lock(text, timestamptz) to service_role;
grant execute on function public.release_photo_cleanup_lock(uuid) to service_role;
grant execute on function public.classify_photo_cleanup_candidate(text, text, timestamptz) to service_role;
grant execute on function public.record_photo_cleanup_audit(text, text, integer, integer, integer, integer, integer, integer, integer, integer) to service_role;
