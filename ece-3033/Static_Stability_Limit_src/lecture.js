
/* ════════════════════════════════════════════════════════════════════════
   LECTURE (new in v2.0.0). One block: its helpers (el, arrow, …) are separate from the Lab's above; it uses the Lab's
   model (eAt, pMaxAt, point, flowLec), number formats (f, kw) and constants.
   ════════════════════════════════════════════════════════════════════════ */
{
/* ═══ L1. CONSTANTS ═══ */
const IF_FIX = IF_START, IF_HIGH = 8;   // A, the fixed field of slides 1, 2 and 4; the raised field of slides 1, 5 and 6
const P_FIX = 20;                       // MW, the fixed power of slides 5 and 6
const FLOW_P = 25;                      // MW, input power of the slide-2 power flow
const PROOF = {pm: 15, iF: 7};          // MW and A, the one operating point of the slide-3 proof
const RAMPS = [[15, 15], [15, 25], [25, 30], null, [30, 30], [15, 15]];   // MW, slide 1: input power from … to on each narration line
const RAMP_FR = 0.75;                   // fraction of a clip over which a slide-1 ramp runs
const P_OVER = [30, 32], OVER_AT = 0.25;   // MW, slide 1 line 4: the input rises past P_max in the first quarter of the clip, then δ runs away
const P_STEP4 = [15, 15, 15, 0, 30, 30];   // MW, slide 4: power shown on lines 1–6 (line 4 climbs from 0 to P_max)
const CLIMB_FR = 0.85, RAISE_FR = 0.8;  // fraction of the clip for the slide-4 climb and for the slide-5 field rise
const SLIP_GAIN = 40, SLIP_MIN_MW = 4;  // run-away: degrees/s² per MW of surplus power, and the least surplus used (illustrative)
const SLIP_END = 450;                   // degrees, the breaker trips here: one pole slip past 90°
const RAD = Math.PI / 180;              // radians per degree
const WPM = 150;                        // reading pace used to time a line when the voice is off, words/min
const FIG_W = 640, FIG_H = 450;         // full figure viewBox, user units
const FS = 16, FS_SMALL = 15;           // figure text sizes, user units
const SUB_SCALE = 0.75, SUB_DROP = 0.28;// subscript size and drop, as fractions of the text size
const HEAD = 11;                        // arrow-head length, user units
const C = {ink: '#1b1f24', mute: '#55606b', grid: '#e3e7eb', axis: '#c9d0d6', vphi: '#c62828', ea: '#1e56c8', ia: '#1b7a3a', amber: '#9a5b00',
  teal: '#0f6b63', white: '#ffffff', box: '#f6f8fa', drop: '#3a444b', band: '#e3f0ee'};
const MMLNS = 'http://www.w3.org/1998/Math/MathML';
const NBSP = '\u00a0';                  // no-break space (MathML collapses ordinary spaces in text)
const SAY = __SAY__;                    // narration text: {slides: [[line, …] × 7], lab: [3]}
const CLIPS = __CLIPS__;                // the same shape; one mp3 data URI per line (en-GB-SoniaNeural, −4 %)
// Equations, in the source form read by mathEl.
const EQ = {pconv: 'P_{conv} = P_{in} − P_{stray} − P_{\\t{F&W}} − P_{core}', pout: 'P_{out} = P_{conv} − 3 I_A^2 R_A', ea: 'E_A = V_φ × \\frac{I_F}{5.00\\t{ A}}',
  pin: 'P_{in} = τ_{app} ω_m', kvl: 'E_A = V_φ + j X_S I_A', vert: 'E_A sin δ = X_S I_A cos θ', icos: 'I_A cos θ = \\frac{E_A sin δ}{X_S}', p: 'P = \\frac{3 V_φ E_A sin δ}{X_S}',
  pmax: 'P_{max} = \\frac{3 V_φ E_A}{X_S}\\t{  at }δ = 90°', tau: 'τ_{max} = \\frac{P_{max}}{ω_m}', band: '\\t{normal }δ ≈ \\t{20°–30°}', dd: 'δ = \\t{arcsin }\\frac{P}{P_{max}}'};

/* ═══ L2. MODEL AND FORMAT ═══ */
// Lecture state: input power (MW), field current (A), torque angle δ (degrees), rotor running away, breaker tripped, narration
// driving the figure, and the student's own slider values on slides 4 and 5 (null until moved).
const T = {pin: 15, iF: IF_FIX, d: 30, slip: false, trip: false, live: false, user4: null, user5: null};
// Steady torque angle in degrees for power p (MW) at field current iF (A); 90° at or above P_max.
function dFor(p, iF) { const m = pMaxAt(iF); return p <= m ? Math.asin(p / m) / RAD : 90; }
// Power factor text of an operating point: "0.901 lag", "unity", "0.894 lead".
function pfTxt(p) { return Math.abs(p.Q) < 0.05 ? 'unity' : f(p.pf, 3) + (p.Q > 0 ? ' lag' : ' lead'); }
// Narration text to caption markup: spoken symbol names become symbols.
function disp(t) {
  return t.replace(/j X S I A/g, 'jX_SI_A').replace(/X S I A/g, 'X_SI_A').replace(/\bE A\b/g, 'E_A').replace(/\bV phi\b/g, 'V_φ').replace(/\bX S\b/g, 'X_S').replace(/\bR A\b/g, 'R_A')
    .replace(/\bI A\b/g, 'I_A').replace(/M V A/g, 'MVA').replace(/G three/g, 'G3').replace(/\bP max\b/g, 'P_{max}').replace(/\btau max\b/g, 'τ_{max}').replace(/\bomega m\b/g, 'ω_m');
}

/* ═══ L3. DOM HELPERS (every node is created with createElement and filled with text nodes; no HTML strings) ═══ */
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
  const out = [], rx = /\*|([A-Za-zφτω])_(\{[^}]*\}|[A-Za-z0-9φ])|\^(\{[^}]*\}|\d)/g;
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
// Show the figure with a viewBox of the given height and an accessible name, emptied.
function figReset(h, label) {
  const fig = $('fig');
  fig.setAttribute('aria-label', label);
  fig.removeAttribute('hidden');
  fig.setAttribute('viewBox', '0 0 ' + FIG_W + ' ' + h);
  fig.replaceChildren();
  return fig;
}
// Arc of radius r about (cx, cy) from angle a0 to a1 in radians (the Lab's arcPath), added to g.
function arc(g, cx, cy, r, a0, a1, col) { g.append(sv('path', {d: arcPath(cx, cy, r, a0, a1), fill: 'none', stroke: col, 'stroke-width': W_FINE})); }

