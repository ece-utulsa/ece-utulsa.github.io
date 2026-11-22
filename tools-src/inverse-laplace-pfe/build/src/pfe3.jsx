/* ═══ SCENE — Inverse Laplace · Complex Poles (PFE-3) ═════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  LIVE MODEL            F(s) = 60/((s+1)(s²+bs+c)); worked example b = 4, c = 13 (sympy-verified by Director)
     3  YOUR TURN             F(s) = 20/((s+2)(s²+2s+10)), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  BEATS                 one line of math at a time (focus rules R1–R7, briefing addendum 2)
     6  PANELS                WorkZone, Tape, FtZone, BottomBand
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const K_NUM = 60;          // numerator constant of the worked example
const POLE = 1;            // the real pole is at s = −POLE
const B0 = 4, C0 = 13;     // worked-example quadratic s² + B0·s + C0
const B_MIN = 0.5, B_MAX = 9, C_MIN = 1, C_MAX = 30, QUAD_STEP = 0.5;   // Explore slider ranges
const LINE_HOLD = 1.5;     // s: pause after each clip before the next line replaces it (focus rule R6)
const TAPE_H = 176;        // px: coefficient tape height
const T_MAX = 5;           // s: time axis of the f(t) plot
const C_FS = TEAL;         // F(s) and the form
const C_K = AMBER;         // coefficients A, B, C
const C_ALG = PURPLE;      // the algebra / matrix route
const C_SQ = CORAL;        // the completed square: α, β
const C_COS = BLUE;        // the cosine part
const C_FT = GREEN;        // f(t)
const MINUS = '−';

/* ═══ 2 LIVE MODEL ════════════════════════════════════════════════════════ */
// number to 3 decimals with a true minus sign
const num = (x) => {
  const r = Math.round(x * 1000) / 1000;
  return (r < 0 ? MINUS : '') + String(Math.abs(r));
};
// "+ 3" / "− 3" for a signed term
const signed = (x) => (x < 0 ? MINUS + ' ' : '+ ') + num(Math.abs(x));
// round to 3 decimals
const r3 = (x) => Math.round(x * 1000) / 1000;

// solve F(s) = K/((s+1)(s²+bs+c)) = A/(s+1) + (Bs+C)/(s²+bs+c); α = b/2, β = √(c − α²) when Δ = b² − 4c < 0
function solve(b, c) {
  const disc = b * b - 4 * c;
  const A = K_NUM / (POLE * POLE - b * POLE + c);      // the quadratic evaluated at s = −1
  const B = -A, C = A * (1 - b);
  const alpha = b / 2;
  const beta = disc < 0 ? Math.sqrt(c - (b * b) / 4) : 0;
  const A1 = B;                                        // cosine coefficient
  const B1 = beta > 0 ? (C - A1 * alpha) / beta : 0;   // sine coefficient
  return { b, c, disc, A, B, C, alpha, beta, A1, B1, p: POLE, complex: disc < 0 };
}
// f(t) = A·e^(−pt) + e^(−αt)(A1·cos βt + B1·sin βt), with its decay envelope
const ftOf = (m) => (t) => m.A * Math.exp(-m.p * t) + Math.exp(-m.alpha * t) * (m.A1 * Math.cos(m.beta * t) + m.B1 * Math.sin(m.beta * t));
const envOf = (m, sign) => (t) => m.A * Math.exp(-m.p * t) + sign * Math.hypot(m.A1, m.B1) * Math.exp(-m.alpha * t);

const quadStr = (m) => 's² + ' + num(m.b) + 's + ' + num(m.c);
const alpha2 = (m) => r3(m.alpha * m.alpha);          // shown α²
const beta2 = (m) => r3(m.c - alpha2(m));             // shown β², from the shown α²
const betaS = (m) => r3(Math.sqrt(beta2(m)));         // shown β, from the shown β²
const sqStr = (m) => '(s + ' + num(m.alpha) + ')² + ' + num(beta2(m));
const denSq = (m) => '(s+' + num(m.alpha) + ')²+' + num(beta2(m));

/* ═══ 3 YOUR TURN ═════════════════════════════════════════════════════════ */
// F(s) = 20/((s+2)(s²+2s+10)) = 2/(s+2) − 2s/(s²+2s+10); (s+1)²+9: α = 1, β = 3;
// −2s = −2(s+1) + 2: cos coefficient −2, sin coefficient 2/3;
// f(t) = (2e^(−2t) − 2e^(−t)cos 3t + (2/3)e^(−t)sin 3t) u(t)
const YT_MODEL = { A: 2, p: 2, alpha: 1, beta: 3, A1: -2, B1: 2 / 3 };
const YT = {
  num: '20',
  den: '(s+2)(s² + 2s + 10)',
  ask: 'Complete the square, split into cosine and sine, then invert.',
  steps: [
    ['form', 'F(s) = A/(s+2) + (Bs + C)/(s² + 2s + 10)'],
    ['algebra', '20 = A(s² + 2s + 10) + (Bs + C)(s + 2)'],
    ['', 'A + B = 0,\u20022A + 2B + C = 0,\u200210A + 2C = 20'],
    ['', '\u2192\u2002A = 2, B = \u22122, C = 0'],
    ['expansion', 'F(s) = 2/(s+2) − 2s/(s² + 2s + 10)'],
    ['square', 's² + 2s + 10 = (s+1)² + 9 → α = 1, β = 3'],
    ['split', '\u22122s = \u22122(s+1) + 2'],
    ['', '\u2192\u2002cos coefficient \u22122, sin coefficient 2/3'],
  ],
  terms: [
    ['2/(s+2)', '2e⁻²ᵗ', C_FT],
    ['−2(s+1)/[(s+1)²+9]', '−2e⁻ᵗcos 3t', C_COS],
    ['(2/3)·[3/((s+1)²+9)]', '(2/3)e⁻ᵗsin 3t', C_FT],
  ],
  ft: '( 2e⁻²ᵗ − 2e⁻ᵗcos 3t + (2/3)e⁻ᵗsin 3t ) u(t)',
  say: '2 e to the minus 2 t, minus 2 e to the minus t cosine 3 t, plus two-thirds e to the minus t sine 3 t',
};

