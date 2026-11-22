/* ═══ SCENE — Inverse Laplace · Repeated Poles (PFE-2) ════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  WORKED EXAMPLE        F(s) = (s³+2s+6)/(s(s+1)²(s+3)), sympy-verified by Director
     3  YOUR TURN             F(s) = (s+3)/(s(s+1)²), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  BEATS                 one line of math at a time (focus rules R1–R7, briefing addendum 2)
     6  PANELS                WorkZone, Tape, FtZone, BottomBand
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5;     // s: pause after each clip before the next line replaces it (focus rule R6)
const TAPE_H = 140;        // px: coefficient tape height
const C_FS = TEAL;         // F(s) and the expansion form
const C_K = AMBER;         // coefficients A, B, C, D
const C_A = BLUE;          // method A: residue (cover-up)
const C_B = PURPLE;        // method B: algebra (matrix)
const C_D = CORAL;         // the catch: the derivative
const C_FT = GREEN;        // f(t)

/* ═══ 2 WORKED EXAMPLE ════════════════════════════════════════════════════ */
const EX = {
  Fnum: 's³ + 2s + 6',
  Fden: 's(s+1)²(s+3)',
  form: 'A/s + B/(s+1)² + C/(s+1) + D/(s+3)',
  easy: [
    { k: 'A', expr: 's·F(s) |s=0', val: '2' },
    { k: 'B', expr: '(s+1)²F(s) |s=−1', val: '−1.5' },
    { k: 'D', expr: '(s+3)F(s) |s=−3', val: '2.25' },
  ],
  warn: 'C cannot be found by cover-up — that term blows up at s = −1',
  derivRule: 'Kₙ₋ₘ = (1/M!) · dᴹ/dsᴹ [ (s+p)ᴺ F(s) ] |s=−p',
  derivHere: 'N = 2, M = 1: C = d/ds [ (s+1)²F(s) ] |s=−1 (quotient rule)',
  derivVal: '−3.25',
  ruleA: 'cover-up for the simple poles and the highest repeated power — derivatives below it',
  ruleB: 'clear the denominator → identity → equate powers → matrix → solve  (no derivative)',
  identity: 's³ + 2s + 6 = A(s+1)²(s+3) + Bs(s+3) + Cs(s+1)(s+3) + Ds(s+1)²',
  system: [
    ['s³', 'A + C + D = 1'],
    ['s²', '5A + B + 4C + 2D = 0'],
    ['s¹', '7A + 3B + 3C + D = 2'],
    ['s⁰', '3A = 6'],
  ],
  matrix: {
    rows: [['1', '0', '1', '1'], ['5', '1', '4', '2'], ['7', '3', '3', '1'], ['3', '0', '0', '0']],
    unk: ['A', 'B', 'C', 'D'], rhs: ['1', '0', '2', '6'],
    tags: ['s³', 's²', 's¹', 's⁰'],
  },
  solved: 'A = 2,  B = −1.5,  C = −3.25,  D = 2.25',
  noDeriv: 'the algebra route never needed a derivative',
  coeffs: [
    { k: 'A', val: '2', pole: 'pole 0', deriv: false },
    { k: 'B', val: '−1.5', pole: '(s+1)²', deriv: false },
    { k: 'C', val: '−3.25', pole: '(s+1)', deriv: true },
    { k: 'D', val: '2.25', pole: 'pole −3', deriv: false },
  ],
  pair: 'K/(s+p)ᴺ ⟺ (K/(N−1)!) tᴺ⁻¹e⁻ᵖᵗ',
  terms: [
    ['2/s', '2', false],
    ['−1.5/(s+1)²', '−1.5·t e⁻ᵗ', true],
    ['−3.25/(s+1)', '−3.25e⁻ᵗ', false],
    ['2.25/(s+3)', '2.25e⁻³ᵗ', false],
  ],
  ft: '( 2 − 1.5·t e⁻ᵗ − 3.25e⁻ᵗ + 2.25e⁻³ᵗ ) u(t)',
  say: '2, minus 1.5 t e to the minus t, minus 3.25 e to the minus t, plus 2.25 e to the minus 3 t',
  through: 't·e⁻ᵖᵗ — the repeated-pole fingerprint · the critically damped shape',
  tradeoff: 'residue: a derivative per lower power  ·  algebra: a slightly larger matrix',
  tmax: 8,   // s
  f: (t) => 2 - 1.5 * t * Math.exp(-t) - 3.25 * Math.exp(-t) + 2.25 * Math.exp(-3 * t),
};

