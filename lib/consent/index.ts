import { z } from "zod";

export const consentDocumentKindSchema = z.enum(["notice", "consent"]);
export const consentVersionStatusSchema = z.enum(["draft", "published", "retired"]);
export const consentDocumentStatusSchema = z.enum(["active", "inactive", "archived"]);

export type ConsentDocumentKind = z.infer<typeof consentDocumentKindSchema>;
export type ConsentVersionStatus = z.infer<typeof consentVersionStatusSchema>;

export const noticeEventTypes = ["presented", "notice_acknowledged"] as const;
export const consentDecisionEventTypes = ["consent_accepted", "consent_declined", "consent_withdrawn"] as const;

export function canTransitionConsentVersionStatus(from: ConsentVersionStatus, to: ConsentVersionStatus) {
  return (
    (from === "draft" && to === "published") ||
    (from === "draft" && to === "retired") ||
    (from === "published" && to === "retired")
  );
}

export function isPublishedConsentVersionImmutable(status: ConsentVersionStatus) {
  return status === "published" || status === "retired";
}

const consentDocumentInputSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,80}$/),
  title: z.string().trim().min(2).max(160),
  documentKind: consentDocumentKindSchema,
  purposeKey: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{1,80}$/)
});

export function parseConsentDocumentInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  return consentDocumentInputSchema.parse({
    code: raw.code,
    title: raw.title,
    documentKind: raw.documentKind,
    purposeKey: raw.purposeKey
  });
}

const consentVersionInputSchema = z.object({
  titleSnapshot: z.string().trim().min(2).max(160),
  bodyText: z.string().trim().min(20).max(20_000),
  summaryText: z.string().trim().min(2).max(1_000).nullable().optional()
});

export function parseConsentVersionInput(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = consentVersionInputSchema.parse({
    titleSnapshot: raw.titleSnapshot,
    bodyText: raw.bodyText,
    summaryText: raw.summaryText || null
  });

  return {
    ...parsed,
    summaryText: parsed.summaryText ?? null
  };
}

export function mapConsentDatabaseError(error: { code?: string; message?: string } | null | undefined) {
  return mapConsentRpcResult(error, null);
}

export const CONSENT_GENERIC_ERROR = "Belge işlemi tamamlanamadı. Lütfen tekrar deneyin.";

const CONSENT_RPC_ERROR_MESSAGES: Record<string, string> = {
  "permission denied": "Bu işlem için yetkiniz yok.",
  "not found": "Belge bulunamadı.",
  "draft already exists": "Bu belge için zaten aktif bir taslak var.",
  "version conflict": "Versiyon oluşturulurken bir çakışma oluştu. Lütfen tekrar deneyin.",
  "content is required": "Yayınlamadan önce başlık ve belge metni zorunludur.",
  "document is archived": "Arşivlenmiş belgelerde değişiklik yapılamaz.",
  "version is not draft": "Yalnızca taslak versiyonlar güncellenebilir.",
  "source version must be published or retired":
    "Yeni taslak yalnızca yayımlanmış bir versiyondan oluşturulabilir."
};

type ConsentTransportError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type ConsentRpcResult = {
  error?: string;
  status?: string;
};

export function mapConsentRpcResult(
  transportError: ConsentTransportError | null | undefined,
  rpcResult: ConsentRpcResult | null | undefined
): string {
  if (rpcResult?.error) {
    return CONSENT_RPC_ERROR_MESSAGES[rpcResult.error] ?? CONSENT_GENERIC_ERROR;
  }

  if (transportError?.code === "23505") {
    return "Bu kodla bir belge zaten var.";
  }

  if (transportError) {
    return CONSENT_GENERIC_ERROR;
  }

  return CONSENT_GENERIC_ERROR;
}

export type ConsentVersionDraftSource = {
  id: string;
  status: ConsentVersionStatus;
  versionNumber: number;
};

export function selectPublishedVersionForNewDraft(versions: ConsentVersionDraftSource[]): string | null {
  const source = versions
    .filter((version) => version.status === "published" || version.status === "retired")
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];

  return source?.id ?? null;
}
