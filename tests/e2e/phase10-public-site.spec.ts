import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { phase11Config } from "../../lib/phase11/config";
import { publicPages } from "../../lib/public-site/content";
import {
  deriveRateLimitClientFacet,
  deriveRateLimitKey
} from "../../lib/rate-limit/keys";

const demoSuccess = "Demo talebiniz kaydedildi.";
const contactSuccess = "Mesajınız kaydedildi.";

function localTestUrl(value: string | undefined) {
  if (!value) throw new Error("Run Phase 10 E2E with explicit isolated test endpoints.");
  const uri = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname)) {
    throw new Error("Phase 10 E2E requires loopback test endpoints.");
  }
  return value;
}

async function withDb<T>(run: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client({
    connectionString: localTestUrl(process.env.TEST_DATABASE_URL)
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function fillForm(page: Page, email: string, kind: "demo" | "contact") {
  await page.getByLabel("Ad soyad").fill("Sentetik Form Kullanıcısı");
  await page.getByLabel("E-posta").fill(email);
  if (kind === "demo")
    await page.getByLabel("Klinik veya kurum").fill("Sentetik Örnek Klinik");
  else
    await page
      .getByLabel("Mesajınız")
      .fill("Bu mesaj otomatik izole test için oluşturuldu.");
}

test("publishes all pages, functional links and private-route boundaries", async ({
  page,
  request
}) => {
  const visitedLinks = new Set<string>();
  for (const [path, entry] of Object.entries(publicPages)) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(entry.title.replace(/[?]/g, "\\?")));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/aftercare\/share\.jpg$/
    );
    for (const href of await page
      .locator(".ac-site a")
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")))) {
      if (href?.startsWith("/")) visitedLinks.add(href);
    }
  }
  expect(visitedLinks).toEqual(new Set([...Object.keys(publicPages), "/login", ...(phase11Config() ? ["/kayit"] : [])]));
  for (const href of visitedLinks) expect((await request.get(href)).status()).toBe(200);
  await page.goto("/");
  await page.getByRole("link", { name: "Demo talep et" }).first().click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole("link", { name: "Klinik girişi" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  const privateResponse = await request.get("/clinic", { maxRedirects: 0 });
  expect(privateResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await page.goto("/clinic");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/care/session");
  await expect(page).toHaveURL(/\/care\/invalid$/);
  const robots = await (await request.get("/robots.txt")).text();
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(robots).toContain("Disallow: /care");
  expect(robots).toContain("Disallow: /clinic");
  expect(robots).toContain("Disallow: /randevu");
  expect(sitemap).toContain("/nasil-calisir");
  expect(sitemap).not.toMatch(/\/(clinic|care|login|internal|kayit|auth|sifre-yenile|sifre-unuttum|kurulum|ekip|randevu)(\/|<)/);
});

test("mobile navigation, skip link, FAQ keyboard and page geometry work at three widths", async ({
  page
}) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 880 });
    for (const path of Object.keys(publicPages)) {
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        path
      ).toBeLessThanOrEqual(width);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ana içeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const toggle = page.getByRole("button", { name: "Menü", exact: true });
  await toggle.click();
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Ana menü" })
    .getByRole("link", { name: "Özellikler" })
    .click();
  await expect(page).toHaveURL(/\/ozellikler$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.goto("/sss");
  const question = page.locator("summary").first();
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(page.locator("details").first()).not.toHaveAttribute("open", "");
});

test("persists both forms, validates fields and excludes persisted data from public output", async ({
  page,
  request
}) => {
  const suffix = randomUUID();
  const demo = `phase10-demo-${suffix}@example.test`;
  const contact = `phase10-contact-${suffix}@example.test`;
  await page.goto("/demo");
  await fillForm(page, "invalid", "demo");
  await page.getByRole("button", { name: "Demo talebini kaydet" }).click();
  await expect(page.locator(".ac-form").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("E-posta")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Ad soyad")).toHaveValue("Sentetik Form Kullanıcısı");
  await page.getByLabel("E-posta").fill(demo);
  let releaseRequest = () => {};
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/demo", async (route) => {
    if (route.request().method() === "POST") await heldRequest;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Demo talebini kaydet" }).click();
    await expect(page.getByRole("button", { name: "Kaydediliyor…" })).toBeDisabled();
  } finally {
    releaseRequest();
  }
  await expect(page.getByRole("status").filter({ hasText: demoSuccess })).toBeVisible();
  await page.goto("/iletisim");
  await fillForm(page, contact, "contact");
  await page.getByLabel("Mesajınız").fill("Kısa");
  await page.getByRole("button", { name: "Mesajı kaydet" }).click();
  await expect(page.locator(".ac-form").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Mesajınız")).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Mesajınız")
    .fill("Bu mesaj otomatik izole test için oluşturuldu.");
  await page.getByRole("button", { name: "Mesajı kaydet" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: contactSuccess })
  ).toBeVisible();
  const rows = await withDb((client) =>
    client.query(
      "select kind, email, clinic, message from public.public_inquiries where email = any($1) order by kind",
      [[demo, contact]]
    )
  );
  expect(rows.rows).toEqual([
    {
      kind: "contact",
      email: contact,
      clinic: null,
      message: "Bu mesaj otomatik izole test için oluşturuldu."
    },
    { kind: "demo", email: demo, clinic: "Sentetik Örnek Klinik", message: null }
  ]);
  for (const path of ["/", "/demo", "/iletisim", "/sitemap.xml"]) {
    expect(await (await request.get(path)).text()).not.toContain(suffix);
  }
  const api = localTestUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) throw new Error("Local anon credential is required");
  const denied = await request.get(`${api}/rest/v1/public_inquiries?select=email`, {
    headers: { apikey: anon }
  });
  expect([401, 403, 404]).toContain(denied.status());
  expect(await denied.text()).not.toContain(suffix);
});

test("rejects honeypot and durable rate limit submissions without saving", async ({
  page
}) => {
  const email = `phase10-limited-${randomUUID()}@example.test`;
  await page.goto("/demo");
  await fillForm(page, email, "demo");
  await page.locator('[name="website"]').evaluate((input: HTMLInputElement) => {
    input.value = "bot";
  });
  await page.getByRole("button", { name: "Demo talebini kaydet" }).click();
  await expect(page.locator(".ac-form").getByRole("alert")).toHaveText(/kaydedilemedi/);
  await page.reload();
  const limiterKey = deriveRateLimitKey({
    scope: "website.inquiry",
    route: "/inquiry/email",
    clientFacet: deriveRateLimitClientFacet(email)
  });
  // A browser submission near a 15-minute boundary may reach the next bucket.
  await withDb((client) => client.query(
    `select public.consume_rate_limit($1, 'website.inquiry', 5, 900, windows.start_at)
       from (select distinct date_bin(interval '15 minutes', now() + shift.amount, '1970-01-01 UTC'::timestamptz) as start_at
               from (values (interval '0 seconds'), (interval '30 seconds')) as shift(amount)) windows
       cross join generate_series(1, 5)`,
    [limiterKey]
  ));
  await fillForm(page, email, "demo");
  await page.getByRole("button", { name: "Demo talebini kaydet" }).click();
  await expect(page.locator(".ac-form").getByRole("alert")).toHaveText(/Çok fazla talep/);
  const result = await withDb((client) =>
    client.query("select count(*)::int from public.public_inquiries where email = $1", [
      email
    ])
  );
  expect(result.rows[0].count).toBe(0);
});
