/* RF Cascade Analyzer — View 1, Reflections: what happens at an interface between two regions (Z01 = 50 Ω and Z02).
   Top (about 30 %), power at the interface: band arrows whose thickness is proportional to power, incident and
   transmitted on one row, reflected on a row of its own. Bottom (about 70 %), voltage on the lines: 2λ of Region 1 and
   Region 2 fading out on to ∞, with the envelope, the total wave in Region 1 and the transmitted wave in Region 2
   (animated; the incident and reflected waves on request), and a small readout of V⁺ + V⁻ = Vₜ in the top-right corner.
   At an open or a short nothing travels into Region 2: a marker on the interface shows the voltage there and a note
   says what happens (open: V = 2V⁺, I = 0; short: V = 0, I = 2I⁺).
   Titles, the legend and the caption are in the side panel. Both regions are real, so Γ and τ = 1 + Γ are real and
   shown signed; both regions have the same propagation speed (same λ). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — reference impedance, slider taper, layout
   2. State            — Z02 (Ω, or ∞ for an open), incident/reflected switch, number formats
   3. Power panel      — regions, interface, band arrows
   4. Voltage panel    — geometry, curves, envelope, Vmax / Vmin labels, interface readout, axis
   5. Panel            — Γ and VSWR, the Z02 control, τ, the notes, the incident/reflected switch and the legend
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const SHADE = 0.12, SHADE_VR = 0.04;   // envelope fill opacity: normally, and while the incident and reflected waves are shown
const VR_W = 2.5, VR_DASH = '9 5';      // incident and reflected waves: dashed, heavy enough to read over the envelope shade
const Z01 = 50;                  // Region 1 impedance (Ω, fixed)
const Z02_POS = 1000;            // Z02 slider: 0 → short, 1..999 → 1..1000 Ω (log), 1000 → ∞ (open)
const Z02_DEC = 3;               // decades on the log part of the slider
const WAVE_HZ = 0.5;             // wave frequency on screen (Hz)
const WAVE_N = 120;              // samples per wavelength along a drawn curve
const R1_LAMBDA = 2;             // Region 1 drawn: 2λ
const R2_LAMBDA = 0.75;          // Region 2 drawn: 0.75λ, then the curves fade out
const R2_FADE = 40;              // fade length (units) after Region 2's drawn part
const A_MAX = 2;                 // the largest possible amplitude (open: total and transmitted reach 2)
const FS_READ = [18, 15];        // interface readout: line 1 (bold), line 2
const FS_TICK = 14;              // distance-axis labels
/* Layout (design units = px at 1280×720). split: the power panel's share of the height. Power panel: region boxes from
   regTop with their labels at regLab; incident (and transmitted) band at yI, reflected band rowGap below the incident
   head at its thickest; arrow labels labUp above / below their band. Voltage panel: the readout box (readH) in the
   top-right corner, above the region tints; plotL..iface: Region 1 (2λ), the interface at 70 % of the width; the
   distance axis axisUp above the bottom. */
const LY_R = { split: 0.28, edge: 16, regTop: 4, regLab: 20, band: 28, x0: 40, xi: 450, x1: 860, yI0: 73, rowGap: 10, labUp: 28, minBot: 173,
               plotL: 130, iface: 630, readTop: 6, readH: 54, readPad: 8, tintGap: 6, tintPad: 6, axisUp: 37, lvlOff: 11, lvlGap: 28 };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const R = { z02: 150, vr: false };   // vr: show the incident and reflected curves (off by default)
