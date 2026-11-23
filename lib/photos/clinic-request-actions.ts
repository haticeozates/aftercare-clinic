"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createPhotoRequestFromForm } from "@/lib/photos/clinic-request-service";
import { PHOTO_REQUEST_GENERIC_ERROR } from "@/lib/photos/clinic-request-contracts";
import { toSafeUserFeedbackMessage } from "@/lib/ui/feedback-contracts";

export type PhotoRequestActionState = {
  error?: string;
  success?: boolean;
};

function safePhotoRequestError(error: unknown): PhotoRequestActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  const message = error instanceof Error ? error.message : undefined;
  return {
    error: toSafeUserFeedbackMessage(message, PHOTO_REQUEST_GENERIC_ERROR)
  };
}

export async function createPhotoRequestAction(
  _previous: PhotoRequestActionState,
  formData: FormData
): Promise<PhotoRequestActionState> {
  try {
    await createPhotoRequestFromForm(formData);
    return { success: true };
  } catch (error) {
    return safePhotoRequestError(error);
  }
}
