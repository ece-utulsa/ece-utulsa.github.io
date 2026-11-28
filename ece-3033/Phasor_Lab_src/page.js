/* ═══ CONTENTS ═══
   1. CONSTANTS   2. MODEL   3. FORMAT   4. DOM HELPERS   5. STATE, HOLDS AND CHANGES   6. CONTROLS   7. CIRCUIT   8. PHASOR PANELS
   9. SIDE PLOT   10. SHARING BARS   11. READOUTS, WARNINGS AND STEPS   12. SWEEP   13. DRAW   14. EXPERIMENTS   15. WORKSHEET   16. PAGES AND START */
'use strict';
{
/* ═══ 1. CONSTANTS ═══ */
const DEFAULT = {                         // spec §6: own numbers, never homework data
  VLL: 13.8,                              // kV, line-to-line bus voltage (held)
  ident: true,                            // G2 uses G1's rating and impedance
  m: [{S: 10, R: 0.6, X: 15}, {S: 10, R: 0.6, X: 15}],   // per machine: rating (MVA), R_A and X_S (Ω per phase, Y)
  PL: 12.0, pfL: 0.85, lagL: true,        // load: MW, power factor, lagging (true) or leading
  hold: 'free',                           // 'free' | 'field' (|E_A1| held, vary P_1) | 'power' (P_1 held, vary |E_A1|) | 'shift' (pf_1 held, vary P_1)
  by: 'pf',                               // in Free, G1 is set by P_1 and one of: 'pf' | 'q' | 'e'
  P1: 6.0, pf1: 0.92, lag1: true,         // G1: MW, power factor, lagging (true) or leading
  Q1: 0, E1: 0};                          // G1: Mvar (by 'q') and |E_A1| in V (by 'e'); filled from the solution when first used
const MW = 1e6;                           // W per MW (and var per Mvar, VA per MVA)
const KV = 1e3;                           // V per kV
const UNITY_PF = 0.9995;                  // at or above this power factor the load or G1 is "unity" and Q = 0
const Q_ZERO = 0.005, P_ZERO = 0.005;     // Mvar and MW: below these Q counts as zero, and a negative P as reverse power
const OVER_MVA = 0.005;                   // MVA above the rating before "above rating" shows
const E_RANGE_TOP = 1.6;                  // spec §3: the |E_A1| slider of the constant-power Hold runs to 1.6 × the unity-pf value
const P_RANGE_TOP = 1.2;                  // the P_L and Free P_1 sliders run to 1.2 × the sum of the ratings (MW)
const PF_MIN = 0.10;                      // least power factor on a slider
const LIMIT_TOL_P = 1e-4, LIMIT_TOL_E = 0.5;   // MW and V: within these of a limit the limit message shows
const SEEK_STEPS = 40;                    // bisection steps used to stop a refused slider move exactly at the limit
const SWEEP_MS = 6000;                    // spec §3: a Sweep takes about 6 s
const GHOST_EVERY = 0.1;                  // a faint ghost of each phasor every 10 % of the swept range
const LOCUS_N = 64, PLOT_N = 96;          // samples along a locus and along a side-plot curve
const ROUND_TIE = 1e-9;                   // added (away from zero) before rounding, so a value on a half step always rounds the same way
const EPS = 1e-9;
const HOLD_DELAY = 400, HOLD_EVERY = 110; // ms, press-and-hold repeat of a − / + button
const LIM = {VLL: [0.2, 50], S: [0.05, 2000], R: [0, 1000], X: [0.01, 10000]};   // accepted ranges of the typed inputs: kV, MVA, Ω, Ω
const NUM_MAX_CHARS = 12;                 // longest accepted typed number
const NUMBER_FORM = /^[+]?(\d+\.?\d*|\.\d+)$/;   // a plain positive decimal number
const SHEET_KEY = 'phasor-lab-worksheet-v1';   // the only localStorage key this tool reads or writes
const SHEET_MAX = 4000;                   // longest stored answer (characters)
const MINUS = '−';                        // U+2212
const DEG = 180 / Math.PI;                // degrees per radian
const SVGNS = 'http://www.w3.org/2000/svg';
const FS = 17, FS_S = 16;                 // figure text sizes, user units (at least 11 px at 1093 × 614; checked by the dev test)
const SUB_SCALE = 0.75, SUB_DROP = 0.28;  // subscript size and drop, as fractions of the text size
const HEAD = 10;                          // arrow-head length, user units
const W_FINE = 1.2, W_LINE = 1.7, W_PHASOR = 2.8, W_PART = 2.0, W_CURVE = 2.4;   // stroke widths
const DASH = '7 5', DASH_FINE = '4 3';    // dash patterns: loci and constant-P line, projections
const GHOST_OPACITY = 0.22;               // ghost phasors of a Sweep
const C = {g1: '#1c5fd6', g2: '#b0127e', load: '#18744a', v: '#A32D2D', ink: '#1b1f24', mute: '#55606b', grid: '#c8cfd5', amber: '#9a5b00',
  white: '#ffffff', panel: '#fafbfc', edge: '#dde3e8', loadbg: '#eef6f1', g1bg: '#dbe6fa', g2bg: '#f6dcee'};
const HALO = {stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round'};   // keeps a label legible where a line crosses it
const COL = [C.g1, C.g2];
// Panel geometry (viewBox 380 × 410 each). Scales are fixed by the ratings and V_φ (spec §5):
// currents: the reach to the right edge is CUR_REACH × the larger rated current; voltages: the reach is VOL_REACH × V_φ.
const PB = {x: 4, y: 4, w: 372, h: 402};  // drawable frame of a panel
const CUR = {ox: 40, oy: 200, reach: 322}, CUR_REACH = 2.2;
const VOL = {ox: 30, oy: 300, reach: 334}, VOL_REACH = 2.1;
const DELTA_R = [46, 66];                 // radius of the δ_1 and δ_2 arcs, user units

/* ═══ 2. MODEL ═══ */
// Complex numbers are [real, imaginary]; phasors are on V_φ at 0°.
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const mag = c => Math.hypot(c[0], c[1]);
const ang = c => Math.atan2(c[1], c[0]) * DEG;
// Phase voltage (V) of the bus.
function vph(st) { return st.VLL * KV / Math.sqrt(3); }
// Machine k's data (G2 copies G1 when the machines are identical).
function mach(st, k) { return st.ident ? st.m[0] : st.m[k]; }
// Reactive power (Mvar) at P (MW) and power factor pf; lagging (supplied) positive. Unity gives 0.
function qOf(P, pf, lag) { return pf >= UNITY_PF ? 0 : (lag ? 1 : -1) * Math.abs(P) * Math.tan(Math.acos(pf)); }
// Per-phase current (A) for P (MW) and Q (Mvar) at the bus: I = (P − jQ) / 3V_φ.
function current(P, Q, V) { return [P * MW / (3 * V), -Q * MW / (3 * V)]; }
// Internal voltage (V): E_A = V_φ + I (R_A + jX_S).
function emf(I, m, V) { return cadd([V, 0], cmul(I, [m.R, m.X])); }
// |Z_S| and its angle θ_Z (rad) of machine m. θ_Z is also the pull-out angle at a held |E_A|.
function zOf(m) { return {z: Math.hypot(m.R, m.X), th: Math.atan2(m.X, m.R)}; }
// G1 at a held |E_A| = E (V) delivering P (MW): the stable branch (δ below θ_Z). Uses P = 3V_φ[E(R cos δ + X sin δ) − V_φR]/|Z|² and
// Q = 3V_φ[E(X cos δ − R sin δ) − V_φX]/|Z|². Returns {ok, d (rad), Q (Mvar), k} or ok = false when P is past the pull-out limit.
function atField(P, E, m, V) {
  const {z, th} = zOf(m), k = (P * MW * z * z / (3 * V) + V * m.R) / (E * z);
  if (!(E > 0) || k > 1 + 1e-12 || k < -1) return {ok: false, k};
  const d = th - Math.acos(Math.min(1, k));
  return {ok: true, d, k, Q: 3 * V * (E * (m.X * Math.cos(d) - m.R * Math.sin(d)) - V * m.X) / (z * z) / MW};
}
// Largest P (MW) at a held |E_A| = E, and the angle (deg) where it occurs (δ = θ_Z).
function pMax(E, m, V) { const {z, th} = zOf(m); return {P: (3 * V * E / z - 3 * V * V * m.R / (z * z)) / MW, d: th * DEG}; }
// Least |E_A| (V) that can deliver P (MW): the distance from the origin to the constant-P line (reached at δ = θ_Z).
function eMin(P, m, V) { const {z} = zOf(m); return (P * MW * z * z / (3 * V) + V * m.R) / z; }
// |E_A| (V) at P (MW) and unity power factor.
function eUnity(P, m, V) { return mag(emf(current(P, 0, V), m, V)); }
// Q_L (Mvar) of the load.
function qLoad(st) { return qOf(st.PL, st.pfL, st.lagL); }
// Solve both machines for the state st. Returns d = {ok, V, QL, P, Q, S, IL, I, E, m, d1} or {ok: false} when G1's held field cannot give P_1.
function solve(st) {
  const V = vph(st), m = [mach(st, 0), mach(st, 1)], QL = qLoad(st);
  let Q1;
  if (st.by === 'pf') Q1 = qOf(st.P1, st.pf1, st.lag1);
  else if (st.by === 'q') Q1 = st.Q1;
  else { const f = atField(st.P1, st.E1, m[0], V); if (!f.ok) return {ok: false}; Q1 = f.Q; }
  const P = [st.P1, st.PL - st.P1], Q = [Q1, QL - Q1], IL = current(st.PL, QL, V), I1 = current(P[0], Q[0], V), I = [I1, csub(IL, I1)];
  const E = [emf(I[0], m[0], V), emf(I[1], m[1], V)];
  return {ok: true, V, QL, P, Q, S: [Math.hypot(P[0], Q[0]), Math.hypot(P[1], Q[1])], IL, I, E, m};
}
// Power factor of P, Q as a number (0 to 1) and its kind: 'unity', 'lag' or 'lead'.
function pfOf(P, Q) { const S = Math.hypot(P, Q); return {pf: S > EPS ? Math.abs(P) / S : 1, kind: Math.abs(Q) < Q_ZERO ? 'unity' : Q > 0 ? 'lag' : 'lead'}; }

/* ═══ 3. FORMAT ═══ */
// x to d decimals with a true minus.
function num(x, d) { const k = 10 ** d, r = Math.round(Math.abs(x) * k + ROUND_TIE) / k; return (x < 0 && r > 0 ? MINUS : '') + r.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
const f2 = x => num(x, 2);                // MW, Mvar, MVA (spec §5: 0.01)
const fk = x => num(x * 1000, 1);         // kW, kvar, kVA from MW (Steps: 0.1)
const fA = x => num(x, 1);                // A
const fV = x => num(x, 0);                // V
const fD = x => num(x, 1);                // degrees
// Phasor as magnitude∠angle (A or V, the unit written by the caller).
function polA(c) { return fA(mag(c)) + '∠' + fD(ang(c)) + '°'; }
function polV(c) { return fV(mag(c)) + '∠' + fD(ang(c)) + '°'; }
// Power factor text: "0.78 lag", "0.78 lead" or "1.00 unity".
function pfTxt(P, Q) { const p = pfOf(P, Q); return p.kind === 'unity' ? '1.00 unity' : num(p.pf, 2) + ' ' + p.kind; }
// Ohms as typed (no trailing zeros).
function ohm(x) { return String(+x.toFixed(4)); }

/* ═══ 4. DOM HELPERS (every node is created with createElement and filled with text nodes; no HTML strings) ═══ */
// Element by id.
function $(id) { return document.getElementById(id); }
// Append children (nodes or strings) to a node.
function add(node, kids) { for (const k of [].concat(kids || [])) if (k !== null && k !== undefined && k !== false) node.append(k); return node; }
// HTML element with attributes and children; 'class' and 'text' are set as properties.
function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
  return add(e, kids);
}
// SVG element with attributes and children.
function sv(tag, attrs, kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  return add(e, kids);
}
// Split rich text into runs: {t}, {b: true|false}, {v, sub} (variable with subscript) and {sup}.
// Markup: *bold*, X_S or I_{A1} (subscript on the letter before it), ^2 (superscript).
function runs(str) {
  const out = [], rx = /\*|([A-Za-zφθδ])_(\{[^}]*\}|[A-Za-z0-9φ])|\^(\{[^}]*\}|\d)/g;
  let last = 0, bold = false, m;
  const strip = s => s.replace(/^\{|\}$/g, '');
  while ((m = rx.exec(str))) {
    if (m.index > last) out.push({t: str.slice(last, m.index)});
    if (m[0] === '*') { bold = !bold; out.push({b: bold}); }
    else if (m[1]) out.push({v: m[1], sub: strip(m[2])});
    else out.push({sup: strip(m[3])});
    last = rx.lastIndex;
  }
  if (last < str.length) out.push({t: str.slice(last)});
  return out;
}
// Rich text as HTML nodes (markup as in the runs function).
function rich(str) {
  const frag = document.createDocumentFragment();
  let tgt = frag;
  for (const r of runs(str)) {
    if ('b' in r) { if (r.b) { tgt = el('b'); frag.append(tgt); } else tgt = frag; }
    else if ('v' in r) tgt.append(el('span', {class: 'v'}, [r.v, el('sub', r.sub.length > 1 ? {class: 'up'} : {}, r.sub)]));
    else if ('sup' in r) tgt.append(el('sup', {}, r.sup));
    else tgt.append(r.t);
  }
  return frag;
}
// HTML element holding rich text.
function rel(tag, cls, str) { return el(tag, cls ? {class: cls} : {}, rich(str)); }
// Replace the children of a node with rich text.
function setRich(node, str) { node.replaceChildren(rich(str)); }
// SVG text with subscripts and superscripts on shifted baselines (markup as in the runs function). o: size, fill, anchor, weight.
function stext(x, y, str, o = {}) {
  const fs = o.size || FS, a = {x, y, 'font-size': fs, fill: o.fill || C.ink};
  if (o.anchor) a['text-anchor'] = o.anchor;
  if (o.weight) a['font-weight'] = o.weight;
  if (o.rotate) a.transform = 'rotate(' + o.rotate + ' ' + x + ' ' + y + ')';
  const t = sv('text', a);
  let back = 0, bold = false;                    // back: baseline shift to undo on the next run, user units
  const span = (txt, extra, dy) => { const s = Object.assign({}, extra); if (dy) s.dy = dy; if (bold) s['font-weight'] = 700; t.append(sv('tspan', s, txt)); };
  for (const r of runs(str)) {
    if ('b' in r) { bold = r.b; continue; }
    if ('v' in r) {
      span(r.v, {'font-style': 'italic'}, -back);
      span(r.sub, {'font-size': fs * SUB_SCALE, 'font-style': r.sub.length > 1 ? 'normal' : 'italic'}, fs * SUB_DROP);
      back = fs * SUB_DROP;
    } else if ('sup' in r) { span(r.sup, {'font-size': fs * SUB_SCALE}, -back - fs * SUB_DROP * 1.4); back = -fs * SUB_DROP * 1.4; }
    else { span(r.t, {}, -back); back = 0; }
  }
  return t;
}
// A haloed figure label (stext with a white outline, so a line behind it does not strike it through).
function label(x, y, str, o) { const t = stext(x, y, str, o); for (const k in HALO) t.setAttribute(k, HALO[k]); return t; }
// Arrow from (x1, y1) to (x2, y2) added to g. o: dash, opacity, noHead.
function arrow(g, x1, y1, x2, y2, col, w, o = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), op = o.opacity === undefined ? 1 : o.opacity, len = Math.hypot(x2 - x1, y2 - y1);
  const head = Math.min(HEAD, len * 0.6), ln = {x1, y1, x2: x2 - Math.cos(a) * head * 0.6, y2: y2 - Math.sin(a) * head * 0.6, stroke: col, 'stroke-width': w, opacity: op};
  if (o.dash) ln['stroke-dasharray'] = o.dash;
  g.append(sv('line', ln));
  if (len < 1 || o.noHead) return;
  const p = d => (x2 - head * Math.cos(a + d)) + ',' + (y2 - head * Math.sin(a + d));
  g.append(sv('path', {d: 'M' + x2 + ',' + y2 + ' L' + p(-0.4) + ' L' + p(0.4) + 'z', fill: col, opacity: op}));
}
// Button with a label and a click handler.
function button(text, cls, onClick, attrs) { const b = el('button', Object.assign({type: 'button', class: cls, text}, attrs || {})); b.addEventListener('click', onClick); return b; }
// Run fn now, then repeat while the button is held (press and hold). Keyboard activation runs fn once.
function holdButton(b, fn) {
  let t1 = null, t2 = null;
  const end = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', e => { if (e.button !== 0) return; fn(); end(); t1 = setTimeout(() => { t2 = setInterval(fn, HOLD_EVERY); }, HOLD_DELAY); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(ev, end);
  b.addEventListener('click', e => { if (e.detail === 0) fn(); });
}
// Clip the segment (x0, y0)–(x1, y1) to the frame b (Liang–Barsky). Returns {x, y, cut} with the drawable end, or null if all of it is outside.
function clip(x0, y0, x1, y1, b) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0, p = [-dx, dx, -dy, dy], q = [x0 - b.x, b.x + b.w - x0, y0 - b.y, b.y + b.h - y0];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < EPS) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
  }
  if (t0 > t1) return null;
  return {x0: x0 + t0 * dx, y0: y0 + t0 * dy, x: x0 + t1 * dx, y: y0 + t1 * dy, cut: t1 < 1 - EPS};
}

