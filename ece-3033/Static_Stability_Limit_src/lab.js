'use strict';
/* ═══ CONTENTS ═══
   Lab and Experiments (carried from v1.2.0):
   1. CONSTANTS   2. STATE   3. PHYSICS   4. FORMATTING   5. P–δ CURVE   6. EXPERIMENT 5   7. LAB INSTRUMENTS
   8. READOUTS AND VERDICT   9. CONTROLS AND PAGES   10. WORKSHEET   11. LOOP
   Lecture (new in v2.0.0, in its own block so that its helpers do not collide with the Lab's):
   L1. CONSTANTS   L2. MODEL AND FORMAT   L3. DOM HELPERS   L4. FIGURES   L5. SLIDES   L6. PLAYER   L7. LAB LISTEN AND START */
/* ═══ 1. CONSTANTS ═══ */
/* ═══ 1. CONSTANTS ═══ */
const V_LL = 13.8;                        // kV line, bus and machine rating
const V_PH = V_LL / Math.sqrt(3);         // kV per phase, 7.967 (the infinite bus, reference phasor)
const S_RATED = 25;                       // MVA machine rating
const P_RATED = 25;                       // MW, rated real power (unity power factor)
const X_S = V_LL * V_LL / S_RATED;        // Ω, 1.0 pu synchronous reactance = 7.6176 Ω
const IF_RATED = 5.00;                    // A, field current at which E_A = V_φ (no saturation)
const N_SYNC = 1800;                      // r/min, 4 poles at 60 Hz
const W_M = 2 * Math.PI * N_SYNC / 60;    // rad/s, mechanical speed, 188.5
const LOSS_FW = 0.15, LOSS_CORE = 0.20;   // MW, friction and windage, core (illustrative, fixed)
const STRAY_K = 0.01;                     // stray loss as a fraction of P_out (illustrative)
const R_A = 0.07;                         // Ω per phase, armature resistance (copper loss on slide 2 and in the Lab panel only)
const COPPER_K = R_A / (3 * V_PH * V_PH); // MW per MW², Lab panel: copper loss = COPPER_K · P_out² at unity power factor
const FLOW_ITER = 40;                     // fixed-point passes of the slide-2 loss model (converges in a few)
const IF_START = 6.00;                    // A, the field current of the dashed curve in Experiment 5
const PM_STEP = 0.1, IF_STEP = 0.05;      // MW and A, the − / + buttons and the Lab sliders
const LAB_CTL = { pm: [0, 35], iF: [3, 10] };   // slider ranges in the Lab
const BAND_LO = 20, BAND_HI = 30;         // degrees, normal operating band of δ
const TAU_D = 0.25;                       // s, glide of δ toward its steady value
const K_SLIP = 0.05;                      // rad/s² per MW of unbalanced power while slipping (qualitative, slowed to be followed)
const W_SLIP_MIN = 0.15, W_SLIP_MAX = 4;  // rad/s, slowest and fastest drawn slip speed
const TRIP_AT = 2 * Math.PI;              // rad, the breaker trips after one pole slip (δ has advanced 360°)
const TURN_P = 18, TURN_DEG = 28;         // MW and degrees, the Experiment 5 problem
const TURN_TOL = [0.05, 0.03, 0.3];       // kV, A, MW accepted either side of the three answers
const NUMBER_FORM = /^[+\-−]?(\d+\.?\d*|\.\d+)$/;   // a plain decimal number, optional sign
const BEEP_HZ = 880, BEEP_S = 0.15, BEEP_EVERY_MS = 1000;   // audible alarm: tone, length, repeat (1 per second)
const DT_MAX = 0.1;                       // s, largest frame step
const RO_MS = 250;                        // ms between numeric updates (4 per second)
const HOLD_DELAY = 400, HOLD_EVERY = 110; // ms, press-and-hold repeat
const DEG = 180 / Math.PI, HALF_PI = Math.PI / 2;
const MINUS = '−';                        // U+2212
const KW_PER_MW = 1e3;                    // kW in one MW (losses are written in kW)
const SHEET_KEY = 'static-stability-limit-worksheet-v1';   // the only localStorage key this tool reads or writes
const SHEET_MAX = 4000;                   // longest stored answer (characters)
const EPS = 1e-9;
const COL = { v: '#d32f2f', e: '#1c5fd6', x: '#3a444b', i: '#18744a', proj: '#b06f00', mech: '#8a5700', loss: '#c2412f', mut: '#55636b', ink: '#1a2328', ok: '#18744a' };
const HALO = { stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };   // keeps a label legible where a line crosses it

const SVGNS = 'http://www.w3.org/2000/svg';
const LAB_START = { pm: 15, iF: 6 };       // Lab on first view and after Reset

/* ═══ 2. STATE ═══ */
/* Lab model: input power (MW), field current (A), torque angle δ (rad), slip speed (rad/s), run = 'ok' | 'slip' | 'trip'. */
const S = { pm: LAB_START.pm, iF: LAB_START.iF, d: 0, w: 0, run: 'ok', paused: false, sound: false, lastBeep: 0, solved: false, shown: false, tried: false };
let PAGE = 'lec';                         // page on screen: 'lec', 'lab' or 'exp'
let stopNarration = () => {};             // set by the Lecture section: stops any narration
let showLecture = () => {};               // set by the Lecture section: redraws the Lecture page

/* ═══ 3. PHYSICS ═══ */
/* Internal voltage E_A (kV per phase) at field current iF (A): proportional, no saturation. */
function eAt(iF) { return V_PH * iF / IF_RATED; }
/* E_A (kV per phase) at the present field current. */
function eA() { return eAt(S.iF); }
/* Static stability limit P_max = 3 V_φ E_A / X_S (MW) at field current iF (A). */
function pMaxAt(iF) { return 3 * V_PH * eAt(iF) / X_S; }
/* P_max (MW) at the present field current. */
function pMax() { return pMaxAt(S.iF); }
/* Steady torque angle (rad) for input power p (MW), or null when p exceeds P_max. */
function dSteady(p) { const m = pMax(); return p <= m ? Math.asin(p / m) : null; }
/* Operating point at torque angle d (rad) and internal voltage E (kV; the present one unless given), R_A ignored: P, Q, I_A (kA, with its real and imaginary parts on V_φ), θ (rad, negative = lagging), pf. */
function point(d, E = eA()) {
  const ir = E * Math.sin(d) / X_S, ii = -(E * Math.cos(d) - V_PH) / X_S;     // I_A = (E_A − V_φ) / jX_S
  const I = Math.hypot(ir, ii), th = Math.atan2(ii, ir);
  return { E, d, ir, ii, I, th, pf: I < EPS ? 1 : Math.cos(th), P: 3 * V_PH * ir, Q: -3 * V_PH * ii, vert: E * Math.sin(d) };
}
/* Word for the power factor of point p. */
function pfWord(p) { return Math.abs(p.Q) < 0.05 ? 'unity' : p.Q > 0 ? 'lagging' : 'leading'; }
/* Slide-2 power flow for input pin (MW) at field current iF (A), illustrative losses. δ comes from P_out with the lossless
   relation P_out = 3 V_φ E_A sin δ / X_S, then I_A = |E_A∠δ − V_φ| / X_S; the copper and stray losses are iterated to a fixed point. */
