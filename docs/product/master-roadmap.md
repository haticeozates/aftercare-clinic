---
type: Product
title: Master Roadmap
description: Authoritative product-owner approved roadmap for AfterCare Clinic Platform phases 0–17 and optional modules.
tags: [product, roadmap, phases]
timestamp: 2026-07-09T01:20:00Z
okf_version: "0.1"
---

# AfterCare Clinic Platform — Master Roadmap

This document is the **authoritative product plan**. Older docs that mark a capability as “out of scope” or “deferred” mean it was deferred from that phase, not removed from the product.

Status values: `DONE` · `IN PROGRESS` · `PLANNED` · `DEFERRED` · `OPTIONAL` · `BLOCKED`

This production codebase is separate from the frozen presentation project `aftercare-clinic-demo`.

## Permanent product boundary

- No automatic diagnosis
- No automatic complication detection
- No treatment recommendation
- No medical-image interpretation without separate medical, legal and safety review

---

## Faz 0–8 — Secure Aftercare Core

**Status:** `DONE`

**Amaç:** Multi-tenant, RLS-backed clinic aftercare core with portal access, photos, consent and data-request workflows.

**Dahil olan işler:**

- Next.js / TypeScript / Supabase foundation
- Multi-tenant organizations
- Owner/admin/staff roles and permissions
- RLS and append-only audit
- Client and procedure management
- Immutable care templates and versions
- Care plan snapshots
- Secure links and portal sessions
- Daily tasks
- Structured check-ins and alerts
- Private photo upload/finalize/view/cleanup
- Consent/notice documents and assignments
- Data-request workflow
- Premium clinic and portal UI foundation

**Dahil olmayan işler:** Public website, signup, appointments, messaging, payments, analytics, platform admin, production go-live (later phases).

**Bağımlılıklar:** Local Supabase and synthetic fixtures only.

**Kapanış kriterleri:** Faz 0–8.3B verified and merged; core clinic/portal journeys covered by pgTAP, RLS and E2E.

---

## Faz 9A — Production Hardening Foundation

**Status:** `DONE` at code level; repository/merge operations may be tracked separately

**Amaç:** Durable rate limiting, env/logging/header hardening, migration integrity and predeploy gates.

**Dahil olan işler:**

- Durable shared rate limiting
- Production environment guards
- Safe structured logging and redaction
- Security headers and no-store boundaries
- Rate-limit cleanup operation
- Migration integrity
- Repository hygiene
- Node 24 and Sharp verification
- CI and predeploy gates

**Dahil olmayan / deferred operational requirements (remain visible):**

- Production schedulers — `DEFERRED`
- Strict CSP nonce/hash architecture — `DEFERRED`
- Next.js middleware-to-proxy migration — `DEFERRED`
- Real deployment and production credentials — `DEFERRED`

**Bağımlılıklar:** Faz 0–8 complete.

**Kapanış kriterleri:** Local `verify:predeploy` and GitHub CI jobs green for the hardening branch; no production deploy claimed.

---

## Faz 9B — Demo & Pilot Preparation

**Status:** `DONE` (local demo/pilot verification; production go-live deferred)

**Amaç:** Make the existing secure core demoable and pilot-ready without implementing Faz 10–17 product surfaces.

### Stage 1A — Clinic Photo Request Creation

**Status:** `DONE`

**Dahil:** Secure clinic-side request creation; owner/admin permission; audit; duplicate protection; portal visibility; photo upload/view regression.

**Dahil değil:** Edit/cancel/reschedule, reminders, bulk requests.

### Stage 1B — Master Roadmap, Demo Data & Golden Journey

**Status:** `DONE`

**Dahil:** Authoritative roadmap; deterministic local demo fixture; demo accounts and scenario; demo runbook; demo readiness/smoke verification.

**Dahil değil:** Stage 2 UI polish; Stage 3 full pilot tag/merge.

### Stage 2 — UI/UX Completion

**Status:** `DONE`

Loading/skeleton states; safe error states; success feedback pattern; empty-state consistency; confirmation patterns; form validation consistency; mobile viewport matrix; accessibility pass; Turkish copy consistency; date/time consistency; internal/technical message cleanup.

#### Stage 2A — Shared UI States and Feedback Foundation

**Status:** `DONE`

**Dahil:** `FeedbackMessage`, `FormStatusMessage`, `SubmitButton`, `LoadingState`; safe feedback contracts; clinic photo-request / consent / data-request / secure-link form feedback; portal task and check-in mutation feedback; demo-critical `loading.tsx` routes; empty-state alignment on priority lists; RED→GREEN UI feedback tests.

**Dahil değil:** Global toast dependency; full-app skeleton rollout; navigation redesign; mobile/a11y/copy pass (Stage 2B).

#### Stage 2B — Mobile, Accessibility and Copy Consistency

**Status:** `DONE`

**Dahil:** Viewport overflow hardening; skip link and mobile drawer focus; landmark/heading consistency; form label and `aria-describedby` alignment; Turkish product vocabulary; `tr-TR` / `Europe/Istanbul` date-time display; portal data-request and document-card shared feedback; Stage 2B unit/E2E regressions; [UI language reference](../product/ui-language-and-accessibility.md).

**Dahil değil:** Full WCAG audit; navigation redesign; Stage 2C confirmation polish.

#### Stage 2C — Final Screen-by-Screen Polish

**Status:** `DONE`

**Dahil:** Shared `ConfirmDialog` for destructive plan stop, secure-link rotate/revoke, client archive, and template publish; client edit validation feedback; Turkish status/resolution/severity/purpose labels; semantic badge variants; safe `not-found` and global `error` boundaries; tablet link-action stacking; Stage 2C gap/unit/E2E regressions; [UI screen acceptance checklist](../playbooks/ui-screen-acceptance-checklist.md).

