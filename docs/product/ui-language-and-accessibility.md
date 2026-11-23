# UI Language and Accessibility

Authoritative user-facing vocabulary and baseline accessibility decisions for Faz 9B Stage 2B.

## Preferred Turkish terms

| Concept | Term |
|---------|------|
| Person receiving care | Danışan |
| Clinical procedure | İşlem |
| Care template | Bakım şablonu |
| Care plan | Bakım planı |
| Daily task | Günlük görev |
| Structured check-in | Durum bildirimi |
| Clinic alert | Takip bildirimi |
| Photo request | Fotoğraf talebi |
| Notice document | Bilgilendirme metni |
| Consent document | Onay metni / Tercih belgesi (portal) |
| Data request | Veri talebi |
| Assignee | Atanan çalışan |
| History | Geçmiş |
| Archived | Arşivlendi |
| Completed | Tamamlandı |
| Pending | Bekliyor |
| Cancelled | İptal edildi |

## Date and time

- Locale: `tr-TR`
- Timezone: `Europe/Istanbul`
- Use `formatDisplayDate` for date-only values
- Use `formatDisplayDateTime` for timestamps
- Do not show raw ISO strings in user-facing UI

## Accessibility baseline (Stage 2B)

- Clinic shell exposes skip link, mobile drawer focus trap, and focus return to menu trigger
- Shared `FeedbackMessage` keeps Stage 2A live-region semantics
- Portal document dialog traps Tab focus and restores focus to trigger on close
- Status badges always include visible Turkish text, not color alone

## Copy safety

User-facing text must not claim medical diagnosis, legal compliance, or treatment advice. Keep alert, photo, and check-in language structured and non-diagnostic.