/* ═══ 3 YOUR TURN ═════════════════════════════════════════════════════════ */
// F(s) = (s+3)/(s(s+1)²) = 3/s − 2/(s+1)² − 3/(s+1);  f(t) = (3 − 2t·e^(−t) − 3e^(−t)) u(t)
const YT = {
  num: 's + 3',
  den: 's(s+1)²',
  ask: 'Find the lower coefficient with the derivative, or with the matrix. Then invert.',
  steps: [
    ['form', 'F(s) = A/s + B/(s+1)² + C/(s+1)'],
    ['cover-up', 'A = (s+3)/(s+1)² |s=0 = 3'],
    ['', 'B = (s+3)/s |s=−1 = 2/(−1) = −2'],
    ['derivative', 'C = d/ds [ (s+3)/s ] |s=−1 = −3/s² |s=−1 = −3'],
    ['or matrix', 's + 3 = A(s+1)\u00b2 + Bs + Cs(s+1)'],
    ['', 'A + C = 0,\u20022A + B + C = 1,\u2002A = 3'],
    ['expansion', 'F(s) = 3/s − 2/(s+1)² − 3/(s+1)'],
  ],
  terms: [
    ['3/s', '3', false],
    ['−2/(s+1)²', '−2·t e⁻ᵗ', true],
    ['−3/(s+1)', '−3e⁻ᵗ', false],
  ],
  ft: '( 3 − 2·t e⁻ᵗ − 3e⁻ᵗ ) u(t)',
  say: '3, minus 2 t e to the minus t, minus 3 e to the minus t',
  tmax: 8,   // s
  f: (t) => 3 - 2 * t * Math.exp(-t) - 3 * Math.exp(-t),
};

