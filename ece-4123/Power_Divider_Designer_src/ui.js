/* Power Divider Designer — shared UI: state and persistence, number formats, DOM and SVG builders, the derived design.
   ============================================================
   TABLE OF CONTENTS
   1. State            — every design and view setting, defaults, ranges, persistence (localStorage, validated, with
                         a note for every stored setting not used)
   2. Formats          — dB, dBm, watts, ratio text and parsing
   3. Builders         — HTML elements, rich text and tables (no raw-HTML sink), segmented buttons, number inputs with
                         refusals in words, sliders, SVG elements
   4. Derived design   — synthesis → layout → network → sweep, bandwidths, loaded solves, ideal split
   ============================================================ */

// ── 1. STATE ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SUBSTRATES = { 'FR-4': [4.4, 1.6], 'RO4003C': [3.55, 0.508], 'RT/duroid 5880': [2.2, 0.787], 'RO3010': [10.2, 0.635] };
const SHAPES = [['straight', 'Straight'], ['arc', 'Arc'], ['meander', 'Meander'], ['mitred', 'Mitred']];
const MAX_SEC = 8;
const MAX_LOADS = 16;                                 // output loads kept in the state (the largest tree)
const LOAD_G_MAX = 0.95;                              // largest stored load |Γ|
const LOAD_DEG_MAX = 180;                             // load angle range ±180° (stored values outside are discarded)
const DEFAULTS = {
  topology: 'wilkinson', N: 2, ratioDB: 0, M: 1, taper: 'binomial', rippleDB: -20, z0: 50, f0: 2.4e9,
  er: 4.4, h: 1.6, msModel: 'course', shapes: new Array(MAX_SEC).fill('straight'), turns: 2, gapH: 3, bend: 'mitre', arcDeg: 180,
  fp: '0603', launch: 5, pitch: 15, minW: 0.15, pin: 1, pinUnit: 'W', resOn: true, rMult: 1, lossOn: false, lossDb: 0.2,
  teeXfmr: true, resForm: 'Y', loads: [], overlay: false, compare: false, sma: true, view3d: false,
  tree: { N: 4, layout: 'binary', amp: 'uniform', edgeDB: -10, module: 'wilk', levelMods: [], mods: {}, ratios: {}, equalise: true, pathErr: 0 },
  perf: { traces: {}, mode: 'mag', uLo: 0.2, uHi: 2.4, dbMin: -40, marker: 1.2 },
};
/* One range per numeric quantity [lo, hi, label, unit]: used by its control, its attributes and the stored-state check
   (CQ-PDD-007). Frequencies of the plot range and marker are f/f0. */
const RANGES = {
  N: [2, 6, 'Outputs N', ''], M: [1, 4, 'Sections per arm', ''], ratioDB: [-10, 10, 'Power split', 'dB'], rippleDB: [-40, -6, 'Ripple |Γ|max', 'dB'],
  z0: [20, 120, 'Z₀', 'Ω'], f0: [0.1, 40, 'f₀', 'GHz'], er: [1, 15, 'εr', ''], h: [0.05, 5, 'h', 'mm'], arcDeg: [60, 300, 'Arc angle', '°'],
  turns: [1, 4, 'Turns', ''], gapH: [1, 4, 'Gap', '× h'], launch: [0, 50, 'Port launch', 'mm'], pitch: [1, 200, 'Port pitch', 'mm'],
  minW: [0.01, 2, 'Minimum W', 'mm'], rMult: [0.1, 5, 'R scale', '×'], lossDb: [0, 5, 'Line loss', 'dB/λg'],
  pinW: [1e-13, 1e5, 'Input power', 'W'], pinDbm: [-100, 80, 'Input power', 'dBm'],
  treeN: [2, 16, 'Tree outputs N', ''], edgeDB: [-30, 0, 'Edge level', 'dB'], pathErr: [0, 100, 'Path error on P2', 'mm'],
  uLo: [0.05, 1, 'f min', 'f/f₀'], uHi: [1, 3, 'f max', 'f/f₀'], dbMin: [-120, -10, 'Lowest dB shown', 'dB'],
};
const rangeText = k => { const [lo, hi, , u] = RANGES[k], f = v => String(+v.toPrecision(6)); return f(lo) + ' to ' + f(hi) + (u ? ' ' + u : ''); };
const inRange = (k, v) => typeof v === 'number' && isFinite(v) && v >= RANGES[k][0] && v <= RANGES[k][1];
const LS_KEY = 'pdd.state.v2';
const MODULES = ['wilk', 'branch', 'resY'];
/* Every enumerated setting must be one of its values (a stored state is data, never markup); arrays are rebuilt. */
const ENUMS = { topology: ['wilkinson', 'tee', 'resistive', 'tree'], taper: ['binomial', 'cheby'], msModel: ['course', 'hj'], fp: ['0402', '0603'],
  pinUnit: ['W', 'dBm'], resForm: ['Y', 'delta'], bend: ['mitre', 'round'] };
