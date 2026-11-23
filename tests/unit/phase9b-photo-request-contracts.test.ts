import { describe, expect, it } from "vitest";
import {
  mapPhotoRequestRpcResult,
  parseCreatePhotoRequestInput,
  PHOTO_REQUEST_GENERIC_ERROR
} from "@/lib/photos/clinic-request-contracts";

describe("parseCreatePhotoRequestInput", () => {
  it("parses trusted plan/day fields without organization or client ids", () => {
    expect(
      parseCreatePhotoRequestInput({
        carePlanId: "00000000-0000-4000-8000-00000000e101",
        carePlanDayId: "00000000-0000-4000-8000-00000000f101",
        label: "Temsili fotoğraf talebi",
        required: "on",
        organizationId: "should-be-ignored",
        clientId: "should-be-ignored"
      })
    ).toEqual({
      carePlanId: "00000000-0000-4000-8000-00000000e101",
      carePlanDayId: "00000000-0000-4000-8000-00000000f101",
      label: "Temsili fotoğraf talebi",
      required: true
    });
  });

  it("rejects invalid uuids and empty labels", () => {
    expect(() =>
      parseCreatePhotoRequestInput({
        carePlanId: "not-a-uuid",
        carePlanDayId: "00000000-0000-4000-8000-00000000f101",
        label: "Temsili fotoğraf talebi"
      })
    ).toThrow();

    expect(() =>
      parseCreatePhotoRequestInput({
        carePlanId: "00000000-0000-4000-8000-00000000e101",
        carePlanDayId: "00000000-0000-4000-8000-00000000f101",
        label: " "
      })
    ).toThrow();
  });
});

describe("mapPhotoRequestRpcResult", () => {
  it("maps allowlisted RPC tokens to safe Turkish messages", () => {
    expect(mapPhotoRequestRpcResult(null, { error: "permission denied" })).toBe("Bu işlem için yetkiniz yok.");
    expect(mapPhotoRequestRpcResult(null, { error: "photo request already exists" })).toBe(
      "Bu plan günü için zaten aktif bir fotoğraf talebi var."
    );
    expect(mapPhotoRequestRpcResult(null, { error: "plan is not eligible" })).toMatch(/plan/i);
  });

  it("does not leak raw postgres unique-violation details", () => {
    const message = mapPhotoRequestRpcResult(
      {
        code: "23505",
        message: "duplicate key value violates unique constraint photo_requests_one_active_per_day"
      },
      null
    );

    expect(message).toBe("Bu plan günü için zaten aktif bir fotoğraf talebi var.");
    expect(message).not.toContain("photo_requests_one_active_per_day");
    expect(message).not.toContain("23505");
  });

  it("returns a generic message for unknown errors", () => {
    expect(mapPhotoRequestRpcResult(null, { error: "unexpected internal state" })).toBe(
      PHOTO_REQUEST_GENERIC_ERROR
    );
  });
});
