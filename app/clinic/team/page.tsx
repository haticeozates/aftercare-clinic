import { InvitationList, InviteForm, MemberList } from "@/components/phase11/team";
import { Card, PageHeader } from "@/components/ui";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { listInvites, listTeam } from "@/lib/phase11/clinic-data";
import { phase11Config } from "@/lib/phase11/config";
import { requireClinicManagement } from "@/lib/phase11/server";

export default async function ClinicTeamPage() {
  requireClinicManagement();
  const actor = await requireOrganizationPermission("membership.manage");
  const localInvites = Boolean(phase11Config());
  const [members, invitations] = await Promise.all([
    listTeam(actor.organization.id), localInvites ? listInvites(actor.organization.id) : []
  ]);
  const owner = actor.membership.roleKey === "organization_owner";
  return (
    <section className="page-section stack phase11-management">
      <PageHeader eyebrow="Yönetim" title="Ekip yönetimi" description={localInvites
        ? "Klinik erişimini, ekip rollerini ve davetleri yönetin."
        : "Mevcut ekip üyelerinin klinik erişimini ve rollerini yönetin."} />
      <div className={localInvites ? "phase11-grid" : "stack"}>
        <Card className="stack"><h2>Ekip üyeleri</h2><MemberList members={members} owner={owner} /></Card>
        {localInvites && <Card className="stack">
          <h2>Yeni ekip daveti</h2><p>Davetler yalnızca .test adreslerine gönderilir ve 48 saat geçerlidir.</p>
          <InviteForm owner={owner} />
          <h2>Davet geçmişi</h2><InvitationList invitations={invitations} owner={owner} />
        </Card>}
      </div>
    </section>
  );
}
