/* ═══ SCENE — Inverse Laplace · Repeated Poles (PFE-2) ════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  WORKED EXAMPLE        F(s) = (s³+2s+6)/(s(s+1)²(s+3)), sympy-verified by Director
     3  YOUR TURN             F(s) = (s+3)/(s(s+1)²), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  PANELS                WorkZone, Tape, FtZone, BottomBand
     6  TOUR                  narration line -> what is shown
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const ALL4 = ['A', 'B', 'C', 'D'];   // the four coefficients
const EASY3 = ['A', 'B', 'D'];       // found by plain cover-up
const DETAIL_MAX = 4;      // work-zone rows revealed in full
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
  clips: Array.from({ length: 16 }, (_, i) => 'pfe2_line' + (i + 1) + '.mp3'),
  durs: [13.224, 16.536, 7.584, 12.24, 13.656, 12.096, 7.416, 9.0, 7.752, 9.072, 10.704, 15.048, 11.232, 7.896, 11.544, 7.728],
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
    title: 'Inverse Laplace — Repeated Poles',
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
      'a quotient rule, and C lands at −3.25',
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

/* ═══ 5 PANELS ════════════════════════════════════════════════════════════ */
// WorkZone: the worked example, by residue with the derivative (method 0) or by algebra (method 1)
function WorkZone({ ui, method, showForm, detail }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.FS_ON) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const tint = method === 0 ? C_A : C_B;
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 7 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.workHead, ACCENT)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: tint,
          border: `1px solid ${tint}`, borderRadius: 4, padding: '1px 7px' }}>{ui.methodLong[method]}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 19, color: MUTE }}>F(s) =</span>
        <Frac num={EX.Fnum} den={EX.Fden} size={19} color={C_FS} />
      </div>

      <div className={up(showForm)} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 5 }}>
        {smallLabel(ui.formLabel)}
        <div style={{ fontFamily: MONO, fontSize: 15.5, fontWeight: 600, color: C_FS, marginTop: 2 }}><Eq text={'F(s) = ' + EX.form} /></div>
      </div>

      <div className={up(detail > 0)} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6, flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint, textWrap: 'pretty', lineHeight: 1.3 }}>
          {method === 0 ? EX.ruleA : EX.ruleB}
        </div>

        {method === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className={up(detail >= 1)} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {smallLabel(ui.easyLabel)}
              {EX.easy.map((r) => (
                <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span data-unk="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_K, width: 16, flexShrink: 0 }}>{r.k}</span>
                  <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 176, flexShrink: 0, whiteSpace: 'nowrap' }}>{r.expr}</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_K, whiteSpace: 'nowrap' }}>= {r.val}</span>
                </div>
              ))}
            </div>

            <div className={up(detail >= 2)} style={{ border: `1px solid ${C_D}`, borderRadius: 8, padding: '5px 10px',
              background: detail >= 2 ? 'rgba(0,0,0,0.02)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: C_D }}>{ui.catchLabel}</span>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_D, whiteSpace: 'nowrap' }}><Eq text={EX.warn} /></div>
              <div className={up(detail >= 3)} style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, whiteSpace: 'nowrap' }}>{EX.derivRule}</div>
              <div className={up(detail >= 3)} style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, whiteSpace: 'nowrap' }}><Eq text={EX.derivHere} /></div>
              <div className={up(detail >= DETAIL_MAX)} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C_K }}>C = {EX.derivVal}</span>
                <span style={{ fontFamily: HEAD, fontSize: FS_MIN, color: C_D }}>one derivative per step down in power</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className={up(detail >= 1)} style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, whiteSpace: 'nowrap' }}><Eq text={EX.identity} /></div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className={up(detail >= 2)} style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EX.system.map((row) => (
                  <div key={row[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 20, flexShrink: 0 }}>{row[0]}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, color: tint, whiteSpace: 'nowrap' }}><Eq text={row[1]} /></span>
                  </div>
                ))}
              </div>
              <div className={up(detail >= 3)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4,
                borderLeft: `1px solid ${LINE}`, paddingLeft: 16 }}>
                {smallLabel(ui.matrixLabel)}
                <Matrix rows={EX.matrix.rows} unk={EX.matrix.unk} rhs={EX.matrix.rhs} tags={EX.matrix.tags} tint={tint} />
              </div>
            </div>
            <div className={up(detail >= DETAIL_MAX)} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_K }}>{'→  ' + EX.solved}</div>
              <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: tint }}>{EX.noDeriv}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tape: the coefficients found so far; C is marked d/ds when it came from the derivative
