import { z } from "zod";

export type InquiryKind = "demo" | "contact";
export type InquiryField = "name" | "email" | "clinic" | "message";
export type InquiryState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fields?: Partial<Record<InquiryField, string>> };

const name = z
  .string()
  .trim()
  .min(2, "Adınızı ve soyadınızı girin.")
  .max(100, "En fazla 100 karakter girin.");
const email = z
  .email("Geçerli bir e-posta adresi girin.")
  .max(254, "E-posta adresi çok uzun.");
const clinic = z
  .string()
  .trim()
  .min(2, "Klinik veya kurum adını girin.")
  .max(140, "En fazla 140 karakter girin.");
const message = z
  .string()
  .trim()
  .min(10, "Mesajınız en az 10 karakter olmalı.")
  .max(1000, "Mesajınız en fazla 1.000 karakter olmalı.");
const demoSchema = z.object({ name, email, clinic });
const contactSchema = z.object({ name, email, message });

export function validateInquiry(kind: InquiryKind, form: FormData) {
  const read = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const fields = {
    name: read("name"),
    email: read("email").trim().toLowerCase(),
    clinic: read("clinic"),
    message: read("message")
  };
  return kind === "demo" ? demoSchema.safeParse(fields) : contactSchema.safeParse(fields);
}
