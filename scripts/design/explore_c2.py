import math
import os
import sys

sys.path.insert(0, r"C:\Users\ircpr\.gemini\config\skills\logo-design\scripts")
import render_png
import svg_audit

# Option 2A: Semicircular arc bands on left and right of a central spine gap of 8 units.
# Left C (teal): outer r=80, inner r=52, facing left.
# Right C (amber): outer r=96, inner r=64, facing right.
# Between them at x=128 is an 8-unit vertical gap (x=124 and x=132).
# Left C top and bottom flat ends cut at y = 128 - 80 to 128 + 80?
# Or arcs from top to bottom?
# Let's see: Left C is from top (124, 128-80) curving left to (124-80, 128)=(44, 128) down to (124, 128+80),
# then inner arc from (124, 128+52) curving left to (124-52, 128)=(72, 128) up to (124, 128-52).
# With flat caps at the top (from y=48 to y=76 at x=124) and bottom (from y=180 to y=208 at x=124).

svg_2a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Hand-off logo symbol</title>
  <!-- Left C (Teal, supporter, r_out=80, r_in=52) -->
  <path fill="#1B4D4A" d="M 124 48 A 80 80 0 0 0 124 208 H 124 V 180 A 52 52 0 0 1 124 76 V 48 Z"/>
  <!-- Right C (Amber, leader, r_out=96, r_in=64) -->
  <path fill="#E8A04A" d="M 132 32 V 64 A 64 64 0 0 1 132 192 V 224 A 96 96 0 0 0 132 32 Z"/>
</svg>"""

with open(r"d:\My Creations\career-copilot\logos\test-c2a.svg", "w", encoding="utf-8") as f:
    f.write(svg_2a)

info_2a = svg_audit.audit(r"d:\My Creations\career-copilot\logos\test-c2a.svg")
print("=== 2A Audit ===")
svg_audit.print_report(info_2a)
render_png.render_file(r"d:\My Creations\career-copilot\logos\test-c2a.svg", r"d:\My Creations\career-copilot\logos\test-c2a.png", size=512)

# Option 2B: Mirrored letter Cs with open mouths (like letter C):
# Left C has opening on left (from -150 to +150 deg).
# Wait, if mouth is on left, the spine is the closed arc in the middle!
# But in 2A, the opening is on the left and right! Look at 2A: the hole is in the middle of each arc,
# but the opening between the two ends at x=124 is open to the right (towards the spine)!
# In 2A, the shape on the left curves to the left like a '(' (mouth facing right towards spine).
# What if Left C has its mouth facing left:
# That would mean it curves around the spine at x=124!
# Let's test Option 2B where the mouth faces outward:
# i.e., spine is a vertical bar or arc at center, and arms reach out left/right.
