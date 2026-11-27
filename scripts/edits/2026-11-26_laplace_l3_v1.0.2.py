#!/usr/bin/env python3
"""Exact-replacement edit for Laplace Lecture 3 v1.0.1 -> v1.0.2 (QUICK FIX, AT-026).

Purpose: reproduce the L3 part of PR "Laplace L1-L3 v1.0.2" (series PR #158).
Briefing: Queue/2026-11-26_ClaudeCode_briefing_Laplace-L2-L3_v1.0.2.md (STANDING GO 2026-11-15).
Items: PPR-AT-026-1..4 (on-screen text), AT-026-1 (rail contrast), AT-026-2 (Start card tab order), AT-026-3 (end
links at 125 %), AT-026-4 (readout follows the step, counter), AT-026-5 (R, L, C signalled in the band),
AT-026-6 (done mark is a tick), AT-026-7 (series label), AT-026-8 (e5 caption exponent).
Not done: item 5 (gloss "every pole of sF(s) has a negative real part") waits on PPR-AT-026-J1.
Narration, the 11 clips and the timeline are not touched.
Usage (from the repo root): python3 -I scripts/edits/2026-11-26_laplace_l3_v1.0.2.py
The input is checked against its pre-edit SHA-256; every replacement is asserted to match the stated number of
times; the CSP script and style hashes are recomputed; the v1.0.2 file is written beside v1.0.1.
"""
import base64, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'ece-2003', 'Laplace_L3_Circuit_Element_Models_v1.0.1.html')
DST = os.path.join(ROOT, 'ece-2003', 'Laplace_L3_Circuit_Element_Models_v1.0.2.html')
PRE_SHA = '5e09c21c565146487a75f9413ed9fcc2c4267e00a62336b0cc8afa614453ea08'  # v1.0.1, PR #143 (live)


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

# ═══ version stamp ═══
s = rep(s, '  Version: v1.0.1\n  Released: 2026-11-22\n', '  Version: v1.0.2\n  Released: 2026-11-26\n')
s = rep(s, '  Changelog: v1.0.1 —',
        '  Changelog: v1.0.2 — QUICK FIX AT-026 (briefing 2026-11-26 L2-L3): the capacitor branch is named\n'
        '  "admittance sC (impedance 1/(sC))" (PPR-AT-026-1); the boundary term states its condition (-2); the worked\n'
        '  check shows the pole of sV_C(s) before v(∞) (-3); the check lines say they are confirmed by the forward\n'
        '  transform with the Lecture 2 pairs, with Lecture 8 as a preview (-4); upcoming rail labels ≥ 4.5:1\n'
        '  (AT-026-1); the Start card is the first tab stop (AT-026-2); end links ≥ 24 px (AT-026-3); stepping moves\n'
        '  the playhead and the counter reads "step n of 38" (AT-026-4); R, L, C highlighted in the s-domain band at\n'
        '  their beats (AT-026-5); the done mark renders as a tick (AT-026-6); series label as L1 (AT-026-7); the e5\n'
        '  caption exponent is a superscript (AT-026-8). Narration, clips, timeline and layout unchanged.\n'
        '  Changelog: v1.0.1 —')
s = rep(s, '<meta name="version" content="v1.0.1">', '<meta name="version" content="v1.0.2">')
s = rep(s, '<title>Lecture 3 · From Derivatives to Circuit Models v1.0.1</title>',
        '<title>Lecture 3 · From Derivatives to Circuit Models v1.0.2</title>')
s = rep(s, '/* Lecture 3 · From Derivatives to Circuit Models v1.0.1 — application script',
        '/* Lecture 3 · From Derivatives to Circuit Models v1.0.2 — application script')
s = rep(s, "const VERSION = 'v1.0.1'; // must agree", "const VERSION = 'v1.0.2'; // must agree")

# ═══ AT-026-1: upcoming rail labels >= 4.5:1 (same token as L1/L2 v1.0.2) ═══
s = rep(s, "const UPCOMING = '#858A94'; // rows not yet reached (>= 3:1)",
        "const UPCOMING = '#6B707A'; // rows not yet reached: 4.97:1 on CARD, 4.75:1 on BG (AT-026-1, >= 4.5:1)")

