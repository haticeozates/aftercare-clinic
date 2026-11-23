---
type: Reference
title: Phase Handoff
description: Practical continuation map — built phases, hard boundaries, verification habits, and next-phase direction.
tags: [reference, phases, handoff]
timestamp: 2026-07-08T21:43:00Z
okf_version: "0.1"
---

# AfterCare Clinic Phase Handoff

Last updated: 2026-07-09

This document is the practical continuation map for the production project. It records what has been built, what is intentionally excluded, and where the next phase should continue.

## Current Repository State

- Repository: `https://github.com/haticeozates/aftercare-clinic.git`
- Current local product branch for Faz 9B: `phase-9b-demo-pilot-prep`
- Current functional scope: Faz 0 through Faz 9A complete; Faz 9B Stages 1A–3 done locally; Faz 10 next (planning)
- Latest exact commit should be verified with `git log --oneline -5` before starting new work.
- `.env.local` is intentionally not tracked. Recreate it per machine from local Supabase values and `.env.example`.
- Authoritative product plan: [`docs/product/master-roadmap.md`](../product/master-roadmap.md).
- This production codebase is separate from the frozen presentation project `aftercare-clinic-demo`.

## Hard Boundaries

- Do not connect to remote/production Supabase.
- Do not deploy.
- Do not use real client, health, phone, email, legal, photo or clinic data.
- Use only local Supabase/Postgres and synthetic `.test` users/data.
- Do not start Faz 10–17 product surfaces until the current Faz 9B stage requests them.
- Appointment scheduling, public landing, notifications, payments and analytics are **planned** in the [master roadmap](../product/master-roadmap.md), not permanently excluded.
- Do not claim legal/KVKK compliance. The system stores technical records only.

## Phase Summary

### Faz 0-1: Production Foundation

Built:

- Next.js App Router + TypeScript project foundation.
- Environment validation and local Supabase structure.
- Organization, membership, roles and permissions.
- Tenant isolation and RLS foundation.
- Append-only audit foundation.
- Synthetic seed and local/test safety rules.

Key point: organization context must come from active membership or validated portal scope, not browser input.

### Faz 1.5: Local Supabase and RLS Verification

Built and verified:

- Local Supabase CLI workflow.
- Clean DB reset flow.
- pgTAP/RLS tests against real local Postgres.
- Tenant isolation tests for Alpha/Beta organizations.
- Audit append-only and browser insert denial.
- Inactive membership access denial.

Key point: RLS tests must not silently skip.

### Faz 2: Client and Procedure Management

Built:

- Tenant-safe `clients` and `procedures`.
- Client/procedure permissions.
- Server-side services/actions.
- Clinic UI for clients and procedures.
- Synthetic seed records.

Rules:

- No TC kimlik, address, health history, medical notes, photos or treatment data.
- Phone is normalized and masked where shown.
- Archive/inactive flows are used instead of hard delete.

### Faz 2.5: Local Auth Session and Browser E2E

Built:

- Real local Supabase email/password login.
- Logout and session reload behavior.
- Owner/admin/staff browser flows.
- Role-based UI plus server-side permission checks.

Key point: UI hiding is not a security boundary.

### Faz 3: Care Templates and Immutable Versioning

Built:

- `care_templates`, `care_template_versions`, `care_template_days`, `care_template_tasks`
- `symptom_options`, `alert_rules`
- Draft/published version model.
- Transactional publish flow.
- Immutable published content.
- Template UI and E2E coverage.

Rules:

- Published template content cannot be silently edited.
- Real care/treatment instructions are not used in seed or tests.

### Faz 4: Care Plan Snapshots and Secure Access Links

Built:

- Care plan snapshot model.
- Plan days/tasks generated from published template snapshots.
- Secure link creation, rotation and revocation.
- Token hashing with pepper.
- One-time plaintext token display.
- Initial care access route.

Follow-up:

- Faz 4.1 acceptance gap audit is documented in `docs/qa/phase4-acceptance-gap-audit.md`.

Rules:

- Plain token is only shown after create/rotate.
- Reload must not show plaintext token again.
- Links must not expose client, phone, procedure, health data or predictable IDs.

### Faz 5: Client Care Portal and Daily Task Completion

Built:

