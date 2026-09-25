import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("settings card layout & padding", () => {
  const profileV2CssPath = path.resolve(__dirname, "../profile-v2.css");
  const globalsCssPath = path.resolve(__dirname, "../../../globals.css");
  const settingsTsxPath = path.resolve(__dirname, "../components/settings.tsx");
  const profileV2Css = fs.readFileSync(profileV2CssPath, "utf8");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
  const settingsTsx = fs.readFileSync(settingsTsxPath, "utf8");

  it("defines --ps-28 and --ps-6 spacing tokens in profile-v2.css scale", () => {
    expect(profileV2Css).toMatch(/--ps-28:\s*28px;/);
    expect(profileV2Css).toMatch(/--ps-6:\s*6px;/);
  });

  it("defines responsive spacing overrides in profile-v2.css @media (max-width: 720px)", () => {
    expect(profileV2Css).toMatch(/@media\s*\(max-width:\s*720px\)[^}]+--ps-28:\s*20px;/);
    expect(profileV2Css).toMatch(/@media\s*\(max-width:\s*720px\)[^}]+--ps-24:\s*20px;/);
  });

  it("ensures no undefined --ps-* variables are used without fallbacks in profile-v2.css", () => {
    const definedVars = new Set(
      Array.from(profileV2Css.matchAll(/(--ps-[a-zA-Z0-9-]+)\s*:/g)).map((m) => m[1])
    );
    const usedVars = Array.from(
      profileV2Css.matchAll(/var\((--ps-[a-zA-Z0-9-]+)(?:,\s*([^)]+))?\)/g)
    );
    for (const [, varName, fallback] of usedVars) {
      const isDefined = definedVars.has(varName);
      const hasFallback = Boolean(fallback && fallback.trim().length > 0);
      expect(
        isDefined || hasFallback,
        `Variable ${varName} is neither defined in scale nor has a fallback in profile-v2.css`
      ).toBe(true);
    }
  });

  it("applies generous internal padding to .settings-card in profile-v2.css with broad selectors", () => {
    expect(profileV2Css).toContain(".settings-card");
    expect(profileV2Css).toMatch(/padding:\s*var\(--ps-24[^;]*!important/);
    expect(profileV2Css).toContain("box-sizing: border-box !important");
    expect(profileV2Css).toContain(".settings-canvas .settings-card");
    expect(profileV2Css).toContain(".feature-page.settings-page .settings-card");
  });

  it("provides responsive padding for .settings-card at mobile breakpoints", () => {
    expect(profileV2Css).toMatch(/@media\s*\(max-width:\s*720px\)[^}]*\{[\s\S]*?padding:\s*20px\s+20px\s*!important/);
    expect(profileV2Css).toMatch(/@media\s*\(max-width:\s*560px\)[^}]*\{[\s\S]*?padding:\s*18px\s+16px\s*!important/);
  });

  it("ensures card headings, eyebrows, and ledes have non-colliding margins in profile-v2.css", () => {
    expect(profileV2Css).toMatch(/\.settings-card\s+h2[\s\S]*?margin:\s*0\s+0\s+var\(--ps-6,\s*6px\)\s*!important/);
    expect(profileV2Css).toMatch(/\.settings-card\s+\.eyebrow[\s\S]*?margin:\s*0\s+0\s+var\(--ps-6,\s*6px\)\s*!important/);
    expect(profileV2Css).toMatch(/\.eyebrow[\s\S]*?margin:\s*0\s+0\s+var\(--ps-6,\s*6px\)\s*!important/);
    expect(profileV2Css).toMatch(/h3[\s\S]*?margin:\s*0\s+0\s+var\(--ps-6,\s*6px\)\s*!important/);
    expect(profileV2Css).toMatch(/\.settings-card\s+p\.muted[\s\S]*?margin:\s*0\s+0\s+var\(--ps-12,\s*12px\)\s*!important/);
  });

  it("excludes .profile-feedback-card from zero padding reset in profile-v2.css", () => {
    expect(profileV2Css).toContain(".profile-editor > .panel:not(.profile-feedback-card)");
    expect(profileV2Css).toMatch(/\.profile-feedback-card\s*\{[\s\S]*?padding:\s*var\(--ps-16\)\s*!important/);
  });

  it("ensures globals.css has safe fallbacks and broad selectors for settings cards", () => {
    expect(globalsCss).toMatch(/padding:\s*24px\s+var\(--settings-pad,\s*28px\)\s*24px\s*!important;/);
    expect(globalsCss).toMatch(/border-radius:\s*var\(--settings-radius,\s*20px\)\s*!important;/);
    expect(globalsCss).toContain("box-sizing: border-box !important;");
    expect(globalsCss).toContain(".feature-page.settings-page .settings-card");
    expect(globalsCss).toContain(".settings-canvas .settings-card");
  });

  it("ensures eyebrows and headings in settings.tsx have explicit zero top margins", () => {
    // Danger zone eyebrow in AccountSettings
    expect(settingsTsx).toMatch(/<p\s+className="eyebrow"[^>]*style=\{\{\s*margin:\s*0\s*\}\}>Danger zone<\/p>/);
    // Saved resumes eyebrow in ProfileSettings
    expect(settingsTsx).toMatch(/id="saved-resumes-title"[^>]*style=\{\{\s*margin:\s*0\s*\}\}/);
    // Upload resume eyebrow in ProfileSettings
    expect(settingsTsx).toMatch(/id="upload-resume-title"[^>]*style=\{\{\s*margin:\s*0\s*\}\}/);
  });
});
