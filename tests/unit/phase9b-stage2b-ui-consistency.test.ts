import { describe, expect, it } from "vitest";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatters";
import { alertEventStatusLabel, alertEventTypeLabel } from "@/lib/alerts";
import { templateVersionStatusLabel } from "@/lib/templates";

describe("phase 9b stage 2b ui consistency regressions", () => {
  it("formats dates in tr-TR without raw ISO output", () => {
    const formatted = formatDisplayDate("2026-07-09");
    expect(formatted).toMatch(/2026|Temmuz|9/);
    expect(formatted).not.toMatch(/2026-07-09/);

    const dateTime = formatDisplayDateTime("2026-07-09T14:30:00+03:00");
    expect(dateTime).not.toMatch(/T14:30:00/);
  });

  it("localizes alert history labels", () => {
    expect(alertEventTypeLabel("acknowledged")).toBe("İncelendi");
    expect(alertEventStatusLabel("open")).toBe("Klinik değerlendirmesi bekliyor");
  });

  it("localizes template version statuses", () => {
    expect(templateVersionStatusLabel("retired")).toBe("Emekli");
  });
});