/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 15 }, (_, i) => 'pfe3_line' + (i + 1) + '.mp3'),
  durs: [17.784, 13.152, 12.024, 7.488, 8.64, 11.784, 12.504, 9.096, 11.688, 11.04, 10.848, 9.696, 13.008, 11.52, 15.504],
  text: [
    'This denominator has a complex pair — the quadratic s-squared plus 4s plus 13 has no real roots. It’s proper: degree zero over degree three. We won’t force complex numbers. There’s a cleaner path: keep the quadratic whole, and complete the square.',
    'Step one, the form. The real pole gets its usual fraction. The complex pair stays together as the irreducible quadratic — and its numerator is linear, B s plus C, not just a constant.',
    'Step two, the coefficients. Cover-up here would drag in complex arithmetic, so we use algebra instead. Multiply both sides by the whole denominator to clear the fractions.',
    'Match powers on both sides — s squared, s, and the constant — giving three equations in A, B, and C.',
    'Stack them as a matrix: the three-by-three coefficient matrix, times the column A, B, C, equals the right-hand-side column.',
    'Solve, and A is six, B is minus six, C is minus eighteen. So F is six over s plus one, minus the quantity six s plus eighteen over the quadratic.',
    'Step three. Complete the square on the quadratic: s-squared plus 4s plus 13 becomes s plus 2, squared, plus 9. Reading it off, alpha is two and beta is three.',
    'Now shape the numerator to match the standard pairs: write it as a multiple of s plus 2 — the cosine part — plus a multiple of beta — the sine part.',
    'That gives minus six times s plus 2, and then minus six, which is minus two times beta. So the cosine coefficient is minus six, and the sine coefficient is minus two.',
    'Two standard pairs finish it: s plus alpha over the square gives e-to-the-minus-alpha-t cosine beta t; and beta over the square gives e-to-the-minus-alpha-t sine beta t.',
    'Invert term by term: six e-to-the-minus-t from the real pole; minus six e-to-the-minus-2t cosine 3t; and minus two e-to-the-minus-2t sine 3t.',
    'So f of t is six e-to-the-minus-t, minus six e-to-the-minus-2t cosine 3t, minus two e-to-the-minus-2t sine 3t.',
    'A complex pair always gives a decaying sinusoid: e-to-the-minus-alpha-t times cosine and sine of beta t. Alpha sets how fast it decays, beta how fast it rings — the underdamped response, in the s-domain.',
    'So for complex poles: don’t force complex roots. Keep the quadratic, get the constants by matrix, complete the square, split into cosine and sine, and invert.',
    'Your turn. On paper, expand F-of-s equals twenty, over s plus two times s squared plus two s plus ten. Complete the square, split into cosine and sine, then invert. Press Show solution to check.',
  ],
  caps: [
    'F(s) = 60/((s+1)(s²+4s+13)) — no real roots (Δ < 0) · proper: degree 0 over degree 3',
    'STEP 1 F(s) = A/(s+1) + (Bs + C)/(s²+4s+13) — linear numerator',
    'STEP 2 algebra, not cover-up: 60 = A(s²+4s+13) + B(s²+s) + C(s+1)',
    'Equate powers: A+B = 0; 4A+B+C = 0; 13A+C = 60',
    'Matrix: [1 1 0; 4 1 1; 13 0 1]·[A; B; C] = [0; 0; 60]',
    'Solve → A = 6, B = −6, C = −18 · F = 6/(s+1) − (6s+18)/(s²+4s+13)',
    'STEP 3 s²+4s+13 = (s+2)² + 9 → α = 2, β = 3',
    'Split the numerator: −(6s+18) = A₁(s+2) + B₁·β',
    '−6s−18 = −6(s+2) − 6 → A₁ = −6 (cos), B₁ = −2 (sin)',
    '(s+α)/((s+α)²+β²) ⟺ e⁻ᵅᵗcos βt · β/((s+α)²+β²) ⟺ e⁻ᵅᵗsin βt',
    '6e⁻ᵗ − 6e⁻²ᵗcos 3t − 2e⁻²ᵗsin 3t',
    'f(t) = (6e⁻ᵗ − 6e⁻²ᵗcos 3t − 2e⁻²ᵗsin 3t) u(t)',
    'e⁻ᵅᵗ(cos βt, sin βt) — underdamped: α decays, β rings',
    'keep the quadratic → matrix → complete the square → split → invert',
    'Your turn — on paper: expand F(s) = 20/((s+2)(s²+2s+10)), invert, then press Show solution.',
  ],
  rail: ['STEP 1 · the form', 'STEP 2 · matrix for A, B, C', 'STEP 3a · complete the square', 'STEP 3b · split · invert'],
  card: {
    series: 'ECE 2003 · Inverse Laplace · 3 of 3',
    title: 'Inverse Laplace — Complex Poles',
    sentence: 'You’ll take F(s) = 60 / ((s+1)(s²+4s+13)), one real pole and a complex pair, back to f(t).',
    steps: [
      'Write the partial-fraction form: the quadratic stays whole, with Bs + C on top.',
      'Find A, B and C by algebra with a matrix.',
      'Complete the square, split into cosine and sine, and invert each term.',
    ],
    able: 'Expand any F(s) with a complex pole pair and write f(t) as a decaying sinusoid. Then try one yourself.',
  },
  ui: {
    kicker: 'PARTIAL FRACTIONS · COMPLEX POLES',
    title: 'Complete the square',
    sub: 'F(s) = 60 / (s+1)(s²+4s+13)',
    header: 'Inverse Laplace',
    headerSub: '· complex poles · no complex arithmetic',
    keyPoint: 'A complex pair stays as a quadratic: complete the square, then cos and sin.',
    railHead: 'THE SKELETON',
    workHead: 'THE WORK',
    tapeHead: 'COEFFICIENT TAPE',
    ftHead: 'f(t) — INVERT TERM BY TERM',
    ftHeadYT: 'YOUR TURN — f(t)',
    quadHead: 'EXPLORE THE QUADRATIC',
    tourTag: 'TOUR', exploreTag: 'EXPLORE',
    formLabel: 'STEP 1 — irreducible quadratic, linear numerator',
    whyAlg: 'cover-up here would force complex arithmetic — use algebra',
    matrixLabel: 'MATRIX FORM (3×3)',
    sqLabel: 'COMPLETE THE SQUARE',
    splitLabel: 'SPLIT THE NUMERATOR — cosine part + sine part',
    pairLabel: 'transform pairs',
    throughHead: 'THROUGH-LINE',
    through: 'e⁻ᵅᵗ(cos βt, sin βt) — the underdamped signature',
    throughSub: 'α sets the decay envelope · β sets the ringing frequency',
    realNote: 'Δ ≥ 0 — real roots now: this leaves the complex case (see SD-2a)',
    notes: [
      'no real roots — keep the quadratic whole',
      'the quadratic’s numerator is linear: Bs + C',
      'clear the denominator — algebra, not cover-up',
      'three powers → three equations',
      'a 3×3, and no complex numbers anywhere',
      'A, B and C are settled — now the shape',
      'α and β read straight off the completed square',
      'match the numerator to the two standard pairs',
      'the sine term is written as B₁·[β/(…)] so B₁ is visible',
      'two pairs finish the job',
      'term by term → the time function',
      'a decaying sinusoid — the payoff',
      'α decays it, β rings it',
      'no complex roots forced, start to finish',
      'work the new problem on paper, then show the solution',
    ],
    noteExplore: 'move b and c — α and β follow the completed square',
    endTitle: 'Complex poles ✓', endSub: 'try the Your-turn problem · or explore the quadratic',
    srSummary: 'Inverse Laplace, complex poles by completing the square. ',
  },
};

