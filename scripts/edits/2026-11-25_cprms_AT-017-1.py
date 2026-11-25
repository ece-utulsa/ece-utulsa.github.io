#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for Complex Power - RMS and Effective Values v1.0.1 (Animation Rubric §6.4).

Purpose: reproduce PR "Complex Power - RMS and Effective Values v1.0.1 — AT-017-1: V_dc is the mean of v(t)".
Briefing: Queue/2026-11-22_ClaudeCode_briefing_ComplexPower-RMS_v1.0.1.md (STANDING GO 2026-11-15).
Items: AT-017-1 (= PPR-AT-017-1, Critical) and AT-017-2 m (duty shown to two decimals). Nothing else.
Usage (from the repo root, on the pre-edit file):
  python3 -I scripts/edits/2026-11-25_cprms_AT-017-1.py
The input is checked against its pre-edit SHA-256, round-tripped unchanged through
scripts/design_bundle.py, edited by exact string replacements (each asserted to match the
stated number of times), repacked, and written in place. Re-running on the edited file stops
at the hash check.
"""
import hashlib, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
PAGE = 'ece-2003/Complex Power - RMS and Effective Values.html'
PRE_SHA = '7b69fc1a6011710ea0c138173d3aa710f24e54a2da55a481da4e78ad8a1b3131'   # main 25559f2 (triage build)
SCENE = 'a44bc461-15ba-493a-9c8b-e6d2821c20d0'                                  # cp1-rms-scene.jsx
VERSION = 'v1.0.1'                                                               # first version stamp for this page
TITLE = 'RMS and Effective Values'


def sha(path):
    """SHA-256 of a file, hex."""
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:70], n)
    return s.replace(old, new)


# ═══ AT-017-1: V_dc = mean of v(t); V_ac = sqrt(V_rms² − V_dc²); quadrature row true as displayed ═══
def scene(js):
    """Solver, quadrature row, V_dc readout and plot line use the true mean; duty slider shows two decimals."""
    js = rep(js, "// cp1-rms-scene.jsx \u2014 CP-1 \u00b7 RMS / Effective values.\n",
             "// cp1-rms-scene.jsx \u2014 CP-1 \u00b7 RMS / Effective values.\n"
             "// Version " + VERSION + " (2026-11-25). Author of this revision: Claude Code \u2014 AT-017-1 and AT-017-2 m only:\n"
             "//   V_dc is the mean of v(t) over one period, V_ac = \u221a(V_rms\u00b2 \u2212 V_dc\u00b2) (rms of v \u2212 V_dc),\n"
             "//   the quadrature row is true to its displayed precision, and duty is shown to two decimals.\n")
    # solver: DC component is the period mean of v(t), not the offset slider value
    js = rep(js, "function solve(w) {\n",
             "// mean of v(t) over one period, on the same samples as rmsOf \u2014 the DC component V_dc, V\n"
             "function meanOf(w, N) {\n"
             "  const n = N || 4000; let acc = 0;\n"
             "  for (let i = 0; i < n; i++) acc += vAt(w, (i + 0.5) / n);\n"
             "  return acc / n;\n"
             "}\n"
             "function solve(w) {\n")
    js = rep(js,
             "  const Vac = rmsOf({ ...w, off: 0 });               // AC part alone\n",
             "  const Vdc = meanOf(w);                             // DC component: mean of v(t), V (AT-017-1)\n"
             "  const Vac = Math.sqrt(Math.max(0, Vrms * Vrms - Vdc * Vdc)); // rms of v \u2212 V_dc, V (AT-017-1)\n"
             "  const shapeRms = rmsOf({ ...w, off: 0 });          // rms of the shape alone (offset 0), V; factor panel only\n")
    js = rep(js,
             "  return { Vrms, Vac, Vdc: w.off, meanSq: Vrms * Vrms, peak, minv,\n"
             "    factor: w.A > 0.01 ? Vac / w.A : 0, P: Vrms * Vrms / R_LOAD };\n",
             "  return { Vrms, Vac, Vdc, meanSq: Vrms * Vrms, peak, minv,\n"
             "    factor: w.A > 0.01 ? shapeRms / w.A : 0, P: Vrms * Vrms / R_LOAD };\n")
    # display helpers: signed two-decimal volts without "−0.00"; quadrature terms at the fewest decimals that keep the row true
    js = rep(js, "const sgn = (v) => (v >= 0 ? '+' : '\\u2212');\n",
             "const sgn = (v) => (v >= 0 ? '+' : '\\u2212');\n"
             "const sv2 = (v) => { const r = Math.round(v * 100) / 100; return (r === 0 ? '' : r > 0 ? '+' : '\\u2212') + n2(Math.abs(r)); }; // signed, 2 dp, V; 0.00 unsigned\n"
             "const DC_LBL_UP = 6, DC_LBL_DOWN = 14, DC_LBL_CLEAR = 18, DC_LBL_EDGE = 12; // V_dc label offsets, px\n"
             "// y of the V_dc label: above its line, or below it when the V_rms line runs just above (no overprint)\n"
             "function dcLabelY(yDc, yRms, H) {\n"
             "  const below = yRms < yDc && yDc - yRms < DC_LBL_CLEAR;\n"
             "  return Math.min(Math.max(below ? yDc + DC_LBL_DOWN : yDc - DC_LBL_UP, DC_LBL_EDGE), H - 3);\n"
             "}\n"
             "const QUAD_DP_MIN = 2, QUAD_DP_MAX = 4;             // decimals tried for V_dc\u00b2 and V_ac\u00b2 (V\u00b2)\n"
             "// V_dc\u00b2 and V_ac\u00b2 as shown in the quadrature row: the fewest decimals (2\u20134) at which\n"
             "// \u221a(shown V_dc\u00b2 + shown V_ac\u00b2) rounds to the shown V_rms (AT-017-1 requirement 3)\n"
             "function quadTerms(sol) {\n"
             "  const a = sol.Vdc * sol.Vdc, b = sol.Vac * sol.Vac;\n"
             "  let dp = QUAD_DP_MIN, ta, tb;\n"
             "  for (; dp <= QUAD_DP_MAX; dp++) {\n"
             "    ta = a.toFixed(dp); tb = b.toFixed(dp);\n"
             "    if (n2(Math.sqrt(parseFloat(ta) + parseFloat(tb))) === n2(sol.Vrms)) break;\n"
             "  }\n"
             "  return [ta, tb];\n"
             "}\n")
    js = rep(js,
             "{'\\u221a'}(<span style={{ color: C_DC }}>{n1(sol.Vdc * sol.Vdc)}</span> + <span style={{ color: C_V }}>{n1(sol.Vac * sol.Vac)}</span>) ={' '}",
             "{'\\u221a'}(<span style={{ color: C_DC }}>{quadTerms(sol)[0]}</span> + <span style={{ color: C_V }}>{quadTerms(sol)[1]}</span>) ={' '}")
    js = rep(js, "{stat('V_dc', `${sgn(sol.Vdc)}${nv(Math.abs(sol.Vdc))} V`, C_DC)}",
             "{stat('V_dc', `${sv2(sol.Vdc)} V`, C_DC)}")
    # waveform plot: the dashed V_dc line sits at the mean of v(t) and carries its value
    js = rep(js,
             "        {wave.off !== 0 && (\n"
             "          <g>\n"
             "            <line x1=\"0\" y1={y(wave.off)} x2={W} y2={y(wave.off)} stroke={C_DC} strokeWidth=\"1.6\" strokeDasharray=\"2 5\" />\n"
             "            <text x={W - 4} y={y(wave.off) - 6} textAnchor=\"end\" fontFamily={MONO} fontSize=\"11\" fill={C_DC}>\n"
             "              V_dc {sgn(wave.off)}{nv(Math.abs(wave.off))}\n"
             "            </text>\n",
             "        {n2(Math.abs(sol.Vdc)) !== '0.00' && (\n"
             "          <g>\n"
             "            <line x1=\"0\" y1={y(sol.Vdc)} x2={W} y2={y(sol.Vdc)} stroke={C_DC} strokeWidth=\"1.6\" strokeDasharray=\"2 5\" />\n"
             "            <text x={W - 4} y={dcLabelY(y(sol.Vdc), y(sol.Vrms), H)} textAnchor=\"end\" fontFamily={MONO} fontSize=\"11\" fill={C_DC}>\n"
             "              V_dc {sv2(sol.Vdc)} V\n"
             "            </text>\n")
    # AT-017-2 m: the duty readout shows two decimals (0.95 read "1.0")
    js = rep(js, "function Slider({ label, value, min, max, step, unit, color, onChange, onGrab, disabled, big }) {",
             "function Slider({ label, value, min, max, step, unit, color, onChange, onGrab, disabled, big, fmt }) {")
    js = rep(js, "{value > 0 && big ? '+' : ''}{nv(value)}", "{value > 0 && big ? '+' : ''}{fmt ? fmt(value) : nv(value)}")
    js = rep(js, "<Slider label={ui.duty} value={wave.D} min={D_MIN} max={D_MAX} step={0.05} unit=\"\"",
             "<Slider label={ui.duty} value={wave.D} min={D_MIN} max={D_MAX} step={0.05} unit=\"\" fmt={n2}")
    return js


def template(t):
    """Inner page title and version meta."""
    return rep(t, '<meta name="viewport" content="width=device-width, initial-scale=1">\n',
               '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
               '<title>' + TITLE + ' \u00b7 ' + VERSION + '</title>\n<meta name="version" content="' + VERSION + '">\n')


def outer(s):
    """Outer wrapper title and version meta (shown while the bundle unpacks)."""
    return rep(s, '<title>Bundled Page</title>',
               '<title>' + TITLE + ' \u00b7 ' + VERSION + '</title>\n  <meta name="version" content="' + VERSION + '">')


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
