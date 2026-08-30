import { expect, test } from "@playwright/test";

test("community search finds a person by full name and opens only their public profile", async ({ page }) => {
  await page.route("**/public/profiles/search**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("q")).toBe("Ada Lovelace");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ username: "ada-lovelace", full_name: "Ada Lovelace", current_role: "AI engineer", career_level: "Experienced" }]) });
  });
  await page.goto("/");
  await page.context().addCookies([{ name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin }]);
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Find people worth learning from" })).toBeVisible();
  await page.getByLabel("Search community profiles").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Search profiles" }).click();
  const result = page.getByRole("link", { name: /Ada Lovelace/ });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", "/ada-lovelace");
  await expect(result).not.toContainText("resume");
});
