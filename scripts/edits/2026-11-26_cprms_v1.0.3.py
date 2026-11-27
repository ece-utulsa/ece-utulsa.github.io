#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for Complex Power - RMS and Effective Values v1.0.2 (Animation Rubric §6.4).

Purpose: reproduce PR "Complex Power - RMS and Effective Values v1.0.3 — two R2 Minors".
Briefing: Queue/2026-11-26_ClaudeCode_briefing_ComplexPower-RMS_v1.0.3.md (STANDING GO 2026-11-15).
Items: PPR-AT-017-14 m (V_ac definition bracketed: rms of [v(t) − V_dc]), DEFECT-CPRMS-R2-002 m (the zero
axis joins the V_dc label clearance rule). Nothing else.
Usage (from the repo root, on the published v1.0.2 file):
  python3 -I scripts/edits/2026-11-26_cprms_v1.0.3.py
Same edit path as scripts/edits/2026-11-26_cprms_v1.0.2.py: the input is checked against its pre-edit
SHA-256, round-tripped unchanged through scripts/design_bundle.py, edited by exact string replacements
(each asserted to match the stated number of times), repacked, and written in place. Re-running on the
edited file stops at the hash check.
"""
import hashlib, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
PAGE = 'ece-2003/Complex Power - RMS and Effective Values.html'
PRE_SHA = '845ce03dd080bff42a1f83de1a7ebf27c87b546b69671ee748530538593e8a22'   # v1.0.2, PR #154 (published ae77eda)
SCENE = 'a44bc461-15ba-493a-9c8b-e6d2821c20d0'                                  # cp1-rms-scene.jsx
OLD_VERSION = 'v1.0.2'
VERSION = 'v1.0.3'
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
    """Version stamp; bracketed V_ac definition; the zero axis joins the V_dc label clearance set."""
    js = rep(js,
             "// Version v1.0.2 (2026-11-26). Author of this revision: Claude Code — PPR-AT-017-11, PPR-AT-017-13 and\n",
             "// Version v1.0.3 (2026-11-26). Author of this revision: Claude Code — PPR-AT-017-14 and DEFECT-CPRMS-R2-002\n"
             "//   only: the V_ac definition reads rms of [v(t) − V_dc]; the V_dc label also clears the zero axis.\n"
             "// Version v1.0.2 (2026-11-26). Author of that revision: Claude Code — PPR-AT-017-11, PPR-AT-017-13 and\n")
    # DEFECT-CPRMS-R2-002: the zero axis is one more line the label text box must clear
    js = rep(js,
             "// y (baseline) of the V_dc label: the first candidate inside the plot whose text box clears the V_dc and\n"
             "// V_rms lines — above or below the V_dc line, else above or below the pair when they (nearly) coincide\n"
             "function dcLabelY(yDc, yRms, H) {\n"
             "  const hi = Math.min(yDc, yRms), lo = Math.max(yDc, yRms), maxY = H - DC_LBL_DESC;\n"
             "  const clear = (b) => [yDc, yRms].every((yl) => yl < b - DC_LBL_ASC - DC_LBL_GAP || yl > b + DC_LBL_DESC + DC_LBL_GAP);\n"
             "  const cands = [yDc - DC_LBL_UP, yDc + DC_LBL_DOWN, hi - DC_LBL_UP, lo + DC_LBL_DOWN];\n"
             "  for (const b of cands) if (b >= DC_LBL_EDGE && b <= maxY && clear(b)) return b;\n"
             "  return Math.min(Math.max(lo + DC_LBL_DOWN, DC_LBL_EDGE), maxY);   // not reached in the reachable range\n"
             "}\n",
             "// y (baseline) of the V_dc label: the first candidate inside the plot whose text box clears the V_dc line,\n"
             "// the V_rms line and the zero axis — above or below the V_dc line, else above or below the V_dc / V_rms\n"
             "// pair, else above or below all three lines when they lie close together (DEFECT-CPRMS-R2-002)\n"
             "function dcLabelY(yDc, yRms, yZero, H) {\n"
             "  const lines = [yDc, yRms, yZero], maxY = H - DC_LBL_DESC;\n"
             "  const pairHi = Math.min(yDc, yRms), pairLo = Math.max(yDc, yRms);\n"
             "  const allHi = Math.min(...lines), allLo = Math.max(...lines);\n"
             "  const clear = (b) => lines.every((yl) => yl < b - DC_LBL_ASC - DC_LBL_GAP || yl > b + DC_LBL_DESC + DC_LBL_GAP);\n"
             "  const cands = [yDc - DC_LBL_UP, yDc + DC_LBL_DOWN, pairHi - DC_LBL_UP, pairLo + DC_LBL_DOWN, allHi - DC_LBL_UP, allLo + DC_LBL_DOWN];\n"
             "  for (const b of cands) if (b >= DC_LBL_EDGE && b <= maxY && clear(b)) return b;\n"
             "  return Math.min(Math.max(allLo + DC_LBL_DOWN, DC_LBL_EDGE), maxY);   // not reached in the reachable range\n"
             "}\n")
    js = rep(js,
             "<text x={W - 4} y={dcLabelY(y(sol.Vdc), y(sol.Vrms), H)}",
             "<text x={W - 4} y={dcLabelY(y(sol.Vdc), y(sol.Vrms), y(0), H)}")
    # PPR-AT-017-14: unambiguous V_ac definition (rms of the waveform minus its mean)
    js = rep(js,
             "\\u00b7 V_ac = rms of v \\u2212 V_dc',\n",
             "\\u00b7 V_ac = rms of [v(t) \\u2212 V_dc]',\n")
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
