'use strict';
/* ════════════════════════════════════════════════════════════════════════
   TABLE OF CONTENTS
     1. CONSTANTS .............. machine data, ranges, figure sizes, colours, narration data
     2. MODEL .................. op(), cross(), k2th(), th2k(), TH, TH_X
     3. FORMAT ................. fmt(), f1(), sg(), deg1(), pfTxt(), mva(), polar(), fieldTxt(), exName(), disp()
     4. DOM HELPERS ............ $(), add(), el(), sv(), runs(), rich(), rel(), setRich(), stext(), mathEl(), arrow(),
                                 focusRect(), focusCircle(), arcPath(), figReset()
     5. CONTROL BUILDERS ....... row(), seg(), button(), slider(), pfButtons(), stepButtons(), pfSlider()
     6. FIGURES ................ layout constants, boxClear(), phasors(), figOneLine(), keyRow(), figPhasor(), vrAxes(), vrPath(), figCrossover(),
                                 figWorked(), figKeys(), figLab()
     7. SLIDES ................. workedBuild(), workedSlide(), SL[], buildLeft()
     8. PLAYER ................. render(), stop(), playClip(), setVoice(), tick(), playLine(), setLine(), setSlide(), playSeq()
     9. LAB .................... labBuild(), labRender()
    10. EXPERIMENTS ............ EXP[], expRender()
    11. PAGES AND START ........ fitCaption(), pageLines(), setMode(), event wiring
   ════════════════════════════════════════════════════════════════════════ */

/* ═══ 1. CONSTANTS ═══ */
const V_LINE = 4160;                    // rated line-to-line voltage, V rms (Y-connected)
const S_RATED = 2.5e6;                  // rated three-phase apparent power, VA
const S_RATED_MVA = S_RATED / 1e6;      // the same, MVA
const R_A = 0.12;                       // armature resistance, Ω per phase
const X_S = 6.2;                        // synchronous reactance, Ω per phase
const XS_CHOICES = [3.1, 6.2, 9.3];     // Lab choices for X_S, Ω per phase
const V_PHI = V_LINE / Math.sqrt(3);    // full-load phase voltage, V rms; the reference phasor (angle 0)
const I_RATED = S_RATED / (3 * V_PHI);  // armature current at rated S, A rms (kept unrounded)
const DEG = Math.PI / 180;              // radians per degree
const PF_STEP = 0.005;                  // power-factor change per slider step
const PF_STEPS = 100;                   // slider steps each side of unity (0.5 lag … 0.5 lead)
const PF_EX = 0.85;                     // power factor of the lagging and leading examples
const SF_MIN = 0.1, SF_MAX = 1, SF_STEP = 0.05;   // load as a fraction of rated S (0.25 … 2.5 MVA)
const TH_PLOT = 60;                     // VR curves run from −60° to +60° current angle (0.5 lag … 0.5 lead)
const DELTA_LIMIT = 90;                 // steady-state stability limit for δ, degrees
const UNITY_TOL = 0.05;                 // |θ| below this (degrees) is written "unity"
const ZERO_TOL = 0.05;                  // |VR| below this (%) is written without a sign
const BISECT_STEPS = 60;                // bisection steps for the VR = 0 angle
const WPM = 150;                        // reading pace used to time a line when the voice is off, words/min
const BUILD_STEPS = 5;                  // steps in the E_A construction and in each worked example
const FIG_W = 640, FIG_H = 450;         // full figure viewBox, user units
const FS = 16, FS_SMALL = 15;           // figure text sizes, user units
const SUB_SCALE = 0.75, SUB_DROP = 0.28;// subscript size and drop, as fractions of the text size
const HEAD = 11;                        // arrow-head length, user units
const TAG_GAP = 26;                     // distance of a short phasor tag from its arrow tip, user units
const DELTA_ARC_SMALL = 60;              // δ arc radius used when E_A is too short for the usual one, user units
const DIM = 0.35;                       // opacity of de-emphasised shapes
const FOCUS_W = 3, FOCUS_RX = 8;        // amber focus outline: stroke width and corner radius, user units
const C = {ink: '#1b1f24', mute: '#55606b', grid: '#e3e7eb', axis: '#c9d0d6', vphi: '#c62828', ea: '#1e56c8',
  ia: '#1b7a3a', amber: '#9a5b00', ra: '#555555', white: '#ffffff', curve: '#5a6570'};
const SVGNS = 'http://www.w3.org/2000/svg', MMLNS = 'http://www.w3.org/1998/Math/MathML';
const NBSP = '\u00a0';                  // no-break space (MathML collapses ordinary spaces in text)
const SAY = __SAY__;                    // narration text: {slides: [[line, …] × 8], lab: [3], exp: [5]}
const CLIPS = __CLIPS__;                // the same shape; one mp3 data URI per line (en-GB-SoniaNeural, −4 %)

/* ═══ 2. MODEL (per phase, steady state, no saturation, no voltage regulator) ═══ */
// Operating point. th: angle of I_A from V_φ in degrees (negative = lagging). sf: load as a fraction of rated S.
// xs, ra in Ω. Returns I_A (ir, ii) in A, the drop Z_S·I_A (dr, di) and E_A (er, ei) in V, |E_A| in V, δ in degrees, VR in %.
function op(th, sf = 1, xs = X_S, ra = R_A) {
  const r = th * DEG, ir = sf * I_RATED * Math.cos(r), ii = sf * I_RATED * Math.sin(r);
  const dr = ra * ir - xs * ii, di = ra * ii + xs * ir;
  const er = V_PHI + dr, ei = di, E = Math.hypot(er, ei);
  return {ir, ii, dr, di, er, ei, E, d: Math.atan2(ei, er) / DEG, VR: (E - V_PHI) / V_PHI * 100};
}
// Leading current angle (degrees) at which |E_A| = |V_φ|, so VR = 0; found by bisection between 0° and 90°.
function cross(sf = 1, xs = X_S, ra = R_A) {
  let lo = 0, hi = 90;
  for (let i = 0; i < BISECT_STEPS; i++) { const m = (lo + hi) / 2; if (op(m, sf, xs, ra).E > V_PHI) lo = m; else hi = m; }
  return lo;
}
// Slider index (−100 … 100) to current angle in degrees: each step is 0.005 of power factor; negative = lagging.
function k2th(k) { return Math.sign(k) * Math.acos(1 - Math.abs(k) * PF_STEP) / DEG; }
// Current angle in degrees to the nearest slider index.
function th2k(th) { return Math.sign(th) * Math.round((1 - Math.cos(th * DEG)) / PF_STEP); }
const TH = {lag: -Math.acos(PF_EX) / DEG, unity: 0, lead: Math.acos(PF_EX) / DEG};   // the three example loads, degrees
const TH_X = cross();                   // VR = 0 angle for the rated machine at full load, degrees

