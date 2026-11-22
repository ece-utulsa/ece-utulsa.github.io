# Patch the published Lectures 1-3 (built by other sessions; no sources in the repo) to v1.0.1 for the lecture
# series: version stamps, previous / next links, new file names; then recompute the CSP hash of the application
# script. Clips, React, fonts and styles are untouched. Usage: python3 patch_l123.py <repo ece-2003 dir> <out dir>
import sys, re, hashlib, base64, os
SRC, OUT = sys.argv[1], sys.argv[2]
L1, L2, L3 = 'Laplace_L1_What_the_Transform_Does', 'Laplace_L2_Table_and_Properties', 'Laplace_L3_Circuit_Element_Models'
NOTE = ('  Changelog: v1.0.1 — Laplace lecture series (rename briefing 2026-11-22): previous / next lecture links on the end\n'
        '  card; cross-links updated to the new file names. Narration, clips, math and layout unchanged.\n')
def sha(t): return "'sha256-" + base64.b64encode(hashlib.sha256(t.encode('utf8')).digest()).decode() + "'"
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a, s.count(a)); return s.replace(a, b)
def run(base, edits):
    s = open(os.path.join(SRC, base + '_v1.0.0.html'), encoding='utf8').read()
    i = s.rfind('<script>') + len('<script>'); j = s.index('</script>', i); head, app, tail = s[:i], s[i:j], s[j:]
    old = sha(app); assert head.count(old) == 1, 'app hash not in CSP'
    app = rep(app, "const VERSION = 'v1.0.0';", "const VERSION = 'v1.0.1';")
    k = app.index('v1.0.0'); assert k < 120; app = app[:k] + 'v1.0.1' + app[k + 6:]          # the script's header comment
    for a, b in edits: app = rep(app, a, b)
    head = rep(head, '  Version: v1.0.0\n', '  Version: v1.0.1\n')
    head = rep(head, '<meta name="version" content="v1.0.0">', '<meta name="version" content="v1.0.1">')
    head = re.sub(r'(<title>[^<]*) v1\.0\.0</title>', r'\1 v1.0.1</title>', head, count=1); assert ' v1.0.1</title>' in head
    head = rep(head, '  Changelog: v1.0.0 —', NOTE + '  Changelog: v1.0.0 —')
    head = rep(head, old, sha(app))
    out = head + app + tail
    assert 'v1.0.0.html' not in app and 'v1.1.0.html' not in app
    open(os.path.join(OUT, base + '_v1.0.1.html'), 'w', encoding='utf8').write(out)
    print(base + '_v1.0.1.html', len(out.encode('utf8')), hashlib.sha256(out.encode('utf8')).hexdigest(), sha(app))
os.makedirs(OUT, exist_ok=True)
run(L1, [(L2 + '_v1.0.0.html', L2 + '_v1.0.1.html')])
run(L2, [(L1 + '_v1.0.0.html', L1 + '_v1.0.1.html'), (L3 + '_v1.0.0.html', L3 + '_v1.0.1.html'),
         ("\n            { text: 'Lecture 4 · Factoring the Denominator →', href: 'Factoring_the_Denominator_v1.1.0.html' },", '')])
run(L3, [("nextHref: 'Factoring_the_Denominator_v1.1.0.html',", "nextHref: 'Factoring_the_Denominator_v1.1.1.html',\n        prevText: '← Lecture 2 · The Table and Its Properties',\n        prevHref: '" + L2 + "_v1.0.1.html',"),
         ("            h('a', { key: 'a', 'data-endlink': '1', href: ui.nextHref,", "            h('a', { key: 'p', 'data-endlink': '1', href: ui.prevHref, style: { fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, ui.prevText),\n            h('a', { key: 'a', 'data-endlink': '1', href: ui.nextHref,"),
         ("flexDirection: 'column', gap: 10 } }, bi >= IX.k3", "flexDirection: 'column', gap: 4 } }, bi >= IX.k3")])
