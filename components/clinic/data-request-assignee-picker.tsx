import { assignDataRequestAction } from "@/lib/data-requests/actions";
import type { DataRequestStatus } from "@/lib/data-requests";
import type { StaffAssigneeOption } from "@/lib/data-requests/service";

export function DataRequestAssigneePicker({
  dataRequestId,
  currentStatus,
  staffOptions,
  currentAssigneeUserId
}: {
  dataRequestId: string;
  currentStatus: DataRequestStatus;
  staffOptions: StaffAssigneeOption[];
  currentAssigneeUserId: string | null;
}) {
  if (staffOptions.length === 0) {
    return <p className="muted">Atanabilir aktif personel bulunamadı.</p>;
  }

  return (
    <form action={assignDataRequestAction} className="toolbar stack">
      <input type="hidden" name="dataRequestId" value={dataRequestId} />
      <input type="hidden" name="currentStatus" value={currentStatus} />
      <label>
        Sorumlu personel
        <select
          name="assignedToUserId"
          required
          defaultValue={currentAssigneeUserId ?? ""}
        >
          {!currentAssigneeUserId ? (
            <option value="" disabled>
              Personel seçin
            </option>
          ) : null}
          {staffOptions.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
        </select>
      </label>
      <button className="button secondary" type="submit">
        Personel ata
      </button>
    </form>
  );
}
