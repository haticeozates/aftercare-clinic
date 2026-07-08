import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import crypto from "node:crypto";

const password = process.env.E2E_LOCAL_TEST_PASSWORD ?? "local-test-password";

const ids = {
  alphaOrg: "00000000-0000-4000-8000-0000000000a1",
  betaOrg: "00000000-0000-4000-8000-0000000000b1",
  alphaClient: "00000000-0000-4000-8000-00000000c101",
  alphaStaff: "00000000-0000-4000-8000-00000000a103"
};

async function connect() {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  });
  await client.connect();
  return client;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/clinic$/);
}

test.describe("Phase 8.3B - Clinic Data Request Review", () => {
  test("admin assigns staff and sees event history; staff cannot manage", async ({ page }) => {
    const requestId = crypto.randomUUID();
    const db = await connect();
    try {
      await db.query(
        `insert into public.data_requests (
          id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
        ) values ($1, $2, $3, null, 'access', 'submitted', 'clinic', now())`,
        [requestId, ids.alphaOrg, ids.alphaClient]
      );
    } finally {
      await db.end();
    }

    await login(page, "alpha-admin@example.test");
    await page.goto("/clinic/data-requests");
    await expect(page.getByRole("heading", { name: "Veri talebi kayıtları" })).toBeVisible();
    await page.getByLabel("Sorumlu personel").first().selectOption({ label: "Alpha Staff" });
    await page.getByRole("button", { name: "Personel ata" }).first().click();
    await page.reload();
    await expect(page.getByText("Sorumlu:")).toBeVisible();
    await expect(page.getByText("Personel atandı")).toBeVisible();

    const dbAfterAssign = await connect();
    try {
      const statusResult = await dbAfterAssign.query<{ status: string }>(
        "select status from public.data_requests where id = $1",
        [requestId]
      );
      expect(statusResult.rows[0]?.status).toBe("submitted");
    } finally {
      await dbAfterAssign.end();
    }

    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await login(page, "alpha-staff@example.test");
    await page.goto("/clinic/data-requests");
    await expect(page.getByRole("heading", { name: "Veri talebi kayıtları" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Personel ata" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Durumu güncelle" })).toHaveCount(0);
  });

  test("terminal transitions store distinct resolution codes", async ({ page }) => {
    const declinedId = crypto.randomUUID();
    const cancelledId = crypto.randomUUID();
    const db = await connect();
    try {
      await db.query(
        `insert into public.data_requests (
          id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
        ) values
          ($1, $2, $3, null, 'correction', 'under_review', 'clinic', now()),
          ($4, $2, $3, null, 'deletion', 'submitted', 'clinic', now())`,
        [declinedId, ids.alphaOrg, ids.alphaClient, cancelledId]
      );
    } finally {
      await db.end();
    }

    await login(page, "alpha-owner@example.test");
    await page.goto("/clinic/data-requests");

    const declinedCard = page.locator(`article:has(input[name="dataRequestId"][value="${declinedId}"])`);
    await declinedCard.getByLabel("Yeni durum").selectOption({ label: "Reddedildi" });
    await declinedCard.getByRole("button", { name: "Durumu güncelle" }).click();
    await page.reload();
    await expect(page.getByText("manual_review_declined")).toBeVisible();

    const cancelledCard = page.locator(`article:has(input[name="dataRequestId"][value="${cancelledId}"])`);
    await cancelledCard.getByLabel("Yeni durum").selectOption({ label: "İptal edildi" });
    await cancelledCard.getByRole("button", { name: "Durumu güncelle" }).click();
    await page.reload();
    await expect(page.getByText("manual_review_cancelled")).toBeVisible();
  });
});
