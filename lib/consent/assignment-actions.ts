"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ASSIGNMENT_GENERIC_ERROR } from "@/lib/consent/assignment-contracts";
import {
  cancelClientDocumentAssignmentFromForm,
  createClientDocumentAssignmentFromForm
} from "@/lib/consent/assignment-service-read";

export interface AssignmentActionState {
  error?: string;
  success?: string;
}

function safeAssignmentError(error: unknown): AssignmentActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  return {
    error: error instanceof Error ? error.message : ASSIGNMENT_GENERIC_ERROR
  };
}

export async function createAssignmentFormAction(
  _previous: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  try {
    await createClientDocumentAssignmentFromForm(formData);
    return { success: "Belge ataması oluşturuldu." };
  } catch (error) {
    return safeAssignmentError(error);
  }
}

export async function cancelAssignmentFormAction(
  _previous: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  try {
    await cancelClientDocumentAssignmentFromForm(formData);
    return { success: "Atama iptal edildi." };
  } catch (error) {
    return safeAssignmentError(error);
  }
}
