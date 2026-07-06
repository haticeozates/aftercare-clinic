import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hashSecureToken } from "@/lib/secure-links";
import { mapPortalError, sanitizePortalPlan, type PortalPlan, type PortalTaskStatus } from "@/lib/portal";

const PORTAL_COOKIE_NAME = "aftercare_portal_session";

async function getPortalSessionHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return hashSecureToken(token, getServerEnv().AUDIT_LOG_PEPPER);
}

export async function getPortalPlan(): Promise<PortalPlan | null> {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_portal_plan_for_session", {
    target_session_hash: sessionHash
  });

  if (error || !data) {
    return null;
  }

  return sanitizePortalPlan(data as Record<string, unknown>);
}

export async function updatePortalTaskStatus(taskId: string, status: Extract<PortalTaskStatus, "pending" | "completed">) {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return { error: "Bağlantı geçersiz veya süresi dolmuş." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_portal_task_status", {
    target_session_hash: sessionHash,
    target_task_id: taskId,
    target_status: status
  });

  if (error) {
    return { error: mapPortalError(error) };
  }

  const result = data as { error?: string; task_status?: string; day_status?: string } | null;
  if (result?.error) {
    return { error: mapPortalError(result.error) };
  }

  return {
    taskStatus: result?.task_status,
    dayStatus: result?.day_status
  };
}
