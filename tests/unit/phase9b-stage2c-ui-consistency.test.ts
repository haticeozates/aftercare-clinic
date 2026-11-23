import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataRequestResolutionCodeLabel } from "@/lib/data-requests/labels";
import { structuredSeverityLevelLabel } from "@/lib/alerts";
import { consentPurposeKeyLabel } from "@/lib/consent/clinic-ui";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b stage 2c ui consistency", () => {
  it("maps data request resolution codes to Turkish labels", () => {
    expect(dataRequestResolutionCodeLabel("manual_review_declined")).toBe("Manuel inceleme reddedildi");
    expect(dataRequestResolutionCodeLabel("unsupported_request")).toBe("Desteklenmeyen talep");
  });

  it("maps structured severity levels for alert detail", () => {
    expect(structuredSeverityLevelLabel(3)).toBe("Orta");
    expect(structuredSeverityLevelLabel(5)).toBe("Çok belirgin");
  });

  it("maps consent purpose keys for clinic display", () => {
    expect(consentPurposeKeyLabel("local_notice")).toBe("Yerel bilgilendirme");
    expect(consentPurposeKeyLabel("unknown_key")).toBe("Özel belge amacı");
  });

  it("keeps confirmation dialog exported from shared UI", () => {
    expect(read("components/ui/index.tsx")).toMatch(/ConfirmDialog/);
  });
});
