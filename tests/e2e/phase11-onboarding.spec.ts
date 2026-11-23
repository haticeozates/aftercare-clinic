import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { deriveRateLimitClientFacet, deriveRateLimitKey } from "../../lib/rate-limit/keys";
import { phase11Config } from "../../lib/phase11/config";

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] };
type MailBody = { HTML: string; Text: string };
const title = "Klinik kurulumu";
const readSignup = "E-posta doğrulama";
const readRecovery = "parola yenileme";
const readInvite = "ekip daveti";

test.use({ trace: "off", screenshot: "off", video: "off", actionTimeout: 12_000, navigationTimeout: 20_000 });
test.setTimeout(150_000);

function requireLocalRunner() {
  const config = phase11Config();
  const db = new URL(process.env.TEST_DATABASE_URL ?? "postgres://invalid/");
  if (!config || config.appOrigin !== "http://localhost:3000" || !config.mailOrigin.endsWith(":56324")
    || !["127.0.0.1", "localhost"].includes(db.hostname) || db.port !== "56322") {
    throw new Error("Phase 11 E2E requires the verified isolated mail and database runner.");
  }
  return config;
}

async function mailbox(email: string, subject: string, except?: string) {
  const { appOrigin, mailOrigin } = requireLocalRunner();
  let match: MailSummary | undefined;
  await expect.poll(async () => {
    const result = await fetch(new URL("/api/v1/messages", mailOrigin));
    if (!result.ok) return false;
    const payload = await result.json() as { messages: MailSummary[] };
    match = payload.messages.find((item) => item.ID !== except &&
      item.Subject.toLowerCase().includes(subject.toLowerCase()) &&
      item.To.some((recipient) => recipient.Address === email));
    return Boolean(match);
  }, { timeout: 15_000, message: "Local Mailpit received the requested message" }).toBe(true);
  if (!match) throw new Error("Mail not available");
  const payload = await (await fetch(new URL(`/api/v1/message/${encodeURIComponent(match.ID)}`, mailOrigin))).json() as MailBody;
  const href = payload.HTML?.match(/href="([^"]+)"/)?.[1] ?? payload.Text?.match(/http[^\s]+/)?.[0];
  if (!href) throw new Error("Email lacks a link");
  const url = new URL(href.replaceAll("&amp;", "&"));
  if (url.origin !== appOrigin || !["/auth/dogrula", "/ekip/davet"].includes(url.pathname) || !url.hash) {
    throw new Error("Email link did not use its expected local endpoint");
  }
  return { url, id: match.ID };
}

async function openEmail(page: Page, mail: Awaited<ReturnType<typeof mailbox>>) {
  // Capabilities are supplied to the browser in a fragment and kept out of test traces.
  await page.goto(mail.url.pathname);
  await page.evaluate((hash) => { location.hash = hash; }, mail.url.hash);
}

async function register(page: Page, email: string, password: string) {
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Yeni parola", { exact: true }).fill(password);
  await page.getByLabel("Yeni parolayı tekrar girin").fill(password);
  await page.getByRole("button", { name: "Doğrulama bağlantısı iste" }).click();
  await expect(page.getByRole("status")).toContainText("İstek alındı");
}

