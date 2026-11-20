/* RF Cascade Analyzer — View 1, Reflections: what happens at an interface between two regions (Z01 = 50 Ω and Z02).
   Top (about 30 %), power at the interface: band arrows whose thickness is proportional to power, incident and
   transmitted on one row, reflected on a row of its own. Bottom (about 70 %), voltage on the lines: 2λ of Region 1 and
   Region 2 fading out on to ∞, with the envelope, the total wave in Region 1 and the transmitted wave in Region 2
   (animated; the incident and reflected waves on request), and a small readout of V⁺ + V⁻ = Vₜ in the top-right corner.
   At an open or a short nothing travels into Region 2: a marker on the interface shows the voltage there and a note
   says what happens (open: V = 2V⁺, I = 0; short: V = 0, I = 2I⁺).
   Titles, the legend and the caption are in the side panel. Both regions are real, so Γ and τ = 1 + Γ are real and
   shown signed; both regions have the same propagation speed (same λ).
   v1.8.1: each frame recomputes only the wave heights (geometry, Γ, τ and sample positions are cached at draw,
   CQ-RFC-005); the Z02 box takes a strict decimal number, 0 or 1–1000 Ω, or open/short, and names the cause of a refusal. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — reference impedance, slider taper, Z02 limits, layout
   2. State            — Z02 (Ω, or ∞ for an open), incident/reflected switch, number formats
   3. Power panel      — regions, interface, band arrows
   4. Voltage panel    — geometry, curves, envelope, Vmax / Vmin labels, interface readout, axis, the animation cache
   5. Panel            — Γ and VSWR, the Z02 control, τ, the notes, the incident/reflected switch and the legend
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const SHADE = 0.12;                 // envelope fill opacity (none while the incident and reflected waves are shown)
const ENV_VR = 0.5;                 // envelope outline opacity while they are shown, so the waves stand out
const VR_W = 2.5, VR_DASH = '9 5';      // incident and reflected waves: dashed, heavy enough to read over the envelope shade
const Z01 = 50;                  // Region 1 impedance (Ω, fixed)
const Z02_INIT = 150;            // Z02 at start-up (Ω)
const Z02_POS = 1000;            // Z02 slider: 0 → short, 1..999 → 1..1000 Ω (log), 1000 → ∞ (open)
const Z02_DEC = 3;               // decades on the log part of the slider
const Z02_MIN = 1, Z02_MAX = 1000;   // finite Z02 range (Ω) shared by the slider and the box (CQ-RFC-013); 0 = short, ∞ = open
const Z02_SIG = 3;               // significant figures of Z02 on the slider taper and in the drawing
const WAVE_HZ = 0.5;             // wave frequency on screen (Hz)
const WAVE_N = 120;              // samples per wavelength along a drawn curve
const R1_LAMBDA = 2;             // Region 1 drawn: 2λ
const R2_LAMBDA = 0.75;          // Region 2 drawn: 0.75λ, then the curves fade out
const R2_FADE = 40;              // fade length (units) after Region 2's drawn part
const A_MAX = 2;                 // the largest possible amplitude (open: total and transmitted reach 2)
const FS_READ = [18, 15];        // interface readout: line 1 (bold), line 2
const FS_TICK = 14;              // distance-axis labels
const COEF_ZERO = 0.005;         // a coefficient below this shows as "0" (one threshold for every coefficient, CQ-RFC-001)
const P_SHOW_ZERO = 1e-9;        // a power share below this draws a ghost arrow
const DEC_COEF = 2;              // Γ and τ: 2 decimals
const R1_TICKS = [[2, '2λ'], [1.5, '3λ/2'], [1, 'λ'], [0.5, 'λ/2']], R2_TICKS = [[0.25, 'λ/4'], [0.5, 'λ/2']];   // distance-axis ticks (wavelengths from the interface)
/* Layout (design units = px at 1280×720). split: the power panel's share of the height. Power panel: region boxes from
   regTop with their labels at regLab (inset regIn from the box edge, boxes boxIn from the drawing's edge, corner regR);
   incident (and transmitted) band at yI0, reflected band rowGap below the incident head at its thickest; spare height
   shared spareI above the incident row and spareR between the rows; arrow labels labUp above / below their band, the
   reflected label refIn left of the interface. Voltage panel: the readout box (readH) in the top-right corner, above
   the region tints; plotL..iface: Region 1 (2λ), the interface at 70 % of the width; the distance axis axisUp above the
   bottom, its line axisGap above that, ticks tickLen long; Vmax/Vmin labels lvlOff from their level (lvlGap apart at
   least); the end note's lines from noteTop, noteGap apart; the interface marker markR. */
