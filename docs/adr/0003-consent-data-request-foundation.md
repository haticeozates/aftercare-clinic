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
