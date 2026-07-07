# AfterCare Clinic Phase Handoff

Last updated: 2026-07-07

This document is the practical continuation map for the production project. It records what has already been built, what is intentionally not included yet, and where the next machine/session should continue.

## Current Repository State

- Repository: `https://github.com/haticeozates/aftercare-clinic.git`
- Branch: `main`
- Current checkpoint commit: `66dbf69 wip: save phase 6.5 premium ui work`
- Previous completed checkpoint: `f9fc581 feat: add structured check-ins and clinical alerts`
- Current phase status: Faz 6.5 UI/UX work is saved as a WIP checkpoint, but final heavy verification was blocked on the old Mac because disk space stayed below the requested threshold.

## Important Boundaries

- Do not connect to remote/production Supabase.
- Do not deploy.
- Do not use real client, health, phone, photo, or clinic data.
- Use only local Supabase/Postgres and synthetic `.test` users/data.
- Do not add Faz 7 photo/storage work until Faz 6.5 is fully verified and accepted.
- `.env.local` is intentionally not tracked. Recreate it per machine from local Supabase values and project env examples.

## Phase Summary

### Faz 0-1: Production Foundation

Built:
- Next.js App Router + TypeScript production project foundation.
- Environment validation.
- Local Supabase setup structure.
- Auth foundation.
- Organization, membership, roles, permissions.
- Tenant isolation and RLS foundation.
- Append-only audit foundation.
- Synthetic seed and local/test safety rules.

Key point:
- The app is multi-tenant from the start. Organization context must come from active membership, not browser input.

### Faz 1.5: Local Supabase and Real RLS Verification

Built/verified:
- Local Supabase CLI workflow.
- Two clean DB reset flow.
- pgTAP/RLS tests against real local Postgres.
- Tenant isolation tests for Alpha/Beta organizations.
- Audit append-only and browser insert denial.
- Inactive membership access denial.

Key point:
- RLS tests are not allowed to silently skip.

### Faz 2: Client and Procedure Management

Built:
- `clients`
- `procedures`
- Client/procedure permissions.
- Tenant-safe RLS and constraints.
- Server-side services/actions.
- Basic production UI for clients and procedures.
- Synthetic seed records.

Security/product rules:
- No TC kimlik, address, health history, medical notes, photos, or treatment data.
- Phone is normalized and masked in UI.
- Client hard delete is not exposed; archive flow is used.

### Faz 2.5: Local Auth Session and Browser E2E

Built/verified:
- Real local Supabase email/password login.
- Logout and session reload behavior.
- Owner/admin/staff browser flows.
- Role-based UI and server-side permission checks.
- Playwright E2E for clients/procedures with real local auth sessions.

Key point:
- UI hiding is not a security boundary. Server permission checks and RLS remain the real defenses.

### Faz 3: Care Templates and Immutable Versioning

Built:
- `care_templates`
- `care_template_versions`
- `care_template_days`
- `care_template_tasks`
- `symptom_options`
- `alert_rules`
- Template permissions.
- Draft/published version model.
- Publish transaction.
- Immutable published version behavior.
- Template UI and E2E coverage.

Product rules:
- No real care/treatment instructions in seed or UI.
- Published template content cannot be silently edited. Changes require a new draft/version.

### Faz 4: Care Plan Snapshots and Secure Access Links

Built:
- Care plan snapshot model.
- Plan days/tasks generated from published template version snapshots.
- Secure link creation/rotation/revocation.
- Token hashing with pepper.
- One-time plaintext token display behavior.
- Initial care access route.
- Plan UI and secure-link tests.

Follow-up audit:
- Faz 4.1 acceptance gap audit was completed in `docs/qa/phase4-acceptance-gap-audit.md`.

Product/security rules:
- Plain token is only shown on create/rotate result.
- Reload must not show plaintext token again.
- URL must not contain client name, phone, procedure, health data, or predictable IDs.

### Faz 5: Client Care Portal and Daily Task Completion

