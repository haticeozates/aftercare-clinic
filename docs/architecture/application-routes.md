---
type: Guide
title: Application Routes
description: Next.js App Router route map for clinic UI, patient portal, and internal jobs.
resource: app/
tags: [architecture, routes, nextjs]
timestamp: 2026-07-08T21:31:00Z
---

# Clinic Routes (`/clinic/*`)

Guarded by `app/clinic/layout.tsx` — requires active organization membership via [Auth and Roles](auth-and-roles.md).

| Route | File | Purpose |
|-------|------|---------|
| `/clinic` | `app/clinic/page.tsx` | Dashboard overview |
| `/clinic/clients` | `app/clinic/clients/page.tsx` | Client list |
| `/clinic/clients/new` | `app/clinic/clients/new/page.tsx` | Create client |
| `/clinic/clients/[id]` | `app/clinic/clients/[id]/page.tsx` | Client detail + consent assignments |
| `/clinic/procedures` | `app/clinic/procedures/page.tsx` | Procedure catalog |
| `/clinic/templates` | `app/clinic/templates/page.tsx` | Care template list |
| `/clinic/templates/[id]` | `app/clinic/templates/[id]/page.tsx` | Template detail and version history |
| `/clinic/templates/[id]/draft` | `app/clinic/templates/[id]/draft/page.tsx` | Draft editor |
| `/clinic/plans` | `app/clinic/plans/page.tsx` | Care plan list |
| `/clinic/plans/[id]` | `app/clinic/plans/[id]/page.tsx` | Plan detail, secure links, photo requests |
| `/clinic/alerts` | `app/clinic/alerts/page.tsx` | Clinical alert list |
| `/clinic/alerts/[id]` | `app/clinic/alerts/[id]/page.tsx` | Alert review (acknowledge/resolve/dismiss) |
| `/clinic/consent-documents` | `app/clinic/consent-documents/page.tsx` | Consent document management |
| `/clinic/data-requests` | `app/clinic/data-requests/page.tsx` | Data request review and assignment |
| `/clinic/photos/[photoRecordId]/view-url` | `app/clinic/photos/[photoRecordId]/view-url/route.ts` | Short-lived signed view URL |

# Auth Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Redirects to `/login` |
| `/login` | `app/login/page.tsx` | Supabase email/password login |
| `/unauthorized` | `app/unauthorized/page.tsx` | No active membership |

# Patient Portal Routes (`/care/*`)

No Supabase Auth — session from secure link exchange. See [Patient Portal Workflows](patient-portal-workflows.md).

| Route | File | Purpose |
|-------|------|---------|
| `/care/t/[token]` | `app/care/t/[token]/route.ts` | Token validation → HttpOnly session cookie |
| `/care/session` | `app/care/session/page.tsx` | Main portal UI |
| `/care/invalid` | `app/care/invalid/page.tsx` | Invalid or expired link |
| `/care/session/tasks` | `app/care/session/tasks/route.ts` | Task complete/reopen |
| `/care/session/check-in` | `app/care/session/check-in/route.ts` | Structured symptom check-in |
| `/care/session/documents` | `app/care/session/documents/route.ts` | Notice/consent decisions |
| `/care/session/data-requests` | `app/care/session/data-requests/route.ts` | Data request submission |
| `/care/session/photos/intents` | `app/care/session/photos/intents/route.ts` | Photo upload intent |
| `/care/session/photos/finalize` | `app/care/session/photos/finalize/route.ts` | Server-side finalize |

# Internal Routes

| Route | File | Purpose |
|-------|------|---------|
| `/internal/jobs/photo-cleanup` | `app/internal/jobs/photo-cleanup/route.ts` | Protected orphan photo cleanup job |

# Middleware

There is no `middleware.ts`. Auth enforcement lives in clinic layout, server helpers (`lib/auth/server.ts`), and session-scoped portal RPCs.

# Related

- [Clinic Workflows](clinic-workflows.md)
- [Clinical Modules](../modules/clinical-modules.md)
