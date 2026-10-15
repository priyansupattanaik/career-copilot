import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import playwright from "../frontend/node_modules/playwright/index.js";
const { chromium } = playwright;

const VIEWPORTS = [
  { width: 1868, height: 1006, name: "1868x1006" },
  { width: 1440, height: 900, name: "1440x900" },
  { width: 1280, height: 720, name: "1280x720" },
  { width: 1024, height: 768, name: "1024x768" },
  { width: 768, height: 1024, name: "768x1024" },
  { width: 390, height: 844, name: "390x844" },
  { width: 360, height: 640, name: "360x640" },
];

const SECTION_HASHES = ["#resume", "#about", "#background", "#skills", "#preferences"];
const OTHER_SETTINGS_TABS = ["/settings/account", "/settings/preferences", "/settings/privacy"];

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUTPUT_DIR = path.join(os.tmpdir(), "career-copilot-ui-audit", process.argv[2] || "baseline");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const mockResumes = [
  {
    id: "demo-resume-1",
    user_id: "demo-user",
    title: "Priyansu Pattanaik Resume",
    filename: "Priyansu Pattanaik Resume",
    original_filename: "Priyansu_Pattanaik_Resume.pdf",
    extraction_status: "confirmed",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const mockProfile = {
  profile: {
    full_name: "Priyansu Pattanaik",
    username: "priyansupattanaik",
    headline: "Staff UI Engineer",
    location: "San Francisco, CA",
    current_role: "Staff UI Engineer",
    years_experience: 8,
    career_level: "Senior",
    career_goal: "Lead frontend architecture",
    bio: "Passionate about modern web standards.",
    avatar_url: null,
  },
  preferences: {
    target_roles: ["Staff UI Engineer"],
    preferred_locations: ["San Francisco, CA"],
    work_modes: ["hybrid"],
    salary_min: 220000,
    salary_currency: "USD",
  },
};

const mockSkills = [
  { id: "s-1", name: "TypeScript" },
  { id: "s-2", name: "React" },
];
const mockExperiences = [
  { id: "e-1", company: "Acme", title: "Staff UI Engineer", start_date: "2020-01", is_current: true },
];
const mockEducation = [
  { id: "ed-1", institution: "MIT", degree: "BS Computer Science" },
];
const mockLinks = [
  { id: "l-1", link_type: "github", url: "https://github.com/priyansupattanaik" },
];

async function setupPageRoutes(page) {
  await page.route("**/api/backend/resumes*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockResumes),
    });
  });
  await page.route("**/api/backend/profile/skills*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSkills),
    });
  });
  await page.route("**/api/backend/profile/experiences*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockExperiences),
    });
  });
  await page.route("**/api/backend/profile/education*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockEducation),
    });
  });
  await page.route("**/api/backend/profile/links*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockLinks),
    });
  });
  await page.route("**/api/backend/profile*", async (route) => {
    if (route.request().url().includes("/skills") ||
        route.request().url().includes("/experiences") ||
        route.request().url().includes("/education") ||
        route.request().url().includes("/links")) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockProfile),
    });
  });
}