/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 16 }, (_, i) => 'pfe2_line' + (i + 1) + '.mp3'),
  durs: [17.16, 16.536, 7.584, 12.24, 13.656, 12.648, 7.416, 9.0, 7.752, 9.072, 10.704, 15.048, 11.64, 7.896, 11.544, 15.6],
  text: [
    'Here’s a repeated pole: the factor s plus one appears twice. It’s proper: degree three over degree four. The skeleton is the same — write the form, find the coefficients, invert — but repeated poles add one real wrinkle, and it’s worth seeing clearly.',
    'Step one, the form. A repeated factor needs one term for every power it appears in. So s plus one, squared, gives two terms — B over the square, and C over the first power — alongside the simple terms, A over s and D over s plus three.',
    'Step two, the coefficients. Same two methods as before, residue and algebra, and we’ll do both.',
    'By residue, the simple poles and the highest repeated power come easily. Cover the factor, set s to the pole: A is two, B is minus one-point-five, D is two-point-two-five.',
    'But here’s the catch with repeated poles. The lower coefficient, C, cannot be found by simple cover-up — at s equals minus one that term would blow up. For the lower powers, you must differentiate first.',
    'The rule: multiply F by the repeated factor squared, differentiate once with respect to s, then evaluate at the pole. That derivative is the extra work a repeated pole costs you.',
    'Carrying out that derivative — a quotient rule — and evaluating at minus one gives C equals minus three-point-two-five.',
    'Now the algebra method, on the same example. Multiply both sides by the whole denominator, and you’re left with a polynomial identity.',
    'Match powers on both sides — s cubed, s squared, s, and the constant — and you get four equations in the four unknowns.',
    'Stack them as a matrix: the four-by-four coefficient matrix, times the column A, B, C, D, equals the right-hand-side column.',
    'Solve, and you recover the same four numbers — and notice: the algebra route never needed a derivative. That’s exactly why it’s often the cleaner choice when poles repeat.',
    'Step three, invert. The simple terms give exponentials as before. The repeated factor is the new pair: B over s-plus-one squared inverts to B times t, e to the minus t — the tell-tale t-times-exponential.',
    'Putting it together: f of t is two, minus one-point-five t e-to-the-minus-t, minus three-point-two-five e-to-the-minus-t, plus two-point-two-five e-to-the-minus-three-t.',
    'That t-times-exponential term is the fingerprint of a repeated pole — and it’s the same shape as a critically damped circuit’s response.',
    'So repeated poles come down to the same three steps, with one caution: by residue, the lower powers each cost you a derivative; by algebra, you trade that for a slightly larger matrix.',
    'Your turn. On paper, expand F-of-s equals s plus three, over s times s plus one, squared. Find the lower coefficient with the derivative, or with the matrix. Then invert, and press Show solution.',
  ],
  caps: [
    'F(s) = (s³+2s+6)/(s(s+1)²(s+3)) — (s+1) is repeated · proper: degree 3 over degree 4',
    'STEP 1 F(s) = A/s + B/(s+1)² + C/(s+1) + D/(s+3)',
    'STEP 2 two ways: residue · algebra',
    'Cover-up: A = 2, B = −1.5, D = 2.25',
    'THE CATCH: C cannot come from cover-up — it blows up at s = −1',
    'Kₙ₋ₘ = (1/M!) dᴹ/dsᴹ[(s+p)ᴺF(s)] |s=−p (here N = 2, M = 1)',
    'C = d/ds[(s+1)²F(s)] |s=−1 = −3.25 (quotient rule)',
    'Algebra: s³+2s+6 = A(s+1)²(s+3) + Bs(s+3) + Cs(s+1)(s+3) + Ds(s+1)²',
    'Equate powers → four equations in A, B, C, D',
    'Matrix: [1 0 1 1; 5 1 4 2; 7 3 3 1; 3 0 0 0]·[A; B; C; D] = [1; 0; 2; 6]',
    'Solve → 2, −1.5, −3.25, 2.25 · no derivative required',
    'STEP 3 B/(s+1)² ⟺ B·t e⁻ᵗ (the repeated-pole pair)',
    'f(t) = (2 − 1.5t·e⁻ᵗ − 3.25e⁻ᵗ + 2.25e⁻³ᵗ) u(t)',
    't·e⁻ᵖᵗ = repeated-pole fingerprint = the critically damped shape',
    'residue → a derivative per lower power · algebra → a larger matrix',
    'Your turn — on paper: expand F(s) = (s+3)/(s(s+1)²), invert, then press Show solution.',
  ],
  rail: ['STEP 1 · the form', 'STEP 2·A · residue + d/ds', 'STEP 2·B · algebra + matrix', 'STEP 3 · invert'],
  card: {
    series: 'ECE 2003 · Inverse Laplace · 2 of 3',
    title: 'Lecture 6 · Inverse Laplace — Repeated Poles',
    sentence: 'You’ll take F(s) = (s³+2s+6) / (s(s+1)²(s+3)), where the pole at s = −1 is repeated, back to f(t).',
    steps: [
      'Write the partial-fraction form: one term for every power of the repeated factor.',
      'Find the coefficients two ways: cover-up plus one derivative, then algebra with a matrix. Same answer.',
      'Invert each term: K/(s+p)² ⟷ K·t·e⁻ᵖᵗ.',
    ],
    able: 'Expand any F(s) with a repeated real pole and write f(t). Then try one yourself.',
  },
  ui: {
    kicker: 'PARTIAL FRACTIONS · REPEATED POLES',
    title: 'One term per power',
    sub: 'F(s) = (s³+2s+6) / s(s+1)²(s+3)',
    header: 'Inverse Laplace',
    headerSub: '· repeated poles · the derivative catch',
    keyPoint: 'A pole repeated N times needs N terms; (s+p)² gives the t·e⁻ᵖᵗ term.',
    railHead: 'THE SKELETON',
    workHead: 'THE WORK',
    tapeHead: 'COEFFICIENT TAPE',
    ftHead: 'f(t) — INVERT TERM BY TERM',
    ftHeadYT: 'YOUR TURN — f(t)',
    methodHead: 'METHOD',
    methodTag: ['residue', 'algebra'],
    methodBtn: ['A · residue', 'B · algebra'],
    methodLong: ['METHOD A · RESIDUE + DERIVATIVE', 'METHOD B · ALGEBRA (MATRIX)'],
    tourTag: 'TOUR', exploreTag: 'EXPLORE',
    formLabel: 'STEP 1 — one term per power of the repeated factor',
    pairLabel: 'transform pair',
    easyLabel: 'plain cover-up',
    catchLabel: 'THE CATCH — lower repeated power',
    matrixLabel: 'MATRIX FORM (4×4)',
    sameNote: 'different work · same coefficients',
    derivBadge: 'd/ds',
    throughHead: 'THROUGH-LINE',
    notes: [
      '(s+1) appears twice — that is the whole wrinkle',
      'one term for every power of the repeated factor',
      'the same two routes as simple poles',
      'the simple poles and the top power come free',
      'cover-up fails on the lower power — it blows up',
      'differentiate once, then evaluate at the pole',
      'a quotient rule, then evaluate at the pole',
      'clear the denominator — no fractions left',
      'four powers → four equations',
      'a 4×4 instead of a derivative',
      'same four numbers, no differentiation',
      'the squared factor is the new pair',
      'term by term → the time function',
      'the same shape as a critically damped response',
      'pick your cost: a derivative or a bigger matrix',
      'work the new problem on paper, then show the solution',
    ],
    noteExplore: 'step with ◀ ▶ or switch the method — watch where the derivative appears',
    endTitle: 'Repeated poles ✓', endSub: 'try the Your-turn problem · or step through the worked example',
    srSummary: 'Inverse Laplace, repeated poles. ',
  },
};

