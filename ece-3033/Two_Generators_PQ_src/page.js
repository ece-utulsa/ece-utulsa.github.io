/* ═══ CONTENTS ═══
   1. CONSTANTS   2. MODEL   3. FORMAT   4. DOM HELPERS   5. HOUSE DIAGRAM   6. CIRCUIT AND PHASOR PANELS   7. ONE PHASOR DIAGRAM (Q)
   8. SLIDES   9. PLAYER   10. LAB   11. EXPERIMENTS   12. WORKSHEET   13. PAGES AND START */
'use strict';
{
/* ═══ 1. CONSTANTS ═══ */
const V_LL = 4160;                        // V, line-to-line terminal voltage (held)
const V_PH = V_LL / Math.sqrt(3);         // V, phase voltage, the phasor reference: 2,401.8
const S_RATED = 4;                        // MVA, rating of each unit
const R_A = 0.2, X_S = 4.5;               // Ω per phase, synchronous impedance Z_S = R_A + jX_S
const P_FL = 4, F_NL0 = 61.0, SD0 = 0.03; // MW, Hz, per unit: full-load power, default set point and speed droop of each governor
const S_P = P_FL / (F_NL0 - F_NL0 / (1 + SD0));   // MW/Hz, slope of each droop line: 2.2514
const P_LOAD = 5.0, PF_LOAD = 0.80;       // MW and lagging power factor of the lecture's load
const Q_PER_P = Math.tan(Math.acos(PF_LOAD));   // Mvar of load per MW at that power factor: 0.75
const F_60 = 60;                          // Hz, the target frequency
const SET_A = [61.244, 60.977];           // Hz, the set points that give 2.8 / 2.2 MW at 60 Hz (slide 2, slide 4, the Lab's start)
const P1_OP = 2.8, PF1_OP = 0.90;         // MW and lagging power factor of G1 at the operating point of slides 3 and 4
const Q1_OP = P1_OP * Math.tan(Math.acos(PF1_OP));   // Mvar, G1's reactive power there: 1.356
const Q1_MOVED = 2.5;                     // Mvar, G1's reactive power at the end of slide 4's animation
const L_HIGH = 7, L_LOW = 3;              // MW, the loads slide 1 moves to
const WORKED = {PL: 4.4, pfL: 0.85, P1: 2.4, pf1: 0.92};   // slide 5: load MW and lagging pf, G1's MW and lagging pf
const TURN = {PL: 5.6, pfL: 0.85, P1: 3.2, pf1: 0.95};     // Experiment 5: the same quantities of its own problem
const TURN_MAX_CHARS = 12;                // longest accepted entry in Experiment 5
const NUMBER_FORM = /^[+\-−]?(\d+\.?\d*|\.\d+)$/;   // a plain decimal number, optional sign
const UNITY_PF = 0.9995;                  // at or above this power factor a unit is written as "unity" and given Q = 0
const Q_ZERO = 0.005, P_ZERO = 0.005;     // Mvar and MW: below these a reactive power counts as zero, and a negative power as motoring
const OVER_MVA = 0.005;                   // MVA above the rating before the rating warning shows
const HZ_OK = 0.005;                      // Hz from 60.00 within which the slide-2 "at 60 Hz" tick shows
const FN_FINE = 0.001;                    // Hz, the − / + buttons of a set point (the slider moves in 0.01 Hz)
const ANIM_FROM = 0.15, ANIM_SPAN = 0.55; // an animated line moves its quantity between 15 % and 70 % of its clip
const WPM = 153;                          // reading pace used to time a line when the voice is off, words/min
const ROUND_TIE = 1e-9;                   // added (away from zero) before rounding, so a value on a half step always rounds the same way
const EPS = 1e-9;
const HOLD_DELAY = 400, HOLD_EVERY = 110; // ms, press-and-hold repeat of a − / + button
const SHEET_KEY = 'two-generators-pq-worksheet-v2';   // the only localStorage key this tool reads or writes
const SHEET_MAX = 4000;                   // longest stored answer (characters)
const MINUS = '−';                        // U+2212
const DEG = 180 / Math.PI;                // degrees per radian
const SVGNS = 'http://www.w3.org/2000/svg', MMLNS = 'http://www.w3.org/1998/Math/MathML';
const NBSP = ' ';                    // no-break space (MathML collapses ordinary spaces in text)
const FS = 16, FS_BIG = 17;               // figure text sizes, user units (16 units is at least 11 px at 1093 × 614 and 1024 × 768)
const SUB_SCALE = 0.75, SUB_DROP = 0.28;  // subscript size and drop, as fractions of the text size
const HEAD = 11;                          // arrow-head length, user units
const W_FINE = 1.3, W_LINE = 1.8, W_DROOP = 2.6, W_PHASOR = 2.8, W_WALL = 3, W_SEG = 9;   // stroke widths
const DASH = '7 5', DASH_FINE = '4 3', DASH_DOT = '2 4';   // dash patterns: droop ghost and constant-P lines, drop lines, the 60 Hz gridline
const C = {g1: '#1c5fd6', g2: '#b0127e', f: '#a84d00', load: '#18744a', v: '#A32D2D', ink: '#1b1f24', mute: '#55606b', tick: '#c8cfd5', grid: '#9aa4ad',
  amber: '#9a5b00', white: '#ffffff', panel: '#fafbfc', edge: '#dde3e8', loadbg: '#eef6f1'};
const HALO = {stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round'};   // keeps a label legible where a line crosses it
const SAY = __SAY__;                      // narration text: {slides: [[line, …] × 6], lab: [3], exp: [5]}
const CLIPS = __CLIPS__;                  // the same shape; one mp3 data URI per line (en-GB-SoniaNeural, −4 %)
// Equations, in the source form read by mathEl.
const EQ = {psum: 'P_1 + P_2 = P_{load}', qsum: 'Q_1 + Q_2 = Q_{load}', droop: 'P_k = s_P ( f_{\\t{nl},k} − f_{sys} )', kcl: 'I_{A1} + I_{A2} = I_L',
  fsys: 'f_{sys} = \\frac{s_P ( f_{\\t{nl},1} + f_{\\t{nl},2} ) − P_{load}}{2 s_P}', ea: 'E_{A k} = V_φ + I_{A k} Z_S',
  when60: 'f_{sys} = 60\\t{ Hz when}', rule: 'f_{\\t{nl},1} + f_{\\t{nl},2} = 120 + \\frac{P_{load}}{s_P}', rule60: '60\\t{ Hz: }f_{\\t{nl},1} + f_{\\t{nl},2} = 120 + \\frac{P_{load}}{s_P}',
  ia: 'I_A = \\frac{P}{3 V_φ \\t{ pf}} ∠ −θ', given: 's_P = 2.25\\t{ MW/Hz}\\t{   }f_{nl} = 61.00\\t{ Hz}', height: 'E_A sin δ ≈ X_S I_A cos θ ∝ P',
  qtot: 'Q_1 + Q_2 = Q_{load} = 3.75\\t{ Mvar}', p2: 'P_2 = P_{load} − P_1', q2: 'Q_2 = Q_{load} − Q_1', ia2: 'I_{A2} = I_L − I_{A1}', ea2: 'E_{A2} = V_φ + I_{A2} Z_S'};

/* ═══ 2. MODEL ═══ */
// Phasors are [real, imaginary] on V_φ. Armature current (A) of a unit or load giving P (MW) and Q (Mvar, lagging positive): I = (P − jQ) / 3V_φ.
function current(P, Q) { return [P * 1e6 / (3 * V_PH), -Q * 1e6 / (3 * V_PH)]; }
// Internal voltage (V) behind Z_S for armature current I: E_A = V_φ + I Z_S.
function internal(I) { return [V_PH + R_A * I[0] - X_S * I[1], X_S * I[0] + R_A * I[1]]; }
// Magnitude and angle (degrees) of a phasor.
function mag(c) { return Math.hypot(c[0], c[1]); }
function ang(c) { return Math.atan2(c[1], c[0]) * DEG; }
// Reactive power (Mvar) that goes with P (MW) at a lagging power factor; zero at unity.
function qOf(P, pf) { return pf >= UNITY_PF ? 0 : P * Math.tan(Math.acos(pf)); }
// Both units for a load PL (MW), QL (Mvar) when G1 gives P1 and Q1: G2 gives the rest, and its current is I_L − I_A1 (KCL).
function pair(PL, QL, P1, Q1) {
  const IL = current(PL, QL), I1 = current(P1, Q1), I2 = [IL[0] - I1[0], IL[1] - I1[1]], P = [P1, PL - P1], Q = [Q1, QL - Q1];
  return {IL, I: [I1, I2], E: [internal(I1), internal(I2)], P, Q, S: [Math.hypot(P[0], Q[0]), Math.hypot(P[1], Q[1])]};
}
// System frequency (Hz) and each unit's power (MW) for load L (MW) and set points fn (Hz): the two droop lines cross where the powers add to L.
function share(L, fn) { const f = (S_P * (fn[0] + fn[1]) - L) / (2 * S_P); return {f, P: [S_P * (fn[0] - f), S_P * (fn[1] - f)]}; }

/* ═══ 3. FORMAT ═══ */
// Number with d decimals, rounded half away from zero, with a true minus sign and no "−0".
function num(x, d) { const k = 10 ** d, r = Math.round(Math.abs(x) * k + ROUND_TIE) / k; return (x < 0 && r > 0 ? MINUS : '') + r.toFixed(d); }
// MW, Mvar, MVA and A to 0.1; Hz and power factor to 0.01; volts whole with a thousands comma.
function mw(x) { return num(x, 1); }
function hz(x) { return num(x, 2); }
function volts(x) { return Math.round(x).toLocaleString('en-US'); }
// A current or a voltage phasor as "431.8∠−25.8° A" or "3,741∠27.2° V".
function polA(c) { return num(mag(c), 1) + '∠' + num(ang(c), 1) + '° A'; }
function polV(c) { return volts(mag(c)) + '∠' + num(ang(c), 1) + '° V'; }
// Power factor of P and Q as "0.90 lag", "unity" or "0.95 lead".
function pfTxt(P, Q) { return Math.abs(Q) < Q_ZERO ? 'unity' : num(P / Math.hypot(P, Q), 2) + (Q > 0 ? ' lag' : ' lead'); }
// Narration text to caption markup: spoken symbol names become symbols.
function disp(t) { return t.replace(/\b([EI]) A([12])\b/g, '$1_{A$2}').replace(/\bI L\b/g, 'I_L').replace(/\bE A\b/g, 'E_A').replace(/\bQ 1\b/g, 'Q_1'); }

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
// Markup: *bold*, X_S or I_{F,nl} (subscript on the letter before it), ^2 (superscript).
function runs(str) {
  const out = [], rx = /\*|([A-Za-zφτωδ])_(\{[^}]*\}|[A-Za-z0-9φ])|\^(\{[^}]*\}|\d)/g;
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
// MathML from a compact source. Atoms: numbers, letters (single = italic variable, word = upright), _ and ^ scripts,
// \frac{a}{b}, \t{upright text}, ( … ) and | … | groups; every other character is an operator.
function mathEl(src) {
  const mm = (tag, kids, attrs) => { const e = document.createElementNS(MMLNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return add(e, kids); };
  let i = 0;
  const TIGHT = '∠°', BAR = {lspace: '0', rspace: '0', stretchy: 'false'};   // operators set without space around them
  const group = () => { i++; const r = seq('}'); i++; return r.length === 1 ? r[0] : mm('mrow', r); };
  const script = () => { if (src[i] === '{') return group(); const c = src[i++]; return /\d/.test(c) ? mm('mn', c) : mm('mi', c); };
  // Parse atoms up to a closing character (or the end of the source).
  function seq(close) {
    const out = [];
    let prevOp = true;                           // true at the start and after an operator: a sign then belongs to the number
    while (i < src.length && src[i] !== close) {
      const rest = src.slice(i);
      let node = null, m;
      if (src[i] === ' ') { i++; continue; }
      if (rest.startsWith('\\frac')) { i += 5; const n = group(), d = group(); node = mm('mfrac', [n, d]); }
      else if (rest.startsWith('\\t{')) { const end = src.indexOf('}', i); node = mm('mtext', src.slice(i + 3, end).replace(/ /g, NBSP)); i = end + 1; }
      else if ((m = /^[+−]?\d[\d,]*(?:\.\d+)?/.exec(rest)) && (prevOp || /\d/.test(rest[0]))) { node = mm('mn', m[0]); i += m[0].length; }
      else if ((m = /^[A-Za-z]+/.exec(rest))) {
        const w = rest[m[0].length] === '_' ? m[0][0] : m[0];
        node = mm('mi', w);
        i += w.length;
        if (w === 'sin' || w === 'cos') { out.push(node, mm('mspace', [], {width: '0.17em'})); prevOp = true; continue; }
      }
      else if (/[φδθτω]/.test(src[i])) node = mm('mi', src[i++]);
      else if (src[i] === '(') { i++; const inner = seq(')'); i++; node = mm('mrow', [mm('mo', '(')].concat(inner, [mm('mo', ')')])); }
      else if (src[i] === '|') { i++; const inner = seq('|'); i++; node = mm('mrow', [mm('mo', '|', BAR)].concat(inner, [mm('mo', '|', BAR)])); }
      else { const c = src[i++]; out.push(mm('mo', c, TIGHT.includes(c) ? BAR : {})); prevOp = c !== '°'; continue; }
      let sub = null, sup = null;
      if (src[i] === '_') { i++; sub = script(); }
      if (src[i] === '^') { i++; sup = script(); }
      if (sub && sup) node = mm('msubsup', [node, sub, sup]); else if (sub) node = mm('msub', [node, sub]); else if (sup) node = mm('msup', [node, sup]);
      out.push(node);
      prevOp = false;
    }
    return out;
  }
  return mm('math', seq(''), {displaystyle: 'true'});
}
// Arrow from (x1, y1) to (x2, y2) added to g.
function arrow(g, x1, y1, x2, y2, col, w, o = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), op_ = o.opacity === undefined ? 1 : o.opacity;
  const line = {x1, y1, x2: x2 - Math.cos(a) * HEAD * 0.6, y2: y2 - Math.sin(a) * HEAD * 0.6, stroke: col, 'stroke-width': w, opacity: op_};
  if (o.dash) line['stroke-dasharray'] = o.dash;
  const p = d => (x2 - HEAD * Math.cos(a + d)) + ',' + (y2 - HEAD * Math.sin(a + d));
  g.append(sv('line', line), sv('path', {d: 'M' + x2 + ',' + y2 + ' L' + p(-0.4) + ' L' + p(0.4) + 'z', fill: col, opacity: op_}));
}
// A haloed figure label (stext with a white outline, so a line behind it does not strike it through).
function label(x, y, str, o) { const t = stext(x, y, str, o); for (const k in HALO) t.setAttribute(k, HALO[k]); return t; }
// Button with a label and a click handler.
function button(text, cls, onClick) { const b = el('button', {type: 'button', class: cls, text}); b.addEventListener('click', onClick); return b; }
// Run fn now, then repeat while the button is held (press and hold). Keyboard activation runs fn once.
function holdButton(b, fn) {
  let t1 = null, t2 = null;
  const end = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', e => { if (e.button !== 0) return; fn(); end(); t1 = setTimeout(() => { t2 = setInterval(fn, HOLD_EVERY); }, HOLD_DELAY); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(ev, end);
  b.addEventListener('click', e => { if (e.detail === 0) fn(); });
}
// One slider row for a controls column: label, value chip, range input, optional − / + fine buttons and end labels.
// c: {label, aria, min, max, step, fine (step of the − / + buttons), ends: [left, right], get, set, fmt}. Returns {box, sync}.
function slider(c, onChange) {
  const val = el('span', {class: 'val'}), inp = el('input', {type: 'range', min: c.min, max: c.max, step: c.step, 'aria-label': c.aria});
  const put = v => { c.set(Math.min(c.max, Math.max(c.min, v))); onChange(); };
  inp.addEventListener('input', () => put(Number(inp.value)));
  const head = el('div', {class: 'row'}, [rel('span', '', c.label), val]), box = el('div', {class: 'ctlrow'}, [head, inp]);
  if (c.fine) {
    const dn = el('button', {type: 'button', class: 'btn fine', 'aria-label': 'Lower ' + c.aria + ' by ' + c.fine, text: MINUS}), up = el('button', {type: 'button', class: 'btn fine', 'aria-label': 'Raise ' + c.aria + ' by ' + c.fine, text: '+'});
    holdButton(dn, () => put(Math.round((c.get() - c.fine) / c.fine) * c.fine)); holdButton(up, () => put(Math.round((c.get() + c.fine) / c.fine) * c.fine));
    head.append(el('span', {class: 'fines'}, [dn, up]));
  }
  if (c.ends) box.append(el('div', {class: 'scale'}, c.ends.map(t => el('span', {text: t}))));
  return {box, sync() { const v = c.get(), t = c.fmt(v); inp.value = v; inp.setAttribute('aria-valuetext', t); if (val.textContent !== t) val.textContent = t; }};
}
// The rating and motoring warnings for both units: S (MVA) and P (MW) of each. Returns the warning boxes.
function warnings(S, P) {
  const out = [];
  S.forEach((s, k) => { if (s > S_RATED + OVER_MVA) out.push(el('div', {class: 'warnbox', text: 'G' + (k + 1) + ' is at ' + mw(s) + ' MVA, above its ' + S_RATED + ' MVA rating.'})); });
  P.forEach((p, k) => { if (p < -P_ZERO) out.push(el('div', {class: 'warnbox', text: 'G' + (k + 1) + ' is below 0 MW: it is motoring.'})); });
  return out;
}

/* ═══ 5. HOUSE DIAGRAM (slides 1 and 2, and the Lab). Fixed scales: 55 units per MW, 73 units per Hz. ═══ */
const LEGEND_ROW = 22;                    // units between the rows of a legend
const ROW_UP = FS + 10;                   // units one label is raised above another when two would otherwise meet
const HS = {x0: 70, pxMW: 55, yTop: 58, fTop: 62, pxHz: 73, fRoof: 62.2, fFloor: 57.5, tickLo: 58, tickHi: 62, labelW: 126, fLabelDx: 60};
// Draw the house diagram into g for state s: {L (MW), fn: [Hz, Hz], stage (0 = walls only, 1 = everything), ghost, hiSet, grid60}.
// Each wall is one unit's frequency axis; the walls stand one load apart. Returns the operating point {f, P}.
function drawHouse(g, s) {
  const r = share(s.L, s.fn), fy = f => HS.yTop + (HS.fTop - f) * HS.pxHz, floor = fy(HS.fFloor), roof = fy(HS.fRoof);
  const xr = HS.x0 + s.L * HS.pxMW, wallX = [HS.x0, xr], col = [C.g1, C.g2], put = (...kids) => add(g, kids);
  for (let k = 0; k < 2; k++) {
    const x = wallX[k];
    put(stext(x, roof - 27, 'G' + (k + 1), {fill: col[k], weight: 700, anchor: 'middle'}), stext(x, roof - 7, 'frequency', {fill: C.mute, anchor: 'middle'}));
    for (let f = HS.tickLo; f <= HS.tickHi; f++) {
      const y = fy(f), main = f === F_60;
      put(sv('path', {d: `M${k ? x - 8 : x} ${y}h8`, stroke: main ? C.mute : C.tick, 'stroke-width': main ? 1.6 : 1}),
        stext(k ? x + 6 : x - 6, y + 5, f + ' Hz', {fill: main ? C.ink : C.mute, weight: main ? 700 : 400, anchor: k ? 'start' : 'end'}));
    }
  }
  if (s.grid60) put(sv('path', {d: `M${HS.x0} ${fy(F_60)}H${xr}`, stroke: C.grid, 'stroke-width': 1, 'stroke-dasharray': DASH_DOT}));
  put(sv('path', {d: `M${HS.x0} ${floor}H${xr}`, stroke: C.ink, 'stroke-width': 2}),
    sv('path', {d: `M${HS.x0} ${floor + 28}H${xr}M${HS.x0} ${floor + 22}v12M${xr} ${floor + 22}v12`, stroke: C.load, 'stroke-width': 1.5, fill: 'none'}),
    stext((HS.x0 + xr) / 2, floor + 49, 'walls ' + mw(s.L) + ' MW apart', {fill: C.load, weight: 600, anchor: 'middle', size: FS_BIG}));
  if (s.stage >= 1) {
    const xc = HS.x0 + r.P[0] * HS.pxMW, yc = fy(r.f), xm = Math.min(xr, Math.max(HS.x0, xc));   // the crossing, and the same kept between the walls
    const line = (k, fn) => `M${wallX[k]} ${fy(fn)}L${wallX[1 - k]} ${fy(fn - s.L / S_P)}`;        // a droop line from its own wall to the other
    const ly = s.fn.map(f => fy(f) - 10), hi = ly[0] <= ly[1] ? 0 : 1;                           // baselines of the two set-point labels; hi is the upper one
    if (xr - HS.x0 < 2 * HS.labelW + 14 && Math.abs(ly[0] - ly[1]) < ROW_UP) {                   // walls close together: the labels would meet
      if (ly[1 - hi] - ROW_UP > roof + FS) ly[hi] = ly[1 - hi] - ROW_UP; else ly[1 - hi] = ly[hi] + ROW_UP;   // the upper one moves up; under the wall's caption, the lower one moves down
    }
    for (let k = 0; k < 2; k++) {
      if (s.ghost && Math.abs(s.fn[k] - F_NL0) > FN_FINE / 2) put(sv('path', {d: line(k, F_NL0), stroke: col[k], 'stroke-width': 1.6, 'stroke-dasharray': DASH, opacity: 0.5, fill: 'none'}));
      put(sv('path', {d: line(k, s.fn[k]), stroke: col[k], 'stroke-width': W_DROOP, fill: 'none'}), sv('circle', {cx: wallX[k], cy: fy(s.fn[k]), r: s.hiSet ? 8 : 5, fill: col[k]}),
        label(k ? xr - 10 : HS.x0 + 10, ly[k], 'f_{nl,' + (k + 1) + '} ' + hz(s.fn[k]) + ' Hz', {fill: col[k], anchor: k ? 'end' : 'start', weight: s.hiSet ? 700 : 400}));
    }
    put(sv('path', {d: `M${HS.x0} ${yc}H${xr + 6}`, stroke: C.f, 'stroke-width': 2, 'stroke-dasharray': DASH}),
      stext(xr + HS.fLabelDx, yc + 5, 'f_{sys} ' + hz(r.f) + ' Hz', {fill: C.f, weight: 700, size: FS_BIG}),
      sv('path', {d: `M${HS.x0} ${floor - 6}H${xm}`, stroke: C.g1, 'stroke-width': W_SEG}), sv('path', {d: `M${xm} ${floor - 6}H${xr}`, stroke: C.g2, 'stroke-width': W_SEG}),
      sv('circle', {cx: xc, cy: yc, r: 7, fill: C.white, stroke: C.f, 'stroke-width': 3}));
    // The two power labels sit over their floor spans; when a span is narrower than its label they go on two rows, kept between the walls.
    const two = xm - HS.x0 < HS.labelW || xr - xm < HS.labelW, half = HS.labelW / 2, mid = (HS.x0 + xr) / 2;
    const keep = x => xr - HS.x0 < HS.labelW ? mid : Math.min(xr - half, Math.max(HS.x0 + half, x));
    put(label(two ? keep((HS.x0 + xm) / 2) : (HS.x0 + xm) / 2, floor - 17 - (two ? ROW_UP : 0), 'P_1 = ' + mw(r.P[0]) + ' MW', {fill: C.g1, weight: 600, anchor: 'middle', size: FS_BIG}),
      label(two ? keep((xm + xr) / 2) : (xm + xr) / 2, floor - 17, 'P_2 = ' + mw(r.P[1]) + ' MW', {fill: C.g2, weight: 600, anchor: 'middle', size: FS_BIG}));
  }
  return r;
}

/* ═══ 6. CIRCUIT AND PHASOR PANELS (slides 3 and 5). Currents and voltages are never drawn on one diagram. ═══ */
const CK = {y: 50, rail: 138, node: 320, x: [70, 570], srcR: 20, lead: 40, resW: 50, gap: 20, coilW: 70, loadW: 132, loadH: 44};   // circuit geometry, user units
const PN = {y: 168, w: 308, h: 280, x: [6, 326], cur: {ox: 36, oy: 224, k: 0.28}, vol: {ox: 342, oy: 426, k: 0.055}};   // panels; scales in units per A and per V
// Draw the circuit: each unit is E_A behind 0.2 Ω and j4.5 Ω, G2 mirrored, the load at the node, one return rail. loadText names the load.
function drawCircuit(g, loadText) {
  const {y, rail, node} = CK, midY = (y + rail) / 2, col = [C.g1, C.g2];
  g.append(sv('path', {d: `M${CK.x[0]} ${rail}H${CK.x[1]}`, stroke: C.ink, 'stroke-width': 1.6, fill: 'none'}));
  for (let k = 0; k < 2; k++) {
    const x0 = CK.x[k], dir = k ? -1 : 1, c = col[k], r0 = x0 + dir * CK.lead, r1 = r0 + dir * CK.resW, l0 = r1 + dir * CK.gap, l1 = l0 + dir * CK.coilW, hump = CK.coilW / 4;
    let coil = `M${l0} ${y}`;
    for (let n = 0; n < 4; n++) coil += `a${hump / 2} ${hump / 2} 0 0 ${k ? 0 : 1} ${dir * hump} 0`;
    add(g, [sv('circle', {cx: x0, cy: midY, r: CK.srcR, fill: C.white, stroke: c, 'stroke-width': 2.4}), stext(x0, midY + 5, 'E_{A' + (k + 1) + '}', {fill: c, weight: 700, anchor: 'middle'}),
      sv('path', {d: `M${x0} ${midY - CK.srcR}V${y}H${r0}M${x0} ${midY + CK.srcR}V${rail}M${r1} ${y}H${l0}M${l1} ${y}H${node}`, stroke: c, 'stroke-width': W_LINE, fill: 'none'}),
      sv('rect', {x: Math.min(r0, r1), y: y - 9, width: CK.resW, height: 18, fill: C.white, stroke: c, 'stroke-width': W_LINE}), stext((r0 + r1) / 2, y - 16, R_A + ' Ω', {fill: C.mute, anchor: 'middle'}),
      sv('path', {d: coil, stroke: c, 'stroke-width': W_LINE, fill: 'none'}), stext((l0 + l1) / 2, y - 16, 'j' + X_S + ' Ω', {fill: C.mute, anchor: 'middle'}),
      stext(node - dir * 30, y + 21, k ? '← I_{A2}' : 'I_{A1} →', {fill: c, weight: 600, anchor: 'middle'})]);
  }
  add(g, [sv('circle', {cx: node, cy: y, r: 4.5, fill: C.ink}), sv('path', {d: `M${node} ${y}V${y + 28}M${node} ${y + 28 + CK.loadH}V${rail}`, stroke: C.ink, 'stroke-width': 1.6}),
    sv('rect', {x: node - CK.loadW / 2, y: y + 28, width: CK.loadW, height: CK.loadH, rx: 6, fill: C.loadbg, stroke: C.load, 'stroke-width': W_LINE}),
    stext(node, y + 46, 'Load', {fill: C.load, weight: 700, anchor: 'middle'}), stext(node, y + 64, loadText, {fill: C.load, anchor: 'middle'}),
    stext(node + CK.loadW / 2 + 8, y + 56, 'I_L ↓', {fill: C.load, weight: 600}), stext(node, rail + 19, 'KCL at the node: I_{A1} + I_{A2} = I_L', {fill: C.mute, anchor: 'middle'})]);
}
// Draw the currents panel (left) and the voltages panel (right) for the pair d. show: 0 nothing, 1 I_L, 2 + I_A1, 3 + I_A2 tip to tail, 4 + E_A1 and E_A2.
// Phasors carry their names; their values are listed in each panel's corner, clear of every phasor.
function drawPanels(g, d, show) {
  const A = PN.cur, V = PN.vol, pa = c => [A.ox + c[0] * A.k, A.oy - c[1] * A.k], pv = c => [V.ox + c[0] * V.k, V.oy - c[1] * V.k], vt = pv([V_PH, 0]);
  for (const x of PN.x) g.append(sv('rect', {x, y: PN.y, width: PN.w, height: PN.h, rx: 8, fill: C.panel, stroke: C.edge}));
  add(g, [stext(PN.x[0] + 10, PN.y + 20, 'Currents: I_{A1} + I_{A2} = I_L', {fill: C.mute, weight: 700}), stext(PN.x[1] + 10, PN.y + 20, 'Voltages: E_{Ak} = V_φ + I_{Ak}Z_S', {fill: C.mute, weight: 700}),
    sv('path', {d: `M${A.ox} ${A.oy}H300`, stroke: C.v, 'stroke-width': 1, 'stroke-dasharray': DASH_FINE}), stext(300, A.oy + 18, 'V_φ direction', {fill: C.v, anchor: 'end'})]);
  const tL = pa(d.IL), t1 = pa(d.I[0]), legend = (n, str, col) => g.append(stext(PN.x[0] + 10, PN.y + PN.h - 50 + n * LEGEND_ROW, str, {fill: col, weight: 600}));
  if (show >= 1) { arrow(g, A.ox, A.oy, tL[0], tL[1], C.load, W_PHASOR); g.append(label(tL[0] + 6, tL[1] + 16, 'I_L', {fill: C.load, weight: 700})); legend(0, 'I_L ' + polA(d.IL), C.load); }
  if (show >= 2) { arrow(g, A.ox, A.oy, t1[0], t1[1], C.g1, W_PHASOR); g.append(label((A.ox + t1[0]) / 2 + 6, (A.oy + t1[1]) / 2 - 9, 'I_{A1}', {fill: C.g1, weight: 700})); legend(1, 'I_{A1} ' + polA(d.I[0]), C.g1); }
  if (show >= 3) { arrow(g, t1[0], t1[1], tL[0], tL[1], C.g2, W_PHASOR); g.append(label((t1[0] + tL[0]) / 2 + 12, (t1[1] + tL[1]) / 2 + 2, 'I_{A2}', {fill: C.g2, weight: 700})); legend(2, 'I_{A2} ' + polA(d.I[1]), C.g2); }
  arrow(g, V.ox, V.oy, vt[0], vt[1], C.v, W_PHASOR);
  g.append(stext((V.ox + vt[0]) / 2, V.oy + 17, 'V_φ = ' + volts(V_PH) + ' V', {fill: C.v, weight: 600, anchor: 'middle'}));
  if (show >= 4) d.E.forEach((E, k) => {
    const t = pv(E), c = k ? C.g2 : C.g1;
    g.append(sv('path', {d: `M${vt[0]} ${vt[1]}L${t[0]} ${t[1]}`, stroke: c, 'stroke-width': 1.2, 'stroke-dasharray': DASH_FINE}));
    arrow(g, V.ox, V.oy, t[0], t[1], c, W_PHASOR);
    // E_A1 is named up and to the left of its tip; E_A2 down and to the right of its own, beyond its drop line.
    add(g, [k ? label(Math.min(t[0] + 6, PN.x[1] + PN.w - 38), t[1] + 19, 'E_{A2}', {fill: c, weight: 700}) : label(t[0] - 6, t[1] - 9, 'E_{A1}', {fill: c, weight: 700, anchor: 'end'}),
      stext(PN.x[1] + 10, PN.y + 44 + k * LEGEND_ROW, 'E_{A' + (k + 1) + '} ' + polV(E), {fill: c, weight: 600})]);
  });
}

/* ═══ 7. ONE PHASOR DIAGRAM, BOTH UNITS (slide 4 and the Lab) ═══ */
const PQ4 = {ox: 40, oy: 372, k: 0.092, xEnd: 630, bar: [40, 410, 106.7]};      // slide 4: origin, units per V, right end of the constant-P lines, Q bar (x, y, units per Mvar)
const PQL = {ox: 30, oy: 330, k: 0.062, xEnd: 548, bar: [30, 384, 78]};         // the Lab's copy (viewBox 560 × 430; a smaller scale, because the Lab's fields reach further)
const Q_LINE_FROM = -1;                   // Mvar, where each constant-P line starts (left end)
const LINE_LABEL_UP = 13, LINE_LABEL_DOWN = 19;   // a constant-P line is labelled at its right end: above it for the higher line, below it for the lower
const BAR_H = 22, BAR_TEXT_W = 58;        // Q bar height, and the least width of a part that still carries its label
// Draw both internal voltages with V_φ held, each unit's constant-P line (the path of its tip as its Q changes; R_A tilts it slightly),
// the names and values, and the bar that splits the load's Q between the units. d: the pair; o: geometry (PQ4 or PQL); ring: tips ringed.
function drawPQ(g, d, o, ring) {
  const pt = c => [o.ox + c[0] * o.k, o.oy - c[1] * o.k], vt = pt([V_PH, 0]), col = [C.g1, C.g2];
  d.P.forEach((P, k) => {
    const qEnd = ((o.xEnd - o.ox) / o.k - V_PH - R_A * P * 1e6 / (3 * V_PH)) * 3 * V_PH / (X_S * 1e6);     // Q (Mvar) at which the tip reaches x = xEnd
    const a = pt(internal(current(P, Q_LINE_FROM))), b = pt(internal(current(P, qEnd)));
    add(g, [sv('path', {d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, stroke: col[k], 'stroke-width': W_FINE, 'stroke-dasharray': DASH, opacity: 0.8}),
      label(b[0], b[1] + (P >= d.P[1 - k] && !(k && P === d.P[0]) ? -LINE_LABEL_UP : LINE_LABEL_DOWN), 'P_' + (k + 1) + ' = ' + mw(P) + ' MW line', {fill: col[k], anchor: 'end'})]);
  });
  arrow(g, o.ox, o.oy, vt[0], vt[1], C.v, W_PHASOR);
  g.append(stext(o.ox + 4, o.oy + 19, 'V_φ = ' + volts(V_PH) + ' V (held)', {fill: C.v, weight: 600}));
  d.E.forEach((E, k) => {
    const t = pt(E);
    g.append(sv('path', {d: `M${vt[0]} ${vt[1]}L${t[0]} ${t[1]}`, stroke: col[k], 'stroke-width': 1.2, 'stroke-dasharray': DASH_FINE}));
    arrow(g, o.ox, o.oy, t[0], t[1], col[k], W_PHASOR);
    if (ring) g.append(sv('circle', {cx: t[0], cy: t[1], r: 8, fill: 'none', stroke: C.amber, 'stroke-width': 2.5}));
    add(g, [label(t[0] - 10, t[1] - 10, 'E_{A' + (k + 1) + '}', {fill: col[k], weight: 700, anchor: 'end'}),
      stext(o.ox - 24, 22 + k * LEGEND_ROW, 'E_{A' + (k + 1) + '} ' + polV(E) + '   pf ' + pfTxt(d.P[k], d.Q[k]), {fill: col[k], weight: 600})]);
  });
  const [x0, y0, kq] = o.bar, tot = d.Q[0] + d.Q[1], x1 = x0 + Math.min(Math.max(0, d.Q[0]), Math.max(0, tot)) * kq, x2 = x0 + Math.max(0, tot) * kq;
  add(g, [sv('rect', {x: x0, y: y0, width: x1 - x0, height: BAR_H, fill: C.g1}), sv('rect', {x: x1, y: y0, width: x2 - x1, height: BAR_H, fill: C.g2}),
    x1 - x0 >= BAR_TEXT_W && stext((x0 + x1) / 2, y0 + 16, 'Q_1 ' + mw(d.Q[0]), {fill: C.white, weight: 700, anchor: 'middle'}),
    x2 - x1 >= BAR_TEXT_W && stext((x1 + x2) / 2, y0 + 16, 'Q_2 ' + mw(d.Q[1]), {fill: C.white, weight: 700, anchor: 'middle'}),
    stext(x2 + 8, y0 + 16, num(tot, 2) + ' Mvar', {weight: 700})]);
}

/* ═══ 8. SLIDES ═══ */
// Lecture state. L load (MW); fn set points (Hz); stage 0 = walls only; ghost = dashed copy of a moved droop line; hiSet = set points
// emphasised; p1 (MW) and pf1 of G1 on slide 3; show = how much of slide 3 is built; q1 (Mvar) and ring on slide 4; row on slide 5; col on slide 6.
const T = {};
let si = 0, line = 0;                     // slide and narration line, zero-based
// Text line under a figure (rich text; cls 'lbl' for a plain note).
function below(str, cls) { const d = rel('div', cls || '', str); $('below').append(d); return d; }
// The slide-5 worked case and its step table: one row per narration line.
const CASE = pair(WORKED.PL, qOf(WORKED.PL, WORKED.pfL), WORKED.P1, qOf(WORKED.P1, WORKED.pf1));
const VT = volts(V_PH);                   // "2,402", the terminal phase voltage as printed
const STEPS = [
  ['1 Load', 'Q_{load} = ' + mw(WORKED.PL) + ' × tan(cos⁻¹ ' + num(WORKED.pfL, 2) + ') = ' + mw(CASE.Q[0] + CASE.Q[1]) + ' Mvar;  I_L = ' + mw(WORKED.PL) + ' MW / (3 × ' + VT + ' V × ' + num(WORKED.pfL, 2) + ') = ' + polA(CASE.IL)],
  ['2 G1', 'Q_1 = ' + mw(WORKED.P1) + ' × tan(cos⁻¹ ' + num(WORKED.pf1, 2) + ') = ' + mw(CASE.Q[0]) + ' Mvar;  I_{A1} = ' + polA(CASE.I[0])],
  ['3 G2 power', 'P_2 = ' + mw(WORKED.PL) + ' − ' + mw(WORKED.P1) + ' = ' + mw(CASE.P[1]) + ' MW;  Q_2 = ' + mw(CASE.Q[0] + CASE.Q[1]) + ' − ' + mw(CASE.Q[0]) + ' = ' + mw(CASE.Q[1]) + ' Mvar;  pf_2 = ' + pfTxt(CASE.P[1], CASE.Q[1])],
  ['4 G2 current', 'I_{A2} = I_L − I_{A1} = ' + polA(CASE.I[1])],
  ['5 G2 voltage', 'E_{A2} = ' + VT + ' + I_{A2} (' + R_A + ' + j' + X_S + ') = ' + polV(CASE.E[1])]];
const ROW_SHOWS = [0, 1, 2, 2, 3, 4];     // slide 5: how much of the panels is drawn once row n of the table is reached
const CARDS = [['psum', 'qsum'], ['droop', 'kcl'], ['fsys', 'ea'], ['rule60', 'ia'], ['given', 'height']];   // slide 6: [left, right] equation of each row
// The figures. Each draws into the svg group g and writes its lines under the figure.
function figHouse(g) {
  const r = drawHouse(g, Object.assign({grid60: si === 1}, T)), sp = num(S_P, 2);
  if (T.stage < 1) below('Each wall is one unit\'s frequency axis. The walls stand one load apart.', 'lbl');
  else if (si === 0) { below('f_{sys} = ' + hz(F_NL0) + ' − ' + mw(T.L) + ' / (2 × ' + sp + ') = ' + hz(r.f) + ' Hz'); below('P_1 = P_2 = ' + sp + ' × (' + hz(F_NL0) + ' − ' + hz(r.f) + ') = ' + mw(r.P[0]) + ' MW   sum ' + mw(r.P[0] + r.P[1]) + ' MW'); }
  else {
    below('f_{sys} = (' + sp + '·' + hz(T.fn[0]) + ' + ' + sp + '·' + hz(T.fn[1]) + ' − ' + mw(T.L) + ') / ' + num(2 * S_P, 2) + ' = ' + hz(r.f) + ' Hz');
    below('P_1 = ' + sp + '·(' + hz(T.fn[0]) + ' − ' + hz(r.f) + ') = ' + mw(r.P[0]) + ' MW · P_2 = ' + mw(r.P[1]) + ' MW');
    const d = below('f_{nl,1} + f_{nl,2} = ' + hz(T.fn[0] + T.fn[1]) + ' Hz (60 Hz: ' + hz(2 * F_60 + T.L / S_P) + ')');
    if (Math.abs(r.f - F_60) < HZ_OK) d.append(el('span', {class: 'ok', text: '  ✓ at 60 Hz'}));
  }
}
function figCurrents(g) {
  const d = pair(P_LOAD, P_LOAD * Q_PER_P, T.p1, qOf(T.p1, T.pf1));
  drawCircuit(g, mw(P_LOAD) + ' MW, ' + num(PF_LOAD, 2) + ' lag'); drawPanels(g, d, T.show);
  below('I_L = ' + mw(P_LOAD) + ' MW / (3 × ' + VT + ' V × ' + num(PF_LOAD, 2) + ') = ' + polA(d.IL));
  below('I_{A1} = ' + mw(T.p1) + ' MW / (3 × ' + VT + ' V × ' + num(T.pf1, 2) + ') = ' + polA(d.I[0]));
  below('G2: P_2 ' + mw(d.P[1]) + ' MW, Q_2 ' + mw(d.Q[1]) + ' Mvar, pf ' + pfTxt(d.P[1], d.Q[1]) + ', S_2 ' + mw(d.S[1]) + ' MVA');
  $('warn').replaceChildren(...warnings(d.S, d.P));
}
function figFields(g) {
  const d = pair(P_LOAD, P_LOAD * Q_PER_P, P1_OP, T.q1);
  drawPQ(g, d, PQ4, T.ring);
  below('Q_1 + Q_2 = ' + mw(d.Q[0]) + ' + ' + mw(d.Q[1]) + ' = ' + num(P_LOAD * Q_PER_P, 2) + ' Mvar (the load decides the total)');
  below('|E_{A1}| ' + volts(mag(d.E[0])) + ' V (pf ' + pfTxt(d.P[0], d.Q[0]) + ')   |E_{A2}| ' + volts(mag(d.E[1])) + ' V (pf ' + pfTxt(d.P[1], d.Q[1]) + ')');
  $('warn').replaceChildren(...warnings(d.S, d.P));
}
function figWorked(g) {
  drawCircuit(g, mw(WORKED.PL) + ' MW, ' + num(WORKED.pfL, 2) + ' lag'); drawPanels(g, CASE, ROW_SHOWS[T.row]);
  const tb = el('table', {class: 'steps'});
  STEPS.forEach((s, i) => tb.append(el('tr', {class: i + 1 > T.row ? 'wait' : i + 1 === T.row ? 'lit' : ''}, [el('td', {text: s[0]}), rel('td', '', s[1])])));
  $('below').append(tb);
}
function figKeys() {
  const grid = el('div', {class: 'eqgrid'});
  for (const [a, b] of CARDS) grid.append(el('div', {class: 'kcard' + (T.col === 1 || T.col === 3 ? ' on' : '')}, mathEl(EQ[a])), el('div', {class: 'kcard' + (T.col >= 2 ? ' on' : '')}, mathEl(EQ[b])));
  $('below').append(grid);
}
// The controls of each slide: slider definitions (see the slider function) and fixed notes.
const HZ_FMT = v => hz(v) + ' Hz';
const CTL_L = {label: 'Load P_{load}', aria: 'load power', min: L_LOW, max: L_HIGH, step: 0.1, ends: [mw(L_LOW), mw(L_HIGH) + ' MW'], get: () => T.L, set: v => { T.L = v; T.stage = 1; }, fmt: v => mw(v) + ' MW'};
const CTL_F = k => ({label: 'G' + (k + 1) + ' set point f_{nl,' + (k + 1) + '}', aria: 'G' + (k + 1) + ' set point', min: 60.5, max: 61.8, step: 0.01, fine: FN_FINE, get: () => T.fn[k], set: v => { T.fn[k] = v; }, fmt: HZ_FMT});
const CTL_P1 = {label: 'G1 power P_1', aria: 'G1 power', min: 2, max: 3.5, step: 0.05, get: () => T.p1, set: v => { T.p1 = v; T.show = 4; }, fmt: v => mw(v) + ' MW'};
const CTL_PF1 = {label: 'G1 power factor', aria: 'G1 power factor', min: 0.8, max: 1, step: 0.01, ends: ['0.80 lag', 'unity'], get: () => T.pf1, set: v => { T.pf1 = v; T.show = 4; }, fmt: v => v >= UNITY_PF ? 'unity' : num(v, 2) + ' lag'};
const CTL_Q1 = {label: 'Move Q: G2 → G1 (Q_1)', aria: 'G1 reactive power', min: 0.5, max: 3.25, step: 0.05, ends: ['0.50', '3.25 Mvar'], get: () => T.q1, set: v => { T.q1 = v; }, fmt: v => mw(v) + ' Mvar'};
// A fixed value row and a note for a controls column.
function fixedRow(name, value) { return el('div', {class: 'row'}, [rel('span', '', name), el('span', {class: 'val', text: value})]); }
function note(str) { return rel('p', 'fixed', str); }
// Each slide: eyebrow, title, key box, the two equation boxes (each a list of equation keys), paragraphs, small print, the state on entry (init),
// the narration lines (st: state set at the line's start; hl: which of key, eqA, eqB are lit; anim: [quantity, from, to] moved over the clip),
// the controls (a function returning nodes; sliders register themselves) and the figure.
const SL = [
  {eyebrow: 'NO INFINITE BUS', title: 'No infinite bus: the units set f and V themselves',
    key: 'The governor set points on the prime movers decide the frequency and the split of P. The field currents decide the terminal voltage and the split of Q.',
    eqs: [['psum', 'qsum'], ['droop']],
    text: ['*Set point f_{nl}:* the frequency a unit runs at with no load. *Droop slope s_P:* the extra power a unit gives for each hertz the frequency falls, ' + num(S_P, 2) + ' MW/Hz here.'], small: 'Slide 2: P. Slide 4: Q.',
    init: {L: P_LOAD, fn: [F_NL0, F_NL0], stage: 0, ghost: false, hiSet: false},
    lines: [{st: {}, hl: []}, {st: {}, hl: ['key', 'eqA']}, {st: {stage: 1}, hl: ['eqB']}, {st: {}, hl: [], anim: ['L', P_LOAD, L_HIGH]}, {st: {}, hl: [], anim: ['L', L_HIGH, L_LOW]}],
    ctl: use => [use(CTL_L), note('at ' + num(PF_LOAD, 2) + ' lagging'), fixedRow('G1 set point', HZ_FMT(F_NL0)), fixedRow('G2 set point', HZ_FMT(F_NL0)), note('Set points move on slide 2.')], draw: figHouse},
  {eyebrow: 'MOVING THE SET POINTS', title: 'Move one set point and both the split and the frequency move',
    key: 'To change the split and keep 60 Hz, move both set points: raise one and lower the other.',
    eqs: [['droop'], ['when60', 'rule']],
    text: ['The load is held at ' + mw(P_LOAD) + ' MW on this slide. A moved line leaves a faint dashed copy at ' + hz(F_NL0) + ' Hz.'],
    init: {L: P_LOAD, fn: [F_NL0, F_NL0], stage: 1, ghost: true, hiSet: false},
    lines: [{st: {hiSet: true}, hl: []}, {st: {hiSet: false}, hl: ['eqA'], anim: ['f1', F_NL0, SET_A[0]]}, {st: {}, hl: []}, {st: {}, hl: ['key']}, {st: {}, hl: [], anim: ['f2', F_NL0, SET_A[1]]}, {st: {}, hl: ['eqB']}],
    ctl: use => [use(CTL_F(0)), use(CTL_F(1)), el('div', {class: 'scale'}, [el('span', {text: '60.50'}), el('span', {text: '61.80 Hz'})]), note('− / + move a set point by ' + FN_FINE + ' Hz; values are shown to 0.01 Hz.'),
      note('Load fixed at ' + mw(P_LOAD) + ' MW, ' + num(PF_LOAD, 2) + ' lag.'), el('div', {class: 'row'}, button('Reset set points', 'btn grow', () => { stop(); T.fn = [F_NL0, F_NL0]; render(); }))], draw: figHouse},
  {eyebrow: 'THE CIRCUIT AND THE CURRENTS', title: 'The currents add at the node; each E_A follows its own current',
    key: 'The load fixes I_L. Set G1\'s current, and G2 must supply the rest.', eqs: [['kcl'], ['ea']],
    text: ['Both units: Z_S = ' + R_A + ' + j' + X_S + ' Ω. Terminal voltage V_φ = ' + VT + ' V, the reference. Load ' + mw(P_LOAD) + ' MW at ' + num(PF_LOAD, 2) + ' lag.'],
    init: {p1: P1_OP, pf1: PF1_OP, show: 0},
    lines: [{st: {}, hl: []}, {st: {}, hl: ['eqA']}, {st: {show: 1}, hl: []}, {st: {show: 2}, hl: []}, {st: {show: 3}, hl: ['key']}, {st: {show: 4}, hl: ['eqB']}, {st: {}, hl: [], anim: ['pf1', PF1_OP, 1]}],
    ctl: use => [use(CTL_P1), use(CTL_PF1), note('G2 follows by KCL: it supplies whatever G1 does not.'), el('div', {id: 'warn', role: 'status'})], draw: figCurrents},
  {eyebrow: 'THE FIELDS SHARE Q', title: 'The set points fix P; the fields share Q',
    key: 'Raise G1\'s field and lower G2\'s together: Q moves from G2 to G1, while P and the terminal voltage stay put.', eqs: [['qtot'], ['height']],
    text: ['Each tip\'s height is fixed by that unit\'s P, so a tip can only slide sideways. Longer E_A: more field current, more Q.'],
    init: {q1: Q1_OP, ring: false},
    lines: [{st: {}, hl: []}, {st: {ring: true}, hl: ['eqB']}, {st: {ring: false}, hl: ['eqA']}, {st: {}, hl: ['key'], anim: ['q1', Q1_OP, Q1_MOVED]}, {st: {}, hl: []}, {st: {}, hl: []}],
    ctl: use => [use(CTL_Q1), note('Right: raise G1\'s field, lower G2\'s.'), fixedRow('Real power (fixed)', mw(P1_OP) + ' · ' + mw(P_LOAD - P1_OP) + ' MW'), note('Set points from slide 2.'), el('div', {id: 'warn', role: 'status'})], draw: figFields},
  {eyebrow: 'WORKED CASE', title: 'G1\'s share is given: find everything about G2',
    key: 'Load ' + mw(WORKED.PL) + ' MW at ' + num(WORKED.pfL, 2) + ' lag. G1 carries ' + mw(WORKED.P1) + ' MW at ' + num(WORKED.pf1, 2) + ' lag. Find G2\'s P, Q, power factor, I_{A2} and E_{A2}.',
    eqs: [['p2', 'q2'], ['ia2', 'ea2']], text: [], small: 'Same machines: V_φ = ' + VT + ' V, Z_S = ' + R_A + ' + j' + X_S + ' Ω. Experiment 5 has a problem of your own.',
    init: {row: 0},
    lines: [{st: {row: 1}, hl: ['key']}, {st: {row: 2}, hl: []}, {st: {row: 3}, hl: ['eqA']}, {st: {row: 4}, hl: ['eqB']}, {st: {row: 5}, hl: []}],
    ctl: () => [note('No controls on this slide. Step through the lines.')], draw: figWorked},
  {eyebrow: 'KEY EQUATIONS', title: 'Key equations',
    key: 'The set points share P and set the frequency. The fields share Q and set the voltage. The load fixes both totals.', eqs: [],
    text: ['Left column: frequency and real power. Right column: currents, voltages and reactive power.'],
    init: {col: 0}, lines: [{st: {col: 1}, hl: []}, {st: {col: 2}, hl: []}, {st: {col: 3}, hl: ['key']}],
    ctl: () => [note('No controls on this slide.')], draw: figKeys}];
// Set an animated quantity.
function setQuantity(key, v) { if (key === 'f1') T.fn[0] = v; else if (key === 'f2') T.fn[1] = v; else T[key] = v; }
// Put the lecture state at fraction fr (0 to 1) of narration line i of the present slide: the slide's entry state, then every earlier
// line's state and finished animation, then this line's state and its animation as far as fr (smooth start and stop).
function stateAt(i, fr) {
  const S_ = SL[si];
  for (const k of Object.keys(T)) delete T[k];
  for (const [k, v] of Object.entries(S_.init)) T[k] = Array.isArray(v) ? v.slice() : v;
  S_.lines.slice(0, i + 1).forEach((ln, n) => {
    Object.assign(T, ln.st);
    if (!ln.anim) return;
    const u = n < i ? 1 : Math.min(1, Math.max(0, (fr - ANIM_FROM) / ANIM_SPAN)), e = fr >= 1 ? 1 : u * u * (3 - 2 * u);
    setQuantity(ln.anim[0], ln.anim[1] + (ln.anim[2] - ln.anim[1]) * e);
  });
}

/* ═══ 9. PLAYER ═══ */
let playing = false, voice = true;        // narration running; voice on (false = timed captions only)
let raf = 0, fitRaf = 0;                  // animation-frame handles (narration, caption fit)
let listenBtn = null;                     // the Lab or Experiments Listen button now playing, if any
let syncs = [];                           // the present slide's sliders: functions that copy the state to the controls
let page = 'lec';                         // 'lec', 'lab' or 'exp'
const player = new Audio();
// Draw the present slide: figure, the lines under it, the warnings and the slider positions. One call per interaction or animation frame.
function render() {
  const fig = $('fig'), keys = si === SL.length - 1;
  $('below').replaceChildren(); fig.replaceChildren();
  if (keys) fig.setAttribute('hidden', ''); else fig.removeAttribute('hidden');
  SL[si].draw(fig);
  syncs.forEach(f => f());
}
// Stop any narration and reset the play and Listen buttons.
function stop() {
  playing = false;
  cancelAnimationFrame(raf);
  player.onended = null; player.pause();
  $('play').textContent = '▶ Play narration';
  if (listenBtn) { listenBtn.textContent = listenBtn.dataset.listen; listenBtn = null; }
}
// Switch the voice on or off.
function setVoice(on) { voice = on; $('voice').textContent = on ? 'voice on' : 'voice off'; $('voice').setAttribute('aria-pressed', String(on)); }
// Play one clip (or time its text when the voice is off). The tick callback gets the time and the duration on every frame, and done runs at the end. If the browser refuses
// to play, the voice is switched off, every "voice could not start" notice is shown, and the line continues as a timed caption.
function playClip(clip, text, tick, done) {
  cancelAnimationFrame(raf);
  player.onended = null; player.pause();
  const finish = () => { cancelAnimationFrame(raf); player.onended = null; tick(1, 1); done(); };
  if (voice) {
    player.src = clip;
    player.onended = finish;
    player.play().catch(() => { if (!playing) return; setVoice(false); for (const m of document.querySelectorAll('.voiceMsg')) m.removeAttribute('hidden'); playClip(clip, text, tick, done); });
    const loop = () => { if (player.duration) tick(player.currentTime, player.duration); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  } else {
    const dur = text.split(/\s+/).length / WPM * 60, t0 = performance.now();      // seconds
    const loop = () => { const t = (performance.now() - t0) / 1000; if (t >= dur) { finish(); return; } tick(t, dur); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
}
// Advance the present lecture line to time t of dur: progress bar and the line's animated state.
function tick(t, dur) { $('bar').style.width = Math.min(100, t / dur * 100) + '%'; stateAt(line, Math.min(1, t / dur)); render(); }
// Show narration line i of the present slide at fraction fr of its clip (1 = its end state): caption, lit boxes, figure.
function showLine(i, fr) {
  line = Math.max(0, Math.min(SL[si].lines.length - 1, i));
  setRich($('cap'), disp(SAY.slides[si][line]));
  $('bar').style.width = '0';
  $('lineNo').textContent = 'line ' + (line + 1) + '/' + SL[si].lines.length;
  for (const id of ['key', 'eqA', 'eqB']) { const e = $(id); if (e) e.classList.toggle('on', SL[si].lines[line].hl.includes(id)); }
  stateAt(line, fr);
  render();
}
// Play the present line from its start, then the next, to the end of the slide.
function playLine() {
  playing = true;
  $('play').textContent = '❚❚ Pause';
  showLine(line, 0);
  playClip(CLIPS.slides[si][line], SAY.slides[si][line], tick, () => { if (line < SL[si].lines.length - 1) { line++; playLine(); } else stop(); });
}
// Go to line i from a control: narration stops and the line is shown in its end state.
function setLine(i) { stop(); showLine(i, 1); }
// Build the text column and the controls of slide i, and show its first line.
function setSlide(i) {
  stop();
  si = Math.max(0, Math.min(SL.length - 1, i));
  const S_ = SL[si], left = $('left');
  left.replaceChildren(el('p', {class: 'eyebrow', text: (si + 1) + ' OF ' + SL.length + ' · ' + S_.eyebrow}), rel('h2', '', S_.title), el('div', {class: 'key', id: 'key'}, rich(S_.key)));
  S_.eqs.forEach((keys, n) => left.append(el('div', {class: 'eq', id: n ? 'eqB' : 'eqA'}, keys.map(k => el('div', {}, mathEl(EQ[k]))))));
  for (const t of S_.text) left.append(rel('p', '', t));
  if (S_.small) left.append(rel('p', 'small', S_.small));
  left.scrollTop = 0;
  syncs = [];
  $('ctl').replaceChildren(...S_.ctl(c => { const s = slider(c, () => { stop(); render(); }); syncs.push(s.sync); return s.box; }));
  $('slPos').textContent = (si + 1) + '/' + SL.length;
  $('slPrev').disabled = si === 0; $('slNext').disabled = si === SL.length - 1;
  fitCaption();
  showLine(0, 1);
}
// Reserve caption height for the longest line of the present slide, so the figure does not resize between lines.
function fitCaption() {
  const cap = $('cap'), m = $('capMeasure');
  let h = 0;
  m.style.width = cap.clientWidth + 'px';
  for (const t of SAY.slides[si]) { setRich(m, disp(t)); h = Math.max(h, m.offsetHeight); }
  m.replaceChildren();
  cap.style.minHeight = h + 'px';
}
// Play Lab or Experiments lines in order from a Listen button. The say callback is told the line now spoken and the total, or null at the end.
function listen(btn, clips, texts, say) {
  if (playing) { const same = listenBtn === btn; stop(); say(null); if (same) return; }
  playing = true; listenBtn = btn; btn.textContent = '❚❚ Stop';
  let i = 0;
  const next = () => { if (i >= texts.length) { stop(); say(null); return; } say(i, texts.length); playClip(clips[i], texts[i++], () => {}, next); };
  next();
}

/* ═══ 10. LAB ═══ */
const LAB_START = {L: P_LOAD, fn: SET_A, q1: Q1_OP};   // the Lab's state on entry and after Reset
const LAB = {L: LAB_START.L, fn: LAB_START.fn.slice(), q1: LAB_START.q1};
const labSyncs = [];
// Draw the Lab: house diagram, phasor diagram, readouts and warnings from the Lab's own state.
function drawLab() {
  const gh = $('labHouse'), gp = $('labPQ');
  gh.replaceChildren(); gp.replaceChildren();
  const r = drawHouse(gh, {L: LAB.L, fn: LAB.fn, stage: 1, ghost: false, hiSet: false, grid60: true}), d = pair(LAB.L, LAB.L * Q_PER_P, r.P[0], LAB.q1);
  drawPQ(gp, d, PQL, false);
  const cell = (name, v) => el('div', {}, [rel('span', 'lbl', name + ' '), v]);
  $('labRead').replaceChildren(cell('f_{sys}', hz(r.f) + ' Hz'), cell('P_1 / P_2', mw(d.P[0]) + ' / ' + mw(d.P[1]) + ' MW'), cell('Q_1 / Q_2', mw(d.Q[0]) + ' / ' + mw(d.Q[1]) + ' Mvar'),
    cell('pf_1 / pf_2', pfTxt(d.P[0], d.Q[0]) + ' / ' + pfTxt(d.P[1], d.Q[1])), cell('|E_{A1}| / |E_{A2}|', volts(mag(d.E[0])) + ' / ' + volts(mag(d.E[1])) + ' V'), cell('S_1 / S_2', mw(d.S[0]) + ' / ' + mw(d.S[1]) + ' MVA'));
  $('labWarn').replaceChildren(...warnings(d.S, d.P));
  labSyncs.forEach(f => f());
}
// Put the Lab in state s ({L, fn, q1}) and draw it.
function setLab(s) { LAB.L = s.L; LAB.fn = s.fn.slice(); LAB.q1 = s.q1; drawLab(); }
// Build the Lab's controls once.
function buildLab() {
  const fK = k => ({label: 'G' + (k + 1) + ' set point', aria: 'G' + (k + 1) + ' set point', min: 60.5, max: 61.8, step: 0.01, fine: FN_FINE, get: () => LAB.fn[k], set: v => { LAB.fn[k] = v; }, fmt: HZ_FMT});
  const defs = [{label: 'Load P_{load} (' + num(PF_LOAD, 2) + ' lag)', aria: 'load power', min: L_LOW, max: L_HIGH, step: 0.1, get: () => LAB.L, set: v => { LAB.L = v; }, fmt: v => mw(v) + ' MW'}, fK(0), fK(1),
    {label: 'Q_1 (fields G2 → G1)', aria: 'G1 reactive power', min: 0, max: 5.25, step: 0.05, get: () => LAB.q1, set: v => { LAB.q1 = v; }, fmt: v => mw(v) + ' Mvar'}];
  const lb = button('▶ Listen', 'btn grow', () => listen(lb, CLIPS.lab, SAY.lab, (i, n) => { $('labNo').textContent = i === null ? '' : (i + 1) + '/' + n + (voice ? '' : ' (no voice)'); setRich($('labCap'), i === null ? '' : disp(SAY.lab[i])); }));
  lb.dataset.listen = '▶ Listen';
  $('labCtl').replaceChildren(...defs.map(c => { const s = slider(c, drawLab); labSyncs.push(s.sync); return s.box; }), note('− / + move a set point by ' + FN_FINE + ' Hz; values are shown to 0.01 Hz.'));
  $('labBtns').replaceChildren(button('Reset', 'btn grow', () => setLab(LAB_START)), lb);
}

/* ═══ 11. EXPERIMENTS ═══ */
// E1 to E4: heading, task, the Lab state its button sets, the worksheet key of its answer box, and the answer shown on request.
const Q_HALF = 6 * Q_PER_P / 2;           // Mvar, half the reactive power of the 6.0 MW load of E1 and E2
const EXPS = [
  {h: 'The load moves the frequency', task: 'Both set points at 61.00 Hz. Raise the load from 5.0 to 6.0 MW. Predict first: does f_{sys} rise or fall, and how is the extra megawatt shared? Then find f_{sys} and each unit\'s P.',
    setup: {L: 6, fn: [F_NL0, F_NL0], q1: Q_HALF}, k: 'e1', ans: () => { const r = share(6, [F_NL0, F_NL0]); return 'f_{sys} = ' + hz(F_NL0) + ' − 6.0 / (2 × ' + num(S_P, 2) + ') = ' + hz(r.f) + ' Hz. P_1 = P_2 = ' + mw(r.P[0]) + ' MW: identical droop lines share the change equally.'; }},
  {h: 'Back to 60 Hz', task: 'Load 6.0 MW. Find set points that give 60.00 Hz with the load shared equally. Use the 60 Hz rule, then check it in the Lab.',
    setup: {L: 6, fn: [F_NL0, F_NL0], q1: Q_HALF}, k: 'e2', ans: () => { const sum = 2 * F_60 + 6 / S_P; return 'f_{nl,1} + f_{nl,2} = 120 + 6.0 / ' + num(S_P, 2) + ' = ' + hz(sum) + ' Hz, so ' + hz(sum / 2) + ' Hz each (' + num(sum / 2, 3) + '). Each unit gives ' + mw(3) + ' MW at 60.00 Hz.'; }},
  {h: 'Equal power factors', task: 'Load 5.0 MW, set points 61.24 / 60.98 Hz (2.8 / 2.2 MW). Move Q until both units run at the same power factor. What is it, what is Q_1, and what is |E_{A1}|?',
    setup: {L: P_LOAD, fn: SET_A, q1: 1.0}, k: 'e3', ans: () => { const q = P1_OP * Q_PER_P, d = pair(P_LOAD, P_LOAD * Q_PER_P, P1_OP, q); return 'Both at ' + pfTxt(d.P[0], d.Q[0]) + ', the load\'s own power factor: Q_1 = ' + mw(P1_OP) + ' × ' + num(Q_PER_P, 2) + ' = ' + mw(q) + ' Mvar, Q_2 = ' + num(d.Q[1], 2) + ' Mvar. |E_{A1}| = ' + volts(mag(d.E[0])) + ' V.'; }},
  {h: 'The rating limits', task: 'Same set points. How far can you move Q toward G1 before G1 passes 4 MVA, and how far the other way before G2 does?',
    setup: {L: P_LOAD, fn: SET_A, q1: Q1_OP}, k: 'e4', ans: () => { const a = Math.sqrt(S_RATED ** 2 - P1_OP ** 2), b = Math.sqrt(S_RATED ** 2 - (P_LOAD - P1_OP) ** 2), lo = P_LOAD * Q_PER_P - b;
      return 'G1 reaches 4 MVA at Q_1 = √(4² − ' + mw(P1_OP) + '²) = ' + mw(a) + ' Mvar. G2 reaches 4 MVA at Q_2 = √(4² − ' + mw(P_LOAD - P1_OP) + '²) = ' + mw(b) + ' Mvar, that is Q_1 = ' + mw(lo) + ' Mvar. Q_1 must stay between ' + mw(lo) + ' and ' + mw(a) + ' Mvar.'; }}];
// Experiment 5 (the v1.2.0 "Your turn"): the model's answers rounded as v1.2.0 rounded them, the accepted error either side (wider than the
// display rounding, so a value typed as printed is accepted), and the step to check when one is wrong.
const E5 = pair(TURN.PL, qOf(TURN.PL, TURN.pfL), TURN.P1, qOf(TURN.P1, TURN.pf1));
const ANSWERS = [
  {k: 'e5p', name: 'P_2', unit: 'MW', val: +(E5.P[1]).toFixed(3), tol: 0.02, fix: 'P_2 = P_{load} − P_1.'},
  {k: 'e5qv', name: 'Q_2', unit: 'Mvar', val: +(E5.Q[1]).toFixed(3), tol: 0.05, fix: 'Q_2 = Q_{load} − Q_1, with Q_{load} = 5.6 tan(cos⁻¹ 0.85) and Q_1 = 3.2 tan(cos⁻¹ 0.95).'},
  {k: 'e5pf', name: 'pf_2', unit: 'lag', val: +(E5.P[1] / E5.S[1]).toFixed(3), tol: 0.01, fix: 'pf_2 = P_2 / √(P_2² + Q_2²).'},
  {k: 'e5i', name: '|I_{A2}|', unit: 'A', val: +(mag(E5.I[1])).toFixed(1), tol: 5, fix: '|I_{A2}| = S_2 / (3V_φ), or subtract the phasors: I_{A2} = I_L − I_{A1}.'},
  {k: 'e5e', name: '|E_{A2}|', unit: 'V', val: +(mag(E5.E[1])).toFixed(0), tol: 20, fix: 'E_{A2} = V_φ + I_{A2} (0.2 + j4.5), with I_{A2} at its lagging angle.'},
  {k: 'e5d', name: 'δ_2', unit: '°', val: +(ang(E5.E[1])).toFixed(2), tol: 0.5, fix: 'δ_2 is the angle of E_{A2} = V_φ + I_{A2} (0.2 + j4.5), measured from V_φ.'}];
// Show a message under the Experiment 5 boxes: kind 'good', 'bad' (refused or wrong) or 'mid' (hint).
function turnMsg(t, kind) { const e = $('turnMsg'); setRich(e, t); e.className = kind; }
// Read the six boxes. Returns six numbers, or null after naming the entries that were refused (nothing is checked then).
function readAnswers() {
  const vals = [], empty = [], bad = [];
  for (const a of ANSWERS) {
    const raw = a.box.value.trim(), ok = raw !== '' && raw.length <= TURN_MAX_CHARS && NUMBER_FORM.test(raw.replace(/,/g, ''));
    if (raw === '') empty.push(a.name); else if (!ok) bad.push(a.name);
    a.box.setAttribute('aria-invalid', String(!ok)); a.mark.textContent = '';
    vals.push(ok ? parseFloat(raw.replace(/,/g, '').replace(MINUS, '-')) : NaN);
  }
  if (empty.length || bad.length) { turnMsg((empty.length ? 'Fill in ' + empty.join(', ') + '. ' : '') + (bad.length ? 'Not a number: ' + bad.join(', ') + '. Type a value such as 2.1 or 480.' : ''), 'bad'); return null; }
  return vals;
}
// Check the six answers against the model, each within its own tolerance, and mark each box.
function checkAnswers() {
  const v = readAnswers();
  if (v === null) return;
  const ok = ANSWERS.map((a, i) => Math.abs(v[i] - a.val) <= a.tol + EPS), first = ok.indexOf(false);
  ANSWERS.forEach((a, i) => { a.mark.textContent = ok[i] ? '✓' : '✗'; a.mark.className = 'mark ' + (ok[i] ? 'y' : 'n'); });
  if (first < 0) { turnMsg('All six correct.', 'good'); showSolution(); } else turnMsg('Check ' + ANSWERS[first].name + ': ' + ANSWERS[first].fix, 'bad');
}
// Write the worked solution of Experiment 5.
function showSolution() {
  const box = $('sol');
  setRich(box, 'I_L = ' + polA(E5.IL) + ';  I_{A1} = ' + mw(TURN.P1) + ' MW / (3 × ' + VT + ' V × ' + num(TURN.pf1, 2) + ') = ' + polA(E5.I[0]) + '\n'
    + 'P_2 = ' + mw(E5.P[1]) + ' MW, Q_2 = ' + mw(E5.Q[1]) + ' Mvar (' + num(E5.Q[1], 3) + '), pf_2 = ' + pfTxt(E5.P[1], E5.Q[1]) + ';  I_{A2} = I_L − I_{A1} = ' + polA(E5.I[1]) + '\n'
    + 'E_{A2} = ' + VT + ' + I_{A2} (' + R_A + ' + j' + X_S + ') = ' + polV(E5.E[1]) + ', so δ_2 = ' + num(ang(E5.E[1]), 1) + '°');
  box.removeAttribute('hidden');
}
// Build the Experiments page: the four cards with their buttons and answer boxes, then Experiment 5.
function buildExp() {
  const host = $('cards'), listenTo = (btn, n) => listen(btn, [CLIPS.exp[n]], [SAY.exp[n]], () => {});
  const voiceMsg = () => el('p', {class: 'warn voiceMsg', role: 'status', hidden: '', text: 'The voice could not start in this browser. The Listen button reads the task text shown here.'});
  EXPS.forEach((e, n) => {
    const ans = rel('p', 'ans', e.ans()), li = button('▶ Listen', 'btn', () => listenTo(li, n));
    ans.setAttribute('hidden', ''); li.dataset.listen = '▶ Listen';
    host.append(el('section', {class: 'exp-card'}, [el('p', {class: 'num', text: 'Experiment ' + (n + 1)}), el('h3', {text: e.h}), rel('p', '', e.task),
      el('div', {class: 'btns'}, [button('Set up the Lab', 'btn pri', () => { setLab(e.setup); setPage('lab'); }), li, button('Show answer', 'btn', () => { ans.toggleAttribute('hidden'); })]), voiceMsg(),
      el('label', {}, ['Your prediction and answer', el('textarea', {'data-k': e.k, 'aria-label': 'Experiment ' + (n + 1) + ', your prediction and answer'})]), ans]));
  });
  const li = button('▶ Listen', 'btn', () => listenTo(li, EXPS.length)), grid = el('div', {class: 'grid6'});
  li.dataset.listen = '▶ Listen';
  for (const a of ANSWERS) {
    const id = 'in_' + a.k;
    a.box = el('input', {type: 'text', id, 'data-k': a.k, inputmode: 'decimal', maxlength: TURN_MAX_CHARS, autocomplete: 'off', 'aria-describedby': 'turnMsg'}); a.mark = el('span', {class: 'mark'});
    a.box.addEventListener('keydown', ev => { if (ev.key === 'Enter') checkAnswers(); });
    grid.append(el('label', {for: id}, rich(a.name + ' (' + a.unit + ')')), el('span', {}, [a.box, a.mark]));
  }
  host.append(el('section', {class: 'exp-card', id: 'e5'}, [el('p', {class: 'num', text: 'Experiment 5'}), el('h3', {text: 'Your turn'}),
    rel('p', '', 'The load is ' + mw(TURN.PL) + ' MW at ' + num(TURN.pfL, 2) + ' lagging, 4.16 kV. G1 carries ' + mw(TURN.P1) + ' MW at ' + num(TURN.pf1, 2) + ' lagging. Both units: V_φ = ' + num(V_PH, 1).replace(/(\d)(\d{3})\./, '$1,$2.') + ' V, Z_S = ' + R_A + ' + j' + X_S + ' Ω. Find G2\'s P, Q, power factor, I_{A2}, |E_{A2}| and δ_2.'),
    el('div', {class: 'btns'}, li), voiceMsg(),
    el('label', {}, [rich('Predict first: will G2 run at a higher or lower power factor than G1?'), el('textarea', {'data-k': 'e5q', 'aria-label': 'Experiment 5, your prediction'})]),
    grid, el('div', {class: 'btns'}, [button('Check', 'btn pri', checkAnswers), button('Hint', 'btn', () => turnMsg('Hint: G2 supplies what G1 does not. P_2 = 5.6 − 3.2 and Q_2 = Q_{load} − Q_1, with Q = P tan(cos⁻¹ pf). Then I_{A2} = (P_2 − jQ_2) / 3V_φ and E_{A2} = V_φ + I_{A2}Z_S.', 'mid')), button('Show solution', 'btn', showSolution)]),
    el('p', {id: 'turnMsg', role: 'status', 'aria-live': 'polite'}), el('div', {id: 'sol', hidden: ''})]));
}

/* ═══ 12. WORKSHEET (answers kept in this browser only; every stored value is validated before it is used) ═══ */
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
    for (const e of document.querySelectorAll('#sheet [data-k]')) { if (['name', 'section', 'date'].includes(e.dataset.k)) continue;
      const name = e.getAttribute('aria-label') || (e.labels && e.labels[0] ? 'Experiment 5, ' + e.labels[0].textContent : e.dataset.k);
      lines.push('[' + e.dataset.k + '] ' + name, '  ' + (SHEET[e.dataset.k] || '(blank)')); }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain'})), a = el('a', {href: url, download: 'Two_Generators_PQ_answers.txt'});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); sheetMsg('Exported to Two_Generators_PQ_answers.txt.', false);
  });
}

/* ═══ 13. PAGES AND START ═══ */
// Show a page: 'lec' (Lecture), 'lab' (Lab) or 'exp' (Experiments). Changing page stops any narration.
function setPage(p) {
  stop(); page = p;
  $('labNo').textContent = ''; $('labCap').replaceChildren();
  $('lec').hidden = p !== 'lec'; $('lab').hidden = p !== 'lab'; $('page-exp').hidden = p !== 'exp';
  document.documentElement.className = p;
  for (const b of document.querySelectorAll('nav.tabs button')) b.setAttribute('aria-pressed', String(b.dataset.page === p));
  if (p === 'lab') drawLab(); else if (p === 'lec') { fitCaption(); render(); }
}
for (const b of document.querySelectorAll('nav.tabs button')) b.addEventListener('click', () => setPage(b.dataset.page));
$('play').addEventListener('click', () => { if (playing) stop(); else playLine(); });
$('prev').addEventListener('click', () => { const p = playing; setLine(line - 1); if (p) playLine(); });
$('next').addEventListener('click', () => { const p = playing; setLine(line + 1); if (p) playLine(); });
$('slPrev').addEventListener('click', () => setSlide(si - 1));
$('slNext').addEventListener('click', () => setSlide(si + 1));
$('voice').addEventListener('click', () => { const p = playing && page === 'lec'; stop(); setVoice(!voice); for (const m of document.querySelectorAll('.voiceMsg')) m.setAttribute('hidden', ''); if (p) playLine(); });
window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => { if (page === 'lec') fitCaption(); }); });
buildLab(); buildExp(); wireSheet(); loadSheet();
setSlide(0);
}
