/* RF Cascade Analyzer — View 1, Reflections (mock-up v1): power at an interface between two regions, drawn as band
   arrows whose thickness is proportional to power, and the standing wave this sets up in Region 1. One control: Z02. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — reference impedance, slider taper, layout
   2. State            — Z02 (Ω, or ∞ for an open)
   3. Drawing          — interface panel, standing-wave panel, snapshot wave
   4. Panel            — headline readouts and the Z02 control
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const Z01 = 50;                  // Region 1 impedance (Ω, fixed)
const Z02_POS = 1000;            // Z02 slider: 0 → short, 1..999 → 1..1000 Ω (log), 1000 → ∞ (open)
const Z02_DEC = 3;               // decades on the log part of the slider
const WAVE_HZ = 0.5;             // snapshot wave frequency on screen (Hz)
const WAVE_N = 240;              // samples along a drawn curve
const LY_R = { split: 0.47, regTop: 32, regLab: 52, yInc: 0.42, reflUp: 70, band: 40, x0: 40, xi: 450, x1: 860,
               plotL: 130, plotR: 870, axisUp: 34, headGap: 64, lvlOff: 18 };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const R = { z02: 150 };
// Slider position -> Z02 (0, 1..1000 Ω on a log taper, ∞).
const zFromPos = p => (p <= 0 ? 0 : p >= Z02_POS ? Infinity : +Math.pow(10, Z02_DEC * (p - 1) / (Z02_POS - 2)).toPrecision(3));
// Z02 -> slider position.
const posFromZ = z => (z === Infinity ? Z02_POS : z < 1 ? 0 : Math.min(Z02_POS - 1, Math.round(1 + (Z02_POS - 2) * Math.log10(z) / Z02_DEC)));
// Γ at the interface (real): +1 for an open.
const gammaR = () => (R.z02 === Infinity ? 1 : gammaInterface(Z01, R.z02));
// VSWR to 2 significant figures; ∞ at |Γ| = 1.
const vswr2 = gm => { const v = vswr(gm); return v.kind === 'num' ? sig2(v.v) : '∞'; };
// Z02 as text for the drawing and the number box.
const z02Text = () => (R.z02 === Infinity ? '∞ (open)' : R.z02 === 0 ? '0 (short)' : fx(R.z02, R.z02 < 10 ? 1 : 0) + ' Ω');
// ── END STATE ─────────────────────────────────────────────────

// ── DRAWING ───────────────────────────────────────────────────
// Geometry of the standing-wave panel for a drawing H units tall.
function geoR(H){
  const top = H * LY_R.split + 4, plotTop = top + LY_R.headGap, yAxis = H - LY_R.axisUp, A = (yAxis - 8 - plotTop) / 4;
  return { top, plotTop, yAxis, A, yc: plotTop + 2 * A, pl: LY_R.plotR - LY_R.plotL };
}
// x of a point d wavelengths from the interface (interface at the right).
const xOfDR = (G, d) => LY_R.plotR - d * G.pl;
// Snapshot wave path at time t: Re{(e^{jβd} + Γe^{−jβd})e^{jωt}} over 0..1λ.
function snapPath(G, g, t){
  const wt = 2 * Math.PI * WAVE_HZ * t, tw = 2 * Math.PI; let p = '';
  for(let k = 0; k <= WAVE_N; k++){ const d = k / WAVE_N, v = Math.cos(wt + tw * d) + g * Math.cos(wt - tw * d);
    p += (k ? 'L' : 'M') + n2(xOfDR(G, d)) + ' ' + n2(G.yc - v * G.A); }
  return p;
}
// The whole drawing for a drawing H units tall.
function drawReflections(H){
  const g = gammaR(), gm = Math.abs(g), split = powerSplit(gm), T = LY_R.band, xi = LY_R.xi;
  const regBot = H * LY_R.split - 8, yI = LY_R.regTop + LY_R.yInc * (regBot - LY_R.regTop), yR = regBot - LY_R.reflUp;
  let s = heading(12, 14, 'At the interface');
  s += el('rect', { x: 8, y: LY_R.regTop, width: xi - 8, height: regBot - LY_R.regTop, fill: 'var(--bg2)', stroke: 'var(--line)', rx: 6 });
  s += el('rect', { x: xi, y: LY_R.regTop, width: DESIGN_W - 8 - xi, height: regBot - LY_R.regTop, fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 });
  s += txt(24, LY_R.regLab, 'Region 1 · Z_01 = 50 Ω');
  s += txt(xi + 24, LY_R.regLab, 'Region 2 · Z_02 = ' + z02Text(), { id: 'z02Label' });
  s += el('line', { x1: xi, y1: LY_R.regTop, x2: xi, y2: regBot, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  // band arrows: thickness ∝ power (incident = full thickness T)
  const off = Math.max(22, T * 1.7) / 2 + 14;
  s += bandArrow(LY_R.x0, xi, yI, T, { col: 'var(--neutral)', q: 'P_inc', v: 1, ref: T, op: 0.6 });
  s += txt(LY_R.x0, yI - off, 'Incident ' + pct2(1));
  s += bandArrow(xi, LY_R.x1, yI, split.deliv > 1e-9 ? T * split.deliv : 0, { col: 'var(--s21)', q: 'P_trans', v: split.deliv, ref: T });
  s += txt(xi + 24, yI - off, 'Transmitted ' + pct2(split.deliv), { fill: 'var(--s21)' });
  s += bandArrow(xi, LY_R.x0, yR, split.refl > 1e-9 ? T * split.refl : 0, { col: 'var(--s11)', q: 'P_refl', v: split.refl, ref: T });
  s += txt(xi - 16, yR + Math.max(22, T * split.refl * 1.7) / 2 + 14, 'Reflected ' + pct2(split.refl), { anchor: 'end', fill: 'var(--s11)' });
  // standing wave in Region 1
  const G = geoR(H), vmax = 1 + gm, vmin = 1 - gm;
  s += heading(12, G.top + 14, 'Standing wave in Region 1');
  s += txt(888, G.top + 14, 'VSWR = V_max / V_min = ' + sig2(vmax) + ' / ' + sig2(vmin) + ' = ' + vswr2(gm), { anchor: 'end', cls: 'vswrLine' });
  let top = '', bot = '';
  for(let k = 0; k <= WAVE_N; k++){ const d = k / WAVE_N, v = envelope(C(g, 0), d) * G.A, x = n2(xOfDR(G, d));
    top += (k ? 'L' : 'M') + x + ' ' + n2(G.yc - v); bot = 'L' + x + ' ' + n2(G.yc + v) + bot; }
  s += el('path', { d: top + bot + 'Z', fill: 'var(--s12)', 'fill-opacity': 0.16, stroke: 'none', class: 'shade' });
  s += el('path', { d: top, fill: 'none', stroke: 'var(--s12)', 'stroke-width': 3, class: 'envelope', 'data-q': 'envelope', 'data-v': +gm.toPrecision(12), 'data-a': n2(G.A), 'data-yc': n2(G.yc) });
  s += el('path', { d: 'M' + bot.slice(1), fill: 'none', stroke: 'var(--s12)', 'stroke-width': 3, class: 'envelope' });
  s += el('path', { id: 'snap', d: snapPath(G, g, app.tNow), fill: 'none', stroke: 'var(--txt)', 'stroke-width': 1.5, opacity: 0.4, class: 'snap' });
  // V_max and V_min levels: dashed lines at their true heights, labels in the left margin (V_max above, V_min below, so
  // they never meet even when the lines coincide)
  const lvl = (v, q, col, above, dash) => { const y = G.yc - v * G.A;
    return el('line', { x1: LY_R.plotL, y1: y, x2: LY_R.plotR, y2: y, stroke: col, 'stroke-width': 2, 'stroke-dasharray': dash, class: 'level', 'data-q': q, 'data-v': +v.toPrecision(12) })
      + txt(LY_R.plotL - 10, y + (above ? -LY_R.lvlOff : LY_R.lvlOff), (q === 'Vmax' ? 'V_max ' : 'V_min ') + sig2(v), { anchor: 'end', fill: col }); };
  s += lvl(vmax, 'Vmax', 'var(--txt)', true, '8 5') + lvl(vmin, 'Vmin', 'var(--txt)', false, '2 5');
  // distance axis: 1λ … interface
  s += el('line', { x1: LY_R.plotL, y1: G.yAxis - 8, x2: LY_R.plotR, y2: G.yAxis - 8, stroke: 'var(--mut)', 'stroke-width': 1.5 });
  s += el('line', { x1: LY_R.plotR, y1: G.plotTop, x2: LY_R.plotR, y2: G.yAxis - 8, stroke: 'var(--s22)', 'stroke-width': 3, 'stroke-dasharray': DASH, class: 'iface' });
  [[1, '1λ'], [0.75, '3λ/4'], [0.5, 'λ/2'], [0.25, 'λ/4'], [0, 'interface']].forEach(([d, t]) => { const x = xOfDR(G, d);
    s += el('line', { x1: x, y1: G.yAxis - 14, x2: x, y2: G.yAxis - 2, stroke: 'var(--mut)', 'stroke-width': 1.5 });
    s += txt(d === 0 ? x + 8 : x, G.yAxis + 14, t, { anchor: d === 0 ? 'end' : 'middle', fill: 'var(--mut)', weight: 400 }); });
  return svgRoot(H, 'Interface power split and the standing wave in Region 1', s);
}
// Move the snapshot wave to time t (animation frame).
function tickReflections(H, t){ const e = document.getElementById('snap'); if(e) e.setAttribute('d', snapPath(geoR(H), gammaR(), t)); }
// ── END DRAWING ───────────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// Side panel: |Γ| and VSWR, the Z02 slider with its box, and Matched / Short / Open.
function panelReflections(){
  const gm = Math.abs(gammaR()), set = z => { R.z02 = z; redraw(true); };
  const box = h('input', { type: 'text', id: 'z02Box', value: R.z02 === Infinity ? '∞' : String(R.z02), attrs: { 'aria-label': 'Z02 in ohms (∞ or "open" for an open)', inputmode: 'decimal' } });
  box.addEventListener('change', () => { const w = box.value.trim().toLowerCase(), z = OPEN_WORDS.includes(w) ? Infinity : SHORT_WORDS.includes(w) ? 0 : +w;
    const okv = (z === Infinity || (box.value.trim() !== '' && isFinite(z) && z >= 0 && z <= 1e6));
    box.classList.toggle('invalid', !okv); box.setAttribute('aria-invalid', okv ? 'false' : 'true'); if(okv) set(z); });
  const rng = h('input', { type: 'range', id: 'z02', min: 0, max: Z02_POS, step: 1, value: posFromZ(R.z02), attrs: { 'aria-label': 'Z02', 'aria-valuetext': 'Z02 ' + z02Text() } });
  rng.addEventListener('input', () => { R.z02 = zFromPos(+rng.value); box.value = R.z02 === Infinity ? '∞' : String(R.z02); box.classList.remove('invalid'); redraw(false); });
  const pre = R.z02 === Z01 ? 'm' : R.z02 === 0 ? 's' : R.z02 === Infinity ? 'o' : '';
  return [h('div', { cls: 'heads' }, headline('|Γ|', sig2(gm), 'roGamma'), headline('VSWR', vswr2(gm), 'roVswr')),
    h('div', { cls: 'ctl' }, h('label', { htmlFor: 'z02', text: 'Z02, Region 2 (Ω)' }), h('div', { cls: 'row' }, rng, box)),
    h('div', { cls: 'btnrow' }, pbtn('bMatch', 'Matched (50)', pre === 'm', () => set(Z01)), pbtn('bShort', 'Short (0)', pre === 's', () => set(0)),
      pbtn('bOpen', 'Open (∞)', pre === 'o', () => set(Infinity))),
    note('Thickness of each arrow is its share of the power.')];
}
// Refresh the panel's readouts and preset buttons after a slider move (the panel itself is not rebuilt).
function syncReflections(){
  const gm = Math.abs(gammaR()), set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  set('roGamma', sig2(gm)); set('roVswr', vswr2(gm));
  const pre = { bMatch: R.z02 === Z01, bShort: R.z02 === 0, bOpen: R.z02 === Infinity };
  for(const id in pre){ const b = document.getElementById(id); if(b) b.setAttribute('aria-pressed', String(pre[id])); }
  const r = document.getElementById('z02'); if(r) r.setAttribute('aria-valuetext', 'Z02 ' + z02Text());
}
// ── END PANEL ─────────────────────────────────────────────────
