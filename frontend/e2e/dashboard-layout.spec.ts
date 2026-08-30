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

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function assertNoIntersect(page: Page, selectors: string[]) {
  const boxes = await page.evaluate((list) => {
    return list.map((selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { selector, x: r.x, y: r.y, w: r.width, h: r.height };
    });
  }, selectors);
  const visible = boxes.filter(
    (box): box is { selector: string; x: number; y: number; w: number; h: number } =>
      Boolean(box && box.w > 1 && box.h > 1),
  );
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i];
      const b = visible[j];
      const overlap =
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(overlap, `${a.selector} overlaps ${b.selector}`).toBe(false);
    }
  }
}

async function collectFonts(page: Page) {
  return page.evaluate(() => {
    const nodes = [document.body, ...Array.from(document.querySelectorAll("h1, h2, h3, .eyebrow, .mono, .metric-value"))];
    return Array.from(
      new Set(
        nodes.map((node) => getComputedStyle(node).fontFamily.toLowerCase()),
      ),
    );
  });
}

test.describe("dashboard layout", () => {
  test("desktop charts, Outfit-only type, and no overlapping panels", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterDemo(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Welcome/i);
    await expect(page.locator(".dashboard-metrics .metric-card")).toHaveCount(4);
    await expect(page.locator(".dash-pie").first()).toBeVisible();
    await expect(page.locator(".trend-chart")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skill mix" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workspace mix" })).toBeVisible();
    const navIcon = page.locator(".sidebar .career-icon").first();
    await expect(navIcon).toBeVisible();
    await page.waitForTimeout(500);
    const firstTop = await navIcon.evaluate((element) => element.getBoundingClientRect().top);
    await page.waitForTimeout(800);
    const secondTop = await navIcon.evaluate((element) => element.getBoundingClientRect().top);
    expect(firstTop).toBeGreaterThan(0);
    expect(secondTop).toBeGreaterThan(0);
    await expect(page.locator(".profile-toast")).toHaveCount(0);
    await page.waitForTimeout(1200);

    const fonts = await collectFonts(page);
    for (const family of fonts) {
      expect(family).toMatch(/outfit/i);
      expect(family).not.toMatch(/inter|fraunces|ibm plex|satoshi/i);
    }

    await assertNoOverflow(page);
    await assertNoIntersect(page, [
      ".page-heading h1",
      ".page-heading-actions",
      ".dashboard-metrics",
      ".interview-progress-panel",
      ".dash-pie-card",
      ".dashboard-main",
      ".activity-feed",
      ".sidebar",
    ]);
    await assertNoIntersect(page, [
      ".interview-progress-chart-col",
      ".interview-progress-side",
    ]);
    await assertNoIntersect(page, [
      ".dashboard-metrics .metric-card:nth-child(1)",
      ".dashboard-metrics .metric-card:nth-child(2)",
      ".dashboard-metrics .metric-card:nth-child(3)",
      ".dashboard-metrics .metric-card:nth-child(4)",
    ]);

    await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
  });

  test("tablet and phone keep gaps, pie charts, and no overlap", async ({ page }) => {
    await enterDemo(page);

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      await expect(page.locator(".dash-pie").first()).toBeVisible();
      await assertNoOverflow(page);
      await assertNoIntersect(page, [
        ".page-heading h1",
        ".dashboard-metrics",
        ".interview-progress-panel",
        ".activity-feed",
      ]);
      await page.screenshot({
        path: `test-results/dashboard-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });

  test("workspace pages share Outfit and do not collide headings with actions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterDemo(page);

    const routes = ["/jobs", "/learning", "/resume-analysis", "/mock-interview", "/settings/profile"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".workspace")).toBeVisible();
      const fonts = await collectFonts(page);
      for (const family of fonts) {
        expect(family, route).toMatch(/outfit/i);
        expect(family, route).not.toMatch(/inter|fraunces|ibm plex|satoshi/i);
      }
      await assertNoOverflow(page);
      if ((await page.locator(".page-heading h1").count()) && (await page.locator(".page-heading-actions").count())) {
        await assertNoIntersect(page, [".page-heading h1", ".page-heading-actions"]);
      }
    }
  });
});
