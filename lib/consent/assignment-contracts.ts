import { z } from "zod";

const createAssignmentInputSchema = z.object({
  clientId: z.string().uuid(),
  documentVersionId: z.string().uuid(),
  carePlanId: z.string().uuid().nullable().optional(),
  required: z.boolean().optional()
});

export function parseCreateAssignmentInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = createAssignmentInputSchema.parse({
    clientId: raw.clientId,
    documentVersionId: raw.documentVersionId,
    carePlanId: raw.carePlanId || null,
    required: raw.required === true || raw.required === "true" || raw.required === "on"
  });

  return {
    clientId: parsed.clientId,
    documentVersionId: parsed.documentVersionId,
    carePlanId: parsed.carePlanId ?? null,
    required: parsed.required ?? true
  };
}

export const ASSIGNMENT_GENERIC_ERROR = "Atama işlemi tamamlanamadı. Lütfen tekrar deneyin.";

const ASSIGNMENT_RPC_ERROR_MESSAGES: Record<string, string> = {
  "not found": "Kayıt bulunamadı.",
  "permission denied": "Bu işlem için yetkiniz yok.",
  "document version is not published": "Yalnızca yayımlanmış belge versiyonu atanabilir.",
  "document is archived": "Arşivlenmiş belgelere atama yapılamaz.",
  "invalid care plan": "Seçilen bakım planı bu müşteri için geçerli değil.",
  "assignment already exists": "Bu belge için zaten bekleyen bir atama var.",
  "assignment is not pending": "Yalnızca bekleyen atamalar iptal edilebilir.",
  "assignment already cancelled": "Bu atama zaten iptal edilmiş.",
  "assignment already completed": "Tamamlanmış atamalar iptal edilemez.",
  "concurrent state change": "İşlem sırasında durum değişti. Lütfen yenileyip tekrar deneyin."
};

type AssignmentTransportError = {
  code?: string;
  message?: string;
};

type AssignmentRpcResult = {
  error?: string;
  status?: string;
};

export function mapAssignmentRpcResult(
  transportError: AssignmentTransportError | null | undefined,
  rpcResult: AssignmentRpcResult | null | undefined
): string {
  if (rpcResult?.error) {
    return ASSIGNMENT_RPC_ERROR_MESSAGES[rpcResult.error] ?? ASSIGNMENT_GENERIC_ERROR;
  }

  if (transportError?.code === "23505") {
    return ASSIGNMENT_RPC_ERROR_MESSAGES["assignment already exists"] ?? ASSIGNMENT_GENERIC_ERROR;
  }

  if (transportError) {
    return ASSIGNMENT_GENERIC_ERROR;
  }

  return ASSIGNMENT_GENERIC_ERROR;
}

export type AssignmentStatus = "pending" | "completed" | "cancelled";

export function assignmentStatusLabel(status: AssignmentStatus) {
  return {
    pending: "Bekliyor",
    completed: "Tamamlandı",
    cancelled: "İptal edildi"
  }[status];
}