const MS_MODEL_RENAMED = { pozar: 'course' };         // v2.0.0 key → v2.0.1 key (same synthesis; ε_eff now two-branch)
/* Settings from storage that were not used, each with its cause, for the notice on the Designer (DEFECT-PDD-004). */
const RESTORE_NOTES = [];
const shown = v => { const t = typeof v === 'string' ? '"' + v.slice(0, 24) + (v.length > 24 ? '…"' : '"') : typeof v === 'number' ? String(v) : Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v; return t; };
function sanitize(s){
  const d = freshState(), note = (k, v, why) => RESTORE_NOTES.push(k + ' ' + shown(v) + ' (' + why + ')');
  const pick = (k, v, ok, def) => { if(ok.includes(v)) return v; if(v !== def) note(k, v, 'not one of its choices'); return def; };
  if(MS_MODEL_RENAMED[s.msModel]) s.msModel = MS_MODEL_RENAMED[s.msModel];
  for(const k in ENUMS) s[k] = pick(k, s[k], ENUMS[k], d[k]);
  s.tree.layout = pick('tree layout', s.tree.layout, ['binary', 'H'], 'binary'); s.tree.amp = pick('output taper', s.tree.amp, ['uniform', 'cosine'], 'uniform');
  s.tree.module = pick('tree module', s.tree.module, MODULES, 'wilk'); s.perf.mode = pick('plot mode', s.perf.mode, ['mag', 'phase'], 'mag');
  s.shapes = Array.from({ length: MAX_SEC }, (_, k) => pick('section ' + (k + 1) + ' shape', s.shapes[k] === undefined ? 'straight' : s.shapes[k], SHAPES.map(x => x[0]), 'straight'));
  s.tree.levelMods = (s.tree.levelMods || []).slice(0, 5).map((v, l) => v == null ? undefined : MODULES.includes(v) ? v : (note('level ' + (l + 1) + ' module', v, 'not one of its choices'), undefined));
  s.loads = (s.loads || []).slice(0, MAX_LOADS).map((L, i) => {
    const g = L && +L.g, deg = L && +L.deg, ok = L && typeof L === 'object';
    if(!ok){ note('P' + (i + 2) + ' load', L, 'not a load'); return { g: 0, deg: 0 }; }
    const gg = isFinite(g) && g >= 0 && g <= LOAD_G_MAX ? g : (note('P' + (i + 2) + ' |Γ|', L.g, 'outside 0 to ' + LOAD_G_MAX), 0);
    const dd = isFinite(deg) && Math.abs(deg) <= LOAD_DEG_MAX ? deg : (note('P' + (i + 2) + ' ∠Γ', L.deg, 'outside ±' + LOAD_DEG_MAX + '°'), 0);
    return { g: gg, deg: dd }; });
  // numbers within their control ranges (f0 and input power are stored in Hz and in the unit chosen)
  const clamp = (o, def, k, rk, div) => { const v = o[k] / (div || 1); if(!inRange(rk, v)){ note(RANGES[rk][2], o[k], 'outside ' + rangeText(rk) + (div ? ' (stored in units of ' + div + ')' : '')); o[k] = def[k]; } };
  ['N', 'M', 'ratioDB', 'rippleDB', 'z0', 'er', 'h', 'arcDeg', 'turns', 'gapH', 'launch', 'pitch', 'minW', 'rMult', 'lossDb'].forEach(k => clamp(s, d, k, k));
  clamp(s, d, 'f0', 'f0', 1e9);
  clamp(s, d, 'pin', s.pinUnit === 'W' ? 'pinW' : 'pinDbm');
  [['N', 'treeN'], ['edgeDB', 'edgeDB'], ['pathErr', 'pathErr']].forEach(([k, rk]) => clamp(s.tree, d.tree, k, rk));
  if(!(inRange('uLo', s.perf.uLo) && inRange('uHi', s.perf.uHi) && s.perf.uLo < s.perf.uHi - 0.05)){
    if(s.perf.uLo !== d.perf.uLo || s.perf.uHi !== d.perf.uHi) note('plot range', s.perf.uLo + '–' + s.perf.uHi, 'not a valid range');
    s.perf.uLo = d.perf.uLo; s.perf.uHi = d.perf.uHi; }
  if(!inRange('dbMin', s.perf.dbMin)){ note('lowest dB shown', s.perf.dbMin, 'outside ' + rangeText('dbMin')); s.perf.dbMin = d.perf.dbMin; }
  // the marker lies inside the plot range (SEC-PDD-002 (a), DEFECT-PDD-003)
  if(!(s.perf.marker >= s.perf.uLo && s.perf.marker <= s.perf.uHi)){ note('marker', s.perf.marker, 'outside the plot range'); s.perf.marker = Math.min(s.perf.uHi, Math.max(s.perf.uLo, d.perf.marker)); }
  s.N = Math.round(s.N); s.M = Math.round(s.M); s.tree.N = Math.round(s.tree.N);
  return s;
}

