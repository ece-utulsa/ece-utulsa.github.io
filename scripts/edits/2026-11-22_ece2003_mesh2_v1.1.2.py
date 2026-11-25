#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for Mesh Analysis Part 2 v1.1.2 (Animation Rubric §6.4).

Purpose: R2 colour Minors on ece-2003/Mesh Analysis - Part 2.html (v1.1.1 -> v1.1.2):
  DEFECT-AT008-R2-001 (accent text on tinted fills >= 4.5:1), PPR-AT-008-R2-1 (line-2 highlight
  on the 3 mA boundary source), PPR-AT-008-R2-2 (duality cell styled to its meaning).
Briefing: Queue/2026-11-22_ClaudeCode_briefing_ECE2003-MeshPart2_v1.1.2.md (STANDING GO).
Usage (from the repo root, on the v1.1.1 file):
  python3 -I scripts/edits/2026-11-22_ece2003_mesh2_v1.1.2.py
Same method as scripts/edits/2026-11-21_ece2003_mascot_and_AT-008.py: pre-edit SHA-256 gate,
unchanged round trip through scripts/design_bundle.py, exact-count string replacements,
repack, write in place. Re-running on the edited file stops at the hash check.
"""
import hashlib, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
OLD, NEW = 'v1.1.1', 'v1.1.2'
PAGE = 'ece-2003/Mesh Analysis - Part 2.html'
PRE_SHA = '1be25642631acc2b83fe4b6f4f62f737defe592d16085e9dcc2736c3db4d94eb'   # v1.1.1 at 61bdf0a
SCENE = 'bfb2ee7f-8a96-4754-b638-dc3a3b1609df'                                 # scene resource uuid


def sha(path):
    """SHA-256 of a file, hex."""
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:70], n)
    return s.replace(old, new)


# ═══ SCENE EDITS ═══
def scene(js):
    """Version stamp, ACCENT_TXT token on tinted fills, line-2 source highlight, neutral duality cell."""
    js = rep(js, "// Version v1.1.1 (2026-11-21). Author of this revision: Claude Code — mascot removed (PED-10),\n"
                 "//   AT-008 quick-fix list (light chrome, contrast, text sizes, units, sign rule, no dimming in l9).\n",
             "// Version v1.1.2 (2026-11-22). Author of this revision: Claude Code — R2 colour Minors:\n"
             "//   ACCENT_TXT for accent text on tinted fills (DEFECT-AT008-R2-001), line-2 highlight on the\n"
             "//   3 mA boundary source (PPR-AT-008-R2-1), neutral duality cell (PPR-AT-008-R2-2).\n"
             "// Version v1.1.1 (2026-11-21). Author of that revision: Claude Code — mascot removed (PED-10),\n"
             "//   AT-008 quick-fix list (light chrome, contrast, text sizes, units, sign rule, no dimming in l9).\n")
    # DEFECT-AT008-R2-001: one darker accent token for TEXT on tinted fills; strokes and fills keep CX.ACCENT
    js = rep(js, "const AMBER_TXT = 'oklch(0.48 0.10 75)';   // AT-008-3: amber for TEXT\n",
             "const AMBER_TXT = 'oklch(0.48 0.10 75)';   // AT-008-3: amber for TEXT\n"
             "const ACCENT_TXT = 'oklch(0.48 0.13 255)'; // AT008-R2-001: accent blue for TEXT on tinted fills (kit ACCENT\n"
             "                                           //   L 0.55 is 4.1-4.3:1 on the mesh/band tints; this is >= 5.5:1)\n")
    # loop labels I_A on the mesh A tint (Example 1) and mesh A / supermesh tint (Example 2)
    js = rep(js, "fontFamily: MONO, fontSize: 17, fontWeight: 700, color: ACCENT, opacity: arrE }}><span>I<sub>A</sub></span></div>}",
             "fontFamily: MONO, fontSize: 17, fontWeight: 700, color: ACCENT_TXT, opacity: arrE }}><span>I<sub>A</sub></span></div>}", count=2)
    # identity-row "1" on its highlight band
    js = rep(js, "fontFamily: MONO, fontSize: fs, fontWeight: 700, color: ACCENT }}>1</div>);",
             "fontFamily: MONO, fontSize: fs, fontWeight: 700, color: ACCENT_TXT }}>1</div>);")
    # Case 2 card: I_A on the mesh A tint
    js = rep(js, "<text x=\"102\" y=\"105\" fontFamily={MONO} fontSize=\"15\" fontWeight=\"700\" fill={ACCENT}>I<tspan",
             "<text x=\"102\" y=\"105\" fontFamily={MONO} fontSize=\"15\" fontWeight=\"700\" fill={ACCENT_TXT}>I<tspan")
    # payoff I_A = 4 mA on the mesh A tint (line 9)
    js = rep(js, "fontFamily: MONO, fontSize: 15, fontWeight: 700, color: ACCENT, lineHeight: 1.25 }}><span>I<sub>A</sub> =</span><br />4 mA</div>",
             "fontFamily: MONO, fontSize: 15, fontWeight: 700, color: ACCENT_TXT, lineHeight: 1.25 }}><span>I<sub>A</sub> =</span><br />4 mA</div>")
    # supermesh matrix: plain constraint-row entries (on the band) and the same tokens in flight
    js = rep(js, "fontWeight: t.plain ? 700 : 600, color: t.plain ? ACCENT : INK,",
             "fontWeight: t.plain ? 700 : 600, color: t.plain ? ACCENT_TXT : INK,")
    js = rep(js, "width: 60, textAlign: 'center', fontFamily: MONO, fontSize: fs, fontWeight: 700, color: ACCENT }}>{t.text}</div>);",
             "width: 60, textAlign: 'center', fontFamily: MONO, fontSize: fs, fontWeight: 700, color: ACCENT_TXT }}>{t.text}</div>);")
    # PPR-AT-008-R2-1 (PED-10): line 2 names the boundary source; highlight it in the l9 shared-branch style
    js = rep(js, "        <rect x={G.TMx} y={G.TOPY} width={G.TRx - G.TMx} height={G.BOTY - G.TOPY} fill={AMBER} opacity=\"0.06\" />\n"
                 "        {els}\n",
             "        <rect x={G.TMx} y={G.TOPY} width={G.TRx - G.TMx} height={G.BOTY - G.TOPY} fill={AMBER} opacity=\"0.06\" />\n"
             "        {srcHi > 0 && (<g opacity={srcHi}>{/* PPR-AT-008-R2-1: l2 names this source; same 10 px, 0.25 accent underlay as the l9 shared branch */}\n"
             "          <line x1={G.TRx} y1={G.TOPY + 6} x2={G.TRx} y2={G.BOTY - 6} stroke={ACCENT} strokeWidth=\"10\" strokeLinecap=\"round\" opacity=\"0.25\" />\n"
             "          <circle cx={G.TRx} cy={gMY} r=\"17\" fill=\"none\" stroke={ACCENT} strokeWidth=\"10\" opacity=\"0.25\" />\n"
             "        </g>)}\n"
             "        {els}\n")
    js = rep(js, "  const arrE = clamp((time - (T2 + 0.3)) / 0.6, 0, 1);\n  const els = [];\n  els.push(wire('bot', gBL, gBR));\n  // left 12V",
             "  const arrE = clamp((time - (T2 + 0.3)) / 0.6, 0, 1);\n"
             "  const srcHi = clamp((time - T2) / 0.5, 0, 1) * clamp((T3 - time) / 0.5, 0, 1);   // 0..1, on through line 2 only\n"
             "  const els = [];\n  els.push(wire('bot', gBL, gBR));\n  // left 12V")
    # PPR-AT-008-R2-2 (AP 05 §5): the mixed Mesh x current-source cell in a neutral style, text unchanged
    js = rep(js, "  const cell = (txt, good) => (\n"
                 "    <div style={{ flex: 1, padding: '14px 6px', textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 600,\n"
                 "      color: good ? GREEN_TXT : CORAL_TXT, background: good ? 'rgba(70,140,90,0.07)' : 'rgba(190,90,70,0.07)', borderRadius: 6 }}>{txt}</div>\n"
                 "  );\n",
             "  // cell tone: true = easy (green), false = hard (coral), null = neutral (mixed case; PPR-AT-008-R2-2)\n"
             "  const cell = (txt, good) => (\n"
             "    <div style={{ flex: 1, padding: '14px 6px', textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 600,\n"
             "      color: good === null ? INK : good ? GREEN_TXT : CORAL_TXT,\n"
             "      background: good === null ? 'rgba(35,38,46,0.05)' : good ? 'rgba(70,140,90,0.07)' : 'rgba(190,90,70,0.07)', borderRadius: 6 }}>{txt}</div>\n"
             "  );\n")
    js = rep(js, "{cell(<span style={{ fontSize: 13 }}>boundary: easy<br />shared: supermesh</span>, false)}",
             "{cell(<span style={{ fontSize: 13 }}>boundary: easy<br />shared: supermesh</span>, null)}")
    return js


def template(t):
    """Inner title and version meta."""
    t = rep(t, "<title>Mesh Analysis — Part 2 · " + OLD + "</title>", "<title>Mesh Analysis — Part 2 · " + NEW + "</title>")
    t = rep(t, "<meta name=\"version\" content=\"" + OLD + "\">", "<meta name=\"version\" content=\"" + NEW + "\">")
    return t


def outer(s):
    """Outer wrapper title and version meta (shown while the bundle unpacks)."""
    s = rep(s, "<title>Mesh Analysis — Part 2 · " + OLD + "</title>", "<title>Mesh Analysis — Part 2 · " + NEW + "</title>")
    s = rep(s, "<meta name=\"version\" content=\"" + OLD + "\">", "<meta name=\"version\" content=\"" + NEW + "\">")
    return s


def main():
    """Verify the input, edit it through design_bundle.py, write in place."""
    path = os.path.join(ROOT, PAGE)
    got = sha(path)
    if got != PRE_SHA:
        sys.exit('%s: SHA-256 %s is not the pre-edit %s (already edited?)' % (PAGE, got[:12], PRE_SHA[:12]))
    subprocess.run([sys.executable, '-I', TOOL, 'roundtrip', path], check=True)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([sys.executable, '-I', TOOL, 'unpack', path, d], check=True)
        jp = os.path.join(d, 'res', SCENE + '.js')
        js = scene(open(jp, encoding='utf-8').read())
        open(jp, 'w', encoding='utf-8').write(js)
        tp = os.path.join(d, 'template.html')
        tmpl = template(open(tp, encoding='utf-8').read())
        open(tp, 'w', encoding='utf-8').write(tmpl)
        out = os.path.join(d, 'out.html')
        subprocess.run([sys.executable, '-I', TOOL, 'repack', path, d, out], check=True)
        s = outer(open(out, encoding='utf-8').read())
        assert OLD not in s.split('<script type="__bundler/manifest">')[0], 'old stamp left in outer head'
        open(path, 'w', encoding='utf-8', newline='').write(s)
    print('%s  %d B  %s' % (PAGE, os.path.getsize(path), sha(path)))


if __name__ == '__main__':
    main()
