/* Power Divider Designer — shared UI: state and persistence, number formats, DOM and SVG builders, the derived design.
   ============================================================
   TABLE OF CONTENTS
   1. State            — every design and view setting, defaults, persistence (localStorage, guarded)
   2. Formats          — dB, dBm, watts, ratio text and parsing
   3. Builders         — HTML elements, segmented buttons, number inputs, SVG elements
   4. Derived design   — synthesis → layout → network → sweep, bandwidths, loaded solves, ideal split
   ============================================================ */

// ── 1. STATE ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SUBSTRATES = { 'FR-4': [4.4, 1.6], 'RO4003C': [3.55, 0.508], 'RT/duroid 5880': [2.2, 0.787], 'RO3010': [10.2, 0.635] };
const SHAPES = [['straight', 'Straight'], ['arc', 'Arc'], ['meander', 'Meander'], ['mitred', 'Mitred']];
const MAX_SEC = 8;
const DEFAULTS = {
  topology: 'wilkinson', N: 2, ratioDB: 0, M: 1, taper: 'binomial', rippleDB: -20, z0: 50, f0: 2.4e9,
  er: 4.4, h: 1.6, msModel: 'pozar', shapes: new Array(MAX_SEC).fill('straight'), turns: 2, gapH: 3, bend: 'mitre', arcDeg: 180,
  fp: '0603', launch: 5, pitch: 15, minW: 0.15, pin: 1, pinUnit: 'W', resOn: true, rMult: 1, lossOn: false, lossDb: 0.2,
  teeXfmr: true, resForm: 'Y', loads: [], overlay: false, compare: false, sma: true, view3d: false,
  tree: { N: 4, layout: 'binary', amp: 'uniform', edgeDB: -10, module: 'wilk', levelMods: [], mods: {}, ratios: {}, equalise: true, pathErr: 0 },
  perf: { traces: {}, mode: 'mag', uLo: 0.2, uHi: 2.4, dbMin: -40, marker: 1.2 },
};
const LS_KEY = 'pdd.state.v2';
/* Every enumerated setting must be one of its values (a stored state is data, never markup); arrays are rebuilt. */
const ENUMS = { topology: ['wilkinson', 'tee', 'resistive', 'tree'], taper: ['binomial', 'cheby'], msModel: ['pozar', 'hj'], fp: ['0402', '0603'],
  pinUnit: ['W', 'dBm'], resForm: ['Y', 'delta'], bend: ['mitre', 'round'] };
const pinBad = s => s.pinUnit === 'W' && !(s.pin > 0);
function sanitize(s){
  const d = freshState(), pick = (v, ok, def) => ok.includes(v) ? v : def;
  for(const k in ENUMS) s[k] = pick(s[k], ENUMS[k], d[k]);
  s.tree.layout = pick(s.tree.layout, ['binary', 'H'], 'binary'); s.tree.amp = pick(s.tree.amp, ['uniform', 'cosine'], 'uniform');
  s.tree.module = pick(s.tree.module, ['wilk', 'branch', 'resY'], 'wilk'); s.perf.mode = pick(s.perf.mode, ['mag', 'phase'], 'mag');
  s.shapes = Array.from({ length: MAX_SEC }, (_, k) => pick(s.shapes[k], SHAPES.map(x => x[0]), 'straight'));
  s.tree.levelMods = (s.tree.levelMods || []).slice(0, 5).map(v => pick(v, ['wilk', 'branch', 'resY'], undefined));
  s.loads = (s.loads || []).slice(0, 16).map(L => ({ g: Math.min(0.95, Math.max(0, +(L && L.g) || 0)), deg: isFinite(+(L && L.deg)) ? +L.deg : 0 }));
  // numbers within their control ranges
  const clamp = (o, def, k, lo, hi) => { if(!(o[k] >= lo && o[k] <= hi)) o[k] = def[k]; };
  [['N', 2, 6], ['M', 1, 4], ['ratioDB', -10, 10], ['rippleDB', -40, -6], ['z0', 20, 120], ['f0', 1e8, 4e10], ['er', 1, 15], ['h', 0.05, 5], ['arcDeg', 60, 300],
    ['turns', 1, 4], ['gapH', 1, 4], ['launch', 0, 50], ['pitch', 1, 200], ['minW', 0.01, 2], ['rMult', 0.1, 5], ['lossDb', 0, 5], ['pin', -100, 1e5]].forEach(([k, lo, hi]) => clamp(s, d, k, lo, hi));
  [['N', 2, 16], ['edgeDB', -30, 0], ['pathErr', 0, 100]].forEach(([k, lo, hi]) => clamp(s.tree, d.tree, k, lo, hi));
  if(pinBad(s)) s.pin = d.pin;
  if(!(s.perf.uLo >= 0.05 && s.perf.uHi <= 3 && s.perf.uLo < s.perf.uHi - 0.05)){ s.perf.uLo = d.perf.uLo; s.perf.uHi = d.perf.uHi; }
  if(!(s.perf.dbMin >= -120 && s.perf.dbMin <= -10)) s.perf.dbMin = d.perf.dbMin;
  s.N = Math.round(s.N); s.M = Math.round(s.M); s.tree.N = Math.round(s.tree.N);
  return s;
}

