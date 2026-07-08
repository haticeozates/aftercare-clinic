import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreateConsentDocumentInput } from "./clinic-contracts";

export async function getClinicConsentDocuments(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("consent_documents")
    .select("*, consent_document_versions(*)")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createConsentDocument(
  organizationId: string,
  input: CreateConsentDocumentInput
) {
  const supabase = await createServerSupabaseClient();
  const { data: docData, error: docError } = await supabase.rpc(
    "create_consent_document",
    {
      p_organization_id: organizationId,
      p_code: input.code,
      p_title: input.title,
      p_document_kind: input.documentKind,
      p_purpose_key: input.purposeKey
    }
  );

  if (docError) throw docError;
  if (docData.error) throw new Error(docData.error);

  const documentId = docData.document_id;

  const { data: verData, error: verError } = await supabase.rpc(
    "create_consent_document_draft_version",
    {
      p_document_id: documentId,
      p_title_snapshot: input.initialDraftTitle,
      p_summary_text: input.initialDraftSummary,
      p_body_text: input.initialDraftBody
    }
  );

  if (verError) throw verError;
  if (verData.error) throw new Error(verData.error);

  return documentId;
}

export async function updateConsentDraftVersion(
  versionId: string,
  title: string,
  summary: string,
  body: string
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "update_consent_document_draft_version",
    {
      p_version_id: versionId,
      p_title_snapshot: title,
      p_summary_text: summary,
      p_body_text: body
    }
  );
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.version_id;
}

export async function publishConsentVersion(versionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "publish_consent_document_version",
    { target_version_id: versionId }
  );
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.version_id;
}

export async function createDraftFromLatestVersion(publishedVersionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_draft_from_published_consent_version",
    { p_published_version_id: publishedVersionId }
  );
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.version_id;
}

export async function archiveConsentDocument(documentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "archive_consent_document",
    { p_document_id: documentId }
  );
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.document_id;
}

