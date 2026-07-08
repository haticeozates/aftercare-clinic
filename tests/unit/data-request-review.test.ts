import { describe, expect, it } from "vitest";
import { mapDataRequestDatabaseError } from "@/lib/data-requests";

describe("mapDataRequestDatabaseError", () => {
  it("maps allowlisted RPC tokens to safe Turkish messages", () => {
    expect(mapDataRequestDatabaseError({ message: "invalid assignee" })).toBe(
      "Seçilen personel bu organizasyonda geçerli değil."
    );
    expect(mapDataRequestDatabaseError({ message: "invalid status transition" })).toBe("Bu durum geçişi yapılamaz.");
    expect(mapDataRequestDatabaseError({ message: "not found" })).toBe("Kayıt bulunamadı.");
  });

  it("does not leak raw postgres codes or messages", () => {
    const message = mapDataRequestDatabaseError({
      code: "42501",
      message: "permission denied for function transition_data_request_status"
    });
    expect(message).toBe("Bu işlem için yetkiniz yok.");
    expect(message).not.toContain("transition_data_request_status");
    expect(message).not.toContain("42501");
  });

  it("returns generic fallback for unknown errors", () => {
    expect(mapDataRequestDatabaseError({ message: "unexpected internal failure" })).toBe(
      "Veri talebi işlemi tamamlanamadı."
    );
  });
});
