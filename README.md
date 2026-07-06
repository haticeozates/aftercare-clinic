# AfterCare Clinic Platform

Production foundation for AfterCare Clinic. This project is intentionally separate from
`aftercare-clinic-demo`.

## Phase Scope

Included through Faz 4:

- Next.js App Router + TypeScript foundation
- Environment validation
- Supabase SSR client helpers
- Organization, role, permission and membership model
- Tenant isolation/RLS migration
- Append-only audit foundation
- Tenant-safe clients/danışan records
- Tenant-safe procedures/işlem records
- Local Supabase Auth email/password session flow
- Role-based browser E2E coverage for owner/admin/staff behavior
- Immutable care template versioning
- Care plan snapshots from current published template versions
- Secure care links with hash-only token storage
- Minimal token exchange to a no-data portal session placeholder
- Synthetic local/test seed
- Unit, integration and RLS policy tests

Out of scope:

- Symptoms, alerts, photos/storage
- Consent/data requests
- WhatsApp, payment, analytics, AI
- Real personal, health or photo data
- Remote Supabase project or deployment

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run db:reset
npm run verify:phase2-ui
```

Supabase CLI is installed as a dev dependency and should be run through npm scripts:

```bash
npm run supabase:start
npm run db:reset
npm run db:lint
npm run test:db
npm run test:rls:local
```

If the CLI is not installed, SQL migrations and seed files can still be reviewed and
committed, but real RLS integration tests cannot run against local Postgres.

Local auth users are synthetic `.test` accounts created by `supabase/seed.sql`.
Use only local/test credentials and never store real user, client, health or photo
data in this project.

## Environment

Server-only:

- `APP_ENV`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `PRODUCTION_SUPABASE_PROJECT_REF`
- `AUDIT_LOG_PEPPER`

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Secrets must not be logged. `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with
`NEXT_PUBLIC_` and must never be imported by client components.

## Test Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:rls
npm run test:auth
npm run test:e2e:phase2
npm run test:e2e:phase3
npm run test:e2e:phase4
npm run build
npm run verify
npm run verify:phase4
```

## Phase 4 Security Notes

Secure link validation currently uses a local rate-limit hook so tests and route
boundaries are explicit without adding a production-grade distributed limiter. Durable
rate limiting for token validation is a Faz 9 hardening decision and must be backed by
a shared store before real data is processed.

## Synthetic Data Rule

Only synthetic local/test data is allowed. Do not store real users, client records,
health data, photos, tokens or production credentials in this repository.
