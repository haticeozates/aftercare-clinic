import { z } from "zod";

export type PlanStatus = "scheduled" | "active" | "completed" | "stopped";

const planCreateSchema = z.object({
  clientId: z.string().uuid(),
  procedureId: z.string().uuid(),
  careTemplateId: z.string().uuid(),
  templateVersionId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  controlDate: z.string().optional().nullable(),
  responsibleMembershipId: z.string().uuid().optional().nullable()
});

export function calculatePlanEndDate(startDate: string, maxDayNumber: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(1, maxDayNumber) - 1);
  return date.toISOString().slice(0, 10);
}

export function canTransitionPlanStatus(from: PlanStatus, to: PlanStatus) {
  if (from === to) {
    return true;
  }

  if (from === "scheduled") {
    return to === "active" || to === "stopped";
  }

  if (from === "active") {
    return to === "completed" || to === "stopped";
  }

  return false;
}

export function parsePlanCreateInput(input: Record<string, unknown>) {
  const parsed = planCreateSchema.parse(input);
  return {
    clientId: parsed.clientId,
    procedureId: parsed.procedureId,
    careTemplateId: parsed.careTemplateId,
    templateVersionId: parsed.templateVersionId,
    startDate: parsed.startDate,
    controlDate: parsed.controlDate ? parsed.controlDate : null,
    responsibleMembershipId: parsed.responsibleMembershipId ?? null
  };
}

export function planStatusLabel(status: PlanStatus) {
  const labels: Record<PlanStatus, string> = {
    scheduled: "Planlandı",
    active: "Aktif",
    completed: "Tamamlandı",
    stopped: "Durduruldu"
  };
  return labels[status];
}

export function mapPlanDatabaseError(error: { code?: string; message?: string }) {
  const message = (error.message ?? "").toLocaleLowerCase("tr-TR");

  if (message.includes("client must be active")) {
    return "Plan yalnız aktif danışan için oluşturulabilir.";
  }

  if (message.includes("template version must be published") || message.includes("current published")) {
    return "Yalnız yayınlanmış şablon versiyonundan plan oluşturulabilir.";
  }

  if (message.includes("procedure must be active")) {
    return "Plan yalnız aktif işlem için oluşturulabilir.";
  }

  if (message.includes("template must be active")) {
    return "Plan yalnız aktif şablon için oluşturulabilir.";
  }

  if (error.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Bakım planı işlemi tamamlanamadı.";
}
