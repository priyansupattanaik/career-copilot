import { test, expect } from "@playwright/test";
import { setupResumeStudioRoutes } from "./fixtures/mock-session";
import { ResumeStudioPage } from "./pages/resume-studio.page";

test.describe("Challenger M2-2: Adversarial Stress Testing of Swiss Template & Preview", () => {
  let studioPage: ResumeStudioPage;

  test.beforeEach(async ({ page }) => {
    await setupResumeStudioRoutes(page);
    studioPage = new ResumeStudioPage(page);
  });

  test("ADV-SWISS-01: Candidate Name Word Wrap & Physical Margins Boundary", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    const nameInput = page.locator(".rs-field:has-text('Full Name') input, input[placeholder*='Alex Morgan']").first();
    await expect(nameInput).toBeVisible();

    // 1. Extreme unbroken string (80 characters)
    const unbrokenLongName = "AlexanderMaximillianBartholomewMontgomeryVanderbiltTheThird1234567890ExtraLongName";
    await nameInput.fill(unbrokenLongName);

    // Verify preview renders the updated text
    await expect(studioPage.previewName).toBeVisible();
    await expect(studioPage.previewName).toContainText(unbrokenLongName);

    // Verify CSS word-break & overflow-wrap properties
    const wordBreak = await studioPage.previewName.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        wordBreak: s.wordBreak,
        overflowWrap: s.overflowWrap,
      };
    });
    expect(["break-word", "break-all"]).toContain(wordBreak.wordBreak);
    expect(["break-word", "anywhere"]).toContain(wordBreak.overflowWrap);

    // Verify candidate name does not overflow horizontal bounds of .rs-page-inner
    const bounds = await page.evaluate(() => {
      const nameEl = document.querySelector(".rs-name") as HTMLElement;
      const innerEl = document.querySelector(".rs-page-inner") as HTMLElement;
      return {
        nameScrollWidth: nameEl.scrollWidth,
        nameClientWidth: nameEl.clientWidth,
        innerClientWidth: innerEl.clientWidth,
      };
    });
    // Name width must not exceed inner page width
    expect(bounds.nameScrollWidth).toBeLessThanOrEqual(bounds.innerClientWidth + 2);
  });

  test("ADV-SWISS-02: Missing Contact Info Separators & Ghost Bullets Elimination", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    const emailInput = page.locator(".rs-field:has-text('Email') input").first();
    const phoneInput = page.locator(".rs-field:has-text('Phone') input").first();
    const locationInput = page.locator(".rs-field:has-text('Location') input").first();

    // 1. Test single contact field (email only)
    await emailInput.fill("ada@analytical-engine.org");
    await phoneInput.fill("");
    await locationInput.fill("");

    const contactLine = studioPage.previewFlow.locator(".rs-contact:not(.rs-urls)").first();
    await expect(contactLine).toBeVisible();
    const emailOnlyText = (await contactLine.textContent()) || "";
    expect(emailOnlyText.trim()).toBe("ada@analytical-engine.org");
    expect(emailOnlyText).not.toContain("·");

    // 2. Test two contact fields (email + location, phone empty)
    await locationInput.fill("London, UK");
    const twoFieldsText = (await contactLine.textContent()) || "";
    expect(twoFieldsText).toBe("ada@analytical-engine.org · London, UK");
    expect(twoFieldsText).not.toContain("··");
    expect(twoFieldsText).not.toContain("·  ·");

    // 3. Test whitespace-only in phone (ghost bullet attack)
    await phoneInput.fill("     ");
    const whitespacePhoneText = (await contactLine.textContent()) || "";
    expect(whitespacePhoneText).toBe("ada@analytical-engine.org · London, UK");
    expect(whitespacePhoneText).not.toContain("··");

    // 4. Test contact row omission when contact fields are blank
    await emailInput.fill("");
    await phoneInput.fill("");
    await locationInput.fill("");
    const contactOnlyLines = studioPage.previewFlow.locator(".rs-contact:not(.rs-urls)");
    expect(await contactOnlyLines.count()).toBe(0);
  });

  test("ADV-SWISS-03: Non-Destructive Template Switching Round-Trip", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    // 1. Ensure initial template is Swiss
    await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);

    // 2. Edit candidate personal name
    const nameInput = page.locator(".rs-field:has-text('Full Name') input").first();
    await nameInput.fill("Dr. Grace Brewster Murray Hopper");
    await expect(studioPage.previewName).toContainText("Grace Brewster Murray Hopper");

    // 3. Switch template to Modern via Format tab
    const formatTab = page.locator('.rs-left-tabs button[title*="Format" i], .rs-left-tabs button:has-text("Format")').first();
    await formatTab.click();

    // Custom select trigger for Template Style
    const templateTrigger = page.locator('button.cc-select-trigger[aria-label*="Template Style" i]');
    await templateTrigger.click();
    await page.locator('.cc-select-menu .cc-select-option:has-text("Modern")').click();
    await expect(studioPage.previewFlow).toHaveClass(/rs-template-modern/);
    await expect(studioPage.previewFlow).toContainText("Grace Brewster Murray Hopper");

    // 4. Switch template to Classic
    await templateTrigger.click();
    await page.locator('.cc-select-menu .cc-select-option:has-text("Classic")').click();
    await expect(studioPage.previewFlow).toHaveClass(/rs-template-classic/);
    await expect(studioPage.previewFlow).toContainText("Grace Brewster Murray Hopper");

    // 5. Switch template back to Swiss
    await templateTrigger.click();
    await page.locator('.cc-select-menu .cc-select-option:has-text("Swiss")').click();
    await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);
    await expect(studioPage.previewName).toContainText("Grace Brewster Murray Hopper");
    await expect(studioPage.previewFlow).toContainText("Grace Brewster Murray Hopper");
  });

  test("ADV-SWISS-04: Zoom Scaling Boundaries and Sheet Alignment", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    const zoomLabel = page.locator(".rs-zoom-label");
    const zoomInBtn = page.locator('button.rs-tool-btn[title*="Zoom in" i], button.rs-tool-btn[aria-label*="Zoom in" i]');
    const zoomOutBtn = page.locator('button.rs-tool-btn[title*="Zoom out" i], button.rs-tool-btn[aria-label*="Zoom out" i]');
    const previewSheet = page.locator(".rs-preview-sheet");

    // 1. Zoom in repeatedly until 200% max
    for (let i = 0; i < 20; i++) {
      const currentText = await zoomLabel.textContent();
      if (currentText === "200%") break;
      await zoomInBtn.click();
      await page.waitForTimeout(50);
    }
    await expect(zoomLabel).toHaveText("200%");

    // Verify transform on sheet is scale(2)
    const maxZoomTransform = await previewSheet.evaluate((el) => el.style.transform);
    expect(maxZoomTransform).toBe("scale(2)");

    // 2. Zoom out repeatedly until 25% min
    for (let i = 0; i < 25; i++) {
      const currentText = await zoomLabel.textContent();
      if (currentText === "25%") break;
      await zoomOutBtn.click();
      await page.waitForTimeout(50);
    }
    await expect(zoomLabel).toHaveText("25%");

    const minZoomTransform = await previewSheet.evaluate((el) => el.style.transform);
    expect(minZoomTransform).toBe("scale(0.25)");

    // 3. Test Fit Width mode
    const fitWidthBtn = page.locator('button.rs-mode-btn:has-text("Fit Width")');
    await fitWidthBtn.click();
    await expect(zoomLabel).not.toHaveText("25%");
    const fitWidthPercent = await zoomLabel.textContent();
    const zoomVal = parseInt(fitWidthPercent || "0", 10);
    expect(zoomVal).toBeGreaterThanOrEqual(28);
    expect(zoomVal).toBeLessThanOrEqual(125);

    // 4. Test Fit Page mode
    const fitPageBtn = page.locator('button.rs-mode-btn:has-text("Fit Page")');
    await fitPageBtn.click();
    await page.waitForTimeout(100);
    const fitPagePercent = await zoomLabel.textContent();
    const pageZoomVal = parseInt(fitPagePercent || "0", 10);
    expect(pageZoomVal).toBeGreaterThanOrEqual(28);
    expect(pageZoomVal).toBeLessThanOrEqual(125);
  });

  test("ADV-SWISS-05: Dark Mode Theme Contrast & Razor-Sharp Borders", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    // Set dark theme
    await studioPage.setTheme("dark");
    await expect(studioPage.htmlRoot).toHaveAttribute("data-theme", "dark");
    await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);

    // Inspect styles
    const contrastData = await page.evaluate(() => {
      const stage = document.querySelector(".rs-stage") as HTMLElement;
      const sheet = document.querySelector(".rs-page") as HTMLElement;
      const flow = document.querySelector(".rs-template-swiss") as HTMLElement;
      const heading = document.querySelector(".rs-heading") as HTMLElement;
      const name = document.querySelector(".rs-name") as HTMLElement;

      const stageStyle = window.getComputedStyle(stage);
      const sheetStyle = window.getComputedStyle(sheet);
      const headingStyle = window.getComputedStyle(heading);
      const nameStyle = window.getComputedStyle(name);

      return {
        stageBg: stageStyle.backgroundColor,
        sheetBg: sheetStyle.backgroundColor,
        nameColor: nameStyle.color,
        headingColor: headingStyle.color,
        headingBorderTop: headingStyle.borderTopColor,
        headingBorderBottom: headingStyle.borderBottomColor,
        swissBorderVar: window.getComputedStyle(flow).getPropertyValue("--swiss-border").trim(),
      };
    });

    // Verify paper sheet stays white and high contrast
    expect(contrastData.sheetBg).toBe("rgb(255, 255, 255)");
    // Verify dark stage background
    expect(contrastData.stageBg).toBe("rgb(8, 14, 24)");
    // Verify Swiss border token in dark mode is #0f172a (rgb(15, 23, 42))
    expect(["#0f172a", "rgb(15, 23, 42)"]).toContain(contrastData.swissBorderVar);
    // Heading border uses the sharp contrast border
    expect(contrastData.headingBorderBottom).toBe("rgb(15, 23, 42)");
    // Heading text uses black
    expect(contrastData.headingColor).toBe("rgb(0, 0, 0)");
  });
});