/* ═══ 5 BEATS — one line of math at a time (focus rules R1–R7) ═══════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based), `from` the fraction of
// that clip at which the beat starts (estimated from the script; the clips are not shortened or moved).
//   rail    skeleton step: 0 form, 1 residue + d/ds, 2 algebra, 3 invert
//   method  0 residue, 1 algebra
//   cover   index of the covered factor of F(s) [s, (s+1)², (s+3)], or -1
//   land    coefficient that lands in the tape on this beat, or ''
//   power   power of s being matched (3..0) or -1;  mrows: matrix rows built so far
//   terms   f(t) terms spoken so far;  ft: the whole f(t) has been spoken
const P_COLOR = [POW0, POW1, POW2, POW3];           // colour of s⁰ … s³ (index = power)
const FACTORS = ['s', '(s+1)²', '(s+3)'];      // denominator factors of F(s)
const BEATS = [
  { id: 'intro', line: 1, from: 0.27, rail: 0, method: 0, cap: 'F(s) = (s³+2s+6)/(s(s+1)²(s+3)) — the factor (s+1) appears twice' },
  { id: 'proper', line: 1, from: 0.34, rail: 0, method: 0, cap: 'proper: degree 3 over degree 4' },
  { id: 'form', line: 2, from: 0, rail: 0, method: 0, cap: 'STEP 1 one term for every power of the repeated factor' },
  { id: 'two', line: 3, from: 0, rail: 1, method: 0, cap: 'STEP 2 the same two ways: residue · algebra' },
  { id: 'A-cover', line: 4, from: 0, rail: 1, method: 0, cover: 0, cap: 'Residue: cover the factor, set s to the pole' },
  { id: 'A-val', line: 4, from: 0.6, rail: 1, method: 0, cover: 0, land: 'A', cap: 'A = 2' },
  { id: 'B-val', line: 4, from: 0.73, rail: 1, method: 0, cover: 1, land: 'B', cap: 'B = −1.5' },
  { id: 'D-val', line: 4, from: 0.88, rail: 1, method: 0, cover: 2, land: 'D', cap: 'D = 2.25' },
  { id: 'catch', line: 5, from: 0, rail: 1, method: 0, cap: 'THE CATCH: C cannot come from cover-up — it blows up at s = −1' },
  { id: 'diff', line: 5, from: 0.72, rail: 1, method: 0, cap: 'for the lower powers, differentiate first' },
  { id: 'C-cover', line: 6, from: 0.08, rail: 1, method: 0, cover: 1, cap: 'multiply F by the repeated factor squared …' },
  { id: 'C-dds', line: 6, from: 0.36, rail: 1, method: 0, cover: 1, cap: '… differentiate once with respect to s …' },
  { id: 'C-at', line: 6, from: 0.55, rail: 1, method: 0, cover: 1, cap: '… then evaluate at the pole, s = −1' },
  { id: 'C-quot', line: 7, from: 0, rail: 1, method: 0, cover: 1, cap: 'the derivative, by the quotient rule' },
  { id: 'C-eval', line: 7, from: 0.5, rail: 1, method: 0, cover: 1, cap: 'evaluate at s = −1' },
  { id: 'C-val', line: 7, from: 0.8, rail: 1, method: 0, cover: 1, land: 'C', cap: 'C = −3.25' },
  { id: 'ident', line: 8, from: 0, rail: 2, method: 1, cap: 'Algebra: multiply both sides by the whole denominator' },
  { id: 'expand', line: 9, from: 0, rail: 2, method: 1, cap: 'Match powers on both sides' },
  { id: 'eq3', line: 9, from: 0.3, rail: 2, method: 1, power: 3, cap: 'match the s³ terms' },
  { id: 'eq2', line: 9, from: 0.42, rail: 2, method: 1, power: 2, cap: 'match the s² terms' },
  { id: 'eq1', line: 9, from: 0.52, rail: 2, method: 1, power: 1, cap: 'match the s terms' },
  { id: 'eq0', line: 9, from: 0.62, rail: 2, method: 1, power: 0, cap: 'match the constants — four equations, four unknowns' },
  { id: 'mat1', line: 10, from: 0, rail: 2, method: 1, mrows: 1, cap: 'Stack them as a matrix …' },
  { id: 'mat2', line: 10, from: 0.2, rail: 2, method: 1, mrows: 2, cap: '… the four-by-four coefficient matrix …' },
  { id: 'mat3', line: 10, from: 0.45, rail: 2, method: 1, mrows: 3, cap: '… times the column A, B, C, D …' },
  { id: 'mat4', line: 10, from: 0.7, rail: 2, method: 1, mrows: 4, cap: '… equals the right-hand-side column' },
  { id: 'solved', line: 11, from: 0, rail: 2, method: 1, cap: 'Solve → the same four numbers' },
  { id: 'noderiv', line: 11, from: 0.4, rail: 2, method: 1, cap: 'the algebra route never needed a derivative' },
  { id: 'pair1', line: 12, from: 0.1, rail: 3, method: 1, cap: 'STEP 3 simple terms: K/(s+p) ⟺ K·e⁻ᵖᵗ' },
  { id: 'pair2', line: 12, from: 0.45, rail: 3, method: 1, cap: 'the repeated factor: B/(s+1)² ⟺ B·t e⁻ᵗ' },
  { id: 't1', line: 13, from: 0.12, rail: 3, method: 1, terms: 1, cap: '2/s ⟺ 2' },
  { id: 't2', line: 13, from: 0.3, rail: 3, method: 1, terms: 2, cap: '−1.5/(s+1)² ⟺ −1.5·t e⁻ᵗ' },
  { id: 't3', line: 13, from: 0.55, rail: 3, method: 1, terms: 3, cap: '−3.25/(s+1) ⟺ −3.25e⁻ᵗ' },
  { id: 't4', line: 13, from: 0.78, rail: 3, method: 1, terms: 4, cap: '2.25/(s+3) ⟺ 2.25e⁻³ᵗ' },
  { id: 'ft', line: 14, from: 0, rail: 3, method: 1, terms: 4, ft: true, through: true, cap: 't·e⁻ᵖᵗ = repeated-pole fingerprint = the critically damped shape' },
  { id: 'trade', line: 15, from: 0, rail: 3, method: 1, terms: 4, ft: true, through: true, cap: 'residue → a derivative per lower power · algebra → a larger matrix' },
  { id: 'yt', line: 16, from: 0, rail: 3, method: 1, terms: 4, ft: true, through: true, cap: 'Your turn — on paper: expand F(s) = (s+3)/(s(s+1)²), invert, then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.trade;                                                // last derivation line (the Your-turn line is not one)
const LAND_AT = { A: IX['A-val'], B: IX['B-val'], C: IX['C-val'], D: IX['D-val'] };   // beat at which each coefficient is first spoken
const FIRST_OF_METHOD = [IX['A-cover'], IX.ident];                    // where each method's derivation starts
const VAL = { A: '2', B: '−1.5', C: '−3.25', D: '2.25' };

// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}
// coefficients the voice has given by beat i
const foundAt = (i) => ['A', 'B', 'C', 'D'].filter((k) => i >= LAND_AT[k]);

/* ═══ 6 PANELS ════════════════════════════════════════════════════════════ */
// identity with each bracket expanded; [text, power] tokens can be highlighted by power (focus rule R3)
const EXPANDED = [['s³', 3], '+', ['2s', 1], '+', ['6', 0], ' = A(', ['s³', 3], '+', ['5s²', 2], '+', ['7s', 1], '+', ['3', 0], ') + B(', ['s²', 2], '+', ['3s', 1],
  ') + C(', ['s³', 3], '+', ['4s²', 2], '+', ['3s', 1], ') + D(', ['s³', 3], '+', ['2s²', 2], '+', ['s', 1], ')'];
