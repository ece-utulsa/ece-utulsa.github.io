/* ═══ SCENE — Lecture 9 · Mesh Analysis in the s-Domain ═══════════════════════
   TOC
     1  MODEL          the two-mesh circuit and its solution (spec L9, sympy-checked)
     2  LANGUAGE PACK  narration text, UI strings
     3  STEPS + BEATS  one line at a time (focus rules R1–R7)
     4  CIRCUIT        the two-mesh ladder, time domain morphing to s
     5  FOCUS + ROWS   the line being spoken; finished lines
     6  BOARD + PLOT   results panel, i(t) plot
     7  YOUR TURN + PAGE
   Sign convention: mesh currents I₁ (left) and I₂ (right) are both clockwise. Units: V, A, Ω, H, F, s. */

/* ═══ 1 MODEL ═════════════════════════════════════════════════════════════ */
// [3/s + 10, −10; −10, 4s + 10][I₁; I₂] = [4/(s+2); 2/(s+1)],  Δ = (40s² + 12s + 30)/s
// poles −1, −2, −ALPHA ± jBETA;  i(t) = e^(−ALPHA t)(Kc cos BETA t + Ks sin BETA t) + K1 e^(−t) + K2 e^(−2t), in A, t > 0
const ALPHA = 0.15, BETA = 0.853;                      // 1/s, rad/s: the complex pair −0.15 ± j0.853
const K1 = { c: 0.841, s: 0.198, e1: -0.345, e2: -0.096 };   // i₁ coefficients, A (e1 = −10/29, e2 = −8/83)
const K2 = { c: 0.723, s: 0.473, e1: -0.241, e2: -0.482 };   // i₂ coefficients, A (e1 = −7/29, e2 = −40/83)
const T_PLOT = 25;                                     // s: span of the i(t) plot
const T_PLOT_YT = 10;                                  // s: span of the Your-turn plot (five time constants of 2 s)
// i(t) in A for coefficient set K
const iOf = (K) => (t) => Math.exp(-ALPHA * t) * (K.c * Math.cos(BETA * t) + K.s * Math.sin(BETA * t)) + K.e1 * Math.exp(-t) + K.e2 * Math.exp(-2 * t);
// a coefficient with a true minus sign
const kv = (x) => (x < 0 ? MINUS : '') + Math.abs(x).toFixed(3);
const E15 = 'e⁻⁰·¹⁵ᵗ', E1 = 'e⁻ᵗ', E2 = 'e⁻²ᵗ';
const DEN = '(s+1)(s+2)(40s² + 12s + 30)';
const A_SYM = [['a₁₁', 'a₁₂'], ['a₂₁', 'a₂₂']], B_SYM = ['b₁', 'b₂'];
const A_VAL = [['3/s + 10', '−10'], ['−10', '4s + 10']], B_VAL = ['4/(s+2)', '2/(s+1)'];