/* ═══ L4. FIGURES ═══ */
// Layout in figure user units (viewBox FIG_W wide): x from the left edge, y down from the top.
const ONE = {y: 58, pmX: 30, pmW: 96, pmH: 48, gX: 250, gR: 34, brkX: 420, brkGap: 36, busX: 560, busH: 34};   // slide 1 one-line: wire height, prime-mover box, G3 circle, breaker, bus
const PD1 = {x0: 62, x1: 402, y0: 400, y1: 190, pTop: 42, pStep: 10, dStep: 30, keyY: 132, keyRow: 24, keyX2: 210, keyX3: 270, barX: [470, 548], barW: 52};   // slide 1 curve box, power axis top (MW), legend row, bars
const FLOW = {y: 190, boxH: 80, pm: [20, 100], rotor: [250, 120], arm: [470, 100], busX: 606, lossX: [266, 310, 354], lossTextX: 310, copperX: 520, effY: 410};   // slide 2
const PRF = {ox: 70, oy: 360, k: 40, iLen: 150, thR: 60, dR: 110, tipR: 36, noteY: 60};   // slide 3: origin, px per kV, I_A arrow length, arc radii
const ARC4 = {ox: 36, oy: 330, k: 23};                                    // slide 4 phasor: origin and px per kV
const PD4 = {x0: 392, x1: 620, y0: 330, y1: 110, pTop: 36, pStep: 10, dStep: 45, liveY: 404};   // slide 4 curve box
const FLD = {ox: 50, oy: 346, k: 34, iK: 0.13, unityY: 68, sideY: 90, lineY: 124};   // slide 5: origin, px per kV, px per A of I_A, label rows
const PD6 = {h: 296, x0: 70, x1: 600, y0: 250, y1: 40, pTop: 42, pStep: 10, dStep: 30};   // slide 6 curve
const W_FINE = 1.5, W_LINE = 2, W_CURVE = 3, W_PHASOR = 3.5, W_SHAFT = 6, W_FLOW = 10;   // stroke widths
const DASH = '6 4', DASH_GHOST = '7 5', DASH_FINE = '4 4';                // dash patterns
const DOT_R = 7, NODE_R = 4;                                              // operating point and joint radii
const GHOST = 0.55;                                                       // opacity of the dashed comparison curve and phasor
// Power–angle axes in the box B (x0…x1, y0 bottom, y1 top, pTop MW): grid, ticks and axis names. Returns the scale functions.
function pdAxes(fig, B, pName) {
  const xd = d => B.x0 + (B.x1 - B.x0) * d / 180, yp = p => B.y0 - (B.y0 - B.y1) * p / B.pTop;
  for (let p = 0; p <= B.pTop; p += B.pStep) fig.append(sv('line', {x1: B.x0, x2: B.x1, y1: yp(p), y2: yp(p), stroke: C.grid}), stext(B.x0 - 8, yp(p) + 5, String(p), {anchor: 'end', size: FS_SMALL, fill: C.mute}));
  for (let d = 0; d <= 180; d += B.dStep) fig.append(stext(xd(d), B.y0 + 21, d + '°', {anchor: 'middle', size: FS_SMALL, fill: C.mute}));
  fig.append(sv('path', {d: 'M' + B.x0 + ',' + (B.y1 - 6) + 'V' + B.y0 + 'H' + (B.x1 + 8), fill: 'none', stroke: C.ink, 'stroke-width': W_FINE}),
    stext(B.x0, B.y1 - 8, pName, {size: FS_SMALL, fill: C.mute}), stext(B.x1 + 8, B.y0 + 40, 'torque angle δ', {anchor: 'end', size: FS_SMALL, fill: C.mute}));
  return {xd, yp};
}
// Path of P = pm·sin δ from 0° to 180° on the axes ax.
function pdPath(ax, pm) {
  let d = '';
  for (let a = 0; a <= 180; a += 2) d += (a ? 'L' : 'M') + ax.xd(a).toFixed(1) + ',' + ax.yp(pm * Math.sin(a * RAD)).toFixed(1);
  return d;
}
// The normal band of δ (20° to 30°) on the axes ax in the box B.
function pdBand(fig, ax, B) { fig.append(sv('rect', {x: ax.xd(BAND_LO), y: B.y1, width: ax.xd(BAND_HI) - ax.xd(BAND_LO), height: B.y0 - B.y1, fill: C.band})); }
// Slide 1: one-line diagram (prime mover, G3 with its rotor pointer, breaker, infinite bus), P–δ curve at 6.00 A and P_in / P_out bars.
function figLimit() {
  const i = line, d = T.d, pm = pMaxAt(IF_FIX), dd = ((d % 360) + 360) % 360, pout = T.trip ? 0 : Math.max(0, pm * Math.sin(d * RAD)), W = ONE, B = PD1;
  const fig = figReset(FIG_H, 'G3 on the infinite bus: input ' + f(T.pin, 1) + ' MW, output ' + f(pout, 1) + ' MW, ' + (T.trip ? 'breaker open after a pole slip' : 'torque angle ' + f(dd, T.slip ? 0 : 1) + ' degrees'));
  const y = W.y, gL = W.gX - W.gR, gRt = W.gX + W.gR, wire = (x1, x2) => sv('line', {x1, x2, y1: y, y2: y, stroke: C.ink, 'stroke-width': W_FINE});
  fig.append(sv('rect', {x: W.pmX, y: y - W.pmH / 2, width: W.pmW, height: W.pmH, rx: 6, fill: C.box, stroke: C.ink, 'stroke-width': W_FINE}),
    stext(W.pmX + W.pmW / 2, y - 5, 'Prime', {anchor: 'middle'}), stext(W.pmX + W.pmW / 2, y + 16, 'mover', {anchor: 'middle'}),
    sv('line', {x1: W.pmX + W.pmW, x2: gL, y1: y, y2: y, stroke: C.ink, 'stroke-width': W_SHAFT}),
    sv('circle', {cx: W.gX, cy: y, r: W.gR, fill: C.white, stroke: C.ink, 'stroke-width': W_LINE + 0.5}),
    sv('line', {x1: W.gX, y1: y - W.gR + 4, x2: W.gX, y2: y - W.gR - 6, stroke: C.mute, 'stroke-width': W_FINE}),
    sv('line', {x1: W.gX, y1: y, x2: W.gX + (W.gR - 6) * Math.sin(d * RAD), y2: y - (W.gR - 6) * Math.cos(d * RAD), stroke: C.ea, 'stroke-width': 4, 'stroke-linecap': 'round'}),
    sv('circle', {cx: W.gX, cy: y, r: NODE_R, fill: C.ink}), stext(W.gX, y + W.gR + 19, 'G3', {anchor: 'middle', weight: 700}),
    stext(gRt + 8, y + W.gR + 4, T.trip ? '' : 'δ = ' + f(dd, T.slip ? 0 : 1) + '°', {fill: C.ea, weight: 700}),
    wire(gRt, W.brkX), sv('line', {x1: W.brkX, y1: y, x2: W.brkX + W.brkGap - (T.trip ? 8 : 0), y2: T.trip ? y - 22 : y, stroke: T.trip ? C.vphi : C.ink, 'stroke-width': 3}),
    wire(W.brkX + W.brkGap, W.busX), sv('line', {x1: W.busX, x2: W.busX, y1: y - W.busH, y2: y + W.busH, stroke: C.ink, 'stroke-width': 4}),
    stext(W.busX + 8, y - 5, 'infinite', {size: FS_SMALL, fill: C.mute}), stext(W.busX + 8, y + 16, 'bus', {size: FS_SMALL, fill: C.mute}),
    stext(W.brkX + W.brkGap / 2, y + 24, T.trip ? 'breaker OPEN' : 'breaker', {anchor: 'middle', size: FS_SMALL, fill: T.trip ? C.vphi : C.mute, weight: T.trip ? 700 : 400}),
    stext((W.pmX + gL) / 2, y - 38, 'P_{in} ' + f(T.pin, 1) + ' MW →', {anchor: 'middle', fill: C.amber, weight: 700}),
    stext((gRt + W.brkX) / 2, y - 14, 'P_{out} ' + f(pout, 1) + ' MW →', {anchor: 'middle', fill: C.ea, weight: 700}));
  // curve
  if (i === 5 && !T.trip) { pdBand(fig, {xd: a => B.x0 + (B.x1 - B.x0) * a / 180}, B); }
  const ax = pdAxes(fig, B, 'P_{out} (MW)'), yIn = ax.yp(T.pin);
  if (i === 5 && !T.trip) fig.append(stext(ax.xd((BAND_LO + BAND_HI) / 2), B.y0 - 6, 'normal', {anchor: 'middle', size: FS_SMALL, fill: C.teal}));
  const row2 = B.keyY + B.keyRow;                                        // second legend row: the 8.00 A curve and the margin (line 6)
  if (i === 5) fig.append(sv('path', {d: pdPath(ax, pMaxAt(IF_HIGH)), fill: 'none', stroke: C.ea, 'stroke-width': W_LINE, 'stroke-dasharray': DASH_GHOST, opacity: GHOST}),
    sv('line', {x1: B.x0, x2: B.x0 + 26, y1: row2 - 5, y2: row2 - 5, stroke: C.ea, 'stroke-width': W_LINE, 'stroke-dasharray': DASH_GHOST, opacity: GHOST}),
    stext(B.x0 + 32, row2, f(IF_HIGH, 2) + ' A: P_{max} ' + f(pMaxAt(IF_HIGH), 1) + ' MW', {size: FS_SMALL, fill: C.mute}));
  fig.append(sv('path', {d: pdPath(ax, pm), fill: 'none', stroke: C.ea, 'stroke-width': W_CURVE}),
    sv('line', {x1: B.x0, x2: B.x0 + 26, y1: B.keyY - 5, y2: B.keyY - 5, stroke: C.ea, 'stroke-width': W_CURVE}), stext(B.x0 + 32, B.keyY, 'I_F = ' + f(IF_FIX, 2) + ' A', {size: FS_SMALL, fill: C.mute}),
    sv('line', {x1: B.x0, x2: B.x1, y1: yIn, y2: yIn, stroke: C.amber, 'stroke-width': W_LINE, 'stroke-dasharray': DASH}),
    stext(B.x1 + 14, yIn - 5, 'P_{in}', {size: FS_SMALL, fill: C.amber, weight: 700}));
  if (i >= 2) fig.append(sv('line', {x1: ax.xd(90), x2: ax.xd(90), y1: ax.yp(0), y2: ax.yp(pm), stroke: C.amber, 'stroke-width': W_FINE, 'stroke-dasharray': DASH_FINE}),
    stext(B.keyX2, B.keyY, 'P_{max} = ' + f(pm, 1) + ' MW at 90°', {fill: C.amber, weight: 700}));
  if (i === 5 && !T.trip) { const x = ax.xd(d);
    fig.append(sv('line', {x1: x, x2: x, y1: ax.yp(pout) - 9, y2: ax.yp(pm), stroke: C.teal, 'stroke-width': W_CURVE - 0.5}),
      sv('line', {x1: B.keyX3, x2: B.keyX3 + 20, y1: row2 - 5, y2: row2 - 5, stroke: C.teal, 'stroke-width': W_CURVE - 0.5}),
      stext(B.keyX3 + 28, row2, 'margin ' + f(pm - pout, 1) + ' MW', {size: FS_SMALL, fill: C.teal, weight: 700})); }
  if (!T.trip && dd <= 180) fig.append(sv('circle', {cx: ax.xd(dd), cy: ax.yp(Math.max(0, pm * Math.sin(dd * RAD))), r: DOT_R, fill: C.ea, stroke: C.white, 'stroke-width': W_LINE}));
  if (T.trip || T.slip) fig.append(stext((B.x0 + B.x1) / 2 + 60, ax.yp(38), T.trip ? 'Pole slip · breaker trip' : 'δ running away', {anchor: 'middle', fill: C.vphi, weight: 700}));
  // bars
  const [bi, bo] = B.barX, hi = ax.yp(Math.min(T.pin, B.pTop)), ho = ax.yp(pout);
  fig.append(sv('line', {x1: bi - 14, x2: bo + B.barW + 14, y1: B.y0, y2: B.y0, stroke: C.ink, 'stroke-width': W_FINE}), stext(bi - 10, B.y1 - 10, 'Power (MW)', {size: FS_SMALL, fill: C.mute}),
    sv('rect', {x: bi, y: hi, width: B.barW, height: B.y0 - hi, fill: C.amber}), sv('rect', {x: bo, y: ho, width: B.barW, height: B.y0 - ho, fill: C.ea}),
    stext(bi + B.barW / 2, hi - 6, f(T.pin, 1), {anchor: 'middle', weight: 700}), stext(bo + B.barW / 2, ho - 6, f(pout, 1), {anchor: 'middle', weight: 700}),
    stext(bi + B.barW / 2, B.y0 + 21, 'P_{in}', {anchor: 'middle'}), stext(bo + B.barW / 2, B.y0 + 21, 'P_{out}', {anchor: 'middle'}));
  return [f(T.pin, 1) + ' MW', f(IF_FIX, 2) + ' A (fixed)', f(eAt(IF_FIX), 2) + ' kV', T.trip ? '—' : T.slip ? f(dd, 0) + '° ↑' : f(d, 1) + '°', f(pout, 1) + ' MW', f(pm, 1) + ' MW', T.trip ? '—' : f(pm - pout, 1) + ' MW'];
}
// Slide 2: where the power goes at 25 MW and 6.00 A (v1.2.0 loss model flowLec); the losses appear line by line. Widths not to scale.
function figFlow() {
  const i = line, F = flowLec(FLOW_P, IF_FIX), L = FLOW, y = L.y, fig = figReset(FIG_H, 'Power flow through G3: input ' + f(F.pin, 1) + ' MW, output ' + f(F.po, 2) + ' MW');
  const box = ([x, w], t1, t2) => fig.append(sv('rect', {x, y: y - L.boxH / 2, width: w, height: L.boxH, rx: 8, fill: C.box, stroke: C.ink, 'stroke-width': W_FINE}),
    stext(x + w / 2, y - 4, t1, {anchor: 'middle', weight: 700}), stext(x + w / 2, y + 15, t2, {anchor: 'middle', size: FS_SMALL, fill: C.mute}));
  const two = (x, t1, t2, col) => fig.append(stext(x, y - 38, t1, {anchor: 'middle', fill: col, weight: 700}), stext(x, y - 15, t2, {anchor: 'middle', fill: col, weight: 700}));
  const loss = (x, tx, row, txt) => { arrow(fig, x, y + L.boxH / 2 + 2, x, y + 96, C.vphi, 3); fig.append(stext(tx, y + 116 + 19 * row, txt, {anchor: 'middle', size: FS_SMALL, fill: C.vphi, weight: 700})); };
  box(L.pm, 'Prime', 'mover'); box(L.rotor, 'Rotor', 'air gap'); box(L.arm, 'Armature', 'stator');
  fig.append(sv('line', {x1: L.busX, x2: L.busX, y1: y - 50, y2: y + 50, stroke: C.ink, 'stroke-width': 4}), stext(L.busX, y + 68, 'bus', {anchor: 'middle', size: FS_SMALL, fill: C.mute}));
  arrow(fig, L.pm[0] + L.pm[1] + 4, y, L.rotor[0] - 6, y, C.amber, W_FLOW); two((L.pm[0] + L.pm[1] + L.rotor[0]) / 2, 'P_{in}', f(F.pin, 1) + ' MW', C.amber);
  if (i >= 1) { arrow(fig, L.rotor[0] + L.rotor[1] + 4, y, L.arm[0] - 6, y, C.ea, W_FLOW); two((L.rotor[0] + L.rotor[1] + L.arm[0]) / 2, 'P_{conv}', f(F.pconv, 2) + ' MW', C.ea);
    loss(L.lossX[0], L.lossTextX, 0, 'F&W ' + kw(F.fw)); loss(L.lossX[1], L.lossTextX, 1, 'core ' + kw(F.core)); loss(L.lossX[2], L.lossTextX, 2, 'stray ' + kw(F.stray)); }
  if (i >= 2) { arrow(fig, L.arm[0] + L.arm[1] + 4, y, L.busX - 4, y, C.ea, W_FLOW); fig.append(stext(L.arm[0] + L.arm[1] + 60, y - 60, 'P_{out} ' + f(F.po, 2) + ' MW', {anchor: 'end', fill: C.ea, weight: 700}));
    loss(L.copperX, L.copperX, 0, 'copper ' + kw(F.copper)); }
  if (i >= 3) fig.append(stext(FIG_W / 2, L.effY, 'P_{out} / P_{in} = ' + f(F.eff * 100, 1) + ' %   →   ignore the losses: P_{in} = P_{out} = P', {anchor: 'middle', fill: C.teal, weight: 700}));
  return [f(F.pin, 1) + ' MW', f(IF_FIX, 2) + ' A', kw(F.fw + F.core + F.stray), kw(F.copper), f(F.pconv, 2) + ' MW', f(F.po, 2) + ' MW', f(F.eff * 100, 1) + ' %'];
}
// Slide 3: the proof at 15 MW and 7.00 A, to scale, built step by step: the vertical from the tip of E_A read in two right triangles.
function figProof() {
  const i = line, E = eAt(PROOF.iF), p = point(Math.asin(PROOF.pm / pMaxAt(PROOF.iF)), E), G = PRF, ox = G.ox, oy = G.oy;
  const fig = figReset(FIG_H, 'Phasor diagram of G3 at ' + f(PROOF.pm, 1) + ' MW and ' + f(PROOF.iF, 2) + ' A: E_A ' + f(E, 2) + ' kV at ' + f(p.d / RAD, 1) + ' degrees');
  const v = k => i === 0 || i === 7 || i >= k, vx = ox + V_PH * G.k, ex = ox + E * Math.cos(p.d) * G.k, ey = oy - p.vert * G.k, ix = ox + G.iLen * Math.cos(p.th), iy = oy - G.iLen * Math.sin(p.th);
  fig.append(sv('line', {x1: 40, x2: 600, y1: oy, y2: oy, stroke: C.axis}));
  if (v(4)) fig.append(sv('polygon', {points: ox + ',' + oy + ' ' + ex + ',' + ey + ' ' + ex + ',' + oy, fill: C.ea, opacity: 0.12}));
  if (v(6)) fig.append(sv('polygon', {points: vx + ',' + oy + ' ' + ex + ',' + ey + ' ' + ex + ',' + oy, fill: C.drop, opacity: 0.16}));
  if (v(1)) { arrow(fig, ox, oy, vx, oy, C.vphi, W_PHASOR); arrow(fig, ox, oy, ix, iy, C.ia, W_CURVE); arc(fig, ox, oy, G.thR, 0, p.th, C.ia);
    fig.append(stext((ox + vx) / 2 + 40, oy + 24, 'V_φ = ' + f(V_PH, 2) + ' kV', {anchor: 'middle', fill: C.vphi, weight: 700}), stext(ix + 8, iy + 16, 'I_A', {fill: C.ia, weight: 700}), stext(ox + G.thR + 10, oy + 19, 'θ', {fill: C.ia})); }
  if (v(2)) { arrow(fig, vx, oy, ex, ey, C.drop, W_CURVE); fig.append(stext((vx + ex) / 2 - 28, (oy + ey) / 2 + 32, 'jX_SI_A', {anchor: 'end', fill: C.drop, weight: 700})); }
  if (v(3)) { arrow(fig, ox, oy, ex, ey, C.ea, W_PHASOR); arc(fig, ox, oy, G.dR, 0, p.d, C.ea);
    fig.append(stext((ox + ex) / 2 - 16, (oy + ey) / 2 - 16, 'E_A = ' + f(E, 2) + ' kV', {anchor: 'end', fill: C.ea, weight: 700}), stext(ox + G.dR + 8, oy - 20, 'δ', {fill: C.ea})); }
  if (v(4)) fig.append(sv('line', {x1: ex, x2: ex, y1: ey, y2: oy, stroke: C.amber, 'stroke-width': 3, 'stroke-dasharray': DASH}), stext(ex + 10, (ey + oy) / 2 + 5, f(p.vert, 2) + ' kV', {fill: C.amber, weight: 700}),
    stext(FIG_W / 2, G.noteY, 'blue triangle: vertical = E_A sin δ', {anchor: 'middle', fill: C.ea, weight: 700}));
  if (v(5)) { arc(fig, ex, ey, G.tipR, -Math.PI / 2, -Math.PI / 2 + p.th, C.ia); fig.append(stext(ex - 11, ey + G.tipR + 24, 'θ', {anchor: 'middle', weight: 700})); }
  if (v(6)) fig.append(stext(FIG_W / 2, G.noteY + 24, 'grey triangle: vertical = X_SI_A cos θ', {anchor: 'middle', fill: C.drop, weight: 700}));
  return [f(PROOF.pm, 1) + ' MW', f(PROOF.iF, 2) + ' A', f(E, 2) + ' kV', f(p.d / RAD, 1) + '°', f(p.I * 1e3, 0) + ' A', f(-p.th / RAD, 1) + '°', f(p.vert, 2) + ' kV', f(X_S * p.I * p.pf, 2) + ' kV'];
}
// Slide 4: E_A on its arc at 6.00 A beside the P–δ curve, with the substituted line of the present derivation step under them.
function figPeak() {
  const i = line, E = eAt(IF_FIX), pm = pMaxAt(IF_FIX), p = point(T.d * RAD, E), A = ARC4, B = PD4, ex = A.ox + E * Math.cos(p.d) * A.k, ey = A.oy - p.vert * A.k, vx = A.ox + V_PH * A.k;
  const fig = figReset(FIG_H, 'E_A on its arc and the power–angle curve at ' + f(IF_FIX, 2) + ' A: ' + f(p.P, 1) + ' MW at ' + f(T.d, 1) + ' degrees');
  fig.append(stext(A.ox, 60, 'E_A on its arc (field fixed)', {size: FS_SMALL, fill: C.mute}), sv('line', {x1: 20, x2: 330, y1: A.oy, y2: A.oy, stroke: C.axis}));
  fig.append(sv('path', {d: arcPath(A.ox, A.oy, E * A.k, 0, Math.PI / 2), fill: 'none', stroke: C.ea, 'stroke-width': W_FINE, 'stroke-dasharray': DASH_FINE, opacity: 0.6}));
  arrow(fig, A.ox, A.oy, vx, A.oy, C.vphi, W_CURVE); arrow(fig, vx, A.oy, ex, ey, C.drop, W_CURVE - 0.5); arrow(fig, A.ox, A.oy, ex, ey, C.ea, W_PHASOR);
  fig.append(stext(A.ox, A.oy + 22, 'V_φ', {fill: C.vphi, weight: 700}), stext((A.ox + ex) / 2 - 10, (A.oy + ey) / 2 - 10, 'E_A', {anchor: 'end', fill: C.ea, weight: 700}),
    sv('line', {x1: ex, x2: ex, y1: ey, y2: A.oy, stroke: C.amber, 'stroke-width': 3, 'stroke-dasharray': DASH}));
  fig.append(stext(Math.max(ex, A.ox + 76), A.oy + 22, 'E_A sin δ', {anchor: 'middle', size: FS_SMALL, fill: C.amber, weight: 700}));
  if (i >= 6) pdBand(fig, {xd: a => B.x0 + (B.x1 - B.x0) * a / 180}, B);
  const ax = pdAxes(fig, B, 'P (MW)');
  fig.append(sv('path', {d: pdPath(ax, pm), fill: 'none', stroke: C.ea, 'stroke-width': W_CURVE}));
  if (i >= 4) fig.append(stext(ax.xd(90), ax.yp(pm) - 16, 'P_{max} = ' + f(pm, 1) + ' MW', {anchor: 'middle', fill: C.amber, weight: 700}));
  fig.append(sv('circle', {cx: ax.xd(T.d), cy: ax.yp(p.P), r: DOT_R - 1, fill: C.ea, stroke: C.white, 'stroke-width': W_LINE}));
  const V = f(V_PH, 2), Ev = f(E, 2), X = f(X_S, 2), dg = f(T.d, 1);
  fig.append(stext(FIG_W / 2, B.liveY, ['E_A sin δ = ' + Ev + ' × sin ' + dg + '° = ' + f(p.vert, 2) + ' kV', 'I_A cos θ = ' + f(p.ir * 1e3, 0) + ' A', 'P = 3 × ' + V + ' × ' + Ev + ' × sin ' + dg + '° / ' + X + ' = ' + f(p.P, 1) + ' MW',
    'P = ' + f(p.P, 1) + ' MW at δ = ' + dg + '°', 'P_{max} = 3 × ' + V + ' × ' + Ev + ' / ' + X + ' = ' + f(pm, 1) + ' MW', 'τ_{max} = ' + f(pm, 1) + ' MW / ' + f(W_M, 1) + ' rad/s = ' + f(pm * 1e3 / W_M, 1) + ' kN·m',
    'δ = ' + dg + '°; margin = P_{max} − P = ' + f(pm - p.P, 1) + ' MW'][i], {anchor: 'middle', weight: 700}));
  return [f(T.pin, 1) + ' MW', f(IF_FIX, 2) + ' A (fixed)', Ev + ' kV', dg + '°', f(pm, 1) + ' MW', f(pm * 1e3 / W_M, 1) + ' kN·m', f(pm - p.P, 1) + ' MW'];
}
// Slide 5: 20 MW fixed, so the tip of E_A slides on a horizontal line as the field changes; unity power factor where it passes over the tip of V_φ.
function figField() {
  const i = line, E = eAt(T.iF), p = point(T.d * RAD, E), G = FLD, ox = G.ox, oy = G.oy, hy = oy - P_FIX * X_S / (3 * V_PH) * G.k, vx = ox + V_PH * G.k, ex = ox + E * Math.cos(p.d) * G.k;
  const fig = figReset(FIG_H, 'G3 at ' + f(P_FIX, 1) + ' MW and ' + f(T.iF, 2) + ' A: E_A ' + f(E, 2) + ' kV, torque angle ' + f(T.d, 1) + ' degrees, power factor ' + pfTxt(p));
  fig.append(sv('line', {x1: 30, x2: 620, y1: oy, y2: oy, stroke: C.axis}), sv('line', {x1: vx - 40, x2: 620, y1: hy, y2: hy, stroke: C.amber, 'stroke-width': W_LINE, 'stroke-dasharray': DASH}),
    stext(620, G.lineY - 8, 'E_A sin δ = ' + f(P_FIX * X_S / (3 * V_PH), 2) + ' kV (P = ' + P_FIX + ' MW)', {anchor: 'end', size: FS_SMALL, fill: C.amber}));
  if (i >= 3 || i === 0) fig.append(sv('line', {x1: vx, x2: vx, y1: G.unityY + 6, y2: oy, stroke: C.teal, 'stroke-width': W_FINE, 'stroke-dasharray': '3 3'}),
    stext(vx, G.unityY, 'unity pf (' + f(IF_RATED * Math.hypot(V_PH, P_FIX * X_S / (3 * V_PH)) / V_PH, 2) + ' A)', {anchor: 'middle', size: FS_SMALL, fill: C.teal, weight: 700}),
    stext(vx - 12, G.sideY, '← leading', {anchor: 'end', size: FS_SMALL, fill: C.teal}), stext(vx + 12, G.sideY, 'lagging →', {size: FS_SMALL, fill: C.teal}));
  arrow(fig, ox, oy, vx, oy, C.vphi, W_CURVE);
  fig.append(stext(vx - 10, oy + 22, 'V_φ', {anchor: 'end', fill: C.vphi, weight: 700}));
  if (i >= 2 && Math.abs(T.iF - IF_FIX) > 0.05) { const q = point(dFor(P_FIX, IF_FIX) * RAD, eAt(IF_FIX)); arrow(fig, ox, oy, ox + q.E * Math.cos(q.d) * G.k, hy, C.ea, W_LINE, {dash: '5 4', opacity: GHOST}); }
  const il = G.iK * p.I * 1e3, ix = ox + il * Math.cos(p.th), iy = oy - il * Math.sin(p.th);
  arrow(fig, vx, oy, ex, hy, C.drop, W_CURVE - 0.5); arrow(fig, ox, oy, ex, hy, C.ea, W_PHASOR); arrow(fig, ox, oy, ix, iy, C.ia, W_CURVE);
  fig.append(ex > vx ? stext(ex + 10, hy + 24, 'E_A = ' + f(E, 2) + ' kV', {fill: C.ea, weight: 700}) : stext(ex, hy - 10, 'E_A = ' + f(E, 2) + ' kV', {anchor: 'end', fill: C.ea, weight: 700}), stext(ix + 8, iy + (p.th < 0 ? 18 : -8), 'I_A', {fill: C.ia, weight: 700}));
  return [f(P_FIX, 1) + ' MW (fixed)', f(T.iF, 2) + ' A', f(E, 2) + ' kV', f(T.d, 1) + '°', pfTxt(p), f(p.Q, 1) + ' Mvar', f(pMaxAt(T.iF), 1) + ' MW', f(pMaxAt(T.iF) - P_FIX, 1) + ' MW'];
}
// The three worked cases of slide 6: 20 MW at 5.00, 6.00 and 8.00 A.
const CASES = [IF_RATED, IF_FIX, IF_HIGH].map(iF => { const d = dFor(P_FIX, iF), p = point(d * RAD, eAt(iF)); return {iF, E: eAt(iF), pm: pMaxAt(iF), d, margin: pMaxAt(iF) - P_FIX, p}; });
// Slide 6: the three curves with their operating points at 20 MW, and the table under them, one row per narration line.
function figCases() {
  const i = line, B = PD6, fig = figReset(B.h, 'Power–angle curves at ' + CASES.map(c => f(c.iF, 2)).join(', ') + ' A with the operating points at ' + P_FIX + ' MW'), shown = k => i === 0 || i === 4 || i >= k + 1;
  pdBand(fig, {xd: a => B.x0 + (B.x1 - B.x0) * a / 180}, B);
  const ax = pdAxes(fig, B, 'P (MW)'), yP = ax.yp(P_FIX);
  fig.append(stext(ax.xd((BAND_LO + BAND_HI) / 2), B.y0 - 6, 'normal', {anchor: 'middle', size: FS_SMALL, fill: C.teal}),
    sv('line', {x1: B.x0, x2: B.x1, y1: yP, y2: yP, stroke: C.amber, 'stroke-width': W_LINE, 'stroke-dasharray': DASH}), stext(B.x1, yP - 7, 'P = ' + P_FIX + ' MW', {anchor: 'end', size: FS_SMALL, fill: C.amber, weight: 700}));
  CASES.forEach((c, k) => { if (!shown(k)) return;
    fig.append(sv('path', {d: pdPath(ax, c.pm), fill: 'none', stroke: C.ea, 'stroke-width': k === 2 ? W_CURVE : W_LINE + 0.2, opacity: [0.5, 0.75, 1][k]}),
      sv('circle', {cx: ax.xd(c.d), cy: yP, r: DOT_R - 1, fill: C.ea, stroke: C.white, 'stroke-width': W_LINE}), stext(ax.xd(90), ax.yp(c.pm) - 7, 'I_F = ' + f(c.iF, 2) + ' A', {anchor: 'middle', size: FS_SMALL, fill: C.ea, weight: 700})); });
  const tbl = el('table', {class: 'cmp'}, el('tr', {}, ['I_F', 'E_A', 'P_{max}', 'δ at ' + P_FIX + ' MW', 'Margin', 'pf'].map(h => rel('th', '', h))));
  CASES.forEach((c, k) => tbl.append(el('tr', {class: (i === k + 1 ? 'lit' : '') + (shown(k) ? '' : ' wait')}, [f(c.iF, 2) + ' A', f(c.E, 2) + ' kV', f(c.pm, 1) + ' MW', f(c.d, 1) + '°', f(c.margin, 1) + ' MW', pfTxt(c.p)].map(t => el('td', {text: t})))));
  $('below').append(tbl);
  const one = i >= 1 && i <= 3, c = CASES[Math.min(2, Math.max(0, i - 1))], or = (t) => one ? t : '—';
  return [f(P_FIX, 1) + ' MW', one ? f(c.iF, 2) + ' A' : 'all three', or(f(c.E, 2) + ' kV'), or(f(c.pm, 1) + ' MW'), or(f(c.d, 1) + '°'), or(f(c.margin, 1) + ' MW'), or(pfTxt(c.p))];
}
// Slide 7: the ten key equations in two columns; the left column is lit on line 1 and the right on line 2.
function figKeys() {
  $('fig').setAttribute('hidden', '');
  const grid = el('div', {class: 'eqgrid'}), Lc = ['pconv', 'pout', 'ea', 'pin', 'band'], Rc = ['kvl', 'vert', 'p', 'pmax', 'tau'];
  Lc.forEach((k, n) => grid.append(el('div', {class: 'kcard' + (line === 0 ? ' on' : '')}, mathEl(EQ[k])), el('div', {class: 'kcard' + (line === 1 ? ' on' : '')}, mathEl(EQ[Rc[n]]))));
  $('eqs').append(grid);
  return [];
}

