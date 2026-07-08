import { ConsentAssignmentForm } from "@/components/clinic/consent-assignment-form";
import { ConsentAssignmentList } from "@/components/clinic/consent-assignment-list";
import {
  getClientAssignmentCreateOptions,
  listClientDocumentAssignments
} from "@/lib/consent/assignment-service-read";

export async function ClientConsentAssignmentsSection({ clientId }: { clientId: string }) {
  const [{ assignments, canManage }, createOptions] = await Promise.all([
    listClientDocumentAssignments(clientId),
    getClientAssignmentCreateOptions(clientId)
  ]);

  return (
    <div className="panel stack">
      <div>
        <p className="eyebrow">Onay ve bilgilendirme</p>
        <h2>Belge atamaları</h2>
        <p>Danışana yayımlanmış belge versiyonları atayın. Portal kararları yalnız danışan oturumu üzerinden kaydedilir.</p>
      </div>
      {canManage ? (
        <ConsentAssignmentForm
          clientId={clientId}
          publishedVersions={createOptions.publishedVersions}
          carePlans={createOptions.carePlans}
        />
      ) : null}
      <ConsentAssignmentList clientId={clientId} assignments={assignments} canManage={canManage} />
    </div>
  );
}
