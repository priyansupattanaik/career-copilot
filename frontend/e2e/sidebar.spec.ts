import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([
    { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
  ]);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace")).toBeVisible();
}

test.describe("workspace sidebar", () => {
  test("desktop rail is permanent: no retraction button, fixed 248px, labels visible", async ({ page }) => {
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await enterDemo(page);

      const workspace = page.locator(".workspace");
      const sidebar = page.locator(".sidebar");

      // The retraction feature is gone entirely.
      await expect(page.getByRole("button", { name: /collapse navigation/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /expand navigation/i })).toHaveCount(0);
      await expect(workspace).not.toHaveClass(/sidebar-collapsed/);

      await expect.poll(() =>
        sidebar.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { visible: rect.width > 0, width: Math.round(rect.width) };
        }),
      ).toEqual(expect.objectContaining({ visible: true, width: 248 }));

      await expect(page.locator(".sidebar-link", { hasText: "Dashboard" })).toBeVisible();
      await expect(page.locator(".sidebar-link-label", { hasText: "Recommended Jobs" })).toBeVisible();
    }
  });

  test("no hamburger or drawer machinery remains on any width", async ({ page }) => {
    for (const width of [1440, 1024, 900, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await enterDemo(page);
      await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Close navigation" })).toHaveCount(0);
      await expect(page.locator(".sidebar-backdrop")).toHaveCount(0);
      await expect(page.locator(".mobile-sidebar-button")).toHaveCount(0);
    }
  });

  test("mobile view swaps the rail for a bottom navigation bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);

    const nav = page.locator(".mobile-bottom-nav");
    await expect(nav).toBeVisible();

    const links = ["Home", "Resume", "Interview", "Learn", "Jobs", "People", "Profile"];
    for (const label of links) {
      await expect(nav.locator("a", { hasText: label })).toBeVisible();
    }

    // Rail is fully hidden on mobile.
    await expect(page.locator(".sidebar")).toBeHidden();

    // The bar must not overlap content: main leaves clearance for it.
    const gap = await page.evaluate(() => {
      const content = document.querySelector(".workspace-content") as HTMLElement;
      const nav = document.querySelector(".mobile-bottom-nav") as HTMLElement;
      return nav.getBoundingClientRect().top - content.getBoundingClientRect().bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(-2);

    // Bottom padding keeps the last content above the bar.
    const padding = await page.evaluate(
      () => getComputedStyle(document.querySelector(".workspace-content") as HTMLElement).paddingBottom,
    );
    expect(parseFloat(padding)).toBeGreaterThanOrEqual(88);
  });

  test("bottom navigation drives routes and tracks the active item", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);

    const nav = page.locator(".mobile-bottom-nav");
    await nav.locator("a", { hasText: "Learn" }).click();
    await page.waitForURL(/learning/);
    await expect(nav.locator("a.active", { hasText: "Learn" })).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();

    await nav.locator("a", { hasText: "Profile" }).click();
    await page.waitForURL(/settings\/profile/);
    await expect(nav.locator("a.active", { hasText: "Profile" })).toBeVisible();

    // Desktop counterpart: same route shows the permanent rail instead.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".sidebar-link", { hasText: "Recommended Jobs" })).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
  });
});