/* ═══ 5. STATE, HOLDS AND CHANGES ═══ */
const clone = s => JSON.parse(JSON.stringify(s));
let ST = clone(DEFAULT);
let D = null;                             // the present solution
let refusal = null;                       // the last refused change, said on screen until the next change
let ghosts = [];                          // solutions left behind by a Sweep (every 10 %)
// Fill G1's Q_1 and |E_A1| fields of st from its present solution, so a change of "set by" does not move the operating point.
function fillG1(st) { const d = solve(st); if (!d.ok) return; st.Q1 = d.Q[0]; st.E1 = mag(d.E[0]); const p = pfOf(d.P[0], d.Q[0]); if (d.P[0] > P_ZERO) { st.pf1 = Math.max(PF_MIN, p.pf); st.lag1 = d.Q[0] >= 0; } }
// The range of the quantity a Hold varies: {key, lo, hi, from, to, pm} (from → to is the Sweep's direction), or null in Free.
function holdRange(st) {
  const V = vph(st), m1 = mach(st, 0);
  if (st.hold === 'field') { const pm = pMax(st.E1, m1, V); return {key: 'P1', lo: 0, hi: Math.max(0, Math.min(st.PL, pm.P)), from: 0, to: Math.max(0, Math.min(st.PL, pm.P)), pm}; }
  if (st.hold === 'power') { const lo = eMin(st.P1, m1, V), hi = E_RANGE_TOP * eUnity(st.P1, m1, V); return {key: 'E1', lo, hi, from: hi, to: lo}; }
  if (st.hold === 'shift') return {key: 'P1', lo: 0, hi: st.PL, from: 0, to: st.PL};
  return null;
}
// Choose a Hold condition; the held quantity is locked at its present value.
function setHold(h) {
  stopSweep(); fillG1(ST); ST.hold = h;
  if (h === 'field' || h === 'power') ST.by = 'e';
  if (h === 'shift') ST.by = 'pf';
  clearSweep(); refusal = null; buildControls(); draw();
}
// Set G1 "by" pf, Q or |E_A1| (Free only).
function setBy(b) { fillG1(ST); ST.by = b; clearSweep(); refusal = null; buildControls(); draw(); }
// The words said when a change to key would put G1 past its pull-out limit at its held field.
function limitWords(key) {
  if (key === 'P1') return 'G1 at its pull-out limit for this field: P_1 stopped at ' + f2(ST.P1) + ' MW.';
  if (key === 'E1') return 'Not reachable at this P_1: |E_{A1}| stopped at ' + fV(ST.E1) + ' V, the least field that gives ' + f2(ST.P1) + ' MW.';
  return 'G1 at its pull-out limit for this field: that change was not made.';
}
// Set one numeric quantity of the state. If G1 cannot reach it, stop at the limit (bisection) and say so; nothing changes silently.
function setQty(key, v, keepGhosts) {
  const was = ST[key];
  ST[key] = v;
  if (solve(ST).ok) { refusal = null; }
  else {
    let ok = was, bad = v;
    for (let i = 0; i < SEEK_STEPS; i++) { const mid = (ok + bad) / 2; ST[key] = mid; if (solve(ST).ok) ok = mid; else bad = mid; }
    ST[key] = ok;
    refusal = limitWords(key);
  }
  if (!keepGhosts) clearSweep();
}
// Apply a change made by fn (to ratings, bus or switches); refuse it with a message if G1's held field could not then give P_1.
function change(fn) {
  const prev = clone(ST);
  fn(ST);
  if (!solve(ST).ok) { ST = prev; refusal = limitWords(''); } else refusal = null;
  clearSweep();
}
// Reset the Lab to the defaults.
function resetLab() { stopSweep(); ST = clone(DEFAULT); fillG1(ST); clearSweep(); refusal = null; buildControls(); draw(); }
// Put the Lab in state s (an Experiment's set-up).
function setLab(s) {
  stopSweep(); ST = clone(s);
  if (!(ST.E1 > 0)) { const base = Object.assign(clone(ST), {by: 'pf'}); fillG1(base); ST.E1 = base.E1; ST.Q1 = base.Q1; }   // a held field not given: G1's field at its pf set-up
  fillG1(ST); clearSweep(); refusal = null; buildControls(); draw(); }

