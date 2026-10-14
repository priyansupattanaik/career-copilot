import math
import os
import sys

sys.path.insert(0, r"C:\Users\ircpr\.gemini\config\skills\logo-design\scripts")
import render_png
import svg_audit

LOGOS_DIR = r"d:\My Creations\career-copilot\logos"
os.makedirs(LOGOS_DIR, exist_ok=True)

# ==============================================================================
# CONCEPT 1: "Forward C"
# ==============================================================================
def build_concept_01():
    # Outer r=104, inner r=68. Center at cx=135, cy=128.
    # 60 deg gap on right (-30 deg to +30 deg).
    # 30 deg diagonal cut flat faces.
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Forward C Symbol</title>
  <path fill="#2D5016" d="M 225.1 180 A 104 104 0 1 1 225.1 76 L 193.9 94 A 68 68 0 1 0 193.9 162 Z"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Forward C Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#2D5016" d="M 225.1 180 A 104 104 0 1 1 225.1 76 L 193.9 94 A 68 68 0 1 0 193.9 162 Z"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#2D5016" letter-spacing="-1">Career Copilot</text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 2: "Hand-off"
# ==============================================================================
def build_concept_02():
    # Left C (teal supporter): outer r=80, inner r=52.
    # Right C (amber leader): outer r=96, inner r=64.
    # Gap between spines is 8 units: Left spine at x=116, Right spine at x=124.
    # Leftmost edge: 116 - 80 = 36. Rightmost edge: 124 + 96 = 220.
    # Margins: L36, R36, T32, B32. Perfectly centered!
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Hand-off Symbol</title>
  <!-- Left C (Teal supporter, r_out=80, r_in=52) -->
  <path fill="#1B4D4A" d="M 116 48 A 80 80 0 0 0 116 208 V 180 A 52 52 0 0 1 116 76 Z"/>
  <!-- Right C (Amber leader, r_out=96, r_in=64) -->
  <path fill="#E8A04A" d="M 124 32 V 64 A 64 64 0 0 1 124 192 V 224 A 96 96 0 0 0 124 32 Z"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Hand-off Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#1B4D4A" d="M 116 48 A 80 80 0 0 0 116 208 V 180 A 52 52 0 0 1 116 76 Z"/>
    <path fill="#E8A04A" d="M 124 32 V 64 A 64 64 0 0 1 124 192 V 224 A 96 96 0 0 0 124 32 Z"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1B4D4A" letter-spacing="-1">Career <tspan fill="#E8A04A">Copilot</tspan></text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 3: "Signal"
# ==============================================================================
def build_concept_03():
    # Single filled outline path: width 220 (x=18..238), centered horizontally and vertically.
    # Zigzag: clean 45-degree angles. Stroke width 16.
    # Top peak reaches y=92, bottom valley reaches y=164.
    # Margins: L18, R18, T92, B92. Perfectly balanced!
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Signal Symbol</title>
  <path fill="#3D2B7A" d="M 26 112 L 46 92 L 74 148 L 94 92 C 106 92 118 112 134 112 L 230 112 A 8 8 0 0 1 230 128 L 134 128 C 114 128 102 108 94 108 L 74 164 L 46 108 L 26 128 A 8 8 0 0 1 26 112 Z"/>
