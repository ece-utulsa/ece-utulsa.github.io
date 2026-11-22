/* ═══ SCENE — Inverse Laplace · Simple Poles (PFE-1) ══════════════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  WORKED EXAMPLE        F(s) = 10s/((s+1)(s+2)(s+3)), sympy-verified by Director
     3  YOUR TURN             F(s) = (2s+8)/((s+1)(s+3)), spec v1.1.0 key
     4  LANGUAGE PACK         narration text, captions, UI strings
     5  PANELS                WorkZone, Tape, FtZone, BottomBand
     6  TOUR                  narration line -> what is shown
     7  SCENE                 */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const N_COEF = 3;          // number of coefficients A, B, C
const DETAIL_MAX = 4;      // work-zone rows revealed in full
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

/* ═══ 5 PANELS ════════════════════════════════════════════════════════════ */
// WorkZone: the worked example, by residue (method 0) or by algebra (method 1)
function WorkZone({ ui, method, showForm, detail }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.FS_ON) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const tint = method === 0 ? C_A : C_B;
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 10 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.workHead, ACCENT)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: tint,
          border: `1px solid ${tint}`, borderRadius: 4, padding: '1px 7px' }}>{ui.methodLong[method]}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 19, color: MUTE }}>F(s) =</span>
        <Frac num={EX.Fnum} den={EX.Fden} size={21} color={C_FS} />
      </div>

      <div className={up(showForm)} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 7 }}>
        {smallLabel(ui.formLabel)}
        <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C_FS, marginTop: 3 }}><Eq text={'F(s) = ' + EX.form} /></div>
      </div>

      <div className={up(detail > 0)} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8, flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint, textWrap: 'pretty' }}>
          {method === 0 ? EX.ruleA : EX.ruleB}
        </div>

        {method === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {EX.poles.map((r, i) => {
              const shown = detail >= i + 1;
              const evald = shown && (i > 0 || detail >= 2);
              return (
                <div key={r.k} className={up(shown)} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  background: shown && i === Math.min(detail, N_COEF) - 1 ? 'rgba(0,0,0,0.035)' : 'transparent',
                  borderRadius: 6, padding: '4px 6px' }}>
                  <span data-unk="1" style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C_K, width: 16, flexShrink: 0 }}>{r.k}</span>
                  <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 132, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {r.factor + '·F(s) |s=' + r.at}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 13.5, color: tint, width: 150, flexShrink: 0, whiteSpace: 'nowrap' }}>{r.cover}</span>
                  <span className={up(evald)} style={{ fontFamily: MONO, fontSize: 13.5, color: INK, flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>{r.evalStr}</span>
                  <span className={up(evald)} style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C_K, whiteSpace: 'nowrap' }}>= {r.val}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={up(detail >= 1)} style={{ fontFamily: MONO, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}><Eq text={EX.identity} /></div>
            <div style={{ display: 'flex', gap: 18 }}>
              <div className={up(detail >= 2)} style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {EX.system.map((row) => (
                  <div key={row[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 22, flexShrink: 0 }}>{row[0]}</span>
                    <span style={{ fontFamily: MONO, fontSize: 14, color: tint }}><Eq text={row[1]} /></span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9,
                borderLeft: `1px solid ${LINE}`, paddingLeft: 18 }}>
                <div className={up(detail >= 3)} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {smallLabel('MATRIX FORM')}
                  <Matrix rows={EX.matrix.rows} unk={EX.matrix.unk} rhs={EX.matrix.rhs} tags={EX.matrix.tags} tint={tint} />
                </div>
                <div className={up(detail >= DETAIL_MAX)} style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 600, color: C_K }}>
                  {'→  ' + EX.solved}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tape: the coefficients found so far, shared by both methods
function Tape({ ui, method, found }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1]) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  const tint = method === 0 ? C_A : C_B;
  return (
    <div data-gate="tape" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: TAPE_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 7 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.tapeHead, C_K)}
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint }}>{ui.methodTag[method]}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {EX.poles.map((r, i) => {
          const got = found > i;
          return (
            <div key={r.k} style={{ flex: 1, border: `1px solid ${got ? C_K : LINE}`, borderRadius: 8,
              padding: '5px 6px', textAlign: 'center', background: got ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
              <div data-unk="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_K, fontWeight: 600, lineHeight: 1.2 }}>{r.k}</div>
              <div data-tape={r.k} style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: got ? INK : UPCOMING,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{got ? r.val : '—'}</div>
              <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.2 }}>{'pole −' + r.p}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: found >= N_COEF ? tint : UPCOMING, textAlign: 'center' }}>
        {found >= N_COEF ? ui.sameNote : '…'}
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
      display: 'flex', flexDirection: 'column', gap: 6 })}>
      {zoneHead(yourTurn ? ui.ftHeadYT : ui.ftHead, yourTurn ? ACCENT : C_FT)}
      <div className={up(showPairs)} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {src.terms.map((t) => (
          <div key={t[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: MONO, fontSize: 13.5 }}>
            <span style={{ color: C_FS, width: 104, flexShrink: 0, textAlign: 'right' }}>{t[0]}</span>
            <span style={{ color: MUTE }}>{'⟺'}</span>
            <span style={{ color: C_FT, fontWeight: 600 }}>{t[1]}</span>
          </div>
        ))}
      </div>
      <div data-ft-text="1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: showFt ? C_FT : UPCOMING, lineHeight: 1.35 }}>
        {showFt ? 'f(t) = ' + src.ft : 'f(t) = —'}
      </div>
      <FtPlot f={src.f} tmax={src.tmax} width={SIDE_W - 26} height={h - 20 - 22 - src.terms.length * 19 - 40} shown={showFt} color={C_FT} />
    </div>
  );
}

