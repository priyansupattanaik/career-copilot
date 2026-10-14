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

for (const cand of ["#A3B1C2", "#A4B2C3", "#A5B3C5", "#A6B4C6"]) {
  console.log(cand, "on surface3 (#1C2735):", contrast(cand, "#1C2735").toFixed(3), "on canvas:", contrast(cand, "#000000").toFixed(3));
}
