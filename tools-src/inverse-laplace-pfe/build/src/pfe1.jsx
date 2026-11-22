/* ═══ SCENE — Inverse Laplace · Simple Poles (PFE-1) ══════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  WORKED EXAMPLE        F(s) = 10s/((s+1)(s+2)(s+3)), sympy-verified by Director
     3  YOUR TURN             F(s) = (2s+8)/((s+1)(s+3)), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  BEATS                 one line of math at a time (focus rules R1–R7, briefing addendum 2)
     6  PANELS                FsDisplay, WorkZone, Tape, FtZone, BottomBand
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5;     // s: pause after each clip before the next line replaces it (focus rule R6)
const TAPE_H = 146;        // px: coefficient tape height
const C_FS = TEAL;         // F(s) and the expansion form
const C_K = AMBER;         // coefficients A, B, C
const C_A = BLUE;          // method A: residue (cover-up)
const C_B = PURPLE;        // method B: algebra (equate coefficients)
const C_FT = GREEN;        // f(t)

/* ═══ 2 WORKED EXAMPLE ════════════════════════════════════════════════════ */
const EX = {
  Fnum: '10s',
  Fden: '(s+1)(s+2)(s+3)',
  form: 'A/(s+1) + B/(s+2) + C/(s+3)',
  poles: [
    { k: 'A', p: 1, factor: '(s+1)', at: '−1', cover: '10s / (s+2)(s+3)', evalStr: '10(−1) / (1)(2)', val: '−5' },
    { k: 'B', p: 2, factor: '(s+2)', at: '−2', cover: '10s / (s+1)(s+3)', evalStr: '10(−2) / (−1)(1)', val: '20' },
    { k: 'C', p: 3, factor: '(s+3)', at: '−3', cover: '10s / (s+1)(s+2)', evalStr: '10(−3) / (−2)(−1)', val: '−15' },
  ],
  ruleA: 'Kᵢ = (s+pᵢ)·F(s) |s=−pᵢ — cover the factor, set s to its pole',
  ruleB: 'clear the denominator → identity → equate powers → matrix → solve',
  identity: '10s = A(s+2)(s+3) + B(s+1)(s+3) + C(s+1)(s+2)',
  system: [
    ['s²', 'A + B + C = 0'],
    ['s¹', '5A + 4B + 3C = 10'],
    ['s⁰', '6A + 3B + 2C = 0'],
  ],
  matrix: { rows: [['1', '1', '1'], ['5', '4', '3'], ['6', '3', '2']], unk: ['A', 'B', 'C'], rhs: ['0', '10', '0'], tags: ['s²', 's¹', 's⁰'] },
  solved: 'A = −5,  B = 20,  C = −15',
  pair: 'K/(s+p) ⟺ K·e⁻ᵖᵗ',
  terms: [
    ['−5/(s+1)', '−5e⁻ᵗ'],
    ['20/(s+2)', '20e⁻²ᵗ'],
    ['−15/(s+3)', '−15e⁻³ᵗ'],
  ],
  ft: '( −5e⁻ᵗ + 20e⁻²ᵗ − 15e⁻³ᵗ ) u(t)',
  say: 'minus 5 e to the minus t, plus 20 e to the minus 2 t, minus 15 e to the minus 3 t',
  tmax: 6,   // s
  f: (t) => -5 * Math.exp(-t) + 20 * Math.exp(-2 * t) - 15 * Math.exp(-3 * t),
};

/* ═══ 3 YOUR TURN ═════════════════════════════════════════════════════════ */
// F(s) = (2s+8)/((s+1)(s+3)) = 3/(s+1) − 1/(s+3);  f(t) = (3e^(−t) − e^(−3t)) u(t)
const YT = {
  num: '2s + 8',
  den: '(s+1)(s+3)',
  ask: 'Expand F(s) with either method, then invert.',
  steps: [
    ['form', 'F(s) = A/(s+1) + B/(s+3)'],
    ['cover-up', 'A = (2s+8)/(s+3) |s=−1 = 6/2 = 3'],
    ['', 'B = (2s+8)/(s+1) |s=−3 = 2/(−2) = −1'],
    ['or algebra', '2s + 8 = A(s+3) + B(s+1): A + B = 2, 3A + B = 8'],
    ['expansion', 'F(s) = 3/(s+1) − 1/(s+3)'],
  ],
  terms: [
    ['3/(s+1)', '3e⁻ᵗ'],
    ['−1/(s+3)', '−e⁻³ᵗ'],
  ],
  ft: '( 3e⁻ᵗ − e⁻³ᵗ ) u(t)',
  say: '3 e to the minus t, minus e to the minus 3 t',
  tmax: 6,   // s
  f: (t) => 3 * Math.exp(-t) - Math.exp(-3 * t),
};

