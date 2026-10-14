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
    h = s = 0; // achromatic
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

const WARM_HUE_RANGES = [
  [0, 75],
  [330, 360]
];

function isWarm(h, s) {
  if (s <= 10) return false;
  return (h >= 0 && h <= 75) || (h >= 330 && h <= 360);
}

// Traverse frontend/src
const filesToScan = [];
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist") {
        scanDir(fullPath);
      }
    } else if (/\.(css|scss|tsx|ts|jsx|js|html)$/.test(entry.name)) {
      filesToScan.push(fullPath);
    }
  }
}

scanDir(path.resolve("frontend/src"));
filesToScan.push(path.resolve("frontend/index.html"));

const findings = [];
const tailwindWarmRegex = /\b(?:bg|text|border|ring|stroke|fill|from|to|via)-(?:orange|amber|yellow|red|rose|pink)(?:-[0-9]{2,3})?(?:\/[0-9]+)?\b/g;
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
const rgbaRegex = /rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9.]+))?\s*\)/g;

for (const file of filesToScan) {
  // Skip mesh component per scope lock: "the mesh component (its teal/sky/emerald blooms stay exactly as they are)"
  if (file.includes("frost-mesh-background.tsx") || file.includes("dark-midnight-mesh-background.tsx")) {
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, lineIdx) => {
    // Check tailwind warm classes
    let match;
    while ((match = tailwindWarmRegex.exec(line)) !== null) {
      findings.push({
        file,
        lineNum: lineIdx + 1,
        type: "tailwind-warm",
        match: match[0],
        line: line.trim()
      });
    }

    // Check hex
    while ((match = hexRegex.exec(line)) !== null) {
      const hex = match[0];
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (isWarm(hsl.h, hsl.s)) {
          findings.push({
            file,
            lineNum: lineIdx + 1,
            type: "hex-warm",
            match: hex,
            hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
            line: line.trim()
          });
        }
      }
    }

    // Check rgba
    while ((match = rgbaRegex.exec(line)) !== null) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const hsl = rgbToHsl(r, g, b);
      if (isWarm(hsl.h, hsl.s)) {
        findings.push({
          file,
          lineNum: lineIdx + 1,
          type: "rgba-warm",
          match: match[0],
          hsl: `H:${hsl.h.toFixed(1)} S:${hsl.s.toFixed(1)}% L:${hsl.l.toFixed(1)}%`,
          line: line.trim()
        });
      }
    }
  });
}

console.log(`Found ${findings.length} warm color matches in ${filesToScan.length} files.`);
for (const f of findings.slice(0, 50)) {
  console.log(`${path.relative(".", f.file)}:${f.lineNum} [${f.type}] ${f.match} (${f.hsl || ""}) => ${f.line.slice(0, 80)}`);
}
if (findings.length > 50) {
  console.log(`... and ${findings.length - 50} more`);
}
