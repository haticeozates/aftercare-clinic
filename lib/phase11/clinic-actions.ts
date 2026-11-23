"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clinicInput, demoEmail, inviteToken, roleLabels, type Phase11State } from "./config";
import {
  clearInviteCookie, getInviteCookie, getOnboarding, getVerifiedUser, hashInvite,
  newInviteToken, requireClinicManagement, requirePhase11, requireVerifiedUser, setInviteCookie
} from "./server";

const invalidInvite = "Bu davet kullanılamıyor. Bağlantıyı, hesabınızı veya davetin süresini kontrol edin.";
const uuid = z.uuid();
const formError = "Klinik adı ve ad soyad zorunludur. Telefon ve saat dilimi alanlarını kontrol edin.";

function clinicFields(form: FormData) {
  return clinicInput.safeParse({
    clinic_name: form.get("clinic_name"), profile_name: form.get("profile_name"),
    clinic_address: form.get("clinic_address"), clinic_phone: form.get("clinic_phone"),
    clinic_zone: form.get("clinic_zone")
  });
}

export async function createClinicAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const user = await requireVerifiedUser();
  const fields = clinicFields(form);
  if (!fields.success) return { error: formError };

  const { error } = await createAdminSupabaseClient().rpc("phase11_create_clinic", {
    actor: user.id, ...fields.data
  });
  if (error) return { error: "Klinik oluşturulamadı. Hesabınızın kuruluma uygun olduğunu kontrol edin." };
  redirect("/kurulum");
}

export async function completeOnboardingAction() {
  requirePhase11();
  const actor = await requireOrganizationPermission("organization.update");
  const data = await getOnboarding(actor.user.id);
  if (data?.organization_id !== actor.organization.id || actor.membership.roleKey !== "organization_owner") {
    redirect("/clinic");
  }
  const { error } = await createAdminSupabaseClient().from("phase11_onboarding")
    .update({ completed_at: new Date().toISOString() }).eq("user_id", actor.user.id)
    .eq("organization_id", actor.organization.id).is("completed_at", null);
  if (error) throw new Error("Kurulum tamamlanamadı.");
  redirect("/clinic");
}

export async function saveClinicAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requireClinicManagement();
  const actor = await requireOrganizationPermission("organization.update");
  const fields = clinicFields(form);
  if (!fields.success) return { error: formError };

  const { error } = await createAdminSupabaseClient().rpc("phase11_update_clinic", {
    actor: actor.user.id, clinic: actor.organization.id, ...fields.data
  });
  if (error) return { error: "Klinik ayarları kaydedilemedi." };
  revalidatePath("/clinic", "layout");
  return { success: "Klinik ayarları kaydedildi." };
}

export async function manageInviteAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  const config = requirePhase11();
  const actor = await requireOrganizationPermission("membership.manage");
  const parsed = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("create"), email: demoEmail, role: z.enum(["staff", "organization_admin"]) }),
    z.object({ operation: z.enum(["resend", "revoke"]), invite: uuid })
  ]).safeParse(Object.fromEntries(form));

  if (!parsed.success) return { error: "Geçerli bir .test adresi ve ekip rolü seçin." };
  const data = parsed.data;
  const admin = createAdminSupabaseClient();
  const token = newInviteToken();
  const hash = hashInvite(token);
  const { data: entry, error } = await admin.rpc("phase11_manage_invite", {
    actor: actor.user.id, clinic: actor.organization.id, operation: data.operation,
    invite: data.operation === "create" ? null : data.invite,
    recipient: data.operation === "create" ? data.email : null,
    requested_role: data.operation === "create" ? data.role : null, hashed_token: hash
  }).single<{ id: string; email: string; role_key: keyof typeof roleLabels }>();

  if (error || !entry) {
    return { error: error?.code === "23505" ? "Bu adres için bekleyen bir davet var." : "Davet işlemi tamamlanamadı." };
  }
  revalidatePath("/clinic/team");
  revalidatePath("/kurulum");
  if (data.operation === "revoke") return { success: "Davet iptal edildi." };

  const href = new URL("/ekip/davet", config.appOrigin);
  href.hash = new URLSearchParams({ code: token }).toString();
  try {
    const response = await fetch(new URL("/api/v1/send", config.mailOrigin), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(4000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "aftercare@demo.test", Name: "AfterCare Clinic" },
        To: [{ Email: entry.email }],
        Subject: "AfterCare Clinic ekip daveti",
        Text: `Rol: ${roleLabels[entry.role_key]}. Davet 48 saat geçerlidir.\n\n${href.href}`
      })
    });
    if (!response.ok) throw new Error("mail_not_delivered");
    const { data: delivered, error: updateError } = await admin.from("phase11_team_invites")
      .update({ delivered_at: new Date().toISOString() }).eq("id", entry.id).eq("token_hash", hash)
      .is("revoked_at", null).select("id").maybeSingle();
    if (updateError || !delivered) throw new Error("mail_state_changed");
  } catch {
    return { error: "Davetin gönderimi doğrulanamadı. Ekip ekranından durumunu kontrol edin." };
  }
  revalidatePath("/clinic/team");
  revalidatePath("/kurulum");
  return { success: "Davet yerel test posta kutusuna gönderildi." };
}

export async function rememberInviteAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requirePhase11();
  const token = inviteToken.safeParse(form.get("token"));
  if (!token.success) return { error: invalidInvite };
  const { data } = await createAdminSupabaseClient().from("phase11_team_invites")
    .select("id").eq("token_hash", hashInvite(token.data)).is("accepted_at", null).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!data) return { error: invalidInvite };
  await setInviteCookie(token.data);
  redirect("/ekip/davet");
}

export async function acceptInviteAction(): Promise<void> {
  requirePhase11();
  const token = await getInviteCookie();
  const user = await getVerifiedUser();
  if (!token || !user) redirect("/ekip/davet?durum=kapali");

  const { error } = await createAdminSupabaseClient().rpc("phase11_accept_invite", {
    actor: user.id, hashed_token: hashInvite(token)
  });
  await clearInviteCookie();
  if (error) redirect("/ekip/davet?durum=kapali");
  redirect("/clinic");
}

export async function changeMemberAction(_state: Phase11State, form: FormData): Promise<Phase11State> {
  requireClinicManagement();
  const actor = await requireOrganizationPermission("membership.manage");
  const parsed = z.object({
    member: uuid, role: z.enum(["organization_owner", "organization_admin", "staff"]),
    operation: z.enum(["role", "deactivate"])
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Geçerli bir ekip üyesi ve rol seçin." };

  const { error } = await createAdminSupabaseClient().rpc("phase11_change_membership", {
    actor: actor.user.id, clinic: actor.organization.id, member: parsed.data.member,
    requested_role: parsed.data.role, deactivate: parsed.data.operation === "deactivate"
  });
  if (error) {
    return { error: error.code === "23514"
      ? "Klinikte en az bir etkin işletme sahibi kalmalıdır."
      : "Üyenin erişimi güncellenemedi." };
  }
  revalidatePath("/clinic", "layout");
  return { success: "Üyenin erişimi güncellendi." };
}
