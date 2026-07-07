"use server";

import { reviewAlertFromForm } from "@/lib/alerts/service";

export async function reviewAlertAction(formData: FormData) {
  await reviewAlertFromForm(formData);
}