function Tape({ ui, method, found }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1]) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const tint = method === 0 ? C_A : C_B;
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint }}>{ui.methodTag[method]}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {EX.coeffs.map((r) => {
          const got = found.indexOf(r.k) >= 0;
          const mark = got && r.deriv && method === 0;
          return (
            <div key={r.k} style={{ flex: 1, border: `1px solid ${mark ? C_D : got ? C_K : LINE}`, borderRadius: 8,
              padding: '4px 4px', textAlign: 'center', background: got ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
              <div data-unk="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_K, fontWeight: 600, lineHeight: 1.2 }}>{r.k}</div>
              <div data-tape={r.k} style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, color: got ? INK : UPCOMING,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{got ? r.val : '—'}</div>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: mark ? C_D : MUTE, lineHeight: 1.2 }}>{mark ? ui.derivBadge : r.pole}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: found.length >= ALL4.length ? tint : UPCOMING, textAlign: 'center' }}>
        {found.length >= ALL4.length ? ui.sameNote : '…'}
      </div>
    </div>
  );
}

// FtZone: transform pairs, f(t) and its plot — for the worked example, or for the Your-turn solution when shown
function FtZone({ ui, showPairs, showFt, yourTurn }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1] - 0.2) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const src = yourTurn ? YT : EX;
  const top = PANEL_TOP + TAPE_H + 10, h = PANEL_H - TAPE_H - 10;
  return (
    <div data-gate="ft" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 5 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div className={up(showPairs)} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {src.terms.map((t) => (
          <div key={t[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 9, fontFamily: MONO, fontSize: FS_MIN, lineHeight: '18px' }}>
            <span style={{ color: C_FS, width: 112, flexShrink: 0, textAlign: 'right' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'⟺'}</span>
            <span style={{ color: t[2] ? C_D : C_FT, fontWeight: 600 }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: showFt ? C_FT : UPCOMING, lineHeight: 1.35 }}>
        {showFt ? 'f(t) = ' + src.ft : 'f(t) = —'}
      </div>
      <FtPlot f={src.f} tmax={src.tmax} width={SIDE_W - 26} height={h - 20 - 20 - src.terms.length * 18 - 54} shown={showFt} color={C_FT} />
    </div>
  );
}

// BottomBand: method toggle, step-back / step-forward, and the through-line (spec V5: no second step rail)
function BottomBand({ ui, step, method, setStep, setMethod, explore, onGrab, note, showThrough, yt }) {
  const go = (n) => { onGrab(); setStep(n); };
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 18, padding: '9px 16px', alignItems: 'stretch' })}>
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {zoneHead(ui.methodHead)}
          <span data-mode="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em',
            color: explore ? ACCENT : MUTE, border: `1px solid ${explore ? ACCENT : MUTE}`, borderRadius: 4, padding: '0 6px' }}>
            {explore ? ui.exploreTag : ui.tourTag}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ui.methodBtn.map((mt, i) => (
            <button key={mt} type="button" aria-pressed={method === i} onClick={() => { onGrab(); setMethod(i); setStep(Math.max(2, step)); }}
              style={Object.assign(btnStyle(method === i, i === 0 ? C_A : C_B), { flex: 1, fontSize: 14, padding: '6px 10px' })}>{mt}</button>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: method === 0 ? C_D : MUTE, whiteSpace: 'nowrap' }}>
          {method === 0 ? 'lower power costs a derivative' : 'no derivative needed'}
        </div>
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

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        {smallLabel(ui.throughHead)}
        <div className={up(showThrough)} style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_D, textWrap: 'pretty', lineHeight: 1.35 }}>{EX.through}</div>
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, textWrap: 'pretty', lineHeight: 1.35 }}>{EX.tradeoff}</div>
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
  let step = 0, method = 0, detail = 0, found = [], form = false, pairs = false, ft = false, through = false;
  if (at(2)) { step = 1; form = true; }
  if (at(3)) { step = 2; }
  if (at(4)) { step = 2; method = 0; detail = 1; found = frac(4) > 0.45 ? EASY3 : []; }
  if (at(5)) { detail = 2; found = EASY3; }
  if (at(6)) { detail = 3; }
  if (at(7)) { detail = frac(7) > 0.4 ? DETAIL_MAX : 3; found = frac(7) > 0.4 ? ALL4 : EASY3; }
  if (at(8)) { method = 1; detail = 1; found = ALL4; }
  if (at(9)) { detail = 2; }
  if (at(10)) { detail = 3; }
  if (at(11)) { detail = frac(11) > 0.35 ? DETAIL_MAX : 3; }
  if (at(12)) { step = 3; detail = DETAIL_MAX; pairs = frac(12) > 0.35; }
  if (at(13)) { pairs = true; ft = frac(13) > 0.25; }
  if (at(14)) { pairs = true; ft = true; through = frac(14) > 0.2; }
  if (at(15)) { pairs = true; ft = true; through = true; }
  return { step, method, detail, found, form, pairs, ft, through };
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

