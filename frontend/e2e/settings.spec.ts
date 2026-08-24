import { expect, test } from "@playwright/test";

test.describe("settings visual system", () => {
  test("does not render a hard shadow behind the settings navigation", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.context().addCookies([
        { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
      ]);
      await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Account & access" })).toBeVisible();

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((nextTheme) => {
          document.documentElement.setAttribute("data-theme", nextTheme);
          document.documentElement.style.colorScheme = nextTheme;
        }, theme);

        const visual = await page.locator(".settings-nav").evaluate((element) => {
          const nav = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            boxShadow: style.boxShadow,
            right: nav.right,
            viewport: document.documentElement.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
          };
        });

        expect(visual.boxShadow).toBe("none");
        expect(visual.right).toBeLessThanOrEqual(visual.viewport);
        expect(visual.pageWidth).toBeLessThanOrEqual(visual.viewport);
        await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Delete account" })).toBeVisible();
      }
    }
  });
});