/* ═══ 6. CONTROLS ═══ */
let syncs = [];                           // functions that copy the state to the controls
// One slider row: label, value chip, range input, − / + buttons and end labels. c: {label, aria, min(), max(), step, get, set, fmt, ends}.
// min and max may move (a Hold's range); the input's own ends are rounded out to whole steps so typed set-ups land exactly.
function slider(c) {
  const val = el('span', {class: 'val'}), inp = el('input', {type: 'range', step: c.step, 'aria-label': c.aria});
  const lo = () => c.min(), hi = () => c.max();
  const put = v => { stopSweep(); c.set(Math.min(hi(), Math.max(lo(), v)), v < lo() - EPS || v > hi() + EPS); draw(); };
  inp.addEventListener('input', () => put(Number(inp.value)));
  const dn = el('button', {type: 'button', class: 'btn fine', 'aria-label': 'Lower ' + c.aria, text: MINUS}), up = el('button', {type: 'button', class: 'btn fine', 'aria-label': 'Raise ' + c.aria, text: '+'});
  holdButton(dn, () => put(Math.round((c.get() - c.step) / c.step) * c.step)); holdButton(up, () => put(Math.round((c.get() + c.step) / c.step) * c.step));
  const head = el('div', {class: 'row'}, [rel('span', '', c.label), val, el('span', {class: 'fines'}, [dn, up])]), ends = el('div', {class: 'scale'}, [el('span'), el('span')]);
  const box = el('div', {class: 'ctlrow'}, [head, inp, ends]);
  return {box, sync() {
    const a = lo(), b = hi(), v = c.get(), t = c.fmt(v);
    inp.min = Math.floor(a / c.step + EPS) * c.step; inp.max = Math.ceil(b / c.step - EPS) * c.step; inp.value = v;
    inp.setAttribute('aria-valuetext', t); if (val.textContent !== t) val.textContent = t;
    ends.children[0].textContent = c.fmt(a); ends.children[1].textContent = c.fmt(b);
  }};
}
// A row showing a held (locked) value.
function fixedRow(name, get) { const v = el('span', {class: 'val'}); syncs.push(() => { v.textContent = get(); }); return el('div', {class: 'row'}, [rel('span', '', name), v]); }
// A two- or three-way switch. opts: [[value, text], …]; get/set the state value.
function seg(aria, opts, get, set) {
  const bs = opts.map(([v, t]) => { const b = button('', 'btn', () => { stopSweep(); set(v); }, {'aria-pressed': 'false'}); b.append(rich(t)); return b; });
  syncs.push(() => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(get() === opts[i][0]))));
  return el('div', {class: 'seg', role: 'group', 'aria-label': aria}, bs);
}
// A typed number field for the machines and bus. Invalid entries are refused with the cause and leave the Lab unchanged.
function numBox(aria, get, set, lim, msg) {
  const inp = el('input', {type: 'text', inputmode: 'decimal', maxlength: NUM_MAX_CHARS, 'aria-label': aria, autocomplete: 'off'});
  inp.addEventListener('change', () => {
    stopSweep();
    const raw = inp.value.trim(), v = Number(raw);
    let why = '';
    if (!NUMBER_FORM.test(raw)) why = aria + ': not a number. Type a value such as ' + get() + '.';
    else if (v < lim[0] || v > lim[1]) why = aria + ' must be from ' + lim[0] + ' to ' + lim[1] + '; ' + raw + ' was not used.';
    if (why) { inp.setAttribute('aria-invalid', 'true'); msg.textContent = why; inp.value = String(get()); return; }
    inp.removeAttribute('aria-invalid'); msg.textContent = '';
    change(s => set(s, v)); buildControls(); draw();
    if (refusal) msg.textContent = refusal;
  });
  syncs.push(() => { if (document.activeElement !== inp) inp.value = String(+get().toFixed(4)); });
  return inp;
}
// The machines-and-bus panel (typed values).
function machineBox() {
  const msg = el('p', {class: 'nmsg', role: 'status'});
  const vll = numBox('Bus V_LL (kV)', () => ST.VLL, (s, v) => { s.VLL = v; }, LIM.VLL, msg);
  const chk = el('input', {type: 'checkbox', id: 'ident'});
  chk.addEventListener('change', () => { stopSweep(); const on = chk.checked; change(s => { if (on) s.ident = true; else { s.ident = false; s.m[1] = clone(s.m[0]); } }); buildControls(); draw(); });
  syncs.push(() => { chk.checked = ST.ident; });
  const grid = el('div', {class: 'ngrid'}, [el('span'), el('span', {class: 'hd', text: 'G1'}), el('span', {class: 'hd', text: ST.ident ? 'G2 (= G1)' : 'G2'})]);
  for (const [key, name, unit] of [['S', 'Rating S', 'MVA'], ['R', 'R_A', 'Ω'], ['X', 'X_S', 'Ω']]) {
    grid.append(rel('span', '', name + ' (' + unit + ')'));
    for (let k = 0; k < 2; k++) {
      if (k === 1 && ST.ident) { const v = el('span', {class: 'val'}); syncs.push(() => { v.textContent = String(+ST.m[0][key].toFixed(4)); }); grid.append(v); continue; }
      grid.append(numBox('G' + (k + 1) + ' ' + name.replace('_', '') + ' (' + unit + ')', () => ST.m[k][key], (s, v) => { s.m[k][key] = v; }, LIM[key], msg));
    }
  }
  return el('details', {id: 'mach', class: 'grp'}, [el('summary', {text: 'Machines and bus'}),
    el('div', {class: 'ngrid'}, [rel('span', '', 'V_{LL} (kV)'), vll, el('span', {class: 'fixed', text: 'Y'})]),
    el('label', {class: 'chk', for: 'ident'}, [chk, 'Identical machines']), grid, msg,
    rel('p', 'fixed', 'Scales are fixed by the ratings and V_φ; they change only when one of these changes.')]);
}
// Build the controls for the present Hold and "set by".
function buildControls() {
  syncs = [];
  const open = $('mach') ? $('mach').open : false;
  const sel = el('select', {id: 'holdSel', 'aria-label': 'Hold condition on G1'});
  for (const [v, t] of [['free', '1. Free: set each input'], ['field', '2. Field held (|EA1|), vary P1'], ['power', '3. Power held (P1), vary |EA1|'], ['shift', '4. Load fixed, pf1 held: shift P']]) sel.append(el('option', {value: v, text: t}));
  sel.value = ST.hold; sel.addEventListener('change', () => setHold(sel.value));
  const kids = [el('label', {class: 'sel', for: 'holdSel', text: 'Hold on G1'}), sel];
  const R = () => holdRange(ST), PTOP = () => P_RANGE_TOP * (mach(ST, 0).S + mach(ST, 1).S);
  const sl = c => { const s = slider(c); syncs.push(s.sync); return s.box; };
  // Load.
  kids.push(el('div', {class: 'grp'}, [el('h4', {text: 'Load'}),
    sl({label: 'P_L', aria: 'load power', min: () => 0, max: PTOP, step: 0.01, get: () => ST.PL, set: v => setQty('PL', v), fmt: v => f2(v) + ' MW'}),
    sl({label: 'pf_L', aria: 'load power factor', min: () => PF_MIN, max: () => 1, step: 0.01, get: () => ST.pfL, set: v => setQty('pfL', v), fmt: v => v >= UNITY_PF ? 'unity' : num(v, 2)}),
    seg('Load lagging or leading', [[true, 'lag'], [false, 'lead']], () => ST.lagL, v => { change(s => { s.lagL = v; }); draw(); })]));
  // G1.
  const g1 = [el('h4', {text: 'G1 (G2 makes up the rest)'})];
  if (ST.hold === 'free') g1.push(rel('span', 'fixed', 'Set G1 by P_1 and:'), seg('Set G1 by', [['pf', 'pf_1'], ['q', 'Q_1'], ['e', '|E_{A1}|']], () => ST.by, setBy));
  const pMaxFn = () => ST.hold === 'free' ? PTOP() : R().hi;
  const pRow = {label: 'P_1', aria: 'G1 power', min: () => 0, max: pMaxFn, step: 0.01, get: () => ST.P1, set: (v, out) => { setQty('P1', v); if (out && ST.hold === 'field') refusal = limitWords('P1'); }, fmt: v => f2(v) + ' MW'};
  if (ST.hold === 'power') g1.push(fixedRow('P_1 held', () => f2(ST.P1) + ' MW')); else g1.push(sl(pRow));
  if (ST.by === 'pf') {
    if (ST.hold === 'shift') g1.push(fixedRow('pf_1 held', () => ST.pf1 >= UNITY_PF ? 'unity' : num(ST.pf1, 2) + (ST.lag1 ? ' lag' : ' lead')));
    else g1.push(sl({label: 'pf_1', aria: 'G1 power factor', min: () => PF_MIN, max: () => 1, step: 0.01, get: () => ST.pf1, set: v => setQty('pf1', v), fmt: v => v >= UNITY_PF ? 'unity' : num(v, 2)}),
      seg('G1 lagging or leading', [[true, 'lag'], [false, 'lead']], () => ST.lag1, v => { change(s => { s.lag1 = v; }); draw(); }));
  } else if (ST.by === 'q') {
    g1.push(sl({label: 'Q_1', aria: 'G1 reactive power', min: () => -mach(ST, 0).S, max: () => mach(ST, 0).S, step: 0.01, get: () => ST.Q1, set: v => setQty('Q1', v), fmt: v => f2(v) + ' Mvar'}));
  } else if (ST.hold === 'field') g1.push(fixedRow('|E_{A1}| held', () => fV(ST.E1) + ' V'));
  else {
    const V = () => vph(ST), m1 = () => mach(ST, 0);
    g1.push(sl({label: '|E_{A1}|', aria: 'G1 internal voltage', min: () => eMin(ST.P1, m1(), V()), max: () => Math.max(E_RANGE_TOP * eUnity(ST.P1, m1(), V()), ST.hold === 'power' ? 0 : ST.E1), step: 1,
      get: () => ST.E1, set: (v, out) => { setQty('E1', v); if (out && v < ST.E1) refusal = limitWords('E1'); }, fmt: v => fV(v) + ' V'}));
  }
  kids.push(el('div', {class: 'grp'}, g1));
  // Sweep and reset.
  const sw = button('▶ Sweep', 'btn pri grow', toggleSweep, {id: 'sweepBtn'});
  syncs.push(() => { sw.disabled = ST.hold === 'free'; sw.textContent = SW.on ? '❚❚ Pause' : reduced() ? 'Step ▶ (10 %)' : SW.r && !SW.done && SW.frac > 0 ? '▶ Resume sweep' : '▶ Sweep'; });
  kids.push(el('div', {class: 'row'}, [sw, button('Reset', 'btn', resetLab)]),
    rel('p', 'fixed', ST.hold === 'free' ? 'Choose a Hold (2, 3 or 4) to sweep.' : 'Sweep moves ' + {field: 'P_1', power: '|E_{A1}|', shift: 'P_1'}[ST.hold] + ' over its range and leaves a faint ghost every 10 %.'));
  kids.push(machineBox());
  $('ctl').replaceChildren(...kids);
  $('mach').open = open;
}

