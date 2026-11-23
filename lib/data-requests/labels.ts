import type { DataRequestStatus, DataRequestType } from "@/lib/data-requests";

export interface StaffAssigneeOption {
  userId: string;
  label: string;
}

export function dataRequestTypeLabel(type: DataRequestType) {
  return {
    access: "Erişim talebi",
    copy: "Kopya talebi",
    correction: "Düzeltme talebi",
    deletion: "Silme talebi",
    restriction: "Kısıtlama talebi",
    objection: "İtiraz talebi",
    withdraw_consent: "Onay geri çekme talebi",
    other: "Diğer talep"
  }[type];
}

export function dataRequestStatusLabel(status: DataRequestStatus) {
  return {
    submitted: "Gönderildi",
    under_review: "İncelemede",
    in_progress: "İşlemde",
    completed: "Tamamlandı",
    declined: "Reddedildi",
    cancelled: "İptal edildi"
  }[status];
}

export function dataRequestEventTypeLabel(eventType: string) {
  return (
    {
      submitted: "Gönderildi",
      review_started: "İnceleme başladı",
      assigned: "Personel atandı",
      status_changed: "Durum değişti",
      completed: "Tamamlandı",
      declined: "Reddedildi",
      cancelled: "İptal edildi"
    }[eventType] ?? "Olay"
  );
}

export function dataRequestResolutionCodeLabel(code: string) {
  return (
    {
      completed_without_export: "Dışa aktarma olmadan tamamlandı",
      manual_review_completed: "Manuel inceleme tamamlandı",
      manual_review_declined: "Manuel inceleme reddedildi",
      manual_review_cancelled: "Manuel inceleme iptal edildi",
      unsupported_request: "Desteklenmeyen talep",
      duplicate_request: "Yinelenen talep",
      cancelled_by_client: "Danışan tarafından iptal edildi",
      other_internal: "Diğer iç değerlendirme"
    }[code] ?? "Sonuç kodu"
  );
}
