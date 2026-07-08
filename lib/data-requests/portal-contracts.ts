import { z } from "zod";
import { dataRequestStatusSchema, dataRequestTypeSchema, type DataRequestStatus, type DataRequestType } from "@/lib/data-requests";

const portalDataRequestInputSchema = z.object({
  requestType: dataRequestTypeSchema,
  confirmed: z.literal(true)
});

export interface PortalDataRequest {
  id: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  submittedAt: string;
}

export function parsePortalDataRequestInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = portalDataRequestInputSchema.parse({
    requestType: raw.requestType,
    confirmed: raw.confirmed
  });
  return parsed;
}

export function sanitizePortalDataRequests(input: unknown): PortalDataRequest[] {
  const rows = Array.isArray(input) ? (input as Array<Record<string, unknown>>) : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    requestType: dataRequestTypeSchema.parse(row.request_type),
    status: dataRequestStatusSchema.parse(row.status),
    submittedAt: String(row.submitted_at ?? "")
  }));
}

export function sanitizePortalDataRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("session") || message.includes("expired")) {
    return "Oturumunuzun süresi dolmuş olabilir.";
  }
  if (message.includes("request_type") || message.includes("invalid")) {
    return "Talebiniz oluşturulamadı. Lütfen tekrar deneyin.";
  }
  return "Talebiniz oluşturulamadı. Lütfen tekrar deneyin.";
}