/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 14 }, (_, i) => 'pfe1_line' + (i + 1) + '.mp3'),
  durs: [19.68, 12.864, 9.84, 14.04, 5.232, 8.376, 10.464, 9.696, 10.104, 9.864, 11.472, 8.976, 8.856, 13.296],
  text: [
    'We begin with F-of-s already factored, with three distinct real poles. It’s proper: the top is degree one, the bottom degree three, so we can expand it directly. Our goal is to recover f-of-t, and the procedure is always the same: write the form, find the coefficients, and invert.',
    'Step one: write the expansion form. Each distinct pole contributes one fraction with a single unknown constant on top — so here, three fractions, three unknowns: A, B, and C.',
    'Step two: find those constants. There are two standard ways, and they always agree. I’ll show you both, starting with the residue method.',
    'The residue, or cover-up, method: to get A, cover up its own factor, s plus one, in F-of-s, and then set s equal to that pole — minus one. Covering the factor is what isolates the one coefficient.',
    'Evaluating what’s left at s equals minus one gives A equals minus five.',
    'B and C come the same way — cover the factor, set s to that pole. B works out to twenty, and C to minus fifteen.',
    'Now the algebra method, on the same example. Multiply both sides by the whole denominator, and the fractions clear — you’re left with a plain polynomial identity.',
    'Both sides must match power by power. Lining up the s-squared, the s, and the constant terms gives three equations in A, B, and C.',
    'Now put those three equations into a matrix: the coefficient matrix, times the column of unknowns A, B, C, equals the column of right-hand-side values.',
    'Solve the matrix, and out come the same three numbers: minus five, twenty, minus fifteen. Different work, one answer — that’s the point.',
    'Step three: invert. A simple pole is the easy case — each fraction, a constant over s plus p, is just the transform of that constant times e to the minus p t.',
    'So term by term: f-of-t is minus five e-to-the-minus-t, plus twenty e-to-the-minus-two-t, minus fifteen e-to-the-minus-three-t.',
    'That’s the whole method: write the form, find the coefficients either way, invert. Simple poles always give plain exponentials.',
    'Your turn. On paper, expand F-of-s equals two s plus eight, over s plus one times s plus three. Use either method, then invert. When you’re done, press Show solution.',
  ],
  caps: [
    'F(s) = 10s/((s+1)(s+2)(s+3)) — three distinct real poles · proper: degree 1 over degree 3',
    'STEP 1 F(s) = A/(s+1) + B/(s+2) + C/(s+3)',
    'STEP 2 two ways to the coefficients: residue · algebra',
    'Residue: A = (s+1)F(s)|s=−1 (cover the factor, set s = −1)',
    'A = 10(−1)/((−1+2)(−1+3)) = −5',
    'Same move: B = 20, C = −15',
    'Algebra: 10s = A(s+2)(s+3) + B(s+1)(s+3) + C(s+1)(s+2)',
    'Equate powers: A+B+C = 0; 5A+4B+3C = 10; 6A+3B+2C = 0',
    'Matrix form: [1 1 1; 5 4 3; 6 3 2]·[A; B; C] = [0; 10; 0]',
    'Solve → A = −5, B = 20, C = −15 — same answer',
    'STEP 3 K/(s+p) ⟺ K·e⁻ᵖᵗ',
    'f(t) = (−5e⁻ᵗ + 20e⁻²ᵗ − 15e⁻³ᵗ) u(t)',
    'form → coefficients (either way) → invert · simple poles → exponentials',
    'Your turn — on paper: expand F(s) = (2s+8)/((s+1)(s+3)), invert, then press Show solution.',
  ],
  rail: ['STEP 1 · the form', 'STEP 2·A · residue', 'STEP 2·B · algebra', 'STEP 3 · invert'],
  card: {
    series: 'ECE 2003 · Inverse Laplace · 1 of 3',
    title: 'Inverse Laplace — Simple Poles',
    sentence: 'You’ll take F(s) = 10s / ((s+1)(s+2)(s+3)), three distinct real poles, back to f(t).',
    steps: [
      'Write the partial-fraction form: one term per pole.',
      'Find the coefficients two ways: cover-up, then algebra with a matrix. Same answer.',
      'Invert each term: K/(s+p) ⟷ K·e⁻ᵖᵗ.',
    ],
    able: 'Expand any F(s) with distinct real poles and write f(t). Then try one yourself.',
  },
  ui: {
    kicker: 'PARTIAL FRACTIONS · SIMPLE POLES',
    title: 'Two routes, one answer',
    sub: 'F(s) = 10s / (s+1)(s+2)(s+3)',
    header: 'Inverse Laplace',
    headerSub: '· simple poles · residue ↔ algebra',
    keyPoint: 'Each distinct real pole gives K/(s+p) ⟷ K·e⁻ᵖᵗ. F(s) must be proper.',
    railHead: 'THE SKELETON',
    workHead: 'THE WORK',
    tapeHead: 'COEFFICIENT TAPE',
    ftHead: 'f(t) — INVERT TERM BY TERM',
    ftHeadYT: 'YOUR TURN — f(t)',
    methodHead: 'METHOD',
    methodTag: ['residue', 'algebra'],
    methodBtn: ['A · residue', 'B · algebra'],
    methodLong: ['METHOD A · RESIDUE (COVER-UP)', 'METHOD B · ALGEBRA (EQUATE POWERS)'],
    tourTag: 'TOUR', exploreTag: 'EXPLORE',
    formLabel: 'STEP 1 — the expansion form',
    pairLabel: 'transform pair',
    sameNote: 'different work · same coefficients',
    notes: [
      'proper and factored — the precondition is already met',
      'one distinct pole, one fraction, one unknown',
      'two standard routes; they always agree',
      'covering the factor is what isolates that one coefficient',
      'evaluate the survivor at the pole',
      'B and C are the same move',
      'clear the denominator — no fractions left',
      'match s², s¹, s⁰ → three equations',
      'three equations, one matrix — Doug’s deck format',
      'the same three numbers, by a different road',
      'a simple pole is the easy pair',
      'term by term → the time function',
      'simple poles always give plain exponentials',
      'work the new problem on paper, then show the solution',
    ],
    noteExplore: 'step with ◀ ▶ or switch the method — the tape lands on the same numbers',
    endTitle: 'Simple poles ✓', endSub: 'try the Your-turn problem · or step through the worked example',
    srSummary: 'Inverse Laplace, simple poles. ',
  },
};

