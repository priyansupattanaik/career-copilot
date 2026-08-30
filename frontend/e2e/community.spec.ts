import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openCommunity(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin }]);
  await page.goto("/community", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Find people worth learning from" })).toBeVisible();
}

test("community shows no profiles until the user searches", async ({ page }) => {
  await openCommunity(page);
  await expect(page.getByText("Search by a real username or career term to discover public profiles.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ada Lovelace/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Grace Hopper/ })).toHaveCount(0);
});

test("community finds a person as you type without clicking search", async ({ page }) => {
  await openCommunity(page);
  await page.getByLabel("Search community profiles").fill("Ada Lovelace");
  const result = page.getByRole("link", { name: /Ada Lovelace/ });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", "/ada-lovelace");
  await expect(result).not.toContainText("resume");
  await expect(page.getByRole("link", { name: /Grace Hopper/ })).toHaveCount(0);
  await result.click();
  await expect(page).toHaveURL(/\/ada-lovelace$/);
  await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
});

test("community search matches @username without listing the directory", async ({ page }) => {
  await openCommunity(page);
  await expect(page.getByRole("link", { name: /Ada Lovelace/ })).toHaveCount(0);
  await page.getByLabel("Search community profiles").fill("@ada-lovelace");
  await expect(page.getByRole("link", { name: /Ada Lovelace/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Grace Hopper/ })).toHaveCount(0);
});
