# Modules

Server-side domain libraries under `lib/`. Pattern per domain: `index.ts` (types/validation), `service.ts` (reads/writes), `actions.ts` (server actions).

* [Clinical Modules](clinical-modules.md) - Server modules for clients, procedures, care templates, care plans, and secure access links.
* [Compliance Modules](compliance-modules.md) - Consent document versioning, client assignments, portal decisions, and data request workflows.
* [Foundation Modules](foundation-modules.md) - Core infrastructure modules for auth, authorization, environment, Supabase clients, and audit.
* [Media Modules](media-modules.md) - Photo upload intents, server-side finalize with Sharp, clinic secure viewing, and orphan cleanup.
* [Portal Modules](portal-modules.md) - Patient portal session services, structured check-ins, and clinical alert review.