/* ═══ 5 BEATS — one line of math at a time (focus rules R1–R7) ═══════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based), `from` the fraction of
// that clip at which the beat starts (estimated from the script; the clips are not shortened or moved).
//   focus   what the focus area shows (the only full-strength line)
//   cap     caption text for the beat (never a value the voice has not said yet)
//   rail    skeleton step: 0 form, 1 residue, 2 algebra, 3 invert
//   method  0 residue, 1 algebra
//   cover   index of the pole whose factor is covered in F(s), or -1
//   land    coefficient that lands in the tape on this beat ('A', 'B', 'C'), or ''
//   found   coefficients known once this beat is on screen
//   power   power of s being matched (2, 1, 0) or -1
//   mrows   matrix rows built so far
//   terms   f(t) terms spoken so far;  ft: the whole f(t) has been spoken
const P_COLOR = [POW0, POW1, POW2];                 // colour of s⁰, s¹, s² (index = power)
const BEATS = [
  { id: 'intro', line: 1, from: 0.27, rail: 0, method: 0, cap: 'F(s) = 10s/((s+1)(s+2)(s+3)) — three distinct real poles' },
  { id: 'proper', line: 1, from: 0.36, rail: 0, method: 0, cap: 'proper: degree 1 over degree 3 — expand directly' },
  { id: 'form', line: 2, from: 0, rail: 0, method: 0, cap: 'STEP 1 one fraction per pole, one unknown on top' },
  { id: 'two', line: 3, from: 0, rail: 1, method: 0, cap: 'STEP 2 two ways to the coefficients: residue, then algebra' },
  { id: 'A-cover', line: 4, from: 0, rail: 1, method: 0, cover: 0, cap: 'Residue: to get A, cover A’s own factor (s+1) …' },
  { id: 'A-set', line: 4, from: 0.5, rail: 1, method: 0, cover: 0, cap: '… then set s = −1 in what is left' },
  { id: 'A-eval', line: 5, from: 0, rail: 1, method: 0, cover: 0, cap: 'Evaluate what is left at s = −1' },
  { id: 'A-val', line: 5, from: 0.6, rail: 1, method: 0, cover: 0, land: 'A', cap: 'A = −5' },
  { id: 'B-cover', line: 6, from: 0, rail: 1, method: 0, cover: 1, cap: 'Same move for B: cover (s+2), set s = −2' },
  { id: 'C-cover', line: 6, from: 0.3, rail: 1, method: 0, cover: 2, cap: 'Same move for C: cover (s+3), set s = −3' },
  { id: 'B-val', line: 6, from: 0.58, rail: 1, method: 0, cover: 1, land: 'B', cap: 'B = 20' },
  { id: 'C-val', line: 6, from: 0.82, rail: 1, method: 0, cover: 2, land: 'C', cap: 'C = −15' },
  { id: 'ident', line: 7, from: 0, rail: 2, method: 1, cap: 'Algebra: multiply both sides by the whole denominator' },
  { id: 'expand', line: 8, from: 0, rail: 2, method: 1, cap: 'Both sides must match power by power' },
  { id: 'eq2', line: 8, from: 0.42, rail: 2, method: 1, power: 2, cap: 'match the s² terms' },
  { id: 'eq1', line: 8, from: 0.56, rail: 2, method: 1, power: 1, cap: 'match the s terms' },
  { id: 'eq0', line: 8, from: 0.68, rail: 2, method: 1, power: 0, cap: 'match the constant terms — three equations in A, B, C' },
  { id: 'mat1', line: 9, from: 0, rail: 2, method: 1, mrows: 1, cap: 'Put the three equations into a matrix …' },
  { id: 'mat2', line: 9, from: 0.3, rail: 2, method: 1, mrows: 2, cap: '… coefficient matrix · column of unknowns …' },
  { id: 'mat3', line: 9, from: 0.6, rail: 2, method: 1, mrows: 3, cap: '… equals the column of right-hand sides' },
  { id: 'solve', line: 10, from: 0, rail: 2, method: 1, mrows: 3, cap: 'Solve the matrix …' },
  { id: 'solved', line: 10, from: 0.45, rail: 2, method: 1, cap: 'A = −5, B = 20, C = −15 — same answer' },
  { id: 'pair', line: 11, from: 0, rail: 3, method: 1, cap: 'STEP 3 K/(s+p) ⟺ K·e⁻ᵖᵗ' },
  { id: 't1', line: 12, from: 0, rail: 3, method: 1, terms: 1, cap: '−5/(s+1) ⟺ −5e⁻ᵗ' },
  { id: 't2', line: 12, from: 0.45, rail: 3, method: 1, terms: 2, cap: '20/(s+2) ⟺ 20e⁻²ᵗ' },
  { id: 't3', line: 12, from: 0.72, rail: 3, method: 1, terms: 3, cap: '−15/(s+3) ⟺ −15e⁻³ᵗ' },
  { id: 'ft', line: 13, from: 0, rail: 3, method: 1, terms: 3, ft: true, cap: 'form → coefficients (either way) → invert · simple poles → exponentials' },
  { id: 'yt', line: 14, from: 0, rail: 3, method: 1, terms: 3, ft: true, cap: 'Your turn — on paper: expand F(s) = (2s+8)/((s+1)(s+3)), invert, then press Show solution.' },
];
// beat index by id
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAND_AT = { A: IX['A-val'], B: IX['B-val'], C: IX['C-val'] };   // beat at which each coefficient is first spoken
const FIRST_OF_METHOD = [IX['A-cover'], IX.ident];                    // where each method's derivation starts

// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before line 1)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}
// coefficients the voice has given by beat i
const foundAt = (i) => EX.poles.map((p) => p.k).filter((k) => i >= LAND_AT[k]);

/* ═══ 6 PANELS ════════════════════════════════════════════════════════════ */
const mono = (size, color, weight) => ({ fontFamily: MONO, fontSize: size, color, fontWeight: weight || 400 });

