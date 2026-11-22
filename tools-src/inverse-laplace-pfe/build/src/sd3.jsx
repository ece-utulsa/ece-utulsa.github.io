/* ═══ SCENE — S-Domain Circuit Analysis (the capstone) ══════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  MODEL                 series RL, step V_S, initial current I₀ (sympy-verified by Director)
     3  YOUR TURN             series RC with a pre-charged capacitor, spec v1.1.0 key
     4  LANGUAGE PACK         narration text, UI strings
     5  BEATS                 one line at a time (focus rules R1–R7)
     6  DRAWINGS              loop schematics, initial-condition models, i(t) plot
     7  PANELS                circuit, solve, element models, i(t), bottom band, Your-turn card
     8  SCENE
   Sign convention: the loop current i(t), I(s) is clockwise (out of the source's + terminal, through R,
   down through the reactive element). Units: V, A, Ω, H, F, s. */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5;     // s: pause after each clip before the next line replaces it (focus rule R6)
const M0 = { R: 2, L: 1, VS: 10, I0: 3 };   // the worked example: Ω, H, V, A
const W_AC = 10;           // rad/s: probe frequency of the AC (s = jω) view
const VS_RANGE = [2, 24, 1], I0_RANGE = [0, 8, 0.5], R_RANGE = [0.5, 10, 0.5], L_RANGE = [0.25, 4, 0.25];   // Explore sliders: min, max, step
const CIRC_H = 208;        // px: height of the circuit panel
const MODELS_H = 224;      // px: height of the element-models panel
const SCH_W = 296, SCH_H = 140, SCH_Y0 = 6;   // px: one loop schematic (viewBox starts SCH_Y0 down)
const TAUS = 5;            // the i(t) plot spans five time constants
const C_Z = TEAL;          // the circuit and its impedances
const C_IC = AMBER;        // initial conditions as sources, and coefficients
const C_IT = GREEN;        // i(t)
const C_UNI = PURPLE;      // the DC / AC / transient unification
const MINUS = '\u2212';

/* ═══ 2 MODEL ═════════════════════════════════════════════════════════════ */
// number to dp decimals (default 2) with a true minus sign, trailing zeros dropped
const num = (x, dp) => {
  const p = Math.pow(10, dp == null ? 2 : dp), r = Math.round(x * p) / p;
  return (r < 0 ? MINUS : '') + String(Math.abs(r));
};
const signed = (x) => (x < 0 ? MINUS + ' ' : '+ ') + num(Math.abs(x));
const SUP = { 0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3', 4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079', '.': '\u00b7' };
// e^(−x t) with a superscript exponent
const expo = (x) => 'e\u207b' + String(num(x)).split('').map((c) => SUP[c] || c).join('') + '\u1d57';

// series RL with a step V_S and initial current I₀:  I(s)(R + sL) = V_S/s + L·I₀
//   I(s) = A/s + B/(s + p),  A = V_S/R (final value),  B = I₀ − V_S/R,  p = R/L;  i(t) = A + B·e^(−pt)
function solve(m) {
  const { R, L, VS, I0 } = m, p = R / L, A = VS / R, B = I0 - VS / R, sL = (L === 1 ? 's' : num(L) + 's');
  const zMag = Math.hypot(R, W_AC * L);                 // |Z| at s = jω, Ω
  return {
    R, L, VS, I0, p, A, B, tau: L / R, Lic: L * I0, f: (t) => A + B * Math.exp(-p * t),
    sL, kvl: 'I(s)(' + num(R) + ' + ' + sL + ') = ' + num(VS) + '/s + ' + num(L * I0),
    Is: 'I(s) = (' + num(L * I0) + 's + ' + num(VS) + ') / (s(' + sL + ' + ' + num(R) + '))',
    form: 'I(s) = A/s + B/(s + ' + num(p) + ')',
    pfe: 'I(s) = ' + num(A) + '/s ' + signed(B) + '/(s + ' + num(p) + ')',
    it: num(A) + ' ' + signed(B) + expo(p) + ' A',
    zMag, iAC: VS / zMag, phase: -Math.atan2(W_AC * L, R) * 180 / Math.PI,
  };
}
const SOL0 = solve(M0);

/* ═══ 3 YOUR TURN ═════════════════════════════════════════════════════════ */
// Series RC: R = 2 Ω, C = 0.5 F, 10 V step, V_C(0⁻) = 4 V opposing the source.
// 10/s = I(s)(2 + 2/s) + 4/s  →  I(s) = 3/(s + 1)  →  i(t) = 3e^(−t) A;  i(0) = 3 A, i(∞) = 0.
const YT = {
  steps: [
    ['transform', 'R \u2192 2;\u2002C \u2192 1/(sC) = 2/s, in series with the source 4/s;\u2002the step becomes 10/s'],
    ['KVL', '10/s = I(s)(2 + 2/s) + 4/s,\u2002so\u2002I(s)(2 + 2/s) = 6/s'],
    ['solve', 'I(s) = 3/(s + 1)'],
    ['check', 'i(0) = (10 \u2212 4)/2 = 3 A;\u2002i(\u221e) = 0 (C is open at DC)'],
  ],
  it: '3e\u207b\u1d57 A',
  say: '3 e to the minus t amps',
  f: (t) => 3 * Math.exp(-t), tau: 1, i0: 3, iInf: 0,
};

