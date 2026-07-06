import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const users = {
  alphaOwner: "alpha-owner@example.test",
  alphaAdmin: "alpha-admin@example.test",
  alphaStaff: "alpha-staff@example.test",
  betaOwner: "beta-owner@example.test",
  noMembership: "no-membership@example.test",
  inactive: "inactive-member@example.test"
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function syntheticPhone() {
  const digits = String(Date.now()).slice(-5);
  const padded = `${digits}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`.slice(0, 7);
  const phone = `0555 ${padded.slice(0, 3)} ${padded.slice(3, 5)} ${padded.slice(5, 7)}`;
  return {
    phone,
    masked: `05•• ••• •• ${padded.slice(5, 7)}`
  };
}

async function login(page: Page, email: string, expected: "clinic" | "unauthorized" = "clinic") {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(expected === "clinic" ? /\/clinic$/ : /\/unauthorized$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function createClient(page: Page, name: string, phone: string, email?: string) {
  await page.goto("/clinic/clients/new");
  await page.getByLabel("Ad soyad").fill(name);
  await page.getByLabel("Telefon").fill(phone);
  if (email) {
    await page.getByLabel("E-posta opsiyonel").fill(email);
  }
  await page.getByRole("button", { name: "Danışan oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/clients\/[0-9a-f-]+$/);
}

test("unauthenticated user is redirected from clinic home to login", async ({ page }) => {
  await page.goto("/clinic");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated user is redirected from protected phase 2 routes", async ({ page }) => {
  await page.goto("/clinic/clients/new");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/clinic/procedures");
  await expect(page).toHaveURL(/\/login/);
});

test("owner can login with local Supabase Auth", async ({ page }) => {
  await login(page, users.alphaOwner);
  await expect(page.getByRole("main").getByText("Organization Alpha")).toBeVisible();
});

test("session survives page reload", async ({ page }) => {
  await login(page, users.alphaOwner);
  await page.reload();
  await expect(page.getByRole("main").getByText("Organization Alpha")).toBeVisible();
});

test("logout clears protected route access", async ({ page }) => {
  await login(page, users.alphaOwner);
  await logout(page);
  await page.goto("/clinic/clients");
  await expect(page).toHaveURL(/\/login/);
});

test("owner creates a client and phone is masked in list", async ({ page }) => {
  const suffix = uniqueSuffix();
  const phone = syntheticPhone();
  await login(page, users.alphaOwner);
  await createClient(
    page,
    `Synthetic Owner Client ${suffix}`,
    phone.phone,
    `owner-client-${suffix}@example.test`
  );
  await expect(page.getByText(phone.masked)).toBeVisible();

  await page.goto("/clinic/clients");
  await expect(page.getByText(`Synthetic Owner Client ${suffix}`)).toBeVisible();
  await expect(page.getByText(phone.masked)).toBeVisible();
});

test("owner updates a client", async ({ page }) => {
  const suffix = uniqueSuffix();
  const phone = syntheticPhone();
  await login(page, users.alphaOwner);
  await createClient(page, `Synthetic Owner Editable ${suffix}`, phone.phone);

  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByLabel("Ad soyad").fill(`Synthetic Owner Updated ${suffix}`);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("heading", { name: `Synthetic Owner Updated ${suffix}` })).toBeVisible();
});

test("owner archives a client and sees it under archived filter", async ({ page }) => {
  const suffix = uniqueSuffix();
  const phone = syntheticPhone();
  await login(page, users.alphaOwner);
  await createClient(page, `Synthetic Owner Archive ${suffix}`, phone.phone);

  await page.getByRole("button", { name: "Arşivle" }).click();
  await expect(page.getByText("Arşivli")).toBeVisible();
  await page.goto("/clinic/clients?status=archived");
  await expect(page.getByText(`Synthetic Owner Archive ${suffix}`)).toBeVisible();
});

test("staff creates and updates a client", async ({ page }) => {
  const suffix = uniqueSuffix();
  const phone = syntheticPhone();
  await login(page, users.alphaStaff);
  await createClient(page, `Synthetic Staff Client ${suffix}`, phone.phone);

  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByLabel("Ad soyad").fill(`Synthetic Staff Updated ${suffix}`);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("heading", { name: `Synthetic Staff Updated ${suffix}` })).toBeVisible();
});

test("staff cannot see archive action and direct archive is denied", async ({ page }) => {
  const suffix = uniqueSuffix();
  const phone = syntheticPhone();
  await login(page, users.alphaStaff);
  await createClient(page, `Synthetic Staff No Archive ${suffix}`, phone.phone);
  await expect(page.getByRole("button", { name: "Arşivle" })).toHaveCount(0);

  const id = page.url().split("/").at(-1) ?? "";
  const direct = await page.request.post("/clinic/clients/archive", { form: { id } });
  expect(direct.status()).toBe(403);
});

test("duplicate phone shows a friendly Turkish error", async ({ page }) => {
  const phone = syntheticPhone();
  await login(page, users.alphaAdmin);
  await createClient(page, "Synthetic Duplicate Baseline", phone.phone);
  await page.goto("/clinic/clients/new");
  await page.getByLabel("Ad soyad").fill("Synthetic Duplicate Client");
  await page.getByLabel("Telefon").fill(phone.phone);
  await page.getByRole("button", { name: "Danışan oluştur" }).click();
  await expect(page.getByText("Bu telefon için aktif bir danışan kaydı zaten var.")).toBeVisible();
});

test("staff sees procedures read-only", async ({ page }) => {
  await login(page, users.alphaStaff);
  await page.goto("/clinic/procedures");
  await expect(page.getByText("Alpha Procedure One")).toBeVisible();
  await expect(page.getByRole("button", { name: "İşlem oluştur" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pasifleştir" })).toHaveCount(0);
});

test("admin creates a procedure", async ({ page }) => {
  const suffix = uniqueSuffix();
  await login(page, users.alphaAdmin);
  await page.goto("/clinic/procedures");
  await page.getByLabel("İşlem adı").first().fill(`Synthetic E2E Procedure ${suffix}`);
  await page.getByLabel("Kategori").first().fill("Demo");
  await page.getByLabel("Kısa açıklama").first().fill("Klinik tarafından yapılandırılacak temsili işlem kaydı.");
  await page.getByRole("button", { name: "İşlem oluştur" }).click();
  await expect(page.getByText(`Synthetic E2E Procedure ${suffix}`)).toBeVisible();
});

test("admin updates a procedure", async ({ page }) => {
  const suffix = uniqueSuffix();
  const procedureName = `Synthetic E2E Procedure Update ${suffix}`;
  await login(page, users.alphaAdmin);
  await page.goto("/clinic/procedures");
  await page.getByLabel("İşlem adı").first().fill(procedureName);
  await page.getByLabel("Kategori").first().fill("Demo");
  await page.getByRole("button", { name: "İşlem oluştur" }).click();

  const card = page.locator(".item-card", { hasText: procedureName });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Düzenle" }).click();
  await card.getByLabel("Kategori").fill("Updated Demo");
  await card.getByRole("button", { name: "Kaydet" }).click();
  await expect(card.getByText("Updated Demo")).toBeVisible();
});

test("admin deactivates a procedure", async ({ page }) => {
  const suffix = uniqueSuffix();
  const procedureName = `Synthetic E2E Procedure Inactive ${suffix}`;
  await login(page, users.alphaAdmin);
  await page.goto("/clinic/procedures");
  await page.getByLabel("İşlem adı").first().fill(procedureName);
  await page.getByRole("button", { name: "İşlem oluştur" }).click();

  const card = page.locator(".item-card", { hasText: procedureName });
  await card.getByRole("button", { name: "Pasifleştir" }).click();
  await page.goto("/clinic/procedures?status=inactive");
  await expect(page.getByText(procedureName)).toBeVisible();
});

test("Alpha user cannot view Beta client detail", async ({ page }) => {
  await login(page, users.betaOwner);
  await page.goto("/clinic/clients");
  await page.getByRole("link", { name: "Detay" }).first().click();
  const betaClientUrl = page.url();
  await logout(page);

  await login(page, users.alphaOwner);
  await page.goto(betaClientUrl);
  await expect(page).toHaveURL(/\/clinic\/clients$/);
  await expect(page.getByText("Synthetic Beta Client")).toHaveCount(0);
});

test("no-membership user is unauthorized after login", async ({ page }) => {
  await login(page, users.noMembership, "unauthorized");
});

test("inactive membership user is unauthorized after login", async ({ page }) => {
  await login(page, users.inactive, "unauthorized");
});
