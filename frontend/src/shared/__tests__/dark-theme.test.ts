import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyThemeToDocument } from "../theme";

describe("OLED dark theme tokens", () => {
  const cssPath = path.resolve(__dirname, "../../globals.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");

  it("configures true OLED black background tokens in dark mode", () => {
    expect(cssContent).toContain("--background: #000000;");
    expect(cssContent).toContain("--background-subtle: #050505;");
    expect(cssContent).toContain("--background-accent: #0a0a0a;");
  });

  it("configures neutral dark grey elevation surfaces in dark mode", () => {
    expect(cssContent).toContain("--surface: #0a0a0a;");
    expect(cssContent).toContain("--surface-raised: #121212;");
    expect(cssContent).toContain("--surface-muted: #18181b;");
    expect(cssContent).toContain("--surface-selected: #222226;");
  });

  it("configures neutral dark border contrasts in dark mode", () => {
    expect(cssContent).toContain("--border: #27272a;");
    expect(cssContent).toContain("--border-strong: #3f3f46;");
    expect(cssContent).toContain("--border-subtle: #18181b;");
  });

  it("does not use dark blue palette codes in [data-theme=\"dark\"] tokens", () => {
    // Extract [data-theme="dark"] token block
    const darkBlockMatch = cssContent.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/);
    expect(darkBlockMatch).not.toBeNull();
    const darkBlock = darkBlockMatch![1];

    const forbiddenBlueHex = [
      "#0b1220",
      "#111c2d",
      "#162942",
      "#17263b",
      "#142b45",
      "#101a2a",
      "#183a5b",
      "#14243b",
    ];
    for (const hex of forbiddenBlueHex) {
      expect(darkBlock).not.toContain(hex);
    }
  });

  it("sidebar gradient and sidebar background do not use blue palette in dark mode", () => {
    const sidebarDarkMatch = cssContent.match(/\[data-theme="dark"\]\s+\.sidebar\s*\{([^}]+)\}/);
    expect(sidebarDarkMatch).not.toBeNull();
    const sidebarBlock = sidebarDarkMatch![1];
    expect(sidebarBlock).not.toContain("#101c2d");
    expect(sidebarBlock).not.toContain("#0b1220");
    expect(sidebarBlock).toContain("#000000");
  });

  it("configures workspace cards with elevated dark grey surface hierarchy in dark mode", () => {
    expect(cssContent).toContain("--app-panel: var(--surface-raised);");
    expect(cssContent).toContain("--atlas-work-card: var(--surface-raised);");
    expect(cssContent).toMatch(/\[data-theme="dark"\][\s\S]*?\.workspace[\s\S]*?\.metric-card[\s\S]*?background:\s*var\(--surface-raised\)\s*!important/);
  });

  it("configures auth aurora and aside to pure OLED black in dark mode", () => {
    expect(cssContent).toMatch(/\[data-theme="dark"\]\s+\.auth-shell\s+\.auth-aurora[\s\S]*?background:\s*#000000\s*!important/);
  });
});

describe("applyThemeToDocument", () => {
  let docMock: {
    documentElement: {
      attributes: Record<string, string>;
      style: Record<string, string>;
      setAttribute: (k: string, v: string) => void;
      getAttribute: (k: string) => string | undefined;
      removeAttribute: (k: string) => void;
    };
    metaMock: {
      attributes: Record<string, string>;
      setAttribute: (k: string, v: string) => void;
      getAttribute: (k: string) => string | undefined;
    };
    querySelector: (selector: string) => unknown;
  };

  beforeEach(() => {
    const metaMock = {
      attributes: { name: "theme-color", content: "" } as Record<string, string>,
      setAttribute(k: string, v: string) {
        this.attributes[k] = v;
      },
      getAttribute(k: string) {
        return this.attributes[k];
      },
    };

    docMock = {
      documentElement: {
        attributes: {},
        style: {},
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        removeAttribute(k: string) {
          delete this.attributes[k];
        },
      },
      metaMock,
      querySelector(selector: string) {
        if (selector === 'meta[name="theme-color"]') {
          return this.metaMock;
        }
        return null;
      },
    };
    (globalThis as unknown as { document: unknown }).document = docMock;
  });

  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it("applies dark theme, colorScheme, and #000000 meta theme-color", () => {
    applyThemeToDocument("dark");
    expect(docMock.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(docMock.documentElement.style.colorScheme).toBe("dark");
    expect(docMock.metaMock.getAttribute("content")).toBe("#000000");
  });

  it("applies light theme, colorScheme, and light meta theme-color", () => {
    applyThemeToDocument("light");
    expect(docMock.documentElement.getAttribute("data-theme")).toBe("light");
    expect(docMock.documentElement.style.colorScheme).toBe("light");
    expect(docMock.metaMock.getAttribute("content")).toBe("#f5faff");
  });
});
