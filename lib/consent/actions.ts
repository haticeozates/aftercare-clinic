"use server";

import { redirect } from "next/navigation";
import {
  archiveConsentDocument,
  createConsentDocumentFromForm,
  createDraftFromLatestVersion,
  publishConsentVersion,
  updateConsentDraftVersion
} from "@/lib/consent/service";

export async function createConsentDocumentAction(formData: FormData) {
  const id = await createConsentDocumentFromForm(formData);
  redirect(`/clinic/consent-documents/${id}`);
}

export async function updateConsentDraftVersionAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) {
    throw new Error("Belge işlemi tamamlanamadı. Lütfen tekrar deneyin.");
  }

  await updateConsentDraftVersion(versionId, formData);
}

export async function publishConsentVersionAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) {
    throw new Error("Belge işlemi tamamlanamadı. Lütfen tekrar deneyin.");
  }

  await publishConsentVersion(versionId);
}

export async function createConsentDraftVersionAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error("Belge işlemi tamamlanamadı. Lütfen tekrar deneyin.");
  }

  await createDraftFromLatestVersion(documentId);
}

export async function archiveConsentDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error("Belge işlemi tamamlanamadı. Lütfen tekrar deneyin.");
  }

  await archiveConsentDocument(documentId);
}
