import { expect, test, type Locator } from "@playwright/test";

const turkish = "şŞçÇğĞıİöÖüÜ";

async function expectTurkishFace(element: Locator, family: "Inter" | "Gelasio", style = "normal") {
  await expect(element).toBeVisible();
  const rendered = await element.evaluate(async (node, { family, style, turkish }) => {
    const css = getComputedStyle(node);
    const faces = await document.fonts.load(`${style} ${css.fontWeight} ${css.fontSize} "${family}"`, turkish);
    return {
      family: css.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      style: css.fontStyle,
      loaded: faces.some((face) => face.family.replace(/["']/g, "") === family
        && face.style === style && face.status === "loaded")
    };
  }, { family, style, turkish });
  expect(rendered).toEqual({ family, style, loaded: true });
}

test.use({ locale: "tr-TR", viewport: { width: 390, height: 844 } });

test("Turkish display text and login controls use the bundled faces", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  const heading = page.getByRole("heading", { level: 1 });
  await expectTurkishFace(heading, "Gelasio");
  const emphasis = heading.locator("em");
  await expectTurkishFace(emphasis, "Gelasio", "italic");
  await expectTurkishFace(page.getByRole("link", { name: "Demo talep et", exact: true }).first(), "Inter");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await emphasis.evaluate((node) => node.getClientRects().length)).toBe(1);
  await page.setViewportSize({ width: 1440, height: 960 });
  expect(await emphasis.evaluate((node) => node.getClientRects().length)).toBe(1);

  await page.goto("/login");
  await expectTurkishFace(page.getByRole("heading", { level: 1 }), "Inter");
  await expectTurkishFace(page.getByLabel("E-posta", { exact: true }), "Inter");
});