/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 16 }, (_, i) => 'sd3_line' + (i + 1) + '.mp3'),
  durs: [13.704, 15.432, 13.224, 10.488, 14.472, 13.272, 12.36, 10.128, 8.736, 13.8, 11.136, 18.144, 20.304, 14.904, 13.104, 12.456],
  text: [
    'This is where it all comes together. Every tool you\u2019ve built \u2014 the transform, its properties, partial fractions \u2014 now solves an actual circuit. The trick is to work the circuit in the s-domain, where it\u2019s just algebra.',
    'S-domain analysis turns the differential equations that describe inductors and capacitors into algebraic ones. You analyse the circuit with the ordinary tools \u2014 Ohm\u2019s law, KVL, KCL, nodal, mesh \u2014 only now in s.',
    'Step one: transform the circuit. Every element becomes an impedance in s. A resistor stays R. An inductor becomes s-L. A capacitor becomes one over s-C.',
    'The sources transform too \u2014 a step of V-S becomes V-S over s. And here\u2019s what\u2019s unique to the s-domain: the initial conditions become sources of their own.',
    'Take a charged inductor. From the differentiation property, V-L of s is s-L times I-L, minus L times the initial current. That\u2019s an impedance s-L in series with a voltage source \u2014 L times the initial current.',
    'A charged capacitor is the dual: one over s-C, with the initial voltage as its source. Either way, the stored energy is carried into the s-domain automatically \u2014 no separate initial-condition step later.',
    'Step two: solve. There are no derivatives left \u2014 it\u2019s an algebra problem. Use exactly the tools from the course: series and parallel, the voltage divider, nodal, mesh.',
    'Let\u2019s do one. A series R-L circuit \u2014 R is 2 ohms, L is 1 henry \u2014 with a 10-volt step applied, and the inductor already carrying 3 amps.',
    'Transform it: the resistor is 2, the inductor is s, the initial current becomes a 3-volt source, and the input is 10 over s.',
    'One loop, so one KVL equation: I-of-s times the quantity 2 plus s equals 10 over s, plus 3. Solve \u2014 pure algebra \u2014 and I-of-s is 3s plus 10, over s times s plus 2.',
    'Invert it with partial fractions \u2014 two simple poles \u2014 to get 5 over s minus 2 over s plus 2. So the current is five minus two e-to-the-minus-2t amps.',
    'And it checks itself. At t equals zero the current is 3 amps \u2014 the initial condition, carried through with no extra work. As time runs on it settles to 5 amps, which is just V-S over R \u2014 the DC answer. Transient and steady state, from one algebraic solve.',
    'Now the payoff. This one method contains everything you\u2019ve learned. Let s go to zero and you have the DC circuit. Let s equal j-omega and you have AC steady-state \u2014 phasor analysis. Keep s general and the transient comes with it. DC, AC, and transient \u2014 one framework.',
    'Every piece connects here. The transform and its properties turned calculus into algebra; partial fractions inverted the result; and the impedances s-L and one-over-s-C came straight from the differentiation property. This is the summit.',
    'So the whole method: transform the circuit, with initial conditions as sources; solve it with ordinary algebra; invert to get the time response. DC, AC, and transient, all at once.',
    'Your turn. On paper, transform the series RC circuit, with the capacitor\u2019s initial voltage as a source, solve for I-of-s, and invert. Press Show solution to check.',
  ],
  rail: ['STEP 1 \u00b7 transform', 'STEP 2 \u00b7 solve (algebra)', 'STEP 3 \u00b7 invert + check', 'THE UNIFICATION'],
  card: {
    series: 'ECE 2003 \u00b7 s-domain analysis \u00b7 capstone',
    title: 'S-Domain Circuit Analysis',
    sentence: 'You\u2019ll solve a series RL circuit, with the inductor already carrying current, entirely in the s-domain.',
    steps: [
      'Transform the circuit: impedances, with initial conditions as sources.',
      'Solve with algebra (KVL).',
      'Invert with partial fractions, and check.',
    ],
    able: 'Solve an RL or RC circuit with initial conditions by s-domain analysis.',
  },
  ui: {
    kicker: 'S-DOMAIN CIRCUIT ANALYSIS \u00b7 THE CAPSTONE',
    title: 'One method, three answers',
    sub: 'R \u2192 R\u2003L \u2192 sL\u2003C \u2192 1/(sC)\u2003\u00b7\u2003initial conditions become sources',
    header: 'S-Domain Circuit Analysis',
    headerSub: '\u00b7 transform \u2192 algebra \u2192 invert',
    keyPoint: 'Transform the circuit (initial conditions become sources) \u2192 solve with algebra \u2192 invert. DC, AC and transient from one method.',
    railHead: 'THE PROCESS',
    arcHead: 'THE ARC',
    arc: 'sL and 1/(sC) came from d/dt \u2192 \u00d7s; partial fractions inverted the result',
    circHead: 'THE CIRCUIT',
    timeLabel: 'TIME DOMAIN',
    sLabel: 'S-DOMAIN (transformed)',
    workHead: 'THE SOLVE \u2014 ALGEBRA, NOT CALCULUS',
    modelHead: 'ELEMENT MODELS',
    icHead: 'INITIAL CONDITIONS BECOME SOURCES',
    outHead: 'i(t) \u2014 AND IT CHECKS ITSELF',
    outHeadYT: 'YOUR TURN \u2014 i(t)',
    uniHead: 'THE UNIFICATION \u2014 ONE METHOD',
    knobHead: 'EXPLORE THE CIRCUIT VALUES',
    views: ['DC \u00b7 s\u21920', 'AC \u00b7 s=j\u03c9', 'full s'],
    tourTag: 'TOUR', exploreTag: 'EXPLORE',
    notes: [
      'the usual tools \u2014 only now in s',
      'differential equations become algebraic ones',
      'every element becomes an impedance in s',
      'a step of V_S becomes V_S/s',
      'the charged inductor carries its own source',
      'the charged capacitor is the dual',
      'no derivatives left \u2014 this is algebra',
      'one loop, one unknown current',
      'the initial condition is already in the circuit',
      'solve for I(s) \u2014 ordinary algebra',
      'two simple poles \u2192 back to time',
      'the initial condition and the DC answer, both free',
      'DC, AC and transient are one circuit',
      'every earlier piece converges here',
      'transform \u00b7 solve \u00b7 invert',
      'work the RC problem on paper, then show the solution',
    ],
    noteExplore: 'change V_S, I\u2080, R or L \u2014 the whole chain follows',
    noteStep: 'step with \u25c0 \u25b6; the sliders appear after the tour',
    endTitle: 'The summit \u2713', endSub: 'try the Your-turn problem \u00b7 or explore the circuit values',
    srSummary: 'S-domain circuit analysis. ',
  },
};