function freshState(){ return JSON.parse(JSON.stringify(DEFAULTS)); }
// Merge a stored object over the defaults, keeping only known keys of the right type; a wrong type is noted.
function mergeState(base, j, where){
  if(!j || typeof j !== 'object' || Array.isArray(j)) return base;
  for(const k in base){
    if(!Object.prototype.hasOwnProperty.call(j, k)) continue;
    const b = base[k], v = j[k], name = (where ? where + ' ' : '') + k;
    if(Array.isArray(b)){ if(Array.isArray(v)) base[k] = v.slice(0, Math.max(b.length, MAX_LOADS)); else RESTORE_NOTES.push(name + ' ' + shown(v) + ' (not a list)'); }
    else if(b && typeof b === 'object'){ if(v && typeof v === 'object' && !Array.isArray(v)) base[k] = mergeState(b, v, name); else RESTORE_NOTES.push(name + ' ' + shown(v) + ' (not a group of settings)'); }
    else if(typeof v === typeof b && (typeof v !== 'number' || isFinite(v))) base[k] = v;
    else RESTORE_NOTES.push(name + ' ' + shown(v) + ' (wrong type)');
  }
  return base;
}
const S = (() => {
  let j = null, raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { raw = null; }
  if(raw != null){ try { j = JSON.parse(raw); } catch { j = null; RESTORE_NOTES.push('the stored design could not be read (not valid JSON)'); }
    if(j != null && (typeof j !== 'object' || Array.isArray(j))){ RESTORE_NOTES.push('the stored design is ' + shown(j) + ', not a design'); j = null; } }
  const s = mergeState(freshState(), j);
  if(j) for(const k in j){ if(Object.prototype.hasOwnProperty.call(j, k) && !(k in s) && k !== 'sel') RESTORE_NOTES.push('unknown setting ' + shown(k) + ' (not part of this version)'); }
  // the per-junction maps have free keys (junction paths): copy only valid entries; modules by allow-list (SEC-PDD-002 (c))
  const t = j && j.tree, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  if(t && t.mods && typeof t.mods === 'object') for(const p in t.mods){ if(!own(t.mods, p)) continue;
    if(/^[LR]{0,5}$/.test(p) && MODULES.includes(t.mods[p])) s.tree.mods[p] = t.mods[p]; else RESTORE_NOTES.push('junction ' + shown(p) + ' module ' + shown(t.mods[p]) + ' (not one of its choices)'); }
  if(t && t.ratios && typeof t.ratios === 'object') for(const p in t.ratios){ if(!own(t.ratios, p)) continue; const v = t.ratios[p];
    if(/^[LR]{0,5}$/.test(p) && inRange('ratioDB', v)) s.tree.ratios[p] = v; else RESTORE_NOTES.push('junction ' + shown(p) + ' split ' + shown(v) + ' (outside ' + rangeText('ratioDB') + ')'); }
  sanitize(s);
  const tr = j && j.perf && j.perf.traces;
  if(tr && typeof tr === 'object') for(const k in tr){ if(!own(tr, k)) continue; if(/^S\w{1,8}$/.test(k) && typeof tr[k] === 'boolean') s.perf.traces[k] = tr[k]; else RESTORE_NOTES.push('trace ' + shown(k) + ' (not a trace setting)'); }
  return s;
})();
/* Saving is suspended while the Tests page drives the live state (SEC-PDD-003): the stored design is never overwritten. */
const SAVE = { suspended: false };
function save(){ if(SAVE.suspended) return; try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* storage blocked: the page still works */ } }
const isTree = () => S.topology === 'tree';
const nOut = () => isTree() ? S.tree.N : S.N;
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. FORMATS ────────────────────────────────────────────────
// Signed fixed-point text with a true minus; a value that rounds to zero has no sign (never "−0.0", DEFECT-PDD-005).
const fmt = (x, d) => { const t = Math.abs(x).toFixed(d); return (x < 0 && +t !== 0 ? '−' : '') + t; };
const fmtDb = (x, d) => isFinite(x) ? fmt(x, d == null ? 2 : d) : '−∞';
const dbm = w => 10 * Math.log10(Math.max(w, 1e-15) * 1000);
const pinW = () => S.pinUnit === 'dBm' ? 10 ** (S.pin / 10) / 1000 : S.pin;
const fmtW = w => w >= 1 ? w.toFixed(3) + ' W' : w >= 1e-3 ? (w * 1e3).toFixed(2) + ' mW' : (w * 1e6).toFixed(1) + ' µW';
const fmtGHz = u => (u * S.f0 / 1e9).toFixed(3) + ' GHz';
const wrap180 = d => { let x = ((d + 180) % 360 + 360) % 360 - 180; return x === -180 ? 180 : x; };
// An angle in degrees as shown: in (−180, 180] after rounding to dp places, so ±180 reads +180.0 (DEFECT-PDD-005).
const fmtDeg = (deg, dp) => { let r = +wrap180(deg).toFixed(dp); if(r <= -180) r = 180; return fmt(r, dp); };
// Ratio text: "2:1", "67/33" (percent or parts), or a dB value with an optional sign ("+3", "−3 dB"); returns dB (P2/P3) or null.
function parseRatio(t){
  t = String(t).trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
  let m = t.match(/^(\d*\.?\d+):(\d*\.?\d+)$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^(\d*\.?\d+)%?\/(\d*\.?\d+)%?$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^([+-]?\d*\.?\d+)(dB)?$/i); if(m) return +m[1];
  return null;
}
const ratioText = dB => { const r = 10 ** (dB / 10), t = v => v.toFixed(2).replace(/\.?0+$/, ''); return r >= 1 ? t(r) + ':1' : '1:' + t(1 / r); };
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. BUILDERS ───────────────────────────────────────────────
/* HTML element: attrs { on: {event: fn}, text, any attribute }; kids are nodes or strings (as text). No raw-HTML option
   (SEC-PDD-001): rich text goes through rich(). */
