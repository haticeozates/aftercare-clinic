import {
  dataRequestEventTypeLabel,
  dataRequestStatusLabel,
  type DataRequestEventItem
} from "@/lib/data-requests/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export function DataRequestEventHistory({ events }: { events: DataRequestEventItem[] }) {
  if (events.length === 0) {
    return <p className="muted">Henüz olay kaydı yok.</p>;
  }

  return (
    <ul className="timeline-list">
      {events.map((event) => (
        <li key={event.id}>
          <EventLine event={event} />
        </li>
      ))}
    </ul>
  );
}

function EventLine({ event }: { event: DataRequestEventItem }) {
  const statusPart =
    event.fromStatus && event.fromStatus !== event.toStatus
      ? `${dataRequestStatusLabel(event.fromStatus as never)} → ${dataRequestStatusLabel(event.toStatus as never)}`
      : dataRequestStatusLabel(event.toStatus as never);

  return (
    <div className="timeline-item">
      <strong>{dataRequestEventTypeLabel(event.eventType)}</strong>
      <span>{formatDisplayDateTime(event.occurredAt)}</span>
      <p>
        {event.eventType === "assigned" && event.assigneeName
          ? `Atanan: ${event.assigneeName}`
          : statusPart}
      </p>
    </div>
  );
}
