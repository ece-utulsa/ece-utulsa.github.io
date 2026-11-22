/* ═══ SCENE — Factoring the Denominator (SD-2a) ═══════════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  MODEL                 D(s) = s² + bs + c (monic); Δ = b² − 4c decides the pole type
     3  YOUR TURN             three quadratics to classify and factor, spec v1.1.0 key
     4  LANGUAGE PACK         narration text, UI strings
     5  BEATS                 one line of math at a time (focus rules R1–R7)
     6  PANELS                DsDisplay, WorkZone, Numbers, RoutePanel, BottomBand, cards
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5;     // s: pause after each clip before the next line replaces it (focus rule R6)
const B_MIN = -8, B_MAX = 12, C_MIN = -12, C_MAX = 40, QUAD_STEP = 0.5;   // Explore slider ranges
const DISC_EPS = 1e-6;     // |Δ| below this counts as a repeated root
const NUMBERS_H = 112;     // px: height of the numbers panel
const AXIS_MIN = -8, AXIS_MAX = 2, AXIS_PAD = 1.5;   // real-axis window, widened to hold the roots
const C_SIMPLE = BLUE;     // Δ > 0: simple poles (overdamped)
const C_REPEAT = PURPLE;   // Δ = 0: repeated pole (critically damped)
const C_CPLX = CORAL;      // Δ < 0: complex pair (underdamped)
const C_FORM = TEAL;       // the factored form
const C_ROOT = AMBER;      // Δ, poles, α, β
const KCOL = { simple: C_SIMPLE, rep: C_REPEAT, cplx: C_CPLX };
const MINUS = '−';

/* ═══ 2 MODEL ═════════════════════════════════════════════════════════════ */
// classify and factor s² + bs + c: Δ = b² − 4c; real roots, a repeated root, or (s+α)² + β²
function solve(b, c) {
  const D = b * b - 4 * c;
  const kind = Math.abs(D) < DISC_EPS ? 'rep' : D > 0 ? 'simple' : 'cplx';
  const out = { b, c, D, kind };
  if (kind === 'simple') { const r = Math.sqrt(D); out.r1 = (-b + r) / 2; out.r2 = (-b - r) / 2; }   // nearest the origin first
  else if (kind === 'rep') { out.r1 = -b / 2; out.r2 = -b / 2; }
  else { out.alpha = b / 2; out.beta = Math.sqrt(-D) / 2; }
  return out;
}
// number to 2 decimals (integers shown whole), with a true minus sign
const nabs = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(Math.abs(v))) : (Math.round(Math.abs(v) * 100) / 100).toFixed(2));
const nv = (v) => (v < -0.005 ? MINUS : '') + nabs(v);
const sgn = (v) => (v >= 0 ? '+' : MINUS);
// (s + k) for a root at −k; never "(s + −2)"
const factorOf = (root) => (Math.abs(root) < 0.005 ? 's' : root < 0 ? '(s + ' + nabs(root) + ')' : '(s ' + MINUS + ' ' + nabs(root) + ')');
const quadStr = (m) => 's² ' + sgn(m.b) + ' ' + nabs(m.b) + 's ' + sgn(m.c) + ' ' + nabs(m.c);
const formOf = (s) => (s.kind === 'simple' ? factorOf(s.r1) + factorOf(s.r2) : s.kind === 'rep' ? factorOf(s.r1) + '²'
  : factorOf(-s.alpha) + '² + ' + nv(s.beta * s.beta));
const discSteps = (m) => (m.b < 0 ? '(' + nv(m.b) + ')' : nv(m.b)) + '\u00b2 ' + MINUS + ' 4(' + nv(m.c) + ')';
// the three worked examples of the tour
const EXAMPLES = [null, solve(5, 6), solve(4, 4), solve(4, 13)];

/* ═══ 3 YOUR TURN ═════════════════════════════════════════════════════════ */
// (a) s²+7s+12: Δ = 1 → (s+3)(s+4); (b) s²+6s+9: Δ = 0 → (s+3)²; (c) s²+6s+25: Δ = −64 → (s+3)² + 16, α = 3, β = 4
const YT = [
  { tag: '(a)', quad: 's² + 7s + 12', disc: 'Δ = 49 − 48 = 1 > 0', result: '(s+3)(s+4), poles −3, −4', color: C_SIMPLE },
  { tag: '(b)', quad: 's² + 6s + 9', disc: 'Δ = 36 − 36 = 0', result: '(s+3)², repeated pole −3', color: C_REPEAT },
  { tag: '(c)', quad: 's² + 6s + 25', disc: 'Δ = 36 − 100 = −64 < 0', result: '(s+3)² + 16, α = 3, β = 4', color: C_CPLX },
];

