#!/usr/bin/env python3
"""Build the single-file RF Cascade Analyzer from the sources in this folder.

The delivered page is ONE plain HTML file (no bundle, no loader): template.html with
  @@FONTFACES@@  the embedded IBM Plex Mono faces (base64 woff2 in @font-face)
  @@SCRIPT@@     the application scripts, concatenated inside one strict-mode function
                 (no globals: there is no window-level object for tests, spec D10.4)
  @@VERSION@@ @@RELEASED@@ @@CHANGELOG@@  the release fields below.

Sources:
  template.html                        markup, CSS and the version stamp
  engine.js ui.js reflections.js devices.js cascade.js main.js   application scripts, in this order
  fonts/*.woff2                        IBM Plex Mono (SIL OFL 1.1), latin subset, 400 and 600

Usage:  python3 build.py            writes ../RF_Cascade_Analyzer_v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import base64
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '1.7.0'
RELEASED = '2026-10-23'
CHANGELOG = ('\n    v1.7.0 - Cascade: v1.1.0\'s Lab brought back (source Vs and Zs, reference Z0, loads with Matched/Short/Open, '
             'device presets with S entries, results with node voltages, currents and powers), its settings and results in the '
             'side panel and the circuit drawn large across the drawing area; a power divider can be inserted at any junction, '
             'splitting the chain into two parallel branches with their own loads; a frequency band (centre ± span or '
             'start–stop) is sent through the circuit, with the spectrum at every junction, the response across the band, '
             'a marker frequency, and frequency-dependent lines and Butterworth low-, high- and band-pass filters.'
             '\n    v1.6.0 - Devices: drawn as the incident / reflected / transmitted flow diagram (V1⁺ and V2⁺ split into '
             'S21, S11 and S12, S22; braces gather V1⁻ and V2⁻; a DUT box with Port 1 and Port 2), each path in its S colour '
             'and as wide as its power, unexcited paths faded but clearly visible, values and power shares on the paths; '
             'every device\'s S entries editable, keeping the device as "<Device> (edited)" with a reset.'
             '\n    v1.5.0 - Devices: two-port drawn as the textbook signal-flow graph (each port two terminal wires, a in on '
             'top, b out on the bottom; S21 and S12 crossing, S11 and S22 down each side); wave arrows always solid; '
             'S-parameters adjustable on every device. Reflections: an open or a short ends the line (a marker at the '
             'interface, nothing enters Region 2). Cascade: the v1.3.0 drawing restored, with the S-parameter editor kept; '
             'a block can be inserted at any junction of the chain.'
             '\n    v1.4.1 - Declutter: smaller text at all window sizes; Reflections — separate power rows, voltage plot '
             'enlarged, titles/legend/caption to the side panel, VSWR equation and extra labels removed, incident/reflected '
             'off by default; Devices — one port line per side, waves as arrows beside it, thinner paths, smaller matrix; '
             'Cascade — S-parameter editor shown on selection.'
             '\n    v1.4.0 - Reflections: titled power panel; voltage panel with incident, reflected, total and transmitted waves '
             '(Region 2 to ∞) and V⁺ + V⁻ = Vₜ readout; signed Γ and τ. Devices: S values moved into a numeric matrix row; '
             'power line clear of the port labels; waves neutral/text colour, path colours for S only. Cascade: junction '
             'powers labelled × input; dB with power factor; river arithmetic; budget shows dB adding.'
             '\n    v1.3.0 - Devices: two-port redrawn as straight power-tapered lanes (S21 top, S12 bottom) with reflection '
             'U-turns; no text inside the box; labels outside.'
             '\n    v1.2.1 - Devices: power shown beside the driven wave (|b|²) and dB caption gives × power and × wave.'
             '\n    v1.2.0 - Three views (Reflections, Devices, Cascade); normalized waves a/b on Devices with forward/reverse '
             'drive; version stamp in presentation mode; layout fixes.'
             '\n    v1.1.0 - Normalized waves on Devices; forward/reverse; polish (2 significant figures, Cascade alignment, '
             'larger Devices drawing, readable reflection paths). Rework to three views (Reflections, Devices, Cascade) after '
             'review of PR #43: the six Lecture steps, the step rail and the old Lab (cascade and divider tables, source '
             'EMF/Zs) are replaced; Devices keeps the two-port path diagram with path width proportional to |S|; Cascade adds '
             'the power-flow band and dB budget. Visual-first rebuild fixes PF-1 (open load read as a short), PF-2 (Deg/Rad '
             'switch changed the network), PF-3 (negative VSWR), PF-5 (insertion-loss sign), PF-6 (invalid input read as 0); '
             'circulator preset removed; Tweaks panel, postMessage bridge and CRT themes removed.')
# ── END RELEASE ───────────────────────────────────────────────────────

SCRIPTS = ['engine.js', 'ui.js', 'reflections.js', 'devices.js', 'cascade.js', 'main.js']
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
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'RF_Cascade_Analyzer_v%s.html' % VERSION)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(build())
    print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
