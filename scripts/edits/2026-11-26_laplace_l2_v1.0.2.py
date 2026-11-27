#!/usr/bin/env python3
"""Exact-replacement edit for Laplace Lecture 2 v1.0.1 -> v1.0.2 (QUICK FIX, AT-025).

Purpose: reproduce the L2 part of PR "Laplace L1-L3 v1.0.2" (series PR #158).
Briefing: Queue/2026-11-26_ClaudeCode_briefing_Laplace-L2-L3_v1.0.2.md (STANDING GO 2026-11-15).
Items: PPR-AT-025-1..4 (on-screen text), AT-025-1 (rail contrast), AT-025-2 (Start card tab order), AT-025-3
(header and caption while stepping), AT-025-4 (series label), AT-025-5 (readout follows the step, counter).
Narration, the 11 clips and the timeline are not touched.
Usage (from the repo root): python3 -I scripts/edits/2026-11-26_laplace_l2_v1.0.2.py
The input is checked against its pre-edit SHA-256; every replacement is asserted to match the stated number of
times; the CSP script and style hashes are recomputed; the v1.0.2 file is written beside v1.0.1 (v1.0.1 is
removed at publish only).
"""
import base64, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'ece-2003', 'Laplace_L2_Table_and_Properties_v1.0.1.html')
DST = os.path.join(ROOT, 'ece-2003', 'Laplace_L2_Table_and_Properties_v1.0.2.html')
PRE_SHA = '2777fc37d417dc451c67cf2bf1ace181d24330a3976ef3ffd173de5faddf4d9a'  # v1.0.1, PR #143 (live)


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

# ═══ version stamp (header comment, meta, title, VERSION constant, script banner) ═══
s = rep(s, '  Version: v1.0.1\n  Released: 2026-11-22\n', '  Version: v1.0.2\n  Released: 2026-11-26\n')
s = rep(s, '  Changelog: v1.0.1 —',
        '  Changelog: v1.0.2 — QUICK FIX AT-025 (briefing 2026-11-26 L2-L3): on screen, each f(t) is zero for t < 0\n'
        '  (PPR-AT-025-1); the sin and cos rows are the damped pairs with a = 0 (-2); each property card states what its\n'
        '  constant means (-3); scaling a > 0 and F₁(s) defined under the property table (-4); upcoming rail labels ≥ 4.5:1 (AT-025-1); the\n'
        '  Start card is the first tab stop, the controls behind it are out of the tab order (AT-025-2); stepping with\n'
        '  ◀ ▶ moves the playhead into the step, so the header shows, no title fragment remains, the caption is held\n'
        '  and the readout follows (AT-025-3, -5); counter "step n of 40"; series label as L1 (AT-025-4); links to\n'
        '  L1 and L3 v1.0.2. Narration, clips, timeline and layout unchanged.\n'
        '  Changelog: v1.0.1 —')
s = rep(s, '<meta name="version" content="v1.0.1">', '<meta name="version" content="v1.0.2">')
s = rep(s, '<title>Lecture 2 · The Table and Its Properties v1.0.1</title>',
        '<title>Lecture 2 · The Table and Its Properties v1.0.2</title>')
s = rep(s, '/* Lecture 2 · The Table and Its Properties v1.0.1 — application script',
        '/* Lecture 2 · The Table and Its Properties v1.0.2 — application script')
s = rep(s, "const VERSION = 'v1.0.1'; // set by the build script", "const VERSION = 'v1.0.2'; // set by the build script")

# ═══ AT-025-1: upcoming rail labels >= 4.5:1 on the white card (same token as L1 v1.0.2) ═══
s = rep(s, "const UPCOMING = '#858A94'; // rows not yet reached (>= 3:1)",
        "const UPCOMING = '#6B707A'; // rows not yet reached: 4.97:1 on CARD, 4.75:1 on BG (AT-025-1, >= 4.5:1)")

# ═══ constants for the step-by-hand playhead move and the Start-card guard ═══
s = rep(s, "const MINUS = '−';\n",
        "const MINUS = '−';\n"
        "const STEP_SETTLE = 0.4; // s: a step by hand puts the playhead this far into the beat (caption faded in)\n"
        "const STEP_SETTLE_FRAC = 0.5; // never more than this fraction of the way to the next beat\n")

# ═══ AT-025-4: series label in L1's form ═══
s = rep(s, "series: 'ECE 2003 · Laplace Transform · Lecture 2',", "series: 'ECE 2003 · Laplace & the s-Domain · Lecture 2',")
s = rep(s, "kicker: 'LAPLACE · LECTURE 2',", "kicker: 'ECE 2003 · LAPLACE · LECTURE 2',")