/* ═══ 5 BEATS — one line of math at a time (focus rules R1–R7) ═══════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based), `from` the fraction of
// that clip at which the beat starts (estimated from the script; the clips are not shortened or moved).
//   rail    skeleton step: 0 form, 1 matrix, 2 complete the square, 3 split and invert
//   land    tape slot that lands on this beat ('A','B','C','α','β','A₁','B₁') or ''
//   power   power of s being matched (2..0) or -1;  mrows: matrix rows built so far
//   terms   f(t) terms spoken so far;  ft: the whole f(t) has been spoken
// Captions use the worked example's numbers; the focus area follows the live quadratic in Explore.
const P_COLOR = [POW0, POW1, POW2];                 // colour of s⁰, s¹, s² (index = power)
const BEATS = [
  { id: 'intro', line: 1, from: 0.27, rail: 0, cap: 'F(s) = 60/((s+1)(s\u00b2+4s+13)) \u2014 the quadratic has no real roots' },
  { id: 'proper', line: 1, from: 0.42, rail: 0, cap: 'proper: degree 0 over degree 3' },
  { id: 'keep', line: 1, from: 0.62, rail: 0, cap: 'keep the quadratic whole, and complete the square' },
  { id: 'form', line: 2, from: 0, rail: 0, cap: 'STEP 1\u2003the quadratic stays together, with a linear numerator' },
  { id: 'why', line: 3, from: 0, rail: 1, cap: 'STEP 2\u2003cover-up would need complex arithmetic \u2014 use algebra' },
  { id: 'ident', line: 3, from: 0.55, rail: 1, cap: 'multiply both sides by the whole denominator' },
  { id: 'eq2', line: 4, from: 0.2, rail: 1, power: 2, cap: 'match the s\u00b2 terms' },
  { id: 'eq1', line: 4, from: 0.42, rail: 1, power: 1, cap: 'match the s terms' },
  { id: 'eq0', line: 4, from: 0.58, rail: 1, power: 0, cap: 'match the constants \u2014 three equations in A, B, C' },
  { id: 'mat1', line: 5, from: 0, rail: 1, mrows: 1, cap: 'Stack them as a matrix \u2026' },
  { id: 'mat2', line: 5, from: 0.3, rail: 1, mrows: 2, cap: '\u2026 coefficient matrix \u00b7 column A, B, C \u2026' },
  { id: 'mat3', line: 5, from: 0.6, rail: 1, mrows: 3, cap: '\u2026 equals the right-hand-side column' },
  { id: 'A-val', line: 6, from: 0.08, rail: 1, land: 'A', cap: 'Solve: A = 6' },
  { id: 'B-val', line: 6, from: 0.2, rail: 1, land: 'B', cap: 'B = \u22126' },
  { id: 'C-val', line: 6, from: 0.31, rail: 1, land: 'C', cap: 'C = \u221218' },
  { id: 'Fs2', line: 6, from: 0.48, rail: 1, cap: 'F(s) = 6/(s+1) \u2212 (6s+18)/(s\u00b2+4s+13)' },
  { id: 'sq-set', line: 7, from: 0.08, rail: 2, cap: 'STEP 3\u2003complete the square on the quadratic' },
  { id: 'sq-done', line: 7, from: 0.4, rail: 2, cap: 's\u00b2+4s+13 = (s+2)\u00b2 + 9' },
  { id: 'al-val', line: 7, from: 0.72, rail: 2, land: '\u03b1', cap: '\u03b1 = 2' },
  { id: 'be-val', line: 7, from: 0.86, rail: 2, land: '\u03b2', cap: '\u03b2 = 3' },
  { id: 'split', line: 8, from: 0, rail: 3, cap: 'Shape the numerator: a multiple of (s+2), plus a multiple of \u03b2' },
  { id: 'split2', line: 9, from: 0, rail: 3, cap: 'take out \u22126 times (s+2)' },
  { id: 'split3', line: 9, from: 0.3, rail: 3, cap: 'what is left is \u22126, which is \u22122 times \u03b2' },
  { id: 'A1-val', line: 9, from: 0.62, rail: 3, land: 'A\u2081', cap: 'cosine coefficient A\u2081 = \u22126' },
  { id: 'B1-val', line: 9, from: 0.84, rail: 3, land: 'B\u2081', cap: 'sine coefficient B\u2081 = \u22122' },
  { id: 'pairc', line: 10, from: 0.12, rail: 3, cap: '(s+\u03b1)/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57cos \u03b2t' },
  { id: 'pairs', line: 10, from: 0.56, rail: 3, cap: '\u03b2/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57sin \u03b2t' },
  { id: 't1', line: 11, from: 0.15, rail: 3, terms: 1, cap: '6e\u207b\u1d57 from the real pole' },
  { id: 't2', line: 11, from: 0.42, rail: 3, terms: 2, cap: '\u22126e\u207b\u00b2\u1d57cos 3t' },
  { id: 't3', line: 11, from: 0.72, rail: 3, terms: 3, cap: '\u22122e\u207b\u00b2\u1d57sin 3t' },
  { id: 'ft', line: 12, from: 0, rail: 3, terms: 3, ft: true, cap: 'f(t) = (6e\u207b\u1d57 \u2212 6e\u207b\u00b2\u1d57cos 3t \u2212 2e\u207b\u00b2\u1d57sin 3t) u(t)' },
  { id: 'through', line: 13, from: 0, rail: 3, terms: 3, ft: true, through: true, cap: 'e\u207b\u1d45\u1d57(cos \u03b2t, sin \u03b2t) \u2014 underdamped: \u03b1 decays, \u03b2 rings' },
  { id: 'sum', line: 14, from: 0, rail: 3, terms: 3, ft: true, through: true, cap: 'keep the quadratic \u2192 matrix \u2192 complete the square \u2192 split \u2192 invert' },
  { id: 'yt', line: 15, from: 0, rail: 3, terms: 3, ft: true, through: true, cap: 'Your turn \u2014 on paper: expand F(s) = 20/((s+2)(s\u00b2+2s+10)), invert, then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.sum;                                // last derivation line (the Your-turn line is not one)
const SLOTS = ['A', 'B', 'C', '\u03b1', '\u03b2', 'A\u2081', 'B\u2081'];
const LAND_AT = { A: IX['A-val'], B: IX['B-val'], C: IX['C-val'], '\u03b1': IX['al-val'], '\u03b2': IX['be-val'], 'A\u2081': IX['A1-val'], 'B\u2081': IX['B1-val'] };
const SQUARE_FROM = IX['sq-set'];                   // from here on the beats need a complex pair (Δ < 0)

// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}
// tape slots the voice has filled by beat i
const foundAt = (i) => SLOTS.filter((k) => i >= LAND_AT[k]);

/* ═══ 6 PANELS ════════════════════════════════════════════════════════════ */
const quadTight = (m) => 's\u00b2+' + num(m.b) + 's+' + num(m.c);           // quadratic without spaces, for long lines
const remOf = (m) => r3(m.C - m.A1 * m.alpha);                              // what is left of the numerator after A₁(s+α): equals B₁·β
const tapeVal = (m, k) => ({ A: num(m.A), B: num(m.B), C: num(m.C), '\u03b1': num(m.alpha), '\u03b2': num(betaS(m)), 'A\u2081': num(m.A1), 'B\u2081': num(m.B1) }[k]);
// identity tokens for the live quadratic; [text, power] tokens can be highlighted by power (focus rule R3)
const identTokens = (m) => [[String(K_NUM), 0], ' = A(', ['s\u00b2', 2], '+', [num(m.b) + 's', 1], '+', [num(m.c), 0], ') + B(', ['s\u00b2', 2], '+', ['s', 1], ') + C(', ['s', 1], '+', ['1', 0], ')'];
const systemOf = (m) => [['s\u00b2', 'A + B = 0'], ['s\u00b9', num(m.b) + 'A + B + C = 0'], ['s\u2070', num(m.c) + 'A + C = ' + K_NUM]];
const numerStr = (m) => num(m.B) + 's ' + signed(m.C);                      // the quadratic's numerator Bs + C with its numbers
const fsExpanded = (m) => 'F(s) = ' + num(m.A) + '/(s+1) ' + MINUS + ' (' + num(-m.B) + 's ' + signed(-m.C) + ')/(' + quadTight(m) + ')';
const termsOf = (m) => [
  [num(m.A) + '/(s+1)', num(m.A) + 'e\u207b\u1d57', C_FT],
  [num(m.A1) + '(s+' + num(m.alpha) + ')/[' + denSq(m) + ']', num(m.A1) + 'e\u207b' + num(m.alpha) + '\u1d57cos ' + num(betaS(m)) + 't', C_COS],
  [num(m.B1) + '\u00b7[' + num(betaS(m)) + '/(' + denSq(m) + ')]', num(m.B1) + 'e\u207b' + num(m.alpha) + '\u1d57sin ' + num(betaS(m)) + 't', C_FT],
];
const ftParts = (m) => ['( ' + num(m.A) + 'e\u207b\u1d57 ' + signed(m.A1) + 'e\u207b' + num(m.alpha) + '\u1d57cos ' + num(betaS(m)) + 't', signed(m.B1) + 'e\u207b' + num(m.alpha) + '\u1d57sin ' + num(betaS(m)) + 't ) u(t)'];