Built:
- Token exchange to short-lived HttpOnly portal session.
- `/care/session`
- `/care/invalid`
- Portal plan/day/task read model.
- Task complete and reopen behavior.
- Append-only task event history.
- Day status recalculation.
- Portal privacy-safe DTOs.

Product/security rules:
- Portal does not use Supabase Auth user account.
- Portal session scope is one care plan.
- Portal response must not include phone, email, internal notes, IDs, token hashes, or session hashes.
- No symptoms, photos, messaging, or consent in this phase.

### Faz 6: Structured Check-In and Clinical Alert Review

Built:
- Plan-specific symptom option/rule snapshots.
- Structured portal check-in submission.
- Severity selection with safe 1-5 labels.
- Rule-based alert generation for supported deterministic rules.
- Clinic alert list/detail.
- Alert acknowledge/resolve/dismiss flow.
- Append-only alert event history.
- Audit and privacy controls.

Product rules:
- The system does not diagnose.
- The system does not say complication, dangerous, abnormal, urgent, or disease detected.
- Alerts mean only: clinic review is needed.
- No free-text health note, photo upload, AI, WhatsApp, messaging, appointment, consent, payment, or analytics.

### Faz 6.5: Premium UI/UX Design System and App Shell Redesign

Saved in current WIP checkpoint:
- Central visual tokens in global CSS.
- Reusable UI primitives.
- Premium clinic app shell with sidebar/mobile drawer.
- Login refresh.
- Dashboard refresh.
- Responsive client list behavior.
- Design-focused unit tests.
- Design-focused Playwright E2E smoke tests.

Known verification state before handoff:
- `npm run test:ui` passed: 3/3.
- `npm run test:e2e:design` passed: 12/12.
- `npm run test` passed: 86/86.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` was clean.

Not yet completed:
- Final heavy verification chain was not completed because the old Mac did not have enough free disk space.
- The WIP commit message is intentionally `wip: save phase 6.5 premium ui work`, not the final accepted phase commit.

## Next Session Continuation

On the new Windows machine:

1. Clone the repository.
2. Install Node dependencies.
3. Install/start Docker Desktop with WSL2 backend.
4. Recreate `.env.local` for local/test only.
5. Start local Supabase.
6. Continue Faz 6.5 polish/refinement if still requested.
7. Run full Faz 6.5 verification.
8. If all checks pass, create the final phase commit:

```text
feat: introduce premium clinical design system
```

Do not move to Faz 7 until Faz 6.5 is verified and accepted.

## Expected Full Verification For Faz 6.5

Use actual package scripts from `package.json`; do not invent missing script names.

Minimum expected chain:

```bash
npm install
npm run supabase:start
npm run db:reset
npm run db:reset
npm run db:lint
npm run test:db
npm run test:rls:local
npm run test:auth
npm run test:plans
npm run test:secure-links
npm run test:portal
npm run test:symptoms
npm run test:alerts
npm run test:e2e:phase2
npm run test:e2e:phase3
npm run test:e2e:phase4
npm run test:e2e:phase5
npm run test:e2e:phase6
npm run test:ui
npm run test:e2e:design
npm run test
npm run lint
npm run typecheck
npm run build
npm run verify:phase6-ui
npm audit
```

Also verify:
- `.env.local` is not tracked.
- Service role keys and peppers are not in the browser bundle.
- No new migrations or Faz 7 tables were added in Faz 6.5.
- Auth, roles, tenant isolation, client masking, immutable templates, plan snapshots, secure links, portal sessions, task completion, check-ins, alerts, and audit privacy still work.

## Future Phase

### Faz 7: Photo/Storage Security

Not started.

Expected direction:
- Private photo storage only.
- No real photos in development.
- Signed upload/download URLs.
- MIME/size validation.
- EXIF cleanup strategy.
- Photo view audit.
- Retention/delete rules.
- No AI/image analysis.
- No diagnosis or automated medical interpretation.
