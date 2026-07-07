export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type AlertSeverity = "low" | "medium" | "high";
export type AlertResolutionCode =
  | "reviewed_no_action"
  | "client_contact_planned"
  | "follow_up_planned"
  | "duplicate_report"
  | "other_internal";

export function alertStatusLabel(status: AlertStatus) {
  return {
    open: "Klinik değerlendirmesi bekliyor",
    acknowledged: "İncelendi",
    resolved: "Kapatıldı",
    dismissed: "Kapatıldı"
  }[status];
}

export function alertSeverityLabel(severity: AlertSeverity) {
  return {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek"
  }[severity];
}

export function resolutionCodeLabel(code: AlertResolutionCode) {
  return {
    reviewed_no_action: "İncelendi, ek aksiyon yok",
    client_contact_planned: "Danışanla iletişim planlandı",
    follow_up_planned: "Takip planlandı",
    duplicate_report: "Tekrarlanan bildirim",
    other_internal: "Diğer iç değerlendirme"
  }[code];
}

export function mapAlertError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("permission")) {
    return "Bu işlem için yetkiniz yok.";
  }
  if (message.includes("resolution")) {
    return "Geçerli bir kapatma nedeni seçin.";
  }
  if (message.includes("transition")) {
    return "Bu takip bildirimi bu durumdan değiştirilemez.";
  }
  return "Takip bildirimi güncellenemedi.";
}
