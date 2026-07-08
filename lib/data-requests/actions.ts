"use server";

import { transitionDataRequestFromForm } from "@/lib/data-requests/service";

export async function transitionDataRequestAction(formData: FormData) {
  await transitionDataRequestFromForm(formData);
}
