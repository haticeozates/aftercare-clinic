import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizePortalDocumentAssignments, sanitizePortalDocumentError, type PortalDocumentAssignment, type PortalDocumentEvent } from "@/lib/consent/portal-contracts";
import { getPortalSessionHash } from "@/lib/portal/service";

export async function getPortalDocumentAssignments(): Promise<PortalDocumentAssignment[]> {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_portal_document_assignments", {
    target_session_hash: sessionHash
  });
  if (error) {
    return [];
  }
  return sanitizePortalDocumentAssignments(data);
}

export async function recordPortalDocumentEvent(assignmentId: string, eventType: PortalDocumentEvent) {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return { error: "Oturumunuzun süresi dolmuş olabilir." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_portal_document_event", {
    target_session_hash: sessionHash,
    target_assignment_id: assignmentId,
    target_event_type: eventType
  });
  if (error) {
    return { error: sanitizePortalDocumentError(error) };
  }
  const result = data as { error?: string; status?: string; current_decision?: string } | null;
  if (result?.error) {
    return { error: sanitizePortalDocumentError(result.error) };
  }
  return {
    status: result?.status ?? "recorded",
    currentDecision: result?.current_decision ?? null
  };
}