async function signIn(page: Page, email: string, secret: string) {
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Parola", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function sendInvite(page: Page, email: string) {
  await page.getByLabel("Ekip üyesinin e-postası").fill(email);
  await page.getByRole("button", { name: "Davet gönder" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Davet yerel test posta kutusuna gönderildi" })).toBeVisible();
}

async function assertCookie(page: Page, name: string) {
  await expect.poll(async () => (await page.context().cookies()).some(
    (cookie) => cookie.name.includes(name) && cookie.httpOnly && cookie.sameSite === "Lax"
  ), { message: "Expected HttpOnly SameSite=Lax cookie" }).toBe(true);
}

async function checkViewports(page: Page, view: string, save = false) {
  const output = process.env.PHASE11_SCREENSHOTS_DIR;
  if (save && output) await mkdir(output, { recursive: true, mode: 0o700 });
  for (const [label, width, height] of [["desktop", 1440, 960], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), view).toBeLessThanOrEqual(width);
    if (width <= 820 && view === "klinik-ayarlari") {
      const header = await page.locator(".mobile-topbar").boundingBox();
      expect(header?.height).toBeLessThan(120);
    }
    if (save && output) await page.screenshot({ path: join(output, `${view}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

test("real-mail golden journey connects registration, onboarding, invitation, roles and password recovery", async ({ page, browser }) => {
  requireLocalRunner();
  const suffix = randomUUID().slice(0, 12);
  const owner = `phase11-owner-${suffix}@example.test`;
  const staff = `phase11-staff-${suffix}@example.test`;
  const inviteToExpire = `phase11-expire-${suffix}@example.test`;
  const secret = randomUUID();
  const fresh = randomUUID();
  const clinic = "Ada Sentetik Klinik";

  await test.step("Show the public CTA and require email confirmation before setup", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: /Klinik demo hesabı oluştur/ }).click();
    await expect(page).toHaveURL(/\/kayit$/);
    await register(page, owner, secret);
    await page.goto("/kurulum");
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, owner, secret);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Giriş bilgileri doğrulanamadı");
  });

  const confirmation = await mailbox(owner, readSignup);
  await openEmail(page, confirmation);
  await page.getByRole("button", { name: "E-posta adresini doğrula" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await assertCookie(page, "auth-token");
  await checkViewports(page, "kurulum", true);

  await test.step("Create the clinic and resume safely after reload and sign in", async () => {
    await expect(page.locator('[aria-current="step"]')).toHaveText("Klinik profili");
    await page.getByLabel("Klinik adı").fill(clinic);
    await page.getByLabel("Ad soyad").fill("Sentetik Klinik Sahibi");
    await page.getByRole("button", { name: "Kliniği oluştur" }).click();
    await expect(page.locator('[aria-current="step"]')).toHaveText("Ekip");
    await page.reload();
    await expect(page.locator('[aria-current="step"]')).toHaveText("Ekip");
    await signOut(page);
    await signIn(page, owner, secret);
    await expect(page).toHaveURL(/\/kurulum$/);
    await expect(page.locator('[aria-current="step"]')).toHaveText("Ekip");
    await page.goto("/clinic");
    await expect(page).toHaveURL(/\/kurulum$/);
  });

  await sendInvite(page, staff);
  const invitation = await mailbox(staff, readInvite);
  await page.getByRole("link", { name: "Kurulum özetine geç" }).click();
  await expect(page.getByRole("heading", { name: "Kurulum özeti" })).toBeVisible();
  await expect(page.getByText(clinic, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kurulumu tamamla ve kliniğe geç" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
  await expect(page.getByRole("heading", { name: "İlk bakım takibinizi başlatın" })).toBeVisible();

  const staffContext = await browser.newContext();
  try {
    const member = await staffContext.newPage();
    await test.step("Reject a wrong account and accept once with the verified recipient", async () => {
      await openEmail(page, invitation);
      await page.getByRole("button", { name: "Davetle devam et" }).click();
      await page.getByRole("button", { name: "Ekip davetini kabul et" }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Bu davet kullanılamıyor");

      await openEmail(member, invitation);
      await member.getByRole("button", { name: "Davetle devam et" }).click();
      await assertCookie(member, "aftercare_demo_invite");
      await member.getByRole("link", { name: "Hesap oluştur" }).click();
      await register(member, staff, secret);
      await openEmail(member, await mailbox(staff, readSignup));
      await member.getByRole("button", { name: "E-posta adresini doğrula" }).click();
      await member.getByRole("button", { name: "Ekip davetini kabul et" }).click();
      await expect(member).toHaveURL(/\/clinic$/);
      await expect(member.getByLabel("Klinik kenar çubuğu").getByText(clinic)).toBeVisible();
      await expect(member.getByLabel("Klinik kenar çubuğu").getByText("Uzman", { exact: true })).toBeVisible();
      await member.goto("/clinic/team");
      await expect(member).toHaveURL(/\/unauthorized$/);
      await member.goto("/clinic/settings");
      await expect(member).toHaveURL(/\/unauthorized$/);
      await openEmail(member, invitation);
      await member.getByRole("button", { name: "Davetle devam et" }).click();
      await expect(member.getByRole("main").getByRole("alert")).toContainText("Bu davet kullanılamıyor");
    });

    await test.step("Edit settings and verify role changes, last-owner protection and access removal", async () => {
      await page.goto("/clinic/settings");
      await checkViewports(page, "klinik-ayarlari", true);
      await page.getByLabel("Klinik telefonu").fill("0212 555 00 00");
      await page.getByRole("button", { name: "Ayarları kaydet" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Klinik ayarları kaydedildi" })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Klinik telefonu")).toHaveValue("0212 555 00 00");
      await page.goto("/clinic/team");
      await expect(page.getByRole("list", { name: "Davetler" })).toContainText("Kabul edildi");
      const ownerRow = page.getByRole("listitem").filter({ hasText: "Sentetik Klinik Sahibi" });
      await ownerRow.getByRole("button", { name: "Erişimi kaldır" }).click();
      await expect(ownerRow.getByRole("alert")).toContainText("en az bir etkin işletme sahibi");
      const staffRow = page.getByRole("list", { name: "Ekip üyeleri" }).getByRole("listitem")
        .filter({ has: page.getByText("Ekip üyesi", { exact: true }) });
      await expect(staffRow.getByText("Uzman · Etkin", { exact: true })).toBeVisible();
      await staffRow.getByLabel("Üye rolü").selectOption("organization_admin");
      await staffRow.getByRole("button", { name: "Rolü kaydet" }).click();
      await expect(staffRow.getByText("Yönetici · Etkin", { exact: true })).toBeVisible();
      await member.goto("/clinic/team");
      await expect(member.getByRole("heading", { name: "Ekip yönetimi" })).toBeVisible();
      await expect(member.getByLabel("Davet rolü").locator("option")).toHaveCount(1);
      await expect(member.getByRole("button", { name: "Erişimi kaldır" })).toHaveCount(0);
      await staffRow.getByRole("button", { name: "Erişimi kaldır" }).click();
      await expect(staffRow.getByText("Yönetici · Erişim kapalı", { exact: true })).toBeVisible();
      await member.goto("/clinic");
      await expect(member).toHaveURL(/\/unauthorized$/);
    });
  } finally {
    await staffContext.close();
  }

  await test.step("Expire, resend and revoke an invitation", async () => {
    await page.goto("/clinic/team");
    await sendInvite(page, inviteToExpire);
    const old = await mailbox(inviteToExpire, readInvite);
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      expect((await db.query(
        "update public.phase11_team_invites set expires_at = now() - interval '1 second' where email = $1",
        [inviteToExpire]
      )).rowCount).toBe(1);
    } finally {
      await db.end();
    }
    await openEmail(page, old);
    await page.getByRole("button", { name: "Davetle devam et" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bu davet kullanılamıyor");
    await page.goto("/clinic/team");
    const row = page.getByRole("listitem").filter({ hasText: inviteToExpire });
    await expect(row).toContainText("Süresi doldu");
    await row.getByRole("button", { name: "Yeniden gönder" }).click();
    await expect(row).toContainText("Bekliyor");
    const resent = await mailbox(inviteToExpire, readInvite, old.id);
    expect(resent.url.hash === old.url.hash).toBe(false);
    await row.getByRole("button", { name: "Daveti iptal et" }).click();
    await expect(row).toContainText("İptal edildi");
    await openEmail(page, resent);
    await page.getByRole("button", { name: "Davetle devam et" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bu davet kullanılamıyor");
  });

  await test.step("Reject confirmation replay and renew the password without a clinic session", async () => {
    await openEmail(page, confirmation);
    await page.getByRole("button", { name: "E-posta adresini doğrula" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı geçersiz");
    await page.goto("/clinic");
    await page.setViewportSize({ width: 1280, height: 650 });
    await expect(page.getByRole("button", { name: "Çıkış yap" })).toBeInViewport();
    await signOut(page);
    await page.getByRole("link", { name: "Parolamı unuttum" }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(owner);
    await page.getByRole("button", { name: "Yenileme bağlantısı iste" }).click();
    await expect(page.getByRole("status")).toContainText("İstek alındı");
    const recovery = await mailbox(owner, readRecovery);
    await openEmail(page, recovery);
    await page.getByRole("button", { name: "Parolayı yenile" }).click();
    await expect(page).toHaveURL(/\/sifre-yenile$/);
    await assertCookie(page, "aftercare_demo_recovery");
    await page.goto("/clinic");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/sifre-yenile");
    await page.getByLabel("Yeni parola", { exact: true }).fill(fresh);
    await page.getByLabel("Yeni parolayı tekrar girin").fill(fresh);
    await page.getByRole("button", { name: "Parolayı kaydet" }).click();
    await expect(page.getByRole("status")).toContainText("Parolanız güncellendi");
    await signIn(page, owner, secret);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Giriş bilgileri doğrulanamadı");
    await signIn(page, owner, fresh);
    await expect(page).toHaveURL(/\/clinic$/);
    await signOut(page);
    await openEmail(page, recovery);
    await page.getByRole("button", { name: "Parolayı yenile" }).click();
    await page.getByLabel("Yeni parola", { exact: true }).fill(randomUUID());
    await page.getByLabel("Yeni parolayı tekrar girin").fill(fresh);
    await page.getByRole("button", { name: "Parolayı kaydet" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Parolalar aynı olmalı");
    await page.getByLabel("Yeni parola", { exact: true }).fill(fresh);
    await page.getByLabel("Yeni parolayı tekrar girin").fill(fresh);
    await page.getByRole("button", { name: "Parolayı kaydet" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı geçersiz");
    await page.goto("/clinic");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test("validates public entry, generic recovery and responsive keyboard navigation", async ({ page, request }) => {
  requireLocalRunner();
  await page.goto("/kayit");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /AfterCare Clinic/ })).toBeFocused();
  await page.goto("/kayit");
  await checkViewports(page, "kayit", true);
  for (const path of ["/login", "/sifre-unuttum", "/sifre-yenile", "/auth/dogrula", "/ekip/davet"]) {
    await page.goto(path);
    await checkViewports(page, path);
  }
  await page.goto("/kayit");
  await page.getByLabel("E-posta", { exact: true }).fill("sentetik@example.invalid");
  await page.getByLabel("Yeni parola", { exact: true }).fill("sentetik-otomasyon");
  await page.getByLabel("Yeni parolayı tekrar girin").fill("sentetik-otomasyon");
  await page.getByRole("button", { name: "Doğrulama bağlantısı iste" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(".test ile biten");
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();

  const privateResponse = await request.get("/auth/dogrula?next=https%3A%2F%2Fredirect.example.test", { maxRedirects: 0 });
  expect(privateResponse.status()).toBe(200);
  expect(privateResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(privateResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  await page.goto("/auth/dogrula?next=https%3A%2F%2Fredirect.example.test");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı eksik veya geçersiz");
  await expect(page).toHaveURL(/localhost:3000\/auth\/dogrula/);

  await page.goto("/sifre-unuttum");
  await page.getByLabel("E-posta", { exact: true }).fill(`phase11-unknown-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Yenileme bağlantısı iste" }).click();
  await expect(page.getByRole("status")).toContainText("İstek alındı. Adres bu işlem için uygunsa");
});


test("an expired confirmation link does not verify the account or create a clinic", async ({ page }) => {
  requireLocalRunner();
  const email = `phase11-expired-auth-${randomUUID()}@example.test`;
  await page.goto("/kayit");
  await register(page, email, randomUUID());
  const confirmation = await mailbox(email, readSignup);
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    const updated = await db.query(
      "update auth.users set confirmation_sent_at = now() - interval '1 day' where email = $1",
      [email]
    );
    expect(updated.rowCount).toBe(1);
    await openEmail(page, confirmation);
    await page.getByRole("button", { name: "E-posta adresini doğrula" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı geçersiz");
    const result = await db.query(
      "select email_confirmed_at, organization_id from auth.users u join public.phase11_onboarding o on o.user_id=u.id where u.email=$1",
      [email]
    );
    expect(result.rows).toEqual([{ email_confirmed_at: null, organization_id: null }]);
  } finally {
    await db.end();
  }
});


test("rate-limited registration gives a generic reply without creating an account or sending mail", async ({ page }) => {
  const { mailOrigin } = requireLocalRunner();
  const email = `phase11-limited-${randomUUID()}@example.test`;
  const limiterKey = deriveRateLimitKey({
    scope: "auth.entry", route: "/auth/signup", clientFacet: deriveRateLimitClientFacet(email)
  });
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    await db.query(`select public.consume_rate_limit($1, 'auth.entry', 5, 900, now())
      from generate_series(1, 5)`, [limiterKey]);
    await page.goto("/kayit");
    await register(page, email, randomUUID());
    expect((await db.query("select id from auth.users where email = $1", [email])).rowCount).toBe(0);
    const payload = await (await fetch(new URL("/api/v1/messages", mailOrigin))).json() as { messages: MailSummary[] };
    expect(payload.messages.some((message) => message.To.some((recipient) => recipient.Address === email))).toBe(false);
  } finally {
    await db.end();
  }
});
