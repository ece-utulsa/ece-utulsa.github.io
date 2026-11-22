/* ═══ SCENE — Lecture 10 · Node-Voltage Analysis in the s-Domain ══════════════
   TOC
     1  MODEL          the circuit and its solution (spec L10, sympy-checked)
     2  LANGUAGE PACK  narration text, UI strings
     3  STEPS + BEATS  one line at a time (focus rules R1–R7)
     4  CIRCUIT        current source, 1 Ω, 1 F, series 1 Ω, 1 H; initial-condition sources after the transform
     5  FOCUS + ROWS   the line being spoken; finished lines
     6  BOARD + PLOT   results panel, v_C(t) plot
     7  YOUR TURN + PAGE
   Sign convention: node voltages V_C and V_L are measured to ground (bottom rail); the source arrow points up
   into node V_C; i_L flows down through the inductor. Units: V, A, Ω, H, F, s, C. */

/* ═══ 1 MODEL ═════════════════════════════════════════════════════════════ */
// i_s(t) = 2u(−t) + δ(t) A (principal ruling).  For t < 0: i_L(0⁻) = 1 A, v_C(0⁻) = 1 V.
// [s+2, −1; −1, (s+1)/s][V_C; V_L] = [2; −1/s],  Δ = (s² + 2s + 2)/s,  V_C = (2s + 1)/(s² + 2s + 2)
// v_C(t) = e^(−t)(2 cos t − sin t) V for t > 0;  v_C(0⁻) = 1 V, v_C(0⁺) = 2 V, v_C(∞) = 0.
const vC = (t) => Math.exp(-t) * (2 * Math.cos(t) - Math.sin(t));   // V, t > 0
const vCyt = (t) => Math.exp(-t) * Math.cos(t);                     // V, Your-turn answer
const VC_BEFORE = 1;       // V: v_C(0⁻)
const T_BEFORE = -2, T_PLOT = 6;   // s: the plot runs from 2 s before the impulse to 6 s after
const SPLIT_TIME = 1.4;    // s: the two dots that show the 2 A splitting take this long
const A_VAL = [['s + 2', '−1'], ['−1', '(s+1)/s']], B_VAL = ['2', '−1/s'];
const SQ = '(s+1)² + 1';