const LY_R = { split: 0.28, edge: 16, regTop: 4, regLab: 20, regIn: 24, boxIn: 8, regR: 6, regGap: 6, band: 28, x0: 40, xi: 450, x1: 860, yI0: 73, rowGap: 10,
               spareI: 0.3, spareR: 0.4, labUp: 28, refIn: 16, minBot: 173, incOp: 0.6, ifaceSw: 3,
               plotL: 130, iface: 630, readTop: 6, readH: 54, readPad: 8, readR: 8, readL1: 16, readL2: 38, readSw: 1.5, tintGap: 6, tintPad: 6, tintIn: 4,
               axisUp: 37, axisGap: 8, tickLen: 10, tickTop: 13, tickLab: 12, tickIn: 6, lineSw: 1.5, curveSw: 3, envSw: 1.5,
               lvlOff: 11, lvlGap: 28, lvlIn: 8, maskPad: 10, maskIn: 4, infGap: 2, infHead: 10, infHalf: 5, noteTop: 28, noteGap: 22, markR: 7, markSw: 2 };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const R = { z02: Z02_INIT, vr: false, anim: null };   // vr: show the incident and reflected curves (off by default); anim: the frame cache
// Slider position -> Z02 (0, 1..1000 Ω on a log taper, ∞).
const zFromPos = p => (p <= 0 ? 0 : p >= Z02_POS ? Infinity : +Math.pow(DECADE, Z02_DEC * (p - 1) / (Z02_POS - 2)).toPrecision(Z02_SIG));
// Z02 -> slider position.
const posFromZ = z => (z === Infinity ? Z02_POS : z < Z02_MIN ? 0 : Math.min(Z02_POS - 1, Math.round(1 + (Z02_POS - 2) * Math.log10(z) / Z02_DEC)));
// Γ and τ at the interface (real): +1 and 2 for an open, −1 and 0 for a short.
const gammaR = () => (R.z02 === Infinity ? 1 : gammaInterface(Z01, R.z02));
// τ at the interface
const tauR = () => tauInterface(Z01, R.z02);
// VSWR to 2 significant figures; ∞ at |Γ| = 1.
const vswr2 = gm => { const v = vswr(gm); return v.kind === 'num' ? sig2(v.v) : INF; };
// Z02 in the power formula (3 significant figures: 150, 16.7, 50).
const zNum = z => String(+z.toPrecision(Z02_SIG));
// Z02 as text for the drawing and the number box.
const z02Text = () => (R.z02 === Infinity ? INF + ' (open)' : R.z02 === 0 ? '0 (short)' : zNum(R.z02) + ' Ω');
// A real coefficient signed to 2 decimals ("+0.50", "−1.00"); "0" for zero. plus: write the + sign.
const coef = (v, plus) => (Math.abs(v) < COEF_ZERO ? '0' : (plus && v > 0 ? '+' : '') + fx(v, DEC_COEF));
// A term of the sum 1 + Γ: a negative Γ in brackets ("(−0.50)").
const term = v => (v <= -COEF_ZERO ? '(' + coef(v) + ')' : coef(v));
// ── END STATE ─────────────────────────────────────────────────

// ── POWER PANEL ───────────────────────────────────────────────
/* The two regions, the interface and the three power arrows (thickness ∝ power, incident = full thickness). Incident
   and transmitted share the upper row; the reflected arrow has its own lower row, rowGap clear of the incident head
   at the thickest. Extra height goes between the rows and above them. */