/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 11 }, (_, i) => 'sd2a_line' + (i + 1) + '.mp3'),
  durs: [7.536, 9.84, 9.816, 11.472, 7.632, 9.456, 10.176, 12.552, 10.392, 8.4, 9.6],
  text: [
    'Before you can invert F-of-s, you have to factor the denominator — and the kind of factors you get decides everything that follows.',
    'The roots of the denominator are the poles. For a quadratic, one number — the discriminant, b squared minus 4 a c — tells you which kind you have.',
    'If the discriminant is positive, there are two real roots. You factor into two first-order terms — two simple poles — and you’re headed for exponentials.',
    'Take s-squared plus 5s plus 6. The discriminant is 1 — positive — so it factors as s-plus-2 times s-plus-3: simple poles at minus 2 and minus 3.',
    'If the discriminant is exactly zero, the two roots merge into one repeated root — a squared factor, a repeated pole.',
    'Take s-squared plus 4s plus 4. The discriminant is zero, so it’s s-plus-2, squared: a repeated pole at minus 2.',
    'If the discriminant is negative, there are no real roots at all. Don’t force complex factors — that negative discriminant is your signal to complete the square instead.',
    'Take s-squared plus 4s plus 13. The discriminant is minus 36 — negative — so complete the square: s-plus-2 squared plus 9. Alpha is 2, beta is 3.',
    'So the discriminant is the fork in the road: positive sends you to simple poles, zero to a repeated pole, negative to completing the square — and that picks your inverse method.',
    'And it rhymes with the circuit: real roots are the overdamped case, a repeated root is critical, and complex roots are the underdamped ringing.',
    'Your turn. On paper, find the discriminant of each quadratic, then factor it or complete the square. Press Show solution to check.',
  ],
  rail: ['Δ decides', 'Δ > 0: simple', 'simple example', 'Δ = 0: repeated', 'repeated example', 'Δ < 0: complex', 'complex example', 'the fork', 'RLC rhyme'],
  card: {
    series: 'ECE 2003 · Inverse Laplace · before you start',
    title: 'Factoring the Denominator',
    sentence: 'You’ll see how one number, the discriminant, decides how a quadratic denominator factors.',
    steps: [
      'Compute Δ = b² − 4ac.',
      'Δ > 0: two simple poles · Δ = 0: a repeated pole · Δ < 0: complete the square.',
      'That choice picks your inverse method.',
    ],
    able: 'Classify and factor any quadratic denominator. Then try three yourself.',
  },
  ui: {
    kicker: 'LAPLACE · BEFORE YOU START',
    title: 'Factoring the denominator',
    sub: 'Δ = b² − 4ac · the pole-type fork',
    header: 'Factoring the Denominator',
    headerSub: '· the pole-type fork',
    keyPoint: 'Δ = b² − 4ac decides: Δ > 0 simple poles · Δ = 0 repeated · Δ < 0 complete the square',
    railHead: 'THE ARGUMENT',
    workHead: 'THE WORK',
    numbersHead: 'THE NUMBERS',
    axisHead: 'ROOTS ON THE REAL AXIS',
    routeHead: 'WHERE IT ROUTES',
    rhymeHead: 'RHYMES WITH THE CIRCUIT',
    quadHead: 'EXPLORE THE QUADRATIC',
    tourTag: 'TOUR', exploreTag: 'EXPLORE',
    reset: 'reset',
    routes: [
      { kind: 'simple', head: 'Δ > 0', text: 'Inverse Laplace · Simple Poles', href: 'Inverse_Laplace_Simple_Poles_v1.2.0.html', rhyme: 'overdamped' },
      { kind: 'rep', head: 'Δ = 0', text: 'Inverse Laplace · Repeated Poles', href: 'Inverse_Laplace_Repeated_Poles_v1.2.0.html', rhyme: 'critically damped' },
      { kind: 'cplx', head: 'Δ < 0', text: 'Inverse Laplace · Complex Poles', href: 'Inverse_Laplace_Complex_Poles_v1.2.0.html', rhyme: 'underdamped' },
    ],
    notes: [
      'the factors decide the method — so factor first',
      'one number carries the whole decision',
      'two real roots → two first-order terms',
      'a clean split into simple poles',
      'the boundary case — the roots merge',
      'one squared factor, one pole counted twice',
      'a negative Δ is a signal, not a failure',
      'complete the square — don’t force complex factors',
      'positive, zero, negative — three routes, one number',
      'the same three cases you met in the RLC',
      'work the three on paper, then show the solution',
    ],
    noteExplore: 'move b and c, or pick a quadratic — watch Δ change sign',
    noteStep: 'step with ◀ ▶, or move b and c to explore',
    endTitle: 'Factoring ✓', endSub: 'try the Your-turn problems · or explore the quadratic',
    srSummary: 'Factoring the denominator. ',
  },
};