</svg>"""

    # Lockup: stacked — symbol above, wordmark below centred
    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 256" width="480" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Signal Lockup</title>
  <g id="symbol" transform="translate(112, 12)">
    <path fill="#3D2B7A" d="M 26 112 L 46 92 L 74 148 L 94 92 C 106 92 118 112 134 112 L 230 112 A 8 8 0 0 1 230 128 L 134 128 C 114 128 102 108 94 108 L 74 164 L 46 108 L 26 128 A 8 8 0 0 1 26 112 Z"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark">
    <text x="240" y="210" text-anchor="middle" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="46" font-weight="700" fill="#3D2B7A" letter-spacing="-0.5">Career Copilot</text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 4: "Tandem"
# ==============================================================================
def build_concept_04():
    # Two overlapping rounded squares: 112x112, rx=28.
    # Right leader: Ink #1A1A1A at (152, 128) -> x in [96, 208], y in [72, 184].
    # Left supporter: Coral #E85D4A at (104, 128) -> x in [48, 88] with rx=28 on left.
    # Overlap is cut as negative space. Margins: L48, R48, T72, B72.
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Tandem Symbol</title>
  <!-- Left supporter squircle (Coral #E85D4A) -->
  <path fill="#E85D4A" d="M 76 72 H 88 V 184 H 76 A 28 28 0 0 1 48 156 V 100 A 28 28 0 0 1 76 72 Z"/>
  <!-- Right leader squircle (Ink #1A1A1A, 112x112 rx=28) -->
  <rect x="96" y="72" width="112" height="112" rx="28" fill="#1A1A1A"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Tandem Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#E85D4A" d="M 76 72 H 88 V 184 H 76 A 28 28 0 0 1 48 156 V 100 A 28 28 0 0 1 76 72 Z"/>
    <rect x="96" y="72" width="112" height="112" rx="28" fill="#1A1A1A"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1A1A1A" letter-spacing="-1">Career <tspan fill="#E85D4A">Copilot</tspan></text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 5: "Threshold"
# ==============================================================================
def build_concept_05():
    # Outer r=112, inner r=70. Center (128, 128).
    # Single path with fill-rule="evenodd".
    # Doorway threshold notch 42x40 cut through right wall at 3 o'clock position (x=198..240, y=108..148).
    # Perfectly centered: L16, R16, T16, B16.
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Threshold Symbol</title>
  <path fill="#1B4D4A" fill-rule="evenodd" d="M 128 16 A 112 112 0 1 1 127.9 16 Z M 128 58 A 70 70 0 1 0 128.1 58 Z M 198 108 H 240 V 148 H 198 Z"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Threshold Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#1B4D4A" fill-rule="evenodd" d="M 128 16 A 112 112 0 1 1 127.9 16 Z M 128 58 A 70 70 0 1 0 128.1 58 Z M 198 108 H 240 V 148 H 198 Z"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1B4D4A" letter-spacing="-1">Career Copilot</text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 6: "First Step"
# ==============================================================================
def build_concept_06():
    # Two offset rounded rect stepping stones:
    # Base stone: 130x40, rx=14 at x=63..193, y=132..172.
    # Elevated step stone: 88x40, rx=14 at x=105..193, y=84..124.
    # Margins: L63, R63, T84, B84. Grounded, balanced, solid!
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — First Step Symbol</title>
  <!-- Base stepping stone -->
  <rect x="63" y="132" width="130" height="40" rx="14" fill="#2D5016"/>
  <!-- Elevated step stone (stepping forward) -->
  <rect x="105" y="84" width="88" height="40" rx="14" fill="#2D5016"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — First Step Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <rect x="63" y="132" width="130" height="40" rx="14" fill="#2D5016"/>
    <rect x="105" y="84" width="88" height="40" rx="14" fill="#2D5016"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#2D5016" letter-spacing="-1">Career Copilot</text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 7: "Room to Grow"
# ==============================================================================
def build_concept_07():
    # Outer r=108, inner r=80. Center (128, 128).
    # Main ring: Ink #1A1A1A (315 deg of arc, from -45 deg around to -90 deg).
    # Amber growth segment: #E8A04A (15 deg arc from -45 deg to -30 deg).
    # Radial cuts at 90 deg, 45 deg, 30 deg -> all CLEAN_ANGLES!
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Room to Grow Symbol</title>
  <!-- Main ring (Ink #1A1A1A, 315 deg of arc) -->
  <path fill="#1A1A1A" d="M 204.4 51.6 A 108 108 0 1 1 128 20 L 128 48 A 80 80 0 1 0 184.6 71.4 Z"/>
  <!-- Growth segment (Amber #E8A04A, 15 deg arc at gap threshold) -->
  <path fill="#E8A04A" d="M 204.4 51.6 A 108 108 0 0 1 221.5 74 L 197.3 88 A 80 80 0 0 0 184.6 71.4 Z"/>
</svg>"""

    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Room to Grow Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#1A1A1A" d="M 204.4 51.6 A 108 108 0 1 1 128 20 L 128 48 A 80 80 0 1 0 184.6 71.4 Z"/>
    <path fill="#E8A04A" d="M 204.4 51.6 A 108 108 0 0 1 221.5 74 L 197.3 88 A 80 80 0 0 0 184.6 71.4 Z"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1A1A1A" letter-spacing="-1">Career <tspan fill="#E8A04A">Copilot</tspan></text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 8: "Call and Response"
