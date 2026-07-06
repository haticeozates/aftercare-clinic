import crypto from "node:crypto";
import type { AppEnv } from "@/lib/types";

export function createSecureToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSecureToken(token: string, pepper: string) {
  return crypto.createHash("sha256").update(`${token}.${pepper}`).digest("hex");
}

export function buildCareTokenPath(token: string) {
  return `/care/t/${encodeURIComponent(token)}`;
}

export function maskTokenPrefix(prefix: string | null | undefined) {
  if (!prefix) {
    return "•••";
  }
  return `${prefix.slice(0, 3)}...`;
}

export function tokenValidationFailureMessage() {
  return "Bağlantı geçersiz veya süresi dolmuş.";
}

export function parsePortalSessionCookieOptions(appEnv: AppEnv) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appEnv === "production",
    path: "/care",
    maxAge: 15 * 60
  };
}

export function defaultLinkExpiry(endDate: string) {
  const date = new Date(`${endDate}T23:59:59.000Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString();
}

export function mapSecureLinkDatabaseError(error: { code?: string; message?: string }) {
  const message = (error.message ?? "").toLocaleLowerCase("tr-TR");

  if (message.includes("stopped plan")) {
    return "Durdurulan plan için güvenli bağlantı oluşturulamaz.";
  }

  if (message.includes("plan not found")) {
    return "Plan kaydı bulunamadı.";
  }

  if (error.code === "42501" || message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Güvenli bağlantı işlemi tamamlanamadı.";
}