/* ═══ 2 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 17 }, (_, i) => 'l9_line' + (i + 1) + '.mp3'),
  durs: [12.312, 21.912, 14.304, 15.84, 17.904, 15.696, 10.464, 19.728, 12.288, 15.768, 15.936, 17.496, 20.592, 12.408, 24.072, 11.064, 17.64],
  text: [
    'Lecture nine. We solve a two-mesh circuit entirely in the s-domain: transform it, write the mesh equations, solve them with Cramer’s rule, and check the answer at t equals zero plus.',
    'Here is the circuit. On the left, a source of four e to the minus two t volts. On the right, two e to the minus t volts, with its minus terminal on top. Between them, a one-third farad capacitor, a ten ohm resistor shared by both meshes, and a four henry inductor. Both mesh currents run clockwise.',
    'Step one: initial conditions. Both sources are zero before t equals zero, so nothing is stored. The capacitor voltage and the inductor current start at zero, and there are no initial-condition sources.',
    'Step two: transform. The left source becomes four over s plus two. The right source becomes two over s plus one. The capacitor becomes three over s, the inductor becomes four s, and the resistor stays ten.',
    'Step three: Kirchhoff’s voltage law around mesh one. Minus the left source. Plus I-one times three over s, for the capacitor. Plus ten times I-one minus I-two, for the shared resistor. Collect the terms, and the sum is zero.',
    'Now mesh two. Ten times I-two minus I-one, for the shared resistor. Plus four s times I-two, for the inductor. Minus the right source, because we pass through it from minus to plus. Collect the terms again.',
    'Step four: move the sources to the right, and stack the two equations as a matrix. Row one comes from mesh one. Row two comes from mesh two.',
    'To solve it we use Cramer’s rule. The determinant, delta, is the main diagonal product minus the other diagonal product. For delta one, replace column one with the right-hand side. For delta two, replace column two. Each unknown is its own delta, over delta.',
    'Here, delta is three over s plus ten, times four s plus ten, minus one hundred. That simplifies to forty s squared plus twelve s plus thirty, all over s.',
    'For I-one, the sources go in column one. Delta one is sixteen s plus forty, over s plus two, plus twenty over s plus one. Divide by delta and clear the fractions: I-one is a cubic, over three factors.',
    'For I-two, the sources go in column two. Delta two is twenty s plus six, over s times s plus one, plus forty over s plus two. Divide by delta, and I-two is a quadratic over the same three factors.',
    'Now the poles. Two are simple: minus one and minus two. The quadratic gives a complex pair, at minus zero point one five, plus or minus j zero point eight five three. Two simple poles and a complex pair — Lectures five and seven.',
    'Invert term by term. For i-one, the complex pair gives a damped cosine and a damped sine, with coefficients zero point eight four one and zero point one nine eight. The pole at minus one gives minus zero point three four five. The pole at minus two gives minus zero point zero nine six.',
    'I-two has the same four terms with its own coefficients: zero point seven two three and zero point four seven three for the pair, then minus zero point two four one and minus zero point four eight two.',
    'Always check. The initial value theorem, from Lecture three, gives i-one at zero plus as sixteen over forty: zero point four amps. Our three coefficients at t equals zero add up to zero point four. For i-two, the theorem gives zero, and its coefficients add up to zero. And both currents decay to zero, because the sources do.',
    'The key point. Mesh analysis in s is the same method as in DC — the impedances just carry s. Check the answer at t equals zero plus before you trust it.',
    'Your turn. A one volt step drives two meshes: a one ohm resistor, a one henry inductor shared by both meshes, and a second one ohm resistor. On paper, find the matrix, delta, I-two of s, and i-two of t. Then press Show solution.',
  ],
  card: {
    series: 'ECE 2003 · Laplace lectures · Lecture 9 of 10',
    title: 'Lecture 9 · Mesh Analysis in the s-Domain',
    sentence: 'This lecture solves a two-mesh circuit entirely in s: transform, write the mesh equations, solve with Cramer’s rule, then check the answer at t = 0⁺.',
    steps: [
      'Transform the circuit: the sources and the impedances in s.',
      'Write the two mesh equations and solve them with Cramer’s rule.',
      'Invert, then check with the initial value theorem.',
    ],
    able: 'Solve a two-mesh circuit in the s-domain and check the result at t = 0⁺.',
  },
  ui: {
    kicker: 'ECE 2003 · LAPLACE LECTURES · LECTURE 9',
    title: 'Mesh Analysis in the s-Domain',
    sub: 'transform → mesh equations → Cramer’s rule → check',
    header: 'Lecture 9 · Mesh Analysis in the s-Domain',
    headerSub: '',
    keyPoint: 'Mesh analysis in s is the same method as in DC — the impedances just carry s. Check the answer at t = 0⁺ before you trust it.',
    railHead: 'THE METHOD',
    circHead: 'THE CIRCUIT',
    workHead: 'THE WORK — ONE LINE AT A TIME',
    bandHead: 'THE TOUR',
    bandHelp: 'Step one line back or forward with ◀ ▶.',
    linksHead: 'WHERE NEXT',
    noteStep: 'stepping by hand — press play to hear the tour again',
    notes: [
      'a two-mesh circuit, solved in s',
      'two sources, three elements, two clockwise mesh currents',
      'nothing is stored before t = 0',
      'each element is replaced in place, one at a time',
      'one term for each element around mesh 1',
      'one term for each element around mesh 2',
      'sources on the right, one row per mesh',
      'taught here once; Lecture 10 uses it again',
      'the determinant of the mesh matrix',
      'the sources replace column 1',
      'the sources replace column 2',
      'the poles say which terms the answer has',
      'each pole gives one term of the first mesh current',
      'the second mesh current has the same four terms',
      'the initial value theorem needs no inverse transform',
      'the same method as in DC',
      'work the problem on paper, then show the solution',
    ],
    endTitle: 'End of Lecture 9 ✓', endSub: 'try the Your-turn problem · then go on to Lecture 10',
    srSummary: 'Lecture 9, mesh analysis in the s-domain. ',
  },
};

/* ═══ 3 STEPS + BEATS ═════════════════════════════════════════════════════ */
const STEPS = [
  { label: 'The circuit', tint: ACCENT }, { label: 'Initial conditions', tint: C_IC }, { label: 'Transform', tint: C_Z },
  { label: 'Mesh equations (KVL)', tint: INK }, { label: 'Matrix form', tint: INK }, { label: 'Cramer’s rule', tint: C_ALG },
  { label: 'Poles', tint: C_Z }, { label: 'Back to time', tint: C_IT }, { label: 'Check at t = 0⁺', tint: ACCENT },
];
// Each beat is one thing the voice says: `line` is the narration clip (1-based), `from` the fraction of that clip at
// which the beat starts (estimated from the script), `step` the rail step, `land` the slot a value lands in, `hl` the
// circuit elements highlighted while the beat is spoken (VL, VR, C, R, L, M1, M2).
const BEATS = [
  { id: 'intro', line: 1, from: 0.4, step: 0, cap: 'a two-mesh circuit, solved entirely in the s-domain' },
  { id: 'srcL', line: 2, from: 0.08, step: 0, hl: ['VL'], cap: 'left source: 4e⁻²ᵗu(t) V' },
  { id: 'srcR', line: 2, from: 0.27, step: 0, hl: ['VR'], cap: 'right source: 2e⁻ᵗu(t) V, with − on top' },
  { id: 'elC', line: 2, from: 0.52, step: 0, hl: ['C'], cap: 'a 1/3 F capacitor' },
  { id: 'elR', line: 2, from: 0.62, step: 0, hl: ['R'], cap: 'a 10 Ω resistor shared by both meshes' },
  { id: 'elL', line: 2, from: 0.78, step: 0, hl: ['L'], cap: 'a 4 H inductor' },
  { id: 'mesh', line: 2, from: 0.88, step: 0, hl: ['M1', 'M2'], cap: 'both mesh currents run clockwise' },
  { id: 'ic', line: 3, from: 0, step: 1, cap: 'STEP 1 initial conditions' },
  { id: 'zero', line: 3, from: 0.22, step: 1, hl: ['VL', 'VR'], cap: 'both sources are zero before t = 0: nothing is stored' },
  { id: 'ic0', line: 3, from: 0.5, step: 1, hl: ['C', 'L'], cap: 'v_C(0⁻) = 0 and i_L(0⁻) = 0' },
  { id: 'noic', line: 3, from: 0.78, step: 1, cap: 'no initial-condition sources' },
  { id: 'tr', line: 4, from: 0, step: 2, cap: 'STEP 2 transform' },
  { id: 'tVL', line: 4, from: 0.1, step: 2, land: 'tVL', hl: ['VL'], cap: 'the left source becomes 4/(s+2)' },
  { id: 'tVR', line: 4, from: 0.3, step: 2, land: 'tVR', hl: ['VR'], cap: 'the right source becomes 2/(s+1)' },
  { id: 'tC', line: 4, from: 0.52, step: 2, land: 'tC', hl: ['C'], cap: 'the capacitor becomes 3/s' },
  { id: 'tL', line: 4, from: 0.68, step: 2, land: 'tL', hl: ['L'], cap: 'the inductor becomes 4s' },
  { id: 'tR', line: 4, from: 0.84, step: 2, land: 'tR', hl: ['R'], cap: 'the resistor stays 10' },
  { id: 'k1', line: 5, from: 0, step: 3, hl: ['M1'], cap: 'STEP 3 Kirchhoff’s voltage law around mesh 1' },
  { id: 'k1a', line: 5, from: 0.2, step: 3, hl: ['VL'], cap: 'minus the left source' },
  { id: 'k1b', line: 5, from: 0.32, step: 3, hl: ['C'], cap: 'plus I₁ times 3/s, for the capacitor' },
  { id: 'k1c', line: 5, from: 0.55, step: 3, hl: ['R'], cap: 'plus 10(I₁ − I₂), for the shared resistor' },
  { id: 'k1d', line: 5, from: 0.82, step: 3, hl: ['M1'], cap: 'collected: −4/(s+2) + I₁(3/s + 10) − 10I₂ = 0' },
  { id: 'k2', line: 6, from: 0, step: 3, hl: ['M2'], cap: 'now mesh 2' },
  { id: 'k2a', line: 6, from: 0.1, step: 3, hl: ['R'], cap: '10(I₂ − I₁), for the shared resistor' },
  { id: 'k2b', line: 6, from: 0.38, step: 3, hl: ['L'], cap: 'plus 4s times I₂, for the inductor' },
  { id: 'k2c', line: 6, from: 0.58, step: 3, hl: ['VR'], cap: 'minus the right source: we pass through it from − to +' },
  { id: 'k2d', line: 6, from: 0.88, step: 3, hl: ['M2'], cap: 'collected: I₂(10 + 4s) − 10I₁ − 2/(s+1) = 0' },
  { id: 'mat', line: 7, from: 0, step: 4, cap: 'STEP 4 sources to the right, then stack the equations as a matrix' },
  { id: 'row1', line: 7, from: 0.55, step: 4, hl: ['M1'], cap: 'row 1 comes from mesh 1' },
  { id: 'row2', line: 7, from: 0.78, step: 4, hl: ['M2'], cap: 'row 2 comes from mesh 2' },
  { id: 'cr', line: 8, from: 0, step: 5, cap: 'Cramer’s rule' },
  { id: 'crD', line: 8, from: 0.12, step: 5, cap: 'Δ: main diagonal product minus the other diagonal product' },
  { id: 'crD1', line: 8, from: 0.42, step: 5, cap: 'Δ₁: replace column 1 with the right-hand side' },
  { id: 'crD2', line: 8, from: 0.62, step: 5, cap: 'Δ₂: replace column 2' },
  { id: 'crX', line: 8, from: 0.8, step: 5, cap: 'each unknown is its own Δ over Δ' },
  { id: 'dA', line: 9, from: 0.03, step: 5, cap: 'Δ = (3/s + 10)(4s + 10) − 100' },
  { id: 'dB', line: 9, from: 0.5, step: 5, land: 'D', cap: 'Δ = (40s² + 12s + 30)/s' },
  { id: 'i1A', line: 10, from: 0, step: 5, cap: 'for I₁ the sources go in column 1' },
  { id: 'i1B', line: 10, from: 0.2, step: 5, cap: 'Δ₁ = (16s + 40)/(s+2) + 20/(s+1)' },
  { id: 'i1C', line: 10, from: 0.6, step: 5, land: 'I1', cap: 'I₁ = Δ₁/Δ: a cubic over three factors' },
  { id: 'i2A', line: 11, from: 0, step: 5, cap: 'for I₂ the sources go in column 2' },
  { id: 'i2B', line: 11, from: 0.2, step: 5, cap: 'Δ₂ = (20s + 6)/(s(s+1)) + 40/(s+2)' },
  { id: 'i2C', line: 11, from: 0.62, step: 5, land: 'I2', cap: 'I₂ = Δ₂/Δ: a quadratic over the same three factors' },
  { id: 'pA', line: 12, from: 0, step: 6, cap: 'now the poles' },
  { id: 'p1', line: 12, from: 0.1, step: 6, cap: 'two simple poles: −1 and −2' },
  { id: 'p2', line: 12, from: 0.32, step: 6, cap: 'the quadratic gives a complex pair: −0.15 ± j0.853' },
  { id: 'p3', line: 12, from: 0.78, step: 6, cap: 'two simple poles and a complex pair: Lectures 5 and 7' },
  { id: 't1', line: 13, from: 0, step: 7, cap: 'invert term by term: i₁(t)' },
  { id: 'c11', line: 13, from: 0.3, step: 7, land: 'c11', cap: 'damped cosine: 0.841' },
  { id: 'c12', line: 13, from: 0.46, step: 7, land: 'c12', cap: 'damped sine: 0.198' },
  { id: 'c13', line: 13, from: 0.6, step: 7, land: 'c13', cap: 'the pole at −1 gives −0.345' },
  { id: 'c14', line: 13, from: 0.82, step: 7, land: 'c14', cap: 'the pole at −2 gives −0.096' },
  { id: 't2', line: 14, from: 0, step: 7, cap: 'i₂(t) has the same four terms' },
  { id: 'c21', line: 14, from: 0.28, step: 7, land: 'c21', cap: 'damped cosine: 0.723' },
  { id: 'c22', line: 14, from: 0.44, step: 7, land: 'c22', cap: 'damped sine: 0.473' },
  { id: 'c23', line: 14, from: 0.66, step: 7, land: 'c23', cap: 'the pole at −1 gives −0.241' },
  { id: 'c24', line: 14, from: 0.84, step: 7, land: 'c24', cap: 'the pole at −2 gives −0.482' },
  { id: 'chk', line: 15, from: 0, step: 8, cap: 'always check: the initial value theorem (Lecture 3)' },
  { id: 'v1a', line: 15, from: 0.1, step: 8, cap: 'i₁(0⁺) = 16/40 = 0.4 A' },
  { id: 'v1b', line: 15, from: 0.33, step: 8, cap: 'our answer at t = 0: 0.841 − 0.345 − 0.096 = 0.400 ✓' },
  { id: 'v2a', line: 15, from: 0.55, step: 8, cap: 'for i₂ the theorem gives 0' },
  { id: 'v2b', line: 15, from: 0.66, step: 8, cap: '0.723 − 0.241 − 0.482 = 0 ✓' },
  { id: 'fin', line: 15, from: 0.82, step: 8, cap: 'both currents decay to zero, because the sources do' },
  { id: 'key', line: 16, from: 0, step: 8, cap: 'KEY POINT the same method as in DC — the impedances just carry s' },
  { id: 'yt', line: 17, from: 0, step: 8, cap: 'Your turn — on paper: find the matrix, Δ, I₂(s) and i₂(t), then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.key;                                // last line of the tour proper (the Your-turn line is not one)

/* ═══ 4 CIRCUIT ═══════════════════════════════════════════════════════════ */
// MeshLadder: source — top-left element — shared element — top-right element — right source (or a wire).
// `parts` gives each element { type: 'R' | 'C' | 'L', was, now }; `got` says which have been transformed; `land` is
// the one whose value is landing; `hl` lists the highlighted parts; `h` is the drawing height in px.
function MeshLadder({ parts, got, land, hl, h, big, label }) {
  const xl = 120, xm = 298, xr = 476, yT = 40, yB = h - 22, cy = (yT + yB) / 2, ca = 209, la = 387, g = got || {}, on = (k) => (hl || []).includes(k);
  const el = (p, cx, cyy, vert, k) => (p.type === 'C' && !g[p.slot] ? <Cap cx={cx} cy={cyy} vert={vert} hl={on(k)} /> : p.type === 'L' && !g[p.slot] ? <Ind cx={cx} cy={cyy} vert={vert} hl={on(k)} /> : <ZBox cx={cx} cy={cyy} vert={vert} hl={on(k)} />);
  const lab = (p, x, y, anchor, k) => <ELabel x={x} y={y} anchor={anchor} was={p.was} now={p.now} got={g[p.slot]} landing={land === p.slot} slot={p.slot} hl={on(k)} />;
  return (
    <svg viewBox={`0 0 ${SCH_W} ${h}`} width={SCH_W} height={h} role="img" aria-label={label} style={{ display: 'block', flexShrink: 0 }}>
      <Wire x1={xl} y1={yT} x2={xr} y2={yT} /><Wire x1={xl} y1={yB} x2={xr} y2={yB} /><Wire x1={xl} y1={yT} x2={xl} y2={yB} /><Wire x1={xm} y1={yT} x2={xm} y2={yB} /><Wire x1={xr} y1={yT} x2={xr} y2={yB} />
      <VSrc cx={xl} cy={cy} plusTop={parts.vl.plusTop} hl={on('VL')} />{lab(parts.vl, xl - 19, cy + 5, 'end', 'VL')}
      {el(parts.tl, ca, yT, false, 'C')}{lab(parts.tl, ca, yT - 18, 'middle', 'C')}
      {el(parts.mid, xm, cy, true, 'R')}{lab(parts.mid, xm + 16, cy + 5, 'start', 'R')}
      {el(parts.tr, la, yT, false, 'L')}{lab(parts.tr, la, yT - 18, 'middle', 'L')}
      {parts.vr ? <g><VSrc cx={xr} cy={cy} plusTop={parts.vr.plusTop} hl={on('VR')} />{lab(parts.vr, xr + 19, cy + 5, 'start', 'VR')}</g> : null}
      <MeshArrow cx={ca - 4} cy={cy + 6} label={big ? 'I₁' : 'i₁'} hl={on('M1')} /><MeshArrow cx={la + 22} cy={cy + 6} label={big ? 'I₂' : 'i₂'} hl={on('M2')} />
    </svg>
  );
}
const PARTS = {
  vl: { slot: 'tVL', was: '4e⁻²ᵗu(t) V', now: '4/(s+2)', plusTop: true }, vr: { slot: 'tVR', was: '2e⁻ᵗu(t) V', now: '2/(s+1)', plusTop: false },
  tl: { slot: 'tC', type: 'C', was: '1/3 F', now: '3/s' }, mid: { slot: 'tR', type: 'R', was: '10 Ω', now: '10' }, tr: { slot: 'tL', type: 'L', was: '4 H', now: '4s' },
};
const PARTS_YT = {
  vl: { slot: 'y1', was: 'u(t) V', now: '', plusTop: true }, vr: null,
  tl: { slot: 'y2', type: 'R', was: '1 Ω', now: '' }, mid: { slot: 'y3', type: 'L', was: '1 H', now: '' }, tr: { slot: 'y4', type: 'R', was: '1 Ω', now: '' },
};
// the lecture's circuit at beat bi: labels morph to their s-domain values as each is spoken
function Circuit({ bi, b, land }) {
  const got = { tVL: bi >= IX.tVL, tVR: bi >= IX.tVR, tC: bi >= IX.tC, tL: bi >= IX.tL, tR: bi >= IX.tR };
  return <MeshLadder parts={PARTS} got={got} land={land} hl={b.hl} h={SCH_H - 18} big={bi >= IX.tr}
    label="Two-mesh circuit: left source, capacitor, shared resistor, inductor, right source with minus on top; both mesh currents clockwise" />;
}

/* ═══ 5 FOCUS + ROWS ══════════════════════════════════════════════════════ */
// the one line the voice is speaking at beat b (st.since = seconds into the beat, null when stepping by hand)
function focusOf(b, st) {
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  const nw = (t) => <span style={{ color: C_HL, fontWeight: 600 }}>{t}</span>;
  const prog = st.reduced || st.since == null ? 1 : st.since / COL_SLIDE;
  const coef = (k, basis, K) => <span>{basis + ' ×'}<LVal k={k}>{kv(K)}</LVal></span>;
  switch (b.id) {
    case 'intro': return prose('a two-mesh circuit, solved entirely in s');
    case 'srcL': return <span>{'left source: '}{nw('4e⁻²ᵗu(t) V')}</span>;
    case 'srcR': return <span>{'right source: '}{nw('2e⁻ᵗu(t) V')}{', − on top'}</span>;
    case 'elC': return <span>{'capacitor: '}{nw('1/3 F')}</span>;
    case 'elR': return <span>{'shared resistor: '}{nw('10 Ω')}</span>;
    case 'elL': return <span>{'inductor: '}{nw('4 H')}</span>;
    case 'mesh': return <span>{nw('i₁')}{' and '}{nw('i₂')}{', both clockwise'}</span>;
    case 'ic': return prose('STEP 1: initial conditions', C_IC);
    case 'zero': return prose('both sources are zero for t < 0');
    case 'ic0': return <span>{'v_C(0⁻) = 0,  i_L(0⁻) = 0'}</span>;
    case 'noic': return prose('no initial-condition sources');
    case 'tr': return prose('STEP 2: transform to the s-domain', C_Z);
    case 'tVL': return <span>{'4e⁻²ᵗu(t) →'}<LVal k="tVL">{'4/(s+2)'}</LVal></span>;
    case 'tVR': return <span>{'2e⁻ᵗu(t) →'}<LVal k="tVR">{'2/(s+1)'}</LVal></span>;
    case 'tC': return <span>{'1/3 F → 1/(sC) ='}<LVal k="tC">{'3/s'}</LVal></span>;
    case 'tL': return <span>{'4 H → sL ='}<LVal k="tL">{'4s'}</LVal></span>;
    case 'tR': return <span>{'10 Ω →'}<LVal k="tR">{'10'}</LVal></span>;
    case 'k1': return prose('STEP 3: KVL around mesh 1, clockwise');
    case 'k1a': return <span>{nw('−4/(s+2)')}</span>;
    case 'k1b': return <span>{'−4/(s+2) '}{nw('+ I₁(3/s)')}</span>;
    case 'k1c': return <span>{'−4/(s+2) + I₁(3/s) '}{nw('+ 10(I₁ − I₂)')}{' = 0'}</span>;
    case 'k1d': return <span>{'−4/(s+2) + I₁(3/s + 10) − 10I₂ = 0'}</span>;
    case 'k2': return prose('KVL around mesh 2, clockwise');
    case 'k2a': return <span>{nw('10(I₂ − I₁)')}</span>;
    case 'k2b': return <span>{'10(I₂ − I₁) '}{nw('+ 4s·I₂')}</span>;
    case 'k2c': return <span>{'10(I₂ − I₁) + 4s·I₂ '}{nw('− 2/(s+1)')}{' = 0'}</span>;
    case 'k2d': return <span>{'I₂(10 + 4s) − 10I₁ − 2/(s+1) = 0'}</span>;
    case 'mat': return prose('STEP 4: sources to the right, then stack');
    case 'row1': return <Mat2 a={A_VAL} x={['I₁', 'I₂']} b={B_VAL} shown={1} size={FOCUS_FS} />;
    case 'row2': return <Mat2 a={A_VAL} x={['I₁', 'I₂']} b={B_VAL} shown={2} size={FOCUS_FS} />;
    case 'cr': return prose('Cramer’s rule for a 2×2 system', C_ALG);
    case 'crD': return <span>{'Δ = a₁₁a₂₂ − a₂₁a₁₂'}</span>;
    case 'crD1': return <Det2 a={A_SYM} b={B_SYM} swap={0} prog={prog} size={FOCUS_FS} name="Δ₁" />;
    case 'crD2': return <Det2 a={A_SYM} b={B_SYM} swap={1} prog={prog} size={FOCUS_FS} name="Δ₂" />;
    case 'crX': return <span>{'x₁ = Δ₁/Δ,  x₂ = Δ₂/Δ'}</span>;
    case 'dA': return <span>{'Δ = (3/s + 10)(4s + 10) − (−10)(−10)'}</span>;
    case 'dB': return <span>{'Δ ='}<LVal k="D"><Frac num="40s² + 12s + 30" den="s" size={VALUE_FS} color={AMBER} /></LVal></span>;
    case 'i1A': return <Det2 a={A_VAL} b={B_VAL} swap={0} prog={prog} size={FOCUS_FS} name="Δ₁" />;
    case 'i1B': return <span>{'Δ₁ = (16s + 40)/(s+2) + 20/(s+1)'}</span>;
    case 'i1C': return <span>{'I₁ ='}<LVal k="I1"><Frac num="16s³ + 76s² + 80s" den={DEN} size={VALUE_FS} color={AMBER} /></LVal></span>;
    case 'i2A': return <Det2 a={A_VAL} b={B_VAL} swap={1} prog={prog} size={FOCUS_FS} name="Δ₂" />;
    case 'i2B': return <span>{'Δ₂ = (20s + 6)/(s(s+1)) + 40/(s+2)'}</span>;
    case 'i2C': return <span>{'I₂ ='}<LVal k="I2"><Frac num="60s² + 86s + 12" den={DEN} size={VALUE_FS} color={AMBER} /></LVal></span>;
    case 'pA': return prose('the poles of I₁ and I₂', C_Z);
    case 'p1': return <span>{'(s+1)(s+2): poles at −1 and −2'}</span>;
    case 'p2': return <span>{'40s² + 12s + 30 = 0 → s = −0.15 ± j0.853'}</span>;
    case 'p3': return prose('simple poles: Lecture 5 · complex pair: Lecture 7');
    case 't1': return prose('i₁(t): invert term by term', C_IT);
    case 'c11': return coef('c11', E15 + ' cos 0.853t', K1.c);
    case 'c12': return coef('c12', E15 + ' sin 0.853t', K1.s);
    case 'c13': return coef('c13', E1, K1.e1);
    case 'c14': return coef('c14', E2, K1.e2);
    case 't2': return prose('i₂(t): the same four terms', C_IT);
    case 'c21': return coef('c21', E15 + ' cos 0.853t', K2.c);
    case 'c22': return coef('c22', E15 + ' sin 0.853t', K2.s);
    case 'c23': return coef('c23', E1, K2.e1);
    case 'c24': return coef('c24', E2, K2.e2);
    case 'chk': return prose('check: the initial value theorem');
    case 'v1a': return <span>{'i₁(0⁺) = lim(s→∞) sI₁ = 16/40 = 0.4 A'}</span>;
    case 'v1b': return <span>{'0.841 − 0.345 − 0.096 = 0.400 ✓'}</span>;
    case 'v2a': return <span>{'i₂(0⁺) = lim(s→∞) sI₂ = 0'}</span>;
    case 'v2b': return <span>{'0.723 − 0.241 − 0.482 = 0 ✓'}</span>;
    case 'fin': return <span>{'i₁(∞) = i₂(∞) = 0'}</span>;
    default: return prose('the same method as in DC — the impedances carry s');
  }
}

// finished lines for beat index i: compact rows (R1), at most three
function doneRows(i) {
  const rows = [], add = (key, text, color) => rows.push({ key, node: <span>{text}</span>, color });
  if (i < IX.k1) {
    if (i > IX.noic) add('ic', 'zero initial conditions: no extra sources', C_IC);
    if (i > IX.tR) add('s', 's-domain: 4/(s+2), 2/(s+1), 3/s, 4s, 10', C_Z);
  } else if (i < IX.cr) {
    if (i > IX.k1d) add('m1', 'mesh 1: −4/(s+2) + I₁(3/s + 10) − 10I₂ = 0');
    if (i > IX.k2d) add('m2', 'mesh 2: I₂(10 + 4s) − 10I₁ − 2/(s+1) = 0');
  } else if (i < IX.pA) {
    if (i > IX.crD) add('d', 'Δ = a₁₁a₂₂ − a₂₁a₁₂', C_ALG);
    if (i > IX.crD2) add('dk', 'Δ₁, Δ₂: replace column 1 or 2 with the right-hand side', C_ALG);
    if (i > IX.crX) add('x', 'x₁ = Δ₁/Δ,  x₂ = Δ₂/Δ', C_ALG);
  } else if (i < IX.chk) {
    if (i > IX.p1) add('p1', 'simple poles: −1, −2', C_Z);
    if (i > IX.p2) add('p2', 'complex pair: −0.15 ± j0.853', C_Z);
  } else {
    if (i > IX.v1b) add('v1', 'i₁(0⁺) = 0.4 A: theorem and answer agree ✓');
    if (i > IX.v2b) add('v2', 'i₂(0⁺) = 0: theorem and answer agree ✓');
    if (i > IX.fin) add('f', 'i₁(∞) = i₂(∞) = 0');
  }
  return rows;
}

/* ═══ 6 BOARD + PLOT ══════════════════════════════════════════════════════ */
// Board: the results so far. In s until the inverse starts, then the table of time-domain coefficients.
// Every value reads "?" until the voice has said it (R4).
function Board({ bi, land, reduced }) {
  if (bi < IX.row1) return null;
  const at = (id) => bi >= IX[id], slot = (k, id, node, pad) => <BSlot k={k} got={at(id)} landing={land === k} reduced={reduced} pad={pad}>{node}</BSlot>;
  const frac = (num) => <Frac num={num} den={DEN} size={FS_MIN} color={INK} />;
  if (bi < IX.t1) {
    return (
      <div data-gate="board" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: BOARD_H, display: 'flex', flexDirection: 'column', gap: 5 })}>
        {zoneHead('RESULTS IN s', C_Z)}
        <BRow label="system"><Mat2 a={A_VAL} x={['I₁', 'I₂']} b={B_VAL} shown={at('row2') ? 2 : 1} size={FS_MIN} /></BRow>
        {at('cr') ? <BRow label="Δ">{slot('D', 'dB', '(40s² + 12s + 30)/s')}</BRow> : null}
        {at('cr') ? <BRow label="I₁(s)">{slot('I1', 'i1C', frac('16s³ + 76s² + 80s'), '2px 7px')}</BRow> : null}
        {at('cr') ? <BRow label="I₂(s)">{slot('I2', 'i2C', frac('60s² + 86s + 12'), '2px 7px')}</BRow> : null}
        {at('p1') ? <BRow label="poles"><span data-poles="1">{'−1, −2' + (at('p2') ? ', −0.15 ± j0.853' : '')}</span></BRow> : null}
      </div>
    );
  }
  const head = [[E15, 'cos 0.853t'], [E15, 'sin 0.853t'], [E1, ''], [E2, '']];
  const row = (name, ks, K, ids) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_IT, width: 64, flexShrink: 0, whiteSpace: 'nowrap' }}>{name}</span>
      {ks.map((k, j) => <span key={k} style={{ width: j < 2 ? 88 : 64, display: 'flex', justifyContent: 'center' }}>{slot(k, ids[j], kv(K[['c', 's', 'e1', 'e2'][j]]))}</span>)}
    </div>
  );
  return (
    <div data-gate="board" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: BOARD_H, display: 'flex', flexDirection: 'column', gap: 6 })}>
      {zoneHead('BACK TO TIME — COEFFICIENTS IN A, t > 0', C_IT)}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 64, flexShrink: 0 }}>term</span>
        {head.map((hd, j) => <span key={j} style={{ width: j < 2 ? 88 : 64, textAlign: 'center', fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: 1.25 }}>{hd[0]}<br />{hd[1] || ' '}</span>)}
      </div>
      {row('i₁(t) =', ['c11', 'c12', 'c13', 'c14'], K1, ['c11', 'c12', 'c13', 'c14'])}
      {at('t2') ? row('i₂(t) =', ['c21', 'c22', 'c23', 'c24'], K2, ['c21', 'c22', 'c23', 'c24']) : null}
      <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE }}>each current is the sum of coefficient × term</div>
      <div data-checks="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {at('v1a') ? <span>{'i₁(0⁺) = 0.4 A' + (at('v1b') ? '  =  0.841 − 0.345 − 0.096 ✓' : '')}</span> : null}
        {at('v2a') ? <span>{'i₂(0⁺) = 0' + (at('v2b') ? '  =  0.723 − 0.241 − 0.482 ✓' : '')}</span> : null}
      </div>
    </div>
  );
}

