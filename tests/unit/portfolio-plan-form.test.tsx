import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PlanForm } from "@/app/clinic/plans/new/plan-form";
import { formatIstanbulIsoDate } from "@/lib/formatters";
import { effectivePlanStatus } from "@/lib/plans";

vi.mock("@/lib/plans/actions", () => ({ createPlanAction: vi.fn() }));

it("renders the current Istanbul date around midnight as the plan input default", () => {
  const beforeMidnight = new Date("2026-11-18T20:59:59Z");
  const midnight = new Date("2026-11-18T21:00:00Z");
  expect(formatIstanbulIsoDate(beforeMidnight)).toBe("2026-11-18");
  expect(formatIstanbulIsoDate(midnight)).toBe("2026-11-19");
  const html = renderToStaticMarkup(
    <PlanForm options={{ clients: [], procedures: [], templates: [], memberships: [] }}
      startDate={formatIstanbulIsoDate(midnight)} />
  );
  expect(html).toMatch(/name="startDate"[^>]+value="2026-11-19"/);
});

it("activates due plans in clinic views and retains terminal states", () => {
  expect(effectivePlanStatus("scheduled", "2026-11-20", "2026-11-19")).toBe("scheduled");
  expect(effectivePlanStatus("scheduled", "2026-11-19", "2026-11-19")).toBe("active");
  expect(effectivePlanStatus("active", "2026-11-18", "2026-11-19")).toBe("active");
  expect(effectivePlanStatus("completed", "2026-11-18", "2026-11-19")).toBe("completed");
  expect(effectivePlanStatus("stopped", "2026-11-18", "2026-11-19")).toBe("stopped");
});
