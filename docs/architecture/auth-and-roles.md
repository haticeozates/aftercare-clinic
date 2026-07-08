---
type: Business Rule
title: Auth and Roles
description: Clinic Supabase Auth, portal session model, roles, and permission matrix.
resource: lib/auth/, lib/authorization/
tags: [auth, roles, permissions, rls]
timestamp: 2026-07-08T21:31:00Z
---

# Clinic Staff Authentication

Clinic users authenticate via Supabase Auth email/password (`lib/auth/actions.ts`).

Flow:

1. `signInWithPassword` establishes a Supabase session.
2. Server resolves active `organization_memberships` for the user.
3. Without active membership → redirect `/unauthorized`.
4. With membership → redirect `/clinic` with organization context.

Context helpers in `lib/auth/server.ts`:

| Function | Purpose |
|----------|---------|
| `getCurrentOrganizationContext()` | Resolve user + active membership |
| `requireActiveMembership()` | Throw if no active membership |
| `requireOrganizationPermission(key)` | Assert permission for current membership |

Layout guard: `app/clinic/layout.tsx` calls membership resolution before rendering clinic shell.

# Patient Portal Authentication

Portal users do **not** have Supabase Auth accounts.

1. Patient opens `/care/t/{token}` with a plaintext secure link token.
2. Server hashes token, validates `secure_links` row, creates `portal_sessions` record.
3. HttpOnly cookie `aftercare_portal_session` (path `/care`, ~15 min TTL) is set.
4. All portal mutations use session-scoped RPCs — organization/plan scope from validated session, never browser input.

# Roles

Defined in `lib/types/index.ts`:

| Role key | Display |
|----------|---------|
| `organization_owner` | Organization owner |
| `organization_admin` | Organization admin |
| `staff` | Staff |

Membership status must be `active` for access.

# Permission Model

`lib/authorization/index.ts` maps roles to `PermissionKey` values. Server actions call `hasPermission` / `assertOrganizationPermission`; RLS provides database-level enforcement.

## Owner and Admin (full manage)

Both `organization_owner` and `organization_admin` receive identical permission sets including:

- `membership.manage`, `audit.read`
- `client.*`, `procedure.manage`, `template.*`, `plan.*`, `secure_link.*`
- `alert.*`, `photo.read`, `photo.request.manage`, `photo.view`
- `consent.read`, `consent.manage`, `data_request.read`, `data_request.manage`

## Staff (read-heavy, limited manage)

Staff permissions exclude:

| Excluded permission | Effect |
|---------------------|--------|
| `membership.manage` | Cannot manage memberships |
| `audit.read` | No audit log access |
| `client.archive` | Cannot archive clients |
| `procedure.manage` | Read-only procedures |
| `template.create`, `template.update`, `template.publish`, `template.deactivate` | Read-only templates |
| `photo.request.manage` | Cannot create photo requests |
| `consent.manage` | Read-only consent documents and assignments |
| `data_request.manage` | Read-only data requests (no review actions) |

Staff **can** create/update plans, manage secure links, acknowledge alerts, and view photos.

# Security Rule

UI element visibility is a UX concern only. Every mutation must re-check permissions server-side and rely on RLS for tenant boundaries.

# Related

- [Tenant Isolation](tenant-isolation.md)
- [Foundation Modules](../modules/foundation-modules.md)
