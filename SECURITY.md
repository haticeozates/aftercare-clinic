# Security Policy

This repository is currently a production foundation only. It must not process real
personal data, health data, photos, payment data or production credentials.

## Secret Handling

- Keep all secrets in environment variables.
- Never expose service role keys to browser code.
- Never commit `.env`, database dumps or real screenshots.
- Do not log tokens, secrets, phone numbers, full email addresses or photo URLs.

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
The current token validation path has a local rate-limit hook only; a durable shared
rate limiter is required before production use with real data.

## Reporting

During this early private phase, report suspected security issues directly to the
project owner. Do not create public issues containing secrets, tenant data or exploit
details.