/* ═══ 5 BEATS — one line at a time (focus rules R1–R7) ═══════════════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based), `from` the fraction of
// that clip at which the beat starts (estimated from the script; the clips are not shortened or moved).
//   rail  process step: -1 before step 1, 0 transform, 1 solve, 2 invert + check, 3 the unification
//   land  slot that lands on this beat ('tR', 'tL', 'tIC', 'tV' on the s-domain circuit; 'A', 'B') or ''
const BEATS = [
  { id: 'intro', line: 1, from: 0.4, rail: -1, cap: 'the whole toolkit \u2192 a real circuit' },
  { id: 'de', line: 2, from: 0, rail: -1, cap: 's-domain: differential equations \u2192 algebraic equations' },
  { id: 'tools', line: 2, from: 0.52, rail: -1, cap: 'the ordinary tools \u2014 Ohm\u2019s law, KVL, KCL, nodal, mesh \u2014 now in s' },
  { id: 'step1', line: 3, from: 0, rail: 0, cap: 'STEP 1\u2003transform the circuit: every element becomes an impedance in s' },
  { id: 'mR', line: 3, from: 0.42, rail: 0, cap: 'a resistor stays R' },
  { id: 'mL', line: 3, from: 0.58, rail: 0, cap: 'an inductor becomes sL' },
  { id: 'mC', line: 3, from: 0.76, rail: 0, cap: 'a capacitor becomes 1/(sC)' },
  { id: 'src', line: 4, from: 0.05, rail: 0, cap: 'sources transform too: a step V_S becomes V_S/s' },
  { id: 'ics', line: 4, from: 0.5, rail: 0, cap: 'unique to the s-domain: initial conditions become sources' },
  { id: 'icL1', line: 5, from: 0.12, rail: 0, cap: 'charged L:\u2003V_L(s) = sL\u00b7I_L(s) \u2212 L\u00b7I_L(0\u207b)' },
  { id: 'icL2', line: 5, from: 0.62, rail: 0, cap: 'that is sL in series with a voltage source L\u00b7I_L(0\u207b)' },
  { id: 'icC', line: 6, from: 0.05, rail: 0, cap: 'charged C, the dual:\u20031/(sC) in series with a source V_C(0\u207b)/s' },
  { id: 'energy', line: 6, from: 0.48, rail: 0, cap: 'the stored energy is carried into the s-domain automatically' },
  { id: 'step2', line: 7, from: 0, rail: 1, cap: 'STEP 2\u2003solve: no derivatives left \u2014 an algebra problem' },
  { id: 'tools2', line: 7, from: 0.56, rail: 1, cap: 'series and parallel, the voltage divider, nodal, mesh' },
  { id: 'ex', line: 8, from: 0.1, rail: 1, cap: 'a series RL circuit: R = 2 \u03a9, L = 1 H' },
  { id: 'ex2', line: 8, from: 0.55, rail: 1, cap: 'a 10 V step, and the inductor already carrying 3 A' },
  { id: 'tr', line: 9, from: 0, rail: 1, cap: 'transform it, element by element' },
  { id: 'tR', line: 9, from: 0.14, rail: 1, land: 'tR', cap: 'the resistor is 2' },
  { id: 'tL', line: 9, from: 0.3, rail: 1, land: 'tL', cap: 'the inductor is s' },
  { id: 'tIC', line: 9, from: 0.46, rail: 1, land: 'tIC', cap: 'the initial current becomes a 3 V source' },
  { id: 'tV', line: 9, from: 0.8, rail: 1, land: 'tV', cap: 'the input is 10/s' },
  { id: 'kvl', line: 10, from: 0.1, rail: 1, cap: 'one loop, one KVL equation:\u2003I(s)(2 + s) = 10/s + 3' },
  { id: 'Is', line: 10, from: 0.62, rail: 1, cap: 'solve \u2014 pure algebra:\u2003I(s) = (3s + 10)/(s(s + 2))' },
  { id: 'form', line: 11, from: 0.02, rail: 2, cap: 'STEP 3\u2003invert with partial fractions: two simple poles' },
  { id: 'A', line: 11, from: 0.42, rail: 2, land: 'A', cap: '5/s \u2026' },
  { id: 'B', line: 11, from: 0.52, rail: 2, land: 'B', cap: '5/s \u2212 2/(s + 2)' },
  { id: 'it', line: 11, from: 0.68, rail: 2, cap: 'i(t) = 5 \u2212 2e\u207b\u00b2\u1d57 A' },
  { id: 'chk0', line: 12, from: 0.1, rail: 2, cap: 'at t = 0 the current is 3 A: the initial condition, carried through' },
  { id: 'chkInf', line: 12, from: 0.44, rail: 2, cap: 'it settles to 5 A = V_S/R: the DC answer' },
  { id: 'one', line: 12, from: 0.8, rail: 2, cap: 'transient and steady state, from one algebraic solve' },
  { id: 'pay', line: 13, from: 0, rail: 3, cap: 'THE PAYOFF\u2003this one method contains everything' },
  { id: 'dc', line: 13, from: 0.27, rail: 3, cap: 's \u2192 0: the DC circuit' },
  { id: 'ac', line: 13, from: 0.41, rail: 3, cap: 's = j\u03c9: AC steady state \u2014 phasor analysis' },
  { id: 'full', line: 13, from: 0.62, rail: 3, cap: 'keep s general: the transient comes with it' },
  { id: 'arc', line: 14, from: 0, rail: 3, cap: 'sL and 1/(sC) came from the differentiation property \u00b7 partial fractions inverted the result' },
  { id: 'sum', line: 15, from: 0, rail: 3, cap: 'transform (initial conditions as sources) \u2192 solve by algebra \u2192 invert' },
  { id: 'yt', line: 16, from: 0, rail: 3, cap: 'Your turn \u2014 on paper: transform the series RC circuit, solve for I(s), invert, then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.sum;                                // last line of the tour proper (the Your-turn line is not one)

// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}

/* ═══ 6 DRAWINGS ══════════════════════════════════════════════════════════ */
const svgText = (size, fill, weight) => ({ fontFamily: MONO, fontSize: size || FS_MIN, fill: fill || C_Z, fontWeight: weight || 600 });
// a voltage source: circle with polarity marks; `plusFirst` puts + on the top (or left, when horizontal)
function Source({ cx, cy, color, plusFirst, horizontal }) {
  const a = plusFirst ? '+' : MINUS, b = plusFirst ? MINUS : '+';
  return (
    <g>
      <circle cx={cx} cy={cy} r="13" fill={CARD} stroke={color} strokeWidth="1.8" />
      <text x={horizontal ? cx - 6 : cx} y={horizontal ? cy + 4.5 : cy - 2} textAnchor="middle" {...svgText(FS_MIN, color)}>{a}</text>
      <text x={horizontal ? cx + 6 : cx} y={horizontal ? cy + 4.5 : cy + 11} textAnchor="middle" {...svgText(FS_MIN, color)}>{b}</text>
    </g>
  );
}
// a schematic label that reads "?" until its value has been spoken; ringed in amber while it lands (R4, R5, R7)
function SLabel({ x, y, anchor, text, shown, landing, slot, color }) {
  const t = shown ? text : '?', w = t.length * 8 + 8, x0 = anchor === 'end' ? x - w + 4 : anchor === 'middle' ? x - w / 2 : x - 4;
  return (
    <g>
      {landing ? <rect x={x0} y={y - 14} width={w} height="19" rx="4" fill="none" stroke={AMBER} strokeWidth="2" /> : null}
      <text data-slot={slot} data-tape={slot} x={x} y={y} textAnchor={anchor} {...svgText(FS_MIN, color || C_Z)}>{t}</text>
    </g>
  );
}

