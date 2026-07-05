# AfterCare Clinic Platform

Production foundation for AfterCare Clinic. This project is intentionally separate from
`aftercare-clinic-demo`.

## Phase Scope

Included in Faz 0-1:

- Next.js App Router + TypeScript foundation
- Environment validation
- Supabase SSR client helpers
- Organization, role, permission and membership model
- Tenant isolation/RLS migration
- Append-only audit foundation
- Synthetic local/test seed
- Unit, integration and RLS policy tests

Out of scope:

- Clients/danışan records
- Procedures
- Care templates/plans
- Secure links
- Client portal
- Symptoms, alerts, photos/storage
- Consent/data requests
- WhatsApp, payment, analytics, AI
- Real personal, health or photo data
- Remote Supabase project or deployment

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run verify
```

Supabase CLI is expected for local database work:

```bash
supabase start
supabase db reset
npm run test:rls
```

If the CLI is not installed, SQL migrations and seed files can still be reviewed and
committed, but real RLS integration tests cannot run against local Postgres.

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
npm run build
npm run verify
```

## Synthetic Data Rule

Only synthetic local/test data is allowed. Do not store real users, client records,
health data, photos, tokens or production credentials in this repository.
