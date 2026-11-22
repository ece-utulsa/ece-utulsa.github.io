/* ═══ SCENE — Inverse Laplace · Complex Poles (PFE-3) ═════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  LIVE MODEL            F(s) = 60/((s+1)(s²+bs+c)); worked example b = 4, c = 13 (sympy-verified by Director)
     3  YOUR TURN             F(s) = 20/((s+2)(s²+2s+10)), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  PANELS                WorkZone, Tape, FtZone, BottomBand
     6  TOUR                  narration line -> what is shown
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const K_NUM = 60;          // numerator constant of the worked example
const POLE = 1;            // the real pole is at s = −POLE
const B0 = 4, C0 = 13;     // worked-example quadratic s² + B0·s + C0
const B_MIN = 0.5, B_MAX = 9, C_MIN = 1, C_MAX = 30, QUAD_STEP = 0.5;   // Explore slider ranges
const DETAIL_MAX = 4;      // rows revealed in full within a step
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

/* ═══ 5 PANELS ════════════════════════════════════════════════════════════ */
// row "match s / match 1" inside a derivation
const matchRow = (label, body, color) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 62, flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color, whiteSpace: 'nowrap' }}>{body}</span>
  </div>
);

// WorkZone: step 2 (algebra and matrix) or step 3 (complete the square, split the numerator) for the live quadratic
function WorkZone({ ui, m, step, d2, d3 }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.FS_ON) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const showSq = step >= 3;
  const numerator = MINUS + '(' + num(-m.B) + 's ' + signed(-m.C) + ')';
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.workHead, ACCENT)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: showSq ? C_SQ : C_ALG,
          border: `1px solid ${showSq ? C_SQ : C_ALG}`, borderRadius: 4, padding: '1px 7px' }}>
          {showSq ? 'STEP 3 · COMPLETE THE SQUARE' : 'STEP 2 · ALGEBRA (MATRIX)'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 18, color: MUTE }}>F(s) =</span>
        <Frac num={String(K_NUM)} den={'(s+1)(' + quadStr(m) + ')'} size={18} color={C_FS} />
      </div>

      <div className={up(step >= 1)} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4 }}>
        {smallLabel(ui.formLabel)}
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C_FS, marginTop: 1 }}>
          <Eq text={'F(s) = A/(s+1) + (Bs + C)/(' + quadStr(m) + ')'} />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!showSq ? (
          <div className={up(d2 > 0)} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_ALG }}>{ui.whyAlg}</div>
            <div className={up(d2 >= 1)} style={{ fontFamily: MONO, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}>
              <Eq text={K_NUM + ' = A(' + quadStr(m) + ') + B(s² + s) + C(s + 1)'} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className={up(d2 >= 2)} style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[['s²', 'A + B = 0'], ['s¹', num(m.b) + 'A + B + C = 0'], ['s⁰', num(m.c) + 'A + C = ' + K_NUM]].map((row) => (
                  <div key={row[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 20, flexShrink: 0 }}>{row[0]}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, color: C_ALG, whiteSpace: 'nowrap' }}><Eq text={row[1]} /></span>
                  </div>
                ))}
              </div>
              <div className={up(d2 >= 3)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5,
                borderLeft: `1px solid ${LINE}`, paddingLeft: 16 }}>
                {smallLabel(ui.matrixLabel)}
                <Matrix rows={[['1', '1', '0'], [num(m.b), '1', '1'], [num(m.c), '0', '1']]} unk={['A', 'B', 'C']}
                  rhs={['0', '0', String(K_NUM)]} tags={['s²', 's¹', 's⁰']} tint={C_ALG} />
              </div>
            </div>
            <div className={up(d2 >= DETAIL_MAX)} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_K }}>
                {'→  A = ' + num(m.A) + ',  B = ' + num(m.B) + ',  C = ' + num(m.C)}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13.5, color: C_FS }}>
                {'F(s) = ' + num(m.A) + '/(s+1) ' + MINUS + ' (' + num(-m.B) + 's ' + signed(-m.C) + ')/(' + quadStr(m) + ')'}
              </div>
            </div>
          </div>
        ) : !m.complex ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ border: `1px solid ${C_SQ}`, borderRadius: 8, padding: '10px 12px',
              background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: C_SQ }}>NOT A COMPLEX PAIR</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: INK }}>
                {'Δ = ' + num(m.disc) + ' ≥ 0 — ' + quadStr(m) + ' has real roots'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, textWrap: 'pretty' }}>
                {'completing the square gives no β — factor into two real poles instead (SD-2a · PFE-1)'}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE }}>
              {'roots:  s = ' + num((-m.b + Math.sqrt(m.disc)) / 2) + ',  s = ' + num((-m.b - Math.sqrt(m.disc)) / 2)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className={up(d3 >= 1)} style={{ border: `1px solid ${C_SQ}`, borderRadius: 8, padding: '4px 9px',
              background: d3 >= 1 ? 'rgba(0,0,0,0.02)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: C_SQ }}>{ui.sqLabel}</div>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, whiteSpace: 'nowrap' }}>
                {'set ' + quadStr(m) + ' = (s+α)² + β² = s² + 2αs + (α² + β²)'}
              </div>
              {matchRow('match s', '2α = ' + num(m.b) + '  →  α = ' + num(m.b) + '/2 = ' + num(m.alpha), INK)}
              {matchRow('match 1', 'α² + β² = ' + num(m.c) + '  →  β² = ' + num(m.c) + ' − ' + num(alpha2(m)) + ' = ' + num(beta2(m)), INK)}
              <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>
                  {quadStr(m) + '  =  ' + sqStr(m)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C_SQ, whiteSpace: 'nowrap' }}>
                  {'α = ' + num(m.alpha) + ',  β = +√' + num(beta2(m)) + ' = ' + num(betaS(m))}
                </span>
              </div>
              <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: C_SQ, textWrap: 'pretty', lineHeight: 1.25 }}>
                {'always take β > 0 — a negative β only flips the sine term, and B₁ already carries that sign'}
              </div>
            </div>

            <div className={up(d3 >= 2)} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {smallLabel(ui.splitLabel)}
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, whiteSpace: 'nowrap' }}>
                {numerator + ' = A₁(s + ' + num(m.alpha) + ') + B₁·' + num(betaS(m))
                  + '  =  A₁s + (A₁·' + num(m.alpha) + ' + B₁·' + num(betaS(m)) + ')'}
              </div>
              <div className={up(d3 >= 3)} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {matchRow('match s', 'A₁ = ' + num(m.B), C_COS)}
                {matchRow('match 1', 'A₁·' + num(m.alpha) + ' + B₁·' + num(betaS(m)) + ' = ' + num(m.C)
                  + '  →  B₁ = (' + num(m.C) + ' − (' + num(m.A1) + ')(' + num(m.alpha) + '))/' + num(betaS(m)), C_FT)}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_COS }}>{'A₁ = ' + num(m.A1) + '  (cos)'}</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_FT }}>{'B₁ = ' + num(m.B1) + '  (sin)'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tape: A, B, C from the matrix, then α, β and the cosine / sine coefficients from the completed square
function Tape({ ui, m, gotABC, gotSq }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1]) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const card = (k, v, sub, got, tint) => (
    <div key={k} style={{ flex: 1, border: `1px solid ${got ? tint : LINE}`, borderRadius: 8, padding: '3px 4px',
      textAlign: 'center', background: got ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
      <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint, fontWeight: 600, lineHeight: 1.2 }}>{k}</div>
      <div data-tape={k} style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: got ? INK : UPCOMING,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{got ? v : '—'}</div>
      <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.2 }}>{sub}</div>
    </div>
  );
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_ALG }}>{'algebra · matrix'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {card('A', num(m.A), 'pole −1', gotABC, C_K)}
        {card('B', num(m.B), 's coeff', gotABC, C_K)}
        {card('C', num(m.C), 'constant', gotABC, C_K)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {card('α', num(m.alpha), 'decay', gotSq && m.complex, C_SQ)}
        {card('β', num(betaS(m)), 'ring', gotSq && m.complex, C_SQ)}
        {card('A₁', num(m.A1), 'cos', gotSq && m.complex, C_COS)}
        {card('B₁', num(m.B1), 'sin', gotSq && m.complex, C_FT)}
      </div>
    </div>
  );
}