// LoopSchematic: source (left leg) — R (top) — reactive element (right leg) — return (bottom); current clockwise.
//   mode 'time': the RL circuit with its values (or symbols only while `vals` is false)
//   mode 's':    the transformed circuit; `got` says which labels have been spoken; `land` is the one landing now
//   mode 'rc':   the Your-turn RC circuit in the time domain
function LoopSchematic({ mode, sol, vals, vals2, got, land, label }) {
  const x0 = 78, x1 = 246, y0 = 34, y1 = 134, rx = 132, rw = 52, cy = 84;
  const wire = (a, b, c, d) => <line x1={a} y1={b} x2={c} y2={d} stroke={C_Z} strokeWidth="1.6" />;
  const s = mode === 's', rc = mode === 'rc', g = got || {};
  return (
    <svg viewBox={`0 ${SCH_Y0} ${SCH_W} ${SCH_H}`} width={SCH_W} height={SCH_H} role="img" aria-label={label} style={{ display: 'block', flexShrink: 0 }}>
      {wire(x0, y0, rx, y0)}{wire(rx + rw, y0, x1, y0)}{wire(x0, y1, x1, y1)}{wire(x0, y0, x0, cy - 13)}{wire(x0, cy + 13, x0, y1)}
      <rect x={rx} y={y0 - 8} width={rw} height="16" fill={CARD} stroke={C_Z} strokeWidth="1.8" />
      {s ? <SLabel x={rx + rw / 2} y={y0 - 13} anchor="middle" text={num(sol.R)} shown={g.tR} landing={land === 'tR'} slot="tR" />
        : <text x={rx + rw / 2} y={y0 - 13} textAnchor="middle" {...svgText()}>{rc ? 'R = 2 \u03a9' : vals ? 'R = ' + num(sol.R) + ' \u03a9' : 'R'}</text>}
      <Source cx={x0} cy={cy} color={C_Z} plusFirst />
      {s ? <SLabel x={x0 - 19} y={cy + 5} anchor="end" text={num(sol.VS) + '/s'} shown={g.tV} landing={land === 'tV'} slot="tV" />
        : <text x={x0 - 19} y={cy + 5} textAnchor="end" {...svgText()}>{rc ? '10 V' : vals2 ? num(sol.VS) + ' V' : 'V_S'}</text>}
      {!s ? <text x={x0 - 19} y={cy - 12} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>step</text> : null}
      {/* right leg */}
      {s ? (
        <g>
          {wire(x1, y0, x1, 48)}<rect x={x1 - 9} y="48" width="18" height="30" fill={CARD} stroke={C_Z} strokeWidth="1.8" />{wire(x1, 78, x1, 93)}{wire(x1, 119, x1, y1)}
          <SLabel x={x1 - 16} y={68} anchor="end" text={sol.sL} shown={g.tL} landing={land === 'tL'} slot="tL" />
          {/* the initial-condition source aids the clockwise current: − on top, + below */}
          <Source cx={x1} cy={106} color={C_IC} plusFirst={false} />
          <SLabel x={x1 - 19} y={111} anchor="end" text={num(sol.Lic) + ' V'} shown={g.tIC} landing={land === 'tIC'} slot="tIC" color={C_IC} />
          {g.tIC ? <text x={x1 + 18} y={111} {...svgText(FS_MIN, C_IC, 400)}>{'L\u00b7I\u2080'}</text> : null}
        </g>
      ) : rc ? (
        <g>
          {wire(x1, y0, x1, cy - 4)}{wire(x1, cy + 4, x1, y1)}
          <line x1={x1 - 13} y1={cy - 4} x2={x1 + 13} y2={cy - 4} stroke={C_Z} strokeWidth="2.2" /><line x1={x1 - 13} y1={cy + 4} x2={x1 + 13} y2={cy + 4} stroke={C_Z} strokeWidth="2.2" />
          <text x={x1 - 19} y={cy + 5} textAnchor="end" {...svgText()}>{'C = 0.5 F'}</text>
          <text x={x1 + 17} y={cy - 9} {...svgText(FS_MIN, C_IC)}>+</text><text x={x1 + 17} y={cy + 19} {...svgText(FS_MIN, C_IC)}>{MINUS}</text>
          <text x={x1 - 19} y={cy + 22} textAnchor="end" {...svgText(FS_MIN, C_IC)}>{'V_C(0\u207b) = 4 V'}</text>
        </g>
      ) : (
        <g>
          {wire(x1, y0, x1, 62)}{wire(x1, 106, x1, y1)}
          <path d={'M' + x1 + ' 62 ' + [0, 1, 2, 3].map(() => 'a5.5 5.5 0 0 1 0 11').join(' ')} fill="none" stroke={C_Z} strokeWidth="1.8" />
          <text x={x1 - 16} y={80} textAnchor="end" {...svgText()}>{vals ? 'L = ' + num(sol.L) + ' H' : 'L'}</text>
          <text x={x1 - 16} y={98} textAnchor="end" {...svgText(FS_MIN, C_IC)}>{vals2 ? 'I\u2080 = ' + num(sol.I0) + ' A \u2193' : 'I\u2080 \u2193'}</text>
        </g>
      )}
      {/* loop current, clockwise */}
      <text x={x0 + 40} y={cy - 6} textAnchor="middle" {...svgText(FS_MIN, INK)}>{s ? 'I(s)' : 'i(t)'}</text>
      <path d={`M${x0 + 27} ${cy + 5} l26 0 m-6 -4 l6 4 l-6 4`} fill="none" stroke={INK} strokeWidth="1.4" />
    </svg>
  );
}

// IcModel: an impedance box in series with its initial-condition source (amber, with polarity). Current enters at the left.
//   inductor: source aids the current (− then +);  capacitor: source opposes it (+ then −)
function IcModel({ kind }) {
  const L = kind === 'L', y = 22;
  return (
    <svg viewBox="0 8 192 46" width="192" height="46" role="img" data-icmodel={kind}
      aria-label={L ? 'Charged inductor model: sL in series with a voltage source L times the initial current' : 'Charged capacitor model: 1 over sC in series with a voltage source, the initial voltage over s'} style={{ display: 'block' }}>
      <line x1="4" y1={y} x2="26" y2={y} stroke={C_Z} strokeWidth="1.6" /><path d={`M8 ${y - 5} l7 5 l-7 5`} fill="none" stroke={INK} strokeWidth="1.3" />
      <rect x="26" y={y - 9} width="46" height="18" fill={CARD} stroke={C_Z} strokeWidth="1.8" />
      <line x1="72" y1={y} x2="101" y2={y} stroke={C_Z} strokeWidth="1.6" />
      <Source cx={114} cy={y} color={C_IC} plusFirst={!L} horizontal />
      <line x1="127" y1={y} x2="186" y2={y} stroke={C_Z} strokeWidth="1.6" />
      <text x="49" y={y + 26} textAnchor="middle" {...svgText()}>{L ? 'sL' : '1/(sC)'}</text>
      <text x="124" y={y + 26} textAnchor="middle" {...svgText(FS_MIN, C_IC)}>{L ? 'L\u00b7I_L(0\u207b)' : 'V_C(0\u207b)/s'}</text>
    </svg>
  );
}

