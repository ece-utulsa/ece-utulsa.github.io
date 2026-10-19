/* RF Cascade Analyzer — View 1, Reflections: what happens at an interface between two regions (Z01 = 50 Ω and Z02).
   Panel 1, power at the interface: band arrows whose thickness is proportional to power. Panel 2, voltage on the lines:
   2λ of Region 1 and Region 2 running on to ∞ (no further reflections), with the incident, reflected, total and
   transmitted waves (animated), the standing-wave envelope, and a readout of V⁺ + V⁻ = Vₜ at the interface. Both regions
   are real, so Γ and τ = 1 + Γ are real and shown signed; both regions have the same propagation speed (same λ). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — reference impedance, slider taper, layout
   2. State            — Z02 (Ω, or ∞ for an open), incident/reflected switch, number formats
   3. Power panel      — regions, interface, band arrows
   4. Voltage panel    — geometry, curves, envelope, levels, legend, interface readout, axis, caption
   5. Panel            — Γ and VSWR, the Z02 control, τ, the incident/reflected switch
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const Z01 = 50;                  // Region 1 impedance (Ω, fixed)
const Z02_POS = 1000;            // Z02 slider: 0 → short, 1..999 → 1..1000 Ω (log), 1000 → ∞ (open)
const Z02_DEC = 3;               // decades on the log part of the slider
const WAVE_HZ = 0.5;             // wave frequency on screen (Hz)
const WAVE_N = 120;              // samples per wavelength along a drawn curve
const R1_LAMBDA = 2;             // Region 1 drawn: 2λ
const R2_LAMBDA = 0.75;          // Region 2 drawn: 0.75λ, then the curves fade out
const R2_FADE = 40;              // fade length (units) after Region 2's drawn part
const A_MAX = 2;                 // the largest possible amplitude (open: total and transmitted reach 2)
const FS_CAPTION = 16;           // the caption under the voltage panel (muted)
const FS_READ = 22;              // interface readout, line 1
/* Layout (design units = px at 1280×720). split: the power panel's share of the height. Power panel: region boxes from
   regTop, band arrows. Voltage panel rows: heading, legend, readout box, region tint (labels in its top band), curves,
   axis, caption; the tint's top band holds the region labels and (two lines, inside Region 2) the "continues to ∞" caption. plotL..xi: Region 1 (2λ); the interface at xi (70 % of the width); Region 2 to its right. */
