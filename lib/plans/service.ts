import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveMembership, requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { sanitizeClinicPhotoRecord, type ClinicPhotoRecordDto } from "@/lib/photos/clinic-view";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapPlanDatabaseError, parsePlanCreateInput, planStatusLabel, type PlanStatus } from "@/lib/plans";

export interface PlanListItem {
  id: string;
  clientName: string;
  procedureName: string;
  templateName: string;
  versionNumber: number;
  startDate: string;
  endDate: string;
  controlDate: string | null;
  status: PlanStatus;
}

export interface PlanDaySnapshot {
  id: string;
  dayNumber: number;
  scheduledDate: string;
  title: string | null;
  tasks: { id: string; title: string; description: string | null; taskType: string; required: boolean }[];
  photos: ClinicPhotoRecordDto[];
}

export interface SecureLinkMetadata {
  id: string;
  tokenPrefix: string | null;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface PlanDetail extends PlanListItem {
  days: PlanDaySnapshot[];
  activeLink: SecureLinkMetadata | null;
}

type PlanRow = {
  id: string;
  start_date: string;
  end_date: string;
  control_date: string | null;
  status: PlanStatus;
  care_template_versions: { version_number: number } | { version_number: number }[] | null;
  clients: { full_name: string } | { full_name: string }[] | null;
  procedures: { name: string } | { name: string }[] | null;
  care_templates: { name: string } | { name: string }[] | null;
};

type DayRow = {
  id: string;
  day_number: number;
  scheduled_date: string;
  title: string | null;
};

type TaskRow = {
  id: string;
  care_plan_day_id: string;
  title: string;
  description: string | null;
  task_type: string;
  required: boolean;
  display_order: number;
};

type PhotoRecordRow = {
  id: string;
  photo_request_id: string;
  care_plan_day_id: string;
  uploaded_at: string;
  width: number;
  height: number;
  verified_mime_type: "image/webp";
};

type PhotoRequestRow = {
  id: string;
  label: string;
  required: boolean;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toPlanListItem(row: PlanRow): PlanListItem {
  return {
    id: row.id,
    clientName: relationOne(row.clients)?.full_name ?? "Danışan",
    procedureName: relationOne(row.procedures)?.name ?? "İşlem",
    templateName: relationOne(row.care_templates)?.name ?? "Şablon",
    versionNumber: relationOne(row.care_template_versions)?.version_number ?? 1,
    startDate: row.start_date,
    endDate: row.end_date,
    controlDate: row.control_date,
    status: row.status
  };
}

export async function listPlans(status?: PlanStatus) {
  const context = await requireOrganizationPermission("plan.read");
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("care_plans")
    .select("id,start_date,end_date,control_date,status,clients(full_name),procedures(name),care_templates(name),care_template_versions(version_number)")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<PlanRow[]>();
  if (error) {
    throw new Error("Bakım planları alınamadı.");
  }

  return {
    plans: data.map(toPlanListItem),
    canCreate: hasPermission(context.membership, "plan.create")
  };
}

export async function listPlanCreateOptions() {
  const context = await requireOrganizationPermission("plan.create");
  const supabase = await createServerSupabaseClient();
  const [clients, procedures, templates, memberships] = await Promise.all([
    supabase.from("clients").select("id,full_name").eq("organization_id", context.organization.id).eq("status", "active").order("full_name"),
    supabase.from("procedures").select("id,name").eq("organization_id", context.organization.id).eq("status", "active").order("name"),
    supabase
      .from("care_templates")
      .select("id,name,procedure_id,current_published_version_id,care_template_versions!care_templates_current_published_version_same_org_fk(id,version_number)")
      .eq("organization_id", context.organization.id)
      .eq("status", "active")
      .not("current_published_version_id", "is", null)
      .order("name"),
    supabase
      .from("organization_memberships")
      .select("id,user_id")
      .eq("organization_id", context.organization.id)
      .eq("status", "active")
  ]);

  if (clients.error || procedures.error || templates.error || memberships.error) {
    throw new Error("Plan oluşturma seçenekleri alınamadı.");
  }

  return {
    clients: clients.data.map((client) => ({ id: client.id, name: client.full_name })),
    procedures: procedures.data,
    templates: templates.data.map((template) => {
      const version = relationOne(template.care_template_versions as { id: string; version_number: number } | { id: string; version_number: number }[] | null);
      return {
        id: template.id,
        name: template.name,
        procedureId: template.procedure_id,
        versionId: template.current_published_version_id as string,
        versionNumber: version?.version_number ?? 1
      };
    }),
    memberships: memberships.data.map((membership) => ({ id: membership.id, label: membership.user_id }))
  };
}

export async function createPlanFromForm(formData: FormData) {
  await requireOrganizationPermission("plan.create");
  const parsed = parsePlanCreateInput({
    clientId: String(formData.get("clientId") ?? ""),
    procedureId: String(formData.get("procedureId") ?? ""),
    careTemplateId: String(formData.get("careTemplateId") ?? ""),
    templateVersionId: String(formData.get("templateVersionId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    controlDate: String(formData.get("controlDate") ?? ""),
    responsibleMembershipId: String(formData.get("responsibleMembershipId") || "") || null
  });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_care_plan_from_template", {
    target_client_id: parsed.clientId,
    target_procedure_id: parsed.procedureId,
    target_template_id: parsed.careTemplateId,
    target_template_version_id: parsed.templateVersionId,
    target_start_date: parsed.startDate,
    target_control_date: parsed.controlDate,
    target_responsible_membership_id: parsed.responsibleMembershipId
  });

  if (error || !data) {
    throw new Error(mapPlanDatabaseError(error ?? {}));
  }

  revalidatePath("/clinic/plans");
  return String(data);
}

export async function getPlanDetail(id: string): Promise<{ plan: PlanDetail; canManageLinks: boolean; canStop: boolean }> {
  const context = await requireOrganizationPermission("plan.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("care_plans")
    .select("id,start_date,end_date,control_date,status,clients(full_name),procedures(name),care_templates(name),care_template_versions(version_number)")
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle<PlanRow>();

  if (error || !data) {
    redirect("/clinic/plans");
  }

  const [days, tasks, photos, links] = await Promise.all([
    supabase.from("care_plan_days").select("id,day_number,scheduled_date,title").eq("organization_id", context.organization.id).eq("care_plan_id", id).order("day_number").returns<DayRow[]>(),
    supabase.from("care_plan_tasks").select("id,care_plan_day_id,title,description,task_type,required,display_order").eq("organization_id", context.organization.id).order("display_order").returns<TaskRow[]>(),
    supabase
      .from("photo_records")
      .select("id,photo_request_id,care_plan_day_id,uploaded_at,width,height,verified_mime_type")
      .eq("organization_id", context.organization.id)
      .eq("care_plan_id", id)
      .eq("processing_status", "ready")
      .order("uploaded_at", { ascending: false })
      .returns<PhotoRecordRow[]>(),
    supabase
      .from("secure_links")
      .select("id,token_prefix,status,expires_at,created_at")
      .eq("organization_id", context.organization.id)
      .eq("care_plan_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ id: string; token_prefix: string | null; status: "active" | "revoked" | "expired"; expires_at: string; created_at: string }[]>()
  ]);

  if (days.error || tasks.error || photos.error || links.error) {
    throw new Error("Plan detayı alınamadı.");
  }

  const photoRequestIds = Array.from(new Set(photos.data.map((photo) => photo.photo_request_id)));
  const photoRequests = photoRequestIds.length
    ? await supabase
        .from("photo_requests")
        .select("id,label,required")
        .eq("organization_id", context.organization.id)
        .in("id", photoRequestIds)
        .returns<PhotoRequestRow[]>()
    : { data: [] as PhotoRequestRow[], error: null };

  if (photoRequests.error) {
    throw new Error("Plan detayı alınamadı.");
  }

  const requestsById = new Map(photoRequests.data.map((request) => [request.id, request]));

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "plan.viewed",
    entityType: "plan",
    entityId: id,
    result: "success",
    safeMetadata: { source: "server_action" }
  });

  return {
    plan: {
      ...toPlanListItem(data),
      days: days.data.map((day) => ({
        id: day.id,
        dayNumber: day.day_number,
        scheduledDate: day.scheduled_date,
        title: day.title,
        tasks: tasks.data
          .filter((task) => task.care_plan_day_id === day.id)
          .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            taskType: task.task_type,
            required: task.required
          })),
        photos: photos.data
          .filter((photo) => photo.care_plan_day_id === day.id)
          .map((photo) => {
            const request = requestsById.get(photo.photo_request_id);
            return sanitizeClinicPhotoRecord({
              id: photo.id,
              request_label: request?.label,
              request_required: request?.required,
              day_number: day.day_number,
              uploaded_at: photo.uploaded_at,
              width: photo.width,
              height: photo.height,
              mime_type: photo.verified_mime_type
            });
          })
      })),
      activeLink: links.data[0]
        ? {
            id: links.data[0].id,
            tokenPrefix: links.data[0].token_prefix,
            status: links.data[0].status,
            expiresAt: links.data[0].expires_at,
            createdAt: links.data[0].created_at
          }
        : null
    },
    canManageLinks:
      hasPermission(context.membership, "secure_link.create") && !["completed", "stopped"].includes(data.status),
    canStop: hasPermission(context.membership, "plan.stop") && ["scheduled", "active"].includes(data.status)
  };
}

export async function stopPlan(planId: string) {
  const context = await requireActiveMembership();
  if (!hasPermission(context.membership, "plan.stop")) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("care_plans")
    .update({
      status: "stopped",
      stopped_at: new Date().toISOString(),
      stopped_by_user_id: context.user.id,
      updated_by_user_id: context.user.id
    })
    .eq("id", planId)
    .eq("organization_id", context.organization.id);

  if (error) {
    throw new Error(mapPlanDatabaseError(error));
  }

  revalidatePath(`/clinic/plans/${planId}`);
}

export { planStatusLabel };