/* ═══ L5. SLIDES ═══ */
// Each slide: title, left (text blocks; an 'eq' block may carry a function of the line number that says when it shows), cues (one per
// narration line), note, rows (readout labels), ctl (a slider: label, min, max, step, scale text, getter, setter), at (sets the state
// of line i at fraction fr of its clip, and returns true when the run-away should start) and draw (the figure, returning the readout values).
const SL = [
  {title: 'How much power can G3 send to the bus?', eyebrow: 'THE STATIC STABILITY LIMIT',
    left: [['key', 'The *static stability limit* is the largest real power a generator can deliver to the bus without losing synchronism, when the load changes slowly.'], ['eq', 'pmax', i => i >= 4]],
    note: 'G3: 25 MVA, 13.8 kV, X_S = ' + f(X_S, 2) + ' Ω, on an infinite bus (V_φ = ' + f(V_PH, 2) + ' kV, 60 Hz). R_A and losses ignored. The pole slip is illustrated, not computed. Transient stability is not modelled.',
    cues: ['Fixed field', 'Climb the curve', 'Peak at 90°', 'Pole slip', 'The limit', 'Margin'],
    rows: ['Input power P_{in}', 'Field current I_F', 'E_A', 'Torque angle δ', 'P_{out} to bus', 'P_{max}', 'Margin'],
    ctl: ['Input power P_{in}', 0, 32, 0.5, ['0', '32 MW'], () => T.pin, v => { T.trip = false; T.slip = false; T.pin = v; if (v > pMaxAt(IF_FIX)) { T.d = 90; runaway(); } else T.d = dFor(v, IF_FIX); }],
    at(i, fr) {
      T.iF = IF_FIX;
      if (i === 3) { T.pin = P_OVER[0] + (P_OVER[1] - P_OVER[0]) * Math.min(1, fr / OVER_AT); if (T.live) { if (!T.slip && !T.trip) T.d = 90; return fr >= OVER_AT; } T.trip = true; T.slip = false; return false; }
      const [a, b] = RAMPS[i]; T.pin = a + (b - a) * Math.min(1, fr / RAMP_FR); T.trip = false; T.slip = false; T.d = dFor(Math.min(T.pin, pMaxAt(IF_FIX)), IF_FIX); return false;
    }, draw: figLimit},
  {title: 'Losses are small: P_{in} ≈ P_{out}', eyebrow: 'WHERE THE POWER GOES',
    left: [['key', 'About ' + f(flowLec(FLOW_P, IF_FIX).eff * 100, 0) + ' % of the input reaches the bus, so from here on R_A and the rotational losses are ignored: P_{in} = P_{out} = P.'], ['eq', 'pconv'], ['eq', 'pout']],
    note: 'Illustrative losses, as v1.2.0: friction and windage ' + kw(LOSS_FW) + ', core ' + kw(LOSS_CORE) + ', stray ' + STRAY_K + ' × P_{out}, copper 3I_A^2R_A with R_A = ' + R_A + ' Ω; G3 at ' + FLOW_P + ' MW, ' + f(IF_FIX, 2) + ' A. Arrow widths not to scale.',
    cues: ['Input', 'Rotational and stray', 'Copper', 'P in = P out'],
    rows: ['Input power P_{in}', 'Field current I_F', 'Rotational + stray', 'Copper 3I_A^2R_A', 'P_{conv}', 'P_{out}', 'Efficiency'],
    at() { T.pin = FLOW_P; T.iF = IF_FIX; return false; }, draw: figFlow},
  {title: 'Why E_A sin δ = X_SI_A cos θ', eyebrow: 'THE PHASOR DIAGRAM',
    left: [['key', 'The vertical from the tip of E_A is a side of two right triangles. Read it in each: the two readings are the same line, so they are equal.'], ['eq', 'kvl', i => i === 0 || i >= 3], ['eq', 'vert', i => i === 0 || i >= 6]],
    note: 'G3 at ' + f(PROOF.pm, 1) + ' MW, I_F = ' + f(PROOF.iF, 2) + ' A. Voltages to one scale; I_A on its own scale.',
    cues: ['Two readings', 'V_φ and I_A', 'jX_SI_A', 'E_A closes', 'E_A sin δ', 'Same θ', 'X_SI_A cos θ', 'The link'],
    rows: ['P', 'Field current I_F', 'E_A', 'δ', 'I_A', 'θ (lagging)', 'E_A sin δ', 'X_SI_A cos θ'],
    at() { T.pin = PROOF.pm; T.iF = PROOF.iF; return false; }, draw: figProof},
  {title: 'More power, fixed field', eyebrow: 'FROM THE DIAGRAM TO P_{max}',
    left: [['key', 'The field is fixed, so |E_A| is fixed and its tip rides an arc. More power raises δ and the height E_A sin δ, which is the power, scaled. It cannot exceed E_A: P peaks at δ = 90°.'], ['steps']],
    note: 'G3 at I_F = ' + f(IF_FIX, 2) + ' A: E_A = ' + f(eAt(IF_FIX), 2) + ' kV, ω_m = ' + f(W_M, 1) + ' rad/s (' + N_SYNC + ' r/min).',
    cues: ['Slide 3', '÷ X_S', 'Substitute', 'Climb the arc', 'Peak at 90°', 'Pull-out torque', 'Normal band'],
    rows: ['Input power P', 'Field current I_F', 'E_A', 'δ', 'P_{max}', 'τ_{max}', 'Margin'],
    ctl: ['Power P (live at line 7)', 0, 28, 0.5, ['0', '28 MW'], () => T.pin, v => { T.user4 = v; setLine(6); }],
    at(i, fr) { T.iF = IF_FIX; T.pin = i === 3 ? pMaxAt(IF_FIX) * Math.min(1, fr / CLIMB_FR) : i === 6 ? (T.user4 === null ? P_FIX : T.user4) : P_STEP4[i]; T.d = dFor(Math.min(T.pin, pMaxAt(IF_FIX)), IF_FIX); return false; },
    draw: figPeak},
  {title: 'More field, fixed power', eyebrow: 'RAISING THE LIMIT',
    left: [['key', 'P is fixed at ' + P_FIX + ' MW, so E_A sin δ is fixed: the tip of E_A slides along a horizontal line. More field lifts P_{max} and lowers δ.'], ['p', 'Left of the unity-pf line G3 runs *leading* (absorbs Q); right of it, *lagging* (supplies Q).']],
    note: 'G3 at ' + P_FIX + ' MW: E_A sin δ = PX_S / 3V_φ = ' + f(P_FIX * X_S / (3 * V_PH), 2) + ' kV. Unity power factor at I_F = ' + f(IF_RATED * Math.hypot(V_PH, P_FIX * X_S / (3 * V_PH)) / V_PH, 2) + ' A (E_A = ' + f(Math.hypot(V_PH, P_FIX * X_S / (3 * V_PH)), 2) + ' kV).',
    cues: ['Fixed height', f(IF_FIX, 2) + ' A', 'Raise to ' + f(IF_HIGH, 2) + ' A', 'Leading | lagging', 'Margin bought'],
    rows: ['Power P', 'Field current I_F', 'E_A', 'δ', 'Power factor', 'Q', 'P_{max}', 'Margin'],
    ctl: ['Field current I_F', 5, 8.5, 0.05, ['5.00', '8.50 A'], () => T.iF, v => { T.user5 = v; setLine(4); }],
    at(i, fr) { T.pin = P_FIX; T.iF = i < 2 ? IF_FIX : i === 2 ? IF_FIX + (IF_HIGH - IF_FIX) * Math.min(1, fr / RAISE_FR) : (T.user5 === null ? IF_HIGH : T.user5); T.d = dFor(P_FIX, T.iF); return false; },
    draw: figField},
  {title: 'The same ' + P_FIX + ' MW at three field currents', eyebrow: 'WORKED CASES',
    left: [['key', 'Two steps for every case: P_{max} from E_A, then δ from P / P_{max}.'], ['eq', 'pmax'], ['eq', 'dd']],
    note: 'G3: V_φ = ' + f(V_PH, 2) + ' kV, X_S = ' + f(X_S, 2) + ' Ω, E_A = V_φI_F / ' + f(IF_RATED, 2) + ' A, R_A ignored. Normal band δ ≈ ' + BAND_LO + '°–' + BAND_HI + '°.',
    cues: ['Method', f(CASES[0].iF, 2) + ' A', f(CASES[1].iF, 2) + ' A', f(CASES[2].iF, 2) + ' A', 'The handle'],
    rows: ['Power P', 'Case', 'E_A', 'P_{max}', 'δ', 'Margin', 'Power factor'],
    at() { T.pin = P_FIX; return false; }, draw: figCases},
  {title: 'Ten lines carry the whole lecture', eyebrow: 'KEY EQUATIONS',
    left: [['key', 'Left: the power flow, the field and the normal range of δ. Right: the phasor diagram, the curve and its peak.']],
    note: 'R_A and rotational losses ignored from slide 3 on.', cues: ['Left column', 'Right column', 'To the Lab'], rows: [],
    at() { return false; }, draw: figKeys}];
