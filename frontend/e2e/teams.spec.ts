import { expect, test } from "@playwright/test";

test("teams page shows the Team 5 strip without a search click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teams", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "The team" })).toBeVisible();
  await expect(page.locator(".team5-member")).toHaveCount(5);
  await expect(page.getByText("Daji Adelkar")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the team page" }),
  ).toHaveCount(0);
});

test("landing team section links to the teams page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const openTeam = page.getByRole("link", { name: "Open the team page" });
  await openTeam.scrollIntoViewIfNeeded();
  await expect(openTeam).toBeVisible();
  await openTeam.click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole("heading", { name: "The team" })).toBeVisible();
});
