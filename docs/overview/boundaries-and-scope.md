---
type: Business Rule
title: Boundaries and Scope
description: Hard product boundaries, explicit exclusions, and synthetic-data safety rules for the platform.
tags: [boundaries, security, compliance]
timestamp: 2026-07-08T21:31:00Z
okf_version: "0.1"
---

# In Scope (Delivered)

- Local Supabase/Postgres development only
- Synthetic `.test` users and seed data
- Technical recordkeeping for consent, notices, and data requests
- Tenant-isolated clinic operations with RLS + server authorization
- Privacy-safe patient portal scoped to one care plan

# Explicitly Out of Scope

| Area | Status |
|------|--------|
| Real patients, health records, phone/email, clinical content | Prohibited |
| Real legal/KVKK document text or compliance claims | Prohibited |
| Electronic signature, fingerprinting, location/IP legal proof | Not implemented |
| Automatic data export, deletion, or backup deletion | Not implemented |
| Appointment scheduling | Deferred unless explicitly requested |
| Public marketing/landing page | Deferred unless explicitly requested |
| WhatsApp, SMS, email notifications | Not implemented |
| Payment, analytics, AI, image analysis | Not implemented |
| Remote Supabase or production deployment | Prohibited in this repo |

# Security Principles

1. **Organization context** must come from active membership or validated portal scope — never from untrusted browser input.
2. **UI hiding is not a security boundary** — server actions, RPCs, and RLS enforce access.
3. **Append-only events** for task history, alert history, consent decisions, and data request transitions.
4. **Audit metadata allowlists** — no PII, tokens, storage paths, document body text, or free-form health text in audit payloads.
5. **Portal DTOs** exclude phone, email, internal IDs, token hashes, and session hashes.

# Consent and Data Request Boundaries

- Notice acknowledgment is **not** consent.
- Withdrawal creates a new append-only event; it does not delete historical events or user data.
- Data requests are **workflow records only** — submission does not export or delete data.
- Placeholder document text is synthetic and must not be treated as real legal content.

See [ADR 0003](../adr/0003-consent-data-request-foundation.md) for the full decision record.

# Photo Boundaries

- Private buckets only (`care-photo-incoming`, `care-photos`).
- Opaque object keys — no client IDs, names, or filenames in paths.
- Signed upload tokens and view URLs are credentials — never persisted in DB, audit, or logs.
- Orphan cleanup uses conservative classification; uncertain objects are not deleted.

See [ADR 0002](../adr/0002-photo-storage-foundation.md).

# Synthetic Data Rule

Only synthetic local/test data is allowed. Do not store real users, client records, health data, legal documents, photos, tokens, or production credentials in this repository.

See [Synthetic Data Rules](../playbooks/synthetic-data-rules.md).

# Citations

[1] [Phase Handoff](../references/phase-handoff.md) — hard boundaries and verification habits
[2] [README](../../README.md) — environment and security notes
