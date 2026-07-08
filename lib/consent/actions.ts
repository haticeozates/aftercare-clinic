"use server";

import { redirect } from "next/navigation";
import {
  createConsentDocumentFromForm,
  createDraftFromLatestVersion,
  publishConsentVersion
} from "@/lib/consent/service";

export async function createConsentDocumentAction(formData: FormData) {
  const id = await createConsentDocumentFromForm(formData);
  redirect(`/clinic/consent-documents/${id}`);
}

export async function publishConsentVersionAction(formData: FormData) {
  await publishConsentVersion(String(formData.get("versionId") ?? ""));
}

export async function createConsentDraftVersionAction(formData: FormData) {
  await createDraftFromLatestVersion(String(formData.get("documentId") ?? ""));
}
