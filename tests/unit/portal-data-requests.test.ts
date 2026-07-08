import { describe, expect, it } from "vitest";
import {
  parsePortalDataRequestInput,
  sanitizePortalDataRequestError,
  sanitizePortalDataRequests
} from "@/lib/data-requests/portal-contracts";
import { sanitizeAuditMetadata } from "@/lib/audit";

describe("portal data request contracts", () => {
  it("validates request type and requires confirmation without free text", () => {
    expect(parsePortalDataRequestInput({ requestType: "access", confirmed: true })).toEqual({
      requestType: "access",
      confirmed: true
    });
    expect(() => parsePortalDataRequestInput({ requestType: "kvkk_delete_now", confirmed: true })).toThrow();
    expect(() => parsePortalDataRequestInput({ requestType: "copy", confirmed: false })).toThrow();
    expect(parsePortalDataRequestInput({ requestType: "other", confirmed: true, freeText: "not accepted" })).not.toHaveProperty("freeText");
  });

  it("sanitizes own request list without internal workflow details", () => {
    expect(
      sanitizePortalDataRequests([
        {
          id: "request-1",
          request_type: "copy",
          status: "submitted",
          submitted_at: "2026-07-08T10:00:00.000Z",
          organization_id: "blocked",
          client_id: "blocked",
          resolution_code: "blocked"
        }
      ])
    ).toEqual([
      {
        id: "request-1",
        requestType: "copy",
        status: "submitted",
        submittedAt: "2026-07-08T10:00:00.000Z"
      }
    ]);
  });

  it("keeps body/free text and PII out of audit and errors", () => {
    expect(
      sanitizeAuditMetadata({
        request_type: "access",
        new_status: "submitted",
        source: "portal",
        body_text: "blocked",
        free_text: "blocked",
        email: "client@example.test",
        token: "blocked"
      })
    ).toEqual({ request_type: "access", new_status: "submitted", source: "portal" });
    expect(sanitizePortalDataRequestError(new Error("raw postgres token email"))).toBe("Talebiniz oluşturulamadı. Lütfen tekrar deneyin.");
  });
});
