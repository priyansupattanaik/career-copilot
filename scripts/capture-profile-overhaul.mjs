import pkg from "../frontend/node_modules/@playwright/test/index.js";
const { chromium } = pkg;
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { name: "390x844_mobile", width: 390, height: 844 },
  { name: "1024x768_tablet", width: 1024, height: 768 },
  { name: "1440x900_desktop", width: 1440, height: 900 },
];

async function main() {
  const outDir = path.resolve("scripts/screenshots/overhaul");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Launching browser via msedge...");
  const browser = await chromium.launch({
    headless: true,
    channel: "msedge",
  });

  const context = await browser.newContext({
    colorScheme: "dark",
  });

  await context.addCookies([
    {
      name: "career_copilot_demo",
      value: "1",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  for (const vp of VIEWPORTS) {
    console.log(`Capturing viewport ${vp.name}...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const url = "http://127.0.0.1:3000/settings/profile";
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Capture main profile page
    const file = path.join(outDir, `profile_${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`Saved ${file}`);

    // Capture full-page scroll
    const fullFile = path.join(outDir, `profile_${vp.name}_full.png`);
    await page.screenshot({ path: fullFile, fullPage: true });
    console.log(`Saved full page: ${fullFile}`);
  }

  // Also test hash navigation on desktop
  console.log("Testing section scroll on desktop...");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const hash of ["#skills", "#preferences", "#background"]) {
    await page.goto(`http://127.0.0.1:3000/settings/profile${hash}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const file = path.join(outDir, `profile_desktop_hash_${hash.replace("#", "")}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`Saved ${file}`);
  }

  await browser.close();
  console.log("All overhaul screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