function flowLec(pin, iF) {
  const E = eAt(iF), fixed = LOSS_FW + LOSS_CORE, cur = po => { const d = Math.asin(Math.min(1, po * X_S / (3 * V_PH * E))); return { d, I: Math.hypot(E * Math.cos(d) - V_PH, E * Math.sin(d)) / X_S }; };
  let po = pin - fixed;
  for (let n = 0; n < FLOW_ITER; n++) po = (pin - fixed - 3 * cur(po).I ** 2 * R_A) / (1 + STRAY_K);
  const { d, I } = cur(po), copper = 3 * I * I * R_A, stray = STRAY_K * po, pconv = pin - stray - fixed, q = E * Math.cos(d) - V_PH;   // q > 0: lagging
  return { pin, po: pconv - copper, stray, fw: LOSS_FW, core: LOSS_CORE, copper, pconv, E, I, pf: E * Math.sin(d) / (X_S * I), word: Math.abs(q) < 0.005 ? 'unity' : q > 0 ? 'lagging' : 'leading',
           tApp: pin * 1e3 / W_M, tInd: pconv * 1e3 / W_M, eff: (pconv - copper) / pin };
}
/* Lab power-flow panel for input pin (MW), illustrative losses at unity power factor (as v1.0.1): solve
   pin = P_out + F&W + core + stray(P_out) + copper(P_out) for P_out. */
