import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([
    { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
  ]);
  await page.goto("/learning", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace")).toBeVisible();
}

test.describe("learning path", () => {
  test("builds from ATS analysis and shows watch tracking", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterDemo(page);

    await expect(page.locator(".lp-title")).toHaveText("Learning path");
    await expect(page.getByText("Choose a completed ATS analysis")).toBeVisible();
    await expect(page.getByText(/Backend Engineer/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate from ATS gaps|Open path from this ATS/ })).toBeVisible();

    await page.getByRole("link", { name: /Continue watching|Open path & track progress/ }).first().click();
    await page.waitForURL(/\/learning\/demo-path-1/);
    await expect(page.getByText("Recommended resources (videos + articles)")).toBeVisible();
    await expect(page.getByText("Watched time (unique)")).toBeVisible();
    await expect(page.getByText(/Progress counts only the parts you actually play/)).toBeVisible();

    const fonts = await page.evaluate(() => {
      const nodes = [document.body, ...Array.from(document.querySelectorAll("h1, h2, .lp-kicker, .lp-step-title"))];
      return Array.from(new Set(nodes.map((node) => getComputedStyle(node).fontFamily.toLowerCase())));
    });
    for (const family of fonts) {
      expect(family).toMatch(/outfit/i);
    }
  });
});
