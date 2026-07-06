import { z } from "zod";

export type TemplateStatus = "active" | "inactive";
export type TemplateVersionStatus = "draft" | "published" | "retired";
export type TemplateTaskType = "do" | "avoid" | "check" | "information";
export type AlertRuleType = "symptom_selected" | "severity_threshold" | "task_incomplete" | "photo_missing";
export type AlertSeverityLevel = "low" | "medium" | "high";

export interface TemplateInput {
  name: string;
  procedureId: string;
}

export interface TemplateTaskInput {
  title: string;
  description?: string | null;
  taskType: TemplateTaskType;
  required: boolean;
}

export interface AlertRuleInput {
  ruleType: AlertRuleType;
  severityLevel: AlertSeverityLevel;
  messageLabel: string;
  symptomOptionId?: string | null;
  configuration?: Record<string, unknown>;
}

export interface PublishPreconditionsInput {
  templateActive: boolean;
  procedureActive: boolean;
  dayCount: number;
  taskCount: number;
  status: TemplateVersionStatus;
}

const templateInputSchema = z.object({
  name: z.string().trim().min(2, "Şablon adı en az 2 karakter olmalı.").max(140),
  procedureId: z.string().uuid("Bağlı işlem seçilmeli.")
});

const taskInputSchema = z.object({
  title: z.string().trim().min(2, "Görev başlığı en az 2 karakter olmalı.").max(180),
  description: z.string().trim().max(600).optional().nullable(),
  taskType: z.enum(["do", "avoid", "check", "information"]),
  required: z.boolean()
});

const symptomOptionSchema = z.object({
  label: z.string().trim().min(2, "Belirti seçeneği en az 2 karakter olmalı.").max(160),
  allowsSeverity: z.boolean().default(false),
  allowsNote: z.boolean().default(true)
});

const alertRuleSchema = z.object({
  ruleType: z.enum(["symptom_selected", "severity_threshold", "task_incomplete", "photo_missing"]),
  severityLevel: z.enum(["low", "medium", "high"]),
  messageLabel: z.string().trim().min(2, "Kural mesajı en az 2 karakter olmalı.").max(180),
  symptomOptionId: z.string().uuid().optional().nullable(),
  configuration: z.record(z.string(), z.unknown()).optional()
});

const allowedConfigurationKeys = new Set(["threshold", "days", "required"]);

export function plainText(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  return input.replace(/[<>]/g, "").trim().replace(/\s+/g, " ") || null;
}

export function normalizeTemplateName(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function normalizeSymptomLabel(input: string): string {
  return normalizeTemplateName(input);
}

export function parseTemplateInput(input: TemplateInput) {
  const parsed = templateInputSchema.parse(input);

  return {
    name: parsed.name,
    normalizedName: normalizeTemplateName(parsed.name),
    procedureId: parsed.procedureId
  };
}

export function parseTemplateTaskInput(input: TemplateTaskInput) {
  const parsed = taskInputSchema.parse({
    ...input,
    description: plainText(input.description)
  });

  return {
    title: plainText(parsed.title) ?? "",
    description: parsed.description ? plainText(parsed.description) : null,
    taskType: parsed.taskType,
    required: parsed.required
  };
}

export function parseSymptomOptionInput(input: {
  label: string;
  allowsSeverity?: boolean;
  allowsNote?: boolean;
}) {
  const parsed = symptomOptionSchema.parse(input);

  return {
    label: plainText(parsed.label) ?? "",
    normalizedLabel: normalizeSymptomLabel(parsed.label),
    allowsSeverity: parsed.allowsSeverity,
    allowsNote: parsed.allowsNote
  };
}

export function parseAlertRuleInput(input: AlertRuleInput) {
  const parsed = alertRuleSchema.parse(input);
  const configuration: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed.configuration ?? {})) {
    if (allowedConfigurationKeys.has(key)) {
      configuration[key] = value;
    }
  }

  return {
    ruleType: parsed.ruleType,
    severityLevel: parsed.severityLevel,
    messageLabel: plainText(parsed.messageLabel) ?? "",
    symptomOptionId: parsed.symptomOptionId ?? null,
    configuration
  };
}

export function parseTemplateVersionPublishPreconditions(input: PublishPreconditionsInput) {
  if (input.status !== "draft") {
    return { ok: false as const, message: "Yalnız taslak versiyon yayına alınabilir." };
  }

  if (!input.templateActive) {
    return { ok: false as const, message: "Pasif şablon yayına alınamaz." };
  }

  if (!input.procedureActive) {
    return { ok: false as const, message: "Bağlı işlem aktif değil." };
  }

  if (input.dayCount < 1) {
    return { ok: false as const, message: "Yayına almak için en az bir gün gerekir." };
  }

  if (input.taskCount < 1) {
    return { ok: false as const, message: "Yayına almak için en az bir görev gerekir." };
  }

  return { ok: true as const };
}

export function canTransitionVersionStatus(from: TemplateVersionStatus, to: TemplateVersionStatus): boolean {
  if (from === to) {
    return true;
  }

  if (from === "draft") {
    return to === "published" || to === "retired";
  }

  if (from === "published") {
    return to === "retired";
  }

  return false;
}

export function mapTemplateDatabaseError(error: { code?: string; message?: string; details?: string }) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLocaleLowerCase("tr-TR");

  if (error.code === "23505") {
    if (
      message.includes("care_templates_normalized_name_unique") ||
      message.includes("care_templates_name_per_procedure_unique")
    ) {
      return "Bu işlem için aynı isimde bir şablon zaten var.";
    }

    return "Bu kayıt zaten var.";
  }

  if (message.includes("published template version is immutable")) {
    return "Bu yayınlanmış versiyon değiştirilemez. Yeni bir taslak oluşturun.";
  }

  if (message.includes("publish requires at least one day")) {
    return "Yayına almak için en az bir gün gerekir.";
  }

  if (message.includes("publish requires at least one task")) {
    return "Yayına almak için en az bir görev gerekir.";
  }

  if (error.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (error.code === "23503") {
    return "Seçilen kayıt bu organizasyon için geçerli değil.";
  }

  return "Bakım şablonu işlemi tamamlanamadı.";
}
