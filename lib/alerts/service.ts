import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { writeAuditEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { alertStatusLabel, mapAlertError, type AlertSeverity, type AlertStatus } from "@/lib/alerts";

export interface AlertListItem {
  id: string;
  status: AlertStatus;
  severityLevel: AlertSeverity;
  clientName: string;
  dayNumber: number;
  createdAt: string;
}

export interface AlertDetail extends AlertListItem {
  planStartDate: string;
  planEndDate: string;
  reportItems: { label: string; selected: boolean; severity: number | null }[];
  events: { eventType: string; previousStatus: string | null; newStatus: string; occurredAt: string }[];
}

type AlertRow = {
  id: string;
  status: AlertStatus;
  severity_level: AlertSeverity;
  created_at: string;
  care_plan_id: string;
  care_plan_day_id: string;
  symptom_report_id: string;
};

type DayRow = { id: string; day_number: number };
type PlanRow = { id: string; client_id: string; start_date: string; end_date: string };
type ClientRow = { id: string; full_name: string };
type ReportItemRow = { selected: boolean; severity: number | null; care_plan_symptom_option_id: string };
type SymptomOptionRow = { id: string; label: string };
type AlertEventRow = { event_type: string; previous_status: string | null; new_status: string; occurred_at: string };

function unique(values: string[]) {
  return [...new Set(values)].filter(Boolean);
}

function toMap<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function toAlertListItem(row: AlertRow, days: Map<string, DayRow>, plans: Map<string, PlanRow>, clients: Map<string, ClientRow>): AlertListItem {
  const plan = plans.get(row.care_plan_id);
  return {
    id: row.id,
    status: row.status,
    severityLevel: row.severity_level,
    clientName: plan ? (clients.get(plan.client_id)?.full_name ?? "Danışan") : "Danışan",
    dayNumber: days.get(row.care_plan_day_id)?.day_number ?? 0,
    createdAt: row.created_at
  };
}

export async function listAlerts(filters?: { status?: AlertStatus; severity?: AlertSeverity }) {
  const context = await requireOrganizationPermission("alert.read");
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("alerts")
    .select("id,status,severity_level,created_at,care_plan_id,care_plan_day_id,symptom_report_id")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.severity) {
    query = query.eq("severity_level", filters.severity);
  }

  const { data, error } = await query.returns<AlertRow[]>();
  if (error) {
    throw new Error("Takip bildirimleri alınamadı.");
  }

  if (data.length === 0) {
    return [];
  }

  const [days, plans] = await Promise.all([
    supabase
      .from("care_plan_days")
      .select("id,day_number")
      .eq("organization_id", context.organization.id)
      .in("id", unique(data.map((row) => row.care_plan_day_id)))
      .returns<DayRow[]>(),
    supabase
      .from("care_plans")
      .select("id,client_id,start_date,end_date")
      .eq("organization_id", context.organization.id)
      .in("id", unique(data.map((row) => row.care_plan_id)))
      .returns<PlanRow[]>()
  ]);

  if (days.error || plans.error) {
    throw new Error("Takip bildirimleri alınamadı.");
  }

  const clients = await supabase
    .from("clients")
    .select("id,full_name")
    .eq("organization_id", context.organization.id)
    .in("id", unique(plans.data.map((plan) => plan.client_id)))
    .returns<ClientRow[]>();

  if (clients.error) {
    throw new Error("Takip bildirimleri alınamadı.");
  }

  const dayMap = toMap(days.data);
  const planMap = toMap(plans.data);
  const clientMap = toMap(clients.data);

  return data.map((row) => toAlertListItem(row, dayMap, planMap, clientMap)).sort((a, b) => {
    const statusWeight = { open: 0, acknowledged: 1, resolved: 2, dismissed: 3 };
    const severityWeight = { high: 0, medium: 1, low: 2 };
    return statusWeight[a.status] - statusWeight[b.status] || severityWeight[a.severityLevel] - severityWeight[b.severityLevel];
  });
}

export async function getAlertDetail(id: string): Promise<AlertDetail> {
  const context = await requireOrganizationPermission("alert.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("id,status,severity_level,created_at,care_plan_id,care_plan_day_id,symptom_report_id")
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle<AlertRow>();

  if (error || !data) {
    redirect("/clinic/alerts");
  }

  const [day, plan, items, events] = await Promise.all([
    supabase
      .from("care_plan_days")
      .select("id,day_number")
      .eq("organization_id", context.organization.id)
      .eq("id", data.care_plan_day_id)
      .maybeSingle<DayRow>(),
    supabase
      .from("care_plans")
      .select("id,client_id,start_date,end_date")
      .eq("organization_id", context.organization.id)
      .eq("id", data.care_plan_id)
      .maybeSingle<PlanRow>(),
    supabase
      .from("symptom_report_items")
      .select("selected,severity,care_plan_symptom_option_id")
      .eq("organization_id", context.organization.id)
      .eq("symptom_report_id", data.symptom_report_id)
      .returns<ReportItemRow[]>(),
    supabase
      .from("alert_events")
      .select("event_type,previous_status,new_status,occurred_at")
      .eq("organization_id", context.organization.id)
      .eq("alert_id", id)
      .order("occurred_at")
      .returns<AlertEventRow[]>()
  ]);

  if (day.error || plan.error || items.error || events.error || !day.data || !plan.data) {
    throw new Error("Takip bildirimi detayı alınamadı.");
  }

  const options = await supabase
    .from("care_plan_symptom_options")
    .select("id,label")
    .eq("organization_id", context.organization.id)
    .in("id", unique(items.data.map((item) => item.care_plan_symptom_option_id)))
    .returns<SymptomOptionRow[]>();

  const client = await supabase
    .from("clients")
    .select("id,full_name")
    .eq("organization_id", context.organization.id)
    .eq("id", plan.data.client_id)
    .maybeSingle<ClientRow>();

  if (options.error || client.error) {
    throw new Error("Takip bildirimi detayı alınamadı.");
  }

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "alert.viewed",
    entityType: "alert",
    entityId: id,
    result: "success",
    safeMetadata: { source: "server_action", severity_level: data.severity_level }
  });

  const listItem = toAlertListItem(data, toMap([day.data]), toMap([plan.data]), toMap(client.data ? [client.data] : []));
  const optionMap = toMap(options.data);
  return {
    ...listItem,
    planStartDate: plan.data.start_date,
    planEndDate: plan.data.end_date,
    reportItems: items.data.map((item) => ({
      label: optionMap.get(item.care_plan_symptom_option_id)?.label ?? "Yapılandırılmış bildirim",
      selected: item.selected,
      severity: item.severity
    })),
    events: events.data.map((event) => ({
      eventType: event.event_type,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      occurredAt: event.occurred_at
    }))
  };
}

export async function reviewAlertFromForm(formData: FormData) {
  const action = String(formData.get("action") ?? "");
  const alertId = String(formData.get("alertId") ?? "");
  const resolutionCode = String(formData.get("resolutionCode") || "") || null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("review_alert", {
    target_alert_id: alertId,
    target_action: action,
    target_resolution_code: resolutionCode
  });

  if (error) {
    throw new Error(mapAlertError(error));
  }

  const result = data as { error?: string; status?: string } | null;
  if (result?.error) {
    throw new Error(mapAlertError(result.error));
  }

  revalidatePath("/clinic/alerts");
  revalidatePath(`/clinic/alerts/${alertId}`);
}

export { alertStatusLabel };