const SURVIVOR = '(s³+2s+6) / (s(s+3))';       // (s+1)²·F(s)
const SOLVED = 'A = 2, B = \u22121.5, C = \u22123.25, D = 2.25';   // compact form for the finished rows
const MINUS1 = '−1';

// focus content for beat b: the one line the voice is speaking
function focusOf(b) {
  const at = (v) => <KAt v={v} color={C_A} />;
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  switch (b.id) {
    case 'intro': return <span>{'F(s) = (s³+2s+6) / (s(s+1)²(s+3))'}</span>;
    case 'proper': return prose('proper: degree 3 over degree 4');
    case 'form': return <Eq text={'F(s) = ' + EX.form} />;
    case 'two': return prose('Find A, B, C, D two ways: residue, then algebra');
    case 'A-cover': return <span><KUnk k="A" />{' = s·F(s) | s = '}{at('0')}</span>;
    case 'A-val': return <span><KUnk k="A" />{' = s·F(s) | s = '}{at('0')}<KValue k="A" text={VAL.A} /></span>;
    case 'B-val': return <span><KUnk k="B" />{' = (s+1)²F(s) | s = '}{at(MINUS1)}<KValue k="B" text={VAL.B} /></span>;
    case 'D-val': return <span><KUnk k="D" />{' = (s+3)F(s) | s = '}{at('−3')}<KValue k="D" text={VAL.D} /></span>;
    case 'catch': return <span style={{ color: C_D }}><KUnk k="C" />{'/(s+1): cover-up blows up at s = −1'}</span>;
    case 'diff': return prose('lower power → differentiate first', C_D);
    case 'C-cover': return <span>{'(s+1)²F(s) = ' + SURVIVOR}</span>;
    case 'C-dds': return <span><KUnk k="C" />{' = d/ds [ ' + SURVIVOR + ' ]'}</span>;
    case 'C-at': return <span><KUnk k="C" />{' = d/ds[' + SURVIVOR.replace(/ /g, '') + '] | s = '}{at(MINUS1)}</span>;
    case 'C-quot': return <span><KUnk k="C" />{' = [(3s²+2)(s²+3s) − (s³+2s+6)(2s+3)]'}<br />{'  / (s²+3s)² | s = '}{at(MINUS1)}</span>;
    case 'C-eval': return <span><KUnk k="C" />{' = [(5)(−2) − (3)(1)] / (−2)²'}</span>;
    case 'C-val': return <span><KUnk k="C" />{' = [(5)(−2) − (3)(1)] / (−2)²'}<KValue k="C" text={VAL.C} /></span>;
    case 'ident': return <span><Eq text={'s³+2s+6 = A(s+1)²(s+3) + Bs(s+3)'} /><br /><Eq text={'  + Cs(s+1)(s+3) + Ds(s+1)²'} /></span>;
    case 'expand': return <span><KPower tokens={EXPANDED.slice(0, 17).concat([')'])} power={-1} colors={P_COLOR} /><br />{'\u2003\u2003'}<KPower tokens={['+ C('].concat(EXPANDED.slice(18))} power={-1} colors={P_COLOR} /></span>;
    case 'eq3': case 'eq2': case 'eq1': case 'eq0': {
      const row = EX.system[3 - b.power];
      return <span style={{ color: P_COLOR[b.power], fontWeight: 600 }}>{row[0] + ': '}<Eq text={row[1]} /></span>;
    }
    case 'mat1': case 'mat2': case 'mat3': case 'mat4':
      return <KMatrix rows={EX.matrix.rows} unk={EX.matrix.unk} rhs={EX.matrix.rhs} tags={EX.matrix.tags} shown={b.mrows} colors={[POW3, POW2, POW1, POW0]} rowH={30} />;
    case 'solved': return <span style={{ color: AMBER, fontWeight: 600 }}>{'A = 2, B = −1.5, C = −3.25, D = 2.25'}</span>;
    case 'noderiv': return prose(EX.noDeriv, C_B);
    case 'pair1': return <span>{'K/(s+p) ⟺ K·e⁻ᵖᵗ'}</span>;
    case 'pair2': return <span><KUnk k="B" />{'/(s+1)² ⟺ '}<KUnk k="B" /><span style={{ color: C_D, fontWeight: 600 }}>{'·t e⁻ᵗ'}</span></span>;
    case 't1': case 't2': case 't3': case 't4': {
      const t = EX.terms[b.terms - 1];
      return <span><span style={{ color: C_FS }}>{t[0]}</span>{' ⟺ '}<span style={{ color: t[2] ? C_D : C_FT, fontWeight: 600 }}>{t[1]}</span></span>;
    }
    case 'trade': return prose('residue: a derivative per lower power · algebra: a larger matrix');
    default: return <span style={{ color: C_FT, fontWeight: 600 }}>{'f(t) = ( 2 − 1.5·t e⁻ᵗ − 3.25e⁻ᵗ'}<br />{'  + 2.25e⁻³ᵗ ) u(t)'}</span>;
  }
}

