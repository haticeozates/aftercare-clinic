import { expect, test, type BrowserContext } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaClient: "00000000-0000-4000-8000-00000000c101",
  betaClient: "00000000-0000-4000-8000-00000000c201",
  alphaPlan: "00000000-0000-4000-8000-00000000e101",
  betaPlan: "00000000-0000-4000-8000-00000000e201",
  alphaOwner: "00000000-0000-4000-8000-00000000a101",
  betaOwner: "00000000-0000-4000-8000-00000000b101",
  alphaLink: "00000000-0000-4000-8000-00000000a911",
  betaLink: "00000000-0000-4000-8000-00000000b911"
};

function readLocalEnv() {
  const fileEnv: Record<string, string> = {};
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        fileEnv[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }

  return {
    databaseUrl: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    auditPepper: process.env.AUDIT_LOG_PEPPER ?? fileEnv.AUDIT_LOG_PEPPER ?? "test-audit-pepper-at-least-32-characters-long"
  };
}

function hashPortalSession(rawToken: string) {
  return crypto.createHash("sha256").update(`${rawToken}.${readLocalEnv().auditPepper}`).digest("hex");
}

async function connect() {
  const client = new Client({ connectionString: readLocalEnv().databaseUrl });
  await client.connect();
  return client;
}

async function setPortalCookie(context: BrowserContext, rawSession: string) {
  await context.addCookies([
    {
      name: "aftercare_portal_session",
      value: rawSession,
      domain: "localhost",
      path: "/care",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

async function seedPortalDocuments() {
  const db = await connect();
  const suffix = crypto.randomUUID().slice(0, 8);
  const noticeDoc = crypto.randomUUID();
  const consentDoc = crypto.randomUUID();
  const declineDoc = crypto.randomUUID();
  const draftDoc = crypto.randomUUID();
  const noticeVersion = crypto.randomUUID();
  const consentVersion = crypto.randomUUID();
  const declineVersion = crypto.randomUUID();
  const draftVersion = crypto.randomUUID();
  const noticeAssignment = crypto.randomUUID();
  const consentAssignment = crypto.randomUUID();
  const declineAssignment = crypto.randomUUID();
  const draftAssignment = crypto.randomUUID();
  const rawSession = `phase8-portal-session-${crypto.randomUUID()}`;

  await db.query(
    `
      insert into public.portal_sessions (organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at, created_at)
      values ($1, $2, $3, $4, 'active', now() + interval '20 minutes', now())
    `,
    [ids.alphaOrg, ids.alphaLink, ids.alphaPlan, hashPortalSession(rawSession)]
  );

  await db.query(
    `
      insert into public.consent_documents (id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id)
      values
        ($1, $5, $7, $11, 'notice', 'portal_notice', 'active', $6),
        ($2, $5, $8, $12, 'consent', 'portal_consent', 'active', $6),
        ($3, $5, $9, $13, 'consent', 'portal_decline', 'active', $6),
        ($4, $5, $10, 'Taslak portal belgesi', 'notice', 'portal_draft', 'active', $6)
    `,
    [
      noticeDoc,
      consentDoc,
      declineDoc,
      draftDoc,
      ids.alphaOrg,
      ids.alphaOwner,
      `portal-notice-${suffix}`,
      `portal-consent-${suffix}`,
      `portal-decline-${suffix}`,
      `portal-draft-${suffix}`,
      `Temsili portal bilgilendirme ${suffix}`,
      `Temsili portal tercih belgesi ${suffix}`,
      `Temsili ret tercih belgesi ${suffix}`
    ]
  );

  await db.query(
    `
      insert into public.consent_document_versions (
        id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text, published_at, published_by_user_id, created_by_user_id
      )
      values
        ($1, $9, $5, 1, 'published', $11, 'Temsili bilgilendirme metni — gerçek hukuki metin değildir.', 'Bu belge gerçek bir hukuki metin değildir.', now(), $10, $10),
        ($2, $9, $6, 1, 'published', $12, 'Bu tercih belgesi yalnız yerel test amacıyla oluşturulmuştur.', 'Bu belge gerçek bir hukuki metin değildir.', now(), $10, $10),
        ($3, $9, $7, 1, 'published', $13, 'Bu tercih belgesi yalnız yerel test amacıyla oluşturulmuştur.', null, now(), $10, $10),
        ($4, $9, $8, 1, 'draft', 'Taslak görünmemeli', 'Temsili bilgilendirme metni — gerçek hukuki metin değildir.', null, null, null, $10)
    `,
    [
      noticeVersion,
      consentVersion,
      declineVersion,
      draftVersion,
      noticeDoc,
      consentDoc,
      declineDoc,
      draftDoc,
      ids.alphaOrg,
      ids.alphaOwner,
      `Temsili bilgilendirme v1 ${suffix}`,
      `Temsili tercih v1 ${suffix}`,
      `Temsili ret v1 ${suffix}`
    ]
  );

  await db.query(
    `
      insert into public.client_document_assignments (
        id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
      )
      values
        ($1, $8, $9, $10, $4, 'notice', true, 'pending', $11),
        ($2, $8, $9, $10, $5, 'consent', true, 'pending', $11),
        ($3, $8, $9, $10, $6, 'consent', false, 'pending', $11),
        ($7, $8, $9, $10, $12, 'notice', false, 'pending', $11)
    `,
    [noticeAssignment, consentAssignment, declineAssignment, noticeVersion, consentVersion, declineVersion, draftAssignment, ids.alphaOrg, ids.alphaClient, ids.alphaPlan, ids.alphaOwner, draftVersion]
  );

  await db.end();
  return {
    rawSession,
    consentAssignment,
    declineAssignment,
    noticeAssignment,
    noticeTitle: `Temsili bilgilendirme v1 ${suffix}`,
    consentTitle: `Temsili tercih v1 ${suffix}`,
    declineTitle: `Temsili ret v1 ${suffix}`
  };
}

test("portal records notice acknowledgment, consent decisions, withdrawal and data request submission", async ({ page, context }) => {
  const fixture = await seedPortalDocuments();
  await setPortalCookie(context, fixture.rawSession);

  await page.goto("/care/session");
  await expect(page.getByRole("heading", { name: "Belgeler ve tercihlerim" })).toBeVisible();
  await expect(page.getByText("Taslak portal belgesi")).toHaveCount(0);

  await page.getByRole("button", { name: `${fixture.noticeTitle} belgesini görüntüle` }).click();
  await expect(page.getByRole("dialog")).toContainText("Temsili bilgilendirme metni — gerçek hukuki metin değildir.");
  await page.getByRole("button", { name: "Okudum / Görüntüledim" }).click();
  await expect(page.locator("article").filter({ hasText: fixture.noticeTitle }).getByText("Görüldü")).toBeVisible();

  await page.getByRole("button", { name: `${fixture.consentTitle} belgesini görüntüle` }).click();
  await page.getByRole("button", { name: "Kabul ediyorum" }).click();
  await expect(page.locator("article").filter({ hasText: fixture.consentTitle }).getByText("Kabul edildi")).toBeVisible();
  await page.reload();
  await expect(page.locator("article").filter({ hasText: fixture.consentTitle }).getByText("Kabul edildi")).toBeVisible();
  await page.getByRole("button", { name: `${fixture.consentTitle} belgesini görüntüle` }).click();
  await page.getByRole("button", { name: "Geri çek" }).click();
  await page.getByRole("button", { name: "Geri çekmeyi onayla" }).click();
  await expect(page.locator("article").filter({ hasText: fixture.consentTitle }).getByText("Geri çekildi")).toBeVisible();

  await page.getByRole("button", { name: `${fixture.declineTitle} belgesini görüntüle` }).click();
  await page.getByRole("button", { name: "Kabul etmiyorum" }).click();
  await expect(page.locator("article").filter({ hasText: fixture.declineTitle }).getByText("Reddedildi")).toBeVisible();

  await page.getByLabel("Talep türü").selectOption("access");
  await page.getByLabel("Talebimin incelenmek üzere kliniğe iletileceğini anlıyorum.").check();
  await page.getByRole("button", { name: "Talep oluştur" }).click();
  await expect(page.getByText("Talebiniz incelenmek üzere kaydedildi.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Verilerimle ilgili talep oluştur" }).locator("article").filter({ hasText: "Erişim talebi" })).toBeVisible();

  const db = await connect();
  const events = await db.query(
    "select event_type from public.client_document_events where assignment_id = $1 order by occurred_at asc",
    [fixture.consentAssignment]
  );
  expect(events.rows.map((row) => row.event_type)).toEqual(["consent_accepted", "consent_withdrawn"]);
  const dataRequests = await db.query("select count(*)::int as count from public.data_requests where client_id = $1 and request_type = 'access'", [ids.alphaClient]);
  expect(dataRequests.rows[0].count).toBeGreaterThan(0);
  const audit = await db.query(
    "select coalesce(jsonb_agg(safe_metadata)::text, '') as metadata from public.audit_logs where action in ('consent.event_recorded','data_request.created')"
  );
  expect(audit.rows[0].metadata).not.toMatch(/Temsili bilgilendirme|token|session|phone|email|body_text|free_text/i);
  await db.end();
});

test("expired portal session cannot submit document decisions or data requests", async ({ page, context }) => {
  const rawSession = `phase8-expired-${crypto.randomUUID()}`;
  const db = await connect();
  await db.query(
    `
      insert into public.portal_sessions (organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at, created_at)
      values ($1, $2, $3, $4, 'active', now() - interval '1 minute', now())
    `,
    [ids.alphaOrg, ids.alphaLink, ids.alphaPlan, hashPortalSession(rawSession)]
  );
  await db.end();
  await setPortalCookie(context, rawSession);

  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
});
