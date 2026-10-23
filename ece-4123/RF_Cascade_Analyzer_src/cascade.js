/* RF Cascade Analyzer — View 3, Cascade (v1.7.0): v1.1.0's Lab brought back as the Cascade view (source V_s and Z_s,
   reference Z0, load Z_L, a chain of two-ports, and a power divider), with its settings and results in the side panel
   and the circuit drawn large. A power divider can be inserted at any junction of the chain: it splits the chain into
   two parallel branches, A and B, each with its own blocks and its own load. A frequency band (centre ± span, or start
   to stop) is sent through the circuit: the drawing shows the band's power spectrum at every junction (a "block" of
   frequencies being shaped as it passes each device) and the response across the band, with a marker frequency whose
   values the panel reads out. The engine's solvers are used unchanged; the frequency-dependent device models are here. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — presets and their parameters, divider names, limits, layout
   2. State            — source, reference, chain, divider, loads, band, selection
   3. Formatting       — angles in the chosen unit, impedances, power, frequency
   4. Solution         — S of each block at f, the circuit solved at f, the band sweep
   5. Drawing          — the circuit, the spectrum at each junction, the response across the band
   6. Interaction      — select, add, remove, insert or remove the divider, set the marker
   7. Panel            — editors (block, source, load, divider), band, results
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const MAX_MAIN = 4;              // blocks in a single cascade
const MAX_COLS = 4;              // with a divider: the blocks before it plus the longer branch
const NPTS = 201;                // frequency points across the band
const PRESETS = ['thru', 'atten', 'amp', 'phase', 'lpf', 'hpf', 'bpf', 'isolator', 'custom'];
const PRESET_NAME = { thru: 'Through line', atten: 'Attenuator', amp: 'Amplifier', phase: 'Phase shift', lpf: 'Low-pass filter', hpf: 'High-pass filter',
                      bpf: 'Band-pass filter', isolator: 'Isolator', custom: 'Custom' };
const SHORT_NAME = { thru: 'Line', atten: 'Attenuator', amp: 'Amplifier', phase: 'Phase', lpf: 'Low-pass', hpf: 'High-pass', bpf: 'Band-pass', isolator: 'Isolator', custom: 'Custom' };
const ABBR = { thru: 'Line', atten: 'Atten', amp: 'Amp', phase: 'Phase', lpf: 'LPF', hpf: 'HPF', bpf: 'BPF', isolator: 'Isolator', custom: 'Custom' };
/* Each preset's parameters: [key, label, unit, default, min, max]. Unit 'f' is a frequency (stored in Hz, the default
   given in multiples of f0, shown in the band's unit); 'λ' is a length in wavelengths at f0. */
const PARAMS = {
  thru: [['l', 'Length ℓ at f0', 'λ', 0.25, 0, 20]],
  atten: [['A', 'Attenuation', 'dB', 3, 0, 100]],
  amp: [['G', 'Gain', 'dB', 10, 0, 60]],
  phase: [['ph', 'Phase delay', '°', 45, -360, 360]],
  lpf: [['fc', 'Cut-off fc', 'f', 1.2], ['n', 'Order n', '', 3, 1, 9]],
  hpf: [['fc', 'Cut-off fc', 'f', 0.8], ['n', 'Order n', '', 3, 1, 9]],
  bpf: [['fc', 'Centre fc', 'f', 1], ['bw', 'Bandwidth (−3 dB)', 'f', 0.2], ['n', 'Order n', '', 3, 1, 9]],
  isolator: [['IL', 'Insertion loss', 'dB', 0.5, 0, 20]],
};
const PRESET_NOTE = {
  thru: 'A matched line: S21 = 1∠−βℓ, and βℓ = 2πℓ·f/f0 grows with frequency.',
  atten: 'Matched and flat with frequency.', amp: 'Matched, unilateral (S12 = 0) and flat with frequency.', phase: 'A fixed phase delay, flat with frequency.',
  lpf: 'Butterworth magnitude |S21|² = 1/(1 + (f/fc)^2n); lossless, the rest is reflected.',
  hpf: 'Butterworth magnitude |S21|² = 1/(1 + (fc/f)^2n); lossless, the rest is reflected.',
  bpf: 'Butterworth band-pass |S21|² = 1/(1 + x^2n), x = (f/fc − fc/f)·fc/BW; lossless, the rest is reflected.',
  isolator: 'Matched; passes forward with this loss, blocks the reverse wave (S12 = 0). Flat with frequency.',
  custom: 'Fixed S entries, the same at every frequency.' };
const DIV_NAME = { ideal: 'Ideal equal-split (lossless)', wilkinson: 'Wilkinson (matched, isolated)', resistive: 'Resistive (lossy)', tee: 'T-junction (reactive node)' };
const DIV_SHORT = { ideal: 'Ideal', wilkinson: 'Wilkinson', resistive: 'Resistive', tee: 'T-junction' };
const DIV_NOTE = {
  ideal: 'Input matched, lossless. Outputs are not isolated and not individually matched.',
  wilkinson: 'Matched at all ports and outputs isolated. The isolation resistor dissipates only reflected (odd-mode) power.',
  resistive: 'Matched at all ports but lossy: each output is 6 dB below the input. Equal split only.',
  tee: 'Reactive junction of three Z0 lines: lossless and reciprocal but not matched (S11 = −1/3). Equal split only.' };
const FU = { MHz: 1e6, GHz: 1e9 };   // band units
const P_UNITS = [[1, 'W'], [1e-3, 'mW'], [1e-6, 'µW'], [1e-9, 'nW']];
const DEC_P = 4, DEC_DBM = 2, DEC_RAD = 3, MW = 1e-3;
const PLOT_SPAN = 50, MINI_SPAN = 40;   // dB shown by the response plot and by each junction spectrum
/* Layout (design units = px at 1280×720). The drawing is as wide as the drawing area (at least 900): the circuit spreads
   to fill it. Cascade: one row; divider: branch A above, the chain and the divider in the middle, branch B below. */
const LY_C = { edge: 16, srcR: 26, loadW: 90, divW: 110, plusR: 14, rowC: 84, rowsD: { A: 118, M: 198, B: 278 }, bhC: 88, bhD: 80,
               miniC: { top: 150, h: 80 }, miniD: { top: 22, h: 44, topB: 330 }, plotC: 272, plotD: 412 };
const SCALE_H = 700, SCALE_MAX = 1.6;   // the circuit's scale k = H / SCALE_H (design units), from 1 up to SCALE_MAX
// The circuit's layout at scale k: sizes and vertical positions grow by k (the edge clearance and "+" buttons do not).
function scaledLayout(k){
  const L = LY_C, m = v => v * k;
  return { srcR: m(L.srcR), loadW: m(L.loadW), divW: m(L.divW), rowC: m(L.rowC), bhC: m(L.bhC), bhD: m(L.bhD), plotC: m(L.plotC), plotD: m(L.plotD),
           rowsD: { A: m(L.rowsD.A), M: m(L.rowsD.M), B: m(L.rowsD.B) }, miniC: { top: m(L.miniC.top), h: m(L.miniC.h) },
           miniD: { top: m(L.miniD.top), h: m(L.miniD.h), topB: m(L.miniD.topB) } };
}
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const K = {
  unit: 'deg', vsMag: 1, vsAng: 0, zs: C(50, 0), z0: 50,
  main: [], A: [], B: [], div: null,                                   // div: null, or { type, split (% into A) }
  zl: zLoad(C(50, 0)), zlA: zLoad(C(50, 0)), zlB: zLoad(C(50, 0)),
  f1: 0.5e9, f2: 1.5e9, bandMode: 'cs', fu: 'GHz', f0: 1e9, fm: 1e9,   // band start/stop (Hz), entry mode, unit, design and marker frequencies
  sel: { k: 'main', i: 0 }, menu: false, plotMode: 'band',             // plotMode: the response across the band, or the power along the chain                               // selection: a block { k: main|A|B, i }, or { k: src|load|div }; menu: "k:j" of an open "+"
};
// A new block of a preset with its default parameters (custom: S, here a matched through).
function newBlock(type, p){
  if(type === 'custom') return { type, p: {}, S: labPresetS('thru', 0) };
  const q = {}; PARAMS[type].forEach(([k, , u, v]) => { q[k] = u === 'f' ? v * K.f0 : v; });
  return { type, p: Object.assign(q, p || {}) };
}
// The example circuit: Amplifier 12 dB → Band-pass filter (1 GHz, 200 MHz, n = 3) → Attenuator 3 dB → 50 Ω.
function resetExample(){
  Object.assign(K, { vsMag: 1, vsAng: 0, zs: C(50, 0), z0: 50, div: null, A: [], B: [], zl: zLoad(C(50, 0)), zlA: zLoad(C(50, 0)), zlB: zLoad(C(50, 0)),
    f1: 0.5e9, f2: 1.5e9, fu: 'GHz', f0: 1e9, fm: 1e9, sel: { k: 'main', i: 0 }, menu: false });
  K.main = [newBlock('amp', { G: 12 }), newBlock('bpf'), newBlock('atten', { A: 3 })];
}
resetExample();
const listOf = k => K[k];
// Load impedance of a chain end: L (single cascade), A or B.
const loadKey = b => (b === 'A' ? 'zlA' : b === 'B' ? 'zlB' : 'zl');
// ── END STATE ─────────────────────────────────────────────────

