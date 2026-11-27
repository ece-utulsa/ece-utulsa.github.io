#!/usr/bin/env python3
"""Exact-replacement edit for Laplace Lecture 1 v1.0.1 -> v1.0.2 (QUICK FIX, AT-024).

Purpose: reproduce PR "Laplace L1 v1.0.2 — AT-024 QUICK FIX".
Briefings: Queue/2026-11-25_ClaudeCode_briefing_Laplace-L1_v1.0.2.md (STANDING GO 2026-11-15) and the L1
addendum of Queue/2026-11-26_ClaudeCode_briefing_Laplace-L2-L3_v1.0.2.md (Start card first tab stop).
Items: PPR-AT-024-1..5 (on-screen text), AT-024-1 (rail contrast), AT-024-2 and -3 (stepping), L1 addendum
(tab order), series label. Narration, the 16 clips and the timeline are not touched.
Usage (from the repo root): python3 -I scripts/edits/2026-11-26_laplace_l1_v1.0.2.py
The input is checked against its pre-edit SHA-256; every replacement is asserted to match the stated number of
times; the CSP script and style hashes are recomputed; the v1.0.2 file is written beside v1.0.1 (v1.0.1 is
removed at publish only). Re-running stops at the hash check if v1.0.1 has changed.
"""
import base64, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'ece-2003', 'Laplace_L1_What_the_Transform_Does_v1.0.1.html')
DST = os.path.join(ROOT, 'ece-2003', 'Laplace_L1_What_the_Transform_Does_v1.0.2.html')
PRE_SHA = '74206e26afd28ef7dcb99062c4504d9994316204e61dfdd8961ff2310c2dfe42'  # v1.0.1, PR #143 (live)


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:80], n)
    return s.replace(old, new)


def csp_hash(body):
    """CSP sha256 source for an inline element body."""
    return "'sha256-" + base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode() + "'"


raw = open(SRC, 'rb').read()
assert hashlib.sha256(raw).hexdigest() == PRE_SHA, 'v1.0.1 is not the build the briefing names'
s = raw.decode('utf-8')

# ═══ version stamp (header comment, meta, title, VERSION constant) ═══
s = rep(s, '  Version: v1.0.1\n  Released: 2026-11-22\n', '  Version: v1.0.2\n  Released: 2026-11-26\n')
s = rep(s, '  Changelog: v1.0.1 —',
        '  Changelog: v1.0.2 — QUICK FIX AT-024 (briefings 2026-11-25 L1 v1.0.2 and 2026-11-26 L2-L3 addendum):\n'
        '  on screen, the pairs hold for t ≥ 0⁻ (PPR-AT-024-1); the 0⁻ line names v(0⁻), set by the stored energy\n'
        '  (-2); the RC symbols are scoped (-3); a is real in Re s > −a, Re s > 0 in the Your-turn (-4); the sifting\n'
        '  property is shown where it is used (-5); upcoming rail labels ≥ 4.5:1 (AT-024-1); stepping with ◀ ▶ moves\n'
        '  the playhead to the step, so the header shows, no title fragment remains and the readout follows\n'
        '  (AT-024-2, -3); the counter reads "step n of 31"; the Start card is the first tab stop and the controls\n'
        '  behind it are out of the tab order; the NEXT link goes to Lecture 2 v1.0.2. Narration, clips, timeline and\n'
        '  layout unchanged.\n'
        '  Changelog: v1.0.1 —')
s = rep(s, '<meta name="version" content="v1.0.1">', '<meta name="version" content="v1.0.2">')
s = rep(s, '<title>Lecture 1 · What the Laplace Transform Does v1.0.1</title>',
        '<title>Lecture 1 · What the Laplace Transform Does v1.0.2</title>')
s = rep(s, '/* Lecture 1 · What the Laplace Transform Does v1.0.1 — application script',
        '/* Lecture 1 · What the Laplace Transform Does v1.0.2 — application script')
s = rep(s, "const VERSION = 'v1.0.1';", "const VERSION = 'v1.0.2';")

# ═══ AT-024-1: upcoming rail labels >= 4.5:1 on the white card ═══
s = rep(s, "const UPCOMING = '#858A94'; // rows not yet reached (>= 3:1)",
        "const UPCOMING = '#6B707A'; // rows not yet reached: 4.97:1 on CARD, 4.75:1 on BG (AT-024-1, >= 4.5:1)")

# ═══ L1 addendum: the Start card is the first tab stop; everything behind it is inert while it shows ═══
s = rep(s, "const NEXT = { href:",
        "const CARD_EPS = START_EPS; // s: the opening card shows while paused within this of the start\n"
        "const STEP_SETTLE = 0.4; // s: a step by hand puts the playhead this far into the beat (caption faded in)\n"
        "const NEXT = { href:")

