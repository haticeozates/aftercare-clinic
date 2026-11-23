"use server";

import { revalidatePath } from "next/cache";
import { createOrRotateSecureLink, revokeSecureLink } from "@/lib/secure-links/service";
import { toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

const SECURE_LINK_GENERIC_ERROR = "Güvenli bağlantı işlemi tamamlanamadı.";

export async function createLinkAction(
  _previous: { link?: string; linkId?: string; error?: string },
  formData: FormData
): Promise<{ link?: string; linkId?: string; error?: string }> {
  try {
    const link = await createOrRotateSecureLink(String(formData.get("planId") ?? ""));
    return { link: link.link, linkId: link.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { error: toSafeUserFeedbackMessage(message, SECURE_LINK_GENERIC_ERROR) };
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
    const message = error instanceof Error ? error.message : undefined;
    return { error: toSafeUserFeedbackMessage(message, SECURE_LINK_GENERIC_ERROR) };
  }
}
