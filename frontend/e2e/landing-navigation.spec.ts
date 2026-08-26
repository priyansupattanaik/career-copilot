import { test, expect } from "@playwright/test";

test.describe("Landing navigation", () => {
  test("mobile menu anchor link scrolls to the practice section", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: /Open navigation/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Video practice" }).click();
    await expect(dialog).toHaveCount(0);

    await page.waitForTimeout(1200);

    const state = await page.evaluate(() => {
      const rect = document.querySelector("#practice")!.getBoundingClientRect();
      return {
        hash: window.location.hash,
        scrollY: window.scrollY,
        targetDocTop: rect.top + window.scrollY,
        focusedId: document.activeElement?.id ?? "",
      };
    });

    expect(state.hash).toBe("#practice");
    expect(state.focusedId).toBe("practice");
    expect(
      Math.abs(state.scrollY - state.targetDocTop),
      "viewport should rest at the #practice section",
    ).toBeLessThan(120);
  });

  test("header stays pinned to the top while scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
    await page.waitForTimeout(200);

    const navTop = await page.evaluate(
      () => document.querySelector(".home-nav")!.getBoundingClientRect().top,
    );
    expect(Math.abs(navTop), "sticky header must remain at viewport top").toBeLessThan(2);
  });
});
