import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveMembership, requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mapTemplateDatabaseError,
  parseAlertRuleInput,
  parseSymptomOptionInput,
  parseTemplateInput,
  parseTemplateTaskInput,
  type AlertRuleType,
  type AlertSeverityLevel,
  type TemplateStatus,
  type TemplateTaskType,
  type TemplateVersionStatus
} from "@/lib/templates";

export interface TemplateListItem {
  id: string;
  name: string;
  status: TemplateStatus;
  procedureName: string;
  currentPublishedVersionId: string | null;
  draftVersionId: string | null;
  currentVersionNumber: number | null;
}

export interface TemplateDetail extends TemplateListItem {
  versions: TemplateVersionSummary[];
}

export interface TemplateVersionSummary {
  id: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface TemplateDay {
  id: string;
  dayNumber: number;
  title: string | null;
  displayOrder: number;
  tasks: TemplateTask[];
}

export interface TemplateTask {
  id: string;
  title: string;
  description: string | null;
  taskType: TemplateTaskType;
  required: boolean;
  displayOrder: number;
}

export interface SymptomOption {
  id: string;
  label: string;
  allowsSeverity: boolean;
  allowsNote: boolean;
  displayOrder: number;
}

export interface AlertRule {
  id: string;
  symptomOptionId: string | null;
  ruleType: AlertRuleType;
  severityLevel: AlertSeverityLevel;
  messageLabel: string;
}

export interface TemplateVersionDetail {
  id: string;
  templateId: string;
  templateName: string;
  procedureName: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  title: string | null;
  publishedAt: string | null;
  days: TemplateDay[];
  symptomOptions: SymptomOption[];
  alertRules: AlertRule[];
}

type TemplateRow = {
  id: string;
  name: string;
  status: TemplateStatus;
  current_published_version_id: string | null;
  procedures: { name: string } | { name: string }[] | null;
};

type VersionRow = {
  id: string;
  version_number: number;
  status: TemplateVersionStatus;
  created_at: string;
  published_at: string | null;
};

type VersionDetailRow = {
  id: string;
  care_template_id: string;
  version_number: number;
  status: TemplateVersionStatus;
  title: string | null;
  published_at: string | null;
};

type TemplateProcedureRow = {
  name: string;
  procedures: { name: string } | { name: string }[] | null;
};

type DayRow = {
  id: string;
  day_number: number;
  title: string | null;
  display_order: number;
};

type TaskRow = {
  id: string;
  template_day_id: string;
  title: string;
  description: string | null;
  task_type: TemplateTaskType;
  required: boolean;
  display_order: number;
};

type SymptomRow = {
  id: string;
  label: string;
  allows_severity: boolean;
  allows_note: boolean;
  display_order: number;
};

type RuleRow = {
  id: string;
  symptom_option_id: string | null;
  rule_type: AlertRuleType;
  severity_level: AlertSeverityLevel;
  message_label: string;
};

type ProcedureOptionRow = {
  id: string;
  name: string;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function getDraftVersionId(templateId: string, organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("care_template_versions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("care_template_id", templateId)
    .eq("status", "draft")
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

export async function listTemplates(params: { status?: TemplateStatus; procedureId?: string } = {}) {
  const context = await requireOrganizationPermission("template.read");
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("care_templates")
    .select("id,name,status,current_published_version_id,procedures(name)")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.procedureId) {
    query = query.eq("procedure_id", params.procedureId);
  }

  const { data, error } = await query.returns<TemplateRow[]>();

  if (error) {
    throw new Error("Bakım şablonları alınamadı.");
  }

  const templates = await Promise.all(
    data.map(async (row) => {
      const draftVersionId = await getDraftVersionId(row.id, context.organization.id);
      let currentVersionNumber: number | null = null;

      if (row.current_published_version_id) {
        const { data: version } = await supabase
          .from("care_template_versions")
          .select("version_number")
          .eq("organization_id", context.organization.id)
          .eq("id", row.current_published_version_id)
          .maybeSingle<{ version_number: number }>();
        currentVersionNumber = version?.version_number ?? null;
      }

      return {
        id: row.id,
        name: row.name,
        status: row.status,
        procedureName: relationOne(row.procedures)?.name ?? "İşlem bulunamadı",
        currentPublishedVersionId: row.current_published_version_id,
        draftVersionId,
        currentVersionNumber
      };
    })
  );

  return {
    context,
    templates,
    canManage: hasPermission(context.membership, "template.create")
  };
}

export async function listActiveProcedureOptions() {
  const context = await requireOrganizationPermission("procedure.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("procedures")
    .select("id,name")
    .eq("organization_id", context.organization.id)
    .eq("status", "active")
    .order("name", { ascending: true })
    .returns<ProcedureOptionRow[]>();

  if (error) {
    throw new Error("Aktif işlem listesi alınamadı.");
  }

  return data;
}

export async function getTemplateDetail(id: string): Promise<{ detail: TemplateDetail; canManage: boolean }> {
  const context = await requireOrganizationPermission("template.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("care_templates")
    .select("id,name,status,current_published_version_id,procedures(name)")
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle<TemplateRow>();

  if (error || !data) {
    redirect("/clinic/templates");
  }

  const { data: versions, error: versionsError } = await supabase
    .from("care_template_versions")
    .select("id,version_number,status,created_at,published_at")
    .eq("organization_id", context.organization.id)
    .eq("care_template_id", id)
    .order("version_number", { ascending: false })
    .returns<VersionRow[]>();

  if (versionsError) {
    throw new Error("Şablon versiyonları alınamadı.");
  }

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "template.viewed",
    entityType: "template",
    entityId: data.id,
    result: "success",
    safeMetadata: { source: "server_action" }
  });

  return {
    canManage: hasPermission(context.membership, "template.update"),
    detail: {
      id: data.id,
      name: data.name,
      status: data.status,
      procedureName: relationOne(data.procedures)?.name ?? "İşlem bulunamadı",
      currentPublishedVersionId: data.current_published_version_id,
      currentVersionNumber:
        versions.find((version) => version.id === data.current_published_version_id)?.version_number ?? null,
      draftVersionId: versions.find((version) => version.status === "draft")?.id ?? null,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.version_number,
        status: version.status,
        createdAt: version.created_at,
        publishedAt: version.published_at
      }))
    }
  };
}