function powerPanel(H){
  const L = LY_R, gm = Math.abs(gammaR()), split = powerSplit(gm), T = L.band, xi = L.xi, head = Math.max(BAND.headMin, T * BAND.headK) / 2;
  const regBot = H * L.split - L.regGap, spare = Math.max(0, regBot - L.minBot), yI = L.yI0 + spare * L.spareI, yR = yI + 2 * head + L.rowGap + spare * L.spareR;
  return [
    el('rect', { x: L.boxIn, y: L.regTop, width: xi - L.boxIn, height: regBot - L.regTop, fill: 'var(--bg2)', stroke: 'var(--line)', rx: L.regR }),
    el('rect', { x: xi, y: L.regTop, width: DESIGN_W - L.boxIn - xi, height: regBot - L.regTop, fill: 'var(--panel)', stroke: 'var(--line)', rx: L.regR }),
    txt(L.regIn, L.regLab, 'Region 1 · Z_01 = ' + Z01 + ' Ω'),
    txt(xi + L.regIn, L.regLab, 'Region 2 · Z_02 = ' + z02Text(), { id: 'z02Label' }),
    el('line', { x1: xi, y1: L.regTop, x2: xi, y2: regBot, stroke: 'var(--s22)', 'stroke-width': L.ifaceSw, 'stroke-dasharray': DASH, class: 'iface' }),
    bandArrow(L.x0, xi, yI, T, { col: 'var(--neutral)', q: 'P_inc', v: 1, ref: T, op: L.incOp }),
    txt(L.x0, yI - L.labUp, 'Incident ' + pct2(1), { id: 'pInc' }),
    bandArrow(xi, L.x1, yI, split.deliv > P_SHOW_ZERO ? T * split.deliv : 0, { col: 'var(--s21)', q: 'P_trans', v: split.deliv, ref: T }),
    txt(xi + L.regIn, yI - L.labUp, 'Transmitted 1 − |Γ|² = ' + pct2(split.deliv), { fill: 'var(--s21)', id: 'pTrans' }),
    bandArrow(xi, L.x0, yR, split.refl > P_SHOW_ZERO ? T * split.refl : 0, { col: 'var(--s11)', q: 'P_refl', v: split.refl, ref: T }),
    txt(xi - L.refIn, yR + L.labUp, 'Reflected |Γ|² = ' + pct2(split.refl), { anchor: 'end', fill: 'var(--s11)', id: 'pRefl' })];
}
// ── END POWER PANEL ───────────────────────────────────────────

// ── VOLTAGE PANEL ─────────────────────────────────────────────
// Geometry of the voltage panel for a drawing H units tall.
function geoV(H){
  const L = LY_R, top = H * L.split + 2, tintTop = top + L.readTop + L.readH + L.tintGap, plotTop = tintTop + L.tintPad, yAxis = H - L.axisUp;
  const A = (yAxis - L.axisGap - plotTop) / (2 * A_MAX), ppl = (L.iface - L.plotL) / R1_LAMBDA;
  return { top, tintTop, plotTop, yAxis, A, yc: plotTop + A_MAX * A, ppl, xi: L.iface, x2: L.iface + R2_LAMBDA * ppl };
}
// x of a point d wavelengths into Region 1 (from the interface, leftwards), or x wavelengths into Region 2.
const xR1 = (G, d) => G.xi - d * G.ppl;
// x of a point x wavelengths into Region 2.
const xR2 = (G, x) => G.xi + x * G.ppl;
// Region 2's extent including the fade (wavelengths).
const r2Len = G => R2_LAMBDA + R2_FADE / G.ppl;
/* The sample positions of a curve over u = 0 … uMax wavelengths, placed by xOf: u values and the x text of each sample
   (computed once per draw; a frame computes only the heights). */
