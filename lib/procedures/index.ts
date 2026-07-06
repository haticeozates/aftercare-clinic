import { z } from "zod";

const procedureInputSchema = z.object({
  name: z.string().trim().min(2, "İşlem adı en az 2 karakter olmalı.").max(120),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(280).optional().or(z.literal(""))
});

export interface ProcedureInput {
  name: string;
  category?: string | null;
  description?: string | null;
}

export function normalizeProcedureName(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function parseProcedureInput(input: ProcedureInput) {
  const parsed = procedureInputSchema.parse(input);

  return {
    name: parsed.name,
    normalizedName: normalizeProcedureName(parsed.name),
    category: parsed.category === "" ? null : (parsed.category ?? null),
    description: parsed.description === "" ? null : (parsed.description ?? null)
  };
}

export function translateProcedureDatabaseError(error: { code?: string; message?: string }) {
  if (error.code === "23505" && error.message?.includes("procedures_normalized_name_unique")) {
    return "Bu işlem adı zaten kullanılıyor.";
  }

  if (error.code === "42501") {
    return "Bu işlem için yetkiniz yok.";
  }

  return "İşlem kaydı işlenemedi.";
}