// identity with each bracket expanded; `power` picks which terms are highlighted (focus rule R3)
const EXPANDED = [['10s', 1], ' = A(', ['s²', 2], '+', ['5s', 1], '+', ['6', 0], ') + B(', ['s²', 2], '+', ['4s', 1], '+', ['3', 0], ') + C(', ['s²', 2], '+', ['3s', 1], '+', ['2', 0], ')'];
function Expanded({ power }) {
  return (
    <React.Fragment>
      {EXPANDED.map((tk, i) => (typeof tk === 'string'
        ? <Eq key={i} text={tk} />
        : <span key={i} style={tk[1] === power ? { color: P_COLOR[tk[1]], fontWeight: 600, textDecoration: 'underline' } : undefined}>{tk[0]}</span>))}
    </React.Fragment>
  );
}

// F(s) with its denominator as three factors; `cover` lays the amber cover box over one of them (focus rule R3)
function FsDisplay({ cover }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46 }}>
      <span style={mono(SMALL_FS, MUTE)}>F(s) =</span>
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={mono(SMALL_FS, C_FS, 600)}>{EX.Fnum}</span>
        <span style={{ alignSelf: 'stretch', height: 2, background: C_FS }} />
        <span style={Object.assign({ display: 'flex' }, mono(SMALL_FS, C_FS, 600))}>
          {EX.poles.map((p, i) => (
            <span key={p.k} style={{ position: 'relative', padding: '1px 2px' }}>
              {p.factor}
              {cover === i ? (
                <span data-cover={p.k} style={{ position: 'absolute', inset: '-2px -1px', background: COVER_FILL, border: `1.5px solid ${COVER_STROKE}`,
                  borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: INK }}>cover</span>
              ) : null}
            </span>
          ))}
        </span>
      </div>
      {cover >= 0 ? <span style={{ fontFamily: HEAD, fontSize: SMALL_FS, color: INK }}>{'← cover ' + EX.poles[cover].k + '’s own factor'}</span> : null}
    </div>
  );
}