- Secure link exchange to a short-lived HttpOnly portal session.
- `/care/session` and `/care/invalid`.
- Portal plan/day/task read model.
- Task complete and reopen behavior.
- Append-only task event history.
- Day status recalculation.
- Privacy-safe portal DTOs.

Rules:

- Portal does not use Supabase Auth user accounts.
- Portal session scope is one care plan.
- Portal response excludes phone, email, internal notes, raw IDs, token hashes and session hashes.

### Faz 6: Structured Check-In and Clinical Alert Review

Built:

- Plan-specific symptom option and rule snapshots.
- Structured portal check-in submission.
- Severity selection with safe 1-5 labels.
- Deterministic rule-based alert generation.
- Clinic alert list/detail.
- Alert acknowledge, resolve and dismiss flow.
- Append-only alert event history.
- Audit and privacy controls.

Rules:

- The system does not diagnose.
- Alerts mean only that clinic review is needed.
- No AI, free-text health note, messaging, appointment, payment or analytics.

### Faz 6.5: Premium Clinical UI

Built:

- Central design tokens in global CSS.
- Reusable UI primitives.
- Premium clinic app shell with desktop sidebar and mobile drawer.
- Login and dashboard refresh.
- Responsive list/detail/form polish.
- Portal visual polish.
- Design unit and Playwright smoke tests.

Rules:

- Auth, permissions, RLS, portal security and audit behavior remained server-side.

### Faz 7.1: Photo Storage Foundation

Built:

- `photo_requests`, `photo_upload_intents`, `photo_records`.
- Private `care-photo-incoming` and `care-photos` buckets.
- Tenant-safe schema, grants and negative RLS tests.
- ADR for opaque path and private storage foundation.

Rules:

- No public buckets.
- No original filenames, client IDs or meaningful IDs in object paths.
- No photo events table; central audit is used.

### Faz 7.2: Secure Photo Upload Finalize

Built:

- Portal upload intent and signed upload credential backend.
- Atomic intent claim and processing lease behavior.
- Server-side image byte/decode validation with Sharp.
- Metadata stripping, orientation normalization and WebP output.
- Idempotent finalization and compensation for DB/storage boundary failures.

Rules:

- Signed token is not persisted.
- Incoming opaque path is stored server-side only as an object locator, not as a credential.
- Final object key never returns to the browser.

### Faz 7.3A: Portal Photo Upload UI

Built:

- Portal photo request card.
- Mobile-first file picker and preview.
- Client-side UX validation for JPEG/PNG/WebP and 5 MB limit.
- Real signed upload plus finalize UI flow.
- Safe retry and success states.

Rules:

- Path/token stay in component memory only.
- No final photo viewing in portal.
- No medical interpretation or image analysis.

### Faz 7.3B: Clinic Secure Photo Viewer

Built:

- Staff-side secure photo view authorization RPC.
- Short-lived signed view URL route.
- Plan/client photo card and accessible viewer.
- Audit for authorized view.
- Cross-tenant and inactive-staff denial coverage.

Rules:

- Final bucket stays private.
- Browser does not receive raw storage key or bucket path.
- No download, edit or delete workflow.

### Faz 7.4: Photo Cleanup Infrastructure

Built:

- Conservative orphan incoming/final cleanup classification.
- Safety windows and batch limits.
- Protected internal cleanup route.
- Dry-run and execute modes.
- Advisory/job lock behavior.
- Aggregate cleanup audit with redacted metadata.

Rules:

- If orphan status is uncertain, do not delete.
- Referenced finalized photos must not be deleted.
- Production cron is not connected in this phase.

### Faz 8.1: Consent Documents and Data Request Foundation

Built:

- Immutable consent/notice document model.
- Draft/published/retired document versions.
- Client document assignments.
- Append-only client document events.
- Data request workflow tables and append-only events.
- Consent/data-request permissions and RLS.
- Publish and data request transition foundations.
- ADR 0003 for legal-content boundaries.

Rules:

- Notice acknowledgment is not consent.
- Published document versions are immutable.
- Withdrawal does not delete historical events or user data.
- Data requests are workflow records only.

### Faz 8.2: Portal Document Decisions and Data Request Submission

Built:

- Portal-scoped document assignment DTO.
- Portal notice acknowledgment event.
- Portal consent accept and decline events.
- Portal consent withdrawal event.
- Idempotent duplicate-event handling.
- Portal data request submission.
- Portal-owned data request list.
- Safe modal/viewer UI for plain text document versions.
- Real browser E2E for notice, consent, withdrawal and data request submission.