/* ═══ 7. CIRCUIT ═══ */
const CK = {y: 30, rail: 112, node: 330, x: [56, 604], srcR: 20, lead: 30, resW: 44, gap: 16, coilW: 64, loadW: 176, loadH: 46};   // geometry, user units (viewBox 660 × 138)
// Draw the circuit with the live currents: each machine is E_A behind R_A and jX_S, G2 mirrored, the load at the KCL node (ringed).
function drawCircuit(g, d) {
  const {y, rail, node} = CK, midY = (y + rail) / 2;
  g.append(sv('path', {d: `M${CK.x[0]} ${rail}H${CK.x[1]}`, stroke: C.ink, 'stroke-width': 1.6, fill: 'none'}));
  for (let k = 0; k < 2; k++) {
    const x0 = CK.x[k], dir = k ? -1 : 1, c = COL[k], r0 = x0 + dir * CK.lead, r1 = r0 + dir * CK.resW, l0 = r1 + dir * CK.gap, l1 = l0 + dir * CK.coilW, hump = CK.coilW / 4, m = d.m[k];
    let coil = `M${l0} ${y}`;
    for (let n = 0; n < 4; n++) coil += `a${hump / 2} ${hump / 2} 0 0 ${k ? 0 : 1} ${dir * hump} 0`;
    add(g, [sv('circle', {cx: x0, cy: midY, r: CK.srcR, fill: C.white, stroke: c, 'stroke-width': 2.4}), stext(x0, midY + 6, 'G' + (k + 1), {fill: c, weight: 700, anchor: 'middle'}),
      sv('path', {d: `M${x0} ${midY - CK.srcR}V${y}H${r0}M${x0} ${midY + CK.srcR}V${rail}M${r1} ${y}H${l0}M${l1} ${y}H${node}`, stroke: c, 'stroke-width': W_LINE, fill: 'none'}),
      sv('rect', {x: Math.min(r0, r1), y: y - 8, width: CK.resW, height: 16, fill: C.white, stroke: c, 'stroke-width': W_LINE}), stext((r0 + r1) / 2, y - 13, ohm(m.R) + ' Ω', {fill: C.mute, anchor: 'middle', size: FS_S}),
      sv('path', {d: coil, stroke: c, 'stroke-width': W_LINE, fill: 'none'}), stext((l0 + l1) / 2, y - 13, 'j' + ohm(m.X) + ' Ω', {fill: C.mute, anchor: 'middle', size: FS_S}),
      stext(x0 + dir * 30, midY + 12, 'E_{A' + (k + 1) + '}', {fill: c, weight: 700, anchor: k ? 'end' : 'start'}),
      stext(node - dir * 14, y + 20, k ? '← I_{A2} ' + polA(d.I[1]) + ' A' : 'I_{A1} ' + polA(d.I[0]) + ' A →', {fill: c, weight: 600, anchor: k ? 'start' : 'end', size: FS_S})]);
  }
  const by = y + 30;
  add(g, [sv('path', {d: `M${node} ${y}V${by}M${node} ${by + CK.loadH}V${rail}`, stroke: C.ink, 'stroke-width': 1.6}),
    sv('circle', {cx: node, cy: y, r: 9, fill: 'none', stroke: C.amber, 'stroke-width': 2.5}), sv('circle', {cx: node, cy: y, r: 4, fill: C.ink}),
    sv('rect', {x: node - CK.loadW / 2, y: by, width: CK.loadW, height: CK.loadH, rx: 6, fill: C.loadbg, stroke: C.load, 'stroke-width': W_LINE}),
    stext(node, by + 19, 'Load ' + f2(ST.PL) + ' MW, ' + pfTxt(ST.PL, d.QL), {fill: C.load, weight: 700, anchor: 'middle', size: FS_S}),
    stext(node, by + 38, 'I_L ' + polA(d.IL) + ' A ↓', {fill: C.load, weight: 600, anchor: 'middle', size: FS_S}),
    stext(node, rail + 19, 'KCL at the ringed node: I_{A1} + I_{A2} = I_L      V_φ = ' + fV(d.V) + ' V held', {fill: C.mute, anchor: 'middle', size: FS_S})]);
}

