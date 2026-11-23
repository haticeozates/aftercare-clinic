import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountCard } from "@/components/phase11/account";
import { ClinicFields, DemoForm } from "@/components/phase11/forms";
import { InvitationList, InviteForm } from "@/components/phase11/team";
import { getCurrentOrganizationContext } from "@/lib/auth/server";
import { signOutAction } from "@/lib/auth/actions";
import { completeOnboardingAction, createClinicAction } from "@/lib/phase11/clinic-actions";
import { getClinicDetails, listInvites } from "@/lib/phase11/clinic-data";
import { getOnboarding, requirePhase11, requireVerifiedUser } from "@/lib/phase11/server";

const steps = ["Hesap", "Klinik profili", "Ekip", "Özet"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ adim?: string }> }) {
  requirePhase11();
  const user = await requireVerifiedUser();
  const [state, context, { adim }] = await Promise.all([
    getOnboarding(user.id), getCurrentOrganizationContext(), searchParams
  ]);
  if (!state) redirect("/clinic");
  if (context.status === "authorized" && (state.organization_id !== context.organization.id
    || state.completed_at || context.membership.roleKey !== "organization_owner")) redirect("/clinic");
  if (context.status !== "authorized" && state.organization_id) redirect("/unauthorized");
  const step = context.status === "authorized" ? (adim === "ozet" ? 3 : 2) : 1;
  const details = context.status === "authorized" ? await getClinicDetails(context.organization, user.id) : null;
  const invitations = context.status === "authorized" ? await listInvites(context.organization.id) : [];

  return (
    <AccountCard title="Klinik kurulumu" description={`E-posta adresi doğrulandı. Adım ${step + 1} / ${steps.length}.`} wide>
      <ol className="phase11-steps" aria-label="Kurulum adımları">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}
          data-done={index < step}>{label}</li>)}
      </ol>
      {step === 1 && <section className="stack" aria-labelledby="clinic-profile-heading">
        <h2 id="clinic-profile-heading">Klinik bilgilerini girin</h2>
        <p>Portföy demosunda yalnızca sentetik klinik ve profil bilgileri kullanın.</p>
        <DemoForm action={createClinicAction} submit="Kliniği oluştur"><ClinicFields /></DemoForm>
      </section>}
      {step === 2 && <section className="stack" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Ekibinizi davet edin</h2>
        <p>Davet isteğe bağlıdır. Ekip üyelerini daha sonra klinik panelinden de ekleyebilirsiniz.</p>
        <InviteForm owner />
        <InvitationList invitations={invitations} owner />
        <Link className="ui-button ui-button--secondary" href="/kurulum?adim=ozet">Kurulum özetine geç</Link>
      </section>}
      {step === 3 && details && <section className="stack" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Kurulum özeti</h2>
        <dl className="phase11-grid">
          <div><dt>Klinik</dt><dd>{details.clinic_name}</dd></div>
          <div><dt>İşletme sahibi</dt><dd>{details.profile_name}</dd></div>
          <div><dt>Saat dilimi</dt><dd>{details.clinic_zone}</dd></div>
          <div><dt>Gönderilen davet</dt><dd>{invitations.filter((invite) => invite.delivered_at && !invite.revoked_at).length}</dd></div>
        </dl>
        <form action={completeOnboardingAction}>
          <button className="ui-button ui-button--primary" type="submit">Kurulumu tamamla ve kliniğe geç</button>
        </form>
        <Link href="/kurulum">Ekip adımına dön</Link>
      </section>}
      <form action={signOutAction}>
        <button className="ui-button ui-button--ghost" type="submit">Çıkış yap</button>
      </form>
    </AccountCard>
  );
}