Rules:

- Portal sees only assigned published versions for its own client/plan scope.
- Draft versions never enter portal DTOs.
- Document body is rendered as plain text, not HTML.
- Accept and decline are equally available; decline is not hidden or made harder.
- Withdrawal creates a new append-only event and does not trigger deletion/export.
- Data request submission does not automatically export or delete anything.

## Current Verification Habit

Before moving phases, run the relevant phase verifier and targeted tests:

```bash
npm run supabase:start
npm run db:reset
npm run db:reset
npm run db:lint
npm run test:db
npm run test:rls:local
npm run verify:phase8
npm test
npm run lint
npm run typecheck
npm run build
npm audit
```

Also check:

- `.env.local` is not tracked.
- Service role keys, peppers, cleanup secrets, signed URLs and tokens are not in browser bundles.
- Audit metadata does not contain body text, free text, PII, tokens, session hashes or storage keys.
- Generated files, `.next`, test results and cache files are not committed.

## Phase 8.3A — Completed

Clinic consent document management correction is complete.

Delivered:

- Clinic list/detail UI with inline create form (Phase 8.1 compatible heading and fields).
- Draft editor, semantic publish confirmation dialog, archive confirmation, readonly published viewer and version history.
- Owner/admin manage controls; staff read-only visibility; cross-tenant detail redirect.
- Service/action safe error mapping; no published-version mutation path.
- Unit/component tests (`test:clinic-consent`) and browser E2E (`phase8-clinic-consent-management.spec.ts`).
- Phase 8.1/8.2 regression coverage retained in `test:e2e:phase8`.

Verification:

```bash
npm run test:clinic-consent
npm run test:e2e:phase8
npm run verify:phase8
```

## Phase 8.3B — Completed

Clinic assignment and data request review is complete, including the controlled correction pass (`20260706082300_phase8_3b_security_and_workflow_corrections.sql`).

Delivered:

- Clinic client document assignment create/cancel/history on `app/clinic/clients/[id]/page.tsx` only (not care plan detail page).
- Owner/admin manage; staff read-only for assignments.
- Cancellation history shows timestamp and safe actor display name (no raw user IDs in browser DTOs).
- Data request review UI with staff assignee picker and append-only event history.
- Narrow `assign_data_request` RPC for assignee-only mutations without browser-supplied status.
- Tenant-safe data request transitions: cross-tenant IDs return generic `not found` without foreign denied audits.
- Server-side terminal resolution codes: `manual_review_completed`, `manual_review_declined`, `manual_review_cancelled`.
- Clinic `record_client_document_event` accepts only `source = clinic` (portal/system spoof denied).
- Migrations `20260706082200_phase8_3b_clinic_assignment_and_data_request_review.sql` and `20260706082300_phase8_3b_security_and_workflow_corrections.sql`.
- pgTAP: `phase8_3b_clinic_assignment_and_data_request_review.test.sql`, `phase8_3b_security_and_workflow_corrections.test.sql`.
- E2E: `phase8-clinic-consent-assignment.spec.ts`, `phase8-clinic-data-request-review.spec.ts`.

Archived portal boundary:

- Portal does not show archived-document assignments (pending or completed) in 8.3B.
- Clinic history retains all assignment states.
- `get_portal_document_assignments` was not extended for archived completed records.

Verification:

```bash
npm run test:clinic-assignment
npm run test:data-requests
npm run test:e2e:phase8
npm run verify:phase8
```

## Phase 9A Stage 1 — Durable Rate Limiting (complete)

Stage 1 replaces process-local abuse hooks on security-critical portal routes with a durable PostgreSQL-backed shared limiter.

Delivered in Stage 1:

- Migration `20260709090000_phase9a_durable_rate_limiting.sql` with atomic `consume_rate_limit` RPC and bounded `cleanup_expired_rate_limit_buckets` helper.
- Opaque HMAC key derivation via dedicated `RATE_LIMIT_PEPPER` (separate from audit and portal token peppers).
- Durable adapter for production/local Supabase; deterministic memory adapter for unit tests only.
- Fail-closed behavior when the durable store is unavailable.
- Migrated call sites: `/care/t/[token]` and `/care/session/tasks`.
- pgTAP `phase9a_durable_rate_limiting.test.sql`, unit/integration coverage, E2E `phase9a-rate-limit.spec.ts`.