function samples(G, xOf, uMax){
  const n = Math.ceil(WAVE_N * uMax), u = [], x = [];
  for(let k = 0; k <= n; k++){ u.push(uMax * k / n); x.push(n2(xOf(G, u[k]))); }
  return { u, x };
}
// A curve y = yc − A·f(u) through cached samples, as path data.
function curveD(G, sm, f){ let p = ''; for(let k = 0; k < sm.u.length; k++) p += (k ? 'L' : 'M') + sm.x[k] + ' ' + n2(G.yc - G.A * f(sm.u[k])); return p; }
/* The four instantaneous waves at time t (s) from the frame cache c. d: distance into Region 1, x: into Region 2,
   β = 2π/λ. Incident cos(ωt + βd), reflected Γ·cos(ωt − βd), total their sum, transmitted τ·cos(ωt − βx). At the
   interface the total is (1 + Γ)cos ωt = τ cos ωt, the transmitted wave there: the two lines meet at every instant.
   yIf: that voltage's height, for the interface marker drawn at an open or a short. */
function wavePathsV(c, t){
  const { G, g, tau } = c, wt = 2 * Math.PI * WAVE_HZ * t, tw = 2 * Math.PI;
  return { inc: curveD(G, c.r1, d => Math.cos(wt + tw * d)), ref: curveD(G, c.r1, d => g * Math.cos(wt - tw * d)),
           tot: curveD(G, c.r1, d => Math.cos(wt + tw * d) + g * Math.cos(wt - tw * d)), tr: curveD(G, c.r2, x => tau * Math.cos(wt - tw * x)),
           yIf: n2(G.yc - G.A * tau * Math.cos(wt)) };   // the voltage at the interface, τ cos ωt
}
/* The interface readout: V⁺ + V⁻ = Vₜ with the numbers (line 1, bold), and the transmitted share of the incident power
   from Vₜ (line 2, PPR-RFC-009: Pₜ/P⁺ = |τ|²·Z01/Z02, P⁺ the incident power), in a small rounded box in the voltage panel's top-right
   corner, above the curves (it can never meet one). */
