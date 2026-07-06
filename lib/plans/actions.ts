"use server";

import { redirect } from "next/navigation";
import { createPlanFromForm, stopPlan } from "@/lib/plans/service";

export async function createPlanAction(
  _previous: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  let id: string;
  try {
    id = await createPlanFromForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Bakım planı oluşturulamadı." };
  }

  redirect(`/clinic/plans/${id}`);
}

export async function stopPlanAction(formData: FormData) {
  await stopPlan(String(formData.get("planId") ?? ""));
}