/* ═══ 8. PHASOR PANELS (currents and voltages are never drawn on one diagram) ═══ */
// Fixed scales: units per A (from the larger rated current) and units per V (from V_φ).
function scales(st) {
  const V = vph(st), Ir = Math.max(mach(st, 0).S, mach(st, 1).S) * MW / (3 * V);
  return {kI: CUR.reach / (CUR_REACH * Ir), kV: VOL.reach / (VOL_REACH * V), Ir, V};
}
// Draw a phasor arrow inside the panel frame; a phasor that runs off the frame is cut at the edge with an open marker. Returns true if cut.
function phasor(g, x0, y0, x1, y1, col, w, o = {}) {
  const c = clip(x0, y0, x1, y1, PB);
  if (!c) return true;
  arrow(g, c.x0, c.y0, c.x, c.y, col, w, Object.assign({}, o, {noHead: c.cut || o.noHead}));
  if (c.cut && !o.ghost) g.append(sv('circle', {cx: c.x, cy: c.y, r: 5, fill: C.white, stroke: col, 'stroke-width': 2}));
  return c.cut;
}
// A polyline through points (only the parts inside the frame are visible: the panel's clip path does that).
function poly(g, pts, col, dash, w) { if (pts.length > 1) g.append(sv('polyline', {points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), fill: 'none', stroke: col, 'stroke-width': w || W_FINE, 'stroke-dasharray': dash || DASH, 'clip-path': 'url(#' + g.dataset.clip + ')'})); }
// Solutions sampled across the present Hold's range (for the loci and the side plot). Each item: {v, d}.
function samples(n) {
  const r = holdRange(ST); if (!r || r.hi - r.lo < EPS) return [];
  const out = [], st = clone(ST);
  for (let i = 0; i <= n; i++) { st[r.key] = r.lo + (r.hi - r.lo) * i / n; const d = solve(st); if (d.ok) out.push({v: st[r.key], d}); }
  return out;
}
// Panel background, frame, clip path and title.
function panelBase(g, id, title) {
  g.replaceChildren();
  g.dataset.clip = id + 'Clip';
  add(g, [sv('clipPath', {id: id + 'Clip'}, sv('rect', {x: PB.x, y: PB.y, width: PB.w, height: PB.h, rx: 8})), sv('rect', {x: PB.x, y: PB.y, width: PB.w, height: PB.h, rx: 8, fill: C.panel, stroke: C.edge}),
    stext(PB.x + 8, PB.y + 19, title, {fill: C.mute, weight: 700, size: FS_S})]);
}
// Currents panel: I_L, then I_A1 and I_A2 tip to tail (KCL), V_φ as the reference direction, the locus of each tip, and ghosts.
function drawCurrents(g, d, sc, locus) {
  panelBase(g, 'curr', 'Currents: I_{A1} + I_{A2} = I_L');
  const pa = c => [CUR.ox + c[0] * sc.kI, CUR.oy - c[1] * sc.kI], O = [CUR.ox, CUR.oy];
  add(g, [sv('line', {x1: CUR.ox, y1: CUR.oy, x2: PB.x + PB.w - 4, y2: CUR.oy, stroke: C.v, 'stroke-width': 1, 'stroke-dasharray': DASH_FINE}),
    stext(PB.x + PB.w - 6, CUR.oy - 6, 'V_φ direction', {fill: C.v, anchor: 'end', size: FS_S})]);
  if (locus.length) { poly(g, locus.map(s => pa(s.d.I[0])), C.g1); poly(g, locus.map(s => pa(s.d.I[1])), C.g2); }
  for (const h of ghosts) { const a = pa(h.I[0]), b = pa(h.IL); phasor(g, O[0], O[1], a[0], a[1], C.g1, W_PART, {opacity: GHOST_OPACITY, ghost: true}); phasor(g, a[0], a[1], b[0], b[1], C.g2, W_PART, {opacity: GHOST_OPACITY, ghost: true}); }
  const tL = pa(d.IL), t1 = pa(d.I[0]), cut = [];
  if (phasor(g, O[0], O[1], tL[0], tL[1], C.load, W_PHASOR)) cut.push('I_L');
  if (phasor(g, O[0], O[1], t1[0], t1[1], C.g1, W_PHASOR)) cut.push('I_{A1}');
  if (phasor(g, t1[0], t1[1], tL[0], tL[1], C.g2, W_PHASOR)) cut.push('I_{A2}');
  const inF = p => [Math.min(PB.x + PB.w - 40, Math.max(PB.x + 6, p[0])), Math.min(PB.y + PB.h - 30, Math.max(PB.y + 36, p[1]))];
  const lL = inF([tL[0] + 6, tL[1] + (d.IL[1] <= 0 ? 18 : -8)]), l1 = inF([t1[0] - 6, t1[1] + (d.I[0][1] <= 0 ? -10 : 22)]), l2 = inF([(t1[0] + tL[0]) / 2 + 10, (t1[1] + tL[1]) / 2 + 4]);
  add(g, [label(lL[0], lL[1], 'I_L', {fill: C.load, weight: 700}), label(l1[0], l1[1], 'I_{A1}', {fill: C.g1, weight: 700, anchor: 'end'}), label(l2[0], l2[1], 'I_{A2}', {fill: C.g2, weight: 700})]);
  add(g, [stext(PB.x + 8, PB.y + PB.h - 10, 'Fixed scale (ratings): right edge = ' + fV((PB.x + PB.w - CUR.ox) / sc.kI) + ' A', {fill: C.mute, size: FS_S}),
    cut.length && label(PB.x + 8, PB.y + 40, cut.join(', ') + ' off the frame (fixed scale)', {fill: C.amber, weight: 700, size: FS_S})]);
}
// Voltages panel: V_φ, then for each machine I_A R_A and jX_S I_A ending at E_A; E_A cos δ projections (dashed), δ arcs, the loci, ghosts,
// and G1's constant-P line (Hold 3) or constant-|E_A1| arc (Hold 2).
function drawVoltages(g, d, sc, locus) {
  panelBase(g, 'volt', 'Voltages: E_{Ak} = V_φ + I_{Ak}(R_A + jX_S)');
  const pv = c => [VOL.ox + c[0] * sc.kV, VOL.oy - c[1] * sc.kV], O = [VOL.ox, VOL.oy], vt = pv([d.V, 0]);
  g.append(sv('line', {x1: PB.x, y1: VOL.oy, x2: PB.x + PB.w, y2: VOL.oy, stroke: C.grid, 'stroke-width': 1}));
  if (ST.hold === 'field') {          // the circle |E_A1| = constant: G1's tip moves on it as P_1 changes
    const r = ST.E1 * sc.kV;
    g.append(sv('circle', {cx: O[0], cy: O[1], r, fill: 'none', stroke: C.g1, 'stroke-width': W_FINE, 'stroke-dasharray': DASH_FINE, opacity: 0.6, 'clip-path': 'url(#voltClip)'}));
  }
  if (locus.length) { poly(g, locus.map(s => pv(s.d.E[0])), C.g1, DASH, ST.hold === 'field' || ST.hold === 'power' ? W_LINE : W_FINE); poly(g, locus.map(s => pv(s.d.E[1])), C.g2); }
  for (const h of ghosts) for (let k = 0; k < 2; k++) { const t = pv(h.E[k]); phasor(g, O[0], O[1], t[0], t[1], COL[k], W_PART, {opacity: GHOST_OPACITY, ghost: true}); }
  phasor(g, O[0], O[1], vt[0], vt[1], C.v, W_PHASOR);
  g.append(stext(O[0] + 4, O[1] + 20, 'V_φ ' + fV(d.V) + ' V (held)', {fill: C.v, weight: 600, size: FS_S}));
  const cut = [];
  d.E.forEach((E, k) => {
    const mid = pv(cadd([d.V, 0], [d.I[k][0] * d.m[k].R, d.I[k][1] * d.m[k].R])), t = pv(E), c = COL[k];
    phasor(g, vt[0], vt[1], mid[0], mid[1], c, W_PART, {noHead: true});
    phasor(g, mid[0], mid[1], t[0], t[1], c, W_PART, {dash: DASH_FINE});
    g.append(sv('line', {x1: t[0], y1: t[1], x2: t[0], y2: O[1], stroke: c, 'stroke-width': 1, 'stroke-dasharray': DASH_FINE, opacity: 0.8, 'clip-path': 'url(#voltClip)'}));
    if (phasor(g, O[0], O[1], t[0], t[1], c, W_PHASOR)) cut.push('E_{A' + (k + 1) + '}');
    const dl = ang(E) / DEG, r = DELTA_R[k];
    if (Math.abs(dl) > 0.02) {
      const ex = O[0] + r * Math.cos(dl), ey = O[1] - r * Math.sin(dl);
      g.append(sv('path', {d: `M${O[0] + r} ${O[1]}A${r} ${r} 0 0 ${dl > 0 ? 0 : 1} ${ex} ${ey}`, fill: 'none', stroke: c, 'stroke-width': 1.4}));
      g.append(label(O[0] + r * Math.cos(dl / 2) + 4, O[1] - r * Math.sin(dl / 2) + (k ? -2 : 12), 'δ_' + (k + 1), {fill: c, weight: 700, size: FS_S}));
    }
    const lp = [Math.min(PB.x + PB.w - 44, Math.max(PB.x + 50, t[0] + (k ? 8 : -8))), Math.min(PB.y + PB.h - 30, Math.max(PB.y + 40, t[1] + (k ? 18 : -8)))];
    g.append(label(lp[0], lp[1], 'E_{A' + (k + 1) + '}', {fill: c, weight: 700, anchor: k ? 'start' : 'end'}));
    const sx = (mid[0] + t[0]) / 2, sy = (mid[1] + t[1]) / 2;
    if (sx > PB.x + 60 && sx < PB.x + PB.w - 60 && sy > PB.y + 30 && sy < PB.y + PB.h - 30) g.append(label(sx + (k ? 6 : -6), sy + (k ? 14 : -4), 'jX_SI_{A' + (k + 1) + '}', {fill: c, size: FS_S, anchor: k ? 'start' : 'end'}));
  });
  const note = ST.hold === 'field' ? 'G1 tip on its |E_{A1}| circle (field held)' : ST.hold === 'power' ? 'G1 tip on its constant-P_1 line' : ST.hold === 'shift' ? 'Dashed: tip paths as P_1 moves' : 'Dashed drops: E_A cos δ on the V_φ axis';
  add(g, [stext(PB.x + 8, PB.y + PB.h - 10, note, {fill: C.mute, size: FS_S}), cut.length && label(PB.x + 8, PB.y + 40, cut.join(', ') + ' off the frame (fixed scale)', {fill: C.amber, weight: 700, size: FS_S})]);
}

