import { test, expect } from "@playwright/test";

test.describe("Theme visibility", () => {
  test("profile file picker keeps text readable in both themes", async ({ page, context }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await context.addCookies([
      { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
    ]);
    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Candidate profile" })).toBeVisible();

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.setAttribute("data-theme", nextTheme);
        document.documentElement.style.colorScheme = nextTheme;
      }, theme);
      await page.waitForTimeout(350);

      const contrast = await page.locator(".profile-resume-upload-control").first().evaluate((element) => {
        const control = getComputedStyle(element);
        const button = getComputedStyle(element.querySelector(".profile-resume-upload-button") as Element);
        const hint = getComputedStyle(element.querySelector(".profile-resume-upload-hint") as Element);
        return {
          controlBackground: control.backgroundColor,
          controlBorder: control.borderTopColor,
          buttonBackground: button.backgroundColor,
          buttonText: button.color,
          hintText: hint.color,
        };
      });

      expect(contrast.controlBackground).not.toBe(contrast.buttonText);
      expect(contrast.buttonBackground).not.toBe(contrast.buttonText);
      expect(contrast.hintText).not.toBe(contrast.controlBackground);
    }
  });
});
