# ADR 0002: Phase 7.1 Photo Storage Foundation

## Status

Accepted for Phase 7.1 implementation.

## Context

AfterCare Clinic now has secure care plans, portal sessions, daily task completion, structured check-ins and clinic alert review. The next storage-sensitive surface is photo handling. Photos can contain personal and health-related visual information, so the product must not treat a raw browser upload as a clinic-ready record.

## Decision

Phase 7.1 establishes only acceptance contracts, database constraints, private storage buckets and RLS foundations.

The upload architecture is intentionally staged:

1. The server validates portal session, plan, day and photo request scope.
2. The server creates a short-lived application upload intent.
3. The browser receives a signed upload URL only for an opaque object key in the private `care-photo-incoming` bucket.
4. A later finalize step will re-read the incoming object server-side, verify real image bytes and raster dimensions, normalize orientation, strip EXIF/GPS/IPTC/XMP metadata and write only a sanitized output into the private `care-photos` bucket.
5. Only finalized sanitized output can create a `photo_records` row.
6. Incoming objects must never be visible in clinic UI and must be cleaned up if orphaned.

Phase 7.1 does not add portal upload UI, clinic image viewing UI, signed URL generation, image processing dependencies or cleanup scheduling.

## Data Model

Only these tables are introduced:

- `photo_requests`
- `photo_upload_intents`
- `photo_records`

There is no separate `photo_events` table. Photo activity uses the central append-only audit log.

Photo object keys are opaque and must not include organization IDs, plan IDs, request IDs, client IDs, names, phone numbers, email addresses or original filenames.

## Storage

Two private buckets are required:

- `care-photo-incoming`
- `care-photos`

Both buckets allow only `image/jpeg`, `image/png` and `image/webp`, with a 5 MB limit. SVG, GIF, HEIC, TIFF and PDF are outside the accepted contract.

## Security Notes

Portal browsers cannot directly read or mutate photo tables. Clinic browsers cannot list storage objects and must not receive raw storage paths. A future clinic view action must create a short-lived signed URL only after server-side membership and permission checks.

Audit metadata must never include storage paths, signed URLs, upload tokens, original filenames, portal session values, client names, phone numbers, email addresses or free-form health text.

## Image Processing Decision Gate

EXIF cleanup is not optional before real photos are accepted. Before Phase 7.2 implementation, choose and verify an image processing runtime that can:

- Decode real image bytes instead of trusting extension or Content-Type.
- Enforce input pixel limits.
- Accept a single raster frame.
- Normalize orientation.
- Strip EXIF, GPS, IPTC, XMP and original metadata.
- Write a safe normalized raster output, preferably WebP.

The likely implementation path is a server-side image processing dependency such as `sharp`, subject to runtime compatibility verification for the target deployment environment.

## Phase 7.2 Finalize Contract

Phase 7.2 uses `sharp` only in explicit Next.js Node.js route handlers. Edge runtime is not used for image decoding, metadata stripping or WebP normalization.

Finalize is intentionally split across Storage and Postgres because Supabase Storage writes cannot be part of the same database transaction as `photo_records` insertion. The accepted compensation model is:

- A portal session can create only a short-lived `photo_upload_intents` row for an active request in its own plan.
- Finalize first claims a pending intent by moving it to `processing` with a random `processing_claim_id`.
- Only the process holding that claim may write the final `photo_records` row.
- If a `photo_record` already exists for the request, repeated finalize returns idempotent success.
- If final Storage write succeeds but database finalize fails, the server must best-effort delete the final object.
- If database finalize succeeds but incoming delete fails, the user can receive success and the incoming object becomes cleanup-eligible.
- Orphan incoming/final objects remain private and must be removed by a later cleanup job; no storage path is written to audit metadata.

The browser may receive the Supabase signed upload `path` and `token` once as a short-lived upload credential. These values must not be stored in localStorage, database rows, audit metadata, logs or telemetry, and the final object key must never be returned to the browser.