function freshState(){ return JSON.parse(JSON.stringify(DEFAULTS)); }
// Merge a stored object over the defaults, keeping only known keys of the right type.
function mergeState(base, j){
  if(!j || typeof j !== 'object') return base;
  for(const k in base){
    if(!(k in j)) continue;
    const b = base[k], v = j[k];
    if(Array.isArray(b)){ if(Array.isArray(v)) base[k] = v.slice(0, Math.max(b.length, 16)); }
    else if(b && typeof b === 'object'){ if(v && typeof v === 'object' && !Array.isArray(v)) base[k] = mergeState(b, v); }
    else if(typeof v === typeof b && (typeof v !== 'number' || isFinite(v))) base[k] = v;
  }
  return base;
}
const S = (() => {
  let j = null; try { j = JSON.parse(localStorage.getItem(LS_KEY)); } catch { j = null; }
  const s = mergeState(freshState(), j);
  // the per-junction maps have free keys (junction paths): copy only valid entries
  const t = j && j.tree;
  if(t && t.mods && typeof t.mods === 'object') for(const p in t.mods){ if(/^[LR]{0,5}$/.test(p) && MODULE_NAME[t.mods[p]]) s.tree.mods[p] = t.mods[p]; }
  if(t && t.ratios && typeof t.ratios === 'object') for(const p in t.ratios){ const v = t.ratios[p]; if(/^[LR]{0,5}$/.test(p) && typeof v === 'number' && Math.abs(v) <= 10) s.tree.ratios[p] = v; }
  sanitize(s);
  const tr = j && j.perf && j.perf.traces;
  if(tr && typeof tr === 'object') for(const k in tr){ if(/^S\w{1,8}$/.test(k) && typeof tr[k] === 'boolean') s.perf.traces[k] = tr[k]; }
  return s;
})();
function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* storage blocked: the page still works */ } }
const isTree = () => S.topology === 'tree';
const nOut = () => isTree() ? S.tree.N : S.N;
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. FORMATS ────────────────────────────────────────────────
const fmt = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const fmtDb = (x, d) => isFinite(x) ? fmt(x, d == null ? 2 : d) : '−∞';
const dbm = w => 10 * Math.log10(Math.max(w, 1e-15) * 1000);
const pinW = () => S.pinUnit === 'dBm' ? 10 ** (S.pin / 10) / 1000 : S.pin;
const fmtW = w => w >= 1 ? w.toFixed(3) + ' W' : w >= 1e-3 ? (w * 1e3).toFixed(2) + ' mW' : (w * 1e6).toFixed(1) + ' µW';
const fmtGHz = u => (u * S.f0 / 1e9).toFixed(3) + ' GHz';
const wrap180 = d => { let x = ((d + 180) % 360 + 360) % 360 - 180; return x === -180 ? 180 : x; };
// Ratio text: "2:1", "67/33" (percent or parts), or a dB value; returns dB (P2/P3) or null.
function parseRatio(t){
  t = String(t).trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
  let m = t.match(/^(\d*\.?\d+):(\d*\.?\d+)$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^(\d*\.?\d+)%?\/(\d*\.?\d+)%?$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^(-?\d*\.?\d+)(dB)?$/i); if(m) return +m[1];
  return null;
}
const ratioText = dB => { const r = 10 ** (dB / 10), t = v => v.toFixed(2).replace(/\.?0+$/, ''); return r >= 1 ? t(r) + ':1' : '1:' + t(1 / r); };
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. BUILDERS ───────────────────────────────────────────────
function el(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for(const k in attrs || {}){
    if(k === 'on') for(const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
    else if(k === 'text') e.textContent = attrs[k];
    else if(k === 'html') e.innerHTML = attrs[k];
    else if(attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
  }
  kids.forEach(c => { if(c != null) e.append(c); });
  return e;
}
/* Segmented buttons. get/set read and write the value; opts [[value, text, title?]]. */
function segCtl(label, get, set, opts, id){
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label, id });
  opts.forEach(([v, t, title]) => box.append(el('button', { 'aria-pressed': String(get() === v), text: t, title, 'data-v': String(v),
    on: { click: () => { set(v); update(true); } } })));
  return el('div', { class: 'row' }, el('span', { class: 'lbl', text: label }), box);
}
const seg = (label, key, opts, id) => segCtl(label, () => S[key], v => { S[key] = v; }, opts, id);
/* A number input with range check: invalid input is marked and not applied. */
function numCtl(label, id, get, set, lo, hi, step, unit){
  const inp = el('input', { type: 'number', id, value: String(get()), min: lo, max: hi, step, 'aria-label': label + (unit ? ' (' + unit + ')' : '') });
  inp.addEventListener('change', () => { const v = parseFloat(inp.value), ok = isFinite(v) && v >= lo && v <= hi; inp.classList.toggle('invalid', !ok);
    if(ok){ set(v); update(true); } });
  return el('div', { class: 'row' }, el('label', { for: id, text: label }), inp, unit ? el('span', { class: 'unit', text: unit }) : null);
}
function chk(label, id, get, set){
  const c = el('input', { type: 'checkbox', id }); c.checked = !!get();
  c.addEventListener('change', () => { set(c.checked); update(true); });
  return el('div', { class: 'row' }, c, el('label', { for: id, text: label }));
}
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for(const k in attrs) if(attrs[k] != null) e.setAttribute(k, attrs[k]); if(text != null) e.textContent = text; return e; };
const ptsAttr = pts => pts.map(p => p.x.toFixed(4) + ',' + p.y.toFixed(4)).join(' ');
// ── END 3 ─────────────────────────────────────────────────────