// ── FORMATTING ────────────────────────────────────────────────
// An angle (degrees) in the current unit, as text.
const angText = deg => (K.unit === 'rad' ? fx(deg / DEG, DEC_RAD) + ' rad' : fx(wrapDeg(deg), DEC_ANG) + '°');
// Magnitude∠angle in the current unit.
const polarU = (c, unit) => fmtMag(cabs(c)) + ANGLE_SIGN + angText(cabs(c) <= EPS_ZERO ? 0 : carg(c) * DEG) + (unit ? ' ' + unit : '');
// Field text for a complex value as magnitude∠angle in the current unit (S entries).
function polarField(c){
  const m = cabs(c), a = m <= EPS_ZERO ? 0 : wrapDeg(carg(c) * DEG);
  return +m.toPrecision(6) + '∠' + (K.unit === 'rad' ? +(a / DEG).toFixed(5) : +a.toFixed(3));
}
// Field text for an impedance (rectangular), and for a load ("open" for Z_L = ∞).
const zField = z => +z.re.toPrecision(6) + (z.im < 0 ? '-j' : '+j') + +Math.abs(z.im).toPrecision(6);
const loadField = zl => (zl.inf ? 'open' : zField(zl.z));
// A load as drawn in its box: ∞, 0 Ω, 50 Ω, 25+j10 Ω.
function loadShort(zl){
  if(zl.inf) return INF;
  const r = +zl.z.re.toPrecision(3), x = +Math.abs(zl.z.im).toPrecision(3);
  return (x === 0 ? String(r) : (r === 0 ? '' : String(r)) + (zl.z.im < 0 ? MINUS : r === 0 ? '' : '+') + 'j' + x) + ' Ω';
}
// Power in W, mW, µW or nW; in dBm; both; and a power ratio in dB.
function fmtW(P){
  if(!isFinite(P)) return '—';
  const a = Math.abs(P); if(a === 0) return '0 W';
  const u = P_UNITS.find(([s]) => a >= s) || P_UNITS[P_UNITS.length - 1];
  return fx(P / u[0], DEC_P) + ' ' + u[1];
}
const fmtDbm = P => (!(P > 0) ? MINUS + INF + ' dBm' : fx(10 * Math.log10(P / MW), DEC_DBM) + ' dBm');
const fmtPow = P => fmtW(P) + ' (' + fmtDbm(P) + ')';
const db10 = r => (r > 1e-30 ? 10 * Math.log10(r) : -Infinity);
const fmtRatioDb = r => (db10(r) === -Infinity ? MINUS + INF + ' dB' : fx(db10(r), DEC_DB) + ' dB');
// A power ratio in dB with its sign, one decimal ("+6.1 dB", "−3.0 dB", "−∞ dB").
const sdb = r => { const d = db10(r); return d === -Infinity ? MINUS + INF + ' dB' : (d > 0.05 ? '+' : '') + fx(d, 1) + ' dB'; };
// A frequency in the band's unit: short (3 significant figures, block labels and axis) and full (3 decimals, marker).
const fText = f => +(f / FU[K.fu]).toPrecision(3) + ' ' + K.fu;
const fFull = f => fx(f / FU[K.fu], 3) + ' ' + K.fu;
// A block's key value as drawn in its box.
function keyText(d){
  const p = d.p;
  switch(d.type){
    case 'thru': return 'ℓ = ' + lenText(p.l);
    case 'atten': return dbText(-p.A);
    case 'amp': return dbText(p.G);
    case 'isolator': return dbText(-p.IL);
    case 'phase': return fx(-p.ph, 0) + '°';
    case 'lpf': case 'hpf': case 'bpf': return fText(p.fc);
  }
  const m = cabs(d.S.s21); return m < S_ZERO ? MINUS + INF + ' dB' : dbText(dbOf(m));
}
// A block's name for the panel and screen readers: "Block 2" or "Branch A, block 1".
const blockName = (k, i) => (k === 'main' ? 'Block ' + (i + 1) : 'Branch ' + k + ', block ' + (i + 1));
// ── END FORMATTING ────────────────────────────────────────────

// ── SOLUTION ──────────────────────────────────────────────────
// S of block d at frequency f (Hz).
function devS(d, f){
  const p = d.p;
  switch(d.type){
    case 'thru': { const th = FULL_TURN * p.l * f / K.f0; return devPolar([0, 0], [1, -th], [1, -th], [0, 0]); }
    case 'atten': return labPresetS('atten', p.A);
    case 'amp': return labPresetS('amp', p.G);
    case 'phase': return labPresetS('phase', p.ph);
    case 'isolator': return labPresetS('isolator', p.IL);
    case 'lpf': case 'hpf': case 'bpf': {
      const x = d.type === 'lpf' ? f / p.fc : d.type === 'hpf' ? p.fc / f : (f / p.fc - p.fc / f) * p.fc / p.bw;
      const t2 = 1 / (1 + Math.pow(Math.abs(x), 2 * p.n)), t = Math.sqrt(t2), r = Math.sqrt(1 - t2);   // lossless reflective
      return devPolar([r, 90], [t, 0], [t, 0], [r, 90]); }
  }
  return d.S;
}
/* The divider's waves for a unit wave into port 1, with branch A and B presenting reflections GA and GB at ports 2
   and 3 (a2 = GA·b2, a3 = GB·b3): { b1, b2, b3 }. */
function divWaves(S, GA, GB){
  const M = [[csub(ONE, cmul(GA, S[1][1])), cscale(cmul(GA, S[1][2]), -1)], [cscale(cmul(GB, S[2][1]), -1), csub(ONE, cmul(GB, S[2][2]))]];
  const [a2, a3] = csolve(M, [cmul(GA, S[1][0]), cmul(GB, S[2][0])]) || [ZERO, ZERO];
  const b = r => cadd(S[r][0], cadd(cmul(S[r][1], a2), cmul(S[r][2], a3)));
  return { b1: b(0), b2: b(1), b3: b(2) };
}
const splitOf = () => (DIV_EQUAL_ONLY[K.div.type] ? 50 : K.div.split);
/* The circuit solved at f: source, input, the chain's interfaces (nodesM) and, with a divider, the power into it, the
   branches' interfaces (nodesA, nodesB) and the divider's dissipation. Peak phasors (E5, E12). */
function solveAt(f){
  const Ss = l => l.map(d => devS(d, f)), Vs = polar(K.vsMag, K.vsAng), src = source(Vs, K.zs, K.z0), m = Ss(K.main);
  if(!K.div){ const r = solveCascade(m, Vs, K.zs, K.zl, K.z0); return Object.assign(r, { nodesM: r.nodes }); }
  const A = Ss(K.A), B = Ss(K.B), GLA = gammaLoad(K.zlA, K.z0), GLB = gammaLoad(K.zlB, K.z0), setA = branchSetup(A, GLA), setB = branchSetup(B, GLB);
  const w = divWaves(dividerS(K.div.type, splitOf() / 100), setA.Gin, setB.Gin);
  const setM = branchSetup(m, w.b1), a1 = cdiv(src.bs, csub(ONE, cmul(src.Gs, setM.Gin)));
  const nodesM = propagate(m, setM, a1, K.z0), aD = nodesM[m.length].a;
  const nodesA = propagate(A, setA, cmul(aD, w.b2), K.z0), nodesB = propagate(B, setB, cmul(aD, w.b3), K.z0);
  const PD = nodesM[m.length].P, PA = nodesA[0].P, PB = nodesB[0].P;
  return { Gs: src.Gs, Pavs: src.Pavs, Gin: setM.Gin, Zin: zFromGamma(setM.Gin, K.z0), nodesM, nodesA, nodesB, GLA, GLB,
           Pin: nodesM[0].P, reflIn: 0.5 * cabs(nodesM[0].b) ** 2, PD, PA, PB, Pdiss: PD - PA - PB };
}
// The reference power for ratios: P_avs, or (a source with |Γs| = 1) the power incident at the input.
const refOf = r => (r.Pavs > 0 ? r.Pavs : (r.Pin + r.reflIn) || 1);
const refName = r => (r.Pavs > 0 ? 'P_avs' : 'the incident power');
// The marker frequency kept inside the band.
const clampFm = () => { K.fm = Math.min(K.f2, Math.max(K.f1, K.fm)); };
/* The band swept at NPTS frequencies: power ratios (to the reference) at every interface of each chain, delivered to
   each load, and reflected at the input. */