# ═══ PPR-AT-025-1: f(t) = 0 for t < 0 (table view and the seven-pairs panel share the footnote) ═══
s = rep(s, "footnote: 'Every pair holds for t ≥ 0.',",
        "footnote: 'Every pair holds for t ≥ 0; each f(t) is zero for t < 0 (read it as f(t)u(t)).',")

# ═══ PPR-AT-025-2: the sin and cos rows say they are the damped pairs with a = 0 (so undamped sinusoids are covered) ═══
s = rep(s, "{ id: 'sin', f: 'sin ωt', F: ['ω', 's² + ω²'], inl: 'ω/(s² + ω²)' },",
        "{ id: 'sin', f: 'sin ωt', F: ['ω', 's² + ω²'], inl: 'ω/(s² + ω²)', tag: 'damped sine with a = 0' },")
s = rep(s, "{ id: 'cos', f: 'cos ωt', F: ['s', 's² + ω²'], inl: 's/(s² + ω²)' },",
        "{ id: 'cos', f: 'cos ωt', F: ['s', 's² + ω²'], inl: 's/(s² + ω²)', tag: 'damped cosine with a = 0' },")
s = rep(s, "h('span', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, p.use ? '' : ui.refTag));",
        "h('span', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, p.use ? '' : (p.tag || ui.refTag)));")

# ═══ PPR-AT-025-3: each property card scopes its constant; PPR-AT-025-4: reference-row conditions ═══
s = rep(s, "{ id: 'lin', name: 'Linearity', eq: 'a_{1}f_{1}(t) + a_{2}f_{2}(t) ↔ a_{1}F_{1}(s) + a_{2}F_{2}(s)', use: true },",
        "{ id: 'lin', name: 'Linearity', eq: 'a_{1}f_{1}(t) + a_{2}f_{2}(t) ↔ a_{1}F_{1}(s) + a_{2}F_{2}(s)', use: true, scope: 'a_{1}, a_{2}: constants' },")
s = rep(s, "{ id: 'scale', name: 'Scaling', eq: 'f(at) ↔ (1/a)F(s/a)', tag: 'reference' },",
        "{ id: 'scale', name: 'Scaling', eq: 'f(at) ↔ (1/a)F(s/a),  a > 0', tag: 'reference' },")
s = rep(s, "{ id: 'tshift', name: 'Time shift', eq: 'f(t − a)u(t − a) ↔ e^{−as}F(s)', use: true },",
        "{ id: 'tshift', name: 'Time shift', eq: 'f(t − a)u(t − a) ↔ e^{−as}F(s)', use: true, scope: 'a ≥ 0: the delay, in s' },")
s = rep(s, "{ id: 'fshift', name: 'Frequency shift', eq: 'e^{−at}f(t) ↔ F(s + a)', use: true },",
        "{ id: 'fshift', name: 'Frequency shift', eq: 'e^{−at}f(t) ↔ F(s + a)', use: true, scope: 'a: the constant in the exponent' },")
s = rep(s, "{ id: 'period', name: 'Time periodicity', eq: 'f(t) = f(t + nT) ↔ F_{1}(s)/(1 − e^{−sT})', tag: 'reference' },",
        "{ id: 'period', name: 'Time periodicity', eq: 'f(t) = f(t + nT) ↔ F_{1}(s)/(1 − e^{−sT})', tag: 'reference' },")
s = rep(s, "        footnote: 'Every pair holds for t ≥ 0",
        "        periodNote: 'Time periodicity: F_{1}(s) is the transform of the first period, 0 ≤ t < T.',\n"
        "        footnote: 'Every pair holds for t ≥ 0")
s = rep(s,
        "                PROPS.map((p) => h(PropRow, { key: p.id, p, on: bi >= (p.use ? PROP_AT[p.id] : IX.ref), active: b.prop === p.id })))),",
        "                PROPS.map((p) => h(PropRow, { key: p.id, p, on: bi >= (p.use ? PROP_AT[p.id] : IX.ref), active: b.prop === p.id })),\n"
        "                h('div', { 'data-period-note': '1', style: { visibility: bi >= IX.ref ? 'visible' : 'hidden', fontFamily: HEAD, fontSize: FS_MIN, color: INK, marginTop: 3 } }, mt(ui.periodNote, FS_MIN)))),")
# the property cards in the bottom band: name, property, and what its constant is (three lines in the 110 px band)
s = rep(s,
        "                    h('div', { style: { fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: inUse === id ? C_BAR : INK, lineHeight: '19px' } }, p.name),\n"
        "                    h('div', { style: { fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: '24px' } }, mt(p.eq, FS_MIN)));",
        "                    h('div', { style: { fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: inUse === id ? C_BAR : INK, lineHeight: '17px' } }, p.name),\n"
        "                    h('div', { style: { fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: '21px' } }, mt(p.eq, FS_MIN)),\n"
        "                    h('div', { 'data-scope': id, style: { fontFamily: HEAD, fontSize: FS_MIN, color: INK, lineHeight: '17px' } }, mt(p.scope, FS_MIN)));")

