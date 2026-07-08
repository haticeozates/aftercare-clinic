import "server-only";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { parseCreateAssignmentInput } from "@/lib/consent/assignment-contracts";
import {
  cancelClientDocumentAssignment,
  createClientDocumentAssignment
} from "@/lib/consent/assignment-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AssignmentStatus } from "@/lib/consent/assignment-contracts";
import { assignmentStatusLabel } from "@/lib/consent/assignment-contracts";

export interface ClientAssignmentListItem {
  id: string;
  documentCode: string;
  documentTitle: string;
  documentKind: "notice" | "consent";
  versionNumber: number;
  versionTitle: string;
  carePlanLabel: string | null;
  status: AssignmentStatus;
  required: boolean;
  assignedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByDisplayName: string | null;
}

export interface AssignmentCreateOption {
  versionId: string;
  label: string;
  documentKind: "notice" | "consent";
}

export interface ClientCarePlanOption {
  id: string;
  label: string;
}

type AssignmentRow = {
  id: string;
  care_plan_id: string | null;
  assignment_type: "notice" | "consent";
  required: boolean;
  status: AssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  consent_document_versions: {
    version_number: number;
    title_snapshot: string;
    consent_documents: { code: string; title: string; document_kind: "notice" | "consent" } | { code: string; title: string; document_kind: "notice" | "consent" }[] | null;
  } | {
    version_number: number;
    title_snapshot: string;
    consent_documents: { code: string; title: string; document_kind: "notice" | "consent" } | { code: string; title: string; document_kind: "notice" | "consent" }[] | null;
  }[] | null;
  care_plans: { id: string; status: string } | { id: string; status: string }[] | null;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapAssignmentRow(
  row: AssignmentRow,
  cancelledByNames: Map<string, string>
): ClientAssignmentListItem {
  const version = relationOne(row.consent_document_versions);
  const document = relationOne(version?.consent_documents ?? null);
  const plan = relationOne(row.care_plans);
  const cancelledByDisplayName = row.cancelled_by_user_id
    ? (cancelledByNames.get(row.cancelled_by_user_id) ?? "Bilinmeyen personel")
    : null;

  return {
    id: row.id,
    documentCode: document?.code ?? "—",
    documentTitle: document?.title ?? "—",
    documentKind: row.assignment_type,
    versionNumber: version?.version_number ?? 0,
    versionTitle: version?.title_snapshot ?? "—",
    carePlanLabel: plan ? `Plan ${plan.id.slice(0, 8)}` : null,
    status: row.status,
    required: row.required,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelledByDisplayName
  };
}

async function loadCancelledByDisplayNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id,user_profiles(display_name)")
    .eq("organization_id", organizationId)
    .in("user_id", userIds);

  if (error) {
    return new Map<string, string>();
  }

  return new Map(
    data.map((row) => [row.user_id, relationOne(row.user_profiles)?.display_name ?? "Bilinmeyen personel"])
  );
}

export async function listClientDocumentAssignments(clientId: string) {
  const context = await requireOrganizationPermission("consent.read");
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("client_document_assignments")
    .select(
      `id,care_plan_id,assignment_type,required,status,assigned_at,completed_at,cancelled_at,cancelled_by_user_id,
      consent_document_versions(version_number,title_snapshot,consent_documents(code,title,document_kind)),
      care_plans(id,status)`
    )
    .eq("organization_id", context.organization.id)
    .eq("client_id", clientId)
    .order("assigned_at", { ascending: false })
    .returns<AssignmentRow[]>();

  if (error) {
    throw new Error("Belge atamaları alınamadı.");
  }

  const cancelledByIds = [
    ...new Set(
      data
        .map((row) => row.cancelled_by_user_id)
        .filter((userId): userId is string => Boolean(userId))
    )
  ];
  const cancelledByNames = await loadCancelledByDisplayNames(supabase, context.organization.id, cancelledByIds);

  return {
    assignments: data.map((row) => mapAssignmentRow(row, cancelledByNames)),
    canManage: hasPermission(context.membership, "consent.manage")
  };
}

export async function getClientAssignmentCreateOptions(clientId: string) {
  const context = await requireOrganizationPermission("consent.read");
  const supabase = await createServerSupabaseClient();

  const [versionsResult, plansResult] = await Promise.all([
    supabase
      .from("consent_document_versions")
      .select("id,version_number,title_snapshot,consent_documents!inner(code,title,document_kind,status)")
      .eq("organization_id", context.organization.id)
      .eq("status", "published")
      .eq("consent_documents.status", "active")
      .order("version_number", { ascending: false }),
    supabase
      .from("care_plans")
      .select("id,status,start_date")
      .eq("organization_id", context.organization.id)
      .eq("client_id", clientId)
      .in("status", ["scheduled", "active", "completed"])
      .order("start_date", { ascending: false })
  ]);

  if (versionsResult.error || plansResult.error) {
    throw new Error("Atama seçenekleri alınamadı.");
  }

  const publishedVersions: AssignmentCreateOption[] = versionsResult.data.map((row) => {
    const document = relationOne(
      row.consent_documents as { code: string; title: string; document_kind: "notice" | "consent" } | { code: string; title: string; document_kind: "notice" | "consent" }[]
    );
    return {
      versionId: row.id,
      documentKind: document?.document_kind ?? "notice",
      label: `${document?.code ?? "belge"} · v${row.version_number} · ${row.title_snapshot}`
    };
  });

  const carePlans: ClientCarePlanOption[] = plansResult.data.map((plan) => ({
    id: plan.id,
    label: `Plan ${plan.start_date ?? plan.id.slice(0, 8)}`
  }));

  return { publishedVersions, carePlans };
}

export async function createClientDocumentAssignmentFromForm(formData: FormData) {
  await requireOrganizationPermission("consent.manage");
  const parsed = parseCreateAssignmentInput({
    clientId: String(formData.get("clientId") ?? ""),
    documentVersionId: String(formData.get("documentVersionId") ?? ""),
    carePlanId: String(formData.get("carePlanId") || "") || null,
    required: formData.get("required") === "on" || formData.get("required") === "true"
  });

  await createClientDocumentAssignment(parsed);
  revalidatePath(`/clinic/clients/${parsed.clientId}`);
}

export async function cancelClientDocumentAssignmentFromForm(formData: FormData) {
  await requireOrganizationPermission("consent.manage");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!assignmentId) {
    throw new Error("Kayıt bulunamadı.");
  }

  await cancelClientDocumentAssignment(assignmentId);
  revalidatePath(`/clinic/clients/${clientId}`);
}

export { assignmentStatusLabel };
