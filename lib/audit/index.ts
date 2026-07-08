import type { z } from "zod";

export const AUDIT_ACTIONS = [
  "auth.login_success",
  "auth.login_failure",
  "organization.viewed",
  "organization.updated",
  "membership.viewed",
  "membership.created",
  "membership.role_updated",
  "membership.deactivated",
  "authorization.denied",
  "client.created",
  "client.viewed",
  "client.updated",
  "client.archived",
  "client.archive_denied",
  "procedure.created",
  "procedure.viewed",
  "procedure.updated",
  "procedure.deactivated",
  "procedure.manage_denied",
  "template.created",
  "template.updated",
  "template.deactivated",
  "template.viewed",
  "template_draft.created",
  "template_day.created",
  "template_day.updated",
  "template_day.deleted",
  "template_task.created",
  "template_task.updated",
  "template_task.deleted",
  "symptom_option.created",
  "symptom_option.updated",
  "alert_rule.created",
  "alert_rule.updated",
  "template.published",
  "template.publish_denied",
  "template.immutable_change_denied",
  "plan.created",
  "plan.viewed",
  "plan.updated",
  "plan.stopped",
  "plan.status_change_denied",
  "plan.create_denied",
  "secure_link.created",
  "secure_link.rotated",
  "secure_link.revoked",
  "secure_link.validation_succeeded",
  "secure_link.validation_failed",
  "secure_link.create_denied",
  "portal.viewed",
  "portal.session_invalid",
  "portal.task_completed",
  "portal.task_reopened",
  "portal.task_change_denied",
  "portal.future_task_denied",
  "portal.plan_inactive_denied",
  "symptom_report.submitted",
  "symptom_report.submit_denied",
  "alert.created",
  "alert.viewed",
  "alert.acknowledged",
  "alert.resolved",
  "alert.dismissed",
  "alert.status_change_denied",
  "photo_request.created",
  "photo_request.cancelled",
  "photo_upload_intent.created",
  "photo.uploaded",
  "photo.upload_denied",
  "photo.view_access_granted",
  "photo.view_authorized",
  "photo.view_denied",
  "photo.cleanup_completed",
  "photo.cleanup_failed"
] as const;

export const AUDIT_ENTITY_TYPES = [
  "auth",
  "organization",
  "membership",
  "audit_log",
  "client",
  "procedure",
  "template",
  "template_version",
  "template_day",
  "template_task",
  "symptom_option",
  "alert_rule",
  "plan",
  "plan_day",
  "plan_task",
  "plan_task_event",
  "secure_link",
  "portal_session",
  "symptom_report",
  "symptom_report_item",
  "alert",
  "alert_event",
  "photo_request",
  "photo_upload_intent",
  "photo_record"
] as const;
export const AUDIT_RESULTS = ["success", "failure", "denied"] as const;
export const AUDIT_ACTOR_TYPES = ["user", "system"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditResult = (typeof AUDIT_RESULTS)[number];
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

const allowedMetadataKeys = new Set([
  "reason",
  "target_role",
  "previous_role",
  "membership_status",
  "request_path",
  "permission",
  "permission_key",
  "source",
  "previous_status",
  "new_status",
  "changed_fields",
  "version_number",
  "task_type",
  "rule_type",
  "severity_level",
  "day_count",
  "task_count",
  "expiry_category",
  "result_reason",
  "rotated",
  "event_type",
  "day_number",
  "required",
  "selected_option_count",
  "alert_count",
  "resolution_code",
  "mime_type",
  "size_bytes",
  "width",
  "height",
  "result_reason_code",
  "retry",
  "idempotent_result"
]);

export type SafeAuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEventInput {
  organizationId: string;
  actorType: AuditActorType;
  actorUserId?: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  result: AuditResult;
  requestId?: string | null;
  sessionId?: string | null;
  safeMetadata: Record<string, unknown>;
}

export function sanitizeAuditMetadata(input: Record<string, unknown>): SafeAuditMetadata {
  const safe: SafeAuditMetadata = {};

  for (const [key, value] of Object.entries(input)) {
    if (!allowedMetadataKeys.has(key)) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
    }
  }

  return safe;
}

export function validateAuditEvent(input: AuditEventInput) {
  if (!AUDIT_ACTIONS.includes(input.action as AuditAction)) {
    throw new Error(`Unsupported audit action: ${input.action}`);
  }

  return {
    ...input,
    action: input.action as AuditAction,
    safeMetadata: sanitizeAuditMetadata(input.safeMetadata)
  };
}

export async function writeAuditEvent(input: AuditEventInput) {
  const event = validateAuditEvent(input);
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("write_audit_log", {
    target_organization_id: event.organizationId,
    actor_type: event.actorType,
    actor_user_id: event.actorUserId ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    result: event.result,
    request_id: event.requestId ?? null,
    session_id: event.sessionId ?? null,
    safe_metadata: event.safeMetadata
  });

  if (error) {
    throw new Error("Audit event could not be written.");
  }

  return event;
}

export type ZodAuditType = z.ZodTypeAny;
