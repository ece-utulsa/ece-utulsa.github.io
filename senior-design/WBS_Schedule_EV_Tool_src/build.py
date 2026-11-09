#!/usr/bin/env python3
"""Build the single-file Senior Design WBS, Schedule and Earned Value Tool from the sources in this folder (see README.md).

The delivered page is ONE plain HTML file: template.html with
  @@SCRIPT@@     the application scripts, concatenated inside one strict-mode function (no globals)
  @@VERSION@@ @@RELEASED@@ @@CHANGELOG@@  the release fields below.

Usage:  python3 build.py            writes ../WBS_Schedule_EV_Tool_v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '1.0.1'
RELEASED = '2026-11-09'
CHANGELOG = ('\n    v1.0.1 - editor panel wraps long predecessor warnings; full stop after the planned length; Help links to the how-to guide. '
             '\n    v1.0.0 - first release from the briefing of Nov 9, 2026 (tasks-only earned value). WBS tree and org-chart '
             'diagram with the Show to level control, the Senior Design template to level 3, side-panel editor, rule checks; '
             'week-based Gantt with baseline and actual bars, predecessors, milestones, lead-time items, re-baselining with '
             'history; task status bar chart (per week / cumulative, area and owner filters); This week routine; earned value '
             'chart, SPI trend, start/finish quadrant, measures table and late-task list; printable status report; autosave, '
             'project file Save/Open with schema version, CSV exports; help with the lecture equations.')
# ── END RELEASE ───────────────────────────────────────────────────────

SCRIPTS = ['model.js', 'ev.js', 'ui.js', 'wbs.js', 'gantt.js', 'status.js', 'evtab.js', 'main.js']
HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    """Read a source file relative to this folder."""
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def script():
    """The application scripts in order, wrapped in one strict-mode function scope."""
    body = '\n'.join(read(s).rstrip() + '\n' for s in SCRIPTS)
    if '</script' in body.lower():
        raise SystemExit('a script source contains "</script"')
    return "(function(){\n'use strict';\n" + body + '})();'


def build():
    """Fill the template and return the page."""
    page = read('template.html')
    for key, val in (('@@SCRIPT@@', script()), ('@@VERSION@@', 'v' + VERSION), ('@@RELEASED@@', RELEASED),
                     ('@@CHANGELOG@@', CHANGELOG)):
        page = page.replace(key, val)
    if '@@' in page:
        raise SystemExit('unfilled placeholder in the template')
    return page


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'WBS_Schedule_EV_Tool_v%s.html' % VERSION)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build())
    print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