// BottomBand: method toggle, step-back / step-forward, and the method stamp (spec V5: no second step rail)
function BottomBand({ ui, step, method, setStep, setMethod, explore, onGrab, note, yt }) {
  const go = (n) => { onGrab(); setStep(n); };
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
            <button key={mt} type="button" aria-pressed={method === i} onClick={() => { onGrab(); setMethod(i); setStep(Math.max(2, step)); }}
              style={Object.assign(btnStyle(method === i, i === 0 ? C_A : C_B), { flex: 1, fontSize: 14, padding: '8px 10px' })}>{mt}</button>
          ))}
        </div>
      </div>

      <div style={{ width: 1, background: LINE }} />

      <div style={{ width: 330, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
        {smallLabel('THE STAMP')}
        <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, textWrap: 'pretty', lineHeight: 1.4 }}>
          {'F(s) = Σ Kᵢ/(s+pᵢ)  ·  Kᵢ by cover-up or by matching powers  ·  K/(s+p) ⟺ K e⁻ᵖᵗ'}
        </div>
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
  let step = 0, method = 0, detail = 0, found = 0, form = false, pairs = false, ft = false;
  if (at(2)) { step = 1; form = true; }
  if (at(3)) { step = 2; }
  if (at(4)) { step = 2; method = 0; detail = 1; }
  if (at(5)) { detail = 1; found = frac(5) > 0.45 ? 1 : 0; }
  if (at(6)) { found = 1; detail = frac(6) > 0.3 ? 2 : 1; if (frac(6) > 0.55) { detail = 3; found = N_COEF; } }
  if (at(7)) { method = 1; detail = 1; found = N_COEF; }
  if (at(8)) { detail = 2; }
  if (at(9)) { detail = frac(9) > 0.3 ? 3 : 2; }
  if (at(10)) { detail = frac(10) > 0.35 ? DETAIL_MAX : 3; }
  if (at(11)) { step = 3; detail = DETAIL_MAX; pairs = frac(11) > 0.4; }
  if (at(12)) { pairs = true; ft = frac(12) > 0.25; }
  if (at(13)) { pairs = true; ft = true; }
  return { step, method, detail, found, form, pairs, ft };
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
  const [st, setSt] = useState({ step: 0, method: 0, detail: 0, found: 0, form: false, pairs: false, ft: false });
  const explore = time >= TL.EXPLORE || grabbed;
  const grab = useCallback(() => { setGrabbed(true); yt.close(); if (playing) setPlaying(false); }, [playing]);
  useEffect(() => { if (playing) setGrabbed(false); }, [playing]);

  const apply = useCallback((s) => setSt((p) =>
    (p.step === s.step && p.method === s.method && p.detail === s.detail && p.found === s.found
      && p.form === s.form && p.pairs === s.pairs && p.ft === s.ft) ? p : s), []);
  const setStep = (n) => setSt((p) => Object.assign({}, p, { step: n, form: n >= 1, found: n >= 2 ? N_COEF : 0, pairs: n >= 3, ft: n >= 3, detail: n >= 2 ? DETAIL_MAX : 0 }));
  const setMethod = (m) => setSt((p) => Object.assign({}, p, { method: m }));

  const step = explore ? Math.max(1, st.step) : st.step;
  const active = step >= 3 ? 3 : step === 2 ? (st.method === 0 ? 1 : 2) : 0;
  const lit = [step >= 1, step >= 2, st.method === 1 || step >= 3 || (!explore && time >= TL.L[6]), step >= 3];
  const noteIdx = clamp(idxAt(sched, time), 0, ui.notes.length - 1);
  const note = (explore && !yt.open) ? ui.noteExplore : ui.notes[noteIdx];
  const ytShown = yt.shown;

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <Rail items={lang.rail} head={ui.railHead} active={active} lit={lit} tints={[C_FS, C_A, C_B, C_FT]}
        footer={<React.Fragment>{smallLabel(ui.pairLabel)}<div style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_FT, fontWeight: 600 }}>{EX.pair}</div></React.Fragment>} />
      <WorkZone ui={ui} method={st.method} showForm={explore || st.form} detail={explore ? Math.max(st.detail, step >= 2 ? DETAIL_MAX : 0) : st.detail} />
      {yt.open ? <YourTurnCard yt={YT} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <Tape ui={ui} method={st.method} found={explore ? (step >= 2 ? N_COEF : 0) : st.found} />
      <FtZone ui={ui} yourTurn={ytShown} showPairs={ytShown || (explore ? step >= 3 : st.pairs)} showFt={ytShown || (explore ? step >= 3 : st.ft)} />
      <BottomBand ui={ui} step={step} method={st.method} setStep={setStep} setMethod={setMethod}
        explore={explore} onGrab={grab} note={note} yt={yt} />

      <Captions sched={sched} lang={lang} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <TourDriver apply={apply} grabbed={grabbed} tourState={tourState} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + 'F of s = 10 s over (s+1)(s+2)(s+3). Step ' + Math.max(1, step) + ' of 3, method ' +
        ui.methodTag[st.method] + '. Expansion form ' + EX.form + '. Coefficients A = minus 5, B = 20, C = minus 15. f of t = ' + EX.say + '.' +
        (yt.open ? ' Your turn: F of s = (2 s + 8) over (s+1)(s+3).' + (yt.shown ? ' Solution: f of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
