import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const users = {
  alphaOwner: "alpha-owner@example.test",
  alphaAdmin: "alpha-admin@example.test",
  alphaStaff: "alpha-staff@example.test",
  betaOwner: "beta-owner@example.test"
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

async function createTemplate(page: Page, name: string) {
  await page.goto("/clinic/templates/new");
  await page.getByLabel("Şablon adı").fill(name);
  await page.getByLabel("Bağlı işlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/templates\/[0-9a-f-]+\/draft$/);
}

async function addDraftContent(page: Page) {
  await page.getByLabel("Gün başlığı").fill("Temsili takip günü");
  await page.getByRole("button", { name: "Gün ekle" }).click();
  await expect(page.getByText("Temsili takip günü")).toBeVisible();

  await page.getByLabel("Görev başlığı").fill("Klinik tarafından yapılandırılmış temsili günlük görev");
  await page.getByLabel("Görev türü").selectOption("do");
  await page.getByRole("button", { name: "Görev ekle" }).click();
  await expect(page.getByText("Klinik tarafından yapılandırılmış temsili günlük görev")).toBeVisible();
}

test("owner creates a template and adds draft day/task", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template ${uniqueSuffix()}`);
  await addDraftContent(page);
});

test("owner adds symptom option and alert rule", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template Symptom ${uniqueSuffix()}`);
  await page.getByLabel("Belirti seçeneği").fill("Klinik değerlendirmesi için temsili durum");
  await page.getByRole("button", { name: "Belirti ekle" }).click();
  await expect(page.getByText("Klinik değerlendirmesi için temsili durum")).toBeVisible();

  await page.getByLabel("Kural mesajı").fill("Temsili takip uyarısı");
  await page.getByLabel("Kural türü").selectOption("symptom_selected");
  await page.getByLabel("Önem seviyesi").selectOption("medium");
  await page.getByRole("button", { name: "Kural ekle" }).click();
  await expect(page.getByText("Temsili takip uyarısı")).toBeVisible();
});

test("owner publishes valid draft and published version becomes read-only", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template Publish ${uniqueSuffix()}`);
  await addDraftContent(page);
  await page.getByRole("button", { name: "Yayına al" }).click();
  await expect(page.getByText("Yayınlandı")).toBeVisible();
  await expect(page.getByRole("button", { name: "Görev ekle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yayına al" })).toHaveCount(0);
});

test("published mutation endpoint rejects normal browser request", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template Immutable ${uniqueSuffix()}`);
  await addDraftContent(page);
  await page.getByRole("button", { name: "Yayına al" }).click();
  await expect(page.getByText("Yayınlandı")).toBeVisible();
  const versionId = page.url().split("/").at(-1) ?? "";

  const response = await page.request.post(`/clinic/templates/published/${versionId}/tasks`, {
    form: { title: "Tamper", taskType: "do" }
  });
  expect(response.status()).toBe(403);
});

test("admin creates a new draft version from a published template", async ({ page }) => {
  await login(page, users.alphaAdmin);
  await page.goto("/clinic/templates");
  await page.getByRole("link", { name: "Alpha Template One" }).click();
  await page.getByRole("button", { name: "Yeni taslak oluştur" }).click();
  await expect(page).toHaveURL(/\/clinic\/templates\/[0-9a-f-]+\/draft$/);
  await expect(page.getByText("Taslak")).toBeVisible();
});

test("staff sees template list and published content read-only", async ({ page }) => {
  await login(page, users.alphaStaff);
  await page.goto("/clinic/templates");
  await expect(page.getByText("Alpha Template One")).toBeVisible();
  await expect(page.getByRole("link", { name: "Yeni şablon" })).toHaveCount(0);
  await page.getByRole("link", { name: "Alpha Template One" }).click();
  await expect(page.getByRole("button", { name: "Yeni taslak oluştur" })).toHaveCount(0);
});

test("staff direct publish request is denied", async ({ page }) => {
  await login(page, users.alphaStaff);
  const response = await page.request.post("/clinic/templates/publish", {
    form: { versionId: "00000000-0000-4000-8000-00000000a582" }
  });
  expect(response.status()).toBe(403);
});

test("Alpha user cannot view Beta template detail", async ({ page }) => {
  await login(page, users.betaOwner);
  await page.goto("/clinic/templates");
  await page.getByRole("link", { name: "Beta Template One" }).click();
  const betaTemplateUrl = page.url();

  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await login(page, users.alphaOwner);
  await page.goto(betaTemplateUrl);
  await expect(page).toHaveURL(/\/clinic\/templates$/);
  await expect(page.getByText("Beta Template One")).toHaveCount(0);
});

test("duplicate template name shows friendly error", async ({ page }) => {
  await login(page, users.alphaAdmin);
  await page.goto("/clinic/templates/new");
  await page.getByLabel("Şablon adı").fill("Alpha Template One");
  await page.getByLabel("Bağlı işlem").selectOption({ label: "Alpha Procedure One" });
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page.getByText("Bu işlem için aynı isimde bir şablon zaten var.")).toBeVisible();
});

test("draft without day/task cannot be published", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template Invalid ${uniqueSuffix()}`);
  await page.getByRole("button", { name: "Yayına al" }).click();
  await expect(page.getByText("Yayına almak için en az bir gün gerekir.")).toBeVisible();
});

test("draft state persists after session reload", async ({ page }) => {
  await login(page, users.alphaOwner);
  await createTemplate(page, `Synthetic Template Reload ${uniqueSuffix()}`);
  await addDraftContent(page);
  await page.reload();
  await expect(page.getByText("Temsili takip günü")).toBeVisible();
  await expect(page.getByText("Klinik tarafından yapılandırılmış temsili günlük görev")).toBeVisible();
});