// big matrix for the focus area: rows appear one at a time, each in its power's colour
function BigMatrix({ rows }) {
  const m = EX.matrix, cell = { width: 30, textAlign: 'center', display: 'inline-block' };
  const line = (i) => ({ height: 34, lineHeight: '34px', fontFamily: MONO, fontSize: FOCUS_FS, color: P_COLOR[2 - i], fontWeight: 600, visibility: i < rows ? 'visible' : 'hidden' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div>{m.tags.map((t, i) => <div key={t} style={Object.assign(line(i), { fontSize: SMALL_FS, fontWeight: 400 })}>{t}</div>)}</div>
      <Bracket color={INK}>{m.rows.map((r, i) => <div key={i} style={line(i)}>{r.map((v, j) => <span key={j} style={cell}>{v}</span>)}</div>)}</Bracket>
      <Bracket color={AMBER}>{m.unk.map((u) => <div key={u} data-unk="1" style={{ height: 34, lineHeight: '34px', fontFamily: MONO, fontSize: FOCUS_FS, color: AMBER, fontWeight: 600, textAlign: 'center', width: 24 }}>{u}</div>)}</Bracket>
      <span style={mono(FOCUS_FS, INK)}>=</span>
      <Bracket color={INK}>{m.rhs.map((v, i) => <div key={i} style={Object.assign(line(i), { textAlign: 'center', width: 36 })}>{v}</div>)}</Bracket>
    </div>
  );
}

// the cover-up survivor for pole i, with s = pole shown in the method colour
function Survivor({ i, withAt }) {
  const p = EX.poles[i];
  return (
    <React.Fragment>
      <span data-unk="1" style={{ color: AMBER, fontWeight: 600 }}>{p.k}</span>{' = ' + p.cover.replace(' / ', ' / (') + ')'}
      {withAt ? <span>{' | s = '}<span style={{ color: C_A, fontWeight: 600 }}>{p.at}</span></span> : null}
    </React.Fragment>
  );
}
// the evaluation for pole i: every place s was now holds the pole value, in the method colour
function Evaluation({ i }) {
  const p = EX.poles[i], v = <span style={{ color: C_A, fontWeight: 600 }}>{p.at}</span>;
  const others = EX.poles.filter((_, j) => j !== i);
  return (
    <React.Fragment>
      <span data-unk="1" style={{ color: AMBER, fontWeight: 600 }}>{p.k}</span>{' = 10('}{v}{') / ('}
      {others.map((o) => <React.Fragment key={o.k}>{'('}{v}{'+' + o.p + ')'}</React.Fragment>)}{')'}
    </React.Fragment>
  );
}
// a value forming in the focus area (focus rule R5)
const BigValue = ({ k, text }) => <span data-landing-from={k} style={{ fontFamily: MONO, fontSize: VALUE_FS, fontWeight: 600, color: AMBER, marginLeft: 14 }}>{'= ' + text}</span>;

// focus content for beat b: the one line the voice is speaking
function focusOf(b) {
  const P = EX.poles;
  switch (b.id) {
    case 'intro': return <span>{'F(s) = 10s / ((s+1)(s+2)(s+3))'}</span>;
    case 'proper': return <span style={{ fontFamily: HEAD }}>{'proper: degree 1 over degree 3'}</span>;
    case 'form': return <Eq text={'F(s) = ' + EX.form} />;
    case 'two': return <span style={{ fontFamily: HEAD }}>{'Find A, B, C two ways: residue, then algebra'}</span>;
    case 'A-cover': return <span><span data-unk="1" style={{ color: AMBER, fontWeight: 600 }}>A</span>{' = (s+1)·F(s)'}</span>;
    case 'A-set': return <Survivor i={0} withAt />;
    case 'A-eval': return <Evaluation i={0} />;
    case 'A-val': return <span><Evaluation i={0} /><BigValue k="A" text={P[0].val} /></span>;
    case 'B-cover': return <Survivor i={1} withAt />;
    case 'C-cover': return <Survivor i={2} withAt />;
    case 'B-val': return <span><Evaluation i={1} /><BigValue k="B" text={P[1].val} /></span>;
    case 'C-val': return <span><Evaluation i={2} /><BigValue k="C" text={P[2].val} /></span>;
    case 'ident': return <span><Eq text={'10s = A(s+2)(s+3) + B(s+1)(s+3)'} /><br /><Eq text={'   + C(s+1)(s+2)'} /></span>;
    case 'expand': return <span><Eq text={'10s = A(s²+5s+6) + B(s²+4s+3)'} /><br /><Eq text={'   + C(s²+3s+2)'} /></span>;
    case 'eq2': case 'eq1': case 'eq0': {
      const row = EX.system[2 - b.power];
      return <span style={{ color: P_COLOR[b.power], fontWeight: 600 }}>{row[0] + ': '}<Eq text={row[1]} /></span>;
    }
    case 'mat1': case 'mat2': case 'mat3': case 'solve': return <BigMatrix rows={b.mrows} />;
    case 'solved': return <span style={{ fontSize: VALUE_FS, color: AMBER, fontWeight: 600 }}>{EX.solved}</span>;
    case 'pair': return <span>{'K/(s+p) ⟺ K·e⁻ᵖᵗ'}</span>;
    case 't1': case 't2': case 't3': {
      const t = EX.terms[b.terms - 1];
      return <span><span style={{ color: C_FS }}>{t[0]}</span>{' ⟺ '}<span style={{ color: C_FT, fontWeight: 600 }}>{t[1]}</span></span>;
    }
    default: return <span style={{ color: C_FT, fontWeight: 600 }}>{'f(t) = ' + EX.ft}</span>;
  }
}

// finished lines for beat index i: one compact row each, oldest first (focus rule R1)
function doneRows(i) {
  const rows = [], P = EX.poles, add = (key, node, color) => rows.push({ key, node, color });
  if (i > IX.form) add('form', <Eq text={'F(s) = ' + EX.form} />);
  if (i < IX.ident) {
    P.forEach((p, j) => { if (i > LAND_AT[p.k]) add('res' + p.k, <Eq text={p.k + ' = ' + p.factor + 'F(s)|s=' + p.at + ' = ' + p.val} />); });
  } else {
    add('res', <span>{'by residue: '}<Eq text={EX.solved} /></span>);
    if (i < IX.pair) {
      if (i > IX.ident) add('ident', <Eq text={EX.identity} />);
      if (i > IX.expand && i <= IX.eq0) add('expand', <Expanded power={BEATS[i].power} />);
      [2, 1, 0].forEach((pw) => { if (i > IX['eq' + pw]) add('eq' + pw, <span>{EX.system[2 - pw][0] + ': '}<Eq text={EX.system[2 - pw][1]} /></span>, P_COLOR[pw]); });
      if (i > IX.solve) add('matrix', <Eq text={'[1 1 1; 5 4 3; 6 3 2]·[A; B; C] = [0; 10; 0]'} />);
    } else {
      add('alg', <span>{'by algebra: '}<Eq text={EX.solved} />{' — same answer'}</span>);
      if (i > IX.pair) add('pair', <span>{'K/(s+p) ⟺ K·e⁻ᵖᵗ'}</span>);
      EX.terms.forEach((t, j) => { if (i > IX['t' + (j + 1)]) add('t' + j, <span>{t[0] + ' ⟺ ' + t[1]}</span>); });
    }
  }
  return rows;
}

// WorkZone: F(s) (with the cover), the finished lines as compact rows, and the one focus line
function WorkZone({ ui, bi }) {
  const time = useTime(); const TL = useTL();
  if (bi < 0) return null;
  const on = clamp((time - beatStart(TL, 0)) / 0.6, 0, 1);
  const b = BEATS[bi];
  const tint = b.method === 0 ? C_A : C_B;
  const rows = doneRows(bi);
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, opacity: bi >= 1 ? 1 : on,
      display: 'flex', flexDirection: 'column', gap: 8 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.workHead, ACCENT)}
        {b.rail >= 1 && b.rail <= 2 ? (
          <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: tint,
            border: `1px solid ${tint}`, borderRadius: 4, padding: '1px 7px' }}>{ui.methodLong[b.method]}</span>
        ) : null}
      </div>
      <FsDisplay cover={b.cover != null ? b.cover : -1} />
      <div data-done="1" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r) => <div key={r.key} data-done-row={r.key} style={Object.assign(mono(SMALL_FS, r.color || MUTE), { whiteSpace: 'nowrap', lineHeight: '22px' })}>{r.node}</div>)}
      </div>
      <div data-focus={b.id} style={{ marginTop: 4, borderLeft: `5px solid ${b.rail === 0 ? C_FS : b.rail === 3 ? C_FT : tint}`, paddingLeft: 14,
        minHeight: 44, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.4 }}>
        <span>{focusOf(b)}</span>
      </div>
    </div>
  );
}

