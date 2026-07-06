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
  "procedure.manage_denied"
] as const;

export const AUDIT_ENTITY_TYPES = ["auth", "organization", "membership", "audit_log", "client", "procedure"] as const;
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
  "changed_fields"
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