## Phase 9A Stage 2 — Operational Hardening (complete)

Stage 2 hardens environment validation, safe logging, web security boundaries, sensitive cache control, and internal rate-limit bucket cleanup.

Delivered in Stage 2:

- Central production env validation for `RATE_LIMIT_PEPPER` (required, min length, no placeholders, must differ from `AUDIT_LOG_PEPPER`) and `RATE_LIMIT_CLEANUP_SECRET`.
- Supabase local/production project ref and URL guards in `lib/env/index.ts`.
- Safe structured server logging (`lib/observability/safe-log.ts`) with allowlisted results and internal error codes.
- Baseline security headers via `middleware.ts` (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame embedding denial, cross-origin policies).
- HSTS only when `APP_ENV=production`; not emitted for local/test/development.
- CSP deferred to Stage 3/future hardening until nonce/hash App Router infrastructure exists.
- `Cache-Control: no-store, private` on sensitive portal/rate-limit JSON responses and internal cleanup routes.
- Protected internal cleanup route `POST /internal/jobs/rate-limit-cleanup` with `RATE_LIMIT_CLEANUP_SECRET`, bounded batch deletes, and single-runner lock reuse.
- Unit/integration/E2E coverage: `phase9a-stage2-gaps.test.ts`, `phase9a-stage2.test.ts`, `phase9a-stage2-boundaries.test.ts`, `phase9a-stage2-hardening.spec.ts`.

## Phase 9A Stage 3 — CI, Migration Integrity, Pre-Deploy Gate (complete)

Stage 3 closes the production-hardening foundation with migration freeze enforcement, repository hygiene, expanded CI, and a single local pre-deploy gate.

Delivered in Stage 3:

- `supabase/migrations/frozen-manifest.json` with SHA-256 checksums for all applied migrations through Phase 9A.
- `scripts/verify-migration-integrity.mjs` — rejects frozen mutation, deletion, rename, and unexpected mid-history files; allows new forward migrations.
- `scripts/verify-repository-hygiene.mjs` — rejects tracked secrets, build artefacts, logs, and private key material.
- `scripts/verify-next-env-dts.mjs` — canonical tracked `next-env.d.ts` validator.
- `scripts/verify-tracked-worktree.mjs` — post-build/post-test dirty working tree detection.
- `scripts/verify-predeploy.mjs` exposed as `npm run verify:predeploy` with synthetic local secrets only.
- `scripts/verify-linux-node24-clean.mjs` exposed as `npm run verify:linux-node24-clean` for Docker-based clean installs.
- GitHub Actions CI split into `static`, `database`, `e2e`, `build`, and `predeploy-summary` jobs on Ubuntu + Node 24 with `contents: read` permissions.
- CI requires migration integrity, hygiene, pgTAP, local RLS, phase 7/8/9 E2E, production build, audit, and tracked worktree checks.
- Regression coverage: `phase9a-stage3-gaps.test.ts`, `phase9a-stage3-release-gate.test.ts`, `phase9a-stage3-ci-contract.test.ts`.

Explicitly not delivered in Faz 9A:

- Production deploy or remote Supabase usage.
- Production scheduler/cron wiring for photo or rate-limit cleanup (required before production go-live approval).
- Strict CSP enforcement (deferred until nonce/hash App Router infrastructure exists).
- `middleware.ts` → Next.js `proxy` migration (deferred; runtime security header behavior preserved and tested).
- Faz 9B product scope (started separately on `phase-9b-demo-pilot-prep`).

Verification:

```bash
npm run verify:migration-integrity
npm run verify:repository-hygiene
npm run test:unit -- tests/unit/phase9a-stage3-release-gate.test.ts
npm run verify:predeploy
```

Optional Linux clean install check:

```bash
npm run verify:linux-node24-clean
```

## Faz 9A Closure

Faz 9A production-hardening foundation is complete at the code and local verification level.

Production go-live still requires operator steps outside this repository:

1. Bind production scheduler/cron to `POST /internal/jobs/photo-cleanup` and `POST /internal/jobs/rate-limit-cleanup` with separate secrets.
2. Configure production environment values that pass `lib/env/index.ts` production guards.
3. Run GitHub-hosted CI on the release branch and confirm all jobs pass.
4. Plan strict CSP separately once nonce/hash infrastructure is available.

