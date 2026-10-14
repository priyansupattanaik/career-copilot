import sys
import os

sys.path.insert(0, r"C:\Users\ircpr\.gemini\config\skills\logo-design\scripts")
import render_png
import svg_audit

svg_c5_test4 = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Threshold Symbol</title>
  <path fill="#1B4D4A" fill-rule="evenodd" d="M 128 16 A 112 112 0 1 1 127.9 16 Z M 128 58 A 70 70 0 1 0 128.1 58 Z M 198 108 H 240 V 148 H 198 Z"/>
</svg>"""

with open(r"d:\My Creations\career-copilot\logos\test-c5-doorway4.svg", "w", encoding="utf-8") as f:
    f.write(svg_c5_test4)

render_png.render(r"d:\My Creations\career-copilot\logos\test-c5-doorway4.svg", r"d:\My Creations\career-copilot\logos\test-c5-doorway4.png", 512, 512)
info = svg_audit.audit(r"d:\My Creations\career-copilot\logos\test-c5-doorway4.svg")
print("=== Concept 5 Doorway 4 Audit ===")
svg_audit.print_report(info)
