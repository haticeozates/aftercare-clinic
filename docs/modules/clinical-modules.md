---
type: Module
title: Clinical Modules
description: Server modules for clients, procedures, care templates, care plans, and secure access links.
resource: lib/clients/, lib/procedures/, lib/templates/, lib/plans/, lib/secure-links/
tags: [modules, clinical, templates, plans]
timestamp: 2026-07-08T21:31:00Z
---

# Module Inventory

| Module | Path | Responsibility |
|--------|------|----------------|
| Clients | `lib/clients/` | Client CRUD, phone normalization/masking, archive |
| Procedures | `lib/procedures/` | Procedure catalog management |
| Templates | `lib/templates/` | Care templates, draft/publish, days/tasks/symptoms/alert rules |
| Plans | `lib/plans/` | Care plan snapshots from published template versions |
| Secure Links | `lib/secure-links/` | Token hashing, link create/rotate/revoke, portal session exchange |

# Clients (`lib/clients/`)

Rules enforced in service layer and schema:

- No TC kimlik, address, health history, medical notes, or photos on client records.
- Phone normalized and masked in display DTOs.
- Archive/inactive flows — no hard delete.

Permissions: `client.read`, `client.create`, `client.update`, `client.archive`.

# Procedures (`lib/procedures/`)

Tenant-scoped procedure catalog. Inactive procedures cannot be used in new care plans.

# Templates (`lib/templates/`)

Immutable versioning model:

| State | Behavior |
|-------|----------|
| Draft | Editable days, tasks, symptom options, alert rules |
| Published | Immutable — changes require new draft + publish transaction |
| Retired | Historical reference only |
| Inactive template | Cannot create new plans |

Tables: `care_templates`, `care_template_versions`, `care_template_days`, `care_template_tasks`, `symptom_options`, `alert_rules`.

# Plans (`lib/plans/`)

Care plan creation snapshots a **published** template version:

- `care_plans`, `care_plan_days`, `care_plan_tasks` copy structure at creation time.
- `scheduled_date` = plan start date + day offset.
- Existing plans are unaffected when template versions change.

See [Phase 4 Acceptance Audit](../qa/phase4-acceptance-gap-audit.md) for pgTAP evidence.

# Secure Links (`lib/secure-links/`)

| Rule | Detail |
|------|--------|
| Token storage | Hash only (with pepper) — plaintext never persisted |
| Plaintext display | Once at create/rotate; reload does not show again |
| Privacy | Links must not expose client, phone, procedure, or predictable IDs |
| Portal exchange | Valid token → `portal_sessions` + HttpOnly cookie |

Permissions: `secure_link.create`, `secure_link.revoke`, `secure_link.rotate`.

# Related

- [Clinic Workflows](../architecture/clinic-workflows.md)
- [Schema by Phase](../tables/schema-by-phase.md) — Faz 2–4 tables
