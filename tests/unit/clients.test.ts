import { describe, expect, it } from "vitest";
import {
  maskPhoneForList,
  normalizeTurkishPhone,
  parseClientInput,
  translateClientDatabaseError
} from "@/lib/clients";

describe("client validation and privacy helpers", () => {
  it("normalizes Turkish mobile phone numbers to a single E.164-like format", () => {
    expect(normalizeTurkishPhone("0555 010 00 01")).toBe("+905550100001");
    expect(normalizeTurkishPhone("+90 555 010 00 01")).toBe("+905550100001");
  });

  it("masks phone numbers for list views", () => {
    expect(maskPhoneForList("+905550100042")).toBe("05•• ••• •• 42");
  });

  it("validates minimal client input without medical fields", () => {
    const parsed = parseClientInput({
      fullName: "  Synthetic Client  ",
      phone: "0555 010 00 01",
      email: "synthetic-client@example.test",
      responsibleMembershipId: null
    });

    expect(parsed).toEqual({
      fullName: "Synthetic Client",
      phone: "0555 010 00 01",
      phoneNormalized: "+905550100001",
      email: "synthetic-client@example.test",
      responsibleMembershipId: null
    });
  });

  it("translates duplicate phone database errors without echoing PII", () => {
    expect(
      translateClientDatabaseError({
        code: "23505",
        message: "duplicate key value violates unique constraint clients_active_phone_unique"
      })
    ).toBe("Bu telefon için aktif bir danışan kaydı zaten var.");
  });
});