/* ═══ 5 BEATS — one line of math at a time (focus rules R1–R7) ═══════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based), `from` the fraction of
// that clip at which the beat starts (estimated from the script; the clips are not shortened or moved).
//   ex     worked example on screen: 0 none, 1 s²+5s+6, 2 s²+4s+4, 3 s²+4s+13
//   kind   case colour of the focus bar: '' | 'simple' | 'rep' | 'cplx'
//   land   slot that lands on this beat ('Δ', 'p₁', 'p₂', 'p', 'α', 'β') or ''
//   axis   the real-axis marker for the example is shown;  route / rhyme: those panels are shown
const BEATS = [
  { id: 'intro', line: 1, from: 0.27, ex: 0, kind: '', cap: 'Before inverting F(s), factor the denominator.' },
  { id: 'roots', line: 2, from: 0, ex: 0, kind: '', cap: 'The roots of D(s) are the poles.' },
  { id: 'disc', line: 2, from: 0.4, ex: 0, kind: '', cap: 'For a quadratic, the discriminant Δ = b² − 4ac decides the type.' },
  { id: 'rule+', line: 3, from: 0, ex: 0, kind: 'simple', cap: 'Δ > 0 → two real roots → two simple poles' },
  { id: 'ex1', line: 4, from: 0, ex: 1, kind: 'simple', cap: 'Take s² + 5s + 6' },
  { id: 'd1a', line: 4, from: 0.19, ex: 1, kind: 'simple', cap: 'the discriminant: b² − 4ac' },
  { id: 'd1b', line: 4, from: 0.25, ex: 1, kind: 'simple', cap: 'put in b = 5, c = 6' },
  { id: 'd1c', line: 4, from: 0.31, ex: 1, kind: 'simple', land: 'Δ', cap: 'Δ = 1 — positive' },
  { id: 'f1', line: 4, from: 0.5, ex: 1, kind: 'simple', cap: 'so it factors as (s+2)(s+3)' },
  { id: 'p1a', line: 4, from: 0.76, ex: 1, kind: 'simple', land: 'p₁', axis: true, cap: 'a simple pole at −2' },
  { id: 'p1b', line: 4, from: 0.89, ex: 1, kind: 'simple', land: 'p₂', axis: true, cap: 'and a simple pole at −3' },
  { id: 'rule0', line: 5, from: 0, ex: 1, kind: 'rep', axis: true, cap: 'Δ = 0 → the two roots merge → one repeated pole' },
  { id: 'ex2', line: 6, from: 0, ex: 2, kind: 'rep', cap: 'Take s² + 4s + 4' },
  { id: 'd2a', line: 6, from: 0.26, ex: 2, kind: 'rep', cap: 'the discriminant: 4² − 4(4)' },
  { id: 'd2b', line: 6, from: 0.4, ex: 2, kind: 'rep', land: 'Δ', cap: 'Δ = 0' },
  { id: 'f2', line: 6, from: 0.52, ex: 2, kind: 'rep', cap: 'so it is (s+2), squared' },
  { id: 'p2', line: 6, from: 0.76, ex: 2, kind: 'rep', land: 'p', axis: true, cap: 'a repeated pole at −2' },
  { id: 'rule-', line: 7, from: 0, ex: 2, kind: 'cplx', axis: true, cap: 'Δ < 0 → no real roots → complete the square' },
  { id: 'ex3', line: 8, from: 0, ex: 3, kind: 'cplx', cap: 'Take s² + 4s + 13' },
  { id: 'd3a', line: 8, from: 0.16, ex: 3, kind: 'cplx', cap: 'the discriminant: 4² − 4(13)' },
  { id: 'd3b', line: 8, from: 0.24, ex: 3, kind: 'cplx', land: 'Δ', cap: 'Δ = −36 — negative' },
  { id: 'sq1', line: 8, from: 0.42, ex: 3, kind: 'cplx', cap: 'complete the square: add and subtract (b/2)²' },
  { id: 'sq2', line: 8, from: 0.55, ex: 3, kind: 'cplx', cap: 'the perfect square (s+2)²' },
  { id: 'sq3', line: 8, from: 0.66, ex: 3, kind: 'cplx', cap: '(s+2)² + 9' },
  { id: 'al', line: 8, from: 0.8, ex: 3, kind: 'cplx', land: 'α', cap: 'α = 2' },
  { id: 'be', line: 8, from: 0.91, ex: 3, kind: 'cplx', land: 'β', cap: 'β = 3' },
  { id: 'fork', line: 9, from: 0, ex: 3, kind: '', cap: 'The fork: Δ > 0 simple · Δ = 0 repeated · Δ < 0 complete the square' },
  { id: 'route', line: 9, from: 0.74, ex: 3, kind: '', route: true, cap: '… and that picks your inverse method' },
  { id: 'rhyme', line: 10, from: 0, ex: 3, kind: '', route: true, rhyme: true, cap: 'real roots ↔ overdamped · repeated ↔ critical · complex ↔ underdamped' },
  { id: 'yt', line: 11, from: 0, ex: 3, kind: '', route: true, rhyme: true, cap: 'Your turn — on paper: classify and factor the three quadratics, then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.rhyme;                              // last derivation line (the Your-turn line is not one)
const EX_END = [0, IX.p1b, IX.p2, IX.be];           // last beat of each worked example
// slots of the numbers panel for each example, with the beat at which each lands
const SLOTS = [
  [{ k: 'Δ', sub: 'discriminant', at: Infinity }],
  [{ k: 'Δ', sub: 'discriminant', at: IX.d1c }, { k: 'p₁', sub: 'pole', at: IX.p1a }, { k: 'p₂', sub: 'pole', at: IX.p1b }],
  [{ k: 'Δ', sub: 'discriminant', at: IX.d2b }, { k: 'p', sub: 'pole', at: IX.p2 }],
  [{ k: 'Δ', sub: 'discriminant', at: IX.d3b }, { k: 'α', sub: 'decay', at: IX.al }, { k: 'β', sub: 'ring', at: IX.be }],
];
// value shown in slot k for solution s
const slotVal = (s, k) => ({ 'Δ': nv(s.D), 'p₁': nv(s.r1), 'p₂': nv(s.r2), p: nv(s.r1), 'α': nv(s.alpha), 'β': nv(s.beta) }[k]);

// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}

/* ═══ 6 PANELS ════════════════════════════════════════════════════════════ */
// D(s) for the quadratic on screen; "monic: a = 1" is shown where Δ is computed
function DsDisplay({ m, showMonic }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minHeight: 28 }}>
      <span style={kMono(SMALL_FS, MUTE)}>D(s) =</span>
      <span data-ds="1" style={kMono(SMALL_FS, C_FORM, 600)}>{m ? quadStr(m) : 'a s² + b s + c'}</span>
      {showMonic ? <span data-monic="1" style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE }}>monic: a = 1</span> : null}
    </div>
  );
}

