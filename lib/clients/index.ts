import { z } from "zod";

const clientInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(120, "Ad soyad en fazla 120 karakter olmalı."),
  phone: z.string().trim().min(10, "Telefon numarası geçerli değil.").max(32),
  email: z
    .string()
    .trim()
    .email("E-posta adresi geçerli değil.")
    .max(160)
    .optional()
    .or(z.literal("")),
  responsibleMembershipId: z.string().uuid().nullable().optional()
});

export interface ClientInput {
  fullName: string;
  phone: string;
  email?: string | null;
  responsibleMembershipId?: string | null;
}

export function normalizeTurkishPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("90") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;

  if (!/^5\d{9}$/.test(withoutCountry)) {
    throw new Error("Telefon numarası geçerli değil.");
  }

  return `+90${withoutCountry}`;
}

export function maskPhoneForList(phoneNormalized: string): string {
  const digits = phoneNormalized.replace(/\D/g, "");
  const local = digits.startsWith("90") ? digits.slice(2) : digits;
  const prefix = `0${local.slice(0, 1)}`;
  const suffix = local.slice(-2);
  return `${prefix}•• ••• •• ${suffix}`;
}

export function parseClientInput(input: ClientInput) {
  const parsed = clientInputSchema.parse(input);
  const phoneNormalized = normalizeTurkishPhone(parsed.phone);
  const email = parsed.email === "" ? null : (parsed.email ?? null);

  return {
    fullName: parsed.fullName,
    phone: parsed.phone,
    phoneNormalized,
    email,
    responsibleMembershipId: parsed.responsibleMembershipId ?? null
  };
}

export function translateClientDatabaseError(error: { code?: string; message?: string }) {
  if (error.code === "23505" && error.message?.includes("clients_active_phone_unique")) {
    return "Bu telefon için aktif bir danışan kaydı zaten var.";
  }

  if (error.code === "42501") {
    return "Bu işlem için yetkiniz yok.";
  }

  if (error.code === "23503") {
    return "Seçilen sorumlu çalışan bu organizasyon için geçerli değil.";
  }

  return "Danışan kaydı işlenemedi.";
}
