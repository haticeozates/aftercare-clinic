"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { assignDataRequestFromForm, transitionDataRequestFromForm } from "@/lib/data-requests/service";
import { toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

const DATA_REQUEST_GENERIC_ERROR = "Veri talebi işlemi tamamlanamadı.";

export type DataRequestFormState = {
  error?: string;
  success?: string;
};

function safeDataRequestState(error: unknown): DataRequestFormState {
  if (isRedirectError(error)) {
    throw error;
  }

  const message = error instanceof Error ? error.message : undefined;
  return {
    error: toSafeUserFeedbackMessage(message, DATA_REQUEST_GENERIC_ERROR)
  };
}

export async function assignDataRequestFormAction(
  _previous: DataRequestFormState,
  formData: FormData
): Promise<DataRequestFormState> {
  try {
    await assignDataRequestFromForm(formData);
    return { success: "Personel ataması kaydedildi." };
  } catch (error) {
    return safeDataRequestState(error);
  }
}

export async function transitionDataRequestFormAction(
  _previous: DataRequestFormState,
  formData: FormData
): Promise<DataRequestFormState> {
  try {
    await transitionDataRequestFromForm(formData);
    return { success: "Veri talebi durumu güncellendi." };
  } catch (error) {
    return safeDataRequestState(error);
  }
}