export async function getTemplateVersionDetail(versionId: string): Promise<{
  version: TemplateVersionDetail;
  canManage: boolean;
}> {
  const context = await requireOrganizationPermission("template.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("care_template_versions")
    .select("id,care_template_id,version_number,status,title,published_at")
    .eq("organization_id", context.organization.id)
    .eq("id", versionId)
    .maybeSingle<VersionDetailRow>();

  if (error || !data) {
    redirect("/clinic/templates");
  }

  const { data: template, error: templateError } = await supabase
    .from("care_templates")
    .select("name,procedures(name)")
    .eq("organization_id", context.organization.id)
    .eq("id", data.care_template_id)
    .maybeSingle<TemplateProcedureRow>();

  if (templateError || !template) {
    redirect("/clinic/templates");
  }

  const [daysResult, tasksResult, symptomsResult, rulesResult] = await Promise.all([
    supabase
      .from("care_template_days")
      .select("id,day_number,title,display_order")
      .eq("organization_id", context.organization.id)
      .eq("template_version_id", versionId)
      .order("display_order", { ascending: true })
      .returns<DayRow[]>(),
    supabase
      .from("care_template_tasks")
      .select("id,template_day_id,title,description,task_type,required,display_order")
      .eq("organization_id", context.organization.id)
      .order("display_order", { ascending: true })
      .returns<TaskRow[]>(),
    supabase
      .from("symptom_options")
      .select("id,label,allows_severity,allows_note,display_order")
      .eq("organization_id", context.organization.id)
      .eq("template_version_id", versionId)
      .order("display_order", { ascending: true })
      .returns<SymptomRow[]>(),
    supabase
      .from("alert_rules")
      .select("id,symptom_option_id,rule_type,severity_level,message_label")
      .eq("organization_id", context.organization.id)
      .eq("template_version_id", versionId)
      .order("created_at", { ascending: true })
      .returns<RuleRow[]>()
  ]);

  if (daysResult.error || tasksResult.error || symptomsResult.error || rulesResult.error) {
    throw new Error("Şablon versiyonu içeriği alınamadı.");
  }

  const tasks = tasksResult.data;
  const procedure = relationOne(template?.procedures ?? null);

  return {
    canManage: hasPermission(context.membership, "template.update") && data.status === "draft",
    version: {
      id: data.id,
      templateId: data.care_template_id,
      templateName: template.name,
      procedureName: procedure?.name ?? "İşlem",
      versionNumber: data.version_number,
      status: data.status,
      title: data.title,
      publishedAt: data.published_at,
      days: daysResult.data.map((day) => ({
        id: day.id,
        dayNumber: day.day_number,
        title: day.title,
        displayOrder: day.display_order,
        tasks: tasks
          .filter((task) => task.template_day_id === day.id)
          .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            taskType: task.task_type,
            required: task.required,
            displayOrder: task.display_order
          }))
      })),
      symptomOptions: symptomsResult.data.map((symptom) => ({
        id: symptom.id,
        label: symptom.label,
        allowsSeverity: symptom.allows_severity,
        allowsNote: symptom.allows_note,
        displayOrder: symptom.display_order
      })),
      alertRules: rulesResult.data.map((rule) => ({
        id: rule.id,
        symptomOptionId: rule.symptom_option_id,
        ruleType: rule.rule_type,
        severityLevel: rule.severity_level,
        messageLabel: rule.message_label
      }))
    }
  };
}

