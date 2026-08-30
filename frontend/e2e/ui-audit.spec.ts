import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
] as const;

const PUBLIC_ROUTES = ["/", "/teams", "/sign-in", "/sign-up"];
const WORKSPACE_ROUTES = [
  "/dashboard",
  "/resume-analysis",
  "/resume-analysis?tab=upload",
  "/resume-analysis?tab=resumes",
  "/mock-interview",
  "/mock-interview/setup",
  "/mock-interview/preparation",
  "/learning",
  "/learning/demo-path-1",
  "/jobs",
  "/jobs/saved",
  "/community",
  "/settings/profile",
  "/settings/account",
  "/settings/preferences",
  "/settings/privacy",
];

type Finding = {
  route: string;
  viewport: string;
  kind: string;
  detail: string;
};

async function enterDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .context()
    .addCookies([
      {
        name: "career_copilot_demo",
        value: "1",
        url: new URL(page.url()).origin,
      },
    ]);
}

async function auditPage(
  page: Page,
  route: string,
  viewportName: string,
): Promise<Finding[]> {
  return page.evaluate(
    ({ routeName, vp }) => {
      const findings: Finding[] = [];
      const doc = document.documentElement;
      const overflowX = Math.round(doc.scrollWidth - doc.clientWidth);
      if (overflowX > 2) {
        findings.push({
          route: routeName,
          viewport: vp,
          kind: "overflow-x",
          detail: `horizontal overflow ${overflowX}px (scrollWidth=${doc.scrollWidth}, clientWidth=${doc.clientWidth})`,
        });
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const skip = new Set(["SCRIPT", "STYLE", "META", "LINK", "NOSCRIPT"]);
      const candidates = Array.from(document.querySelectorAll("body *")).filter(
        (el) => {
          if (skip.has(el.tagName)) return false;
          const style = getComputedStyle(el);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          )
            return false;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) return false;
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw)
            return false;
          return true;
        },
      );

      for (const el of candidates) {
        if (el.closest("svg, .aurora-background-field, .profile-tabs"))
          continue;
        const style = getComputedStyle(el);
        if (style.position === "fixed" || style.position === "absolute")
          continue;
        const r = el.getBoundingClientRect();
        if (r.left < -2 || r.right > vw + 2) {
          const cls =
            (el as HTMLElement).className?.toString?.().slice(0, 80) ||
            el.tagName.toLowerCase();
          findings.push({
            route: routeName,
            viewport: vp,
            kind: "off-viewport-x",
            detail: `${el.tagName.toLowerCase()}.${cls} left=${Math.round(r.left)} right=${Math.round(r.right)} vw=${vw}`,
          });
        }
      }

      const layoutSelectors = [
        ".sidebar",
        ".app-header",
        ".mobile-bottom-nav",
        ".page-heading h1",
        ".page-heading-actions",
        ".lp-title",
        ".lp-masthead-actions",
        ".ra-title",
        ".ra-segnav",
        ".jobs-radar-copy",
        ".jobs-radar-intro",
        ".community-search-form",
        ".dashboard-metrics",
        ".interview-progress-panel",
        ".activity-feed",
        ".lp-studio",
        ".lp-curriculum",
        ".lp-lesson",
        ".sidebar-profile-card",
        ".sidebar-account-menu",
      ];
      const boxes = layoutSelectors
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden")
            return null;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          return { selector, x: r.x, y: r.y, w: r.width, h: r.height };
        })
        .filter(
          (
            row,
          ): row is {
            selector: string;
            x: number;
            y: number;
            w: number;
            h: number;
          } => Boolean(row),
        );

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const elA = document.querySelector(a.selector);
          const elB = document.querySelector(b.selector);
          if (elA && elB && (elA.contains(elB) || elB.contains(elA))) continue;
          const posA = elA ? getComputedStyle(elA).position : "";
          const posB = elB ? getComputedStyle(elB).position : "";
          if (posA === "fixed" || posB === "fixed") continue;
          const overlap =
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y;
          if (!overlap) continue;
          const ix = Math.max(
            0,
            Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
          );
          const iy = Math.max(
            0,
            Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
          );
          if (ix < 8 || iy < 8) continue;
          findings.push({
            route: routeName,
            viewport: vp,
            kind: "overlap",
            detail: `${a.selector} overlaps ${b.selector} (${Math.round(ix)}×${Math.round(iy)})`,
          });
        }
      }

      const headings = Array.from(
        document.querySelectorAll("h1, h2, .button, .lp-title, .ra-title"),
      );
      for (const el of headings) {
        const html = el as HTMLElement;
        if (
          html.scrollWidth > html.clientWidth + 4 &&
          getComputedStyle(html).overflow !== "visible"
        ) {
          findings.push({
            route: routeName,
            viewport: vp,
            kind: "text-clip",
            detail: `${el.tagName.toLowerCase()}.${html.className.toString().slice(0, 60)} clipped`,
          });
        }
      }

      const fonts = Array.from(
        new Set(
          [
            document.body,
            ...Array.from(document.querySelectorAll("h1, h2, h3")),
          ].map((node) => getComputedStyle(node).fontFamily.toLowerCase()),
        ),
      );
      for (const family of fonts) {
        if (!/outfit/.test(family)) {
          findings.push({
            route: routeName,
            viewport: vp,
            kind: "font",
            detail: `unexpected font ${family}`,
          });
        }
      }

      return findings;
    },
    { routeName: route, vp: viewportName },
  );
}

test("all pages stay aligned across desktop, tablet, and phone", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const findings: Finding[] = [];
  const shotDir = path.join(testInfo.project.outputDir, "ui-audit");
  fs.mkdirSync(shotDir, { recursive: true });

  await enterDemo(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    for (const route of [...PUBLIC_ROUTES, ...WORKSPACE_ROUTES]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page
        .locator(".feature-loading")
        .waitFor({ state: "detached", timeout: 20_000 })
        .catch(() => undefined);
      await page
        .waitForFunction(
          () => {
            if (document.querySelector(".feature-loading")) return false;
            return Array.from(
              document.querySelectorAll("h1, h2, .lp-title, .ra-title"),
            ).some((node) => {
              const box = node.getBoundingClientRect();
              return box.width > 8 && box.height > 8;
            });
          },
          { timeout: 20_000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(200);
      const safe = `${viewport.name}${route.replace(/[/?=]/g, "-") || "-home"}`;
      await page.screenshot({
        path: path.join(shotDir, `${safe}.png`),
        fullPage: true,
      });
      findings.push(...(await auditPage(page, route, viewport.name)));
    }
  }

  const reportPath = path.join(shotDir, "findings.json");
  fs.writeFileSync(reportPath, JSON.stringify(findings, null, 2));
  const unique = findings.filter(
    (row) => row.kind !== "off-viewport-x" || !row.detail.includes("svg"),
  );
  if (unique.length) {
    console.log(
      `UI_AUDIT_FINDINGS ${unique.length}\n${unique.map((row) => `[${row.viewport}] ${row.route} ${row.kind}: ${row.detail}`).join("\n")}`,
    );
  }
  expect(
    unique,
    unique
      .map((row) => `[${row.viewport}] ${row.route} ${row.kind}: ${row.detail}`)
      .join("\n"),
  ).toEqual([]);
});
