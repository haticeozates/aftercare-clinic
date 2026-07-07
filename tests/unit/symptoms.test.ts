import { describe, expect, it } from "vitest";
import {
  buildReportItemsPayload,
  evaluateAlertRule,
  isSeverityValid,
  sanitizePortalCheckIn,
  validateReportItems
} from "@/lib/check-ins";

describe("phase 6 structured check-in helpers", () => {
  it("keeps portal check-in DTO free of PII and internal identifiers", () => {
    const sanitized = sanitizePortalCheckIn({
      client_full_name: "Synthetic Alpha",
      phone: "+905550000000",
      email: "alpha@example.test",
      secure_link_id: "link",
      session_hash: "hash",
      options: [{ id: "option-1", label: "Bugünkü durum bilgisi", allows_severity: true }]
    });

    expect(JSON.stringify(sanitized)).not.toMatch(/Synthetic|phone|email|hash|secure_link/i);
    expect(sanitized.options).toEqual([{ id: "option-1", label: "Bugünkü durum bilgisi", allowsSeverity: true }]);
  });

  it("validates severity with the neutral 1-5 scale only", () => {
    expect(isSeverityValid(1)).toBe(true);
    expect(isSeverityValid(5)).toBe(true);
    expect(isSeverityValid(0)).toBe(false);
    expect(isSeverityValid(6)).toBe(false);
    expect(isSeverityValid("3")).toBe(false);
  });

  it("rejects severity for options that do not support it", () => {
    expect(() =>
      validateReportItems(
        [{ optionId: "option-1", selected: true, severity: 3 }],
        [{ id: "option-1", allowsSeverity: false }]
      )
    ).toThrow("severity_not_allowed");
  });

  it("requires valid severity when severity-enabled option is selected", () => {
    expect(() =>
      validateReportItems(
        [{ optionId: "option-1", selected: true }],
        [{ id: "option-1", allowsSeverity: true }]
      )
    ).toThrow("severity_required");
  });

  it("evaluates only supported deterministic alert rules", () => {
    const selected = new Map([["option-1", { selected: true, severity: 4 }]]);

    expect(evaluateAlertRule({ ruleType: "symptom_selected", optionId: "option-1", configuration: {} }, selected)).toBe(true);
    expect(evaluateAlertRule({ ruleType: "severity_threshold", optionId: "option-1", configuration: { minimum: 4 } }, selected)).toBe(true);
    expect(evaluateAlertRule({ ruleType: "severity_threshold", optionId: "option-1", configuration: { minimum: 5 } }, selected)).toBe(false);
    expect(evaluateAlertRule({ ruleType: "photo_missing", optionId: "option-1", configuration: {} }, selected)).toBe(false);
  });

  it("builds report payload without free text fields", () => {
    const payload = buildReportItemsPayload([{ optionId: "option-1", selected: true, severity: 2, note: "not allowed" }]);
    expect(payload).toEqual([{ option_id: "option-1", selected: true, severity: 2 }]);
  });
});