// SceneBody: tour state, explore state and the layout
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const [grabbed, setGrabbed] = useState(false);
  const [st, setSt] = useState({ step: 0, method: 0, detail: 0, found: [], form: false, pairs: false, ft: false, through: false });
  const explore = time >= TL.EXPLORE || grabbed;
  const grab = useCallback(() => { setGrabbed(true); yt.close(); if (playing) setPlaying(false); }, [playing]);
  useEffect(() => { if (playing) setGrabbed(false); }, [playing]);

  const apply = useCallback((s) => setSt((p) =>
    (p.step === s.step && p.method === s.method && p.detail === s.detail && p.found.length === s.found.length
      && p.form === s.form && p.pairs === s.pairs && p.ft === s.ft && p.through === s.through) ? p : s), []);
  const setStep = (n) => setSt((p) => Object.assign({}, p, { step: n, form: n >= 1, found: n >= 2 ? ALL4 : [], pairs: n >= 3, ft: n >= 3, detail: n >= 2 ? DETAIL_MAX : 0 }));
  const setMethod = (m) => setSt((p) => Object.assign({}, p, { method: m }));

  const step = explore ? Math.max(1, st.step) : st.step;
  const active = step >= 3 ? 3 : step === 2 ? (st.method === 0 ? 1 : 2) : 0;
  const lit = [step >= 1, step >= 2, st.method === 1 || step >= 3, step >= 3];
  const noteIdx = clamp(idxAt(sched, time), 0, ui.notes.length - 1);
  const note = (explore && !yt.open) ? ui.noteExplore : ui.notes[noteIdx];
  const detail = explore ? Math.max(st.detail, step >= 2 ? DETAIL_MAX : 0) : st.detail;
  const found = explore ? (step >= 2 ? ALL4 : []) : st.found;
  const ytShown = yt.shown;

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={active} lit={lit} tints={[C_FS, C_A, C_B, C_FT]}
        footer={<React.Fragment>{smallLabel(ui.pairLabel)}<div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_FT, fontWeight: 600, lineHeight: 1.45 }}>{EX.pair}</div></React.Fragment>} />
      <WorkZone ui={ui} method={st.method} showForm={explore || st.form} detail={detail} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} method={st.method} found={found} />
      <FtZone ui={ui} yourTurn={ytShown} showPairs={ytShown || (explore ? step >= 3 : st.pairs)} showFt={ytShown || (explore ? step >= 3 : st.ft)} />
      <BottomBand ui={ui} step={step} method={st.method} setStep={setStep} setMethod={setMethod}
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
      <SrSummary text={ui.srSummary + 'F of s = (s cubed + 2 s + 6) over s (s+1) squared (s+3). Step ' + Math.max(1, step) + ' of 3, method ' +
        ui.methodTag[st.method] + '. Form ' + EX.form + '. Coefficients A = 2, B = minus 1.5, C = minus 3.25 by one derivative, D = 2.25. f of t = ' + EX.say +
        '. The t e to the minus t term is the repeated-pole fingerprint.' +
        (yt.open ? ' Your turn: F of s = (s + 3) over s (s+1) squared.' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
