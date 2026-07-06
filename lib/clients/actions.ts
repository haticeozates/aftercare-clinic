"use server";

import { archiveClient, createClientFromForm } from "@/lib/clients/service";

export async function createClientAction(formData: FormData) {
  await createClientFromForm(formData);
}

export async function archiveClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await archiveClient(id);
}
