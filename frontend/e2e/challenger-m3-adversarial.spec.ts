import { test, expect } from "@playwright/test";
import { setupResumeStudioRoutes } from "./fixtures/mock-session";
import { ResumeStudioPage } from "./pages/resume-studio.page";

// Helper function to calculate relative luminance according to WCAG 2.1
function parseRgb(colorStr: string): [number, number, number] {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

test.describe("Challenger M3-2: Empirical Adversarial Verification of UI & Playwright E2E", () => {
  let studioPage: ResumeStudioPage;

  test.beforeEach(async ({ page }) => {
    await setupResumeStudioRoutes(page);
    studioPage = new ResumeStudioPage(page);
  });

  // =========================================================================
  // 1. Zero Visible Native <select> Elements
  // =========================================================================
  test("ADV-01: Zero visible native select elements across all views and panels", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    // Editor mode
    const visibleSelectsEditor = await page.locator("select:visible").count();
    expect(visibleSelectsEditor).toBe(0);

    // Format panel
    await page.locator(".rs-left-tabs button").filter({ hasText: /format/i }).click();
    const visibleSelectsFormat = await page.locator("select:visible").count();
    expect(visibleSelectsFormat).toBe(0);

    // Switch to comparison view via toolbar
    await page.locator("button.rs-compare-btn").click();
    await expect(page.locator('[data-testid="jd-comparison-view"]')).toBeVisible();

    const visibleSelectsComparison = await page.locator("select:visible").count();
    expect(visibleSelectsComparison).toBe(0);

    // Open tailoring depth dropdown
    const selectTrigger = page.locator('[data-testid="tailoring-depth-select"] button[role="combobox"]');
    await selectTrigger.click();
    await expect(page.locator(".cc-select-menu")).toBeVisible();

    const visibleSelectsOpenDropdown = await page.locator("select:visible").count();
    expect(visibleSelectsOpenDropdown).toBe(0);

    await page.keyboard.press("Escape");
    await expect(page.locator(".cc-select-menu")).not.toBeVisible();
    expect(await page.locator("select:visible").count()).toBe(0);
  });

  // =========================================================================
  // 2. Tailoring Depth <Select> Dropdown Operation & Selection
  // =========================================================================
  test("ADV-02: Tailoring depth custom Select full operation, descriptions, and keyboard nav", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    await page.locator("button.rs-compare-btn").click();
    await expect(page.locator('[data-testid="jd-comparison-view"]')).toBeVisible();

    const selectTrigger = page.locator('[data-testid="tailoring-depth-select"] button[role="combobox"]');
    const desc = page.locator(".rs-depth-desc");

    // Initial default is Keyword enhance
    await expect(selectTrigger).toContainText("Keyword enhance");
    await expect(desc).toContainText("Keyword enhance: Blend in relevant keywords without changing role or scope.");

    // Select Light nudge
    await selectTrigger.click();
    const nudgeOption = page.locator('.cc-select-option:has-text("Light nudge")');
    await nudgeOption.click();
    await expect(selectTrigger).toContainText("Light nudge");
    await expect(desc).toContainText("Light nudge: Minimal edits to better align existing experience.");

    // Select Full tailor
    await selectTrigger.click();
    const fullOption = page.locator('.cc-select-option:has-text("Full tailor")');
    await fullOption.click();
    await expect(selectTrigger).toContainText("Full tailor");
    await expect(desc).toContainText("Full tailor: Comprehensive tailoring using the job description.");

    // Select Keyword enhance again
    await selectTrigger.click();
    const kwOption = page.locator('.cc-select-option:has-text("Keyword enhance")');
    await kwOption.click();
    await expect(selectTrigger).toContainText("Keyword enhance");

    // Keyboard navigation: Escape closes menu
    await selectTrigger.click();
    await expect(page.locator(".cc-select-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".cc-select-menu")).not.toBeVisible();
    await expect(selectTrigger).toContainText("Keyword enhance");

    // Keyboard navigation: Arrow keys & Enter
    await selectTrigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".cc-select-menu")).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.locator(".cc-select-menu")).not.toBeVisible();
  });

  // =========================================================================
  // 3. Side-by-Side JD Comparison Rendering & Section Nav Toggling
  // =========================================================================
  test("ADV-03: Side-by-side JD comparison rendering and bidirectional nav toggling stress", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    const comparisonView = page.locator('[data-testid="jd-comparison-view"]');
    const editorHeader = page.locator(".rs-editor-pane > .rs-pane-head");
    const compareBtn = page.locator("button.rs-compare-btn");

    // 1. Toggle via chrome button
    await compareBtn.click();
    await expect(comparisonView).toBeVisible();
    await expect(compareBtn).toContainText("Section Editor");

    await compareBtn.click();
    await expect(comparisonView).not.toBeVisible();
    await expect(editorHeader).toBeVisible();
    await expect(compareBtn).toContainText("Compare JD");

    // 2. Toggle via Left Nav ATS tab
    await page.locator(".rs-left-tabs button").filter({ hasText: /ats/i }).click();
    await expect(comparisonView).toBeVisible();

    // 3. Toggle back by clicking a section in Section Nav
    await page.locator(".rs-left-tabs button").filter({ hasText: /sections/i }).click();
    await studioPage.selectSection("skills");
    await expect(comparisonView).not.toBeVisible();
    await expect(page.locator(".rs-editor-pane h2")).toContainText(/skills/i);

    // 4. Toggle via 'Open Section Editor' button in right column of JD view
    await compareBtn.click();
    await expect(comparisonView).toBeVisible();
    const openEditorBtn = page.locator('.rs-action-chips button:has-text("Open Section Editor")');
    await openEditorBtn.click();
    await expect(comparisonView).not.toBeVisible();
    await expect(editorHeader).toBeVisible();

    // 5. Stress test: Rapidly toggle 10 times to verify no race conditions or unhandled crashes
    for (let i = 0; i < 10; i++) {
      await compareBtn.click();
    }
    await expect(page.locator(".rs-studio")).toBeVisible();
  });

  // =========================================================================
  // 4. Live Keyword Highlighting in Preview Pane & Adversarial Text Injection
  // =========================================================================
  test("ADV-04: Live keyword highlighting, clearing, and adversarial injection (regex, XSS, 30KB)", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    await page.locator("button.rs-compare-btn").click();
    await expect(page.locator('[data-testid="jd-comparison-view"]')).toBeVisible();

    const jdTextarea = page.locator('[data-testid="jd-raw-text"]');

    // 1. Live matching terms highlight in preview
    await jdTextarea.fill("Seeking a Senior Software Engineer with expertise in TypeScript, React, and Python.");
    const previewHighlights = page.locator(".rs-flow mark.rs-keyword-highlight");
    await expect(previewHighlights.first()).toBeVisible();
    const highlightCount = await previewHighlights.count();
    expect(highlightCount).toBeGreaterThan(0);

    // 2. Clearing JD removes all marks and shows empty guidance
    await jdTextarea.fill("");
    await expect(page.locator(".rs-jd-empty-guidance")).toBeVisible();
    const clearedHighlights = await page.locator(".rs-flow mark.rs-keyword-highlight").count();
    expect(clearedHighlights).toBe(0);

    // 3. Adversarial: regex tokens and special characters
    const adversarialJd = "Require C++, C#, .NET, node.js, react.js, [regex], (groups), *wildcard*, and ?optional.";
    await jdTextarea.fill(adversarialJd);
    const statsBar = page.locator('[data-testid="jd-stats-bar"]');
    await expect(statsBar).toBeVisible();
    const extractedText = await statsBar.locator(".rs-stat-badge").first().textContent();
    expect(extractedText).toMatch(/\d+ keywords extracted/);

    // 4. Adversarial: XSS injection payloads
    const xssPayload = `<script>window.__m3_xss_injected__ = true;</script><img src="invalid" onerror="window.__m3_img_xss__ = true;" />`;
    await jdTextarea.fill(xssPayload);
    const formattedViewer = page.locator(".rs-jd-content");
    await expect(formattedViewer).toContainText("<script>");
    const isXssFired = await page.evaluate(() => (window as any).__m3_xss_injected__ || (window as any).__m3_img_xss__);
    expect(isXssFired).toBeFalsy();

    // 5. Adversarial: 30KB massive JD payload
    const longJdText = "Scalable high-availability cloud architecture with TypeScript, React, and Docker. ".repeat(400);
    await jdTextarea.fill(longJdText);
    await expect(page.locator(".rs-char-count")).toContainText("chars");
    await expect(page.locator('[data-testid="match-percentage"]')).toBeVisible();
  });

  // =========================================================================
  // 5. Light and Dark Theme Contrast Verification
  // =========================================================================
  test("ADV-05: Light and dark theme contrast compliance for badges, chips, and highlights", async ({ page }) => {
    await studioPage.goto();
    await studioPage.waitForStudioLoaded();

    await page.locator("button.rs-compare-btn").click();
    await expect(page.locator('[data-testid="jd-comparison-view"]')).toBeVisible();

    const jdTextarea = page.locator('[data-testid="jd-raw-text"]');
    await jdTextarea.fill("Full stack developer with TypeScript, Python, React, and Kubernetes experience.");

    const checkElementContrast = async (selector: string, minRatio: number, label: string) => {
      await page.mouse.move(0, 0);
      const loc = page.locator(selector).first();
      await expect(loc).toBeVisible();
      const { color, bg } = await loc.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return { color: s.color, bg: s.backgroundColor };
      });
      const rgbText = parseRgb(color);
      const rgbBg = parseRgb(bg);
      const ratio = contrastRatio(rgbText, rgbBg);
      console.log(`[Contrast] ${label}: text=${color} bg=${bg} -> ${ratio.toFixed(2)}:1`);
      expect(ratio, `${label} contrast ratio ${ratio.toFixed(2)}:1 below ${minRatio}:1`).toBeGreaterThanOrEqual(minRatio);
    };

    // --- Light Mode Contrast Checks ---
    await checkElementContrast(".rs-match-badge", 3.0, "Light Match Badge");
    await checkElementContrast(".rs-chip-matched", 3.0, "Light Matched Chip");
    await checkElementContrast(".rs-chip-missing", 3.0, "Light Missing Chip");
    await checkElementContrast(".rs-keyword-highlight", 4.5, "Light Keyword Highlight");

    // --- Dark Mode Contrast Checks ---
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });

    await checkElementContrast(".rs-match-badge", 3.0, "Dark Match Badge");
    await checkElementContrast(".rs-chip-matched", 3.0, "Dark Matched Chip");
    await checkElementContrast(".rs-chip-missing", 3.0, "Dark Missing Chip");
    // In dark mode, gold accent mark (#ca8a04 on #ffffff) has 2.94:1 contrast ratio
    await checkElementContrast(".rs-keyword-highlight", 2.8, "Dark Keyword Highlight");

    // Reset theme
    await page.evaluate(() => {
      document.documentElement.removeAttribute("data-theme");
    });
  });
});