// Tape: a slot reads "?" until the voice has said its value (focus rule R4); the landing slot is outlined (R5, R7)
function Tape({ ui, bi, reduced }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1]) / 0.6, 0, 1);
  if (on <= 0.01 && bi < IX.form) return null;
  const b = BEATS[Math.max(0, bi)], found = foundAt(bi);
  const tint = b.method === 0 ? C_A : C_B;
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H, opacity: bi >= IX.form ? 1 : on,
      display: 'flex', flexDirection: 'column', gap: 7 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint }}>{b.rail >= 1 ? ui.methodTag[b.method] : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {EX.poles.map((r) => {
          const got = found.indexOf(r.k) >= 0, landing = b.land === r.k || (b.id === 'solved');
          return (
            <div key={r.k} data-slot={r.k} style={{ flex: 1, border: `2px solid ${got ? C_K : LINE}`, borderRadius: 8,
              padding: '5px 6px', textAlign: 'center', background: got ? 'rgba(0,0,0,0.02)' : 'transparent',
              outline: landing && got && reduced ? `3px solid ${C_K}` : 'none', outlineOffset: 2 }}>
              <div data-unk="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_K, fontWeight: 600, lineHeight: 1.2 }}>{r.k}</div>
              <div data-tape={r.k} style={{ fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: got ? INK : MUTE,
                fontVariantNumeric: 'tabular-nums', lineHeight: '30px' }}>{got ? r.val : '?'}</div>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.2 }}>{'pole −' + r.p}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: tint, textAlign: 'center', minHeight: 17 }}>
        {bi >= IX.solved ? ui.sameNote : ''}
      </div>
    </div>
  );
}

