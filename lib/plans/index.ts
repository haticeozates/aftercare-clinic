import { z } from "zod";

export type PlanStatus = "scheduled" | "active" | "completed" | "stopped";

const planCreateSchema = z.object({
  clientId: z.string().uuid(),
  procedureId: z.string().uuid(),
  careTemplateId: z.string().uuid(),
  templateVersionId: z.string().uuid(),
  startDate: z.iso.date(),
  controlDate: z.union([z.literal(""), z.iso.datetime({ local: true, offset: true })]).nullish(),
  responsibleMembershipId: z.string().uuid().optional().nullable()
});

export function effectivePlanStatus(status: PlanStatus, startDate: string, today: string): PlanStatus {
  return status === "scheduled" && startDate <= today ? "active" : status;
}

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
  // A clinic datetime-local input denotes Istanbul wall time (UTC+03:00).
  const controlDate = parsed.controlDate && !/(?:Z|[+-]\d{2}:\d{2})$/.test(parsed.controlDate)
    ? parsed.controlDate + "+03:00"
    : parsed.controlDate || null;
  return {
    clientId: parsed.clientId,
    procedureId: parsed.procedureId,
    careTemplateId: parsed.careTemplateId,
    templateVersionId: parsed.templateVersionId,
    startDate: parsed.startDate,
    controlDate,
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
