import { test, expect } from "@playwright/test";

test.describe("Settings Card Layout and Padding", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "career_copilot_demo",
        value: "1",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
  });

  test("settings account cards have proper padding and text does not collide with borders", async ({
    page,
  }) => {
    await page.goto("/settings/account");
    await expect(page.locator(".settings-page")).toBeVisible();

    const cards = page.locator(".settings-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const padding = await card.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          top: parseFloat(computed.paddingTop),
          right: parseFloat(computed.paddingRight),
          bottom: parseFloat(computed.paddingBottom),
          left: parseFloat(computed.paddingLeft),
        };
      });

      // Cards must have generous internal padding (>= 20px)
      expect(padding.top).toBeGreaterThanOrEqual(20);
      expect(padding.bottom).toBeGreaterThanOrEqual(20);
      expect(padding.left).toBeGreaterThanOrEqual(20);
      expect(padding.right).toBeGreaterThanOrEqual(20);

      // Verify first child element has margin-top <= 0 so it doesn't push into or cross the border
      const firstChildMarginTop = await card.evaluate((el) => {
        const first = el.firstElementChild;
        if (!first) return 0;
        return parseFloat(window.getComputedStyle(first).marginTop);
      });
      expect(firstChildMarginTop).toBeLessThanOrEqual(0);
    }
  });

  test("settings preferences cards have proper padding", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.locator(".settings-page")).toBeVisible();

    const cards = page.locator(".settings-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const padding = await card.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          top: parseFloat(computed.paddingTop),
          left: parseFloat(computed.paddingLeft),
        };
      });
      expect(padding.top).toBeGreaterThanOrEqual(20);
      expect(padding.left).toBeGreaterThanOrEqual(20);
    }
  });

  test("settings privacy cards have proper padding", async ({ page }) => {
    await page.goto("/settings/privacy");
    await expect(page.locator(".settings-page")).toBeVisible();

    const cards = page.locator(".settings-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const padding = await card.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          top: parseFloat(computed.paddingTop),
          left: parseFloat(computed.paddingLeft),
        };
      });
      expect(padding.top).toBeGreaterThanOrEqual(20);
      expect(padding.left).toBeGreaterThanOrEqual(20);
    }
  });
});
