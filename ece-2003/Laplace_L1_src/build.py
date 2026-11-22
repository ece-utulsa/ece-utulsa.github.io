#!/usr/bin/env python3
"""Build ece-2003/Laplace_L1_What_the_Transform_Does_v1.0.0.html.
Inputs: kit.js (shared engine, taken from Factoring_the_Denominator_v1.1.0.html), scene.js, the clips and pack.json,
and the model page for the style block (fonts) and the two React scripts (copied byte for byte)."""
import base64, hashlib, json, re, sys

MODEL, CLIPS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
VERSION, TITLE = 'v1.0.0', 'Lecture 1 · What the Laplace Transform Does'

model = open(MODEL, encoding='utf-8').read()
style = re.search(r'<style>(.*?)</style>', model, re.S).group(1)
scripts = re.findall(r'<script>(.*?)</script>', model, re.S)
react, react_dom = scripts[0], scripts[1]
assert 'react.production.min.js' in react[:200] and 'react-dom.production.min.js' in react_dom[:200]

pack = json.load(open(CLIPS + '/pack.json', encoding='utf-8'))['clips']
clip_data = {c['name']: 'data:audio/mpeg;base64,' + base64.b64encode(open(CLIPS + '/' + c['name'], 'rb').read()).decode() for c in pack}
durs = [c['dur'] for c in pack]

kit = open('kit.js', encoding='utf-8').read()
scene = open('scene.js', encoding='utf-8').read()
assert scene.count('/*DURS*/[]') == 1
scene = scene.replace('/*DURS*/[]', json.dumps(durs))
spoken = [c['spoken'].replace("'", '’') for c in pack]
for s in spoken:
    assert s in scene, 'scene text[] differs from the rendered script: ' + s

app = ("/* " + TITLE + " " + VERSION + " — application script (plain JavaScript, React.createElement; no in-browser compiler) */\n"
       "(function () {\n'use strict';\n"
       "/* ═══ KIT — shared engine of the ECE 2003 Laplace pages (the parts this page uses) ═══════════\n"
       "   TOC\n"
       "     1  CONSTANTS            layout, timing, version\n"
       "     2  PALETTE              text colours (>= 4.5:1 on white), fonts\n"
       "     3  TIMELINE + STAGE     playhead, fit-to-window scaling, keyboard\n"
       "     4  CLIPS + NARRATOR     embedded MP3 -> blob URLs, schedule, playback\n"
       "     5  SMALL PARTS          Reveal, SrSummary, panel helpers\n"
       "     7  CHROME               OpeningCard, ReplayPill, SoundToggle, Header, TitleCard, FinishStrip,\n"
       "                             Captions, ProgressBar, Stamp, Landing\n"
       "     8  YOUR TURN + FOCUS PARTS   useYourTurn, KValue, KNav\n"
       "   Units: stage coordinates are px on a 1280 x 720 stage (scaled to the window);\n"
       "   all times are seconds on the narration timeline. */\n"
       + kit + scene + "\n})();\n")

def h(s):
    return "'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode() + "'"

csp = ("default-src 'none'; script-src %s %s %s; style-src %s; font-src data:; media-src blob:; base-uri 'none'; form-action 'none'"
       % (h(react), h(react_dom), h(app), h(style)))
head = """<!DOCTYPE html>
<!--
  Lecture 1 · What the Laplace Transform Does (ECE 2003, Laplace & the s-Domain)
  Version: %(v)s
  Released: 2026-11-22
  Author: Claude Code. Owner: Douglas Jussaume, University of Tulsa ECE.
  DEMO RELEASE 2026-11-22 (principal-directed; gates pending)
  Changelog: %(v)s — new page (Laplace Lectures L1–L3 spec v1.0.0, section L1; Animation Build Kit v2.0, focus rules
  R1–R7): opening card; why the transform (the RC equation becomes algebra); the definition and the 0⁻ lower limit;
  u(t), e^(−at) and δ(t) transformed straight from the definition, one line of math at a time, each result landing
  in its pair slot; key point; Your turn (cos ωt) with Show solution; link to Lecture 2. Replaces
  "Laplace as an Algebra Tool Fall2026.html".
  Third-party: React 18.3.1 and ReactDOM 18.3.1 (MIT, production builds, inlined); IBM Plex Sans and IBM Plex Mono
  (SIL OFL 1.1, subsets inlined). Narration: pre-rendered en-GB clips, embedded.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="%(csp)s">
<meta name="version" content="%(v)s">
<title>%(t)s %(v)s</title>
<style>%(style)s</style>
</head>
<body>
<div id="root"></div>
<noscript>This page needs JavaScript to play.</noscript>
<script type="application/json" id="clip-data">%(clips)s</script>
<script>%(react)s</script>
<script>%(rd)s</script>
<script>%(app)s</script>
</body>
</html>
""" % dict(v=VERSION, t=TITLE, csp=csp, style=style, clips=json.dumps(clip_data, separators=(',', ':')), react=react, rd=react_dom, app=app)
open(OUT, 'w', encoding='utf-8', newline='\n').write(head)
open('app.js', 'w', encoding='utf-8').write(app)
size = len(head.encode('utf-8'))
print('wrote', OUT, size, 'B', 'sha256', hashlib.sha256(head.encode('utf-8')).hexdigest())
print('clips b64', sum(len(v) for v in clip_data.values()), 'app', len(app.encode()), 'style', len(style.encode()), 'react', len(react) + len(react_dom))
print('CSP', csp)
