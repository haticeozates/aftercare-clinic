"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveMembership, requireOrganizationPermission } from "@/lib/auth/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { consumeSecurityRateLimit } from "@/lib/rate-limit/consume";
import { RATE_LIMIT_SCOPES } from "@/lib/rate-limit/types";
import { deriveRateLimitClientFacet } from "@/lib/rate-limit/keys";
import {
  appointmentInput, dayInput, minuteOfDay, minutesInput, publicBookingEnabled, requestInput,
  slugInput, statuses, uuid
} from "./contracts";

export type FormState = { error?: string; success?: string };

function errorMessage(code: string | undefined) {
  if (code === "23P01") return "Bu saat dolu. Farklı bir saat seçin.";
  if (code === "42501") return "Seçilen kayıt veya işlem için yetkiniz bulunmuyor.";
  if (code === "22023" || code === "23514") return "Saat, müsaitlik veya randevu durumu bu işleme uygun değil.";
  return "İşlem tamamlanamadı. Bilgileri kontrol ederek tekrar deneyin.";
}

export async function saveAppointment(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActiveMembership();
  const parsed = appointmentInput.safeParse(Object.fromEntries(form));
  const id = form.get("id");
  if (!parsed.success || (id && !uuid.safeParse(id).success)) {
    return { error: "Danışan, işlem, uzman, tarih ve süre alanlarını kontrol edin." };
  }
  const { data, error } = await createAdminSupabaseClient().rpc("phase12_write", {
    actor: actor.user.id, clinic: actor.organization.id, operation: id ? "edit" : "create",
    appointment: id || null, payload: parsed.data
  });
  if (error || !data) return { error: errorMessage(error?.code) };
  revalidatePath("/clinic/appointments", "layout");
  revalidatePath("/clinic");
  redirect(`/clinic/appointments/${data}`);
}

export async function updateAppointmentStatus(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActiveMembership();
  const parsed = z.object({ id: uuid, status: z.enum(statuses), client_id: z.union([uuid, z.literal("")]).optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Geçerli bir randevu durumu seçin." };
  const { id, ...payload } = parsed.data;
  const { error } = await createAdminSupabaseClient().rpc("phase12_write", {
    actor: actor.user.id, clinic: actor.organization.id, operation: "status", appointment: id, payload
  });
  if (error) return { error: errorMessage(error.code) };
  revalidatePath(`/clinic/appointments/${id}`);
  revalidatePath("/clinic/appointments");
  revalidatePath("/clinic");
  return { success: "Randevu durumu güncellendi." };
}

export async function saveAvailability(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireOrganizationPermission("organization.update");
  const operation = form.get("operation");
  const demo = form.get("public_demo") === "on";
  const payload: Record<string, string | number | boolean | null> = {};
  switch (operation) {
    case "public":
      payload.public_demo = demo && publicBookingEnabled();
      break;
    case "service": {
      const procedure = uuid.safeParse(form.get("procedure_id"));
      const minutes = minutesInput.safeParse(form.get("minutes"));
      if (!procedure.success || !minutes.success) return { error: "İşlem ve 5 dakikanın katı olan süreyi seçin." };
      payload.procedure_id = procedure.data;
      payload.minutes = minutes.data;
      payload.public_demo = demo && publicBookingEnabled();
      break;
    }
    case "rule": {
      const id = form.get("membership_id");
      const kind = z.enum(["work", "break", "closed"]).safeParse(form.get("kind"));
      const start = minuteOfDay(String(form.get("start") ?? ""));
      const end = minuteOfDay(String(form.get("end") ?? ""));
      if (!kind.success || (id && !uuid.safeParse(id).success) || !(start < end)) {
        return { error: "Geçerli bir kapsam, kural ve saat aralığı seçin." };
      }
      payload.kind = kind.data;
      payload.membership_id = id ? String(id) : null;
      payload.start_minute = start;
      payload.end_minute = end;
      if (kind.data === "closed") {
        const date = dayInput.safeParse(form.get("local_date"));
        if (!date.success) return { error: "Kapalı gün için tarih seçin." };
        payload.local_date = date.data;
      } else {
        const weekday = z.coerce.number().int().min(1).max(7).safeParse(form.get("weekday"));
        if (!weekday.success) return { error: "Haftalık kural için gün seçin." };
        payload.weekday = weekday.data;
      }
      break;
    }
    case "remove": {
      const id = uuid.safeParse(form.get("id"));
      if (!id.success) return { error: "Müsaitlik kuralı bulunamadı." };
      payload.id = id.data;
      break;
    }
    default:
      return { error: "Geçerli bir ayar seçin." };
  }
  const { error } = await createAdminSupabaseClient().rpc("phase12_configure", {
    actor: actor.user.id, clinic: actor.organization.id, operation, payload
  });
  if (error) return { error: errorMessage(error.code) };
  revalidatePath("/clinic/appointments/availability");
  return { success: operation === "remove" ? "Müsaitlik kuralı kaldırıldı." : "Takvim ayarı kaydedildi." };
}

export async function requestAppointment(slug: string, _previous: FormState, form: FormData): Promise<FormState> {
  if (!publicBookingEnabled() || !slugInput.safeParse(slug).success) notFound();
  const generic = "Talep alınamadı. Müsait saatleri yenileyerek tekrar deneyin.";
  const parsed = requestInput.safeParse(Object.fromEntries(form));
  if (form.get("website")) return { error: generic };
  if (!parsed.success) return { error: "Bir müsait saat ve DEMO-1234 biçiminde bir sentetik kod girin." };
  const limit = await consumeSecurityRateLimit({
    scope: RATE_LIMIT_SCOPES.APPOINTMENT_DEMO,
    route: "/booking/request", clientFacet: deriveRateLimitClientFacet(slug)
  });
  if (!limit.allowed) return { error: generic };
  const { error } = await createAdminSupabaseClient().rpc("phase12_request", { clinic_slug: slug, payload: parsed.data });
  if (error) return { error: generic };
  return { success: "Talebiniz alındı ve klinik onayı bekliyor. Seçilen saat klinik kararına kadar ayrıldı." };
}
