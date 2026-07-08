import { describe, expect, it } from "vitest";
import {
  canRecordPortalDocumentEvent,
  computePortalDocumentDecision,
  portalDocumentEventSchema,
  sanitizePortalDocumentAssignments,
  sanitizePortalDocumentError
} from "@/lib/consent/portal-contracts";
import { sanitizeAuditMetadata } from "@/lib/audit";

describe("portal consent document contracts", () => {
  it("separates notice acknowledgment from consent decisions", () => {
    expect(portalDocumentEventSchema.parse("notice_acknowledged")).toBe("notice_acknowledged");
    expect(portalDocumentEventSchema.parse("consent_accepted")).toBe("consent_accepted");
    expect(canRecordPortalDocumentEvent("notice", "notice_acknowledged", "not_recorded")).toEqual({ ok: true });
    expect(canRecordPortalDocumentEvent("notice", "consent_accepted", "not_recorded")).toEqual({ ok: false, reason: "document_kind_mismatch" });
    expect(canRecordPortalDocumentEvent("consent", "notice_acknowledged", "not_recorded")).toEqual({ ok: false, reason: "document_kind_mismatch" });
  });

  it("allows accept or decline once and preserves withdrawal as append-only state", () => {
    expect(canRecordPortalDocumentEvent("consent", "consent_accepted", "not_recorded")).toEqual({ ok: true });
    expect(canRecordPortalDocumentEvent("consent", "consent_declined", "not_recorded")).toEqual({ ok: true });
    expect(canRecordPortalDocumentEvent("consent", "consent_withdrawn", "accepted")).toEqual({ ok: true });
    expect(canRecordPortalDocumentEvent("consent", "consent_accepted", "declined")).toEqual({ ok: false, reason: "invalid_transition" });
    expect(canRecordPortalDocumentEvent("consent", "consent_accepted", "withdrawn")).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("computes current decision from append-only events", () => {
    expect(computePortalDocumentDecision([])).toBe("not_recorded");
    expect(computePortalDocumentDecision(["notice_acknowledged"])).toBe("acknowledged");
    expect(computePortalDocumentDecision(["consent_accepted"])).toBe("accepted");
    expect(computePortalDocumentDecision(["consent_accepted", "consent_withdrawn"])).toBe("withdrawn");
    expect(computePortalDocumentDecision(["consent_declined"])).toBe("declined");
  });

  it("sanitizes assignment DTOs and excludes draft/internal fields", () => {
    const assignments = sanitizePortalDocumentAssignments([
      {
        assignment_id: "assignment-1",
        document_kind: "consent",
        document_code: "portal-consent",
        title: "Tercih belgesi",
        summary_text: "Kısa özet",
        body_text: "<strong>Plain text kalmalı</strong>",
        version_number: 2,
        effective_from: null,
        required: true,
        assignment_status: "pending",
        current_decision: "not_recorded",
        completed_at: null,
        organization_id: "blocked",
        portal_session_id: "blocked",
        published_by_user_id: "blocked"
      }
    ]);

    expect(assignments).toEqual([
      {
        assignmentId: "assignment-1",
        documentKind: "consent",
        documentCode: "portal-consent",
        title: "Tercih belgesi",
        summaryText: "Kısa özet",
        bodyText: "<strong>Plain text kalmalı</strong>",
        versionNumber: 2,
        effectiveFrom: null,
        required: true,
        assignmentStatus: "pending",
        currentDecision: "not_recorded",
        completedAt: null
      }
    ]);
  });

  it("does not allow body text or raw portal details into audit/error output", () => {
    expect(
      sanitizeAuditMetadata({
        document_kind: "consent",
        event_type: "consent_accepted",
        version_number: 1,
        source: "portal",
        body_text: "Temsili bilgilendirme metni",
        portal_session_hash: "blocked",
        token: "blocked",
        raw_request: "blocked"
      })
    ).toEqual({ document_kind: "consent", event_type: "consent_accepted", version_number: 1, source: "portal" });
    expect(sanitizePortalDocumentError(new Error("raw db body_text token"))).toBe("Tercihiniz kaydedilemedi. Lütfen tekrar deneyin.");
  });
});