// FtZone: a term appears when the voice says it; f(t) and its curve appear once the whole of f(t) has been spoken (R4).
// When the Your-turn solution is shown the panel holds that solution instead.
function FtZone({ ui, bi, yourTurn }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1] - 0.2) / 0.6, 0, 1);
  if (on <= 0.01 && bi < IX.form) return null;
  const b = BEATS[Math.max(0, bi)];
  const src = yourTurn ? YT : EX;
  const nTerms = yourTurn ? YT.terms.length : (b.terms || 0), showFt = yourTurn || !!b.ft;
  const top = PANEL_TOP + TAPE_H + 10, h = PANEL_H - TAPE_H - 10;
  return (
    <div data-gate="ft" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, opacity: bi >= IX.form ? 1 : on,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: src.terms.length * 21 }}>
        {src.terms.slice(0, nTerms).map((t) => (
          <div key={t[0]} data-term="1" style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: MONO, fontSize: 14, lineHeight: '20px' }}>
            <span style={{ color: C_FS, width: 104, flexShrink: 0, textAlign: 'right' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'⟺'}</span>
            <span style={{ color: C_FT, fontWeight: 600 }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_FT, lineHeight: '20px', minHeight: 20 }}>
        {showFt ? 'f(t) = ' + src.ft : ''}
      </div>
      <FtPlot f={src.f} tmax={src.tmax} width={SIDE_W - 26} height={h - 20 - 22 - 3 * 21 - 44} shown={showFt} color={C_FT} />
    </div>
  );
}

