---
type: Module
title: Portal Modules
description: Patient portal session services, structured check-ins, and clinical alert review.
resource: lib/portal/, lib/check-ins/, lib/alerts/
tags: [modules, portal, check-ins, alerts]
timestamp: 2026-07-08T21:31:00Z
---

# Module Inventory

| Module | Path | Responsibility |
|--------|------|----------------|
| Portal | `lib/portal/` | Portal plan DTO, task mutations, session-scoped reads |
| Check-ins | `lib/check-ins/` | Symptom report validation, alert rule evaluation |
| Alerts | `lib/alerts/` | Alert list/detail, acknowledge/resolve/dismiss |

# Portal (`lib/portal/`)

| File | Role |
|------|------|
| `service.ts` | Session-scoped RPC calls for plan/day/task reads |
| `actions.ts` | Task complete/reopen with append-only `care_plan_task_events` |
| `index.ts` | Portal DTO types and validation |

Session scope: one care plan per portal session. No Supabase Auth user.

Day status recalculates from task completion state after mutations.

# Check-ins (`lib/check-ins/`)

Structured portal check-in flow:

1. Patient selects from plan-specific `care_plan_symptom_options` snapshot.
2. Severity chosen from safe 1–5 labels.
3. `lib/check-ins/` evaluates `care_plan_alert_rules` deterministically.
4. Matching rules create `alerts` rows with append-only `alert_events`.

No free-text health notes. No AI diagnosis.

# Alerts (`lib/alerts/`)

Clinic review workflow:

| Action | Permission | Effect |
|--------|------------|--------|
| Acknowledge | `alert.acknowledge` | Staff saw alert |
| Resolve | `alert.resolve` | Review completed |
| Dismiss | `alert.dismiss` | No action needed |

All staff roles can perform alert actions. Events are append-only.

# Related

- [Patient Portal Workflows](../architecture/patient-portal-workflows.md)
- [Schema by Phase](../tables/schema-by-phase.md) — Faz 5–6 tables
