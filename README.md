# AfterCare Clinic Platform

Production-oriented foundation for AfterCare Clinic. This project is intentionally separate from `aftercare-clinic-demo` and from all game/demo projects.

## Current Scope

Included through Faz 8.3B:

- Next.js App Router + TypeScript foundation
- Local Supabase/Postgres development workflow
- Supabase SSR client helpers and server-only service clients
- Organization, role, permission and active membership model
- Tenant isolation, RLS, pgTAP and local RLS regression coverage
- Append-only audit foundation with metadata allowlists
- Tenant-safe client and procedure records
- Local Supabase Auth email/password clinic sessions
- Owner/admin/staff role-based browser E2E coverage
- Immutable care template versioning
- Care plan snapshots from published template versions
- Secure care links with hash-only token storage
- Scoped HttpOnly portal sessions
- Client care portal for daily tasks and append-only task event history
- Structured portal check-ins and deterministic clinical alert review
- Premium clinical design system, clinic shell and responsive portal UI
- Private photo upload foundation with incoming/final buckets
- Server-validated photo upload intent, finalize, metadata stripping and WebP normalization
- Clinic secure photo viewing through short-lived signed view URLs
- Conservative orphan photo cleanup infrastructure with dry-run and protected execute mode
- Immutable consent document foundation
- Notice acknowledgment and consent decision event history
- Portal document decisions for assigned published document versions
- Portal data request submission as a review workflow record
- Clinic consent document management (draft, publish, retire, archive)
- Clinic client document assignment create/cancel with portal visibility boundaries
- Clinic data request review with staff assignee assignment and event history
- Synthetic local/test seed and deterministic test fixtures

## Explicitly Out Of Scope

- Real patients, real health records, real phone/email data or real clinical content
- Real legal/KVKK document text or legal-compliance claims
- Electronic signature, signature canvas, browser fingerprinting, location capture or IP-based legal proof
- Automatic data export, automatic deletion or backup deletion
- Appointment scheduling
- Public marketing/landing page
- WhatsApp, SMS, email notification systems
- Payment, analytics, AI or image analysis
- Remote Supabase project access or production deployment

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run db:reset
npm run verify:phase8
```

Supabase CLI is installed as a dev dependency and should be run through npm scripts:

```bash
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:lint
npm run test:db
npm run test:rls:local
```

If the CLI is not installed, SQL migrations and seed files can still be reviewed, but real RLS integration tests cannot run against local Postgres.

Local auth users are synthetic `.test` accounts created by `supabase/seed.sql`. Use only local/test credentials and never store real user, client, health, legal, phone, email, photo or production credential data in this project.

## Environment

Server-only:

- `APP_ENV`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `PRODUCTION_SUPABASE_PROJECT_REF`
- `AUDIT_LOG_PEPPER`
- `PHOTO_CLEANUP_SECRET`

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Secrets must not be logged. `SUPABASE_SERVICE_ROLE_KEY`, `AUDIT_LOG_PEPPER` and cleanup secrets must never be prefixed with `NEXT_PUBLIC_` and must never be imported by client components.

## Test Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:rls:local
npm run test:auth
npm run test:photos
npm run test:consent
npm run test:data-requests
npm run test:portal-consent
npm run test:portal-data-requests
npm run test:e2e:phase7
npm run test:e2e:phase7-ui
npm run test:e2e:phase7-view
npm run test:e2e:phase7-cleanup
npm run test:e2e:phase8
npm run build
npm run verify
npm run verify:phase8
```

## Security Notes

Secure link validation and portal mutations use local rate-limit hooks where durable distributed limiting is not yet part of the product. A shared durable limiter remains a future hardening task before real production data.

Photo upload uses a private incoming bucket, server-side validation, WebP normalization, private final storage and short-lived signed view URLs. Raw tokens, signed URLs and storage keys must not be written to audit metadata or user-facing logs.

Consent and data request records are technical workflow records. Notice acknowledgment is not consent. Consent accept, decline and withdrawal are append-only events. Withdrawal does not automatically delete data or photos. Data requests do not automatically export or delete data.

## Synthetic Data Rule

Only synthetic local/test data is allowed. Do not store real users, client records, health data, legal documents, photos, tokens or production credentials in this repository.