// ItPlot: i(t) in A against t in s over five time constants, with numbered axes.
// `mark0` draws the initial value (amber dot), `markInf` the final value (dashed line); the curve only when `shown`.
function ItPlot({ f, tau, i0, iInf, width, height, shown, mark0, markInf }) {
  const padL = 40, padR = 56, padT = 8, padB = 20, N = 240, tmax = TAUS * tau;
  const top = Math.max(i0, iInf, 1e-9), step = niceStep(top, 3), y1 = Math.ceil(top / step - 1e-9) * step;
  const PX = (t) => padL + (t / tmax) * (width - padL - padR), PY = (y) => padT + (1 - y / y1) * (height - padT - padB);
  let d = ''; for (let k = 0; k <= N; k++) { const t = (k / N) * tmax; d += (k ? 'L' : 'M') + PX(t).toFixed(1) + ' ' + PY(f(t)).toFixed(1) + ' '; }
  const yt = []; for (let v = 0; v <= y1 + step * 1e-6; v += step) yt.push(v);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" data-plot="it"
      aria-label={'Plot of the current i(t) in amperes for t from 0 to ' + num(tmax) + ' seconds'} style={{ display: 'block', flexShrink: 0 }}>
      {yt.map((v) => (
        <g key={v}>
          <line x1={padL} y1={PY(v)} x2={width - padR} y2={PY(v)} stroke={LINE} strokeWidth="0.8" />
          <text x={padL - 6} y={PY(v) + 4.5} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>{tickLabel(v, step)}</text>
        </g>
      ))}
      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke={MUTE} strokeWidth="1" /><line x1={padL} y1={PY(0)} x2={width - padR} y2={PY(0)} stroke={MUTE} strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k}>
          <line x1={PX(k * tau)} y1={height - padB} x2={PX(k * tau)} y2={height - padB + 4} stroke={MUTE} strokeWidth="1" />
          <text x={PX(k * tau)} y={height - 3} textAnchor="middle" {...svgText(FS_MIN, MUTE, 400)}>{num(k * tau)}</text>
        </g>
      ))}
      <text x={width - 2} y={height - 3} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>t, s</text>
      <text x={width - 2} y={padT + 10} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>i, A</text>
      {shown && markInf ? <line data-mark="inf" x1={padL} y1={PY(iInf)} x2={width - padR} y2={PY(iInf)} stroke={C_UNI} strokeWidth="1.6" strokeDasharray="6 4" /> : null}
      {shown ? <path data-curve="1" d={d} fill="none" stroke={C_IT} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {shown && mark0 ? <circle data-mark="0" cx={PX(0)} cy={PY(i0)} r="5" fill={C_IC} /> : null}
    </svg>
  );
}