/* ═══ 9. SIDE PLOT (per Hold) ═══ */
const PL_ = {x0: 72, x1: 318, y0: 30, y1: 172};   // plot box in the viewBox 380 × 222
// Axis ticks: a "nice" step for the span lo..hi with about n ticks.
function ticks(lo, hi, n) { const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw)), s = [1, 2, 2.5, 5, 10].map(f => f * p).find(f => f >= raw - EPS) || 10 * p; const out = []; for (let v = Math.ceil(lo / s - EPS) * s; v <= hi + EPS; v += s) out.push(+v.toFixed(10)); return out; }
// Draw the side plot of the present Hold from sampled solutions.
function drawPlot(g, d, sc) {
  g.replaceChildren();
  const B = PL_, smp = samples(PLOT_N);
  if (ST.hold === 'free' || !smp.length) {
    add(g, [sv('rect', {x: 4, y: 4, width: 372, height: 214, rx: 8, fill: C.panel, stroke: C.edge}), stext(190, 100, ST.hold === 'free' ? 'Choose a Hold on G1' : 'No range to plot', {anchor: 'middle', fill: C.mute, weight: 700}),
      stext(190, 124, ST.hold === 'free' ? 'to plot how both machines respond.' : 'at these settings.', {anchor: 'middle', fill: C.mute})]);
    return;
  }
  const r = holdRange(ST), Smax = Math.max(d.m[0].S, d.m[1].S);
  let xs, series, yr, ylab, xlab, xf, cur, right = null;
  if (ST.hold === 'power') {
    xlab = '|E_{A1}| (V)'; xf = fV; xs = [r.lo, r.hi]; yr = [0, CUR_REACH * sc.Ir]; ylab = '|I_A| (A)'; cur = ST.E1;
    series = [{col: C.g1, f: s => mag(s.d.I[0]), name: '|I_{A1}|'}, {col: C.g2, f: s => mag(s.d.I[1]), name: '|I_{A2}|'}];
  } else if (ST.hold === 'field') {
    xlab = 'P_1 (MW)'; xf = f2; xs = [0, ST.PL]; yr = [-Smax, Smax]; ylab = 'Q (Mvar)'; cur = ST.P1;
    series = [{col: C.g1, f: s => s.d.Q[0], name: 'Q_1'}, {col: C.g2, f: s => s.d.Q[1], name: 'Q_2'}];
    right = {f: s => ang(s.d.E[0]), r: [0, 90], name: 'δ_1 (°)', col: C.amber};
  } else {
    xlab = 'P_1 (MW)'; xf = f2; xs = [0, ST.PL]; yr = [0, VOL_REACH * sc.V]; ylab = '|E_A| (V)'; cur = ST.P1;
    series = [{col: C.g1, f: s => mag(s.d.E[0]), name: '|E_{A1}|'}, {col: C.g2, f: s => mag(s.d.E[1]), name: '|E_{A2}|'}];
  }
  if (xs[1] - xs[0] < EPS) xs[1] = xs[0] + 1;
  const X = v => B.x0 + (v - xs[0]) / (xs[1] - xs[0]) * (B.x1 - B.x0), Y = (v, rr) => B.y1 - (v - rr[0]) / (rr[1] - rr[0]) * (B.y1 - B.y0);
  const clipId = 'plotClip';
  add(g, [sv('clipPath', {id: clipId}, sv('rect', {x: B.x0, y: B.y0, width: B.x1 - B.x0, height: B.y1 - B.y0})), sv('rect', {x: B.x0, y: B.y0, width: B.x1 - B.x0, height: B.y1 - B.y0, fill: C.panel, stroke: C.edge})]);
  for (const t of ticks(yr[0], yr[1], 4)) add(g, [sv('line', {x1: B.x0, x2: B.x1, y1: Y(t, yr), y2: Y(t, yr), stroke: t === 0 ? C.mute : C.grid, 'stroke-width': 1}), stext(B.x0 - 4, Y(t, yr) + 5, ST.hold === 'field' ? f2(t).replace(/\.00$/, '') : fV(t), {anchor: 'end', size: FS_S, fill: C.mute})]);
  const xt = ticks(xs[0], xs[1], 3);
  for (const t of xt) add(g, [sv('line', {x1: X(t), x2: X(t), y1: B.y1, y2: B.y1 + 4, stroke: C.mute}), stext(X(t), B.y1 + 19, ST.hold === 'power' ? fV(t) : num(t, t % 1 ? 1 : 0), {anchor: 'middle', size: FS_S, fill: C.mute})]);
  add(g, [stext((B.x0 + B.x1) / 2, B.y1 + 40, xlab, {anchor: 'middle', size: FS_S}), stext(13, (B.y0 + B.y1) / 2, ylab, {anchor: 'middle', size: FS_S, rotate: -90})]);
  if (right) {
    for (const t of [0, 30, 60, 90]) g.append(stext(B.x1 + 4, Y(t, right.r) + 5, String(t), {size: FS_S, fill: right.col}));
    g.append(stext(370, (B.y0 + B.y1) / 2, right.name, {anchor: 'middle', size: FS_S, fill: right.col, rotate: 90}));
    g.append(sv('polyline', {points: smp.map(s => X(s.v).toFixed(1) + ',' + Y(right.f(s), right.r).toFixed(1)).join(' '), fill: 'none', stroke: right.col, 'stroke-width': W_LINE, 'stroke-dasharray': DASH, 'clip-path': 'url(#' + clipId + ')'}));
  }
  series.forEach((s, i) => {
    g.append(sv('polyline', {points: smp.map(p => X(p.v).toFixed(1) + ',' + Y(s.f(p), yr).toFixed(1)).join(' '), fill: 'none', stroke: s.col, 'stroke-width': W_CURVE, 'clip-path': 'url(#' + clipId + ')'}));
    const now = s.f({d}), y = Y(now, yr);
    if (y >= B.y0 && y <= B.y1) g.append(sv('circle', {cx: X(cur), cy: y, r: 5, fill: s.col, stroke: C.white, 'stroke-width': 1.5}));
    g.append(stext(B.x0 + 6 + i * 92, B.y0 - 9, s.name, {fill: s.col, weight: 700, size: FS_S}));
  });
  if (right) g.append(stext(B.x0 + 6 + 2 * 92, B.y0 - 9, 'δ_1', {fill: right.col, weight: 700, size: FS_S}));
  g.append(sv('line', {x1: X(cur), x2: X(cur), y1: B.y0, y2: B.y1, stroke: C.ink, 'stroke-width': 1, 'stroke-dasharray': DASH_FINE}));
  if (ST.hold === 'power') {           // G1's V-curve: its minimum is at unity pf
    const Eu = eUnity(ST.P1, d.m[0], d.V);
    if (Eu >= r.lo && Eu <= r.hi) { const y = Y(ST.P1 * MW / (3 * d.V), yr); add(g, [sv('circle', {cx: X(Eu), cy: y, r: 4, fill: 'none', stroke: C.g1, 'stroke-width': 2}), label(X(Eu), y + 20, 'pf_1 = 1', {anchor: 'middle', size: FS_S, fill: C.g1})]); }
  }
  if (ST.hold === 'field' && r.pm.P < ST.PL) g.append(label(X(r.pm.P) - 3, B.y0 + 18, 'pull-out', {anchor: 'end', size: FS_S, fill: C.amber, weight: 700}));
}

/* ═══ 10. SHARING BARS (signed) ═══ */
const BR = {x0: 100, x1: 400, rows: [8, 42], h: 26};   // bar area (viewBox 660 × 90); the sums are written right of x1
// Draw the P and Q sharing bars: G1's part from 0, then G2's part from there (a negative part runs back, drawn in the lower half).
function drawBars(g, d) {
  g.replaceChildren();
  const tot = d.m[0].S + d.m[1].S, lo = -0.5 * tot, hi = 1.3 * tot, X = v => BR.x0 + (v - lo) / (hi - lo) * (BR.x1 - BR.x0);
  g.append(sv('line', {x1: X(0), x2: X(0), y1: 4, y2: 72, stroke: C.ink, 'stroke-width': 1.4}));
  [['P', d.P, ST.PL, 'MW'], ['Q', d.Q, d.QL, 'Mvar']].forEach(([n, v, sum, u], r) => {
    const y = BR.rows[r], a = X(0), b = X(v[0]), c = X(v[0] + v[1]);
    g.append(stext(BR.x0 - 8, y + 19, n + ' (' + u + ')', {anchor: 'end', weight: 700}));
    g.append(sv('rect', {x: Math.min(a, b), y, width: Math.abs(b - a), height: BR.h / 2 + 3, fill: C.g1}));
    g.append(sv('rect', {x: Math.min(b, c), y: y + (v[1] < 0 ? BR.h / 2 + 3 : 0), width: Math.abs(c - b), height: v[1] < 0 ? BR.h / 2 - 3 : BR.h / 2 + 3, fill: C.g2}));
    g.append(sv('rect', {x: Math.min(a, c), y: y + BR.h / 2 + 6, width: Math.abs(c - a), height: 3, fill: C.load}));
    g.append(stext(BR.x1 + 8, y + 12, n + '_1 ' + f2(v[0]) + ' + ' + n + '_2 ' + f2(v[1]), {size: FS_S}));
    g.append(stext(BR.x1 + 8, y + 29, '= ' + f2(sum) + ' ' + u + ' (load)', {size: FS_S, fill: C.load, weight: 600}));
  });
  const key = sv('text', {x: 4, y: 87, 'font-size': FS_S}, [sv('tspan', {fill: C.g1}, '■ G1  '), sv('tspan', {fill: C.g2}, '■ G2  '), sv('tspan', {fill: C.load}, '▬ load')]);
  add(g, [stext(X(0), 87, '0', {anchor: 'middle', size: FS_S, fill: C.mute}), key]);
}