// finished lines for beat index i: one compact row each, oldest first (focus rule R1)
function doneRows(i) {
  const rows = [], add = (key, node, color, size) => rows.push({ key, node, color, size });
  if (i > IX.form) add('form', <Eq text={'F(s) = ' + EX.form} />);
  if (i < IX.ident) {
    if (i > IX['A-val']) add('rA', <Eq text={'A = s·F(s)|s=0 = 2'} />);
    if (i > IX['B-val']) add('rB', <Eq text={'B = (s+1)²F(s)|s=−1 = −1.5'} />);
    if (i > IX['D-val']) add('rD', <Eq text={'D = (s+3)F(s)|s=−3 = 2.25'} />);
    if (i > IX.diff && i <= IX['C-val']) add('catch', <Eq text={'C: cover-up fails at s = −1 → differentiate first'} />, C_D);
    if (i > IX['C-cover'] && i <= IX['C-val']) add('surv', <span>{'(s+1)²F(s) = ' + SURVIVOR}</span>);
    if (i > IX['C-at'] && i <= IX['C-val']) add('dds', <Eq text={'C = d/ds[(s+1)²F(s)] |s=−1'} />);
    if (i > IX['C-val']) add('rC', <Eq text={'C = d/ds[(s+1)²F(s)]|s=−1 = −3.25 (one derivative)'} />);
  } else {
    add('res', <span>{'by residue (one d/ds):\u2002'}<Eq text={SOLVED} /></span>);
    if (i < IX.pair1) {
      if (i > IX.ident) add('ident', <Eq text={EX.identity} />, null, 15);
      if (i > IX.expand && i <= IX.eq0) add('expand', <KPower tokens={EXPANDED} power={BEATS[i].power} colors={P_COLOR} />, null, 15);
      [3, 2, 1, 0].forEach((pw) => { if (i > IX['eq' + pw]) add('eq' + pw, <span>{EX.system[3 - pw][0] + ': '}<Eq text={EX.system[3 - pw][1]} /></span>, P_COLOR[pw]); });
      if (i > IX.mat4) add('matrix', <Eq text={'[1 0 1 1; 5 1 4 2; 7 3 3 1; 3 0 0 0]·[A; B; C; D] = [1; 0; 2; 6]'} />, null, 15);
      if (i > IX.solved) add('solved', <Eq text={'solve \u2192 ' + SOLVED} />);
    } else {
      add('alg', <span>{'by algebra (no d/ds):\u2002'}<Eq text={SOLVED} /></span>);
      if (i > IX.pair1) add('pair1', <span>{'K/(s+p) ⟺ K·e⁻ᵖᵗ'}</span>);
      if (i > IX.pair2) add('pair2', <span>{'K/(s+p)² ⟺ K·t e⁻ᵖᵗ'}</span>, C_D);
      EX.terms.forEach((t, j) => { if (i > IX['t' + (j + 1)]) add('t' + j, <span>{t[0] + ' ⟺ ' + t[1]}</span>); });
      if (i > IX.ft) add('ftrow', <span>{'f(t) = ' + EX.ft}</span>, C_FT, 15);
    }
  }
  return rows;
}

