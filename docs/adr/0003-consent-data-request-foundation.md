---
type: Decision
title: ADR 0003 — Consent and Data Request Foundation
description: Accepted notice vs consent model, immutable document versions, append-only events, and legal boundaries for Phase 8.
tags: [adr, consent, data-requests, faz-8]
timestamp: 2026-07-08T21:31:00Z
okf_version: "0.1"
---

# ADR 0003: Consent Documents and Data Request Foundation

## Status

Accepted for Phase 8.1 foundation.

## Context

AfterCare Clinic needs a technical foundation for versioned informational documents, consent decisions and data request workflow records. This foundation must not claim legal compliance and must not ship real legal, clinical or personal data content.

## Decision

Phase 8.1 separates two concepts:

- Notice acknowledgment records that a specific document version was presented or acknowledged.
- Consent decisions record accepted, declined or withdrawn events for a specific consent document version.

There is no single global `consent = true` field. Each assignment and event points to an immutable document version.

Published document versions are immutable. Changes require a new draft version and a controlled publish transaction.

Client document events and data request events are append-only. Withdrawal is a new event and does not delete historical accepted or declined events.

Data requests are workflow records only. They do not automatically export, delete, redact or mutate user data. Resolution uses controlled codes instead of free-form sensitive text.

## Legal Boundary

This model is a technical recordkeeping foundation. It does not prove that a document is legally valid, sufficient or compliant. Real document text, which consents are required, and jurisdiction-specific processes must be reviewed by qualified legal and clinic stakeholders before production use.

The local placeholder text is synthetic:

- `Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir.`
- `Bu belge gerçek bir hukuki metin değildir.`

These strings must not be treated as real legal content.

## Security Boundary

Portal browsers do not receive direct table access in Phase 8.1. Future portal acknowledgement or consent flows must use narrow session-scoped RPCs.

RLS is enabled on all Phase 8 tables. Cross-tenant relationships are protected with composite foreign keys where relevant, not only TypeScript checks.

Audit metadata is allowlisted. It must not contain document body text, full legal text, client names, phone numbers, email addresses, free-form request detail, portal tokens or raw request bodies.

## Deferred Work

Phase 8.2 may add portal notice/consent presentation and session-scoped recording.

Phase 8.3 may add richer clinic workflow screens for assignment management and data request review.

This ADR intentionally does not add electronic signature, PDF certification, automatic export, automatic deletion, retention automation, notifications, appointments or a public landing page.

## Phase 8.2 Portal Decisions

Phase 8.2 adds session-scoped portal access for assigned published document versions. The portal receives only safe assignment DTO fields and cannot directly read or mutate consent/data-request tables.

Notice acknowledgment remains separate from consent. A `notice_acknowledged` event records that the portal user acknowledged the specific notice version; it is not treated as accepted consent.

Consent decisions are append-only events:

- `consent_accepted`
- `consent_declined`
- `consent_withdrawn`

Withdrawal does not delete the earlier accepted event, and it does not automatically delete client data, photos, backups or records. If a separate review workflow is needed, it must be modeled as a data request or a future clinic process.

Portal data requests are review workflow records only. Submission creates a `submitted` request and a matching event; it does not run export, correction, deletion, restriction or objection actions automatically.

The portal UI does not collect signature images, IP-based legal proof, browser fingerprints, location data or identity documents. Document body text is rendered as plain text. No `dangerouslySetInnerHTML` rendering is required or allowed for portal document content.

Audit metadata for portal document and data-request events is allowlisted. It must not contain body text, summary text, free-form text, client identifiers, phone numbers, email addresses, portal tokens, session hashes or raw request payloads.

Clinic review, assignment handling, completion workflows and richer document management screens are intentionally deferred to Phase 8.3.

## Phase 8.3A Clinic Document Management Correction

Phase 8.3A completes the clinic-side document management workflow without changing portal behavior or starting assignment/data-request review (Phase 8.3B).

Technical workflow:

- Clinic users with `consent.manage` create documents with an initial draft version.
- Draft versions are editable until published through an explicit confirmation dialog.
- Published and retired versions are immutable plain-text records; the UI does not expose update forms for them.
- Only one active draft may exist per document at a time.
- Owners/admins may create a new draft from the latest published or retired version when the document is active and no draft exists.
- Active documents may be archived; archived documents become read-only and reject new drafts or publish actions.
- Published version history is preserved after archive.

Audit boundary:

- Audit metadata for clinic consent management events does not include body text, summary text or title snapshots.
- Denied manage attempts are logged only for authenticated organization members.

Legal boundary:

- This workflow is technical recordkeeping only. It does not guarantee legal validity, enforceability or regulatory compliance.
- Synthetic placeholder text remains for local testing only.

Deferred to Phase 8.3B:

- Client document assignment UI and workflows.
- Clinic data request review and staff assignment handling.

## Phase 8.3B addendum (clinic assignment and data request review)

Delivered in migration `20260706082200_phase8_3b_clinic_assignment_and_data_request_review.sql`:

- Clinic assignment create/cancel RPCs with `consent.manage` authorization and membership-scoped composite foreign keys.
- Pending assignment semantic invariants enforced via `consent_documents` row lock and version join (no denormalized `consent_document_id` on assignments).
- Defense-in-depth partial unique indexes on `(organization_id, client_id, document_version_id)` for exact duplicate pending rows.
- Direct `INSERT`/`UPDATE` on `client_document_assignments` revoked from `authenticated`; mutations RPC-only.
- `record_client_document_event` restricted to clinic-operational types (`presented`, `notice_acknowledged`); portal consent decisions remain portal-session RPC only.
- Data request assignee changes emit separate `assigned` events with `assignee_user_id`; idempotent when assignee unchanged.
- `consent_assignment.cancelled` audit action allowlisted.

Archived document portal boundary (product decision):

- New assignments cannot be created for archived documents.
- Archived pending assignments are not visible or actionable in the portal.
- Archived completed assignments are not shown in the portal in this phase.
- Assignment/event history remains in the database and clinic UI.
- Archive does not auto-cancel existing assignments.
- No portal historical-documents surface in 8.3B.

Legal boundary unchanged: technical recordkeeping only.