// focus content for beat b with the live model m: the one line the voice is speaking
function focusOf(b, m) {
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  if (!m.complex && IX[b.id] >= SQUARE_FROM) {
    return <span style={{ color: C_SQ }}>{'\u0394 = ' + num(m.disc) + ' \u2265 0: real roots, not a complex pair'}</span>;
  }
  const sys = systemOf(m), tm = termsOf(m);
  switch (b.id) {
    case 'intro': return <span>{'F(s) = ' + K_NUM + ' / ((s+1)(' + quadTight(m) + '))'}</span>;
    case 'proper': return prose('proper: degree 0 over degree 3');
    case 'keep': return prose('keep the quadratic whole \u2192 complete the square');
    case 'form': return <Eq text={'F(s) = A/(s+1) + (Bs + C)/(' + quadTight(m) + ')'} />;
    case 'why': return prose('cover-up needs complex arithmetic \u2192 use algebra', C_ALG);
    case 'ident': return <KPower tokens={identTokens(m)} power={-1} colors={P_COLOR} />;
    case 'eq2': case 'eq1': case 'eq0': {
      const row = sys[2 - b.power];
      return <span style={{ color: P_COLOR[b.power], fontWeight: 600 }}>{row[0] + ':\u2003'}<Eq text={row[1]} /></span>;
    }
    case 'mat1': case 'mat2': case 'mat3':
      return <KMatrix rows={[['1', '1', '0'], [num(m.b), '1', '1'], [num(m.c), '0', '1']]} unk={['A', 'B', 'C']} rhs={['0', '0', String(K_NUM)]}
        tags={['s\u00b2', 's\u00b9', 's\u2070']} shown={b.mrows} colors={[POW2, POW1, POW0]} />;
    case 'A-val': return <span><KUnk k="A" /><KValue k="A" text={num(m.A)} /></span>;
    case 'B-val': return <span><KUnk k="B" /><KValue k="B" text={num(m.B)} /></span>;
    case 'C-val': return <span><KUnk k="C" /><KValue k="C" text={num(m.C)} /></span>;
    case 'Fs2': return <span>{fsExpanded(m)}</span>;
    case 'sq-set': return <span>{quadTight(m) + ' = (s+\u03b1)\u00b2 + \u03b2\u00b2'}</span>;
    case 'sq-done': return <span>{quadTight(m) + ' = '}<span style={{ color: C_SQ, fontWeight: 600 }}>{sqStr(m)}</span></span>;
    case 'al-val': return <span><KUnk k={'\u03b1'} color={C_SQ} />{' = ' + num(m.b) + '/2'}<KValue k={'\u03b1'} text={num(m.alpha)} /></span>;
    case 'be-val': return <span><KUnk k={'\u03b2'} color={C_SQ} />{' = \u221a' + num(beta2(m))}<KValue k={'\u03b2'} text={num(betaS(m))} /></span>;
    case 'split': return <span>{numerStr(m) + ' = A\u2081(s + ' + num(m.alpha) + ') + B\u2081\u00b7' + num(betaS(m))}</span>;
    case 'split2': return <span>{numerStr(m) + ' = '}<span style={{ color: C_COS, fontWeight: 600 }}>{num(m.A1) + '(s + ' + num(m.alpha) + ')'}</span>{' ' + signed(remOf(m))}</span>;
    case 'split3': return <span>{num(remOf(m)) + ' = '}<span style={{ color: C_FT, fontWeight: 600 }}>{num(m.B1) + '\u00b7' + num(betaS(m))}</span>{'\u2003(B\u2081\u00b7\u03b2)'}</span>;
    case 'A1-val': return <span><KUnk k={'A\u2081'} color={C_COS} />{'\u2002(cos)'}<KValue k={'A\u2081'} text={num(m.A1)} /></span>;
    case 'B1-val': return <span><KUnk k={'B\u2081'} color={C_FT} />{'\u2002(sin)'}<KValue k={'B\u2081'} text={num(m.B1)} /></span>;
    case 'pairc': return <span style={{ color: C_COS }}>{'(s+\u03b1)/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57cos \u03b2t'}</span>;
    case 'pairs': return <span style={{ color: C_FT }}>{'\u03b2/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57sin \u03b2t'}</span>;
    case 't1': case 't2': case 't3': {
      const t = tm[b.terms - 1];
      return <span style={{ fontSize: FOCUS_FS }}><span style={{ color: C_FS }}>{t[0]}</span><br />{'\u2003\u27fa\u2002'}<span style={{ color: t[2], fontWeight: 600 }}>{t[1]}</span></span>;
    }
    case 'through': return <span style={{ color: C_SQ, fontWeight: 600 }}>{'e\u207b\u1d45\u1d57(cos \u03b2t, sin \u03b2t): \u03b1 decays, \u03b2 rings'}</span>;
    case 'sum': return prose('keep the quadratic \u2192 matrix \u2192 complete the square \u2192 split \u2192 invert');
    default: { const p = ftParts(m); return <span style={{ color: C_FT, fontWeight: 600 }}>{'f(t) = ' + p[0]}<br />{'\u2003\u2003' + p[1]}</span>; }
  }
}

