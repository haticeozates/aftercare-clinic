# Local portfolio showcase

Use a dedicated clone and a fresh, disposable Supabase project for the showcase. Existing development and regression databases retain their own data.

1. Use Node.js 24 with a running Docker engine and install the locked dependencies with `npm ci`.
2. In the showcase clone, set `project_id = "aftercare-portfolio-showcase"` in `supabase/config.toml`. Use API port `56321`, database port `56322`, and unused ports for Studio, Mailpit, shadow DB and any additional enabled services. Check that the project ID and configured ports are free. The setup script verifies the project and the database container port before SQL is applied.
3. Run `npm run supabase:start` and `npm run supabase:write-env`.
4. Run `node scripts/setup-portfolio-showcase.mjs` and then `npm run dev`.
5. Sign in using the local demo owner from the [local demo runbook](demo-runbook.md). The clinic is **Ardıç Kıyısı Bakım Kliniği**. Use the existing clinic action to create a fresh secure portal link for the sample care plan.

The overlay copies the dedicated Phase 9B demo foundation, relabels the fictional clinic, client and specialist records, and adds appointments consumed by the calendar and reports. The original fixture remains intact. Demo contact addresses are under `example.test` and the phone placeholders use a non-dialable national prefix. Keep this setup local. A hosted preview requires its own reviewed seed and generated per-user credentials.

For a public presentation, use the approved static screenshots from `public/aftercare/` or the prepared portfolio gallery. The gallery requires no Supabase connection, CLI login or demo account.