async function runAuditOnPage(page, url, viewport) {
  return await page.evaluate(({ url, vp }) => {
    function isVisible(el) {
      if (!el || !(el instanceof Element)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    // A. Background owners for main content element
    const mainEl = document.querySelector("#main, .workbench-content, main") || document.body;
    const bgOwners = [];
    let curr = mainEl;
    while (curr) {
      const style = window.getComputedStyle(curr);
      const bg = style.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        const rect = curr.getBoundingClientRect();
        bgOwners.push({
          tag: curr.tagName.toLowerCase(),
          className: curr.className || "",
          id: curr.id || "",
          bg,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
      }
      curr = curr.parentElement;
    }

    // B. Alignment
    // breadcrumb, top-bar avatar, Settings tabs row, identity strip, section tabs row, active panel
    const breadcrumb = document.querySelector(".workbench-breadcrumb, [aria-label='Breadcrumbs']");
    const topbarAvatar = document.querySelector(".workbench-avatar-btn, [aria-label*='Account menu']");
    const settingsTabs = document.querySelector(".settings-nav, nav[aria-label='Settings navigation'], nav[aria-label='Settings sections']");
    const identityStrip = document.querySelector(".profile-identity-strip, .profile-overhaul-canvas .rounded-2xl, [data-component='identity-strip'], .identity-strip");
    const sectionTabs = document.querySelector("nav[aria-label='Profile navigation sections'], nav[aria-label='Section navigation'], .sticky-section-tabs, [role='tablist']");
    const activePanel = document.querySelector("[role='tabpanel']:not([hidden]), section[id^='section-'], .settings-card");

    function getCoords(el) {
      if (!el || !isVisible(el)) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    }

    const alignment = {
      breadcrumb: getCoords(breadcrumb),
      topbarAvatar: getCoords(topbarAvatar),
      settingsTabs: getCoords(settingsTabs),
      identityStrip: getCoords(identityStrip),
      sectionTabs: getCoords(sectionTabs),
      activePanel: getCoords(activePanel),
    };

    // Alignment diffs
    const lefts = [alignment.breadcrumb?.left, alignment.settingsTabs?.left, alignment.identityStrip?.left, alignment.sectionTabs?.left, alignment.activePanel?.left].filter(v => v != null);
    const rights = [alignment.topbarAvatar?.right, alignment.settingsTabs?.right, alignment.identityStrip?.right, alignment.sectionTabs?.right, alignment.activePanel?.right].filter(v => v != null);
    const leftSpread = lefts.length > 1 ? Math.max(...lefts) - Math.min(...lefts) : 0;
    const rightSpread = rights.length > 1 ? Math.max(...rights) - Math.min(...rights) : 0;

    // C. Vertical gaps between consecutive page blocks
    // blocks: top bar bottom, Settings tabs, identity strip, section tabs, panel
    const topBar = document.querySelector(".workbench-topbar, header");
    const topBarBottom = topBar ? Math.round(topBar.getBoundingClientRect().bottom) : 0;
    const sTabsTop = settingsTabs ? Math.round(settingsTabs.getBoundingClientRect().top) : null;
    const sTabsBottom = settingsTabs ? Math.round(settingsTabs.getBoundingClientRect().bottom) : null;
    const stripTop = identityStrip ? Math.round(identityStrip.getBoundingClientRect().top) : null;
    const stripBottom = identityStrip ? Math.round(identityStrip.getBoundingClientRect().bottom) : null;
    const secTabsTop = sectionTabs ? Math.round(sectionTabs.getBoundingClientRect().top) : null;
    const secTabsBottom = sectionTabs ? Math.round(sectionTabs.getBoundingClientRect().bottom) : null;
    const panelTop = activePanel ? Math.round(activePanel.getBoundingClientRect().top) : null;

    const verticalGaps = {
      topBarToSettingsTabs: sTabsTop != null ? sTabsTop - topBarBottom : null,
      settingsTabsToStrip: (stripTop != null && sTabsBottom != null) ? stripTop - sTabsBottom : null,
      stripToSectionTabs: (secTabsTop != null && stripBottom != null) ? secTabsTop - stripBottom : null,
      sectionTabsToPanel: (panelTop != null && secTabsBottom != null) ? panelTop - secTabsBottom : null,
    };

    // D. Radii
    const allEls = Array.from(document.querySelectorAll("*")).filter(isVisible);
    const radiiMap = {};
    const allowedRadii = new Set(["0px", "4px", "8px", "12px", "9999px", "50%", "3.35544e+07px"]);
    let invalidRadiiCount = 0;

    allEls.forEach(el => {
      const style = window.getComputedStyle(el);
      const r = style.borderRadius;
      if (r && r !== "0px") {
        radiiMap[r] = (radiiMap[r] || 0) + 1;
        // check if allowed
        const rNorm = r.split(" ")[0];
        if (!allowedRadii.has(rNorm) && !rNorm.endsWith("%")) {
          invalidRadiiCount++;
        }
      }
    });

    // E. Spacing
    // allowed: 0, 1, 4, 8, 12, 16, 20, 24, 32, 48, 64
    const allowedSpacing = new Set([0, 1, 4, 8, 12, 16, 20, 24, 32, 48, 64]);
    let invalidSpacingCount = 0;
    const invalidSpacingValues = {};

    allEls.forEach(el => {
      const style = window.getComputedStyle(el);
      const props = ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
                     "marginTop", "marginBottom", "marginLeft", "marginRight",
                     "rowGap", "columnGap"];
      props.forEach(p => {
        const val = parseFloat(style[p]);
        if (!Number.isNaN(val) && val > 0 && !allowedSpacing.has(Math.round(val))) {
          invalidSpacingCount++;
          const roundVal = Math.round(val);
          invalidSpacingValues[roundVal] = (invalidSpacingValues[roundVal] || 0) + 1;
        }
      });
    });

    // F. Overlaps
    // visible content elements (direct text, img, svg, button, input, select, textarea)
    const contentEls = allEls.filter(el => {
      if (el.closest("[data-allow-overlap]")) return false;
      const tag = el.tagName.toLowerCase();
      if (["img", "svg", "button", "input", "select", "textarea"].includes(tag)) return true;
      // direct text
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) return true;
      }
      return false;
    });

    let overlapCount = 0;
    const overlapPairs = [];
    for (let i = 0; i < contentEls.length; i++) {
      for (let j = i + 1; j < contentEls.length; j++) {
        const a = contentEls[i];
        const b = contentEls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const xOverlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const yOverlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (xOverlap > 1 && yOverlap > 1) {
          overlapCount++;
          if (overlapPairs.length < 10) {
            const getCls = (el) => typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : "";
            overlapPairs.push({
              a: a.tagName + getCls(a),
              b: b.tagName + getCls(b),
              xOverlap,
              yOverlap
            });
          }
        }
      }
    }

    // G. Colours (raw hex / non-tokens / cyan-teal)
    // flag cyan/teal/blue that is not --accent (#6EA8FF / rgb(110, 168, 255))
    let cyanTealCount = 0;
    allEls.forEach(el => {
      const style = window.getComputedStyle(el);
      const colors = [style.color, style.backgroundColor, style.borderColor];
      colors.forEach(c => {
        if (c.includes("0, 255") || c.includes("6, 182, 212") || c.includes("20, 184, 166") || c.includes("34, 211, 238") || c.includes("rgb(6, 182, 212)")) {
          cyanTealCount++;
        }
      });
    });

    // H. Fonts
    // flag text not using Instrument Serif for display, Geist for UI, Geist Mono only for numbers
    let fontViolations = 0;
    allEls.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const style = window.getComputedStyle(el);
      const font = style.fontFamily;
      // if it has direct text
      let hasText = false;
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
          hasText = true;
          break;
        }
      }
      if (!hasText) return;

      const isHeading1 = tag === "h1";
      if (isHeading1) {
        if (!font.toLowerCase().includes("instrument serif")) {
          fontViolations++;
        }
      }
    });

    // I. Heights of buttons, inputs, tabs, chips
    let heightViolations = 0;
    allEls.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();
      const h = Math.round(rect.height);
      const role = el.getAttribute("role");

      if (tag === "button" || el.classList.contains("button") || el.classList.contains("wb-button")) {
        // avatar badge is 28px, chips 24px, buttons 40px (or 44px)
        if (el.classList.contains("chip") || el.classList.contains("wb-chip") || el.classList.contains("badge")) {
          if (h !== 24 && h !== 20) heightViolations++;
        } else if (el.classList.contains("avatar-badge") || el.getAttribute("aria-label") === "Change photo") {
          if (h !== 28) heightViolations++;
        } else if (role === "tab" || el.classList.contains("settings-nav-tab")) {
          if (h !== 44) heightViolations++;
        } else if (el.classList.contains("wb-ghost-link") || el.classList.contains("wb-missing-item-link")) {
          // inline text ghost buttons / links
        } else {
          if (h !== 40 && h !== 44 && !el.closest("[data-allow-overlap]")) {
            heightViolations++;
          }
        }
      }
      if (tag === "input" && el.type !== "checkbox" && el.type !== "radio" && el.type !== "hidden") {
        if (h !== 40 && h !== 44) heightViolations++;
      }
    });

    // J. Horizontal overflow
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const mainOverflow = mainEl.scrollWidth > mainEl.clientWidth + 1;

    // K. Tab sync
    const activeTab = document.querySelector(".profile-section-tabs [role='tab'][aria-selected='true'], [role='tablist'] [role='tab'][aria-selected='true'], [role='tab'][aria-selected='true']");
    const activeTabText = activeTab ? activeTab.textContent.trim() : "";
    const activeHeading = activePanel ? (activePanel.querySelector("h2, h3, h1")?.textContent.trim() || "") : "";

    return {
      bgOwners,
      alignment,
      leftSpread,
      rightSpread,
      verticalGaps,
      radiiMap,
      invalidRadiiCount,
      invalidSpacingCount,
      invalidSpacingValues,
      overlapCount,
      overlapPairs,
      cyanTealCount,
      fontViolations,
      heightViolations,
      horizontalOverflow: docOverflow || mainOverflow,
      tabSync: {
        activeTab: activeTabText,
        panelHeading: activeHeading,
      }
    };
  }, { url, vp: viewport });
}

