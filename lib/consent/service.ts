import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseConsentVersionInput } from "@/lib/consent";
import { parseCreateConsentDocumentInput } from "@/lib/consent/clinic-contracts";
import * as clinicConsentService from "@/lib/consent/clinic-service";

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
  const input = parseCreateConsentDocumentInput({
    code: String(formData.get("code") ?? ""),
    title: String(formData.get("title") ?? ""),
    documentKind: String(formData.get("documentKind") ?? ""),
    purposeKey: String(formData.get("purposeKey") ?? ""),
    titleSnapshot: String(formData.get("titleSnapshot") ?? formData.get("initialDraftTitle") ?? ""),
    summaryText: String(formData.get("summaryText") ?? formData.get("initialDraftSummary") ?? ""),
    bodyText: String(formData.get("bodyText") ?? formData.get("initialDraftBody") ?? "")
  });

  const documentId = await clinicConsentService.createConsentDocument(context.organization.id, input);
  revalidatePath("/clinic/consent-documents");
  return documentId;
}

export async function updateConsentDraftVersion(versionId: string, formData: FormData) {
  await requireOrganizationPermission("consent.manage");
  const versionInput = parseConsentVersionInput({
    titleSnapshot: String(formData.get("titleSnapshot") ?? ""),
    summaryText: String(formData.get("summaryText") ?? ""),
    bodyText: String(formData.get("bodyText") ?? "")
  });
  const documentId = String(formData.get("documentId") ?? "");

  await clinicConsentService.updateConsentDraftVersion(versionId, versionInput);

  revalidatePath("/clinic/consent-documents");
  if (documentId) {
    revalidatePath(`/clinic/consent-documents/${documentId}`);
  }
}

export async function publishConsentVersion(versionId: string) {
  await requireOrganizationPermission("consent.manage");
  await clinicConsentService.publishConsentVersion(versionId);
  revalidatePath("/clinic/consent-documents");
}

export async function createDraftFromLatestVersion(documentId: string) {
  const context = await requireOrganizationPermission("consent.manage");
  await clinicConsentService.createDraftFromLatestVersion(context.organization.id, documentId);
  revalidatePath(`/clinic/consent-documents/${documentId}`);
}

export async function archiveConsentDocument(documentId: string) {
  await requireOrganizationPermission("consent.manage");
  await clinicConsentService.archiveConsentDocument(documentId);
  revalidatePath("/clinic/consent-documents");
  revalidatePath(`/clinic/consent-documents/${documentId}`);
}
