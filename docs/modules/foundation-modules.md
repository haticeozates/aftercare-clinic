---
type: Module
title: Foundation Modules
description: Core infrastructure modules for auth, authorization, environment, Supabase clients, and audit.
resource: lib/auth/, lib/authorization/, lib/env/, lib/supabase/, lib/audit/
tags: [modules, foundation, auth, audit]
timestamp: 2026-07-08T21:31:00Z
---

# Module Inventory

| Module | Path | Responsibility |
|--------|------|----------------|
| Auth | `lib/auth/` | Supabase session, org context, login/logout, route access |
| Authorization | `lib/authorization/` | Role → permission matrix, `hasPermission`, `assertOrganizationPermission` |
| Types | `lib/types/` | `RoleKey`, `PermissionKey`, `AuthUser`, `MembershipStatus` |
| Environment | `lib/env/` | Zod-validated server/public env vars |
| Supabase | `lib/supabase/` | SSR browser client, server client, admin service-role client |
| Audit | `lib/audit/` | Append-only audit action catalog and write helpers |
| Formatters | `lib/formatters.ts` | Date/time display helpers |

# Auth (`lib/auth/`)

| File | Role |
|------|------|
| `server.ts` | `getCurrentOrganizationContext`, `requireActiveMembership`, `requireOrganizationPermission` |
| `actions.ts` | `signIn`, `signOut` server actions |
| `route-access.ts` | Route-level access helpers |

# Authorization (`lib/authorization/`)

Single source of truth for role permissions. See [Auth and Roles](../architecture/auth-and-roles.md) for the staff vs owner/admin matrix.

# Environment (`lib/env/`)

Validated variables:

| Variable | Scope |
|----------|-------|
| `APP_ENV` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never `NEXT_PUBLIC_` |
| `AUDIT_LOG_PEPPER` | Server only |
| `PHOTO_CLEANUP_SECRET` | Server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public |

# Supabase Clients (`lib/supabase/`)

| Client | Usage |
|--------|-------|
| `browser.ts` | Client components (anon key) |
| `server.ts` | Server components/actions with user session |
| `admin.ts` | Service role — server-only narrow operations |

# Audit (`lib/audit/`)

Central append-only log for security-sensitive events. Photo activity uses audit (no separate `photo_events` table). Metadata is allowlisted per action type.

# Related

- [Tenant Isolation](../architecture/tenant-isolation.md)
- [Synthetic Data Rules](../playbooks/synthetic-data-rules.md)
