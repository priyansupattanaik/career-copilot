import { test, expect } from "@playwright/test";

test.describe("App Navigation & Routing", () => {
  test("loads landing page successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("redirects /resume-studio to /resume-analysis", async ({ page }) => {
    await page.goto("/resume-studio");
    await expect(page).toHaveURL(/\/resume-analysis/);
  });
});
