"use server";

import { assignDataRequestFromForm, transitionDataRequestFromForm } from "@/lib/data-requests/service";

export async function transitionDataRequestAction(formData: FormData) {
  await transitionDataRequestFromForm(formData);
}

export async function assignDataRequestAction(formData: FormData) {
  await assignDataRequestFromForm(formData);
}
