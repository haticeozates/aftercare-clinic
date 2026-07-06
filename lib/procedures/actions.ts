"use server";

import { createProcedureFromForm, deactivateProcedure, updateProcedureFromForm } from "@/lib/procedures/service";

export async function createProcedureAction(formData: FormData) {
  await createProcedureFromForm(formData);
}

export async function deactivateProcedureAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deactivateProcedure(id);
}

export async function updateProcedureAction(formData: FormData) {
  await updateProcedureFromForm(formData);
}