// FtZone: transform pairs, f(t) and its plot with the decay envelope — for the live quadratic, or for the Your-turn solution when shown
function FtZone({ ui, m, showPairs: wantPairs, showFt: wantFt, yourTurn }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1] - 0.2) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const ok = yourTurn || m.complex;
  const showPairs = wantPairs && ok, showFt = wantFt && ok;
  const model = yourTurn ? YT_MODEL : m;
  const terms = yourTurn ? YT.terms : [
    [num(m.A) + '/(s+1)', num(m.A) + 'e⁻ᵗ', C_FT],
    [num(m.A1) + '(s+' + num(m.alpha) + ')/[' + denSq(m) + ']', num(m.A1) + 'e⁻' + num(m.alpha) + 'ᵗcos ' + num(betaS(m)) + 't', C_COS],
    [num(m.B1) + '·[' + num(betaS(m)) + '/(' + denSq(m) + ')]', num(m.B1) + 'e⁻' + num(m.alpha) + 'ᵗsin ' + num(betaS(m)) + 't', C_FT],
  ];
  const ftStr = yourTurn ? YT.ft : '( ' + num(m.A) + 'e⁻ᵗ ' + signed(m.A1) + 'e⁻' + num(m.alpha) + 'ᵗcos ' + num(betaS(m)) + 't '
    + signed(m.B1) + 'e⁻' + num(m.alpha) + 'ᵗsin ' + num(betaS(m)) + 't ) u(t)';
  const top = PANEL_TOP + TAPE_H + 10, h = PANEL_H - TAPE_H - 10;
  return (
    <div data-gate="ft" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 3 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div className={up(showPairs)} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {terms.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: MONO, fontSize: FS_MIN, lineHeight: '17px' }}>
            <span style={{ color: C_FS, width: 186, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'⟺'}</span>
            <span style={{ color: t[2], fontWeight: 600, whiteSpace: 'nowrap' }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: showFt ? C_FT : (ok ? UPCOMING : C_SQ),
        lineHeight: '17px', minHeight: 34 }}>
        {showFt ? 'f(t) = ' + ftStr : ok ? 'f(t) = —' : 'f(t): two real exponentials (Δ ≥ 0); see PFE-1'}
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

