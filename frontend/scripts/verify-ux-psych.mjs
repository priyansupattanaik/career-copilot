import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function parsePngRgba(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const compressedData = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressedData);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);

  let srcOffset = 0;
  let destOffset = 0;
  const rowBuffer = Buffer.alloc(stride);
  const prevRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOffset++];
    for (let x = 0; x < stride; x++) {
      const b = decompressed[srcOffset++];
      const a = x >= bytesPerPixel ? rowBuffer[x - bytesPerPixel] : 0;
      const c = prevRow[x];
      const d = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

      let val = b;
      if (filter === 1) val = (b + a) & 0xff;
      else if (filter === 2) val = (b + c) & 0xff;
      else if (filter === 3) val = (b + Math.floor((a + c) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + c - d;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - c);
        const pc = Math.abs(p - d);
        let pr = a;
        if (pb < pa && pb <= pc) pr = c;
        else if (pc < pa && pc < pb) pr = d;
        val = (b + pr) & 0xff;
      }
      rowBuffer[x] = val;
    }
    rowBuffer.copy(pixels, destOffset);
    rowBuffer.copy(prevRow);
    destOffset += stride;
  }

  return {
    width,
    height,
    getPixel(x, y) {
      const idx = (y * width + x) * 4;
      return {
        r: pixels[idx],
        g: pixels[idx + 1],
        b: pixels[idx + 2],
        a: pixels[idx + 3],
      };
    },
  };
}

const VIEWPORTS = [
  { width: 360, height: 640, name: "360x640" },
  { width: 390, height: 844, name: "390x844" },
  { width: 768, height: 1024, name: "768x1024" },
  { width: 1024, height: 768, name: "1024x768" },
  { width: 1280, height: 720, name: "1280x720" },
  { width: 1440, height: 900, name: "1440x900" },
  { width: 1920, height: 1080, name: "1920x1080" },
  { width: 844, height: 390, name: "844x390-landscape" },
];

const SCREENS = [
  { path: "/dashboard", name: "dashboard", primarySelector: ".wb-button-primary" },
  { path: "/resume-analysis", name: "resume-analysis", primarySelector: ".wb-tabs" },
  { path: "/mock-interview", name: "mock-interview", primarySelector: 'button[type="submit"]' },
  { path: "/learning", name: "learning", primarySelector: ".wb-page-header-actions button" },
  { path: "/jobs", name: "jobs", primarySelector: '[data-testid="freehire-sync"]' },
  { path: "/community", name: "community", primarySelector: '.wb-community-search-bar button' },
];

async function main() {
  const screenshotsDir = path.resolve("d:/My Creations/career-copilot/scripts/screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    colorScheme: "dark",
  });

  // Set demo authentication cookie
  await context.addCookies([
    {
      name: "career_copilot_demo",
      value: "1",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const results = {
    screens: [],
    oledSampling: {},
    scrollBudget: {},
    horizontalScrollIssues: [],
    phoneLandscape: {},
    moreSheet: {},
    accountMenu: {},
    consoleErrors,
  };

  console.log("Starting verification across 8 viewports and 6 screens...");

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const screen of SCREENS) {
      await page.goto(`http://127.0.0.1:3000${screen.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(100);

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      if (overflow.hasOverflow) {
        results.horizontalScrollIssues.push({
          viewport: vp.name,
          screen: screen.name,
          ...overflow,
        });
      }

      // Check primary action visibility for scroll budget
      if (vp.name === "1280x720" || vp.name === "390x844") {
        const isActionVisible = await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        }, screen.primarySelector);

        results.scrollBudget[`${screen.name}@${vp.name}`] = {
          selector: screen.primarySelector,
          visibleWithoutScroll: isActionVisible,
        };
      }

      // Take screenshot
      const filename = `${screen.name}_${vp.name}.png`;
      const filePath = path.join(screenshotsDir, filename);
      const buffer = await page.screenshot({ path: filePath });

      // If desktop 1280x720 dashboard, perform OLED pixel sampling at 4 corners and center
      if (vp.name === "1280x720" && screen.name === "dashboard") {
        const png = parsePngRgba(buffer);
        const w = png.width;
        const h = png.height;
        results.oledSampling = {
          topLeft: png.getPixel(2, 2),
          topRight: png.getPixel(w - 3, 2),
          bottomLeft: png.getPixel(2, h - 3),
          bottomRight: png.getPixel(w - 3, h - 3),
          centerMesh: png.getPixel(Math.floor(w / 2), Math.floor(h / 2)),
          bareOledBlackSample: png.getPixel(Math.floor(w * 0.15), Math.floor(h * 0.7)),
        };
      }

      results.screens.push({
        name: screen.name,
        viewport: vp.name,
        filename,
      });
    }
  }

  // Verify Phone Landscape (844x390) specifically
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "networkidle" });
  const landscapeState = await page.evaluate(() => {
    const bottomBar = document.querySelector(".workbench-bottom-bar");
    const labels = document.querySelectorAll(".workbench-tab-label");
    const sidebar = document.querySelector(".workbench-sidebar");
    const bbStyle = bottomBar ? window.getComputedStyle(bottomBar) : null;
    const sbStyle = sidebar ? window.getComputedStyle(sidebar) : null;
    let anyLabelVisible = false;
    labels.forEach((l) => {
      if (window.getComputedStyle(l).display !== "none") anyLabelVisible = true;
    });

    return {
      sidebarDisplay: sbStyle?.display,
      bottomBarDisplay: bbStyle?.display,
      bottomBarHeight: bbStyle?.height,
      labelsHidden: !anyLabelVisible,
    };
  });
  results.phoneLandscape = landscapeState;

  // Verify Mobile More sheet on 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "networkidle" });
  const moreBtn = await page.$('button[aria-label="More navigation options"]');
  if (moreBtn) {
    await moreBtn.click();
    await page.waitForTimeout(200);
    const sheetVisible = await page.evaluate(() => {
      const sheet = document.querySelector(".wb-sheet-content");
      return Boolean(sheet && window.getComputedStyle(sheet).display !== "none");
    });
    // Test Escape to close
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const sheetClosed = await page.evaluate(() => {
      const sheet = document.querySelector(".wb-sheet-content");
      return !sheet || window.getComputedStyle(sheet).display === "none";
    });

    results.moreSheet = {
      opened: sheetVisible,
      closedOnEscape: sheetClosed,
    };
  }

  // Verify Avatar DropdownMenu on 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "networkidle" });
  const avatarBtn = await page.$(".workbench-avatar-btn");
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(200);
    const menuVisible = await page.evaluate(() => {
      const menu = document.querySelector(".wb-dropdown-content");
      return Boolean(menu && window.getComputedStyle(menu).display !== "none");
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    results.accountMenu = {
      opened: menuVisible,
    };
  }

  await browser.close();

  fs.writeFileSync(
    path.join(screenshotsDir, "verification-report.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("Playwright verification finished successfully!");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