/* ═══ 3. FORMAT ═══ */
// Number with thousands commas, a fixed number of decimals and a true minus sign.
function fmt(x, dec) {
  const a = Math.abs(x).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  return (x < 0 && Number(a.replace(/,/g, '')) !== 0 ? '−' : '') + a;
}
// One decimal (volts, percent, megawatts).
function f1(x) { return fmt(x, 1); }
// Signed percent value: + or − in front, no sign when it rounds to zero.
function sg(v) { return (Math.abs(v) < ZERO_TOL ? '' : v > 0 ? '+' : '−') + f1(Math.abs(v)); }
// Angle in degrees, one decimal, true minus.
function deg1(a) { return fmt(a, 1) + '°'; }
// Power factor text for a current angle: "0.850 lag", "unity", "0.885 lead".
function pfTxt(th) { return Math.abs(th) < UNITY_TOL ? 'unity' : fmt(Math.cos(th * DEG), 3) + (th < 0 ? ' lag' : ' lead'); }
// Apparent power in MVA for a load fraction, exact to the slider step (2.5, 1.25, 1.375).
function mva(sf) { return String(Math.round(S_RATED_MVA * sf * 1000) / 1000); }
// Polar form "magnitude∠angle°".
function polar(m, a) { return f1(m) + '∠' + deg1(a); }
// Field current relative to the no-load field for rated voltage (unsaturated: |E_A| / |V_φ|).
function fieldTxt(E) { return fmt(E / V_PHI, 2) + ' ×'; }
// Label of an example load: "0.85 lag", "unity", "0.85 lead".
function exName(k) { return k === 'unity' ? 'unity' : PF_EX + ' ' + k; }
// Narration text to caption markup: spoken symbol names become subscripted symbols.
function disp(t) {
  return t.replace(/R A I A/g, 'R_AI_A').replace(/j X S I A/g, 'jX_SI_A').replace(/X S I A/g, 'X_SI_A')
    .replace(/\bE A\b/g, 'E_A').replace(/\bV phi\b/g, 'V_φ').replace(/\bX S\b/g, 'X_S').replace(/\bR A\b/g, 'R_A').replace(/M V A/g, 'MVA');
}

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
  const out = [], rx = /\*|([A-Za-zφ])_(\{[^}]*\}|[A-Za-z0-9φ])|\^(\{[^}]*\}|\d)/g;
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
// SVG text with subscripts and superscripts on shifted baselines (markup as in the runs function). o: size, fill, anchor, weight, halo.
function stext(x, y, str, o = {}) {
  const fs = o.size || FS, a = {x, y, 'font-size': fs, fill: o.fill || C.ink};
  if (o.anchor) a['text-anchor'] = o.anchor;
  if (o.weight) a['font-weight'] = o.weight;
  if (o.halo) Object.assign(a, {'paint-order': 'stroke', stroke: C.white, 'stroke-width': 4, 'stroke-linejoin': 'round'});
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
      else if (/[φδθ]/.test(src[i])) node = mm('mi', src[i++]);
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
// Amber focus rectangle.
function focusRect(x, y, w, h) { return sv('rect', {x, y, width: w, height: h, rx: FOCUS_RX, fill: 'none', stroke: C.amber, 'stroke-width': FOCUS_W}); }
// Amber focus circle.
function focusCircle(cx, cy, r) { return sv('circle', {cx, cy, r, fill: 'none', stroke: C.amber, 'stroke-width': FOCUS_W}); }
// Circular arc of radius r about (cx, cy) from angle a0 to a1 (degrees, counter-clockwise, a1 > a0) as a path string.
function arcPath(cx, cy, r, a0, a1) {
  const p = a => (cx + r * Math.cos(a * DEG)) + ' ' + (cy - r * Math.sin(a * DEG));
  return 'M' + p(a0) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 0 ' + p(a1);
}
// Show the figure with a viewBox of the given height and an accessible name, emptied.
function figReset(h, label) {
  const fig = $('fig');
  fig.setAttribute('aria-label', label);
  fig.removeAttribute('hidden');
  fig.setAttribute('viewBox', '0 0 ' + FIG_W + ' ' + h);
  fig.replaceChildren();
  return fig;
}

/* ═══ 5. CONTROL BUILDERS ═══ */
// Label and value on one line; returns the row and its value span.
function row(label, cls) {
  const val = el('span', {class: 'val'});
  return {row: el('div', {class: 'row' + (cls ? ' ' + cls : '')}, [rel('span', '', label), val]), val};
}
// Group of toggle buttons; onPick receives the chosen key. Returns the group and a function that marks the pressed key.
function seg(items, onPick, label) {
  const box = el('div', {class: 'seg', role: 'group', 'aria-label': label});
  const btns = items.map(([key, text]) => {
    const b = el('button', {type: 'button', 'aria-pressed': 'false'}, rich(text));
    b.addEventListener('click', () => onPick(key));
    box.append(b);
    return [key, b];
  });
  return {box, mark: key => btns.forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === key)))};
}
// Plain button.
function button(text, cls, onClick) {
  const b = el('button', {type: 'button', class: cls}, text);
  b.addEventListener('click', onClick);
  return b;
}
// Range input with an accessible name.
function slider(min, max, step, label, onInput) {
  const s = el('input', {type: 'range', min, max, step, 'aria-label': label});
  s.addEventListener('input', () => onInput(Number(s.value)));
  return s;
}
// The three example power factors as toggle buttons.
function pfButtons(onPick) { return seg(['lag', 'unity', 'lead'].map(k => [k, exName(k)]), onPick, 'Load power factor'); }
// "− step" and "+ step" buttons that move st.step between lo and BUILD_STEPS.
function stepButtons(lo) {
  const move = d => { stop(); st.step = Math.max(lo, Math.min(BUILD_STEPS, Math.min(st.step, BUILD_STEPS) + d)); st.focus = ''; st.table = 0; render(); };
  return el('div', {class: 'seg'}, [button('− step', 'btn', () => move(-1)), button('+ step', 'btn', () => move(1))]);
}
// Power-factor slider block: heading with value, slider and its scale. Returns the nodes and the parts to update.
function pfSlider(onInput) {
  const val = el('span', {class: 'val'});
  const s = slider(-PF_STEPS, PF_STEPS, 1, 'Load power factor in steps of 0.005, lagging left, leading right', k => onInput(k2th(k)));
  const nodes = [el('div', {class: 'row'}, [el('span', {text: 'Load power factor'}), val]), s,
    el('div', {class: 'scale'}, [el('span', {text: '0.5 lag'}), el('span', {text: 'unity'}), el('span', {text: '0.5 lead'})])];
  return {nodes, set: th => { val.textContent = pfTxt(th); s.value = th2k(th); s.setAttribute('aria-valuetext', pfTxt(th)); }};
}