// BottomBand: the live quadratic (Explore), step-back / step-forward, and the through-line (spec V5: no second step rail)
function BottomBand({ ui, m, step, setStep, setB, setC, explore, onGrab, note, showThrough, yt }) {
  const go = (n) => { onGrab(); setStep(n); };
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 18, padding: '9px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {zoneHead(ui.quadHead)}
          <span data-quad="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_FS, whiteSpace: 'nowrap' }}>{quadStr(m)}</span>
          <span data-mode="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em',
            color: explore ? ACCENT : MUTE, border: `1px solid ${explore ? ACCENT : MUTE}`, borderRadius: 4, padding: '0 6px' }}>
            {explore ? ui.exploreTag : ui.tourTag}
          </span>
        </div>
        <Slider label="b" value={m.b} min={B_MIN} max={B_MAX} step={QUAD_STEP} onChange={(v) => { onGrab(); setB(v); }} />
        <Slider label="c" value={m.c} min={C_MIN} max={C_MAX} step={QUAD_STEP} onChange={(v) => { onGrab(); setC(v); }} />
      </div>

      <div style={{ width: 1, background: LINE }} />

      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => go(Math.max(1, step - 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="previous step">{'◀'}</button>
          <button type="button" onClick={() => go(Math.min(3, step + 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="next step">{'▶'}</button>
          <span data-step="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE }}>{step >= 1 ? 'step ' + step + ' of 3' : 'before step 1'}</span>
          {yt.reached && !yt.open
            ? <button type="button" onClick={yt.reopen} style={Object.assign(btnStyle(true, ACCENT), { marginLeft: 'auto' })}>Your turn</button> : null}
        </div>
        <div data-note="1" style={{ fontFamily: HEAD, fontSize: 13.5, color: INK, textWrap: 'pretty', lineHeight: 1.35 }}><Eq text={note} /></div>
      </div>

      <div style={{ width: 1, background: LINE }} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
        {smallLabel(ui.throughHead)}
        {m.complex ? (
          <React.Fragment>
            <div className={up(showThrough)} style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_SQ, lineHeight: 1.3 }}>{ui.through}</div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, whiteSpace: 'nowrap', lineHeight: 1.3 }}>{ui.throughSub}</div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.3 }}>
              {'α = ' + num(m.alpha) + '  ·  β = ' + num(betaS(m)) + '  ·  Δ = ' + num(m.disc)}
            </div>
          </React.Fragment>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_SQ, textWrap: 'pretty', lineHeight: 1.45 }}>{ui.realNote}</div>
        )}
      </div>
    </div>
  );
}