# ═══ cross-links to the v1.0.2 lectures of this series pass ═══
s = rep(s, "href: 'Laplace_L1_What_the_Transform_Does_v1.0.1.html' }", "href: 'Laplace_L1_What_the_Transform_Does_v1.0.2.html' }")
s = rep(s, "href: 'Laplace_L3_Circuit_Element_Models_v1.0.1.html' }", "href: 'Laplace_L3_Circuit_Element_Models_v1.0.2.html' }")

# ═══ AT-025-5: counter names steps ═══
s = rep(s, "'line ' + (cur + 1) + ' of ' + total", "'step ' + (cur + 1) + ' of ' + total")
s = rep(s, "step('◀', Math.max(0, cur - 1), 'previous line'),", "step('◀', Math.max(0, cur - 1), 'previous step'),")
s = rep(s, "step('▶', Math.min(total - 1, cur + 1), 'next line'),", "step('▶', Math.min(total - 1, cur + 1), 'next step'),")
s = rep(s, "// ◀ ▶ one line at a time, the line counter,", "// ◀ ▶ one step at a time, the step counter,")

# ═══ AT-025-3: the caption of the stepped beat is held (as L3) ═══
s = rep(s,
        "function LectureCaptions({ sched, text }) {\n"
        "    const time = useTime();\n"
        "    const TL = useTL();\n"
        "    const i = idxAt(sched, time);\n"
        "    if (i < 0 || time >= TL.FINISH || !text)\n"
        "        return null;\n",
        "// `still` shows it at full strength while stepping by hand (AT-025-3)\n"
        "function LectureCaptions({ sched, text, still }) {\n"
        "    const time = useTime();\n"
        "    const TL = useTL();\n"
        "    const i = idxAt(sched, time);\n"
        "    if (!text || (!still && (i < 0 || time >= TL.FINISH)))\n"
        "        return null;\n")
s = rep(s, "                opacity: clamp((time - sched.starts[i]) / 0.35, 0, 1), fontFamily: MONO, fontSize: 15,",
        "                opacity: still ? 1 : clamp((time - sched.starts[i]) / 0.35, 0, 1), fontFamily: MONO, fontSize: 15,")

# ═══ AT-025-3, -5: a step by hand moves the playhead into that beat (header, title card, readout follow) ═══
s = rep(s,
        "    const { time, playing, setPlaying } = useTimeline();\n    const TL = useTL();\n    const yt = useYourTurn();\n    const reduced = useReducedMotion();",
        "    const { time, playing, setPlaying, setTime } = useTimeline();\n    const TL = useTL();\n    const yt = useYourTurn();\n    const reduced = useReducedMotion();")
s = rep(s,
        "    const goBeat = (i) => { yt.close(); if (playing)\n        setPlaying(false); setHand(i); };\n",
        "    // step by hand: pause, show beat i, and move the playhead into it (STEP_SETTLE, kept short of the next beat)\n"
        "    const goBeat = (i) => { yt.close(); if (playing)\n        setPlaying(false);\n"
        "        const t0 = beatStart(TL, i), t1 = i + 1 < BEATS.length ? beatStart(TL, i + 1) : TL.REVERT;\n"
        "        setTime(t0 + Math.min(STEP_SETTLE, STEP_SETTLE_FRAC * Math.max(0, t1 - t0))); setHand(i); };\n"
        "    const cardOn = !playing && time < START_EPS; // the opening card is showing (AT-025-2)\n")

# ═══ AT-025-2: Start card first in the DOM; the stage behind it inert while it shows ═══
s = rep(s,
        "    return h(React.Fragment, null,\n        h(TitleCard, { ui }),\n",
        "    return h(React.Fragment, null,\n        h(OpeningCard, { card: lang.card }),\n"
        "        h('div', { 'data-behind-card': '1', inert: cardOn ? '' : undefined, 'aria-hidden': cardOn ? 'true' : undefined },\n"
        "        h(TitleCard, { ui }),\n")
s = rep(s, "        h(LectureCaptions, { sched, text: shown >= 0 ? b.cap : '' }),\n",
        "        h(LectureCaptions, { sched, text: shown >= 0 ? b.cap : '', still: hand >= 0 }),\n")
s = rep(s, "        h(ReplayPill, null),\n        h(OpeningCard, { card: lang.card }),\n        h(SrSummary,",
        "        h(ReplayPill, null),\n        h(SrSummary,")
s = rep(s,
        "(yt.shown ? ' Solution: ' + YT.answer.map(plain).join(' ') + '.' : '') : '') }));\n}",
        "(yt.shown ? ' Solution: ' + YT.answer.map(plain).join(' ') + '.' : '') : '') })));\n}")

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