// WorkZone: F(s) (with the cover), the finished lines, and the one focus line
function WorkZone({ ui, bi }) {
  const time = useTime(); const TL = useTL();
  if (bi < 0) return null;
  const b = BEATS[bi], tint = b.method === 0 ? C_A : C_B;
  const cover = b.cover != null ? b.cover : -1;
  const bar = b.rail === 0 ? C_FS : b.rail === 3 ? C_FT : (b.id === 'catch' || b.id === 'diff') ? C_D : tint;
  return (
    <KWork head={ui.workHead} badge={b.rail >= 1 && b.rail <= 2 ? ui.methodLong[b.method] : ''} badgeColor={tint}
      fs={<KFs num={EX.Fnum} factors={FACTORS} cover={cover} coverNote={cover >= 0 ? '← cover the factor ' + FACTORS[cover] : ''} />}
      rows={doneRows(bi)} focusId={b.id} bar={bar} opacity={bi >= 1 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1)}>
      {focusOf(b)}
    </KWork>
  );
}

// Tape: a slot reads "?" until the voice has said its value (R4); C is marked d/ds when it came from the derivative
function Tape({ ui, bi, reduced }) {
  if (bi < IX.form) return null;
  const b = BEATS[bi], found = foundAt(bi), tint = b.method === 0 ? C_A : C_B;
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint }}>{b.rail >= 1 ? ui.methodTag[b.method] : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {EX.coeffs.map((r) => {
          const got = found.indexOf(r.k) >= 0, mark = got && r.deriv && b.method === 0;
          return <KSlot key={r.k} k={r.k} value={r.val} sub={mark ? ui.derivBadge : r.pole} subColor={mark ? C_D : MUTE}
            got={got} landing={b.land === r.k || b.id === 'solved'} reduced={reduced} tint={C_K} />;
        })}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: tint, textAlign: 'center', minHeight: 17 }}>{bi >= IX.solved ? ui.sameNote : ''}</div>
    </div>
  );
}

