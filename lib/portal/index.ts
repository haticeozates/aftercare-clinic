export type PortalPlanStatus = "scheduled" | "active" | "completed" | "stopped";
export type PortalTaskStatus = "pending" | "completed" | "skipped";
export type PortalDayAvailability = "available" | "locked" | "readonly";

export interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  taskType: "do" | "avoid" | "check" | "information";
  required: boolean;
  status: PortalTaskStatus;
  completedAt: string | null;
}

export interface PortalPhotoRequest {
  id: string;
  label: string;
  required: boolean;
  status: "active" | "cancelled";
  uploadedAt: string | null;
}

export interface PortalDay {
  id: string;
  dayNumber: number;
  scheduledDate: string;
  title: string | null;
  status: "pending" | "available" | "completed" | "skipped" | "locked";
  availability: PortalDayAvailability;
  photoRequests: PortalPhotoRequest[];
  tasks: PortalTask[];
}

export interface PortalCheckInOption {
  id: string;
  label: string;
  allowsSeverity: boolean;
}

export interface PortalPlan {
  planStatus: Exclude<PortalPlanStatus, "stopped">;
  mode: "scheduled" | "active" | "readonly";
  startDate: string;
  endDate: string;
  today: string;
  timezone: "Europe/Istanbul";
  checkIn: {
    options: PortalCheckInOption[];
    submittedDayIds: string[];
  };
  days: PortalDay[];
}

type RawPortalTask = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  task_type?: unknown;
  required?: unknown;
  status?: unknown;
  completed_at?: unknown;
};

type RawPortalDay = {
  id?: unknown;
  day_number?: unknown;
  scheduled_date?: unknown;
  title?: unknown;
  status?: unknown;
  availability?: unknown;
  photo_requests?: unknown;
  tasks?: unknown;
};

type RawPortalCheckIn = {
  options?: unknown;
  submitted_day_ids?: unknown;
};

type RawPortalPlan = {
  plan_status?: unknown;
  mode?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  today?: unknown;
  timezone?: unknown;
  check_in?: unknown;
  days?: unknown;
};

export function computeDayAvailability(input: {
  planStatus: PortalPlanStatus;
  planStartDate: string;
  dayDate: string;
  today: string;
}): PortalDayAvailability {
  if (input.planStatus === "completed") {
    return "readonly";
  }

  if (input.planStatus === "scheduled" || input.planStartDate > input.today || input.dayDate > input.today) {
    return "locked";
  }

  return "available";
}

export function isPortalTaskTransitionAllowed(current: PortalTaskStatus, next: PortalTaskStatus) {
  return (current === "pending" && next === "completed") || (current === "completed" && next === "pending");
}

export function computeDayStatus(tasks: Array<{ required: boolean; status: PortalTaskStatus }>) {
  const requiredTasks = tasks.filter((task) => task.required);
  if (requiredTasks.length === 0) {
    return "completed" as const;
  }

  return requiredTasks.every((task) => task.status === "completed") ? ("completed" as const) : ("available" as const);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function taskStatus(value: unknown): PortalTaskStatus {
  return value === "completed" || value === "skipped" ? value : "pending";
}

function taskType(value: unknown): PortalTask["taskType"] {
  return value === "avoid" || value === "check" || value === "information" ? value : "do";
}

export function sanitizePortalPlan(raw: RawPortalPlan & Record<string, unknown>): PortalPlan {
  const days = Array.isArray(raw.days) ? (raw.days as RawPortalDay[]) : [];
  const checkIn = (raw.check_in && typeof raw.check_in === "object" ? raw.check_in : {}) as RawPortalCheckIn;
  const checkInOptions = Array.isArray(checkIn.options) ? (checkIn.options as Array<Record<string, unknown>>) : [];
  const submittedDayIds = Array.isArray(checkIn.submitted_day_ids) ? checkIn.submitted_day_ids.map((id) => String(id)) : [];

  return {
    planStatus: raw.plan_status === "scheduled" || raw.plan_status === "completed" ? raw.plan_status : "active",
    mode: raw.mode === "scheduled" || raw.mode === "readonly" ? raw.mode : "active",
    startDate: String(raw.start_date ?? ""),
    endDate: String(raw.end_date ?? ""),
    today: String(raw.today ?? ""),
    timezone: "Europe/Istanbul",
    checkIn: {
      options: checkInOptions.map((option) => ({
        id: String(option.id ?? ""),
        label: String(option.label ?? ""),
        allowsSeverity: option.allows_severity === true
      })),
      submittedDayIds
    },
    days: days.map((day) => {
      const tasks = Array.isArray(day.tasks) ? (day.tasks as RawPortalTask[]) : [];
      return {
        id: String(day.id ?? ""),
        dayNumber: Number(day.day_number ?? 0),
        scheduledDate: String(day.scheduled_date ?? ""),
        title: stringOrNull(day.title),
        status:
          day.status === "completed" || day.status === "available" || day.status === "skipped" || day.status === "locked"
            ? day.status
            : "pending",
        availability: day.availability === "readonly" || day.availability === "locked" ? day.availability : "available",
        photoRequests: Array.isArray(day.photo_requests)
          ? (day.photo_requests as Array<Record<string, unknown>>).map((request) => ({
              id: String(request.id ?? ""),
              label: String(request.label ?? ""),
              required: request.required === true,
              status: request.status === "cancelled" ? "cancelled" : "active",
              uploadedAt: stringOrNull(request.uploaded_at)
            }))
          : [],
        tasks: tasks.map((task) => ({
          id: String(task.id ?? ""),
          title: String(task.title ?? ""),
          description: stringOrNull(task.description),
          taskType: taskType(task.task_type),
          required: task.required !== false,
          status: taskStatus(task.status),
          completedAt: stringOrNull(task.completed_at)
        }))
      };
    })
  };
}

export function mapPortalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("not currently available")) {
    return "Bu görev şu anda tamamlanamaz.";
  }

  if (message.includes("read-only")) {
    return "Bu plan şu anda yalnızca görüntülenebilir.";
  }

  if (message.includes("invalid")) {
    return "Bağlantı geçersiz veya süresi dolmuş.";
  }

  return "İşlem tamamlanamadı. Lütfen sayfayı yenileyin.";
}

export { checkPortalTaskMutationRateLimit } from "@/lib/rate-limit/security-routes";
