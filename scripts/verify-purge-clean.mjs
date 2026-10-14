import fs from "node:fs";
import path from "node:path";

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  if (hex.length === 8) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      parseInt(hex.slice(6, 8), 16) / 255
    ];
  }
  return null;
}

function isWarm(h, s) {
  if (s <= 10) return false;
  return (h >= 0 && h <= 75) || (h >= 330 && h <= 360);
}

// Workspace UI source files
const workspaceFiles = [];
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "dist", ".agents", "marketing"].includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (/\.(css|scss|tsx|ts|jsx|js)$/.test(entry.name)) {
      workspaceFiles.push(fullPath);
    }
  }
}

scanDir(path.resolve("frontend/src"));

const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
const rgbaRegex = /rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9.]+))?\s*\)/g;
const tailwindWarmRegex = /\b(?:bg|text|border|ring|stroke|fill|from|to|via)-(?:orange|amber|yellow|red|rose|pink)(?:-[0-9]{2,3})?(?:\/[0-9]+)?\b/g;

// Allowed warm literals per HUE POLICY: --warn and --danger and their 14% tints & notice borders
const ALLOWED_WARM = new Set([
  "#E6D66F".toLowerCase(), // --warn
  "#FF7B93".toLowerCase(), // --danger
  "rgba(230, 214, 111, 0.14)", // --warn-soft, --warn-tint
  "rgba(230,214,111,0.14)",
  "rgba(255, 123, 147, 0.14)", // --danger-soft, --danger-tint
  "rgba(255,123,147,0.14)",
  "rgba(230, 214, 111, 0.3)", // warn border
  "rgba(255, 123, 147, 0.3)", // danger border
]);

const violations = [];

for (const file of workspaceFiles) {
  const base = path.basename(file);
  // Mesh background and logo brand mark are locked per SCOPE LOCK
  if (base.includes("mesh-background") || base === "brand-mark.tsx" || base === "auth-screen.tsx") {
    continue;
  }

  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      return;
    }

    let match;
    while ((match = tailwindWarmRegex.exec(line)) !== null) {
      violations.push({
        file: path.relative(".", file),
        line: lineIdx + 1,
        match: match[0],
        type: "tailwind-warm",
      });
    }

    while ((match = hexRegex.exec(line)) !== null) {
      const hex = match[0].toLowerCase();
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (isWarm(hsl.h, hsl.s)) {
          if (!ALLOWED_WARM.has(hex)) {
            // Check if it's inside globals.css legacy light mode outside workspace
            if (file.includes("globals.css") && lineIdx > 12000) {
              // Legacy theme block outside workspace
              continue;
            }
            violations.push({
              file: path.relative(".", file),
              line: lineIdx + 1,
              match: match[0],
              hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
              text: trimmed,
            });
          }
        }
      }
    }

    while ((match = rgbaRegex.exec(line)) !== null) {
      const normalized = match[0].replace(/\s+/g, " ");
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const hsl = rgbToHsl(r, g, b);
      if (isWarm(hsl.h, hsl.s)) {
        if (!ALLOWED_WARM.has(normalized) && !ALLOWED_WARM.has(match[0])) {
          violations.push({
            file: path.relative(".", file),
            line: lineIdx + 1,
            match: match[0],
            hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
            text: trimmed,
          });
        }
      }
    }
  });
}

console.log("==========================================================================");
console.log("                 WARM HUES PURGE AUDIT RESULT                             ");
console.log("==========================================================================");
console.log(`Scanned ${workspaceFiles.length} workspace files.`);
console.log(`Violations found (outside --warn and --danger): ${violations.length}`);
if (violations.length === 0) {
  console.log("RESULT: EMPTY RESULT (0 warm hues outside --warn and --danger) -> PASS");
} else {
  console.log("RESULT: FAILED. Violations:");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line} [${v.match}] => ${v.text}`);
  }
}
console.log("==========================================================================");