/* ═══ 2 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
  code: 'en-GB',
  gap: LINE_HOLD,
  clips: Array.from({ length: 13 }, (_, i) => 'l10_line' + (i + 1) + '.mp3'),
  durs: [12.528, 19.416, 18.504, 20.88, 18.528, 12.144, 7.728, 23.28, 8.136, 16.512, 20.136, 10.248, 13.056],
  text: [
    'Lecture ten. This circuit already holds energy when the action starts. The capacitor and the inductor become impedances with sources, and node-voltage analysis finishes the job.',
    'The source is a current source: two amps for all time before zero, then a unit impulse at t equals zero. In parallel with it are a one ohm resistor and a one farad capacitor, at the node v-C. A second one ohm resistor leads to the node v-L, where a one henry inductor goes to ground.',
    'Step one: initial conditions. Before zero the source is two amps DC, so the capacitor is open and the inductor is a short. The two amps split evenly between the two one-ohm branches. So the inductor carries one amp, and the capacitor sits at one volt.',
    'Step two: transform, with the parallel models from Lecture three. After zero only the impulse remains, and it becomes one amp. The capacitor becomes one over s, in parallel with a one amp source pointing up. The inductor becomes s, in parallel with a source of one over s pointing down.',
    'Step three: Kirchhoff’s current law at node V-C. Current leaves through the resistor, through the capacitor, and through the series resistor toward V-L. The two one-amp sources feed the node. Collect the terms: s plus two, times V-C, minus V-L, equals two.',
    'At node V-L, current leaves through the series resistor and through the inductor. The initial-condition source takes one over s out of the node, so the right side is minus one over s.',
    'Step four: stack the two equations as a matrix. Row one is node V-C. Row two is node V-L.',
    'Solve with Cramer’s rule, from Lecture nine. Delta is s squared plus two s plus two, over s. For V-C, replace column one with the right-hand side: delta C is two s plus one, over s. Divide, and V-C is two s plus one, over s squared plus two s plus two. The inverse-matrix form in your notes is the same rule.',
    'The denominator has complex roots, so complete the square, as in Lecture four: s plus one, squared, plus one.',
    'Split the numerator to match the table, as in Lecture seven: two times s plus one, over the square, minus one over the square. So v-C is e to the minus t, times two cosine t minus sine t, volts, for t greater than zero.',
    'Now check. The initial value theorem gives v-C at zero plus as two volts. But just before zero it was one volt. The impulse delivers one coulomb straight into the one-farad capacitor — the only element that can take it — so the voltage jumps by one volt. And the final value is zero.',
    'The key point. Stored energy becomes sources, and an impulse can change a capacitor voltage instantly. The initial value theorem shows both.',
    'Your turn. Same circuit, but the source is the impulse alone, with nothing stored beforehand. On paper, find V-C of s and v-C of t. Then press Show solution.',
  ],
  card: {
    series: 'ECE 2003 · Laplace lectures · Lecture 10 of 10',
    title: 'Lecture 10 · Node-Voltage Analysis in the s-Domain',
    sentence: 'This lecture solves a circuit that already holds energy. The capacitor and the inductor become impedances with sources, then node-voltage analysis finishes the job.',
    steps: [
      'Find the initial conditions and turn them into sources.',
      'Write the two node equations and solve for the capacitor voltage in s.',
      'Invert, then explain the jump at t = 0.',
    ],
    able: 'Solve a circuit with stored energy and an impulse source by node-voltage analysis in s.',
  },
  ui: {
    kicker: 'ECE 2003 · LAPLACE LECTURES · LECTURE 10',
    title: 'Node-Voltage Analysis in the s-Domain',
    sub: 'initial conditions → sources → node equations → check',
    header: 'Lecture 10 · Node-Voltage Analysis in the s-Domain',
    headerSub: '',
    keyPoint: 'Stored energy becomes sources; an impulse can change a capacitor voltage instantly. The initial value theorem shows both.',
    railHead: 'THE METHOD',
    circHead: 'THE CIRCUIT',
    workHead: 'THE WORK — ONE LINE AT A TIME',
    bandHead: 'THE TOUR',
    bandHelp: 'Step one line back or forward with ◀ ▶.',
    linksHead: 'WHERE NEXT',
    noteStep: 'stepping by hand — press play to hear the tour again',
    notes: [
      'a circuit that already holds energy',
      'one current source, two resistors, one capacitor, one inductor',
      'the steady state before t = 0 sets the initial conditions',
      'each stored quantity becomes a current source',
      'one term for each branch at the capacitor node',
      'one term for each branch at the inductor node',
      'one row per node',
      'the rule from Lecture 9',
      'complex roots: complete the square',
      'two table pairs, one answer',
      'the theorem shows the jump at t = 0',
      'stored energy becomes sources',
      'work the problem on paper, then show the solution',
    ],
    endTitle: 'End of Lecture 10 ✓', endSub: 'try the Your-turn problem · or step back through the lines',
    srSummary: 'Lecture 10, node-voltage analysis in the s-domain. ',
  },
};

/* ═══ 3 STEPS + BEATS ═════════════════════════════════════════════════════ */
const STEPS = [
  { label: 'The circuit', tint: ACCENT }, { label: 'Initial conditions', tint: C_IC }, { label: 'Transform', tint: C_Z },
  { label: 'Node equations (KCL)', tint: INK }, { label: 'Matrix form', tint: INK }, { label: 'Cramer’s rule', tint: C_ALG },
  { label: 'Complete the square', tint: C_Z }, { label: 'Back to time', tint: C_IT }, { label: 'Check the jump', tint: ACCENT },
];
// Each beat is one thing the voice says: `line` is the narration clip (1-based), `from` the fraction of that clip at
// which the beat starts (estimated from the script), `step` the rail step, `land` the slot a value lands in, `hl` the
// circuit parts highlighted while the beat is spoken (IS, R1, C, RS, L, CS, LS, NC, NL).
const BEATS = [
  { id: 'intro', line: 1, from: 0.4, step: 0, cap: 'a circuit that already holds energy' },
  { id: 'srcA', line: 2, from: 0.05, step: 0, hl: ['IS'], cap: 'a current source: 2 A for all time before zero' },
  { id: 'srcB', line: 2, from: 0.25, step: 0, hl: ['IS'], cap: 'then a unit impulse at t = 0' },
  { id: 'elR1', line: 2, from: 0.4, step: 0, hl: ['R1'], cap: 'in parallel: a 1 Ω resistor' },
  { id: 'elC', line: 2, from: 0.5, step: 0, hl: ['C', 'NC'], cap: 'and a 1 F capacitor, at the node v_C' },
  { id: 'elRS', line: 2, from: 0.68, step: 0, hl: ['RS', 'NL'], cap: 'a second 1 Ω resistor leads to the node v_L' },
  { id: 'elL', line: 2, from: 0.85, step: 0, hl: ['L'], cap: 'a 1 H inductor goes to ground' },
  { id: 'ic', line: 3, from: 0, step: 1, cap: 'STEP 1 initial conditions' },
  { id: 'dc', line: 3, from: 0.12, step: 1, hl: ['IS'], cap: 'before zero the source is 2 A DC' },
  { id: 'dcCL', line: 3, from: 0.3, step: 1, hl: ['C', 'L'], cap: 'the capacitor is open and the inductor is a short' },
  { id: 'split', line: 3, from: 0.5, step: 1, hl: ['R1', 'RS'], cap: 'the 2 A splits evenly between the two 1 Ω branches' },
  { id: 'icL', line: 3, from: 0.72, step: 1, land: 'icL', hl: ['L'], cap: 'the inductor carries 1 A' },
  { id: 'icC', line: 3, from: 0.86, step: 1, land: 'icC', hl: ['C'], cap: 'the capacitor sits at 1 V' },
  { id: 'tr', line: 4, from: 0, step: 2, cap: 'STEP 2 transform, with the parallel models from Lecture 3' },
  { id: 'tI', line: 4, from: 0.25, step: 2, land: 'tI', hl: ['IS'], cap: 'after zero only the impulse remains: it becomes 1 A' },
  { id: 'tC', line: 4, from: 0.44, step: 2, land: 'tC', hl: ['C'], cap: 'the capacitor becomes 1/s' },
  { id: 'tCs', line: 4, from: 0.56, step: 2, land: 'tCs', hl: ['CS'], cap: 'in parallel with a 1 A source pointing up' },
  { id: 'tL', line: 4, from: 0.72, step: 2, land: 'tL', hl: ['L'], cap: 'the inductor becomes s' },
  { id: 'tLs', line: 4, from: 0.82, step: 2, land: 'tLs', hl: ['LS'], cap: 'in parallel with a source of 1/s pointing down' },
  { id: 'nC', line: 5, from: 0, step: 3, hl: ['NC'], cap: 'STEP 3 Kirchhoff’s current law at node V_C' },
  { id: 'nCa', line: 5, from: 0.24, step: 3, hl: ['R1'], cap: 'current leaves through the resistor' },
  { id: 'nCb', line: 5, from: 0.34, step: 3, hl: ['C'], cap: 'through the capacitor' },
  { id: 'nCc', line: 5, from: 0.42, step: 3, hl: ['RS'], cap: 'and through the series resistor toward V_L' },
  { id: 'nCd', line: 5, from: 0.58, step: 3, hl: ['IS', 'CS'], cap: 'the two 1 A sources feed the node' },
  { id: 'nCe', line: 5, from: 0.74, step: 3, hl: ['NC'], cap: 'collected: (s + 2)V_C − V_L = 2' },
  { id: 'nL', line: 6, from: 0, step: 3, hl: ['NL'], cap: 'at node V_L' },
  { id: 'nLa', line: 6, from: 0.14, step: 3, hl: ['RS'], cap: 'current leaves through the series resistor' },
  { id: 'nLb', line: 6, from: 0.32, step: 3, hl: ['L'], cap: 'and through the inductor' },
  { id: 'nLc', line: 6, from: 0.48, step: 3, hl: ['LS'], cap: 'the initial-condition source takes 1/s out of the node: the right side is −1/s' },
  { id: 'mat', line: 7, from: 0, step: 4, cap: 'STEP 4 stack the two equations as a matrix' },
  { id: 'row1', line: 7, from: 0.5, step: 4, hl: ['NC'], cap: 'row 1 is node V_C' },
  { id: 'row2', line: 7, from: 0.76, step: 4, hl: ['NL'], cap: 'row 2 is node V_L' },
  { id: 'sv', line: 8, from: 0, step: 5, cap: 'solve with Cramer’s rule, from Lecture 9' },
  { id: 'dA', line: 8, from: 0.13, step: 5, cap: 'Δ: main diagonal product minus the other diagonal product' },
  { id: 'dB', line: 8, from: 0.2, step: 5, land: 'D', cap: 'Δ = (s² + 2s + 2)/s' },
  { id: 'dCa', line: 8, from: 0.33, step: 5, cap: 'for V_C, replace column 1 with the right-hand side' },
  { id: 'dCb', line: 8, from: 0.48, step: 5, cap: 'Δ_C = (2s + 1)/s' },
  { id: 'VC', line: 8, from: 0.62, step: 5, land: 'VC', cap: 'V_C = (2s + 1)/(s² + 2s + 2)' },
  { id: 'inv', line: 8, from: 0.86, step: 5, cap: 'the inverse-matrix form in your notes is the same rule' },
  { id: 'sqA', line: 9, from: 0, step: 6, cap: 'the denominator has complex roots' },
  { id: 'sq', line: 9, from: 0.55, step: 6, cap: 'complete the square (Lecture 4): (s+1)² + 1' },
  { id: 'spA', line: 10, from: 0, step: 7, cap: 'split the numerator to match the table (Lecture 7)' },
  { id: 'sp1', line: 10, from: 0.3, step: 7, cap: '2(s+1) over the square' },
  { id: 'sp2', line: 10, from: 0.46, step: 7, cap: 'minus 1 over the square' },
  { id: 'vc', line: 10, from: 0.6, step: 7, land: 'vc', cap: 'v_C(t) = e⁻ᵗ(2 cos t − sin t) V, for t > 0' },
  { id: 'chk', line: 11, from: 0, step: 8, cap: 'now check' },
  { id: 'ivt', line: 11, from: 0.07, step: 8, cap: 'the initial value theorem gives v_C(0⁺) = 2 V' },
  { id: 'bef', line: 11, from: 0.27, step: 8, hl: ['C'], cap: 'but just before zero it was 1 V' },
  { id: 'jump', line: 11, from: 0.4, step: 8, hl: ['IS', 'C'], cap: 'the impulse delivers 1 C straight into the 1 F capacitor: the voltage jumps by 1 V' },
  { id: 'fin', line: 11, from: 0.9, step: 8, cap: 'and the final value is zero' },
  { id: 'key', line: 12, from: 0, step: 8, cap: 'KEY POINT stored energy becomes sources; an impulse can change a capacitor voltage instantly' },
  { id: 'yt', line: 13, from: 0, step: 8, cap: 'Your turn — on paper: find V_C(s) and v_C(t) for the impulse alone, then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.key;                                // last line of the tour proper (the Your-turn line is not one)

/* ═══ 4 CIRCUIT ═══════════════════════════════════════════════════════════ */
// point at fraction p (0–1) along a polyline given as [[x, y], …]
function along(pts, p) {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), total = seg.reduce((a, c) => a + c, 0);
  let d = clamp(p, 0, 1) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? d / seg[i] : 0; return [pts[i][0] + f * (pts[i + 1][0] - pts[i][0]), pts[i][1] + f * (pts[i + 1][1] - pts[i][1])]; } d -= seg[i]; }
  return pts[0];
}
// NodeCircuit: the current source, 1 Ω, 1 F (node V_C), series 1 Ω, 1 H (node V_L) on a ground rail.
//   src      text under the source              got      which parts have been transformed (tI, tC, tCs, tL, tLs)
//   dcNote   mark the capacitor open and the inductor a short (the t < 0 steady state)
//   split    null, or 0–1: progress of the two dots that show the 2 A splitting; 1 leaves the two "1 A" arrows
function NodeCircuit({ src, got, land, hl, h, big, dcNote, split, label }) {
  const xs = 70, x1 = 160, xc = 250, xcs = 330, xr = 393, xL = 456, xls = 536, yT = 40, yB = h - 28, cy = (yT + yB) / 2, g = got || {}, on = (k) => (hl || []).includes(k);
  const xEnd = g.tLs ? xls : xL, vc = big ? 'V_C' : 'v_C', vl = big ? 'V_L' : 'v_L';
  const dot = (pts) => { const q = along(pts, split); return <circle cx={q[0]} cy={q[1]} r="5" fill={C_IC} />; };
  return (
    <svg viewBox={`0 0 ${SCH_W} ${h}`} width={SCH_W} height={h} role="img" aria-label={label} style={{ display: 'block', flexShrink: 0 }}>
      <Wire x1={xs} y1={yT} x2={xEnd} y2={yT} /><Wire x1={xs} y1={yB} x2={xEnd} y2={yB} />
      {[xs, x1, xc, xL].concat(g.tCs ? [xcs] : [], g.tLs ? [xls] : []).map((x) => <Wire key={x} x1={x} y1={yT} x2={x} y2={yB} />)}
      <Gnd x={298} y={yB} />
      <ISrc cx={xs} cy={cy} up hl={on('IS')} />
      <ELabel x={xs} y={yB + 18} anchor="middle" was={src} now="1 A" got={g.tI} landing={land === 'tI'} slot="tI" hl={on('IS')} />
      <ZBox cx={x1} cy={cy} vert hl={on('R1')} /><text x={x1 + 16} y={cy + 5} {...svgText(FS_MIN, on('R1') ? C_HL : C_Z)}>{'1 Ω'}</text>
      {g.tC ? <ZBox cx={xc} cy={cy} vert hl={on('C')} /> : <Cap cx={xc} cy={cy} vert hl={on('C')} />}
      <ELabel x={xc + 18} y={cy + 5} anchor="start" was={dcNote ? '1 F: open' : '1 F'} now="1/s" got={g.tC} landing={land === 'tC'} slot="tC" hl={on('C')} />
      <text x={xc - 18} y={cy - 12} textAnchor="end" {...svgText(FS_MIN, MUTE)}>+</text><text x={xc - 18} y={cy + 22} textAnchor="end" {...svgText(FS_MIN, MUTE)}>{MINUS}</text>
      {g.tCs ? <g><ISrc cx={xcs} cy={cy} up hl={on('CS')} color={C_IC} /><ELabel x={xcs + 18} y={cy + 5} anchor="start" was="" now="1 A" got landing={land === 'tCs'} slot="tCs" color={C_IC} /></g> : null}
      <ZBox cx={xr} cy={yT} hl={on('RS')} /><text x={xr} y={yT - 16} textAnchor="middle" {...svgText(FS_MIN, on('RS') ? C_HL : C_Z)}>{'1 Ω'}</text>
      {g.tL ? <ZBox cx={xL} cy={cy} vert hl={on('L')} /> : <Ind cx={xL} cy={cy} vert hl={on('L')} />}
      <ELabel x={xL + 16} y={cy + 5} anchor="start" was={dcNote ? '1 H: short' : '1 H'} now="s" got={g.tL} landing={land === 'tL'} slot="tL" hl={on('L')} />
      {g.tLs ? <g><ISrc cx={xls} cy={cy} up={false} hl={on('LS')} color={C_IC} /><ELabel x={xls + 18} y={cy + 5} anchor="start" was="" now="1/s" got landing={land === 'tLs'} slot="tLs" color={C_IC} /></g> : null}
      {[[xc, vc, 'NC'], [xL, vl, 'NL']].map((n) => (
        <g key={n[2]}><circle cx={n[0]} cy={yT} r={on(n[2]) ? 5.5 : 3.5} fill={on(n[2]) ? C_HL : C_Z} />
          <text x={n[0] + (n[2] === 'NC' ? -8 : 10)} y={yT - 10} textAnchor={n[2] === 'NC' ? 'end' : 'start'} {...svgText(FS_MIN, on(n[2]) ? C_HL : INK)}>{n[1]}</text></g>
      ))}
      {split != null ? (
        <g data-split="1">
          {split >= 1 ? <g><text x={x1 - 16} y={cy + 5} textAnchor="end" {...svgText(FS_MIN, C_IC)}>{'1 A ↓'}</text><text x={xL - 14} y={cy - 16} textAnchor="end" {...svgText(FS_MIN, C_IC)}>{'1 A ↓'}</text></g>
            : <g>{dot([[xs, yT], [x1, yT], [x1, yB]])}{dot([[xs, yT], [xL, yT], [xL, yB]])}</g>}
        </g>
      ) : null}
    </svg>
  );
}
// the lecture's circuit at beat bi: the DC state for step 1, then each part replaced as it is spoken
function Circuit({ bi, b, land, since, reduced }) {
  const got = { tI: bi >= IX.tI, tC: bi >= IX.tC, tCs: bi >= IX.tCs, tL: bi >= IX.tL, tLs: bi >= IX.tLs };
  const inDC = bi >= IX.dc && bi < IX.tr;
  const split = bi < IX.split || bi >= IX.tr ? null : bi > IX.split || reduced || since == null ? 1 : clamp(since / SPLIT_TIME, 0, 1);
  return <NodeCircuit src={inDC ? '2 A (t < 0)' : '2u(−t) + δ(t) A'} got={got} land={land} hl={b.hl} h={SCH_H - 18} big={bi >= IX.tr} dcNote={bi >= IX.dcCL && bi < IX.tr} split={split}
    label="Current source in parallel with a 1 ohm resistor and a 1 farad capacitor at node V C; a series 1 ohm resistor to node V L; a 1 henry inductor to ground" />;
}

