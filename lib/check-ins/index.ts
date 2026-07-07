export interface CheckInOptionInput {
  id: string;
  allowsSeverity: boolean;
}

export interface ReportItemInput {
  optionId: string;
  selected: boolean;
  severity?: unknown;
  note?: unknown;
}

export interface AlertRuleInput {
  ruleType: string;
  optionId: string | null;
  configuration: Record<string, unknown>;
}

export interface SelectedReportItem {
  selected: boolean;
  severity: number | null;
}

export function isSeverityValid(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

export function sanitizePortalCheckIn(raw: Record<string, unknown>) {
  const options = Array.isArray(raw.options) ? (raw.options as Array<Record<string, unknown>>) : [];

  return {
    options: options.map((option) => ({
      id: String(option.id ?? ""),
      label: String(option.label ?? ""),
      allowsSeverity: option.allows_severity === true || option.allowsSeverity === true
    }))
  };
}

export function validateReportItems(items: ReportItemInput[], options: CheckInOptionInput[]) {
  const optionMap = new Map(options.map((option) => [option.id, option]));
  const seen = new Set<string>();

  return items.map((item) => {
    const option = optionMap.get(item.optionId);
    if (!option) {
      throw new Error("invalid_option");
    }

    if (seen.has(item.optionId)) {
      throw new Error("duplicate_option");
    }
    seen.add(item.optionId);

    if (!item.selected) {
      if (item.severity != null) {
        throw new Error("severity_not_allowed");
      }
      return { optionId: item.optionId, selected: false, severity: null };
    }

    if (!option.allowsSeverity) {
      if (item.severity != null) {
        throw new Error("severity_not_allowed");
      }
      return { optionId: item.optionId, selected: true, severity: null };
    }

    if (!isSeverityValid(item.severity)) {
      throw new Error("severity_required");
    }

    return { optionId: item.optionId, selected: true, severity: item.severity };
  });
}

export function evaluateAlertRule(rule: AlertRuleInput, selectedItems: Map<string, SelectedReportItem>) {
  if (!rule.optionId) {
    return false;
  }

  const item = selectedItems.get(rule.optionId);
  if (!item?.selected) {
    return false;
  }

  if (rule.ruleType === "symptom_selected") {
    return true;
  }

  if (rule.ruleType === "severity_threshold") {
    const minimum = rule.configuration.minimum;
    if (!isSeverityValid(minimum) || !isSeverityValid(item.severity)) {
      return false;
    }

    return item.severity >= minimum;
  }

  return false;
}

export function buildReportItemsPayload(items: ReportItemInput[]) {
  return items.map((item) => ({
    option_id: item.optionId,
    selected: item.selected,
    severity: isSeverityValid(item.severity) ? item.severity : null
  }));
}

export function mapCheckInError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("duplicate") || message.includes("already submitted")) {
    return "Bugün için bildiriminiz zaten kaydedildi.";
  }

  if (message.includes("severity")) {
    return "Seçilen durum için geçerli bir şiddet değeri seçin.";
  }

  if (message.includes("invalid") || message.includes("permission")) {
    return "Bağlantı geçersiz veya süresi dolmuş.";
  }

  return "Bildiriminiz kaydedilemedi. Lütfen sayfayı yenileyin.";
}
