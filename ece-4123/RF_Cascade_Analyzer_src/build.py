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
        python3 build.py --check    rebuilds in memory and compares with the committed page (SHA-256); exit 1 if they differ
The page is written as bytes with LF line ends on every platform, so the rebuild is byte for byte (CQ-RFC-018).
"""
import base64
import hashlib
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '1.8.1'
RELEASED = '2026-11-20'
CHANGELOG = ('\n    v1.8.1 - Fix pass on the first gates (PPR, Test, Code Quality, Cybersecurity, Visual). A power or gain at or below '
             'zero is never given a dB value: it is written in words with its direction, and an active circuit is named once. '
             'Cascade: the input account closes (mismatch loss P_avs - P_in; the reflected wave named as the Z0-referenced '
             '1/2|b1|^2); every percentage names its basis; the marker box follows the current band and a plot click lands '
             'on a swept frequency; every refused entry says why, and typed numbers use a strict decimal grammar '
             '("0x10", "1e309", "Infinity" refused); entries are bounded in length; traces beyond a plot axis are drawn '
             'dotted on its edge; the band sweep is cached while only the marker moves; phase shifter, amplifier, '
             'Wilkinson and Devices wording corrected (outgoing waves labelled b1, b2; a wave carries 1/2|a|^2). Drawings '
             'are built as DOM nodes, not markup; one redraw per interaction; Reflections recomputes only the wave heights '
             'per frame; named constants; dead engine helpers removed; drawn text at least 11 px, focus rings on every drawn '
             'button, remove buttons at least 24 px, the device bar wraps at narrow widths. Legacy unversioned copy removed.'
             '\n    v1.8.0 - Cascade: the plot under the circuit is compact (about a third of the height) or off, and the circuit '
             'and its junction spectra grow into the room (up to 2×); "Along the chain" is the default, one line per '
             'frequency across the band plus the marker, so the frequencies are seen separating stage by stage (branch B '
             'dotted after a divider). The spectra and the chain plot show the forward power arriving at each stage (delivered power at '
             'the loads), so a filter\'s effect appears at the filter. Reflections: no purple envelope fill, and a lighter outline, while the incident '
             'and reflected waves are shown.'
             '\n    v1.7.2 - Cascade: the power divider drawn as a splitter (the input line splitting into two output lines with '
             'arrows to ports 2 and 3) with each output\'s level in dB.'
             '\n    v1.7.1 - Cascade: the circuit (blocks, schematic symbols, spacing, junction spectra) scales up with the window '
             'height, up to 1.6×; text keeps its size.'
             '\n    v1.7.0 - Cascade: v1.1.0\'s Lab brought back (source Vs and Zs, reference Z0, loads with Matched/Short/Open, '
             'device presets with S entries, results with node voltages, currents and powers), its settings and results in the '
             'side panel and the circuit drawn large across the drawing area; a power divider can be inserted at any junction, '
             'splitting the chain into two parallel branches with their own loads; a frequency band (centre ± span or '
             'start–stop) is sent through the circuit, with the spectrum at every junction, the response across the band, '
             'a marker frequency, and frequency-dependent lines and Butterworth low-, high- and band-pass filters; each block '
             'drawn with its standard schematic symbol, and a plot of the power along the chain (after each stage, the stages\' '
             'symbols on its axis) as an alternative to the response across the band. '
             'Reflections: incident and reflected waves drawn heavier, the envelope shade faint while they are shown. '
             'Devices: a zero-valued S path keeps the same solid style (no dashes, not faded), at the minimum width, valued "0".'
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
    """Read a source file relative to this folder (text as UTF-8 with its line ends kept, or bytes)."""
    kw = {} if 'b' in mode else {'encoding': 'utf-8', 'newline': ''}
    with open(os.path.join(HERE, name), mode, **kw) as f:
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
    """Fill the template and return the page as UTF-8 bytes with LF line ends."""
    if '-->' in CHANGELOG:
        raise SystemExit('the changelog contains "-->", which would end the header comment')
    page = read('template.html')
    for key, val in (('@@FONTFACES@@', fontfaces()), ('@@SCRIPT@@', script()), ('@@VERSION@@', 'v' + VERSION),
                     ('@@RELEASED@@', RELEASED), ('@@CHANGELOG@@', CHANGELOG)):
        page = page.replace(key, val)
    if '@@' in page:
        raise SystemExit('unfilled placeholder in the template')
    return page.replace('\r\n', '\n').encode('utf-8')


def default_out():
    """The committed page for this version."""
    return os.path.join(HERE, '..', 'RF_Cascade_Analyzer_v%s.html' % VERSION)


if __name__ == '__main__':
    if sys.argv[1:] == ['--check']:
        want = hashlib.sha256(build()).hexdigest()
        with open(default_out(), 'rb') as f:
            have = hashlib.sha256(f.read()).hexdigest()
        print('rebuild', want, '\ncommitted', have)
        sys.exit(0 if want == have else 1)
    out = sys.argv[1] if len(sys.argv) > 1 else default_out()
    with open(out, 'wb') as f:
        f.write(build())
    print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