// ── 4. DERIVED DESIGN ─────────────────────────────────────────
function synthParams(){
  return { topology: S.topology, N: S.N, ratioDB: S.ratioDB, M: S.M, taper: S.taper, gm: 10 ** (S.rippleDB / 20), z0: S.z0, teeXfmr: S.teeXfmr,
    resForm: S.resForm, tree: S.tree };
}
function msFactory(){ const cache = new Map(); return Z => { const k = Z.toFixed(6); if(!cache.has(k)) cache.set(k, microstrip(Z, S.er, S.h, S.f0, S.msModel)); return cache.get(k); }; }
function geomOpts(shapes){
  return { ms: msFactory(), z0: S.z0, h: S.h, shapes: shapes || S.shapes, fp: S.fp, launch: S.launch, pitch: S.pitch, minW: S.minW,
    shapeOpt: { phi: S.arcDeg / DEG, turns: S.turns, gap: S.gapH * S.h, bend: S.bend }, resOn: S.resOn, rMult: S.rMult,
    treeLayout: S.tree.layout, equalise: S.tree.equalise, pathErr: S.tree.pathErr };
}
const lossDb = () => S.lossOn ? S.lossDb : 0;
/* Full analysis of a design for the current settings (used for the current design, the straight reference, the pinned
   comparison and the direct N-way comparisons). */
function analyse(design, shapes, opts){
  const o = opts || {};
  const lay = layoutDesign(geomOpts(shapes), design);
  const net = buildNetwork(design, { z0: S.z0, resOn: S.resOn, rMult: S.rMult, lens: lay.lens, zs: lay.zs });
  const nf = net.n > 100 ? 121 : 201;
  const sw = o.noSweep ? null : sweep(net, S.perf.uLo, S.perf.uHi, nf, lossDb());
  const S0 = solveS(net, 1, lossDb());
  const loads = (S.loads || []).slice(0, net.ports.length - 1);
  const L0 = solveLoaded(net, 1, lossDb(), loads);
  const bw = sw ? bandwidths(sw, -15) : null;
  return { design, lay, net, sw, S0, L0, bw, ideal: idealFractions(design) };
}
function derive(){
  const design = synthesize(synthParams());
  const D = analyse(design);
  const straight = S.shapes.slice(0, MAX_SEC).every(x => x === 'straight');
  D.ref = straight ? D.lay : layoutDesign(geomOpts(new Array(MAX_SEC).fill('straight')), design);
  D.Lm = solveLoaded(D.net, S.perf.marker, lossDb(), (S.loads || []).slice(0, D.net.ports.length - 1));
  return D;
}
// ── END 4 ─────────────────────────────────────────────────────
