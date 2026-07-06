import { describe, expect, it } from "vitest";
import {
  normalizeProcedureName,
  parseProcedureInput,
  translateProcedureDatabaseError
} from "@/lib/procedures";

describe("procedure validation helpers", () => {
  it("normalizes procedure names for duplicate detection", () => {
    expect(normalizeProcedureName("  Alpha   Procedure ONE  ")).toBe("alpha procedure one");
  });

  it("validates a procedure without treatment instructions", () => {
    const parsed = parseProcedureInput({
      name: "  Temsili İşlem  ",
      category: "Demo",
      description: "Klinik tarafından yapılandırılacak temsili işlem kaydı"
    });

    expect(parsed).toEqual({
      name: "Temsili İşlem",
      normalizedName: "temsili işlem",
      category: "Demo",
      description: "Klinik tarafından yapılandırılacak temsili işlem kaydı"
    });
  });

  it("translates duplicate procedure database errors", () => {
    expect(
      translateProcedureDatabaseError({
        code: "23505",
        message: "duplicate key value violates unique constraint procedures_normalized_name_unique"
      })
    ).toBe("Bu işlem adı zaten kullanılıyor.");
  });
});
