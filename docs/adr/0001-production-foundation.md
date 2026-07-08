---
type: Decision
title: ADR 0001 — Production Foundation
description: Accepted foundation for Faz 0–1 — Next.js, Supabase Auth/Postgres/RLS, org model, and audit.
tags: [adr, foundation, faz-0, faz-1]
timestamp: 2026-07-08T21:31:00Z
okf_version: "0.1"
---

# ADR 0001: Production Foundation

## Status

Accepted for Faz 0-1.

## Context

`aftercare-clinic-demo` is a frozen presentation demo with mock/localStorage data.
Production needs a separate foundation so security decisions, migrations, RLS policies
and real auth boundaries do not destabilize the demo.

## Decision

Use Next.js App Router with Supabase Auth, Supabase Postgres/RLS and Vercel-oriented
environment separation. This phase only creates the repository foundation, environment
validation, auth helpers, organization/membership tables, seeded roles/permissions,
RLS policies and append-only audit foundation.

## Rationale

Supabase SSR helpers support separate browser and server clients for Next.js App
Router. RLS provides a database-level tenant boundary, but it is not used alone:
server-side authorization helpers are also required to avoid trusting request-supplied
organization context.

## Accepted Risks

- Supabase CLI/local Postgres availability is required for full RLS integration tests.
- Provider/data-region decisions remain a legal and operational decision gate.
- Service-role operations must remain narrow and server-only.

## Deferred

Client, health, care template, care plan, secure link, portal, symptom, alert, photo,
consent, data request, WhatsApp and payment modules are intentionally excluded until
tenant isolation and audit behavior are proven.

## Revisit When

- Real health/photo data is planned.
- A pilot clinic requires a specific data region.
- Storage lifecycle/delete guarantees become a contractual requirement.
- Multi-organization switching becomes a product feature.