export async function insertTemplateFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("template.create");
  const parsed = parseTemplateInput({
    name: String(formData.get("name") ?? ""),
    procedureId: String(formData.get("procedureId") ?? "")
  });
  const supabase = await createServerSupabaseClient();
  const { data: template, error: templateError } = await supabase
    .from("care_templates")
    .insert({
      organization_id: context.organization.id,
      procedure_id: parsed.procedureId,
      name: parsed.name,
      normalized_name: parsed.normalizedName,
      created_by_user_id: context.user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (templateError || !template) {
    throw new Error(mapTemplateDatabaseError(templateError ?? {}));
  }

  const { data: version, error: versionError } = await supabase
    .from("care_template_versions")
    .insert({
      organization_id: context.organization.id,
      care_template_id: template.id,
      version_number: 1,
      status: "draft",
      title: parsed.name,
      created_by_user_id: context.user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (versionError || !version) {
    throw new Error(mapTemplateDatabaseError(versionError ?? {}));
  }

  revalidatePath("/clinic/templates");
  return { templateId: template.id, versionId: version.id };
}

export async function createDraftFromPublished(templateId: string) {
  const context = await requireOrganizationPermission("template.update");
  const supabase = await createServerSupabaseClient();
  const existingDraftId = await getDraftVersionId(templateId, context.organization.id);

  if (existingDraftId) {
    redirect(`/clinic/templates/${templateId}/draft`);
  }

  const { data: template, error: templateError } = await supabase
    .from("care_templates")
    .select("id,name,current_published_version_id")
    .eq("organization_id", context.organization.id)
    .eq("id", templateId)
    .maybeSingle<{ id: string; name: string; current_published_version_id: string | null }>();

  if (templateError || !template?.current_published_version_id) {
    throw new Error("Yeni taslak oluşturmak için yayınlanmış bir versiyon gerekir.");
  }

  const { data: maxVersion, error: maxError } = await supabase
    .from("care_template_versions")
    .select("version_number")
    .eq("organization_id", context.organization.id)
    .eq("care_template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single<{ version_number: number }>();

  if (maxError) {
    throw new Error("Versiyon bilgisi alınamadı.");
  }

  const { data: newVersion, error: newVersionError } = await supabase
    .from("care_template_versions")
    .insert({
      organization_id: context.organization.id,
      care_template_id: templateId,
      version_number: maxVersion.version_number + 1,
      status: "draft",
      title: template.name,
      created_by_user_id: context.user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (newVersionError || !newVersion) {
    throw new Error(mapTemplateDatabaseError(newVersionError ?? {}));
  }

  await copyVersionContent(template.current_published_version_id, newVersion.id, context.organization.id);
  revalidatePath(`/clinic/templates/${templateId}`);
  redirect(`/clinic/templates/${templateId}/draft`);
}

async function copyVersionContent(sourceVersionId: string, targetVersionId: string, organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: days, error: daysError } = await supabase
    .from("care_template_days")
    .select("id,day_number,title,display_order")
    .eq("organization_id", organizationId)
    .eq("template_version_id", sourceVersionId)
    .order("display_order", { ascending: true })
    .returns<DayRow[]>();

  if (daysError) {
    throw new Error("Yayınlanmış içerik kopyalanamadı.");
  }

  const dayIdMap = new Map<string, string>();
  for (const day of days) {
    const { data: newDay, error } = await supabase
      .from("care_template_days")
      .insert({
        organization_id: organizationId,
        template_version_id: targetVersionId,
        day_number: day.day_number,
        title: day.title,
        display_order: day.display_order
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !newDay) {
      throw new Error(mapTemplateDatabaseError(error ?? {}));
    }

    dayIdMap.set(day.id, newDay.id);
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("care_template_tasks")
    .select("template_day_id,title,description,task_type,required,display_order")
    .eq("organization_id", organizationId)
    .returns<Omit<TaskRow, "id">[]>();

  if (tasksError) {
    throw new Error("Görev içeriği kopyalanamadı.");
  }

  for (const task of tasks.filter((item) => dayIdMap.has(item.template_day_id))) {
    await supabase.from("care_template_tasks").insert({
      organization_id: organizationId,
      template_day_id: dayIdMap.get(task.template_day_id),
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      required: task.required,
      display_order: task.display_order
    });
  }
}

export async function addDayToDraft(formData: FormData) {
  const context = await requireOrganizationPermission("template.update");
  const versionId = String(formData.get("versionId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || null;
  const supabase = await createServerSupabaseClient();
  const { data: countData, error: countError } = await supabase
    .from("care_template_days")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organization.id)
    .eq("template_version_id", versionId);

  if (countError) {
    throw new Error("Gün bilgisi alınamadı.");
  }

  const nextDay = (countData ? 0 : 0) + ((await countTemplateDays(versionId, context.organization.id)) + 1);
  const { error } = await supabase.from("care_template_days").insert({
    organization_id: context.organization.id,
    template_version_id: versionId,
    day_number: nextDay,
    title,
    display_order: nextDay
  });

  if (error) {
    throw new Error(mapTemplateDatabaseError(error));
  }

  revalidatePath("/clinic/templates");
}

async function countTemplateDays(versionId: string, organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("care_template_days")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("template_version_id", versionId);

  if (error) {
    throw new Error("Gün sayısı alınamadı.");
  }

  return count ?? 0;
}

export async function addTaskToDraft(formData: FormData) {
  const context = await requireOrganizationPermission("template.update");
  const versionId = String(formData.get("versionId") ?? "");
  const parsed = parseTemplateTaskInput({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    taskType: String(formData.get("taskType") ?? "do") as TemplateTaskType,
    required: formData.get("required") !== "false"
  });
  const supabase = await createServerSupabaseClient();
  const { data: day, error: dayError } = await supabase
    .from("care_template_days")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("template_version_id", versionId)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (dayError || !day) {
    throw new Error("Görev eklemek için önce gün ekleyin.");
  }

  const { count } = await supabase
    .from("care_template_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organization.id)
    .eq("template_day_id", day.id);

  const { error } = await supabase.from("care_template_tasks").insert({
    organization_id: context.organization.id,
    template_day_id: day.id,
    title: parsed.title,
    description: parsed.description,
    task_type: parsed.taskType,
    required: parsed.required,
    display_order: (count ?? 0) + 1
  });

  if (error) {
    throw new Error(mapTemplateDatabaseError(error));
  }

  revalidatePath("/clinic/templates");
}

export async function addSymptomOptionToDraft(formData: FormData) {
  const context = await requireOrganizationPermission("template.update");
  const versionId = String(formData.get("versionId") ?? "");
  const parsed = parseSymptomOptionInput({
    label: String(formData.get("label") ?? ""),
    allowsSeverity: true,
    allowsNote: true
  });
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("symptom_options")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organization.id)
    .eq("template_version_id", versionId);
  const { error } = await supabase.from("symptom_options").insert({
    organization_id: context.organization.id,
    template_version_id: versionId,
    label: parsed.label,
    normalized_label: parsed.normalizedLabel,
    allows_severity: parsed.allowsSeverity,
    allows_note: parsed.allowsNote,
    display_order: (count ?? 0) + 1
  });

  if (error) {
    throw new Error(mapTemplateDatabaseError(error));
  }

  revalidatePath("/clinic/templates");
}

export async function addAlertRuleToDraft(formData: FormData) {
  const context = await requireOrganizationPermission("template.update");
  const versionId = String(formData.get("versionId") ?? "");
  const parsed = parseAlertRuleInput({
    ruleType: String(formData.get("ruleType") ?? "symptom_selected") as AlertRuleType,
    severityLevel: String(formData.get("severityLevel") ?? "medium") as AlertSeverityLevel,
    messageLabel: String(formData.get("messageLabel") ?? ""),
    symptomOptionId: String(formData.get("symptomOptionId") || "") || null,
    configuration: {}
  });
  const supabase = await createServerSupabaseClient();
  const { data: fallbackSymptom } = await supabase
    .from("symptom_options")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("template_version_id", versionId)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  const { error } = await supabase.from("alert_rules").insert({
    organization_id: context.organization.id,
    template_version_id: versionId,
    symptom_option_id: parsed.symptomOptionId ?? fallbackSymptom?.id ?? null,
    rule_type: parsed.ruleType,
    severity_level: parsed.severityLevel,
    configuration: parsed.configuration,
    message_label: parsed.messageLabel
  });

  if (error) {
    throw new Error(mapTemplateDatabaseError(error));
  }

  revalidatePath("/clinic/templates");
}

export async function publishDraftVersion(versionId: string) {
  const context = await requireActiveMembership();

  if (!hasPermission(context.membership, "template.publish")) {
    await writeAuditEvent({
      organizationId: context.organization.id,
      actorType: "user",
      actorUserId: context.user.id,
      action: "template.publish_denied",
      entityType: "template_version",
      entityId: versionId,
      result: "denied",
      safeMetadata: { reason: "permission_denied", permission_key: "template.publish" }
    });
    throw new Error("Bu işlem için yetkiniz yok.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("publish_care_template_version", {
    target_version_id: versionId
  });

  if (error) {
    throw new Error(mapTemplateDatabaseError(error));
  }

  const result = Array.isArray(data) ? data[0] : (data as { template_id?: string; version_id?: string } | null);
  revalidatePath("/clinic/templates");
  return {
    templateId: result?.template_id ?? null,
    versionId: result?.version_id ?? versionId
  };
}