// finished lines for beat index i with the live model m: one compact row each, oldest first (focus rule R1)
function doneRows(i, m) {
  // rows may wrap here: the Explore sliders can make the numbers longer than the worked example's
  const rows = [], add = (key, node, color, size) => rows.push({ key, node, color, size, wrap: true });
  const sys = systemOf(m), abc = 'A = ' + num(m.A) + ', B = ' + num(m.B) + ', C = ' + num(m.C);
  if (i > IX.form) add('form', <Eq text={'F(s) = A/(s+1) + (Bs + C)/(' + quadTight(m) + ')'} />);
  if (i < SQUARE_FROM) {
    if (i > IX.ident) add('ident', <KPower tokens={identTokens(m)} power={BEATS[i].power != null ? BEATS[i].power : -1} colors={P_COLOR} />);
    [2, 1, 0].forEach((pw) => { if (i > IX['eq' + pw]) add('eq' + pw, <span>{sys[2 - pw][0] + ':\u2002'}<Eq text={sys[2 - pw][1]} /></span>, P_COLOR[pw]); });
    if (i > IX.mat3) add('matrix', <Eq text={'[1 1 0; ' + num(m.b) + ' 1 1; ' + num(m.c) + ' 0 1]\u00b7[A; B; C] = [0; 0; ' + K_NUM + ']'} />);
    ['A', 'B', 'C'].forEach((k) => { if (i > LAND_AT[k] && i <= IX['C-val']) add('v' + k, <Eq text={k + ' = ' + tapeVal(m, k)} />); });
    if (i > IX['C-val']) add('abc', <Eq text={'solve \u2192 ' + abc} />);
    return rows;
  }
  if (i >= IX.pairc) rows.length = 0;            // inverting: the form has done its work; keep the rows the inversion uses
  add('abc', <span>{'by matrix:\u2002'}<Eq text={abc} /></span>);
  if (i < IX.pairc) add('fs2', <span>{fsExpanded(m)}</span>);
  if (!m.complex) return rows;
  if (i < IX.split) {
    if (i > IX['sq-set']) add('sqset', <span>{quadTight(m) + ' = (s+\u03b1)\u00b2 + \u03b2\u00b2 = s\u00b2 + 2\u03b1s + (\u03b1\u00b2 + \u03b2\u00b2)'}</span>);
    if (i > IX['sq-done']) add('sqdone', <span>{quadTight(m) + ' = ' + sqStr(m)}</span>, C_SQ);
    if (i > IX['al-val']) add('al', <span>{'match s:\u20022\u03b1 = ' + num(m.b) + ' \u2192 \u03b1 = ' + num(m.alpha)}</span>);
    return rows;
  }
  add('sq', <span>{quadTight(m) + ' = ' + sqStr(m) + ' \u2192 \u03b1 = ' + num(m.alpha) + ', \u03b2 = ' + num(betaS(m))}</span>, C_SQ);
  if (i < IX.pairc) {
    if (i > IX.split) add('split', <span>{numerStr(m) + ' = A\u2081(s + ' + num(m.alpha) + ') + B\u2081\u00b7' + num(betaS(m))}</span>);
    if (i > IX.split2) add('split2', <span>{numerStr(m) + ' = ' + num(m.A1) + '(s + ' + num(m.alpha) + ') ' + signed(remOf(m))}</span>);
    if (i > IX.split3) add('split3', <span>{num(remOf(m)) + ' = ' + num(m.B1) + '\u00b7' + num(betaS(m))}</span>);
    if (i > IX['A1-val']) add('a1', <span>{'A\u2081 = ' + num(m.A1) + ' (cos)'}</span>, C_COS);
    return rows;
  }
  add('ab1', <span>{numerStr(m) + ' = ' + num(m.A1) + '(s + ' + num(m.alpha) + ') ' + signed(m.B1) + '\u00b7' + num(betaS(m)) + ' \u2192 A\u2081 = ' + num(m.A1) + ', B\u2081 = ' + num(m.B1)}</span>);
  if (i > IX.pairc) add('pairc', <span>{'(s+\u03b1)/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57cos \u03b2t'}</span>, C_COS);
  if (i > IX.pairs) add('pairs', <span>{'\u03b2/((s+\u03b1)\u00b2+\u03b2\u00b2) \u27fa e\u207b\u1d45\u1d57sin \u03b2t'}</span>, C_FT);
  termsOf(m).forEach((t, j) => { if (i > IX['t' + (j + 1)]) add('t' + j, <span>{t[0] + ' \u27fa ' + t[1]}</span>); });
  if (i > IX.ft) { const p = ftParts(m); add('ftrow', <span>{'f(t) = ' + p[0] + ' ' + p[1]}</span>, C_FT, 15); }
  return rows;
}