function el(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for(const k in attrs || {}){
    if(k === 'on') for(const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
    else if(k === 'text') e.textContent = attrs[k];
    else if(attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
  }
  kids.forEach(c => { if(c != null) e.append(c); });
  return e;
}
/* Rich text from the tool's own strings: only the inline tags b, i, sub, sup, br and span with one of the classes in
   RICH_CLASSES become elements (createElement); everything else, including any other "<", stays text. &nbsp; becomes a
   no-break space. Returns a DocumentFragment. */
const RICH_CLASSES = ['math', 'bad', 'hint', 'mut', 'num', 'beyond'];
const RICH_TOKEN = /<(\/?)(b|i|sub|sup|br|span)(?:\s+class="([a-z]+)")?\s*\/?>|&nbsp;/g;
function rich(s){
  const frag = document.createDocumentFragment(), stack = [frag];
  const top = () => stack[stack.length - 1], text = t => { if(t) top().append(document.createTextNode(t)); };
  let at = 0, m; RICH_TOKEN.lastIndex = 0; s = String(s);
  while((m = RICH_TOKEN.exec(s))){
    text(s.slice(at, m.index)); at = RICH_TOKEN.lastIndex;
    if(m[0] === '&nbsp;'){ text('\u00a0'); continue; }
    const [, close, tag, cls] = m;
    if(tag === 'br'){ if(!close) top().append(document.createElement('br')); continue; }
    if(close){ if(stack.length > 1 && top().tagName.toLowerCase() === tag) stack.pop(); continue; }
    if(tag === 'span' && !RICH_CLASSES.includes(cls)){ text(m[0]); continue; }
    const e = document.createElement(tag); if(cls) e.className = cls; top().append(e); stack.push(e);
  }
  text(s.slice(at));
  return frag;
}
/* Table: head [cell], rows [{ cells: [cell], cls?, attrs? }], foot [cell] or null; a cell is rich text or
   { t (rich text) | text (plain), cls, th }. */
function cellEl(c, tag){
  const o = c != null && typeof c === 'object' ? c : { t: c == null ? '' : String(c) };
  const e = el(o.th ? 'th' : tag, { class: o.cls || null });
  if(o.text != null) e.textContent = o.text; else e.append(rich(o.t));
  return e;
}
function table(cls, head, rows, foot){
  const t = el('table', { class: cls });
  if(head) t.append(el('thead', {}, el('tr', {}, ...head.map(c => cellEl(c, 'th')))));
  t.append(el('tbody', {}, ...rows.map(r => el('tr', Object.assign({ class: r.cls || null }, r.attrs || {}), ...r.cells.map(c => cellEl(c, 'td'))))));
  if(foot) t.append(el('tfoot', {}, el('tr', {}, ...foot.map(c => cellEl(c, 'td')))));
  return t;
}
/* Segmented buttons. get/set read and write the value; opts [[value, text, title?]]. */
function segCtl(label, get, set, opts, id){
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label, id });
  opts.forEach(([v, t, title]) => box.append(el('button', { 'aria-pressed': String(get() === v), text: t, title, 'data-v': String(v),
    on: { click: () => { set(v); update(true); } } })));
  return el('div', { class: 'row' }, el('span', { class: 'lbl', text: label }), box);
}
const seg = (label, key, opts, id) => segCtl(label, () => S[key], v => { S[key] = v; }, opts, id);
/* A refused entry (CQ-PDD-007, DEFECT-PDD-004, VIS-PDD-005): the field goes back to the value in use, is marked
   aria-invalid with the warning outline, and a message beside it names the cause, the range and the value kept. */
