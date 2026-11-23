# Phase 15 operations reporting

Open `/clinic/reports` with an active clinic membership. Owners and administrators see the clinic scope. Staff reports are limited to their assignments. The CSV action requires the same origin and an owner or administrator. Exports include totals, rates and grouped counts. Practitioner and procedure dimensions use clinic-local codes in the file. The private export log stores actor, clinic, range and filter presence.

Appointments use the clinic zone and care activity uses the Istanbul plan day. Date filters scope report flows. Status filters affect appointment flow only. The operational snapshot uses the current state and keeps the relevant practitioner and procedure scopes. Percentages with undefined denominators display a dash. For capacity, select an entirely future window of up to 31 days with no procedure or appointment status filter. The estimate uses the current work schedules, excluding breaks and closures. Historic working schedules are unavailable.

Use the existing isolated Stage 2 Linux runner. Check the project ID `aftercare-portfolio-stage2-test` and the loopback database port `56322`. The performance test generates and rolls back its fixtures within a single transaction. Run E2E separately on a clean isolated seed before running another suite that writes appointment fixtures.

```sh
npm run test:db
PHASE15_DB_INTEGRATION=true npx vitest run tests/integration/phase15-analytics-scale.test.ts
npm run test:e2e:phase15
```

Use the optional `PHASE15_BENCHMARK_OUTPUT` for a private JSON measurement file and `PHASE15_SCREENSHOTS_DIR` for private browser screenshots.