// focus content for beat b: the one line the voice is speaking
function focusOf(b) {
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  const s = EXAMPLES[b.ex], col = KCOL[b.kind];
  const D = (k) => <KUnk k={k || 'Δ'} color={C_ROOT} />;
  switch (b.id) {
    case 'intro': return prose('Before inverting F(s): factor the denominator');
    case 'roots': return prose('the roots of D(s) are the poles');
    case 'disc': return <span>{D()}{' = b² − 4ac'}</span>;
    case 'rule+': return <span style={{ color: col }}>{'Δ > 0 → two real roots → two simple poles'}</span>;
    case 'rule0': return <span style={{ color: col }}>{'Δ = 0 → roots merge → one repeated pole'}</span>;
    case 'rule-': return <span style={{ color: col }}>{'Δ < 0 → no real roots → complete the square'}</span>;
    case 'ex1': case 'ex2': case 'ex3': return <span>{'D(s) = ' + quadStr(s)}</span>;
    case 'd1a': return <span>{D()}{' = b² − 4ac'}</span>;
    case 'd1b': case 'd2a': case 'd3a': return <span>{D()}{' = ' + discSteps(s)}</span>;
    case 'd1c': case 'd2b': case 'd3b': return <span>{D()}{' = ' + discSteps(s)}<KValue k={'Δ'} text={nv(s.D)} /></span>;
    case 'f1': case 'f2': return <span>{quadStr(s) + ' = '}<span style={{ color: C_FORM, fontWeight: 600 }}>{formOf(s)}</span></span>;
    case 'p1a': return <span>{'simple pole'}<KValue k={'p₁'} text={nv(s.r1)} /></span>;
    case 'p1b': return <span>{'simple pole'}<KValue k={'p₂'} text={nv(s.r2)} /></span>;
    case 'p2': return <span>{'repeated pole'}<KValue k="p" text={nv(s.r1)} /></span>;
    case 'sq1': return <span>{'(s² + 4s '}<span style={{ color: col, fontWeight: 600 }}>{'+ 4'}</span>{') '}<span style={{ color: col, fontWeight: 600 }}>{'− 4'}</span>{' + 13'}</span>;
    case 'sq2': return <span><span style={{ color: C_FORM, fontWeight: 600 }}>{'(s + 2)²'}</span>{' − 4 + 13'}</span>;
    case 'sq3': return <span style={{ color: C_FORM, fontWeight: 600 }}>{'(s + 2)² + 9'}</span>;
    case 'al': return <span><KUnk k={'α'} color={C_ROOT} />{' = b/2'}<KValue k={'α'} text={nv(s.alpha)} /></span>;
    case 'be': return <span><KUnk k={'β'} color={C_ROOT} />{' = √9'}<KValue k={'β'} text={nv(s.beta)} /></span>;
    case 'fork': return <span style={{ fontFamily: HEAD }}><span style={{ color: C_SIMPLE }}>{'Δ > 0 simple'}</span>{' · '}<span style={{ color: C_REPEAT }}>{'Δ = 0 repeated'}</span>{' · '}<span style={{ color: C_CPLX }}>{'Δ < 0 square'}</span></span>;
    case 'route': return prose('Δ picks your inverse method →');
    default: return prose('overdamped · critical · underdamped');
  }
}

