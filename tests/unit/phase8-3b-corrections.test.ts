import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDataRequestResolutionCode,
  dataRequestResolutionCodeSchema
} from "@/lib/data-requests";

describe("resolveDataRequestResolutionCode", () => {
  it("maps each terminal status to a distinct allowlisted resolution code", () => {
    expect(resolveDataRequestResolutionCode("completed")).toBe("manual_review_completed");
    expect(resolveDataRequestResolutionCode("declined")).toBe("manual_review_declined");
    expect(resolveDataRequestResolutionCode("cancelled")).toBe("manual_review_cancelled");
    expect(resolveDataRequestResolutionCode("completed")).not.toBe(resolveDataRequestResolutionCode("declined"));
    expect(resolveDataRequestResolutionCode("declined")).not.toBe(resolveDataRequestResolutionCode("cancelled"));
  });

  it("returns null for non-terminal statuses", () => {
    expect(resolveDataRequestResolutionCode("submitted")).toBeNull();
    expect(resolveDataRequestResolutionCode("under_review")).toBeNull();
    expect(resolveDataRequestResolutionCode("in_progress")).toBeNull();
  });

  it("only exposes allowlisted resolution codes", () => {
    for (const status of ["completed", "declined", "cancelled"] as const) {
      const code = resolveDataRequestResolutionCode(status);
      expect(() => dataRequestResolutionCodeSchema.parse(code)).not.toThrow();
    }
  });
});

describe("assignee action trust boundary", () => {
  it("does not read currentStatus from form data in assign service", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/data-requests/service.ts"),
      "utf8"
    );
    const assignBlock = source.slice(
      source.indexOf("export async function assignDataRequestFromForm"),
      source.indexOf("export async function transitionDataRequestFromForm")
    );
    expect(assignBlock).not.toContain('formData.get("currentStatus")');
    expect(assignBlock).toContain("assign_data_request");
  });

  it("does not send currentStatus from assignee picker", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/clinic/data-request-assignee-picker.tsx"),
      "utf8"
    );
    expect(source).not.toContain("currentStatus");
  });
});

describe("transition action resolution trust boundary", () => {
  it("derives resolution code server-side instead of trusting hidden browser input", () => {
    const reviewCard = readFileSync(
      resolve(process.cwd(), "components/clinic/data-request-review-card.tsx"),
      "utf8"
    );
    expect(reviewCard).not.toContain('name="resolutionCode"');

    const service = readFileSync(resolve(process.cwd(), "lib/data-requests/service.ts"), "utf8");
    const transitionBlock = service.slice(
      service.indexOf("export async function transitionDataRequestFromForm"),
      service.length
    );
    expect(transitionBlock).toContain("resolveDataRequestResolutionCode");
    expect(transitionBlock).not.toContain('formData.get("resolutionCode")');
  });
});

describe("cancellation history DTO", () => {
  it("exposes display name without raw cancelled user id in assignment read service", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/consent/assignment-service-read.ts"),
      "utf8"
    );
    expect(source).toContain("cancelledByDisplayName");
    expect(source).not.toContain("cancelled_by_user_id");
  });
});

describe("clinic event source contract", () => {
  it("records clinic events with clinic source only in assignment actions", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/consent/assignment-actions.ts"), "utf8");
    if (source.includes("record_client_document_event")) {
      expect(source).toMatch(/target_source:\s*["']clinic["']/);
      expect(source).not.toMatch(/target_source:\s*formData/);
    }
  });
});
