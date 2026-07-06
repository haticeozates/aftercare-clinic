import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  sanitizeAuditMetadata,
  validateAuditEvent
} from "@/lib/audit";

describe("audit metadata safety", () => {
  it("removes disallowed sensitive metadata keys", () => {
    const safe = sanitizeAuditMetadata({
      reason: "permission_denied",
      permission_key: "client.archive",
      target_role: "staff",
      token: "secret-token",
      email: "person@example.test",
      request_body: { unsafe: true },
      photo_url: "https://example.test/photo.jpg"
    });

    expect(safe).toEqual({
      reason: "permission_denied",
      permission_key: "client.archive",
      target_role: "staff"
    });
  });

  it("rejects unknown audit actions", () => {
    expect(() =>
      validateAuditEvent({
        organizationId: "org-alpha",
        actorType: "user",
        action: "unknown.created",
        entityType: "organization",
        result: "success",
        safeMetadata: {}
      })
    ).toThrow(/Unsupported audit action/);
  });

  it("accepts the foundation audit action catalog", () => {
    expect(AUDIT_ACTIONS).toContain("authorization.denied");
    expect(AUDIT_ACTIONS).toContain("client.created");
    expect(AUDIT_ACTIONS).toContain("procedure.updated");
  });
});
