import { z } from "zod";

export const dataRequestTypeSchema = z.enum([
  "access",
  "copy",
  "correction",
  "deletion",
  "restriction",
  "objection",
  "withdraw_consent",
  "other"
]);

export const dataRequestStatusSchema = z.enum([
  "submitted",
  "under_review",
  "in_progress",
  "completed",
  "declined",
  "cancelled"
]);

export const dataRequestFinalStatuses = ["completed", "declined", "cancelled"] as const;

export const dataRequestResolutionCodeSchema = z.enum([
  "completed_without_export",
  "manual_review_completed",
  "manual_review_declined",
  "manual_review_cancelled",
  "unsupported_request",
  "duplicate_request",
  "cancelled_by_client",
  "other_internal"
]);

export type DataRequestStatus = z.infer<typeof dataRequestStatusSchema>;
export type DataRequestType = z.infer<typeof dataRequestTypeSchema>;

export const dataRequestAllowedTransitions: Record<DataRequestStatus, DataRequestStatus[]> = {
  submitted: ["under_review", "cancelled"],
  under_review: ["in_progress", "declined", "cancelled"],
  in_progress: ["completed", "declined"],
  completed: [],
  declined: [],
  cancelled: []
};

export function canTransitionDataRequestStatus(from: DataRequestStatus, to: DataRequestStatus) {
  return dataRequestAllowedTransitions[from].includes(to);
}

export function nextDataRequestStatuses(status: DataRequestStatus): DataRequestStatus[] {
  return dataRequestAllowedTransitions[status];
}

export function resolveDataRequestResolutionCode(status: DataRequestStatus) {
  if (status === "completed") {
    return "manual_review_completed" as const;
  }
  if (status === "declined") {
    return "manual_review_declined" as const;
  }
  if (status === "cancelled") {
    return "manual_review_cancelled" as const;
  }
  return null;
}

const createInputSchema = z.object({
  clientId: z.string().uuid(),
  carePlanId: z.string().uuid().nullable().optional(),
  requestType: dataRequestTypeSchema
});

export function parseDataRequestCreateInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = createInputSchema.parse({
    clientId: raw.clientId,
    carePlanId: raw.carePlanId || null,
    requestType: raw.requestType
  });

  return {
    clientId: parsed.clientId,
    carePlanId: parsed.carePlanId ?? null,
    requestType: parsed.requestType
  };
}

const transitionInputSchema = z.object({
  status: dataRequestStatusSchema,
  resolutionCode: dataRequestResolutionCodeSchema.nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional()
});

export function parseDataRequestTransitionInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = transitionInputSchema.parse({
    status: raw.status,
    resolutionCode: raw.resolutionCode || null,
    assignedToUserId: raw.assignedToUserId || null
  });

  return {
    status: parsed.status,
    resolutionCode: parsed.resolutionCode ?? null,
    assignedToUserId: parsed.assignedToUserId ?? null
  };
}

export function mapDataRequestDatabaseError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  const token = message.trim();

  const messages: Record<string, string> = {
    "not found": "Kayıt bulunamadı.",
    "permission denied": "Bu işlem için yetkiniz yok.",
    "invalid status transition": "Bu durum geçişi yapılamaz.",
    "invalid assignee": "Seçilen personel bu organizasyonda geçerli değil.",
    "invalid status": "Geçersiz durum.",
    "invalid resolution code": "Geçersiz çözüm kodu.",
    "concurrent state change": "İşlem sırasında durum değişti. Lütfen yenileyip tekrar deneyin."
  };

  if (messages[token]) {
    return messages[token];
  }

  if (error?.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Veri talebi işlemi tamamlanamadı.";
}
