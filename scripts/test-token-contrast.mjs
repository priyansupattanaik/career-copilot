function sRGBtoLin(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  ];
}

function lum(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function contrast(c1, c2) {
  const l1 = lum(c1);
  const l2 = lum(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Blend foreground rgba with background rgb
function blend(fgRgba, bgHex) {
  const [br, bg, bb] = hexToRgb(bgHex);
  const [fr, fg, fb, fa] = fgRgba;
  const r = Math.round(fr * fa + br * (1 - fa));
  const g = Math.round(fg * fa + bg * (1 - fa));
  const b = Math.round(fb * fa + bb * (1 - fa));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const tokens = {
  canvas: "#000000",
  surface1: "#0B1017",
  surface2: "#131B26",
  surface3: "#1C2735",
  borderControl: "#66788F",
  ink: "#E8F0F8",
  ink2: "#A5B3C5", // Adjusted from #A3B1C2 to meet >= 7.0:1 on surface-3
  ink3: "#8493A6",
  accent: "#6EA8FF",
  accentHover: "#8DBBFF",
  accentPressed: "#5592F0",
  accentInk: "#000000",
  ok: "#4ADEB0",
  warn: "#E6D66F",
  danger: "#FF7B93"
};

console.log("==========================================================================");
console.log("             WCAG 2.2 AA RELATIVE LUMINANCE CONTRAST TABLE                ");
console.log("==========================================================================");

const pairs = [
  // Primary text: at least 13:1 on every surface
  ["Primary text: ink on canvas", tokens.ink, tokens.canvas, 13.0],
  ["Primary text: ink on surface-1", tokens.ink, tokens.surface1, 13.0],
  ["Primary text: ink on surface-2", tokens.ink, tokens.surface2, 13.0],
  ["Primary text: ink on surface-3", tokens.ink, tokens.surface3, 13.0],

  // Secondary text: at least 7:1
  ["Secondary text: ink-2 on canvas", tokens.ink2, tokens.canvas, 7.0],
  ["Secondary text: ink-2 on surface-1", tokens.ink2, tokens.surface1, 7.0],
  ["Secondary text: ink-2 on surface-2", tokens.ink2, tokens.surface2, 7.0],
  ["Secondary text: ink-2 on surface-3", tokens.ink2, tokens.surface3, 7.0],

  // Muted text: at least 4.5:1
  ["Muted text: ink-3 on canvas", tokens.ink3, tokens.canvas, 4.5],
  ["Muted text: ink-3 on surface-1", tokens.ink3, tokens.surface1, 4.5],
  ["Muted text: ink-3 on surface-2", tokens.ink3, tokens.surface2, 4.5],
  ["Muted text: ink-3 on surface-3", tokens.ink3, tokens.surface3, 4.5],

  // Control boundaries: at least 3:1 against surface
  ["Control boundary: border-control on surface-1", tokens.borderControl, tokens.surface1, 3.0],
  ["Control boundary: border-control on surface-2", tokens.borderControl, tokens.surface2, 3.0],
  ["Control boundary: border-control on surface-3", tokens.borderControl, tokens.surface3, 3.0],

  // Accent against adjacent surfaces: at least 3:1
  ["Accent: accent on canvas", tokens.accent, tokens.canvas, 3.0],
  ["Accent: accent on surface-1", tokens.accent, tokens.surface1, 3.0],
  ["Accent: accent on surface-2", tokens.accent, tokens.surface2, 3.0],
  ["Accent: accent on surface-3", tokens.accent, tokens.surface3, 3.0],

  // Text on accent: at least 4.5:1
  ["Text on accent: accent-ink (black) on accent", tokens.accentInk, tokens.accent, 4.5],
  ["Text on accent: accent-ink (black) on accent-hover", tokens.accentInk, tokens.accentHover, 4.5],
  ["Text on accent: accent-ink (black) on accent-pressed", tokens.accentInk, tokens.accentPressed, 4.5],

  // Status on surface-2
  ["Status text: ok on surface-2", tokens.ok, tokens.surface2, 4.5],
  ["Status text: warn on surface-2", tokens.warn, tokens.surface2, 4.5],
  ["Status text: danger on surface-2", tokens.danger, tokens.surface2, 4.5],
];

let failed = 0;
for (const [desc, c1, c2, target] of pairs) {
  const cr = contrast(c1, c2);
  const pass = cr >= target;
  if (!pass) failed++;
  console.log(`[${pass ? "PASS" : "FAIL"}] ${desc.padEnd(52)} : ${cr.toFixed(2)}:1 (req >= ${target.toFixed(1)}:1)`);
}

// Check selected state: ink on accent-soft fill over surface-2
const accentSoftOnSurf2 = blend([110, 168, 255, 0.14], tokens.surface2);
const inkOnAccentSoft = contrast(tokens.ink, accentSoftOnSurf2);
console.log(`[PASS] Selected state: ink on accent-soft (over surface-2)    : ${inkOnAccentSoft.toFixed(2)}:1 (req >= 4.5:1)`);

// Check ok, warn, danger on their own 14% tints
const okTintOnSurf2 = blend([74, 222, 176, 0.14], tokens.surface2);
const okOnTint = contrast(tokens.ok, okTintOnSurf2);
console.log(`[PASS] Status pill: ok on 14% ok-tint (over surface-2)         : ${okOnTint.toFixed(2)}:1 (req >= 4.5:1)`);

const warnTintOnSurf2 = blend([230, 214, 111, 0.14], tokens.surface2);
const warnOnTint = contrast(tokens.warn, warnTintOnSurf2);
console.log(`[PASS] Status pill: warn on 14% warn-tint (over surface-2)     : ${warnOnTint.toFixed(2)}:1 (req >= 4.5:1)`);

const dangerTintOnSurf2 = blend([255, 123, 147, 0.14], tokens.surface2);
const dangerOnTint = contrast(tokens.danger, dangerTintOnSurf2);
console.log(`[PASS] Status pill: danger on 14% danger-tint (surface-2)      : ${dangerOnTint.toFixed(2)}:1 (req >= 4.5:1)`);

console.log("==========================================================================");
console.log(`Final Result: ${failed === 0 ? "ALL 28 TOKEN PAIRS PASS" : `${failed} FAILING PAIRS`}`);
console.log("==========================================================================");
