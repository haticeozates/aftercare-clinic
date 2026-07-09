---
type: Playbook
title: Verification Gates
description: npm verify commands, phase gates, and pre-commit quality checks for the platform.
tags: [playbook, testing, ci]
timestamp: 2026-07-08T21:31:00Z
---

# Quick Quality Check

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

`verify` = lint + typecheck + all Vitest + build.

# CI Gate

```bash
npm run verify:ci
```

Runs lint, typecheck, unit, integration, static RLS analysis, and build — no full E2E or live Postgres.

# Foundation Gate

```bash
npm run verify:foundation
```

Requires local Supabase: status → db reset → db lint → pgTAP → live RLS → verify.

# Phase Gates

Progressive gates from Faz 2 through Faz 8:

| Command | Adds beyond prior phase |
|---------|-------------------------|
| `verify:phase2` | Clients, procedures tests |
| `verify:phase2-ui` | Auth E2E |
| `verify:phase3` | Templates + E2E |
| `verify:phase4` | Plans, secure links + E2E |
| `verify:phase5` | Portal + E2E |
| `verify:phase6` | Symptoms, alerts + E2E |
| `verify:phase6-ui` | UI unit + design E2E |
| `verify:phase7` | Photos + photo E2E + cleanup |
| `verify:phase8` | Consent, data requests, all phase 8 E2E |

Current recommended gate before new work or merge to `main`:

```bash
npm run verify:predeploy
```

`verify:phase8` remains available for phase 8 regression without the full Faz 9A release gate.

# Faz 9A Pre-Deploy Gate

```bash
npm run verify:predeploy
```

Single fail-closed local release command. Requires local Supabase. Uses synthetic command-scoped secrets only; does not deploy or connect to remote Supabase.

Includes:

1. Repository hygiene
2. Migration integrity (`frozen-manifest.json`)
3. Canonical `next-env.d.ts`
4. Environment contract tests
5. `npm ci` (skip with `SKIP_NPM_CI=true` only for intentional reruns)
6. Double `db:reset`, `db:lint`, pgTAP, local RLS
7. Faz 9 rate-limit / Stage 2 hardening tests
8. Phase 7, 8, and 9 E2E
9. Full unit suite, lint, typecheck, production build, audit
10. Tracked worktree integrity

Supporting commands:

```bash
npm run verify:migration-integrity
npm run verify:repository-hygiene
npm run verify:tracked-worktree
npm run verify:linux-node24-clean   # Docker required
```

# Migration Freeze

Applied migrations through Faz 9A are listed in `supabase/migrations/frozen-manifest.json`.

- Do not edit, rename, or delete frozen migration files.
- Add new forward migrations only with a later timestamp prefix.
- Manifest updates require explicit review; the integrity script does not auto-rewrite the manifest.

# CI (GitHub Actions)

`.github/workflows/ci.yml` runs on `pull_request` and `push` to `main`:

| Job | Purpose |
|-----|---------|
| `static` | Hygiene, migration integrity, canonical next-env, release-gate unit tests, lint, typecheck, Sharp smoke |
| `database` | Supabase start, double reset, lint, pgTAP, local RLS, rate-limit tests |
| `e2e` | Phase 7, 8, and 9 browser E2E with synthetic secrets |
| `build` | Full unit suite, production build, audit, tracked worktree check |
| `predeploy-summary` | Fails unless all required jobs pass |

CI uses Ubuntu, Node 24, `npm ci`, and `permissions: contents: read`. No production secrets are required.

# Targeted Domain Tests

```bash
npm run test:clients
npm run test:procedures
npm run test:templates
npm run test:plans
npm run test:secure-links
npm run test:portal
npm run test:symptoms
npm run test:alerts
npm run test:photos
npm run test:consent
npm run test:clinic-consent
npm run test:clinic-assignment
npm run test:data-requests
npm run test:portal-consent
npm run test:portal-data-requests
npm run test:rate-limit
```

# Phase 9A Stage 2 Tests

```bash
npm run test:rate-limit
npm run test:e2e:phase9a-rate-limit
npm run test:e2e:phase9a-stage2
```

# Database Tests

```bash
npm run test:db          # pgTAP against local Supabase
npm run test:rls         # static SQL policy analysis
npm run test:rls:local   # live Postgres RLS regression
```

RLS tests must not silently skip.

# E2E Tests

```bash
npm run test:e2e:phase2   # through phase8
npm run test:auth         # login/reload/logout subset
```

E2E requires Playwright chromium and running dev server (Playwright config handles this).

# Pre-Work Checklist

From [Phase Handoff](../references/phase-handoff.md):

- [ ] `.env.local` not tracked
- [ ] Service role keys, peppers (`AUDIT_LOG_PEPPER`, `RATE_LIMIT_PEPPER`), cleanup secrets (`RATE_LIMIT_CLEANUP_SECRET`, `PHOTO_CLEANUP_SECRET`) not in browser bundles
- [ ] Audit metadata free of body text, PII, tokens, storage keys
- [ ] Generated files (`.next`, test results) not committed
- [ ] `npm audit` clean for phase gates that include it

# Related

- [Local Setup](local-setup.md)
- [Schema by Phase](../tables/schema-by-phase.md) — pgTAP file mapping
