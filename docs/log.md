# Directory Update Log

## 2026-07-09

* **Demo**: Added local-only Phase 9B demo fixture (`supabase/demo/phase9b-demo.sql`, `demo:setup` / `demo:reset`) and [demo runbook](playbooks/demo-runbook.md). Separate from Alpha/Beta base seed; no raw portal tokens.
* **Product**: Added authoritative [master roadmap](product/master-roadmap.md) and [product index](product/index.md); synchronized README, overview, phase handoff, schema-by-phase, routes and playbooks for Faz 9A delivered / Faz 9B Stage 1A done / Stage 1B current.
* **UI (9B Stage 2A)**: Shared accessible feedback and loading primitives; clinic and portal mutation feedback alignment; demo-critical loading routes; phase9b UI feedback unit/E2E regressions. Stage 2B (mobile/a11y/copy) next.
* **UI (9B Stage 2B)**: Mobile viewport overflow hardening; skip link and drawer focus; Turkish vocabulary and date-time consistency; portal data-request/document-card feedback alignment; portal check-in DTO restoration migration; `phase9b_portal_check_in_payload.test.sql` pgTAP contract; `test:e2e:phase9b-mobile-a11y` regressions; [UI language reference](product/ui-language-and-accessibility.md).
* **UI (9B Stage 2C)**: Final screen-by-screen polish — shared `ConfirmDialog`, destructive action confirmations, client edit validation, Turkish status/resolution/severity labels, safe fallback screens, tablet link-action layout; [UI screen acceptance checklist](playbooks/ui-screen-acceptance-checklist.md); `test:e2e:phase9b-final-ui` regressions.
* **Pilot (9B Stage 3)**: `npm run verify:phase9b`; golden journey E2E; [pilot readiness checklist](playbooks/pilot-readiness-checklist.md); [pilot user guide](playbooks/pilot-user-guide.md); [acceptance matrix](references/phase9b-acceptance-matrix.md). Faz 9B local demo/pilot verification complete; production go-live deferred. Faz 10 planning next.
* **Audit**: Documentation conformance pass — moved [phase handoff](references/phase-handoff.md) under `references/`, synced index descriptions with frontmatter, fixed stale Faz 8.3B status, added [marketing/index.md](marketing/index.md), and normalized root bundle navigation.
* **Fix**: Converted bundle-absolute links (`/path`) to relative paths so links resolve in GitHub and local Markdown viewers.
* **Creation**: Added Turkish beauty-center marketing slide at [marketing/aftercare-clinic-slide.html](marketing/aftercare-clinic-slide.html).
* **Initialization**: Created OKF v0.1 knowledge bundle root with [index.md](index.md) and section indexes.
* **Creation**: Added [Platform Overview](overview/platform-overview.md) and [Boundaries and Scope](overview/boundaries-and-scope.md).
* **Creation**: Added architecture concepts for routes, auth/roles, tenant isolation, clinic workflows, and patient portal workflows.
* **Creation**: Added module concepts for foundation, clinical, portal, media, and compliance domains.
* **Creation**: Added [Schema by Phase](tables/schema-by-phase.md) table reference.
* **Creation**: Added playbooks for [local setup](playbooks/local-setup.md), [verification gates](playbooks/verification-gates.md), and [synthetic data rules](playbooks/synthetic-data-rules.md).
* **Update**: Added OKF frontmatter to existing ADRs, [phase handoff](references/phase-handoff.md), and [Phase 4 acceptance audit](qa/phase4-acceptance-gap-audit.md).
