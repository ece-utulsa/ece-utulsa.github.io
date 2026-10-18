#!/usr/bin/env python3
"""Build the single-file RF Cascade Analyzer from the sources in this folder.

The delivered page is ONE plain HTML file (no bundle, no loader): template.html with
  @@FONTFACES@@  the embedded IBM Plex Mono faces (base64 woff2 in @font-face)
  @@SCRIPT@@     the application scripts, concatenated inside one strict-mode function
                 (no globals: there is no window-level object for tests, spec D10.4)
  @@VERSION@@ @@RELEASED@@ @@CHANGELOG@@  the release fields below.

Sources:
  template.html                        markup, CSS and the version stamp
  engine.js ui.js lecture.js lab.js main.js   application scripts, in this order
  fonts/*.woff2                        IBM Plex Mono (SIL OFL 1.1), latin subset, 400 and 600

Usage:  python3 build.py            writes ../RF_Cascade_Analyzer_v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import base64
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '1.1.0'
RELEASED = '2026-10-18'
CHANGELOG = ('Visual-first rebuild: Lecture mode Steps 1-6 with beats, presentation mode with clicker keys, '
             'Lab mode re-laid out; fixes PF-1 (open load read as a short), PF-2 (Deg/Rad switch changed the '
             'network), PF-3 (negative VSWR), PF-5 (insertion-loss sign), PF-6 (invalid input read as 0, Z0 '
             'range); circulator preset removed; Tweaks panel, postMessage bridge and CRT themes removed')
# ── END RELEASE ───────────────────────────────────────────────────────

SCRIPTS = ['engine.js', 'ui.js', 'lecture.js', 'lab.js', 'main.js']
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