/* ═══ 5 FOCUS + ROWS ══════════════════════════════════════════════════════ */
// the one line the voice is speaking at beat b (st.since = seconds into the beat, null when stepping by hand)
function focusOf(b, st) {
  const prose = (t, color) => <span style={{ fontFamily: HEAD, color: color || INK }}>{t}</span>;
  const nw = (t) => <span style={{ color: C_HL, fontWeight: 600 }}>{t}</span>;
  const prog = st.reduced || st.since == null ? 1 : st.since / COL_SLIDE;
  const fr = (num) => <LFrac num={num} den={SQ} size={FOCUS_FS} />;
  switch (b.id) {
    case 'intro': return prose('a circuit that already holds energy');
    case 'srcA': return <span>{'i_s(t) = '}{nw('2u(−t)')}{' + δ(t) A'}</span>;
    case 'srcB': return <span>{'i_s(t) = 2u(−t) + '}{nw('δ(t)')}{' A'}</span>;
    case 'elR1': return <span>{'in parallel: '}{nw('1 Ω')}</span>;
    case 'elC': return <span>{nw('1 F')}{' at node '}{nw('v_C')}</span>;
    case 'elRS': return <span>{'series '}{nw('1 Ω')}{' to node '}{nw('v_L')}</span>;
    case 'elL': return <span>{nw('1 H')}{' to ground'}</span>;
    case 'ic': return prose('STEP 1: initial conditions', C_IC);
    case 'dc': return <span>{'t < 0: i_s = 2 A (DC)'}</span>;
    case 'dcCL': return prose('capacitor open · inductor a short');
    case 'split': return <span>{'2 A splits evenly: 1 A + 1 A'}</span>;
    case 'icL': return <span>{'i_L(0⁻) ='}<LVal k="icL">{'1 A'}</LVal></span>;
    case 'icC': return <span>{'v_C(0⁻) = (1 A)(1 Ω) ='}<LVal k="icC">{'1 V'}</LVal></span>;
    case 'tr': return prose('STEP 2: transform (parallel models)', C_Z);
    case 'tI': return <span>{'t > 0: δ(t) →'}<LVal k="tI">{'1 A'}</LVal></span>;
    case 'tC': return <span>{'1 F → 1/(sC) ='}<LVal k="tC">{'1/s'}</LVal></span>;
    case 'tCs': return <span>{'source C·v_C(0⁻), up ='}<LVal k="tCs">{'1 A'}</LVal></span>;
    case 'tL': return <span>{'1 H → sL ='}<LVal k="tL">{'s'}</LVal></span>;
    case 'tLs': return <span>{'source i_L(0⁻)/s, down ='}<LVal k="tLs">{'1/s'}</LVal></span>;
    case 'nC': return prose('STEP 3: KCL at node V_C');
    case 'nCa': return <span>{nw('V_C(1)')}</span>;
    case 'nCb': return <span>{'V_C(1 '}{nw('+ s')}{')'}</span>;
    case 'nCc': return <span>{'V_C(1 + s '}{nw('+ 1')}{') '}{nw('− V_L(1)')}</span>;
    case 'nCd': return <span>{'V_C(1 + s + 1) − V_L(1) = '}{nw('1 + 1')}</span>;
    case 'nCe': return <span>{'(s + 2)V_C − V_L = 2'}</span>;
    case 'nL': return prose('KCL at node V_L');
    case 'nLa': return <span>{nw('V_L(1) − V_C(1)')}</span>;
    case 'nLb': return <span>{'V_L(1 '}{nw('+ 1/s')}{') − V_C(1)'}</span>;
    case 'nLc': return <span>{'V_L(1 + 1/s) − V_C(1) '}{nw('= −1/s')}</span>;
    case 'mat': return prose('STEP 4: stack the equations as a matrix');
    case 'row1': return <Mat2 a={A_VAL} x={['V_C', 'V_L']} b={B_VAL} shown={1} size={FOCUS_FS} />;
    case 'row2': return <Mat2 a={A_VAL} x={['V_C', 'V_L']} b={B_VAL} shown={2} size={FOCUS_FS} />;
    case 'sv': return prose('Cramer’s rule, from Lecture 9', C_ALG);
    case 'dA': return <span>{'Δ = (s+2)(s+1)/s − (−1)(−1)'}</span>;
    case 'dB': return <span>{'Δ ='}<LVal k="D"><Frac num="s² + 2s + 2" den="s" size={VALUE_FS} color={AMBER} /></LVal></span>;
    case 'dCa': return <Det2 a={A_VAL} b={B_VAL} swap={0} prog={prog} size={FOCUS_FS} name="Δ_C" />;
    case 'dCb': return <span>{'Δ_C = 2(s+1)/s − 1/s = (2s + 1)/s'}</span>;
    case 'VC': return <span>{'V_C = Δ_C/Δ ='}<LVal k="VC"><Frac num="2s + 1" den="s² + 2s + 2" size={VALUE_FS} color={AMBER} /></LVal></span>;
    case 'inv': return <span>{'[V] = A⁻¹b = adj(A)·b/Δ'}</span>;
    case 'sqA': return <span>{'s² + 2s + 2: complex roots'}</span>;
    case 'sq': return <span>{'s² + 2s + 2 = '}{nw(SQ)}</span>;
    case 'spA': return prose('split the numerator to match the table', C_IT);
    case 'sp1': return <span>{'V_C = '}{fr('2(s+1)')}{' − …'}</span>;
    case 'sp2': return <span>{'V_C = '}{fr('2(s+1)')}{' − '}{fr('1')}</span>;
    case 'vc': return <span>{'v_C(t) ='}<LVal k="vc">{'e⁻ᵗ(2 cos t − sin t) V'}</LVal></span>;
    case 'chk': return prose('check: the initial value theorem');
    case 'ivt': return <span>{'v_C(0⁺) = lim(s→∞) sV_C = 2 V'}</span>;
    case 'bef': return <span>{'but v_C(0⁻) = 1 V'}</span>;
    case 'jump': return <span>{'jump = Q/C = (1 C)/(1 F) = 1 V'}</span>;
    case 'fin': return <span>{'v_C(∞) = 0'}</span>;
    default: return prose('stored energy becomes sources');
  }
}