/* ═══ 6. FIGURES ═══ */
// Layout in figure user units (viewBox FIG_W wide): x from the left edge, y down from the top.
const PAD = 10, RIGHT = 630;            // left edge of titles and notes; right edge of right-aligned text
const TITLE_Y = 20, NOTE_Y = 44;        // baselines of a figure title and of the line under it
const FS_TITLE = 16, FS_SOURCE = 18;    // text sizes of figure titles and of the E_A source symbol
const W_FINE = 1.5, W_LINE = 2, W_CURVE = 2.5, W_BOLD = 3, W_PHASOR = 4;   // stroke widths
const DASH_I = '6 4', DASH_VC = '7 5', DASH_LOCUS = '2 5', DASH_REF = '5 4', DASH_FOCUS = '6 6';   // dash patterns
const FOCUS_R = 12, MARK_R = 5, DOT_R = 6, NODE_R = 4;   // radii: focus ring on a tip, VR = 0 marker, operating point / terminal, breaker contact
const KEY_LEN = 24, KEY_TEXT = 32, KEY_ROW = 22;   // key: sample length, text offset from the sample start, row spacing
// Slide 1. One-line diagram: wire height, source circle, reactor (humps), terminal dot, breaker contacts and open-blade lift, load box.
const ONE = {wireY: 92, srcX: 70, srcR: 28, coilX: 170, coilHump: 16, coilN: 4, termX: 300, brkX0: 380, brkX1: 440, liftX: 8, liftY: 33, loadX: 488, loadW: 148, loadH: 60, fieldY: 150, noteDY: 30};
// Slide 1. Bars: title baseline, axis 0 … vmax volts from x0 to x1, values right-aligned at xv, bar tops and height, grid span, tick-label and summary baselines, VR bracket height.
const BARS = {titleY: 172, x0: 170, x1: 540, xv: 632, vmax: 4500, yE: 212, yT: 262, h: 34, top: 204, bottom: 372, tickY: 390, ticks: [0, 1000, 2000, 3000, 4000], refY: 198, noteDY: 26, vrY: 340, vrTick: 7, vrTextDY: 25, sumY: 436};
// Slides 2 and 3. Origin, scale (px per volt), I_A arrow length, |V_φ| arc end (degrees), δ arc radius, axis span, key position, readout baseline.
const PH = {ox: 70, oy: 316, k: 0.105, iLen: 100, arc: 126, dArc: 150, axisX0: 30, axisX1: 620, keyX: 340, keyY: 364, readY: 438, labelDY: 22, noteDY: 50};
// Slide 4. Plot: figure height, plot box, VR range (%) and ticks, key rows (% on the VR axis).
const XPLOT = {h: 250, x0: 70, x1: 610, y0: 28, y1: 212, vmin: -60, vmax: 100, ticks: [-50, 0, 50, 100], titleY: 18, keyV: -18, keyDV: 22};
// Slides 5 to 7. Small phasor diagram: figure height, origin, scale, I_A arrow length, tag distance, |V_φ| arc end, axis span.
const MINI = {h: 200, ox: 250, oy: 150, k: 0.05, iLen: 45, gap: 13, arc: 132, axisX0: 150, axisX1: 520, w: 0.8};
// Lab. Phasors: origin, scale, I_A arrow length, |V_φ| arc end, axis span, title and key baselines; VR plot box, range (%) and ticks.
const LABF = {ox: 150, oy: 250, k: 0.06, iLen: 60, arc: 138, axisX0: 20, axisX1: 630, titleY: 18, keyY: 44, openY: 66, w: 0.9, x0: 70, x1: 610, y0: 322, y1: 428, vmin: -60, vmax: 140, ticks: [-50, 0, 50, 100]};
// Clearance (user units) between a text box centred at (cx, cy), half-size hw × hh, and the circle of radius rv about (ox, oy):
// positive when the circle misses the box.
function boxClear(cx, cy, hw, hh, ox, oy, rv) {
  const d = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => Math.hypot(cx + a * hw - ox, cy + b * hh - oy));
  return Math.max(Math.min(...d) - rv, rv - Math.max(...d));
}
// Phasors V_φ, I_A (direction only), R_A·I_A, jX_S·I_A and E_A, to scale, with optional locus and |V_φ| circle.
// p: {o, th, xs, ox, oy, k (px per volt), iLen, step, dim (opacity of a part), loc, vc, arc (|V_φ| arc end, degrees), dArc (largest δ arc radius),
//     fs, w (line-width scale), gap (tag distance), full (value on the jX_S·I_A label), tags (false = no labels on the arrows)}.
function phasors(g, p) {
  const {o, th, ox, oy, k} = p, dim = p.dim || (() => 1), fs = p.fs || FS, w = p.w || 1, gap = p.gap || TAG_GAP, tags = p.tags !== false;
  const P = (re, im) => [ox + re * k, oy - im * k];
  const [vx, vy] = P(V_PHI, 0), [ex, ey] = P(o.er, o.ei);
  const [rx, ry] = P(V_PHI + o.dr + p.xs * o.ii, o.di - p.xs * o.ir);       // tip of V_φ + R_A·I_A
  const r = th * DEG, ix = ox + p.iLen * Math.cos(r), iy = oy - p.iLen * Math.sin(r), rv = V_PHI * k, rl = Math.hypot(o.dr, o.di) * k;
  const tag = (x, y, txt, col) => g.append(stext(x, y + fs * 0.35, txt, {fill: col, anchor: 'middle', weight: 700, size: fs, halo: true}));
  const dArc = !p.dArc ? 0 : o.E * k >= p.dArc + 16 ? p.dArc : DELTA_ARC_SMALL;   // δ arc radius: inside the E_A arrow tip
  const dl = [ox + (dArc + 12) * Math.cos(o.d / 2 * DEG), oy - (dArc + 12) * Math.sin(o.d / 2 * DEG)];   // centre of the δ label
  const showD = dArc && p.step >= 5, MARGIN = 4;
  // Drawn circles a label must not touch: |V_φ| circle, δ arc, locus of the E_A tip.
  const rings = (p.vc ? [[ox, oy, rv]] : []).concat(showD ? [[ox, oy, dArc]] : [], p.loc ? [[vx, vy, rl]] : []);
  // Distance from a point to the segment a–b.
  const segDist = (c, a, b) => { const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1, u = Math.max(0, Math.min(1, ((c[0] - a[0]) * (b[0] - a[0]) + (c[1] - a[1]) * (b[1] - a[1])) / L2)); return Math.hypot(c[0] - a[0] - u * (b[0] - a[0]), c[1] - a[1] - u * (b[1] - a[1])); };
  // Free space around a text box centred at c: least clearance to the rings, the given arrows and the δ label.
  const clear = (c, hw, hh, segs) => Math.min(99, ...rings.map(q => boxClear(c[0], c[1], hw, hh, q[0], q[1], q[2])), ...segs.map(q => segDist(c, q[0], q[1]) - Math.max(hw, hh)),
    showD ? Math.max(Math.abs(c[0] - dl[0]) - hw - 8, Math.abs(c[1] - dl[1]) - hh - 10) : 99);
  // Of the candidate centres for a text box, the first with MARGIN of free space, else the one with the most.
  const pick = (cands, hw, hh, segs) => cands.find(c => clear(c, hw, hh, segs) > MARGIN) || cands.reduce((m, c) => clear(c, hw, hh, segs) > clear(m, hw, hh, segs) ? c : m);
  if (p.loc) g.append(sv('path', {d: arcPath(vx, vy, rl, 90 - TH_PLOT + 1.1, 90 + TH_PLOT + 1.1), fill: 'none', stroke: C.ink, 'stroke-width': W_LINE * w, 'stroke-dasharray': DASH_LOCUS, opacity: dim('loc')}));
  if (p.vc) g.append(sv('path', {d: arcPath(ox, oy, rv, 0, p.arc), fill: 'none', stroke: C.vphi, 'stroke-width': W_LINE * w, 'stroke-dasharray': DASH_VC}));
  if (p.step >= 1) arrow(g, ox, oy, vx, vy, C.vphi, W_PHASOR * w, {opacity: dim('V')});
  if (p.step >= 2) {
    arrow(g, ox, oy, ix, iy, C.ia, W_CURVE * w, {dash: DASH_I, opacity: dim('I')});
    const ty = iy + gap * Math.cos(r), near = th > 0 && oy - ty < fs;      // no room for the tag between I_A and the V_φ arrow
    if (tags) tag(near ? ix : ix + gap * Math.sin(r), near ? oy + fs + 4 : ty, 'I_A', C.ia);
  }
  if (p.step >= 3) g.append(sv('line', {x1: vx, y1: vy, x2: rx, y2: ry, stroke: C.ra, 'stroke-width': W_BOLD * w, opacity: dim('R')}));
  if (p.step >= 4) {
    arrow(g, rx, ry, ex, ey, C.ink, W_BOLD * w, {opacity: dim('X')});
    const txt = 'jX_SI_A' + (p.full ? ' = ' + f1(p.xs * Math.hypot(o.ir, o.ii)) + ' V' : '');
    const hw = txt.replace(/[_{}]/g, '').length * fs * 0.29, hh = fs * 0.7, mx = (rx + ex) / 2, my = (ry + ey) / 2;
    const L = Math.hypot(ex - rx, ey - ry) || 1, nx = -(ey - ry) / L, ny = (ex - rx) / L;   // unit normal, pointing away from the origin side
    const d = 8 + Math.abs(nx) * hw + Math.abs(ny) * hh, at = (u, sgn) => [rx + (ex - rx) * u + sgn * nx * d, ry + (ey - ry) * u + sgn * ny * d];
    const c = pick([at(0.5, 1), at(0.5, -1), at(0.7, 1), at(0.3, 1), at(0.7, -1), at(0.3, -1)], hw, hh, []);
    if (tags) g.append(stext(c[0], c[1] + fs * 0.35, txt, {weight: 700, size: fs, anchor: 'middle', halo: true}));
  }
  if (p.step >= 5) {
    arrow(g, ox, oy, ex, ey, C.ea, W_PHASOR * w, {opacity: dim('E')});
    // E_A tag: around the tip, starting outside the locus circle, clear of the circles and of the three arrows
    const a0 = Math.atan2(vy - ey, ex - vx), cands = [];
    for (const q of [gap + 4, gap + 14, gap + 26]) for (const da of [0, 35, -35, 70, -70, 110, -110, 150, -150, 180]) cands.push([ex + q * Math.cos(a0 + da * DEG), ey - q * Math.sin(a0 + da * DEG)]);
    const c = pick(cands, fs * 0.9, fs * 0.8, [[[ox, oy], [ex, ey]], [[rx, ry], [ex, ey]], [[ox, oy], [ix, iy]]]);
    if (tags) tag(c[0], c[1], 'E_A', C.ea);
    if (showD) {
      g.append(sv('path', {d: arcPath(ox, oy, dArc, 0, o.d), fill: 'none', stroke: C.ea, 'stroke-width': W_FINE * w}));
      g.append(stext(dl[0], dl[1] + fs * 0.35, 'δ', {fill: C.ea, anchor: 'middle', size: fs, halo: true}));
    }
  }
  return {vx, vy, ex, ey, ix, iy, rv, rl};
}
// Slide 1: one-line diagram with a breaker, and |E_A| and terminal-voltage bars.
function figOneLine() {
  const o = op(TH[st.k]), E = o.E, T = st.open ? E : V_PHI, f = st.focus || '', W = ONE, B = BARS, y = W.wireY;
  const fig = figReset(FIG_H, 'One-line diagram and voltage bars: E_A ' + f1(E) + ' V, terminal ' + f1(T) + ' V, breaker ' + (st.open ? 'open' : 'closed'));
  const x = v => B.x0 + v / B.vmax * (B.x1 - B.x0), dimE = (f === 'term' || f === 'vr') ? DIM : 1;
  const line = (x1, y1, x2, y2, col, w, extra) => sv('line', Object.assign({x1, y1, x2, y2, stroke: col || C.ink, 'stroke-width': w || W_LINE}, extra));
  const coilEnd = W.coilX + W.coilN * W.coilHump, coilMid = (W.coilX + coilEnd) / 2, brkMid = (W.brkX0 + W.brkX1) / 2, loadMid = W.loadX + W.loadW / 2;
  const hump = ' q' + W.coilHump / 2 + ' -' + W.coilHump + ' ' + W.coilHump + ' 0';
  fig.append(stext(PAD, TITLE_Y, 'One-line, per phase', {weight: 700, size: FS_TITLE}),
    sv('circle', {cx: W.srcX, cy: y, r: W.srcR, fill: C.white, stroke: C.ea, 'stroke-width': W_BOLD}),
    stext(W.srcX, y + FS_SOURCE / 3, 'E_A', {fill: C.ea, anchor: 'middle', weight: 700, size: FS_SOURCE}),
    stext(PAD, W.fieldY, 'field held at ' + fieldTxt(E) + ' no-load', {size: FS_SMALL, fill: C.mute}),
    line(W.srcX + W.srcR, y, W.coilX, y),
    sv('path', {d: 'M' + W.coilX + ' ' + y + hump.repeat(W.coilN), fill: 'none', stroke: C.ink, 'stroke-width': W_LINE}),
    stext(coilMid, y - W.noteDY + 4, 'jX_S = j' + X_S + ' Ω', {anchor: 'middle'}),
    stext(coilMid, y + W.noteDY, st.open ? 'I_A = 0: no drop' : 'I_A = ' + f1(I_RATED) + ' A', {anchor: 'middle', size: FS_SMALL, fill: C.mute}),
    line(coilEnd, y, W.brkX0, y), sv('circle', {cx: W.termX, cy: y, r: DOT_R, fill: C.vphi}),
    stext(W.termX, y - 14, 'terminal', {anchor: 'middle', weight: 700, fill: C.vphi}),
    sv('circle', {cx: W.brkX0, cy: y, r: NODE_R, fill: C.ink}), sv('circle', {cx: W.brkX1, cy: y, r: NODE_R, fill: C.ink}),
    line(W.brkX0, y, st.open ? W.brkX1 - W.liftX : W.brkX1, st.open ? y - W.liftY : y, st.open ? C.vphi : C.ink, W_BOLD),
    stext(brkMid, y + W.noteDY, 'breaker ' + (st.open ? 'OPEN' : 'CLOSED'), {anchor: 'middle', weight: 700}),
    line(W.brkX1, y, W.loadX, y),
    sv('rect', {x: W.loadX, y: y - W.loadH / 2, width: W.loadW, height: W.loadH, rx: DOT_R, fill: C.white, stroke: C.ink, 'stroke-width': W_LINE, opacity: st.open ? DIM : 1}),
    stext(loadMid, y - 5, 'Load', {anchor: 'middle', weight: 700}),
    stext(loadMid, y + 16, S_RATED_MVA + ' MVA · ' + exName(st.k), {anchor: 'middle', size: FS_SMALL}),
    stext(PAD, B.titleY, 'Voltage magnitudes per phase: ' + (st.open ? 'no load, breaker open' : 'full load, breaker closed'), {weight: 700, size: FS_TITLE}));
  if (f === 'brk') fig.append(focusRect(W.brkX0 - 48, y - 44, W.brkX1 - W.brkX0 + 92, 84));
  for (const v of B.ticks) fig.append(line(x(v), B.top, x(v), B.bottom, C.grid, 1), stext(x(v), B.tickY, fmt(v, 0), {anchor: 'middle', size: FS_SMALL, fill: C.mute}));
  // One bar with its two-line name on the left and its value on the right.
  const bar = (top, name, sub, v, col, opacity) => fig.append(stext(B.x0 - 12, top + 10, name, {anchor: 'end', weight: 700, size: FS_TITLE, fill: col}),
    stext(B.x0 - 12, top + B.h, sub, {anchor: 'end', size: FS_SMALL, fill: C.mute}),
    sv('rect', {x: B.x0, y: top, width: x(v) - B.x0, height: B.h, rx: NODE_R, fill: col, opacity}),
    stext(B.xv, top + 23, f1(v) + ' V', {anchor: 'end', weight: 700, fill: col}));
  fig.append(stext(B.xv, B.tickY, 'volts', {anchor: 'end', size: FS_SMALL, fill: C.mute}));
  bar(B.yE, '|E_A|', 'set by the field', E, C.ea, dimE);
  bar(B.yT, 'Terminal', 'what the bus sees', T, C.vphi, 1);
  fig.append(stext(B.x0, B.yT + B.h + B.noteDY, 'Terminal ' + (st.open ? '= |E_A|: no current, no drop' : E > V_PHI ? 'below |E_A| (drop across Z_S)' : 'ABOVE |E_A| (leading current)'), {size: FS_SMALL}),
    line(x(V_PHI), B.top, x(V_PHI), B.yT + B.h + 4, C.vphi, W_FINE, {'stroke-dasharray': DASH_REF}),
    stext(x(V_PHI), B.refY, 'full-load |V_φ| = ' + f1(V_PHI) + ' V', {anchor: 'middle', size: FS_SMALL, fill: C.vphi}));
  const both = B.yT - B.yE + B.h + 12, wide = B.xv - B.x0 + 12;        // focus boxes: both bars high; bar start to value wide
  if (f === 'gap') fig.append(focusRect(Math.min(x(E), x(V_PHI)) - 12, B.yE - 6, Math.abs(x(V_PHI) - x(E)) + 24, both));
  if (f === 'term') fig.append(focusRect(B.x0 - 6, B.yT - 6, wide, B.h + 12));
  if (f === 'both') fig.append(focusRect(B.x0 - 6, B.yE - 6, wide, both));
  if (st.open) {
    const xa = x(V_PHI), xb = x(E), yy = B.vrY, t = B.vrTick, HALF = 64;   // HALF: half-width allowed for the VR text
    const xm = Math.max(B.x0 + HALF, Math.min(B.x1 - HALF / 2, (xa + xb) / 2)), lo = Math.min(xa, xb, xm - HALF), hi = Math.max(xa, xb, xm + HALF);
    fig.append(line(xa, yy, xb, yy, C.amber, W_BOLD), line(xa, yy - t, xa, yy + t, C.amber, W_BOLD), line(xb, yy - t, xb, yy + t, C.amber, W_BOLD),
      stext(xm, yy + B.vrTextDY, 'VR = ' + sg(o.VR) + ' %', {anchor: 'middle', weight: 700, size: FS_TITLE, fill: C.amber, halo: true}));
    if (f === 'vr') fig.append(focusRect(lo - 8, yy - 2 * t, hi - lo + 16, B.vrTextDY + 25));
  }
  if (st.sum) {
    const v = k => sg(op(TH[k]).VR) + ' %';
    fig.append(stext(PAD, B.sumY, 'Same ' + S_RATED_MVA + ' MVA:  *' + exName('lag') + ' ' + v('lag') + '  ·  unity ' + v('unity') + '  ·  ' + exName('lead') + ' ' + v('lead') + '*', {fill: C.amber}));
  }
}
// One row of a figure key: a line sample (or, with dash = null, a VR = 0 marker) and its text.
function keyRow(fig, x, y, col, dash, txt, w) {
  const mid = y - FS_SMALL / 3;
  fig.append(dash === null ? sv('circle', {cx: x + KEY_LEN / 2, cy: mid, r: MARK_R, fill: C.white, stroke: col, 'stroke-width': W_CURVE})
    : sv('line', Object.assign({x1: x, y1: mid, x2: x + KEY_LEN, y2: mid, stroke: col, 'stroke-width': w || W_LINE}, dash ? {'stroke-dasharray': dash} : {})),
    stext(x + KEY_TEXT, y, txt, {size: FS_SMALL, fill: col, weight: 700}));
}
// Slides 2 and 3: the E_A construction to scale; with locus = true, the tip circle and the |V_φ| circle as well.
function figPhasor(locus) {
  const th = st.th === undefined ? TH[st.k] : st.th, o = op(th), f = st.focus || '', step = locus ? BUILD_STEPS : st.step, {ox, oy, k} = PH;
  const fig = figReset(FIG_H, 'Phasor diagram at ' + pfTxt(th) + ': E_A ' + polar(o.E, o.d) + ' V, VR ' + sg(o.VR) + ' %');
  const dim = e => (!f || (locus && (e === 'V' || e === 'E')) || f === e || f === 'eq' || (f === 'x' && e === 'E') || (f === 'loc' && (e === 'E' || e === 'X')) || (f === 'vc' && e === 'V')) ? 1 : DIM;
  fig.append(stext(PAD, TITLE_Y, 'Phasor diagram, per phase, to scale · ' + pfTxt(th) + ', ' + S_RATED_MVA + ' MVA', {weight: 700, size: FS_TITLE}),
    sv('line', {x1: PH.axisX0, y1: oy, x2: PH.axisX1, y2: oy, stroke: C.axis}));
  const g = phasors(fig, {o, th, ox, oy, k, xs: X_S, iLen: PH.iLen, step, dim, loc: locus && st.loc, vc: locus && st.vc, arc: PH.arc, full: !locus, dArc: PH.dArc});
  if (step >= 1) fig.append(stext(g.vx + PAD, oy + PH.labelDY, 'V_φ = ' + polar(V_PHI, 0) + ' V', {weight: 700, fill: C.vphi}));
  if (step >= 2) fig.append(stext(PAD, NOTE_Y, 'I_A arrow: direction only, θ = ' + deg1(th), {size: FS_SMALL, fill: C.ia}));
  if (step >= 3 && (st.step === 3 || f === 'R')) fig.append(stext(g.vx + PAD, oy + PH.noteDY, 'R_AI_A = ' + f1(R_A * I_RATED) + ' V (too short to see)', {size: FS_SMALL}), focusCircle(g.vx, g.vy, FOCUS_R - 3));
  if (step >= 4 && f === 'X') fig.append(stext(g.vx - 8, g.vy - FOCUS_R, '90° ahead of I_A', {anchor: 'end', weight: 700, size: FS_SMALL, fill: C.amber, halo: true}));
  if (locus && st.loc) {
    keyRow(fig, PH.keyX, PH.keyY + 2 * KEY_ROW, C.ink, DASH_LOCUS, 'locus of the E_A tip');
    if (f === 'loc') fig.append(sv('path', {d: arcPath(g.vx, g.vy, g.rl + 9, 90 - TH_PLOT - 4, 90 + TH_PLOT + 4), fill: 'none', stroke: C.amber, 'stroke-width': W_BOLD, 'stroke-dasharray': DASH_FOCUS, opacity: 0.7}));
  }
  if (locus && st.vc) {
    const x0 = op(TH_X), cx = ox + x0.er * k, cy = oy - x0.ei * k;
    keyRow(fig, PH.keyX, PH.keyY + KEY_ROW, C.vphi, DASH_VC, 'circle of radius |V_φ|');
    keyRow(fig, PH.keyX, PH.keyY, C.amber, null, 'VR = 0 at ' + pfTxt(TH_X));
    fig.append(sv('circle', {cx, cy, r: MARK_R, fill: C.white, stroke: C.amber, 'stroke-width': W_CURVE}));
    if (f === 'x') fig.append(focusCircle(cx, cy, FOCUS_R));
  }
  if (f === 'E' && step >= 5) fig.append(focusCircle(g.ex, g.ey, FOCUS_R));
  if (f === 'V') fig.append(focusRect(ox - 8, oy - 14, g.vx - ox + 16, 28));
  if (f === 'I') fig.append(focusCircle(g.ix, g.iy, FOCUS_R));
  if (step >= 5) fig.append(stext(RIGHT, PH.readY, 'E_A = ' + polar(o.E, o.d) + ' V  ·  *VR = ' + sg(o.VR) + ' %*', {anchor: 'end', fill: C.ea, weight: 700}));
}
// VR-against-power-factor axes inside the box X0…X1, Y0…Y1; returns the scale functions.
function vrAxes(fig, X0, X1, Y0, Y1, vmin, vmax, ticks, xl) {
  const xm = t => X0 + (t + TH_PLOT) / (2 * TH_PLOT) * (X1 - X0), ym = v => Y1 - (v - vmin) / (vmax - vmin) * (Y1 - Y0);
  for (const v of ticks) fig.append(sv('line', {x1: X0, x2: X1, y1: ym(v), y2: ym(v), stroke: v === 0 ? C.ink : C.grid}), stext(X0 - 6, ym(v) + 5, fmt(v, 0) + ' %', {anchor: 'end', size: FS_SMALL, fill: C.mute}));
  for (const [t, l, a] of xl) fig.append(stext(xm(t), Y1 + 17, l, {anchor: a || 'middle', size: FS_SMALL, fill: C.mute}));
  return {xm, ym};
}
// VR curve from 0.5 lag to 0.5 lead as a path string.
function vrPath(ax, sf, xs, ra) {
  let d = '';
  for (let t = -TH_PLOT; t <= TH_PLOT; t++) d += (d ? 'L' : 'M') + ax.xm(t).toFixed(1) + ',' + ax.ym(op(t, sf, xs, ra).VR).toFixed(1);
  return d;
}
// Slide 4: derivation of the VR = 0 condition (equations above) and VR against power factor at full and reduced load.
function figCrossover() {
  const eqs = $('eqs'), f = st.focus || '';
  const E = ['E_A = (V_φ − X_S I_A sin φ) + j X_S I_A cos φ', '|E_A|^2 = V_φ^2 − 2 V_φ X_S I_A sin φ + (X_S I_A)^2',
    '|E_A| = V_φ   ⇒   sin φ = \\frac{X_S I_A}{2 V_φ}',
    'sin φ = \\frac{' + f1(X_S * I_RATED) + '}{' + f1(2 * V_PHI) + '} = ' + fmt(X_S * I_RATED / (2 * V_PHI), 3) + '   →   φ = ' + deg1(Math.asin(X_S * I_RATED / (2 * V_PHI)) / DEG) + '   →   \\t{pf }' + fmt(Math.cos(Math.asin(X_S * I_RATED / (2 * V_PHI))), 3) + '\\t{ lead}'];
  eqs.append(rel('p', 'ftitle', 'With R_A neglected; I_A leads V_φ by φ'));
  E.forEach((src, i) => { if (st.step > i) eqs.append(el('div', {class: 'step' + (f === 'e' + (i + 1) ? ' on' : '')}, mathEl(src))); });
  const X = XPLOT, fig = figReset(X.h, 'VR against load power factor at full load and at ' + Math.round(st.sf * 100) + ' % load');
  const ax = vrAxes(fig, X.x0, X.x1, X.y0, X.y1, X.vmin, X.vmax, X.ticks, [[-TH_PLOT, '0.5 lag', 'start'], [TH.lag, exName('lag')], [0, 'unity'], [TH.lead, exName('lead')], [TH_PLOT, '0.5 lead', 'end']]);
  // One VR curve with its VR = 0 marker.
  const curve = (sf, col, w) => { fig.append(sv('path', {d: vrPath(ax, sf, X_S, R_A), fill: 'none', stroke: col, 'stroke-width': w}), sv('circle', {cx: ax.xm(cross(sf)), cy: ax.ym(0), r: MARK_R, fill: C.white, stroke: col, 'stroke-width': W_CURVE})); };
  fig.append(stext(X.x1, X.titleY, 'VR against load power factor', {anchor: 'end', weight: 700, size: FS_SMALL}));
  curve(1, C.curve, W_CURVE);
  // The key sits in the lower left, where no curve runs (VR > 0 for every lagging load).
  keyRow(fig, X.x0 + 14, ax.ym(X.keyV), C.curve, '', 'full load', W_CURVE);
  if (st.half) {
    curve(st.sf, C.amber, W_BOLD);
    keyRow(fig, X.x0 + 14, ax.ym(X.keyV - X.keyDV), C.amber, '', Math.round(st.sf * 100) + ' % load', W_BOLD);
  }
  if (f === 'plot') fig.append(focusRect(4, 3, FIG_W - 8, X.h - 6));
}
// Slides 5 to 7: a worked example in five steps with a small phasor diagram, or the comparison table.
function figWorked() {
  const eqs = $('eqs'), th = TH[st.k], o = op(th), f = st.focus || '', step = st.step;
  const L = [['I_A = ' + polar(I_RATED, th) + '\\t{ A}', 'the load: ' + S_RATED_MVA + ' MVA at ' + pfTxt(th)],
    ['R_A I_A = ' + R_A + ' × ' + polar(I_RATED, th) + ' = ' + polar(R_A * I_RATED, th) + '\\t{ V}', 'along the current'],
    ['j X_S I_A = j ' + X_S + ' × ' + polar(I_RATED, th) + ' = ' + polar(X_S * I_RATED, th + 90) + '\\t{ V}', '90° ahead of I_A'],
    ['E_A = V_φ + R_A I_A + j X_S I_A = ' + f1(o.er) + ' + j ' + f1(o.ei) + ' = ' + polar(o.E, o.d) + '\\t{ V}', 'the sum of the three phasors above'],
    ['\\t{VR} = \\frac{' + f1(o.E) + ' − ' + f1(V_PHI) + '}{' + f1(V_PHI) + '} × 100\\t{ %} = ' + sg(o.VR) + '\\t{ %}', 'lengths only']];
  eqs.append(rel('p', 'ftitle', pfTxt(th) + ', ' + S_RATED_MVA + ' MVA · V_φ = ' + polar(V_PHI, 0) + ' V'));
  L.forEach(([src, note], i) => { if (step > i) eqs.append(el('div', {class: 'step' + (f === 'w' + (i + 1) ? ' on' : '') + (i === 4 ? ' res' : '')}, [mathEl(src), rel('span', 'note', note)])); });
  if (st.table) {
    $('fig').setAttribute('hidden', '');
    const col = k => { const q = op(TH[k]); return [exName(k), f1(q.E), deg1(q.d), sg(q.VR) + ' %', f1(S_RATED_MVA * Math.cos(TH[k] * DEG)) + ' / ' + f1(3 * V_PHI * q.E / X_S / 1e6)]; };
    const cols = [['', '|E_A| (V)', 'δ', 'VR', 'P / P_{max} (MW)']].concat(['lag', 'unity', 'lead'].map(col));
    const tbl = el('table', {class: 'cmp'});
    for (let r = 0; r < cols[0].length; r++) tbl.append(el('tr', {}, cols.map((c, j) => rel(r === 0 || j === 0 ? 'th' : 'td', '', c[r]))));
    eqs.append(tbl);
    return;
  }
  const M = MINI, fig = figReset(M.h, 'Phasor diagram for the worked example at ' + pfTxt(th));
  fig.append(sv('line', {x1: M.axisX0, y1: M.oy, x2: M.axisX1, y2: M.oy, stroke: C.axis}));
  // worked steps 1–2 show V_φ and I_A, step 3 adds the drops, step 4 adds E_A and the |V_φ| arc
  const g = phasors(fig, {o, th, ox: M.ox, oy: M.oy, k: M.k, xs: X_S, iLen: M.iLen, gap: M.gap, step: step >= 4 ? 5 : step >= 3 ? 4 : step >= 1 ? 2 : 0, vc: step >= 4, arc: M.arc, fs: FS_SMALL, w: M.w});
  if (step >= 1) fig.append(stext(g.vx + 8, M.oy + 18, 'V_φ', {weight: 700, size: FS_SMALL, fill: C.vphi}));
}
// Slide 8: the key equations as cards, then the summary line.
function figKeys() {
  const eqs = $('eqs'), f = st.focus || '';
  $('fig').setAttribute('hidden', '');
  const K = [['\\t{VR} = \\frac{V_{nl} − V_{fl}}{V_{fl}} × 100\\t{ %}', 'V_{nl} = |E_A|,  V_{fl} = |V_φ|  (field and speed held)'],
    ['E_A = V_φ + R_A I_A + j X_S I_A', 'only |E_A| enters VR; δ drops out'],
    ['\\t{VR} = 0\\t{  when  }sin φ = \\frac{X_S I_A}{2 V_φ}', 'R_A neglected; φ = leading angle of I_A. Lag, unity: VR > 0. Leading past this: VR < 0']];
  K.forEach(([src, note], i) => { if (st.step > i) eqs.append(el('div', {class: 'kcard' + (f === 'k' + (i + 1) ? ' on' : '')}, [mathEl(src), rel('span', 'note', note)])); });
  if (st.step >= 4) {
    const v = k => sg(op(TH[k]).VR) + ' %';
    eqs.append(rel('p', 'sumline', S_RATED_MVA + ' MVA:  *' + exName('lag') + ' ' + v('lag') + '   ·   unity ' + v('unity') + '   ·   ' + exName('lead') + ' ' + v('lead') + '   ·   VR = 0 at ' + pfTxt(TH_X) + '*'));
  }
}
// Lab and Experiments: phasors with both circles (top) and the VR curve with the operating point (bottom).
function figLab() {
  const ra = lab.ra ? R_A : 0, o = op(lab.th, lab.sf, lab.xs, ra);
  const fig = figReset(FIG_H, 'Lab phasor diagram and VR curve at ' + pfTxt(lab.th) + ': E_A ' + polar(o.E, o.d) + ' V, VR ' + sg(o.VR) + ' %');
  const F = LABF, {ox, oy, k} = F;
  fig.append(stext(PAD, F.titleY, 'Phasors, per phase, to scale · ' + pfTxt(lab.th) + ', ' + mva(lab.sf) + ' MVA, X_S = ' + lab.xs + ' Ω', {weight: 700}),
    sv('line', {x1: F.axisX0, y1: oy, x2: F.axisX1, y2: oy, stroke: C.axis}));
  // colour key in one row; each entry advances by its sample, its text (estimated width) and a gap
  [['V_φ', C.vphi, ''], ['I_A (direction)', C.ia, DASH_I], ['jX_SI_A', C.ink, ''], ['E_A', C.ea, '']].reduce((x, [name, col, dash]) => {
    keyRow(fig, x, F.keyY, col, dash, name, W_BOLD);
    return x + KEY_TEXT + 14 + name.replace(/[_{}]/g, '').length * FS_SMALL * 0.56;
  }, PAD);
  if (lab.open) fig.append(stext(RIGHT, F.openY, 'Breaker OPEN: terminal = |E_A|', {anchor: 'end', weight: 700, size: FS_SMALL, fill: C.vphi}));
  const g = phasors(fig, {o, th: lab.th, ox, oy, k, xs: lab.xs, iLen: F.iLen, step: 5, dim: e => (lab.open && e !== 'E' && e !== 'loc') ? DIM : 1, loc: true, vc: true, arc: F.arc, w: F.w, tags: false});
  fig.append(stext(g.vx + 8, oy + 18, 'V_φ = ' + f1(V_PHI) + ' V', {weight: 700, size: FS_SMALL, fill: C.vphi}),
    stext(RIGHT, F.keyY, 'E_A = ' + polar(o.E, o.d) + ' V', {anchor: 'end', weight: 700, fill: C.ea}));
  const ax = vrAxes(fig, F.x0, F.x1, F.y0, F.y1, F.vmin, F.vmax, F.ticks, [[-TH_PLOT, '0.5 lag', 'start'], [0, 'unity'], [TH_PLOT, '0.5 lead', 'end']]);
  fig.append(stext(F.x1, F.y0 - 8, 'VR against power factor', {anchor: 'end', weight: 700, size: FS_SMALL}),
    sv('path', {d: vrPath(ax, lab.sf, lab.xs, ra), fill: 'none', stroke: C.amber, 'stroke-width': W_CURVE}),
    sv('circle', {cx: ax.xm(cross(lab.sf, lab.xs, ra)), cy: ax.ym(0), r: MARK_R, fill: C.white, stroke: C.amber, 'stroke-width': W_LINE}),
    sv('circle', {cx: ax.xm(lab.th), cy: ax.ym(o.VR), r: DOT_R, fill: C.amber}));
}