# ═══ beat notes: one extra line under the focus line (PPR-AT-024-2, -3, -4, -5) ═══
s = rep(s,
        "  { id: 'ode', line: 2, from: 0, sec: 0, f: 'RC @c{t}{@frac{dv}{dt}} + v = v_{s}', cap:",
        "  { id: 'ode', line: 2, from: 0, sec: 0, f: 'RC @c{t}{@frac{dv}{dt}} + v = v_{s}', note: SCOPE_T, cap:")
s = rep(s,
        "  { id: 'xform', line: 3, from: 0, sec: 0, f: 'RC@c{s}{[sV − v(0^{−})]} + V = V_{s}', cap:",
        "  { id: 'xform', line: 3, from: 0, sec: 0, f: 'RC@c{s}{[sV − v(0^{−})]} + V = V_{s}', note: SCOPE_S, cap:")
s = rep(s,
        "  { id: 'alg', line: 4, from: 0, sec: 0, f: 'V = @frac{V_{s} + RC v(0^{−})}{RCs + 1}', cap:",
        "  { id: 'alg', line: 4, from: 0, sec: 0, f: 'V = @frac{V_{s} + RC v(0^{−})}{RCs + 1}', note: SCOPE_S, cap:")
s = rep(s,
        "tag: 'the initial condition', cap:",
        "tag: 'the initial condition', note: SCOPE_S, cap:")
s = rep(s,
        "f: '@h{0^{−} captures an impulse at }t = 0@h{, and the energy already stored}', cap:",
        "f: '@h{0^{−} captures an impulse at }t = 0@h{, and the energy already stored}', note: ZERO_WHY, cap:")
s = rep(s,
        "f: '@h{valid if }@c{k}{Re s > −a}', cap:",
        "f: '@h{valid if }@c{k}{Re s > −a}@h{  (a real)}', note: '@h{For complex }a@h{ the condition is }Re(s + a) > 0@h{.}', cap:")
s = rep(s,
        "tag: 'sifting', cap:",
        "tag: 'sifting', note: SIFT, cap:")
s = rep(s, "const DEF = '@int{0^{−}}{∞}';\n",
        "const DEF = '@int{0^{−}}{∞}';\n"
        "// on-screen notes under a focus line (PPR-AT-024-2, -3, -5); markup as for the focus line\n"
        "const SCOPE_T = '@h{Series RC driven by }v_{s}(t)@h{; }v = v(t)@h{ is the capacitor voltage.}';\n"
        "const SCOPE_S = 'V = V(s)@h{, the transform of }v(t)@h{;  }V_{s} = V_{s}(s)@h{, the transform of }v_{s}(t)@h{ (not a DC value).}';\n"
        "const ZERO_WHY = '@h{The initial condition used is }v(0^{−})@h{, the value just before the switch, set by the stored energy (the RC example; Lecture 3).}';\n"
        "const SIFT = '@h{Sifting: }@int{0^{−}}{0^{+}} δ(t) g(t) dt = g(0)@h{, here with }g(t) = e^{−st}@h{.}';\n")

# finished rows carry the same conditions
s = rep(s, "    add('d2', '= e^{−st}  at t = 0', 'sifting');",
        "    add('d2', '= e^{−st}  at t = 0', 'sifting: ∫δ(t)g(t)dt = g(0)');")
s = rep(s, "cond: 'Re s > −a', sr:", "cond: 'Re s > −a (a real)', sr:")

# WorkZone renders the note as a full-width line under the focus line
s = rep(s,
        "b.tag ? h('span', { 'data-focus-tag': '1', style: { fontFamily: HEAD, fontSize: SMALL_FS, color: MUTE, marginLeft: 16, whiteSpace: 'nowrap' } }, b.tag) : null));",
        "b.tag ? h('span', { 'data-focus-tag': '1', style: { fontFamily: HEAD, fontSize: SMALL_FS, color: MUTE, marginLeft: 16, whiteSpace: 'nowrap' } }, b.tag) : null, "
        "b.note ? h('div', { 'data-focus-note': '1', style: { flexBasis: '100%', fontFamily: MONO, fontSize: SMALL_FS, color: INK, lineHeight: 1.5, marginTop: 4 } }, h(M, { t: b.note, size: SMALL_FS })) : null));")

# ═══ definition panel: 0⁻ reason (PPR-AT-024-2) and t >= 0⁻ where the table first appears (PPR-AT-024-1) ═══
s = rep(s,
        "'It captures an impulse at t = 0, and the energy already stored in the circuit.') : null,",
        "'It keeps an impulse at t = 0 inside the integral, and the initial condition used is v(0⁻), the value just before the switch, set by the stored energy.') : null, "
        "bi >= IX.u0 ? h('div', { 'data-def': 'tpos', style: { fontFamily: HEAD, fontSize: 14, color: INK, lineHeight: 1.35 } }, "
        "'Only t\u00a0≥\u00a00⁻ enters the integral: every pair above holds for t\u00a0≥\u00a00⁻.') : null,")