// finished lines for beat index i: compact rows (R1), at most three
function doneRows(i) {
  const rows = [], add = (key, text, color) => rows.push({ key, node: <span>{text}</span>, color });
  if (i < IX.nC) {
    if (i > IX.icC) add('ic', 'at 0⁻: i_L = 1 A, v_C = 1 V', C_IC);
    if (i > IX.tLs) add('s', 's-domain: 1 A source; 1/s with 1 A up; s with 1/s down', C_Z);
  } else if (i < IX.sv) {
    if (i > IX.nCe) add('n1', 'node V_C: (s + 2)V_C − V_L = 2');
    if (i > IX.nLc) add('n2', 'node V_L: −V_C + ((s+1)/s)V_L = −1/s');
  } else if (i < IX.sqA) {
    if (i > IX.dB) add('d', 'Δ = (s² + 2s + 2)/s', C_ALG);
    if (i > IX.dCb) add('dc', 'Δ_C = (2s + 1)/s', C_ALG);
    if (i > IX.VC) add('vc', 'V_C = (2s + 1)/(s² + 2s + 2)', C_ALG);
  } else if (i < IX.chk) {
    add('vc', 'V_C = (2s + 1)/(s² + 2s + 2)');
    if (i > IX.sq) add('sq', 's² + 2s + 2 = (s+1)² + 1', C_Z);
    if (i > IX.sp2) add('sp', 'V_C = 2(s+1)/((s+1)² + 1) − 1/((s+1)² + 1)', C_Z);
  } else {
    add('vt', 'v_C(t) = e⁻ᵗ(2 cos t − sin t) V, t > 0', C_IT);
    if (i > IX.ivt) add('ivt', 'v_C(0⁺) = 2 V (initial value theorem)');
    if (i > IX.jump) add('j', 'the impulse puts 1 C on 1 F: a 1 V jump');
  }
  return rows;
}

