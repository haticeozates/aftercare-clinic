import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveMembership, requireOrganizationPermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { maskPhoneForList, parseClientInput, translateClientDatabaseError } from "@/lib/clients";

export type ClientStatus = "active" | "archived";

export interface ClientListItem {
  id: string;
  fullName: string;
  maskedPhone: string;
  status: ClientStatus;
  responsibleMembershipId: string | null;
  createdAt: string;
}

export interface ClientDetail extends ClientListItem {
  phone: string;
  email: string | null;
  updatedAt: string;
}

type ClientRow = {
  id: string;
  full_name: string;
  phone_normalized: string;
  phone: string;
  email: string | null;
  status: ClientStatus;
  responsible_membership_id: string | null;
  created_at: string;
  updated_at: string;
};

function toClientListItem(row: ClientRow): ClientListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    maskedPhone: maskPhoneForList(row.phone_normalized),
    status: row.status,
    responsibleMembershipId: row.responsible_membership_id,
    createdAt: row.created_at
  };
}

export async function listClients(params: { status?: ClientStatus; search?: string } = {}) {
  const context = await requireOrganizationPermission("client.read");
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("clients")
    .select("id,full_name,phone,phone_normalized,email,status,responsible_membership_id,created_at,updated_at")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.search?.trim()) {
    query = query.ilike("full_name", `%${params.search.trim()}%`);
  }

  const { data, error } = await query.returns<ClientRow[]>();

  if (error) {
    throw new Error("Danışan listesi alınamadı.");
  }

  return {
    context,
    clients: data.map(toClientListItem),
    canArchive: hasPermission(context.membership, "client.archive")
  };
}

export async function getClientDetail(id: string) {
  const context = await requireOrganizationPermission("client.read");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id,full_name,phone,phone_normalized,email,status,responsible_membership_id,created_at,updated_at")
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle<ClientRow>();

  if (error || !data) {
    redirect("/clinic/clients");
  }

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "client.viewed",
    entityType: "client",
    entityId: data.id,
    result: "success",
    safeMetadata: { source: "server_action" }
  });

  return {
    context,
    client: {
      ...toClientListItem(data),
      phone: data.phone,
      email: data.email,
      updatedAt: data.updated_at
    },
    canArchive: hasPermission(context.membership, "client.archive")
  };
}

export async function insertClientFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("client.create");
  const parsed = parseClientInput({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    responsibleMembershipId: String(formData.get("responsibleMembershipId") || "") || null
  });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: context.organization.id,
      full_name: parsed.fullName,
      phone: parsed.phone,
      phone_normalized: parsed.phoneNormalized,
      email: parsed.email,
      responsible_membership_id: parsed.responsibleMembershipId,
      created_by_user_id: context.user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(translateClientDatabaseError(error ?? {}));
  }

  revalidatePath("/clinic/clients");
  return data.id;
}

export async function createClientFromForm(formData: FormData) {
  const id = await insertClientFromForm(formData);
  redirect(`/clinic/clients/${id}`);
}

export async function updateClientFromForm(formData: FormData) {
  const context = await requireOrganizationPermission("client.update");
  const id = String(formData.get("id") ?? "");
  const parsed = parseClientInput({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    responsibleMembershipId: String(formData.get("responsibleMembershipId") || "") || null
  });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({
      full_name: parsed.fullName,
      phone: parsed.phone,
      phone_normalized: parsed.phoneNormalized,
      email: parsed.email,
      responsible_membership_id: parsed.responsibleMembershipId,
      updated_by_user_id: context.user.id
    })
    .eq("id", id)
    .eq("organization_id", context.organization.id);

  if (error) {
    throw new Error(translateClientDatabaseError(error));
  }

  revalidatePath("/clinic/clients");
  revalidatePath(`/clinic/clients/${id}`);
}

export async function archiveClient(id: string) {
  const context = await requireActiveMembership();

  if (!hasPermission(context.membership, "client.archive")) {
    await writeAuditEvent({
      organizationId: context.organization.id,
      actorType: "user",
      actorUserId: context.user.id,
      action: "client.archive_denied",
      entityType: "client",
      entityId: id,
      result: "denied",
      safeMetadata: { reason: "permission_denied", permission_key: "client.archive" }
    });
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by_user_id: context.user.id,
      updated_by_user_id: context.user.id
    })
    .eq("id", id)
    .eq("organization_id", context.organization.id);

  if (error) {
    throw new Error(translateClientDatabaseError(error));
  }

  revalidatePath("/clinic/clients");
  revalidatePath(`/clinic/clients/${id}`);
}
