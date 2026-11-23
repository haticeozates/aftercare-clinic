-- Hosted Supabase can grant anon and authenticated direct EXECUTE/DML through
-- postgres default privileges. Restore the application's scoped Data API boundary.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

revoke execute on function
  public.acquire_photo_cleanup_lock(target_job_name text, target_locked_until timestamp with time zone),
  public.alert_rule_configuration_is_allowed(input_configuration jsonb),
  public.archive_consent_document(p_document_id uuid),
  public.assign_data_request(p_request_id uuid, p_assigned_to_user_id uuid),
  public.audit_clients_change(),
  public.audit_procedures_change(),
  public.audit_template_change(),
  public.authorize_photo_view_for_staff(target_actor_user_id uuid, target_photo_record_id uuid),
  public.cancel_client_document_assignment(p_assignment_id uuid),
  public.care_template_day_version_status(target_day_id uuid),
  public.care_template_version_status(target_version_id uuid),
  public.claim_photo_upload_intent_for_portal(target_session_hash text, target_intent_id uuid),
  public.classify_photo_cleanup_candidate(target_bucket_kind text, target_object_key text, target_object_created_at timestamp with time zone),
  public.cleanup_expired_rate_limit_buckets(target_batch_limit integer),
  public.consume_rate_limit(target_limiter_key text, target_scope text, target_threshold integer, target_window_seconds integer, target_now timestamp with time zone),
  public.create_care_plan_from_template(target_client_id uuid, target_procedure_id uuid, target_template_id uuid, target_template_version_id uuid, target_start_date date, target_control_date timestamp with time zone, target_responsible_membership_id uuid),
  public.create_client_document_assignment(p_client_id uuid, p_document_version_id uuid, p_required boolean, p_care_plan_id uuid),
  public.create_consent_document(p_organization_id uuid, p_code text, p_title text, p_document_kind text, p_purpose_key text),
  public.create_consent_document_draft_version(p_document_id uuid, p_title_snapshot text, p_summary_text text, p_body_text text),
  public.create_draft_from_published_consent_version(p_published_version_id uuid),
  public.create_photo_request_for_staff(p_care_plan_id uuid, p_care_plan_day_id uuid, p_label text, p_required boolean),
  public.create_photo_upload_intent_for_portal(target_session_hash text, target_photo_request_id uuid, target_declared_mime_type text, target_declared_size_bytes integer, target_incoming_object_key text, target_expires_at timestamp with time zone),
  public.create_portal_session_for_link(target_token_hash text, target_session_hash text, target_expires_at timestamp with time zone),
  public.create_secure_link_for_plan(target_plan_id uuid, target_token_hash text, target_token_prefix text, target_expires_at timestamp with time zone),
  public.current_user_has_active_membership(target_organization_id uuid),
  public.current_user_has_permission(target_organization_id uuid, required_permission text),
  public.current_user_is_active_member(target_organization_id uuid, target_user_id uuid),
  public.day_is_draft_for_mutation(target_day_id uuid),
  public.enforce_care_plan_update_rules(),
  public.enforce_care_template_rules(),
  public.enforce_client_rules(),
  public.enforce_photo_request_update_rules(),
  public.enforce_photo_upload_intent_update_rules(),
  public.enforce_procedure_rules(),
  public.enforce_template_day_rules(),
  public.enforce_template_task_rules(),
  public.enforce_template_version_child_rules(),
  public.enforce_template_version_rules(),
  public.ensure_template_manage_permission(target_organization_id uuid, permission_key text),
  public.get_portal_data_requests(target_session_hash text),
  public.get_portal_document_assignments(target_session_hash text),
  public.get_portal_plan_for_session(target_session_hash text, expected_plan_id uuid),
  public.membership_is_active_in_organization(target_organization_id uuid, target_membership_id uuid),
  public.phase11_accept_invite(actor uuid, hashed_token text),
  public.phase11_actor_role(actor uuid, clinic uuid),
  public.phase11_change_membership(actor uuid, clinic uuid, member uuid, requested_role text, deactivate boolean),
  public.phase11_create_clinic(actor uuid, clinic_name text, profile_name text, clinic_address text, clinic_phone text, clinic_zone text),
  public.phase11_manage_invite(actor uuid, clinic uuid, operation text, invite uuid, recipient text, requested_role text, hashed_token text),
  public.phase11_membership_guard(),
  public.phase11_update_clinic(actor uuid, clinic uuid, clinic_name text, profile_name text, clinic_address text, clinic_phone text, clinic_zone text),
  public.phase12_bookable_clinic(clinic_slug text),
  public.phase12_catalog(clinic_slug text),
  public.phase12_configure(actor uuid, clinic uuid, operation text, payload jsonb),
  public.phase12_fits(clinic uuid, specialist uuid, begins timestamp with time zone, finishes timestamp with time zone, zone text),
  public.phase12_request(clinic_slug text, payload jsonb),
  public.phase12_roster(actor uuid, clinic uuid),
  public.phase12_slots(clinic_slug text, procedure uuid, specialist uuid, local_day date),
  public.phase12_write(actor uuid, clinic uuid, operation text, appointment uuid, payload jsonb),
  public.phase12_zone(clinic uuid),
  public.phase13_mark(actor uuid, clinic uuid, receipt uuid, mark_read boolean),
  public.phase13_preferences(actor uuid, clinic uuid, scope text, payload jsonb),
  public.phase15_report(clinic uuid, preset text, custom_from date, custom_to date, requested_member uuid, requested_procedure uuid, booking_status text, bucket text, export_csv boolean),
  public.phase6_rule_matches(rule_row care_plan_alert_rules, selected_items jsonb),
  public.phase8_current_document_decision(target_assignment_id uuid),
  public.phase8_data_request_allowed_resolution_codes(),
  public.phase8_data_request_default_resolution_code(target_status text),
  public.phase8_data_request_transition_allowed(from_status text, to_status text),
  public.phase8_validate_portal_session(target_session_hash text),
  public.portal_today(),
  public.prevent_alert_unsafe_mutation(),
  public.prevent_audit_log_mutation(),
  public.prevent_client_document_event_mutation(),
  public.prevent_data_request_event_mutation(),
  public.prevent_phase6_append_only(),
  public.prevent_photo_record_mutation(),
  public.prevent_plan_snapshot_mutation(),
  public.prevent_published_consent_version_mutation(),
  public.prevent_task_event_mutation(),
  public.publish_care_template_version(target_version_id uuid),
  public.publish_consent_document_version(target_version_id uuid),
  public.recalculate_care_plan_day_status(target_day_id uuid),
  public.record_client_document_event(target_assignment_id uuid, target_event_type text, target_source text),
  public.record_finalized_photo_for_portal(target_session_hash text, target_intent_id uuid, target_processing_claim_id uuid, target_final_object_key text, target_verified_size_bytes integer, target_width integer, target_height integer, target_checksum_sha256 text),
  public.record_photo_cleanup_audit(target_mode text, target_result text, target_scanned_incoming integer, target_scanned_final integer, target_candidate_incoming integer, target_candidate_final integer, target_deleted_incoming integer, target_deleted_final integer, target_failed integer, target_duration_ms integer),
  public.record_portal_document_event(target_session_hash text, target_assignment_id uuid, target_event_type text),
  public.release_photo_cleanup_lock(target_lock_token uuid),
  public.require_available_photo_day(),
  public.review_alert(target_alert_id uuid, target_action text, target_resolution_code text),
  public.revoke_secure_link(target_link_id uuid),
  public.sanitize_audit_metadata(input_metadata jsonb),
  public.set_portal_task_status(target_session_hash text, target_task_id uuid, target_status text),
  public.snapshot_care_plan_checkin_configuration(target_plan_id uuid),
  public.snapshot_care_plan_checkin_configuration_trigger(),
  public.submit_portal_data_request(target_session_hash text, target_request_type text),
  public.submit_symptom_report_for_portal(target_session_hash text, target_day_id uuid, target_items jsonb),
  public.transition_data_request_status(target_data_request_id uuid, target_status text, target_resolution_code text, target_assigned_to_user_id uuid),
  public.update_consent_document_draft_version(p_version_id uuid, p_title_snapshot text, p_summary_text text, p_body_text text),
  public.validate_portal_session_hash(target_session_hash text),
  public.validate_secure_link_hash(target_token_hash text),
  public.version_is_draft_for_mutation(target_version_id uuid),
  public.write_audit_log(target_organization_id uuid, actor_type text, actor_user_id uuid, action text, entity_type text, entity_id uuid, result text, request_id text, session_id text, safe_metadata jsonb),
  public.write_consent_manage_denied_audit(p_target_organization_id uuid, p_action text, p_entity_type text, p_entity_id uuid),
  public.write_data_request_manage_denied_audit(p_target_organization_id uuid, p_action text, p_entity_type text, p_entity_id uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.alert_rule_configuration_is_allowed(input_configuration jsonb),
  public.archive_consent_document(p_document_id uuid),
  public.assign_data_request(p_request_id uuid, p_assigned_to_user_id uuid),
  public.audit_clients_change(),
  public.audit_procedures_change(),
  public.audit_template_change(),
  public.cancel_client_document_assignment(p_assignment_id uuid),
  public.care_template_day_version_status(target_day_id uuid),
  public.care_template_version_status(target_version_id uuid),
  public.create_care_plan_from_template(target_client_id uuid, target_procedure_id uuid, target_template_id uuid, target_template_version_id uuid, target_start_date date, target_control_date timestamp with time zone, target_responsible_membership_id uuid),
  public.create_client_document_assignment(p_client_id uuid, p_document_version_id uuid, p_required boolean, p_care_plan_id uuid),
  public.create_consent_document(p_organization_id uuid, p_code text, p_title text, p_document_kind text, p_purpose_key text),
  public.create_consent_document_draft_version(p_document_id uuid, p_title_snapshot text, p_summary_text text, p_body_text text),
  public.create_draft_from_published_consent_version(p_published_version_id uuid),
  public.create_photo_request_for_staff(p_care_plan_id uuid, p_care_plan_day_id uuid, p_label text, p_required boolean),
  public.create_secure_link_for_plan(target_plan_id uuid, target_token_hash text, target_token_prefix text, target_expires_at timestamp with time zone),
  public.current_user_has_active_membership(target_organization_id uuid),
  public.current_user_has_permission(target_organization_id uuid, required_permission text),
  public.current_user_is_active_member(target_organization_id uuid, target_user_id uuid),
  public.day_is_draft_for_mutation(target_day_id uuid),
  public.enforce_care_plan_update_rules(),
  public.enforce_care_template_rules(),
  public.enforce_client_rules(),
  public.enforce_procedure_rules(),
  public.enforce_template_day_rules(),
  public.enforce_template_task_rules(),
  public.enforce_template_version_child_rules(),
  public.enforce_template_version_rules(),
  public.ensure_template_manage_permission(target_organization_id uuid, permission_key text),
  public.membership_is_active_in_organization(target_organization_id uuid, target_membership_id uuid),
  public.phase15_report(clinic uuid, preset text, custom_from date, custom_to date, requested_member uuid, requested_procedure uuid, booking_status text, bucket text, export_csv boolean),
  public.phase8_current_document_decision(target_assignment_id uuid),
  public.phase8_data_request_allowed_resolution_codes(),
  public.phase8_data_request_default_resolution_code(target_status text),
  public.phase8_data_request_transition_allowed(from_status text, to_status text),
  public.portal_today(),
  public.prevent_alert_unsafe_mutation(),
  public.prevent_client_document_event_mutation(),
  public.prevent_data_request_event_mutation(),
  public.prevent_phase6_append_only(),
  public.prevent_plan_snapshot_mutation(),
  public.prevent_published_consent_version_mutation(),
  public.prevent_task_event_mutation(),
  public.publish_care_template_version(target_version_id uuid),
  public.publish_consent_document_version(target_version_id uuid),
  public.record_client_document_event(target_assignment_id uuid, target_event_type text, target_source text),
  public.review_alert(target_alert_id uuid, target_action text, target_resolution_code text),
  public.revoke_secure_link(target_link_id uuid),
  public.snapshot_care_plan_checkin_configuration_trigger(),
  public.transition_data_request_status(target_data_request_id uuid, target_status text, target_resolution_code text, target_assigned_to_user_id uuid),
  public.update_consent_document_draft_version(p_version_id uuid, p_title_snapshot text, p_summary_text text, p_body_text text),
  public.version_is_draft_for_mutation(target_version_id uuid)
to authenticated;

grant execute on function
  public.acquire_photo_cleanup_lock(target_job_name text, target_locked_until timestamp with time zone),
  public.alert_rule_configuration_is_allowed(input_configuration jsonb),
  public.audit_clients_change(),
  public.audit_procedures_change(),
  public.audit_template_change(),
  public.authorize_photo_view_for_staff(target_actor_user_id uuid, target_photo_record_id uuid),
  public.claim_photo_upload_intent_for_portal(target_session_hash text, target_intent_id uuid),
  public.classify_photo_cleanup_candidate(target_bucket_kind text, target_object_key text, target_object_created_at timestamp with time zone),
  public.cleanup_expired_rate_limit_buckets(target_batch_limit integer),
  public.consume_rate_limit(target_limiter_key text, target_scope text, target_threshold integer, target_window_seconds integer, target_now timestamp with time zone),
  public.create_photo_upload_intent_for_portal(target_session_hash text, target_photo_request_id uuid, target_declared_mime_type text, target_declared_size_bytes integer, target_incoming_object_key text, target_expires_at timestamp with time zone),
  public.create_portal_session_for_link(target_token_hash text, target_session_hash text, target_expires_at timestamp with time zone),
  public.day_is_draft_for_mutation(target_day_id uuid),
  public.enforce_care_plan_update_rules(),
  public.enforce_care_template_rules(),
  public.enforce_client_rules(),
  public.enforce_procedure_rules(),
  public.enforce_template_day_rules(),
  public.enforce_template_task_rules(),
  public.enforce_template_version_child_rules(),
  public.enforce_template_version_rules(),
  public.get_portal_data_requests(target_session_hash text),
  public.get_portal_document_assignments(target_session_hash text),
  public.get_portal_plan_for_session(target_session_hash text, expected_plan_id uuid),
  public.phase11_accept_invite(actor uuid, hashed_token text),
  public.phase11_change_membership(actor uuid, clinic uuid, member uuid, requested_role text, deactivate boolean),
  public.phase11_create_clinic(actor uuid, clinic_name text, profile_name text, clinic_address text, clinic_phone text, clinic_zone text),
  public.phase11_manage_invite(actor uuid, clinic uuid, operation text, invite uuid, recipient text, requested_role text, hashed_token text),
  public.phase11_update_clinic(actor uuid, clinic uuid, clinic_name text, profile_name text, clinic_address text, clinic_phone text, clinic_zone text),
  public.phase12_catalog(clinic_slug text),
  public.phase12_configure(actor uuid, clinic uuid, operation text, payload jsonb),
  public.phase12_request(clinic_slug text, payload jsonb),
  public.phase12_roster(actor uuid, clinic uuid),
  public.phase12_slots(clinic_slug text, procedure uuid, specialist uuid, local_day date),
  public.phase12_write(actor uuid, clinic uuid, operation text, appointment uuid, payload jsonb),
  public.phase13_mark(actor uuid, clinic uuid, receipt uuid, mark_read boolean),
  public.phase13_preferences(actor uuid, clinic uuid, scope text, payload jsonb),
  public.phase8_current_document_decision(target_assignment_id uuid),
  public.phase8_data_request_allowed_resolution_codes(),
  public.phase8_data_request_default_resolution_code(target_status text),
  public.phase8_data_request_transition_allowed(from_status text, to_status text),
  public.portal_today(),
  public.prevent_alert_unsafe_mutation(),
  public.prevent_client_document_event_mutation(),
  public.prevent_data_request_event_mutation(),
  public.prevent_phase6_append_only(),
  public.prevent_plan_snapshot_mutation(),
  public.prevent_published_consent_version_mutation(),
  public.prevent_task_event_mutation(),
  public.record_finalized_photo_for_portal(target_session_hash text, target_intent_id uuid, target_processing_claim_id uuid, target_final_object_key text, target_verified_size_bytes integer, target_width integer, target_height integer, target_checksum_sha256 text),
  public.record_photo_cleanup_audit(target_mode text, target_result text, target_scanned_incoming integer, target_scanned_final integer, target_candidate_incoming integer, target_candidate_final integer, target_deleted_incoming integer, target_deleted_final integer, target_failed integer, target_duration_ms integer),
  public.record_portal_document_event(target_session_hash text, target_assignment_id uuid, target_event_type text),
  public.release_photo_cleanup_lock(target_lock_token uuid),
  public.sanitize_audit_metadata(input_metadata jsonb),
  public.set_portal_task_status(target_session_hash text, target_task_id uuid, target_status text),
  public.snapshot_care_plan_checkin_configuration_trigger(),
  public.submit_portal_data_request(target_session_hash text, target_request_type text),
  public.submit_symptom_report_for_portal(target_session_hash text, target_day_id uuid, target_items jsonb),
  public.validate_portal_session_hash(target_session_hash text),
  public.validate_secure_link_hash(target_token_hash text),
  public.version_is_draft_for_mutation(target_version_id uuid),
  public.write_audit_log(target_organization_id uuid, actor_type text, actor_user_id uuid, action text, entity_type text, entity_id uuid, result text, request_id text, session_id text, safe_metadata jsonb)
to service_role;

revoke all privileges on table
  public.alert_events,
  public.alert_rules,
  public.alerts,
  public.appointment_availability,
  public.appointment_events,
  public.appointment_services,
  public.appointment_settings,
  public.appointments,
  public.audit_logs,
  public.care_plan_alert_rules,
  public.care_plan_days,
  public.care_plan_symptom_options,
  public.care_plan_task_events,
  public.care_plan_tasks,
  public.care_plans,
  public.care_template_days,
  public.care_template_tasks,
  public.care_template_versions,
  public.care_templates,
  public.client_document_assignments,
  public.client_document_events,
  public.clients,
  public.consent_document_versions,
  public.consent_documents,
  public.data_request_events,
  public.data_requests,
  public.notification_clinic_preferences,
  public.notification_receipts,
  public.notification_user_preferences,
  public.organization_memberships,
  public.organizations,
  public.permissions,
  public.phase11_clinic_settings,
  public.phase11_onboarding,
  public.phase11_team_invites,
  public.photo_cleanup_locks,
  public.photo_records,
  public.photo_requests,
  public.photo_upload_intents,
  public.portal_sessions,
  public.procedures,
  public.public_inquiries,
  public.rate_limit_buckets,
  public.role_permissions,
  public.roles,
  public.secure_links,
  public.symptom_options,
  public.symptom_report_items,
  public.symptom_reports,
  public.user_profiles
from public, anon, authenticated, service_role;

grant DELETE, INSERT, SELECT, UPDATE on table
  public.alert_rules,
  public.care_template_days,
  public.care_template_tasks,
  public.symptom_options
to authenticated;

grant INSERT, SELECT on table
  public.data_requests
to authenticated;

grant INSERT, SELECT, UPDATE on table
  public.care_template_versions,
  public.care_templates,
  public.clients,
  public.consent_document_versions,
  public.consent_documents,
  public.organization_memberships,
  public.procedures
to authenticated;

grant SELECT on table
  public.alert_events,
  public.alerts,
  public.appointment_availability,
  public.appointment_events,
  public.appointment_services,
  public.appointment_settings,
  public.appointments,
  public.audit_logs,
  public.care_plan_alert_rules,
  public.care_plan_days,
  public.care_plan_symptom_options,
  public.care_plan_tasks,
  public.care_plans,
  public.client_document_assignments,
  public.client_document_events,
  public.data_request_events,
  public.notification_clinic_preferences,
  public.notification_receipts,
  public.notification_user_preferences,
  public.permissions,
  public.photo_records,
  public.photo_requests,
  public.photo_upload_intents,
  public.role_permissions,
  public.roles,
  public.symptom_report_items,
  public.symptom_reports
to authenticated;

grant SELECT, UPDATE on table
  public.organizations,
  public.user_profiles
to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on table
  public.client_document_assignments,
  public.client_document_events,
  public.consent_document_versions,
  public.consent_documents,
  public.data_request_events,
  public.data_requests
to service_role;

grant INSERT, SELECT, UPDATE on table
  public.phase11_clinic_settings,
  public.phase11_onboarding,
  public.phase11_team_invites
to service_role;

grant SELECT on table
  public.audit_logs
to service_role;

revoke all privileges on sequence
  public.appointment_events_id_seq,
  public.audit_logs_id_seq
from public, anon, authenticated, service_role;

grant SELECT, USAGE on sequence
  public.audit_logs_id_seq
to service_role;

grant UPDATE (control_date, responsible_membership_id, status, stopped_at, stopped_by_user_id) on table public.care_plans to authenticated;

grant INSERT (clinic, email, kind, message, name) on table public.public_inquiries to service_role;

grant SELECT (care_plan_id, created_at, created_by_user_id, expires_at, id, last_used_at, organization_id, revoked_at, revoked_by_user_id, rotated_from_link_id, status, token_prefix, usage_count) on table public.secure_links to authenticated;

alter function public.phase8_data_request_allowed_resolution_codes() set search_path = '';
alter function public.phase8_data_request_default_resolution_code(text) set search_path = '';

-- Bootstrap the application's role catalog without demo identities or clinical fixtures.

insert into public.roles (key, display_name)
values
  ('organization_owner', 'Organization Owner'),
  ('organization_admin', 'Organization Admin'),
  ('staff', 'Staff')
on conflict (key) do update set display_name = excluded.display_name;

insert into public.permissions (key, description)
values
  ('organization.read', 'Read organization foundation data'),
  ('organization.update', 'Update organization foundation settings'),
  ('membership.read', 'Read organization memberships'),
  ('membership.manage', 'Create or update organization memberships'),
  ('audit.read', 'Read organization audit logs')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'organization.read',
  'organization.update',
  'membership.read',
  'membership.manage',
  'audit.read'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'organization.read'
where r.key = 'staff'
on conflict do nothing;

insert into public.permissions (key, description)
values
  ('client.read', 'Read organization client records'),
  ('client.create', 'Create organization client records'),
  ('client.update', 'Update organization client records'),
  ('client.archive', 'Archive organization client records'),
  ('procedure.read', 'Read organization procedure records'),
  ('procedure.manage', 'Create or update organization procedure records')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'client.read',
  'client.create',
  'client.update',
  'client.archive',
  'procedure.read',
  'procedure.manage'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'client.read',
  'client.create',
  'client.update',
  'procedure.read'
)
where r.key = 'staff'
on conflict do nothing;

