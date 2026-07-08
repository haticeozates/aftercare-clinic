import "server-only";

import { mapAssignmentRpcResult } from "@/lib/consent/assignment-contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AssignmentRpcPayload = {
  error?: string;
  status?: string;
  assignment_id?: string;
};

function assertAssignmentRpcSuccess(
  transportError: { code?: string; message?: string } | null,
  rpcResult: AssignmentRpcPayload | null
): AssignmentRpcPayload {
  if (transportError || rpcResult?.error) {
    throw new Error(mapAssignmentRpcResult(transportError, rpcResult));
  }

  if (!rpcResult) {
    throw new Error(mapAssignmentRpcResult({ code: "UNKNOWN" }, null));
  }

  return rpcResult;
}

export async function createClientDocumentAssignment(input: {
  clientId: string;
  documentVersionId: string;
  carePlanId: string | null;
  required: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_client_document_assignment", {
    p_client_id: input.clientId,
    p_document_version_id: input.documentVersionId,
    p_required: input.required,
    p_care_plan_id: input.carePlanId
  });

  const result = assertAssignmentRpcSuccess(error, data as AssignmentRpcPayload | null);
  return result.assignment_id ?? "";
}

export async function cancelClientDocumentAssignment(assignmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("cancel_client_document_assignment", {
    p_assignment_id: assignmentId
  });

  assertAssignmentRpcSuccess(error, data as AssignmentRpcPayload | null);
  return assignmentId;
}