function sweep(){
  const out = { f: [], refl: [], M: K.main.map(() => []).concat([[]]), A: K.A.map(() => []).concat([[]]), B: K.B.map(() => []).concat([[]]) };
  for(let i = 0; i < NPTS; i++){
    const f = K.f1 + (K.f2 - K.f1) * i / (NPTS - 1), r = solveAt(f), ref = refOf(r);
    out.f.push(f); out.refl.push(r.reflIn / ref);
    r.nodesM.forEach((n, j) => out.M[j].push(n.P / ref));
    if(K.div){ r.nodesA.forEach((n, j) => out.A[j].push(n.P / ref)); r.nodesB.forEach((n, j) => out.B[j].push(n.P / ref)); }
  }
  return out;
}
// ── END SOLUTION ──────────────────────────────────────────────

// ── DRAWING ───────────────────────────────────────────────────
/* x positions: blocks, junctions (each between two neighbours: source, block, divider or load), the divider and the
   loads. Blocks widen and gaps grow with the drawing's width; a gap always leaves room for its "+". */
function geoC(H, W){
  // the circuit (blocks, symbols, spacing, spectra) grows with a tall drawing area; text keeps its size
  const k = Math.min(SCALE_MAX, Math.max(1, H / SCALE_H)), Lk = scaledLayout(k);
  const div = !!K.div, e = LY_C.edge, srcX = e + Lk.srcR + 4, x0 = srcX + Lk.srcR, loadX = W - e - Lk.loadW;
  const nM = K.main.length, nBr = div ? Math.max(K.A.length, K.B.length) : 0, cols = Math.max(1, nM + nBr), gaps = div ? nM + nBr + 2 : nM + 1;
  const free = loadX - x0 - (div ? Lk.divW : 0);
  const bw = div ? Math.min(130 * k, Math.max(86, (free - gaps * 64) / cols)) : Math.min(150 * k, Math.max(110, (free - gaps * 70) / cols)), g = (free - (nM + nBr) * bw) / gaps;
  const rows = div ? Lk.rowsD : { M: Lk.rowC }, bh = div ? Lk.bhD : Lk.bhC;
  const bxM = K.main.map((_, i) => x0 + g + i * (bw + g)), divX = div ? x0 + g + nM * (bw + g) : null, after = div ? divX + Lk.divW : null;
  const jM = K.main.map((_, j) => (j === 0 ? x0 + g / 2 : bxM[j - 1] + bw + g / 2)).concat([nM ? bxM[nM - 1] + bw + ((div ? divX : loadX) - bxM[nM - 1] - bw) / 2 : (x0 + (div ? divX : loadX)) / 2]);
  const br = {};
  if(div) ['A', 'B'].forEach(k => { const n = K[k].length, bx = K[k].map((_, i) => after + g + i * (bw + g));
    br[k] = { bx, jx: bx.map((x, j) => (j === 0 ? after + g / 2 : bx[j - 1] + bw + g / 2)).concat([n ? (bx[n - 1] + bw + loadX) / 2 : (after + loadX) / 2]) }; });
  return { W, H, k, Lk, div, srcX, x0, loadX, bw, bh, g, rows, bxM, jM, divX, after, br, pitch: bw + g };
}
const btnG = (attrs, label, inner) => el('g', Object.assign({ role: 'button', tabindex: 0, 'aria-label': label, class: 'hit' }, attrs), inner);
const isSel = (k, i) => K.sel.k === k && (i === undefined || K.sel.i === i);
// Can a block be added to chain k (main, A or B)?
function canAdd(k){
  if(!K.div) return K.main.length < MAX_MAIN;
  const nA = K.A.length + (k === 'A' ? 1 : 0), nB = K.B.length + (k === 'B' ? 1 : 0);
  return K.main.length + (k === 'main' ? 1 : 0) + Math.max(nA, nB) <= MAX_COLS;
}
// A "+" on the wire at junction j of chain k: insert a block there.
function plusBtn(k, j, x, y, where){
  const key = k + ':' + j;
  return btnG({ 'data-add': key, 'aria-expanded': K.menu === key ? 'true' : 'false' }, 'Add a block ' + where,
    el('title', {}, 'Add a block here') + el('circle', { cx: x, cy: y, r: LY_C.plusR, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2, class: 'plus' })
    + el('path', { d: 'M' + n2(x - 7) + ' ' + y + 'h14M' + n2(x) + ' ' + (y - 7) + 'v14', stroke: 'var(--txt)', 'stroke-width': 3 }));
}
/* An RF schematic symbol for a block type, centred at (cx, cy), s units half-high, drawn in col: amplifier triangle,
   attenuator (resistor in a box), transmission line, phase shifter (φ), filters (three waves, the stopped bands struck
   through: low-pass the upper two, high-pass the lower two, band-pass the outer two), isolator (one-way arrow), Custom (S). */
