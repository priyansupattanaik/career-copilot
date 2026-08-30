import { expect, test } from "@playwright/test";

test("teams page shows the Team 5 strip without a search click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teams", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "The team" })).toBeVisible();
  await expect(page.locator(".team5-member")).toHaveCount(5);
  await expect(page.getByText("Daji Adelkar")).toBeVisible();
});

test("landing navigation opens the separate teams page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-team")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "The team" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole("heading", { name: "The team" })).toBeVisible();
});
