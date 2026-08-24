import { expect, test } from "@playwright/test";

test.describe("candidate profile responsive layout", () => {
  test("keeps the profile canvas and every section inside the viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([
      { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
    ]);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Candidate profile" })).toBeVisible();

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((nextTheme) => {
          document.documentElement.setAttribute("data-theme", nextTheme);
          document.documentElement.style.colorScheme = nextTheme;
        }, theme);

        const geometry = await page.locator(".profile-page-body").evaluate((body) => {
        const viewportWidth = document.documentElement.clientWidth;
        const bodyRect = body.getBoundingClientRect();
        const overflowingSections = Array.from(body.children)
          .map((child) => ({
            name: child.className,
            right: Math.round(child.getBoundingClientRect().right * 100) / 100,
          }))
          .filter(({ right }) => right > viewportWidth + 1);

        return {
          bodyRight: bodyRect.right,
          viewportWidth,
          pageWidth: document.documentElement.scrollWidth,
          overflowingSections,
        };
        });

        expect(geometry.pageWidth, `page overflow at ${viewport.width}px (${theme})`).toBeLessThanOrEqual(
          geometry.viewportWidth,
        );
        expect(geometry.bodyRight, `profile canvas overflow at ${viewport.width}px (${theme})`).toBeLessThanOrEqual(
          geometry.viewportWidth + 1,
        );
        expect(geometry.overflowingSections, `profile section overflow at ${viewport.width}px (${theme})`).toEqual([]);
        await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();
      }
    }
  });

  test("uploads, applies the agent draft automatically, and hides extraction diagnostics", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([
      { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
    ]);

    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Upload PDF or DOCX").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("synthetic resume fixture"),
    });

    await expect(page.getByText("Profile fill applied.", { exact: false })).toBeVisible();
    await expect(page.getByText("Technical extraction warning that must stay hidden.")).toHaveCount(0);
    await expect(page.getByText("Demo draft — resume saved to library for reuse.")).toHaveCount(0);
  });
});