# ═══ constants ═══
s = rep(s, "const C_CATCH = CORAL; // the catch: the final-value validity condition\n",
        "const C_CATCH = CORAL; // the catch: the final-value validity condition\n"
        "const STEP_SETTLE = 0.4; // s: a step by hand puts the playhead this far into the beat\n"
        "const STEP_SETTLE_FRAC = 0.5; // never more than this fraction of the way to the next beat\n"
        "const LINK_MIN_H = 29; // px on the stage: an end-band link target stays >= 24 CSS px at 125 % zoom (stage scale 0.854; SC 2.5.8)\n"
        "const NEXT_GAP = 2; // px: gap between the NEXT heading and the two links (keeps both links inside the 110 px band)\n"
        "const TICK_PX = 12; // px: the rail's done mark (a drawn tick; the font's U+2713 read as a radical, AT-026-6)\n"
        "const L8_HREF = 'S-Domain_Circuit_Analysis_v1.1.1.html'; // Lecture 8, where the models are applied\n")

# ═══ AT-026-7: series label in L1's form ═══
s = rep(s, "series: 'ECE 2003 · LAPLACE & THE s-DOMAIN',", "series: 'ECE 2003 · Laplace & the s-Domain · Lecture 3',")
s = rep(s, "kicker: 'ECE 2003 · LECTURE 3',", "kicker: 'ECE 2003 · LAPLACE · LECTURE 3',")
# cross-link to L2 v1.0.2 (this series pass)
s = rep(s, "prevHref: 'Laplace_L2_Table_and_Properties_v1.0.1.html',", "prevHref: 'Laplace_L2_Table_and_Properties_v1.0.2.html',")

# ═══ PPR-AT-026-1: the capacitor's parallel branch named as the figure names it ═══
s = rep(s, "cap: 'sC in parallel with a current source Cv(0⁻)' }, // \"As a circuit\"",
        "cap: 'admittance sC (impedance 1/(sC)) in parallel with a current source Cv(0⁻)' }, // \"As a circuit\"")
s = rep(s, "case 'c3': return prose('sC in parallel with a current source Cv(0⁻)');",
        "case 'c3': return prose('admittance sC (impedance 1/(sC)) in parallel with a current source Cv(0⁻)');")
s = rep(s, "add('c3', h('span', null, 'parallel: sC with a current source Cv(0⁻)' + (i > IX.c4 ? ', arrow toward +' : '')));",
        "add('c3', h('span', null, 'parallel: admittance sC (impedance 1/(sC)) with a current source Cv(0⁻)' + (i > IX.c4 ? ', arrow toward +' : '')), MUTE, true);")

# ═══ PPR-AT-026-2: the boundary term states when the upper limit vanishes ═══
s = rep(s, "add('bterm', h('span', null, 'boundary term: 0 − f(0⁻)'));",
        "add('bterm', h('span', null, 'boundary term: 0 − f(0⁻); the upper limit is 0 for Re s large enough that f(t)', e, ' → 0 (integrals from 0⁻ to ∞)'), MUTE, true);")

# ═══ PPR-AT-026-3: the pole check before v(∞) ═══
s = rep(s,
        "    if (i > IX.e4b && i <= IX.e5)\n",
        "    if (i >= IX.e4a && i <= IX.e4b) // before v(∞): the final value needs the poles of sV_C(s) in the left half-plane\n"
        "        add('pole', h('span', null, 'pole of s', vc, ': s = ' + nf(-EX_B / EX_A) + ', left half-plane → v(∞) exists'), C_CATCH);\n"
        "    if (i > IX.e4b && i <= IX.e5)\n")

