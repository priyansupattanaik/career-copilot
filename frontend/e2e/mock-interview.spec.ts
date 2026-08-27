import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([
    { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
  ]);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace")).toBeVisible();
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function assertNoIntersect(page: Page, selectors: string[]) {
  const boxes = await page.evaluate((list) => {
    return list.map((selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { selector, x: r.x, y: r.y, w: r.width, h: r.height };
    });
  }, selectors);
  const visible = boxes.filter(
    (box): box is { selector: string; x: number; y: number; w: number; h: number } =>
      Boolean(box && box.w > 1 && box.h > 1),
  );
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i];
      const b = visible[j];
      const overlap =
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(
        overlap,
        `${a.selector} overlaps ${b.selector}`,
      ).toBe(false);
    }
  }
}

const slogan = "Walk in, pick a focus, and start. The interviewer follows the thread of your answers — no profile required.";

test.describe("mock interview", () => {
  test("hub copy and layout: slogan gone, no overlap", async ({ page }) => {
    await enterDemo(page);

    for (const viewport of [
      { width: 1280, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "mobile" },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/mock-interview", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".interview-hub")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Practice out loud" })).toBeVisible();
      await expect(page.getByText(slogan)).toHaveCount(0);
      await expect(page.getByText(/no profile required/i)).toHaveCount(0);
      await expect(page.locator(".profile-toast")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Start interview" })).toBeVisible();
      await assertNoOverflow(page);
      await assertNoIntersect(page, [".interview-start", ".interview-history"]);
      await page.screenshot({
        path: `test-results/mock-interview-hub-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });

  test("setup page matches hub language and stays aligned", async ({ page }) => {
    await enterDemo(page);
    for (const viewport of [
      { width: 1280, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "mobile" },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/mock-interview/setup", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Set the round, then begin" })).toBeVisible();
      await expect(page.getByText(slogan)).toHaveCount(0);
      await expect(page.getByText(/profile completion is not required/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Start interview" })).toBeVisible();
      await assertNoOverflow(page);
      await page.screenshot({
        path: `test-results/mock-interview-setup-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });

  test("starts a session and keeps room elements from overlapping", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await enterDemo(page);
    await page.goto("/mock-interview", { waitUntil: "domcontentloaded" });

    await page.getByRole("textbox", { name: /role you are practicing for/i }).fill("Backend engineer");
    await page.getByRole("radio", { name: /Technical/ }).check();
    const started = Date.now();
    await page.getByRole("button", { name: "Start interview" }).click();

    await expect(page).toHaveURL(/\/mock-interview\/session\/local-/, { timeout: 5_000 });
    await expect(page.getByRole("heading", { name: /Question 1 of/i })).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - started).toBeLessThan(4000);
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeVisible();
    const answerBox = page.locator(".interview-composer textarea");
    await expect(answerBox).toBeEnabled({ timeout: 20_000 });
    await answerBox.fill(
      "Recently I owned a checkout delay. I profiled the API, cut N+1 queries, and shipped a cache. p95 dropped under 400ms.",
    );
    const answered = Date.now();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByRole("heading", { name: /Question 2 of|Follow-up/i })).toBeVisible({ timeout: 8_000 });
    expect(Date.now() - answered).toBeLessThan(8000);
    await expect(page.locator(".profile-toast")).toHaveCount(0);
    await expect(page.getByText(slogan)).toHaveCount(0);
    await assertNoOverflow(page);
    await assertNoIntersect(page, [
      ".interview-session-bar",
      ".interview-bubble.is-agent",
      ".interview-presence",
      ".interview-composer",
    ]);
    await page.screenshot({
      path: "test-results/mock-interview-session-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".interview-bubble.is-agent h2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeVisible();
    await assertNoOverflow(page);
    await assertNoIntersect(page, [
      ".interview-bubble.is-agent",
      ".interview-presence",
      ".interview-composer-actions",
      ".mobile-bottom-nav",
    ]);
    await page.screenshot({
      path: "test-results/mock-interview-session-mobile.png",
      fullPage: true,
    });
  });

  test("saves the session only after the last answer", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await enterDemo(page);
    await page.goto("/mock-interview", { waitUntil: "domcontentloaded" });
    await page.locator(".interview-length-chip", { hasText: "3" }).click();
    await page.getByRole("button", { name: "Start interview" }).click();
    await expect(page).toHaveURL(/\/mock-interview\/session\/local-/);

    const answer =
      "Recently I owned a checkout delay. The situation was p95 over two seconds. I profiled the API, cut N+1 queries, and shipped a cache. The result was p95 under 400ms.";
    const box = page.locator(".interview-composer textarea");
    const heading = page.locator(".interview-session-bar h1");
    for (let step = 0; step < 8; step += 1) {
      if (/\/mock-interview\/report\//.test(page.url())) break;
      await expect(box).toBeEnabled({ timeout: 20_000 });
      const currentHeading = ((await heading.textContent()) || "").trim();
      await box.fill(answer);
      await page.getByRole("button", { name: "Submit answer" }).click();
      await Promise.race([
        page.waitForURL(/\/mock-interview\/report\//, { timeout: 20_000 }),
        heading.filter({ hasNotText: currentHeading }).waitFor({ state: "visible", timeout: 20_000 }),
      ]);
    }
    await expect(page).toHaveURL(/\/mock-interview\/report\//, { timeout: 5_000 });
    await expect(page.locator(".interview-report")).toBeVisible();
    await expect(page.getByRole("heading", { name: /debrief/i })).toBeVisible();
  });

  test("report page is readable on desktop and mobile", async ({ page }) => {
    await enterDemo(page);
    for (const viewport of [
      { width: 1280, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "mobile" },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/mock-interview/report/demo-interview-4", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".interview-report")).toBeVisible();
      await expect(page.getByText(slogan)).toHaveCount(0);
      await assertNoOverflow(page);
      await page.screenshot({
        path: `test-results/mock-interview-report-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });
});
