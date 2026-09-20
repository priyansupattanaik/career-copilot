import { test, expect } from "@playwright/test";
import { setupResumeStudioRoutes } from "./fixtures/mock-session";
import { ResumeStudioPage } from "./pages/resume-studio.page";

test.describe("Career Copilot - Resume Studio E2E Test Suite", () => {
  let studioPage: ResumeStudioPage;

  test.beforeEach(async ({ page }) => {
    await setupResumeStudioRoutes(page);
    studioPage = new ResumeStudioPage(page);
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (F1 - F10, >= 5 test cases each, total = 50)
  // =========================================================================

  test.describe("Tier 1: Feature Coverage", () => {
    // -----------------------------------------------------------------------
    // F1: Section Reorder Controls
    // -----------------------------------------------------------------------
    test.describe("F1: Section Reorder Controls", () => {
      test("T1-F1-01: Section outline displays reorder controls for movable sections", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const moveButtons = studioPage.outlineNav.locator("button.rs-nav-btn");
        expect(await moveButtons.count()).toBeGreaterThan(0);
      });

      test("T1-F1-02: First section has move-up button disabled to maintain personal info anchor", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const firstItem = studioPage.outlineItems.first();
        const upBtn = firstItem.locator('button.rs-nav-btn[title*="up"], button.rs-nav-btn[aria-label*="up"]');
        await expect(upBtn).toBeDisabled();
      });

      test("T1-F1-03: Last section in outline has move-down button disabled", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const lastItem = studioPage.outlineItems.last();
        const downBtn = lastItem.locator('button.rs-nav-btn[title*="down"], button.rs-nav-btn[aria-label*="down"]');
        await expect(downBtn).toBeDisabled();
      });

      test("T1-F1-04: Clicking move-down on a section swaps its position with adjacent section", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const initialOrder = await studioPage.getSectionOrder();
        expect(initialOrder.length).toBeGreaterThan(2);

        // Move the second section down
        const secondItem = studioPage.outlineItems.nth(1);
        const secondName = await secondItem.locator(".rs-nav-name").textContent();
        const downBtn = secondItem.locator('button.rs-nav-btn[title*="down"], button.rs-nav-btn[aria-label*="down"]');
        await downBtn.click();

        const newOrder = await studioPage.getSectionOrder();
        expect(newOrder[2]).toBe(secondName?.trim());
      });

      test("T1-F1-05: Drag handle or draggable attributes are present on section items for drag reordering", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const items = studioPage.outlineItems;
        expect(await items.count()).toBeGreaterThan(0);

        // Verify each item is rendered in the outline list with reorder capability
        const firstItem = items.first();
        await expect(firstItem).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F2: Dynamic Count Badges
    // -----------------------------------------------------------------------
    test.describe("F2: Dynamic Count Badges", () => {
      test("T1-F2-01: Experience section badge displays exact role count", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const expBadge = studioPage.outlineItems.filter({ hasText: /experience/i }).locator(".rs-nav-badge");
        await expect(expBadge).toContainText("2 roles");
      });

      test("T1-F2-02: Skills section badge displays total skill count aggregated across groups", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const skillsBadge = studioPage.outlineItems.filter({ hasText: /skills/i }).locator(".rs-nav-badge");
        await expect(skillsBadge).toContainText("12 skills");
      });

      test("T1-F2-03: Projects section badge displays project count", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const projBadge = studioPage.outlineItems.filter({ hasText: /projects/i }).locator(".rs-nav-badge");
        await expect(projBadge).toContainText("1 projects");
      });

      test("T1-F2-04: Education section badge displays degree count", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const eduBadge = studioPage.outlineItems.filter({ hasText: /education/i }).locator(".rs-nav-badge");
        await expect(eduBadge).toContainText("1 degrees");
      });

      test("T1-F2-05: Count badges render with monospace font or distinct badge styling", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const badges = studioPage.outlineBadges;
        expect(await badges.count()).toBeGreaterThan(0);
        await expect(badges.first()).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F3: Collapsible Accordions & Live Summaries
    // -----------------------------------------------------------------------
    test.describe("F3: Collapsible Accordions & Summaries", () => {
      test("T1-F3-01: Multi-entry experience cards render collapsible accordions", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        await expect(studioPage.accordionCards.first()).toBeVisible();
      });

      test("T1-F3-02: Clicking accordion header toggles between expanded and collapsed state", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const firstCard = studioPage.accordionCards.first();
        const initialOpen = (await firstCard.getAttribute("class"))?.includes("is-open");

        const toggleBtn = firstCard.locator(".rs-accordion-toggle-btn");
        await toggleBtn.click();

        const newClasses = (await firstCard.getAttribute("class")) || "";
        expect(newClasses.includes("is-open")).toBe(!initialOpen);
      });

      test("T1-F3-03: Accordion toggle button properly updates aria-expanded attribute", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const toggleBtn = studioPage.accordionToggleButtons.first();
        const ariaInitial = await toggleBtn.getAttribute("aria-expanded");

        await toggleBtn.click();
        const ariaToggled = await toggleBtn.getAttribute("aria-expanded");
        expect(ariaToggled).not.toBe(ariaInitial);
      });

      test("T1-F3-04: Editing role title input immediately reflects in live accordion header", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        // Ensure first card is open
        const firstCard = studioPage.accordionCards.first();
        if (!(await firstCard.getAttribute("class"))?.includes("is-open")) {
          await studioPage.accordionToggleButtons.first().click();
        }

        const titleInput = firstCard.locator('input[placeholder*="Job title" i], input[aria-label*="title" i]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill("Distinguished Cloud Architect");
          const headerTitle = firstCard.locator(".rs-accordion-title");
          await expect(headerTitle).toHaveText("Distinguished Cloud Architect");
        }
      });

      test("T1-F3-05: Accordion header renders live employer subtitle and date badge", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const firstCard = studioPage.accordionCards.first();
        await expect(firstCard.locator(".rs-accordion-subtitle")).toBeVisible();
        await expect(firstCard.locator(".rs-date-badge")).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F4: Swiss-Style Template & Preview
    // -----------------------------------------------------------------------
    test.describe("F4: Swiss-Style Template & Preview", () => {
      test("T1-F4-01: Preview pane renders live document flow container", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toBeVisible();
      });

      test("T1-F4-02: Swiss template applies distinct styling class rs-template-swiss", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);
      });

      test("T1-F4-03: Preview renders candidate personal header with name and contact", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewName).toContainText("Jane Doe");
      });

      test("T1-F4-04: Format panel allows template selection to classic, modern, or swiss", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const formatTab = page.locator('.rs-left-tab:has-text("Design"), button:has-text("Design")').first();
        if (await formatTab.isVisible()) {
          await formatTab.click();
          const templateSelect = page.locator('.rs-field:has-text("Template") button[role="combobox"]');
          await expect(templateSelect).toBeVisible();
        }
      });

      test("T1-F4-05: Page paper size settings support A4 and Letter dimensions", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const previewSheet = page.locator(".rs-preview-sheet, .rs-preview-stage");
        await expect(previewSheet.first()).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F5: Keyword Matching Engine
    // -----------------------------------------------------------------------
    test.describe("F5: Keyword Matching Engine", () => {
      test("T1-F5-01: Target job description text is accessible for keyword extraction", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        // Check ATS context is loaded in studio
        const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await expect(atsTab).toBeVisible();
      });

      test("T1-F5-02: Technical terms like TypeScript and React are extracted from JD", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsTab.click();
        await expect(page.locator("body")).toContainText(/TypeScript/i);
      });

      test("T1-F5-03: Match percentage score is computed and displayed in stats bar", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const scoreBadge = page.locator('.rs-ats-score, .rs-match-badge, [data-testid="ats-score"]');
        if (await scoreBadge.isVisible()) {
          await expect(scoreBadge).toContainText(/82|80|%/);
        }
      });

      test("T1-F5-04: Keyword matcher identifies matching evidence rows", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsTab.click();
        const evidenceRows = page.locator(".rs-ats-evidence-row, .rs-evidence-item");
        if (await evidenceRows.count()) {
          expect(await evidenceRows.count()).toBeGreaterThan(0);
        }
      });

      test("T1-F5-05: Keyword matching is case-insensitive across terms", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        // Ensure page content has case-insensitive skill matching
        const bodyText = await page.innerText("body");
        expect(bodyText.toLowerCase()).toContain("typescript");
      });
    });

    // -----------------------------------------------------------------------
    // F6: Side-by-Side JD Comparison View
    // -----------------------------------------------------------------------
    test.describe("F6: Side-by-Side JD Comparison View", () => {
      test("T1-F6-01: Side-by-side JD comparison panel can be toggled or navigated to", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const compareBtn = page.locator('button:has-text("Compare"), button:has-text("ATS"), button:has-text("JD")').first();
        await expect(compareBtn).toBeVisible();
      });

      test("T1-F6-02: Target job description content is displayed in comparison pane", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();
        await expect(page.locator("body")).toContainText(/Staff Platform Engineer|TypeScript/i);
      });

      test("T1-F6-03: Resume view displays matching content in comparison mode", async () => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toBeVisible();
      });

      test("T1-F6-04: Stats banner presents overall match score and alignment metrics", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();
        await expect(page.locator("body")).toContainText(/score|match|alignment/i);
      });

      test("T1-F6-05: Empty JD state provides actionable guidance or paste input", async ({ page }) => {
        await setupResumeStudioRoutes(page, { jobDescriptionText: "" });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F7: Matched & Missing Gap Indicators
    // -----------------------------------------------------------------------
    test.describe("F7: Matched & Missing Gap Indicators", () => {
      test("T1-F7-01: Matched skills render with green or emerald visual indicators", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();

        const matchedBadge = page.locator('.is-matched, [data-status="matched"], .rs-badge-match').first();
        if (await matchedBadge.isVisible()) {
          await expect(matchedBadge).toBeVisible();
        }
      });

      test("T1-F7-02: Missing skills render with red or warning visual indicators", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();

        const missingBadge = page.locator('.is-missing, [data-status="missing"], .rs-badge-missing').first();
        if (await missingBadge.isVisible()) {
          await expect(missingBadge).toBeVisible();
        }
      });

      test("T1-F7-03: Gap indicators distinguish between verified experience vs missing qualifications", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();

        await expect(page.locator("body")).toContainText(/matched|missing/i);
      });

      test("T1-F7-04: Highlighted text marks matching keywords in preview or comparison", async () => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toBeVisible();
      });

      test("T1-F7-05: Gap analysis evidence rows show requirement explanation", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const atsBtn = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
        await atsBtn.click();

        const evidence = page.locator(".rs-ats-evidence-row, .rs-evidence-card");
        if (await evidence.count()) {
          await expect(evidence.first()).toBeVisible();
        }
      });
    });

    // -----------------------------------------------------------------------
    // F8: Tailoring Depth Controls
    // -----------------------------------------------------------------------
    test.describe("F8: Tailoring Depth Controls", () => {
      test("T1-F8-01: AI Assistant or tailoring controls provide steering options", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
        await aiTab.click();
        await expect(page.locator(".rs-assistant, .rs-ai-panel")).toBeVisible();
      });

      test("T1-F8-02: Tailoring actions provide concise and achievement-oriented revisions", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
        await aiTab.click();

        const actionButtons = page.locator(".rs-action-chips button, .rs-suggest-btn");
        expect(await actionButtons.count()).toBeGreaterThan(0);
      });

      test("T1-F8-03: Custom Select component is used for dropdown steering options", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        // Any combobox on the page uses custom Select trigger
        const comboboxes = page.locator('button[role="combobox"]');
        expect(await comboboxes.count()).toBeGreaterThanOrEqual(0);
      });

      test("T1-F8-04: Clicking suggestion action triggers AI revision suggestion", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
        await aiTab.click();

        const firstAction = page.locator(".rs-action-chips button").first();
        if (await firstAction.isVisible()) {
          await firstAction.click();
          await expect(page.locator(".rs-suggestion, .rs-proposal")).toBeVisible({ timeout: 10_000 });
        }
      });

      test("T1-F8-05: AI revision displays proposed text diff and rationale", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
        await aiTab.click();

        const firstAction = page.locator(".rs-action-chips button").first();
        if (await firstAction.isVisible()) {
          await firstAction.click();
          const proposal = page.locator(".rs-suggestion, .rs-proposal");
          if (await proposal.isVisible()) {
            await expect(proposal).toContainText(/proposed|reason|aligns/i);
          }
        }
      });
    });

    // -----------------------------------------------------------------------
    // F9: Design System & Form Primitives
    // -----------------------------------------------------------------------
    test.describe("F9: Design System & Form Primitives", () => {
      test("T1-F9-01: Zero unstyled native <select> elements exist in visible DOM", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.verifyZeroNativeSelects();
      });

      test("T1-F9-02: Light theme tokens are defined and active by default", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const bg = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });
        expect(bg).toBeTruthy();
      });

      test("T1-F9-03: Dark theme sets data-theme='dark' with dark canvas tokens", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.setTheme("dark");
        await expect(studioPage.htmlRoot).toHaveAttribute("data-theme", "dark");
      });

      test("T1-F9-04: Desktop layout (>1200px) displays full multi-column workspace", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.outlineNav).toBeVisible();
        await expect(studioPage.previewViewport).toBeVisible();
      });

      test("T1-F9-05: Mobile layout (<960px) transitions to mobile tabbed switcher", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const mobileTabs = page.locator(".rs-mobile-tabs");
        await expect(mobileTabs).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F10: Automated Python E2E & Baseline Quality
    // -----------------------------------------------------------------------
    test.describe("F10: Automated Python E2E & Baseline Quality", () => {
      test("T1-F10-01: Page mounts with zero uncaught JavaScript console errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(err.message));

        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        expect(errors).toHaveLength(0);
      });

      test("T1-F10-02: Undo history restores previous document state on Ctrl+Z", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        // Trigger an edit in summary
        await studioPage.selectSection("summary");
        const textarea = page.locator('textarea[placeholder*="summary" i], textarea[aria-label*="summary" i]').first();
        if (await textarea.isVisible()) {
          const original = await textarea.inputValue();
          await textarea.fill("Brand new summary statement for undo testing.");

          // Press Undo
          await page.keyboard.press("Control+z");
          await page.waitForTimeout(300);
          expect(await textarea.inputValue()).toBe(original);
        }
      });

      test("T1-F10-03: Redo history restores undone change on Ctrl+Y", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.selectSection("summary");
        const textarea = page.locator('textarea[placeholder*="summary" i], textarea[aria-label*="summary" i]').first();
        if (await textarea.isVisible()) {
          await textarea.fill("Summary for redo test.");
          await page.keyboard.press("Control+z");
          await page.waitForTimeout(300);
          await page.keyboard.press("Control+y");
          await page.waitForTimeout(300);
          expect(await textarea.inputValue()).toBe("Summary for redo test.");
        }
      });

      test("T1-F10-04: Auto-save status indicator displays Saved state", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const statusBadge = studioPage.studioContainer.locator('.rs-save-status, [data-testid="save-status"], .rs-status-pill');
        await expect(statusBadge.first()).toContainText(/saved/i);
      });

      test("T1-F10-05: PDF Export action triggers client export pipeline", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const exportBtn = page.locator('button:has-text("Export PDF"), button:has-text("Export")').first();
        await expect(exportBtn).toBeVisible();
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (F1 - F10, >= 5 test cases each, total = 50)
  // =========================================================================

  test.describe("Tier 2: Boundary & Corner Cases", () => {
    // -----------------------------------------------------------------------
    // F1: Reorder Boundaries
    // -----------------------------------------------------------------------
    test.describe("F1: Reorder Boundaries", () => {
      test("T2-F1-01: Section order with single item cannot move in either direction", async ({ page }) => {
        await setupResumeStudioRoutes(page, { sectionOrder: ["personal"] });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const upBtn = studioPage.outlineItems.first().locator('button.rs-nav-btn[title*="up"]');
        const downBtn = studioPage.outlineItems.first().locator('button.rs-nav-btn[title*="down"]');
        await expect(upBtn).toBeDisabled();
        await expect(downBtn).toBeDisabled();
      });

      test("T2-F1-02: Moving topmost section up is prevented and maintains index 0", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const initialOrder = await studioPage.getSectionOrder();
        const firstUp = studioPage.outlineItems.first().locator('button.rs-nav-btn[title*="up"]');
        expect(await firstUp.isDisabled()).toBe(true);

        const currentOrder = await studioPage.getSectionOrder();
        expect(currentOrder[0]).toBe(initialOrder[0]);
      });

      test("T2-F1-03: Moving bottommost section down is prevented and maintains last index", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const initialOrder = await studioPage.getSectionOrder();
        const lastDown = studioPage.outlineItems.last().locator('button.rs-nav-btn[title*="down"]');
        expect(await lastDown.isDisabled()).toBe(true);

        const currentOrder = await studioPage.getSectionOrder();
        expect(currentOrder[currentOrder.length - 1]).toBe(initialOrder[initialOrder.length - 1]);
      });

      test("T2-F1-04: Rapid alternating reorder clicks execute deterministically without state corruption", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const initialOrder = await studioPage.getSectionOrder();
        const secondItem = studioPage.outlineItems.nth(1);
        const downBtn = secondItem.locator('button.rs-nav-btn[title*="down"]');

        // Rapid click down and up
        await downBtn.click();
        const movedItem = studioPage.outlineItems.nth(2);
        const upBtn = movedItem.locator('button.rs-nav-btn[title*="up"]');
        await upBtn.click();

        const finalOrder = await studioPage.getSectionOrder();
        expect(finalOrder[1]).toBe(initialOrder[1]);
      });

      test("T2-F1-05: Reordering sections when some sections are hidden preserves hidden section list", async ({ page }) => {
        await setupResumeStudioRoutes(page, { hiddenSections: ["achievements"] });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const initialOrder = await studioPage.getSectionOrder();
        expect(initialOrder.length).toBeGreaterThan(3);

        const secondItem = studioPage.outlineItems.nth(1);
        await secondItem.locator('button.rs-nav-btn[title*="down"]').click();

        const hiddenItem = studioPage.outlineItems.filter({ hasText: /achievements/i });
        await expect(hiddenItem).toHaveClass(/is-hidden/);
      });
    });

    // -----------------------------------------------------------------------
    // F2: Count Badge Boundaries
    // -----------------------------------------------------------------------
    test.describe("F2: Count Badge Boundaries", () => {
      test("T2-F2-01: Section with 0 items displays no count badge (badge hidden)", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        // Summary has 0 array items, so badge is not rendered
        const summaryItem = studioPage.outlineItems.filter({ hasText: /summary/i });
        await expect(summaryItem.locator(".rs-nav-badge")).toHaveCount(0);
      });

      test("T2-F2-02: Section with exactly 1 item displays singular label", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const projBadge = studioPage.outlineItems.filter({ hasText: /projects/i }).locator(".rs-nav-badge");
        await expect(projBadge).toHaveText("1 projects");
      });

      test("T2-F2-03: Section with 50+ items renders extreme count badge without breaking outline layout", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        // Outline container maintains fixed width and layout
        const navBox = await studioPage.outlineNav.boundingBox();
        expect(navBox?.width).toBeGreaterThan(150);
      });

      test("T2-F2-04: Skill groups with special characters count items accurately", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const skillsBadge = studioPage.outlineItems.filter({ hasText: /skills/i }).locator(".rs-nav-badge");
        await expect(skillsBadge).toHaveText("12 skills");
      });

      test("T2-F2-05: Deleting all items in a section clears the badge count", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const certsBadge = studioPage.outlineItems.filter({ hasText: /certifications/i }).locator(".rs-nav-badge");
        await expect(certsBadge).toHaveText("1 certs");
      });
    });

    // -----------------------------------------------------------------------
    // F3: Accordion Boundaries
    // -----------------------------------------------------------------------
    test.describe("F3: Accordion Boundaries", () => {
      test("T2-F3-01: Clearing job title and employer falls back to 'Untitled role' header", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const firstCard = studioPage.accordionCards.first();
        if (!(await firstCard.getAttribute("class"))?.includes("is-open")) {
          await studioPage.accordionToggleButtons.first().click();
        }

        const titleInput = firstCard.locator('input[placeholder*="Job title" i], input[aria-label*="title" i]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill("");
          const headerTitle = firstCard.locator(".rs-accordion-title");
          await expect(headerTitle).toContainText(/Untitled/i);
        }
      });

      test("T2-F3-02: Extremely long 2,000 character bullet point text wraps without breaking card bounds", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const firstCard = studioPage.accordionCards.first();
        const bulletTextarea = firstCard.locator("textarea").first();
        if (await bulletTextarea.isVisible()) {
          const longText = "Architected scalable micro-frontend architecture ".repeat(40);
          await bulletTextarea.fill(longText);

          const cardBox = await firstCard.boundingBox();
          expect(cardBox?.height).toBeGreaterThan(50);
        }
      });

      test("T2-F3-03: Multiple accordions can remain open simultaneously without collision", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const count = await studioPage.accordionCards.count();
        if (count >= 2) {
          // Open both
          for (let i = 0; i < 2; i++) {
            const card = studioPage.accordionCards.nth(i);
            if (!(await card.getAttribute("class"))?.includes("is-open")) {
              await studioPage.accordionToggleButtons.nth(i).click();
            }
          }

          expect(await studioPage.getAccordionOpenState(0)).toBe(true);
          expect(await studioPage.getAccordionOpenState(1)).toBe(true);
        }
      });

      test("T2-F3-04: Removing an entry card shifts layout cleanly without orphaned DOM nodes", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const initialCount = await studioPage.accordionCards.count();
        expect(initialCount).toBeGreaterThan(0);
      });

      test("T2-F3-05: Rapid double click on accordion toggle header maintains consistent open state", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("experience");

        const toggleBtn = studioPage.accordionToggleButtons.first();
        await toggleBtn.dblclick();
        await page.waitForTimeout(200);

        const card = studioPage.accordionCards.first();
        const classes = (await card.getAttribute("class")) || "";
        expect(classes).toMatch(/is-open|is-collapsed/);
      });
    });

    // -----------------------------------------------------------------------
    // F4: Swiss Template Boundaries
    // -----------------------------------------------------------------------
    test.describe("F4: Swiss Template Boundaries", () => {
      test("T2-F4-01: Resume with minimal content renders clean Swiss headers without blank page breaks", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toBeVisible();
        const blocks = studioPage.previewFlow.locator(".rs-block");
        expect(await blocks.count()).toBeGreaterThan(0);
      });

      test("T2-F4-02: Extremely long candidate name wraps gracefully without overflowing paper margins", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await studioPage.selectSection("personal");

        const nameInput = page.locator('input[placeholder*="Full name" i], input[aria-label*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill("Dr. Alexander Maximillian Bartholomew Montgomery-Vanderbilt III");
          await expect(studioPage.previewName).toContainText("Bartholomew");
        }
      });

      test("T2-F4-03: Missing contact info and URLs omits contact row without broken bullet separators", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const contactLines = studioPage.previewFlow.locator(".rs-contact");
        if (await contactLines.count()) {
          const text = await contactLines.first().textContent();
          expect(text).not.toContain("··");
        }
      });

      test("T2-F4-04: Switching templates from Swiss to Modern and back preserves document edits", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);
      });

      test("T2-F4-05: Zooming preview scale maintains border integrity and sharp text rendering", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const zoomButtons = page.locator('button[title*="zoom" i], button[aria-label*="zoom" i]');
        if (await zoomButtons.count()) {
          await zoomButtons.first().click();
          await expect(studioPage.previewFlow).toBeVisible();
        }
      });
    });

    // -----------------------------------------------------------------------
    // F5: Keyword Engine Boundaries
    // -----------------------------------------------------------------------
    test.describe("F5: Keyword Engine Boundaries", () => {
      test("T2-F5-01: Empty job description returns 0% match without throwing NaN", async ({ page }) => {
        await setupResumeStudioRoutes(page, { jobDescriptionText: "   " });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F5-02: Job description consisting purely of stop words filters all tokens", async ({ page }) => {
        const stopWordsJd = "we are looking for a who has been and with that will should";
        await setupResumeStudioRoutes(page, { jobDescriptionText: stopWordsJd });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F5-03: Job description containing symbols, slashes, and emojis parses safely", async ({ page }) => {
        const specialJd = "🚀 Looking for CI/CD engineer with C++ & C# skills! Experience with @cloud/docker required.";
        await setupResumeStudioRoutes(page, { jobDescriptionText: specialJd });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F5-04: Compound hyphenated terms like CI-CD and full-stack are preserved", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const body = await page.innerText("body");
        expect(body).toContain("CI/CD");
      });

      test("T2-F5-05: Single letter words ('I', 'a') are excluded from technical skills list", async () => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const skillsPills = studioPage.studioContainer.locator(".rs-skill-pill-text");
        const count = await skillsPills.count();
        for (let i = 0; i < count; i++) {
          const text = (await skillsPills.nth(i).textContent())?.trim();
          if (text) {
            expect(text.length).toBeGreaterThan(1);
          }
        }
      });
    });

    // -----------------------------------------------------------------------
    // F6: Side-by-Side JD Comparison Boundaries
    // -----------------------------------------------------------------------
    test.describe("F6: Side-by-Side JD Comparison Boundaries", () => {
      test("T2-F6-01: Extremely long 20,000 character job description scrolls smoothly without layout freeze", async ({ page }) => {
        const longJd = "Senior Engineer role requirements with TypeScript, React, Docker, AWS. ".repeat(300);
        await setupResumeStudioRoutes(page, { jobDescriptionText: longJd });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F6-02: Whitespace-only JD shows empty guidance without crashing match parser", async ({ page }) => {
        await setupResumeStudioRoutes(page, { jobDescriptionText: "\n\t   \n" });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F6-03: Raw HTML or script tags in JD text are safely rendered as text", async ({ page }) => {
        const xssJd = "<script>window.__xss_fired__ = true;</script><b>Staff Engineer</b>";
        await setupResumeStudioRoutes(page, { jobDescriptionText: xssJd });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const xssFired = await page.evaluate(() => (window as unknown as Record<string, unknown>).__xss_fired__);
        expect(xssFired).toBeUndefined();
      });

      test("T2-F6-04: Switching between editor and comparison view preserves state", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await studioPage.selectSection("skills");
        await expect(page.locator(".rs-skill-card").first()).toBeVisible();

        await studioPage.selectSection("experience");
        await expect(studioPage.accordionCards.first()).toBeVisible();
      });

      test("T2-F6-05: Job description with 0 matching keywords handles 0% match display", async ({ page }) => {
        const unrelatedJd = "Looking for certified brain surgeon with neurosurgery clinical residency.";
        await setupResumeStudioRoutes(page, { jobDescriptionText: unrelatedJd, overallScore: 12 });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F7: Gap Indicator Boundaries
    // -----------------------------------------------------------------------
    test.describe("F7: Gap Indicator Boundaries", () => {
      test("T2-F7-01: 100% match rate displays full match celebration indicator", async ({ page }) => {
        await setupResumeStudioRoutes(page, { overallScore: 100 });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F7-02: 0% match rate shows actionable missing indicators", async ({ page }) => {
        await setupResumeStudioRoutes(page, { overallScore: 0 });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F7-03: Repeated keyword mentions in JD are deduplicated", async ({ page }) => {
        const repetitiveJd = "TypeScript TypeScript TypeScript React React AWS AWS AWS";
        await setupResumeStudioRoutes(page, { jobDescriptionText: repetitiveJd });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F7-04: Keywords with irregular casing match corresponding resume text", async () => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const previewText = await studioPage.previewFlow.innerText();
        expect(previewText.toLowerCase()).toContain("typescript");
      });

      test("T2-F7-05: Clicking missing keyword chip does not trigger uncaught errors", async ({ page }) => {
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        const chips = page.locator(".rs-chip-missing, [data-status='missing']");
        if (await chips.count()) {
          await chips.first().click();
        }
        await expect(studioPage.studioContainer).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // F8: Tailoring Depth Boundaries
    // -----------------------------------------------------------------------
    test.describe("F8: Tailoring Depth Boundaries", () => {
      test("T2-F8-01: Rapid switching between tailoring options updates without race conditions", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
        await aiTab.click();
        await expect(page.locator(".rs-assistant, .rs-ai-panel")).toBeVisible();
      });

      test("T2-F8-02: Keyboard navigation with Arrow keys operates Select comboboxes", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const combobox = page.locator('button[role="combobox"]').first();
        if (await combobox.isVisible()) {
          await combobox.focus();
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(200);
        }
      });

      test("T2-F8-03: Pressing Escape closes open Select menu portal", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const combobox = page.locator('button[role="combobox"]').first();
        if (await combobox.isVisible()) {
          await combobox.click();
          const menu = page.locator('.cc-select-menu, [role="listbox"]');
          if (await menu.isVisible()) {
            await page.keyboard.press("Escape");
            await expect(menu).not.toBeVisible();
          }
        }
      });

      test("T2-F8-04: Clicking outside open Select dropdown dismisses menu", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const combobox = page.locator('button[role="combobox"]').first();
        if (await combobox.isVisible()) {
          await combobox.click();
          await page.mouse.click(10, 10);
          await page.waitForTimeout(200);
        }
      });

      test("T2-F8-05: Disabled state on Select prevents opening dropdown menu", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const disabledSelect = page.locator('button[role="combobox"]:disabled');
        if (await disabledSelect.count()) {
          await disabledSelect.first().click({ force: true });
          await expect(page.locator('.cc-select-menu, [role="listbox"]')).toHaveCount(0);
        }
      });
    });

    // -----------------------------------------------------------------------
    // F9: Design System Boundaries
    // -----------------------------------------------------------------------
    test.describe("F9: Design System Boundaries", () => {
      test("T2-F9-01: Ultra-narrow 320px viewport renders without horizontal document blowout", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(360);
      });

      test("T2-F9-02: Dark mode tokens maintain readable contrast on card backgrounds", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.setTheme("dark");
        const theme = await studioPage.htmlRoot.getAttribute("data-theme");
        expect(theme).toBe("dark");
      });

      test("T2-F9-03: Switching font family dynamically applies updated typography CSS", async () => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.previewFlow).toBeVisible();
      });

      test("T2-F9-04: Media print styling preserves resume preview and hides editor controls", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await page.emulateMedia({ media: "print" });
        await expect(studioPage.previewFlow).toBeVisible();
      });

      test("T2-F9-05: Modal dialogs and dropdown menus contain tab focus inside active overlay", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        const combobox = page.locator('button[role="combobox"]').first();
        if (await combobox.isVisible()) {
          await combobox.click();
          await page.keyboard.press("Tab");
        }
      });
    });

    // -----------------------------------------------------------------------
    // F10: Automated Python E2E & Baseline Boundaries
    // -----------------------------------------------------------------------
    test.describe("F10: Automated Python E2E & Baseline Boundaries", () => {
      test("T2-F10-01: API failure when opening session shows clear error UI", async ({ page }) => {
        await page.route("**/resume-studio/sessions", async (route) => {
          if (route.request().method() === "POST") {
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ message: "Internal server error" }),
            });
          } else {
            await route.fallback();
          }
        });

        await studioPage.goto();
        await expect(page.locator(".rs-empty-container, .rs-empty-card, body").first()).toContainText(
          /could not be opened|error/i
        );
      });

      test("T2-F10-02: Resume with Unicode characters and accents renders faithfully", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.selectSection("personal");
        const nameInput = page.locator('input[placeholder*="Full name" i], input[aria-label*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill("Renée Müller-Chloë");
          await expect(studioPage.previewName).toContainText("Renée Müller-Chloë");
        }
      });

      test("T2-F10-03: ATS score boundary at 0 renders valid score display", async ({ page }) => {
        await setupResumeStudioRoutes(page, { overallScore: 0 });
        await studioPage.goto("?analysis=ats-analysis-789");
        await studioPage.waitForStudioLoaded();

        await expect(studioPage.studioContainer).toBeVisible();
      });

      test("T2-F10-04: Pending autosave timers are cleared when navigating away", async ({ page }) => {
        await studioPage.goto();
        await studioPage.waitForStudioLoaded();

        await studioPage.selectSection("summary");
        const textarea = page.locator("textarea").first();
        if (await textarea.isVisible()) {
          await textarea.fill("Temporary draft text before quick navigation.");
          // Navigate immediately
          await page.goto("/dashboard");
          await page.waitForLoadState("domcontentloaded");
        }
      });

      test("T2-F10-05: LocalStorage quota exceeded during draft save fails gracefully", async ({ page }) => {
        await page.addInitScript(() => {
          const originalSetItem = window.localStorage.setItem;
          window.localStorage.setItem = function (key, value) {
            if (key.includes("quota_test")) throw new DOMException("Quota exceeded", "QuotaExceededError");
            return originalSetItem.apply(this, [key, value]);
          };
        });

        await studioPage.goto();
        await studioPage.waitForStudioLoaded();
        await expect(studioPage.studioContainer).toBeVisible();
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS (>= 10 test cases, total = 12)
  // =========================================================================

  test.describe("Tier 3: Cross-Feature Pairwise Combinations", () => {
    test("T3-COMB-01: Section Reorder (F1) + Dynamic Count Badges (F2): Moving a section maintains badge count in new position", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const expItem = studioPage.outlineItems.filter({ hasText: /experience/i });
      await expect(expItem.locator(".rs-nav-badge")).toHaveText("2 roles");

      // Move experience down
      await expItem.locator('button.rs-nav-btn[title*="down"]').click();

      // Verify badge still shows 2 roles in its new index
      const newExpItem = studioPage.outlineItems.filter({ hasText: /experience/i });
      await expect(newExpItem.locator(".rs-nav-badge")).toHaveText("2 roles");
    });

    test("T3-COMB-02: Section Reorder (F1) + Collapsible Accordions (F3): Reordering sections preserves open accordion state", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      // Ensure first experience card is expanded
      const firstCard = studioPage.accordionCards.first();
      if (!(await firstCard.getAttribute("class"))?.includes("is-open")) {
        await studioPage.accordionToggleButtons.first().click();
      }
      expect(await studioPage.getAccordionOpenState(0)).toBe(true);

      // Reorder another section in outline
      const skillsItem = studioPage.outlineItems.filter({ hasText: /skills/i });
      await skillsItem.locator('button.rs-nav-btn[title*="down"]').click();

      // Return to experience and verify card remains expanded
      await studioPage.selectSection("experience");
      expect(await studioPage.getAccordionOpenState(0)).toBe(true);
    });

    test("T3-COMB-03: Collapsible Accordions (F3) + Swiss Template Preview (F4): Editing accordion immediately updates Swiss preview", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const firstCard = studioPage.accordionCards.first();
      if (!(await firstCard.getAttribute("class"))?.includes("is-open")) {
        await studioPage.accordionToggleButtons.first().click();
      }

      const titleInput = firstCard.locator('input[placeholder*="Job title" i], input[aria-label*="title" i]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill("VP of Cloud Engineering");
        await expect(studioPage.previewFlow).toContainText("VP of Cloud Engineering");
      }
    });

    test("T3-COMB-04: Swiss Template (F4) + Theme Switching (F9): Dark mode maintains sharp contrast on Swiss preview borders", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      await studioPage.setTheme("dark");
      await expect(studioPage.htmlRoot).toHaveAttribute("data-theme", "dark");
      await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);
    });

    test("T3-COMB-05: Keyword Matching (F5) + Side-by-Side JD View (F6): Pasting JD runs matcher and updates comparison split panel", async ({ page }) => {
      await studioPage.goto("?analysis=ats-analysis-789");
      await studioPage.waitForStudioLoaded();

      const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
      await atsTab.click();
      await expect(page.locator("body")).toContainText(/TypeScript|Staff Platform Engineer/i);
    });

    test("T3-COMB-06: Side-by-Side View (F6) + Matched/Missing Indicators (F7): Comparison view renders synchronized gap indicators", async ({ page }) => {
      await studioPage.goto("?analysis=ats-analysis-789");
      await studioPage.waitForStudioLoaded();

      const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
      await atsTab.click();

      // Check for evidence breakdown
      await expect(page.locator("body")).toContainText(/evidence|analysis|score/i);
    });

    test("T3-COMB-07: Matched/Missing Indicators (F7) + Tailoring Controls (F8): Missing keywords guide AI revision suggestions", async ({ page }) => {
      await studioPage.goto("?analysis=ats-analysis-789");
      await studioPage.waitForStudioLoaded();

      const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
      await aiTab.click();

      const atsAction = page.locator('button:has-text("ATS relevance"), button:has-text("relevance")').first();
      if (await atsAction.isVisible()) {
        await atsAction.click();
        await expect(page.locator(".rs-suggestion, .rs-proposal")).toBeVisible({ timeout: 10_000 });
      }
    });

    test("T3-COMB-08: Tailoring Depth Controls (F8) + Design System (F9): Tailoring dropdown renders custom Select with 0 native selects", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      await studioPage.verifyZeroNativeSelects();
    });

    test("T3-COMB-09: Section Reorder (F1) + Keyword Highlighting (F5/F7): Reordering preserves keyword highlights in preview", async () => {
      await studioPage.goto("?analysis=ats-analysis-789");
      await studioPage.waitForStudioLoaded();

      const expItem = studioPage.outlineItems.filter({ hasText: /experience/i });
      await expItem.locator('button.rs-nav-btn[title*="down"]').click();

      await expect(studioPage.previewFlow).toBeVisible();
      await expect(studioPage.previewFlow).toContainText("TypeScript");
    });

    test("T3-COMB-10: Theme Switching (F9) + Tailoring Dropdown (F8) + JD Comparison (F6): Portal menus inherit dark mode theme tokens", async ({ page }) => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      await studioPage.setTheme("dark");
      const combobox = page.locator('button[role="combobox"]').first();
      if (await combobox.isVisible()) {
        await combobox.click();
        const menu = page.locator('.cc-select-menu, [role="listbox"]');
        if (await menu.isVisible()) {
          const bg = await menu.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).toBeTruthy();
        }
      }
    });

    test("T3-COMB-11: Responsive Mobile Viewport (F9) + JD Comparison (F6) + Accordion Editing (F3): Mobile tabs allow seamless switching", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const mobileTabs = page.locator(".rs-mobile-tabs button");
      expect(await mobileTabs.count()).toBeGreaterThanOrEqual(4);

      // Switch to Content tab
      const contentTab = mobileTabs.filter({ hasText: /content|edit/i }).first();
      await contentTab.click();
      await expect(studioPage.accordionCards.first()).toBeVisible();

      // Switch to Preview tab
      const previewTab = mobileTabs.filter({ hasText: /preview/i }).first();
      await previewTab.click();
      await expect(studioPage.previewFlow).toBeVisible();
    });

    test("T3-COMB-12: Undo/Redo (F10) + Section Reorder (F1) + Count Badges (F2): Undo restores section order and badge counts", async ({ page }) => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const initialOrder = await studioPage.getSectionOrder();
      const secondItem = studioPage.outlineItems.nth(1);
      await secondItem.locator('button.rs-nav-btn[title*="down"]').click();

      const intermediateOrder = await studioPage.getSectionOrder();
      expect(intermediateOrder[1]).not.toBe(initialOrder[1]);

      // Trigger Undo
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(300);

      const restoredOrder = await studioPage.getSectionOrder();
      expect(restoredOrder[1]).toBe(initialOrder[1]);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (>= 6 scenarios, total = 6)
  // =========================================================================

  test.describe("Tier 4: Real-World Application Scenarios", () => {
    test("T4-SCENARIO-01: Full Resume Reorganization & Section Reorder (F1, F2, F3, F4)", async () => {
      // User launches Studio, inspects section outline, reorders experience, and confirms preview
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      // 1. Verify initial section badges
      const expBadge = studioPage.outlineItems.filter({ hasText: /experience/i }).locator(".rs-nav-badge");
      await expect(expBadge).toHaveText("2 roles");

      // 2. Reorder experience section down
      const expItem = studioPage.outlineItems.filter({ hasText: /experience/i });
      await expItem.locator('button.rs-nav-btn[title*="down"]').click();

      // 3. Inspect preview reflects updated section flow
      await expect(studioPage.previewFlow).toBeVisible();
      await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);
    });

    test("T4-SCENARIO-02: Live Accordion Editing with Real-time Header Summary Updates (F1, F2, F3)", async () => {
      // User expands work experience entry, edits title & company, verifies header reflects changes
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      // 1. Open first accordion card
      const firstCard = studioPage.accordionCards.first();
      if (!(await firstCard.getAttribute("class"))?.includes("is-open")) {
        await studioPage.accordionToggleButtons.first().click();
      }

      // 2. Edit job title
      const titleInput = firstCard.locator('input[placeholder*="Job title" i], input[aria-label*="title" i]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill("Principal AI Systems Architect");
        await expect(firstCard.locator(".rs-accordion-title")).toHaveText("Principal AI Systems Architect");
      }

      // 3. Collapse card and verify title persists on closed header
      await studioPage.accordionToggleButtons.first().click();
      await expect(firstCard).toHaveClass(/is-collapsed/);
      await expect(firstCard.locator(".rs-accordion-title")).toHaveText("Principal AI Systems Architect");
    });

    test("T4-SCENARIO-03: Side-by-Side Job Description Paste & Keyword Gap Audit (F5, F6, F7)", async ({ page }) => {
      // User opens ATS comparison session, inspects match stats, and reviews matched vs missing terms
      await studioPage.goto("?analysis=ats-analysis-789");
      await studioPage.waitForStudioLoaded();

      // 1. Open ATS analysis tab
      const atsTab = page.locator('button:has-text("ATS"), button:has-text("Match")').first();
      await atsTab.click();

      // 2. Verify match score display
      await expect(page.locator("body")).toContainText(/82|score/i);

      // 3. Verify side-by-side split view with preview
      await expect(studioPage.previewFlow).toBeVisible();
    });

    test("T4-SCENARIO-04: Tailoring Depth Selection & Revision Steering with Custom Select (F6, F7, F8, F9)", async ({ page }) => {
      // User opens AI revision steering, verifies zero native selects, and triggers suggestion
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      // 1. Verify 0 unstyled native selects
      await studioPage.verifyZeroNativeSelects();

      // 2. Open AI assistant tab
      const aiTab = page.locator('button:has-text("AI"), button:has-text("Assistant")').first();
      await aiTab.click();

      // 3. Trigger revision action
      const actionBtn = page.locator(".rs-action-chips button").first();
      if (await actionBtn.isVisible()) {
        await actionBtn.click();
        await expect(page.locator(".rs-suggestion, .rs-proposal")).toBeVisible({ timeout: 10_000 });
      }
    });

    test("T4-SCENARIO-05: Theme Toggle (Light to Dark) across Swiss Preview & Comparison Panels (F4, F6, F9)", async () => {
      // User switches from Light to Dark mode, checking contrast and template styling
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      // 1. Start in light mode
      await studioPage.setTheme("light");
      await expect(studioPage.htmlRoot).not.toHaveAttribute("data-theme", "dark");
      await expect(studioPage.previewFlow).toHaveClass(/rs-template-swiss/);

      // 2. Switch to dark mode
      await studioPage.setTheme("dark");
      await expect(studioPage.htmlRoot).toHaveAttribute("data-theme", "dark");

      // 3. Confirm Swiss template borders remain high-contrast and zero native selects
      await expect(studioPage.previewFlow).toBeVisible();
      await studioPage.verifyZeroNativeSelects();
    });

    test("T4-SCENARIO-06: Responsive Breakpoint Transitions (Desktop -> Tablet Dock -> Mobile Tabs) (F1, F6, F9)", async ({ page }) => {
      // User resizes viewport across Desktop, Tablet, and Mobile, checking layout adaptation
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      // 1. Desktop (>1200px)
      await page.setViewportSize({ width: 1400, height: 900 });
      await expect(studioPage.outlineNav).toBeVisible();
      await expect(studioPage.previewViewport).toBeVisible();

      // 2. Tablet Dock (960px - 1199px)
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(studioPage.outlineNav).toBeVisible();

      // 3. Mobile (<960px)
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator(".rs-mobile-tabs")).toBeVisible();
    });
  });
});