// WorkZone: F(s), the finished lines, and the one focus line
function WorkZone({ ui, m, bi }) {
  const time = useTime(); const TL = useTL();
  if (bi < 0) return null;
  const b = BEATS[bi];
  const tint = [C_FS, C_ALG, C_SQ, C_FT][b.rail];
  const badge = b.rail === 1 ? 'STEP 2 \u00b7 ALGEBRA (MATRIX)' : b.rail === 2 ? 'STEP 3 \u00b7 COMPLETE THE SQUARE' : b.rail === 3 ? 'STEP 3 \u00b7 SPLIT AND INVERT' : '';
  return (
    <KWork head={ui.workHead} badge={badge} badgeColor={tint}
      fs={<KFs num={String(K_NUM)} factors={['(s+1)', '(' + quadStr(m) + ')']} cover={-1} />}
      rows={doneRows(bi, m)} focusId={b.id} bar={tint} opacity={bi >= 1 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1)}>
      {focusOf(b, m)}
    </KWork>
  );
}

// Tape: a slot reads "?" until the voice has said its value (R4). With real roots (Δ ≥ 0) the square slots read "–".
function Tape({ ui, m, bi, reduced }) {
  if (bi < IX.form) return null;
  const b = BEATS[bi], found = foundAt(bi);
  const slot = (k, sub, tint, needsComplex) => {
    const got = found.indexOf(k) >= 0;
    return <KSlot key={k} k={k} value={needsComplex && !m.complex ? '\u2013' : tapeVal(m, k)} sub={sub} got={got} landing={b.land === k} reduced={reduced} tint={tint} dense />;
  };
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_ALG }}>{'algebra \u00b7 matrix'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {slot('A', 'pole \u22121', C_K)}{slot('B', 's coeff', C_K)}{slot('C', 'constant', C_K)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {slot('\u03b1', 'decay', C_SQ, true)}{slot('\u03b2', 'ring', C_SQ, true)}{slot('A\u2081', 'cos', C_COS, true)}{slot('B\u2081', 'sin', C_FT, true)}
      </div>
    </div>
  );
}