/* ═══ 7. SLIDES ═══ */
// Each slide: left (text blocks), init and lines (figure state per narration line, where at = [fraction of the clip, state change]
// and sw = [from angle, to angle, fraction of the clip] sweeps the power factor), build (makes the controls and returns their
// refresh function) and draw (the figure).
const MODEL_NOTE = 'Numbers from the same model as every slide: ' + V_LINE + ' V Y, ' + S_RATED_MVA + ' MVA, R_A = ' + R_A + ' Ω, X_S = ' + X_S + ' Ω. Phasors to scale; the I_A arrow shows direction only.';
const WORK_KEY = 'S = ' + S_RATED_MVA + ' MVA, so |I_A| = ' + f1(I_RATED) + ' A. V_φ = ' + polar(V_PHI, 0) + ' V is the reference. Find E_A, then compare lengths.';
const EQ_EA = 'E_A = V_φ + R_A I_A + j X_S I_A', EQ_VR = '\\t{VR} = \\frac{|E_A| − |V_φ|}{|V_φ|} × 100\\t{ %}';
// Controls shared by the three worked-example slides.
function workedBuild(box) {
  const step = row('Step');
  add(box, [step.row, stepButtons(1), rel('p', 'small', MODEL_NOTE)]);
  return () => { step.val.textContent = Math.min(st.step, BUILD_STEPS) + ' of ' + BUILD_STEPS; };
}
// A worked-example slide for one of the three loads.
function workedSlide(n, k, extra, lines) {
  return {left: [['eyebrow', n + ' OF 8 · WORKED EXAMPLE'], ['h2', (k === 'unity' ? 'Unity' : PF_EX + (k === 'lag' ? ' lagging' : ' leading')) + ': VR = ' + sg(op(TH[k]).VR) + ' %'],
    ['key', WORK_KEY], ['eq', EQ_EA], ['eq', EQ_VR]].concat(extra),
    init: {step: BUILD_STEPS, k}, lines, build: workedBuild, draw: figWorked};
}
const WORK_LINES = [1, 2, 3, 4, 5].map(i => ({s: {step: i, focus: 'w' + i}, cue: 0}));
const SL = [
  { // 1
    left: [['eyebrow', '1 OF 8 · WHAT VR MEASURES'], ['h2', 'Remove full load and hold the field. What happens to the terminal voltage?'],
      ['key', 'With the breaker open there is no current and no drop, so the terminal voltage becomes |E_A| and stays there. Voltage regulation is that change, as a percentage of the full-load voltage.'],
      ['watch', ['|E_A| vs terminal at full load', 'Open the breaker', 'Leading: terminal above E_A']],
      ['p', '*It tells the engineer:* how far the terminal voltage moves when the load goes and nobody touches the field, so how much the field must be adjusted to hold the voltage.'],
      ['p', '*The sign depends on the load:* lagging and unity give a rise; a leading load gives a fall. Slide 3 shows why.']],
    init: {k: 'lag', open: false},
    lines: [{s: {k: 'lag', open: false, focus: 'both'}, cue: 1},
      {s: {k: 'lag', open: false, focus: 'brk'}, cue: 2, at: [[0.12, {open: true, focus: 'term'}], [0.75, {focus: 'vr'}]]},
      {s: {k: 'unity', open: false, focus: 'both'}, cue: 1, at: [[0.62, {open: true, focus: 'vr'}]]},
      {s: {k: 'lead', open: false, focus: 'gap'}, cue: 3},
      {s: {k: 'lead', open: false, focus: 'brk'}, cue: 2, at: [[0.08, {open: true, focus: 'term'}], [0.7, {focus: 'vr'}]]},
      {s: {k: 'lead', open: true, focus: '', sum: true}, cue: 0}],
    build(box) {
      const pf = pfButtons(k => { stop(); st = {k, open: false}; render(); }), brk = row('Breaker'), fld = row('Field I_F / I_{F,nl}'), s = row('Load S');
      const b = button('', 'btn primary', () => { stop(); st.open = !st.open; st.focus = ''; st.sum = false; render(); });
      s.val.textContent = S_RATED_MVA + ' MVA (rated)';
      add(box, [el('div', {text: 'Load power factor'}), pf.box, s.row, brk.row, fld.row, b,
        rel('p', 'small', 'Model: per phase, first order, steady state; R_A = ' + R_A + ' Ω, X_S = ' + X_S + ' Ω, no saturation. No voltage regulator: the field stays where it was set for full load. Field shown relative to the field that gives rated voltage at no load; unsaturated, so I_F ∝ |E_A| and I_F/I_{F,nl} = 1 + VR. Using a control pauses the narration.')]);
      return () => {
        pf.mark(st.k);
        brk.val.textContent = st.open ? 'open' : 'closed';
        fld.val.textContent = fieldTxt(op(TH[st.k]).E);
        b.textContent = st.open ? 'Close the breaker (apply full load)' : 'Open the breaker (remove the load)';
      };
    },
    draw: figOneLine
  },
  { // 2
    left: [['eyebrow', '2 OF 8 · WHERE THE NUMBERS COME FROM'], ['h2', 'Build E_A from the terminal voltage and the load current'],
      ['key', 'VR compares the no-load and full-load terminal voltages. At no load the terminal is |E_A|, so we find E_A at full load with phasors.'],
      ['eq', '\\t{VR} = \\frac{V_{nl} − V_{fl}}{V_{fl}} × 100\\t{ %}'], ['eq', EQ_EA],
      ['watch', ['jX_SI_A is 90° ahead of I_A', 'Only the lengths matter', 'The field sets E_A']],
      ['p', '*Same S, different pf:* |I_A| = ' + f1(I_RATED) + ' A every time; the field is reset each time to hold |V_φ| = ' + f1(V_PHI) + ' V, so E_A differs.']],
    init: {k: 'lag', step: BUILD_STEPS},
    lines: [{s: {k: 'lag', step: 0, focus: 'eq'}, cue: 0}, {s: {k: 'lag', step: 1, focus: 'V'}, cue: 0}, {s: {k: 'lag', step: 2, focus: 'I'}, cue: 0},
      {s: {k: 'lag', step: 3, focus: 'R'}, cue: 0}, {s: {k: 'lag', step: 4, focus: 'X'}, cue: 1}, {s: {k: 'lag', step: 5, focus: 'E'}, cue: 2},
      {s: {k: 'lag', step: 5, focus: 'E'}, cue: 3, at: [[0.45, {k: 'unity'}], [0.62, {k: 'lead'}], [0.85, {k: 'lag'}]]}],
    build(box) {
      const pf = pfButtons(k => { stop(); st.k = k; st.focus = ''; render(); }), stp = row('Build step'), ea = row('|E_A|'), dl = row('δ'), fld = row('Field I_F / I_{F,nl}');
      add(box, [el('div', {text: 'Load power factor'}), pf.box, stp.row, stepButtons(0), ea.row, dl.row, fld.row,
        rel('p', 'small', 'Phasors to scale except the direction arrow for I_A (direction only). R_AI_A = ' + f1(R_A * I_RATED) + ' V is drawn but is too short to see at this scale.')]);
      return () => {
        const o = op(TH[st.k]), done = st.step >= BUILD_STEPS;
        pf.mark(st.k);
        stp.val.textContent = Math.min(st.step, BUILD_STEPS) + ' of ' + BUILD_STEPS;
        ea.val.textContent = done ? f1(o.E) + ' V' : '—';
        dl.val.textContent = done ? deg1(o.d) : '—';
        fld.val.textContent = done ? fieldTxt(o.E) : '—';
      };
    },
    draw: () => figPhasor(false)
  },
  { // 3
    left: [['eyebrow', '3 OF 8 · WHY THE SIGN CHANGES'], ['h2', 'The tip of E_A moves on a circle. Which side of |V_φ| does it end?'],
      ['key', 'S is fixed, so |I_A| and the drop |Z_SI_A| are fixed. The power factor only turns the drop, so the tip of E_A slides on a circle about the tip of V_φ.'],
      ['watch', ['The locus circle', 'The |V_φ| circle', 'Outside: +, inside: −']],
      ['p', '*Outside* the dashed circle: |E_A| > |V_φ|, VR > 0 (lagging, unity, slightly leading).'],
      ['p', '*On* it: VR = 0, at ' + fmt(Math.cos(TH_X * DEG), 3) + ' leading for this machine and load.'], ['p', '*Inside*: VR < 0.']],
    init: {th: TH.lag},
    lines: [{s: {th: TH.lag, loc: 0, vc: 0, focus: 'I'}, cue: 0}, {s: {th: TH.lag, loc: 1, vc: 0, focus: 'loc'}, cue: 1, sw: [-60, 60, 0.85]},
      {s: {th: 60, loc: 1, vc: 1, focus: 'vc'}, cue: 2, sw: [60, TH.lag, 0.5]}, {s: {th: -60, loc: 1, vc: 1, focus: 'E'}, cue: 3, sw: [-60, TH.lag, 0.6]},
      {s: {th: TH.lag, loc: 1, vc: 1, focus: 'E'}, cue: 3, sw: [TH.lag, 0, 0.6]}, {s: {th: 0, loc: 1, vc: 1, focus: 'x'}, cue: 3, sw: [0, TH_X, 0.75]},
      {s: {th: TH_X, loc: 1, vc: 1, focus: 'E'}, cue: 3, sw: [TH_X, 60, 0.6]}],
    build(box) {
      const pf = pfSlider(th => { stop(); st.th = th; st.loc = 1; st.vc = 1; st.focus = ''; render(); });
      const ea = row('|E_A|'), vr = row('VR'), fld = row('Field I_F / I_{F,nl}'), s = row('Load S');
      s.val.textContent = S_RATED_MVA + ' MVA (rated)';
      add(box, pf.nodes.concat([ea.row, vr.row, fld.row, s.row,
        rel('p', 'small', 'Field relative to rated-voltage no-load field (unsaturated: = |E_A|/|V_φ| = 1 + VR). Locus radius |Z_S||I_A| = ' + f1(Math.hypot(R_A, X_S) * I_RATED) + ' V. VR = 0 at ' + pfTxt(TH_X) + ' (R_A included).')]));
      return () => {
        const o = op(st.th);
        pf.set(st.th);
        ea.val.textContent = f1(o.E) + ' V';
        vr.val.textContent = sg(o.VR) + ' %';
        fld.val.textContent = fieldTxt(o.E);
      };
    },
    draw: () => figPhasor(true)
  },
  { // 4
    left: [['eyebrow', '4 OF 8 · WHEN VR = 0'], ['h2', 'The crossover: |E_A| = |V_φ|'],
      ['key', 'Neglecting R_A, VR = 0 when sin φ = X_SI_A / (2V_φ), with φ the leading angle of I_A. Heavier load or larger X_S moves the crossover further into leading.'],
      ['watch', ['Square and add', fmt(Math.cos(Math.asin(X_S * I_RATED / (2 * V_PHI))), 3) + ' lead (' + fmt(Math.cos(TH_X * DEG), 3) + ' with R_A)', 'Half load: ' + pfTxt(cross(0.5))]],
      ['p', '*Caution:* no saturation in this model. A real machine\'s VR is smaller; the sign behaves the same way.']],
    init: {step: 5, sf: 1, half: 1},
    lines: [{s: {step: 0, focus: '', half: 0}, cue: 0}, {s: {step: 1, focus: 'e1', half: 0}, cue: 1}, {s: {step: 2, focus: 'e2', half: 0}, cue: 1}, {s: {step: 3, focus: 'e3', half: 0}, cue: 1},
      {s: {step: 4, focus: 'e4', half: 0}, cue: 2}, {s: {step: 4, focus: 'plot', half: 1, sf: 0.5}, cue: 3}, {s: {step: 4, focus: '', half: 1, sf: 0.5}, cue: 0}],
    build(box) {
      const val = el('span', {class: 'val'}), x = row('VR = 0 at'), fm = row('R_A = 0 formula');
      const s = slider(SF_MIN, SF_MAX, SF_STEP, 'Load as a fraction of rated S', v => { stop(); st.sf = v; st.half = 1; st.focus = ''; render(); });
      add(box, [el('div', {class: 'row'}, [el('span', {text: 'Load S'}), val]), s, x.row, fm.row,
        rel('p', 'small', 'The plot\'s orange curve follows this slider; the grey curve is full load.')]);
      return () => {
        s.value = st.sf;
        val.textContent = Math.round(st.sf * 100) + ' % (' + mva(st.sf) + ' MVA)';
        s.setAttribute('aria-valuetext', val.textContent);
        x.val.textContent = pfTxt(cross(st.sf));
        fm.val.textContent = fmt(Math.cos(Math.asin(X_S * I_RATED * st.sf / (2 * V_PHI))), 3) + ' lead';
      };
    },
    draw: figCrossover
  },
  workedSlide(5, 'lag', [], WORK_LINES),
  workedSlide(6, 'unity', [], WORK_LINES),
  workedSlide(7, 'lead', [['p', '*Closer to the stability limit:* at ' + PF_EX + ' lead, δ = ' + deg1(op(TH.lead).d) + ' and P_{max} = 3|V_φ||E_A|/X_S = ' + f1(3 * V_PHI * op(TH.lead).E / X_S / 1e6) + ' MW against P = ' + f1(S_RATED_MVA * PF_EX) + ' MW (Lecture 2).']],
    WORK_LINES.concat([{s: {step: 5, focus: 'tab', table: 1}, cue: 0}])),
  { // 8
    left: [['eyebrow', '8 OF 8 · KEY EQUATIONS'], ['h2', 'What to take away'],
      ['key', 'VR is the change in terminal voltage when full load is removed with field and speed held. Its sign is set by the load\'s power factor.'],
      ['p', 'Next: the *Lab* tab (change load, power factor, X_S; open the breaker) and the *Experiments* tab.']],
    init: {step: 4},
    lines: [{s: {step: 1, focus: 'k1'}, cue: 0}, {s: {step: 2, focus: 'k2'}, cue: 0}, {s: {step: 3, focus: 'k3'}, cue: 0}, {s: {step: 4, focus: ''}, cue: 0}],
    build(box) { box.append(el('p', {class: 'small', text: 'No controls on this slide.'})); return () => {}; },
    draw: figKeys
  }];
