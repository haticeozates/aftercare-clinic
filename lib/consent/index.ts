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
  const message = error?.message ?? "";
  if (error?.code === "23505") {
    return "Bu kodla bir belge zaten var.";
  }
  if (error?.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }
  if (message.includes("immutable")) {
    return "Yayınlanmış belge versiyonları değiştirilemez.";
  }
  return "Belge işlemi tamamlanamadı.";
}
