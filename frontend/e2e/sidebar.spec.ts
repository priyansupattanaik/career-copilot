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
  test("keeps the desktop rail aligned when collapsed and expanded", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterDemo(page);

    const expanded = await page.locator(".workspace").evaluate((element) => {
      const workspace = element as HTMLElement;
      const sidebar = workspace.querySelector(".sidebar") as HTMLElement;
      return { track: workspace.getBoundingClientRect().width - workspace.querySelector(".workspace-main")!.getBoundingClientRect().width, sidebar: sidebar.getBoundingClientRect().width };
    });
    expect(Math.abs(expanded.track - expanded.sidebar)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
    const collapsed = await page.locator(".workspace").evaluate((element) => {
      const workspace = element as HTMLElement;
      const sidebar = workspace.querySelector(".sidebar") as HTMLElement;
      return { track: workspace.getBoundingClientRect().width - workspace.querySelector(".workspace-main")!.getBoundingClientRect().width, sidebar: sidebar.getBoundingClientRect().width };
    });
    expect(Math.abs(collapsed.track - collapsed.sidebar)).toBeLessThanOrEqual(1);
    await expect(page.locator(".sidebar-link", { hasText: "Dashboard" })).toBeVisible();
  });

  test("supports explicit sidebar retraction across laptop widths", async ({ page }) => {
    for (const width of [1024, 1280, 1366]) {
      await page.setViewportSize({ width, height: 768 });
      await enterDemo(page);
      const workspace = page.locator(".workspace");
      const sidebar = page.locator(".sidebar");
      const collapse = page.getByRole("button", { name: "Collapse navigation" });
      await expect(collapse).toBeVisible();
      await expect(sidebar).not.toHaveClass(/open/);

      await collapse.click();
      await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
      await expect.poll(() => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(78);
      await expect.poll(() => workspace.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ")[0])).toMatch(/78px/);

      await page.getByRole("button", { name: "Expand navigation" }).click();
      await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
      await expect.poll(() => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(248);
    }
  });

  test("keeps collapsed brand and navigation icons inside the rail", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterDemo(page);
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await page.waitForTimeout(300);

    const geometry = await page.locator(".workspace").evaluate((element) => {
      const rail = element.querySelector(".sidebar")!.getBoundingClientRect();
      const brand = element.querySelector(".sidebar-header .brand")!.getBoundingClientRect();
      const profile = element.querySelector(".sidebar-profile-card")!.getBoundingClientRect();
      const icons = [...element.querySelectorAll<HTMLElement>(".sidebar-link-icon")].map((icon) => {
        const rect = icon.getBoundingClientRect();
        return { left: rect.left, right: rect.right, center: rect.left + rect.width / 2 };
      });
      return {
        rail: { left: rail.left, right: rail.right, center: rail.left + rail.width / 2 },
        brand: { left: brand.left, right: brand.right },
        profile: { left: profile.left, right: profile.right, center: profile.left + profile.width / 2 },
        brandShortVisible: getComputedStyle(element.querySelector(".sidebar-brand-short")!).display !== "none",
        navWidths: [...element.querySelectorAll<HTMLElement>(".sidebar-link")].map((link) => link.getBoundingClientRect().width),
        icons,
      };
    });

    expect(geometry.brandShortVisible).toBe(false);
    expect(geometry.brand.left).toBeGreaterThanOrEqual(geometry.rail.left);
    expect(geometry.brand.right).toBeLessThanOrEqual(geometry.rail.right);
    expect(geometry.brand.right - geometry.brand.left).toBeLessThanOrEqual(48);
    expect(Math.abs(geometry.profile.center - geometry.rail.center)).toBeLessThanOrEqual(1);
    expect(geometry.profile.right).toBeLessThanOrEqual(geometry.rail.right);
    for (const width of geometry.navWidths) expect(width).toBeLessThanOrEqual(48);
    for (const icon of geometry.icons) {
      expect(icon.left).toBeGreaterThanOrEqual(geometry.rail.left);
      expect(icon.right).toBeLessThanOrEqual(geometry.rail.right);
      expect(Math.abs(icon.center - geometry.rail.center)).toBeLessThanOrEqual(1);
    }
  });

  test("opens and closes as a drawer on tablet and phone widths", async ({ page }) => {
    for (const viewport of [{ width: 900, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await enterDemo(page);
      const sidebar = page.locator(".sidebar");
      await expect(sidebar).not.toHaveClass(/open/);
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(sidebar).toHaveClass(/open/);
      await expect(page.locator(".sidebar-link", { hasText: "Dashboard" })).toBeVisible();
      expect(await page.locator("body").evaluate((body) => getComputedStyle(body).overflowY)).toBe("hidden");
      await sidebar.getByRole("button", { name: "Close navigation" }).click();
      await expect(sidebar).not.toHaveClass(/open/);
      await expect.poll(() => page.locator("body").evaluate((body) => getComputedStyle(body).overflowY)).toBe("auto");
    }
  });
});