// The derivation steps of slide 4, one per narration line: words, equation key (none on the "climb the arc" line) and short form once behind.
const STEPS = [['From slide 3:', 'vert', 'E_A sin δ = X_SI_A cos θ'], ['Divide by X_S:', 'icos', 'I_A cos θ = E_A sin δ / X_S'], ['P = 3V_φI_A cos θ. Substitute:', 'p', 'P = 3V_φE_A sin δ / X_S'], ['', '', ''],
  ['sin δ ≤ 1, so at δ = 90°:', 'pmax', 'P_{max} = 3V_φE_A / X_S'], ['÷ ω_m:', 'tau', 'τ_{max} = P_{max} / ω_m'], ['Real machines run at:', 'band', '']];
// Fill the slide-4 step box for narration line i: earlier steps as one compact line, the present step with its equation.
function showSteps(box, i) {
  const cur = STEPS[i][1] ? i : i - 1, prev = STEPS.slice(0, cur).map((s, k) => s[2] ? (k + 1) + '. ' + s[2] : '').filter(Boolean).join('  ·  ');
  box.replaceChildren(rel('p', 'small', prev), el('div', {class: 'step'}, [rel('span', 'note', (cur + 1) + '. ' + STEPS[cur][0]), mathEl(EQ[STEPS[cur][1]])]));
}