// Slider position -> Z02 (0, 1..1000 Ω on a log taper, ∞).
const zFromPos = p => (p <= 0 ? 0 : p >= Z02_POS ? Infinity : +Math.pow(10, Z02_DEC * (p - 1) / (Z02_POS - 2)).toPrecision(3));
// Z02 -> slider position.
const posFromZ = z => (z === Infinity ? Z02_POS : z < 1 ? 0 : Math.min(Z02_POS - 1, Math.round(1 + (Z02_POS - 2) * Math.log10(z) / Z02_DEC)));
// Γ and τ at the interface (real): +1 and 2 for an open, −1 and 0 for a short.
const gammaR = () => (R.z02 === Infinity ? 1 : gammaInterface(Z01, R.z02));
const tauR = () => tauInterface(Z01, R.z02);
// VSWR to 2 significant figures; ∞ at |Γ| = 1.
const vswr2 = gm => { const v = vswr(gm); return v.kind === 'num' ? sig2(v.v) : '∞'; };
// Z02 as text for the drawing and the number box.
const z02Text = () => (R.z02 === Infinity ? '∞ (open)' : R.z02 === 0 ? '0 (short)' : zNum(R.z02) + ' Ω');
// A real coefficient signed to 2 decimals ("+0.50", "−1.00"); "0" for zero. plus: write the + sign.
const coef = (v, plus) => (Math.abs(v) < 0.005 ? '0' : (plus && v > 0 ? '+' : '') + fx(v, 2));
// A term of the sum 1 + Γ: a negative Γ in brackets ("(−0.50)").
const term = v => (v < -0.0049 ? '(' + coef(v) + ')' : coef(v));
// Z02 in the power formula (3 significant figures: 150, 16.7, 50).
const zNum = z => String(+z.toPrecision(3));
// ── END STATE ─────────────────────────────────────────────────

// ── POWER PANEL ───────────────────────────────────────────────
/* The two regions, the interface and the three power arrows (thickness ∝ power, incident = full thickness). Incident
   and transmitted share the upper row; the reflected arrow has its own lower row, rowGap clear of the incident head
   at the thickest. Extra height goes between the rows and above them. */
