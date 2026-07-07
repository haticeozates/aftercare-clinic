import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

async function login(page: Page, email = "alpha-owner@example.test") {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

async function createPlanAndOpenPortal(page: Page) {
  await page.goto("/clinic/plans/new");
  await page.getByLabel("Danışan").selectOption({ label: "Synthetic Alpha Client One" });
  await page.getByLabel("İşlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByLabel("Şablon").selectOption({ label: "Alpha Template One v1" });
  await page.getByLabel("Başlangıç tarihi").fill("2026-07-06");
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/plans\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Güvenli bağlantı oluştur" }).click();
  const link = await page.getByTestId("plain-secure-link").textContent();
  await page.goto(link ?? "");
  await expect(page).toHaveURL(/\/care\/session$/);
}

test("login screen uses premium clinical language without developer phase copy", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Klinik takip operasyonu için güvenli çalışma alanı" })).toBeVisible();
  await expect(page.getByText(/Production temel|Faz|placeholder/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("desktop shell shows branded sidebar, active navigation and dashboard cards", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await expect(page.getByRole("navigation", { name: "Klinik menüsü" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genel Bakış" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Operasyon özeti" })).toBeVisible();
  await expect(page.getByText("Aktif bakım planları")).toBeVisible();
  await expect(page.getByText(/Production temel|Faz 2|henüz yok/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("mobile shell opens drawer navigation without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole("navigation", { name: "Klinik menüsü" })).toHaveCount(0);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(page.getByRole("dialog", { name: "Klinik menüsü" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Klinik menüsü" })).toHaveCount(0);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("link", { name: "Danışanlar" }).click();
  await expect(page).toHaveURL(/\/clinic\/clients$/);
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
]) {
  test(`key clinic pages avoid overflow and expose keyboard focus at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page);
    for (const route of ["/clinic/clients", "/clinic/templates", "/clinic/plans", "/clinic/alerts"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        return {
          tag: element?.tagName.toLowerCase(),
          outline: element ? getComputedStyle(element).outlineStyle : ""
        };
      });
      expect(["a", "button", "input", "select", "textarea"]).toContain(focused.tag);
    }
  });
}

test("form and detail routes keep the premium shell and avoid technical copy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);

  await page.goto("/clinic/clients/new");
  await expect(page.getByRole("heading", { name: "Temel danışan kaydı" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/clinic/clients");
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/00000000-|token|session/i)).toHaveCount(0);

  await page.goto("/clinic/procedures");
  await expect(page.getByRole("heading", { name: "İşlem türleri" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/clinic/templates/new");
  await expect(page.getByRole("heading", { name: "Taslak bakım şablonu oluştur" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/clinic/templates");
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Yayınlanan versiyonu görüntüle" }).click();
  await expect(page.getByRole("heading", { name: "Önizleme" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Temsili takip günü" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("plan and alert detail routes are responsive and keep protected information hidden", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await login(page);
  await page.goto("/clinic/plans");
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByRole("heading", { name: "Plan özeti" })).toBeVisible();
  await expect(page.getByText(/00000000-|@example.test|\+90/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/clinic/alerts");
  await page.getByRole("link", { name: "Detay" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/token|session|@example.test|\+90/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("care invalid screen uses portal styling without exposing internals", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/care/invalid");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz veya süresi dolmuş." })).toBeVisible();
  await expect(page.getByText(/token|session|00000000-|@example.test|\+90/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("portal visual language is mobile-first and does not expose internal data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await createPlanAndOpenPortal(page);
  await expect(page.getByRole("heading", { name: "Bakım Planınız" })).toBeVisible();
  await expect(page.getByText(/token|session|00000000-|@example.test|\+90/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("reduced motion preference disables decorative transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  const transitionDuration = await page.getByRole("link", { name: "Danışanlar" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transitionDuration).toBe("0s");
});
