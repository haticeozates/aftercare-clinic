import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit";
import {
  assignmentStatusLabel,
  mapAssignmentRpcResult,
  parseCreateAssignmentInput
} from "@/lib/consent/assignment-contracts";

describe("parseCreateAssignmentInput", () => {
  it("parses trusted assignment fields only", () => {
    expect(
      parseCreateAssignmentInput({
        clientId: "00000000-0000-4000-8000-00000000c101",
        documentVersionId: "00000000-0000-4000-8000-00000000b311",
        carePlanId: "00000000-0000-4000-8000-00000000e101",
        required: "on"
      })
    ).toEqual({
      clientId: "00000000-0000-4000-8000-00000000c101",
      documentVersionId: "00000000-0000-4000-8000-00000000b311",
      carePlanId: "00000000-0000-4000-8000-00000000e101",
      required: true
    });
  });

  it("rejects invalid uuids", () => {
    expect(() =>
      parseCreateAssignmentInput({
        clientId: "not-a-uuid",
        documentVersionId: "00000000-0000-4000-8000-00000000b311"
      })
    ).toThrow();
  });
});

describe("mapAssignmentRpcResult", () => {
  it("maps allowlisted assignment RPC tokens to safe Turkish messages", () => {
    expect(mapAssignmentRpcResult(null, { error: "assignment already exists" })).toBe(
      "Bu belge için zaten bekleyen bir atama var."
    );
    expect(mapAssignmentRpcResult(null, { error: "document is archived" })).toBe(
      "Arşivlenmiş belgelere atama yapılamaz."
    );
    expect(mapAssignmentRpcResult(null, { error: "permission denied" })).toBe("Bu işlem için yetkiniz yok.");
  });

  it("does not leak raw postgres transport errors", () => {
    const message = mapAssignmentRpcResult(
      { code: "23505", message: "duplicate key value violates unique constraint client_doc_assignments_pending_global_unique" },
      null
    );
    expect(message).toBe("Bu belge için zaten bekleyen bir atama var.");
    expect(message).not.toContain("client_doc_assignments");
  });

  it("returns generic message for unknown RPC errors", () => {
    expect(mapAssignmentRpcResult(null, { error: "unexpected internal state" })).toContain("tamamlanamadı");
  });
});

describe("assignment audit allowlist", () => {
  it("includes consent_assignment.cancelled", () => {
    expect(AUDIT_ACTIONS).toContain("consent_assignment.cancelled");
  });
});

describe("assignmentStatusLabel", () => {
  it("labels assignment statuses in Turkish", () => {
    expect(assignmentStatusLabel("pending")).toBe("Bekliyor");
    expect(assignmentStatusLabel("cancelled")).toBe("İptal edildi");
  });
});
