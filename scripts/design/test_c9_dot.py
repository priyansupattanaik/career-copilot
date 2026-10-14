import sys
import os

sys.path.insert(0, r"C:\Users\ircpr\.gemini\config\skills\logo-design\scripts")
import render_png

# In Concept 9 lockup:
# <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" ...>
# Career Cop<tspan dy="-6">ı</tspan><tspan dy="6">lot</tspan></text>
# Let's test dot positions: cx in [410, 415, 420, 425, 430]
for cx in [416, 422, 428]:
    lockup_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256">
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#1A1A1A" d="M 220.1 180 A 104 104 0 1 1 220.1 76 L 188.9 94 A 68 68 0 1 0 188.9 162 Z"/>
    <circle cx="214" cy="64" r="14" fill="#1A1A1A"/>
  </g>
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1A1A1A" letter-spacing="-1">Career Cop<tspan dy="-6">ı</tspan><tspan dy="6">lot</tspan></text>
    <circle cx="{cx}" cy="88" r="7" fill="#1A1A1A"/>
  </g>
</svg>"""
    p = rf"d:\My Creations\career-copilot\logos\test-c9-cx{cx}.svg"
    with open(p, "w", encoding="utf-8") as f:
        f.write(lockup_svg)
    render_png.render(p, rf"d:\My Creations\career-copilot\logos\test-c9-cx{cx}.png", 880, 256)
    print(f"Rendered cx={cx}")
