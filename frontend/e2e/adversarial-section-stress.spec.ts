import { test, expect } from "@playwright/test";
import { setupResumeStudioRoutes, createMockSession } from "./fixtures/mock-session";
import { ResumeStudioPage } from "./pages/resume-studio.page";

test.describe("Empirical Challenger M2-1 Adversarial Stress Suite", () => {
  let studioPage: ResumeStudioPage;

  test.beforeEach(async ({ page }) => {
    await setupResumeStudioRoutes(page);
    studioPage = new ResumeStudioPage(page);
  });

  // -------------------------------------------------------------------------
  // AREA 1: REORDERING EXTREMES & FAILURE MODES
  // -------------------------------------------------------------------------
  test.describe("1. Reordering Extremes", () => {
    test("ADV-REORDER-01: HTML5 Drag-and-Drop section reordering swaps positions and updates DOM state", async ({ page }) => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const initialOrder = await studioPage.getSectionOrder();
      expect(initialOrder.length).toBeGreaterThan(2);

      const sourceItem = studioPage.outlineItems.nth(1);
      const targetItem = studioPage.outlineItems.nth(3);

      // Perform drag and drop using dragTo
      await sourceItem.locator(".rs-nav-drag-handle").dragTo(targetItem);
      await page.waitForTimeout(300);

      const updatedOrder = await studioPage.getSectionOrder();
      // Verify reorder occurred
      expect(updatedOrder).not.toEqual(initialOrder);
    });

    test("ADV-REORDER-02: Rapid alternating reorder clicks (10 clicks) maintain consistent ordering without desync", async ({ page }) => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const initialOrder = await studioPage.getSectionOrder();
      const secondItem = studioPage.outlineItems.nth(1);
      const downBtn = secondItem.locator('button.rs-nav-btn[title*="down"]');

      // Rapidly toggle down and up 5 times (10 clicks)
      for (let i = 0; i < 5; i++) {
        await downBtn.click();
        const movedItem = studioPage.outlineItems.nth(2);
        const upBtn = movedItem.locator('button.rs-nav-btn[title*="up"]');
        await upBtn.click();
      }
      await page.waitForTimeout(200);

      const finalOrder = await studioPage.getSectionOrder();
      expect(finalOrder).toEqual(initialOrder);
    });

    test("ADV-REORDER-03: Moving hidden sections preserves their hidden status", async ({ page }) => {
      await setupResumeStudioRoutes(page, { hiddenSections: ["experience"] });
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const expItem = studioPage.outlineItems.filter({ hasText: /experience/i }).first();
      await expect(expItem).toHaveClass(/is-hidden/);

      // Move down while hidden
      const downBtn = expItem.locator('button.rs-nav-btn[title*="down"]');
      await downBtn.click();

      // Still hidden in new position
      const movedExp = studioPage.outlineItems.filter({ hasText: /experience/i }).first();
      await expect(movedExp).toHaveClass(/is-hidden/);
    });

    test("ADV-REORDER-04: Boundary Move Up at index 0 and Move Down at last index remain strictly disabled", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const firstUp = studioPage.outlineItems.first().locator('button.rs-nav-btn[title*="up"]');
      const lastDown = studioPage.outlineItems.last().locator('button.rs-nav-btn[title*="down"]');

      await expect(firstUp).toBeDisabled();
      await expect(lastDown).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // AREA 2: DYNAMIC COUNT BADGE BOUNDARIES
  // -------------------------------------------------------------------------
  test.describe("2. Badge Count Boundaries", () => {
    test("ADV-BADGE-01: Sections with 0 items render no count badge", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      // Summary section has 0 items
      const summaryItem = studioPage.outlineItems.filter({ hasText: /summary/i }).first();
      await expect(summaryItem.locator(".rs-nav-badge")).toHaveCount(0);
    });

    test("ADV-BADGE-02: Extreme count badge (60 items) renders with tabular numbers and without overflow", async ({ page }) => {
      const session = createMockSession();
      session.document.content.skill_groups = [
        {
          id: "sg-extreme",
          name: "High Volume Skills",
          items: Array.from({ length: 60 }, (_, i) => ({ id: `sk-${i}`, name: `Skill ${i}` })),
        },
      ];

      await page.route("**/resume-studio/sessions", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(session),
          });
        } else {
          await route.fallback();
        }
      });

      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const skillsBadge = studioPage.outlineItems.filter({ hasText: /skills/i }).locator(".rs-nav-badge");
      await expect(skillsBadge).toHaveText("60 skills");

      // Verify outline item did not blow out width
      const navBox = await studioPage.outlineNav.boundingBox();
      expect(navBox?.width).toBeLessThanOrEqual(300);
    });

    test("ADV-BADGE-03: Special characters and symbols in skills do not corrupt badge calculation", async ({ page }) => {
      const session = createMockSession();
      session.document.content.skill_groups = [
        {
          id: "sg-spec",
          name: "C++ / C# & WebAssembly <script>alert(1)</script> 🚀",
          items: [
            { id: "s-1", name: "C++20" },
            { id: "s-2", name: "C# / .NET" },
            { id: "s-3", name: "<b>Wasm</b>" },
          ],
        },
      ];

      await page.route("**/resume-studio/sessions", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(session),
          });
        } else {
          await route.fallback();
        }
      });

      await studioPage.goto();
      await studioPage.waitForStudioLoaded();

      const skillsBadge = studioPage.outlineItems.filter({ hasText: /skills/i }).locator(".rs-nav-badge");
      await expect(skillsBadge).toHaveText("3 skills");
    });
  });

  // -------------------------------------------------------------------------
  // AREA 3: ACCORDION STRESS & CORNER CASES
  // -------------------------------------------------------------------------
  test.describe("3. Accordion Stress & Corner Cases", () => {
    test("ADV-ACCORD-01: Multiple accordions can be opened and manipulated independently", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const cardCount = await studioPage.accordionCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(2);

      // Open all cards
      for (let i = 0; i < cardCount; i++) {
        const card = studioPage.accordionCards.nth(i);
        const isOpen = (await card.getAttribute("class"))?.includes("is-open");
        if (!isOpen) {
          await studioPage.accordionToggleButtons.nth(i).click();
        }
      }

      // Verify all open
      for (let i = 0; i < cardCount; i++) {
        expect(await studioPage.getAccordionOpenState(i)).toBe(true);
      }
    });

    test("ADV-ACCORD-02: Rapid double click on toggle button toggles state cleanly", async ({ page }) => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const firstToggle = studioPage.accordionToggleButtons.first();
      const initialState = await studioPage.getAccordionOpenState(0);

      // Double click
      await firstToggle.dblclick();
      await page.waitForTimeout(200);

      // Should be back to initial state
      const finalState = await studioPage.getAccordionOpenState(0);
      expect(finalState).toBe(initialState);
    });

    test("ADV-ACCORD-03: Whitespace-only title behavior audit", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const firstCard = studioPage.accordionCards.first();
      const titleInput = firstCard.locator('.rs-field:has-text("Job Title") input');
      await expect(titleInput).toBeVisible();

      // Clear title and set spaces
      await titleInput.fill("   ");
      const titleText = await firstCard.locator(".rs-accordion-title").textContent();
      // Whitespace is trimmed so title falls back to 'Untitled role'
      expect(titleText).toBe("Untitled role");
    });

    test("ADV-ACCORD-04: Removing first open accordion entry removes card cleanly without orphan DOM", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const initialCount = await studioPage.accordionCards.count();
      expect(initialCount).toBeGreaterThan(1);

      // Find role remove button on first card's header
      const removeBtn = studioPage.accordionCards.first().locator('.rs-accordion-header button.rs-action-danger[title*="Remove"]');
      await removeBtn.click();

      const newCount = await studioPage.accordionCards.count();
      expect(newCount).toBe(initialCount - 1);
    });

    test("ADV-ACCORD-05: Live editing reflects in accordion header and survives collapse/expand cycle", async () => {
      await studioPage.goto();
      await studioPage.waitForStudioLoaded();
      await studioPage.selectSection("experience");

      const firstCard = studioPage.accordionCards.first();
      const titleInput = firstCard.locator('.rs-field:has-text("Job Title") input');
      await expect(titleInput).toBeVisible();

      await titleInput.fill("Chief Technology Architect");
      await expect(firstCard.locator(".rs-accordion-title")).toHaveText("Chief Technology Architect");

      // Collapse
      await studioPage.accordionToggleButtons.first().click();
      await expect(firstCard).toHaveClass(/is-collapsed/);
      await expect(firstCard.locator(".rs-accordion-title")).toHaveText("Chief Technology Architect");

      // Re-expand
      await studioPage.accordionToggleButtons.first().click();
      await expect(firstCard).toHaveClass(/is-open/);
      await expect(firstCard.locator(".rs-accordion-title")).toHaveText("Chief Technology Architect");
    });
  });
});
