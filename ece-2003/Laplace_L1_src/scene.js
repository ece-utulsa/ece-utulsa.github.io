/* ═══ SCENE — Lecture 1 · What the Laplace Transform Does ═════════════════════
 TOC
  1  CONSTANTS + COLOUR ROLES
  2  MATH TEXT             small markup -> fractions, integrals, limits, superscripts
  3  LANGUAGE PACK         narration text, UI strings, Your-turn key
  4  BEATS                 one line of math at a time (focus rules R1–R7)
  5  PANELS                LectureRail, WorkZone, Pairs, DefinitionPanel, BottomBand, CosYourTurn
  6  SCENE
 Model: symbolic only. Every line on screen is an identity from the definition
 F(s) = ∫ f(t) e^(−st) dt, lower limit 0⁻, upper limit ∞ (Alexander & Sadiku, Table 15.1 notation);
 no numbers are computed at run time. t in s, s = σ + jω in 1/s. */
const h = React.createElement;
/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5; // s: pause after each clip before the next line replaces it (focus rule R6)
const NUMBERS_H = 116; // px: height of the pairs panel
const GUTTER_X = WORK_X + WORK_W + (SIDE_X - WORK_X - WORK_W) / 2; // px: middle of the gap between the work zone and the side column
const GUTTER_Y = 5; // px: below the pairs panel, the middle of the gap above the definition panel
const SUP_SCALE = 0.68; // superscript, subscript and limit size relative to the base size
const SUP_RISE = 0.42, SUB_DROP = 0.25; // em: how far a superscript is raised / a subscript lowered
const INT_H = 2.0, INT_W = 0.5; // em: height and width of the integral sign
const ROW_H = 26; // px: smallest height of a finished row
const CAP_FS = 15, SIDE_FS = 16, LABEL_FS = 15; // px: caption, side-panel math, pair label
const C_TIME = GREEN; // time-domain functions: f(t), u(t), e^(−at), δ(t), dv/dt
const C_S = TEAL; // s-domain: F(s) and what replaces a derivative
const C_VALUE = AMBER; // a result as it forms and lands in its pair slot
const C_MARK = ACCENT; // the part of a line the voice is pointing at
const MCOL = { t: C_TIME, s: C_S, v: C_VALUE, k: C_MARK, m: MUTE };
const NEXT = { href: 'Laplace_L2_Table_and_Properties_v1.0.0.html', text: 'Lecture 2 · The Table and Its Properties' };
/* ═══ 2 MATH TEXT ═════════════════════════════════════════════════════════ */
// Markup: ^{x} superscript, _{x} subscript, @frac{num}{den}, @int{lower}{upper}, @ev{body}{lower}{upper}
// (brackets with evaluation limits), @c{key}{x} colour from MCOL, @h{x} prose in the heading font.
const M_ARGS = { frac: 2, int: 2, ev: 3, c: 2, h: 1 };
const GREEK_RE = /([Ͱ-Ͽ]+)/;
// font size (px) of a superscript, subscript or limit on a base of `size` px; never below FS_MIN
const supFs = (size) => Math.max(FS_MIN, Math.round(size * SUP_SCALE));
// index of the brace that closes the group opening at t[i]
function groupEnd(t, i) {
  let depth = 0;
  for (let k = i; k < t.length; k++) {
    if (t[k] === '{')
      depth++;
    else if (t[k] === '}' && --depth === 0)
      return k;
  }
  return t.length;
}
// plain text with Greek letters set in the heading font (the monospace subset has no Greek)
function MText({ text }) {
  return h(React.Fragment, null, text.split(GREEK_RE).map((p, i) => (i % 2 ? h('span', { key: i, style: { fontFamily: HEAD } }, p) : p)));
}
// lower and upper limit stacked to the right of an integral sign or an evaluation bracket
function MLimits({ lo, hi, size }) {
  const fs = supFs(size);
  return h('span', { style: { display: 'inline-flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch',
      fontSize: fs, lineHeight: 1.1, marginLeft: 2 } }, h('span', null, mnodes(hi, fs)), h('span', null, mnodes(lo, fs)));
}
// one markup command -> element
function mcmd(name, a, size, key) {
  const box = { display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' };
  if (name === 'frac') {
    return h('span', { key, style: Object.assign({}, box, { flexDirection: 'column', margin: '0 4px', lineHeight: 1.2 }) }, h('span', { style: { padding: '0 3px' } }, mnodes(a[0], size)), h('span', { style: { alignSelf: 'stretch', height: size >= FOCUS_FS ? 2 : 1.5, background: 'currentColor' } }), h('span', { style: { padding: '0 3px' } }, mnodes(a[1], size)));
  }
  if (name === 'int') {
    return h('span', { key, style: Object.assign({}, box, { marginRight: 5 }) }, h('svg', { width: size * INT_W, height: size * INT_H, viewBox: '0 0 11 40', 'aria-hidden': 'true', style: { flexShrink: 0 } }, h('path', { d: 'M9.5 4.5 C9.5 1.5 6.6 1.2 6.2 5 L4.8 35 C4.4 38.8 1.5 38.5 1.5 35.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' })), h(MLimits, { lo: a[0], hi: a[1], size }));
  }
  if (name === 'ev') {
    const side = (left) => ({ width: 5, alignSelf: 'stretch', borderTop: '1.5px solid currentColor', borderBottom: '1.5px solid currentColor',
      borderLeft: left ? '1.5px solid currentColor' : 'none', borderRight: left ? 'none' : '1.5px solid currentColor' });
    return h('span', { key, style: Object.assign({}, box, { margin: '0 4px' }) }, h('span', { style: side(true) }), h('span', { style: { padding: '3px 4px' } }, mnodes(a[0], size)), h('span', { style: side(false) }), h(MLimits, { lo: a[1], hi: a[2], size }));
  }
  if (name === 'c')
    return h('span', { key, style: { color: MCOL[a[0]], fontWeight: 600 } }, mnodes(a[1], size));
  return h('span', { key, style: { fontFamily: HEAD } }, mnodes(a[0], size));
}
// markup string -> array of elements at a base size of `size` px
function mnodes(t, size) {
  const out = [];
  let buf = '', i = 0;
  const flush = () => { if (buf) {
    out.push(h(MText, { key: out.length, text: buf }));
    buf = '';
  } };
  while (i < t.length) {
    const ch = t[i];
    if (ch === '@') {
      const name = /^[a-z]+/.exec(t.slice(i + 1))[0], args = [];
      let j = i + 1 + name.length;
      for (let n = 0; n < M_ARGS[name]; n++) {
        const e = groupEnd(t, j);
        args.push(t.slice(j + 1, e));
        j = e + 1;
      }
      flush();
      out.push(mcmd(name, args, size, out.length));
      i = j;
    }
    else if ((ch === '^' || ch === '_') && t[i + 1] === '{') {
      const e = groupEnd(t, i + 1), fs = supFs(size), up = ch === '^';
      flush();
      out.push(h('span', { key: out.length, style: { fontSize: fs, position: 'relative', top: (up ? -SUP_RISE : SUB_DROP) * size, lineHeight: 1 } }, mnodes(t.slice(i + 2, e), fs)));
      i = e + 1;
    }
    else {
      buf += ch;
      i++;
    }
  }
  flush();
  return out;
}
// M: a line of math text
const M = ({ t, size }) => h('span', null, mnodes(t, size));
// markup -> plain words for the screen-reader summary
const plain = (t) => t.replace(/@c\{.\}/g, '').replace(/@[a-z]+/g, ' ').replace(/[{}^_]/g, '').replace(/\s+/g, ' ').trim();
/* ═══ 3 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s, measured with ffprobe at build); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 16 }, (_, i) => 'laplaceL1_line' + (i + 1) + '.mp3'),
  durs: /*DURS*/[],
  text: [
    'In this lecture we see what the Laplace transform does for circuits, and find three transforms straight from the definition. Then you’ll try one yourself.',
    'A capacitor or an inductor gives us a differential equation.',
    'The transform turns each derivative into multiplication by s.',
    'So the differential equation becomes algebra, and the initial condition comes along for free.',
    'Here is the definition. Multiply f of t by e to the minus s t, and integrate. s is complex: sigma plus j omega.',
    'We start the integral at zero minus, just before t equals zero. That captures an impulse at t equals zero, and the energy already stored in the circuit.',
    'First, the unit step. It equals one for positive t, so only the exponential is left.',
    'Integrate, then evaluate between the two limits.',
    'At the upper limit the exponential goes to zero, if the real part of s is positive.',
    'At the lower limit the exponential is one, which leaves one over s.',
    'Next, e to the minus a t. The two exponents add, to s plus a.',
    'The same steps give one over s plus a, if the real part of s is greater than minus a.',
    'Last, the impulse. Zero minus keeps it inside the limits, and it sifts out the exponential at t equals zero.',
    'e to the zero is one, so the impulse transforms to one.',
    'Three integrals give three pairs. From here on, we read transforms from the table.',
    'Your turn. On paper, find the transform of cosine omega t. Hint: use Euler’s formula.',
  ],
  rail: ['why: equation → algebra', 'the definition', 'unit step u(t)', 'exponential e^{−at}', 'impulse δ(t)', 'key point'],
  card: {
    series: 'ECE 2003 · Laplace & the s-Domain · Lecture 1',
    title: 'Lecture 1 · What the Laplace Transform Does',
    sentence: 'In this lecture we see what the Laplace transform does for circuits, and we find three transforms straight from the definition. At the end, you’ll try one yourself.',
    steps: [
      'Why: the transform turns a circuit’s differential equation into algebra.',
      'The definition, and why the integral starts at 0⁻.',
      'Three transforms from the definition: the unit step, an exponential and the impulse.',
    ],
    able: 'Find a transform straight from the definition. Then try cos ωt yourself.',
  },
  ui: {
    kicker: 'ECE 2003 · LAPLACE · LECTURE 1',
    title: 'What the Laplace Transform Does',
    sub: 'three transforms, straight from the definition',
    header: 'Lecture 1 · What the Laplace Transform Does',
    headerSub: '· from the definition',
    keyPoint: 'Three integrals give three pairs. From here on, we read transforms from the table.',
    railHead: 'THE LECTURE',
    workHead: 'THE WORK',
    pairsHead: 'THE PAIRS · f(t) ↔ F(s)',
    defHead: 'THE DEFINITION',
    nextHead: 'NEXT',
    legendHead: 'COLOUR KEY',
    legend: [[C_TIME, 'time domain: f(t)'], [C_S, 's-domain: F(s)'], [C_VALUE, 'a result landing in its pair'], [C_MARK, 'the part being discussed']],
    model: 'Symbolic derivation from the definition; no numbers are computed.',
    notes: [
      'three transforms, straight from the definition',
      'stored energy puts a derivative in the equation',
      'each derivative becomes multiplication by s',
      'solve for V with algebra; the initial condition is already there',
      'one integral turns f(t) into F(s)',
      'the lower limit sits just before t = 0',
      'the step is 1 for t > 0',
      'integrate the exponential',
      'the upper limit sets the condition on s',
      'the lower limit gives the result',
      'combine the two exponentials',
      'the same steps as the unit step',
      'the impulse acts at t = 0',
      'the third pair',
      'the table comes next',
      'work it on paper, then show the solution',
    ],
    noteStep: 'step with ◀ ▶, or press play to carry on',
    endTitle: 'Lecture 1 ✓', endSub: 'try the Your-turn problem · then Lecture 2',
    srSummary: 'Lecture 1, what the Laplace transform does. ',
  },
};
// Your turn (spec L1 item 8): L{cos ωt} = s/(s² + ω²), by Euler's formula and the pair e^(−at) ↔ 1/(s + a)
const YT = {
  ask: 'Find the Laplace transform of ',
  fn: 'cos ωt',
  hint: 'Hint: Euler’s formula.',
  steps: [
    ['Euler', 'cos ωt = ½(e^{jωt} + e^{−jωt})'],
    ['the pair', 'e^{−at} ↔ 1/(s + a), with a = −jω and a = +jω'],
    ['so', 'F(s) = ½[1/(s − jω) + 1/(s + jω)]'],
    ['combine', 'F(s) = ½ · 2s/((s − jω)(s + jω))'],
  ],
  answer: 'cos ωt ↔ s/(s^{2} + ω^{2})',
  sr: 'cosine omega t transforms to s over the quantity s squared plus omega squared',
};
/* ═══ 4 BEATS — one line of math at a time (focus rules R1–R7) ═══════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based); `from` is the fraction of
// that clip at which the beat starts, taken from the word timings the voice service reported for the clip.
//   sec    rail section 0..5 (-1 before the first)
//   f      the focus line (markup);  cap  the caption (markup)
//   land   pair slot whose value forms and lands on this beat ('u', 'e', 'd')
const DEF = '@int{0^{−}}{∞}';
const BEATS = [
  { id: 'intro', line: 1, from: 0.34, sec: -1, f: '@h{What does the Laplace transform do for circuits?}', cap: 'What the Laplace transform does for circuits, and three transforms from the definition.' },
  { id: 'ode', line: 2, from: 0, sec: 0, f: 'RC @c{t}{@frac{dv}{dt}} + v = v_{s}', cap: 'A capacitor or an inductor gives a differential equation.' },
  { id: 'xform', line: 3, from: 0, sec: 0, f: 'RC@c{s}{[sV − v(0^{−})]} + V = V_{s}', cap: 'The transform turns each derivative into multiplication by s.' },
  { id: 'alg', line: 4, from: 0, sec: 0, f: 'V = @frac{V_{s} + RC v(0^{−})}{RCs + 1}', cap: 'The differential equation becomes algebra …' },
  { id: 'ic', line: 4, from: 0.51, sec: 0, f: 'V = @frac{V_{s} + RC @c{k}{v(0^{−})}}{RCs + 1}', tag: 'the initial condition', cap: '… and the initial condition v(0^{−}) comes along for free.' },
  { id: 'def', line: 5, from: 0, sec: 1, f: '@c{s}{F(s)} = ' + DEF + ' @c{t}{f(t)} e^{−st} dt', cap: 'The definition: multiply f(t) by e^{−st}, and integrate.' },
  { id: 'svar', line: 5, from: 0.67, sec: 1, f: 's = σ + jω', tag: 's is complex', cap: 's is complex: s = σ + jω' },
  { id: 'zero', line: 6, from: 0, sec: 1, f: '@h{lower limit }@c{k}{0^{−}}@h{: just before }t = 0', cap: 'The integral starts at 0^{−}, just before t = 0.' },
  { id: 'zero2', line: 6, from: 0.46, sec: 1, f: '@h{0^{−} captures an impulse at }t = 0@h{, and the energy already stored}', cap: 'That captures an impulse at t = 0, and the energy already stored in the circuit.' },
  { id: 'u0', line: 7, from: 0, sec: 2, f: '@c{t}{f(t) = u(t)}@h{  the unit step}', cap: 'First, the unit step u(t).' },
  { id: 'u1', line: 7, from: 0.33, sec: 2, f: 'F(s) = ' + DEF + ' @c{t}{u(t)} e^{−st} dt', tag: 'u(t) = 1 for t > 0', cap: 'u(t) = 1 for positive t …' },
  { id: 'u1b', line: 7, from: 0.66, sec: 2, f: 'F(s) = ' + DEF + ' e^{−st} dt', cap: '… so only the exponential is left.' },
  { id: 'u2', line: 8, from: 0, sec: 2, f: 'F(s) = @ev{−@frac{e^{−st}}{s}}{0^{−}}{∞}', cap: 'Integrate, then evaluate between the two limits.' },
  { id: 'u3', line: 9, from: 0, sec: 2, f: '@h{upper limit: }e^{−st} → 0', cap: 'At the upper limit the exponential goes to 0 …' },
  { id: 'u3b', line: 9, from: 0.57, sec: 2, f: '@h{upper limit: }e^{−st} → 0@h{  if }@c{k}{Re s > 0}', cap: '… if Re s > 0.' },
  { id: 'u4', line: 10, from: 0, sec: 2, f: '@h{lower limit: }t = 0^{−}', cap: 'At the lower limit …' },
  { id: 'u4a', line: 10, from: 0.40, sec: 2, f: '@h{lower limit: }e^{−st} = 1', cap: '… the exponential is 1 …' },
  { id: 'u4b', line: 10, from: 0.68, sec: 2, land: 'u', f: 'F(s) = 0 − (−@frac{1}{s})', cap: '… which leaves 1/s.' },
  { id: 'e0', line: 11, from: 0.14, sec: 3, f: '@c{t}{f(t) = e^{−at}}', cap: 'Next, e^{−at}.' },
  { id: 'e1', line: 11, from: 0.48, sec: 3, f: 'F(s) = ' + DEF + ' @c{t}{e^{−at}} e^{−st} dt', cap: 'The two exponents add …' },
  { id: 'e2', line: 11, from: 0.74, sec: 3, f: 'F(s) = ' + DEF + ' e^{−@c{k}{(s+a)}t} dt', cap: '… to s + a.' },
  { id: 'e3', line: 12, from: 0, sec: 3, f: '@ev{−@frac{e^{−(s+a)t}}{s+a}}{0^{−}}{∞}', tag: 'the same steps', cap: 'The same steps …' },
  { id: 'e4', line: 12, from: 0.19, sec: 3, land: 'e', f: '@ev{−@frac{e^{−(s+a)t}}{s+a}}{0^{−}}{∞}', cap: '… give 1/(s + a) …' },
  { id: 'e5', line: 12, from: 0.50, sec: 3, f: '@h{valid if }@c{k}{Re s > −a}', cap: '… if Re s > −a.' },
  { id: 'd0', line: 13, from: 0.09, sec: 4, f: '@c{t}{f(t) = δ(t)}@h{  the impulse}', cap: 'Last, the impulse δ(t).' },
  { id: 'd1', line: 13, from: 0.26, sec: 4, f: 'F(s) = @int{@c{k}{0^{−}}}{∞} @c{t}{δ(t)} e^{−st} dt', tag: '0⁻ keeps δ(t) inside the limits', cap: '0^{−} keeps the impulse inside the limits …' },
  { id: 'd2', line: 13, from: 0.58, sec: 4, f: 'F(s) = e^{−st}@h{  at }t = 0', tag: 'sifting', cap: '… and it sifts out the exponential at t = 0.' },
  { id: 'd3', line: 14, from: 0, sec: 4, f: 'F(s) = e^{0}', cap: 'e^{0} …' },
  { id: 'd4', line: 14, from: 0.26, sec: 4, land: 'd', f: 'F(s) = e^{0}', cap: '… is 1, so the impulse transforms to 1.' },
  { id: 'key', line: 15, from: 0, sec: 5, f: '@h{Three integrals give three pairs}', cap: 'Three integrals give three pairs.' },
  { id: 'key2', line: 15, from: 0.43, sec: 5, f: '@h{From here on: read transforms from the table}', cap: 'From here on, we read transforms from the table.' },
  { id: 'yt', line: 16, from: 0, sec: 5, f: '@h{From here on: read transforms from the table}', cap: 'Your turn — on paper: find the transform of cos ωt. Hint: Euler’s formula.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.key2; // last derivation line (the Your-turn line is not one)
// the three pairs: `first` is the beat that names the function, `at` the beat on which its transform lands
const PAIRS = [
  { k: 'u', label: 'u(t)', value: '1/s', sub: 'unit step', first: IX.u0, at: IX.u4b, cond: 'Re s > 0', sr: 'u of t transforms to 1 over s' },
  { k: 'e', label: 'e^{−at}', value: '1/(s + a)', sub: 'exponential', first: IX.e0, at: IX.e4, cond: 'Re s > −a', sr: 'e to the minus a t transforms to 1 over s plus a' },
  { k: 'd', label: 'δ(t)', value: '1', sub: 'impulse', first: IX.d0, at: IX.d4, cond: '', sr: 'delta of t transforms to 1' },
];
const PAIR = Object.fromEntries(PAIRS.map((p) => [p.k, p]));
// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++)
    if (time >= beatStart(TL, i))
      k = i;
  return k;
}
// finished lines for beat index i: one compact row each, oldest first (focus rule R1).
// A finished section collapses to one row; the definition lives in its own panel.
function doneRows(i) {
  const rows = [], add = (key, t, tag, color, box) => rows.push({ key, t, tag, color, box });
  if (i > IX.ode && i <= IX.ic)
    add('ode', 'RC dv/dt + v = v_{s}', 'the differential equation');
  if (i > IX.xform && i <= IX.ic)
    add('xform', 'RC[sV − v(0^{−})] + V = V_{s}', 'each term transformed');
  if (i > IX.ic)
    add('why', 'RC dv/dt + v = v_{s}  →  V = (V_{s} + RC v(0^{−}))/(RCs + 1)', 'algebra');
  if (i > IX.u1b && i <= IX.u4b)
    add('u1', 'F(s) = ' + DEF + ' e^{−st} dt', 'u(t) = 1 for t > 0');
  if (i > IX.u2 && i <= IX.u4b)
    add('u2', '= [−e^{−st}/s]  from 0^{−} to ∞');
  if (i > IX.u3b && i <= IX.u4b)
    add('u3', 'upper limit: e^{−st} → 0  if Re s > 0');
  if (i > IX.u4a && i <= IX.u4b)
    add('u4', 'lower limit: e^{−st} = 1');
  if (i > IX.e2 && i <= IX.e5)
    add('e2', 'F(s) = ' + DEF + ' e^{−(s+a)t} dt', 'the exponents add');
  if (i > IX.e4 && i <= IX.e5)
    add('e4', '= [−e^{−(s+a)t}/(s+a)]  from 0^{−} to ∞  = 1/(s + a)');
  if (i > IX.d1 && i <= IX.d4)
    add('d1', 'F(s) = ' + DEF + ' δ(t) e^{−st} dt', '0⁻ keeps δ(t) inside');
  if (i > IX.d2 && i <= IX.d4)
    add('d2', '= e^{−st}  at t = 0', 'sifting');
  PAIRS.forEach((p) => { if (i > p.at && (p.k === 'u' ? i > IX.u4b : p.k === 'e' ? i > IX.e5 : i > IX.d4))
    add('p' + p.k, p.label + ' ↔ ' + p.value, p.cond, C_S, true); });
  return rows;
}
/* ═══ 5 PANELS ════════════════════════════════════════════════════════════ */
// LectureRail: the six parts of the lecture; the current one in the accent colour
const CIRCLED6 = ['①', '②', '③', '④', '⑤', '⑥'];
function LectureRail({ lang, ui, bi }) {
  if (bi < IX.ode)
    return null;
  const active = BEATS[bi].sec;
  return h('div', { 'data-gate': 'rail', style: panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 12 }) }, zoneHead(ui.railHead), lang.rail.map((t, i) => {
    const isAct = i === active, col = isAct ? ACCENT : i < active ? INK : UPCOMING;
    return h('div', { key: i, 'data-rail': i, style: { display: 'flex', alignItems: 'flex-start', gap: 8 } }, h('span', { style: { fontFamily: MONO, fontSize: 14, color: col, lineHeight: '19px', width: 15, flexShrink: 0 } }, i < active ? '✓' : CIRCLED6[i]), h('span', { style: { fontFamily: HEAD, fontSize: 13.5, lineHeight: '19px', color: col, fontWeight: isAct ? 600 : 400 } }, h(M, { t: t, size: 13.5 })));
  }));
}
// WorkZone: the finished lines as compact rows and the one focus line with its colour bar (R1, R2)
function WorkZone({ ui, bi }) {
  const time = useTime();
  const TL = useTL();
  if (bi < 0)
    return null;
  const b = BEATS[bi], pair = b.land ? PAIR[b.land] : null;
  return h('div', { 'data-gate': 'work', style: panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H,
      opacity: bi >= 1 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1), display: 'flex', flexDirection: 'column', gap: 7 }) }, zoneHead(ui.workHead, ACCENT), h('div', { 'data-done': '1', style: { display: 'flex', flexDirection: 'column', gap: 3 } }, doneRows(bi).map((r) => h('div', { key: r.key, 'data-done-row': r.key, style: { display: 'flex', alignItems: 'center', gap: 14, minHeight: ROW_H } }, h('span', { style: Object.assign(kMono(SMALL_FS, r.color || MUTE, r.box ? 600 : 400), { whiteSpace: 'nowrap' }, r.box ? { border: `1.5px solid ${r.color}`, borderRadius: 4, padding: '0 8px' } : null) }, h(M, { t: r.t, size: SMALL_FS })), r.tag ? h('span', { style: { fontFamily: HEAD, fontSize: 13.5, color: MUTE, whiteSpace: 'nowrap' } }, h(M, { t: r.tag, size: 13.5 })) : null))), h('div', { 'data-focus': b.id, style: { marginTop: 6, borderLeft: `5px solid ${ACCENT}`, paddingLeft: 14, minHeight: 64,
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 4, fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.4 } }, h('span', { 'data-focus-line': '1' }, h(M, { t: b.f, size: FOCUS_FS })), pair ? h(KValue, { k: pair.k, text: pair.value }) : null, b.tag ? h('span', { 'data-focus-tag': '1', style: { fontFamily: HEAD, fontSize: SMALL_FS, color: MUTE, marginLeft: 16, whiteSpace: 'nowrap' } }, b.tag) : null));
}
// PairSlot: one transform pair; "?" until the voice has given the transform (R4); outlined while it lands with reduced motion (R7)
function PairSlot({ p, bi, landing, reduced }) {
  const got = bi >= p.at;
  return h('div', { 'data-slot': p.k, style: { flex: 1, border: `2px solid ${got ? C_VALUE : LINE}`, borderRadius: 8, padding: '3px 4px', textAlign: 'center',
      background: got ? 'rgba(0,0,0,0.02)' : 'transparent', visibility: bi >= p.first ? 'visible' : 'hidden',
      outline: landing && got && reduced ? `3px solid ${C_VALUE}` : 'none', outlineOffset: 2 } }, h('div', { style: { fontFamily: MONO, fontSize: LABEL_FS, color: C_TIME, fontWeight: 600, lineHeight: '21px' } }, h(M, { t: p.label, size: LABEL_FS })), h('div', { 'data-pair': p.k, style: { fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: got ? INK : MUTE, lineHeight: '24px' } }, got ? p.value : '?'), h('div', { style: { fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.2 } }, p.sub));
}
// Pairs: the three pairs found in this lecture; a slot appears when its function is first named
function Pairs({ ui, bi, reduced }) {
  if (bi < IX.u0)
    return null;
  const land = BEATS[bi].land;
  return h('div', { 'data-gate': 'pairs', style: panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: NUMBERS_H, display: 'flex', flexDirection: 'column', gap: 6 }) }, zoneHead(ui.pairsHead, C_VALUE), h('div', { style: { display: 'flex', gap: 8 } }, PAIRS.map((p) => h(PairSlot, { key: p.k, p: p, bi: bi, landing: land === p.k, reduced: reduced }))));
}
// DefinitionPanel: the definition, built up as each part is spoken; from the key point on, the link to Lecture 2
function DefinitionPanel({ ui, bi }) {
  if (bi <= IX.def)
    return null;
  const top = PANEL_TOP + NUMBERS_H + 10, ht = PANEL_H - NUMBERS_H - 10;
  const line = (key, t, tag) => h('div', { key, 'data-def': key, style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: ROW_H } }, h('span', { style: Object.assign(kMono(SIDE_FS, INK), { whiteSpace: 'nowrap' }) }, h(M, { t: t, size: SIDE_FS })), tag ? h('span', { style: { fontFamily: HEAD, fontSize: 13.5, color: MUTE } }, tag) : null);
  return h('div', { 'data-gate': 'def', style: panel({ left: SIDE_X, top, width: SIDE_W, height: ht, display: 'flex', flexDirection: 'column', gap: 6 }) }, zoneHead(ui.defHead, C_S), line('def', '@c{s}{F(s)} = ' + DEF + ' @c{t}{f(t)} e^{−st} dt'), bi > IX.svar ? line('svar', 's = σ + jω', 'complex') : null, bi > IX.zero ? line('zero', 'lower limit 0^{−}', 'just before t = 0') : null, bi > IX.zero2 ? h('div', { 'data-def': 'zero2', style: { fontFamily: HEAD, fontSize: 14, color: INK, lineHeight: 1.35 } }, 'It captures an impulse at t = 0, and the energy already stored in the circuit.') : null, bi >= IX.key2 ? h('div', { 'data-next': '1', style: { marginTop: 'auto', borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 } }, zoneHead(ui.nextHead), h('a', { href: NEXT.href, style: { fontFamily: HEAD, fontSize: 16, fontWeight: 600, color: ACCENT } }, NEXT.text + ' →')) : null);
}
// BottomBand: one-line-back / one-line-forward with the note, and the colour key
function BottomBand({ ui, bi, goBeat, note, yt }) {
  return h('div', { 'data-gate': 'band', style: panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H, display: 'flex', gap: 16, padding: '8px 16px', alignItems: 'stretch' }) }, h(KNav, { cur: clamp(bi, 0, LAST), total: LAST + 1, goBeat: goBeat, yt: yt, note: note, width: 420 }), h('div', { style: { width: 1, background: LINE } }), h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 } }, smallLabel(ui.legendHead), h('div', { 'data-legend': '1', style: { display: 'flex', flexWrap: 'wrap', columnGap: 22, rowGap: 4 } }, ui.legend.map(([col, text]) => h('span', { key: text, style: { display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: HEAD, fontSize: 14, color: INK, whiteSpace: 'nowrap' } }, h('span', { style: { width: 12, height: 12, borderRadius: 3, background: col, flexShrink: 0 } }), text))), h('div', { 'data-model': '1', style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, ui.model)));
}
// CosYourTurn (kit rule 63): a new problem over the work zone; Show solution reveals the worked steps. No answer boxes.
function CosYourTurn({ shown, onToggle, onClose }) {
  const lab = { fontFamily: HEAD, fontSize: 14, color: MUTE, width: 78, flexShrink: 0 };
  return h('div', { 'data-gate': 'work', 'data-card': 'yourturn', style: panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5,
      border: `2px solid ${ACCENT}`, display: 'flex', flexDirection: 'column', gap: 12 }) }, h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, h('div', { style: { fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT } }, 'YOUR TURN'), h('button', { type: 'button', onClick: onClose, style: btnStyle(false) }, '← back to the lecture')), h('div', { 'data-yt-problem': '1', style: { fontFamily: HEAD, fontSize: 20, color: INK } }, YT.ask, h('span', { style: { fontFamily: MONO, fontWeight: 600, color: C_TIME } }, h(M, { t: YT.fn, size: 20 })), '.'), h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } }, h('div', { style: { fontFamily: HEAD, fontSize: 16, color: INK, flex: 1 } }, h('b', null, 'Work it on paper.'), ' ' + YT.hint), h('button', { type: 'button', onClick: onToggle, 'aria-expanded': shown, style: Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '8px 16px', flexShrink: 0 }) }, shown ? 'Hide solution' : 'Show solution')), shown ? h('div', { 'data-solution': '1', style: { borderTop: `1px solid ${LINE}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 } }, YT.steps.map((s) => h('div', { key: s[0], style: { display: 'flex', alignItems: 'baseline', gap: 10 } }, h('span', { style: lab }, s[0]), h('span', { style: kMono(SMALL_FS, INK) }, h(M, { t: s[1], size: SMALL_FS })))), h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 } }, h('span', { style: lab }, 'answer'), h('span', { 'data-yt-answer': '1', style: Object.assign(kMono(20, C_S, 600), { border: `1.5px solid ${C_S}`, borderRadius: 4, padding: '2px 10px' }) }, h(M, { t: YT.answer, size: 20 })))) : null);
}
/* ═══ 6 SCENE ═════════════════════════════════════════════════════════════ */
// Scene: builds the schedule from the measured clip durations and mounts the stage
function Scene() {
  const { urls, durs } = useClips(LANG.clips);
  const sched = useMemo(() => buildSchedule(LANG, durs), [durs]);
  const TL = useMemo(() => makeTL(sched), [sched]);
  const narration = useMemo(() => LANG.clips.map((clip, i) => ({ clip, at: sched.starts[i], dur: sched.durs[i] })), [sched]);
  return h(Stage, { duration: sched.total }, h(TLCtx.Provider, { value: TL }, h(SceneBody, { lang: LANG, ui: LANG.ui, sched: sched, narration: narration, urls: urls })));
}
// SceneBody: which beat is on screen — from the playhead, or chosen by hand with ◀ ▶
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1); // beat chosen by hand; -1 while the tour drives
  useEffect(() => { if (playing)
    setHand(-1); }, [playing]);
  useEffect(() => { setHand(-1); }, [time]); // a seek hands the screen back to the playhead
  const tourBi = beatAt(TL, Math.min(time, TL.REVERT));
  const shown = hand >= 0 ? hand : tourBi;
  const b = BEATS[Math.max(0, shown)];
  const goBeat = (i) => { yt.close(); if (playing)
    setPlaying(false); setHand(i); };
  const note = hand >= 0 ? ui.noteStep : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  const landing = shown >= 0 && b.land && !yt.open ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
  const found = PAIRS.filter((p) => shown >= p.at).map((p) => p.sr);
  return h(React.Fragment, null, h(TitleCard, { ui: ui }), h(Header, { head: ui.header, sub: ui.headerSub, keyPoint: ui.keyPoint }), h(LectureRail, { lang: lang, ui: ui, bi: shown }), h(WorkZone, { ui: ui, bi: shown }), yt.open ? h(CosYourTurn, { shown: yt.shown, onToggle: yt.toggle, onClose: yt.close }) : null, h(Pairs, { ui: ui, bi: shown, reduced: reduced }), h(DefinitionPanel, { ui: ui, bi: shown }), landing && !reduced ? h(Landing, { fromSel: '[data-landing-from="' + landing + '"]', toSel: '[data-slot="' + landing + '"]', progress: landProg, viaX: GUTTER_X, viaY: PANEL_TOP + NUMBERS_H + GUTTER_Y }) : null, h(BottomBand, { ui: ui, bi: shown, goBeat: goBeat, note: note, yt: yt }), h(Captions, { sched: sched, text: shown >= 0 ? h(M, { t: b.cap, size: CAP_FS }) : '' }), h(FinishStrip, { ui: ui }), h(ProgressBar, null), h(Stamp, null), h(Narrator, { lines: narration, urls: urls }), h(SoundToggle, null), h(ReplayPill, null), h(OpeningCard, { card: lang.card }), h(SrSummary, { text: ui.srSummary + (shown >= 0 ? plain(b.cap) + ' ' : '') + (found.length ? 'Pairs so far: ' + found.join('; ') + '. ' : '') +
      (yt.open ? 'Your turn: find the Laplace transform of cosine omega t. Hint: Euler’s formula.' + (yt.shown ? ' Solution: ' + YT.sr + '.' : '') : '') }));
}
/* ═══ MOUNT ═══ */
ReactDOM.createRoot(document.getElementById('root')).render(h(Scene, null));
