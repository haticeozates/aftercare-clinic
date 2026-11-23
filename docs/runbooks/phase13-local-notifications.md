# Phase 13 local notification checks

The inbox uses a user's active clinic membership. Read state belongs to that user. Clinic-level preferences require an owner or administrator. Clinic and user choices govern in-app and local email delivery, with mandatory clinical review alerts always visible to accounts that can access them. The clinical alert screens retain their existing review workflow.

## Isolated runner

Reuse the documented Linux Stage 2 runner with the separate Supabase project ID `aftercare-portfolio-stage2-test`. Confirm the local application, API, database and Mailpit ports are `3000`, `56321`, `56322` and `56324` before running commands. The worker requires the verified runner-provided `TEST_DATABASE_URL` and an explicit local `APP_ENV`. Keep credentials and browser connection URLs in the test environment.

Local mail delivery uses the following settings in the isolated runner.

```sh
export PHASE13_MAIL_ENABLED=true
export PHASE13_MAILPIT_ORIGIN=http://127.0.0.1:56324
export PHASE13_APP_ORIGIN=http://localhost:3000
npm run notifications:worker -- --once
```

Use `--watch` for a local tick every five seconds, and stop it when verification ends. A tick sweeps daily care tasks even when local mail is disabled. The optional `PHASE13_SCREENSHOTS_DIR` can point to a private output directory for browser review.

```sh
npm run test:db
PHASE13_DB_INTEGRATION=true npm run test:integration
npm run test:e2e:phase13
```

Start the browser journey from the isolated standard seed. It uses synthetic Alpha/Beta fixtures, runs the real worker, and checks Mailpit query results. It advances one synthetic queue job while leaving the appointment in the future to exercise the scheduled send without waiting.

## Delivery semantics

Appointment approvals, changes, cancellations and reminders can be captured for authorized, opted-in clinic users with confirmed `.test` addresses. Enable email in both clinic and personal preferences before creating the event. Future mail jobs are added by subsequent events. The app also rechecks preferences, eligibility and reminder revision when a pending job is sent. Quiet hours use the clinic's time zone. Receipt visibility and the worker use a persistent queue, and calls retry after one, five and fifteen minutes. The fourth unsuccessful attempt is terminal. Delivery errors persist a controlled status code without the destination or provider response body.

Mailpit acceptance proves capture in the local mailbox. The worker queries the retained mailbox by stable Message-ID and destination before a send to reconcile uncertain acceptance. This depends on retaining the Mailpit copy. SMS, WhatsApp and external email providers are unavailable in this edition. No production scheduler or patient communications are configured.