// FtZone: a term appears when the voice says it; f(t) and its curve (with the decay envelope) once f(t) has been spoken (R4).
// When the Your-turn solution is shown the panel holds that solution instead.
function FtZone({ ui, m, bi, yourTurn }) {
  if (bi < IX.form) return null;
  const b = BEATS[bi], ok = yourTurn || m.complex;
  const model = yourTurn ? YT_MODEL : m;
  const terms = yourTurn ? YT.terms : termsOf(m);
  const nTerms = !ok ? 0 : yourTurn ? terms.length : (b.terms || 0), showFt = ok && (yourTurn || !!b.ft);
  const p = ftParts(m);
  const top = PANEL_TOP + TAPE_H + 10, h = PANEL_H - TAPE_H - 10;
  return (
    <div data-gate="ft" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h,
      display: 'flex', flexDirection: 'column', gap: 3 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 51 }}>
        {terms.slice(0, nTerms).map((t, i) => (
          <div key={i} data-term="1" style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: MONO, fontSize: FS_MIN, lineHeight: '17px' }}>
            <span style={{ color: C_FS, width: 186, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'\u27fa'}</span>
            <span style={{ color: t[2], fontWeight: 600, whiteSpace: 'nowrap' }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: ok ? C_FT : C_SQ, lineHeight: '17px', minHeight: 34 }}>
        {showFt ? 'f(t) = ' + (yourTurn ? YT.ft : p[0] + ' ' + p[1]) : ok ? '' : 'f(t): two real exponentials (\u0394 \u2265 0); see PFE-1'}
      </div>
      <FtPlot f={ftOf(model)} tmax={T_MAX} width={SIDE_W - 26} height={h - 20 - 17 - 51 - 34 - 12} shown={showFt} color={C_FT}
        extra={[{ f: envOf(model, 1), color: C_SQ }, { f: envOf(model, -1), color: C_SQ }]} />
    </div>
  );
}

