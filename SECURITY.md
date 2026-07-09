# Security Policy

This repository is currently a production foundation only. It must not process real
personal data, health data, photos, payment data or production credentials.

## Secret Handling

- Keep all secrets in environment variables.
- Never expose service role keys to browser code.
- Never commit `.env`, database dumps or real screenshots.
- Do not log tokens, secrets, phone numbers, full email addresses or photo URLs.
- `RATE_LIMIT_PEPPER`, `RATE_LIMIT_CLEANUP_SECRET`, and `PHOTO_CLEANUP_SECRET` are separate server-only values and must not be reused semantically across jobs.

## Tenant Isolation

- Every tenant-owned table must carry `organization_id`.
- Browser-supplied `organization_id` is never trusted.
- RLS and server-side authorization must both be used.
- Cross-tenant denied access should be audit/security logged with safe metadata only.

## Audit

Audit records are append-only. Metadata must use an allowlist and must not include
request body dumps, health text, tokens, secrets, full contact details or storage URLs.

## Secure Links

Raw secure-link tokens must be processed only server-side, stored only as hashes with a
server-only pepper, and exchanged into short-lived HttpOnly portal session cookies.
Secure-link token exchange and portal task mutations use a durable PostgreSQL-backed shared
rate limiter with opaque HMAC-derived keys. Process-local counters are not used on these
security-critical routes. If the durable store is unavailable, the route fails closed and
returns a generic response without leaking token or tenant existence.

Portal task mutation routes also use the shared durable limiter in this stage. Distributed
rate limiting cleanup for expired buckets is available through a protected internal route
but is not wired to production cron yet.

## Operational Hardening (Faz 9A Stage 2)

- Production env validation fails fast for missing/weak/placeholder `RATE_LIMIT_PEPPER`, missing `RATE_LIMIT_CLEANUP_SECRET`, local Supabase URLs in production, and local/test environments pointed at the production project ref.
- Security-critical server logs use allowlisted structured fields only (operation, result, correlation ID, internal error code). Raw Postgres `message`, `details`, `hint`, tokens, sessions, limiter keys, IPs, signed URLs, and storage paths must not be logged.
- Baseline security headers are applied globally through middleware. HSTS is emitted only when `APP_ENV=production`. Strict CSP is deferred until nonce/hash App Router infrastructure exists.
- Sensitive portal, signed-view, and internal job responses use `Cache-Control: no-store, private`.

## Release Gates (Faz 9A Stage 3)

- Applied migrations are frozen in `supabase/migrations/frozen-manifest.json`. Frozen files must not be edited, renamed, or deleted.
- `npm run verify:predeploy` is the local fail-closed release gate. It uses synthetic secrets only and does not deploy or connect to remote Supabase.
- GitHub Actions CI on Ubuntu + Node 24 enforces migration integrity, repository hygiene, pgTAP, local RLS, phase 7/8/9 E2E, build, and audit checks with read-only permissions.
- Tracked secret artefacts (`.env.local`, `.next`, private keys, logs) are rejected by repository hygiene checks.

## Production Go-Live Prerequisites (outside this repo)

Faz 9A hardening foundation can be complete in code without approving a real production deployment. Before production go-live:

1. Bind scheduler/cron to photo cleanup and rate-limit cleanup internal routes with separate secrets.
2. Configure production environment values that satisfy `lib/env/index.ts`.
3. Confirm GitHub-hosted CI passes on the release branch.
4. Plan strict CSP separately once nonce/hash App Router infrastructure exists.

## Reporting

During this early private phase, report suspected security issues directly to the
project owner. Do not create public issues containing secrets, tenant data or exploit
details.
