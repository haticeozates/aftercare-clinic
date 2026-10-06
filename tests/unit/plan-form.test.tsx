import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultPlanStartDate } from "@/lib/formatters";

vi.mock("@/lib/plans/actions", () => ({
  createPlanAction: async () => ({})
}));

import { PlanForm } from "@/app/clinic/plans/new/plan-form";

const options = {
  clients: [{ id: "00000000-0000-4000-8000-00000000c101", name: "Synthetic Alpha Client One" }],
  procedures: [{ id: "00000000-0000-4000-8000-00000000d101", name: "Alpha Procedure One" }],
  templates: [
    {
      id: "00000000-0000-4000-8000-00000000a401",
      name: "Alpha Template One",
      procedureId: "00000000-0000-4000-8000-00000000d101",
      versionId: "00000000-0000-4000-8000-00000000a501",
      versionNumber: 1
    }
  ],
  memberships: []
};

describe("plan create form start date", () => {
  it("does not hardcode a stale July 2026 start date", () => {
    const source = readFileSync(join(process.cwd(), "app/clinic/plans/new/plan-form.tsx"), "utf8");
    expect(source).toContain("defaultPlanStartDate");
    expect(source).not.toContain("2026-07-06");
  });

  it("renders tomorrow in Istanbul as the date input default", () => {
    const markup = renderToStaticMarkup(<PlanForm options={options} />);
    expect(markup).toContain(`value="${defaultPlanStartDate()}"`);
    expect(markup).not.toContain("2026-07-06");
  });
});