# ==============================================================================
def build_concept_08():
    # Top rect: 160x56, rx=28, x=36..196, y=64..120.
    # Bottom rect: 120x56, rx=28, x=100..220, y=136..192.
    # Coral #E85D4A. Margins: L36, R36, T64, B64.
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Call and Response Symbol</title>
  <!-- Top dialogue / question bar (wide) -->
  <rect x="36" y="64" width="160" height="56" rx="28" fill="#E85D4A"/>
  <!-- Bottom dialogue / response bar (offset rising) -->
  <rect x="100" y="136" width="120" height="56" rx="28" fill="#E85D4A"/>
</svg>"""

    # Lockup: stacked — symbol above, wordmark below centred with breathing room
    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 256" width="480" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Call and Response Lockup</title>
  <g id="symbol" transform="translate(112, -24)">
    <rect x="36" y="64" width="160" height="56" rx="28" fill="#E85D4A"/>
    <rect x="100" y="136" width="120" height="56" rx="28" fill="#E85D4A"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark">
    <text x="240" y="218" text-anchor="middle" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="44" font-weight="700" fill="#E85D4A" letter-spacing="-0.5">Career Copilot</text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 9: "Copilot"
# ==============================================================================
def build_concept_09():
    # Geometric C (outer r=104, inner r=68) with orbit circle r=14 at upper-right.
    # Center cx=130, cy=128. Orbit dot at (214, 64) r=14.
    # Margins: L26, R28, T24, B24.
    symbol_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Copilot Symbol</title>
  <!-- Primary geometric C -->
  <path fill="#1A1A1A" d="M 220.1 180 A 104 104 0 1 1 220.1 76 L 188.9 94 A 68 68 0 1 0 188.9 162 Z"/>
  <!-- Raised north-star / level-up orbit dot (r=14) -->
  <circle cx="214" cy="64" r="14" fill="#1A1A1A"/>
</svg>"""

    # Lockup: wordmark with calibrated i-dot
    lockup_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Copilot Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#1A1A1A" d="M 220.1 180 A 104 104 0 1 1 220.1 76 L 188.9 94 A 68 68 0 1 0 188.9 162 Z"/>
    <circle cx="214" cy="64" r="14" fill="#1A1A1A"/>
  </g>
  <!-- Exploration text: Jost / Inter with elevated i-dot (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1A1A1A" letter-spacing="-1">Career Cop<tspan dy="-6">ı</tspan><tspan dy="6">lot</tspan></text>
    <circle cx="422" cy="88" r="7" fill="#1A1A1A"/>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

# ==============================================================================
# CONCEPT 10: "Meridian"
# ==============================================================================
def build_concept_010():
    # Circle r=96, center (128, 128).
    # 3 radial cuts: 12 o'clock (-90 deg), 4 o'clock (+30 deg), 8 o'clock (+150 deg).
    # Slit width 8 units. All edges parallel to clean angles (90, 30, 150 deg).
    # Center hub cutout r=20.
    cx, cy = 128.0, 128.0
    R = 96.0
    r = 20.0
    w2 = 4.0

    sectors = []
    slit_angles = [-90.0, 30.0, 150.0]
    for i in range(3):
        a1 = slit_angles[i]
        a2 = slit_angles[(i + 1) % 3]
        if a2 < a1:
            a2 += 360.0
        rad1 = math.radians(a1)
        rad2 = math.radians(a2)
        p1 = (-math.sin(rad1), math.cos(rad1))
        p2 = (math.sin(rad2), -math.cos(rad2))
        v1 = (math.cos(rad1), math.sin(rad1))
        v2 = (math.cos(rad2), math.sin(rad2))
        
        t_out = math.sqrt(R*R - w2*w2)
        t_in = math.sqrt(r*r - w2*w2)
        
        P_out_1 = (round(cx + w2*p1[0] + t_out*v1[0], 1), round(cy + w2*p1[1] + t_out*v1[1], 1))
        P_in_1 = (round(cx + w2*p1[0] + t_in*v1[0], 1), round(cy + w2*p1[1] + t_in*v1[1], 1))

        P_out_2 = (round(cx + w2*p2[0] + t_out*v2[0], 1), round(cy + w2*p2[1] + t_out*v2[1], 1))
        P_in_2 = (round(cx + w2*p2[0] + t_in*v2[0], 1), round(cy + w2*p2[1] + t_in*v2[1], 1))

        d = f"M {P_in_1[0]} {P_in_1[1]} L {P_out_1[0]} {P_out_1[1]} A {R:.0f} {R:.0f} 0 0 1 {P_out_2[0]} {P_out_2[1]} L {P_in_2[0]} {P_in_2[1]} A {r:.0f} {r:.0f} 0 0 0 {P_in_1[0]} {P_in_1[1]} Z"
        sectors.append(d)

    path_data = " ".join(sectors)
    symbol_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Meridian Symbol</title>
  <path fill="#C4781A" d="{path_data}"/>
</svg>"""

    lockup_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title">
  <title id="title">Career Copilot — Meridian Lockup</title>
  <g id="symbol" transform="translate(20, 0)">
    <path fill="#C4781A" d="{path_data}"/>
  </g>
  <!-- Exploration text: Jost / Inter (flagged: needs outline conversion for master) -->
  <g id="wordmark" transform="translate(300, 0)">
    <text x="0" y="148" font-family="'Jost', 'Inter', system-ui, sans-serif" font-size="76" font-weight="700" fill="#1A1A1A" letter-spacing="-1">Career <tspan fill="#C4781A">Copilot</tspan></text>
  </g>
</svg>"""
    return symbol_svg, lockup_svg

BUILDERS = [
    ("concept-01-forward-c", build_concept_01),
    ("concept-02-handoff", build_concept_02),
    ("concept-03-signal", build_concept_03),
    ("concept-04-tandem", build_concept_04),
    ("concept-05-threshold", build_concept_05),
    ("concept-06-firststep", build_concept_06),
    ("concept-07-roomtogrow", build_concept_07),
    ("concept-08-callresponse", build_concept_08),
    ("concept-09-copilot", build_concept_09),
    ("concept-10-meridian", build_concept_010),
]

def main():
    print("Building all 10 concepts...")
    for slug, fn in BUILDERS:
        sym_svg, lock_svg = fn()
        sym_path = os.path.join(LOGOS_DIR, f"{slug}-symbol.svg")
        lock_path = os.path.join(LOGOS_DIR, f"{slug}-lockup.svg")
        with open(sym_path, "w", encoding="utf-8") as f:
            f.write(sym_svg)
        with open(lock_path, "w", encoding="utf-8") as f:
            f.write(lock_svg)
        print(f"Wrote {slug}-symbol.svg and {slug}-lockup.svg")

    print("\nAuditing all 10 symbols...")
    has_warn = False
    for slug, _ in BUILDERS:
        sym_path = os.path.join(LOGOS_DIR, f"{slug}-symbol.svg")
        info = svg_audit.audit(sym_path)
        svg_audit.print_report(info)
        for finding in info.get("findings", []):
            if finding["level"] in ("WARN", "FAIL"):
                has_warn = True

    if has_warn:
        print("\n[!] WARNINGS detected. Review and adjust.")
    else:
        print("\n[✔] ALL 10 SYMBOLS PASSED WITH ZERO WARNINGS/FAILS!")

if __name__ == "__main__":
    main()