/* ═══ 7 PANELS ════════════════════════════════════════════════════════════ */
// CircuitPanel: the time-domain circuit and, from line 9, its s-domain transform built element by element
function CircuitPanel({ ui, bi, sol, live }) {
  if (bi < IX.de && !live) return null;
  const b = BEATS[Math.max(0, bi)];
  const got = live ? { tR: true, tL: true, tIC: true, tV: true } : { tR: bi >= IX.tR, tL: bi >= IX.tL, tIC: bi >= IX.tIC, tV: bi >= IX.tV };
  const showS = live || bi >= IX.tr;
  return (
    <div data-gate="circuit" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: CIRC_H, display: 'flex', flexDirection: 'column', gap: 3 })}>
      {zoneHead(ui.circHead, ACCENT)}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ width: SCH_W }}>
          {smallLabel(ui.timeLabel)}
          <LoopSchematic mode="time" sol={sol} vals={live || bi >= IX.ex} vals2={live || bi >= IX.ex2} label="Time-domain series RL circuit with a step source" />
        </div>
        {showS ? (
          <div style={{ width: SCH_W, borderLeft: `1px solid ${LINE}`, paddingLeft: 4 }}>
            {smallLabel(ui.sLabel, C_Z)}
            <LoopSchematic mode="s" sol={sol} got={got} land={live ? '' : b.land} label="S-domain circuit: impedances, with the initial condition as a source" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// focus content for beat b: the one line the voice is speaking
function focusOf(b) {
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  const z = (t) => <span style={{ color: C_Z, fontWeight: 600 }}>{t}</span>, ic = (t) => <span style={{ color: C_IC, fontWeight: 600 }}>{t}</span>;
  switch (b.id) {
    case 'intro': return prose('work the circuit in the s-domain: it is just algebra');
    case 'de': return prose('differential equations \u2192 algebraic equations');
    case 'tools': return prose('Ohm\u2019s law, KVL, KCL, nodal, mesh \u2014 now in s');
    case 'step1': return prose('STEP 1: transform the circuit', C_Z);
    case 'mR': return <span>{'R \u2192 '}{z('R')}</span>;
    case 'mL': return <span>{'L \u2192 '}{z('sL')}</span>;
    case 'mC': return <span>{'C \u2192 '}{z('1/(sC)')}</span>;
    case 'src': return <span>{'step V_S \u2192 '}{z('V_S/s')}</span>;
    case 'ics': return prose('initial conditions become sources', C_IC);
    case 'icL1': return <span>{'V_L(s) = sL\u00b7I_L(s) \u2212 '}{ic('L\u00b7I_L(0\u207b)')}</span>;
    case 'icL2': return <span>{z('sL')}{' in series with a source '}{ic('L\u00b7I_L(0\u207b)')}</span>;
    case 'icC': return <span>{z('1/(sC)')}{' in series with a source '}{ic('V_C(0\u207b)/s')}</span>;
    case 'energy': return prose('the stored energy is carried in automatically');
    case 'step2': return prose('STEP 2: solve \u2014 no derivatives left, just algebra');
    case 'tools2': return prose('series/parallel, voltage divider, nodal, mesh');
    case 'ex': return <span>{'series RL: R = 2 \u03a9, L = 1 H'}</span>;
    case 'ex2': return <span>{'10 V step, '}{ic('I\u2080 = 3 A')}</span>;
    case 'tr': return prose('transform it, element by element', C_Z);
    case 'tR': return <span>{'R = 2 \u03a9 \u2192'}<KValue k="tR" text="2" /></span>;
    case 'tL': return <span>{'L = 1 H \u2192 sL'}<KValue k="tL" text="s" /></span>;
    case 'tIC': return <span>{ic('L\u00b7I\u2080')}{' = (1)(3)'}<KValue k="tIC" text="3 V" /></span>;
    case 'tV': return <span>{'10 V step \u2192'}<KValue k="tV" text="10/s" /></span>;
    case 'kvl': return <span>{SOL0.kvl}</span>;
    case 'Is': return <span>{SOL0.Is}</span>;
    case 'form': return <span>{'I(s) = '}<KUnk k="A" />{'/s + '}<KUnk k="B" />{'/(s + 2)'}</span>;
    case 'A': return <span><KUnk k="A" /><KValue k="A" text={num(SOL0.A)} /></span>;
    case 'B': return <span><KUnk k="B" /><KValue k="B" text={num(SOL0.B)} /></span>;
    case 'it': return <span style={{ color: C_IT, fontWeight: 600 }}>{'i(t) = ' + SOL0.it}</span>;
    case 'chk0': return <span>{'i(0) = 5 \u2212 2 = '}{ic('3 A = I\u2080')}</span>;
    case 'chkInf': return <span>{'i(\u221e) = '}<span style={{ color: C_UNI, fontWeight: 600 }}>{'5 A = V_S/R'}</span></span>;
    case 'one': return prose('transient and steady state from one solve');
    case 'pay': return prose('one method contains everything', C_UNI);
    case 'dc': return <span style={{ color: C_UNI }}>{'s \u2192 0: the DC circuit'}</span>;
    case 'ac': return <span style={{ color: C_UNI }}>{'s = j\u03c9: AC steady state (phasors)'}</span>;
    case 'full': return <span style={{ color: C_UNI }}>{'s general: the transient too'}</span>;
    case 'arc': return prose('sL and 1/(sC) came from the differentiation property');
    default: return prose('transform \u2192 solve with algebra \u2192 invert');
  }
}

// finished lines for beat index i: one compact row each (focus rule R1); at most four fit under the focus line
function doneRows(i) {
  const rows = [], add = (key, node, color) => rows.push({ key, node, color });
  if (i < IX.ex) {
    if (i > IX.mC) add('z', <span>{'R \u2192 R\u2002\u00b7\u2002L \u2192 sL\u2002\u00b7\u2002C \u2192 1/(sC)'}</span>, C_Z);
    if (i > IX.src) add('src', <span>{'step V_S \u2192 V_S/s'}</span>, C_Z);
    if (i > IX.icL2) add('icL', <span>{'charged L: sL + series source L\u00b7I_L(0\u207b)'}</span>, C_IC);
    if (i > IX.icC) add('icC', <span>{'charged C: 1/(sC) + series source V_C(0\u207b)/s'}</span>, C_IC);
    return rows;
  }
  if (i > IX.ex2 && i <= IX.tV) add('ex', <span>{'series RL: R = 2 \u03a9, L = 1 H, 10 V step, I\u2080 = 3 A'}</span>);
  if (i > IX.kvl) add('kvl', <span>{'KVL: ' + SOL0.kvl}</span>);
  if (i > IX.Is) add('Is', <span>{SOL0.Is}</span>);
  if (i > IX.form && i <= IX.B) add('form', <span>{SOL0.form}</span>);
  if (i > IX.B) add('pfe', <span>{SOL0.pfe}</span>, C_Z);
  if (i > IX.it) add('it', <span>{'i(t) = ' + SOL0.it}</span>, C_IT);
  return rows;
}

// SolvePanel: the finished lines as compact rows and the one focus line with its colour bar (R1, R2)
function SolvePanel({ ui, bi, live }) {
  const time = useTime(); const TL = useTL();
  if (bi < 0) return null;
  const b = BEATS[bi];
  const rows = live ? [{ key: 'kvl', node: <span>{'KVL: ' + live.kvl}</span> }, { key: 'Is', node: <span>{live.Is}</span> }, { key: 'pfe', node: <span>{live.pfe}</span>, color: C_Z }] : doneRows(bi);
  const bar = live ? C_IT : [ACCENT, C_Z, INK, C_IT, C_UNI][b.rail + 1];
  const top = PANEL_TOP + CIRC_H + 8;
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top, width: WORK_W, height: PANEL_H - CIRC_H - 8, display: 'flex', flexDirection: 'column', gap: 6,
      opacity: bi >= 1 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1) })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(ui.workHead, INK)}
        {live ? <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '0 6px' }}>{ui.exploreTag}</span> : null}
      </div>
      <div data-done="1" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((r) => <div key={r.key} data-done-row={r.key} style={Object.assign(kMono(SMALL_FS, r.color || MUTE), { whiteSpace: 'nowrap', lineHeight: '21px' })}>{r.node}</div>)}
      </div>
      <div data-focus={live ? 'live' : b.id} style={{ marginTop: 2, borderLeft: `5px solid ${bar}`, paddingLeft: 14, minHeight: 44, display: 'flex', alignItems: 'center',
        fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.35 }}>
        <span>{live ? <span style={{ color: C_IT, fontWeight: 600 }}>{'i(t) = ' + live.it}</span> : focusOf(b)}</span>
      </div>
    </div>
  );
}

