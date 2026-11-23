import Link from "next/link";
import type { AppointmentStatus } from "@/lib/appointments/contracts";
import { statusLabels } from "@/lib/appointments/contracts";
import { clockLabel, dateLabel, wallDate } from "@/lib/appointments/calendar";
import type { Appointment, Roster } from "@/lib/appointments/service";
import "./appointments.css";

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  return <span className="booking-status" data-booking-status={status}>{statusLabels[status]}</span>;
}

export function AppointmentLine({ item, zone, roster, showDate = false }: {
  item: Appointment; zone: string; roster?: Roster[]; showDate?: boolean;
}) {
  const member = roster?.find((person) => person.id === item.membership_id);
  return (
    <Link className="booking-event" data-status={item.status} href={`/clinic/appointments/${item.id}`}>
      <span className="booking-event-time">
        {showDate && <span>{dateLabel(wallDate(item.starts_at, zone), { day: "numeric", month: "short" })} · </span>}
        <time dateTime={item.starts_at}>{clockLabel(item.starts_at, zone)}</time>
      </span>
      <strong>{item.clients?.full_name ?? "Online talep"}</strong>
      <span className="booking-event-meta">{item.procedures?.name ?? "İşlem"}{member && ` · ${member.name}`}</span>
      <AppointmentBadge status={item.status} />
    </Link>
  );
}
