import { z } from "zod";

const createPhotoRequestInputSchema = z.object({
  carePlanId: z.string().uuid(),
  carePlanDayId: z.string().uuid(),
  label: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => !/<script/i.test(value), { message: "invalid label" }),
  required: z.boolean().optional()
});

export function parseCreatePhotoRequestInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = createPhotoRequestInputSchema.parse({
    carePlanId: raw.carePlanId,
    carePlanDayId: raw.carePlanDayId,
    label: raw.label,
    required: raw.required === true || raw.required === "true" || raw.required === "on"
  });

  return {
    carePlanId: parsed.carePlanId,
    carePlanDayId: parsed.carePlanDayId,
    label: parsed.label,
    required: parsed.required ?? false
  };
}

export const PHOTO_REQUEST_GENERIC_ERROR = "Fotoğraf talebi tamamlanamadı. Lütfen tekrar deneyin.";

const PHOTO_REQUEST_RPC_ERROR_MESSAGES: Record<string, string> = {
  "not found": "Kayıt bulunamadı.",
  "permission denied": "Bu işlem için yetkiniz yok.",
  "invalid label": "Talep açıklaması geçerli değil.",
  "plan is not eligible": "Bu plan durumunda fotoğraf talebi oluşturulamaz.",
  "photo request already exists": "Bu plan günü için zaten aktif bir fotoğraf talebi var."
};

type PhotoRequestTransportError = {
  code?: string;
  message?: string;
};

type PhotoRequestRpcResult = {
  error?: string;
  status?: string;
  photo_request_id?: string;
};

export function mapPhotoRequestRpcResult(
  transportError: PhotoRequestTransportError | null | undefined,
  rpcResult: PhotoRequestRpcResult | null | undefined
): string {
  if (rpcResult?.error) {
    return PHOTO_REQUEST_RPC_ERROR_MESSAGES[rpcResult.error] ?? PHOTO_REQUEST_GENERIC_ERROR;
  }

  if (transportError?.code === "23505") {
    return PHOTO_REQUEST_RPC_ERROR_MESSAGES["photo request already exists"] ?? PHOTO_REQUEST_GENERIC_ERROR;
  }

  if (transportError) {
    return PHOTO_REQUEST_GENERIC_ERROR;
  }

  return PHOTO_REQUEST_GENERIC_ERROR;
}

export type ClinicPhotoRequestDto = {
  id: string;
  carePlanDayId: string;
  label: string;
  required: boolean;
  status: "active" | "cancelled";
};