// finished lines for beat index i: one compact row each, oldest first (focus rule R1)
function doneRows(i) {
  const rows = [], add = (key, node, color) => rows.push({ key, node, color });
  const ex = (n) => 'e.g. ' + quadStr(EXAMPLES[n]) + ': Δ = ' + nv(EXAMPLES[n].D) + ' → ' + formOf(EXAMPLES[n]);
  if (i > IX.roots) add('roots', <span>{'roots of D(s) = the poles'}</span>);
  if (i > IX.disc) add('disc', <span>{'Δ = b² − 4ac'}</span>);
  if (i > IX['rule+']) add('r+', <span>{'Δ > 0 → two real roots → two simple poles'}</span>, C_SIMPLE);
  if (i > IX.d1c && i <= IX.p1b) add('d1', <span>{'Δ = ' + discSteps(EXAMPLES[1]) + ' = 1'}</span>);
  if (i > IX.f1 && i <= IX.p1b) add('f1', <span>{quadStr(EXAMPLES[1]) + ' = ' + formOf(EXAMPLES[1])}</span>);
  if (i > IX.p1b) add('e1', <span>{ex(1) + ', poles −2, −3'}</span>, C_SIMPLE);
  if (i > IX.rule0) add('r0', <span>{'Δ = 0 → roots merge → one repeated pole'}</span>, C_REPEAT);
  if (i > IX.d2b && i <= IX.p2) add('d2', <span>{'Δ = ' + discSteps(EXAMPLES[2]) + ' = 0'}</span>);
  if (i > IX.f2 && i <= IX.p2) add('f2', <span>{quadStr(EXAMPLES[2]) + ' = ' + formOf(EXAMPLES[2])}</span>);
  if (i > IX.p2) add('e2', <span>{ex(2) + ', repeated pole −2'}</span>, C_REPEAT);
  if (i > IX['rule-']) add('r-', <span>{'Δ < 0 → no real roots → complete the square'}</span>, C_CPLX);
  if (i > IX.d3b && i <= IX.be) add('d3', <span>{'Δ = ' + discSteps(EXAMPLES[3]) + ' = −36'}</span>);
  if (i > IX.sq1 && i <= IX.be) add('s1', <span>{'= (s² + 4s + 4) − 4 + 13 add and subtract (b/2)²'}</span>);
  if (i > IX.sq2 && i <= IX.be) add('s2', <span>{'= (s + 2)² − 4 + 13 the perfect square'}</span>);
  if (i > IX.sq3 && i <= IX.be) add('s3', <span>{'= (s + 2)² + 9'}</span>, C_FORM);
  if (i > IX.be) add('e3', <span>{ex(3) + ', α = 2, β = 3'}</span>, C_CPLX);
  return rows;
}

// finished lines for a quadratic set by hand (Explore): the same derivation for the live numbers
function liveRows(s) {
  const rows = [], add = (key, node, color) => rows.push({ key, node, color, wrap: true });
  add('disc', <span>{'Δ = b² − 4ac = ' + discSteps(s) + ' = ' + nv(s.D)}</span>);
  add('kind', <span>{s.kind === 'simple' ? 'Δ > 0 → two real roots → two simple poles' : s.kind === 'rep' ? 'Δ = 0 → roots merge → one repeated pole' : 'Δ < 0 → no real roots → complete the square'}</span>, KCOL[s.kind]);
  if (s.kind === 'cplx') {
    const a2 = nv(s.alpha * s.alpha);
    add('s1', <span>{'= (s² ' + sgn(s.b) + ' ' + nabs(s.b) + 's + ' + a2 + ') − ' + a2 + ' ' + sgn(s.c) + ' ' + nabs(s.c) + ' add and subtract (b/2)²'}</span>);
    add('ab', <span>{'α = b/2 = ' + nv(s.alpha) + ', β = √' + nv(s.beta * s.beta) + ' = ' + nv(s.beta)}</span>);
  } else {
    add('roots', <span>{'roots: s = (−b ± √Δ)/2 = ' + nv(s.r1) + (s.kind === 'rep' ? ' (twice)' : ', ' + nv(s.r2))}</span>);
  }
  return rows;
}

// WorkZone: D(s), the finished lines, and the one focus line. `live` is a quadratic set by hand (Explore).
function WorkZone({ ui, bi, live }) {
  const time = useTime(); const TL = useTL();
  if (bi < 0) return null;
  if (live) {
    return (
      <KWork head={ui.workHead} badge={ui.exploreTag} badgeColor={ACCENT} fs={<DsDisplay m={live} showMonic />}
        rows={liveRows(live)} focusId="live" bar={KCOL[live.kind]} opacity={1}>
        <span>{quadStr(live) + ' = '}<span style={{ color: C_FORM, fontWeight: 600 }}>{formOf(live)}</span></span>
      </KWork>
    );
  }
  const b = BEATS[bi];
  return (
    <KWork head={ui.workHead} badge="" badgeColor={ACCENT} fs={<DsDisplay m={EXAMPLES[b.ex]} showMonic={bi >= IX.disc} />}
      rows={doneRows(bi)} focusId={b.id} bar={b.kind ? KCOL[b.kind] : ACCENT} opacity={bi >= 1 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1)}>
      {focusOf(b)}
    </KWork>
  );
}

