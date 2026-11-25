#!/usr/bin/env python3
"""ECE 3033 Lectures 4 and 5, v1.2.0 -> v1.2.1: remove the cue glow (briefing 2026-11-22 cue-glow v1.2.1).

Replaces the `svg .cue{filter:drop-shadow(...)}` highlight with the crisp highlight of Paralleling Lab v1.4.0 B1:
SVG lines x1.6 stroke width and darkened, SVG shapes a 2.5 px #0f6e6c ring, SVG text teal; no CSS filter anywhere.
Bumps every version stamp, recomputes the CSP hashes and points the ECE 3033 index cards at the new files.
Run from the repo root on a tree where the v1.2.0 files are present: python3 scripts/edits/2026-11-25_ece3033_cue-glow_v1.2.1.py
"""
import base64, hashlib, pathlib, re, sys

ROOT = pathlib.Path('.')
DATE = '2026-11-25'

CUE_CSS_NOTE = ('/* A cued element is drawn crisp (Paralleling Lab v1.4.0 B1): no filter, blur, glow or shadow anywhere.\n'
                '   SVG lines: stroke width x 1.6 and darkened (cueLine, script section "WATCH CUES"). SVG shapes: a 2.5 px teal ring.\n'
                '   SVG text: teal. Panels: the ring below. */\n'
                'svg text.cue{fill:#0f6e6c}\n'
                'svg circle.cue,svg rect.cue{stroke:#0f6e6c;stroke-width:2.5px;vector-effect:non-scaling-stroke}\n')

CONSTS = ("const CUE_LINE_SCALE = 1.6;               // a cued SVG line is drawn at this many times its own stroke width (B1)\n"
          "const CUE_DARK = 0.6;                     // a cued line's colour: each RGB channel of its own colour x this (darker)\n")

FUNCS = ("/* Draw one cued SVG line crisp (on) or restore it (off): stroke width x CUE_LINE_SCALE and its own colour darkened;\n"
         "   a filled arrow head (fill = stroke) darkens with it. Shapes and text are styled by the .cue rules in the style sheet. */\n"
         "function cueLine(e, on) {\n"
         "  if (!(e instanceof SVGPathElement || e instanceof SVGLineElement || e instanceof SVGPolylineElement)) return;\n"
         "  ['stroke-width', 'stroke', 'fill'].forEach(p => e.style.removeProperty(p));\n"
         "  if (!on) return;\n"
         "  const cs = getComputedStyle(e), w = parseFloat(cs.strokeWidth);\n"
         "  if (cs.stroke === 'none' || !(w > 0)) return;\n"
         "  const filled = cs.fill === cs.stroke;\n"
         "  e.style.setProperty('stroke-width', (w * CUE_LINE_SCALE) + 'px'); e.style.setProperty('stroke', darker(cs.stroke));\n"
         "  if (filled) e.style.setProperty('fill', darker(cs.fill));\n"
         "}\n"
         "/* The computed colour c (\"rgb(r, g, b)\") with every channel scaled by CUE_DARK. */\n"
         "function darker(c) {\n"
         "  const m = c.match(/\\d+(\\.\\d+)?/g); if (!m || m.length < 3) return c;\n"
         "  return 'rgb(' + m.slice(0, 3).map(v => Math.round(Number(v) * CUE_DARK)).join(', ') + ')';\n"
         "}\n")

OLD_APPLY = "cueOn.forEach(e => { if (!els.includes(e)) e.classList.remove('cue'); }); els.forEach(e => e.classList.add('cue')); cueOn = els;"
NEW_APPLY = ("cueOn.forEach(e => { if (!els.includes(e)) { e.classList.remove('cue'); cueLine(e, false); } });\n"
             "  els.forEach(e => { e.classList.add('cue'); cueLine(e, true); }); cueOn = els;")

CHANGELOG = ('  Changelog: v1.2.1 — cue glow removed (briefing {d} cue-glow v1.2.1; Paralleling Lab v1.4.0 B1): a Watch cue no\n'
             '  longer blurs its element (the glow rule is gone); cued SVG lines are drawn 1.6x wider and darker, shapes get a 2.5 px teal ring,\n'
             '  text turns teal. No other change.\n'
             '  v1.2.0 —').format(d='2026-11-22')