// Slider: one labelled range input for a quadratic coefficient
function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: INK, width: 14, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={'quadratic coefficient ' + label}
        style={{ flex: 1, accentColor: C_SQ, cursor: 'pointer', margin: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: INK, width: 40,
        textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(value)}</span>
    </div>
  );
}

// BottomBand: the live quadratic (Explore), one-line-back / one-line-forward, and the through-line
function BottomBand({ ui, m, bi, goBeat, setB, setC, explore, note, yt }) {
  const b = BEATS[Math.max(0, bi)];
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 18, padding: '9px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {zoneHead(ui.quadHead)}
          <span data-quad="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_FS, whiteSpace: 'nowrap' }}>{quadStr(m)}</span>
          <KMode explore={explore} ui={ui} />
        </div>
        <Slider label="b" value={m.b} min={B_MIN} max={B_MAX} step={QUAD_STEP} onChange={setB} />
        <Slider label="c" value={m.c} min={C_MIN} max={C_MAX} step={QUAD_STEP} onChange={setC} />
      </div>
      <div style={{ width: 1, background: LINE }} />
      <KNav cur={clamp(bi, 0, LAST)} total={LAST + 1} goBeat={goBeat} yt={yt} note={note} width={300} />
      <div style={{ width: 1, background: LINE }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
        {smallLabel(ui.throughHead)}
        {m.complex ? (
          <React.Fragment>
            <div data-through="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_SQ, lineHeight: 1.3, minHeight: 17 }}>{b.through ? ui.through : ''}</div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, whiteSpace: 'nowrap', lineHeight: 1.3, minHeight: 17 }}>{b.through ? ui.throughSub : ''}</div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.3 }}>{'\u0394 = ' + num(m.disc)}</div>
          </React.Fragment>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_SQ, textWrap: 'pretty', lineHeight: 1.45 }}>{ui.realNote}</div>
        )}
      </div>
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

// SceneBody: which beat is on screen (from the playhead, or from the learner's ◀ ▶ and sliders), and the layout
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1);          // beat chosen by hand; -1 while the tour drives
  const [quad, setQuad] = useState({ b: B0, c: C0 });
  useEffect(() => { if (playing) { setHand(-1); setQuad({ b: B0, c: C0 }); } }, [playing]);
  const tourBi = beatAt(TL, Math.min(time, TL.REVERT));
  const shown = hand >= 0 ? hand : tourBi;
  const explore = hand >= 0 || time >= TL.EXPLORE;
  const goBeat = useCallback((i) => { setHand(i); yt.close(); if (playing) setPlaying(false); }, [playing]);
  // moving a slider takes over at the line now on screen (or the last derivation line)
  const grabQuad = (patch) => { goBeat(clamp(shown, IX.form, LAST)); setQuad((q) => Object.assign({}, q, patch)); };

  const m = useMemo(() => solve(quad.b, quad.c), [quad.b, quad.c]);
  const b = BEATS[Math.max(0, shown)];
  const lit = [shown >= IX.form, shown >= IX.why, shown >= IX['sq-set'], shown >= IX.split];
  const note = hand >= 0 ? ui.noteExplore : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  const landing = shown >= 0 && b.land && !yt.open && (m.complex || shown < SQUARE_FROM) ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
  const sr = foundAt(shown);
  const pairStyle = { fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, lineHeight: 1.35 };

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={b.rail} lit={lit} tints={[C_FS, C_ALG, C_SQ, C_FT]}
        footer={<React.Fragment>
          {smallLabel(ui.pairLabel)}
          <div style={Object.assign({ color: C_COS }, pairStyle)}>{'(s+\u03b1)/[(s+\u03b1)\u00b2+\u03b2\u00b2] \u27fa e\u207b\u1d45\u1d57cos \u03b2t'}</div>
          <div style={Object.assign({ color: C_FT }, pairStyle)}>{'\u03b2/[(s+\u03b1)\u00b2+\u03b2\u00b2] \u27fa e\u207b\u1d45\u1d57sin \u03b2t'}</div>
        </React.Fragment>} />
      <WorkZone ui={ui} m={m} bi={shown} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} m={m} bi={shown} reduced={reduced} />
      <FtZone ui={ui} m={m} bi={shown} yourTurn={yt.shown} />
      {landing && !reduced ? <Landing fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={landProg} /> : null}
      <BottomBand ui={ui} m={m} bi={shown} goBeat={goBeat} setB={(v) => grabQuad({ b: v })} setC={(v) => grabQuad({ c: v })}
        explore={explore} note={note} yt={yt} />

      <Captions sched={sched} lang={lang} text={shown >= 0 ? (hand >= 0 && (quad.b !== B0 || quad.c !== C0) ? ui.noteExplore : b.cap) : ''} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + 'F of s = 60 over (s+1)(' + quadStr(m) + '). ' + (quad.b === B0 && quad.c === C0 ? b.cap + '. ' : '') +
        (sr.length ? 'Found so far: ' + sr.map((k) => k + ' = ' + tapeVal(m, k)).join(', ') + '. ' : '') +
        (!m.complex ? 'The discriminant is not negative, so the quadratic has real roots and this is not a complex pair. ' : '') +
        (yt.open ? 'Your turn: F of s = 20 over (s+2)(s squared + 2 s + 10).' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
