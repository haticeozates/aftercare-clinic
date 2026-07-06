"use server";

import { revalidatePath } from "next/cache";
import { createOrRotateSecureLink, revokeSecureLink } from "@/lib/secure-links/service";

export async function createLinkAction(
  _previous: { link?: string; linkId?: string; error?: string },
  formData: FormData
): Promise<{ link?: string; linkId?: string; error?: string }> {
  try {
    const link = await createOrRotateSecureLink(String(formData.get("planId") ?? ""), String(formData.get("endDate") ?? ""));
    return { link: link.link, linkId: link.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Güvenli bağlantı oluşturulamadı." };
  }
}

export async function rotateLinkAction(
  _previous: { link?: string; linkId?: string; error?: string },
  formData: FormData
): Promise<{ link?: string; linkId?: string; error?: string }> {
  return createLinkAction(_previous, formData);
}

export async function revokeLinkAction(
  _previous: { success?: boolean; error?: string },
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const planId = String(formData.get("planId") ?? "");
  try {
    await revokeSecureLink(String(formData.get("linkId") ?? ""));
    revalidatePath(`/clinic/plans/${planId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Güvenli bağlantı iptal edilemedi." };
  }
}
