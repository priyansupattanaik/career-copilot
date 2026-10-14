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
      const clampedX = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const clampedY = Math.max(0, Math.min(height - 1, Math.floor(y)));
      const idx = (clampedY * width + clampedX) * 4;
      return {
        r: pixels[idx],
        g: pixels[idx + 1],
        b: pixels[idx + 2],
        a: pixels[idx + 3],
      };
    },
  };
}

function sRGBtoLin(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function rgbLum(r, g, b) {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function hexLum(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return rgbLum(r, g, b);
}

function computeContrast(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const INK_LUM = hexLum("#E8F0F8");
const INK2_LUM = hexLum("#A5B3C5");
const INK3_LUM = hexLum("#8493A6");

const VIEWPORTS = [
  { width: 390, height: 844, name: "390x844" },
  { width: 1024, height: 768, name: "1024x768" },
  { width: 1440, height: 900, name: "1440x900" },
];

const SCREENS = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/resume-analysis", name: "resume-analysis" },
  { path: "/mock-interview", name: "mock-interview" },
  { path: "/learning", name: "learning" },
  { path: "/jobs", name: "jobs" },
  { path: "/community", name: "community" },
];

async function main() {
  const screenshotsDir = path.resolve("..", "scripts/screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log("Launching browser via msedge channel...");
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

  const report = {
    screenshots: [],
    meshSampling: {},
    keyboardWalkthrough: {},
  };

  console.log("--- 1. SCREENSHOTS & MESH PIXEL SAMPLING ---");

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const screen of SCREENS) {
      const url = `http://127.0.0.1:3000${screen.path}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const filename = `${screen.name}_${vp.name}.png`;
      const filePath = path.join(screenshotsDir, filename);
      const buffer = await page.screenshot({ path: filePath, fullPage: false });
      report.screenshots.push({ screen: screen.name, viewport: vp.name, filename });

      // On 1440x900 desktop dashboard, sample pixels behind text directly on the mesh
      if (vp.name === "1440x900" && screen.name === "dashboard") {
        const png = parsePngRgba(buffer);
        const w = png.width;
        const h = png.height;

        function getCompositedPixel(x, y) {
          const raw = png.getPixel(x, y);
          const a = raw.a / 255;
          return {
            r: Math.round(raw.r * a),
            g: Math.round(raw.g * a),
            b: Math.round(raw.b * a),
            a: 255,
          };
        }

        // Top-left bloom is -top-[16%] -left-[10%]
        // Sample location directly over the bloom behind header/sidebar area (x: 120, y: 70)
        const pTopLeft = getCompositedPixel(120, 70);
        const lumTopLeft = rgbLum(pTopLeft.r, pTopLeft.g, pTopLeft.b);

        // Top-right bloom is top-[8%] -right-[12%]
        // Sample location near top-right behind actions (x: w - 160, y: 70)
        const pTopRight = getCompositedPixel(w - 160, 70);
        const lumTopRight = rgbLum(pTopRight.r, pTopRight.g, pTopRight.b);

        // Bottom-centre bloom is -bottom-[18%] left-[20%]
        // Sample location near bottom centre (x: Math.floor(w * 0.35), y: h - 60)
        const pBottomCentre = getCompositedPixel(Math.floor(w * 0.35), h - 60);
        const lumBottomCentre = rgbLum(pBottomCentre.r, pBottomCentre.g, pBottomCentre.b);

        report.meshSampling = {
          topLeftBloom: {
            pixel: pTopLeft,
            contrastInk: computeContrast(INK_LUM, lumTopLeft),
            contrastInk2: computeContrast(INK2_LUM, lumTopLeft),
            contrastInk3: computeContrast(INK3_LUM, lumTopLeft),
          },
          topRightBloom: {
            pixel: pTopRight,
            contrastInk: computeContrast(INK_LUM, lumTopRight),
            contrastInk2: computeContrast(INK2_LUM, lumTopRight),
            contrastInk3: computeContrast(INK3_LUM, lumTopRight),
          },
          bottomCentreBloom: {
            pixel: pBottomCentre,
            contrastInk: computeContrast(INK_LUM, lumBottomCentre),
            contrastInk2: computeContrast(INK2_LUM, lumBottomCentre),
            contrastInk3: computeContrast(INK3_LUM, lumBottomCentre),
          },
        };
      }
    }
  }

  console.log("--- 2. KEYBOARD WALKTHROUGH ON ALL 6 SCREENS ---");
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const screen of SCREENS) {
    const url = `http://127.0.0.1:3000${screen.path}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const interactiveInfo = [];
    // Tab up to 8 times per screen to verify interactive elements
    for (let tabIdx = 0; tabIdx < 8; tabIdx++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(50);

      const focusDetails = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          className: el.className ? String(el.className).slice(0, 60) : "",
          outline: style.outline,
          outlineOffset: style.outlineOffset,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          visible: rect.width > 0 && rect.height > 0,
        };
      });

      if (focusDetails) {
        interactiveInfo.push(focusDetails);
      }
    }

    report.keyboardWalkthrough[screen.name] = {
      testedTabs: interactiveInfo.length,
      sampleElements: interactiveInfo.slice(0, 4),
    };
  }

  await browser.close();

  fs.writeFileSync(
    path.join(screenshotsDir, "cold-verification-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n=== MESH PIXEL SAMPLING RESULTS ===");
  console.log("Top-left bloom RGB:", report.meshSampling.topLeftBloom.pixel);
  console.log("  ink   contrast:", report.meshSampling.topLeftBloom.contrastInk.toFixed(2) + ":1 (target >= 13:1)");
  console.log("  ink-2 contrast:", report.meshSampling.topLeftBloom.contrastInk2.toFixed(2) + ":1 (target >= 7:1)");
  console.log("  ink-3 contrast:", report.meshSampling.topLeftBloom.contrastInk3.toFixed(2) + ":1 (target >= 4.5:1)");

  console.log("\nTop-right bloom RGB:", report.meshSampling.topRightBloom.pixel);
  console.log("  ink   contrast:", report.meshSampling.topRightBloom.contrastInk.toFixed(2) + ":1 (target >= 13:1)");
  console.log("  ink-2 contrast:", report.meshSampling.topRightBloom.contrastInk2.toFixed(2) + ":1 (target >= 7:1)");
  console.log("  ink-3 contrast:", report.meshSampling.topRightBloom.contrastInk3.toFixed(2) + ":1 (target >= 4.5:1)");

  console.log("\nBottom-centre bloom RGB:", report.meshSampling.bottomCentreBloom.pixel);
  console.log("  ink   contrast:", report.meshSampling.bottomCentreBloom.contrastInk.toFixed(2) + ":1 (target >= 13:1)");
  console.log("  ink-2 contrast:", report.meshSampling.bottomCentreBloom.contrastInk2.toFixed(2) + ":1 (target >= 7:1)");
  console.log("  ink-3 contrast:", report.meshSampling.bottomCentreBloom.contrastInk3.toFixed(2) + ":1 (target >= 4.5:1)");

  console.log("\n=== KEYBOARD WALKTHROUGH RESULTS ===");
  for (const [screenName, kw] of Object.entries(report.keyboardWalkthrough)) {
    console.log(`Screen: ${screenName.padEnd(16)} | Elements focused: ${kw.testedTabs}`);
    for (const el of kw.sampleElements) {
      console.log(`  <${el.tagName}> outline: ${el.outlineWidth} ${el.outlineStyle} ${el.outlineColor} offset: ${el.outlineOffset}`);
    }
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
