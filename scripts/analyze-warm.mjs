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

const filesToScan = [];
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist" && entry.name !== ".agents") {
        scanDir(fullPath);
      }
    } else if (/\.(css|scss|tsx|ts|jsx|js|html)$/.test(entry.name)) {
      filesToScan.push(fullPath);
    }
  }
}

scanDir(path.resolve("frontend/src"));
filesToScan.push(path.resolve("frontend/index.html"));

const fileFindings = {};

const tailwindWarmRegex = /\b(?:bg|text|border|ring|stroke|fill|from|to|via)-(?:orange|amber|yellow|red|rose|pink)(?:-[0-9]{2,3})?(?:\/[0-9]+)?\b/g;
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
const rgbaRegex = /rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9.]+))?\s*\)/g;

for (const file of filesToScan) {
  // Ignore mesh background components per SCOPE LOCK
  const base = path.basename(file);
  if (base.includes("mesh-background") || base === "brand-mark.tsx") {
    // Note: prompt says: "Do NOT change ... the mesh component (its teal/sky/emerald blooms stay exactly as they are) or the logo mark."
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, lineIdx) => {
    // Ignore pure comments if any
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      // Still inspect if it's token definition comments
    }

    let match;
    while ((match = tailwindWarmRegex.exec(line)) !== null) {
      if (!fileFindings[file]) fileFindings[file] = [];
      fileFindings[file].push({
        lineNum: lineIdx + 1,
        type: "tailwind-warm",
        match: match[0],
        line: trimmed
      });
    }

    while ((match = hexRegex.exec(line)) !== null) {
      const hex = match[0];
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (isWarm(hsl.h, hsl.s)) {
          if (!fileFindings[file]) fileFindings[file] = [];
          fileFindings[file].push({
            lineNum: lineIdx + 1,
            type: "hex-warm",
            match: hex,
            hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
            line: trimmed
          });
        }
      }
    }

    while ((match = rgbaRegex.exec(line)) !== null) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const hsl = rgbToHsl(r, g, b);
      if (isWarm(hsl.h, hsl.s)) {
        if (!fileFindings[file]) fileFindings[file] = [];
        fileFindings[file].push({
          lineNum: lineIdx + 1,
          type: "rgba-warm",
          match: match[0],
          hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
          line: trimmed
        });
      }
    }
  });
}

console.log("=== FILES WITH WARM COLORS ===");
for (const [file, items] of Object.entries(fileFindings)) {
  console.log(`\n${path.relative(".", file)} (${items.length} occurrences):`);
  for (const item of items) {
    console.log(`  Line ${item.lineNum} [${item.type}] ${item.match} ${item.hsl || ""} => ${item.line.slice(0, 90)}`);
  }
}
