# Phase 4 Acceptance Gap Audit

Scope: Faz 4.1 audit for commit `39b99f6` plus acceptance-gap tests only. No Faz 5 feature is included.

## DB / pgTAP Mapping

Evidence command: `npm run test:db`  
Evidence result after gap tests: `Files=4, Tests=234, Result: PASS`

All rows below map to `supabase/tests/phase4_care_plans_secure_links.test.sql`.

| # | Requirement | Test name | Result |
|---|---|---|---|
| 1 | Alpha owner Alpha plan okuyabilir | Alpha owner can read Alpha seed plans | PASS |
| 2 | Alpha admin Alpha plan okuyabilir | Alpha admin can read Alpha seed plans | PASS |
| 3 | Alpha staff Alpha plan okuyabilir | Alpha staff can read Alpha seed plans | PASS |
| 4 | Alpha user Beta plan okuyamaz | Alpha staff cannot read Beta plans | PASS |
| 5 | Anon plan okuyamaz | Anonymous user cannot read plans | PASS |
| 6 | Inactive member plan okuyamaz | Inactive member cannot read plans | PASS |
| 7 | Membership olmayan user plan okuyamaz | No-membership user cannot read plans | PASS |
| 8 | Alpha user Beta day/task okuyamaz | Alpha user cannot read Beta plan days / Alpha user cannot read Beta plan tasks | PASS |
| 9 | Staff valid published version ile plan oluşturabilir | Staff can create plan from valid published version | PASS |
| 10 | Owner/admin valid plan oluşturabilir | Owner can create plan from valid published version / Admin can create plan from valid published version | PASS |
| 11 | Draft version ile plan oluşturulamaz | Draft version cannot create plan | PASS |
| 12 | Retired/uygunsuz version ile plan oluşturulamaz | Retired version cannot create plan | PASS |
| 13 | Archived client ile plan oluşturulamaz | Archived client cannot create plan | PASS |
| 14 | Inactive procedure ile plan oluşturulamaz | Inactive procedure cannot create plan | PASS |
| 15 | Inactive template ile plan oluşturulamaz | Inactive template cannot create plan | PASS |
| 16 | Cross-tenant client ile plan oluşturulamaz | Cross-tenant client cannot create plan | PASS |
| 17 | Cross-tenant procedure ile plan oluşturulamaz | Cross-tenant procedure cannot create plan | PASS |
| 18 | Cross-tenant template/version ile plan oluşturulamaz | Cross-tenant template/version cannot create plan | PASS |
| 19 | Başka org responsible membership kullanılamaz | Cross-tenant responsible membership cannot create plan | PASS |
| 20 | Başarısız create partial row bırakmaz | Failed plan creates leave no partial plan rows | PASS |
| 21 | Plan gün sayısı source version ile aynıdır | Plan snapshot copies days | PASS |
| 22 | Plan task sayısı source version ile aynıdır | Plan snapshot copies tasks | PASS |
| 23 | scheduled_date doğru hesaplanır | Plan day scheduled date is start date plus day offset | PASS |
| 24 | end_date maksimum gün üzerinden hesaplanır | Plan end date uses max day number | PASS |
| 25 | Yeni template version mevcut planı değiştirmez | Existing plan snapshot task count/title stays unchanged after template version history changes | PASS |
| 26 | Source published content immutable kalır | Browser direct task snapshot update is blocked | PASS |
| 27 | Plan snapshot title/description mutation yapılamaz | Browser direct task snapshot update is blocked | PASS |
| 28 | Browser direct plan day insert yapamaz | Browser direct plan day insert is blocked | PASS |
| 29 | Browser direct task insert/update/delete yapamaz | Browser direct task snapshot insert/update/delete is blocked | PASS |
| 30 | Scheduled -> active geçebilir | Scheduled plan can become active | PASS |
| 31 | Active -> completed geçebilir | Active plan can become completed | PASS |
| 32 | Active -> stopped geçebilir | Active plan can become stopped | PASS |
| 33 | Stopped -> active geçemez | Stopped plan cannot reactivate | PASS |
| 34 | Completed -> active geçemez | Completed plan cannot reactivate | PASS |
| 35 | Staff own-org plan stop edebilir | Staff can stop own organization plan | PASS |
| 36 | Cross-tenant status değiştirilemez | Cross-tenant plan status update cannot reveal or modify row | PASS |
| 37 | Source ilişkiler update edilemez | Plan source relations are immutable | PASS |
| 38 | Hard delete yapılamaz | Plan hard delete is blocked | PASS |
| 39 | Staff own-org plan için link oluşturabilir | Staff can create secure link for own organization plan | PASS |
| 40 | Cross-tenant plan için link oluşturamaz | Cross-tenant plan cannot receive link | PASS |
| 41 | Stopped plan için link oluşturulamaz | Stopped plan cannot receive link | PASS |
| 42 | Plain token DB'de yoktur | Plain token is not stored; only its hash is stored | PASS |
| 43 | Token hash unique | Token hash unique constraint rejects duplicates | PASS |
| 44 | Plan başına tek active link | Plan has one active link / Only one active link per plan | PASS |
| 45 | Rotate eski linki revoke eder | Old link revoked by rotation | PASS |
| 46 | Eski token rotate sonrası çalışmaz | Old rotated hash does not validate | PASS |
| 47 | Yeni token çalışır | New token hash validates | PASS |
| 48 | Revoke edilen token çalışmaz | Revoked link does not validate | PASS |
| 49 | Expired token çalışmaz | Expired token does not validate | PASS |
| 50 | Invalid token generic başarısız olur | Invalid hash returns generic null | PASS |
| 51 | Link DB hard delete kapalıdır | Secure link hard delete is blocked | PASS |
| 52 | Staff cross-tenant link okuyamaz | Alpha user cannot read Beta secure links | PASS |
| 53 | Anon secure_links okuyamaz | Anon cannot read secure links table | PASS |
| 54 | Browser direct secure_link insert/update/delete yapamaz | Browser direct secure link insert/update is blocked / Secure link hard delete is blocked | PASS |
| 55 | Valid token session oluşturabilir | Valid token can create portal session | PASS |
| 56 | Session kısa TTL taşır | Cookie TTL is proven by E2E/unit coverage: `portal session cookie is HttpOnly SameSite Lax and short lived` and `parsePortalSessionCookieOptions` maxAge test. pgTAP covers expired/revoked session invalidation. | PASS |
| 57 | Invalid/revoked/expired token session oluşturamaz | Invalid token cannot create portal session / Revoked token cannot create portal session / Expired token cannot create portal session | PASS |
| 58 | Session hash browser-readable DB read değildir | Portal session rows are not browser-readable | PASS |
| 59 | Session revoke/expiry sonrası kullanılamaz | Expired portal session does not validate / Revoked portal session does not validate | PASS |
| 60 | usage_count/last_used_at güncellenir | Validation updates usage count | PASS |
| 61 | Raw token audit/log tablolarına yazılmaz | Audit metadata does not contain raw token text / no PII-token audit regex | PASS |
| 62 | plan.created audit oluşur | plan.created audit exists | PASS |
| 63 | plan.stopped audit oluşur | plan.stopped audit exists | PASS |
| 64 | secure_link.created audit oluşur | secure_link.created audit exists | PASS |
| 65 | secure_link.rotated audit oluşur | secure_link.rotated audit exists | PASS |
| 66 | secure_link.revoked audit oluşur | secure_link.revoked audit exists | PASS |
| 67 | Audit metadata PII/content/token/hash/URL içermez | Audit metadata contains no PII, task content, token hash, or URL | PASS |
| 68 | Audit update/delete yapılamaz | Audit update remains blocked / Audit delete remains blocked | PASS |
| 69 | Browser direct audit insert yapılamaz | Browser direct audit insert remains blocked | PASS |