const LY_R = { split: 0.38, edge: 16, regTop: 32, regLab: 46, labGap: 38, yInc: 0.465, reflUp: 60, band: 40, x0: 40, xi: 450, x1: 860,
               plotL: 130, iface: 630, headY: 14, legY: 50, readTop: 66, readH: 66, tintGap: 6, tintBand: 74, axisUp: 66, capUp: 27, lvlOff: 18 };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const R = { z02: 150, vr: true };   // vr: show the incident and reflected curves
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
// Panel 1: the two regions, the interface and the three power arrows (thickness ∝ power, incident = full thickness).
function powerPanel(H){
  const gm = Math.abs(gammaR()), split = powerSplit(gm), T = LY_R.band, xi = LY_R.xi;
  const off = Math.max(22, T * 1.7) / 2 + 14;   // arrow label above its arrow's centre
  // the incident arrow's labels stay labGap below the region labels (which carry a subscript)
  const regBot = H * LY_R.split - 8, yI = Math.max(LY_R.regTop + LY_R.yInc * (regBot - LY_R.regTop), LY_R.regLab + LY_R.labGap + off), yR = regBot - LY_R.reflUp;
  let s = heading(LY_R.edge, 14, 'Power at the interface (incident power = 100 %)');
  s += el('rect', { x: 8, y: LY_R.regTop, width: xi - 8, height: regBot - LY_R.regTop, fill: 'var(--bg2)', stroke: 'var(--line)', rx: 6 });
  s += el('rect', { x: xi, y: LY_R.regTop, width: DESIGN_W - 8 - xi, height: regBot - LY_R.regTop, fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 });
  s += txt(24, LY_R.regLab, 'Region 1 · Z_01 = 50 Ω');
  s += txt(xi + 24, LY_R.regLab, 'Region 2 · Z_02 = ' + z02Text(), { id: 'z02Label' });
  s += el('line', { x1: xi, y1: LY_R.regTop, x2: xi, y2: regBot, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  s += bandArrow(LY_R.x0, xi, yI, T, { col: 'var(--neutral)', q: 'P_inc', v: 1, ref: T, op: 0.6 });
  s += txt(LY_R.x0, yI - off, 'Incident power ' + pct2(1), { id: 'pInc' });
  s += bandArrow(xi, LY_R.x1, yI, split.deliv > 1e-9 ? T * split.deliv : 0, { col: 'var(--s21)', q: 'P_trans', v: split.deliv, ref: T });
  s += txt(xi + 24, yI - off, 'Transmitted power 1 − |Γ|² = ' + pct2(split.deliv), { fill: 'var(--s21)', id: 'pTrans' });
  s += bandArrow(xi, LY_R.x0, yR, split.refl > 1e-9 ? T * split.refl : 0, { col: 'var(--s11)', q: 'P_refl', v: split.refl, ref: T });
  s += txt(xi - 16, yR + Math.max(22, T * split.refl * 1.7) / 2 + 14, 'Reflected power |Γ|² = ' + pct2(split.refl), { anchor: 'end', fill: 'var(--s11)', id: 'pRefl' });
  return s;
}
// ── END POWER PANEL ───────────────────────────────────────────

// ── VOLTAGE PANEL ─────────────────────────────────────────────
// Geometry of the voltage panel for a drawing H units tall.
function geoV(H){
  const L = LY_R, top = H * L.split + 4, tintTop = top + L.readTop + L.readH + L.tintGap, yAxis = H - L.axisUp;
  const plotTop = tintTop + L.tintBand, A = (yAxis - 8 - plotTop) / (2 * A_MAX), ppl = (L.iface - L.plotL) / R1_LAMBDA;
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
   total is (1 + Γ)cos ωt = τ cos ωt, the transmitted wave there: the two lines meet at every instant. */
function wavePathsV(G, t){
  const g = gammaR(), tau = tauR(), wt = 2 * Math.PI * WAVE_HZ * t, tw = 2 * Math.PI;
  return { inc: curve(G, xR1, R1_LAMBDA, d => Math.cos(wt + tw * d)), ref: curve(G, xR1, R1_LAMBDA, d => g * Math.cos(wt - tw * d)),
           tot: curve(G, xR1, R1_LAMBDA, d => Math.cos(wt + tw * d) + g * Math.cos(wt - tw * d)), tr: curve(G, xR2, r2Len(G), x => tau * Math.cos(wt - tw * x)) };
}
// The legend row: a coloured swatch and a name per curve, left-aligned.
function legend(y){
  const items = [['incident v⁺', 'var(--grey)', '6 4', 2], ['reflected v⁻', 'var(--s11)', '6 4', 2], ['total (Region 1)', 'var(--txt)', null, 3.5],
                 ['transmitted vₜ', 'var(--s21)', null, 3.5], ['envelope', 'var(--s12)', null, 0]];
  let x = LY_R.edge, s = '';
  for(const [name, col, dash, w] of items){
    s += w ? el('line', { x1: x, y1: y, x2: x + 18, y2: y, stroke: col, 'stroke-width': w, 'stroke-dasharray': dash, class: 'swatch' })
           : el('rect', { x, y: y - 6, width: 18, height: 12, fill: col, 'fill-opacity': 0.25, stroke: col, 'stroke-width': 2, class: 'swatch' });
    s += txt(x + 24, y, name, { weight: 400 }); x += 24 + textW(name) + 14;
  }
  return el('g', { class: 'legend' }, s);
}
/* The interface readout: V⁺ + V⁻ = Vₜ with the numbers (line 1, bold), and the transmitted power from Vₜ (line 2), in a
   rounded box centred on the interface (kept inside the drawing). */
function readout(G, y0){
  const g = gammaR(), tau = tauR(), z = R.z02, l1 = 'V⁺ + V⁻ = Vₜ\u00a0\u00a0 1 + ' + term(g) + ' = ' + coef(tau);
  const l2 = z === 0 ? 'Vₜ = 0 → Pₜ = 0 %' : z === Infinity ? 'Pₜ = 0 % (Z02 = ∞)' : Math.abs(g) < 0.005 ? 'Pₜ = 100 %'
    : 'Pₜ = Vₜ² · Z01/Z02 = ' + coef(tau) + '² × 50/' + zNum(z) + ' = ' + pct2(tau * tau * Z01 / z);
  const w = Math.max(textW(l1, FS_READ), textW(l2)) + 28, rh = LY_R.readH, x = Math.min(Math.max(G.xi - w / 2, LY_R.edge - 4), DESIGN_W - LY_R.edge + 4 - w);
  return el('g', { class: 'readout' }, el('rect', { x, y: y0, width: w, height: rh, rx: 10, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 1.5 })
    + txt(x + w / 2, y0 + 20, l1, { anchor: 'middle', size: FS_READ, weight: 700, id: 'readV', cls: 'readv' })
    + txt(x + w / 2, y0 + 47, l2, { anchor: 'middle', weight: 400, id: 'readP' }))
    + el('g', { 'data-q': 'Gamma', 'data-v': +g.toPrecision(12) }, '') + el('g', { 'data-q': 'tau', 'data-v': +tau.toPrecision(12) }, '');
}
// Panel 2: the voltage on the lines.
function voltagePanel(H){
  const G = geoV(H), g = gammaR(), gm = Math.abs(g), tau = tauR(), vmax = 1 + gm, vmin = 1 - gm, L = LY_R, x2f = xR2(G, r2Len(G));
  let s = heading(L.edge, G.top + L.headY, 'Voltage on the lines (incident amplitude = 1)');
  s += txt(DESIGN_W - L.edge, G.top + L.headY, 'VSWR = V_max/V_min = ' + sig2(vmax) + '/' + sig2(vmin) + ' = ' + vswr2(gm), { anchor: 'end', cls: 'vswrLine' });
  s += legend(G.top + L.legY);
  // region tints and labels (labels in the tint's top band, above the curves)
  const tintBot = G.yAxis - 4;
  s += el('rect', { x: L.plotL - 6, y: G.tintTop, width: G.xi - L.plotL + 6, height: tintBot - G.tintTop, fill: 'var(--bg2)', stroke: 'none', class: 'tint' });
  s += el('rect', { x: G.xi, y: G.tintTop, width: DESIGN_W - L.edge + 4 - G.xi, height: tintBot - G.tintTop, fill: 'var(--panel)', stroke: 'none', class: 'tint' });
  s += txt(L.plotL, G.tintTop + 13, 'Region 1 · 50 Ω', { fill: 'var(--mut)', weight: 400 });
  s += txt(DESIGN_W - L.edge, G.tintTop + 13, 'Region 2 · ' + (R.z02 === Infinity ? '∞' : zNum(R.z02)) + ' Ω', { anchor: 'end', fill: 'var(--mut)', weight: 400 });
  // zero line, envelope (Region 1: ±|1 + Γe^(−j2βd)|; Region 2: ±|τ|, flat), V_max / V_min levels
  s += el('line', { x1: L.plotL, y1: G.yc, x2: x2f, y2: G.yc, stroke: 'var(--line)', 'stroke-width': 1, class: 'zero' });
  let top = '', bot = '';
  const n = WAVE_N * R1_LAMBDA;
  for(let k = 0; k <= n; k++){ const d = R1_LAMBDA * (1 - k / n), v = envelope(C(g, 0), d) * G.A, x = n2(xR1(G, d));
    top += (k ? 'L' : 'M') + x + ' ' + n2(G.yc - v); bot = 'L' + x + ' ' + n2(G.yc + v) + bot; }
  const at = Math.abs(tau) * G.A, xe = n2(xR2(G, R2_LAMBDA));
  top += 'L' + xe + ' ' + n2(G.yc - at); bot = 'L' + xe + ' ' + n2(G.yc + at) + 'L' + n2(G.xi) + ' ' + n2(G.yc + at) + bot;
  s += el('path', { d: top + bot + 'Z', fill: 'var(--s12)', 'fill-opacity': 0.14, stroke: 'none', class: 'shade' });
  s += el('path', { d: top, fill: 'none', stroke: 'var(--s12)', 'stroke-width': 2.5, class: 'envelope', 'data-q': 'envelope', 'data-v': +gm.toPrecision(12), 'data-a': n2(G.A), 'data-yc': n2(G.yc), 'data-tau': +Math.abs(tau).toPrecision(12) });
  s += el('path', { d: 'M' + bot.slice(1), fill: 'none', stroke: 'var(--s12)', 'stroke-width': 2.5, class: 'envelope' });
  const lvl = (v, q, above, dash) => { const y = G.yc - v * G.A;
    return el('line', { x1: L.plotL, y1: y, x2: G.xi, y2: y, stroke: 'var(--txt)', 'stroke-width': 1.5, 'stroke-dasharray': dash, class: 'level', 'data-q': q, 'data-v': +v.toPrecision(12) })
      + txt(L.plotL - 10, y + (above ? -L.lvlOff : L.lvlOff), (q === 'Vmax' ? 'V_max ' : 'V_min ') + sig2(v), { anchor: 'end' }); };
  s += lvl(vmax, 'Vmax', true, '8 5') + lvl(vmin, 'Vmin', false, '2 5');
  // the waves: Region 2's fade out over its last R2_FADE units (a mask), then an arrow on to ∞
  const P = wavePathsV(G, app.tNow), x2 = xR2(G, R2_LAMBDA);
  s += el('defs', {}, el('linearGradient', { id: 'r2fade', gradientUnits: 'userSpaceOnUse', x1: x2, y1: 0, x2: x2f, y2: 0 },
      el('stop', { offset: 0, 'stop-color': '#fff' }) + el('stop', { offset: 1, 'stop-color': '#000' }))
    + el('mask', { id: 'r2mask', maskUnits: 'userSpaceOnUse', x: G.xi - 4, y: G.plotTop - 10, width: DESIGN_W, height: G.yAxis - G.plotTop + 20 },
      el('rect', { x: G.xi - 4, y: G.plotTop - 10, width: x2 - G.xi + 4, height: G.yAxis - G.plotTop + 20, fill: '#fff' })
      + el('rect', { x: x2, y: G.plotTop - 10, width: x2f - x2, height: G.yAxis - G.plotTop + 20, fill: 'url(#r2fade)' })));
  const vr = R.vr ? null : 'none';
  s += el('path', { id: 'vInc', d: P.inc, fill: 'none', stroke: 'var(--grey)', 'stroke-width': 2, 'stroke-dasharray': '6 4', display: vr, class: 'vcurve', 'data-q': 'V_inc', 'data-v': 1 });
  s += el('path', { id: 'vRef', d: P.ref, fill: 'none', stroke: 'var(--s11)', 'stroke-width': 2, 'stroke-dasharray': '6 4', display: vr, class: 'vcurve', 'data-q': 'V_refl', 'data-v': +g.toPrecision(12) });
  s += el('path', { id: 'vTot', d: P.tot, fill: 'none', stroke: 'var(--txt)', 'stroke-width': 3.5, 'stroke-linejoin': 'round', class: 'vcurve', 'data-q': 'V_tot' });
  s += el('path', { id: 'vTr', d: P.tr, fill: 'none', stroke: 'var(--s21)', 'stroke-width': 3.5, 'stroke-linejoin': 'round', mask: 'url(#r2mask)', class: 'vcurve', 'data-q': 'V_trans', 'data-v': +tau.toPrecision(12) });
  s += el('path', { d: 'M' + n2(x2f + 2) + ' ' + n2(G.yc) + 'H' + n2(DESIGN_W - L.edge - 12), stroke: 'var(--mut)', 'stroke-width': 2, fill: 'none', class: 'toinf' })
    + el('path', { d: 'M' + n2(DESIGN_W - L.edge) + ' ' + n2(G.yc) + 'l-14 -7v14Z', fill: 'var(--mut)', class: 'toinf' });
  ['Region 2 continues to ∞ —', 'no further reflections'].forEach((t, i) => { s += txt(DESIGN_W - L.edge, G.tintTop + 37 + 22 * i, t, { anchor: 'end', size: FS_CAPTION, fill: 'var(--mut)', weight: 400, cls: 'caption16 toinfCap' }); });
  // the interface and the readout above it
  s += el('line', { x1: G.xi, y1: G.plotTop - 4, x2: G.xi, y2: G.yAxis - 8, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  s += readout(G, G.top + L.readTop);
  // distance axis: Region 1 2λ … interface, Region 2 λ/4, λ/2
  s += el('line', { x1: L.plotL, y1: G.yAxis - 8, x2: x2f, y2: G.yAxis - 8, stroke: 'var(--mut)', 'stroke-width': 1.5 });
  const tk = (x, t, anchor, tx) => el('line', { x1: x, y1: G.yAxis - 14, x2: x, y2: G.yAxis - 2, stroke: 'var(--mut)', 'stroke-width': 1.5 })
    + txt(tx === undefined ? x : tx, G.yAxis + 14, t, { anchor, fill: 'var(--mut)', weight: 400 });
  [[2, '2λ'], [1.5, '3λ/2'], [1, 'λ'], [0.5, 'λ/2']].forEach(([d, t]) => { s += tk(xR1(G, d), t, 'middle'); });
  s += tk(G.xi, 'interface', 'end', G.xi - 6);
  [[0.25, 'λ/4'], [0.5, 'λ/2']].forEach(([x, t]) => { s += tk(xR2(G, x), t, 'middle'); });
  s += txt(L.edge, H - L.capUp, 'Both regions have the same propagation speed (same λ). Region 2 is infinitely long.', { size: FS_CAPTION, fill: 'var(--mut)', weight: 400, cls: 'caption16' });
  return s;
}
// The whole drawing for a drawing H units tall.
function drawReflections(H){ return svgRoot(H, 'Power at the interface, and the incident, reflected, total and transmitted voltage on the lines', powerPanel(H) + voltagePanel(H)); }
// Move the four waves to time t (animation frame).
function tickReflections(H, t){
  const P = wavePathsV(geoV(H), t), set = (id, d) => { const e = document.getElementById(id); if(e) e.setAttribute('d', d); };
  set('vInc', P.inc); set('vRef', P.ref); set('vTot', P.tot); set('vTr', P.tr);
}
// ── END VOLTAGE PANEL ─────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// Side panel: Γ (signed) and VSWR, the Z02 slider with its box, Matched / Short / Open, τ, the incident/reflected switch.
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
    h('label', { cls: 'chk' }, vr, ' Show incident and reflected'),
    note('Thickness of each arrow is its share of the power.')];
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