## Faz 9B — Demo & Pilot Preparation (in progress)

Authoritative plan: [`docs/product/master-roadmap.md`](../product/master-roadmap.md).

| Stage | Status |
|-------|--------|
| 1A Clinic photo-request creation | `DONE` |
| 1B Master roadmap, demo data & golden journey | `DONE` |
| 2 UI/UX completion | `IN PROGRESS` |
| 2A Shared UI states & feedback foundation | `DONE` |
| 2B Mobile, accessibility & copy consistency | `DONE` |
| 2C Final screen-by-screen polish | `DONE` |
| 3 Pilot verification | `DONE` (local) |

Stage 1A delivered:

- Forward migration `20260709100000_phase9b_clinic_photo_request_create.sql`
- `create_photo_request_for_staff` SECURITY DEFINER RPC
- Clinic contracts/service/action and plan-detail create UI
- pgTAP + unit/integration + E2E coverage

Stage 1B delivered:

- Authoritative [master roadmap](../product/master-roadmap.md)
- Separate deterministic fixture `supabase/demo/phase9b-demo.sql` + `npm run demo:setup` / `demo:reset`
- [Demo runbook](../playbooks/demo-runbook.md)
- Demo-readiness smoke E2E (not added to GitHub CI until Stage 3)

Stage 2A delivered (local):

- Shared feedback primitives (`FeedbackMessage`, `FormStatusMessage`, `SubmitButton`, `LoadingState`) and `lib/ui/feedback-contracts.ts`
- Clinic photo-request, consent assignment, data-request review, secure-link, and clients/data-requests empty-state alignment
- Portal task and check-in mutation feedback with accessible success/error semantics
- Demo-critical route loading fallbacks (`/clinic/plans/[id]`, `/clinic/data-requests`, `/care/session`)
- Unit gap/regression tests and `test:e2e:phase9b-ui` smoke coverage

Stage 2B delivered (local):

- Responsive clinic/portal layout hardening (`globals.css`, card stacking, modal overflow)
- Clinic shell skip link, mobile drawer focus trap, and focus return
- Turkish copy cleanup (login, unauthorized, alerts, templates, data-requests, consent assignment)
- `tr-TR` / `Europe/Istanbul` date-time on priority clinic lists
- Portal data-request and document-card alignment to Stage 2A feedback primitives
- Migration `20260709110000_phase9b_restore_portal_check_in_payload.sql` (restores structured check-in DTO dropped in Phase 7)
- `phase9b_portal_check_in_payload.test.sql` pgTAP contract for portal `check_in` DTO
- [UI language and accessibility reference](../product/ui-language-and-accessibility.md)
- Unit gap/consistency tests and `test:e2e:phase9b-mobile-a11y` viewport/a11y/copy smoke

Stage 2C delivered (local):

- Shared `ConfirmDialog` with focus trap, Escape, pending guard, and safe error feedback
- Destructive confirmations for plan stop, secure-link rotate/revoke, client archive, and template publish
- Client edit form with Turkish field validation via `useActionState`
- Status label mapping for data-request resolution, alert severity, consent purpose keys, and plan list badges
- Safe Turkish `not-found` and global `error` boundaries without stack or tenant leakage
- Tablet link-action stacking on plan detail; confirm dialog action spacing
- [UI screen acceptance checklist](../playbooks/ui-screen-acceptance-checklist.md)
- Unit gap/consistency tests and `test:e2e:phase9b-final-ui` polish smoke

Stage 3 delivered (local):

- `npm run verify:phase9b` orchestration (`scripts/verify-phase9b.mjs`) with local-only guard
- Golden journey E2E `tests/e2e/phase9b-pilot-golden-journey.spec.ts`
- [Pilot readiness checklist](../playbooks/pilot-readiness-checklist.md) and [pilot user guide](../playbooks/pilot-user-guide.md)
- [Phase 9B acceptance matrix](phase9b-acceptance-matrix.md)
- Demo runbook dry-run alignment; deferred production blockers documented

Before continuing to Faz 10:

- Stay on `phase-9b-demo-pilot-prep` until an approved release process requests push/tag/merge.
- Do not claim production ready, KVKK compliant, or medically validated.
- Do not connect to remote/production Supabase or deploy without an approved release process.
- Faz 10–17 surfaces remain roadmap-planned; do not implement them to “make the demo work”.
