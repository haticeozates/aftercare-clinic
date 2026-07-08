# AfterCare Clinic Phase Handoff

Last updated: 2026-07-08

This document is the practical continuation map for the production project. It records what has been built, what is intentionally excluded, and where the next phase should continue.

## Current Repository State

- Repository: `https://github.com/haticeozates/aftercare-clinic.git`
- Branch: `main`
- Current functional scope: Faz 0 through Faz 8.2
- Latest exact commit should be verified with `git log --oneline -5` before starting new work.
- `.env.local` is intentionally not tracked. Recreate it per machine from local Supabase values and `.env.example`.

## Hard Boundaries

- Do not connect to remote/production Supabase.
- Do not deploy.
- Do not use real client, health, phone, email, legal, photo or clinic data.
- Use only local Supabase/Postgres and synthetic `.test` users/data.
- Do not add appointment scheduling or public landing page work until explicitly requested.
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

## Phase 8.3A Status — Completed

Phase 8.3A clinic consent document management correction is complete on branch `phase-8-3a-cursor-correction`.

Delivered:

- Clinic list/detail UI with inline create form (Phase 8.1 compatible heading and fields).
- Draft editor, semantic publish confirmation dialog, archive confirmation, readonly published viewer and version history.
- Owner/admin manage controls; staff read-only visibility; cross-tenant detail redirect.
- Service/action safe error mapping; no published-version mutation path.
- Unit/component tests (`test:clinic-consent`) and browser E2E (`phase8-clinic-consent-management.spec.ts`).
- Phase 8.1/8.2 regression coverage retained in `test:e2e:phase8`.

Key commits in this correction series:

- `08612e5` — security gap tests
- `b85bdc3` — RPC authorization hardening
- `251e3c4` — service/action contract restoration
- Stage 3 UI/tests/docs commits on this branch (see git log)

Verification targets:

```bash
npm run test:clinic-consent
npm run test:e2e:phase8
npm run verify:phase8
```

## Next Phase

### Faz 8.3B: Clinic Assignment and Data Request Review

Expected direction:

- Client document assignment clinic workflows.
- Data request clinic review and staff assignment handling.
- Controlled staff/owner/admin workflows.
- No automatic export/delete.
- No legal-compliance claims.
- No appointment module or public landing page unless explicitly requested later.

Phase 8 overall is not fully closed until 8.3B completes.
