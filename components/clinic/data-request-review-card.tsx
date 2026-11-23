import { DataRequestAssigneePicker } from "@/components/clinic/data-request-assignee-picker";
import { DataRequestEventHistory } from "@/components/clinic/data-request-event-history";
import { DataRequestStatusForm } from "@/components/clinic/data-request-status-form";
import {
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  nextDataRequestStatuses,
  type DataRequestEventItem,
  type DataRequestListItem,
  type StaffAssigneeOption
} from "@/lib/data-requests/service";
import { dataRequestResolutionCodeLabel } from "@/lib/data-requests/labels";
import { Badge, statusBadgeVariant } from "@/components/ui";
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
    <article id={`request-${request.id}`} className="item-card stack">
      <div>
        <h2>{dataRequestTypeLabel(request.requestType)}</h2>
        <p>
          {request.clientName} · {formatDisplayDateTime(request.submittedAt)}
        </p>
        <div className="badge-row">
          <Badge variant={statusBadgeVariant(request.status)}>{dataRequestStatusLabel(request.status)}</Badge>
          {request.resolutionCode ? (
            <Badge variant="neutral">{dataRequestResolutionCodeLabel(request.resolutionCode)}</Badge>
          ) : null}
          {request.assigneeName ? <span className="badge">Sorumlu: {request.assigneeName}</span> : null}
        </div>
      </div>

      {canManage ? (
        <DataRequestAssigneePicker
          dataRequestId={request.id}
          staffOptions={staffOptions}
          currentAssigneeUserId={request.assignedToUserId}
        />
      ) : null}

      {canManage ? <DataRequestStatusForm dataRequestId={request.id} nextStatuses={nextStatuses} /> : null}

      <div className="stack">
        <h3>Olay geçmişi</h3>
        <DataRequestEventHistory events={events} />
      </div>
    </article>
  );
}