/* ═══ 6 BOARD + PLOT ══════════════════════════════════════════════════════ */
// Board: the results so far; every value reads "?" until the voice has said it (R4)
function Board({ bi, land, reduced }) {
  if (bi < IX.icL) return null;
  const at = (id) => bi >= IX[id], slot = (k, id, node, pad) => <BSlot k={k} got={at(id)} landing={land === k} reduced={reduced} pad={pad}>{node}</BSlot>;
  return (
    <div data-gate="board" style={panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: BOARD_H, display: 'flex', flexDirection: 'column', gap: 5 })}>
      {zoneHead('RESULTS', C_Z)}
      <BRow label="at 0⁻"><span>{'i_L ='}</span>{slot('icL', 'icL', '1 A')}<span style={{ marginLeft: 8 }}>{'v_C ='}</span>{slot('icC', 'icC', '1 V')}</BRow>
      {at('row1') ? <BRow label="system"><Mat2 a={A_VAL} x={['V_C', 'V_L']} b={B_VAL} shown={at('row2') ? 2 : 1} size={FS_MIN} /></BRow> : null}
      {at('sv') ? <BRow label="Δ">{slot('D', 'dB', '(s² + 2s + 2)/s')}<span style={{ marginLeft: 8, color: MUTE }}>{'V_C(s)'}</span>{slot('VC', 'VC', <Frac num="2s + 1" den="s² + 2s + 2" size={FS_MIN} color={INK} />, '2px 7px')}</BRow> : null}
      {at('spA') ? <BRow label="v_C(t)">{slot('vc', 'vc', 'e⁻ᵗ(2 cos t − sin t) V')}{at('vc') ? <span style={{ color: MUTE }}>{'t > 0'}</span> : null}</BRow> : null}
      <div data-checks="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, display: 'flex', gap: 14 }}>
        {at('ivt') ? <span>{'v_C(0⁺) = 2 V'}</span> : null}
        {at('jump') ? <span style={{ color: C_IC, fontWeight: 600 }}>{'jump: 1 V'}</span> : null}
        {at('fin') ? <span>{'v_C(∞) = 0'}</span> : null}
      </div>
    </div>
  );
}

