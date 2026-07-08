import "server-only";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  dataRequestFinalStatuses,
  mapDataRequestDatabaseError,
  parseDataRequestTransitionInput,
  type DataRequestStatus,
  type DataRequestType
} from "@/lib/data-requests";

export interface DataRequestListItem {
  id: string;
  clientName: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  submittedAt: string;
  completedAt: string | null;
  resolutionCode: string | null;
}

type DataRequestRow = {
  id: string;
  request_type: DataRequestType;
  status: DataRequestStatus;
  submitted_at: string;
  completed_at: string | null;
  resolution_code: string | null;
  clients: { full_name: string } | { full_name: string }[] | null;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function dataRequestTypeLabel(type: DataRequestType) {
  return {
    access: "Erişim talebi",
    copy: "Kopya talebi",
    correction: "Düzeltme talebi",
    deletion: "Silme talebi",
    restriction: "Kısıtlama talebi",
    objection: "İtiraz talebi",
    withdraw_consent: "Onay geri çekme talebi",
    other: "Diğer talep"
  }[type];
}

export function dataRequestStatusLabel(status: DataRequestStatus) {
  return {
    submitted: "Gönderildi",
    under_review: "İncelemede",
    in_progress: "İşlemde",
    completed: "Tamamlandı",
    declined: "Reddedildi",
    cancelled: "İptal edildi"
  }[status];
}

export function nextDataRequestStatuses(status: DataRequestStatus): DataRequestStatus[] {
  const transitions: Record<DataRequestStatus, DataRequestStatus[]> = {
    submitted: ["under_review", "cancelled"],
    under_review: ["in_progress", "declined", "cancelled"],
    in_progress: ["completed", "declined"],
    completed: [],
    declined: [],
    cancelled: []
  };

  return transitions[status];
}

export async function listDataRequests() {
  const context = await requireOrganizationPermission("data_request.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("id,request_type,status,submitted_at,completed_at,resolution_code,clients(full_name)")
    .eq("organization_id", context.organization.id)
    .order("submitted_at", { ascending: false })
    .limit(50)
    .returns<DataRequestRow[]>();

  if (error) {
    throw new Error("Veri talepleri alınamadı.");
  }

  return {
    requests: data.map((row) => ({
      id: row.id,
      clientName: relationOne(row.clients)?.full_name ?? "Danışan",
      requestType: row.request_type,
      status: row.status,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      resolutionCode: row.resolution_code
    })),
    canManage: hasPermission(context.membership, "data_request.manage")
  };
}

export async function transitionDataRequestFromForm(formData: FormData) {
  await requireOrganizationPermission("data_request.manage");
  const parsed = parseDataRequestTransitionInput({
    status: String(formData.get("status") ?? ""),
    resolutionCode: String(formData.get("resolutionCode") || "") || null,
    assignedToUserId: String(formData.get("assignedToUserId") || "") || null
  });
  const id = String(formData.get("dataRequestId") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("transition_data_request_status", {
    target_data_request_id: id,
    target_status: parsed.status,
    target_resolution_code: dataRequestFinalStatuses.includes(parsed.status as (typeof dataRequestFinalStatuses)[number])
      ? (parsed.resolutionCode ?? "manual_review_completed")
      : null,
    target_assigned_to_user_id: parsed.assignedToUserId
  });

  if (error || (data as { error?: string } | null)?.error) {
    throw new Error(mapDataRequestDatabaseError(error ?? { message: (data as { error?: string } | null)?.error }));
  }

  revalidatePath("/clinic/data-requests");
}
