"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationPermission } from "@/lib/auth/server";
import {
  createConsentDocument,
  createDraftFromLatestVersion,
  publishConsentVersion
} from "@/lib/consent/clinic-service";
import { parseConsentDocumentInput, parseConsentVersionInput } from "@/lib/consent";

export async function createConsentDocumentAction(formData: FormData) {
  const context = await requireOrganizationPermission("consent.manage");
  
  const documentInput = parseConsentDocumentInput({
    code: String(formData.get("code") ?? ""),
    title: String(formData.get("title") ?? ""),
    documentKind: String(formData.get("documentKind") ?? ""),
    purposeKey: String(formData.get("purposeKey") ?? "")
  });
  
  const versionInput = parseConsentVersionInput({
    titleSnapshot: String(formData.get("initialDraftTitle") ?? ""),
    summaryText: formData.get("initialDraftSummary") ? String(formData.get("initialDraftSummary")) : null,
    bodyText: String(formData.get("initialDraftBody") ?? "")
  });

  const id = await createConsentDocument(context.organization.id, {
    code: documentInput.code,
    title: documentInput.title,
    documentKind: documentInput.documentKind,
    purposeKey: documentInput.purposeKey,
    initialDraftTitle: versionInput.titleSnapshot,
    initialDraftSummary: versionInput.summaryText,
    initialDraftBody: versionInput.bodyText
  });
  
  redirect(`/clinic/consent-documents/${id}`);
}



export async function createConsentDraftVersionAction(formData: FormData) {
  await requireOrganizationPermission("consent.manage");
  await createDraftFromLatestVersion(String(formData.get("documentId") ?? ""));
}

export async function publishConsentVersionAction(formData: FormData) {
  await requireOrganizationPermission("consent.manage");
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) throw new Error("Version ID is required.");
  await publishConsentVersion(versionId);
  revalidatePath("/clinic/consent-documents");
}