**Dahil değil:** Full WCAG audit; navigation redesign; Stage 3 pilot verification.

### Stage 3 — Pilot Verification

**Status:** `DONE` (local)

**Dahil:** `npm run verify:phase9b`; golden journey E2E (`phase9b-pilot-golden-journey`); [pilot readiness checklist](../playbooks/pilot-readiness-checklist.md); [pilot user guide](../playbooks/pilot-user-guide.md); [acceptance matrix](../references/phase9b-acceptance-matrix.md); demo runbook dry-run alignment.

**Dahil değil:** Git tag, remote push, main merge, production deployment, legal/compliance sign-off.

**Bağımlılıklar:** Faz 9A code complete; Stages 1A–2C complete.

**Kapanış ifadesi:** Local demo/pilot verification completed; production go-live remains deferred.

---

## Faz 10 — Public Website & Brand Experience

**Status:** `PLANNED`

**Amaç:** Public marketing site with `/` as public homepage and `/login` as clinic login.

**Dahil:** Homepage; hero and clinic value proposition; product screenshots; features; how it works; use cases; pricing; FAQ; about; contact; demo request form; privacy, terms, KVKK and cookie pages; SEO and mobile public design.

**Dahil değil:** Authenticated clinic product work beyond linking to login.

**Bağımlılıklar:** Faz 9B pilot readiness preferred.

**Kapanış kriterleri:** Public pages ship with synthetic/marketing content only; no real clinic PII.

---

## Faz 11 — Signup, Onboarding & Clinic Administration

**Status:** `PLANNED`

**Amaç:** Self-serve clinic onboarding and team administration.

**Dahil:** Clinic owner signup; email verification; forgot/reset/change password; clinic creation; logo and brand settings; address, timezone and working hours; service/procedure catalog; onboarding checklist; team invitations; invite accept/revoke/resend; role changes; membership deactivation; last-owner protection; clinic settings; account closure workflow.

**Bağımlılıklar:** Faz 10 public entry points helpful; auth foundation from Faz 2.5.

**Kapanış kriterleri:** New clinic can self-onboard without manual seed intervention.

---

## Faz 12 — Appointments & Calendar

**Status:** `PLANNED`

### 12A Clinic scheduling

Daily/weekly/monthly calendar; staff availability; working hours and leave; appointment create/reschedule/cancel; waiting/confirmed/completed/no-show statuses; service and specialist selection; appointment → procedure → care plan flow.

### 12B Public online booking

Public service selection; specialist selection; available slots; clinic approval; waiting list; optional deposit decision.

**Bağımlılıklar:** Faz 11 clinic administration.

**Kapanış kriterleri:** Clinic can schedule and optionally accept public bookings without weakening tenant isolation.

---

## Faz 13 — Notifications & Communication

**Status:** `PLANNED`

Email; SMS; WhatsApp; in-app notifications; appointment reminders; care-plan delivery; task/check-in reminders; photo request reminders; consent reminders; clinic alert notifications; templates; delivery logs; retry/failure handling; opt-out; quiet hours; timezone and channel preferences; messaging cost tracking.

**Bağımlılıklar:** Faz 12 for appointment reminders; existing care/photo/consent events.

**Kapanış kriterleri:** Channel delivery is audited; opt-out and quiet hours enforced.

---

## Faz 14 — Plans, Subscription & Payments

**Status:** `PLANNED`

Trials; subscription plans; server-side entitlements and limits; users/clients/plans/storage/message limits; payment; billing information; upgrade/downgrade; cancellation; failed payment handling; grace period; invoice history.

**Bağımlılıklar:** Faz 11 clinic accounts.

**Kapanış kriterleri:** Entitlements enforced server-side; no browser-trusted plan state.

---

## Faz 15 — Analytics, Reporting & Data Operations

**Status:** `PLANNED`

Clinic metrics; task/check-in completion; alert response and resolution; pending photo requests; consent and data-request status; filtered reports; CSV/PDF export; export audit; automated data-export preparation; deletion-request operations; retention rules; advanced audit viewer.

**Bağımlılıklar:** Core operational data from Faz 0–8; entitlements from Faz 14 for limits.

**Kapanış kriterleri:** Exports are audited; no cross-tenant leakage.

---

## Faz 16 — Platform Admin & Customer Operations

**Status:** `PLANNED`

Clinic account list; trial/subscription state; usage and limits; suspension/reactivation; support tickets; platform status; feature flags; system announcements; storage/cost monitoring; audited support tooling; strict break-glass access if ever required.

**Bağımlılıklar:** Faz 14–15.

**Kapanış kriterleri:** Support actions are audited; break-glass is exceptional and logged.

---

## Faz 17 — Production Go-Live

**Status:** `PLANNED`

Remote Supabase; region decision; domain and SSL; production secrets; photo and rate-limit schedulers; backup and restore test; monitoring and error tracking; uptime and alerting; incident response; secret rotation; rollback; strict CSP; security review and penetration testing; lawyer-approved legal/KVKK documents; data-processing agreements; pilot clinic; training; controlled rollout; paid launch.

**Bağımlılıklar:** Faz 9A hardening + Faz 9B pilot prep + operator readiness.

**Kapanış kriterleri:** Controlled paid launch with rollback and incident playbooks.

---

## Optional future modules

**Status:** `OPTIONAL`

- Multi-branch clinics
- White-label portal
- Multiple languages
- PWA/mobile applications
- Inventory/product management
- Loyalty and campaigns
- Before/after gallery
- Integrations
- Safe operational AI assistant (non-diagnostic)

---

## Related

- [Product index](index.md)
- [Phase handoff](../references/phase-handoff.md)
- [Demo runbook](../playbooks/demo-runbook.md)