# ═══ PPR-AT-024-4: the Your-turn solution states the condition it uses ═══
s = rep(s, "    ['the pair', 'e^{−at} ↔ 1/(s + a), with a = −jω and a = +jω'],",
        "    ['the pair', 'e^{−at} ↔ 1/(s + a), with a = −jω and a = +jω; valid for Re\u00a0s\u00a0>\u00a00'],")

# ═══ AT-024-3: counter names math steps ═══
s = rep(s, "'line ' + (cur + 1) + ' of ' + total", "'step ' + (cur + 1) + ' of ' + total")
s = rep(s, '"aria-label": "previous line" }', '"aria-label": "previous step" }')
s = rep(s, '"aria-label": "next line" }', '"aria-label": "next step" }')
s = rep(s, "// KNav: ◀ ▶ one line at a time, the line counter,", "// KNav: ◀ ▶ one step at a time, the step counter,")

# ═══ AT-024-2, -3: a step by hand moves the playhead into that beat ═══
s = rep(s,
        "  const [hand, setHand] = useState(-1); // beat chosen by hand; -1 while the tour drives\n"
        "  useEffect(() => { if (playing)\n"
        "    setHand(-1); }, [playing]);\n"
        "  useEffect(() => { setHand(-1); }, [time]); // a seek hands the screen back to the playhead\n",
        "  const [hand, setHand] = useState(-1); // beat chosen by hand; -1 while the tour drives\n"
        "  const stepSeek = useRef(false); // true while the playhead move came from a step by hand\n"
        "  useEffect(() => { if (playing)\n"
        "    setHand(-1); }, [playing]);\n"
        "  // a seek hands the screen back to the playhead; a step by hand keeps its beat (its own playhead move)\n"
        "  useEffect(() => { if (stepSeek.current)\n"
        "    stepSeek.current = false;\n"
        "  else\n"
        "    setHand(-1); }, [time]);\n")
s = rep(s,
        "  const goBeat = (i) => { yt.close(); if (playing)\n"
        "    setPlaying(false); setHand(i); };\n",
        "  // step by hand: pause, show beat i, and move the playhead (header, title card, readout) into that beat\n"
        "  const goBeat = (i) => { yt.close(); if (playing)\n"
        "    setPlaying(false); stepSeek.current = true; setTime(beatStart(TL, i) + STEP_SETTLE); setHand(i); };\n")
s = rep(s, "  const { time, playing, setPlaying } = useTimeline();\n  const TL = useTL();\n  const yt = useYourTurn();",
        "  const { time, playing, setPlaying, setTime } = useTimeline();\n  const TL = useTL();\n  const yt = useYourTurn();")

# ═══ L1 addendum: Start card first in the DOM; the stage behind it inert while it shows ═══
s = rep(s,
        "  return h(React.Fragment, null, h(TitleCard, { ui: ui }),",
        "  const cardOn = !playing && time < CARD_EPS; // the opening card is showing\n"
        "  return h(React.Fragment, null, h(OpeningCard, { card: lang.card }), h('div', { 'data-behind-card': '1', inert: cardOn ? '' : undefined, 'aria-hidden': cardOn ? 'true' : undefined }, h(TitleCard, { ui: ui }),")
s = rep(s,
        "h(SoundToggle, null), h(ReplayPill, null), h(OpeningCard, { card: lang.card }), h(SrSummary,",
        "h(SoundToggle, null), h(ReplayPill, null), h(SrSummary,")
s = rep(s,
        "(yt.shown ? ' Solution: ' + YT.sr + '.' : '') : '') }));\n}",
        "(yt.shown ? ' Solution: ' + YT.sr + '.' : '') : '') })));\n}")

# ═══ cross-link: NEXT goes to Lecture 2 v1.0.2 (L2-L3 v1.0.2 pass, same PR) ═══
s = rep(s, "const NEXT = { href: 'Laplace_L2_Table_and_Properties_v1.0.1.html',", "const NEXT = { href: 'Laplace_L2_Table_and_Properties_v1.0.2.html',")

# ═══ CSP: recompute every inline script and style hash ═══
heads = list(re.finditer(r'<script>(.*?)</script>', s, re.S))
assert len(heads) == 3, len(heads)
styles = list(re.finditer(r'<style>(.*?)</style>', s, re.S))
assert len(styles) == 1
script_src = ' '.join(csp_hash(m.group(1)) for m in heads)
style_src = csp_hash(styles[0].group(1))
s, n = re.subn(r"script-src [^;]*; style-src [^;]*;", "script-src " + script_src + "; style-src " + style_src + ";", s)
assert n == 1
open(DST, 'w', encoding='utf-8', newline='').write(s)
print('wrote', DST, len(s.encode('utf-8')), 'B')
print('script-src', script_src)
print('style-src', style_src)
