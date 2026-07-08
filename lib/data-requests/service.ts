import "server-only";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mapDataRequestDatabaseError,
  nextDataRequestStatuses,
  parseDataRequestTransitionInput,
  resolveDataRequestResolutionCode,
  type DataRequestStatus,
  type DataRequestType
} from "@/lib/data-requests";

export { nextDataRequestStatuses };

export interface DataRequestListItem {
  id: string;
  clientName: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  submittedAt: string;
  completedAt: string | null;
  resolutionCode: string | null;
  assignedToUserId: string | null;
  assigneeName: string | null;
}

export interface DataRequestEventItem {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  occurredAt: string;
  assigneeName: string | null;
}

export interface StaffAssigneeOption {
  userId: string;
  label: string;
}

type DataRequestRow = {
  id: string;
  request_type: DataRequestType;
  status: DataRequestStatus;
  submitted_at: string;
  completed_at: string | null;
  resolution_code: string | null;
  assigned_to_user_id: string | null;
  clients: { full_name: string } | { full_name: string }[] | null;
};

type DataRequestEventRow = {
  id: string;
  data_request_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  assignee_user_id: string | null;
};

type MembershipRow = {
  user_id: string;
  user_profiles: { display_name: string } | { display_name: string }[] | null;
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

export function dataRequestEventTypeLabel(eventType: string) {
  return {
    submitted: "Gönderildi",
    review_started: "İnceleme başladı",
    assigned: "Personel atandı",
    status_changed: "Durum değişti",
    completed: "Tamamlandı",
    declined: "Reddedildi",
    cancelled: "İptal edildi"
  }[eventType] ?? "Olay";
}

async function loadStaffAssigneeOptions(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, organizationId: string) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id,user_profiles(display_name)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .returns<MembershipRow[]>();

  if (error) {
    throw new Error("Personel listesi alınamadı.");
  }

  return data.map((row) => ({
    userId: row.user_id,
    label: relationOne(row.user_profiles)?.display_name ?? row.user_id.slice(0, 8)
  }));
}

function mapDataRequestEventRow(
  row: DataRequestEventRow,
  assigneeMap: Map<string, string>
): DataRequestEventItem {
  return {
    id: row.id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    occurredAt: row.occurred_at,
    assigneeName: row.assignee_user_id ? (assigneeMap.get(row.assignee_user_id) ?? null) : null
  };
}

function groupEventsByRequestId(
  rows: DataRequestEventRow[],
  assigneeMap: Map<string, string>
): Record<string, DataRequestEventItem[]> {
  const grouped: Record<string, DataRequestEventItem[]> = {};

  for (const row of rows) {
    const events = grouped[row.data_request_id] ?? [];
    events.push(mapDataRequestEventRow(row, assigneeMap));
    grouped[row.data_request_id] = events;
  }

  return grouped;
}

export async function listDataRequests() {
  const context = await requireOrganizationPermission("data_request.read");
  const supabase = await createServerSupabaseClient();
  const [requestsResult, staffOptions] = await Promise.all([
    supabase
      .from("data_requests")
      .select("id,request_type,status,submitted_at,completed_at,resolution_code,assigned_to_user_id,clients(full_name)")
      .eq("organization_id", context.organization.id)
      .order("submitted_at", { ascending: false })
      .limit(50)
      .returns<DataRequestRow[]>(),
    loadStaffAssigneeOptions(supabase, context.organization.id)
  ]);

  if (requestsResult.error) {
    throw new Error("Veri talepleri alınamadı.");
  }

  const assigneeMap = new Map(staffOptions.map((member) => [member.userId, member.label]));
  const requestIds = requestsResult.data.map((row) => row.id);
  let eventsByRequestId: Record<string, DataRequestEventItem[]> = {};

  if (requestIds.length > 0) {
    const { data: eventRows, error: eventsError } = await supabase
      .from("data_request_events")
      .select("id,data_request_id,event_type,from_status,to_status,occurred_at,assignee_user_id")
      .eq("organization_id", context.organization.id)
      .in("data_request_id", requestIds)
      .order("occurred_at", { ascending: true })
      .returns<DataRequestEventRow[]>();

    if (eventsError) {
      throw new Error("Veri talebi geçmişi alınamadı.");
    }

    eventsByRequestId = groupEventsByRequestId(eventRows, assigneeMap);
  }

  return {
    requests: requestsResult.data.map((row) => ({
      id: row.id,
      clientName: relationOne(row.clients)?.full_name ?? "Danışan",
      requestType: row.request_type,
      status: row.status,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      resolutionCode: row.resolution_code,
      assignedToUserId: row.assigned_to_user_id,
      assigneeName: row.assigned_to_user_id ? (assigneeMap.get(row.assigned_to_user_id) ?? null) : null
    })),
    eventsByRequestId,
    staffOptions,
    canManage: hasPermission(context.membership, "data_request.manage")
  };
}

export async function assignDataRequestFromForm(formData: FormData) {
  await requireOrganizationPermission("data_request.manage");
  const id = String(formData.get("dataRequestId") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") || "") || null;

  if (!assignedToUserId) {
    throw new Error("Seçilen personel bu organizasyonda geçerli değil.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("assign_data_request", {
    p_request_id: id,
    p_assigned_to_user_id: assignedToUserId
  });

  if (error || (data as { error?: string } | null)?.error) {
    throw new Error(mapDataRequestDatabaseError(error ?? { message: (data as { error?: string } | null)?.error }));
  }

  revalidatePath("/clinic/data-requests");
}

export async function transitionDataRequestFromForm(formData: FormData) {
  await requireOrganizationPermission("data_request.manage");
  const parsed = parseDataRequestTransitionInput({
    status: String(formData.get("status") ?? ""),
    assignedToUserId: String(formData.get("assignedToUserId") || "") || null
  });
  const id = String(formData.get("dataRequestId") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("transition_data_request_status", {
    target_data_request_id: id,
    target_status: parsed.status,
    target_resolution_code: resolveDataRequestResolutionCode(parsed.status),
    target_assigned_to_user_id: parsed.assignedToUserId
  });

  if (error || (data as { error?: string } | null)?.error) {
    throw new Error(mapDataRequestDatabaseError(error ?? { message: (data as { error?: string } | null)?.error }));
  }

  revalidatePath("/clinic/data-requests");
}