// Numbers: Δ and the poles (or α, β) of the example; a slot reads "?" until the voice has said its value (R4)
function Numbers({ ui, bi, live, reduced }) {
  if (bi < IX.disc && !live) return null;
  const b = BEATS[Math.max(0, bi)];
  const s = live || EXAMPLES[b.ex];
  const slots = live ? SLOTS[live.kind === 'simple' ? 1 : live.kind === 'rep' ? 2 : 3] : SLOTS[b.ex];
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: NUMBERS_H,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      {zoneHead(ui.numbersHead, C_ROOT)}
      <div style={{ display: 'flex', gap: 8 }}>
        {slots.map((sl) => <KSlot key={sl.k} k={sl.k} value={s ? slotVal(s, sl.k) : ''} sub={sl.sub} got={!!live || bi >= sl.at}
          landing={!live && b.land === sl.k} reduced={reduced} tint={C_ROOT} />)}
      </div>
    </div>
  );
}

// real axis with the first `count` roots marked (a repeated root gets a double marker); never a complex plane
function RealAxis({ s, width, count }) {
  const H = 58, yAx = 30;
  const lo = Math.min(AXIS_MIN, Math.min(s.r1, s.r2) - AXIS_PAD), hi = Math.max(AXIS_MAX, Math.max(s.r1, s.r2) + AXIS_PAD);
  const X = (v) => 14 + ((v - lo) / (hi - lo)) * (width - 28);
  const span = hi - lo, step = span > 30 ? 10 : span > 14 ? 4 : 2;
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const rep = s.kind === 'rep';
  return (
    <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" data-axis="1"
      aria-label={'Real axis with ' + (rep ? 'a repeated root at ' + nv(s.r1) : 'roots at ' + nv(s.r1) + ' and ' + nv(s.r2))} style={{ display: 'block', flexShrink: 0 }}>
      <line x1="8" y1={yAx} x2={width - 8} y2={yAx} stroke={MUTE} strokeWidth="1.2" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={X(v)} y1={yAx - 4} x2={X(v)} y2={yAx + 4} stroke={MUTE} strokeWidth="1" />
          <text x={X(v)} y={yAx + 20} textAnchor="middle" fontFamily={MONO} fontSize={FS_MIN} fill={MUTE}>{nv(v)}</text>
        </g>
      ))}
      {(rep ? [s.r1] : [s.r1, s.r2]).slice(0, count || 2).map((r, i) => (
        <g key={i} data-root={nv(r)}>
          {rep ? <circle cx={X(r)} cy={yAx} r="10" fill="none" stroke={C_ROOT} strokeWidth="2" /> : null}
          <circle cx={X(r)} cy={yAx} r="5.5" fill={C_ROOT} />
          <text x={X(r)} y={yAx - 14} textAnchor="middle" fontFamily={MONO} fontSize={FS_MIN} fontWeight="600" fill={C_ROOT}>{nv(r) + (rep ? ' ×2' : '')}</text>
        </g>
      ))}
    </svg>
  );
}

