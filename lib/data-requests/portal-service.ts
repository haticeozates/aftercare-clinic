import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPortalSessionHash } from "@/lib/portal/service";
import { sanitizePortalDataRequestError, sanitizePortalDataRequests, type PortalDataRequest } from "@/lib/data-requests/portal-contracts";
import type { DataRequestType } from "@/lib/data-requests";

export async function getPortalDataRequests(): Promise<PortalDataRequest[]> {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_portal_data_requests", {
    target_session_hash: sessionHash
  });
  if (error) {
    return [];
  }
  return sanitizePortalDataRequests(data);
}

export async function submitPortalDataRequest(requestType: DataRequestType) {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return { error: "Oturumunuzun süresi dolmuş olabilir." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_portal_data_request", {
    target_session_hash: sessionHash,
    target_request_type: requestType
  });
  if (error) {
    return { error: sanitizePortalDataRequestError(error) };
  }
  const result = data as { error?: string; status?: string; request?: Record<string, unknown> } | null;
  if (result?.error) {
    return { error: sanitizePortalDataRequestError(result.error) };
  }
  return {
    status: result?.status ?? "submitted",
    request: result?.request ?? null
  };
}
