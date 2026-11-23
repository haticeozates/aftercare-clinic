"use server";

import { redirect } from "next/navigation";
import { createPlanFromForm, stopPlan } from "@/lib/plans/service";
import { toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

const PLAN_GENERIC_ERROR = "Bakım planı işlemi tamamlanamadı.";

export type PlanActionState = {
  error?: string;
  success?: boolean;
};

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

export async function stopPlanFormAction(
  _previous: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  try {
    await stopPlan(String(formData.get("planId") ?? ""));
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { error: toSafeUserFeedbackMessage(message, PLAN_GENERIC_ERROR) };
  }
}