// FtZone: a term appears when the voice says it; f(t) and its curve once the whole of f(t) has been spoken (R4).
// When the Your-turn solution is shown the panel holds that solution instead.
function FtZone({ ui, bi, yourTurn }) {
  if (bi < IX.form) return null;
  const b = BEATS[bi], src = yourTurn ? YT : EX;
  const nTerms = yourTurn ? YT.terms.length : (b.terms || 0), showFt = yourTurn || !!b.ft;
  const top = PANEL_TOP + TAPE_H + 10, h = PANEL_H - TAPE_H - 10;
  return (
    <div data-gate="ft" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h,
      display: 'flex', flexDirection: 'column', gap: 5 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 4 * 18 }}>
        {src.terms.slice(0, nTerms).map((t) => (
          <div key={t[0]} data-term="1" style={{ display: 'flex', alignItems: 'baseline', gap: 9, fontFamily: MONO, fontSize: FS_MIN, lineHeight: '18px' }}>
            <span style={{ color: C_FS, width: 112, flexShrink: 0, textAlign: 'right' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'⟺'}</span>
            <span style={{ color: t[2] ? C_D : C_FT, fontWeight: 600 }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_FT, lineHeight: '18px', minHeight: 36 }}>
        {showFt ? 'f(t) = ' + src.ft : ''}
      </div>
      <FtPlot f={src.f} tmax={src.tmax} width={SIDE_W - 26} height={h - 20 - 20 - 4 * 18 - 36 - 18} shown={showFt} color={C_FT} />
    </div>
  );
}

// BottomBand: method buttons, one-line-back / one-line-forward, and the through-line
function BottomBand({ ui, bi, goBeat, explore, note, yt }) {
  const b = BEATS[Math.max(0, bi)], inMethod = b.rail >= 1 && b.rail <= 2;
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 18, padding: '9px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {zoneHead(ui.methodHead)}<KMode explore={explore} ui={ui} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ui.methodBtn.map((mt, i) => (
            <button key={mt} type="button" aria-pressed={inMethod && b.method === i} onClick={() => goBeat(FIRST_OF_METHOD[i])}
              style={Object.assign(btnStyle(inMethod && b.method === i, i === 0 ? C_A : C_B), { flex: 1, fontSize: 14, padding: '6px 10px' })}>{mt}</button>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, whiteSpace: 'nowrap' }}>
          {'A: one derivative · B: a larger matrix'}
        </div>
      </div>
      <div style={{ width: 1, background: LINE }} />
      <KNav cur={clamp(bi, 0, LAST)} total={LAST + 1} goBeat={goBeat} yt={yt} note={note} width={300} />
      <div style={{ width: 1, background: LINE }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        {smallLabel(ui.throughHead)}
        <div data-through="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_D, textWrap: 'pretty', lineHeight: 1.35, minHeight: 18 }}>{b.through ? EX.through : ''}</div>
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

// SceneBody: which beat is on screen (from the playhead, or from the learner's ◀ ▶), and the layout
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1);          // beat chosen by hand; -1 while the tour drives
  useEffect(() => { if (playing) setHand(-1); }, [playing]);
  const shown = hand >= 0 ? hand : beatAt(TL, Math.min(time, TL.REVERT));
  const explore = hand >= 0 || time >= TL.EXPLORE;
  const goBeat = useCallback((i) => { setHand(i); yt.close(); if (playing) setPlaying(false); }, [playing]);

  const b = BEATS[Math.max(0, shown)];
  const lit = [shown >= IX.form, shown >= IX['A-cover'], shown >= IX.ident, shown >= IX.pair1];
  const note = hand >= 0 ? ui.noteExplore : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  // landing: the dot moves for LAND_MOVE s after the value beat starts; by hand the finished path is shown
  const landing = shown >= 0 && b.land && !yt.open ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
  const sr = foundAt(shown);

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={b.rail} lit={lit} tints={[C_FS, C_A, C_B, C_FT]}
        footer={<React.Fragment>{smallLabel(ui.pairLabel)}<div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_FT, fontWeight: 600, lineHeight: 1.45 }}>{EX.pair}</div></React.Fragment>} />
      <WorkZone ui={ui} bi={shown} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} bi={shown} reduced={reduced} />
      <FtZone ui={ui} bi={shown} yourTurn={yt.shown} />
      {landing && !reduced ? <Landing fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={landProg} /> : null}
      <BottomBand ui={ui} bi={shown} goBeat={goBeat} explore={explore} note={note} yt={yt} />

      <Captions sched={sched} lang={lang} text={shown >= 0 ? b.cap : ''} />
      <SeriesFinish ui={ui} n={6} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + 'F of s = (s cubed + 2 s + 6) over s (s+1) squared (s+3). ' + b.cap + '. ' +
        (sr.length ? 'Coefficients so far: ' + sr.map((k) => k + ' = ' + VAL[k]).join(', ') + '. ' : '') +
        (b.ft ? 'f of t = ' + EX.say + '. ' : '') +
        (yt.open ? 'Your turn: F of s = (s + 3) over s (s+1) squared.' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
