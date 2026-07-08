import { z } from "zod";

export const portalDocumentKindSchema = z.enum(["notice", "consent"]);
export const portalDocumentEventSchema = z.enum(["notice_acknowledged", "consent_accepted", "consent_declined", "consent_withdrawn"]);
export const portalDocumentDecisionSchema = z.enum(["not_recorded", "acknowledged", "accepted", "declined", "withdrawn"]);

export type PortalDocumentKind = z.infer<typeof portalDocumentKindSchema>;
export type PortalDocumentEvent = z.infer<typeof portalDocumentEventSchema>;
export type PortalDocumentDecision = z.infer<typeof portalDocumentDecisionSchema>;

export interface PortalDocumentAssignment {
  assignmentId: string;
  documentKind: PortalDocumentKind;
  documentCode: string;
  title: string;
  summaryText: string | null;
  bodyText: string;
  versionNumber: number;
  effectiveFrom: string | null;
  required: boolean;
  assignmentStatus: "pending" | "completed";
  currentDecision: PortalDocumentDecision;
  completedAt: string | null;
}

export function computePortalDocumentDecision(events: PortalDocumentEvent[]): PortalDocumentDecision {
  if (events.includes("consent_withdrawn")) {
    return "withdrawn";
  }
  if (events.includes("consent_accepted")) {
    return "accepted";
  }
  if (events.includes("consent_declined")) {
    return "declined";
  }
  if (events.includes("notice_acknowledged")) {
    return "acknowledged";
  }
  return "not_recorded";
}

export function canRecordPortalDocumentEvent(kind: PortalDocumentKind, event: PortalDocumentEvent, current: PortalDocumentDecision) {
  if (kind === "notice") {
    if (event !== "notice_acknowledged") {
      return { ok: false as const, reason: "document_kind_mismatch" as const };
    }
    return current === "acknowledged" || current === "not_recorded"
      ? { ok: true as const }
      : { ok: false as const, reason: "invalid_transition" as const };
  }

  if (event === "notice_acknowledged") {
    return { ok: false as const, reason: "document_kind_mismatch" as const };
  }

  if ((event === "consent_accepted" || event === "consent_declined") && current === "not_recorded") {
    return { ok: true as const };
  }

  if (event === "consent_withdrawn" && current === "accepted") {
    return { ok: true as const };
  }

  if (
    (event === "consent_accepted" && current === "accepted") ||
    (event === "consent_declined" && current === "declined") ||
    (event === "consent_withdrawn" && current === "withdrawn")
  ) {
    return { ok: true as const };
  }

  return { ok: false as const, reason: "invalid_transition" as const };
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function sanitizePortalDocumentAssignments(input: unknown): PortalDocumentAssignment[] {
  const rows = Array.isArray(input) ? (input as Array<Record<string, unknown>>) : [];
  return rows.map((row) => ({
    assignmentId: String(row.assignment_id ?? ""),
    documentKind: portalDocumentKindSchema.parse(row.document_kind),
    documentCode: String(row.document_code ?? ""),
    title: String(row.title ?? ""),
    summaryText: nullableString(row.summary_text),
    bodyText: String(row.body_text ?? ""),
    versionNumber: Number(row.version_number ?? 0),
    effectiveFrom: nullableString(row.effective_from),
    required: row.required === true,
    assignmentStatus: row.assignment_status === "completed" ? "completed" : "pending",
    currentDecision: portalDocumentDecisionSchema.parse(row.current_decision ?? "not_recorded"),
    completedAt: nullableString(row.completed_at)
  }));
}

export function sanitizePortalDocumentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("invalid") || message.includes("transition")) {
    return "Bu işlem mevcut durum için kullanılamıyor.";
  }
  if (message.includes("session") || message.includes("expired")) {
    return "Oturumunuzun süresi dolmuş olabilir.";
  }
  return "Tercihiniz kaydedilemedi. Lütfen tekrar deneyin.";
}
