# UI Screen Acceptance Checklist

Use this checklist when polishing or reviewing clinic and portal screens in Faz 9B Stage 2C and later.

For each priority screen, confirm:

- Heading: single meaningful `h1`
- Main landmark: content inside `<main>`
- Primary action: one clear primary CTA
- Secondary/destructive action: visually subordinate; destructive actions require confirmation when irreversible
- Loading: route or inline loading state where data is deferred
- Empty: helpful empty state with next step when lists are empty
- Error: safe Turkish feedback without technical codes
- Success: accessible success feedback after mutations
- Mobile: no horizontal overflow at 375–390px
- Tablet: readable layout at 768–820px
- Desktop: header/action hierarchy remains clear
- Keyboard: focus visible; dialogs trap focus and restore on close
- Focus: Escape closes dialogs; cancel is safe default
- Copy: Turkish product vocabulary; no raw enum or internal IDs
- Date/time: `tr-TR` formatters; no raw ISO in UI
- Status: badge text carries meaning beyond color
- Security-safe text: no PII, tokens, storage paths, or medical/legal claims

Priority screens:

1. Login / unauthorized / not-found / error
2. Clinic dashboard, clients, plans, alerts, data requests, consent
3. Plan detail (secure link, photo request, stop plan)
4. Portal session (tasks, check-in, photo upload, documents, data request)
5. Portal invalid/expired states
