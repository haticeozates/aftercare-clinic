"use server";

import { archiveClient, createClientFromForm, updateClientFromForm } from "@/lib/clients/service";
import { insertClientFromForm } from "@/lib/clients/service";
import { redirect } from "next/navigation";

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

export async function updateClientAction(formData: FormData) {
  await updateClientFromForm(formData);
}