function readout(y0){
  const L = LY_R, g = gammaR(), tau = tauR(), z = R.z02, [f1, f2] = FS_READ, l1 = 'V⁺ + V⁻ = Vₜ\u00a0\u00a0 1 + ' + term(g) + ' = ' + coef(tau);   // no-break spaces keep the gap before the numbers
  const l2 = z === 0 ? 'Vₜ = 0 → Pₜ/P⁺ = 0 %' : z === Infinity ? 'Pₜ/P⁺ = 0 % (Z02 = ∞)' : Math.abs(g) < COEF_ZERO ? 'Pₜ/P⁺ = 100 %'
    : 'Pₜ/P⁺ = |τ|²·Z01/Z02 = ' + coef(tau) + '² × ' + Z01 + '/' + zNum(z) + ' = ' + pct2(tau * tau * Z01 / z);
  const w = Math.max(textW(l1, f1), textW(l2, f2)) + 2 * L.readPad, x = DESIGN_W - L.edge - w;
  return [el('g', { class: 'readout' }, el('rect', { x, y: y0, width: w, height: L.readH, rx: L.readR, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': L.readSw }),
      txt(x + w / 2, y0 + L.readL1, l1, { anchor: 'middle', size: f1, weight: FW.bold, id: 'readV', cls: 'readv' }),
      txt(x + w / 2, y0 + L.readL2, l2, { anchor: 'middle', size: f2, weight: FW.normal, id: 'readP' })),
    el('g', { 'data-q': 'Gamma', 'data-v': +g.toPrecision(DATA_SIG) }), el('g', { 'data-q': 'tau', 'data-v': +tau.toPrecision(DATA_SIG) })];
}
// An open or a short at the interface: no line beyond it, so no wave travels into Region 2.
const endZ = () => R.z02 === Infinity || R.z02 === 0;
/* What happens at an open or a short, written in Region 2: the voltage there (2V⁺ or 0), the current (0 or 2I⁺), and
   that no power enters Region 2. */
const END_NOTE = { open: ['Open circuit:', 'V = 2V⁺, I = 0', 'no power enters', 'Region 2'], short: ['Short circuit:', 'V = 0, I = 2I⁺', 'no power enters', 'Region 2'] };
// The envelope (Region 1: ±|1 + Γe^(−j2βd)|; Region 2: ±|τ|, flat) as its top and bottom path data.
function envelopePaths(G, g, tau){
  let top = '', bot = '';
  const n = WAVE_N * R1_LAMBDA;
  for(let k = 0; k <= n; k++){ const d = R1_LAMBDA * (1 - k / n), v = envelope(C(g, 0), d) * G.A, x = n2(xR1(G, d));
    top += (k ? 'L' : 'M') + x + ' ' + n2(G.yc - v); bot = 'L' + x + ' ' + n2(G.yc + v) + bot; }
  const at = Math.abs(tau) * G.A, xe = n2(xR2(G, R2_LAMBDA));
  if(!endZ()){ top += 'L' + xe + ' ' + n2(G.yc - at); bot = 'L' + xe + ' ' + n2(G.yc + at) + 'L' + n2(G.xi) + ' ' + n2(G.yc + at) + bot; }   // Region 2: flat at |τ|
  return { top, bot };
}
// The distance axis: Region 1 2λ … interface, Region 2 λ/4, λ/2.
function distanceAxis(G, x2f){
  const L = LY_R, ya = G.yAxis - L.axisGap;
  // one tick at x with its label t (anchor; tx moves the label)
  const tk = (x, t, anchor, tx) => [el('line', { x1: x, y1: G.yAxis - L.tickTop, x2: x, y2: G.yAxis - L.tickTop + L.tickLen, stroke: 'var(--mut)', 'stroke-width': L.lineSw }),
    txt(tx === undefined ? x : tx, G.yAxis + L.tickLab, t, { anchor, size: FS_TICK, fill: 'var(--mut)', weight: FW.normal })];
  return [el('line', { x1: L.plotL, y1: ya, x2: x2f, y2: ya, stroke: 'var(--mut)', 'stroke-width': L.lineSw }),
    R1_TICKS.map(([d, t]) => tk(xR1(G, d), t, 'middle')),
    tk(G.xi, 'interface', 'end', G.xi - L.tickIn),
    R2_TICKS.map(([x, t]) => tk(xR2(G, x), t, 'middle'))];
}
// Panel 2: the voltage on the lines. Fills the frame cache R.anim with the geometry, Γ, τ, samples and wave elements.
function voltagePanel(H){
  const G = geoV(H), g = gammaR(), gm = Math.abs(g), tau = tauR(), vmax = 1 + gm, vmin = 1 - gm, L = LY_R, x2f = xR2(G, r2Len(G)), end = endZ();
  const c = { G, g, tau, r1: samples(G, xR1, R1_LAMBDA), r2: samples(G, xR2, r2Len(G)) };
  const s = [];
  // region tints (the top panel names the regions)
  const tintBot = G.yAxis - L.tintIn;
  s.push(el('rect', { x: L.plotL - L.tintPad, y: G.tintTop, width: G.xi - L.plotL + L.tintPad, height: tintBot - G.tintTop, fill: 'var(--bg2)', stroke: 'none', class: 'tint' }),
    el('rect', { x: G.xi, y: G.tintTop, width: DESIGN_W - L.edge + L.tintIn - G.xi, height: tintBot - G.tintTop, fill: 'var(--panel)', stroke: 'none', class: 'tint' }));
  // zero line and envelope; no shade, and a lighter outline, while the incident and reflected waves are shown
  s.push(el('line', { x1: L.plotL, y1: G.yc, x2: x2f, y2: G.yc, stroke: 'var(--line)', 'stroke-width': 1, class: 'zero' }));
  const env = envelopePaths(G, g, tau);
  if(!R.vr) s.push(el('path', { d: env.top + env.bot + 'Z', fill: 'var(--s12)', 'fill-opacity': SHADE, stroke: 'none', class: 'shade' }));
  const envOp = R.vr ? ENV_VR : null;
  s.push(el('path', { d: env.top, fill: 'none', stroke: 'var(--s12)', 'stroke-width': L.envSw, 'stroke-opacity': envOp, class: 'envelope', 'data-q': 'envelope', 'data-v': +gm.toPrecision(DATA_SIG), 'data-a': n2(G.A), 'data-yc': n2(G.yc), 'data-tau': +Math.abs(tau).toPrecision(DATA_SIG) }),
    el('path', { d: 'M' + env.bot.slice(1), fill: 'none', stroke: 'var(--s12)', 'stroke-width': L.envSw, 'stroke-opacity': envOp, class: 'envelope' }));
  // V_max and V_min: short labels at the left end of the envelope (V_max just above its level, V_min just below; spread
  // apart when the two levels are close, as when matched)
  const off = Math.max(L.lvlOff, (L.lvlGap - (vmax - vmin) * G.A) / 2);
  // one level label: value v, data-q name q, vertical offset dy
  const lvl = (v, q, dy) => el('g', { class: 'level', 'data-q': q, 'data-v': +v.toPrecision(DATA_SIG), 'data-y': n2(G.yc - v * G.A) },
    txt(L.plotL - L.lvlIn, G.yc - v * G.A + dy, (q === 'Vmax' ? 'V_max ' : 'V_min ') + sig2(v), { anchor: 'end', id: 'lv' + q }));
  s.push(lvl(vmax, 'Vmax', -off), lvl(vmin, 'Vmin', off));
  // the waves: Region 2's fade out over its last R2_FADE units (a mask), then a small arrow on to ∞
  const P = wavePathsV(c, app.tNow), x2 = xR2(G, R2_LAMBDA), my = G.plotTop - L.maskPad, mh = G.yAxis - G.plotTop + 2 * L.maskPad;
  s.push(el('defs', {}, el('linearGradient', { id: 'r2fade', gradientUnits: 'userSpaceOnUse', x1: x2, y1: 0, x2: x2f, y2: 0 },
      el('stop', { offset: 0, 'stop-color': '#fff' }), el('stop', { offset: 1, 'stop-color': '#000' })),
    el('mask', { id: 'r2mask', maskUnits: 'userSpaceOnUse', x: G.xi - L.maskIn, y: my, width: DESIGN_W, height: mh },
      el('rect', { x: G.xi - L.maskIn, y: my, width: x2 - G.xi + L.maskIn, height: mh, fill: '#fff' }),
      el('rect', { x: x2, y: my, width: x2f - x2, height: mh, fill: 'url(#r2fade)' }))));
  const vr = R.vr ? null : 'none';
  c.inc = el('path', { id: 'vInc', d: P.inc, fill: 'none', stroke: 'var(--grey)', 'stroke-width': VR_W, 'stroke-dasharray': VR_DASH, display: vr, class: 'vcurve', 'data-q': 'V_inc', 'data-v': 1 });
  c.ref = el('path', { id: 'vRef', d: P.ref, fill: 'none', stroke: 'var(--s11)', 'stroke-width': VR_W, 'stroke-dasharray': VR_DASH, display: vr, class: 'vcurve', 'data-q': 'V_refl', 'data-v': +g.toPrecision(DATA_SIG) });
  c.tot = el('path', { id: 'vTot', d: P.tot, fill: 'none', stroke: 'var(--txt)', 'stroke-width': L.curveSw, 'stroke-linejoin': 'round', class: 'vcurve', 'data-q': 'V_tot', 'data-v': +vmax.toPrecision(DATA_SIG) });   // data-v: the total wave's peak, 1 + |Γ|
  c.tr = el('path', { id: 'vTr', d: P.tr, fill: 'none', stroke: 'var(--s21)', 'stroke-width': L.curveSw, 'stroke-linejoin': 'round', mask: 'url(#r2mask)', display: end ? 'none' : null, class: 'vcurve', 'data-q': 'V_trans', 'data-v': +tau.toPrecision(DATA_SIG) });
  s.push(c.inc, c.ref, c.tot, c.tr);
  if(!end) s.push(el('path', { d: 'M' + n2(x2f + L.infGap) + ' ' + n2(G.yc) + 'H' + n2(DESIGN_W - L.edge - L.infHead), stroke: 'var(--mut)', 'stroke-width': L.lineSw, fill: 'none', class: 'toinf' }),
    arrowHead(DESIGN_W - L.edge, G.yc, 1, 0, L.infHead, L.infHalf, { fill: 'var(--mut)', class: 'toinf' }));
  else (R.z02 === 0 ? END_NOTE.short : END_NOTE.open).forEach((t, i) => { s.push(txt((G.xi + DESIGN_W - L.edge) / 2, G.plotTop + L.noteTop + L.noteGap * i, t, { anchor: 'middle', weight: i ? FW.normal : FW.semi, cls: 'endnote' })); });
  // the interface, and the readout in the top-right corner
  s.push(el('line', { x1: G.xi, y1: G.tintTop, x2: G.xi, y2: G.yAxis - L.axisGap, stroke: 'var(--s22)', 'stroke-width': L.ifaceSw, 'stroke-dasharray': DASH, class: 'iface' }), readout(G.top + L.readTop));
  // at an open or a short: a marker on the interface at the voltage there (τ cos ωt: ±2 for an open, 0 for a short)
  c.mark = end ? el('circle', { id: 'vIf', cx: G.xi, cy: P.yIf, r: L.markR, fill: 'var(--txt)', stroke: 'var(--panel)', 'stroke-width': L.markSw, 'data-q': 'V_if', 'data-v': +tau.toPrecision(DATA_SIG) }) : null;
  s.push(c.mark, distanceAxis(G, x2f));
  R.anim = c;
  return s;
}
// The whole drawing for a drawing H units tall.
function drawReflections(H){ return svgRoot(H, 'Power at the interface, and the total and transmitted voltage on the lines', [powerPanel(H), voltagePanel(H)]); }
// Move the four waves to time t (animation frame): only the heights are computed; everything else is in R.anim.
function tickReflections(t){
  const c = R.anim; if(!c) return;
  const P = wavePathsV(c, t);
  c.inc.setAttribute('d', P.inc); c.ref.setAttribute('d', P.ref); c.tot.setAttribute('d', P.tot); c.tr.setAttribute('d', P.tr);
  if(c.mark) c.mark.setAttribute('cy', P.yIf);
}
// ── END VOLTAGE PANEL ─────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// The voltage panel's legend, in the side panel: name and swatch style (template.html .sw.*).
const LEGEND = [['incident v⁺', 'inc'], ['reflected v⁻', 'refl'], ['total (Region 1)', 'tot'], ['transmitted vₜ', 'tr'], ['envelope', 'env']];
const Z02_RULE = 'Z02 is 0 (short), ' + Z02_MIN + ' to ' + Z02_MAX + ' Ω, or open';
/* Read the Z02 box: "open" or "∞" (open), "short" (0), or a strict decimal number 0 or 1–1000 Ω. Returns { z } or
   { cause } (in words, DEFECT-RFC-002, -007). */
function readZ02(text){
  const w = text.trim().toLowerCase();
  if(w.length > INPUT_MAXLEN) return { cause: 'too long (over ' + INPUT_MAXLEN + ' characters)' };
  if(OPEN_WORDS.includes(w)) return { z: Infinity }; if(SHORT_WORDS.includes(w)) return { z: 0 };
  if(w === '') return { cause: 'empty' };
  const v = parseRealStrict(w);
  if(v === null) return { cause: 'not a decimal number (write e.g. 75, 1.5e2, open or short)' };
  if(v === 0 || (v >= Z02_MIN && v <= Z02_MAX)) return { z: v };
  return { cause: Z02_RULE };
}
// The Z02 box's text for the current value.
const z02BoxText = () => (R.z02 === Infinity ? INF : String(R.z02));
/* Side panel: Γ (signed) and VSWR, the Z02 slider with its box, Matched / Short / Open, τ, the power note, the voltage
   panel's title, the incident/reflected switch, the legend and the caption. */
function panelReflections(){
  // set Z02 and rebuild the panel (a preset button changes)
  const g = gammaR(), gm = Math.abs(g), set = z => { R.z02 = z; redraw(true); };
  const box = h('input', { type: 'text', id: 'z02Box', value: z02BoxText(), maxLength: INPUT_MAXLEN + 1, attrs: { 'aria-label': 'Z02 in ohms (∞ or "open" for an open)', inputmode: 'decimal', 'aria-describedby': 'z02BoxErr' } });
  const msg = errSpan('z02Box');
  box.addEventListener('change', () => { const r = readZ02(box.value);
    markInput(box, msg, r.cause && 'Refused: ' + r.cause + '; keeping ' + z02Text()); if(r.cause === undefined) set(r.z); });
  const rng = rangeInput({ id: 'z02', min: 0, max: Z02_POS, step: 1, value: posFromZ(R.z02), attrs: { 'aria-label': 'Z02', 'aria-valuetext': 'Z02 ' + z02Text() } });
  rng.addEventListener('input', () => { R.z02 = zFromPos(+rng.value); box.value = z02BoxText(); markInput(box, msg, ''); redraw(false); });
  const vr = h('input', { type: 'checkbox', id: 'showVR', checked: R.vr });
  vr.addEventListener('change', () => { R.vr = vr.checked; redraw(false); syncHash(); });
  const pre = R.z02 === Z01 ? 'm' : R.z02 === 0 ? 's' : R.z02 === Infinity ? 'o' : '';
  return [h('div', { cls: 'heads' }, headline('Γ', coef(g, true), 'roGamma'), headline('VSWR', vswr2(gm), 'roVswr')),
    h('div', { cls: 'ctl' }, h('label', { htmlFor: 'z02', text: 'Z02, Region 2 (Ω)' }), h('div', { cls: 'row' }, rng, box), msg),
    h('div', { cls: 'btnrow' }, pbtn('bMatch', 'Matched (' + Z01 + ')', pre === 'm', () => set(Z01)), pbtn('bShort', 'Short (0)', pre === 's', () => set(0)),
      pbtn('bOpen', 'Open (' + INF + ')', pre === 'o', () => set(Infinity))),
    h('p', { cls: 'tauline', id: 'roTau', text: 'τ = 1 + Γ = ' + coef(tauR()) }),
    note('Power at the interface — arrow thickness = share of the power (incident = 100 %)'),
    h('div', { cls: 'sec', text: 'Voltage on the lines (incident amplitude = 1)' }),
    h('label', { cls: 'chk' }, vr, ' Show incident and reflected'),
    h('ul', { cls: 'legend', attrs: { 'aria-label': 'Curves' } }, LEGEND.map(([name, cls]) => h('li', {}, h('span', { cls: 'sw ' + cls }), name))),
    h('p', { cls: 'cap', text: 'Both regions have the same propagation speed (same λ). Region 2 is infinitely long.' })];
}
// Refresh the panel's readouts and preset buttons after a slider move (the panel itself is not rebuilt).
function syncReflections(){
  const g = gammaR();
  // write text into the element with this id
  const set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  set('roGamma', coef(g, true)); set('roVswr', vswr2(Math.abs(g))); set('roTau', 'τ = 1 + Γ = ' + coef(tauR()));
  const pre = { bMatch: R.z02 === Z01, bShort: R.z02 === 0, bOpen: R.z02 === Infinity };
  for(const id in pre){ const b = document.getElementById(id); if(b) b.setAttribute('aria-pressed', String(pre[id])); }
  const r = document.getElementById('z02'); if(r) r.setAttribute('aria-valuetext', 'Z02 ' + z02Text());
}
// ── END PANEL ─────────────────────────────────────────────────