/* ═══ 11. READOUTS, WARNINGS AND STEPS ═══ */
// The readout table per machine (and the load).
function drawRead(d) {
  const t = $('read'), row = (name, cells, over) => el('tr', {}, [el('td', {}, rich(name))].concat(cells.map((c, i) => el('td', over && over[i] ? {class: 'over'} : {}, rich(c)))));
  const ec = d.E.map(E => mag(E) * Math.cos(ang(E) / DEG));
  t.replaceChildren(el('tr', {}, [el('th', {text: ''}), el('th', {class: 'g1', text: 'G1'}), el('th', {class: 'g2', text: 'G2'})]),
    row('P (MW)', [f2(d.P[0]), f2(d.P[1])], d.P.map(p => p < -P_ZERO)),
    row('Q (Mvar)', [f2(d.Q[0]), f2(d.Q[1])]),
    row('S (MVA)', [f2(d.S[0]), f2(d.S[1])], d.S.map((s, k) => s > d.m[k].S + OVER_MVA)),
    row('pf', [pfTxt(d.P[0], d.Q[0]), pfTxt(d.P[1], d.Q[1])]),
    row('I_A (A)', [polA(d.I[0]), polA(d.I[1])]),
    row('E_A∠δ (V)', [polV(d.E[0]), polV(d.E[1])]),
    row('E_A cos δ (V)', ec.map(e => fV(e) + (e > d.V + 0.5 ? ' >' : e < d.V - 0.5 ? ' <' : ' ='))));
  $('readNote').replaceChildren(rich('> or < compares E_A cos δ with V_φ = ' + fV(d.V) + ' V. Load ' + f2(ST.PL) + ' MW, ' + f2(d.QL) + ' Mvar; I_L ' + polA(d.IL) + ' A.'));
}
// Warnings and Q statements for both machines, the limit messages, and any refused change. Returns the boxes.
function warnBoxes(d) {
  const out = [], r = holdRange(ST);
  if (refusal) out.push(el('div', {class: 'limitbox'}, rich(refusal)));
  if (ST.hold === 'field' && r.pm.P < ST.PL && ST.P1 >= r.pm.P - LIMIT_TOL_P && !refusal) out.push(el('div', {class: 'limitbox'}, rich('G1 at its pull-out limit for this field: P_{max} = ' + f2(r.pm.P) + ' MW at δ_1 = ' + fD(r.pm.d) + '°. P_1 cannot rise further.')));
  if (ST.hold === 'power' && ST.E1 <= r.lo + LIMIT_TOL_E && !refusal) out.push(el('div', {class: 'limitbox'}, rich('Not reachable at this P_1 below |E_{A1}| = ' + fV(r.lo) + ' V: G1 at its pull-out limit (δ_1 = ' + fD(zOf(d.m[0]).th * DEG) + '°).')));
  d.S.forEach((s, k) => { if (s > d.m[k].S + OVER_MVA) out.push(el('div', {class: 'warnbox', text: 'G' + (k + 1) + ' above rating: ' + f2(s) + ' MVA > ' + f2(d.m[k].S) + ' MVA.'})); });
  d.P.forEach((p, k) => { if (p < -P_ZERO) out.push(el('div', {class: 'warnbox', text: 'G' + (k + 1) + ' motoring: reverse power (P = ' + f2(p) + ' MW).'})); });
  d.Q.forEach((q, k) => { if (Math.abs(q) >= Q_ZERO) out.push(el('p', {class: 'fixed', text: 'G' + (k + 1) + (q > 0 ? ' supplies Q (over-excited).' : ' absorbs Q (under-excited).')})); });
  return out;
}
// The Steps panel: the homework-style solution with the present numbers.
function drawSteps(d) {
  const V = d.V, m1 = d.m[0], m2 = d.m[1], st = [], z = (m) => '(' + ohm(m.R) + ' + j' + ohm(m.X) + ')';
  const pfL = ST.pfL >= UNITY_PF ? 'unity' : num(ST.pfL, 2) + (ST.lagL ? ' lag' : ' lead');
  st.push('V_φ = V_{LL} / √3 = ' + num(ST.VLL * KV, 0) + ' / √3 = ' + fV(V) + ' V, the reference (0°).');
  st.push(ST.pfL >= UNITY_PF ? 'Q_L = 0 (unity-pf load).' : 'Q_L = ' + (ST.lagL ? '' : MINUS) + 'P_L tan(cos⁻¹ pf_L) = ' + (ST.lagL ? '' : MINUS) + fk(ST.PL) + ' kW × tan(cos⁻¹ ' + num(ST.pfL, 2) + ') = ' + fk(d.QL) + ' kvar (' + pfL + ').');
  if (ST.by === 'pf') st.push(ST.pf1 >= UNITY_PF ? 'G1 at unity pf: Q_1 = 0.' : 'Q_1 = ' + (ST.lag1 ? '' : MINUS) + 'P_1 tan(cos⁻¹ pf_1) = ' + (ST.lag1 ? '' : MINUS) + fk(ST.P1) + ' × tan(cos⁻¹ ' + num(ST.pf1, 2) + ') = ' + fk(d.Q[0]) + ' kvar.');
  else if (ST.by === 'q') st.push('Q_1 = ' + fk(d.Q[0]) + ' kvar (set).');
  else {
    const f = atField(ST.P1, ST.E1, m1, V), {z: zz, th} = zOf(m1), pm = pMax(ST.E1, m1, V);
    st.push('|E_{A1}| = ' + fV(ST.E1) + ' V held. |Z_S| = ' + num(zz, 2) + ' Ω, θ_Z = ' + fD(th * DEG) + '°. cos(θ_Z − δ_1) = (P_1|Z_S|²/3V_φ + V_φR_A) / (|E_{A1}||Z_S|) = ' + num(f.k, 4) + ', so δ_1 = ' + fD(f.d * DEG) + '° (stable branch, below θ_Z).');
    st.push('Q_1 = 3V_φ[|E_{A1}|(X_S cos δ_1 − R_A sin δ_1) − V_φX_S] / |Z_S|² = ' + fk(d.Q[0]) + ' kvar.');
    st.push('At this field P_{max} = 3V_φ|E_{A1}|/|Z_S| − 3V_φ²R_A/|Z_S|² = ' + f2(pm.P) + ' MW (δ_1 = ' + fD(pm.d) + '°)' + (pm.P > ST.PL ? ', above P_L.' : '.'));
  }
  st.push('G2 makes up the rest: P_2 = P_L − P_1 = ' + fk(ST.PL) + ' − ' + fk(ST.P1) + ' = ' + fk(d.P[1]) + ' kW; Q_2 = Q_L − Q_1 = ' + fk(d.QL) + ' − ' + fk(d.Q[0]).replace(/^−/, '(−') + (d.Q[0] < 0 ? ')' : '') + ' = ' + fk(d.Q[1]) + ' kvar; S_2 = ' + fk(d.S[1]) + ' kVA, pf_2 = ' + pfTxt(d.P[1], d.Q[1]) + '.');
  st.push('I_L = (P_L − jQ_L) / 3V_φ = ' + polA(d.IL) + ' A;  I_{A1} = (P_1 − jQ_1) / 3V_φ = ' + polA(d.I[0]) + ' A.');
  st.push('KCL: I_{A2} = I_L − I_{A1} = ' + polA(d.I[1]) + ' A.');
  st.push('E_{A1} = V_φ + I_{A1}' + z(m1) + ' = ' + fV(V) + ' + (' + polA(d.I[0]) + ')' + z(m1) + ' = ' + polV(d.E[0]) + ' V, so δ_1 = ' + fD(ang(d.E[0])) + '°.');
  st.push('E_{A2} = V_φ + I_{A2}' + z(m2) + ' = ' + polV(d.E[1]) + ' V, so δ_2 = ' + fD(ang(d.E[1])) + '°.');
  const list = $('stepList');
  list.replaceChildren(...st.map(s => el('li', {}, rich(s))));
  const big = d.Q[0] > d.Q[1] + Q_ZERO ? 0 : d.Q[1] > d.Q[0] + Q_ZERO ? 1 : -1;
  if (big >= 0 && mag(d.E[big]) > mag(d.E[1 - big])) list.append(el('li', {class: 'note'}, rich('Gen ' + (big + 1) + ' carries more Q, so it needs the larger |E_A| (more field current).')));
}

/* ═══ 12. SWEEP ═══ */
const SW = {on: false, done: false, frac: 0, t0: 0, raf: 0, next: 0, r: null};   // frac: 0..1 along from → to; next: the next ghost mark; r: the range swept
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Forget a sweep and its ghosts (any change to the Lab other than the sweep itself).
function clearSweep() { ghosts = []; SW.r = null; SW.frac = 0; SW.next = 0; SW.done = false; }
// Stop a running sweep (the ghosts it left stay until the next change).
function stopSweep() { if (SW.on) { SW.on = false; cancelAnimationFrame(SW.raf); } }
// Put the swept quantity at fraction f of its range and leave a ghost at each 10 % mark passed.
function sweepTo(f) {
  const r = SW.r;
  SW.frac = Math.min(1, f);
  ST[r.key] = r.from + (r.to - r.from) * SW.frac;
  while (SW.next <= SW.frac + EPS) { const st = clone(ST); st[r.key] = r.from + (r.to - r.from) * SW.next; const d = solve(st); if (d.ok) ghosts.push(d); SW.next += GHOST_EVERY; }
  refusal = null;
}
// Sweep button: start, pause or resume the sweep (with reduced motion: one 10 % step per press, no animation).
function toggleSweep() {
  if (ST.hold === 'free') return;
  if (SW.on) { stopSweep(); draw(); return; }
  if (!SW.r || SW.done) {
    const r = holdRange(ST); if (r.hi - r.lo < EPS) return;
    clearSweep(); SW.r = r;
    if (reduced()) { sweepTo(0); draw(); return; }
  }
  if (reduced()) { sweepTo(SW.frac + GHOST_EVERY); if (SW.frac >= 1 - EPS) { SW.frac = 1; SW.done = true; } draw(); return; }
  SW.on = true; SW.t0 = performance.now() - SW.frac * SWEEP_MS;
  const loop = now => { if (!SW.on) return; sweepTo((now - SW.t0) / SWEEP_MS); if (SW.frac >= 1) { SW.on = false; SW.done = true; } draw(); if (SW.on) SW.raf = requestAnimationFrame(loop); };
  SW.raf = requestAnimationFrame(loop);
  draw();
}

/* ═══ 13. DRAW (one redraw per interaction or animation frame) ═══ */
function draw() {
  D = solve(ST);
  if (!D.ok) { ST = clone(DEFAULT); fillG1(ST); D = solve(ST); refusal = 'The settings could not be solved and the Lab was reset.'; }
  const sc = scales(ST), loc = ST.hold === 'free' ? [] : samples(LOCUS_N);
  $('circ').replaceChildren(); drawCircuit($('circ'), D);
  drawCurrents($('curr'), D, sc, loc);
  drawVoltages($('volt'), D, sc, loc);
  drawPlot($('plot'), D, sc);
  drawBars($('bars'), D);
  drawRead(D); drawSteps(D);
  $('warn').replaceChildren(...warnBoxes(D));
  syncs.forEach(f => f());
}