function sym(type, cx, cy, s, col){
  const st = { fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round' }, P = d => el('path', Object.assign({ d }, st));
  const box = (w) => el('rect', Object.assign({ x: cx - w, y: cy - s, width: 2 * w, height: 2 * s, rx: 2 }, st, { fill: 'var(--bg)' }));
  const wave = (y, w) => { let d = 'M' + n2(cx - w) + ' ' + n2(y); for(let i = 0; i < 2; i++){ d += 'q' + n2(w / 4) + ' ' + n2(-s * 0.3) + ' ' + n2(w / 2) + ' 0t' + n2(w / 2) + ' 0'; } return P(d); };
  const strike = y => P('M' + n2(cx - s * 0.35) + ' ' + n2(y + s * 0.28) + 'L' + n2(cx + s * 0.35) + ' ' + n2(y - s * 0.28));
  let g = '';
  switch(type){
    case 'amp': g = P('M' + n2(cx - s * 0.85) + ' ' + n2(cy - s) + 'L' + n2(cx + s * 0.95) + ' ' + n2(cy) + 'L' + n2(cx - s * 0.85) + ' ' + n2(cy + s) + 'Z'); break;
    case 'atten': g = box(s * 1.2) + P('M' + n2(cx - s * 0.8) + ' ' + cy + 'l' + [1, -1, 1, -1, 1, -1].map((v, i) => n2(s * 0.27) + ' ' + n2(v * s * 0.45 * (i ? 2 : 1))).join('l') + 'l' + n2(s * 0.27) + ' ' + n2(s * 0.45)); break;
    case 'thru': g = el('rect', Object.assign({ x: cx - s * 1.6, y: cy - s * 0.35, width: s * 3.2, height: s * 0.7 }, st, { fill: 'var(--bg)' })); break;
    case 'phase': g = box(s * 1.2) + txt(cx, cy, 'φ', { anchor: 'middle', size: FS.small, fill: col }); break;
    case 'lpf': case 'hpf': case 'bpf': { const w = s * 0.8, ys = [cy - s * 0.5, cy, cy + s * 0.5];
      g = box(s * 1.2) + ys.map(y => wave(y, w)).join('') + (type === 'lpf' ? [0, 1] : type === 'hpf' ? [1, 2] : [0, 2]).map(i => strike(ys[i])).join(''); break; }
    case 'isolator': g = box(s * 1.2) + P('M' + n2(cx - s * 0.75) + ' ' + cy + 'H' + n2(cx + s * 0.35)) + el('path', { d: 'M' + n2(cx + s * 0.75) + ' ' + cy + 'l' + n2(-s * 0.5) + ' ' + n2(-s * 0.35) + 'v' + n2(s * 0.7) + 'Z', fill: col, stroke: 'none' }); break;
    default: g = box(s * 1.2) + txt(cx, cy, 'S', { anchor: 'middle', size: FS.small, fill: col });
  }
  return el('g', { class: 'sym', 'data-sym': type }, g);
}
// Half-width of a symbol of half-height s (its leads run from the block's edges to here).
const symHalf = (type, s) => (type === 'amp' ? s * 0.9 : type === 'thru' ? s * 1.6 : s * 1.2);
/* One block: its RF symbol on the wire (leads from the block's edges), short name above, key value below, × to remove;
   the block's area masks the wire behind it and is outlined only when selected. */
function blockBox(G, k, i, x, y){
  const d = K[k][i], on = isSel(k, i), top = y - G.bh / 2, cx = x + G.bw / 2, big = G.bw >= 110, fs = FS.small;   // 14: names clear the × at the corner
  const ss = (G.div ? 11 : 13) * G.k, dy = (G.div ? 22 : 24) * G.k, hw = symHalf(d.type, ss);
  let s = btnG({ 'data-blk': k + ':' + i, 'aria-pressed': on ? 'true' : 'false' }, blockName(k, i) + ': ' + PRESET_NAME[d.type] + ' ' + keyText(d) + (on ? ' (selected)' : ''),
    el('rect', { x, y: top, width: G.bw, height: G.bh, rx: 8, fill: 'var(--bg)', stroke: on ? 'var(--focus)' : 'none', 'stroke-width': on ? 5 : 2, class: 'block' + (on ? ' sel' : '') })
    + el('path', { d: 'M' + n2(x) + ' ' + y + 'H' + n2(cx - hw) + 'M' + n2(cx + hw) + ' ' + y + 'H' + n2(x + G.bw), stroke: 'var(--mut)', 'stroke-width': 2, class: 'lead' })
    + sym(d.type, cx, y, ss, d.type === 'amp' ? 'var(--s21)' : 'var(--txt)')
    + txt(cx, y - dy, (big ? SHORT_NAME : ABBR)[d.type], { anchor: 'middle', size: fs })
    + txt(cx, y + dy, keyText(d), { anchor: 'middle', size: fs, fill: d.type === 'amp' ? 'var(--s21)' : 'var(--txt)', cls: 'keyv' }));
  if(K.div || K.main.length > 1) s += btnG({ 'data-del': k + ':' + i }, 'Remove ' + blockName(k, i).toLowerCase(),
    el('circle', { cx: x + G.bw, cy: top, r: 12, fill: 'var(--bg)', stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'xbtn' }) + crossMark(x + G.bw, top, 5, 'var(--mut)'));
  return s;
}
// A load box (L, A or B) at the end of a row.
function loadBox(G, b, y){
  const zl = K[loadKey(b)], top = y - G.bh / 2, cx = G.loadX + G.Lk.loadW / 2, on = isSel('load') && K.sel.b === b;
  return btnG({ 'data-load': b, 'aria-pressed': on ? 'true' : 'false' }, 'Load' + (b === 'L' ? '' : ' ' + b) + ': ' + loadShort(zl).replace(INF, 'open'),
    el('rect', { x: G.loadX, y: top, width: G.Lk.loadW, height: G.bh, rx: 8, fill: 'var(--bg2)', stroke: on ? 'var(--focus)' : 'var(--txt)', 'stroke-width': on ? 5 : 2, class: 'load' })
    + txt(cx, y - 13, 'Load' + (b === 'L' ? '' : ' ' + b), { anchor: 'middle', size: G.div ? FS.small : FS.label })
    + txt(cx, y + 13, loadShort(zl), { anchor: 'middle', size: FS.small, id: 'loadVal' + (b === 'L' ? '' : b) }));
}
/* The splitter symbol inside the divider box (Douglas, 2026-10-23): the input line from port 1 splits at a point into two
   lines that run out to ports 2 (branch A) and 3 (branch B), arrows on the outputs, and each output's level in dB
   (|S21|², |S31|²): one "−3.0 dB" when the split is equal. */
function splitter(G, yM){
  const w = G.Lk.divW, x0 = G.divX, xs = x0 + 0.25 * w, xb = x0 + 0.5 * w, x1 = x0 + w, yA = G.rows.A, yB = G.rows.B, xl = x0 + 0.68 * w;
  const D = dividerS(K.div.type, splitOf() / 100), pa = cabs(D[1][0]) ** 2, pb = cabs(D[2][0]) ** 2, t = p => fx(10 * Math.log10(p), 1) + ' dB';
  const head = y => el('path', { d: 'M' + n2(x1 - 6) + ' ' + y + 'l-10 -5v10Z', fill: 'var(--txt)', class: 'shead' });
  let s = el('path', { d: 'M' + n2(x0) + ' ' + yM + 'H' + n2(xs) + 'L' + n2(xb) + ' ' + yA + 'H' + n2(x1) + 'M' + n2(xs) + ' ' + yM + 'L' + n2(xb) + ' ' + yB + 'H' + n2(x1),
    fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', class: 'split' }) + head(yA) + head(yB);
  s += Math.abs(pa - pb) < 1e-9 ? txt(xl, yM, t(pa), { anchor: 'middle', size: FS.small, id: 'divDb' })
    : txt(xl, yM - 14, t(pa), { anchor: 'middle', size: FS.small, fill: 'var(--s21)', id: 'divDbA' }) + txt(xl, yM + 14, t(pb), { anchor: 'middle', size: FS.small, fill: 'var(--s12)', id: 'divDbB' });
  return s;
}
// The circuit: source, wires, blocks, the divider and its branches, loads, and a "+" at every junction with room.
function drawCircuit(G){
  const yM = G.rows.M, on = isSel('src');
  let s = '';
  // wires first, so the boxes sit on them
  s += el('line', { x1: G.x0, y1: yM, x2: G.div ? G.divX : G.loadX, y2: yM, stroke: 'var(--mut)', 'stroke-width': 2, class: 'wire' });
  if(G.div) ['A', 'B'].forEach(k => { s += el('line', { x1: G.after, y1: G.rows[k], x2: G.loadX, y2: G.rows[k], stroke: 'var(--mut)', 'stroke-width': 2, class: 'wire' }); });
  s += btnG({ 'data-src': 1, 'aria-pressed': on ? 'true' : 'false' }, 'Source: ' + fmtMag(K.vsMag) + ' V, Zs ' + zField(K.zs) + ' Ω' + (on ? ' (selected)' : ''),
    el('circle', { cx: G.srcX, cy: yM, r: G.Lk.srcR, fill: 'var(--panel)', stroke: on ? 'var(--focus)' : 'var(--txt)', 'stroke-width': on ? 5 : 2.5, class: 'src' })
    + el('path', { d: 'M' + (G.srcX - 14) + ' ' + yM + 'c5 -12 9 -12 14 0s9 12 14 0', fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2.5 }));
  s += txt(G.srcX, yM + G.Lk.srcR + 18, 'Source', { anchor: 'middle', fill: 'var(--mut)' });
  K.main.forEach((_, i) => { s += blockBox(G, 'main', i, G.bxM[i], yM); });
  if(G.div){
    const top = G.rows.A - G.bh / 2, bot = G.rows.B + G.bh / 2, cx = G.divX + G.Lk.divW / 2, on2 = isSel('div');
    s += btnG({ 'data-div': 1, 'aria-pressed': on2 ? 'true' : 'false' }, 'Power divider: ' + DIV_NAME[K.div.type] + ', ' + splitOf() + ' / ' + (100 - splitOf()) + ' %' + (on2 ? ' (selected)' : ''),
      el('rect', { x: G.divX, y: top, width: G.Lk.divW, height: bot - top, rx: 8, fill: 'var(--panel)', stroke: on2 ? 'var(--focus)' : 'var(--txt)', 'stroke-width': on2 ? 5 : 2, class: 'divbox' })
      + splitter(G, yM) + txt(cx, top + 16, DIV_SHORT[K.div.type], { anchor: 'middle', size: FS.small, id: 'divType_t' })
      + txt(cx, bot - 16, splitOf() + ' / ' + (100 - splitOf()) + ' %', { anchor: 'middle', size: FS.small, id: 'divSplit_t' }));
    s += btnG({ 'data-del': 'div' }, 'Remove the divider (branch A joins the chain)',
      el('circle', { cx: G.divX + G.Lk.divW, cy: top, r: 12, fill: 'var(--bg)', stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'xbtn' }) + crossMark(G.divX + G.Lk.divW, top, 5, 'var(--mut)'));
    ['A', 'B'].forEach(k => { K[k].forEach((_, i) => { s += blockBox(G, k, i, G.br[k].bx[i], G.rows[k]); }); s += loadBox(G, k, G.rows[k]); });
  } else s += loadBox(G, 'L', yM);
  // a "+" at every junction where a block can still go (on the chain before a divider also when only the divider can)
  const nM = K.main.length;
  if(canAdd('main') || !K.div) G.jM.forEach((x, j) => { s += plusBtn('main', j, x, yM, j === 0 ? 'before block 1' : j === nM ? 'after block ' + nM : 'between blocks ' + j + ' and ' + (j + 1)); });
  if(G.div) ['A', 'B'].forEach(k => { if(canAdd(k)) G.br[k].jx.forEach((x, j) => { s += plusBtn(k, j, x, G.rows[k], 'in branch ' + k + (j === 0 ? ' after the divider' : ' after its block ' + j)); }); });
  return s;
}
/* The power spectrum at one junction: P/ref in dB across the band (MINI_SPAN dB tall, one scale for every junction),
   filled, with the marker frequency; its label (where and the value at the marker) above or below the frame, and a
   dashed leader to the wire. */
function mini(o){
  const { x, w, y, h: mh, v, rng, name, id, above, wireY } = o, xs = i => x + w * i / (NPTS - 1);
  const ys = r => { const d = db10(r); return y + mh * (1 - (Math.max(rng[0], Math.min(rng[1], d === -Infinity ? rng[0] : d)) - rng[0]) / (rng[1] - rng[0])); };
  let s = el('line', { x1: x + w / 2, y1: above ? y + mh : wireY, x2: x + w / 2, y2: above ? wireY : y, stroke: 'var(--line)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', class: 'leader', 'pointer-events': 'none' });
  s += el('rect', { x, y, width: w, height: mh, fill: 'var(--bg2)', stroke: 'var(--line)', 'stroke-width': 1.5, class: 'mini' });
  const pts = v.map((r, i) => n2(xs(i)) + ' ' + n2(ys(r))).join('L');
  s += el('path', { d: 'M' + n2(x) + ' ' + n2(y + mh) + 'L' + pts + 'L' + n2(x + w) + ' ' + n2(y + mh) + 'Z', fill: 'var(--s21)', 'fill-opacity': 0.3, stroke: 'none', class: 'spec' });
  s += el('path', { d: 'M' + pts, fill: 'none', stroke: 'var(--s21)', 'stroke-width': 2, class: 'specline', 'data-q': id });
  const fr = (K.fm - K.f1) / (K.f2 - K.f1), xm = x + w * fr, k = Math.round(fr * (NPTS - 1));
  s += el('line', { x1: xm, y1: y, x2: xm, y2: y + mh, stroke: 'var(--txt)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3', class: 'mmark' });
  s += txt(x + w / 2, above ? y - 11 : y + mh + 14, name + ' ' + sdb(o.at !== undefined ? o.at : v[k]), { anchor: 'middle', size: FS.small, id, cls: 'minil' });
  return s;
}
// The spectra at every junction (minis), placed under the cascade, or above the chain and branch A and under branch B.
function drawMinis(G, sw, atM){
  const all = [].concat(...sw.M, ...(G.div ? [...sw.A, ...sw.B] : [])).map(db10).filter(isFinite), top = 10 * Math.ceil((Math.max(0, ...all) + 1) / 10), rng = [top - MINI_SPAN, top];
  const w = Math.min(180, G.pitch - 12), cl = (cx, lo, hi) => Math.min(hi - w / 2, Math.max(lo + w / 2, cx)) - w / 2;
  const lo = LY_C.edge, hi = G.W - LY_C.edge, nM = K.main.length;
  let s = '';
  const name = (k, j, n) => (k === 'main' ? (j === 0 ? 'in' : j === n ? (G.div ? 'div in' : 'load') : j + '|' + (j + 1)) : (j === n ? 'load ' + k : j === 0 ? k + ' in' : k + j + '|' + (j + 1)));
  if(!G.div){ const m = G.Lk.miniC;
    G.jM.forEach((jx, j) => { s += mini({ x: cl(jx, lo, hi), w, y: m.top, h: m.h, v: sw.M[j], rng, name: name('main', j, nM), id: 'specM' + j, above: false, wireY: G.rows.M, at: atM.M[j] }); });
    return s; }
  const m = G.Lk.miniD;
  G.jM.forEach((jx, j) => { s += mini({ x: cl(jx, lo, hi), w, y: m.top, h: m.h, v: sw.M[j], rng, name: name('main', j, nM), id: 'specM' + j, above: true, wireY: G.rows.M, at: atM.M[j] }); });
  ['A', 'B'].forEach(k => G.br[k].jx.forEach((jx, j) => { s += mini({ x: cl(jx, lo, hi), w, y: k === 'A' ? m.top : m.topB, h: m.h, v: sw[k][j], rng, name: name(k, j, K[k].length),
    id: 'spec' + k + j, above: k === 'A', wireY: G.rows[k], at: atM[k][j] }); }));
  return s;
}
/* The response across the band: power delivered to each load and reflected at the input, in dB of the reference
   (PLOT_SPAN dB tall), the marker frequency, frequency and dB ticks, the legend on the heading line. Clicking the plot
   moves the marker. */
function drawPlot(G, sw, y0){
  const e = LY_C.edge, x0 = e + 58, x1 = G.W - e - 4, yt = y0 + 38, yb = G.H - e - 28;
  if(yb - yt < 60) return '';
  const series = G.div ? [['load A', 'var(--s21)', sw.A[sw.A.length - 1], 'plotA'], ['load B', 'var(--s12)', sw.B[sw.B.length - 1], 'plotB', true], ['reflected', 'var(--s11)', sw.refl, 'plotR']]
    : [['load', 'var(--s21)', sw.M[sw.M.length - 1], 'plotL'], ['reflected', 'var(--s11)', sw.refl, 'plotR']];
  const all = [].concat(...series.map(x => x[2])).map(db10).filter(isFinite), top = 10 * Math.ceil((Math.max(-40, ...all) + 1) / 10), bot = top - PLOT_SPAN;
  const xs = i => x0 + (x1 - x0) * i / (NPTS - 1), ys = r => { const d = db10(r); return yb - (yb - yt) * (Math.max(bot, Math.min(top, d === -Infinity ? bot : d)) - bot) / PLOT_SPAN; };
  let s = heading(e, y0 + 14, 'Across the band · marker ' + fFull(K.fm));
  let lx = G.W - e;
  series.slice().reverse().forEach(([t, col, , , dash]) => { s += txt(lx, y0 + 14, t, { anchor: 'end', size: FS.small, fill: col, cls: 'legend' }); lx -= textW(t, FS.small) + 8;
    s += el('line', { x1: lx - 24, y1: y0 + 14, x2: lx, y2: y0 + 14, stroke: col, 'stroke-width': 3, 'stroke-dasharray': dash ? '6 4' : null }); lx -= 40; });
  for(let v = bot; v <= top; v += 10){ const y = yb - (yb - yt) * (v - bot) / PLOT_SPAN;
    s += el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: 'var(--line)', 'stroke-width': 1, class: 'grid' });
    s += txt(x0 - 6, y, (v > 0 ? '+' : '') + fx(v, 0) + ' dB', { anchor: 'end', size: FS.small, fill: 'var(--mut)', weight: 400 }); }
  s += el('rect', { x: x0, y: yt, width: x1 - x0, height: yb - yt, fill: 'none', stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'frame' });
  [0, 0.25, 0.5, 0.75, 1].forEach(t => { s += txt(x0 + (x1 - x0) * t, yb + 16, fText(K.f1 + (K.f2 - K.f1) * t), { anchor: t === 0 ? 'start' : t === 1 ? 'end' : 'middle', size: FS.small, fill: 'var(--mut)', weight: 400 }); });
  series.forEach(([, col, v, q, dash]) => { s += el('path', { d: 'M' + v.map((r, i) => n2(xs(i)) + ' ' + n2(ys(r))).join('L'), fill: 'none', stroke: col, 'stroke-width': 2.5, 'stroke-dasharray': dash ? '9 6' : null, class: 'curve', 'data-q': q }); });
  const xm = x0 + (x1 - x0) * (K.fm - K.f1) / (K.f2 - K.f1);
  s += el('line', { x1: xm, y1: yt, x2: xm, y2: yb, stroke: 'var(--txt)', 'stroke-width': 2, 'stroke-dasharray': '6 4', class: 'marker', 'data-q': 'marker', 'data-v': K.fm });
  s += el('rect', { x: x0, y: yt, width: x1 - x0, height: yb - yt, fill: 'none', 'pointer-events': 'all', 'data-plot': 1, class: 'plothit', 'aria-hidden': 'true' });
  K.plot = { x0, x1 };
  return s;
}
/* The power along the chain at the marker frequency (dB of the reference) after each stage, as in a cascade-analysis
   chart: one point per junction, the stages' symbols along the axis; with a divider the line splits into branch A
   (green) and branch B (purple, dashed), their symbols in their colours on two rows. */
function drawChainPlot(G, atM, y0){
  const e = LY_C.edge, nM = K.main.length, nBr = G.div ? Math.max(K.A.length, K.B.length) : 0, steps = G.div ? nM + 1 + nBr : nM;
  const x0 = e + 58, x1 = G.W - e - 4, yt = y0 + 38, yb = G.H - e - (G.div ? 56 : 50);
  if(yb - yt < 60) return '';
  const xs = i => x0 + 30 + (x1 - x0 - 60) * i / Math.max(1, steps);
  const pts = { M: atM.M.map((v, j) => [xs(j), v, 'chainM' + j]) };
  if(G.div) ['A', 'B'].forEach(k => { pts[k] = [[xs(nM), atM.M[nM]]].concat(atM[k].map((v, j) => [xs(nM + 1 + j), v, 'chain' + k + j])); });
  const all = [].concat(atM.M, atM.A, atM.B).map(db10).filter(isFinite), top = 10 * Math.ceil((Math.max(0, ...all) + 1) / 10);
  const bot = Math.max(top - 80, Math.min(top - 30, 10 * Math.floor((Math.min(...all, 0) - 1) / 10))), span = top - bot;
  const ys = r => { const d = db10(r); return yb - (yb - yt) * (Math.max(bot, Math.min(top, d === -Infinity ? bot : d)) - bot) / span; };
  const series = G.div ? [['load A', 'var(--s21)'], ['load B', 'var(--s12)', true]] : [['load', 'var(--s21)']];
  let s = heading(e, y0 + 14, 'Along the chain at ' + fFull(K.fm));
  let lx = G.W - e;
  series.slice().reverse().forEach(([t, col, dash]) => { s += txt(lx, y0 + 14, t, { anchor: 'end', size: FS.small, fill: col, cls: 'legend' }); lx -= textW(t, FS.small) + 8;
    s += el('line', { x1: lx - 24, y1: y0 + 14, x2: lx, y2: y0 + 14, stroke: col, 'stroke-width': 3, 'stroke-dasharray': dash ? '6 4' : null }); lx -= 40; });
  for(let v = bot; v <= top; v += 10){ const y = ys(Math.pow(10, v / 10));
    s += el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: 'var(--line)', 'stroke-width': 1, class: 'grid' });
    s += txt(x0 - 6, y, (v > 0 ? '+' : '') + fx(v, 0) + ' dB', { anchor: 'end', size: FS.small, fill: 'var(--mut)', weight: 400 }); }
  for(let i = 0; i <= steps; i++) s += el('line', { x1: xs(i), y1: yt, x2: xs(i), y2: yb, stroke: 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': '2 4', class: 'grid' });
  s += el('rect', { x: x0, y: yt, width: x1 - x0, height: yb - yt, fill: 'none', stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'frame' });
  const line = (p, col, dash, q) => el('path', { d: 'M' + p.map(([x, v]) => n2(x) + ' ' + n2(ys(v))).join('L'), fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-dasharray': dash ? '9 6' : null, class: 'curve', 'data-q': q });
  const dots = (p, col) => p.filter(x => x[2]).map(([x, v, q]) => el('circle', { cx: x, cy: ys(v), r: 4.5, fill: col, stroke: 'var(--bg)', 'stroke-width': 1.5, class: 'cdot', 'data-q': q, 'data-v': +db10(v).toFixed(6) })).join('');
  if(G.div){ s += line(pts.M, 'var(--txt)', false, 'chainLineM') + line(pts.A, 'var(--s21)', false, 'chainLineA') + line(pts.B, 'var(--s12)', true, 'chainLineB');
    s += dots(pts.M, 'var(--txt)') + dots(pts.A, 'var(--s21)') + dots(pts.B, 'var(--s12)'); }
  else s += line(pts.M, 'var(--s21)', false, 'chainLineM') + dots(pts.M, 'var(--s21)');
  // the stages' symbols under the axis, between their two points (names under them when there is no divider)
  const mid = i => (xs(i) + xs(i + 1)) / 2, yS = yb + 18, yS2 = yb + 42;
  K.main.forEach((d, i) => { s += sym(d.type, mid(i), yS, 9, 'var(--txt)'); if(!G.div) s += txt(mid(i), yb + 40, ABBR[d.type], { anchor: 'middle', size: FS.small, fill: 'var(--mut)', weight: 400 }); });
  if(G.div){ const xd = mid(nM);
    s += el('g', { class: 'sym', 'data-sym': 'div' }, el('rect', { x: xd - 12, y: yS - 9, width: 24, height: 18, rx: 2, fill: 'var(--bg)', stroke: 'var(--txt)', 'stroke-width': 2 })
      + el('path', { d: 'M' + n2(xd - 12) + ' ' + yS + 'H' + n2(xd - 5) + 'L' + n2(xd + 2) + ' ' + (yS - 5) + 'H' + n2(xd + 12) + 'M' + n2(xd - 5) + ' ' + yS + 'L' + n2(xd + 2) + ' ' + (yS + 5) + 'H' + n2(xd + 12), fill: 'none', stroke: 'var(--txt)', 'stroke-width': 1.5 }));
    K.A.forEach((d, i) => { s += sym(d.type, mid(nM + 1 + i), yS, 9, 'var(--s21)'); });
    K.B.forEach((d, i) => { s += sym(d.type, mid(nM + 1 + i), yS2, 9, 'var(--s12)'); }); }
  return s;
}
// The whole Cascade drawing (W: the drawing's width in design units).
function drawCascade(H, W){
  W = Math.max(DESIGN_W, W || DESIGN_W);
  const G = geoC(H, W), sw = sweep(), r = solveAt(K.fm), ref = refOf(r), at = l => l.map(n => n.P / ref);
  const atM = { M: at(r.nodesM), A: G.div ? at(r.nodesA) : [], B: G.div ? at(r.nodesB) : [] };
  K.geo = G;
  return el('svg', { class: 'vis', viewBox: '0 0 ' + n2(W) + ' ' + n2(H), role: 'img', 'aria-label': 'Cascade: the circuit, the band\'s spectrum at each junction and the response across the band' },
    drawMinis(G, sw, atM) + drawCircuit(G) + (K.plotMode === 'chain' ? drawChainPlot(G, atM, G.div ? G.Lk.plotD : G.Lk.plotC) : drawPlot(G, sw, G.div ? G.Lk.plotD : G.Lk.plotC)));
}
// ── END DRAWING ───────────────────────────────────────────────

// ── INTERACTION ───────────────────────────────────────────────
// Select a block, the source, a load or the divider (its editor opens in the panel).
function select(s){ K.sel = s; K.menu = false; redraw(true); }
// Keep the selection on something that exists.
function fixSel(){
  const s = K.sel;
  if(s.k === 'div' && !K.div) K.sel = { k: 'src' };
  else if(s.k === 'load' && (s.b === 'L') === !!K.div) K.sel = { k: 'load', b: K.div ? 'A' : 'L' };
  else if(['main', 'A', 'B'].includes(s.k)){ const l = listOf(s.k); if(!l || !l.length || (s.k !== 'main' && !K.div)) K.sel = { k: 'src' }; else K.sel = { k: s.k, i: Math.min(s.i, l.length - 1) }; }
}
// Remove block "k:i" (a single cascade keeps one block), or the divider ("div": branch A joins the chain, B goes).
function removeAt(key){
  if(key === 'div'){ K.main = K.main.concat(K.A); if(!K.main.length) K.main.push(newBlock('thru'));
    K.zl = K.zlA; K.div = null; K.A = []; K.B = []; }
  else { const [k, i] = key.split(':'); if(!K.div && K.main.length <= 1) return; listOf(k).splice(+i, 1); }
  K.menu = false; fixSel(); redraw(true);
}
/* Insert at the open "+": a block of the type, or a power divider at junction j of the chain: the blocks after j become
   branch A, branch B starts as a copy of them, and the load is copied to both branches. */
function addBlock(type){
  if(K.menu === false) return;
  const [k, js] = K.menu.split(':'), j = +js;
  if(type === 'div'){ if(K.div || k !== 'main') return;
    const tail = K.main.splice(j);
    K.A = tail; K.B = tail.map(d => JSON.parse(JSON.stringify(d))); K.zlA = K.zl; K.zlB = { z: C(K.zl.z.re, K.zl.z.im), inf: K.zl.inf };
    K.div = { type: 'wilkinson', split: 50 }; K.sel = { k: 'div' }; }
  else { if(!canAdd(k)) return; listOf(k).splice(j, 0, newBlock(type)); K.sel = { k, i: j }; }
  K.menu = false; redraw(true);
}
// A click or Enter/Space on the drawing: select, remove, "+", or (a click) move the marker. Returns true when handled.
function cascadeActivate(t, ev){
  const g = t.closest && t.closest('[data-blk],[data-del],[data-add],[data-src],[data-load],[data-div],[data-plot]'); if(!g) return false;
  const ds = g.dataset;
  if(ds.del !== undefined) removeAt(ds.del);
  else if(ds.blk !== undefined){ const [k, i] = ds.blk.split(':'); select({ k, i: +i }); }
  else if(ds.add !== undefined){ K.menu = K.menu === ds.add ? false : ds.add; redraw(true); }
  else if(ds.src !== undefined) select({ k: 'src' });
  else if(ds.load !== undefined) select({ k: 'load', b: ds.load });
  else if(ds.div !== undefined) select({ k: 'div' });
  else { if(!ev || ev.type !== 'click' || !K.plot) return false;
    const sv = g.ownerSVGElement, p = sv.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    const q = p.matrixTransform(sv.getScreenCTM().inverse()), fr = Math.min(1, Math.max(0, (q.x - K.plot.x0) / (K.plot.x1 - K.plot.x0)));
    K.fm = K.f1 + (K.f2 - K.f1) * fr; redraw(false); }
  return true;
}
// The "+" menu: an HTML list of block types (and the power divider, on the chain) under the "+" it was opened from.
function addMenu(){
  if(K.menu === false || !K.geo) return null;
  const [k, j] = K.menu.split(':'), G = K.geo, px = k === 'main' ? G.jM[+j] : G.br[k] && G.br[k].jx[+j], py = G.rows[k === 'main' ? 'M' : k];
  if(px === undefined) return null;
  const b = drawBox(), items = (canAdd(k) ? PRESETS.map(t => [t, PRESET_NAME[t]]) : []).concat(k === 'main' && !K.div ? [['div', 'Power divider (split here)']] : []);
  return h('div', { cls: 'addmenu', attrs: { role: 'menu', 'aria-label': 'Add a block', style: 'left:' + n2(b.off + b.s * Math.min(Math.max(px - 60, LY_C.edge), G.W - 250)) + 'px;top:' + n2(b.s * (py + 20)) + 'px' } },
    items.map(([t, name]) => h('button', { type: 'button', id: 'add_' + t, text: name, attrs: { role: 'menuitem' }, onclick: () => addBlock(t) })));
}
// ── END INTERACTION ───────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
/* A validated text field (v1.1.0). parse(text) returns the value or null; ok(v) stores it. Invalid text flags the
   field (red outline, aria-invalid and a message) and the last valid value is kept. */
function tfield(o){
  const msg = h('span', { cls: 'err', id: o.id + 'Err', attrs: { 'aria-live': 'polite' } });
  const inp = h('input', { type: 'text', id: o.id, value: o.text, spellcheck: false, autocomplete: 'off', attrs: { 'aria-describedby': o.id + 'Err' } });
  inp.addEventListener('input', () => {
    const v = o.parse(inp.value), bad = v === null || v === undefined;
    inp.classList.toggle('invalid', bad); inp.setAttribute('aria-invalid', String(bad));
    msg.textContent = bad ? (o.err || 'not a valid value') + ' — keeping the last valid value' : '';
    if(!bad){ o.ok(v); redraw(!!o.full); }
  });
  return h('label', { cls: 'f', htmlFor: o.id }, h('span', {}, ...o.label), inp, msg);
}
// A validated number box with its label and unit on one row.
function numField(id, label, value, unit, valid, ok){
  const inp = h('input', { type: 'number', id, value: +(+value).toPrecision(6), step: 'any', attrs: { 'aria-label': label + (unit ? ' (' + unit + ')' : '') } });
  inp.addEventListener('input', () => { const v = +inp.value, g = inp.value !== '' && isFinite(v) && valid(v);
    inp.classList.toggle('invalid', !g); inp.setAttribute('aria-invalid', String(!g)); if(g){ ok(v); redraw(false); } });
  return h('div', { cls: 'nrow' }, h('label', { htmlFor: id, text: label }), inp, h('span', { cls: 'unit', text: unit }));
}
// A real number (true minus sign accepted), or null.
function parseReal(text){ const c = parseComplex(text, 'deg'); return c && c.im === 0 ? c.re : null; }
// Label pieces: "Z" with subscript "s" and so on.
const sb = (base, sub, rest) => [base, h('sub', { text: sub }), rest || ''];
// A segmented button group.
function segGroup(label, items, cur, onpick){
  return h('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': label } }, items.map(([v, t]) => pbtn('seg_' + v, t, v === cur, () => onpick(v))));
}
// A key/value table.
function kv(rows){ return h('table', { cls: 'res' }, rows.map(([k, v]) => h('tr', {}, h('td', {}, ...[].concat(k)), h('td', { cls: 'v', text: v })))); }
// The S entry fields of the selected block, at the marker frequency.
const S_FIELDS = ['s11', 's12', 's21', 's22'];
/* The selected block's editor: type, its parameters, and its four S entries at the marker frequency (editing one turns
   the block into Custom with those values, as in v1.1.0). */
function blockEditor(){
  const { k, i } = K.sel, d = K[k][i];
  const typeSel = h('select', { id: 'kType', attrs: { 'aria-label': blockName(k, i) + ' type' }, onchange: e => {
    const t = e.target.value; K[k][i] = t === 'custom' ? { type: t, p: {}, S: devS(d, K.fm) } : newBlock(t); redraw(true); } },
    PRESETS.map(t => h('option', { value: t, text: PRESET_NAME[t], selected: t === d.type })));
  const prm = d.type === 'custom' ? [] : PARAMS[d.type].map(([key, label, u, , mn, mx]) => {
    const isF = u === 'f', unit = isF ? K.fu : u, val = isF ? d.p[key] / FU[K.fu] : d.p[key];
    const valid = isF ? (v => v > 0 && v * FU[K.fu] <= 1e15) : key === 'n' ? (v => Number.isInteger(v) && v >= mn && v <= mx) : (v => v >= mn && v <= mx);
    return numField('kp_' + key, label, val, unit, valid, v => { d.p[key] = isF ? v * FU[K.fu] : v; }); });
  const S = devS(d, K.fm);
  const grid = h('div', { cls: 'sg' }, S_FIELDS.map(key => tfield({ id: 'k' + key, label: [h('span', { cls: key, text: S_NAME[key] })], text: polarField(S[key]), parse: t => parseComplex(t, K.unit), err: 'a complex number',
    full: d.type !== 'custom', ok: v => { const cur = K[k][i]; if(cur.type !== 'custom'){ K[k][i] = { type: 'custom', p: {}, S: Object.assign(devS(cur, K.fm), { [key]: v }) }; } else cur.S[key] = v; } })));
  return [h('div', { cls: 'sec', id: 'kTitle', text: blockName(k, i) + ' · ' + PRESET_NAME[d.type] }),
    h('div', { cls: 'nrow' }, h('label', { htmlFor: 'kType', text: 'Type' }), typeSel), ...prm,
    h('div', { cls: 'cap', id: 'kAt', text: 'S at ' + fFull(K.fm) + (d.type === 'custom' ? '' : ' (editing one makes the block Custom)') }), grid, note(PRESET_NOTE[d.type])];
}
// The source and reference editor: V_s, Z_s and Z0.
function srcEditor(){
  return [h('div', { cls: 'sec', id: 'kTitle', text: 'Source and reference' }),
    tfield({ id: 'vsMag', label: sb('V', 's', ' magnitude (peak, V)'), text: String(K.vsMag), parse: t => { const v = parseReal(t); return v !== null && v >= 0 ? v : null; }, err: 'a real number ≥ 0', ok: v => { K.vsMag = v; } }),
    tfield({ id: 'vsAng', label: sb('V', 's', ' angle (' + (K.unit === 'rad' ? 'rad' : '°') + ')'), text: String(K.unit === 'rad' ? +(K.vsAng / DEG).toFixed(5) : K.vsAng),
      parse: parseReal, err: 'a real number', ok: v => { K.vsAng = K.unit === 'rad' ? v * DEG : v; } }),
    tfield({ id: 'zs', label: sb('Z', 's', ' source impedance (Ω)'), text: zField(K.zs), parse: t => { const z = parseComplex(t, K.unit); return z && cabs(cadd(z, C(K.z0, 0))) > EPS_ZERO ? z : null; },
      err: 'a complex impedance, e.g. 50 or 25+j10', ok: v => { K.zs = v; } }),
    tfield({ id: 'z0', label: sb('Z', '0', ' reference impedance (Ω, real 1–1000)'), text: String(K.z0), parse: parseZ0, err: 'a real value from 1 to 1000 Ω', ok: v => { K.z0 = v; } }),
    note('Impedances: 50, 75+j30. S entries: 0.5∠−90 or 0.2+j0.1. Load: open, short.')];
}
// A load editor: Z_L text field plus Matched, Short and Open.
function loadEditor(){
  const b = K.sel.b, key = loadKey(b), set = zl => { K[key] = zl; redraw(true); }, cur = K[key];
  const pressed = { lMatch: !cur.inf && cur.z.re === K.z0 && cur.z.im === 0, lShort: !cur.inf && cur.z.re === 0 && cur.z.im === 0, lOpen: cur.inf };
  return [h('div', { cls: 'sec', id: 'kTitle', text: b === 'L' ? 'Load' : 'Load ' + b }),
    tfield({ id: 'zl', label: sb('Z', b === 'L' ? 'L' : 'L' + b, ' load impedance (Ω)'), text: loadField(cur), parse: t => parseLoad(t, K.unit), err: 'an impedance, open or short', ok: v => { K[key] = v; } }),
    h('div', { cls: 'btnrow' }, pbtn('lMatch', 'Matched', pressed.lMatch, () => set(zLoad(C(K.z0, 0)))), pbtn('lShort', 'Short', pressed.lShort, () => set(zLoad(ZERO))),
      pbtn('lOpen', 'Open', pressed.lOpen, () => set(OPEN_LOAD)))];
}
// The divider editor: type, split (fixed 50 % for resistive and T-junction), the type's note, and Remove.
function divEditor(){
  const fixed = !!DIV_EQUAL_ONLY[K.div.type];
  const sel = h('select', { id: 'divType', onchange: e => { K.div.type = e.target.value; redraw(true); } },
    Object.keys(DIV_NAME).map(t => h('option', { value: t, text: DIV_NAME[t], selected: t === K.div.type })));
  const sl = slider({ id: 'split', label: 'Power split into branch A' + (fixed ? ' (fixed)' : ''), min: 1, max: 99, step: 1, value: fixed ? 50 : K.div.split, unit: '%',
    fmt: x => 'A ' + x + ' percent, B ' + (100 - x) + ' percent', onset: x => { K.div.split = x; redraw(false); } });
  if(fixed) sl.querySelectorAll('input').forEach(x => { x.disabled = true; });
  return [h('div', { cls: 'sec', id: 'kTitle', text: 'Power divider' }), h('div', { cls: 'nrow' }, h('label', { htmlFor: 'divType', text: 'Type' }), sel), sl,
    note(DIV_NOTE[K.div.type] + ' Frequency-independent here.'), h('div', { cls: 'btnrow' }, h('button', { type: 'button', id: 'divRemove', text: 'Remove divider', onclick: () => removeAt('div') }))];
}
/* The band: centre ± span or start–stop (both kept: they describe the same band), the unit, the design frequency f0
   (line lengths and new filters), and the marker. */
function bandEditor(){
  const u = FU[K.fu], cs = K.bandMode === 'cs', setBand = (a, b) => { if(!(a > 0 && b > a)) return false; K.f1 = a; K.f2 = b; clampFm(); return true; };
  const fld = (id, label, val, valid, ok) => numField(id, label, val / u, K.fu, v => v > 0 && valid(v * u), v => ok(v * u));
  const a = cs ? fld('bandC', 'Centre', (K.f1 + K.f2) / 2, v => v - (K.f2 - K.f1) / 2 > 0, v => setBand(v - (K.f2 - K.f1) / 2, v + (K.f2 - K.f1) / 2))
    : fld('bandS', 'Start', K.f1, v => v < K.f2, v => setBand(v, K.f2));
  const b = cs ? fld('bandW', 'Span', K.f2 - K.f1, v => (K.f1 + K.f2) / 2 - v / 2 > 0, v => { const c = (K.f1 + K.f2) / 2; setBand(c - v / 2, c + v / 2); })
    : fld('bandE', 'Stop', K.f2, v => v > K.f1, v => setBand(K.f1, v));
  const unitSel = h('select', { id: 'fUnit', attrs: { 'aria-label': 'Frequency unit' }, onchange: e => { K.fu = e.target.value; redraw(true); } },
    Object.keys(FU).map(t => h('option', { value: t, text: t, selected: t === K.fu })));
  const mk = slider({ id: 'fm', label: 'Marker frequency', min: K.f1 / u, max: K.f2 / u, step: 'any', value: K.fm / u, unit: K.fu, fmt: v => v + ' ' + K.fu,
    onset: v => { K.fm = Math.min(K.f2, Math.max(K.f1, v * u)); redraw(false); } });
  return [h('div', { cls: 'sec', text: 'Frequency band sent through the circuit' }),
    h('div', { cls: 'nrow' }, h('span', { text: 'Plot' }), segGroup('Plot', [['band', 'Across the band'], ['chain', 'Along the chain']], K.plotMode, v => { K.plotMode = v; redraw(true); })),
    h('div', { cls: 'btnrow' }, segGroup('Band entry', [['cs', 'Centre ± span'], ['ss', 'Start – stop']], K.bandMode, v => { K.bandMode = v; redraw(true); }), unitSel),
    a, b, numField('f0', 'Design f0', K.f0 / u, K.fu, v => v > 0, v => { K.f0 = v * u; }), mk,
    note('f0 sets line lengths (ℓ in λ at f0) and new filters.')];
}
// Source and input-port rows.
function inputRows(r){
  const n0 = r.nodesM[0];
  return [[sb('Γ', 's'), polarU(r.Gs)], [sb('Γ', 'in'), polarU(r.Gin)], [sb('Z', 'in'), r.Zin ? fmtRect(r.Zin, 3) + ' Ω' : INF + ' (open)'],
    ['input VSWR', fmtVswr(cabs(r.Gin))], [sb('V', '1'), polarU(n0.V, 'V')], [sb('I', 's'), polarU(n0.I, 'A')],
    [sb('P', 'in', ' into the circuit'), fmtPow(r.Pin)], [sb('P', 'avs', ' available'), fmtPow(r.Pavs)], ['reflected at the input', fmtPow(r.reflIn)]];
}
// Load rows for a chain end.
function loadRows(nodes, GL, r, tag){
  const n = nodes[nodes.length - 1], gt = n.P / refOf(r);
  return [[sb('Γ', 'L' + tag), polarU(GL)], ['load VSWR', fmtVswr(cabs(GL))], [sb('V', 'L' + tag), polarU(n.V, 'V')], [sb('I', 'L' + tag), polarU(n.I, 'A')],
    [sb('P', 'L' + tag, ' to the load'), fmtPow(n.P)], [sb('G', 'T', tag ? ' (P_L' + tag + ' / P_avs)' : ' transducer gain'), fx(gt, 4) + ' (' + fmtRatioDb(gt) + ')']];
}
// Interface rows: power, and V and I, at each junction of a chain.
function nodeRows(nodes, names){
  return h('table', { cls: 'res nodes' }, nodes.map((n, j) => h('tr', {}, h('td', { text: names(j, nodes.length - 1) }),
    h('td', { cls: 'v' }, fmtPow(n.P), h('br'), 'V ' + polarU(n.V) + ' · I ' + polarU(n.I)))));
}
// The results at the marker frequency.
function resultsBox(){
  const r = solveAt(K.fm), out = [];
  if(!K.div){
    const S = r.St, db = dbOf(cabs(S.s21));
    out.push(h('h3', { text: 'Whole chain as one two-port' }), h('div', { cls: 'slines', id: 'chainS' }, ['s21', 's11', 's22', 's12'].map(key => h('div', { cls: 'sline' }, h('span', { cls: 'sname ' + key, text: S_NAME[key] }),
      h('span', { cls: 'sv', text: polarU(S[key]) + (key === 's21' ? ' (' + (db === -Infinity ? MINUS + INF + ' dB' : dbText(db)) + ')' : '') })))));
    out.push(h('h3', { text: 'Source and input' }), kv(inputRows(r)), h('h3', { text: 'Load' }), kv(loadRows(r.nodesM, r.GL, r, '')),
      h('h3', { text: 'Interfaces' }), nodeRows(r.nodesM, (j, N) => (j === 0 ? 'in' : j === N ? 'load' : j + '|' + (j + 1))));
  } else {
    const pc = x => (r.PD > 0 ? ' (' + fmtPct(Math.max(0, x) / r.PD) + ')' : '');
    out.push(h('h3', { text: 'Source and input' }), kv(inputRows(r)),
      h('h3', { text: 'Divider' }), kv([['type', DIV_NAME[K.div.type]], ['set split (A / B)', splitOf() + ' % / ' + (100 - splitOf()) + ' %'], ['into the divider', fmtW(r.PD)],
        ['into branch A', fmtW(r.PA) + pc(r.PA)], ['into branch B', fmtW(r.PB) + pc(r.PB)], ['dissipated', fmtW(Math.max(0, r.Pdiss)) + pc(r.Pdiss)]]),
      h('h3', { text: 'Load A' }), kv(loadRows(r.nodesA, r.GLA, r, 'A')), h('h3', { text: 'Load B' }), kv(loadRows(r.nodesB, r.GLB, r, 'B')),
      h('h3', { text: 'Interfaces' }), nodeRows(r.nodesM, (j, N) => (j === 0 ? 'in' : j === N ? 'div in' : j + '|' + (j + 1))),
      nodeRows(r.nodesA, (j, N) => (j === N ? 'load A' : j === 0 ? 'A in' : 'A' + j + '|' + (j + 1))), nodeRows(r.nodesB, (j, N) => (j === N ? 'load B' : j === 0 ? 'B in' : 'B' + j + '|' + (j + 1))));
  }
  out.push(note('Ratios and % are of ' + refName(r) + '. Peak phasors.'));
  return out;
}
// Side panel of the Cascade view: the selected item's editor, the band, the results at the marker, and Reset.
function panelCascade(){
  fixSel();
  const ed = ['main', 'A', 'B'].includes(K.sel.k) ? blockEditor() : K.sel.k === 'load' ? loadEditor() : K.sel.k === 'div' ? divEditor() : srcEditor();
  return [...ed, ...bandEditor(),
    h('div', { cls: 'sec row2' }, h('span', { id: 'resTitle', text: 'Results at ' + fFull(K.fm) }),
      segGroup('Angle unit (display only)', [['deg', 'Degrees'], ['rad', 'Radians']], K.unit, v => { K.unit = v; redraw(true); })),
    h('div', { id: 'cres' }, ...resultsBox()),
    note('Click a block, the source, a load or the divider to edit it; "+" adds a block or a power divider; click the plot to move the marker. Up to '
      + MAX_MAIN + ' blocks; with a divider, up to ' + MAX_COLS + ' across.'),
    h('div', { cls: 'btnrow' }, h('button', { type: 'button', id: 'cReset', text: 'Reset to example', onclick: () => { resetExample(); redraw(true); } }))];
}
// Refresh the panel's readouts after a value changed (the edited field keeps focus).
function syncCascade(){
  const put = (id, v) => { const e = document.getElementById(id); if(e && e !== document.activeElement && e.value !== v) e.value = v; };
  const blk = ['main', 'A', 'B'].includes(K.sel.k) && K[K.sel.k] && K[K.sel.k][K.sel.i];
  if(blk){ const S = devS(blk, K.fm); S_FIELDS.forEach(key => put('k' + key, polarField(S[key])));
    const at = document.getElementById('kAt'); if(at) at.textContent = 'S at ' + fFull(K.fm) + (blk.type === 'custom' ? '' : ' (editing one makes the block Custom)'); }
  const u = FU[K.fu], fm = document.getElementById('fm');
  if(fm){ fm.min = K.f1 / u; fm.max = K.f2 / u; if(fm !== document.activeElement) fm.value = K.fm / u; put('fmN', String(+(K.fm / u).toPrecision(6))); }
  const rt = document.getElementById('resTitle'); if(rt) rt.textContent = 'Results at ' + fFull(K.fm);
  const box = document.getElementById('cres'); if(box) box.replaceChildren(...resultsBox());
}
// ── END PANEL ─────────────────────────────────────────────────
