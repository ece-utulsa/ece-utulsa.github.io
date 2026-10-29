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
VERSION = '2.0.0'
RELEASED = '2026-10-28'
CHANGELOG = ('\n    v2.0.0 - Wilkinson Power Divider Designer v1.0.0 rebuilt as the Power Divider Designer (briefing '
             '2026-10-28 rev 1): vanilla JS, one offline file, light theme default with a dark toggle. Topologies: Wilkinson '
             '(equal N-way star, unequal 2-way, 1-4 binomial or Chebyshev sections; unequal multisection with tapered arms and '
             'output transformers), lossless T-junction (optional lambda/4 transformers), resistive Y and Delta, and the N-way '
             'branching tree (any N, a module and ratio per junction: Wilkinson, branching line or resistive Y; uniform or '
             'cosine-on-pedestal output taper). Isolation resistors by even/odd-mode minimax over the S11 <= -20 dB band (checked '
             'against Cohn), refined with the full solver for unequal splits (D1); bandwidths of every port, the narrowest as the '
             'usable bandwidth (D5); phase of every output and the imbalance (D4); microstrip relabelled Pozar (Wheeler) with '
             'Hammerstad-Jensen + Kirschning-Jansen as an option (D6); corrected mismatch text (D2). To-scale layout as the '
             'centrepiece: true widths and lengths, 0402/0603 pads, launches, scale bar, hover shared with the schematic, '
             'growth animation, power-flow overlay, binary or H-tree placement with interconnects and delay lines for equal '
             'paths; straight, arc (ring), meander and mitred sections held at lambda_g/4 along the centreline, with radius and '
             'spacing warnings, footprint and saving, side-by-side with straight. Input power in W or dBm, output power in W, '
             'dBm and % solved beside ideal, width-vs-ratio plot and minimum-width flag. Performance page (plot, markers, range, '
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