/* ═══ L6. PLAYER ═══ */
let si = 0, line = 0;                   // slide and narration line, zero-based
let playing = false, voice = true;      // narration running; voice on (false = timed captions only)
let raf = 0, fitRaf = 0, runId = 0;     // animation-frame handles (narration, caption fit); id of the present run-away animation
let ui = {vals: [], slider: null, get: null, shows: [], steps: null};   // parts of the present slide that a redraw updates
const player = new Audio();
// Draw the present slide: figure, readouts, slider position, conditional equations. One call per interaction or animation frame.
function render() {
  $('eqs').replaceChildren(); $('below').replaceChildren();
  const vals = SL[si].draw();
  ui.vals.forEach((v, k) => { if (v.textContent !== vals[k]) v.textContent = vals[k]; });
  if (ui.slider) { ui.slider.value = ui.get(); ui.slider.setAttribute('aria-valuetext', String(ui.get())); }
  ui.shows.forEach(([node, when]) => { node.hidden = !when(line); });
  if (ui.steps && ui.steps.dataset.line !== String(line)) { ui.steps.dataset.line = String(line); showSteps(ui.steps, line); }
}
// The rotor runs away from 90° (slide 1, input above P_max): δ accelerates with the surplus power, and the breaker trips after one pole slip.
function runaway() {
  const id = ++runId, pm = pMaxAt(IF_FIX);
  let w = 0, last = performance.now();    // w: slip speed, degrees per second
  T.slip = true;
  const stepFn = t => {
    if (id !== runId) return;
    const dt = Math.min(DT_MAX, (t - last) / 1000); last = t;
    w += Math.max(SLIP_MIN_MW, T.pin - pm * Math.sin(T.d * RAD)) * SLIP_GAIN * dt; T.d += w * dt;
    if (T.d >= SLIP_END) { T.slip = false; T.trip = true; render(); return; }
    render(); requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
}
// Stop any narration and animation and reset the play buttons.
function stop() {
  playing = false; runId++;
  cancelAnimationFrame(raf);
  player.onended = null; player.pause();
  $('play').textContent = '▶ Play narration';
  const lb = $('labListen'); lb.textContent = lb.dataset.listen;
}
// Switch the voice on or off.
function setVoice(on) {
  voice = on;
  $('voice').textContent = on ? 'voice on' : 'voice off';
  $('voice').setAttribute('aria-pressed', String(on));
}
// Play one clip (or time its text when the voice is off). The tick callback runs every frame with the time and the duration; done runs at the end.
function playClip(clip, text, tick, done) {
  cancelAnimationFrame(raf);
  player.onended = null; player.pause();
  const finish = () => { cancelAnimationFrame(raf); player.onended = null; tick(1, 1); done(); };
  if (voice) {
    player.src = clip;
    player.onended = finish;
    player.play().catch(() => { if (!playing) return; setVoice(false); $('voiceMsg').removeAttribute('hidden'); playClip(clip, text, tick, done); });
    const loop = () => { if (player.duration) tick(player.currentTime, player.duration); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  } else {
    const dur = text.split(/\s+/).length / WPM * 60, t0 = performance.now();      // seconds
    const loop = () => { const t = (performance.now() - t0) / 1000; if (t >= dur) { finish(); return; } tick(t, dur); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
}
// Advance the present line to time t of dur: progress bar and the line's animated state. On slide 1 line 4 the run-away starts on cue.
function tick(t, dur) {
  $('bar').style.width = Math.min(100, t / dur * 100) + '%';
  const start = SL[si].at(line, Math.min(1, t / dur));
  if (start && !T.slip && !T.trip) { T.d = 90; runaway(); }
  if (!T.slip) render();
}
// Play the present line, then the next, to the end of the slide.
function playLine() {
  playing = true; T.live = true; T.trip = false; T.slip = false; runId++;
  $('play').textContent = '❚❚ Pause';
  playClip(CLIPS.slides[si][line], SAY.slides[si][line], tick, () => { if (line < SAY.slides[si].length - 1) { showLine(line + 1); playLine(); } else stop(); });
}
// Show narration line i of the present slide in its end state (caption, cue, figure).
function showLine(i) {
  line = Math.max(0, Math.min(SAY.slides[si].length - 1, i));
  T.live = false; T.trip = false; T.slip = false; runId++;
  setRich($('cap'), disp(SAY.slides[si][line]));
  $('bar').style.width = '0';
  $('lineNo').textContent = 'line ' + (line + 1) + ' of ' + SAY.slides[si].length;
  for (const c of document.querySelectorAll('#left .cue')) c.classList.toggle('on', Number(c.dataset.c) === line);
  SL[si].at(line, 1);
  render();
}
// Go to line i from a control: narration stops first.
function setLine(i) { stop(); showLine(i); }
// Build the text column, the readouts and the slider of slide i, and show its first line.
function setSlide(i) {
  stop();
  si = Math.max(0, Math.min(SL.length - 1, i));
  const S_ = SL[si], left = $('left'), ctl = $('ctl');
  T.user4 = null; T.user5 = null;
  ui = {vals: [], slider: null, get: null, shows: [], steps: null};
  left.replaceChildren(rel('p', 'eyebrow', (si + 1) + ' OF ' + SL.length + ' · ' + S_.eyebrow), rel('h2', '', S_.title));
  for (const [kind, body, when] of S_.left) {
    const node = kind === 'eq' ? el('div', {class: 'eq'}, mathEl(EQ[body])) : kind === 'steps' ? el('div') : rel(kind === 'key' ? 'div' : 'p', kind === 'key' ? 'key' : '', body);
    if (when) ui.shows.push([node, when]);
    if (kind === 'steps') ui.steps = node;
    left.append(node);
  }
  left.append(el('p', {class: 'eyebrow gap', text: 'WATCH'}));
  S_.cues.forEach((c, k) => { const s = rel('span', 'cue', c); s.dataset.c = k; left.append(s); });
  left.append(rel('p', 'small', S_.note));
  left.scrollTop = 0;
  ctl.replaceChildren();
  if (S_.ctl) {
    const [label, min, max, step, ends, get, set] = S_.ctl;
    ui.get = get;
    ui.slider = el('input', {type: 'range', min, max, step, 'aria-label': label.replace(/[_{}]/g, '')});
    ui.slider.addEventListener('input', () => { stop(); set(Number(ui.slider.value)); render(); });
    add(ctl, [el('div', {class: 'row'}, rel('span', '', label)), ui.slider, el('div', {class: 'scale'}, ends.map(t => el('span', {text: t})))]);
  }
  for (const r of S_.rows) { const val = el('span', {class: 'val'}); ui.vals.push(val); ctl.append(el('div', {class: 'row'}, [rel('span', '', r), val])); }
  if (!S_.ctl && !S_.rows.length) ctl.append(el('p', {class: 'small', text: 'No controls on this slide.'}));
  $('slPos').textContent = (si + 1) + '/' + SL.length;
  fitCaption(SAY.slides[si]);
  showLine(0);
}
// Reserve caption height for the longest of the given lines, so the figure does not resize between lines.
function fitCaption(lines) {
  const cap = $('cap'), m = $('capMeasure');
  let h = 0;
  m.style.width = cap.clientWidth + 'px';
  for (const t of lines) { setRich(m, disp(t)); h = Math.max(h, m.offsetHeight); }
  m.replaceChildren();
  cap.style.minHeight = h + 'px';
}

/* ═══ L7. LAB LISTEN AND START ═══ */
// Play the three Lab lines in order, with the line being spoken shown as a caption in the Lab sidebar. A Lab control does not stop it.
function labListen() {
  const btn = $('labListen');
  if (playing) { stop(); return; }
  playing = true; btn.textContent = '❚❚ Stop';
  let i = 0;
  const next = () => {
    if (i >= SAY.lab.length) { stop(); $('labNo').textContent = ''; return; }
    $('labNo').textContent = (i + 1) + '/' + SAY.lab.length + (voice ? '' : ' (no voice)');
    setRich($('labCap'), disp(SAY.lab[i]));
    playClip(CLIPS.lab[i], SAY.lab[i++], () => {}, next);
  };
  next();
}
$('labListen').addEventListener('click', labListen);
$('play').addEventListener('click', () => { if (playing) { stop(); return; } showLine(line); playLine(); });
$('prev').addEventListener('click', () => { const p = playing; setLine(line - 1); if (p) playLine(); });
$('next').addEventListener('click', () => { const p = playing; setLine(line + 1); if (p) playLine(); });
$('slPrev').addEventListener('click', () => setSlide(si - 1));
$('slNext').addEventListener('click', () => setSlide(si + 1));
$('voice').addEventListener('click', () => { const p = playing && PAGE === 'lec'; setVoice(!voice); $('voiceMsg').setAttribute('hidden', ''); if (p) playLine(); });
window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => { if (PAGE === 'lec') fitCaption(SAY.slides[si]); }); });
for (const box of document.querySelectorAll('.eq5[data-eq]')) box.append(mathEl(EQ[box.dataset.eq]));
stopNarration = stop;
showLecture = () => setSlide(si);
setSlide(0);
}
