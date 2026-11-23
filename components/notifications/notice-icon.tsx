import { LineIcon, type LineIconName } from "@/components/ui/line-icon";
import type { NoticeKind } from "@/lib/notifications/contracts";

const icons: Record<NoticeKind, LineIconName> = {
  appointment_requested: "calendar",
  appointment_confirmed: "check",
  appointment_rescheduled: "calendar",
  appointment_cancelled: "close",
  appointment_reminder: "clock",
  follow_up_reminder: "clock",
  plan_created: "plan",
  daily_task_reminder: "plan",
  checkin_received: "checkin",
  photo_received: "photo",
  alert_review: "alert",
  data_request_received: "request",
};

export function NoticeIcon({ kind }: { kind: NoticeKind }) {
  return <span className="notice-type-icon"><LineIcon name={icons[kind]} size={17} /></span>;
}
