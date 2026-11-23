---
type: Reference
title: Phase 9B Acceptance Matrix
description: Requirement-to-test mapping for Faz 9B demo/pilot local closure.
tags: [reference, phase9b, acceptance, verification]
timestamp: 2026-07-09T22:10:00Z
---

# Phase 9B Acceptance Matrix

Status legend: `DONE` = implemented and covered by persistent automated or documented manual verification in local scope.

| Requirement | Implementation | Persistent test | Manual/demo verification | Status | Notes |
|-------------|----------------|-----------------|--------------------------|--------|-------|
| Stage 1A clinic photo-request create | `create_photo_request_for_staff` RPC, plan detail form | `supabase/tests/phase9b_clinic_photo_request_create.test.sql`, `tests/e2e/phase9b-clinic-photo-request.spec.ts` | Demo runbook §9 | DONE | Owner/admin only |
| Stage 1B master roadmap | `docs/product/master-roadmap.md` | `tests/unit/phase9b-demo-fixture.test.ts` (roadmap refs in docs) | Review roadmap index | DONE | Authoritative plan |
| Demo fixture & scripts | `supabase/demo/phase9b-demo.sql`, `demo:setup`, `demo:reset` | `tests/unit/phase9b-demo-fixture.test.ts` | Demo runbook §4–5 | DONE | Separate from base seed |
| Demo safety/idempotency | Local-only guards in setup script | `tests/unit/phase9b-demo-fixture.test.ts`, `verify:phase9b` idempotency step | `demo:setup` twice | DONE | No raw tokens in SQL |
| Task state/history consistency | Portal task actions + plan snapshot events | `tests/e2e/phase5-portal.spec.ts`, golden journey task complete/reopen | Portal §12 runbook | DONE | Append-only history |
| Stage 2A feedback/loading | `FeedbackMessage`, `LoadingState`, clinic/portal forms | `tests/unit/phase9b-ui-feedback-gaps.test.ts`, `tests/e2e/phase9b-ui-feedback.spec.ts` | Clinic mutation smoke | DONE | No global toast dependency |
| Stage 2B mobile/a11y/copy | `globals.css`, skip link, Turkish copy | `tests/e2e/phase9b-mobile-a11y-copy.spec.ts`, `docs/product/ui-language-and-accessibility.md` | Viewport walkthrough | DONE | Not full WCAG audit |
| Portal check-in payload contract | `20260709110000_phase9b_restore_portal_check_in_payload.sql` | `supabase/tests/phase9b_portal_check_in_payload.test.sql` | Portal check-in in golden journey | DONE | Structured DTO |
| Stage 2C confirmation/status/date polish | `ConfirmDialog`, label maps, fallback screens | `tests/unit/phase9b-stage2c-gaps.test.ts`, `tests/e2e/phase9b-final-ui-polish.spec.ts` | Destructive action review | DONE | No raw enum in UI |
| Golden journey | End-to-end demo clinic ↔ portal ↔ follow-up | `tests/e2e/phase9b-pilot-golden-journey.spec.ts` | Pilot user guide | DONE | Synthetic data only |
| Security boundaries | RLS, tenant isolation, safe error copy | `tests/rls/local-postgres.test.ts`, module E2E suites | Staff/tenant checks in golden journey | DONE | No cross-tenant leakage |
| Local verification gate | `scripts/verify-phase9b.mjs` | `tests/unit/phase9b-stage3-gaps.test.ts`, `npm run verify:phase9b` | Pilot readiness checklist | DONE | Local Supabase only |
| Faz 9A production hardening | Rate limit, `verify:predeploy` | `tests/unit/phase9a-*.test.ts`, `verify:predeploy` (unchanged) | CI/predeploy runbook | DONE | Not weakened by 9B gate |

## Known deferred items (`DEFERRED` / `BLOCKED FOR PRODUCTION`)

| Item | Roadmap | Status |
|------|---------|--------|
| Remote Supabase / production credentials | Faz 9A+ ops | BLOCKED FOR PRODUCTION |
| Scheduler/cron & cleanup scheduling | Faz 9A ops | DEFERRED |
| Backup/restore automation | Ops | DEFERRED |
| Monitoring/error tracking | Ops | DEFERRED |
| Strict CSP / middleware-to-proxy migration | Faz 9A follow-up | DEFERRED |
| Legal/KVKK review & DPA | Compliance | BLOCKED FOR PRODUCTION |
| Real notification providers | Faz 12+ | DEFERRED |
| Signup/onboarding & team invitations | Faz 10–11 | DEFERRED |
| Appointment/calendar | Faz 13 | DEFERRED |
| Payments/subscriptions | Faz 14 | DEFERRED |
| Analytics/reporting | Faz 15 | DEFERRED |
| Platform admin | Faz 16 | DEFERRED |
| Public website / landing | Faz 10 | PLANNED |

These deferred items are not Faz 9B failures; they are explicit post-pilot roadmap work.

## Closure statement

Faz 9B is **demo/pilot-ready locally**. Production go-live, legal compliance claims, and real patient data remain **deferred**.
