import "server-only";

import { revalidatePath } from "next/cache";
import { requireActiveMembership, requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseProcedureInput, translateProcedureDatabaseError } from "@/lib/procedures";

export type ProcedureStatus = "active" | "inactive";

export interface ProcedureListItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  status: ProcedureStatus;
}

type ProcedureRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  status: ProcedureStatus;
};

export async function listProcedures(status?: ProcedureStatus) {
  const context = await requireOrganizationPermission("procedure.read");
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("procedures")
    .select("id,name,category,description,status")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<ProcedureRow[]>();

  if (error) {
    throw new Error("İşlem listesi alınamadı.");
  }

  return {
    context,
    procedures: data,
    canManage: hasPermission(context.membership, "procedure.manage")
  };
}

export async function createProcedureFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("procedure.manage");
  const parsed = parseProcedureInput({
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? "")
  });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("procedures").insert({
    organization_id: context.organization.id,
    name: parsed.name,
    normalized_name: parsed.normalizedName,
    category: parsed.category,
    description: parsed.description,
    created_by_user_id: context.user.id
  });

  if (error) {
    throw new Error(translateProcedureDatabaseError(error));
  }

  revalidatePath("/clinic/procedures");
}

export async function updateProcedureFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("procedure.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseProcedureInput({
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? "")
  });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("procedures")
    .update({
      name: parsed.name,
      normalized_name: parsed.normalizedName,
      category: parsed.category,
      description: parsed.description,
      updated_by_user_id: context.user.id
    })
    .eq("id", id)
    .eq("organization_id", context.organization.id);

  if (error) {
    throw new Error(translateProcedureDatabaseError(error));
  }

  revalidatePath("/clinic/procedures");
}

export async function deactivateProcedure(id: string) {
  const context = await requireActiveMembership();

  if (!hasPermission(context.membership, "procedure.manage")) {
    await writeAuditEvent({
      organizationId: context.organization.id,
      actorType: "user",
      actorUserId: context.user.id,
      action: "procedure.manage_denied",
      entityType: "procedure",
      entityId: id,
      result: "denied",
      safeMetadata: { reason: "permission_denied", permission_key: "procedure.manage" }
    });
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("procedures")
    .update({
      status: "inactive",
      archived_at: new Date().toISOString(),
      updated_by_user_id: context.user.id
    })
    .eq("id", id)
    .eq("organization_id", context.organization.id);

  if (error) {
    throw new Error(translateProcedureDatabaseError(error));
  }

  revalidatePath("/clinic/procedures");
}
