import { describe, expect, it } from "vitest";
import {
  canTransitionDataRequestStatus,
  dataRequestFinalStatuses,
  dataRequestStatusSchema,
  dataRequestTypeSchema,
  parseDataRequestCreateInput,
  parseDataRequestTransitionInput
} from "@/lib/data-requests";
import { sanitizeAuditMetadata } from "@/lib/audit";
import { hasPermission, type Membership } from "@/lib/authorization";

const owner: Membership = {
  organizationId: "org-alpha",
  roleKey: "organization_owner",
  status: "active"
};

const staff: Membership = {
  organizationId: "org-alpha",
  roleKey: "staff",
  status: "active"
};

describe("data request foundation rules", () => {
  it("validates jurisdiction-neutral request types", () => {
    expect(dataRequestTypeSchema.parse("access")).toBe("access");
    expect(dataRequestTypeSchema.parse("withdraw_consent")).toBe("withdraw_consent");
    expect(() => dataRequestTypeSchema.parse("kvkk_delete_now")).toThrow();
  });

  it("validates statuses and final states", () => {
    expect(dataRequestStatusSchema.parse("submitted")).toBe("submitted");
    expect(dataRequestFinalStatuses).toEqual(["completed", "declined", "cancelled"]);
  });

  it("allows only explicit status transitions", () => {
    expect(canTransitionDataRequestStatus("submitted", "under_review")).toBe(true);
    expect(canTransitionDataRequestStatus("submitted", "cancelled")).toBe(true);
    expect(canTransitionDataRequestStatus("under_review", "in_progress")).toBe(true);
    expect(canTransitionDataRequestStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionDataRequestStatus("completed", "under_review")).toBe(false);
    expect(canTransitionDataRequestStatus("declined", "in_progress")).toBe(false);
  });

  it("parses create input without accepting destructive instructions or organization tampering", () => {
    const parsed = parseDataRequestCreateInput({
      clientId: "00000000-0000-4000-8000-00000000c101",
      carePlanId: "",
      requestType: "copy",
      organization_id: "tamper",
      deleteAllData: true,
      freeText: "blocked"
    });

    expect(parsed).toEqual({
      clientId: "00000000-0000-4000-8000-00000000c101",
      carePlanId: null,
      requestType: "copy"
    });
  });

  it("parses transition input with resolution code allowlist", () => {
    expect(
      parseDataRequestTransitionInput({
        status: "declined",
        resolutionCode: "unsupported_request"
      })
    ).toEqual({ status: "declined", resolutionCode: "unsupported_request", assignedToUserId: null });
    expect(() => parseDataRequestTransitionInput({ status: "declined", resolutionCode: "free text reason" })).toThrow();
  });

  it("does not grant staff data request manage access by default", () => {
    expect(hasPermission(owner, "data_request.read")).toBe(true);
    expect(hasPermission(owner, "data_request.manage")).toBe(true);
    expect(hasPermission(staff, "data_request.read")).toBe(true);
    expect(hasPermission(staff, "data_request.manage")).toBe(false);
  });

  it("keeps request free text and PII out of audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        request_type: "access",
        previous_status: "submitted",
        new_status: "under_review",
        free_text: "blocked request detail",
        client_name: "Temsili Danışan",
        email: "client@example.test",
        source: "unit"
      })
    ).toEqual({
      request_type: "access",
      previous_status: "submitted",
      new_status: "under_review",
      source: "unit"
    });
  });
});