# ═══ PPR-AT-026-4: the check is the forward transform with the Lecture 2 pairs; Lecture 8 stays a preview ═══
s = rep(s,
        "    if (i > IX.k1)\n        add('k1',",
        "    if (i >= IX.e5) // how the time function is confirmed today: transform it with the Lecture 2 pairs\n"
        "        add('fwd', h('span', null, 'confirm: ℒ{' + nf(EX.vinf) + ' − ' + nf(EX.amp) + 'e', h(Sup, { size: z }, '−' + nf(EX.rate) + 't'), '} = ' + nf(EX.vinf) + '/s − ' + nf(EX.amp) + '/(s + ' + nf(EX.rate) + ') = ', vc, ' (Lecture 2 pairs; inverting comes in Lectures 4–5)'), MUTE, true);\n"
        "    if (i > IX.k1)\n        add('k1',")
s = rep(s,
        "            h('div', { style: { fontFamily: HEAD, fontSize: 13.5, color: MUTE } }, 'This i(t) is plotted on the right. It agrees with Lecture 8.')) : null);",
        "            step('t', 'confirm', h('span', null, 'ℒ{' + nf(YT.iinf) + ' − ' + nf(YT.iinf - YT.i0) + 'e', h(Sup, { size: SMALL_FS }, '−' + nf(YT.rate) + 't'), '} = ' + nf(YT.iinf) + '/s − ' + nf(YT.iinf - YT.i0) + '/(s + ' + YT_P + ') = I(s)')),\n"
        "            h('div', { style: { fontFamily: HEAD, fontSize: 13.5, color: INK } }, 'Confirmed by transforming i(t) with the Lecture 2 pairs; inverting I(s) comes in Lectures 4–5. This i(t) is plotted on the right. Preview: ',\n"
        "                h('a', { href: L8_HREF, style: { color: ACCENT, fontWeight: 600 } }, 'Lecture 8'), ' solves the circuit.')) : null);")

# ═══ AT-026-3: end-band links are at least 24 px high at every zoom ═══
s = rep(s, "h('a', { key: 'p', 'data-endlink': '1', href: ui.prevHref, style: { fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, ui.prevText),",
        "h('a', { key: 'p', 'data-endlink': '1', href: ui.prevHref, style: { display: 'flex', alignItems: 'center', minHeight: LINK_MIN_H, fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, ui.prevText),")
s = rep(s, "h('a', { key: 'a', 'data-endlink': '1', href: ui.nextHref, style: { fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, ui.nextText),",
        "h('a', { key: 'a', 'data-endlink': '1', href: ui.nextHref, style: { display: 'flex', alignItems: 'center', minHeight: LINK_MIN_H, fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, ui.nextText),")

s = rep(s, "width: NEXT_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }",
        "width: NEXT_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: NEXT_GAP }")

# ═══ AT-026-5: the entry being spoken is highlighted in the IN THE s-DOMAIN band ═══
s = rep(s,
        "? h('span', { key: t, 'data-z': t, style: { fontFamily: MONO, fontSize: 19, fontWeight: 600, color: C_S, whiteSpace: 'nowrap' } }, t) : null)))),",
        "? h('span', { key: t, 'data-z': t, 'data-z-now': bi === at ? '1' : undefined, style: { fontFamily: MONO, fontSize: 19, fontWeight: 600, color: C_S, whiteSpace: 'nowrap',\n"
        "                    outline: bi === at ? `2px solid ${ACCENT}` : 'none', outlineOffset: 3, borderRadius: 4 } }, t) : null)))),")

# ═══ AT-026-6: the rail's done mark is a tick ═══
s = rep(s, "h('span', { style: { fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 } }, i < active ? '✓' : CIRCLED9[i]),",
        "h('span', { style: { fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 } }, i < active ? h(Tick, { color: col }) : CIRCLED9[i]),")
s = rep(s, "// LectureRail: the nine steps of the lecture (narration lines 2–10)\n",
        "// Tick: the rail's done mark, drawn as a path so no font can turn it into a radical sign (AT-026-6)\n"
        "function Tick({ color }) {\n"
        "    return h('svg', { width: TICK_PX, height: TICK_PX, viewBox: '0 0 12 12', role: 'img', 'aria-label': 'done', 'data-tick': '1', style: { display: 'inline-block', verticalAlign: '-1px' } },\n"
        "        h('path', { d: 'M2 6.5L5 9.5L10.5 2.5', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }));\n"
        "}\n"
        "// LectureRail: the nine steps of the lecture (narration lines 2–10)\n")