// PlotPanel: v_C(t) once it has been spoken; the value before zero and the jump when the check names them
function PlotPanel({ bi, ytShown }) {
  if (!ytShown && bi < IX.vc) return null;
  const top = PANEL_TOP + BOARD_H + 8, h = PANEL_H - BOARD_H - 8, w = SIDE_W - 26, ph = h - 18 - 20 - 4;
  const before = bi >= IX.bef;
  return (
    <div data-gate="plot" data-plot-source={ytShown ? 'yourturn' : 'example'} style={panel({ left: SIDE_X, top, width: SIDE_W, height: h, display: 'flex', flexDirection: 'column', gap: 4 })}>
      {zoneHead(ytShown ? 'YOUR TURN — v_C(t)' : 'THE CAPACITOR VOLTAGE', ytShown ? ACCENT : C_IT)}
      {ytShown
        ? <LPlot curves={[{ f: vCyt, t0: 0, t1: T_PLOT, label: 'v_C' }]} tmin={T_BEFORE} tmax={T_PLOT} ymin={-0.5} ymax={1.5} tstep={1} width={w} height={ph} unitY="v, V"
          marks={[{ id: 'yt0', t: 0, y: 1, label: '1 V' }]} />
        : <LPlot curves={[{ f: vC, t0: 0, t1: T_PLOT, label: 'v_C' }].concat(before ? [{ f: () => VC_BEFORE, t0: T_BEFORE, t1: 0 }] : [])}
          tmin={T_BEFORE} tmax={T_PLOT} ymin={-0.5} ymax={2.5} tstep={1} width={w} height={ph} unitY="v, V"
          marks={(bi >= IX.ivt ? [{ id: 'after', t: 0, y: 2, label: '2 V (0⁺)' }] : []).concat(before ? [{ id: 'before', t: 0, y: VC_BEFORE, hollow: true, label: '1 V (0⁻)', left: true }] : [])} />}
    </div>
  );
}

