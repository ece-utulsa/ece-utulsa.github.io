#!/usr/bin/env python3
"""Build ece-2003/Laplace_L2_Table_and_Properties_v1.0.0.html: one self-contained file.
Inputs: the kit engine and React from the published Factoring the Denominator v1.1.0 page (model), scene.js,
script_laplace_l2.json, ../clips/*.mp3 + words.json. Deterministic: the same inputs give the same bytes."""
import base64, hashlib, io, json, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset
VERSION, RELEASED = 'v1.0.0', '2026-11-22'
REPO = '/home/user/ece-utulsa.github.io/ece-2003/'
MODEL = REPO + 'Factoring_the_Denominator_v1.1.0.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else REPO + 'Laplace_L2_Table_and_Properties_%s.html' % VERSION
TITLE = 'Lecture 2 · The Table and Its Properties ' + VERSION
LEAD_IN = 0.0  # s: a beat starts this long before its word (0: on the word)
DROP = {'up', 'UNKNOWN_RE', 'Eq', 'Frac', 'Bracket', 'Matrix', 'smallLabel', 'CIRCLED', 'Rail', 'TourDriver', 'Captions', 'YourTurnCard',
        'Landing', 'FS_ON', 'BLUE', 'PURPLE', 'POW2'}
# beat -> (line, index of the word at which it starts, that word)
WORDS = {'intro': (1, 4, 'table'), 'table': (2, 0, 'Here'), 'tge0': (2, 13, 'Every'), 'seven': (3, 0, 'Circuits'),
 'p_delta': (3, 6, 'the'), 'p_u': (3, 8, 'the'), 'p_t': (3, 10, 'the'), 'p_exp': (3, 12, 'the'), 'p_texp': (3, 14, 't'),
 'p_esin': (3, 18, 'the'), 'p_ecos': (3, 21, 'and'), 'props': (4, 0, 'Three'), 'pr_lin': (4, 4, 'linearity'),
 'pr_fs': (4, 5, 'frequency'), 'pr_ts': (4, 8, 'time'), 'ref': (4, 10, 'The'), 'lin0': (5, 0, 'Linearity'), 'lin1': (5, 9, 'Take'),
 'lin2': (5, 20, 'gives'), 'lin3': (5, 27, 'gives'), 'lin4': (5, 32, 'four'), 'fs0': (6, 0, 'The'), 'fs1': (6, 17, 'Sine'),
 'fs1v': (6, 23, 'four'), 'fs2': (6, 29, 'Multiply'), 'fs3': (6, 40, 'becomes'), 'ts0': (7, 0, 'The'), 'wave': (8, 0, 'Here'),
 'w1': (8, 5, 'three'), 'w2': (8, 10, 'minus'), 'w3': (8, 16, 'zero'), 'st0': (9, 0, 'Write'), 'st1': (9, 4, 'three'),
 'st2': (9, 8, 'minus'), 'st3': (9, 15, 'plus'), 'tr0': (9, 22, 'Term'), 'tr1': (9, 25, 'three'), 'tr2': (9, 28, 'minus'),
 'tr3': (9, 37, 'plus'), 'key': (10, 0, 'Seven'), 'yt': (11, 0, 'Your')}
model = open(MODEL, encoding='utf8').read()
scripts = re.findall(r'<script>(.*?)</script>', model, re.S)
assert len(scripts) == 3
react, reactdom, app = scripts
assert 'react.production.min.js' in react[:200] and 'react-dom.production.min.js' in reactdom[:200]
# --- kit: top-level chunks of the model's application script, up to the FOCUS KIT section ---
kit = app[app.index('/* ═══ KIT'):app.index('/* ═══ FOCUS KIT')]
chunks, cur = [], []
for ln in kit.split('\n'):
    top = ln[:1] not in (' ', '\t', '}', ']', ')', '')
    isc = ln.startswith('//')
    if top and cur and (ln.startswith('/*') or ((isc or ln.startswith(('function ', 'const '))) and not cur[-1].startswith('//'))):
        chunks.append(cur); cur = []
    cur.append(ln)
chunks.append(cur)
def name(ch):
    for ln in ch:
        m = re.match(r'(?:function|const)\s+(\{[^}]*\}|\w+)', ln)
        if m: return m.group(1)
    return ''
kept = ['\n'.join(c) for c in chunks if name(c) not in DROP]
kit = '\n'.join(kept)
kit = kit.replace("const VERSION = 'v1.1.0';", "const VERSION = '%s';" % VERSION)
kit = kit.replace('''const MONO = "'IBM Plex Mono', ui-monospace, monospace";''', '''const MONO = "'IBM Plex Mono', 'IBM Plex Sans', ui-monospace, 'DejaVu Sans Mono', monospace";''')
kit = kit.replace('''const HEAD = "'IBM Plex Sans', system-ui, sans-serif";''', '''const HEAD = "'IBM Plex Sans', system-ui, 'Segoe UI', 'Noto Sans', 'DejaVu Sans', sans-serif";''')
kit = kit.replace("const POW2 = 'oklch(0.50 0.13 350)', POW1 = 'oklch(0.50 0.11 110)', POW0 = 'oklch(0.50 0.11 225)';\n", '')
kit = kit.replace('/* ═══ KIT — shared engine for the Inverse Laplace PFE pages', '/* ═══ KIT — shared engine of the ECE 2003 Laplace pages (from Factoring the Denominator v1.1.0)')
kit = re.sub(r"     5  SMALL PARTS .*\n", "     5  SMALL PARTS          Reveal, SrSummary, panel helpers\n", kit)
kit = re.sub(r"     7  CHROME .*\n.*\n", "     7  CHROME               OpeningCard, ReplayPill, SoundToggle, Header, TitleCard, FinishStrip,\n                             ProgressBar, Stamp\n", kit)
kit = kit.replace('     8  YOUR TURN            problem card with Show solution', '     8  YOUR TURN            when the Your-turn card opens and closes')
kit += "\n// monospace text style\nconst kMono = (size, color, weight) => ({ fontFamily: MONO, fontSize: size, color, fontWeight: weight || 400 });\n"
# --- scene ---
script = json.load(open('script_laplace_l2.json'))
words = json.load(open('../clips/words.json'))
scene = open('scene.js', encoding='utf8').read()
durs = [round(words[str(i)]['dur'], 3) for i in range(1, len(script) + 1)]
frm = {}
for b, (line, wi, w) in WORDS.items():
    wl = words[str(line)]['words']
    assert wl[wi][0] == w, (b, wl[wi])
    frm[b] = 0 if wi == 0 else round(max(0, wl[wi][1] - LEAD_IN) / words[str(line)]['dur'], 3)
