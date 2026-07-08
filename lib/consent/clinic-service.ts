import "server-only";

import { mapConsentRpcResult, selectPublishedVersionForNewDraft } from "@/lib/consent";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CreateConsentDocumentInput } from "./clinic-contracts";

type ConsentRpcPayload = {
  error?: string;
  status?: string;
  document_id?: string;
  version_id?: string;
};

function assertConsentRpcSuccess(
  transportError: { code?: string; message?: string } | null,
  rpcResult: ConsentRpcPayload | null
): ConsentRpcPayload {
  if (transportError || rpcResult?.error) {
    throw new Error(mapConsentRpcResult(transportError, rpcResult));
  }

  if (!rpcResult) {
    throw new Error(mapConsentRpcResult({ code: "UNKNOWN" }, null));
  }

  return rpcResult;
}

export async function createConsentDocument(organizationId: string, input: CreateConsentDocumentInput) {
  const supabase = await createServerSupabaseClient();
  const { data: docData, error: docError } = await supabase.rpc("create_consent_document", {
    p_organization_id: organizationId,
    p_code: input.code,
    p_title: input.title,
    p_document_kind: input.documentKind,
    p_purpose_key: input.purposeKey
  });

  const docResult = assertConsentRpcSuccess(docError, docData as ConsentRpcPayload | null);
  const documentId = docResult.document_id;

  if (!documentId) {
    throw new Error(mapConsentRpcResult(null, { error: "not found" }));
  }

  const { data: verData, error: verError } = await supabase.rpc("create_consent_document_draft_version", {
    p_document_id: documentId,
    p_title_snapshot: input.initialDraftTitle,
    p_summary_text: input.initialDraftSummary,
    p_body_text: input.initialDraftBody
  });

  assertConsentRpcSuccess(verError, verData as ConsentRpcPayload | null);
  return documentId;
}

export async function updateConsentDraftVersion(
  versionId: string,
  input: { titleSnapshot: string; summaryText: string | null; bodyText: string }
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("update_consent_document_draft_version", {
    p_version_id: versionId,
    p_title_snapshot: input.titleSnapshot,
    p_summary_text: input.summaryText,
    p_body_text: input.bodyText
  });

  const result = assertConsentRpcSuccess(error, data as ConsentRpcPayload | null);
  return result.version_id ?? versionId;
}

export async function publishConsentVersion(versionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("publish_consent_document_version", {
    target_version_id: versionId
  });

  const result = assertConsentRpcSuccess(error, data as ConsentRpcPayload | null);
  return result.version_id ?? versionId;
}

export async function createDraftFromPublishedVersion(publishedVersionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_draft_from_published_consent_version", {
    p_published_version_id: publishedVersionId
  });

  const result = assertConsentRpcSuccess(error, data as ConsentRpcPayload | null);
  return result.version_id ?? publishedVersionId;
}

export async function createDraftFromLatestVersion(organizationId: string, documentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: document, error: documentError } = await supabase
    .from("consent_documents")
    .select("id,status")
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .maybeSingle<{ id: string; status: "active" | "inactive" | "archived" }>();

  if (documentError || !document) {
    throw new Error(mapConsentRpcResult(documentError, { error: "not found" }));
  }

  if (document.status === "archived") {
    throw new Error(mapConsentRpcResult(null, { error: "document is archived" }));
  }

  const { data: versions, error: versionsError } = await supabase
    .from("consent_document_versions")
    .select("id,status,version_number")
    .eq("organization_id", organizationId)
    .eq("consent_document_id", documentId)
    .order("version_number", { ascending: false });

  if (versionsError || !versions) {
    throw new Error(mapConsentRpcResult(versionsError, { error: "not found" }));
  }

  if (versions.some((version) => version.status === "draft")) {
    throw new Error(mapConsentRpcResult(null, { error: "draft already exists" }));
  }

  const publishedVersionId = selectPublishedVersionForNewDraft(
    versions.map((version) => ({
      id: version.id,
      status: version.status,
      versionNumber: version.version_number
    }))
  );

  if (!publishedVersionId) {
    throw new Error(mapConsentRpcResult(null, { error: "not found" }));
  }

  return createDraftFromPublishedVersion(publishedVersionId);
}

export async function archiveConsentDocument(documentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("archive_consent_document", {
    p_document_id: documentId
  });

  const result = assertConsentRpcSuccess(error, data as ConsentRpcPayload | null);
  return result.document_id ?? documentId;
}
