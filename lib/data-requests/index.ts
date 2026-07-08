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
  "unsupported_request",
  "duplicate_request",
  "cancelled_by_client",
  "other_internal"
]);

export type DataRequestStatus = z.infer<typeof dataRequestStatusSchema>;
export type DataRequestType = z.infer<typeof dataRequestTypeSchema>;

const allowedTransitions: Record<DataRequestStatus, DataRequestStatus[]> = {
  submitted: ["under_review", "cancelled"],
  under_review: ["in_progress", "declined", "cancelled"],
  in_progress: ["completed", "declined"],
  completed: [],
  declined: [],
  cancelled: []
};

export function canTransitionDataRequestStatus(from: DataRequestStatus, to: DataRequestStatus) {
  return allowedTransitions[from].includes(to);
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
  if (error?.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }
  if (message.includes("invalid status transition")) {
    return "Bu durum geçişi yapılamaz.";
  }
  return "Veri talebi işlemi tamamlanamadı.";
}
