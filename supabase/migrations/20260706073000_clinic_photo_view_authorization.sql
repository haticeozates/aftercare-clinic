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
    'photo.view_authorized'
  )
);

create or replace function public.authorize_photo_view_for_staff(
  target_actor_user_id uuid,
  target_photo_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  record_row public.photo_records%rowtype;
  membership_row record;
begin
  select *
  into record_row
  from public.photo_records
  where id = target_photo_record_id
    and processing_status = 'ready'
    and finalized_at is not null;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  select om.organization_id, r.key as role_key
  into membership_row
  from public.organization_memberships om
  join public.roles r on r.id = om.role_id
  join public.role_permissions rp on rp.role_id = om.role_id
  join public.permissions p on p.id = rp.permission_id
  where om.user_id = target_actor_user_id
    and om.organization_id = record_row.organization_id
    and om.status = 'active'
    and p.key = 'photo.view'
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
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
    record_row.organization_id,
    'user',
    target_actor_user_id,
    'photo.view_authorized',
    'photo_record',
    record_row.id,
    'success',
    public.sanitize_audit_metadata(
      jsonb_build_object(
        'source', 'clinic_photo_view',
        'mime_type', record_row.verified_mime_type,
        'width', record_row.width,
        'height', record_row.height
      )
    )
  );

  return jsonb_build_object(
    'status', 'authorized',
    'photo_record_id', record_row.id,
    'final_object_key', record_row.final_object_key,
    'mime_type', record_row.verified_mime_type,
    'width', record_row.width,
    'height', record_row.height,
    'uploaded_at', record_row.uploaded_at
  );
end;
$$;

revoke all on function public.authorize_photo_view_for_staff(uuid, uuid) from public;
grant execute on function public.authorize_photo_view_for_staff(uuid, uuid) to service_role;
