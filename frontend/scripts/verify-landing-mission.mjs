import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const viewports = [
  [360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 800],
  [1366, 768], [1440, 900], [1512, 982], [1920, 1080],
];
const routes = ["/", "/sign-in", "/sign-up", "/resume-analysis", "/mock-interview/preparation", "/community", "/teams"];
const browser = await chromium.launch({ headless: true, ...(browsersPath ? {} : {}) });
const context = await browser.newContext({ colorScheme: "dark" });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(String(error)));

for (const route of routes) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 60000 });
  if (!response?.ok()) throw new Error(`${route} returned ${response?.status()}`);
}
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
for (const [width, height] of viewports) {
  await page.setViewportSize({ width, height });
  await page.reload({ waitUntil: "domcontentloaded" });
  const result = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    h1: Boolean(document.querySelector("h1")),
  }));
  if (!result.h1 || result.scrollWidth > result.width) {
    throw new Error(`overflow or missing hero at ${width}x${height}: ${JSON.stringify(result)}`);
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({ path: "test-results/landing-1440x900.png", fullPage: false });
const canvas = await page.locator(".landing-dot-pattern").count();
if (canvas !== 1) throw new Error(`expected one landing dot canvas, found ${canvas}`);
const beforeClock = await page.locator(".home-window-top").innerText();
await page.waitForTimeout(1200);
const afterClock = await page.locator(".home-window-top").innerText();
if (beforeClock === afterClock) throw new Error("practice clock did not advance");
await page.waitForTimeout(3400);
const hasAnswer = await page.locator(".home-demo-answer--visible").count();
if (!hasAnswer) throw new Error("simulator did not advance into the typing/answer phase");
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/landing-390x844.png", fullPage: false });
const theme = await page.locator(".landing-dot-pattern").evaluate((node) => getComputedStyle(node).zIndex);
if (theme !== "0") throw new Error(`dot canvas stacking is ${theme}, expected 0`);
if (errors.length) throw new Error(`console errors: ${errors.slice(0, 5).join(" | ")}`);
console.log(`PASS mission smoke: ${routes.length} routes, ${viewports.length} viewports, clock, simulator phase, canvas, and console clean`);
await browser.close();
