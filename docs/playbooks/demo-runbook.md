---
type: Playbook
title: Phase 9B Demo Runbook
description: Reproducible local-only golden journey for Demo Pilot Clinic synthetic fixture.
tags: [playbook, demo, phase9b, local]
timestamp: 2026-07-09T12:00:00Z
---

# Phase 9B Demo Runbook

Local-only golden journey for **Demo Pilot Clinic**. This is not a medical or legal compliance demonstration. Do not use real clinic, patient, health, or legal data.

Authoritative product plan: [master roadmap](../product/master-roadmap.md).

Frozen presentation project `aftercare-clinic-demo` is separate from this production codebase. Do not mix their credentials or data.

## 1. Prerequisites

- Node.js (project targets Node 24 LTS)
- Docker (local Supabase)
- Repository on branch `phase-9b-demo-pilot-prep` (or later Stage 1B+ work)
- `.env.local` copied from `.env.example` and filled from `npm run supabase:status`
- Only synthetic `.test` accounts

```bash
npm install
cp .env.example .env.local   # if missing
```

## 2. Local Supabase start

```bash
npm run supabase:start
npm run supabase:status
```

Confirm API URL is `http://127.0.0.1:54321` (or localhost equivalent). Stop if any remote/production project ref appears.

## 3. Clean database reset

```bash
npm run db:reset
```

This reapplies migrations and the **base** Alpha/Beta `supabase/seed.sql` only. Demo Pilot Clinic is **not** in the base seed.

## 4. Demo fixture setup

```bash
npm run demo:setup
```

Expected JSON summary (values may match exactly):

- `ok: true`
- `clinic: "Demo Pilot Clinic"`
- organization and plan IDs under the `d9` / `da` deterministic ranges
- accounts: `demo-owner@example.test`, `demo-admin@example.test`, `demo-staff@example.test`
- notes reminding you to create a live portal link in the UI

`demo:setup` is idempotent after a clean reset. It refuses non-local database URLs and remote Supabase hosts.

Optional one-shot clean + fixture:

```bash
npm run demo:reset
```

(`db:reset` then `demo:setup`)

## 5. Synthetic account credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | `demo-owner@example.test` | `local-test-password` |
| Admin | `demo-admin@example.test` | `local-test-password` |
| Staff (read-oriented clinic membership) | `demo-staff@example.test` | `local-test-password` |

Base Alpha/Beta seed accounts remain available and unchanged.

## 6. Clinic login

```bash
npm run dev
```

Open `http://localhost:3000/login`, sign in as `demo-owner@example.test`.

Expect redirect to `/clinic` and organization name **Demo Pilot Clinic**.

## 7. Client and procedure review

- Open **Danışanlar** → confirm **Synthetic Demo Client**
- Open client detail → confirm synthetic `.test` contact only
- Confirm procedure **Demo Procedure One** appears on the active plan (plan detail), not as a medical record

## 8. Care template and active plan review

- Templates: **Demo Care Template** (published version)
- Plans: open plan id `00000000-0000-4000-8000-00000000da01` or find via plans list
- Confirm days/tasks, completed and pending task status examples (completed task includes matching append-only completion history)
- Confirm seeded alert / check-in related clinic surfaces as available in current UI

## 9. Create a photo request

On the demo plan detail:

- Section **Fotoğraf talebi oluştur** must be visible for owner/admin
- Day 1 already has **Temsili demo fotoğraf talebi**; create an additional request on a day without an active request (for example day 2)
- Do not enter diagnosis or treatment advice in the label

## 10. Create/copy a secure portal link through the application

On the same plan detail:

1. Use **Güvenli bağlantı oluştur** (or **Bağlantıyı yenile** if a fixture placeholder active link is shown)
2. Copy the one-time plain link from the UI (`data-testid="plain-secure-link"`)
3. Store it only in your local clipboard/session for this demo

**Never** commit, paste into docs, or reuse a raw portal token from the repository. Fixture SQL stores hash-only placeholders that are not usable portal tokens.

## 11. Open portal

Paste the one-time link into the browser (path shape `/care/t/...`).

Expect `/care/session` with **Bakım Planınız**.

## 12. Complete/reopen a task

In **Bugünün görevleri**, complete or reopen a visible task using portal controls. Confirm status badges update.

## 13. Submit check-in

If today’s check-in is available and not already submitted for that day, submit a structured check-in using synthetic symptom options only.

## 14. Review generated alert in clinic

Return to clinic (owner session). Open alerts and confirm tenant-scoped alert rows for Demo Pilot Clinic only. Do not expect Alpha/Beta client names.

## 15. Upload a synthetic image for the request

In the portal photo request card, upload a small synthetic image (non-clinical stock/test file). Do not upload real patient photos.

## 16. View the image safely in clinic

On the plan detail, open the clinic photo viewer for the uploaded record. Confirm no storage keys or signed URLs are shown as durable copy-paste secrets in the UI beyond normal short-lived view behavior.

## 17. Assign notice/consent document

Fixture already includes a pending **Temsili bilgilendirme belgesi** assignment. Optionally assign another published notice through clinic consent flows using only placeholder legal text.

## 18. Acknowledge/accept/decline through portal

In portal **Belgeler ve tercihlerim**, complete the pending notice decision as appropriate for the document kind. Placeholder text is not legally binding.

## 19. Submit a data request

In the portal data-request form, submit a synthetic access/copy-style request. Fixture already includes one clinic-submitted example for clinic review practice.

## 20. Review/assign/resolve the request in clinic

Open clinic data-requests UI. Review, assign, and resolve using synthetic workflow only.

## 21. Reset demo state

```bash
npm run demo:reset
```

Or:

```bash
npm run db:reset
npm run demo:setup
```

## 22. Known limitations

- Stage 3 adds `npm run verify:phase9b` and golden journey E2E; it does not add production deployment.
- Faz 10–17 product surfaces (public site, signup, appointments, notifications, payments, analytics, platform admin) remain planned, not delivered.
- UI polish Stages 2A–2C are complete for local demo scope; full WCAG audit is not claimed.
- Fixture secure-link/session rows are hash-only placeholders for relational completeness; live portal access requires a UI-created link.
- Photo request edit/cancel/reschedule and bulk requests are out of scope.
- This runbook does not claim medical, KVKK, or legal compliance.

## 23. Explicit warning against real data

Use only synthetic names, `.test` emails, and placeholder documents. Never load production dumps, real photos, real consent text, or production credentials into local demo setup.
