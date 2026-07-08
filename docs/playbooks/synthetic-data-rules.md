---
type: Playbook
title: Synthetic Data Rules
description: Mandatory synthetic-data policy for local development, seeds, and tests.
tags: [playbook, security, data]
timestamp: 2026-07-08T21:31:00Z
---

# Rule

Only synthetic local/test data is allowed in this repository.

# Prohibited Content

Do not store or commit:

- Real patient or client records
- Real health or treatment data
- Real phone numbers or email addresses
- Real legal/KVKK document text
- Real photos or clinical images
- Production API keys, tokens, or credentials
- Plaintext secure link tokens (except ephemeral test fixtures)

# Allowed Content

| Source | Examples |
|--------|----------|
| `supabase/seed.sql` | Alpha/Beta orgs, `.test` email users, synthetic clients |
| Test fixtures | Deterministic IDs, placeholder document text |
| Placeholder legal text | `Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.` |

# Client Record Limits

Client records must not include:

- TC kimlik (national ID)
- Physical address
- Health history or medical notes
- Photos or treatment data

Phone fields are normalized and masked in display.

# Consent Document Limits

Published document versions use synthetic placeholder text only. This text must not be presented as real legal content or compliance evidence.

# Environment Safety

| Secret | Rule |
|--------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never `NEXT_PUBLIC_` |
| `AUDIT_LOG_PEPPER` | Server-only |
| `PHOTO_CLEANUP_SECRET` | Server-only |
| Signed URLs / upload tokens | Never in logs, audit, DB, or localStorage |

# Remote Access

Do not connect to remote or production Supabase from this repository. Local Supabase/Postgres only.

# Related

- [Boundaries and Scope](../overview/boundaries-and-scope.md)
- [ADR 0003](../adr/0003-consent-data-request-foundation.md)
- [Local Setup](local-setup.md)