// Build the text column from a list of blocks.
function buildLeft(blocks) {
  const left = $('left');
  left.replaceChildren();
  for (const [kind, body] of blocks) {
    if (kind === 'eq') left.append(el('div', {class: 'eq'}, mathEl(body)));
    else if (kind === 'watch') { left.append(el('p', {class: 'eyebrow gap', text: 'WATCH'})); body.forEach((c, i) => { const s = rel('span', 'cue', c); s.dataset.c = i + 1; left.append(s); }); }
    else left.append(rel(kind === 'h2' ? 'h2' : kind === 'key' ? 'div' : 'p', kind === 'eyebrow' || kind === 'key' || kind === 'small' ? kind : '', body));
  }
  left.scrollTop = 0;
}

/* ═══ 8. PLAYER ═══ */
let mode = 'lec';                       // page: 'lec', 'lab' or 'exp'
let si = 0, line = 0;                   // slide and narration line, zero-based
let st = {};                            // figure state of the current slide
let update = () => {};                  // refreshes the current slide's controls
let playing = false, voice = true;      // narration running; voice on (false = timed captions only)
let raf = 0, fitRaf = 0, fired = [];    // animation-frame handles (narration, caption fit); 'at' events already applied on this line
const audio = new Audio();
// Draw the current slide: controls, equations and figure. One call per interaction or animation frame.
function render() {
  update();
  $('eqs').replaceChildren();
  SL[si].draw();
  $('lineNo').textContent = 'line ' + (line + 1) + ' of ' + SL[si].lines.length;
  $('slPos').textContent = (si + 1) + '/' + SL.length;
}
// Stop any narration and reset the play buttons.
function stop() {
  playing = false;
  cancelAnimationFrame(raf);
  audio.onended = null;
  audio.pause();
  $('play').textContent = '▶ Play narration';
  for (const b of document.querySelectorAll('[data-listen]')) b.textContent = b.dataset.listen;
}
// Play one clip (or time its text when the voice is off). The tick callback runs every frame with the time and the duration; done runs at the end.
function playClip(clip, text, tick, done) {
  cancelAnimationFrame(raf);
  audio.onended = null;
  audio.pause();
  const finish = () => { cancelAnimationFrame(raf); audio.onended = null; tick(1, 1); done(); };
  if (voice) {
    audio.src = clip;
    audio.onended = finish;
    audio.play().catch(() => { if (!playing) return; setVoice(false); $('voiceMsg').removeAttribute('hidden'); playClip(clip, text, tick, done); });
    const loop = () => { if (audio.duration) tick(audio.currentTime, audio.duration); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  } else {
    const dur = text.split(/\s+/).length / WPM * 60, t0 = performance.now();      // seconds
    const loop = () => { const t = (performance.now() - t0) / 1000; if (t >= dur) { finish(); return; } tick(t, dur); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
}
// Switch the voice on or off.
function setVoice(on) {
  voice = on;
  $('voice').textContent = on ? 'voice on' : 'voice off';
  $('voice').setAttribute('aria-pressed', String(on));
}
// Advance the current line's figure to time t of dur: progress bar, timed state changes and power-factor sweep.
function tick(t, dur) {
  const L = SL[si].lines[line];
  let changed = false;
  $('bar').style.width = Math.min(100, t / dur * 100) + '%';
  (L.at || []).forEach((e, j) => { if (!fired[j] && t >= e[0] * dur) { fired[j] = true; Object.assign(st, e[1]); changed = true; } });
  if (L.sw) { const [a, b, fr] = L.sw; st.th = a + (b - a) * Math.min(1, t / (fr * dur)); changed = true; }
  if (changed) render();
}
// Play the current line, then the next, to the end of the slide.
function playLine() {
  playing = true;
  $('play').textContent = '❚❚ Pause';
  playClip(CLIPS.slides[si][line], SAY.slides[si][line], tick, () => { if (line < SL[si].lines.length - 1) { setLine(line + 1); playLine(); } else stop(); });
}
// Show narration line i of the current slide in its starting state.
function setLine(i) {
  const S = SL[si];
  line = Math.max(0, Math.min(S.lines.length - 1, i));
  st = Object.assign({}, S.init, S.lines[line].s);
  fired = [];
  setRich($('cap'), disp(SAY.slides[si][line]));
  $('bar').style.width = '0';
  for (const c of document.querySelectorAll('.cue')) c.classList.toggle('on', Number(c.dataset.c) === S.lines[line].cue);
  render();
}
// Show slide i from its first line.
function setSlide(i) {
  stop();
  si = Math.max(0, Math.min(SL.length - 1, i));
  buildLeft(SL[si].left);
  $('ctl').replaceChildren();
  st = Object.assign({}, SL[si].init);
  update = SL[si].build($('ctl'));
  fitCaption(SAY.slides[si]);
  setLine(0);
}
// Play a list of Lab or Experiments lines in order, driven by the given Listen button.
function playSeq(key, idx, btn) {
  stop();
  playing = true;
  btn.textContent = '❚❚ Stop';
  let i = 0;
  const next = () => {
    if (i >= idx.length) { stop(); return; }
    const n = idx[i++];
    setRich($('cap'), disp(SAY[key][n]));
    playClip(CLIPS[key][n], SAY[key][n], () => {}, next);
  };
  next();
}

/* ═══ 9. LAB ═══ */
let lab = {th: TH.lag, sf: 1, xs: X_S, ra: true, open: false};   // Lab operating point and breaker
let labUpdate = () => {};                                        // refreshes the Lab controls
const LAB_LEFT = [['eyebrow', 'LAB · VOLTAGE REGULATION'], ['h2', 'Change the load and the machine'],
  ['key', 'Each setting is a new full-load operating point: the field is set to give |V_φ| = ' + f1(V_PHI) + ' V. Open the breaker to remove that load with the field held.'],
  ['p', '*Top:* phasors to scale, with the locus of the E_A tip (grey dotted) and the |V_φ| circle (red dashed). Outside the red circle: VR > 0.'],
  ['p', '*Bottom:* VR against power factor for the present load and X_S; the dot is your operating point.'],
  ['p', '*Field:* I_F/I_{F,nl} = |E_A|/|V_φ| = 1 + VR (no saturation).'],
  ['small', 'Machine: ' + V_LINE + ' V Y, ' + S_RATED_MVA + ' MVA rated, 60 Hz. No voltage regulator; steady state only.']];
// Build the Lab controls and readouts in the controls column.
function labBuild() {
  const box = $('ctl');
  box.replaceChildren();
  const pf = pfSlider(th => { lab.th = th; labRender(); }), sVal = el('span', {class: 'val'});
  const sS = slider(SF_MIN, SF_MAX, SF_STEP, 'Load apparent power', v => { lab.sf = v; labRender(); });
  const xs = seg(XS_CHOICES.map(v => [v, v + ' Ω']), v => { lab.xs = v; labRender(); }, 'Synchronous reactance');
  const ra = seg([[true, 'in'], [false, 'ignored']], v => { lab.ra = v; labRender(); }, 'Armature resistance');
  const brk = button('', 'btn primary', () => { lab.open = !lab.open; labRender(); });
  const vt = row('Terminal voltage'), ea = row('|E_A|, δ'), vr = row('VR'), fld = row('Field I_F/I_{F,nl}'), x0 = row('VR = 0 at'), pp = row('P / P_{max}');
  const warn = el('p', {class: 'warn', role: 'status', text: 'δ ≥ ' + DELTA_LIMIT + '°: past the steady-state stability limit. This operating point cannot be held (Lecture 2).'});
  add(box, pf.nodes.concat([el('div', {class: 'row'}, [el('span', {text: 'Load S'}), sVal]), sS,
    el('div', {class: 'row'}, [rel('span', '', 'X_S'), xs.box]), el('div', {class: 'row'}, [rel('span', '', 'R_A = ' + R_A + ' Ω'), ra.box]),
    brk, vt.row, ea.row, vr.row, fld.row, x0.row, pp.row, warn]));
  labUpdate = () => {
    const r = lab.ra ? R_A : 0, o = op(lab.th, lab.sf, lab.xs, r);
    pf.set(lab.th);
    sS.value = lab.sf;
    sVal.textContent = mva(lab.sf) + ' MVA';
    sS.setAttribute('aria-valuetext', sVal.textContent);
    xs.mark(lab.xs);
    ra.mark(lab.ra);
    brk.textContent = lab.open ? 'Close the breaker (apply the load)' : 'Open the breaker (remove the load)';
    vt.val.textContent = f1(lab.open ? o.E : V_PHI) + ' V';
    ea.val.textContent = f1(o.E) + ' V, ' + deg1(o.d);
    vr.val.textContent = sg(o.VR) + ' %';
    fld.val.textContent = fieldTxt(o.E);
    x0.val.textContent = pfTxt(cross(lab.sf, lab.xs, r));
    pp.val.textContent = f1(S_RATED_MVA * lab.sf * Math.cos(lab.th * DEG)) + ' / ' + f1(3 * V_PHI * o.E / lab.xs / 1e6) + ' MW';
    warn.hidden = o.d < DELTA_LIMIT;
  };
}
// Redraw the Lab controls and figure. One call per interaction.
function labRender() {
  labUpdate();
  $('eqs').replaceChildren();
  figLab();
}

/* ═══ 10. EXPERIMENTS ═══ */
// Each experiment: title, Lab set-up, task and answer. The answers are the filed number check for this model.
const EXP = [
  {t: 'E1 · Where is VR = 0?', set: {th: 0, sf: 1, xs: X_S, ra: true, open: false},
    task: 'Start at unity. Move the power factor toward leading until VR = 0. Read the power factor; then check it with sin φ = X_SI_A/(2V_φ) from slide 4.',
    ans: 'VR = 0 at *0.885 leading*. The formula (R_A neglected): sin φ = 2,151.2 / 4,803.6 = 0.448 → φ = 26.6° → *0.894 leading*. The small difference is R_A.'},
  {t: 'E2 · Half load', set: {th: TH.lag, sf: 0.5, xs: X_S, ra: true, open: false},
    task: 'Load S = 1.25 MVA. Find VR at 0.85 lag, unity and 0.85 lead, and the new VR = 0 point. Explain the change.',
    ans: '*+29.9 %, +10.4 %, −13.8 %*; VR = 0 at *0.970 leading*. Half the current halves the drop X_SI_A, so for lagging loads E_A is closer to V_φ and VR is smaller; sin φ = X_SI_A/(2V_φ) halves, so the crossover moves toward unity, and at 0.85 lead the regulation is more negative.'},
  {t: 'E3 · The machine: X_S', set: {th: TH.lag, sf: 1, xs: XS_CHOICES[0], ra: true, open: false},
    task: 'Full load. Find VR at 0.85 lag, unity and 0.85 lead with X_S = 3.1 Ω, then 9.3 Ω. Which machine regulates its voltage better? Does the answer depend on the load?',
    ans: 'X_S = 3.1 Ω: *+30.5, +11.2, −12.9 %* (VR = 0 at 0.965 lead). X_S = 9.3 Ω: *+106.2, +68.5, +19.1 %* (VR = 0 at 0.732 lead). For lagging and unity loads the smaller X_S regulates much better. At 0.85 lead it gives the larger |VR| (−12.9 % vs −5.7 % at 6.2 Ω), so "better" depends on the load; most loads lag.'},
  {t: 'E4 · Does R_A matter?', set: {th: TH.lag, sf: 1, xs: X_S, ra: false, open: false},
    task: 'R_A ignored. Find VR at 0.85 lag, unity and 0.85 lead and compare with slides 5–7.',
    ans: '*+65.7, +34.2, −7.3 %* against +66.6, +35.5, −5.7 % with R_A. R_A moves VR by at most 1.6 percentage points; X_S dominates. VR = 0 moves from 0.885 to 0.894 leading.'},
  {t: 'E5 · Leading load and stability', set: {th: TH.lead, sf: 1, xs: XS_CHOICES[2], ra: true, open: false},
    task: 'X_S = 9.3 Ω, full load. Move toward leading. At what power factor does δ reach 90° and the red warning appear? What is the field current there?',
    ans: 'δ = 90° at *0.658 leading* (on the slider, between 0.660 and 0.655): |E_A| = 2,154.6 V, field *0.90 ×* its no-load value (under-excited), VR = −10.3 %. With X_S = 6.2 Ω, δ is only 63.3° even at 0.5 leading. A leading load needs a weak field, and a weak field with a large X_S pushes the machine to its stability limit (Lecture 2).'}];
let ex = 0;                             // experiment shown, zero-based
// Show the current experiment in the text column.
function expRender() {
  const e = EXP[ex], left = $('left');
  const pick = seg(EXP.map((q, i) => [i, 'E' + (i + 1)]), i => { stop(); ex = i; expRender(); }, 'Experiment');
  const ans = rel('div', 'answer', e.ans), listen = button('▶ Listen', 'btn', () => { if (playing) stop(); else playSeq('exp', [ex], listen); });
  const show = button('Show answer', 'btn wide', () => { ans.hidden = !ans.hidden; show.textContent = ans.hidden ? 'Show answer' : 'Hide answer'; });
  ans.hidden = true;
  listen.dataset.listen = '▶ Listen';
  pick.mark(ex);
  left.replaceChildren(el('p', {class: 'eyebrow', text: 'EXPERIMENTS · ' + (ex + 1) + ' OF ' + EXP.length}), pick.box, rel('h2', '', e.t), rel('div', 'key', e.task),
    el('div', {class: 'seg wide'}, [button('Set up the Lab', 'btn', () => { stop(); lab = Object.assign({}, e.set); labRender(); }), listen]),
    show, ans, el('p', {class: 'small', text: 'Work it in the Lab panel on the right, write your answer down, then check it.'}));
  left.scrollTop = 0;
  setRich($('cap'), disp(SAY.exp[ex]));
}

/* ═══ 11. PAGES AND START ═══ */
// Reserve caption height for the longest of the given lines, so the figure does not resize between lines.
function fitCaption(lines) {
  const cap = $('cap'), m = $('capMeasure');
  let h = 0;
  m.style.width = cap.clientWidth + 'px';
  for (const t of lines) { setRich(m, disp(t)); h = Math.max(h, m.offsetHeight); }
  m.replaceChildren();
  cap.style.minHeight = h + 'px';
}
// Narration lines whose captions the current page can show.
function pageLines() { return mode === 'lec' ? SAY.slides[si] : mode === 'lab' ? SAY.lab : SAY.exp; }
// Show a page: 'lec' (Lecture), 'lab' (Lab) or 'exp' (Experiments).
function setMode(m) {
  stop();
  mode = m;
  for (const b of document.querySelectorAll('nav.tabs button')) b.setAttribute('aria-pressed', String(b.dataset.page === m));
  $('transport').hidden = m !== 'lec';
  if (m === 'lec') { setSlide(si); return; }
  labBuild();
  fitCaption(pageLines());
  if (m === 'lab') {
    buildLeft(LAB_LEFT);
    const lb = button('▶ Listen: how to use the Lab', 'btn wide', () => { if (playing) stop(); else playSeq('lab', [0, 1, 2], lb); });
    lb.dataset.listen = '▶ Listen: how to use the Lab';
    $('left').append(lb);
    setRich($('cap'), disp(SAY.lab[0]));
  } else expRender();
  labRender();
}
for (const b of document.querySelectorAll('nav.tabs button')) b.addEventListener('click', () => setMode(b.dataset.page));
$('play').addEventListener('click', () => { if (playing) { stop(); return; } setLine(line); playLine(); });
$('prev').addEventListener('click', () => { const p = playing; stop(); setLine(line - 1); if (p) playLine(); });
$('next').addEventListener('click', () => { const p = playing; stop(); setLine(line + 1); if (p) playLine(); });
$('slPrev').addEventListener('click', () => setSlide(si - 1));
$('slNext').addEventListener('click', () => setSlide(si + 1));
$('voice').addEventListener('click', () => { setVoice(!voice); $('voiceMsg').setAttribute('hidden', ''); if (playing) playLine(); });
window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fitCaption(pageLines())); });
setSlide(0);