LECTURES = [
    ('ece-3033/Load_Sharing_Droop_v1.2.0.html', 'ece-3033/Load_Sharing_Droop_v1.2.1.html',
     ['svg .cue{filter:drop-shadow(0 0 3px #0f6e6c) drop-shadow(0 0 1px #0f6e6c)}\n',
      'svg text.cue{filter:none;text-decoration:underline}\n',
      'svg path.cue{stroke-width:5}\n',
      'svg circle.cue{stroke-width:4}\n']),
    ('ece-3033/Two_Generators_PQ_v1.2.0.html', 'ece-3033/Two_Generators_PQ_v1.2.1.html',
     ['svg .cue{filter:drop-shadow(0 0 3px #0f6e6c) drop-shadow(0 0 1px #0f6e6c)}\n',
      'svg text.cue{filter:none;text-decoration:underline}\n']),
]


def once(s, old, new):
    """Replace old by new, requiring exactly one occurrence."""
    n = s.count(old)
    if n != 1:
        sys.exit('expected one occurrence, found %d: %r' % (n, old[:80]))
    return s.replace(old, new)


def b64sha(t):
    """CSP hash source of an inline block's text."""
    return "'sha256-" + base64.b64encode(hashlib.sha256(t.encode('utf-8')).digest()).decode() + "'"


def edit(src, dst, css_old):
    """Apply the v1.2.1 change to one lecture and write it under its new name."""
    s = (ROOT / src).read_text(encoding='utf-8')
    s = once(s, '  Version: v1.2.0\n', '  Version: v1.2.1\n')
    s = once(s, '  Released: 2026-11-22\n', '  Released: not yet (build %s; publishes as a DEMO RELEASE on a publish file)\n' % DATE)
    s = once(s, '  DEMO RELEASE 2026-11-22 (principal ruling; gates pending)\n',
             '  v1.2.0 was a DEMO RELEASE 2026-11-22 (principal ruling; gates pending)\n')
    s = once(s, '  Changelog: v1.2.0 —', CHANGELOG)
    s = once(s, '<meta name="version" content="v1.2.0">', '<meta name="version" content="v1.2.1">')
    s = re.sub(r'(<title>[^<]*) v1\.2\.0</title>', r'\1 v1.2.1</title>', s, count=1)
    s = once(s, '· v1.2.0</span>', '· v1.2.1</span>')
    # style sheet: the four (or two) glow rules -> the crisp rules
    first = css_old[0]
    s = once(s, first, CUE_CSS_NOTE)
    for rule in css_old[1:]:
        s = once(s, rule, '')
    # script: constants, the line styler, the apply step
    s = once(s, "const EPS = 1e-9;\n", "const EPS = 1e-9;\n" + CONSTS)
    s = once(s, '/* Highlight the elements of the present cue', FUNCS + '/* Highlight the elements of the present cue')
    s = once(s, OLD_APPLY, NEW_APPLY)
    if re.search(r'filter\s*:|drop-shadow|blur\(', s):
        sys.exit("a CSS filter is left in " + dst + ": " + repr([s[m.start()-60:m.end()+20] for m in re.finditer(r"filter\s*:|drop-shadow|blur\(", s)]))
    # CSP hashes
    style = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
    script = re.search(r'<script>(.*?)</script>', s, re.S).group(1)
    s = re.sub(r"script-src 'sha256-[^']+'", 'script-src ' + b64sha(script), s, count=1)
    s = re.sub(r"style-src 'sha256-[^']+'", 'style-src ' + b64sha(style), s, count=1)
    (ROOT / dst).write_text(s, encoding='utf-8')
    # v1.2.0 stays on main until the publish step removes it (CLAUDE.md §3 step 2).
    print(dst, 'script-src', b64sha(script), 'style-src', b64sha(style))


def main():
    """Edit both lectures and the index cards."""
    idx = ROOT / 'ece-3033/index.html'
    t = idx.read_text(encoding='utf-8')
    for src, dst, css in LECTURES:
        edit(src, dst, css)
        t = once(t, 'file:"%s"' % pathlib.Path(src).name, 'file:"%s"' % pathlib.Path(dst).name)
    idx.write_text(t, encoding='utf-8')


if __name__ == '__main__':
    main()
