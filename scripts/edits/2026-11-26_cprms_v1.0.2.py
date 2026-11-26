#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for Complex Power - RMS and Effective Values v1.0.2 (Animation Rubric §6.4).

Purpose: reproduce PR "Complex Power - RMS and Effective Values v1.0.2 — R2 on-screen Minors".
Briefing: Queue/2026-11-25_ClaudeCode_briefing_ComplexPower-RMS_v1.0.2.md (STANDING GO 2026-11-15).
Items: PPR-AT-017-11 m (on-screen definition of V_dc and V_ac), PPR-AT-017-13 m (no line at −V_rms),
DEFECT-CPRMS-R2-001 m (V_dc label clear of the V_dc and V_rms lines in every reachable state). Nothing else.
Usage (from the repo root, on the v1.0.1 file):
  python3 -I scripts/edits/2026-11-26_cprms_v1.0.2.py
Same edit path as scripts/edits/2026-11-25_cprms_AT-017-1.py: the input is checked against its pre-edit
SHA-256, round-tripped unchanged through scripts/design_bundle.py, edited by exact string replacements
(each asserted to match the stated number of times), repacked, and written in place. Re-running on the
edited file stops at the hash check.
"""
import hashlib, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
PAGE = 'ece-2003/Complex Power - RMS and Effective Values.html'
PRE_SHA = '778b8ca799ea2744db53711ce5abf93da97dcd671b52f42df55d67ea17dee35b'   # v1.0.1, PR #149 (published)
SCENE = 'a44bc461-15ba-493a-9c8b-e6d2821c20d0'                                  # cp1-rms-scene.jsx
OLD_VERSION = 'v1.0.1'
VERSION = 'v1.0.2'
TITLE = 'RMS and Effective Values'


def sha(path):
    """SHA-256 of a file, hex."""
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:70], n)
    return s.replace(old, new)


# ═══ scene module edits ═══
def scene(js):
    """Version stamp; V_dc/V_ac definition line; −V_rms line removed; V_dc label placed clear of both lines."""
    js = rep(js,
             "// Version v1.0.1 (2026-11-25). Author of this revision: Claude Code — AT-017-1 and AT-017-2 m only:\n",
             "// Version v1.0.2 (2026-11-26). Author of this revision: Claude Code — PPR-AT-017-11, PPR-AT-017-13 and\n"
             "//   DEFECT-CPRMS-R2-001 only: on-screen definition of V_dc and V_ac beside the readouts, no line at −V_rms,\n"
             "//   and the V_dc label kept clear of the V_dc and V_rms lines in every reachable state.\n"
             "// Version v1.0.1 (2026-11-25). Author of that revision: Claude Code — AT-017-1 and AT-017-2 m only:\n")
    # DEFECT-CPRMS-R2-001: label position chosen from candidates; the text box must clear both lines
    js = rep(js,
             "const DC_LBL_UP = 6, DC_LBL_DOWN = 14, DC_LBL_CLEAR = 18, DC_LBL_EDGE = 12; // V_dc label offsets, px\n"
             "// y of the V_dc label: above its line, or below it when the V_rms line runs just above (no overprint)\n"
             "function dcLabelY(yDc, yRms, H) {\n"
             "  const below = yRms < yDc && yDc - yRms < DC_LBL_CLEAR;\n"
             "  return Math.min(Math.max(below ? yDc + DC_LBL_DOWN : yDc - DC_LBL_UP, DC_LBL_EDGE), H - 3);\n"
             "}\n",
             "const DC_LBL_UP = 6, DC_LBL_DOWN = 14, DC_LBL_EDGE = 12; // V_dc label baseline offsets from a line, px\n"
             "const DC_LBL_ASC = 11, DC_LBL_DESC = 3;              // label text box (font em box, 11 px mono) above / below its baseline, px\n"
             "const DC_LBL_GAP = 2.5;                              // least gap between the text box and a line centre, px\n"
             "// y (baseline) of the V_dc label: the first candidate inside the plot whose text box clears the V_dc and\n"
             "// V_rms lines — above or below the V_dc line, else above or below the pair when they (nearly) coincide\n"
             "function dcLabelY(yDc, yRms, H) {\n"
             "  const hi = Math.min(yDc, yRms), lo = Math.max(yDc, yRms), maxY = H - DC_LBL_DESC;\n"
             "  const clear = (b) => [yDc, yRms].every((yl) => yl < b - DC_LBL_ASC - DC_LBL_GAP || yl > b + DC_LBL_DESC + DC_LBL_GAP);\n"
             "  const cands = [yDc - DC_LBL_UP, yDc + DC_LBL_DOWN, hi - DC_LBL_UP, lo + DC_LBL_DOWN];\n"
             "  for (const b of cands) if (b >= DC_LBL_EDGE && b <= maxY && clear(b)) return b;\n"
             "  return Math.min(Math.max(lo + DC_LBL_DOWN, DC_LBL_EDGE), maxY);   // not reached in the reachable range\n"
             "}\n")
    # PPR-AT-017-13: the faint dashed line at −V_rms is removed (not replaced)
    js = rep(js,
             "            <line x1=\"0\" y1={y(-sol.Vrms)} x2={W} y2={y(-sol.Vrms)} stroke={C_RMS} strokeWidth=\"1.4\" strokeDasharray=\"3 6\" opacity=\"0.55\" />\n",
             "")
    # PPR-AT-017-11: one on-screen line beside the readouts defining V_dc and V_ac (no narration change)
    js = rep(js,
             "      noteExplore: 'you have the model \\u2014 push the offset and watch rms climb',\n",
             "      noteExplore: 'you have the model \\u2014 push the offset and watch rms climb',\n"
             "      dcDef: 'V_dc = mean of v(t) over one period (the shape\\u2019s own mean + the offset) \\u00b7 V_ac = rms of v \\u2212 V_dc',\n")
    js = rep(js,
             "        <div style={{ fontFamily: HEAD, fontSize: 12.5, color: FAINT, textWrap: 'pretty' }}>{note}</div>\n",
             "        <div data-gate=\"dcdef\" style={{ fontFamily: HEAD, fontSize: 12, color: MUTE, textWrap: 'pretty' }}>{ui.dcDef}</div>\n"
             "        <div style={{ fontFamily: HEAD, fontSize: 12.5, color: FAINT, textWrap: 'pretty' }}>{note}</div>\n")
    return js


def template(t):
    """Inner page title and version meta."""
    t = rep(t, '<title>' + TITLE + ' · ' + OLD_VERSION + '</title>', '<title>' + TITLE + ' · ' + VERSION + '</title>')
    return rep(t, '<meta name="version" content="' + OLD_VERSION + '">', '<meta name="version" content="' + VERSION + '">')


def outer(s):
    """Outer wrapper title and version meta (shown while the bundle unpacks)."""
    s = rep(s, '<title>' + TITLE + ' · ' + OLD_VERSION + '</title>', '<title>' + TITLE + ' · ' + VERSION + '</title>')
    return rep(s, '<meta name="version" content="' + OLD_VERSION + '">', '<meta name="version" content="' + VERSION + '">')


def main():
    """Verify input, edit through design_bundle.py, write in place."""
    path = os.path.join(ROOT, PAGE)
    got = sha(path)
    if got != PRE_SHA:
        sys.exit('%s: SHA-256 %s is not the pre-edit %s (already edited?)' % (PAGE, got[:12], PRE_SHA[:12]))
    subprocess.run([sys.executable, '-I', TOOL, 'roundtrip', path], check=True)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([sys.executable, '-I', TOOL, 'unpack', path, d], check=True)
        jp = os.path.join(d, 'res', SCENE + '.js')
        js = scene(open(jp, encoding='utf-8').read())   # read before the write handle truncates the file
        open(jp, 'w', encoding='utf-8').write(js)
        tp = os.path.join(d, 'template.html')
        t = template(open(tp, encoding='utf-8').read())
        open(tp, 'w', encoding='utf-8').write(t)
        out = os.path.join(d, 'out.html')
        subprocess.run([sys.executable, '-I', TOOL, 'repack', path, d, out], check=True)
        s = outer(open(out, encoding='utf-8').read())
    open(path, 'w', encoding='utf-8', newline='').write(s)
    print('wrote', PAGE, sha(path))


if __name__ == '__main__':
    main()