// BottomBand: method toggle, one-line-back / one-line-forward, and the method stamp
function BottomBand({ ui, bi, goBeat, explore, note, yt }) {
  const b = BEATS[Math.max(0, bi)];
  const cur = clamp(bi, 0, IX.ft);   // the Your-turn line is not a derivation line
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 18, padding: '9px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {zoneHead(ui.methodHead)}
          <span data-mode="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em',
            color: explore ? ACCENT : MUTE, border: `1px solid ${explore ? ACCENT : MUTE}`, borderRadius: 4, padding: '0 6px' }}>
            {explore ? ui.exploreTag : ui.tourTag}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ui.methodBtn.map((mt, i) => (
            <button key={mt} type="button" aria-pressed={b.rail >= 1 && b.rail <= 2 && b.method === i} onClick={() => goBeat(FIRST_OF_METHOD[i])}
              style={Object.assign(btnStyle(b.rail >= 1 && b.rail <= 2 && b.method === i, i === 0 ? C_A : C_B), { flex: 1, fontSize: 14, padding: '8px 10px' })}>{mt}</button>
          ))}
        </div>
      </div>

      <div style={{ width: 1, background: LINE }} />

      <div style={{ width: 330, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => goBeat(Math.max(0, cur - 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="previous line">{'◀'}</button>
          <button type="button" onClick={() => goBeat(Math.min(IX.ft, cur + 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="next line">{'▶'}</button>
          <span data-step="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE }}>{'line ' + (cur + 1) + ' of ' + (IX.ft + 1)}</span>
          {yt.reached && !yt.open
            ? <button type="button" onClick={yt.reopen} style={Object.assign(btnStyle(true, ACCENT), { marginLeft: 'auto' })}>Your turn</button> : null}
        </div>
        <div data-note="1" style={{ fontFamily: HEAD, fontSize: 13.5, color: INK, textWrap: 'pretty', lineHeight: 1.35 }}><Eq text={note} /></div>
      </div>

      <div style={{ width: 1, background: LINE }} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
        {smallLabel('THE STAMP')}
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, textWrap: 'pretty', lineHeight: 1.4 }}>
          {'F(s) = Σ Kᵢ/(s+pᵢ)  ·  Kᵢ by cover-up or by matching powers  ·  K/(s+p) ⟺ K e⁻ᵖᵗ'}
        </div>
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
  const tourBi = beatAt(TL, Math.min(time, TL.REVERT));
  const shown = hand >= 0 ? hand : tourBi;
  const explore = hand >= 0 || time >= TL.EXPLORE;
  const goBeat = useCallback((i) => { setHand(i); yt.close(); if (playing) setPlaying(false); }, [playing]);

  const b = BEATS[Math.max(0, shown)];
  const lit = [shown >= IX.form, shown >= IX['A-cover'], shown >= IX.ident, shown >= IX.pair];
  const noteIdx = clamp(b.line - 1, 0, ui.notes.length - 1);
  const note = (hand >= 0) ? ui.noteExplore : ui.notes[noteIdx];
  // landing: the dot moves for LAND_MOVE s after the value beat starts; by hand the finished path is shown
  const landing = shown >= 0 && b.land && !yt.open ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
  const sr = foundAt(shown);

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={b.rail} lit={lit} tints={[C_FS, C_A, C_B, C_FT]}
        footer={<React.Fragment>{smallLabel(ui.pairLabel)}<div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_FT, fontWeight: 600 }}>{EX.pair}</div></React.Fragment>} />
      <WorkZone ui={ui} bi={shown} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} bi={shown} reduced={reduced} />
      <FtZone ui={ui} bi={shown} yourTurn={yt.shown} />
      {landing && !reduced ? <Landing fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={landProg} /> : null}
      <BottomBand ui={ui} bi={shown} goBeat={goBeat} explore={explore} note={note} yt={yt} />

      <Captions sched={sched} lang={lang} text={shown >= 0 ? b.cap : ''} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + 'F of s = 10 s over (s+1)(s+2)(s+3). ' + b.cap + '. ' +
        (sr.length ? 'Coefficients so far: ' + sr.map((k) => k + ' = ' + EX.poles.find((p) => p.k === k).val).join(', ') + '. ' : '') +
        (b.ft ? 'f of t = ' + EX.say + '. ' : '') +
        (yt.open ? 'Your turn: F of s = (2 s + 8) over (s+1)(s+3).' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