/* ═══ 14. EXPERIMENTS ═══ */
// Each: heading, task, the Lab state its button sets, the worksheet key, and the answer (computed from the model when shown).
const at = patch => Object.assign(clone(DEFAULT), patch);
const E2_FIELD = mag(solve(Object.assign(clone(DEFAULT), {E1: 1})).E[0]);   // V, the held |E_A1| of Experiment 2: the default point's field (10,403 V as printed)
// One solution of a set-up with changes.
const sol = (s, patch) => { const st = Object.assign(clone(s), patch); return solve(st); };
const EXPS = [
  {h: 'G1 to unity power factor', task: 'From the default, raise G1 to unity power factor (pf_1 = 1). Where does all the reactive power go, and what happens to |E_{A2}|?',
    setup: at({pf1: 1}), k: 'e1', ans: () => { const a = solve(DEFAULT), b = sol(DEFAULT, {pf1: 1});
      return 'Q_1 = 0, so G2 supplies all of Q_L: Q_2 = ' + f2(b.Q[1]) + ' Mvar, pf_2 = ' + pfTxt(b.P[1], b.Q[1]) + ', S_2 = ' + f2(b.S[1]) + ' MVA. I_{A1} = ' + polA(b.I[0]) + ' A, I_{A2} = ' + polA(b.I[1]) + ' A.\n'
        + 'E_{A1} falls to ' + polV(b.E[0]) + ' V and E_{A2} rises from ' + fV(mag(a.E[1])) + ' V to ' + polV(b.E[1]) + ' V: G2 needs more field current.'; }},
  {h: 'Hold G1\'s field, shift its power', task: 'Hold G1\'s field (|E_{A1}| = 10,403 V) and shift P_1 from 3 to 9 MW. Predict first: what happens to Q_1 and Q_2?',
    setup: at({hold: 'field', by: 'e', E1: E2_FIELD, P1: 3}), k: 'e2', ans: () => {
      const s = at({hold: 'field', by: 'e', E1: E2_FIELD}), r = [3, 6, 9].map(p => sol(s, {P1: p})), pm = pMax(E2_FIELD, DEFAULT.m[0], vph(DEFAULT));
      return r.map((d, i) => 'P_1 = ' + [3, 6, 9][i] + ' MW: Q_1 ' + f2(d.Q[0]) + ', Q_2 ' + f2(d.Q[1]) + ' Mvar, δ_1 ' + fD(ang(d.E[0])) + '°, E_{A2} ' + polV(d.E[1]) + ' V').join('\n')
        + '\nWith the field held, more P on G1 tips E_{A1} round its circle: δ_1 grows and Q_1 falls, so G2 must pick up the Q (and the P) G1 gives up. G1\'s P_{max} at this field is ' + f2(pm.P) + ' MW (δ_1 = ' + fD(pm.d) + '°), above P_L.'; }},
  {h: 'Hold G1\'s power, sweep its field', task: 'Hold P_1 = 6 MW and sweep G1\'s field. Find the |E_{A1}| for unity pf_1, the one that makes both machines run at the same pf, and where |I_{A1}| is smallest.',
    setup: at({hold: 'power', by: 'e', P1: 6}), k: 'e3', ans: () => {
      const V = vph(DEFAULT), m = DEFAULT.m[0], QL = qLoad(DEFAULT), Eu = eUnity(6, m, V), Eeq = mag(emf(current(6, QL * 6 / DEFAULT.PL, V), m, V));
      const s = at({hold: 'power', by: 'e', P1: 6}), u = sol(s, {E1: Eu}), q = sol(s, {E1: Eeq}), h = sol(s, {E1: 12000});
      return 'Unity pf_1 at |E_{A1}| = ' + fV(Eu) + ' V: |I_{A1}| = ' + fA(mag(u.I[0])) + ' A, its minimum (the bottom of G1\'s V-curve), and G2 carries all Q_L = ' + f2(u.Q[1]) + ' Mvar.\n'
        + 'Same pf on both at |E_{A1}| = ' + fV(Eeq) + ' V: both ' + pfTxt(q.P[0], q.Q[0]) + ', Q_1 = Q_2 = ' + f2(q.Q[0]) + ' Mvar, I_{A1} = I_{A2} = ' + polA(q.I[0]) + ' A.\n'
        + 'At 12,000 V: Q_1 ' + f2(h.Q[0]) + ', Q_2 ' + f2(h.Q[1]) + ' Mvar, I_{A2} ' + polA(h.I[1]) + ' A, E_{A2} ' + polV(h.E[1]) + ' V: as E_{A1} grows, E_{A2} shrinks.'; }},
  {h: 'A leading load', task: 'Change the load to 0.85 leading (G1 at 0.92 leading). Which way does Q flow? Which machine is more under-excited?',
    setup: at({lagL: false, lag1: false}), k: 'e4', ans: () => { const d = sol(DEFAULT, {lagL: false, lag1: false});
      return 'Q_L = ' + f2(d.QL) + ' Mvar: the load supplies Q, and both machines absorb it: Q_1 = ' + f2(d.Q[0]) + ', Q_2 = ' + f2(d.Q[1]) + ' Mvar (' + pfTxt(d.P[1], d.Q[1]) + '). I_{A2} = ' + polA(d.I[1]) + ' A.\n'
        + 'E_{A1} = ' + polV(d.E[0]) + ' V, E_{A2} = ' + polV(d.E[1]) + ' V: G2 absorbs more Q and has the smaller |E_A|, so it is the more under-excited.'; }},
  {h: 'A larger X_S on G2', task: 'Double G2\'s X_S (30 Ω), same P and Q split. What changes: the currents, E_{A2}, δ_2?',
    setup: at({ident: false, m: [{S: 10, R: 0.6, X: 15}, {S: 10, R: 0.6, X: 30}]}), k: 'e5', ans: () => {
      const a = solve(DEFAULT), b = solve(at({ident: false, m: [{S: 10, R: 0.6, X: 15}, {S: 10, R: 0.6, X: 30}]}));
      return 'The currents do not change: the bus voltage is held and the P and Q split is the same, so I_{A2} = ' + polA(b.I[1]) + ' A as before.\n'
        + 'E_{A2} = V_φ + I_{A2}(0.6 + j30) = ' + polV(b.E[1]) + ' V (was ' + polV(a.E[1]) + ' V): the larger jX_SI_{A2} needs more field and a larger δ_2.'; }}];
// Build the Experiments page: a card per experiment with Predict, Set up the Lab and Show answer.
function buildExp() {
  const host = $('cards');
  EXPS.forEach((e, n) => {
    const ans = el('p', {class: 'ans', hidden: ''});
    const show = button('Show answer', 'btn', () => { if (ans.hidden) setRich(ans, e.ans()); ans.toggleAttribute('hidden'); });
    host.append(el('section', {class: 'exp-card'}, [el('p', {class: 'num', text: 'Experiment ' + (n + 1)}), el('h3', {text: e.h}), rel('p', '', e.task),
      el('label', {}, ['Predict first', el('textarea', {'data-k': e.k + 'p', 'aria-label': 'Experiment ' + (n + 1) + ', your prediction'})]),
      el('div', {class: 'btns'}, [button('Set up the Lab', 'btn pri', () => { setLab(e.setup); setPage('lab'); }), show]),
      el('label', {}, ['What you found', el('textarea', {'data-k': e.k, 'aria-label': 'Experiment ' + (n + 1) + ', what you found'})]), ans]));
  });
}

/* ═══ 15. WORKSHEET (answers kept in this browser only; every stored value is validated before it is used) ═══ */
let SHEET = {};
let KEYS = [];
// Show the worksheet status (never silent).
function sheetMsg(t, bad) { const e = $('sheetStatus'); e.textContent = t; e.className = bad ? 'bad' : 'good'; }
// Load and validate the stored record: a plain object of known keys holding short strings.
function loadSheet() {
  KEYS = [...document.querySelectorAll('[data-k]')].map(e => e.dataset.k);
  let raw = null;
  try { raw = localStorage.getItem(SHEET_KEY); } catch (e) { sheetMsg('This browser will not store answers here. Use “Export my answers” before you close the page.', true); return; }
  if (raw === null) { sheetMsg('Answers are saved in this browser only.', false); return; }
  let rec; try { rec = JSON.parse(raw); } catch (e) { rec = null; }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { sheetMsg('A stored worksheet record was invalid and was not loaded.', true); return; }
  let dropped = 0;
  for (const k of Object.keys(rec)) { if (KEYS.includes(k) && typeof rec[k] === 'string' && rec[k].length <= SHEET_MAX) SHEET[k] = rec[k]; else dropped++; }
  sheetMsg(dropped ? dropped + ' stored entr' + (dropped === 1 ? 'y was' : 'ies were') + ' invalid and not loaded; the rest are restored.' : 'Answers restored from this browser.', dropped > 0);
  for (const e of document.querySelectorAll('[data-k]')) if (SHEET[e.dataset.k] !== undefined) e.value = SHEET[e.dataset.k];
}
// Save the worksheet; say so if the browser refuses.
function saveSheet() {
  try { localStorage.setItem(SHEET_KEY, JSON.stringify(SHEET)); sheetMsg('Saved in this browser.', false); }
  catch (e) { sheetMsg('Could not save in this browser. Use “Export my answers” before you close the page.', true); }
}
// Wire the worksheet: save on every entry, clear on request, export as a text file.
function wireSheet() {
  for (const e of document.querySelectorAll('[data-k]')) e.addEventListener('input', () => { SHEET[e.dataset.k] = String(e.value).slice(0, SHEET_MAX); saveSheet(); });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear every answer on this worksheet?')) return;
    SHEET = {}; for (const e of document.querySelectorAll('[data-k]')) e.value = '';
    try { localStorage.removeItem(SHEET_KEY); sheetMsg('Answers cleared.', false); } catch (e) { sheetMsg('Could not clear the stored copy in this browser.', true); }
  });
  $('exportBtn').addEventListener('click', () => {
    const lines = [document.title, 'Name: ' + (SHEET.name || ''), 'Section: ' + (SHEET.section || ''), 'Date: ' + (SHEET.date || ''), ''];
    for (const e of document.querySelectorAll('#sheet textarea[data-k]')) lines.push('[' + e.dataset.k + '] ' + e.getAttribute('aria-label'), '  ' + (SHEET[e.dataset.k] || '(blank)'));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain'})), a = el('a', {href: url, download: 'Phasor_Lab_answers.txt'});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); sheetMsg('Exported to Phasor_Lab_answers.txt.', false);
  });
}

/* ═══ 16. PAGES AND START ═══ */
// Show a page: 'lab' or 'exp'. Changing page stops a sweep.
function setPage(p) {
  stopSweep();
  $('lab').hidden = p !== 'lab'; $('page-exp').hidden = p !== 'exp';
  document.documentElement.className = p;
  for (const b of document.querySelectorAll('nav.tabs button')) b.setAttribute('aria-pressed', String(b.dataset.page === p));
  if (p === 'lab') draw();
}
for (const b of document.querySelectorAll('nav.tabs button')) b.addEventListener('click', () => setPage(b.dataset.page));
fillG1(ST);
buildControls(); buildExp(); wireSheet(); loadSheet();
setPage('lab');
}