function powerPanel(H){
  const L = LY_R, gm = Math.abs(gammaR()), split = powerSplit(gm), T = L.band, xi = L.xi, head = Math.max(22, T * 1.7) / 2;
  const regBot = H * L.split - 6, spare = Math.max(0, regBot - L.minBot), yI = L.yI0 + spare * 0.3, yR = yI + 2 * head + L.rowGap + spare * 0.4;
  let s = el('rect', { x: 8, y: L.regTop, width: xi - 8, height: regBot - L.regTop, fill: 'var(--bg2)', stroke: 'var(--line)', rx: 6 });
  s += el('rect', { x: xi, y: L.regTop, width: DESIGN_W - 8 - xi, height: regBot - L.regTop, fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 });
  s += txt(24, L.regLab, 'Region 1 · Z_01 = 50 Ω');
  s += txt(xi + 24, L.regLab, 'Region 2 · Z_02 = ' + z02Text(), { id: 'z02Label' });
  s += el('line', { x1: xi, y1: L.regTop, x2: xi, y2: regBot, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  s += bandArrow(L.x0, xi, yI, T, { col: 'var(--neutral)', q: 'P_inc', v: 1, ref: T, op: 0.6 });
  s += txt(L.x0, yI - L.labUp, 'Incident ' + pct2(1), { id: 'pInc' });
  s += bandArrow(xi, L.x1, yI, split.deliv > 1e-9 ? T * split.deliv : 0, { col: 'var(--s21)', q: 'P_trans', v: split.deliv, ref: T });
  s += txt(xi + 24, yI - L.labUp, 'Transmitted 1 − |Γ|² = ' + pct2(split.deliv), { fill: 'var(--s21)', id: 'pTrans' });
  s += bandArrow(xi, L.x0, yR, split.refl > 1e-9 ? T * split.refl : 0, { col: 'var(--s11)', q: 'P_refl', v: split.refl, ref: T });
  s += txt(xi - 16, yR + L.labUp, 'Reflected |Γ|² = ' + pct2(split.refl), { anchor: 'end', fill: 'var(--s11)', id: 'pRefl' });
  return s;
}
// ── END POWER PANEL ───────────────────────────────────────────

// ── VOLTAGE PANEL ─────────────────────────────────────────────
// Geometry of the voltage panel for a drawing H units tall.
function geoV(H){
  const L = LY_R, top = H * L.split + 2, tintTop = top + L.readTop + L.readH + L.tintGap, plotTop = tintTop + L.tintPad, yAxis = H - L.axisUp;
  const A = (yAxis - 8 - plotTop) / (2 * A_MAX), ppl = (L.iface - L.plotL) / R1_LAMBDA;
  return { top, tintTop, plotTop, yAxis, A, yc: plotTop + A_MAX * A, ppl, xi: L.iface, x2: L.iface + R2_LAMBDA * ppl };
}
// x of a point d wavelengths into Region 1 (from the interface, leftwards), or x wavelengths into Region 2.
const xR1 = (G, d) => G.xi - d * G.ppl;
const xR2 = (G, x) => G.xi + x * G.ppl;
// A curve y = yc − A·f(u) as a path over u = 0 … uMax wavelengths, placed by xOf.
function curve(G, xOf, uMax, f){
  const n = Math.ceil(WAVE_N * uMax); let p = '';
  for(let k = 0; k <= n; k++){ const u = uMax * k / n; p += (k ? 'L' : 'M') + n2(xOf(G, u)) + ' ' + n2(G.yc - G.A * f(u)); }
  return p;
}
// Region 2's extent including the fade (wavelengths).
const r2Len = G => R2_LAMBDA + R2_FADE / G.ppl;
/* The four instantaneous waves at time t (s). d: distance into Region 1, x: into Region 2, β = 2π/λ.
   Incident cos(ωt + βd), reflected Γ·cos(ωt − βd), total their sum, transmitted τ·cos(ωt − βx). At the interface the
   total is (1 + Γ)cos ωt = τ cos ωt, the transmitted wave there: the two lines meet at every instant. yIf: that voltage's
   height, for the interface marker drawn at an open or a short. */
function wavePathsV(G, t){
  const g = gammaR(), tau = tauR(), wt = 2 * Math.PI * WAVE_HZ * t, tw = 2 * Math.PI;
  return { inc: curve(G, xR1, R1_LAMBDA, d => Math.cos(wt + tw * d)), ref: curve(G, xR1, R1_LAMBDA, d => g * Math.cos(wt - tw * d)),
           tot: curve(G, xR1, R1_LAMBDA, d => Math.cos(wt + tw * d) + g * Math.cos(wt - tw * d)), tr: curve(G, xR2, r2Len(G), x => tau * Math.cos(wt - tw * x)),
           yIf: n2(G.yc - G.A * tau * Math.cos(wt)) };   // the voltage at the interface, τ cos ωt
}
/* The interface readout: V⁺ + V⁻ = Vₜ with the numbers (line 1, bold), and the transmitted power from Vₜ (line 2), in a
   small rounded box in the voltage panel's top-right corner, above the curves (it can never meet one). */
function readout(y0){
  const g = gammaR(), tau = tauR(), z = R.z02, [f1, f2] = FS_READ, l1 = 'V⁺ + V⁻ = Vₜ   1 + ' + term(g) + ' = ' + coef(tau);
  const l2 = z === 0 ? 'Vₜ = 0 → Pₜ = 0 %' : z === Infinity ? 'Pₜ = 0 % (Z02 = ∞)' : Math.abs(g) < 0.005 ? 'Pₜ = 100 %'
    : 'Pₜ = Vₜ²·Z01/Z02 = ' + coef(tau) + '² × 50/' + zNum(z) + ' = ' + pct2(tau * tau * Z01 / z);
  const w = Math.max(textW(l1, f1), textW(l2, f2)) + 2 * LY_R.readPad, rh = LY_R.readH, x = DESIGN_W - LY_R.edge - w;
  return el('g', { class: 'readout' }, el('rect', { x, y: y0, width: w, height: rh, rx: 8, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 1.5 })
    + txt(x + w / 2, y0 + 16, l1, { anchor: 'middle', size: f1, weight: 700, id: 'readV', cls: 'readv' })
    + txt(x + w / 2, y0 + 38, l2, { anchor: 'middle', size: f2, weight: 400, id: 'readP' }))
    + el('g', { 'data-q': 'Gamma', 'data-v': +g.toPrecision(12) }, '') + el('g', { 'data-q': 'tau', 'data-v': +tau.toPrecision(12) }, '');
}
// An open or a short at the interface: no line beyond it, so no wave travels into Region 2.
const endZ = () => R.z02 === Infinity || R.z02 === 0;
/* What happens at an open or a short, written in Region 2: the voltage there (2V⁺ or 0), the current (0 or 2I⁺), and
   that no power enters Region 2. */
const END_NOTE = { open: ['Open circuit:', 'V = 2V⁺, I = 0', 'no power enters', 'Region 2'], short: ['Short circuit:', 'V = 0, I = 2I⁺', 'no power enters', 'Region 2'] };
// Panel 2: the voltage on the lines.
function voltagePanel(H){
  const G = geoV(H), g = gammaR(), gm = Math.abs(g), tau = tauR(), vmax = 1 + gm, vmin = 1 - gm, L = LY_R, x2f = xR2(G, r2Len(G));
  // region tints (the top panel names the regions)
  const tintBot = G.yAxis - 4;
  let s = el('rect', { x: L.plotL - 6, y: G.tintTop, width: G.xi - L.plotL + 6, height: tintBot - G.tintTop, fill: 'var(--bg2)', stroke: 'none', class: 'tint' });
  s += el('rect', { x: G.xi, y: G.tintTop, width: DESIGN_W - L.edge + 4 - G.xi, height: tintBot - G.tintTop, fill: 'var(--panel)', stroke: 'none', class: 'tint' });
  // zero line, envelope (Region 1: ±|1 + Γe^(−j2βd)|; Region 2: ±|τ|, flat)
  s += el('line', { x1: L.plotL, y1: G.yc, x2: x2f, y2: G.yc, stroke: 'var(--line)', 'stroke-width': 1, class: 'zero' });
  let top = '', bot = '';
  const n = WAVE_N * R1_LAMBDA;
  for(let k = 0; k <= n; k++){ const d = R1_LAMBDA * (1 - k / n), v = envelope(C(g, 0), d) * G.A, x = n2(xR1(G, d));
    top += (k ? 'L' : 'M') + x + ' ' + n2(G.yc - v); bot = 'L' + x + ' ' + n2(G.yc + v) + bot; }
  const at = Math.abs(tau) * G.A, xe = n2(xR2(G, R2_LAMBDA)), end = endZ();
  if(!end){ top += 'L' + xe + ' ' + n2(G.yc - at); bot = 'L' + xe + ' ' + n2(G.yc + at) + 'L' + n2(G.xi) + ' ' + n2(G.yc + at) + bot; }   // Region 2: flat at |τ|
  // the shade is kept faint while the incident and reflected waves are shown, so they stand out against it
  s += el('path', { d: top + bot + 'Z', fill: 'var(--s12)', 'fill-opacity': R.vr ? SHADE_VR : SHADE, stroke: 'none', class: 'shade' });
  s += el('path', { d: top, fill: 'none', stroke: 'var(--s12)', 'stroke-width': 1.5, class: 'envelope', 'data-q': 'envelope', 'data-v': +gm.toPrecision(12), 'data-a': n2(G.A), 'data-yc': n2(G.yc), 'data-tau': +Math.abs(tau).toPrecision(12) });
  s += el('path', { d: 'M' + bot.slice(1), fill: 'none', stroke: 'var(--s12)', 'stroke-width': 1.5, class: 'envelope' });
  // V_max and V_min: short labels at the left end of the envelope (V_max just above its level, V_min just below; spread
  // apart when the two levels are close, as when matched)
  const off = Math.max(L.lvlOff, (L.lvlGap - (vmax - vmin) * G.A) / 2), lvl = (v, q, dy) => el('g', { class: 'level', 'data-q': q, 'data-v': +v.toPrecision(12), 'data-y': n2(G.yc - v * G.A) },
    txt(L.plotL - 8, G.yc - v * G.A + dy, (q === 'Vmax' ? 'V_max ' : 'V_min ') + sig2(v), { anchor: 'end', id: 'lv' + q }));
  s += lvl(vmax, 'Vmax', -off) + lvl(vmin, 'Vmin', off);
  // the waves: Region 2's fade out over its last R2_FADE units (a mask), then a small arrow on to ∞
  const P = wavePathsV(G, app.tNow), x2 = xR2(G, R2_LAMBDA);
  s += el('defs', {}, el('linearGradient', { id: 'r2fade', gradientUnits: 'userSpaceOnUse', x1: x2, y1: 0, x2: x2f, y2: 0 },
      el('stop', { offset: 0, 'stop-color': '#fff' }) + el('stop', { offset: 1, 'stop-color': '#000' }))
    + el('mask', { id: 'r2mask', maskUnits: 'userSpaceOnUse', x: G.xi - 4, y: G.plotTop - 10, width: DESIGN_W, height: G.yAxis - G.plotTop + 20 },
      el('rect', { x: G.xi - 4, y: G.plotTop - 10, width: x2 - G.xi + 4, height: G.yAxis - G.plotTop + 20, fill: '#fff' })
      + el('rect', { x: x2, y: G.plotTop - 10, width: x2f - x2, height: G.yAxis - G.plotTop + 20, fill: 'url(#r2fade)' })));
  const vr = R.vr ? null : 'none';
  s += el('path', { id: 'vInc', d: P.inc, fill: 'none', stroke: 'var(--grey)', 'stroke-width': VR_W, 'stroke-dasharray': VR_DASH, display: vr, class: 'vcurve', 'data-q': 'V_inc', 'data-v': 1 });
  s += el('path', { id: 'vRef', d: P.ref, fill: 'none', stroke: 'var(--s11)', 'stroke-width': VR_W, 'stroke-dasharray': VR_DASH, display: vr, class: 'vcurve', 'data-q': 'V_refl', 'data-v': +g.toPrecision(12) });
  s += el('path', { id: 'vTot', d: P.tot, fill: 'none', stroke: 'var(--txt)', 'stroke-width': 3, 'stroke-linejoin': 'round', class: 'vcurve', 'data-q': 'V_tot' });
  s += el('path', { id: 'vTr', d: P.tr, fill: 'none', stroke: 'var(--s21)', 'stroke-width': 3, 'stroke-linejoin': 'round', mask: 'url(#r2mask)', display: end ? 'none' : null, class: 'vcurve', 'data-q': 'V_trans', 'data-v': +tau.toPrecision(12) });
  if(!end) s += el('path', { d: 'M' + n2(x2f + 2) + ' ' + n2(G.yc) + 'H' + n2(DESIGN_W - L.edge - 10), stroke: 'var(--mut)', 'stroke-width': 1.5, fill: 'none', class: 'toinf' })
    + el('path', { d: 'M' + n2(DESIGN_W - L.edge) + ' ' + n2(G.yc) + 'l-10 -5v10Z', fill: 'var(--mut)', class: 'toinf' });
  else (R.z02 === 0 ? END_NOTE.short : END_NOTE.open).forEach((t, i) => { s += txt((G.xi + DESIGN_W - L.edge) / 2, G.plotTop + 28 + 22 * i, t, { anchor: 'middle', weight: i ? 400 : 600, cls: 'endnote' }); });
  // the interface, and the readout in the top-right corner
  s += el('line', { x1: G.xi, y1: G.tintTop, x2: G.xi, y2: G.yAxis - 8, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  s += readout(G.top + L.readTop);
  // at an open or a short: a marker on the interface at the voltage there (τ cos ωt: ±2 for an open, 0 for a short)
  if(end) s += el('circle', { id: 'vIf', cx: G.xi, cy: P.yIf, r: 7, fill: 'var(--txt)', stroke: 'var(--panel)', 'stroke-width': 2, 'data-q': 'V_if', 'data-v': +tau.toPrecision(12) });
  // distance axis: Region 1 2λ … interface, Region 2 λ/4, λ/2
  s += el('line', { x1: L.plotL, y1: G.yAxis - 8, x2: x2f, y2: G.yAxis - 8, stroke: 'var(--mut)', 'stroke-width': 1.5 });
  const tk = (x, t, anchor, tx) => el('line', { x1: x, y1: G.yAxis - 13, x2: x, y2: G.yAxis - 3, stroke: 'var(--mut)', 'stroke-width': 1.5 })
    + txt(tx === undefined ? x : tx, G.yAxis + 12, t, { anchor, size: FS_TICK, fill: 'var(--mut)', weight: 400 });
  [[2, '2λ'], [1.5, '3λ/2'], [1, 'λ'], [0.5, 'λ/2']].forEach(([d, t]) => { s += tk(xR1(G, d), t, 'middle'); });
  s += tk(G.xi, 'interface', 'end', G.xi - 6);
  [[0.25, 'λ/4'], [0.5, 'λ/2']].forEach(([x, t]) => { s += tk(xR2(G, x), t, 'middle'); });
  return s;
}
// The whole drawing for a drawing H units tall.
function drawReflections(H){ return svgRoot(H, 'Power at the interface, and the total and transmitted voltage on the lines', powerPanel(H) + voltagePanel(H)); }
// Move the four waves to time t (animation frame).
function tickReflections(H, t){
  const P = wavePathsV(geoV(H), t), set = (id, d) => { const e = document.getElementById(id); if(e) e.setAttribute('d', d); };
  set('vInc', P.inc); set('vRef', P.ref); set('vTot', P.tot); set('vTr', P.tr);
  const m = document.getElementById('vIf'); if(m) m.setAttribute('cy', P.yIf);
}
// ── END VOLTAGE PANEL ─────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// The voltage panel's legend, in the side panel: name and swatch style (template.html .sw.*).
const LEGEND = [['incident v⁺', 'inc'], ['reflected v⁻', 'refl'], ['total (Region 1)', 'tot'], ['transmitted vₜ', 'tr'], ['envelope', 'env']];
/* Side panel: Γ (signed) and VSWR, the Z02 slider with its box, Matched / Short / Open, τ, the power note, the voltage
   panel's title, the incident/reflected switch, the legend and the caption. */
function panelReflections(){
  const g = gammaR(), gm = Math.abs(g), set = z => { R.z02 = z; redraw(true); };
  const box = h('input', { type: 'text', id: 'z02Box', value: R.z02 === Infinity ? '∞' : String(R.z02), attrs: { 'aria-label': 'Z02 in ohms (∞ or "open" for an open)', inputmode: 'decimal' } });
  box.addEventListener('change', () => { const w = box.value.trim().toLowerCase(), z = OPEN_WORDS.includes(w) ? Infinity : SHORT_WORDS.includes(w) ? 0 : +w;
    const okv = (z === Infinity || (box.value.trim() !== '' && isFinite(z) && z >= 0 && z <= 1e6));
    box.classList.toggle('invalid', !okv); box.setAttribute('aria-invalid', okv ? 'false' : 'true'); if(okv) set(z); });
  const rng = h('input', { type: 'range', id: 'z02', min: 0, max: Z02_POS, step: 1, value: posFromZ(R.z02), attrs: { 'aria-label': 'Z02', 'aria-valuetext': 'Z02 ' + z02Text() } });
  rng.addEventListener('input', () => { R.z02 = zFromPos(+rng.value); box.value = R.z02 === Infinity ? '∞' : String(R.z02); box.classList.remove('invalid'); redraw(false); });
  const vr = h('input', { type: 'checkbox', id: 'showVR', checked: R.vr });
  vr.addEventListener('change', () => { R.vr = vr.checked; redraw(false); syncHash(); });
  const pre = R.z02 === Z01 ? 'm' : R.z02 === 0 ? 's' : R.z02 === Infinity ? 'o' : '';
  return [h('div', { cls: 'heads' }, headline('Γ', coef(g, true), 'roGamma'), headline('VSWR', vswr2(gm), 'roVswr')),
    h('div', { cls: 'ctl' }, h('label', { htmlFor: 'z02', text: 'Z02, Region 2 (Ω)' }), h('div', { cls: 'row' }, rng, box)),
    h('div', { cls: 'btnrow' }, pbtn('bMatch', 'Matched (50)', pre === 'm', () => set(Z01)), pbtn('bShort', 'Short (0)', pre === 's', () => set(0)),
      pbtn('bOpen', 'Open (∞)', pre === 'o', () => set(Infinity))),
    h('p', { cls: 'tauline', id: 'roTau', text: 'τ = 1 + Γ = ' + coef(tauR()) }),
    note('Power at the interface — arrow thickness = share of the power (incident = 100 %)'),
    h('div', { cls: 'sec', text: 'Voltage on the lines (incident amplitude = 1)' }),
    h('label', { cls: 'chk' }, vr, ' Show incident and reflected'),
    h('ul', { cls: 'legend', attrs: { 'aria-label': 'Curves' } }, LEGEND.map(([name, cls]) => h('li', {}, h('span', { cls: 'sw ' + cls }), name))),
    h('p', { cls: 'cap', text: 'Both regions have the same propagation speed (same λ). Region 2 is infinitely long.' })];
}
// Refresh the panel's readouts and preset buttons after a slider move (the panel itself is not rebuilt).
function syncReflections(){
  const g = gammaR(), set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  set('roGamma', coef(g, true)); set('roVswr', vswr2(Math.abs(g))); set('roTau', 'τ = 1 + Γ = ' + coef(tauR()));
  const pre = { bMatch: R.z02 === Z01, bShort: R.z02 === 0, bOpen: R.z02 === Infinity };
  for(const id in pre){ const b = document.getElementById(id); if(b) b.setAttribute('aria-pressed', String(pre[id])); }
  const r = document.getElementById('z02'); if(r) r.setAttribute('aria-valuetext', 'Z02 ' + z02Text());
}
// ── END PANEL ─────────────────────────────────────────────────
