#!/usr/bin/env python3
"""Build the single-file Power Divider Designer from the sources in this folder (see README.md).

The delivered page is ONE plain HTML file (no bundle, no loader): template.html with
  @@FONTFACES@@  the embedded IBM Plex Mono faces (base64 woff2 in @font-face)
  @@SCRIPT@@     the application scripts, concatenated inside one strict-mode function (no globals)
  @@VERSION@@ @@RELEASED@@ @@CHANGELOG@@  the release fields below.

Usage:  python3 build.py            writes ../Power_Divider_Designer_v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import base64
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '2.0.2'
RELEASED = '2026-11-25'
CHANGELOG = ('\n    v2.0.2 - fix pass on the v2.0.1 gates (briefing 2026-11-23). Reciprocity badge judges |Sij - Sji| against the '
             'largest |S| in the matrix (DEFECT-PDD-011 = PPR-PDD-001). Performance f min, f max and floor refuse in words with '
             'the value in use kept, limits from RANGES (DEFECT-PDD-012 = CQ-PDD-007 = VIS-PDD-005). Parameters substrate '
             'and totals tables wrap instead of overlapping (VIS-PDD-016). One load |G| limit for slider, restore and notice '
             '(DEFECT-PDD-015 = CQ-PDD-014 = SEC-PDD-010). Restore notices for a stored null, Object.prototype key names and '
             'cut lists (DEFECT-PDD-013, SEC-PDD-011). One marker frequency in the plot and the power flow (DEFECT-PDD-014). '
             'Quasi-TEM warning names a section as on the Parameters sheet (DEFECT-PDD-016). Status line says lossless for '
             'a signal at the input (PPR-PDD-013); theorem sentence names line loss and is shorter (PPR-PDD-014, VIS-PDD-018). '
             'L09 B and L07 constants as on the slides (PPR-PDD-015). Beyond-the-notes tags on Theory 2 (N-way star) and 10 '
             '(PPR-PDD-016). f_T worded as strong coupling to the TM0 surface wave (PPR-PDD-017). N = 4 S-matrix fits at '
             '1024x768 and 125 % (VIS-PDD-017). sdb at every |Sij| dB site and one dB-per-neper constant (CQ-PDD-010); '
             'purpose comments (CQ-PDD-009); one microstrip factory per Parameters sheet (CQ-PDD-011).'
             '\n    v2.0.1 (2026-11-22) - fix pass on the first gates (briefing 2026-11-19 and addendum 1). Reciprocity badge uses a relative '
             'tolerance (PPR-PDD-001). Designer status line and the theorem sentence are computed from the S-matrix checks of '
             'the state on screen (resistors off, R scale, ripple, T transformers off); "Three-port theorem" only for three-ports '
             '(PPR-PDD-002, -007). R absorbs only the odd-mode part of output reflections (PPR-PDD-003). Default microstrip '
             'model is the course formula set (L09 synthesis, L06 two-branch eps_eff, L07 Z0 check); H-J + K-J tagged beyond '
             'the notes (PDD-3). Quasi-TEM range warning near the outputs (PDD-4). "Beyond the lecture notes" tags (PDD-1). '
             'Theory 3 in Pozar K^2 = P3/P2 with the control mapping (PDD-2). Wording: Exp 06, ideal split, ideal-line model, '
             'line-loss scaling (PPR-PDD-006, -009, -010, -011). Port launch 0 draws (DEFECT-PDD-001); "+3" accepted '
             '(DEFECT-PDD-002); stored marker, load angle and tree modules bounded or allow-listed, and every discarded stored '
             'setting named in a notice (DEFECT-PDD-003, -004, SEC-PDD-002); refused entries named in words with the value in '
             'use kept in the field (CQ-PDD-007, VIS-PDD-005); no -0.0 or -180.0 (DEFECT-PDD-005); one precision per quantity '
             '(DEFECT-PDD-010); no raw-HTML sinks, DOM built with createElement/textContent (SEC-PDD-001, CQ-PDD-006); the Tests '
             'page never writes storage (SEC-PDD-003); one re-derive per slider change (CQ-PDD-004); outputs table, marker '
             'readout, off-state chips and focus rings at 1024x768, 1366x768 and 125 % (VIS-PDD-001, -002, -004, -006).'
             '\n    v2.0.0 (2026-10-29) - Wilkinson Power Divider Designer v1.0.0 rebuilt as the Power Divider Designer (briefing '
             '2026-10-28 rev 1): vanilla JS, one offline file, light theme default with a dark toggle. Topologies: Wilkinson '
             '(equal N-way star, unequal 2-way, 1-4 binomial or Chebyshev sections; unequal multisection with tapered arms and '
             'output transformers), lossless T-junction (optional lambda/4 transformers), resistive Y and Delta, and the N-way '
             'branching tree (any N, a module and ratio per junction: Wilkinson, branching line or resistive Y; uniform or '
             'cosine-on-pedestal output taper). Isolation resistors by even/odd-mode minimax over the S11 <= -20 dB band (checked '
             'against Cohn), refined with the full solver for unequal splits (D1); bandwidths of every port, the narrowest as the '
             'usable bandwidth (D5); phase of every output and the imbalance (D4); microstrip Pozar (Wheeler) with '
             'Hammerstad-Jensen + Kirschning-Jansen as an option (D6); corrected mismatch text (D2). To-scale layout as the '
             'centrepiece: true widths and lengths, 0402/0603 pads, launches, scale bar, hover shared with the parameter sheet, '
             'growth animation, power-flow overlay, binary or H-tree placement with interconnects and delay lines for equal '
             'paths; straight, arc (ring), meander and mitred sections held at lambda_g/4 along the centreline, with radius and '
             'spacing warnings, footprint and saving, side-by-side with straight. Input power in W or dBm, output power in W, '
             'dBm and % solved beside ideal, and a minimum-width flag. Performance page (plot, markers, range, '
             'phase, pinned comparison, power flow at f0 and the marker, S-matrix checks, three-port theorem, tree vs direct '
             'N-way), Parameters page (build sheet, CSV, print), Theory, Experiments and an in-page Tests page. SMA connectors '
             '(edge launch at the board edge, vertical inside an H-tree) and a 3D view of the board (orbit, zoom, height '
             'exaggeration); the two outputs of every 2-way stage leave the output node as separate lines.')
# ── END RELEASE ───────────────────────────────────────────────────────

SCRIPTS = ['engine.js', 'layout.js', 'ui.js', 'view3d.js', 'designer.js', 'perf.js', 'params.js', 'docs.js', 'tests.js', 'main.js']
FONTS = [('IBMPlexMono-Regular-latin.woff2', 400), ('IBMPlexMono-SemiBold-latin.woff2', 600)]
HERE = os.path.dirname(os.path.abspath(__file__))


def read(name, mode='r'):
    """Read a source file relative to this folder."""
    with open(os.path.join(HERE, name), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def fontfaces():
    """@font-face rules with each font embedded as a base64 data: URL (no network request)."""
    rules = []
    for name, weight in FONTS:
        data = base64.b64encode(read(os.path.join('fonts', name), 'rb')).decode('ascii')
        rules.append("@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:%d;font-display:block;"
                     "src:url(data:font/woff2;base64,%s) format('woff2')}" % (weight, data))
    return '\n'.join(rules)


def script():
    """The application scripts in order, wrapped in one strict-mode function scope."""
    body = '\n'.join(read(s).rstrip() + '\n' for s in SCRIPTS)
    if '</script' in body.lower():
        raise SystemExit('a script source contains "</script"')
    return "(function(){\n'use strict';\n" + body + '})();'


def build():
    """Fill the template and return the page."""
    page = read('template.html')
    for key, val in (('@@FONTFACES@@', fontfaces()), ('@@SCRIPT@@', script()), ('@@VERSION@@', 'v' + VERSION),
                     ('@@RELEASED@@', RELEASED), ('@@CHANGELOG@@', CHANGELOG)):
        page = page.replace(key, val)
    if '@@' in page:
        raise SystemExit('unfilled placeholder in the template')
    return page


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'Power_Divider_Designer_v%s.html' % VERSION)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(build())
    print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
