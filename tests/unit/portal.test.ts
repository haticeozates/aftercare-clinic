import { describe, expect, it } from "vitest";
import {
  computeDayAvailability,
  computeDayStatus,
  checkPortalTaskMutationRateLimit,
  isPortalTaskTransitionAllowed,
  mapPortalError,
  sanitizePortalPlan
} from "@/lib/portal";

describe("portal daily task helpers", () => {
  it("computes day availability without relying on process timezone", () => {
    expect(
      computeDayAvailability({
        planStatus: "active",
        planStartDate: "2026-07-06",
        dayDate: "2026-07-06",
        today: "2026-07-06"
      })
    ).toBe("available");

    expect(
      computeDayAvailability({
        planStatus: "active",
        planStartDate: "2026-07-06",
        dayDate: "2026-07-07",
        today: "2026-07-06"
      })
    ).toBe("locked");

    expect(
      computeDayAvailability({
        planStatus: "completed",
        planStartDate: "2026-07-01",
        dayDate: "2026-07-01",
        today: "2026-07-06"
      })
    ).toBe("readonly");
  });

  it("allows only portal-supported task status transitions", () => {
    expect(isPortalTaskTransitionAllowed("pending", "completed")).toBe(true);
    expect(isPortalTaskTransitionAllowed("completed", "pending")).toBe(true);
    expect(isPortalTaskTransitionAllowed("pending", "skipped")).toBe(false);
    expect(isPortalTaskTransitionAllowed("skipped", "completed")).toBe(false);
  });

  it("marks a day complete only when required tasks are completed", () => {
    expect(
      computeDayStatus([
        { required: true, status: "completed" },
        { required: false, status: "pending" }
      ])
    ).toBe("completed");

    expect(
      computeDayStatus([
        { required: true, status: "pending" },
        { required: false, status: "completed" }
      ])
    ).toBe("available");
  });

  it("sanitizes portal DTOs and excludes PII/internal identifiers", () => {
    const sanitized = sanitizePortalPlan({
      plan_status: "active",
      start_date: "2026-07-06",
      end_date: "2026-07-06",
      today: "2026-07-06",
      timezone: "Europe/Istanbul",
      mode: "active",
      client_full_name: "Synthetic Alpha Client",
      phone: "+905550100001",
      email: "alpha-client@example.test",
      secure_link_id: "secret-link",
      days: [
        {
          day_number: 1,
          scheduled_date: "2026-07-06",
          title: "Temsili takip günü",
          status: "available",
          availability: "available",
          tasks: [
            {
              id: "task-1",
              title: "Klinik tarafından yapılandırılmış temsili günlük görev",
              description: "Merkez tarafından belirlenecek takip adımı",
              task_type: "do",
              required: true,
              status: "pending",
              completed_at: null,
              source_template_task_id: "hidden"
            }
          ]
        }
      ]
    });

    expect(JSON.stringify(sanitized)).not.toMatch(/phone|email|Synthetic Alpha|secure_link|source_template/i);
    expect(sanitized.days[0]?.tasks[0]?.id).toBe("task-1");
  });

  it("maps raw portal errors to generic Turkish UI messages", () => {
    expect(mapPortalError("task not found for portal session")).toBe("İşlem tamamlanamadı. Lütfen sayfayı yenileyin.");
    expect(mapPortalError("task is not currently available")).toBe("Bu görev şu anda tamamlanamaz.");
    expect(mapPortalError("plan is read-only")).toBe("Bu plan şu anda yalnızca görüntülenebilir.");
  });

  it("exposes a local abuse-control hook for task mutations", () => {
    expect(checkPortalTaskMutationRateLimit({ route: "/care/session/tasks" })).toEqual({
      allowed: true,
      strategy: "local-hook"
    });
  });
});
