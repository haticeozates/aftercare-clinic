---
type: Playbook
title: Local Setup
description: Steps to install dependencies, start local Supabase, and run the full phase 8 verification gate.
tags: [playbook, setup, supabase]
timestamp: 2026-07-08T21:31:00Z
---

# Prerequisites

- Node.js (project targets Node 24 LTS default)
- Docker (for local Supabase)
- npm

# Steps

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run db:reset
npm run verify:phase8
```

# Supabase CLI

Supabase CLI is a dev dependency — always run through npm scripts:

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
npm run db:reset
npm run db:lint
npm run test:db
npm run test:rls:local
```

If the CLI cannot run, SQL migrations remain reviewable but live RLS integration tests will not execute.

# Environment Variables

Copy `.env.example` to `.env.local` (never commit `.env.local`).

| Variable | Scope | Notes |
|----------|-------|-------|
| `APP_ENV` | Server | Environment label |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Local Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Never `NEXT_PUBLIC_` |
| `AUDIT_LOG_PEPPER` | Server | Token/session hashing |
| `RATE_LIMIT_PEPPER` | Server | Opaque durable rate-limit key derivation (optional locally; required in production) |
| `RATE_LIMIT_CLEANUP_SECRET` | Server | Internal rate-limit bucket cleanup auth (separate from photo cleanup) |
| `PHOTO_CLEANUP_SECRET` | Server | Internal photo cleanup job auth |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Server | Guard rail for preview/local misconfiguration |

Populate from `npm run supabase:status` output after `supabase:start`.

# Local Auth Users

Synthetic `.test` accounts are created by `supabase/seed.sql`. Use only local/test credentials.

# Development Server

```bash
npm run dev
```

Clinic UI: `http://localhost:3000/login` → `/clinic`
Portal: requires a secure link from a seeded or test-created care plan.

# Phase 9A Stage 2 Checks

```bash
npm run test:rate-limit
npm run test:e2e:phase9a-rate-limit
npm run test:e2e:phase9a-stage2
```

Stage 2 E2E for rate-limit cleanup requires `RATE_LIMIT_CLEANUP_SECRET` in the dev server environment (the npm script sets a synthetic local value).

# Related

- [Verification Gates](verification-gates.md)
- [Synthetic Data Rules](synthetic-data-rules.md)
- [Boundaries and Scope](../overview/boundaries-and-scope.md)