function flowLab(pin) {
  const fixed = LOSS_FW + LOSS_CORE, b = 1 + STRAY_K, c = pin - fixed, below = c < 0;
  const po = below ? 0 : (-b + Math.sqrt(b * b + 4 * COPPER_K * c)) / (2 * COPPER_K);
  return { pin, po, stray: STRAY_K * po, fw: LOSS_FW, core: LOSS_CORE, copper: COPPER_K * po * po, pconv: po + COPPER_K * po * po };
}
/* Advance δ by dt seconds: glide to the steady angle; above P_max, run away and trip after one pole slip (qualitative). */
function stepAngle(dt) {
  if (S.run === 'trip') return;
  const m = pMax(), ds = dSteady(S.pm);
  if (S.run === 'ok') { if (ds !== null) S.d += (ds - S.d) * (1 - Math.exp(-dt / TAU_D)); else { S.run = 'slip'; S.w = 0; } }
  if (S.run === 'slip') {
    if (ds !== null && S.d < Math.PI - ds) { S.run = 'ok'; S.w = 0; return; }      // power back under the curve before the unstable point: it pulls back in
    S.w = Math.min(W_SLIP_MAX, Math.max(W_SLIP_MIN, S.w + K_SLIP * (S.pm - m * Math.sin(S.d)) * dt)); S.d += S.w * dt;
    if (S.d >= TRIP_AT) { S.run = 'trip'; beep(3 * BEEP_S); syncButtons(); readouts(true); }
  }
}
/* ═══ 4. FORMATTING AND EQUATIONS ═══ */
/* Number with d decimals; a negative value is written with U+2212. */
function f(x, d) { return x.toFixed(d).replace('-', MINUS); }
/* Signed number with + or −. */
function sg(x, d) { return (x < 0 ? MINUS : '+') + Math.abs(x).toFixed(d); }
/* A power x (MW) written in kW with one decimal: the form used for every loss. */
function kw(x) { return f(x * KW_PER_MW, 1) + ' kW'; }
/* Set an element's text only when it changes. */
function put(id, t) { const e = document.getElementById(id); if (e.textContent !== t) e.textContent = t; }
/* Write text into el, showing "x_ab" as x with subscript ab (text nodes and <sub> only, no markup parsed). */
function richText(el, txt) {
  while (el.firstChild) el.removeChild(el.firstChild);
  for (const part of String(txt).split(/(_[A-Za-zφ]+)/)) {
    if (part.startsWith('_')) { const sb = document.createElement('sub'); sb.textContent = part.slice(1); el.appendChild(sb); }
    else if (part) el.appendChild(document.createTextNode(part));
  }
}
/* richText, skipped when the text has not changed. */
function putRich(el, txt) { if (el.dataset.raw !== txt) { richText(el, txt); el.dataset.raw = txt; } }
/* Create an SVG element in parent. */
function mk(parent, tag, a, txt) { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt !== undefined) subT(e, txt); parent.appendChild(e); return e; }
/* Write str into an SVG text element, drawing "x_ab" as x with a lowered, smaller ab (tspans). */
function subT(el, str) {
  if (el.dataset && el.dataset.raw === str) return; if (el.dataset) el.dataset.raw = str;
  while (el.firstChild) el.removeChild(el.firstChild);
  let low = false;
  for (const part of String(str).split(/(_[A-Za-zφ]+)/)) { if (!part) continue;
    const t = document.createElementNS(SVGNS, 'tspan'), sub = part.startsWith('_');
    t.textContent = sub ? part.slice(1) : part; if (sub) { t.setAttribute('dy', '4'); t.setAttribute('font-size', '75%'); low = true; } else if (low) { t.setAttribute('dy', '-4'); low = false; }
    el.appendChild(t); }
}
/* Set an arrow from (x1,y1) to (x2,y2) with a head of length hl. */
function setArrow(A, x1, y1, x2, y2, hl) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = L > 0 ? (x2 - x1) / L : 1, uy = L > 0 ? (y2 - y1) / L : 0, h = Math.min(hl, L), bx = x2 - ux * h, by = y2 - uy * h, n = h * 0.42;
  A.l.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`);
  A.h.setAttribute('points', L < 2 ? '' : `${x2.toFixed(1)},${y2.toFixed(1)} ${(bx - uy * n).toFixed(1)},${(by + ux * n).toFixed(1)} ${(bx + uy * n).toFixed(1)},${(by - ux * n).toFixed(1)}`);
}
/* SVG arc of radius r about (cx,cy) from angle a0 to a1 (rad, counter-clockwise positive, y up). */
function arcPath(cx, cy, r, a0, a1) {
  const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${a1 > a0 ? 0 : 1} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
/* Place a text element. */
function at(t, x, y, str) { t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', y.toFixed(1)); subT(t, str); }

/* ═══ 5. P–δ CURVE (Lab; its scale helpers also serve Experiment 5) ═══ */
const CG = document.getElementById('cvG'), CV = { yMax: 0 };
const CX = deg => 70 + deg * 480 / 180, CY = (p, yMax) => 348 - p * 296 / yMax;   // curve: degrees → x, MW → y (viewBox units)
const FS_LAB = 13;                        // viewBox font size of the Lab curve
const PT_LABEL_Y = 340;                   // lowest baseline of the operating point's label (the δ axis is at y = 348)
/* Top of the Lab curve's power axis (MW): at least 40, and clear of P_max. */
function curveTop() { return Math.max(40, 10 * Math.ceil(pMax() * 1.12 / 10)); }
/* Build or rebuild the fixed parts of the curve (axes, ticks, zones) for a power axis that ends at yMax. */
function buildCurve(yMax) {
  while (CG.firstChild) CG.removeChild(CG.firstChild);
  const fs = FS_LAB;
  mk(CG, 'text', { x: 70, y: 20, 'font-size': fs + 2, 'font-weight': 800 }, 'Power and induced torque against the torque angle δ');
  mk(CG, 'rect', { x: CX(90), y: 52, width: CX(180) - CX(90), height: 296, fill: '#fbe3df' }); mk(CG, 'text', { x: CX(135), y: 70, 'text-anchor': 'middle', 'font-size': fs + 1, 'font-weight': 700, fill: COL.loss }, 'beyond the limit');
  mk(CG, 'rect', { x: CX(BAND_LO), y: 52, width: CX(BAND_HI) - CX(BAND_LO), height: 296, fill: '#cfeadb' });
  mk(CG, 'text', { x: CX(25), y: 70, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, fill: COL.ok }, '20°–30°');
  mk(CG, 'path', { d: 'M70 52V348H550V52', stroke: COL.mut, 'stroke-width': 1.5, fill: 'none' });
  for (let a = 0; a <= 180; a += 30) { mk(CG, 'path', { d: `M${CX(a)} 348v5`, stroke: COL.mut }); mk(CG, 'text', { x: CX(a), y: 368, 'text-anchor': 'middle', 'font-size': fs, fill: COL.mut }, a + '°'); }
  mk(CG, 'text', { x: 310, y: 390, 'text-anchor': 'middle', 'font-size': fs + 1, fill: COL.mut }, 'torque angle δ');
  mk(CG, 'text', { x: 64, y: 38, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 700, fill: COL.e }, 'P (MW)');
  mk(CG, 'text', { x: 636, y: 36, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 700, fill: COL.mech }, 'τ_ind (kN·m)');
  for (let p = 0; p <= yMax + EPS; p += 10) { const y = CY(p, yMax);
    mk(CG, 'path', { d: `M66 ${y}H550`, stroke: p ? '#d6dde0' : 'none' }); mk(CG, 'text', { x: 62, y: y + 4, 'text-anchor': 'end', 'font-size': fs, fill: COL.e }, String(p));
    mk(CG, 'text', { x: 556, y: y + 4, 'font-size': fs, fill: COL.mech }, f(p * 1e3 / W_M, 0)); }
  CV.solid = mk(CG, 'path', { stroke: COL.e, 'stroke-width': 3, fill: 'none' }); CV.dash = mk(CG, 'path', { stroke: COL.e, 'stroke-width': 3, 'stroke-dasharray': '8 5', fill: 'none' });
  CV.line = mk(CG, 'path', { stroke: COL.proj, 'stroke-width': 2.5, 'stroke-dasharray': '10 4' });
  CV.lineT = mk(CG, 'text', Object.assign({ 'font-size': fs, 'font-weight': 700, fill: COL.mech, 'text-anchor': 'end' }, HALO), '');
  CV.peak = mk(CG, 'circle', { r: 5, fill: '#ffffff', stroke: COL.ink, 'stroke-width': 2.5 }); CV.peakT = mk(CG, 'text', Object.assign({ 'font-size': fs + 1, 'font-weight': 800, 'text-anchor': 'middle' }, HALO), ''); CV.peakT2 = mk(CG, 'text', Object.assign({ 'font-size': fs + 1, 'font-weight': 800, fill: COL.mech, 'text-anchor': 'middle' }, HALO), '');
  CV.pt = mk(CG, 'circle', { r: 7, fill: COL.loss, stroke: '#ffffff', 'stroke-width': 2 }); CV.ptT = mk(CG, 'text', Object.assign({ 'font-size': fs, 'font-weight': 800, fill: COL.loss }, HALO), '');
}
/* Path of P = m sin δ from a0 to a1 degrees on a scale with top yMax. */
function sinePath(m, a0, a1, yMax) { let s = ''; for (let a = a0; a <= a1; a += 2) s += (a === a0 ? 'M' : 'L') + CX(a).toFixed(1) + ' ' + CY(m * Math.sin(a / DEG), yMax).toFixed(1); return s; }
/* Draw the curve, the input power line, the peak and the operating point. */
function drawCurve() {
  const m = pMax(), yMax = curveTop(), fs = FS_LAB;
  if (yMax !== CV.yMax) { CV.yMax = yMax; buildCurve(yMax); }
  CV.solid.setAttribute('d', sinePath(m, 0, 90, yMax)); CV.dash.setAttribute('d', sinePath(m, 90, 180, yMax));
  const yl = CY(Math.min(S.pm, yMax), yMax); CV.line.setAttribute('d', `M70 ${yl.toFixed(1)}H550`);
  at(CV.lineT, 546, yl - 6, 'input power ' + f(S.pm, 1) + ' MW' + (S.pm > yMax ? ' (above the scale)' : ''));
  const py = CY(m, yMax); CV.peak.setAttribute('cx', CX(90)); CV.peak.setAttribute('cy', py);
  at(CV.peakT, CX(90), py - (fs + 14), 'P_max = ' + f(m, 1) + ' MW'); at(CV.peakT2, CX(90), py - 11, 'τ_max = ' + f(m * 1e3 / W_M, 0) + ' kN·m');
  const dd = (S.d % (2 * Math.PI)) * DEG, on = S.run !== 'trip' && dd <= 180, px = CX(Math.min(dd, 180)), pyy = CY(m * Math.sin(dd / DEG), yMax);
  CV.pt.setAttribute('cx', px.toFixed(1)); CV.pt.setAttribute('cy', pyy.toFixed(1)); CV.pt.setAttribute('opacity', on ? 1 : 0);
  const low = pyy + 22 > PT_LABEL_Y;   // near the axis the label stays above the tick labels, further right to clear the curve
  at(CV.ptT, px + (low ? 22 : 12), low ? PT_LABEL_Y : pyy + 22, on ? 'δ = ' + f(dd, 1) + '°' : '');
}

/* ═══ 6. EXPERIMENT 5: SET THE FIELD (the v1.2.0 slide-6 problem, unchanged) ═══ */
const T6 = {};
const T6_YMAX = 45;                       // MW, fixed top of the Experiment 5 curve (the answer peaks at 38.3 MW)
const E_TURN = TURN_P * X_S / (3 * V_PH * Math.sin(TURN_DEG / DEG));   // kV, the answer: 12.22
const IF_TURN = IF_RATED * E_TURN / V_PH; // A, the answer: 7.67
const PM_TURN = 3 * V_PH * E_TURN / X_S;  // MW, the answer: 38.3
const FIELDS = [['eIn', 'E_A', E_TURN, 2], ['ifIn', 'I_F', IF_TURN, 2], ['pmIn', 'P_max', PM_TURN, 1]];   // answer boxes: id, name, model value, decimals as printed
/* Build the Experiment 5 curve once: the 6.00 A curve dashed, the 18 MW and δ = 28° lines and a hollow point with "?". No new curve yet. */
function buildCurve6() {
  const g = document.getElementById('c6G'), Y = p => CY(p, T6_YMAX), m6 = pMaxAt(IF_START), xt = CX(TURN_DEG), yt = Y(TURN_P);
  mk(g, 'text', { x: 70, y: 20, 'font-size': 17, 'font-weight': 800 }, 'Power against the torque angle δ');
  mk(g, 'rect', { x: CX(BAND_LO), y: 52, width: CX(BAND_HI) - CX(BAND_LO), height: 296, fill: '#cfeadb' });
  mk(g, 'path', { d: 'M70 52V348H550', stroke: COL.mut, 'stroke-width': 1.5, fill: 'none' });
  for (let a = 0; a <= 180; a += 30) { mk(g, 'path', { d: `M${CX(a)} 348v5`, stroke: COL.mut }); mk(g, 'text', { x: CX(a), y: 368, 'text-anchor': 'middle', 'font-size': 15, fill: COL.mut }, a + '°'); }
  mk(g, 'text', { x: 310, y: 390, 'text-anchor': 'middle', 'font-size': 16, fill: COL.mut }, 'torque angle δ'); mk(g, 'text', { x: 64, y: 38, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, fill: COL.e }, 'P (MW)');
  for (let p = 0; p <= 40; p += 10) { mk(g, 'path', { d: `M66 ${Y(p)}H550`, stroke: p ? '#d6dde0' : 'none' }); mk(g, 'text', { x: 62, y: Y(p) + 4, 'text-anchor': 'end', 'font-size': 15, fill: COL.e }, String(p)); }
  mk(g, 'text', Object.assign({ x: CX(25), y: 340, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, fill: COL.ok }, HALO), '20°–30°');
  mk(g, 'path', { d: sinePath(m6, 0, 180, T6_YMAX), stroke: COL.e, 'stroke-width': 2.5, 'stroke-dasharray': '8 5', fill: 'none' });
  mk(g, 'text', Object.assign({ x: CX(120), y: Y(m6 * Math.sin(120 / DEG)) + 22, 'font-size': 15, 'font-weight': 700, fill: COL.e }, HALO), f(IF_START, 2) + ' A: P_max ' + f(m6, 1) + ' MW');
  T6.done = mk(g, 'g', {});
  T6.gT = mk(g, 'g', {});
  mk(T6.gT, 'path', { d: `M70 ${yt.toFixed(1)}H550`, stroke: COL.proj, 'stroke-width': 2.5 }); mk(T6.gT, 'path', { d: `M${xt.toFixed(1)} 348V52`, stroke: COL.proj, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' });
  mk(T6.gT, 'text', Object.assign({ x: 546, y: yt - 7, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, fill: COL.mech }, HALO), TURN_P + ' MW');
  mk(T6.gT, 'text', Object.assign({ x: xt + 7, y: 66, 'font-size': 15, 'font-weight': 800, fill: COL.mech }, HALO), 'δ = ' + TURN_DEG + '°');
  T6.pt = mk(T6.gT, 'circle', { cx: xt.toFixed(1), cy: yt.toFixed(1), r: 7.5, stroke: COL.proj, 'stroke-width': 3 });
  T6.ask = mk(T6.gT, 'text', Object.assign({ x: xt + 12, y: yt + 24, 'font-size': 19, 'font-weight': 800, fill: COL.mech }, HALO), '');
}
/* Draw the Experiment 5 marker: hollow with "?" until the problem is solved or the solution shown; then the new curve and the filled point. */
function drawCurve6() {
  const done = S.solved || S.shown; T6.pt.setAttribute('fill', done ? COL.proj : '#ffffff'); subT(T6.ask, done ? '' : '?');
  if (!done) { while (T6.done.firstChild) T6.done.removeChild(T6.done.firstChild); return; }
  if (T6.done.firstChild) return;
  mk(T6.done, 'path', { d: sinePath(PM_TURN, 0, 90, T6_YMAX), stroke: COL.e, 'stroke-width': 3.5, fill: 'none' }); mk(T6.done, 'path', { d: sinePath(PM_TURN, 90, 180, T6_YMAX), stroke: COL.e, 'stroke-width': 3.5, 'stroke-dasharray': '8 5', fill: 'none' });
  mk(T6.done, 'text', Object.assign({ x: CX(90), y: CY(PM_TURN, T6_YMAX) - 9, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: COL.e }, HALO), f(IF_TURN, 2) + ' A: P_max ' + f(PM_TURN, 1) + ' MW');
}
/* Show a message under the answer boxes: kind 'good', 'bad' (refused or wrong) or 'mid' (hint). */
function turnMsg(t, kind) { const e = document.getElementById('turnMsg'); putRich(e, t); e.className = kind; }
/* Read the three answer boxes. Returns the numbers, or null after naming each entry that was refused (nothing is checked then). */
function readAnswers() {
  const errs = [], vals = FIELDS.map(([id, name]) => { const box = document.getElementById(id), raw = box.value.trim();
    const why = raw === '' ? name + ': type a value.' : NUMBER_FORM.test(raw) ? '' : name + ': not a number.';
    box.setAttribute('aria-invalid', String(why !== '')); if (why) errs.push(why);
    return parseFloat(raw.replace(MINUS, '-')); });
  if (errs.length) { turnMsg(errs.join(' '), 'bad'); return null; }
  return vals;
}
/* Check the three answers against the model values as printed, mark each ✓ or ✗ and name the first step to check. */
function checkAnswers() {
  const v = readAnswers(); if (v === null) return;
  const ok = FIELDS.map(([, , ans, dec], n) => Math.abs(v[n] - +ans.toFixed(dec)) <= TURN_TOL[n] + EPS), head = FIELDS.map(([, name], n) => name + ' ' + (ok[n] ? '✓' : '✗')).join('   ') + '   ';
  S.tried = true;
  if (ok.every(Boolean)) { S.solved = true; turnMsg(head + 'Correct: the new curve is drawn.', 'good'); }
  else turnMsg(head + (!ok[0] ? 'Check E_A: rearrange P = 3V_φ E_A sin δ / X_S, with P = ' + TURN_P + ' MW and δ = ' + TURN_DEG + '°.'
    : !ok[1] ? 'Check I_F: E_A = V_φ × I_F / 5.00 A, so I_F = 5.00 A × E_A / V_φ.' : 'Check P_max = 3V_φ E_A / X_S, with the new E_A.'), 'bad');
  drawCurve6();
}
/* Write the worked solution and reveal the new curve. */
function showSolution() {
  const box = document.getElementById('sol'), V = f(V_PH, 2), X = f(X_S, 2), E = f(E_TURN, 2); S.shown = true;
  richText(box, 'E_A = ' + TURN_P + ' × ' + X + ' / (3 × ' + V + ' × sin ' + TURN_DEG + '°) = ' + E + ' kV\nI_F = 5.00 A × ' + E + ' / ' + V + ' = ' + f(IF_TURN, 2) + ' A\nP_max = 3 × ' + V + ' × ' + E + ' / ' + X + ' = ' + f(PM_TURN, 1) + ' MW');
  box.hidden = false; drawCurve6();
}
/* Clear the answer boxes, the message and the solution. */
function resetTurn() {
  S.solved = false; S.shown = false; S.tried = false; turnMsg('', ''); document.getElementById('sol').hidden = true;
  FIELDS.forEach(([id]) => { const b = document.getElementById(id); b.value = ''; b.setAttribute('aria-invalid', 'false'); });
  drawCurve6();
}
document.getElementById('chkBtn').addEventListener('click', checkAnswers);
FIELDS.forEach(([id]) => { document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswers(); }); });
document.getElementById('hintBtn').addEventListener('click', () => { S.tried = true; turnMsg('Hint: rearrange P = 3V_φ E_A sin δ / X_S for E_A, with P = ' + TURN_P + ' MW and δ = ' + TURN_DEG + '°.', 'mid'); });
document.getElementById('solBtn').addEventListener('click', showSolution);
/* ═══ 7. LAB INSTRUMENTS (as v1.2.0: power flow to scale, auto-fitted phasor diagram, dial, alarms) ═══ */
const FG = document.getElementById('flowG'), FL = {};
const FLOW_Y = 196;                       // y of the power stream's centre line
const FLOW_PX_MW = 2.4;                   // px of stream width per MW
const LOSS_PX = 4, LOSS_PX_MW = 34;       // loss arrows: base width and px per MW (their own, larger scale)
const LOSS_AT = { stray: 312, fw: 362, core: 412, copper: 606 };   // x of each loss arrow
/* Build the Lab power-flow drawing once (widths follow MW). */
function buildLabFlow() {
  mk(FG, 'rect', { x: 16, y: 150, width: 132, height: 92, rx: 10, fill: '#eceef4', stroke: COL.mut, 'stroke-width': 2 });
  mk(FG, 'text', { x: 82, y: 202, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, 'Input power');
  mk(FG, 'rect', { x: 290, y: 96, width: 175, height: 208, fill: '#eceef4' }); mk(FG, 'rect', { x: 465, y: 96, width: 175, height: 208, fill: '#e3ecfc' });
  mk(FG, 'rect', { x: 290, y: 96, width: 350, height: 208, rx: 4, fill: 'none', stroke: COL.ink, 'stroke-width': 2.5 });
  mk(FG, 'text', { x: 465, y: 86, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, 'Generator G3');
  mk(FG, 'text', { x: 377, y: 117, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: COL.mut }, 'Rotor side');
  mk(FG, 'text', { x: 552, y: 117, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: COL.e }, 'Stator side');
  FL.shaft = mk(FG, 'polygon', { fill: COL.mech }); FL.rotor = mk(FG, 'polygon', { fill: COL.mech, 'fill-opacity': 0.8 });
  FL.stator = mk(FG, 'polygon', { fill: COL.e, 'fill-opacity': 0.8 }); FL.out = mk(FG, 'polygon', { fill: COL.e });
  mk(FG, 'text', { x: 219, y: 138, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: COL.mech }, 'P_in = τ_app ω_m');
  FL.tIn = mk(FG, 'text', { x: 219, y: 158, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: COL.mech }, '');
  mk(FG, 'text', { x: 516, y: 264, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'P_conv = τ_ind ω_m');
  FL.tConv = mk(FG, 'text', { x: 516, y: 286, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, '');
  mk(FG, 'text', { x: 728, y: 138, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: COL.e }, 'P_out = 3V_φ I_A cos θ');
  FL.tOut = mk(FG, 'text', { x: 728, y: 158, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: COL.e }, '');
  mk(FG, 'rect', { x: 826, y: 70, width: 10, height: 250, fill: COL.v });
  mk(FG, 'text', { x: 831, y: 58, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: COL.v }, 'Infinite bus');
  FL.loss = {};
  for (const [k, name] of [['stray', 'Stray'], ['fw', 'F & W'], ['core', 'Core'], ['copper', 'Copper 3I_A²R_A']]) {
    const x = LOSS_AT[k];
    FL.loss[k] = { arrow: mk(FG, 'polygon', { fill: COL.loss }), val: mk(FG, 'text', { x, y: 386, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, fill: COL.loss }, '') };
    mk(FG, 'text', { x, y: 368, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, fill: COL.loss }, name);
  }
  mk(FG, 'text', { x: 362, y: 408, 'text-anchor': 'middle', 'font-size': 14, fill: COL.mut }, 'rotational losses (kW): almost fixed');
  mk(FG, 'text', { x: 606, y: 408, 'text-anchor': 'middle', 'font-size': 14, fill: COL.mut }, '(kW): grows as I_A²');
  mk(FG, 'text', { x: 16, y: 428, 'font-size': 13, fill: COL.mut }, 'Illustrative losses, unity power factor. Arrow widths follow MW; loss arrows on their own scale.');
}
/* Draw the Lab power flow for input power S.pm: powers in MW, losses in kW. */
function drawLabFlow() {
  const F = flowLab(S.pm), w = p => Math.max(1.5, p * FLOW_PX_MW), wi = w(F.pin), wc = w(F.pconv), wo = w(F.po), y = FLOW_Y;
  const band = (x0, x1, a, b) => `${x0},${y - a / 2} ${x1},${y - b / 2} ${x1},${y + b / 2} ${x0},${y + a / 2}`;
  FL.shaft.setAttribute('points', band(148, 290, wi, wi)); FL.rotor.setAttribute('points', band(290, 465, wi, wc)); FL.stator.setAttribute('points', band(465, 640, wc, wo));
  FL.out.setAttribute('points', `640,${y - wo / 2} 800,${y - wo / 2} 800,${y - wo / 2 - 7} 826,${y} 800,${y + wo / 2 + 7} 800,${y + wo / 2} 640,${y + wo / 2}`);
  subT(FL.tIn, f(F.pin, 1) + ' MW'); subT(FL.tConv, f(F.pconv, 1) + ' MW'); subT(FL.tOut, f(F.po, 1) + ' MW');
  for (const k in FL.loss) { const v = F[k], x = LOSS_AT[k], h = (LOSS_PX + LOSS_PX_MW * v) / 2, top = y + (k === 'copper' ? wc : wi) / 2 - 2;
    FL.loss[k].arrow.setAttribute('points', v < 0.0005 ? '' : `${x - h},${top} ${x + h},${top} ${x + h},334 ${x + h + 6},334 ${x},350 ${x - h - 6},334 ${x - h},334`);
    subT(FL.loss[k].val, f(v * KW_PER_MW, 1)); }
}
const PG = document.getElementById('phG'), PH = {};
const PH_O = { x: 86, y: 418 };           // origin of the phasors (viewBox units)
const PH_KV_PX = 40, PH_TOP = 372;        // largest scale (px per kV) and tallest drawn E_A (px)
const PH_I_PX = 120;                      // px of I_A at rated current (its own scale)
/* Build the Lab phasor drawing once. */
function buildLabPhasor() {
  PH.triB = mk(PG, 'polygon', { fill: COL.e, 'fill-opacity': 0.12 }); PH.triG = mk(PG, 'polygon', { fill: COL.x, 'fill-opacity': 0.14 });
  PH.axis = mk(PG, 'path', { stroke: COL.proj, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', fill: 'none' });
  PH.vert = mk(PG, 'path', { stroke: COL.proj, 'stroke-width': 3, 'stroke-dasharray': '7 4', fill: 'none' });
  PH.arcD = mk(PG, 'path', { stroke: COL.e, 'stroke-width': 2, fill: 'none' }); PH.arcT0 = mk(PG, 'path', { stroke: COL.i, 'stroke-width': 2, fill: 'none' }); PH.arcT1 = mk(PG, 'path', { stroke: COL.i, 'stroke-width': 2, fill: 'none' });
  const arrow = (col, w, dash) => ({ l: mk(PG, 'path', Object.assign({ stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' }, dash ? { 'stroke-dasharray': dash } : {})), h: mk(PG, 'polygon', { fill: col }) });
  PH.I = arrow(COL.i, 3.5); PH.V = arrow(COL.v, 5); PH.X = arrow(COL.x, 4, '2 0'); PH.E = arrow(COL.e, 5);
  const txt = (col, size, anchor, weight) => mk(PG, 'text', { fill: col, 'font-size': size, 'text-anchor': anchor || 'start', 'font-weight': weight || 700, stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, '');
  PH.lV = txt(COL.v, 15, 'end'); PH.lE = txt(COL.e, 15, 'end'); PH.lX = txt(COL.x, 15); PH.lI = txt(COL.i, 15); PH.lD = txt(COL.e, 15); PH.lT0 = txt(COL.i, 14); PH.lT1 = txt(COL.i, 14);
  PH.lVl = txt(COL.e, 14, 'end'); PH.lVr = txt(COL.x, 14);
  mk(PG, 'text', { x: 752, y: 462, 'text-anchor': 'end', 'font-size': 13, fill: COL.mut }, 'I_A shows direction; its length is on a separate scale.');
  mk(PG, 'circle', { cx: PH_O.x, cy: PH_O.y, r: 4, fill: COL.ink });
}
/* Draw the Lab phasor diagram at the present δ. The Lab's field range is wide, so its scale follows E_A. */
function drawLabPhasor() {
  const d = S.d % (2 * Math.PI), p = point(d), s = Math.min(PH_KV_PX, PH_TOP / p.E), O = PH_O;
  const vx = O.x + V_PH * s, ex = O.x + p.E * Math.cos(d) * s, ey = O.y - p.E * Math.sin(d) * s, fx = ex, fy = O.y;
  PH.triB.setAttribute('points', `${O.x},${O.y} ${ex.toFixed(1)},${ey.toFixed(1)} ${fx.toFixed(1)},${fy}`); PH.triG.setAttribute('points', `${vx.toFixed(1)},${O.y} ${ex.toFixed(1)},${ey.toFixed(1)} ${fx.toFixed(1)},${fy}`);
  PH.triB.setAttribute('fill-opacity', 0.16); PH.triG.setAttribute('fill-opacity', 0.2);
  PH.axis.setAttribute('d', `M${O.x} ${O.y}H${Math.max(vx, fx) + 24}`); PH.vert.setAttribute('d', `M${ex.toFixed(1)} ${ey.toFixed(1)}V${O.y}`);
  setArrow(PH.V, O.x, O.y, vx, O.y, 14); setArrow(PH.X, vx, O.y, ex, ey, 12); setArrow(PH.E, O.x, O.y, ex, ey, 14);
  const il = Math.min(240, PH_I_PX * p.I / (S_RATED / (3 * V_PH))), ix = O.x + il * Math.cos(p.th), iy = O.y - il * Math.sin(p.th);
  setArrow(PH.I, O.x, O.y, ix, iy, 11);
  PH.arcD.setAttribute('d', d > 0.02 ? arcPath(O.x, O.y, 64, 0, d) : ''); PH.arcT0.setAttribute('d', Math.abs(p.th) > 0.02 && il > 30 ? arcPath(O.x, O.y, 44, 0, p.th) : '');
  const aV = -HALF_PI, aX = Math.atan2(-(O.y - ey), vx - ex);          // from the E_A tip: straight down, and back along jX_S I_A toward the V_φ tip
  PH.arcT1.setAttribute('d', Math.abs(p.th) > 0.02 && p.vert * s > 46 ? arcPath(ex, ey, 34, aV, aX) : '');
  at(PH.lV, vx - 6, O.y + 24, 'V_φ = ' + f(V_PH, 2) + ' kV');
  at(PH.lE, (O.x + ex) / 2 - 10 * Math.sin(d) - 4, (O.y + ey) / 2 - 10 * Math.cos(d) - 2, 'E_A = ' + f(p.E, 2) + ' kV');
  at(PH.lX, vx + (ex - vx) * 0.62 - 10, O.y - (O.y - ey) * 0.62 + 5, 'jX_S I_A'); PH.lX.setAttribute('text-anchor', 'end');
  const up = p.th >= 0;   // I_A above the axis (leading): its labels go above it
  at(PH.lI, ix + 8, iy + (up ? -8 : 18), 'I_A = ' + f(p.I * 1e3, 0) + ' A');
  at(PH.lD, O.x + 74 * Math.cos(d / 2), O.y - 74 * Math.sin(d / 2) + 5, 'δ = ' + f(d * DEG, 1) + '°');
  at(PH.lT0, ix + 8, iy + (up ? -26 : 36), Math.abs(p.th) > 0.02 ? 'θ = ' + f(Math.abs(p.th) * DEG, 1) + '° ' + pfWord(p) : 'θ = 0°: unity');
  at(PH.lT1, ex + 12, ey + 30, Math.abs(p.th) > 0.02 && p.vert * s > 96 ? 'θ: same θ as at the origin' : '');
  const my = O.y - (O.y - ey) * 0.3;
  at(PH.lVl, ex - 9, my - 4, p.vert * s > 40 ? 'E_A sin δ' : ''); at(PH.lVr, ex + 9, my - 4, p.vert * s > 40 ? 'X_S I_A cos θ = ' + f(p.vert, 2) + ' kV' : '');
}
const DL = {}, DC = { x: 110, y: 104, r: 84 };
/* Build the rotor-angle dial once: green up to 90° (darker in the 20°–30° band), red beyond. */
function buildDial() {
  const G = document.getElementById('dlG'), wedge = (a0, a1, fill) => mk(G, 'path', { d: `M${DC.x} ${DC.y}L` + arcPath(DC.x, DC.y, DC.r, a0 / DEG, a1 / DEG).slice(1) + 'Z', fill });
  wedge(180, 359.9, '#f3d9d4'); wedge(90, 180, '#f0b8ae'); wedge(0, 90, '#d9efe2'); wedge(BAND_LO, BAND_HI, '#7cc49b');
  mk(G, 'circle', { cx: DC.x, cy: DC.y, r: DC.r, fill: 'none', stroke: COL.ink, 'stroke-width': 2.5 });
  mk(G, 'path', { d: `M${DC.x} ${DC.y}H${DC.x + DC.r}`, stroke: COL.v, 'stroke-width': 3 });
  mk(G, 'text', { x: DC.x + DC.r - 4, y: DC.y + 16, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, fill: COL.v }, 'V_φ 0°');
  mk(G, 'text', { x: DC.x, y: DC.y - DC.r + 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, '90°'); mk(G, 'text', { x: DC.x - DC.r + 5, y: DC.y + 16, 'font-size': 13, 'font-weight': 700 }, '180°');
  DL.ptr = mk(G, 'line', { x1: DC.x, y1: DC.y, x2: DC.x, y2: DC.y, stroke: COL.e, 'stroke-width': 6, 'stroke-linecap': 'round' }); mk(G, 'circle', { cx: DC.x, cy: DC.y, r: 7, fill: COL.ink });
  DL.txt = mk(G, 'text', { x: DC.x, y: 216, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, '');
  mk(G, 'text', { x: DC.x, y: 12, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: COL.mut }, 'rotor angle: E_A ahead of V_φ');
}
/* Draw the dial pointer at δ. */
function drawDial() {
  DL.ptr.setAttribute('x2', (DC.x + (DC.r - 8) * Math.cos(S.d)).toFixed(1)); DL.ptr.setAttribute('y2', (DC.y - (DC.r - 8) * Math.sin(S.d)).toFixed(1));
  subT(DL.txt, S.run === 'trip' ? 'breaker tripped' : 'δ = ' + f(S.d * DEG, S.run === 'slip' ? 0 : 1) + '°');
}
/* Light the alarm lamps and the banner for the present state. Flashing is 1 Hz; with reduced motion the lights are steady. */
function drawAlarms() {
  const deg = S.d * DEG, slip = S.run === 'slip', trip = S.run === 'trip';
  const lamp = (id, on, flash) => { const e = document.getElementById(id); e.classList.toggle('on', on); e.classList.toggle('flash', on && flash); };
  lamp('lmOk', S.run === 'ok' && deg <= BAND_HI + 0.05, false); lamp('lmLow', S.run === 'ok' && deg > BAND_HI + 0.05, false);   // off once G3 is slipping or tripped (v1.0.1)
  lamp('lmOver', slip && deg > 90, true); lamp('lmSlip', trip || (slip && deg > 180), !trip);
  const b = document.getElementById('banner'), t = trip ? 'BREAKER TRIPPED — G3 LOST SYNCHRONISM. Press Reset.' : slip ? 'LOSS OF SYNCHRONISM — G3 IS SLIPPING POLES' : '';
  if (b.textContent !== t) b.textContent = t; b.classList.toggle('on', !!t); b.classList.toggle('flash', slip);
}
let audio = null;                         // Web Audio context of the alarm beep, made when the student switches the sound on
/* One short beep of the audible alarm: in the Lab only, and only when the student has switched the sound on there. */
function beep(len) {
  if (PAGE !== 'lab' || !S.sound || !audio) return;
  try { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = BEEP_HZ; g.gain.value = 0.08; o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + len); } catch (e) { S.sound = false; syncButtons(); }
}
/* ═══ 8. READOUTS AND VERDICT ═══ */
/* The Lab's one verdict line for what the student sees now: [text, kind]. */
function verdict(p) {
  if (S.run === 'trip') return ['Breaker tripped: G3 lost synchronism. Press Reset.', 'bad'];
  if (S.run === 'slip') return ['Loss of synchronism: the input power is more than P_max.', 'bad'];
  if (S.pm > P_RATED + EPS) return ['Above the 25 MW rating: shown to see the trend. δ = ' + f(p.d * DEG, 1) + '°.', 'warn'];
  if (p.d * DEG > BAND_HI + 0.05) return ['δ = ' + f(p.d * DEG, 1) + '°: above 30°, low margin (' + f(pMax() - S.pm, 1) + ' MW).', 'warn'];
  return ['In step: δ = ' + f(p.d * DEG, 1) + '°, margin ' + f(pMax() - S.pm, 1) + ' MW.', 'good'];
}
let lastTxt = -1e9;
/* Update the Lab readouts and verdict: at most 4 times a second (or at once when forced). */
function readouts(force) {
  const now = performance.now(); if (!force && now - lastTxt < RO_MS) return; lastTxt = now;
  const p = point(Math.min(S.d, Math.PI)), m = pMax(), steady = S.run === 'ok';
  put('pmO', f(S.pm, 1) + ' MW'); put('ifO', f(S.iF, 2) + ' A');
  put('rD', steady ? f(p.d * DEG, 1) + '°' : '—'); put('rPf', steady ? f(p.pf, 3) + ' ' + pfWord(p) : '—'); put('rIa', steady ? f(p.I * 1e3, 0) : '—'); put('rEa', f(p.E, 2));
  put('rQ', steady ? sg(p.Q, 1) + ' MVAR ' + (Math.abs(p.Q) < 0.05 ? '' : p.Q > 0 ? '(supplies)' : '(absorbs)') : '—'); put('rPm', f(m, 1)); put('rMg', sg(m - S.pm, 1));
  const [txt, kind] = verdict(p), co = document.getElementById('callout'); putRich(co, txt); if (co.className !== kind) co.className = kind;
}

/* ═══ 9. CONTROLS AND PAGES ═══ */
const pmS = document.getElementById('pmS'), ifS = document.getElementById('ifS');
/* True when the student may not move the sliders: a tripped breaker. */
function locked() { return S.run === 'trip'; }
/* Set the input power (MW) from a control, to 0.1 MW, inside the present range. */
function setPm(v) { const c = LAB_CTL.pm; if (locked()) return; S.pm = Math.min(c[1], Math.max(c[0], Math.round(v * 10) / 10)); changed(); }
/* Set the field current (A) from a control, to 0.05 A, inside the present range. */
function setIf(v) { const c = LAB_CTL.iF; if (locked()) return; S.iF = Math.min(c[1], Math.max(c[0], Math.round(v * 20) / 20)); changed(); }
/* A control changed. */
function changed() { syncButtons(); readouts(true); }
/* Set the state (Reset and Experiment set-ups): o = { pm, iF }. δ starts at its steady value (at the peak for a
   set-up above P_max, which then slips). */
function setup(o) {
  S.pm = o.pm; S.iF = o.iF; S.run = 'ok'; S.w = 0; S.paused = false;
  const ds = dSteady(S.pm); S.d = ds === null ? HALF_PI : ds; changed();
}
/* Mirror the state on buttons and sliders. */
function syncButtons() {
  const lk = locked(), pr = (id, on) => document.getElementById(id).setAttribute('aria-pressed', String(on));
  pmS.min = LAB_CTL.pm[0]; pmS.max = LAB_CTL.pm[1]; pmS.step = PM_STEP; ifS.min = LAB_CTL.iF[0]; ifS.max = LAB_CTL.iF[1]; ifS.step = IF_STEP;
  pmS.value = S.pm; ifS.value = S.iF; pmS.disabled = lk; ifS.disabled = lk;
  pmS.setAttribute('aria-valuetext', S.pm.toFixed(1) + ' megawatts'); ifS.setAttribute('aria-valuetext', S.iF.toFixed(2) + ' amperes');
  ['pmM', 'pmP', 'ifM', 'ifP'].forEach(id => { document.getElementById(id).disabled = lk; });
  pr('pauseBtn', S.paused); pr('soundBtn', S.sound);
  put('pauseBtn', S.paused ? '▶ Run' : '❚❚ Pause'); put('soundBtn', S.sound ? '🔊 Alarm sound: on' : '🔈 Alarm sound: off');
  document.body.classList.toggle('paused', S.paused);
}
/* Run fn now, then repeat while the button is held (press and hold). Keyboard activation runs fn once. */
function holdButton(id, fn) {
  const b = document.getElementById(id); let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', e => { if (b.disabled || e.button !== 0) return; fn(); stop(); t1 = setTimeout(() => { t2 = setInterval(() => { if (b.disabled) stop(); else fn(); }, HOLD_EVERY); }, HOLD_DELAY); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => b.addEventListener(ev, stop));
  b.addEventListener('click', e => { if (e.detail === 0) fn(); });   // keyboard (Enter / Space)
}
holdButton('pmM', () => setPm(S.pm - PM_STEP)); holdButton('pmP', () => setPm(S.pm + PM_STEP)); holdButton('ifM', () => setIf(S.iF - IF_STEP)); holdButton('ifP', () => setIf(S.iF + IF_STEP));
pmS.addEventListener('input', () => setPm(+pmS.value)); ifS.addEventListener('input', () => setIf(+ifS.value));
document.getElementById('resetBtn').addEventListener('click', () => setup(LAB_START));
document.getElementById('pauseBtn').addEventListener('click', () => { S.paused = !S.paused; syncButtons(); readouts(true); });
document.getElementById('soundBtn').addEventListener('click', () => {
  S.sound = !S.sound;
  if (S.sound && !audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; S.sound = false; } }
  if (S.sound) beep(BEEP_S); syncButtons();
});
/* Show the Lecture, the Lab or the Experiments worksheet. Changing page stops any narration. */
function showPage(id) {
  stopNarration(); PAGE = id;
  document.getElementById('lec').hidden = id !== 'lec'; document.getElementById('app').hidden = id !== 'lab'; document.getElementById('page-exp').hidden = id !== 'exp';
  document.documentElement.classList.toggle('lec', id === 'lec');
  document.querySelectorAll('nav.tabs button[data-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.page === id)));
  if (id === 'lec') showLecture(); else { syncButtons(); readouts(true); }
}
document.querySelectorAll('nav.tabs button[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
/* Experiment set-ups: put the Lab in the stated state and show it. */
document.querySelectorAll('button.try').forEach(b => b.addEventListener('click', () => {
  let o; try { o = JSON.parse(b.dataset.try); } catch (e) { return; }
  if (!o || typeof o.pm !== 'number' || typeof o.iF !== 'number') return;
  showPage('lab'); setup(o);
}));

/* ═══ 10. WORKSHEET ═══ */
let SHEET = {};
const KEYS = [...document.querySelectorAll('[data-k]')].map(e => e.dataset.k);
/* Show the worksheet status (never silent). */
function sheetMsg(t, bad) { const e = document.getElementById('sheetStatus'); e.textContent = t; e.className = bad ? 'bad' : 'good'; }
/* Load and validate the stored record: a plain object of known keys holding short strings. */
function loadSheet() {
  let raw = null;
  try { raw = localStorage.getItem(SHEET_KEY); } catch (e) { sheetMsg('This browser will not store answers here. Use “Export my answers” before you close the page.', true); return; }
  if (raw === null) { sheetMsg('Answers are saved in this browser only.', false); return; }
  let rec; try { rec = JSON.parse(raw); } catch (e) { rec = null; }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { sheetMsg('A stored worksheet record was invalid and was not loaded.', true); return; }
  let dropped = 0;
  for (const k of Object.keys(rec)) { if (KEYS.includes(k) && typeof rec[k] === 'string' && rec[k].length <= SHEET_MAX) SHEET[k] = rec[k]; else dropped++; }
  sheetMsg(dropped ? dropped + ' stored entr' + (dropped === 1 ? 'y was' : 'ies were') + ' invalid and not loaded; the rest are restored.' : 'Answers restored from this browser.', dropped > 0);
  document.querySelectorAll('[data-k]').forEach(e => { if (SHEET[e.dataset.k] !== undefined) e.value = SHEET[e.dataset.k]; });
}
/* Save the worksheet; say so if the browser refuses. */
function saveSheet() {
  try { localStorage.setItem(SHEET_KEY, JSON.stringify(SHEET)); sheetMsg('Saved in this browser.', false); }
  catch (e) { sheetMsg('Could not save in this browser. Use “Export my answers” before you close the page.', true); }
}
document.querySelectorAll('[data-k]').forEach(e => e.addEventListener('input', () => { SHEET[e.dataset.k] = String(e.value).slice(0, SHEET_MAX); saveSheet(); }));
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('Clear every answer on this worksheet?')) return;
  SHEET = {}; document.querySelectorAll('[data-k]').forEach(e => { e.value = ''; }); resetTurn();
  try { localStorage.removeItem(SHEET_KEY); sheetMsg('Answers cleared.', false); } catch (e) { sheetMsg('Could not clear the stored copy in this browser.', true); }
});
document.getElementById('exportBtn').addEventListener('click', () => {
  const lines = ['Static Stability Limit — ECE 3033 Lecture 2 v2.0.0', 'Name: ' + (SHEET.name || ''), 'Section: ' + (SHEET.section || ''), 'Date: ' + (SHEET.date || ''), ''];
  document.querySelectorAll('#sheet [data-k]').forEach(e => { if (['name', 'section', 'date'].includes(e.dataset.k)) return;
    const lab = e.getAttribute('aria-label') || (e.closest('li') ? e.closest('li').firstChild.textContent.trim() : e.dataset.k);
    lines.push('[' + e.dataset.k + '] ' + lab, '  ' + (SHEET[e.dataset.k] || '(blank)')); });
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = 'Static_Stability_Limit_answers.txt'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); sheetMsg('Exported to Static_Stability_Limit_answers.txt.', false);
});

/* ═══ 11. LOOP ═══ */
let tPrev = performance.now();
/* One frame: advance δ, sound the Lab alarm, then draw the Lab when it is on screen; numbers 4 times a second. */
function frame(t) {
  const dt = S.paused ? 0 : Math.min(DT_MAX, (t - tPrev) / 1000); tPrev = t;
  if (dt > 0) { stepAngle(dt); if (S.run === 'slip' && t - S.lastBeep > BEEP_EVERY_MS) { S.lastBeep = t; beep(BEEP_S); } }
  if (PAGE === 'lab') { drawCurve(); drawLabFlow(); drawLabPhasor(); drawDial(); drawAlarms(); readouts(false); }
  requestAnimationFrame(frame);
}
buildCurve6(); drawCurve6(); buildLabFlow(); buildLabPhasor(); buildDial(); loadSheet(); setup(LAB_START);
requestAnimationFrame(frame);