// ModelsPanel: the element models, the source rule, and the two initial-condition models, each from the line that names it
function ModelsPanel({ ui, bi, live }) {
  const at = (id) => live || bi >= IX[id];
  if (!at('mR')) return null;
  const cards = [['mR', 'resistor', 'Z = R', 'Y = 1/R'], ['mL', 'inductor', 'Z = sL', 'Y = 1/(sL)'], ['mC', 'capacitor', 'Z = 1/(sC)', 'Y = sC']];
  return (
    <div data-gate="models" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: MODELS_H, display: 'flex', flexDirection: 'column', gap: 4 })}>
      {zoneHead(ui.modelHead, C_Z)}
      <div style={{ display: 'flex', gap: 7, minHeight: 54 }}>
        {cards.map((c) => (at(c[0]) ? (
          <div key={c[0]} data-model={c[1]} style={{ flex: 1, border: `1px solid ${C_Z}`, borderRadius: 8, padding: '2px 4px', textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.25 }}>{c[1]}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C_Z, lineHeight: 1.25 }}>{c[2]}</div>
            <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: 1.25 }}>{c[3]}</div>
          </div>
        ) : <div key={c[0]} style={{ flex: 1 }} />))}
      </div>
      <div style={{ minHeight: 18 }}>
        {at('src') ? <div data-srcrule="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: C_Z }}><span style={{ color: MUTE }}>{'sources:\u2002'}</span>{'step V_S \u27fa V_S/s'}</div> : null}
      </div>
      {at('ics') ? (
        <div data-icbox="1" style={{ border: `1px solid ${C_IC}`, borderRadius: 8, padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_IC }}>{ui.icHead}</div>
          <div style={{ display: 'flex', gap: 4, minHeight: 63 }}>
            <div style={{ flex: 1 }}>{at('icL2') ? <React.Fragment>{smallLabel('charged L')}<IcModel kind="L" /></React.Fragment> : null}</div>
            <div style={{ flex: 1 }}>{at('icC') ? <React.Fragment>{smallLabel('charged C')}<IcModel kind="C" /></React.Fragment> : null}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// OutPanel: the coefficients A and B (land here), i(t), its plot and the checks; hidden until line 11 (R4).
// In Explore the coefficient boxes give way to the full i(t) text (the coefficients stay in the I(s) row of the solve panel).
// When the Your-turn solution is shown the panel holds that answer and its plot instead.
function OutPanel({ ui, bi, sol, live, yourTurn, view, reduced }) {
  if (!yourTurn && !live && bi < IX.form) return null;
  const b = BEATS[Math.max(0, bi)], at = (id) => live || bi >= IX[id];
  const top = PANEL_TOP + MODELS_H + 8, h = PANEL_H - MODELS_H - 8;
  const slot = (k, v, got) => (
    <span data-slot={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, border: `2px solid ${got ? C_IC : LINE}`, borderRadius: 6, padding: '0 8px',
      outline: !live && b.land === k && got && reduced ? `3px solid ${C_IC}` : 'none', outlineOffset: 2 }}>
      <span data-unk="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: C_IC }}>{k}</span>
      <span data-tape={k} style={{ fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: got ? INK : MUTE }}>{got ? v : '?'}</span>
    </span>
  );
  const plotH = h - 18 - 20 - 26 - 19 - 3 * 4;   // panel padding, heading, value row, check row, gaps
  return (
    <div data-gate="out" data-ft-source={yourTurn ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, display: 'flex', flexDirection: 'column', gap: 4 })}>
      {zoneHead(yourTurn ? ui.outHeadYT : ui.outHead, yourTurn ? ACCENT : C_IT)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 26 }}>
        {yourTurn || live ? null : slot('A', num(sol.A), at('A'))}{yourTurn || live ? null : slot('B', num(sol.B), at('B'))}
        <span data-ft-text="1" style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 600, color: C_IT, whiteSpace: 'nowrap', marginLeft: 4 }}>
          {yourTurn ? 'i(t) = ' + YT.it : at('it') ? 'i(t) = ' + sol.it : ''}
        </span>
      </div>
      {yourTurn
        ? <ItPlot f={YT.f} tau={YT.tau} i0={YT.i0} iInf={YT.iInf} width={SIDE_W - 26} height={plotH} shown mark0 markInf />
        : <ItPlot f={sol.f} tau={sol.tau} i0={sol.I0} iInf={sol.A} width={SIDE_W - 26} height={plotH} shown={at('it')} mark0={at('chk0')} markInf={at('chkInf')} />}
      <div data-checks="1" style={{ fontFamily: HEAD, fontSize: FS_MIN, color: INK, height: 19, whiteSpace: 'nowrap', display: 'flex', gap: 12 }}>
        {yourTurn ? <span>{'i(0) = 3 A \u00b7 i(\u221e) = 0 (C is open at DC)'}</span> : (
          <React.Fragment>
            {at('chk0') ? <span style={{ color: C_IC, fontWeight: 600 }}>{'i(0) = ' + num(sol.I0) + ' A = I\u2080'}</span> : null}
            {at('chkInf') ? <span style={{ color: C_UNI, fontWeight: view === 0 ? 700 : 600 }}>{'i(\u221e) = ' + num(sol.A) + ' A = V_S/R'}</span> : null}
            {at('one') ? <span style={{ color: C_Z, fontWeight: 600 }}>{'pole ' + num(-sol.p)}</span> : null}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// CaptionLine: the on-screen line for the current beat, as plain text (A and C are units and elements here, not unknowns)
function CaptionLine({ sched, text }) {
  const time = useTime(); const TL = useTL();
  const i = idxAt(sched, time);
  if (i < 0 || time >= TL.FINISH || !text) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div data-gate="caption" style={{ maxWidth: 1040, margin: '0 20px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW,
        padding: '8px 18px', fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' }}>{text}</div>
    </div>
  );
}

// Slider: one labelled range input for a circuit value
function Slider({ label, name, unit, value, range, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, width: 24, flexShrink: 0 }}>{label}</span>
      <input type="range" min={range[0]} max={range[1]} step={range[2]} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={name}
        style={{ flex: 1, minWidth: 0, accentColor: ACCENT, cursor: 'pointer', margin: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, color: INK, width: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(value) + ' ' + unit}</span>
    </div>
  );
}

// the three rows of the unification table for solution s
const uniRows = (s) => [
  ['dc', 's \u2192 0: i(\u221e) = V_S/R = ' + num(s.A) + ' A (L is a short)'],
  ['ac', 'AC: a ' + num(s.VS) + ' V sinusoid at \u03c9 = ' + W_AC + ' rad/s \u2192 Z = R + j\u03c9L, |I| = ' + s.iAC.toFixed(2) + ' A \u2220' + num(s.phase, 1) + '\u00b0'],
  ['full', 'full s: i(t) = ' + s.it + ' (transient + steady state)'],
];

// BottomBand: the circuit-value sliders (only in Explore, after the tour), one-line-back / forward, and the unification table
function BottomBand({ ui, bi, m, sol, live, setM, goBeat, explore, sliders, note, yt, view, setView }) {
  const rowOn = { dc: live || bi >= IX.dc, ac: live || bi >= IX.ac, full: live || bi >= IX.full };
  const anyRow = rowOn.dc || rowOn.ac || rowOn.full;
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H,
      display: 'flex', gap: 14, padding: '8px 14px', alignItems: 'stretch' })}>
      <div style={{ width: 372, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {zoneHead(sliders ? ui.knobHead : 'THE TOUR')}<KMode explore={explore} ui={ui} />
        </div>
        {sliders ? (
          <div data-sliders="1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Slider label="V_S" name="source voltage" unit="V" value={m.VS} range={VS_RANGE} onChange={(v) => setM({ VS: v })} />
              <Slider label={'I\u2080'} name="initial current" unit="A" value={m.I0} range={I0_RANGE} onChange={(v) => setM({ I0: v })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Slider label="R" name="resistance" unit={'\u03a9'} value={m.R} range={R_RANGE} onChange={(v) => setM({ R: v })} />
              <Slider label="L" name="inductance" unit="H" value={m.L} range={L_RANGE} onChange={(v) => setM({ L: v })} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE }}>view</span>
              {ui.views.map((v, i) => <button key={v} type="button" aria-pressed={view === i} onClick={() => setView(i)} style={Object.assign(btnStyle(view === i, C_UNI), { padding: '1px 8px', whiteSpace: 'nowrap' })}>{v}</button>)}
              <button type="button" onClick={() => setM(M0)} style={Object.assign(btnStyle(false), { padding: '1px 8px', marginLeft: 'auto' })}>reset</button>
            </div>
          </div>
        ) : <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE, lineHeight: 1.4 }}>The circuit-value sliders appear here after the tour, for Explore.</div>}
      </div>
      <div style={{ width: 1, background: LINE }} />
      <KNav cur={clamp(bi, 0, LAST)} total={LAST + 1} goBeat={goBeat} yt={yt} note={note} width={292} />
      <div style={{ width: 1, background: LINE }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {anyRow ? zoneHead(ui.uniHead, C_UNI) : null}
        {uniRows(sol).map((r, i) => (rowOn[r[0]] ? (
          <div key={r[0]} data-uni={r[0]} style={{ fontFamily: HEAD, fontSize: FS_MIN, color: INK, whiteSpace: 'nowrap', lineHeight: '19px', padding: '0 5px', borderRadius: 4,
            border: `1.5px solid ${sliders && view === i ? C_UNI : 'transparent'}` }}>{r[1]}</div>
        ) : null))}
      </div>
    </div>
  );
}

