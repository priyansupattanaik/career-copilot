import sys
import os

sys.path.insert(0, r"C:\Users\ircpr\.gemini\config\skills\logo-design\scripts")
import svg_audit

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Forward C logo symbol</title>
  <path fill="#2D5016" d="M 225.1 180 A 104 104 0 1 1 225.1 76 L 193.9 94 A 68 68 0 1 0 193.9 162 Z"/>
</svg>"""

test_file = r"d:\My Creations\career-copilot\logos\test-c1.svg"
with open(test_file, "w", encoding="utf-8") as f:
    f.write(svg_content)

info = svg_audit.audit(test_file)
svg_audit.print_report(info)
