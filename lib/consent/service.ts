import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapConsentDatabaseError, parseConsentDocumentInput, parseConsentVersionInput } from "@/lib/consent";

export interface ConsentDocumentListItem {
  id: string;
  code: string;
  title: string;
  documentKind: "notice" | "consent";
  purposeKey: string;
  status: "active" | "inactive" | "archived";
  versionCount: number;
  latestVersionStatus: "draft" | "published" | "retired" | null;
}

export interface ConsentVersionItem {
  id: string;
  versionNumber: number;
  status: "draft" | "published" | "retired";
  titleSnapshot: string;
  summaryText: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ConsentDocumentDetail extends ConsentDocumentListItem {
  versions: ConsentVersionItem[];
}

type DocumentRow = {
  id: string;
  code: string;
  title: string;
  document_kind: "notice" | "consent";
  purpose_key: string;
  status: "active" | "inactive" | "archived";
};

type VersionRow = {
  id: string;
  consent_document_id: string;
  version_number: number;
  status: "draft" | "published" | "retired";
  title_snapshot: string;
  summary_text: string | null;
  published_at: string | null;
  created_at: string;
};

function toVersion(row: VersionRow): ConsentVersionItem {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    titleSnapshot: row.title_snapshot,
    summaryText: row.summary_text,
    publishedAt: row.published_at,
    createdAt: row.created_at
  };
}

function kindLabel(kind: "notice" | "consent") {
  return kind === "notice" ? "Bilgilendirme" : "Onay";
}

export function consentDocumentKindLabel(kind: "notice" | "consent") {
  return kindLabel(kind);
}

export function consentVersionStatusLabel(status: "draft" | "published" | "retired") {
  return {
    draft: "Taslak",
    published: "Yayınlandı",
    retired: "Emekli"
  }[status];
}

export async function listConsentDocuments() {
  const context = await requireOrganizationPermission("consent.read");
  const supabase = await createServerSupabaseClient();

  const [documents, versions] = await Promise.all([
    supabase
      .from("consent_documents")
      .select("id,code,title,document_kind,purpose_key,status")
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
    supabase
      .from("consent_document_versions")
      .select("id,consent_document_id,version_number,status,title_snapshot,summary_text,published_at,created_at")
      .eq("organization_id", context.organization.id)
      .order("version_number", { ascending: false })
      .returns<VersionRow[]>()
  ]);

  if (documents.error || versions.error) {
    throw new Error("Belge listesi alınamadı.");
  }

  return {
    documents: documents.data.map((document) => {
      const documentVersions = versions.data.filter((version) => version.consent_document_id === document.id);
      return {
        id: document.id,
        code: document.code,
        title: document.title,
        documentKind: document.document_kind,
        purposeKey: document.purpose_key,
        status: document.status,
        versionCount: documentVersions.length,
        latestVersionStatus: documentVersions[0]?.status ?? null
      };
    }),
    canManage: hasPermission(context.membership, "consent.manage")
  };
}

export async function getConsentDocumentDetail(id: string): Promise<{ document: ConsentDocumentDetail; canManage: boolean }> {
  const context = await requireOrganizationPermission("consent.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("consent_documents")
    .select("id,code,title,document_kind,purpose_key,status")
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle<DocumentRow>();

  if (error || !data) {
    redirect("/clinic/consent-documents");
  }

  const { data: versions, error: versionsError } = await supabase
    .from("consent_document_versions")
    .select("id,consent_document_id,version_number,status,title_snapshot,summary_text,published_at,created_at")
    .eq("organization_id", context.organization.id)
    .eq("consent_document_id", id)
    .order("version_number", { ascending: false })
    .returns<VersionRow[]>();

  if (versionsError) {
    throw new Error("Belge versiyonları alınamadı.");
  }

  return {
    document: {
      id: data.id,
      code: data.code,
      title: data.title,
      documentKind: data.document_kind,
      purposeKey: data.purpose_key,
      status: data.status,
      versionCount: versions.length,
      latestVersionStatus: versions[0]?.status ?? null,
      versions: versions.map(toVersion)
    },
    canManage: hasPermission(context.membership, "consent.manage")
  };
}

export async function createConsentDocumentFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("consent.manage");
  const documentInput = parseConsentDocumentInput({
    code: String(formData.get("code") ?? ""),
    title: String(formData.get("title") ?? ""),
    documentKind: String(formData.get("documentKind") ?? ""),
    purposeKey: String(formData.get("purposeKey") ?? "")
  });
  const versionInput = parseConsentVersionInput({
    titleSnapshot: String(formData.get("titleSnapshot") ?? ""),
    summaryText: String(formData.get("summaryText") ?? ""),
    bodyText: String(formData.get("bodyText") ?? "")
  });
  const supabase = await createServerSupabaseClient();
  const { data: document, error: documentError } = await supabase
    .from("consent_documents")
    .insert({
      organization_id: context.organization.id,
      code: documentInput.code,
      title: documentInput.title,
      document_kind: documentInput.documentKind,
      purpose_key: documentInput.purposeKey,
      status: "active",
      created_by_user_id: context.user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (documentError || !document) {
    throw new Error(mapConsentDatabaseError(documentError));
  }

  const { error: versionError } = await supabase.from("consent_document_versions").insert({
    organization_id: context.organization.id,
    consent_document_id: document.id,
    version_number: 1,
    status: "draft",
    title_snapshot: versionInput.titleSnapshot,
    body_text: versionInput.bodyText,
    summary_text: versionInput.summaryText,
    created_by_user_id: context.user.id
  });

  if (versionError) {
    throw new Error(mapConsentDatabaseError(versionError));
  }

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "consent_document.created",
    entityType: "consent_document",
    entityId: document.id,
    result: "success",
    safeMetadata: { document_kind: documentInput.documentKind, source: "server_action" }
  });

  revalidatePath("/clinic/consent-documents");
  return document.id;
}

export async function publishConsentVersion(versionId: string) {
  await requireOrganizationPermission("consent.manage");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("publish_consent_document_version", {
    target_version_id: versionId
  });

  if (error || (data as { error?: string } | null)?.error) {
    throw new Error(mapConsentDatabaseError(error ?? { message: (data as { error?: string } | null)?.error }));
  }

  revalidatePath("/clinic/consent-documents");
}

export async function createDraftFromLatestVersion(documentId: string) {
  const context = await requireOrganizationPermission("consent.manage");
  const supabase = await createServerSupabaseClient();
  const { data: latest, error } = await supabase
    .from("consent_document_versions")
    .select("version_number,title_snapshot,body_text,summary_text")
    .eq("organization_id", context.organization.id)
    .eq("consent_document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number; title_snapshot: string; body_text: string; summary_text: string | null }>();

  if (error || !latest) {
    throw new Error("Yeni taslak oluşturulamadı.");
  }

  const { error: insertError } = await supabase.from("consent_document_versions").insert({
    organization_id: context.organization.id,
    consent_document_id: documentId,
    version_number: latest.version_number + 1,
    status: "draft",
    title_snapshot: latest.title_snapshot,
    body_text: latest.body_text,
    summary_text: latest.summary_text,
    created_by_user_id: context.user.id
  });

  if (insertError) {
    throw new Error(mapConsentDatabaseError(insertError));
  }

  revalidatePath(`/clinic/consent-documents/${documentId}`);
}
