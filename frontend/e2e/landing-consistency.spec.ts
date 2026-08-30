import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "phone-se", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "desktop-wide", width: 1440, height: 900 },
  { name: "ultrawide", width: 1920, height: 1080 },
] as const;

async function assertLandingChrome(page: Page, width: number) {
  const report = await page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='Primary']") as HTMLElement | null;
    const pill = document.querySelector(".nav5-pill") as HTMLElement | null;
    const h1 = document.querySelector("h1");
    const windowEl = document.querySelector(".home-window") as HTMLElement | null;
    const particles = document.querySelector(".home-particles") as HTMLElement | null;
    const root = document.documentElement;
    const pillStyle = pill ? getComputedStyle(pill) : null;
    const navStyle = nav ? getComputedStyle(nav) : null;
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    const parseAlpha = (color: string) => {
      const slash = color.match(/\/\s*([0-9.]+%?)\s*\)/);
      if (slash) {
        const raw = slash[1];
        return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
      }
      const rgba = color.match(/rgba?\(([^)]+)\)/);
      if (!rgba) return 1;
      const parts = rgba[1].split(",").map((p) => p.trim());
      if (parts.length === 4) return Number(parts[3]);
      return 1;
    };
    return {
      navTop: nav ? nav.getBoundingClientRect().top : 999,
      pillBlur: pillStyle?.backdropFilter || "",
      pillBg: pillStyle?.backgroundColor || "",
      pillAlpha: pillStyle ? parseAlpha(pillStyle.backgroundColor) : 1,
      navFont: navStyle?.fontFamily || "",
      h1Font: h1Style?.fontFamily || "",
      bodyFont: getComputedStyle(document.body).fontFamily,
      overflowX,
      windowAnim: windowEl ? getComputedStyle(windowEl).animationName : "",
      particlesPointer: particles ? getComputedStyle(particles).pointerEvents : "",
      paper: getComputedStyle(root).getPropertyValue("--background").trim(),
      text: getComputedStyle(root).getPropertyValue("--text").trim(),
    };
  });

  expect(report.overflowX, "page must not overflow horizontally").toBeLessThanOrEqual(2);
  expect(report.navTop, "nav stays near the top").toBeLessThan(32);
  expect(report.pillBlur.toLowerCase(), "nav pill must use backdrop blur").toMatch(/blur\(/);
  expect(report.pillAlpha, "nav pill must be see-through").toBeLessThan(0.85);
  const family = (value: string) => value.split(",")[0]?.replace(/['"]/g, "").trim().toLowerCase();
  expect(family(report.navFont)).toBe(family(report.bodyFont));
  expect(family(report.h1Font)).toBe(family(report.bodyFont));
  expect(report.bodyFont.toLowerCase()).not.toMatch(/satoshi/);
  expect(report.bodyFont.toLowerCase()).toMatch(/outfit|system-ui|segoe ui/);
  expect(report.paper.toLowerCase()).toMatch(/#f5faff|245, 250, 255/);
  expect(report.windowAnim).toMatch(/cc-window-breathe/);
  expect(report.particlesPointer).toBe("none");

  if (width < 1280) {
    await expect(page.getByRole("button", { name: /Open navigation/i })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Practice" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Team" }).first()).toBeVisible();
  }
}

test.describe("Landing consistency loop", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready).catch(() => undefined);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Show up\s*ready/i);
      await expect(page.locator(".home-team")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "The team" })).toHaveCount(0);
      await assertLandingChrome(page, viewport.width);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await expect(page.getByRole("heading", { name: /Start with/i })).toBeVisible();
      const overflowAfterScroll = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflowAfterScroll).toBeLessThanOrEqual(2);
    });
  }

  test("teams page shares nav glass and type", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "The team" })).toBeVisible();
    const chrome = await page.evaluate(() => {
      const pill = document.querySelector(".nav5-pill") as HTMLElement | null;
      const style = pill ? getComputedStyle(pill) : null;
      return {
        blur: style?.backdropFilter || "",
        font: getComputedStyle(document.body).fontFamily,
      };
    });
    expect(chrome.blur.toLowerCase()).toMatch(/blur\(/);
    expect(chrome.font.toLowerCase()).toMatch(/outfit/);
    await page.getByRole("link", { name: "Practice" }).first().click();
    await expect(page).toHaveURL(/\/#practice/);
  });
});
