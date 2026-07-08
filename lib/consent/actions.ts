"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { CONSENT_GENERIC_ERROR } from "@/lib/consent";
import {
  archiveConsentDocument,
  createConsentDocumentFromForm,
  createDraftFromLatestVersion,
  publishConsentVersion,
  updateConsentDraftVersion
} from "@/lib/consent/service";

export interface ConsentActionState {
  error?: string;
  success?: string;
}

function safeConsentError(error: unknown): ConsentActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  return {
    error: error instanceof Error ? error.message : CONSENT_GENERIC_ERROR
  };
}

export async function createConsentDocumentFormAction(
  _previous: ConsentActionState,
  formData: FormData
): Promise<ConsentActionState> {
  let id: string;
  try {
    id = await createConsentDocumentFromForm(formData);
  } catch (error) {
    return safeConsentError(error);
  }

  redirect(`/clinic/consent-documents/${id}`);
}

export async function createConsentDocumentAction(formData: FormData) {
  const id = await createConsentDocumentFromForm(formData);
  redirect(`/clinic/consent-documents/${id}`);
}

export async function updateConsentDraftVersionAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) {
    throw new Error(CONSENT_GENERIC_ERROR);
  }

  await updateConsentDraftVersion(versionId, formData);
}

export async function updateConsentDraftVersionFormAction(
  _previous: ConsentActionState,
  formData: FormData
): Promise<ConsentActionState> {
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) {
    return { error: CONSENT_GENERIC_ERROR };
  }

  try {
    await updateConsentDraftVersion(versionId, formData);
    return { success: "Taslak kaydedildi." };
  } catch (error) {
    return safeConsentError(error);
  }
}

export async function publishConsentVersionAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) {
    throw new Error(CONSENT_GENERIC_ERROR);
  }

  await publishConsentVersion(versionId);
}

export async function publishConsentVersionFormAction(
  _previous: ConsentActionState,
  formData: FormData
): Promise<ConsentActionState> {
  const versionId = String(formData.get("versionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!versionId || !documentId) {
    return { error: CONSENT_GENERIC_ERROR };
  }

  try {
    await publishConsentVersion(versionId);
  } catch (error) {
    return safeConsentError(error);
  }

  redirect(`/clinic/consent-documents/${documentId}`);
}

export async function createConsentDraftVersionAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error(CONSENT_GENERIC_ERROR);
  }

  await createDraftFromLatestVersion(documentId);
  redirect(`/clinic/consent-documents/${documentId}`);
}

export async function createConsentDraftVersionFormAction(
  _previous: ConsentActionState,
  formData: FormData
): Promise<ConsentActionState> {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    return { error: CONSENT_GENERIC_ERROR };
  }

  try {
    await createDraftFromLatestVersion(documentId);
  } catch (error) {
    return safeConsentError(error);
  }

  redirect(`/clinic/consent-documents/${documentId}`);
}

export async function archiveConsentDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error(CONSENT_GENERIC_ERROR);
  }

  await archiveConsentDocument(documentId);
}

export async function archiveConsentDocumentFormAction(
  _previous: ConsentActionState,
  formData: FormData
): Promise<ConsentActionState> {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    return { error: CONSENT_GENERIC_ERROR };
  }

  try {
    await archiveConsentDocument(documentId);
  } catch (error) {
    return safeConsentError(error);
  }

  redirect(`/clinic/consent-documents/${documentId}`);
}