scene = scene.replace('/*@DURS@*/', ', '.join(str(d) for d in durs))
scene = scene.replace('/*@TEXT@*/', '\n        ' + ',\n        '.join(json.dumps(l['spoken'], ensure_ascii=False) for l in script) + ',\n    ')
scene = scene.replace('/*@FROM@*/', ' ' + ', '.join('%s: %s' % (k, v) for k, v in frm.items()) + ' ')
assert '/*@' not in scene
appjs = ("/* %s — application script (plain JavaScript; no in-browser compiler) */\n(function () {\n'use strict';\n" % TITLE) + kit + scene + "\n})();\n"
# --- fonts: the model's four woff2 faces, cut down to the characters this page uses ---
faces = re.findall(r"(@font-face\{font-family:'[^']+';font-style:normal;font-weight:[^;]+;font-display:swap;src:url\(data:font/woff2;base64,)([A-Za-z0-9+/=]+)(\) format\('woff2'\);unicode-range:[^}]+\})", model)
assert len(faces) == 4
used = set(range(0x20, 0x7f)) | {ord(c) for c in appjs if ord(c) > 0x7e} | {ord(c) for c in TITLE}
css = ''
for pre, b64, post in faces:
    f = TTFont(io.BytesIO(base64.b64decode(b64)), recalcTimestamp=False)
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['kern', 'liga', 'mark', 'mkmk', 'ccmp', 'locl']; opt.name_IDs = [1, 2]; opt.notdef_outline = True
    sub = subset.Subsetter(opt); sub.populate(unicodes=sorted(u for u in used if u in f.getBestCmap())); sub.subset(f)
    buf = io.BytesIO(); f.save(buf)
    css += pre + base64.b64encode(buf.getvalue()).decode() + post + '\n'
rest = model[model.index('html,body{margin:0'):model.index('</style>')]
rest = '\n'.join(l for l in rest.split('\n') if not l.startswith('.up'))
css += rest
clips = {}
for i in range(1, len(script) + 1):
    n = 'laplace_l2_line%d.mp3' % i
    clips[n] = 'data:audio/mpeg;base64,' + base64.b64encode(open('../clips/' + n, 'rb').read()).decode()
clipjson = json.dumps(clips, separators=(',', ':'))
h = lambda s: "'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf8')).digest()).decode() + "'"
csp = "default-src 'none'; script-src %s %s %s; style-src %s; font-src data:; media-src blob:; base-uri 'none'; form-action 'none'" % (h(react), h(reactdom), h(appjs), h(css))
html = '''<!DOCTYPE html>
<!--
  Laplace Lecture 2 · The Table and Its Properties (ECE 2003)
  Version: %(v)s
  Released: %(d)s
  Author: Claude Code. Owner: Douglas Jussaume, University of Tulsa ECE.
  DEMO RELEASE %(d)s (principal-directed; gates pending)
  Changelog: %(v)s — first version, built to Laplace Lectures L1–L3 spec v1.0.0 (Common and L2 sections) and
  Animation Build Kit v2.0 (focus rules R1–R7): opening card; key-point line; Alexander & Sadiku Tables 15.2 and
  15.1 retyped as live text, the seven circuit pairs and three properties highlighted; linearity, frequency shift
  and time shift worked one line at a time, each result landing in its slot; a switched source drawn step by step;
  Your turn with Show solution; links to Lectures 1, 3 and 4.
  Third-party: React 18.3.1 and ReactDOM 18.3.1 (MIT, production builds, inlined); IBM Plex Sans and IBM Plex Mono
  (SIL OFL 1.1, subsets inlined). Narration: pre-rendered en-GB clips, embedded.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="%(csp)s">
<meta name="version" content="%(v)s">
<title>%(t)s</title>
<style>%(css)s</style>
</head>
<body>
<div id="root"></div>
<noscript>This page needs JavaScript to play.</noscript>
<script type="application/json" id="clip-data">%(clips)s</script>
<script>%(react)s</script>
<script>%(reactdom)s</script>
<script>%(app)s</script>
</body>
</html>
''' % dict(v=VERSION, d=RELEASED, csp=csp, t=TITLE, css=css, clips=clipjson, react=react, reactdom=reactdom, app=appjs)
open(OUT, 'w', encoding='utf8', newline='\n').write(html)
open('app.js', 'w', encoding='utf8').write(appjs)
raw = html.encode('utf8')
print('bytes', len(raw), 'sha256', hashlib.sha256(raw).hexdigest())
print('app', len(appjs.encode()), 'css', len(css), 'clips', len(clipjson))
print('CSP', csp)