// RoutePanel: the roots on the real axis, where each case routes (links to the next pages), and the circuit rhyme.
// Each part stays hidden until its line (no faint previews); in Explore the live case is marked.
function RoutePanel({ ui, bi, live }) {
  if (bi < IX.disc && !live) return null;
  const b = BEATS[Math.max(0, bi)];
  const s = live || EXAMPLES[b.ex];
  const showAxis = live ? live.kind !== 'cplx' : !!b.axis;
  const showRoute = !!live || !!b.route, showRhyme = !!live || !!b.rhyme;
  const top = PANEL_TOP + NUMBERS_H + 10, h = PANEL_H - NUMBERS_H - 10;
  return (
    <div data-gate="ft" style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, display: 'flex', flexDirection: 'column', gap: 6 })}>
      {showAxis || live ? zoneHead(ui.axisHead, C_ROOT) : <div style={{ height: 17 }} />}
      <div style={{ minHeight: 58 }}>
        {showAxis && s ? <RealAxis s={s} width={SIDE_W - 26} count={!live && b.id === 'p1a' ? 1 : 2} />
          : live && live.kind === 'cplx' ? <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: C_CPLX, paddingTop: 16 }}>no real roots: nothing to mark on the real axis</div> : null}
      </div>
      <div style={{ borderTop: `1px solid ${showRoute ? LINE : 'transparent'}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 100 }}>
        {showRoute ? zoneHead(ui.routeHead) : null}
        {showRoute ? ui.routes.map((r) => {
          const on = live && live.kind === r.kind;
          return (
            <div key={r.kind} data-route={r.kind} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '1px 6px', borderRadius: 5,
              border: `1.5px solid ${on ? KCOL[r.kind] : 'transparent'}` }}>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: KCOL[r.kind], width: 52, flexShrink: 0 }}>{r.head}</span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: MUTE }}>{'→'}</span>
              <a href={r.href} style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: KCOL[r.kind] }}>{r.text}</a>
            </div>
          );
        }) : null}
      </div>
      <div style={{ borderTop: `1px solid ${showRhyme ? LINE : 'transparent'}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showRhyme ? zoneHead(ui.rhymeHead) : null}
        {showRhyme ? (
          <div data-rhyme="1" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {ui.routes.map((r) => (
              <span key={r.kind} style={{ fontFamily: MONO, fontSize: FS_MIN, color: KCOL[r.kind], fontWeight: live && live.kind === r.kind ? 600 : 400,
                textDecoration: live && live.kind === r.kind ? 'underline' : 'none' }}>{r.rhyme}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// skeleton rail: the nine steps of the argument (narration lines 2–10)
const CIRCLED9 = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
function ArgRail({ lang, ui, bi }) {
  if (bi < IX.roots) return null;
  const active = BEATS[bi].line - 2;
  return (
    <div data-gate="rail" style={panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 9 })}>
      {zoneHead(ui.railHead)}
      {lang.rail.map((t, i) => {
        const isAct = i === active, isOn = i < active || (i === active);
        const col = isAct ? ACCENT : i < active ? INK : UPCOMING;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 }}>{isOn && !isAct ? '✓' : CIRCLED9[i]}</span>
            <span style={{ fontFamily: HEAD, fontSize: 13.5, lineHeight: '18px', color: col, fontWeight: isAct ? 600 : 400 }}>{t}</span>
          </div>
        );
      })}
    </div>
  );
}

// Slider: one labelled range input for a quadratic coefficient
function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: INK, width: 12, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={'quadratic coefficient ' + label}
        style={{ flex: 1, minWidth: 0, accentColor: ACCENT, cursor: 'pointer', margin: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: INK, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{nv(value)}</span>
    </div>
  );
}

const PRESETS = [[5, 6], [3, 2], [4, 4], [2, 5], [4, 13]];   // example quadratics offered in Explore: [b, c]

// BottomBand: the live quadratic (Explore), one-line-back / one-line-forward, and — only in Explore — the live readout
function BottomBand({ ui, bi, quad, live, setQuad, goBeat, explore, note, yt, readout }) {
  const stat = (label, val, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.2 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 600, color, lineHeight: 1.3 }}>{val}</span>
    </div>
  );
  const s = live || solve(quad.b, quad.c);
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 16, padding: '8px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 430, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {zoneHead(ui.quadHead)}
          <span data-quad="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_FORM, whiteSpace: 'nowrap' }}>{quadStr(quad)}</span>
          <KMode explore={explore} ui={ui} />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Slider label="b" value={quad.b} min={B_MIN} max={B_MAX} step={QUAD_STEP} onChange={(v) => setQuad({ b: v, c: quad.c })} />
          <Slider label="c" value={quad.c} min={C_MIN} max={C_MAX} step={QUAD_STEP} onChange={(v) => setQuad({ b: quad.b, c: v })} />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {PRESETS.map(([pb, pc]) => (
            <button key={pb + ',' + pc} type="button" aria-pressed={!!live && quad.b === pb && quad.c === pc} onClick={() => setQuad({ b: pb, c: pc })}
              style={Object.assign(btnStyle(!!live && quad.b === pb && quad.c === pc), { padding: '2px 6px', whiteSpace: 'nowrap' })}>{'s²+' + pb + 's+' + pc}</button>
          ))}
        </div>
      </div>
      <div style={{ width: 1, background: LINE }} />
      <KNav cur={clamp(bi, 0, LAST)} total={LAST + 1} goBeat={goBeat} yt={yt} note={note} width={290} />
      <div style={{ width: 1, background: LINE }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        {smallLabel('LIVE MODEL')}
        {readout ? (
          <div data-readout="1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', columnGap: 22, rowGap: 2 }}>
            {stat('Δ', nv(s.D), KCOL[s.kind])}
            {stat('pole type', s.kind === 'simple' ? 'simple × 2' : s.kind === 'rep' ? 'repeated' : 'complex pair', KCOL[s.kind])}
            {stat('RLC', ui.routes.find((r) => r.kind === s.kind).rhyme, KCOL[s.kind])}
            {stat(s.kind === 'cplx' ? 'α, β' : 'roots', s.kind === 'cplx' ? nv(s.alpha) + ', ' + nv(s.beta) : nv(s.r1) + ', ' + nv(s.r2), C_ROOT)}
            {stat('form', formOf(s), C_FORM)}
          </div>
        ) : <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE }}>shown when you explore, after the tour</div>}
      </div>
    </div>
  );
}