# ═══ AT-026-8: e^(...) in a caption is set as a superscript, as in the focus line ═══
s = rep(s,
        "                padding: '8px 18px', opacity: appear, fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' } }, text));",
        "                padding: '8px 18px', opacity: appear, fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' } },\n"
        "            text.split(CAP_SUP_RE).map((part, k) => (k % 2 ? h(Sup, { key: k, size: 15 }, part) : part))));")
s = rep(s, "// Captions: the on-screen line for the beat being spoken; `still` shows it while stepping by hand\n",
        "// caption text \"^(…)\" is drawn as a superscript (the plain form stays in the screen-reader summary)\n"
        "const CAP_SUP_RE = /\\^\\(([^)]*)\\)/;\n"
        "// Captions: the on-screen line for the beat being spoken; `still` shows it while stepping by hand\n")

# ═══ AT-026-4: counter names steps ═══
s = rep(s, "'line ' + (cur + 1) + ' of ' + total", "'step ' + (cur + 1) + ' of ' + total")
s = rep(s, "style: b, 'aria-label': 'previous line' }, '◀'),", "style: b, 'aria-label': 'previous step' }, '◀'),")
s = rep(s, "style: b, 'aria-label': 'next line' }, '▶'),", "style: b, 'aria-label': 'next step' }, '▶'),")
s = rep(s, "// LineNav: ◀ ▶ one line at a time, the line counter,", "// LineNav: ◀ ▶ one step at a time, the step counter,")

s = rep(s, "noteStep: 'step one line at a time with ◀ ▶',", "noteStep: 'step through the lecture with ◀ ▶, or press play',")

# ═══ AT-026-4: a step by hand moves the playhead into that beat (the readout and bar follow) ═══
s = rep(s,
        "    const { time, playing, setPlaying } = useTimeline();\n    const TL = useTL();\n    const yt = useYourTurn();\n    const reduced = useReducedMotion();\n    const [hand, setHand]",
        "    const { time, playing, setPlaying, setTime } = useTimeline();\n    const TL = useTL();\n    const yt = useYourTurn();\n    const reduced = useReducedMotion();\n    const [hand, setHand]")
s = rep(s,
        "    const goBeat = (i) => { yt.close(); if (playing)\n        setPlaying(false); setHand(i); };\n",
        "    // step by hand: pause, show beat i, and move the playhead into it (STEP_SETTLE, kept short of the next beat)\n"
        "    const goBeat = (i) => { yt.close(); if (playing)\n        setPlaying(false);\n"
        "        const t0 = beatStart(TL, i), t1 = i + 1 < BEATS.length ? beatStart(TL, i + 1) : TL.REVERT;\n"
        "        setTime(t0 + Math.min(STEP_SETTLE, STEP_SETTLE_FRAC * Math.max(0, t1 - t0))); setHand(i); };\n"
        "    const cardOn = !playing && time < START_EPS; // the opening card is showing (AT-026-2)\n")

# ═══ AT-026-2: Start card first in the DOM; the stage behind it inert while it shows ═══
s = rep(s,
        "    return h(React.Fragment, null,\n        h(TitleCard, { ui, hide: hand >= 0 }),\n",
        "    return h(React.Fragment, null,\n        h(OpeningCard, { card: lang.card }),\n"
        "        h('div', { 'data-behind-card': '1', inert: cardOn ? '' : undefined, 'aria-hidden': cardOn ? 'true' : undefined },\n"
        "        h(TitleCard, { ui, hide: hand >= 0 }),\n")
s = rep(s, "        h(ReplayPill, null),\n        h(OpeningCard, { card: lang.card }),\n        h(SrSummary, { text: sr }));\n}",
        "        h(ReplayPill, null),\n        h(SrSummary, { text: sr })));\n}")

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
