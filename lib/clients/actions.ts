"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { archiveClient, createClientFromForm, updateClientFromForm } from "@/lib/clients/service";
import { insertClientFromForm } from "@/lib/clients/service";
import { toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

const CLIENT_GENERIC_ERROR = "Danışan kaydı işlenemedi.";

export type ClientFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: {
    fullName?: string;
    phone?: string;
  };
};

export async function createClientAction(formData: FormData) {
  await createClientFromForm(formData);
}

export async function createClientFormAction(
  _previous: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  let id: string;
  try {
    id = await insertClientFromForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Danışan kaydı işlenemedi." };
  }

  redirect(`/clinic/clients/${id}`);
}

export async function archiveClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await archiveClient(id);
}

export async function archiveClientFormAction(
  _previous: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  try {
    await archiveClient(String(formData.get("id") ?? ""));
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { error: toSafeUserFeedbackMessage(message, CLIENT_GENERIC_ERROR) };
  }
}

export async function updateClientAction(formData: FormData) {
  await updateClientFromForm(formData);
}

export async function updateClientFormAction(
  _previous: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  try {
    await updateClientFromForm(formData);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: ClientFormState["fieldErrors"] = {};
      for (const issue of error.issues) {
        const field = issue.path[0];
        if (field === "fullName" || field === "phone") {
          fieldErrors[field] = issue.message;
        }
      }
      return { error: "Lütfen işaretli alanları kontrol edin.", fieldErrors };
    }

    const message = error instanceof Error ? error.message : undefined;
    return { error: toSafeUserFeedbackMessage(message, CLIENT_GENERIC_ERROR) };
  }
}