// FactorYourTurn (spec item 5): three quadratics over the work zone; Show solution reveals the key. No answer boxes.
function FactorYourTurn({ shown, onToggle, onClose }) {
  return (
    <div data-gate="work" data-card="yourturn" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5,
      border: `2px solid ${ACCENT}`, display: 'flex', flexDirection: 'column', gap: 10 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT }}>YOUR TURN</div>
        <button type="button" onClick={onClose} style={btnStyle(false)}>{'← back to the worked examples'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: HEAD, fontSize: 16, color: INK, flex: 1 }}><b>Classify and factor.</b>{' Work it on paper.'}</div>
        <button type="button" onClick={onToggle} aria-expanded={shown}
          style={Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '8px 16px', flexShrink: 0 })}>{shown ? 'Hide solution' : 'Show solution'}</button>
      </div>
      {YT.map((q) => (
        <div key={q.tag} data-yt={q.tag} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 15, color: MUTE, width: 30 }}>{q.tag}</span>
            <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: C_FORM }}>{q.quad}</span>
          </div>
          {shown ? (
            <div data-solution={q.tag} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 42 }}>
              <span style={{ fontFamily: MONO, fontSize: 14.5, color: INK }}>{q.disc}</span>
              <span data-yt-answer={q.tag} style={{ fontFamily: MONO, fontSize: 15.5, fontWeight: 600, color: q.color }}>{'→ ' + q.result}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ═══ 7 SCENE ═════════════════════════════════════════════════════════════ */
// Scene: builds the schedule from the measured clip durations and mounts the stage
function Scene() {
  const { urls, durs } = useClips(LANG.clips);
  const sched = useMemo(() => buildSchedule(LANG, durs), [durs]);
  const TL = useMemo(() => makeTL(sched), [sched]);
  const narration = useMemo(() => LANG.clips.map((clip, i) => ({ clip, at: sched.starts[i], dur: sched.durs[i] })), [sched]);
  return (
    <Stage duration={sched.total}>
      <TLCtx.Provider value={TL}>
        <SceneBody lang={LANG} ui={LANG.ui} sched={sched} narration={narration} urls={urls} />
      </TLCtx.Provider>
    </Stage>
  );
}

// SceneBody: which beat is on screen (from the playhead, or from ◀ ▶), or a quadratic set by hand (Explore)
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1);          // beat chosen by hand; -1 while the tour drives
  const [liveQuad, setLiveQuad] = useState(null);   // quadratic set by hand; null while a beat is shown
  useEffect(() => { if (playing) { setHand(-1); setLiveQuad(null); } }, [playing]);
  const tourBi = beatAt(TL, Math.min(time, TL.REVERT));
  const shown = hand >= 0 ? hand : tourBi;
  const b = BEATS[Math.max(0, shown)];
  const explore = hand >= 0 || !!liveQuad || time >= TL.EXPLORE;
  const takeOver = () => { yt.close(); if (playing) setPlaying(false); };
  const goBeat = (i) => { takeOver(); setLiveQuad(null); setHand(i); };
  const setQuad = (q) => { takeOver(); setHand(clamp(shown, IX.disc, LAST)); setLiveQuad(q); };
  const live = liveQuad ? solve(liveQuad.b, liveQuad.c) : null;
  const quad = liveQuad || (EXAMPLES[b.ex] ? { b: EXAMPLES[b.ex].b, c: EXAMPLES[b.ex].c } : { b: EXAMPLES[1].b, c: EXAMPLES[1].c });
  // the live readout appears only for Explore: a quadratic set by hand, or after the last clip has ended
  const readout = !!live || time >= TL.REVERT;

  const note = live ? ui.noteExplore : hand >= 0 ? ui.noteStep : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  const landing = shown >= 0 && !live && b.land && !yt.open ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
  const s = live || EXAMPLES[b.ex];

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <ArgRail lang={lang} ui={ui} bi={shown} />
      <WorkZone ui={ui} bi={shown} live={live} />
      {yt.open ? <FactorYourTurn shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Numbers ui={ui} bi={shown} live={live} reduced={reduced} />
      <RoutePanel ui={ui} bi={shown} live={live} />
      {landing && !reduced ? <Landing fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={landProg} /> : null}
      <BottomBand ui={ui} bi={shown} quad={quad} live={live} setQuad={setQuad} goBeat={goBeat} explore={explore} note={note} yt={yt} readout={readout} />

      <Captions sched={sched} lang={lang} text={shown >= 0 ? (live ? ui.noteExplore : b.cap) : ''} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + (live ? 'Denominator ' + quadStr(live) + '. Discriminant ' + nv(live.D) + '. Factored form ' + formOf(live) + '. '
        : (shown >= 0 ? b.cap + '. ' : '') + (s && shown >= EX_END[b.ex] ? 'Example ' + quadStr(s) + ': discriminant ' + nv(s.D) + ', ' + formOf(s) + '. ' : '')) +
        (yt.open ? 'Your turn: classify and factor s squared + 7 s + 12, s squared + 6 s + 9, and s squared + 6 s + 25.' +
          (yt.shown ? ' Solution: ' + YT.map((q) => q.tag + ' ' + q.disc + ', ' + q.result).join('; ') + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