/* ═══ 6 TOUR ══════════════════════════════════════════════════════════════ */
// what is shown at `time`: narration line n starts at TL.L[n-1]
function tourState(TL, time) {
  const L = TL.L;
  const at = (n) => time >= L[n - 1];
  const frac = (n) => clamp((time - L[n - 1]) / TL.durs[n - 1], 0, 1);
  let step = 0, d2 = 0, d3 = 0, pairs = false, ft = false, through = false;
  if (at(2)) step = 1;
  if (at(3)) { step = 2; d2 = 1; }
  if (at(4)) d2 = 2;
  if (at(5)) d2 = 3;
  if (at(6)) d2 = frac(6) > 0.3 ? DETAIL_MAX : 3;
  if (at(7)) { step = 3; d2 = DETAIL_MAX; d3 = frac(7) > 0.35 ? 1 : 0; }
  if (at(8)) d3 = 2;
  if (at(9)) d3 = frac(9) > 0.4 ? 3 : 2;
  if (at(10)) d3 = DETAIL_MAX;
  if (at(11)) { d3 = DETAIL_MAX; pairs = frac(11) > 0.25; }
  if (at(12)) { pairs = true; ft = frac(12) > 0.25; }
  if (at(13)) { pairs = true; ft = true; through = frac(13) > 0.2; }
  if (at(14)) { pairs = true; ft = true; through = true; }
  return { step, d2, d3, pairs, ft, through };
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

// SceneBody: tour state, the live quadratic and the layout
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const [grabbed, setGrabbed] = useState(false);
  const [quad, setQuad] = useState({ b: B0, c: C0 });
  const [st, setSt] = useState({ step: 0, d2: 0, d3: 0, pairs: false, ft: false, through: false });
  const explore = time >= TL.EXPLORE || grabbed;
  const grab = useCallback(() => { setGrabbed(true); yt.close(); if (playing) setPlaying(false); }, [playing]);
  useEffect(() => { if (playing) { setGrabbed(false); setQuad({ b: B0, c: C0 }); } }, [playing]);

  const apply = useCallback((s) => setSt((p) =>
    (p.step === s.step && p.d2 === s.d2 && p.d3 === s.d3 && p.pairs === s.pairs && p.ft === s.ft && p.through === s.through) ? p : s), []);

  const m = useMemo(() => solve(quad.b, quad.c), [quad.b, quad.c]);
  const step = explore ? Math.max(1, st.step) : st.step;
  const d2 = explore ? (step >= 2 ? DETAIL_MAX : 0) : st.d2;
  const d3 = explore ? (step >= 3 ? DETAIL_MAX : 0) : st.d3;
  const setStep = (n) => setSt((p) => Object.assign({}, p, { step: n, d2: n >= 2 ? DETAIL_MAX : 0, d3: n >= 3 ? DETAIL_MAX : 0, pairs: n >= 3, ft: n >= 3 }));

  const active = step >= 3 ? (d3 >= 2 ? 3 : 2) : step === 2 ? 1 : 0;
  const lit = [step >= 1, step >= 2, step >= 3, step >= 3 && d3 >= 2];
  const noteIdx = clamp(idxAt(sched, time), 0, ui.notes.length - 1);
  const note = (explore && !yt.open) ? ui.noteExplore : ui.notes[noteIdx];
  const ytShown = yt.shown;
  const pairStyle = { fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, lineHeight: 1.35 };

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={active} lit={lit} tints={[C_FS, C_ALG, C_SQ, C_FT]}
        footer={<React.Fragment>
          {smallLabel(ui.pairLabel)}
          <div style={Object.assign({ color: C_COS }, pairStyle)}>{'(s+α)/[(s+α)²+β²] ⟺ e⁻ᵅᵗcos βt'}</div>
          <div style={Object.assign({ color: C_FT }, pairStyle)}>{'β/[(s+α)²+β²] ⟺ e⁻ᵅᵗsin βt'}</div>
          <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: m.complex ? MUTE : C_SQ }}>{'Δ = ' + num(m.disc)}</div>
        </React.Fragment>} />
      <WorkZone ui={ui} m={m} step={step} d2={d2} d3={d3} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} m={m} gotABC={step >= 2 && d2 >= DETAIL_MAX} gotSq={step >= 3 && d3 >= 3} />
      <FtZone ui={ui} m={m} yourTurn={ytShown} showPairs={ytShown || (explore ? step >= 3 : st.pairs)} showFt={ytShown || (explore ? step >= 3 : st.ft)} />
      <BottomBand ui={ui} m={m} step={step} setStep={setStep}
        setB={(v) => setQuad((q) => ({ b: v, c: q.c }))} setC={(v) => setQuad((q) => ({ b: q.b, c: v }))}
        explore={explore} onGrab={grab} note={note} showThrough={explore || st.through} yt={yt} />

      <Captions sched={sched} lang={lang} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <TourDriver apply={apply} grabbed={grabbed} tourState={tourState} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + 'F of s = 60 over (s+1)(' + quadStr(m) + '). Step ' + Math.max(1, step) + ' of 3. ' +
        'A = ' + num(m.A) + ', B = ' + num(m.B) + ', C = ' + num(m.C) + '. ' +
        (m.complex ? 'Completed square gives alpha ' + num(m.alpha) + ' and beta ' + num(betaS(m)) + '; cosine coefficient ' + num(m.A1) + ', sine coefficient ' + num(m.B1) + '.'
          : 'The discriminant is not negative, so the quadratic has real roots and this is not a complex pair.') +
        (yt.open ? ' Your turn: F of s = 20 over (s+2)(s squared + 2 s + 10).' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