## Playwright E2E Mapping

Evidence command: `npm run test:e2e:phase4`  
Evidence result after gap tests: `19 tests passed`; several tests intentionally cover multiple original requirements.

All rows below map to `tests/e2e/phase4-plans-links.spec.ts`.

| # | Requirement | Test name | Result |
|---|---|---|---|
| 1 | Owner valid published template ile plan oluşturur | owner creates a care plan from current published template | PASS |
| 2 | Staff valid plan oluşturur | staff creates a care plan | PASS |
| 3 | Draft version UI'da seçilemez | draft versions and archived clients are not selectable | PASS |
| 4 | Archived client UI'da seçilemez | draft versions and archived clients are not selectable | PASS |
| 5 | Plan detayında snapshot gün/görev görünür | plan detail shows read-only snapshot days and tasks | PASS |
| 6 | Yeni template draft/version plan snapshot değiştirmez | new template draft does not change an existing plan snapshot | PASS |
| 7 | Staff planı stop eder | staff stops a plan and link creation is hidden | PASS |
| 8 | Stopped plan link aksiyonu görünmez/reddedilir | staff stops a plan and link creation is hidden | PASS |
| 9 | Owner active plan için güvenli link oluşturur | secure link is shown once and disappears after reload | PASS |
| 10 | Plain link yalnız create sonucu görünür | secure link is shown once and disappears after reload | PASS |
| 11 | Reload sonrası plaintext görünmez | secure link is shown once and disappears after reload | PASS |
| 12 | Rotate sonrası eski link invalid | rotate invalidates old link and new link opens token-free session | PASS |
| 13 | Yeni link token exchange ile session olur | rotate invalidates old link and new link opens token-free session | PASS |
| 14 | Revoke sonrası link invalid | revoke makes link invalid | PASS |
| 15 | Expired link invalid | expired link is invalid | PASS |
| 16 | Alpha user Beta plan detayını göremez | Alpha user cannot view Beta plan detail | PASS |
| 17 | Alpha user Beta linkini yönetemez | Alpha user cannot manage a Beta plan link | PASS |
| 18 | Staff plan/link yönetebilir ama audit göremez | staff manages plan links but cannot access audit data | PASS |
| 19 | Portal session client/plan/procedure göstermez | rotate invalidates old link and new link opens token-free session | PASS |
| 20 | Logout sonrası clinic plan routes korunur | logout protects plan routes | PASS |

## Additional Faz 4.1 Acceptance Evidence

- Token route security headers: `token route sets no-store noindex and referrer headers`
- Portal session cookie: `portal session cookie is HttpOnly SameSite Lax and short lived`
- Responsive/accessibility smoke: `plan and care routes have no horizontal overflow at 1440x900`, `1024x768`, `390x844`
- Token pepper: `tests/unit/env.test.ts` and `tests/unit/secure-links.test.ts`
- Local rate-limit hook: `tests/unit/secure-links.test.ts`, documented in `README.md` and `SECURITY.md`

## Manual Security Review Notes

- All Faz 4 SECURITY DEFINER functions use explicit `set search_path = public, pg_temp`.
- Execute grants are limited to `authenticated` for create/revoke RPCs and to `anon, authenticated` only for token/session validation RPCs.
- Tenant context is derived from `auth.uid()` plus active membership in create/manage RPCs.
- Browser-supplied `organization_id` is not accepted by plan/link server actions.
- Snapshot transaction flag is reset to `off` after snapshot creation; seed also resets it after local snapshot inserts.
- No dynamic SQL is used in Faz 4 RPCs.