// PlotPanel: i₁(t) once its four terms are in, i₂(t) (dashed) once its four are; the Your-turn answer when shown
function PlotPanel({ bi, ytShown }) {
  if (!ytShown && bi < IX.c14) return null;
  const top = PANEL_TOP + BOARD_H + 8, h = PANEL_H - BOARD_H - 8, w = SIDE_W - 26, ph = h - 18 - 20 - 4;
  return (
    <div data-gate="plot" data-plot-source={ytShown ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, display: 'flex', flexDirection: 'column', gap: 4 })}>
      {zoneHead(ytShown ? 'YOUR TURN — i₂(t)' : 'THE MESH CURRENTS', ytShown ? ACCENT : C_IT)}
      {ytShown
        ? <LPlot curves={[{ f: (t) => 0.5 * Math.exp(-t / 2), t0: 0, t1: T_PLOT_YT, label: 'i₂' }]} tmin={0} tmax={T_PLOT_YT} ymin={0} ymax={0.6} tstep={2} width={w} height={ph} unitY="i, A"
          marks={[{ id: 'yt0', t: 0, y: 0.5, label: '0.5 A' }]} />
        : <LPlot curves={[{ f: iOf(K1), t0: 0, t1: T_PLOT, label: 'i₁' }].concat(bi >= IX.c24 ? [{ f: iOf(K2), t0: 0, t1: T_PLOT, dash: true, label: 'i₂' }] : [])}
          tmin={0} tmax={T_PLOT} ymin={-0.6} ymax={0.9} tstep={5} width={w} height={ph} unitY="i, A"
          marks={bi >= IX.v1a ? [{ id: 'i10', t: 0, y: 0.4, label: bi >= IX.v2a ? '' : '0.4 A' }].concat(bi >= IX.v2a ? [{ id: 'i20', t: 0, y: 0, hollow: true }] : []) : []} />}
    </div>
  );
}