/* ═══ 7 YOUR TURN + PAGE ══════════════════════════════════════════════════ */
// Same circuit with i_s = δ(t) A only and zero initial conditions (the literal problem in the deck):
// (s + 2)V_C − V_L = 1,  −V_C + ((s+1)/s)V_L = 0,  V_C = (s + 1)/(s² + 2s + 2),  v_C = e^(−t) cos t u(t) V.
const PAGE = {
  Circuit, Board, PlotPanel,
  circuitTag: (bi) => (bi > IX.tLs ? 'S-DOMAIN' : bi >= IX.tr ? 'TRANSFORMING' : bi >= IX.dc ? 'BEFORE t = 0' : 'TIME DOMAIN'),
  links: [
    { dir: 'back:', href: 'Laplace_L9_Mesh_Analysis_s-Domain_v1.0.0.html', label: 'Lecture 9 · Mesh Analysis in the s-Domain' },
  ],
  yourTurn: {
    circuit: <NodeCircuit src="δ(t) A" h={132} label="The same circuit with an impulse source only: 1 ohm, 1 farad at node v C, series 1 ohm, 1 henry to ground" />,
    problem: 'Same circuit, but the source is i_s(t) = δ(t) A only, with zero initial conditions: nothing is stored before t = 0.',
    ask: 'Find V_C(s) and v_C(t).',
    steps: [
      ['node V_C', '(s + 2)V_C − V_L = 1'],
      ['node V_L', '−V_C + ((s+1)/s)V_L = 0'],
      ['V_C(s)', '(s + 1)/(s² + 2s + 2) = (s+1)/((s+1)² + 1)'],
      ['check', 'v_C(0⁺) = 1 V ✓ (1 C delivered to 1 F)'],
    ],
    answer: 'v_C(t) = e⁻ᵗ cos t u(t) V',
    sr: 'Your turn: the same circuit, but the source is a unit impulse only, with zero initial conditions. Find V C of s and v C of t.',
    srAnswer: 'v C of t equals e to the minus t times cosine t, in volts.',
  },
};
