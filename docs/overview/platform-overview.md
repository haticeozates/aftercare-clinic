---
type: Overview
title: Platform Overview
description: AfterCare Clinic Platform purpose, stack, and delivered functional scope through Faz 8.3B.
resource: aftercare-clinic-platform
tags: [overview, nextjs, supabase]
timestamp: 2026-07-08T21:31:00Z
okf_version: "0.1"
---

# Purpose

AfterCare Clinic Platform is a production-oriented foundation for clinic aftercare workflows. It is intentionally separate from `aftercare-clinic-demo` and from game/demo projects. The codebase prioritizes tenant isolation, append-only audit trails, and privacy-safe portal access over feature breadth.

# Technology Stack

| Layer | Choice |
|-------|--------|
| Application | Next.js 16 App Router, React 19, TypeScript |
| Database | Supabase Postgres with Row Level Security (RLS) |
| Auth (clinic) | Supabase Auth email/password |
| Auth (portal) | HttpOnly session cookie from secure link exchange |
| Image processing | Sharp (server-side Node.js routes only) |
| Testing | Vitest (unit/integration), Playwright (E2E), pgTAP (DB) |

# Application Surfaces

| Surface | Base path | Auth model |
|---------|-----------|------------|
| Clinic staff UI | `/clinic/*` | Supabase Auth + active organization membership |
| Patient care portal | `/care/*` | Secure link token → short-lived portal session |
| Internal jobs | `/internal/jobs/*` | Bearer secret (`PHOTO_CLEANUP_SECRET`) |

# Delivered Phases (Faz 0–8.3B)

| Phase | Capability |
|-------|------------|
| 0–1 | Foundation: org/membership/roles, RLS, audit, env validation |
| 1.5 | Local Supabase workflow, pgTAP and live RLS regression |
| 2 | Tenant-safe clients and procedures |
| 2.5 | Local auth sessions and role-based browser E2E |
| 3 | Care templates with immutable published versions |
| 4 | Care plan snapshots and secure access links |
| 5 | Client care portal: daily tasks and task event history |
| 6 | Structured check-ins and deterministic clinical alerts |
| 6.5 | Premium clinical design system and responsive UI |
| 7.1–7.4 | Private photo upload, finalize, clinic viewer, orphan cleanup |
| 8.1–8.2 | Consent/notice documents, portal decisions, data request submission |
| 8.3A | Clinic consent document management UI |
| 8.3B | Client document assignment and data request review |

See [Phase Handoff](../references/phase-handoff.md) for continuation details and verification habits.

# Repository Layout

| Path | Role |
|------|------|
| `app/` | Next.js routes (clinic, care portal, internal jobs) |
| `lib/` | Server-side domain services, validation, authorization |
| `components/` | Clinic shell, portal UI, shared primitives |
| `supabase/migrations/` | Ordered SQL migrations |
| `supabase/tests/` | pgTAP database tests |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Application test suites |

# Citations

[1] [README](../../README.md) — project scope and local setup summary