function refuse(inp, msg, typed, why, kept){
  inp.value = kept; inp.classList.add('invalid'); inp.setAttribute('aria-invalid', 'true');
  msg.textContent = '⚠ "' + String(typed).slice(0, 20) + '" not applied: ' + why + '. Still using ' + kept + '.';
  msg.hidden = false;
}
function accept(inp, msg){ inp.classList.remove('invalid'); inp.removeAttribute('aria-invalid'); msg.textContent = ''; msg.hidden = true; }
const refuseMsg = id => el('div', { class: 'warnline refused', id: id + '_msg', role: 'alert', hidden: true });
/* A number input for a quantity in RANGES (in the units of its range): an entry outside the range is refused in words. */
function numCtl(label, id, get, set, rk, step){
  const [lo, hi, , unit] = RANGES[rk], msg = refuseMsg(id), cur = () => String(+(+get()).toPrecision(8));
  const inp = el('input', { type: 'number', id, value: cur(), min: lo, max: hi, step, 'aria-label': label + (unit ? ' (' + unit + ')' : ''),
    'aria-describedby': id + '_msg' });
  inp.addEventListener('change', () => { const t = inp.value, v = parseFloat(t);
    if(t.trim() === '' || !isFinite(v)) return refuse(inp, msg, t, 'not a number', cur());
    if(!inRange(rk, v)) return refuse(inp, msg, t, 'allowed ' + rangeText(rk), cur());
    accept(inp, msg); set(v); update(true); });
  return el('div', {}, el('div', { class: 'row' }, el('label', { for: id, text: label }), inp, unit ? el('span', { class: 'unit', text: unit }) : null), msg);
}
function chk(label, id, get, set){
  const c = el('input', { type: 'checkbox', id }); c.checked = !!get();
  c.addEventListener('change', () => { set(c.checked); update(true); });
  return el('div', { class: 'row' }, c, el('label', { for: id, text: label }));
}
/* A slider: input events apply the value and coalesce to one update per animation frame; the closing change event does
   not re-derive (CQ-PDD-004). after(): an optional sidebar refresh when the control set depends on the value. */
let sliderFrame = 0;
function slider(attrs, apply, after){
  const r = el('input', Object.assign({ type: 'range' }, attrs));
  r.addEventListener('input', () => { apply(+r.value); if(!sliderFrame) sliderFrame = requestAnimationFrame(() => { sliderFrame = 0; update(false); }); });
  r.addEventListener('change', () => { if(sliderFrame){ cancelAnimationFrame(sliderFrame); sliderFrame = 0; update(false); } if(after) after(); });
  return r;
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
