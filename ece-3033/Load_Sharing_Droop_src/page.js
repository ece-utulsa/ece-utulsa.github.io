/* ═══ CONTENTS ═══
   1. CONSTANTS   2. MODEL   3. FORMAT   4. DOM HELPERS   5. PLOT (axes, droop lines, legend, load bar)   6. THE THREE FIGURES
   7. SLIDES   8. PLAYER   9. LAB   10. EXPERIMENTS   11. WORKSHEET   12. PAGES AND START */
'use strict';
{
/* ═══ 1. CONSTANTS ═══ */
const P_FL = 100;                         // MW, rating (full load) of each unit
const F_60 = 60;                          // Hz, the infinite bus and the target frequency
const RPM_PER_HZ = 30;                    // r/min per Hz of a 4-pole machine (120 f / 4)
const UNITS = [{name: 'G1', fnl: 61.0, sd: 3.0}, {name: 'G2', fnl: 61.5, sd: 4.0}, {name: 'G3', fnl: 60.8, sd: 2.5}];   // base set points (Hz), speed droops (%)
const BASE_FN = UNITS.map(u => u.fnl), BASE_SD = UNITS.map(u => u.sd);
const SD_ANIM = 5.0, FN1_ANIM = 61.5;     // slide 1: the droop (%) and set point (Hz) its lines 5 and 6 move to and back from
const L1_TOP = 100;                       // MW, slide 1: the load its line 3 ramps to from 0
const AREA = 150;                         // MW, slide 2's area load (and the Lab's on the bus)
const FN2_UP = 61.421, FN2_DOWN = 59.8;   // Hz, slide 2's set points: 61.421 is shown as 61.42 and gives 80.0 MW; 59.80 gives reverse power
const L3 = 150, STEP = 60;                // MW, slide 3's load and its step
const L4 = 210, FN3_MOVED = 61.34;        // MW and Hz: slide 4's load and G3's new set point
const L5 = 180;                           // MW, slide 5's worked case
const L_TURN = 240;                       // MW, Experiments 2 and 5
const SD_E1 = 5.0;                        // %, G3's droop in Experiment 1
const TOL_F = 0.01, TOL_P = 0.5;          // Hz and MW accepted either side of the Experiment 5 answers
const TURN_MAX_CHARS = 12;                // longest accepted entry in Experiment 5
const NUMBER_FORM = /^[+\-−]?(\d+\.?\d*|\.\d+)$/;   // a plain decimal number, optional sign
const P_OUT = 0.05;                       // MW beyond 0 or 100 MW before a unit is flagged (half the displayed 0.1 MW)
const F_WARN = 0.5;                       // Hz from 60 beyond which the Lab says a set point must move
const HZ_OK = 0.005;                      // Hz from 60.00 within which "back at 60 Hz" shows
const FN_FINE = 0.001;                    // Hz, the − / + buttons of a set point (the slider moves in 0.01 Hz)
const ANIM_FROM = 0.15, ANIM_SPAN = 0.55; // an animated line moves its quantity between 15 % and 70 % of its clip
const WPM = 153;                          // reading pace used to time a line when the voice is off, words/min
const ROUND_TIE = 1e-9;                   // added (away from zero) before rounding, so a value on a half step always rounds the same way
const EPS = 1e-9;
const HOLD_DELAY = 400, HOLD_EVERY = 110; // ms, press-and-hold repeat of a − / + button
const SHEET_KEY = 'load-sharing-droop-worksheet-v2';   // the only localStorage key this tool reads or writes
const SHEET_MAX = 4000;                   // longest stored answer (characters)
const MINUS = '−';                        // U+2212
const SVGNS = 'http://www.w3.org/2000/svg', MMLNS = 'http://www.w3.org/1998/Math/MathML';
const NBSP = ' ';                    // no-break space (MathML collapses ordinary spaces in text)
const FS = 16, FS_BIG = 17;               // figure text sizes, user units (16 units is at least 11 px at 1093 × 614 and 1024 × 768)
const SUB_SCALE = 0.75, SUB_DROP = 0.28;  // subscript size and drop, as fractions of the text size
const HEAD = 9;                           // arrow-head length, user units
const W_LINE = 1.6, W_DROOP = 2.8, W_LIT = 4.6, W_BUS = 4;   // stroke widths: frames and arrows, droop lines, a lit droop line, the infinite bus
const DASH = '7 5', DASH_FINE = '3 4', DASH_DOT = '2 4';     // dash patterns: ghosts and f_sys, drop lines, the 60 Hz gridline
const COLS = ['#1c5fd6', '#b0127e', '#0f6e6c'];               // G1, G2, G3 (G3 teal, as v1.2.0)
const C = {f: '#a84d00', load: '#18744a', bus: '#b3261e', busBar: '#5b6770', ink: '#1b1f24', mute: '#55606b', tick: '#e3e7eb', grid: '#9aa4ad',
  amber: '#9a5b00', amberbg: '#fdf3e3', white: '#ffffff', edge: '#c9d0d6', err: '#9b1c1c', errbg: '#fdecea'};
const HALO = {stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round'};   // keeps a label legible where a line crosses it
const SAY = __SAY__;                      // narration text: {slides: [[line, …] × 6], lab: [3], exp: [5]}
const CLIPS = __CLIPS__;                  // the same shape; one mp3 data URI per line (en-GB-SoniaNeural, −4 %)
// Equations, in the source form read by mathEl.
const EQ = {sd: 'SD = \\frac{f_{nl} − f_{fl}}{f_{fl}} × 100\\,%', ffl: 'f_{fl} = \\frac{f_{nl}}{1 + SD}', sp: 's_P = \\frac{P_{fl}}{f_{nl} − f_{fl}}',
  pline: 'P = s_P ( f_{nl} − f_{sys} )', bus: 'P = s_P ( f_{nl} − 60\\,\\t{Hz} )', busload: 'P_{bus} = P_{area} − P_{G1}',
  psum: 'P_{load} = P_1 + P_2 + P_3', fsys: 'f_{sys} = \\frac{Σ s_{Pk} f_{nl,k} − P_{load}}{Σ s_{Pk}}', dp: 'ΔP_k = \\frac{s_{Pk}}{Σ s_{Pj}} ΔP_{load}',
  pk: 'P_k = s_{Pk} ( f_{nl,k} − f_{sys} )', pk60: 'P_k = s_{Pk} ( f_{nl,k} − 60\\,\\t{Hz} )', fn60: 'f_{nl,1} = 60\\,\\t{Hz} + \\frac{P_1}{s_{P1}}'};

/* ═══ 2. MODEL ═══ */
// Slope s_P (MW/Hz) of a unit with speed droop sd (%) at base set point fn0 (Hz): f_fl = fn0 / (1 + SD), s_P = P_fl / (fn0 − f_fl).
function slope(sd, fn0) { return P_FL / (fn0 - fn0 / (1 + sd / 100)); }
const SP0 = UNITS.map(u => slope(u.sd, u.fnl));   // MW/Hz, the base slopes: 56.28 / 42.28 / 67.43
// Units in parallel on an isolated load L (MW), set points fn (Hz), slopes sp (MW/Hz): the frequency where the outputs add up to L.
// Returns {f (Hz), P: [MW, …], S (Σ s_P, MW/Hz), SF (Σ s_Pk f_nl,k, MW)}.
function share(L, fn, sp) {
  const S = sp.reduce((a, s) => a + s, 0), SF = sp.reduce((a, s, k) => a + s * fn[k], 0), f = (SF - L) / S;
  return {f, P: sp.map((s, k) => s * (fn[k] - f)), S, SF};
}
// Power (MW) of a unit on the infinite bus: P = s_P (f_nl − 60).
function onBus(fn, sp) { return sp * (fn - F_60); }
// Slide 5: the set point of G1 (Hz) that restores 60 Hz at L5 with G2 and G3 left at their base set points.
const P_AT60 = SP0.map((s, k) => s * (BASE_FN[k] - F_60)), P1_NEED = L5 - P_AT60[1] - P_AT60[2], FN1_WORKED = F_60 + P1_NEED / SP0[0];

/* ═══ 3. FORMAT ═══ */
// Number with d decimals, rounded half away from zero, with a true minus sign and no "−0".
function num(x, d) { const k = 10 ** d, r = Math.round(Math.abs(x) * k + ROUND_TIE) / k; return (x < 0 && r > 0 ? MINUS : '') + r.toFixed(d); }
// MW and MW/Hz to 0.1; Hz to 0.01; droop to 0.1 %; shaft speed in whole r/min with a thousands comma; a change with its sign.
function mw(x) { return num(x, 1); }
function hz(x) { return num(x, 2); }
function pct(x) { return num(x, 1) + ' %'; }
function rpm(f) { return Math.round(f * RPM_PER_HZ).toLocaleString('en-US') + ' r/min'; }
// MW with a thousands comma: "10,133.1".
function mwk(x) { const [a, b] = mw(x).split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + b; }
function signed(x) { const t = mw(x); return t.startsWith(MINUS) ? t : '+' + t; }
// Sum of MW values written as "48.3 + 57.4 + 44.3".
function plus(list) { return list.map(mw).join(' + ').replace(/\+ −/g, '− '); }
// Narration text to caption markup: the spoken "s P" becomes s_P.
function disp(t) { return t.replace(/\bs P\b/g, 's_P'); }

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
      else if (rest.startsWith('\\,')) { node = mm('mspace', [], {width: '0.22em'}); i += 2; }
      else if (rest.startsWith('\\t{')) { const end = src.indexOf('}', i); node = mm('mtext', src.slice(i + 3, end).replace(/ /g, NBSP)); i = end + 1; }
      else if ((m = /^[+−]?\d[\d,]*(?:\.\d+)?/.exec(rest)) && (prevOp || /\d/.test(rest[0]))) { node = mm('mn', m[0]); i += m[0].length; }
      else if ((m = /^[A-Za-z]+/.exec(rest))) {
        const w = rest[m[0].length] === '_' ? m[0][0] : m[0];
        node = mm('mi', w);
        i += w.length;
        if (w === 'sin' || w === 'cos') { out.push(node, mm('mspace', [], {width: '0.17em'})); prevOp = true; continue; }
      }
      else if (/[φδθτωΔ]/.test(src[i])) node = mm('mi', src[i++]);
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
// Keep x within [lo, hi].
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
// Warning boxes for units outside 0 to 100 MW (P: MW of each; names: their names) and, when f is given, for a frequency far from 60 Hz.
function warnings(P, names, f) {
  const out = [], box = t => out.push(el('div', {class: 'warnbox', text: t}));
  P.forEach((p, k) => {
    if (p > P_FL + P_OUT) box(names[k] + ' is at ' + mw(p) + ' MW, above its ' + P_FL + ' MW rating.');
    if (p < -P_OUT) box(names[k] + ' is at ' + mw(p) + ' MW: reverse power. It would run as a motor.');
  });
  if (f !== undefined && Math.abs(f - F_60) > F_WARN) box('The system frequency is ' + hz(f) + ' Hz, more than ' + F_WARN + ' Hz from 60 Hz: a set point must move.');
  return out;
}

/* ═══ 5. PLOT: frequency against power. Fixed axes: f 58 to 62 Hz; P 0 to 120 MW (slide 1) or −20 to 120 MW. ═══ */
const F_LO = 58, F_HI = 62;               // Hz, the frequency axis (every plot)
const PX0 = 84;                           // left edge of every plot, user units
// Plot geometries (user units in the 640 × 452 viewBox): power axis (MW), right edge, top (62 Hz) and bottom (58 Hz); load bar top and full scale (MW).
const GEO = {one: {lo: 0, hi: 120, x1: 540, top: 118, bot: 380},
  bus: {lo: -20, hi: 120, x1: 612, top: 44, bot: 324, bar: 370, barMax: 250},
  three: {lo: -20, hi: 120, x1: 612, top: 100, bot: 330, bar: 378, barMax: 300}};
const FNL_ABOVE = 0.3;                    // Hz above 60 from which slide 2's set-point label sits above its dot (below it, under the power label)
const ROW_UP = FS + 8;
const LABEL_GAP = 16;                     // units kept clear between a label and a point
const CHAR_W = 0.56;                      // mean width of a bold label character, as a fraction of its size (to keep a label inside the plot)                    // units between two stacked labels
const BAR_H = 22, BAR_TEXT_W = 30;        // load bar height, and the least width of a part that still carries its name
const LEG = {x: 90, y: 6, w: 404, row: 22, col: [42, 76, 222, 322]};   // legend box (slides 3 to 5 and the Lab), upper left above the plot; column offsets
const TICK_P = 20;                        // MW between power-axis labels
// Scales of geometry G, in user units: power to x, frequency to y.
function scales(G) { return {X: p => PX0 + (p - G.lo) * (G.x1 - PX0) / (G.hi - G.lo), Y: f => G.top + (F_HI - f) * (G.bot - G.top) / (F_HI - F_LO)}; }
// Draw the axes of geometry G into g: frequency gridlines and labels (60 Hz bold; its gridline lit if lit60), power labels, 0 MW line, 100 MW rating line.
function axes(g, G, lit60) {
  const {X, Y} = scales(G);
  g.append(sv('rect', {x: PX0, y: G.top, width: G.x1 - PX0, height: G.bot - G.top, fill: 'none', stroke: C.edge}));
  for (let f = F_LO; f <= F_HI; f++) {
    const main = f === F_60;
    if (!main) g.append(sv('path', {d: `M${PX0} ${Y(f)}H${G.x1}`, stroke: C.tick, 'stroke-width': 1}));
    g.append(stext(PX0 - 8, Y(f) + 5, f + ' Hz', {anchor: 'end', fill: main ? C.ink : C.mute, weight: main ? 700 : 400}));
  }
  for (let p = G.lo; p <= G.hi; p += TICK_P) {
    if (p > G.lo && p < G.hi) g.append(sv('path', {d: `M${X(p)} ${G.top}V${G.bot}`, stroke: p === 0 ? C.grid : C.tick, 'stroke-width': p === 0 ? 1.4 : 1}));
    g.append(stext(X(p), G.bot + 22, num(p, 0), {anchor: 'middle', fill: C.mute}));
  }
  g.append(sv('path', {d: `M${X(P_FL)} ${G.top}V${G.bot}`, stroke: C.mute, 'stroke-width': 1.2, 'stroke-dasharray': DASH}),
    stext(X(P_FL), G.top - 6, '100 MW rating', {anchor: 'middle', fill: C.mute}), stext(G.x1, G.bot + 41, 'power P (MW)', {anchor: 'end', fill: C.mute}),
    sv('path', {d: `M${PX0} ${Y(F_60)}H${G.x1}`, stroke: lit60 ? C.amber : C.grid, 'stroke-width': lit60 ? 2.6 : 1.2, 'stroke-dasharray': lit60 ? '' : DASH_DOT}));
}
// A droop line of set point fn (Hz) and slope sp (MW/Hz), clipped to the plot; a: extra attributes (stroke, width, dash, opacity).
function droop(g, G, fn, sp, a) {
  const {X, Y} = scales(G), pa = Math.max(G.lo, sp * (fn - F_HI)), pb = Math.min(G.hi, sp * (fn - F_LO));
  if (pb > pa) g.append(sv('path', Object.assign({d: `M${X(pa)} ${Y(fn - pa / sp)}L${X(pb)} ${Y(fn - pb / sp)}`, fill: 'none'}, a)));
}
// The point (P, f) placed on the plot; off the axes it is held at the edge and flagged.
function place(G, P, f) { const {X, Y} = scales(G); return {x: X(clamp(P, G.lo, G.hi)), y: Y(clamp(f, F_LO, F_HI)), off: P < G.lo || P > G.hi || f < F_LO || f > F_HI}; }
// An operating point: dotted drops to both axes and a dot (hollow when held at an edge, or when ghost).
function opPoint(g, G, P, f, col, ghost) {
  const p = place(G, P, f);
  if (!ghost) g.append(sv('path', {d: `M${p.x} ${p.y}V${G.bot}M${p.x} ${p.y}H${PX0}`, stroke: col, 'stroke-width': 1.3, 'stroke-dasharray': DASH_FINE, fill: 'none'}));
  g.append(sv('circle', {cx: p.x, cy: p.y, r: 6.5, fill: ghost || p.off ? C.white : col, stroke: col, 'stroke-width': 2.4, opacity: ghost ? 0.55 : 1}));
}
// The legend box: one row per unit {k, cells, lit}; the cells (name, s_P, P, ΔP) go in fixed columns beside a swatch of the unit's colour.
function legend(g, rows) {
  g.append(sv('rect', {x: LEG.x, y: LEG.y, width: LEG.w, height: rows.length * LEG.row + 10, rx: 7, fill: C.white, stroke: C.edge}));
  rows.forEach((r, n) => {
    const y = LEG.y + 5 + n * LEG.row;
    if (r.lit) g.append(sv('rect', {x: LEG.x + 3, y: y + 1, width: LEG.w - 6, height: LEG.row - 1, rx: 4, fill: C.amberbg, stroke: C.amber}));
    g.append(sv('path', {d: `M${LEG.x + 10} ${y + 12}h24`, stroke: COLS[r.k], 'stroke-width': 3.5}), ...r.cells.map((t, c) => stext(LEG.x + LEG.col[c], y + 17, t, {fill: COLS[r.k], weight: 600})));
  });
}
// The load bar of geometry G: parts {v (MW), col, name}; the positive parts are drawn end to end; caption under it.
function loadBar(g, G, parts, caption) {
  const k = (G.x1 - PX0) / G.barMax;
  let x = PX0;
  g.append(sv('rect', {x: PX0, y: G.bar, width: G.x1 - PX0, height: BAR_H, fill: 'none', stroke: C.edge}));
  for (const p of parts) {
    const w = Math.min(G.x1 - x, Math.max(0, p.v) * k);
    if (w <= 0) continue;
    g.append(sv('rect', {x, y: G.bar, width: w, height: BAR_H, fill: p.col, stroke: C.white, 'stroke-width': 1}));
    if (w >= BAR_TEXT_W) g.append(stext(x + w / 2, G.bar + 16, p.name, {anchor: 'middle', fill: C.white, weight: 700}));
    x += w;
  }
  g.append(stext((PX0 + G.x1) / 2, G.bar + BAR_H + 24, caption, {anchor: 'middle', fill: C.load, weight: 600}));
}

/* ═══ 6. THE THREE FIGURES ═══ */
// Block diagram of slide 1 (user units): boxes [name, x, width]; their top and height; the speed-sensed path's lower edge.
const BLK = {box: [['Governor', 30, 118], ['Prime mover', 210, 130], ['G1', 400, 70], ['Load', 530, 90]], y: 16, h: 34, fb: 68};
// Slide 1: the block diagram, then one unit alone. s: {L (MW), fn (Hz), sd (%), pts (show the no-load and full-load points and the bracket), path (light the speed path)}.
// Returns {f, sp, ffl} (Hz, MW/Hz, Hz).
function drawOne(g, s) {
  const G = GEO.one, {X, Y} = scales(G), sp = slope(s.sd, BASE_FN[0]), ffl = s.fn - P_FL / sp, f = s.fn - s.L / sp, ym = BLK.y + BLK.h / 2, B = BLK.box;
  const lit = s.path ? C.amber : C.ink, litW = s.path ? 3 : W_LINE;
  B.forEach(([name, x, w], i) => {
    g.append(sv('rect', {x, y: BLK.y, width: w, height: BLK.h, rx: 6, fill: name === 'G1' ? '#e8f0fc' : C.white, stroke: name === 'G1' ? COLS[0] : C.ink, 'stroke-width': W_LINE}),
      stext(x + w / 2, ym + 6, name, {anchor: 'middle', fill: name === 'G1' ? COLS[0] : C.ink, weight: 700}));
    if (i < B.length - 1) { const x0 = x + w, x1 = B[i + 1][1]; arrow(g, x0, ym, x1, ym, i === 0 ? lit : C.ink, i === 0 ? litW : W_LINE); if (i < 2) g.append(stext((x0 + x1) / 2, BLK.y - 0.5 + 6, ['valve', 'shaft'][i], {anchor: 'middle', fill: C.mute})); }
  });
  const tap = (B[1][1] + B[1][2] + B[2][1]) / 2, gx = B[0][1] + B[0][2] / 2;
  g.append(sv('path', {d: `M${tap} ${ym}V${BLK.fb}H${gx}V${BLK.y + BLK.h + HEAD}`, stroke: lit, 'stroke-width': litW, 'stroke-dasharray': DASH, fill: 'none'}));
  arrow(g, gx, BLK.y + BLK.h + HEAD + 1, gx, BLK.y + BLK.h, lit, litW);
  g.append(stext((gx + tap) / 2, BLK.fb + 16, 'speed sensed', {anchor: 'middle', fill: s.path ? C.amber : C.mute, weight: s.path ? 700 : 400}));
  axes(g, G, false);
  droop(g, G, s.fn, sp, {stroke: COLS[0], 'stroke-width': W_DROOP});
  if (s.pts) {
    const a = place(G, 0, s.fn), b = place(G, P_FL, ffl), bx = X(P_FL) + 14;
    g.append(sv('path', {d: `M${a.x} ${a.y}H${bx}`, stroke: C.mute, 'stroke-width': 1.2, 'stroke-dasharray': DASH_FINE}),
      sv('path', {d: `M${bx - 5} ${a.y}h10M${bx} ${a.y}V${b.y}M${bx - 5} ${b.y}h10`, stroke: C.ink, 'stroke-width': 1.6, fill: 'none'}),
      sv('circle', {cx: a.x, cy: a.y, r: 6, fill: COLS[0]}), sv('circle', {cx: b.x, cy: b.y, r: 6, fill: b.off ? C.white : COLS[0], stroke: COLS[0], 'stroke-width': 2}),
      label(a.x + 10, a.y - 10, 'f_{nl} = ' + hz(s.fn) + ' Hz (' + rpm(s.fn) + ')', {fill: COLS[0], weight: 600}),
      label(b.x - 10, b.off ? G.bot - 10 : b.y + 24, 'f_{fl} = ' + hz(ffl) + ' Hz (' + rpm(ffl) + ')' + (b.off ? ', below the plot' : ''), {fill: COLS[0], weight: 600, anchor: 'end'}),
      label((a.x + X(P_FL)) / 2, a.y + 20, '100 MW', {fill: C.mute, anchor: 'middle'}),
      label(bx + 9, (a.y + b.y) / 2 - 4, 'Δf ' + hz(P_FL / sp) + ' Hz', {fill: C.ink}), label(bx + 9, (a.y + b.y) / 2 + 16, 's_P ' + mw(sp) + ' MW/Hz', {fill: C.ink, weight: 700}));
  }
  opPoint(g, G, s.L, f, C.f, false);
  return {f, sp, ffl};
}
// Slide 2 and the Lab on the bus: G1 alone on the infinite bus. s: {fn (Hz), sp (MW/Hz), area (MW), ring (ring the crossing)}. Returns P (MW).
function drawBus(g, s) {
  const G = GEO.bus, {X, Y} = scales(G), P = onBus(s.fn, s.sp), zx = X(0), y60 = Y(F_60);
  g.append(sv('rect', {x: PX0, y: G.top, width: zx - PX0, height: G.bot - G.top, fill: C.errbg}),
    stext((PX0 + zx) / 2, G.top + 22, 'reverse', {anchor: 'middle', fill: C.err, weight: 700}), stext((PX0 + zx) / 2, G.top + 40, 'power', {anchor: 'middle', fill: C.err, weight: 700}));
  axes(g, G, false);
  g.append(sv('path', {d: `M${PX0} ${y60}H${G.x1}`, stroke: C.bus, 'stroke-width': W_BUS}), label(G.x1 - 6, y60 - 10, 'infinite bus 60.00 Hz', {anchor: 'end', fill: C.bus, weight: 700}));
  droop(g, G, s.fn, s.sp, {stroke: COLS[0], 'stroke-width': W_DROOP});
  const a = place(G, 0, s.fn), c = place(G, P, F_60);
  if (!a.off) g.append(sv('circle', {cx: a.x, cy: a.y, r: 5, fill: COLS[0]}), label(a.x + 10, s.fn > F_60 + FNL_ABOVE ? a.y - 10 : Math.max(a.y + 22, y60 + 28 + ROW_UP), 'f_{nl} = ' + hz(s.fn) + ' Hz', {fill: COLS[0], weight: 600}));
  g.append(sv('path', {d: `M${c.x} ${y60}V${G.bot}`, stroke: COLS[0], 'stroke-width': 1.3, 'stroke-dasharray': DASH_FINE}),
    sv('circle', {cx: c.x, cy: y60, r: 7, fill: c.off ? C.white : COLS[0], stroke: C.white, 'stroke-width': 2}));
  if (s.ring) g.append(sv('circle', {cx: c.x, cy: y60, r: 13, fill: 'none', stroke: C.amber, 'stroke-width': 3}));
  const pt = 'P_{G1} = ' + mw(P) + ' MW' + (c.off ? ' (off the plot)' : ''), half = pt.length * FS_BIG * CHAR_W / 2;
  g.append(label(clamp(c.x, PX0 + half, G.x1 - half), y60 + 28, pt, {anchor: 'middle', fill: COLS[0], weight: 700, size: FS_BIG}));
  loadBar(g, G, [{v: Math.min(P, s.area), col: COLS[0], name: 'G1'}, {v: s.area - Math.max(0, P), col: C.busBar, name: 'bus'}],
    'Area load ' + mw(s.area) + ' MW = G1 ' + mw(P) + ' + bus ' + mw(s.area - P) + ' MW');
  return P;
}
// Slides 3 to 5 and the isolated Lab: three units on one load. s: {L (MW), fn, sp, stage (0 lines, 1 + f_sys, 2 + points, bar and values),
// lit (unit whose line is lit, or null), rows (units whose legend rows are lit), ghost ({f, P} before a step, or null), dp (show ΔP from the ghost),
// ghosts (a dashed copy of every moved line at its base set point), hiSet (unit whose set point is ringed, or null), lit60}. Returns the share.
function drawThree(g, s) {
  const G = GEO.three, {X, Y} = scales(G), r = share(s.L, s.fn, s.sp), lit = s.lit === null || s.lit === undefined ? -1 : s.lit;
  axes(g, G, s.lit60);
  for (let k = 0; k < 3; k++) if (s.ghosts && Math.abs(s.fn[k] - BASE_FN[k]) > FN_FINE / 2) droop(g, G, BASE_FN[k], s.sp[k], {stroke: COLS[k], 'stroke-width': 1.8, 'stroke-dasharray': DASH, opacity: 0.5});
  for (let k = 0; k < 3; k++) {
    droop(g, G, s.fn[k], s.sp[k], {stroke: COLS[k], 'stroke-width': k === lit ? W_LIT : W_DROOP, opacity: lit < 0 || k === lit ? 1 : 0.35});
    const a = place(G, 0, s.fn[k]);
    if (!a.off) g.append(sv('circle', {cx: a.x, cy: a.y, r: 4.5, fill: COLS[k]}));
    if (k === s.hiSet && !a.off) g.append(sv('circle', {cx: a.x, cy: a.y, r: 11, fill: 'none', stroke: C.amber, 'stroke-width': 3}));
  }
  if (s.stage >= 1) {
    if (s.ghost) { const gy = Y(clamp(s.ghost.f, F_LO, F_HI)); g.append(sv('path', {d: `M${PX0} ${gy}H${G.x1}`, stroke: C.f, 'stroke-width': 1.6, 'stroke-dasharray': DASH, opacity: 0.45}), label(PX0 + 6, gy - 8, 'before: ' + hz(s.ghost.f) + ' Hz', {fill: C.f})); }
    // The f_sys label goes at the right end of its line, or at the left end when a unit's point sits under the right end (the left end
    // holds the "before" label when there is a ghost); with both ends taken, it goes under the line at the right.
    const fy = Y(clamp(r.f, F_LO, F_HI)), off = r.f < F_LO || r.f > F_HI, txt = 'f_{sys} = ' + hz(r.f) + ' Hz' + (off ? ' (off the plot)' : '');
    const wl = txt.replace(/[_{}]/g, '').length * FS_BIG * CHAR_W + LABEL_GAP, xs = s.stage >= 2 ? r.P.map(P => place(G, P, r.f).x) : [];
    const rightFree = xs.every(x => x < G.x1 - wl), leftFree = !s.ghost && xs.every(x => x > PX0 + wl);
    g.append(sv('path', {d: `M${PX0} ${fy}H${G.x1}`, stroke: C.f, 'stroke-width': 2.2, 'stroke-dasharray': DASH}),
      rightFree || !leftFree ? label(G.x1 - 6, rightFree ? fy - 8 : fy + 24, txt, {anchor: 'end', fill: C.f, weight: 700, size: FS_BIG}) : label(PX0 + 6, fy - 8, txt, {fill: C.f, weight: 700, size: FS_BIG}));
  }
  const rows = [0, 1, 2].map(k => ({k, lit: (s.rows || []).includes(k), cells: [UNITS[k].name, 's_P ' + mw(s.sp[k]) + ' MW/Hz'].concat(s.stage >= 2 ? ['P ' + mw(r.P[k]) + ' MW'] : [], s.stage >= 2 && s.dp && s.ghost ? ['ΔP ' + signed(r.P[k] - s.ghost.P[k])] : [])}));
  legend(g, rows);
  if (s.stage >= 2) {
    if (s.ghost) s.ghost.P.forEach((P, k) => opPoint(g, G, P, s.ghost.f, COLS[k], true));
    r.P.forEach((P, k) => opPoint(g, G, P, r.f, COLS[k], false));
    loadBar(g, G, r.P.map((P, k) => ({v: P, col: COLS[k], name: UNITS[k].name})), 'Load ' + mw(s.L) + ' MW = ' + plus(r.P) + ' MW');
  }
  return r;
}

/* ═══ 7. SLIDES ═══ */
// Lecture state. Slide 1: L, fn, sd, pts, path. Slide 2: fn, ring, litF. Slides 3–5: L, fn (three), stage, lit, rows, ghost, dp, ghosts, hiSet, lit60, row.
// Slide 6: col. Every slide's state is rebuilt from its entry state and its lines (stateAt).
const T = {};
let si = 0, line = 0;                     // slide and narration line, zero-based
// Text line under a figure (rich text; cls 'lbl' for a plain note, 'lit' for a lit line).
function below(str, cls) { const d = rel('div', cls || '', str); $('below').append(d); return d; }
const GH3 = (() => { const r = share(L3, BASE_FN, SP0); return {f: r.f, P: r.P}; })();   // slide 3: the operating point before the step
const SUM_SP = SP0[0] + SP0[1] + SP0[2];  // MW/Hz, Σ s_P of the base units: 165.99
const W5 = share(L5, BASE_FN, SP0);       // slide 5: the worked case at 180 MW
// Slide 5's step table: one row per narration line.
const STEPS = [
  ['1 Load', 'P_{load} = ' + mw(L5) + ' MW; set points ' + BASE_FN.map(hz).join(' / ') + ' Hz'],
  ['2 Slopes', 'Σ s_P = ' + plus(SP0) + ' = ' + mw(SUM_SP) + ' MW/Hz'],
  ['3 Share', 'f_{sys} = (' + mwk(W5.SF) + ' − ' + mw(L5) + ') / ' + mw(SUM_SP) + ' = ' + hz(W5.f) + ' Hz;  P = ' + W5.P.map(mw).join(' / ') + ' MW, together ' + mw(L5) + ' MW'],
  ['4 At 60 Hz', 'P_2 = ' + mw(SP0[1]) + ' × (' + hz(BASE_FN[1]) + ' − 60) = ' + mw(P_AT60[1]) + ' MW;  P_3 = ' + mw(SP0[2]) + ' × (' + hz(BASE_FN[2]) + ' − 60) = ' + mw(P_AT60[2]) + ' MW;  P_1 = ' + num(L5, 0) + ' − ' + mw(P_AT60[1] + P_AT60[2]) + ' = ' + mw(P1_NEED) + ' MW'],
  ['5 G1 set point', 'f_{nl,1} = 60 + ' + mw(P1_NEED) + ' / ' + mw(SP0[0]) + ' = ' + hz(FN1_WORKED) + ' Hz']];
// The figures. Each draws into the svg group g and writes its lines under the figure.
function figOne(g) {
  const r = drawOne(g, T);
  below('f_{fl} = f_{nl} − 100 / s_P = ' + hz(T.fn) + ' − 100 / ' + mw(r.sp) + ' = ' + hz(r.ffl) + ' Hz (' + rpm(r.ffl) + ')');
  below('f_{sys} = f_{nl} − P / s_P = ' + hz(T.fn) + ' − ' + mw(T.L) + ' / ' + mw(r.sp) + ' = ' + hz(r.f) + ' Hz; shaft ' + rpm(r.f));
  const off = [r.ffl < F_LO && 'full load', r.f < F_LO && 'the operating point'].filter(Boolean);
  if (off.length) below('Below the plot\'s 58 Hz: ' + off.join(' and ') + '.', 'lbl');
}
function figBus(g) {
  const P = drawBus(g, {fn: T.fn, sp: SP0[0], area: AREA, ring: T.ring});
  below('P_{G1} = s_P (f_{nl} − 60) = ' + mw(SP0[0]) + ' × (' + hz(T.fn) + ' − 60.00) = ' + mw(P) + ' MW');
  below('P_{bus} = ' + mw(AREA) + ' − ' + (P < 0 ? '(' + mw(P) + ')' : mw(P)) + ' = ' + mw(AREA - P) + ' MW · f_{sys} = 60.00 Hz (held by the bus)', T.litF ? 'lit' : '');
  $('warn').replaceChildren(...warnings([P], ['G1']));
}
// Slides 3 to 5: the share, its lines under the figure, and the warnings.
function figThree(g) {
  const r = drawThree(g, Object.assign({sp: SP0}, T));
  if (T.stage >= 1) below('f_{sys} = (Σ s_{Pk} f_{nl,k} − P_{load}) / Σ s_P = (' + mwk(r.SF) + ' − ' + mw(T.L) + ') / ' + mw(r.S) + ' = ' + hz(r.f) + ' Hz', si === 3 && T.lit60 ? 'lit' : '');
  else below('Three droop lines. Σ s_P = ' + plus(SP0) + ' = ' + mw(SUM_SP) + ' MW/Hz', 'lbl');
  if (T.stage >= 2) {
    const d = below('P_k = s_{Pk} (f_{nl,k} − f_{sys}): ' + plus(r.P) + ' = ' + mw(r.P[0] + r.P[1] + r.P[2]) + ' MW');
    if (si === 3 && Math.abs(r.f - F_60) < HZ_OK) d.append(el('span', {class: 'ok', text: '  ✓ back at 60 Hz'}));
  }
  if (T.dp && T.ghost) below('ΔP_k = s_{Pk} ΔP_{load} / Σ s_P: ' + r.P.map((P, k) => signed(P - T.ghost.P[k])).join(' / ') + ' MW for ' + signed(T.L - L3) + ' MW');
  if (si === 3) below('f_{nl}: ' + T.fn.map(hz).join(' / ') + ' Hz');
  if ($('warn')) $('warn').replaceChildren(...warnings(r.P, UNITS.map(u => u.name)));
}
function figWorked(g) {
  drawThree(g, Object.assign({sp: SP0}, T));
  const tb = el('table', {class: 'steps'});
  STEPS.forEach((s, i) => tb.append(el('tr', {class: i + 1 > T.row ? 'wait' : i + 1 === T.row ? 'lit' : ''}, [el('td', {text: s[0]}), rel('td', '', s[1])])));
  $('below').append(tb);
}
function figKeys() {
  const on = (left) => T.col === 3 || (left ? T.col === 1 : T.col === 2), card = (k, lit, cls) => el('div', {class: 'kcard' + (cls || '') + (lit ? ' on' : '')}, mathEl(EQ[k]));
  const cols = el('div', {class: 'eqcols'}, [el('div', {class: 'eqcol'}, [el('p', {class: 'eqhead', text: 'One unit'})].concat(['sd', 'ffl', 'sp', 'pline'].map(k => card(k, on(true))))),
    el('div', {class: 'eqcol'}, [el('p', {class: 'eqhead', text: 'Units in parallel'})].concat(['psum', 'fsys', 'dp'].map(k => card(k, on(false)))))]);
  $('below').append(cols, el('p', {class: 'eqhead', text: 'On the infinite bus'}), card('bus', T.col === 3, T.col === 3 ? ' wide ring' : ' wide'));
}
// The controls of each slide: slider definitions (see the slider function) and fixed notes.
const HZ_FMT = v => hz(v) + ' Hz';
const CTL_FN = (k, lo, hi, ends = true) => ({label: UNITS[k].name + ' set point f_{nl' + (k === 0 && si < 2 ? '' : ',' + (k + 1)) + '}', aria: UNITS[k].name + ' set point', min: lo, max: hi, step: 0.01, fine: FN_FINE,
  ends: ends ? [hz(lo), hz(hi) + ' Hz'] : null, get: () => (si < 2 ? T.fn : T.fn[k]), set: v => { if (si < 2) T.fn = v; else T.fn[k] = v; }, fmt: HZ_FMT});
const CTL_L1 = {label: 'Load P', aria: 'load power', min: 0, max: 110, step: 1, ends: ['0', '110 MW'], get: () => T.L, set: v => { T.L = v; }, fmt: v => mw(v) + ' MW'};
const CTL_SD1 = {label: 'Speed droop SD', aria: 'speed droop', min: 1.5, max: 5, step: 0.1, ends: ['1.5', '5.0 %'], get: () => T.sd, set: v => { T.sd = v; }, fmt: pct};
const CTL_L3 = {label: 'Load P_{load}', aria: 'load power', min: 60, max: 280, step: 1, ends: ['60', '280 MW'], get: () => T.L, set: v => { T.L = v; T.stage = 2; }, fmt: v => mw(v) + ' MW'};
// A fixed value row and a note for a controls column.
function fixedRow(name, value) { return el('div', {class: 'row'}, [rel('span', '', name), el('span', {class: 'val', text: value})]); }
function note(str) { return rel('p', 'fixed', str); }
// Each slide: eyebrow, title, key box, the two equation boxes (each a list of equation keys), paragraphs, small print, the state on entry (init),
// the narration lines (st: state set at the line's start; hl: which of key, eqA, eqB are lit; anim: [quantity, from, to, back] moved over the clip,
// out and back again when back is true), the controls (a function returning nodes; sliders register themselves) and the figure.
const SL = [
  {eyebrow: 'ONE UNIT ALONE', title: 'Speed droop: one unit alone',
    key: 'Alone, a unit runs at whatever speed its load allows: more load, lower speed, down its droop line.',
    eqs: [['sd', 'ffl'], ['sp', 'pline']],
    text: ['The governor on the prime mover senses shaft speed and opens the valve as the speed falls.',
      '*Set point f_{nl}:* the frequency at no load. *Speed droop SD:* the fall from no-load to full-load speed, as a percentage of full-load speed. *Slope s_P:* megawatts per hertz of fall.'],
    small: 'Four poles: shaft speed in r/min = 30 × f. s_P is fixed by SD at the base set point 61.00 Hz, so moving the set point slides the line without changing its slope.',
    init: {L: 0, fn: BASE_FN[0], sd: BASE_SD[0], pts: false, path: false},
    lines: [{st: {}, hl: ['key']}, {st: {path: true}, hl: []}, {st: {path: false}, hl: ['eqB'], anim: ['L', 0, L1_TOP]}, {st: {pts: true}, hl: ['eqA']},
      {st: {}, hl: [], anim: ['sd', BASE_SD[0], SD_ANIM, true]}, {st: {L: L1_TOP}, hl: [], anim: ['fn', BASE_FN[0], FN1_ANIM, true]}],
    ctl: use => [use(CTL_L1), use(CTL_FN(0, 60.2, 62)), use(CTL_SD1), note('− / + move the set point by ' + FN_FINE + ' Hz; values are shown to 0.01 Hz.')], draw: figOne},
  {eyebrow: 'THE INFINITE BUS', title: 'On the infinite bus',
    key: 'The bus holds 60 Hz. The set point decides the unit\'s power; the bus supplies the rest of the area load.',
    eqs: [['bus'], ['busload']],
    text: ['Area load ' + mw(AREA) + ' MW. G1: SD ' + pct(BASE_SD[0]) + ', s_P ' + mw(SP0[0]) + ' MW/Hz.', 'Below 0 MW the unit takes power from the bus: reverse power.'],
    small: '− / + move the set point by ' + FN_FINE + ' Hz; it is shown to 0.01 Hz, so a hand check from the shown value can differ in the last digit.',
    init: {fn: BASE_FN[0], ring: false, litF: false},
    lines: [{st: {}, hl: ['key']}, {st: {ring: true}, hl: ['eqA']}, {st: {ring: false}, hl: [], anim: ['fn', BASE_FN[0], FN2_UP]}, {st: {litF: true}, hl: ['eqB']}, {st: {litF: false}, hl: [], anim: ['fn', FN2_UP, FN2_DOWN]}],
    ctl: use => [use(CTL_FN(0, 59.6, 62)), fixedRow('Area load', mw(AREA) + ' MW'), fixedRow('G1 droop', pct(BASE_SD[0])), el('div', {id: 'warn', role: 'status'})], draw: figBus},
  {eyebrow: 'THREE UNITS', title: 'Three units, one frequency',
    key: 'With no bus, every unit runs at one frequency: the one at which their outputs add up to the load. A load step is shared in proportion to s_P.',
    eqs: [['psum'], ['fsys', 'dp']],
    text: ['G1 ' + hz(BASE_FN[0]) + ' Hz, ' + pct(BASE_SD[0]) + '. G2 ' + hz(BASE_FN[1]) + ' Hz, ' + pct(BASE_SD[1]) + '. G3 ' + hz(BASE_FN[2]) + ' Hz, ' + pct(BASE_SD[2]) + '. Each 100 MW.'],
    small: 'Unit values are in the box above the plot.',
    init: {L: L3, fn: BASE_FN, stage: 0, lit: null, rows: [], ghost: null, dp: false, ghosts: false, hiSet: null, lit60: false},
    lines: [{st: {}, hl: []}, {st: {}, hl: ['key'], anim: ['lit', 0, 2.999]}, {st: {lit: null, stage: 1}, hl: ['eqB']}, {st: {stage: 2}, hl: ['eqA']},
      {st: {ghost: GH3, dp: true}, hl: [], anim: ['L', L3, L3 + STEP]}, {st: {rows: [2, 1]}, hl: []}],
    ctl: use => [use(CTL_L3), note('Set points and droops as listed on the left.'), el('div', {id: 'warn', role: 'status'})], draw: figThree},
  {eyebrow: 'RESTORING 60 HZ', title: 'Bring the frequency back',
    key: 'Droop alone cannot bring back 60 Hz. Moving a set point shifts its line parallel to itself, and the frequency moves with it.',
    eqs: [['pk'], ['pk60']],
    text: ['Load ' + mw(L4) + ' MW. A moved line leaves a faint dashed copy at its base set point.'],
    small: '− / + move a set point by ' + FN_FINE + ' Hz; values are shown to 0.01 Hz.',
    init: {L: L4, fn: BASE_FN, stage: 2, lit: null, rows: [], ghost: null, dp: false, ghosts: true, hiSet: null, lit60: false},
    lines: [{st: {lit60: true}, hl: ['key']}, {st: {lit60: false, hiSet: 2}, hl: []}, {st: {}, hl: ['eqA'], anim: ['f3', BASE_FN[2], FN3_MOVED]}, {st: {hiSet: null}, hl: []}, {st: {lit60: true}, hl: ['eqB']}],
    ctl: use => [use(CTL_FN(0, 60, 62, false)), use(CTL_FN(1, 60, 62, false)), use(CTL_FN(2, 60, 62, false)), el('div', {class: 'scale'}, [el('span', {text: '60.00'}), el('span', {text: '62.00 Hz'})]),
      el('div', {class: 'row'}, button('Reset set points', 'btn grow', () => { stop(); T.fn = BASE_FN.slice(); render(); })), el('div', {id: 'warn', role: 'status'})], draw: figThree},
  {eyebrow: 'WORKED CASE', title: 'Worked case: 180 MW',
    key: 'Load ' + mw(L5) + ' MW, set points ' + BASE_FN.map(hz).join(' / ') + ' Hz. Find f_{sys} and each unit\'s share, then G1\'s set point that restores 60 Hz.',
    eqs: [['fsys'], ['pk60', 'fn60']], text: [],
    small: 'Numbers are rounded to 0.1 MW and 0.01 Hz; the sums use the unrounded values. Experiment 5 has a load of your own.',
    init: {L: L5, fn: BASE_FN, stage: 2, lit: null, rows: [], ghost: null, dp: false, ghosts: true, hiSet: null, lit60: false, row: 0},
    lines: [{st: {row: 1}, hl: ['key']}, {st: {row: 2}, hl: []}, {st: {row: 3}, hl: ['eqA']}, {st: {row: 4, lit60: true}, hl: ['eqB']}, {st: {row: 5, f1: FN1_WORKED}, hl: []}],
    ctl: () => [note('No controls on this slide. Step through the lines.')], draw: figWorked},
  {eyebrow: 'KEY EQUATIONS', title: 'Key equations',
    key: 'One unit: its droop line. In parallel: one frequency, and the outputs add up to the load. On the bus: the set point decides the power.', eqs: [],
    text: ['Left: one unit. Right: units in parallel. Below: one unit on the infinite bus.'],
    init: {col: 0}, lines: [{st: {col: 1}, hl: []}, {st: {col: 2}, hl: []}, {st: {col: 3}, hl: ['key']}],
    ctl: () => [note('No controls on this slide.')], draw: figKeys}];
// Set an animated or stepped quantity.
function setQuantity(key, v) {
  if (key === 'f1' || key === 'f3') T.fn[key === 'f1' ? 0 : 2] = v; else if (key === 'lit') T.lit = Math.min(2, Math.floor(v)); else T[key] = v;
}
// Put the lecture state at fraction fr (0 to 1) of narration line i of the present slide: the slide's entry state, then every earlier
// line's state and finished animation, then this line's state and its animation as far as fr (smooth start and stop; out and back for back).
function stateAt(i, fr) {
  const S_ = SL[si];
  for (const k of Object.keys(T)) delete T[k];
  for (const [k, v] of Object.entries(S_.init)) T[k] = Array.isArray(v) ? v.slice() : v;
  S_.lines.slice(0, i + 1).forEach((ln, n) => {
    for (const [k, v] of Object.entries(ln.st)) { if (k === 'f1') T.fn[0] = v; else T[k] = Array.isArray(v) ? v.slice() : v; }
    if (!ln.anim) return;
    const [key, a, b, back] = ln.anim, u = n < i ? 1 : Math.min(1, Math.max(0, (fr - ANIM_FROM) / ANIM_SPAN)), e = fr >= 1 && n === i ? 1 : u * u * (3 - 2 * u);
    setQuantity(key, a + (b - a) * (back ? 1 - Math.abs(2 * (n < i ? 1 : e) - 1) : (n < i ? 1 : e)));
  });
}

/* ═══ 8. PLAYER ═══ */
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

/* ═══ 9. LAB ═══ */
const LAB_START = {mode: 'iso', L: L3, area: AREA, fn: BASE_FN, sd: BASE_SD};   // the Lab's state on entry and after Reset
const LAB = {};
const labRows = {iso: [], bus: [], g23: []};   // slider boxes shown only in one mode, and those of G2 and G3 (isolated only)
const labSyncs = [];
// Each unit's slope (MW/Hz) for the Lab's droops, at the base set points.
function labSlopes() { return LAB.sd.map((d, k) => slope(d, BASE_FN[k])); }
// Draw the Lab from its own state: the figure for its mode, the readouts and the warnings.
function drawLab() {
  const g = $('labFig'), sp = labSlopes(), cell = (name, v) => el('div', {}, [rel('span', 'lbl', name + ' '), v]), iso = LAB.mode === 'iso';
  g.replaceChildren();
  if (iso) {
    const r = drawThree(g, {L: LAB.L, fn: LAB.fn, sp, stage: 2, lit: null, rows: [], ghost: null, dp: false, ghosts: false, hiSet: null, lit60: false});
    $('labRead').replaceChildren(cell('f_{sys}', hz(r.f) + ' Hz'), cell('P_1 / P_2 / P_3', r.P.map(mw).join(' / ') + ' MW'), cell('s_{P1} / s_{P2} / s_{P3}', sp.map(mw).join(' / ') + ' MW/Hz'));
    $('labWarn').replaceChildren(...warnings(r.P, UNITS.map(u => u.name), r.f));
  } else {
    const P = drawBus(g, {fn: LAB.fn[0], sp: sp[0], area: LAB.area, ring: false});
    $('labRead').replaceChildren(cell('f_{sys}', '60.00 Hz (held)'), cell('P_{G1} / P_{bus}', mw(P) + ' / ' + mw(LAB.area - P) + ' MW'), cell('s_{P1}', mw(sp[0]) + ' MW/Hz'));
    $('labWarn').replaceChildren(...warnings([P], ['G1']));
  }
  for (const b of labRows.iso) b.hidden = !iso;
  for (const b of labRows.bus) b.hidden = iso;
  for (const b of labRows.g23) b.hidden = !iso;
  $('modeIso').setAttribute('aria-pressed', String(iso)); $('modeBus').setAttribute('aria-pressed', String(!iso));
  labSyncs.forEach(f => f());
}
// Put the Lab in state s ({mode, L, area, fn, sd}; missing parts from the start state) and draw it.
function setLab(s) { const t = Object.assign({}, LAB_START, s); LAB.mode = t.mode; LAB.L = t.L; LAB.area = t.area; LAB.fn = t.fn.slice(); LAB.sd = t.sd.slice(); drawLab(); }
// Build the Lab's controls once.
function buildLab() {
  const fK = k => ({label: UNITS[k].name + ' set point', aria: UNITS[k].name + ' set point', min: 59.5, max: 62, step: 0.01, fine: FN_FINE, get: () => LAB.fn[k], set: v => { LAB.fn[k] = v; }, fmt: HZ_FMT});
  const sK = k => ({label: UNITS[k].name + ' droop SD', aria: UNITS[k].name + ' speed droop', min: 1.5, max: 5, step: 0.1, get: () => LAB.sd[k], set: v => { LAB.sd[k] = v; }, fmt: pct});
  const defs = [['iso', {label: 'Load P_{load}', aria: 'load power', min: 0, max: 300, step: 1, get: () => LAB.L, set: v => { LAB.L = v; }, fmt: v => mw(v) + ' MW'}],
    ['bus', {label: 'Area load', aria: 'area load', min: 0, max: 250, step: 1, get: () => LAB.area, set: v => { LAB.area = v; }, fmt: v => mw(v) + ' MW'}],
    ['all', fK(0)], ['g23', fK(1)], ['g23', fK(2)], ['all', sK(0)], ['g23', sK(1)], ['g23', sK(2)]];
  const lb = button('▶ Listen', 'btn grow', () => listen(lb, CLIPS.lab, SAY.lab, (i, n) => { $('labNo').textContent = i === null ? '' : (i + 1) + '/' + n + (voice ? '' : ' (no voice)'); setRich($('labCap'), i === null ? '' : disp(SAY.lab[i])); }));
  lb.dataset.listen = '▶ Listen';
  $('labCtl').replaceChildren(...defs.map(([grp, c]) => { const s = slider(c, drawLab); labSyncs.push(s.sync); if (grp !== 'all') labRows[grp].push(s.box); return s.box; }),
    note('− / + move a set point by ' + FN_FINE + ' Hz; values are shown to 0.01 Hz. A droop sets s_P at the unit\'s base set point.'));
  $('labBtns').replaceChildren(button('Reset', 'btn grow', () => setLab(LAB_START)), lb);
  $('modeIso').addEventListener('click', () => { LAB.mode = 'iso'; drawLab(); });
  $('modeBus').addEventListener('click', () => { LAB.mode = 'bus'; drawLab(); });
  setLab(LAB_START);
}

/* ═══ 10. EXPERIMENTS ═══ */
// E1 to E4: heading, task, the Lab state its button sets, the worksheet key of its answer box, and the answer shown on request.
const SP_E1 = BASE_SD.map((d, k) => slope(k === 2 ? SD_E1 : d, BASE_FN[k]));
const EXPS = [
  {h: 'A stiffer or a softer unit', task: 'At 150 MW, raise G3\'s droop from 2.5 % to 5.0 %, then step the load by 60 MW. Predict first: does G3 now take more or less of the step? Then find each unit\'s ΔP.',
    setup: {mode: 'iso', L: L3, sd: [BASE_SD[0], BASE_SD[1], SD_E1]}, k: 'e1', ans: () => { const a = share(L3, BASE_FN, SP_E1), b = share(L3 + STEP, BASE_FN, SP_E1);
      return 'With 5.0 %, s_{P3} = ' + mw(SP_E1[2]) + ' MW/Hz. For +60 MW: ΔP G1 ' + signed(b.P[0] - a.P[0]) + ', G2 ' + signed(b.P[1] - a.P[1]) + ', G3 ' + signed(b.P[2] - a.P[2]) + ' MW (at 2.5 % G3 took ' + signed(share(L3 + STEP, BASE_FN, SP0).P[2] - GH3.P[2]) + '). A larger droop means a smaller share.'; }},
  {h: 'One set point is not enough', task: 'Set the load to 240 MW. Can any single set point restore 60 Hz without a unit going over 100 MW? Try each unit in turn.',
    setup: {mode: 'iso', L: L_TURN}, k: 'e2', ans: () => { const need = [0, 1, 2].map(k => L_TURN - P_AT60.reduce((a, p, j) => a + (j === k ? 0 : p), 0));
      return 'At 60 Hz the other two units are fixed by their lines, so the one that moves must carry the rest: G1 alone ' + mw(need[0]) + ' MW, G2 alone ' + mw(need[1]) + ' MW, G3 alone ' + mw(need[2]) + ' MW. No single unit stays within its 100 MW rating: at least two set points must move.'; }},
  {h: 'No power at all', task: 'Switch the Lab to the infinite bus. Find the set point at which G1 carries no power. What happens below it?',
    setup: {mode: 'bus', area: AREA}, k: 'e3', ans: () => 'G1 carries 0 MW at f_{nl} = ' + hz(F_60) + ' Hz: its line meets the bus at P = 0. Below 60.00 Hz its power is negative (reverse power): the bus drives it as a motor, and a reverse-power relay trips it.'},
  {h: 'Who hits the rating first?', task: 'Start at 150 MW and raise the load. Which unit reaches 100 MW first, and at what load and frequency?',
    setup: {mode: 'iso', L: L3}, k: 'e4', ans: () => { const at = SP0.map((s, k) => { const f = BASE_FN[k] - P_FL / s; return {k, f, L: SP0.reduce((a, sj, j) => a + sj * (BASE_FN[j] - f), 0)}; }).sort((a, b) => a.L - b.L);
      return UNITS[at[0].k].name + ' reaches 100 MW first, at a load of ' + mw(at[0].L) + ' MW (' + hz(at[0].f) + ' Hz). ' + UNITS[at[1].k].name + ' follows at ' + mw(at[1].L) + ' MW and ' + UNITS[at[2].k].name + ' at ' + mw(at[2].L) + ' MW.'; }}];
// Experiment 5 (the v1.2.0 "Your turn"): the model's answers, the accepted error either side, and the step to check when one is wrong.
const E5 = share(L_TURN, BASE_FN, SP0);
const ANSWERS = [
  {k: 'e5f', name: 'f_{sys}', unit: 'Hz', val: E5.f, tol: TOL_F, fix: 'f_{sys} = (Σ s_{Pk} f_{nl,k} − P_{load}) / Σ s_P, with Σ s_P = ' + mw(SUM_SP) + ' MW/Hz.'},
  {k: 'e5p1', name: 'P_1', unit: 'MW', val: E5.P[0], tol: TOL_P, fix: 'P_1 = s_{P1} (f_{nl,1} − f_{sys}) = ' + mw(SP0[0]) + ' × (61.00 − f_{sys}).'},
  {k: 'e5p2', name: 'P_2', unit: 'MW', val: E5.P[1], tol: TOL_P, fix: 'P_2 = s_{P2} (f_{nl,2} − f_{sys}) = ' + mw(SP0[1]) + ' × (61.50 − f_{sys}).'},
  {k: 'e5p3', name: 'P_3', unit: 'MW', val: E5.P[2], tol: TOL_P, fix: 'P_3 = s_{P3} (f_{nl,3} − f_{sys}) = ' + mw(SP0[2]) + ' × (60.80 − f_{sys}).'}];
// Show a message under the Experiment 5 boxes: kind 'good', 'bad' (refused or wrong) or 'mid' (hint).
function turnMsg(t, kind) { const e = $('turnMsg'); setRich(e, t); e.className = kind; }
// Read the four boxes. Returns four numbers, or null after naming the entries that were refused (nothing is checked then).
function readAnswers() {
  const vals = [], empty = [], bad = [];
  for (const a of ANSWERS) {
    const raw = a.box.value.trim(), ok = raw !== '' && raw.length <= TURN_MAX_CHARS && NUMBER_FORM.test(raw);
    if (raw === '') empty.push(a.name); else if (!ok) bad.push(a.name);
    a.box.setAttribute('aria-invalid', String(!ok)); a.mark.textContent = '';
    vals.push(ok ? parseFloat(raw.replace(MINUS, '-')) : NaN);
  }
  if (empty.length || bad.length) { turnMsg((empty.length ? 'Fill in ' + empty.join(', ') + '. ' : '') + (bad.length ? 'Not a number: ' + bad.join(', ') + '. Type a value such as 59.75 or 81.2.' : ''), 'bad'); return null; }
  return vals;
}
// Check the four answers against the model, each within its own tolerance, and mark each box.
function checkAnswers() {
  const v = readAnswers();
  if (v === null) return;
  const ok = ANSWERS.map((a, i) => Math.abs(v[i] - a.val) <= a.tol + EPS), first = ok.indexOf(false);
  ANSWERS.forEach((a, i) => { a.mark.textContent = ok[i] ? '✓' : '✗'; a.mark.className = 'mark ' + (ok[i] ? 'y' : 'n'); });
  if (first < 0) { turnMsg('All four correct.', 'good'); showSolution(); } else turnMsg('Check ' + ANSWERS[first].name + ': ' + ANSWERS[first].fix, 'bad');
}
// Write the worked solution of Experiment 5.
function showSolution() {
  const box = $('sol');
  setRich(box, 'Σ s_P = ' + plus(SP0) + ' = ' + mw(SUM_SP) + ' MW/Hz;  Σ s_{Pk} f_{nl,k} = ' + mwk(E5.SF) + ' MW\n'
    + 'f_{sys} = (' + mwk(E5.SF) + ' − ' + mw(L_TURN) + ') / ' + mw(SUM_SP) + ' = ' + hz(E5.f) + ' Hz: below 60 Hz\n'
    + 'P_1 = ' + mw(E5.P[0]) + ' MW, P_2 = ' + mw(E5.P[1]) + ' MW, P_3 = ' + mw(E5.P[2]) + ' MW (together ' + mw(L_TURN) + ' MW)');
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
    rel('p', '', 'The load is ' + mw(L_TURN) + ' MW, with the set points and droops of the lecture: G1 61.00 Hz, 3.0 %; G2 61.50 Hz, 4.0 %; G3 60.80 Hz, 2.5 %. Find the system frequency and each unit\'s output. Answers within ±' + TOL_F + ' Hz and ±' + TOL_P + ' MW are accepted.'),
    el('div', {class: 'btns'}, li), voiceMsg(),
    el('label', {}, [rich('Predict first: will the frequency be above or below 60 Hz?'), el('textarea', {'data-k': 'e5q', 'aria-label': 'Experiment 5, your prediction'})]),
    grid, el('div', {class: 'btns'}, [button('Check', 'btn pri', checkAnswers), button('Hint', 'btn', () => turnMsg('Hint: Σ s_P = ' + mw(SUM_SP) + ' MW/Hz. f_{sys} = (Σ s_{Pk} f_{nl,k} − P_{load}) / Σ s_P; then P_k = s_{Pk} (f_{nl,k} − f_{sys}). The three outputs must add up to ' + mw(L_TURN) + ' MW.', 'mid')), button('Show solution', 'btn', showSolution)]),
    el('p', {id: 'turnMsg', role: 'status', 'aria-live': 'polite'}), el('div', {id: 'sol', hidden: ''})]));
}

/* ═══ 11. WORKSHEET (answers kept in this browser only; every stored value is validated before it is used) ═══ */
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
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain'})), a = el('a', {href: url, download: 'Load_Sharing_Droop_answers.txt'});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); sheetMsg('Exported to Load_Sharing_Droop_answers.txt.', false);
  });
}

/* ═══ 12. PAGES AND START ═══ */
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
