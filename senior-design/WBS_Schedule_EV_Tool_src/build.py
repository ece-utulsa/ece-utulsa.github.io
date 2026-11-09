#!/usr/bin/env python3
"""Build the single-file Senior Design WBS, Schedule and Earned Value Tool from the sources in this folder (see README.md).

The delivered page is ONE plain HTML file: template.html with
  @@SCRIPT@@     the application scripts, concatenated inside one strict-mode function (no globals)
  @@VERSION@@ @@RELEASED@@ @@CHANGELOG@@  the release fields below.

Usage:  python3 build.py            writes ../WBS_Schedule_EV_Tool_v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import os
import re
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = '1.0.3'
RELEASED = '2026-11-09'
CHANGELOG = ('\n    v1.0.3 - change briefing of Nov 9 (ease of use and visuals; no calculation changed): BAC labelled Tasks in the WBS; '
             'Open the lecture example (week-6 team, 40 tasks) with an Example badge and title; chart text for a projector (13 px, '
             'key labels 15 px bold, no overlaps); Plan span / One semester / Whole project zoom on Task status, Earned value and SPI; '
             'Task status table to the current week plus 4 with Show all weeks; This week headline cards with readings in words and '
             'formula tooltips; quadrant labelled with the lecture words; accepted exceptions to the 2-week rule; screenshot script. '
             '\n    v1.0.2 - the how-to guide is built into the Help panel (works offline), from the same source as the guide web page. '
             '\n    v1.0.1 - editor panel wraps long predecessor warnings; full stop after the planned length; Help links to the how-to guide. '
             '\n    v1.0.0 - first release from the briefing of Nov 9, 2026 (tasks-only earned value). WBS tree and org-chart '
             'diagram with the Show to level control, the Senior Design template to level 3, side-panel editor, rule checks; '
             'week-based Gantt with baseline and actual bars, predecessors, milestones, lead-time items, re-baselining with '
             'history; task status bar chart (per week / cumulative, area and owner filters); This week routine; earned value '
             'chart, SPI trend, start/finish quadrant, measures table and late-task list; printable status report; autosave, '
             'project file Save/Open with schema version, CSV exports; help with the lecture equations.')
# ── END RELEASE ───────────────────────────────────────────────────────

SCRIPTS = ['model.js', 'ev.js', 'example.js', 'ui.js', 'wbs.js', 'gantt.js', 'status.js', 'evtab.js', 'main.js']
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


def guide(in_tool):
    """The how-to guide (guide.html). In the tool: no figures (screenshots stay on the web page) and ids prefixed g-
    so they cannot clash with the tool's own ids."""
    g = re.sub(r'<!--.*?-->\n?', '', read('guide.html'), flags=re.S)
    if in_tool:
        g = re.sub(r'\s*<figure>.*?</figure>', '', g, flags=re.S)
        g = re.sub(r'id="([a-z][a-z0-9-]*)"', r'id="g-\1"', g)
        g = re.sub(r'href="#([a-z][a-z0-9-]*)"', r'href="#g-\1"', g)
        if '<img' in g or '<script' in g.lower():
            raise SystemExit('guide.html: unexpected <img> or <script> left for the tool')
    return g


def tool_file():
    return 'WBS_Schedule_EV_Tool_v%s.html' % VERSION


def guide_page():
    """The guide web page (guide_page.html + guide.html, figures kept)."""
    page = read('guide_page.html')
    for key, val in (('@@GUIDE@@', guide(False)), ('@@TOOLFILE@@', tool_file()), ('@@VERSION@@', 'v' + VERSION)):
        page = page.replace(key, val)
    if '@@' in page:
        raise SystemExit('unfilled placeholder in the guide page')
    return page


def build():
    """Fill the template and return the page."""
    page = read('template.html')
    for key, val in (('@@GUIDE@@', guide(True)), ('@@SCRIPT@@', script()), ('@@VERSION@@', 'v' + VERSION), ('@@RELEASED@@', RELEASED),
                     ('@@CHANGELOG@@', CHANGELOG)):
        page = page.replace(key, val)
    if '@@' in page:
        raise SystemExit('unfilled placeholder in the template')
    return page


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', tool_file())
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build())
    print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
    if len(sys.argv) == 1:
        gout = os.path.join(HERE, '..', 'WBS_Schedule_EV_Tool_Guide.html')
        with open(gout, 'w', encoding='utf-8', newline='\n') as f:
            f.write(guide_page())
        print('wrote', os.path.normpath(gout), os.path.getsize(gout), 'bytes')