/* ═══ 7 YOUR TURN + PAGE ══════════════════════════════════════════════════ */
// Source u(t) V, 1 Ω in mesh 1, 1 H shared, 1 Ω in mesh 2, zero initial conditions:
// [1+s, −s; −s, 1+s][I₁; I₂] = [1/s; 0],  Δ = 2s + 1,  I₂ = 1/(2s + 1),  i₂ = 0.5e^(−t/2) u(t) A.
const sup = (t) => <sup style={{ fontSize: FS_MIN, lineHeight: 0 }}>{t}</sup>;
const PAGE = {
  Circuit, Board, PlotPanel,
  circuitTag: (bi) => (bi > IX.tR ? 'S-DOMAIN' : bi >= IX.tr ? 'TRANSFORMING' : 'TIME DOMAIN'),
  links: [
    { dir: 'back:', href: 'S-Domain_Circuit_Analysis_v1.1.0.html', label: 'Lecture 8 · S-Domain Circuit Analysis' },
    { dir: 'next:', href: 'Laplace_L10_Node_Analysis_s-Domain_v1.0.0.html', label: 'Lecture 10 · Node-Voltage Analysis in the s-Domain' },
  ],
  yourTurn: {
    circuit: <MeshLadder parts={PARTS_YT} h={128} label="Two-mesh circuit: unit step source, 1 ohm resistor, 1 henry inductor shared by both meshes, 1 ohm resistor; both mesh currents clockwise" />,
    problem: 'A source u(t) V drives a 1 Ω resistor in mesh 1, a 1 H inductor shared by both meshes, and a 1 Ω resistor in mesh 2. Zero initial conditions; both mesh currents clockwise.',
    ask: 'Find the matrix, Δ, I₂(s) and i₂(t).',
    steps: [
      ['matrix', '[1+s, −s; −s, 1+s][I₁; I₂] = [1/s; 0]'],
      ['Δ', '(1+s)² − s² = 2s + 1'],
      ['I₂(s)', 'Δ₂/Δ = 1/(2s + 1)'],
      ['also', <span key="a">{'I₁ = (s+1)/(s(2s+1)), so i₁ = 1 − 0.5e'}{sup('−t/2')}{' A'}</span>],
      ['check', 'i₂(0⁺) = 0.5 A ✓ (the inductor is open at t = 0⁺)'],
    ],
    answer: <span>{'i₂(t) = 0.5e'}{sup('−t/2')}{' u(t) A'}</span>,
    sr: 'Your turn: a unit step source, a 1 ohm resistor in mesh 1, a 1 henry inductor shared by both meshes, a 1 ohm resistor in mesh 2. Find the matrix, delta, I-two of s and i-two of t.',
    srAnswer: 'i-two of t equals 0.5 e to the minus t over 2, in amps.',
  },
};
