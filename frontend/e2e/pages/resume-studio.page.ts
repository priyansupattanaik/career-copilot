import { type Page, type Locator, expect } from "@playwright/test";

export class ResumeStudioPage {
  readonly page: Page;

  // Shell & Navigation
  readonly studioContainer: Locator;
  readonly outlineNav: Locator;
  readonly outlineItems: Locator;
  readonly outlineButtons: Locator;
  readonly outlineBadges: Locator;
  readonly outlineMoveUpButtons: Locator;
  readonly outlineMoveDownButtons: Locator;

  // Accordions & Form Editor
  readonly accordionCards: Locator;
  readonly accordionHeaders: Locator;
  readonly accordionToggleButtons: Locator;
  readonly accordionTitles: Locator;
  readonly accordionSubtitles: Locator;
  readonly accordionDateBadges: Locator;
  readonly accordionBodies: Locator;

  // Preview & Swiss Styling
  readonly previewViewport: Locator;
  readonly previewFlow: Locator;
  readonly previewHeadings: Locator;
  readonly previewName: Locator;

  // Side-by-Side JD Comparison
  readonly jdComparisonContainer: Locator;
  readonly jdInputTextarea: Locator;
  readonly jdStatsBar: Locator;
  readonly matchRateBadge: Locator;
  readonly matchedChips: Locator;
  readonly missingChips: Locator;
  readonly keywordMarks: Locator;

  // Tailoring Depth Controls
  readonly tailoringSelectTrigger: Locator;
  readonly tailoringOptions: Locator;
  readonly visibleNativeSelects: Locator;

  // Themes & Primitives
  readonly htmlRoot: Locator;
  readonly leftTabs: Locator;
  readonly mobileTabs: Locator;

  constructor(page: Page) {
    this.page = page;

    // Shell
    this.studioContainer = page.locator(".rs-studio");
    this.outlineNav = page.locator(".rs-nav");
    this.outlineItems = page.locator(".rs-nav-item");
    this.outlineButtons = page.locator(".rs-nav-select-btn");
    this.outlineBadges = page.locator(".rs-nav-badge");
    this.outlineMoveUpButtons = page.locator('button.rs-nav-btn[title*="up"], button.rs-nav-btn[aria-label*="up"]');
    this.outlineMoveDownButtons = page.locator('button.rs-nav-btn[title*="down"], button.rs-nav-btn[aria-label*="down"]');

    // Accordions
    this.accordionCards = page.locator(".rs-accordion-card");
    this.accordionHeaders = page.locator(".rs-accordion-header");
    this.accordionToggleButtons = page.locator(".rs-accordion-toggle-btn");
    this.accordionTitles = page.locator(".rs-accordion-title");
    this.accordionSubtitles = page.locator(".rs-accordion-subtitle");
    this.accordionDateBadges = page.locator(".rs-date-badge");
    this.accordionBodies = page.locator(".rs-accordion-body");

    // Preview
    this.previewViewport = page.locator(".rs-preview-viewport, .rs-preview-stage");
    this.previewFlow = page.locator(".rs-flow");
    this.previewHeadings = page.locator(".rs-flow .rs-heading");
    this.previewName = page.locator(".rs-flow .rs-name");

    // JD Comparison
    this.jdComparisonContainer = page.locator(
      ".rs-jd-comparison, [data-testid='jd-comparison-view'], .rs-comparison-view, .rs-jd-panel"
    );
    this.jdInputTextarea = page.locator(
      ".rs-jd-input, textarea[placeholder*='job description' i], [data-testid='jd-raw-text']"
    );
    this.jdStatsBar = page.locator(".rs-jd-stats, [data-testid='jd-stats-bar'], .rs-stats-banner");
    this.matchRateBadge = page.locator(
      ".rs-match-badge, [data-testid='match-percentage'], .rs-badge-match, .rs-match-rate"
    );
    this.matchedChips = page.locator(
      ".rs-chip-matched, [data-status='matched'], .rs-matched-chip, [data-testid='matched-chip']"
    );
    this.missingChips = page.locator(
      ".rs-chip-missing, [data-status='missing'], .rs-missing-chip, [data-testid='missing-chip']"
    );
    this.keywordMarks = page.locator(".rs-flow mark, mark.bg-yellow-200, .rs-keyword-highlight");

    // Tailoring
    this.tailoringSelectTrigger = page.locator(
      "[data-testid='tailoring-depth-select'] button[role='combobox'], .rs-tailoring-select button[role='combobox'], .cc-select-trigger"
    );
    this.tailoringOptions = page.locator(".cc-select-menu [role='option'], [role='listbox'] [role='option']");
    this.visibleNativeSelects = page.locator("select:visible");

    // Global
    this.htmlRoot = page.locator("html");
    this.leftTabs = page.locator(".rs-left-tab");
    this.mobileTabs = page.locator(".rs-mobile-tabs button");
  }

  async goto(query = "") {
    const url = `/resume-studio${query ? `?${query.replace(/^\?/, "")}` : ""}`;
    await this.page.goto(url);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForStudioLoaded() {
    await expect(this.studioContainer).toBeVisible({ timeout: 15_000 });
  }

  async selectSection(name: string) {
    const btn = this.outlineButtons.filter({ hasText: new RegExp(name, "i") });
    await btn.first().click();
  }

  async getSectionOrder(): Promise<string[]> {
    const count = await this.outlineButtons.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await this.outlineButtons.nth(i).locator(".rs-nav-name").textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  async moveSectionUp(name: string) {
    const item = this.outlineItems.filter({ hasText: new RegExp(name, "i") }).first();
    const upBtn = item.locator('button.rs-nav-btn[title*="up"], button.rs-nav-btn[aria-label*="up"]');
    await upBtn.click();
  }

  async moveSectionDown(name: string) {
    const item = this.outlineItems.filter({ hasText: new RegExp(name, "i") }).first();
    const downBtn = item.locator('button.rs-nav-btn[title*="down"], button.rs-nav-btn[aria-label*="down"]');
    await downBtn.click();
  }

  async toggleAccordion(index = 0) {
    await this.accordionToggleButtons.nth(index).click();
  }

  async getAccordionOpenState(index = 0): Promise<boolean> {
    const card = this.accordionCards.nth(index);
    const classes = (await card.getAttribute("class")) || "";
    return classes.includes("is-open");
  }

  async setTailoringDepth(optionText: "Light nudge" | "Keyword enhance" | "Full tailor") {
    // Open the tailoring depth combobox
    const trigger = this.tailoringSelectTrigger.first();
    await trigger.click();
    // Select option from portal menu
    const option = this.tailoringOptions.filter({ hasText: optionText }).first();
    await option.click();
  }

  async setTheme(theme: "light" | "dark") {
    await this.page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.style.colorScheme = t;
    }, theme);
  }

  async verifyZeroNativeSelects() {
    const count = await this.visibleNativeSelects.count();
    expect(count).toBe(0);
  }
}
