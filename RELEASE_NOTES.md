# AfterCare Clinic V1.0 Portfolio Edition

The portfolio edition demonstrates clinic operations and post-procedure follow-up using fictional clinical records. The first public presentation shows the product through a standalone read-only gallery. The application source supports a separate local demonstration.

## Highlights

- Clinic workspace for clients, procedures, care templates, care plans, and follow-up review.
- Mobile patient portal with scoped secure links, daily tasks, check-ins, requested photos, consent decisions, and data requests.
- Specialist scheduling, appointment history, a mobile agenda, and operational reports based on synthetic activity.
- In-app notifications and a gated local Mailpit demonstration.

## Local installation and screenshots

Start with the [installation guide and product tour](README.md). For the optional fictional clinic and calendar data, use the [local showcase runbook](docs/playbooks/portfolio-showcase.md) in a disposable environment.

## Verification and release limits

The release candidate passed the clean installation, Phase 9B and predeploy gates, with 387 Vitest tests and 759 pgTAP checks. Firefox passed the selected browser matrix. The WebKit care journey passed. The combined Phase 12 WebKit scenario completed with diagnostic instrumentation after an invitation timeout in the original run. Its repeatability remains open.

The static presentation contains no sign-up, inquiry submission, payment, or messaging flow. The interactive hosted application remains a separate future milestone. The [master roadmap](docs/product/master-roadmap.md) carries the remaining commercial scope.