// ProcessRail: the four steps of the method, and — from line 14 — the arc note
const CIRCLED4 = ['\u2460', '\u2461', '\u2462', '\u2463'];
function ProcessRail({ lang, ui, bi, live }) {
  if (bi < IX.de) return null;
  const active = live ? 3 : BEATS[bi].rail, tints = [C_Z, INK, C_IT, C_UNI];
  return (
    <div data-gate="rail" style={panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 12 })}>
      {zoneHead(ui.railHead)}
      {lang.rail.map((t, i) => {
        const isAct = i === active, done = i < active, col = isAct ? tints[i] : done ? INK : UPCOMING;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 }}>{done ? '\u2713' : CIRCLED4[i]}</span>
            <span style={{ fontFamily: HEAD, fontSize: 13.5, lineHeight: '18px', color: col, fontWeight: isAct ? 600 : 400, textWrap: 'pretty' }}>{t}</span>
          </div>
        );
      })}
      {live || bi >= IX.arc ? (
        <div data-arc="1" style={{ marginTop: 'auto', borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {smallLabel(ui.arcHead)}
          <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: INK, lineHeight: 1.4, textWrap: 'pretty' }}>{ui.arc}</div>
        </div>
      ) : null}
    </div>
  );
}

// RcYourTurn (spec item 5): the series RC problem over the circuit and solve panels; Show solution reveals the key. No answer boxes.
function RcYourTurn({ shown, onToggle, onClose }) {
  const lab = { fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 84, flexShrink: 0 };
  return (
    <div data-gate="work" data-card="yourturn" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5,
      border: `2px solid ${ACCENT}`, display: 'flex', flexDirection: 'column', gap: 8 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT }}>YOUR TURN</div>
        <button type="button" onClick={onClose} style={btnStyle(false)}>{'\u2190 back to the worked example'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LoopSchematic mode="rc" label="Series RC circuit: 10 volt step, R = 2 ohms, C = 0.5 farad, capacitor pre-charged to 4 volts opposing the source" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div data-yt-problem="1" style={{ fontFamily: HEAD, fontSize: 15, color: INK, lineHeight: 1.4 }}>
            {'Series RC: R = 2 \u03a9, C = 0.5 F, a 10 V step at t = 0. The capacitor is pre-charged to V_C(0\u207b) = 4 V, opposing the source.'}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 16, color: INK }}><b>Find i(t).</b>{' Work it on paper.'}</div>
          <button type="button" onClick={onToggle} aria-expanded={shown} style={Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '8px 16px', alignSelf: 'flex-start' })}>
            {shown ? 'Hide solution' : 'Show solution'}
          </button>
        </div>
      </div>
      {shown ? (
        <div data-solution="1" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {YT.steps.map((s) => (
            <div key={s[0]} data-yt-step={s[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={lab}>{s[0]}</span><span style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: 1.4 }}>{s[1]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
            <span style={lab}>answer</span><span data-yt-answer="1" style={{ fontFamily: MONO, fontSize: 15.5, fontWeight: 600, color: C_IT }}>{'i(t) = ' + YT.it}</span>
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 13.5, color: MUTE }}>{'This i(t) is plotted in the i(t) panel on the right.'}</div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══ 8 SCENE ═════════════════════════════════════════════════════════════ */
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

// SceneBody: which beat is on screen (from the playhead, or from ◀ ▶), or circuit values set by hand (Explore)
function SceneBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1);          // beat chosen by hand; -1 while the tour drives
  const [liveM, setLiveM] = useState(null);      // circuit values set by hand; null while a beat is shown
  const [view, setView] = useState(2);           // Explore view: 0 DC, 1 AC, 2 full s
  useEffect(() => { if (playing) { setHand(-1); setLiveM(null); setView(2); } }, [playing]);
  const shown = hand >= 0 ? hand : beatAt(TL, Math.min(time, TL.REVERT));
  const b = BEATS[Math.max(0, shown)];
  const sliders = time >= TL.REVERT;             // the sliders appear only after the last clip has ended
  const explore = hand >= 0 || !!liveM || time >= TL.EXPLORE;
  const takeOver = () => { yt.close(); if (playing) setPlaying(false); };
  const goBeat = (i) => { takeOver(); setLiveM(null); setHand(i); };
  const setM = (patch) => { takeOver(); setHand(LAST); setLiveM((q) => Object.assign({}, q || M0, patch)); };
  const pickView = (i) => { takeOver(); setHand(LAST); setLiveM((q) => q || M0); setView(i); };
  const m = liveM || M0, sol = useMemo(() => solve(m), [m.R, m.L, m.VS, m.I0]);
  const live = liveM ? sol : null;

  const note = live ? ui.noteExplore : hand >= 0 ? ui.noteStep : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  const landing = shown >= 0 && !live && b.land && !yt.open ? b.land : '';
  const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;

  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />

      <ProcessRail lang={lang} ui={ui} bi={shown} live={live} />
      {yt.open ? null : <CircuitPanel ui={ui} bi={shown} sol={sol} live={live} />}
      {yt.open ? null : <SolvePanel ui={ui} bi={shown} live={live} />}
      {yt.open ? <RcYourTurn shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <ModelsPanel ui={ui} bi={shown} live={live} />
      <OutPanel ui={ui} bi={shown} sol={sol} live={live} yourTurn={yt.shown} view={view} reduced={reduced} />
      {landing && !reduced ? <Landing fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={landProg} /> : null}
      <BottomBand ui={ui} bi={shown} m={m} sol={sol} live={live} setM={setM} goBeat={goBeat} explore={explore} sliders={sliders} note={note} yt={yt} view={view} setView={pickView} />

      <CaptionLine sched={sched} text={shown >= 0 ? (live ? ui.noteExplore : b.cap) : ''} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + (live ? 'Series RL with R = ' + num(sol.R) + ' ohms, L = ' + num(sol.L) + ' henries, a ' + num(sol.VS) + ' volt step and initial current ' + num(sol.I0) + ' amps. i of t = ' + sol.it + '. '
        : (shown >= 0 ? b.cap + '. ' : '')) +
        (yt.open ? 'Your turn: series RC, R = 2 ohms, C = 0.5 farads, a 10 volt step, capacitor pre-charged to 4 volts opposing the source. Find i of t.' + (yt.shown ? ' Solution: i of t = ' + YT.say + '.' : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}