insert into public.permissions (key, description)
values
  ('template.read', 'Read care templates and versions'),
  ('template.create', 'Create care templates'),
  ('template.update', 'Update draft care templates'),
  ('template.publish', 'Publish care template versions'),
  ('template.deactivate', 'Deactivate care templates')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'template.read',
  'template.create',
  'template.update',
  'template.publish',
  'template.deactivate'
)
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'template.read'
where r.key = 'staff'
on conflict do nothing;

insert into public.permissions (key, description)
values
  ('plan.read', 'Read care plans'),
  ('plan.create', 'Create care plans'),
  ('plan.update', 'Update care plan operational fields'),
  ('plan.stop', 'Stop care plans'),
  ('secure_link.create', 'Create secure care links'),
  ('secure_link.revoke', 'Revoke secure care links'),
  ('secure_link.rotate', 'Rotate secure care links')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'plan.read',
  'plan.create',
  'plan.update',
  'plan.stop',
  'secure_link.create',
  'secure_link.revoke',
  'secure_link.rotate'
)
where r.key in ('organization_owner', 'organization_admin', 'staff')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('alert.read', 'alert.acknowledge', 'alert.resolve', 'alert.dismiss')
where r.key in ('organization_owner', 'organization_admin', 'staff')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.request.manage', 'photo.view')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.view')
where r.key = 'staff'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'consent.manage', 'data_request.read', 'data_request.manage')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'data_request.read')
where r.key = 'staff'
on conflict do nothing;
