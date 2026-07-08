---
type: Business Rule
title: Tenant Isolation
description: Multi-tenant boundary enforcement via RLS, composite FKs, and server-side organization context.
resource: supabase/migrations/
tags: [tenancy, rls, security]
timestamp: 2026-07-08T21:31:00Z
---

# Principle

Every clinic data row belongs to exactly one `organizations` record. Cross-tenant reads and writes must fail at both the application layer and Postgres RLS.

Organization context is resolved from:

- **Clinic paths:** active `organization_memberships` for the authenticated Supabase user.
- **Portal paths:** validated `portal_sessions` scope (one care plan, one organization).

Never trust `organization_id` or similar fields from browser form input without membership/session validation.

# Enforcement Layers

| Layer | Mechanism |
|-------|-----------|
| Database | Row Level Security policies on all tenant tables |
| Application | `lib/authorization/` permission checks before mutations |
| Schema | Composite foreign keys tying child rows to parent organization |
| Tests | pgTAP (`supabase/tests/`) and live RLS tests (`tests/rls/`) |

# RLS Testing Requirements

RLS tests must not silently skip when local Postgres is unavailable.

Verification commands:

```bash
npm run supabase:start
npm run db:reset
npm run test:db
npm run test:rls:local
```

Seed data includes Alpha and Beta organizations for cross-tenant denial tests.

# Audit Foundation

`audit_logs` is append-only. Browser clients cannot insert audit rows directly. Metadata fields use allowlists — no PII, tokens, storage paths, or document body text.

See [Foundation Modules](../modules/foundation-modules.md).

# Service Role Usage

`SUPABASE_SERVICE_ROLE_KEY` is server-only (`lib/supabase/admin.ts`). Use is narrow: migrations, seed, cleanup jobs, and explicit admin operations — never in client components or `NEXT_PUBLIC_*` env vars.

# Related

- [ADR 0001](../adr/0001-production-foundation.md) — foundation decision
- [Schema by Phase](../tables/schema-by-phase.md) — table inventory
- [Verification Gates](../playbooks/verification-gates.md)