async function runAudit() {
  console.log(`Starting UI Audit against ${BASE_URL}...`);
  console.log(`Screenshots and reports will be saved to: ${OUTPUT_DIR}`);

  const msPlaywrightDir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  let executablePath;
  if (fs.existsSync(msPlaywrightDir)) {
    const entries = fs.readdirSync(msPlaywrightDir);
    const chromeDir = entries.find(e => e.startsWith("chromium-"));
    if (chromeDir) {
      const p = path.join(msPlaywrightDir, chromeDir, "chrome-win64", "chrome.exe");
      if (fs.existsSync(p)) executablePath = p;
    }
  }
  const browser = await chromium.launch({ headless: true, executablePath });
  const report = {
    timestamp: new Date().toISOString(),
    viewports: {},
    summary: {
      totalViolations: 0,
      ruleCounts: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0 }
    }
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Auditing Viewport ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
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
    await setupPageRoutes(page);

    report.viewports[vp.name] = { sections: {}, settingsTabs: {} };

    // 1. Audit section hashes on /settings/profile
    for (const hash of SECTION_HASHES) {
      const url = `${BASE_URL}/settings/profile${hash}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(400); // allow transitions and DOM render

      const screenshotName = `profile_${hash.replace("#", "")}_${vp.name}.png`;
      await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: false });

      const auditResult = await runAuditOnPage(page, url, vp);
      report.viewports[vp.name].sections[hash] = auditResult;

      // Update summary counts for 1868x1006 baseline
      if (vp.name === "1868x1006") {
        if (auditResult.bgOwners.length > 2) report.summary.ruleCounts.A += (auditResult.bgOwners.length - 2);
        if (auditResult.leftSpread > 2 || auditResult.rightSpread > 2) report.summary.ruleCounts.B += 1;
        // gap check
        Object.values(auditResult.verticalGaps).forEach(g => {
          if (g != null && Math.abs(g - 24) > 2) report.summary.ruleCounts.C += 1;
        });
        report.summary.ruleCounts.D += auditResult.invalidRadiiCount;
        report.summary.ruleCounts.E += auditResult.invalidSpacingCount;
        report.summary.ruleCounts.F += auditResult.overlapCount;
        report.summary.ruleCounts.G += auditResult.cyanTealCount;
        report.summary.ruleCounts.H += auditResult.fontViolations;
        report.summary.ruleCounts.I += auditResult.heightViolations;
        if (auditResult.horizontalOverflow) report.summary.ruleCounts.J += 1;
      }
    }

    // 2. Audit other Settings tabs
    for (const tabPath of OTHER_SETTINGS_TABS) {
      const url = `${BASE_URL}${tabPath}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const tabSlug = tabPath.split("/").pop();
      const screenshotName = `settings_${tabSlug}_${vp.name}.png`;
      await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: false });

      const auditResult = await runAuditOnPage(page, url, vp);
      report.viewports[vp.name].settingsTabs[tabPath] = auditResult;
    }

    await context.close();
  }

  await browser.close();

  const reportPath = path.join(OUTPUT_DIR, "audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nAudit complete! Report written to ${reportPath}`);
  console.log("Summary rule violations at 1868x1006:", report.summary.ruleCounts);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
