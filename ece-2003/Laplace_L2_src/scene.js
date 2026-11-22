/* ═══ SCENE — Laplace Lecture 2 · The Table and Its Properties ═══════════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  MATH TEXT             superscripts, subscripts, stacked fractions, landing values
     3  TABLE DATA            Alexander & Sadiku Tables 15.2 (pairs) and 15.1 (properties), retyped
     4  LANGUAGE PACK         narration text, card, UI strings
     5  BEATS                 one line at a time (focus rules R1–R7)
     6  PANELS                TableView, Wave, Work, PairsPanel, LandPath, ResultsPanel, LectureRail, BottomBand, cards
     7  SCENE
   Model: every pair is the one-sided transform F(s) = ∫ from 0⁻ to ∞ of f(t)e^(−st) dt and holds for t ≥ 0.
   The switched-source plot is schematic: ideal steps, f(t) dimensionless, t in seconds. */
const h = React.createElement;
/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5; // s: pause after each clip before the next line replaces it (focus rule R6)
const TABLE_W = STAGE_W - RAIL_X - WORK_X; // px: the full-table card spans the work zone and the side column
const PAIRS_H = 262; // px: height of the seven-pairs panel in the side column
const PANEL_GAP = 10; // px: gap between panels
const LAND_UNDER = 12; // px: the landing path runs this far below the slots before it turns up into one
const SCRIPT_SCALE = 0.7; // superscript / subscript size relative to its line (never below FS_MIN)
const ROW_FS = 14, ROW_H = 20; // px: table row text and row height
const WAVE_W = 590, WAVE_H = 124; // px: switched-source plot
const WAVE_T0 = -0.4, WAVE_T1 = 3.4, WAVE_Y0 = -3, WAVE_Y1 = 4; // plot window: t in s, f(t) dimensionless
const YT_TMAX = 2; // s: time window of the Your-turn plot
const C_TIME = GREEN; // f(t), the time side of a pair
const C_S = TEAL; // F(s), the s side of a pair
const C_VAL = AMBER; // a value while it lands, and the step being transformed
const C_BAR = ACCENT; // focus bar and the row or property in use
const MINUS = '−';
/* ═══ 2 MATH TEXT ═════════════════════════════════════════════════════════ */
const SCRIPT_RE = /([\^_])\{([^}]*)\}/g;
// math text: "^{…}" becomes a superscript and "_{…}" a subscript; scripts never go below FS_MIN px
function mt(t, size) {
    const out = [], fs = Math.max(FS_MIN, Math.round(size * SCRIPT_SCALE));
    let last = 0, m;
    SCRIPT_RE.lastIndex = 0;
    while ((m = SCRIPT_RE.exec(t)) !== null) {
        if (m.index > last)
            out.push(t.slice(last, m.index));
        out.push(h(m[1] === '^' ? 'sup' : 'sub', { key: m.index, style: { fontSize: fs, lineHeight: 0 } }, m[2]));
        last = SCRIPT_RE.lastIndex;
    }
    if (last < t.length)
        out.push(t.slice(last));
    return out;
}
// the same math text as one plain string for the screen-reader summary
const plain = (t) => t.replace(SCRIPT_RE, (all, k, x) => (k === '^' ? '^(' + x + ')' : x));
// stacked fraction; n and d are math text or ready nodes
function Fr({ n, d, size, color }) {
    const part = (x) => h('span', { style: { fontFamily: MONO, fontSize: size, fontWeight: 600, color, lineHeight: 1.25, whiteSpace: 'nowrap', padding: '0 4px' } }, typeof x === 'string' ? mt(x, size) : x);
    return h('span', { style: { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 6px' } }, part(n), h('span', { style: { alignSelf: 'stretch', height: 2, background: color } }), part(d));
}
// the s side of a pair: a stacked fraction for [numerator, denominator], plain math text otherwise
const sSide = (F, size, color) => (Array.isArray(F) ? h(Fr, { n: F[0], d: F[1], size, color })
    : h('span', { style: { color, fontWeight: 600 } }, mt(F, size)));
// coloured math text
const col = (t, color, size, weight) => h('span', { style: { color, fontWeight: weight || 400 } }, mt(t, size));
// prose inside the focus line
const prose = (t) => h('span', { style: { fontFamily: HEAD } }, t);
// a value forming in the focus line at VALUE_FS in amber; its landing path starts here (focus rule R5)
function Val({ k, pre, children }) {
    return h('span', { 'data-landing-from': k, style: { display: 'inline-flex', alignItems: 'center', fontFamily: MONO, fontSize: VALUE_FS, fontWeight: 600, color: C_VAL, marginLeft: 12, whiteSpace: 'nowrap', verticalAlign: 'middle' } }, pre || null, children);
}
/* ═══ 3 TABLE DATA ════════════════════════════════════════════════════════ */
// Table 15.2 in textbook order. `F` is the stacked form [numerator, denominator] (or plain text), `inl` the one-line form.
// `use` marks the seven pairs circuits use; the others are reference rows.
const PAIRS = [
    { id: 'delta', f: 'δ(t)', F: '1', inl: '1', use: true },
    { id: 'u', f: 'u(t)', F: ['1', 's'], inl: '1/s', use: true },
    { id: 'exp', f: 'e^{−at}', F: ['1', 's + a'], inl: '1/(s + a)', use: true },
    { id: 't', f: 't', F: ['1', 's²'], inl: '1/s²', use: true },
    { id: 'tn', f: 't^{n}', F: ['n!', 's^{n+1}'], inl: 'n!/s^{n+1}' },
    { id: 'texp', f: 'te^{−at}', F: ['1', '(s + a)²'], inl: '1/(s + a)²', use: true },
    { id: 'tnexp', f: 't^{n}e^{−at}', F: ['n!', '(s + a)^{n+1}'], inl: 'n!/(s + a)^{n+1}' },
    { id: 'sin', f: 'sin ωt', F: ['ω', 's² + ω²'], inl: 'ω/(s² + ω²)' },
    { id: 'cos', f: 'cos ωt', F: ['s', 's² + ω²'], inl: 's/(s² + ω²)' },
    { id: 'sinth', f: 'sin(ωt + θ)', F: ['s sin θ + ω cos θ', 's² + ω²'], inl: '(s sin θ + ω cos θ)/(s² + ω²)' },
    { id: 'costh', f: 'cos(ωt + θ)', F: ['s cos θ − ω sin θ', 's² + ω²'], inl: '(s cos θ − ω sin θ)/(s² + ω²)' },
    { id: 'esin', f: 'e^{−at} sin ωt', F: ['ω', '(s + a)² + ω²'], inl: 'ω/((s + a)² + ω²)', use: true },
    { id: 'ecos', f: 'e^{−at} cos ωt', F: ['s + a', '(s + a)² + ω²'], inl: '(s + a)/((s + a)² + ω²)', use: true },
];
const PAIR = Object.fromEntries(PAIRS.map((p) => [p.id, p]));
// Table 15.1. `use` marks the three properties of this lecture; `tag` labels the others.
const PROPS = [
    { id: 'lin', name: 'Linearity', eq: 'a_{1}f_{1}(t) + a_{2}f_{2}(t) ↔ a_{1}F_{1}(s) + a_{2}F_{2}(s)', use: true },
    { id: 'scale', name: 'Scaling', eq: 'f(at) ↔ (1/a)F(s/a)', tag: 'reference' },
    { id: 'tshift', name: 'Time shift', eq: 'f(t − a)u(t − a) ↔ e^{−as}F(s)', use: true },
    { id: 'fshift', name: 'Frequency shift', eq: 'e^{−at}f(t) ↔ F(s + a)', use: true },
    { id: 'tdiff', name: 'Time differentiation', eq: 'df/dt ↔ sF(s) − f(0^{−})', tag: 'Lecture 3' },
    { id: 'tint', name: 'Time integration', eq: '∫_{0}^{t} f(x) dx ↔ F(s)/s', tag: 'reference' },
    { id: 'fdiff', name: 'Frequency differentiation', eq: 'tf(t) ↔ −dF(s)/ds', tag: 'reference' },
    { id: 'fint', name: 'Frequency integration', eq: 'f(t)/t ↔ ∫_{s}^{∞} F(s) ds', tag: 'reference' },
    { id: 'period', name: 'Time periodicity', eq: 'f(t) = f(t + nT) ↔ F_{1}(s)/(1 − e^{−sT})', tag: 'reference' },
    { id: 'ivt', name: 'Initial value', eq: 'f(0^{+}) = lim_{s→∞} sF(s)', tag: 'Lecture 3' },
    { id: 'fvt', name: 'Final value', eq: 'f(∞) = lim_{s→0} sF(s)', tag: 'Lecture 3' },
    { id: 'conv', name: 'Convolution', eq: 'f_{1}(t) * f_{2}(t) ↔ F_{1}(s)F_{2}(s)', tag: 'reference' },
];
const PROP = Object.fromEntries(PROPS.map((p) => [p.id, p]));
const THREE = ['lin', 'fshift', 'tshift']; // the three properties, in teaching order
// Your turn (spec key, C1-verified): L{10e^(−3t) cos 4t} = 10(s+3)/((s+3)²+16) = 10(s+3)/(s²+6s+25)
const YT = {
    ask: '10e^{−3t} cos 4t',
    steps: [
        ['pair', 'e^{−at} cos ωt ↔ (s + a)/((s + a)² + ω²)'],
        ['read off', 'a = 3, ω = 4, so ω² = 16'],
        ['linearity', 'the constant 10 multiplies the transform'],
    ],
    answer: ['F(s) = 10(s + 3)/((s + 3)² + 16)', '= 10(s + 3)/(s² + 6s + 25)'],
    f: (t) => 10 * Math.exp(-3 * t) * Math.cos(4 * t), // f(t), dimensionless; t in s
    env: (t) => 10 * Math.exp(-3 * t), // its envelope
};
/* ═══ 4 LANGUAGE PACK ═════════════════════════════════════════════════════ */
// `durs` are fallbacks (s); the schedule re-measures every embedded clip at load.
const LANG = {
    code: 'en-GB',
    gap: LINE_HOLD,
    clips: Array.from({ length: 11 }, (_, i) => 'laplace_l2_line' + (i + 1) + '.mp3'),
    durs: [/*@DURS@*/],
    text: [/*@TEXT@*/],
    rail: ['the table', 'seven pairs', 'three properties', 'linearity', 'frequency shift', 'time shift', 'a switched source', 'step by step', 'key point'],
    card: {
        series: 'ECE 2003 · Laplace Transform · Lecture 2',
        title: 'Lecture 2 · The Table and Its Properties',
        sentence: 'This lecture turns the table into a tool: the seven pairs circuits use, and three properties that stretch them.',
        steps: [
            'Read the table and pick out the seven pairs circuits use.',
            'Stretch them with linearity and the frequency shift.',
            'Time-shift a switched source, one step at a time.',
        ],
        able: 'Transform a source straight from the table. Then try one yourself.',
    },
    ui: {
        kicker: 'LAPLACE · LECTURE 2',
        title: 'The Table and Its Properties',
        sub: 'seven pairs · three properties',
        header: 'Lecture 2 · The Table and Its Properties',
        headerSub: '· ECE 2003',
        keyPoint: 'Seven pairs plus linearity, frequency shift and time shift cover every source in this course.',
        railHead: 'THE LECTURE',
        workHead: 'THE WORK',
        tableHead: 'THE TABLE',
        pairsHead: 'TRANSFORM PAIRS · Table 15.2',
        propsHead: 'PROPERTIES · Table 15.1',
        sevenHead: 'THE SEVEN PAIRS',
        resultsHead: 'TRANSFORMS',
        nextHead: 'WHERE NEXT',
        threeHead: 'THE THREE PROPERTIES',
        footnote: 'Every pair holds for t ≥ 0.',
        refTag: 'reference',
        waveCaption: 'f(t) against t in seconds · ideal steps, schematic',
        ytPlotHead: 'f(t) = 10e^{−3t} cos 4t',
        ytPlotNote: 'the time function you transformed, with its envelope ±10e^{−3t}',
        links: [
            { text: '← Lecture 1 · What the Laplace Transform Does', href: 'Laplace_L1_What_the_Transform_Does_v1.0.0.html' },
            { text: 'Lecture 3 · From Derivatives to Circuit Models →', href: 'Laplace_L3_Circuit_Element_Models_v1.0.0.html' },
            { text: 'Lecture 4 · Factoring the Denominator →', href: 'Factoring_the_Denominator_v1.1.0.html' },
        ],
        notes: [
            'the table is the tool for the rest of the course',
            'time functions on the left, transforms on the right',
            'seven pairs carry almost every circuit problem',
            'three properties make seven pairs go a long way',
            'a sum transforms one term at a time',
            'a decaying exponential in time is a shift in s',
            'a delay in time is an exponential in s',
            'a source that switches twice',
            'one step, one term',
            'pairs plus properties: that is the whole toolkit',
            'work it on paper, then show the solution',
        ],
        noteStep: 'step through the lecture with ◀ ▶, or press play',
        endTitle: 'Lecture 2 ✓', endSub: 'try the Your-turn problem · then go on to Lecture 3',
        srSummary: 'Lecture 2, the table and its properties. ',
    },
};
/* ═══ 5 BEATS — one line at a time (focus rules R1–R7) ═════════════════════ */
// Each beat is one thing the voice says. `line` is the narration line (1-based); the beat starts at the word
// position listed in BEAT_FROM (fraction of the measured clip, taken from the word timings of the render).
//   sec    section: 'table' (full-table view) | 'lin' | 'fs' | 'ts' | 'key'
//   pair   table pair this beat names or uses;  prop: property it names
//   land   result slot that lands on this beat;  segs / steps / hi: switched-source plot state
const BEAT_FROM = {/*@FROM@*/};
const BEATS = [
    { id: 'intro', line: 1, sec: 'table', cap: 'The table becomes a tool.' },
    { id: 'table', line: 2, sec: 'table', cap: 'The table: f(t) on the left, F(s) on the right.' },
    { id: 'tge0', line: 2, sec: 'table', cap: 'Every pair holds for t ≥ 0.' },
    { id: 'seven', line: 3, sec: 'table', cap: 'Circuits use 7 of these pairs.' },
    { id: 'p_delta', line: 3, sec: 'table', pair: 'delta', cap: 'the impulse: δ(t) ↔ 1' },
    { id: 'p_u', line: 3, sec: 'table', pair: 'u', cap: 'the step: u(t) ↔ 1/s' },
    { id: 'p_t', line: 3, sec: 'table', pair: 't', cap: 'the ramp: t ↔ 1/s²' },
    { id: 'p_exp', line: 3, sec: 'table', pair: 'exp', cap: 'the exponential: e^{−at} ↔ 1/(s + a)' },
    { id: 'p_texp', line: 3, sec: 'table', pair: 'texp', cap: 't times the exponential: te^{−at} ↔ 1/(s + a)²' },
    { id: 'p_esin', line: 3, sec: 'table', pair: 'esin', cap: 'the damped sine: e^{−at} sin ωt ↔ ω/((s + a)² + ω²)' },
    { id: 'p_ecos', line: 3, sec: 'table', pair: 'ecos', cap: 'the damped cosine: e^{−at} cos ωt ↔ (s + a)/((s + a)² + ω²)' },
    { id: 'props', line: 4, sec: 'table', cap: '3 properties stretch the pairs.' },
    { id: 'pr_lin', line: 4, sec: 'table', prop: 'lin', cap: 'linearity' },
    { id: 'pr_fs', line: 4, sec: 'table', prop: 'fshift', cap: 'frequency shift' },
    { id: 'pr_ts', line: 4, sec: 'table', prop: 'tshift', cap: 'time shift' },
    { id: 'ref', line: 4, sec: 'table', cap: 'The rest of the table is for reference.' },
    { id: 'lin0', line: 5, sec: 'lin', cap: 'Linearity: a sum transforms one term at a time.' },
    { id: 'lin1', line: 5, sec: 'lin', cap: 'Take f(t) = (2t + 4)u(t).' },
    { id: 'lin2', line: 5, sec: 'lin', pair: 't', land: 'L1', cap: 'the ramp: 2t ↔ 2/s²' },
    { id: 'lin3', line: 5, sec: 'lin', pair: 'u', land: 'L2', cap: 'the step: 4u(t) ↔ 4/s' },
    { id: 'lin4', line: 5, sec: 'lin', land: 'L3', cap: 'together: F(s) = 2/s² + 4/s = (4s + 2)/s²' },
    { id: 'fs0', line: 6, sec: 'fs', cap: 'Frequency shift: e^{−at}f(t) ↔ F(s + a)' },
    { id: 'fs1', line: 6, sec: 'fs', pair: 'sin', cap: 'Start with sin 4t.' },
    { id: 'fs1v', line: 6, sec: 'fs', pair: 'sin', land: 'F1', cap: 'sin 4t ↔ 4/(s² + 16)' },
    { id: 'fs2', line: 6, sec: 'fs', cap: 'Multiply by e^{−2t}: replace s with s + 2.' },
    { id: 'fs3', line: 6, sec: 'fs', pair: 'esin', land: 'F2', cap: 'e^{−2t} sin 4t ↔ 4/((s + 2)² + 16)' },
    { id: 'ts0', line: 7, sec: 'ts', cap: 'Time shift: f(t − a)u(t − a) ↔ e^{−as}F(s)' },
    { id: 'wave', line: 8, sec: 'ts', segs: 0, steps: 0, cap: 'A switched source, f(t).' },
    { id: 'w1', line: 8, sec: 'ts', segs: 1, steps: 0, cap: 'f(t) = 3 for the first second' },
    { id: 'w2', line: 8, sec: 'ts', segs: 2, steps: 0, cap: 'f(t) = −2 for the next second' },
    { id: 'w3', line: 8, sec: 'ts', segs: 3, steps: 0, cap: 'f(t) = 0 after that' },
    { id: 'st0', line: 9, sec: 'ts', segs: 3, steps: 0, cap: 'Write f(t) as steps.' },
    { id: 'st1', line: 9, sec: 'ts', segs: 3, steps: 1, hi: 0, cap: '3u(t): up 3 at t = 0' },
    { id: 'st2', line: 9, sec: 'ts', segs: 3, steps: 2, hi: 1, cap: '− 5u(t − 1): down 5 at t = 1 s' },
    { id: 'st3', line: 9, sec: 'ts', segs: 3, steps: 3, hi: 2, cap: '+ 2u(t − 2): up 2 at t = 2 s' },
    { id: 'tr0', line: 9, sec: 'ts', segs: 3, steps: 3, cap: 'Transform term by term.' },
    { id: 'tr1', line: 9, sec: 'ts', segs: 3, steps: 3, hi: 0, pair: 'u', land: 'T1', cap: '3u(t) ↔ 3/s' },
    { id: 'tr2', line: 9, sec: 'ts', segs: 3, steps: 3, hi: 1, pair: 'u', land: 'T2', cap: '− 5u(t − 1) ↔ − 5e^{−s}/s' },
    { id: 'tr3', line: 9, sec: 'ts', segs: 3, steps: 3, hi: 2, pair: 'u', land: 'T3', cap: '+ 2u(t − 2) ↔ + 2e^{−2s}/s' },
    { id: 'key', line: 10, sec: 'key', segs: 3, steps: 3, cap: '7 pairs + linearity + frequency shift + time shift cover every source in this course.' },
    { id: 'yt', line: 11, sec: 'key', segs: 3, steps: 3, cap: 'Your turn, on paper: find ℒ{10e^{−3t} cos 4t}. Then press Show solution.' },
];
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const LAST = IX.key; // last lecture line (the Your-turn line is not one)
// beat at which each table row appears: a pair or property when it is named, every reference row on 'ref'
const PAIR_AT = { delta: IX.p_delta, u: IX.p_u, t: IX.p_t, exp: IX.p_exp, texp: IX.p_texp, esin: IX.p_esin, ecos: IX.p_ecos };
const PROP_AT = { lin: IX.pr_lin, fshift: IX.pr_fs, tshift: IX.pr_ts };
// result slots of each section: key, label (time side), value (s side), beat at which it lands
const SLOTS = {
    lin: [{ k: 'L1', label: '2t', v: '2/s²', at: IX.lin2 }, { k: 'L2', label: '4u(t)', v: '4/s', at: IX.lin3 }, { k: 'L3', label: '(2t + 4)u(t)', v: '(4s + 2)/s²', at: IX.lin4 }],
    fs: [{ k: 'F1', label: 'sin 4t', v: '4/(s² + 16)', at: IX.fs1v }, { k: 'F2', label: 'e^{−2t} sin 4t', v: '4/((s + 2)² + 16)', at: IX.fs3 }],
    ts: [{ k: 'T1', label: '3u(t)', v: '3/s', at: IX.tr1 }, { k: 'T2', label: '− 5u(t − 1)', v: '− 5e^{−s}/s', at: IX.tr2 }, { k: 'T3', label: '+ 2u(t − 2)', v: '+ 2e^{−2s}/s', at: IX.tr3 }],
};
SLOTS.key = SLOTS.ts;
// the three steps of the switched source f(t) = 3u(t) − 5u(t − 1) + 2u(t − 2): time (s), level before, level after, label
const STEPS = [{ t: 0, y0: 0, y1: 3, label: '+3' }, { t: 1, y0: 3, y1: -2, label: '−5' }, { t: 2, y0: -2, y1: 0, label: '+2' }];
// start time (s) of beat i on the measured timeline
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEAT_FROM[BEATS[i].id] * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
    let k = -1;
    for (let i = 0; i < BEATS.length; i++)
        if (time >= beatStart(TL, i))
            k = i;
    return k;
}
/* ═══ 6 PANELS ════════════════════════════════════════════════════════════ */
// the one focus line with its colour bar (focus rules R1, R2)
function FocusLine({ id, children }) {
    return h('div', { 'data-focus': id, style: { marginTop: 3, borderLeft: `5px solid ${C_BAR}`, paddingLeft: 14, minHeight: 44,
            display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.35 } }, h('span', null, children));
}
// focus content for beat b: the one line the voice is speaking
function focusOf(b) {
    const F = FOCUS_FS, f = (t) => col(t, C_TIME, F, 600), arrow = ' ↔ ';
    if (b.id.slice(0, 2) === 'p_') {
        const p = PAIR[b.pair];
        return h('span', null, f(p.f), arrow, sSide(p.F, F, C_S));
    }
    if (b.id.slice(0, 3) === 'pr_')
        return h('span', null, mt(PROP[b.prop].eq, F));
    const val = (k, n, d, pre) => h(Val, { k, pre }, h(Fr, { n, d, size: VALUE_FS, color: C_VAL }));
    switch (b.id) {
        case 'intro': return prose('The table becomes a tool');
        case 'table': return h('span', null, f('f(t)'), arrow, col('F(s)', C_S, F, 600));
        case 'tge0': return h('span', null, prose('every pair holds for '), 't ≥ 0');
        case 'seven': return prose('seven pairs circuits use');
        case 'props': return prose('three properties stretch the pairs');
        case 'ref': return prose('the rest of the table: for reference');
        case 'lin0': return h('span', null, mt(PROP.lin.eq, F));
        case 'lin1': return h('span', null, f('f(t) = (2t + 4)u(t)'));
        case 'lin2': return h('span', null, f('2t'), arrow, val('L1', '2', 's²'));
        case 'lin3': return h('span', null, f('4u(t)'), arrow, val('L2', '4', 's'));
        case 'lin4': return h('span', null, h(Fr, { n: '2', d: 's²', size: F, color: C_S }), '+', h(Fr, { n: '4', d: 's', size: F, color: C_S }), val('L3', '4s + 2', 's²', '= '));
        case 'fs0': return h('span', null, mt(PROP.fshift.eq, F));
        case 'fs1': return h('span', null, f('sin 4t'), arrow, h('span', { style: { color: MUTE } }, '?'));
        case 'fs1v': return h('span', null, f('sin 4t'), arrow, val('F1', '4', 's² + 16'));
        case 'fs2': return h('span', null, f('e^{−2t} sin 4t'), arrow, h(Fr, { n: '4', size: F, color: C_S, d: h('span', null,
                h('span', { style: { position: 'relative', display: 'inline-block', padding: '0 24px' } }, 's', h('span', { 'data-cover': 's', style: { position: 'absolute', top: 1, bottom: 1, left: 0, right: 0, background: COVER_FILL,
                        border: `1.5px solid ${COVER_STROKE}`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: INK } }, 'cover')), '² + 16') }), h('span', { style: { fontFamily: HEAD, fontSize: SMALL_FS, marginLeft: 10 } }, 'replace s with s + 2'));
        case 'fs3': return h('span', null, f('e^{−2t} sin 4t'), arrow, val('F2', '4', '(s + 2)² + 16'));
        case 'ts0': return h('span', null, mt(PROP.tshift.eq, F));
        case 'wave': return prose('a switched source, f(t)');
        case 'w1': return h('span', null, f('f(t) = 3'), prose('  for 0 < t < 1 s'));
        case 'w2': return h('span', null, f('f(t) = −2'), prose('  for 1 < t < 2 s'));
        case 'w3': return h('span', null, f('f(t) = 0'), prose('  for t > 2 s'));
        case 'st0': return prose('write f(t) as a sum of steps');
        case 'st1': return h('span', null, f('f(t) = '), col('3u(t)', C_VAL, F, 600));
        case 'st2': return h('span', null, f('f(t) = 3u(t) '), col('− 5u(t − 1)', C_VAL, F, 600));
        case 'st3': return h('span', null, f('f(t) = 3u(t) − 5u(t − 1) '), col('+ 2u(t − 2)', C_VAL, F, 600));
        case 'tr0': return prose('transform term by term');
        case 'tr1': return h('span', null, f('3u(t)'), arrow, val('T1', '3', 's'));
        case 'tr2': return h('span', null, f('− 5u(t − 1)'), arrow, val('T2', '5e^{−s}', 's', '− '));
        case 'tr3': return h('span', null, f('+ 2u(t − 2)'), arrow, val('T3', '2e^{−2s}', 's', '+ '));
        default: return prose('seven pairs + three properties cover every source in this course');
    }
}
// one row of the full table: the time side, the s side and a tag; hidden (space kept) until its beat
function PairRow({ p, on, active, ui }) {
    const c1 = p.use ? C_TIME : MUTE, c2 = p.use ? C_S : MUTE;
    return h('div', { 'data-pair': p.id, style: { display: 'flex', alignItems: 'center', height: ROW_H, visibility: on ? 'visible' : 'hidden', borderRadius: 4,
            outline: active ? `2px solid ${C_BAR}` : 'none', fontFamily: MONO, fontSize: ROW_FS, whiteSpace: 'nowrap' } },
        h('span', { style: { width: 14, color: C_BAR, fontWeight: 600 } }, p.use ? '●' : ''),
        h('span', { style: { width: 128, color: c1, fontWeight: p.use ? 600 : 400 } }, mt(p.f, ROW_FS)),
        h('span', { style: { flex: 1, color: c2, fontWeight: p.use ? 600 : 400 } }, mt(p.inl, ROW_FS)),
        h('span', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, p.use ? '' : ui.refTag));
}
// one row of the property table: name, the property and a tag; hidden (space kept) until its beat
function PropRow({ p, on, active }) {
    const c = p.use ? INK : MUTE;
    return h('div', { 'data-prop': p.id, style: { display: 'flex', alignItems: 'center', height: ROW_H, visibility: on ? 'visible' : 'hidden', borderRadius: 4,
            outline: active ? `2px solid ${C_BAR}` : 'none', whiteSpace: 'nowrap' } },
        h('span', { style: { width: 14, fontFamily: MONO, fontSize: ROW_FS, color: C_BAR, fontWeight: 600 } }, p.use ? '●' : ''),
        h('span', { style: { width: 172, fontFamily: HEAD, fontSize: ROW_FS, color: c, fontWeight: p.use ? 600 : 400 } }, p.name),
        h('span', { style: { flex: 1, fontFamily: MONO, fontSize: ROW_FS, color: c, fontWeight: p.use ? 600 : 400 } }, mt(p.eq, ROW_FS)),
        h('span', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, p.use ? '' : p.tag));
}
// TableView: both textbook tables, retyped; a row appears when the voice names it (focus rule R4), and the one focus line
function TableView({ ui, bi }) {
    const b = BEATS[bi];
    const colHead = (t, on) => h('div', { style: { visibility: on ? 'visible' : 'hidden', borderBottom: `1px solid ${LINE}`, paddingBottom: 2, marginBottom: 2 } }, zoneHead(t));
    return h('div', { 'data-gate': 'work', 'data-view': 'table', style: panel({ left: WORK_X, top: PANEL_TOP, width: TABLE_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 5 }) },
        zoneHead(ui.tableHead, ACCENT),
        h('div', { style: { display: 'flex', gap: 28, visibility: bi >= IX.table ? 'visible' : 'hidden' } },
            h('div', { style: { width: 456, flexShrink: 0 } },
                colHead(ui.pairsHead, true),
                h('div', { style: { display: 'flex', height: ROW_H, alignItems: 'center', fontFamily: MONO, fontSize: ROW_FS, fontWeight: 600 } },
                    h('span', { style: { width: 14 } }), h('span', { style: { width: 128, color: C_TIME } }, 'f(t)'), h('span', { style: { color: C_S } }, 'F(s)')),
                PAIRS.map((p) => h(PairRow, { key: p.id, p, ui, on: bi >= (p.use ? PAIR_AT[p.id] : IX.ref), active: b.pair === p.id })),
                h('div', { 'data-footnote': '1', style: { visibility: bi >= IX.tge0 ? 'visible' : 'hidden', fontFamily: HEAD, fontSize: FS_MIN, color: INK, marginTop: 3 } }, ui.footnote)),
            h('div', { style: { flex: 1, minWidth: 0 } },
                colHead(ui.propsHead, bi >= IX.props),
                PROPS.map((p) => h(PropRow, { key: p.id, p, on: bi >= (p.use ? PROP_AT[p.id] : IX.ref), active: b.prop === p.id })))),
        h(FocusLine, { id: b.id }, focusOf(b)));
}
// Wave: the switched source f(t) = 3u(t) − 5u(t − 1) + 2u(t − 2), drawn one level at a time; `steps` jumps carry their
// labels and jump `hi` is drawn in amber. Schematic: ideal steps; f(t) dimensionless, t in s.
function Wave({ segs, steps, hi, ui }) {
    const padL = 34, padR = 40, padT = 8, padB = 20; // px: room for tick labels
    const X = (t) => padL + ((t - WAVE_T0) / (WAVE_T1 - WAVE_T0)) * (WAVE_W - padL - padR);
    const Y = (y) => padT + (1 - (y - WAVE_Y0) / (WAVE_Y1 - WAVE_Y0)) * (WAVE_H - padT - padB);
    const ends = [1, 2, WAVE_T1]; // s: where each level ends
    const yTicks = [-2, 0, 2], tTicks = [0, 1, 2, 3];
    const lv = (i) => h('line', { key: 'l' + i, 'data-seg': i, x1: X(STEPS[i].t), y1: Y(STEPS[i].y1), x2: X(ends[i]), y2: Y(STEPS[i].y1), stroke: C_TIME, strokeWidth: 3, strokeLinecap: 'round' });
    return h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('svg', { viewBox: `0 0 ${WAVE_W} ${WAVE_H}`, width: WAVE_W, height: WAVE_H, role: 'img', 'data-plot': 'wave', style: { display: 'block' },
                'aria-label': 'Plot of the switched source against time in seconds' + (segs >= 3 ? ': 3 from 0 to 1 second, minus 2 from 1 to 2 seconds, 0 after' : '') },
            yTicks.map((v) => h('g', { key: 'y' + v },
                h('line', { x1: padL, y1: Y(v), x2: WAVE_W - padR, y2: Y(v), stroke: LINE, strokeWidth: v === 0 ? 1.4 : 0.8 }),
                h('text', { x: padL - 6, y: Y(v) + 4.5, textAnchor: 'end', fontFamily: MONO, fontSize: FS_MIN, fill: MUTE }, (v < 0 ? MINUS : '') + Math.abs(v)))),
            h('line', { x1: X(0), y1: padT, x2: X(0), y2: WAVE_H - padB, stroke: MUTE, strokeWidth: 1 }),
            h('line', { x1: padL, y1: Y(0), x2: WAVE_W - padR, y2: Y(0), stroke: MUTE, strokeWidth: 1 }),
            tTicks.map((t) => h('g', { key: 't' + t },
                h('line', { x1: X(t), y1: WAVE_H - padB, x2: X(t), y2: WAVE_H - padB + 4, stroke: MUTE, strokeWidth: 1 }),
                h('text', { x: X(t), y: WAVE_H - 3, textAnchor: 'middle', fontFamily: MONO, fontSize: FS_MIN, fill: MUTE }, t))),
            h('text', { x: WAVE_W - 2, y: WAVE_H - 3, textAnchor: 'end', fontFamily: MONO, fontSize: FS_MIN, fill: MUTE }, 't, s'),
            h('text', { x: 2, y: padT + 10, fontFamily: MONO, fontSize: FS_MIN, fill: C_TIME }, 'f(t)'),
            segs >= 1 ? h('line', { x1: X(WAVE_T0), y1: Y(0), x2: X(0), y2: Y(0), stroke: C_TIME, strokeWidth: 3, strokeLinecap: 'round' }) : null,
            STEPS.map((s, i) => (i < segs ? h('line', { key: 'j' + i, 'data-jump': i, x1: X(s.t), y1: Y(s.y0), x2: X(s.t), y2: Y(s.y1),
                stroke: hi === i ? C_VAL : C_TIME, strokeWidth: hi === i ? 5 : 1.6, strokeDasharray: hi === i ? 'none' : '4 3' }) : null)),
            STEPS.map((s, i) => (i < segs ? lv(i) : null)),
            STEPS.map((s, i) => (i < steps ? h('text', { key: 's' + i, 'data-step-label': i, x: X(s.t) + 8, y: Y((s.y0 + s.y1) / 2) + 5, fontFamily: MONO, fontSize: hi === i ? SMALL_FS : FS_MIN,
                fontWeight: 600, fill: hi === i ? C_VAL : INK }, s.label) : null))),
        h('div', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, ui.waveCaption));
}
// the object being transformed, at the top of the work zone: f(t) as text, or the switched-source plot
function contextOf(b, bi, ui) {
    const line = (t) => h('div', { 'data-context': '1', style: { minHeight: 26, fontFamily: MONO, fontSize: SMALL_FS, color: C_TIME, fontWeight: 600 } }, t ? mt(t, SMALL_FS) : null);
    if (b.sec === 'lin')
        return line(bi >= IX.lin1 ? 'f(t) = (2t + 4)u(t)' : '');
    if (b.sec === 'fs')
        return line(bi >= IX.fs2 ? 'f(t) = e^{−2t} sin 4t' : bi >= IX.fs1 ? 'f(t) = sin 4t' : '');
    if (b.sec === 'ts' && bi >= IX.wave)
        return h(Wave, { segs: b.segs, steps: b.steps, hi: b.hi, ui });
    return line('');
}
// finished lines for beat index i: one compact row each, oldest first (focus rule R1)
function doneRows(i) {
    const rows = [], add = (key, t, color) => rows.push({ key, t, color });
    const sec = BEATS[i].sec;
    if (sec === 'lin') {
        if (i > IX.lin0)
            add('lr', PROP.lin.eq, INK);
        if (i > IX.lin2)
            add('l1', '2t ↔ 2/s²');
        if (i > IX.lin3)
            add('l2', '4u(t) ↔ 4/s');
        return rows;
    }
    add('ls', 'linearity: (2t + 4)u(t) ↔ 2/s² + 4/s = (4s + 2)/s²');
    if (sec === 'fs') {
        if (i > IX.fs0)
            add('fr', PROP.fshift.eq, INK);
        if (i > IX.fs1v)
            add('f1', 'sin 4t ↔ 4/(s² + 16)');
        if (i > IX.fs2)
            add('f2', 'times e^{−2t}: replace s with s + 2');
        return rows;
    }
    add('fss', 'frequency shift: e^{−2t} sin 4t ↔ 4/((s + 2)² + 16)');
    if (sec === 'ts') {
        if (i > IX.ts0)
            add('tr', PROP.tshift.eq, INK);
        if (i > IX.w3 && i <= IX.st3)
            add('lv', 'f(t) = 3 for 0 < t < 1 s, −2 for 1 < t < 2 s, 0 after');
        if (i > IX.st3)
            add('st', 'f(t) = 3u(t) − 5u(t − 1) + 2u(t − 2)', C_TIME);
        if (i > IX.tr1)
            add('t1', '3u(t) ↔ 3/s');
        if (i > IX.tr2)
            add('t2', '− 5u(t − 1) ↔ − 5e^{−s}/s');
        return rows;
    }
    add('tss', 'time shift: the switched source ↔ 3/s − 5e^{−s}/s + 2e^{−2s}/s');
    return rows;
}
// Work: the work zone for the three properties: the object, the finished lines as compact rows, and the one focus line
function Work({ ui, bi }) {
    const b = BEATS[bi];
    const badge = { lin: PROP.lin.name, fs: PROP.fshift.name, ts: PROP.tshift.name }[b.sec];
    return h('div', { 'data-gate': 'work', 'data-view': 'work', style: panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 6 }) },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            zoneHead(ui.workHead, ACCENT),
            badge ? h('span', { style: { fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: C_BAR, border: `1px solid ${C_BAR}`, borderRadius: 4, padding: '1px 7px' } }, badge.toUpperCase()) : null),
        contextOf(b, bi, ui),
        h('div', { 'data-done': '1', style: { display: 'flex', flexDirection: 'column', gap: 1 } }, doneRows(bi).map((r) => h('div', { key: r.key, 'data-done-row': r.key,
            style: Object.assign(kMono(SMALL_FS, r.color || MUTE), { whiteSpace: 'nowrap', lineHeight: '21px' }) }, mt(r.t, SMALL_FS)))),
        h(FocusLine, { id: b.id }, focusOf(b)));
}
// PairsPanel: the seven pairs, always in view while the properties are taught; the pair in use is outlined.
// The sine pair (a reference row) joins the list while the frequency shift starts from it.
function PairsPanel({ ui, bi }) {
    const b = BEATS[bi];
    const list = PAIRS.filter((p) => p.use || (p.id === 'sin' && b.sec === 'fs' && bi >= IX.fs1));
    return h('div', { 'data-gate': 'tape', 'data-panel': 'pairs', style: panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: PAIRS_H, display: 'flex', flexDirection: 'column', gap: 3 }) },
        zoneHead(ui.sevenHead, C_S),
        list.map((p) => h('div', { key: p.id, 'data-pair': p.id, style: { display: 'flex', alignItems: 'center', height: 23, padding: '0 6px', borderRadius: 4, fontFamily: MONO, fontSize: ROW_FS, whiteSpace: 'nowrap',
                outline: b.pair === p.id ? `2px solid ${C_BAR}` : 'none', outlineOffset: -2 } },
            h('span', { style: { width: 126, color: p.use ? C_TIME : MUTE, fontWeight: 600 } }, mt(p.f, ROW_FS)),
            h('span', { style: { flex: 1, color: p.use ? C_S : MUTE, fontWeight: 600 } }, mt(p.inl, ROW_FS)),
            p.use ? null : h('span', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, ui.refTag))),
        h('div', { style: { marginTop: 'auto', fontFamily: HEAD, fontSize: FS_MIN, color: INK } }, ui.footnote));
}
// YtPlot: the Your-turn time function with its envelope, shown with the solution (in place of the seven pairs)
function YtPlot({ ui }) {
    return h('div', { 'data-gate': 'tape', 'data-panel': 'ytplot', style: panel({ left: SIDE_X, top: PANEL_TOP, width: SIDE_W, height: PAIRS_H, display: 'flex', flexDirection: 'column', gap: 4 }) },
        h('div', { style: kMono(SMALL_FS, C_TIME, 600) }, mt(ui.ytPlotHead, SMALL_FS)),
        h(FtPlot, { f: YT.f, tmax: YT_TMAX, width: SIDE_W - 26, height: 172, shown: true, color: C_TIME,
            extra: [{ f: YT.env, color: MUTE }, { f: (t) => -YT.env(t), color: MUTE }] }),
        h('div', { style: { fontFamily: HEAD, fontSize: FS_MIN, color: MUTE } }, mt(ui.ytPlotNote, FS_MIN)));
}
// one result slot: "?" until the voice has given the value (R4); outlined while it lands with reduced motion (R7)
function Slot({ sl, got, landing, reduced }) {
    return h('div', { 'data-slot': sl.k, style: { flex: 1, minWidth: 0, border: `2px solid ${got ? C_VAL : LINE}`, borderRadius: 8, padding: '4px 4px', textAlign: 'center',
            background: got ? 'rgba(0,0,0,0.02)' : 'transparent', outline: landing && got && reduced ? `3px solid ${C_VAL}` : 'none', outlineOffset: 2, whiteSpace: 'nowrap' } },
        h('div', { style: { fontFamily: MONO, fontSize: FS_MIN, color: C_TIME, fontWeight: 600, lineHeight: '20px' } }, mt(sl.label, FS_MIN)),
        h('div', { 'data-tape': sl.k, style: { fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: got ? INK : MUTE, lineHeight: '26px' } }, got ? mt(sl.v, SMALL_FS) : '?'));
}
// LandPath (focus rule R5): a dashed path from the value in the focus line to its result slot, with a dot that travels
// along it in LAND_MOVE s. The path runs along the focus line, down the gap between the work zone and the side column,
// and into the slot from below, so it never crosses a line of text. `progress` is 0..1; null draws the finished path.
function LandPath({ k, progress }) {
    const [pts, setPts] = useState(null);
    useEffect(() => {
        const stage = document.getElementById('stage'), a = document.querySelector('[data-landing-from="' + k + '"]'), b = document.querySelector('[data-slot="' + k + '"]');
        if (!stage || !a || !b) {
            setPts(null);
            return;
        }
        const s = stage.getBoundingClientRect(), z = STAGE_W / s.width, ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const p = [(ra.right - s.left) * z + 6, (ra.top + ra.height / 2 - s.top) * z, (rb.left + rb.width / 2 - s.left) * z, (rb.bottom - s.top) * z];
        setPts((o) => (o && o.every((v, i) => Math.abs(v - p[i]) < 0.5) ? o : p));
    });
    if (!pts)
        return null;
    const [x0, y0, x1, yb] = pts, gx = SIDE_X - PANEL_GAP / 2, under = yb + LAND_UNDER;
    const P = [[x0, y0], [gx, y0], [gx, under], [x1, under], [x1, yb + 3]];
    const len = P.slice(1).map((q, i) => Math.abs(q[0] - P[i][0]) + Math.abs(q[1] - P[i][1]));
    let at = (progress == null ? 1 : clamp(progress, 0, 1)) * len.reduce((u, v) => u + v, 0), dot = P[P.length - 1];
    for (let i = 0; i < len.length; i++) {
        if (at <= len[i]) {
            const f = len[i] ? at / len[i] : 0;
            dot = [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f];
            break;
        }
        at -= len[i];
    }
    return h('svg', { 'data-landing': '1', width: STAGE_W, height: STAGE_H, 'aria-hidden': 'true', style: { position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none' } },
        h('path', { d: 'M' + P.map((q) => q[0] + ' ' + q[1]).join(' L'), fill: 'none', stroke: C_VAL, strokeWidth: 2, strokeDasharray: '6 5' }),
        h('circle', { cx: dot[0], cy: dot[1], r: 5, fill: C_VAL }));
}
// ResultsPanel: the transforms found in the current section, each landing in its slot; on the Your-turn line, where to go next
function ResultsPanel({ ui, bi, reduced }) {
    const b = BEATS[bi], slots = SLOTS[b.sec];
    const top = PANEL_TOP + PAIRS_H + PANEL_GAP, height = PANEL_H - PAIRS_H - PANEL_GAP;
    const links = bi >= IX.yt;
    return h('div', { 'data-gate': 'ft', 'data-panel': 'results', style: panel({ left: SIDE_X, top, width: SIDE_W, height, display: 'flex', flexDirection: 'column', gap: 7 }) },
        zoneHead(links ? ui.nextHead : ui.resultsHead, links ? ACCENT : C_VAL),
        links ? ui.links.map((l) => h('a', { key: l.href, href: l.href, 'data-next': '1', style: { fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: ACCENT, lineHeight: '24px' } }, l.text))
            : h('div', { style: { display: 'flex', gap: 8 } }, slots.map((sl) => h(Slot, { key: sl.k, sl, got: bi >= sl.at, landing: b.land === sl.k, reduced }))));
}
// skeleton rail: the nine steps of the lecture (narration lines 2–10)
const CIRCLED9 = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
function LectureRail({ lang, ui, bi }) {
    if (bi < IX.table)
        return null;
    const active = BEATS[bi].line - 2;
    return h('div', { 'data-gate': 'rail', style: panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 9 }) },
        zoneHead(ui.railHead),
        lang.rail.map((t, i) => {
            const isAct = i === active, c = isAct ? ACCENT : i < active ? INK : UPCOMING;
            return h('div', { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
                h('span', { style: { fontFamily: MONO, fontSize: 14, color: c, lineHeight: '18px', width: 15, flexShrink: 0 } }, i < active ? '✓' : CIRCLED9[i]),
                h('span', { style: { fontFamily: HEAD, fontSize: 13.5, lineHeight: '18px', color: c, fontWeight: isAct ? 600 : 400 } }, t));
        }));
}
// ◀ ▶ one line at a time, the line counter, the Your-turn button and the note
function Nav({ cur, total, goBeat, yt, note }) {
    const step = (label, to, aria) => h('button', { type: 'button', onClick: () => goBeat(to), style: Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' }), 'aria-label': aria }, label);
    return h('div', { style: { width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            step('◀', Math.max(0, cur - 1), 'previous line'),
            step('▶', Math.min(total - 1, cur + 1), 'next line'),
            h('span', { 'data-step': '1', style: { fontFamily: MONO, fontSize: FS_MIN, color: MUTE } }, 'line ' + (cur + 1) + ' of ' + total),
            yt.reached && !yt.open ? h('button', { type: 'button', onClick: yt.reopen, style: Object.assign(btnStyle(true, ACCENT), { marginLeft: 'auto' }) }, 'Your turn') : null),
        h('div', { 'data-note': '1', style: { fontFamily: HEAD, fontSize: 13.5, color: INK, textWrap: 'pretty', lineHeight: 1.35 } }, note));
}
// BottomBand: line-by-line stepping, and the three properties (each appears when the voice names it; the one in use is outlined)
function BottomBand({ ui, bi, goBeat, yt, note }) {
    const b = BEATS[Math.max(0, bi)];
    const inUse = { lin: 'lin', fs: 'fshift', ts: 'tshift' }[b.sec] || b.prop;
    return h('div', { 'data-gate': 'band', style: panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H, display: 'flex', gap: 16, padding: '8px 16px', alignItems: 'stretch' }) },
        h(Nav, { cur: clamp(bi, 0, LAST), total: LAST + 1, goBeat, yt, note }),
        h('div', { style: { width: 1, background: LINE } }),
        h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: { visibility: bi >= IX.pr_lin ? 'visible' : 'hidden' } }, zoneHead(ui.threeHead)),
            h('div', { style: { display: 'flex', gap: 10 } }, THREE.map((id) => {
                const p = PROP[id], on = bi >= PROP_AT[id];
                return h('div', { key: id, 'data-three': id, style: { flex: id === 'lin' ? '1.4 1 0' : id === 'tshift' ? '1.1 1 0' : '0.9 1 0', minWidth: 0, visibility: on ? 'visible' : 'hidden',
                        border: `2px solid ${inUse === id ? C_BAR : LINE}`, borderRadius: 8, padding: '4px 8px', whiteSpace: 'nowrap' } },
                    h('div', { style: { fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: inUse === id ? C_BAR : INK, lineHeight: '19px' } }, p.name),
                    h('div', { style: { fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: '24px' } }, mt(p.eq, FS_MIN)));
            }))));
}
// LectureCaptions: the on-screen line for the current beat (numerals and symbols)
function LectureCaptions({ sched, text }) {
    const time = useTime();
    const TL = useTL();
    const i = idxAt(sched, time);
    if (i < 0 || time >= TL.FINISH || !text)
        return null;
    return h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', pointerEvents: 'none' } },
        h('div', { 'data-gate': 'caption', style: { maxWidth: 1040, margin: '0 20px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW, padding: '8px 18px',
                opacity: clamp((time - sched.starts[i]) / 0.35, 0, 1), fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' } }, mt(text, 15)));
}
// LectureYourTurn (kit rule 63): one new problem over the work zone; Show solution reveals the worked steps. No answer boxes.
function LectureYourTurn({ shown, onToggle, onClose }) {
    const lab = { fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 92, flexShrink: 0 };
    return h('div', { 'data-gate': 'work', 'data-card': 'yourturn', style: panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5, border: `2px solid ${ACCENT}`, display: 'flex', flexDirection: 'column', gap: 12 }) },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('div', { style: { fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT } }, 'YOUR TURN'),
            h('button', { type: 'button', onClick: onClose, style: btnStyle(false) }, '← back to the lecture')),
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 12 } },
            h('span', { style: { fontFamily: HEAD, fontSize: 19, color: INK } }, 'Find'),
            h('span', { 'data-yt-problem': '1', style: { fontFamily: MONO, fontSize: 24, fontWeight: 600, color: C_TIME } }, mt('ℒ{' + YT.ask + '}', 24))),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
            h('div', { style: { fontFamily: HEAD, fontSize: 15.5, color: INK, flex: 1, textWrap: 'pretty' } }, h('b', null, 'Work it on paper.'), ' Use one of the seven pairs and one property.'),
            h('button', { type: 'button', onClick: onToggle, 'aria-expanded': shown, style: Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '8px 16px', flexShrink: 0 }) }, shown ? 'Hide solution' : 'Show solution')),
        shown ? h('div', { 'data-solution': '1', style: { borderTop: `1px solid ${LINE}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 } },
            YT.steps.map((s, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'baseline', gap: 10 } },
                h('span', { style: lab }, s[0]),
                h('span', { style: { fontFamily: MONO, fontSize: 14.5, color: INK } }, mt(s[1], 14.5)))),
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 } },
                h('span', { style: lab }, 'answer'),
                h('span', { 'data-yt-answer': '1', style: { fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: C_S, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: 4 } },
                    YT.answer.map((a, i) => h('span', { key: i, style: { paddingLeft: i ? 45 : 0 } }, mt(a, SMALL_FS))))),
            h('div', { style: { fontFamily: HEAD, fontSize: 13.5, color: MUTE } }, 'The time function is plotted on the right.')) : null);
}
/* ═══ 7 SCENE ═════════════════════════════════════════════════════════════ */
// Scene: builds the schedule from the measured clip durations and mounts the stage
function Scene() {
    const { urls, durs } = useClips(LANG.clips);
    const sched = useMemo(() => buildSchedule(LANG, durs), [durs]);
    const TL = useMemo(() => makeTL(sched), [sched]);
    const narration = useMemo(() => LANG.clips.map((clip, i) => ({ clip, at: sched.starts[i], dur: sched.durs[i] })), [sched]);
    return h(Stage, { duration: sched.total }, h(TLCtx.Provider, { value: TL }, h(SceneBody, { lang: LANG, ui: LANG.ui, sched, narration, urls })));
}
// SceneBody: which beat is on screen (from the playhead, or from ◀ ▶) and the panels for it
function SceneBody({ lang, ui, sched, narration, urls }) {
    const { time, playing, setPlaying } = useTimeline();
    const TL = useTL();
    const yt = useYourTurn();
    const reduced = useReducedMotion();
    const [hand, setHand] = useState(-1); // beat chosen by hand; -1 while the tour drives
    useEffect(() => { if (playing)
        setHand(-1); }, [playing]);
    const tourBi = beatAt(TL, Math.min(time, TL.REVERT));
    const shown = hand >= 0 ? hand : tourBi;
    const b = BEATS[Math.max(0, shown)];
    const goBeat = (i) => { yt.close(); if (playing)
        setPlaying(false); setHand(i); };
    const note = hand >= 0 ? ui.noteStep : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
    const landing = shown >= 0 && b.land && !yt.open ? b.land : '';
    const landProg = hand >= 0 ? null : (time - beatStart(TL, Math.max(0, shown))) / LAND_MOVE;
    const tableView = b.sec === 'table';
    const got = (SLOTS[b.sec] || []).filter((sl) => shown >= sl.at).map((sl) => plain(sl.label) + ' gives ' + plain(sl.v)).join('; ');
    return h(React.Fragment, null,
        h(TitleCard, { ui }),
        h(Header, { head: ui.header, sub: ui.headerSub, keyPoint: ui.keyPoint }),
        shown >= 0 ? h(LectureRail, { lang, ui, bi: shown }) : null,
        shown >= 0 && tableView ? h(TableView, { ui, bi: shown }) : null,
        shown >= 0 && !tableView ? h(Work, { ui, bi: shown }) : null,
        yt.open ? h(LectureYourTurn, { shown: yt.shown, onToggle: yt.toggle, onClose: yt.close }) : null,
        shown >= 0 && !tableView ? (yt.shown ? h(YtPlot, { ui }) : h(PairsPanel, { ui, bi: shown })) : null,
        shown >= 0 && !tableView ? h(ResultsPanel, { ui, bi: shown, reduced }) : null,
        landing && !reduced ? h(LandPath, { k: landing, progress: landProg }) : null,
        h(BottomBand, { ui, bi: shown, goBeat, yt, note }),
        h(LectureCaptions, { sched, text: shown >= 0 ? b.cap : '' }),
        h(FinishStrip, { ui }),
        h(ProgressBar, null),
        h(Stamp, null),
        h(Narrator, { lines: narration, urls }),
        h(SoundToggle, null),
        h(ReplayPill, null),
        h(OpeningCard, { card: lang.card }),
        h(SrSummary, { text: ui.srSummary + (shown >= 0 ? plain(b.cap) + ' ' : '') + (got ? 'So far: ' + got + '. ' : '') +
                (yt.open ? 'Your turn: find the Laplace transform of ' + plain(YT.ask) + '.' + (yt.shown ? ' Solution: ' + YT.answer.map(plain).join(' ') + '.' : '') : '') }));
}
/* ═══ MOUNT ═══ */
ReactDOM.createRoot(document.getElementById('root')).render(h(Scene, null));
