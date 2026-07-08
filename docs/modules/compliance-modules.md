---
type: Module
title: Compliance Modules
description: Consent document versioning, client assignments, portal decisions, and data request workflows.
resource: lib/consent/, lib/data-requests/
tags: [modules, consent, data-requests, compliance]
timestamp: 2026-07-08T21:31:00Z
---

# Module Inventory

| Module | Path | Responsibility |
|--------|------|----------------|
| Consent core | `lib/consent/` | Document versions, clinic management, portal decisions |
| Consent assignment | `lib/consent/assignment-*.ts` | Client document assignment create/cancel/history |
| Data requests | `lib/data-requests/` | Workflow status transitions, clinic review, portal submission |

# Consent Concepts

| Concept | Meaning |
|---------|---------|
| Notice acknowledgment | Document version was presented — **not** consent |
| Consent decision | `consent_accepted`, `consent_declined`, or `consent_withdrawn` |
| Document version | Immutable after publish; changes need new draft + publish |

No global `consent = true` field. Each event references a specific document version.

# Clinic Consent (`lib/consent/clinic-service.ts`)

Owner/admin with `consent.manage`:

- Create documents with initial draft version.
- Edit draft until publish (explicit confirmation dialog).
- Publish, retire, archive documents.
- One active draft per document maximum.

Staff: `consent.read` only — read-only visibility.

# Client Assignments (`lib/consent/assignment-service.ts`)

Faz 8.3B — client detail page only (`/clinic/clients/[id]`):

- Assign published document versions to clients.
- Cancel pending assignments.
- View append-only assignment event history.
- Portal hides archived-document assignments; clinic retains full history.

# Portal Consent (`lib/consent/portal-service.ts`)

Session-scoped RPCs:

- List assigned published versions for portal client/plan scope.
- Record notice acknowledgment and consent events (append-only, idempotent duplicates).
- Withdrawal appends event — does not delete prior events or data.
- Document body rendered as plain text.

# Data Requests (`lib/data-requests/`)

| Layer | File | Role |
|-------|------|------|
| Clinic | `service.ts`, `actions.ts` | Review, assignee picker, status transitions |
| Portal | `portal-service.ts` | Submit requests, list owned requests |

Workflow records only — no automatic export, deletion, or redaction. Resolution uses controlled status codes, not free-form sensitive text.

Faz 8.3B adds clinic review UI with staff assignee picker and append-only `data_request_events` history.

# Legal Boundary

Technical recordkeeping foundation only. Does not prove legal validity or regulatory compliance. Synthetic placeholder text:

- `Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.`
- `Bu belge gerçek bir hukuki metin değildir.`

# Related

- [ADR 0003](../adr/0003-consent-data-request-foundation.md)
- [Boundaries and Scope](../overview/boundaries-and-scope.md)
- [Schema by Phase](../tables/schema-by-phase.md) — Faz 8 tables
