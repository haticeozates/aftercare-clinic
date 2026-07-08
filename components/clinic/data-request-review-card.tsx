import { transitionDataRequestAction } from "@/lib/data-requests/actions";
import { DataRequestAssigneePicker } from "@/components/clinic/data-request-assignee-picker";
import { DataRequestEventHistory } from "@/components/clinic/data-request-event-history";
import {
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  nextDataRequestStatuses,
  type DataRequestEventItem,
  type DataRequestListItem,
  type StaffAssigneeOption
} from "@/lib/data-requests/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export function DataRequestReviewCard({
  request,
  canManage,
  staffOptions,
  events
}: {
  request: DataRequestListItem;
  canManage: boolean;
  staffOptions: StaffAssigneeOption[];
  events: DataRequestEventItem[];
}) {
  const nextStatuses = nextDataRequestStatuses(request.status);

  return (
    <article className="item-card stack">
      <div>
        <h2>{dataRequestTypeLabel(request.requestType)}</h2>
        <p>
          {request.clientName} · {formatDisplayDateTime(request.submittedAt)}
        </p>
        <div className="badge-row">
          <span className="badge">{dataRequestStatusLabel(request.status)}</span>
          {request.resolutionCode ? <span className="badge">{request.resolutionCode}</span> : null}
          {request.assigneeName ? <span className="badge">Sorumlu: {request.assigneeName}</span> : null}
        </div>
      </div>

      {canManage ? (
        <DataRequestAssigneePicker
          dataRequestId={request.id}
          currentStatus={request.status}
          staffOptions={staffOptions}
          currentAssigneeUserId={request.assignedToUserId}
        />
      ) : null}

      {canManage && nextStatuses.length > 0 ? (
        <form action={transitionDataRequestAction} data-request-id={request.id} className="toolbar">
          <input type="hidden" name="dataRequestId" value={request.id} />
          <label>
            Yeni durum
            <select name="status" defaultValue={nextStatuses[0]}>
              {nextStatuses.map((status) => (
                <option key={status} value={status}>
                  {dataRequestStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="resolutionCode" value="manual_review_completed" />
          <button className="button secondary" type="submit">
            Durumu güncelle
          </button>
        </form>
      ) : null}

      <div className="stack">
        <h3>Olay geçmişi</h3>
        <DataRequestEventHistory events={events} />
      </div>
    </article>
  );
}
