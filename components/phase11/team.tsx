import { changeMemberAction, manageInviteAction } from "@/lib/phase11/clinic-actions";
import type { listInvites, listTeam } from "@/lib/phase11/clinic-data";
import { roleLabels } from "@/lib/phase11/config";
import { DemoForm } from "./forms";
import "./phase11.css";

export function InviteForm({ owner }: { owner: boolean }) {
  return (
    <DemoForm action={manageInviteAction} submit="Davet gönder">
      <input type="hidden" name="operation" value="create" />
      <label className="form-field">Ekip üyesinin e-postası
        <input type="email" name="email" autoComplete="off" placeholder="ekip@klinik.test" maxLength={254} required />
      </label>
      <div className="form-field">
        <label htmlFor="phase11-invite-role">Davet rolü</label>
        <select id="phase11-invite-role" name="role">
          <option value="staff">{roleLabels.staff}</option>
          {owner && <option value="organization_admin">{roleLabels.organization_admin}</option>}
        </select>
      </div>
    </DemoForm>
  );
}

export function InvitationList({ invitations, owner }: {
  invitations: Awaited<ReturnType<typeof listInvites>>; owner: boolean;
}) {
  if (invitations.length === 0) return <p className="helper-text">Henüz ekip daveti yok.</p>;
  return (
    <ul className="clean-list card-list" aria-label="Davetler">
      {invitations.map((entry) => {
        const editable = !entry.accepted_at && !entry.revoked_at && (owner || entry.role_key === "staff");
        const status = entry.accepted_at ? "Kabul edildi" : entry.revoked_at ? "İptal edildi"
          : entry.expired ? "Süresi doldu" : entry.delivered_at ? "Bekliyor" : "Gönderim doğrulanmadı";
        return (
          <li className="item-card phase11-record" key={entry.id}>
            <strong>{entry.email}</strong><p>{roleLabels[entry.role_key]} · {status}</p>
            {editable && <DemoForm action={manageInviteAction}>
              <input type="hidden" name="invite" value={entry.id} />
              <button type="submit" name="operation" value="resend" className="ui-button ui-button--secondary">Yeniden gönder</button>
              <button type="submit" name="operation" value="revoke" className="ui-button ui-button--ghost">Daveti iptal et</button>
            </DemoForm>}
          </li>
        );
      })}
    </ul>
  );
}

export function MemberList({ members, owner }: {
  members: Awaited<ReturnType<typeof listTeam>>; owner: boolean;
}) {
  return (
    <ul className="clean-list card-list" aria-label="Ekip üyeleri">
      {members.map((member) => (
        <li key={member.id} className="item-card phase11-record">
          <strong>{member.name}</strong>
          <p>{roleLabels[member.role]} · {member.status === "active" ? "Etkin" : "Erişim kapalı"}</p>
          {member.status === "active" && (owner || member.role === "staff") && (
            <DemoForm action={changeMemberAction}>
              <input type="hidden" name="member" value={member.id} />
              <div className="form-field">
                <label htmlFor={`phase11-role-${member.id}`}>Üye rolü</label>
                <select id={`phase11-role-${member.id}`} name="role" defaultValue={member.role}>
                  {(owner ? Object.keys(roleLabels) as (keyof typeof roleLabels)[] : ["staff"] as const)
                    .map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </div>
              <button type="submit" name="operation" value="role" className="ui-button ui-button--secondary">Rolü kaydet</button>
              <button type="submit" name="operation" value="deactivate" className="ui-button ui-button--danger">Erişimi kaldır</button>
            </DemoForm>
          )}
        </li>
      ))}
    </ul>
  );
}
