/* RF Cascade Analyzer — Lab mode (spec A.9): v1.0.0's Single cascade and Power divider, in three columns (settings,
   chain with schematic and power-flow bar, results). Every entered value is stored in canonical form (complex
   rectangular, angles in degrees); the Degrees/Radians switch changes display only (PF-2). Invalid input is flagged
   and the last valid value is kept (PF-6). All result text is set with textContent. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — presets, example chains, divider names and notes, limits
   2. State            — Lab inputs (canonical values)
   3. Formatting       — angle-unit display, power, dBm, dB
   4. Fields           — validated text fields (flag and keep the last valid value)
   5. Settings column  — topology, angle unit, source, reference, load, divider
   6. Chain column     — device cards, add/remove, reset
   7. Flow visual      — schematic with the power-flow bars (data-q / data-v)
   8. Results column   — overall S, dB lines, source/input, load, node tables, divider
   9. Compute          — solve and render, build and render entry points
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const MAX_DEVS = 10;             // device chain cap (spec A.9)
const PRESET_NAME = { thru: 'Thru line', atten: 'Attenuator', amp: 'Amplifier', phase: 'Phase shift', filter: 'Filter', isolator: 'Isolator', custom: 'Custom' };
const PRESET_UNIT = { atten: 'dB', amp: 'dB', phase: '°', filter: 'dB', isolator: 'dB' };
const PRESET_HINT = { atten: 'attenuation', amp: 'gain', phase: 'phase delay', filter: 'rejection, lossless reflective', isolator: 'insertion loss' };
const EXAMPLE = { main: [['amp', 12], ['atten', 3]], A: [['amp', 10]], B: [['atten', 2]] };   // v1.0.0 example chains
const DIV_NAME = { ideal: 'Ideal equal-split (lossless)', wilkinson: 'Wilkinson (matched, isolated)', resistive: 'Resistive (lossy)', tee: 'T-junction (reactive node)' };
const DIV_NOTE = {
  ideal: 'Input matched, lossless. Outputs are not isolated and not individually matched.',
  wilkinson: 'Matched at all ports and outputs isolated. The isolation resistor dissipates only reflected (odd-mode) power.',
  resistive: 'Matched at all ports but lossy: each output is 6 dB below the input. Equal split only.',
  tee: 'Reactive junction of three Z0 lines: lossless and reciprocal but not matched (S11 = −1/3). Equal split only.' };
const P_UNITS = [[1, 'W'], [1e-3, 'mW'], [1e-6, 'µW'], [1e-9, 'nW']];
const DEC_P = 4, DEC_DBM = 2, DEC_RAD = 3, MW = 1e-3;
const FLOW = { bw: 0.04, label: 6 };   // flow visual: bar width (fraction of the width) and label gap (px)
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
// A device: preset type, its parameter (dB or degrees) and its S entries (C).
const newDev = (type, param) => ({ type, param: param === undefined ? LAB_DEFAULT_PARAM[type] : param, S: labPresetS(type, param === undefined ? LAB_DEFAULT_PARAM[type] : param) });
const LB = {
  unit: 'deg', topo: 'cascade',
  vsMag: 1, vsAng: 0, zs: C(50, 0), z0: 50,
  zl: zLoad(C(50, 0)), zlA: zLoad(C(50, 0)), zlB: zLoad(C(50, 0)),
  divType: 'ideal', split: 50,
  chains: { main: [], A: [], B: [] },
};
// Reset a chain (or both divider branches) to the v1.0.0 example.
function resetChain(key){ (key === 'div' ? ['A', 'B'] : [key]).forEach(k => { LB.chains[k] = EXAMPLE[k].map(([t, p]) => newDev(t, p)); }); }
resetChain('main'); resetChain('div');
// ── END STATE ─────────────────────────────────────────────────

// ── FORMATTING ────────────────────────────────────────────────
// An angle (degrees) in the current unit, as text.
const angText = deg => (LB.unit === 'rad' ? fx(deg / DEG, DEC_RAD) + ' rad' : fx(wrapDeg(deg), DEC_ANG) + '°');
// Magnitude∠angle in the current unit (results).
const polarU = (c, unit) => fmtMag(cabs(c)) + ANGLE_SIGN + angText(cabs(c) <= EPS_ZERO ? 0 : carg(c) * DEG) + (unit ? ' ' + unit : '');
// Field text for a complex value as magnitude∠angle in the current unit (S entries).
function polarField(c){
  const m = cabs(c), a = m <= EPS_ZERO ? 0 : wrapDeg(carg(c) * DEG);
  return +m.toPrecision(6) + '∠' + (LB.unit === 'rad' ? +(a / DEG).toFixed(5) : +a.toFixed(3));
}
// Field text for an impedance (rectangular).
const zField = z => +z.re.toPrecision(6) + (z.im < 0 ? '-j' : '+j') + +Math.abs(z.im).toPrecision(6);
// Field text for a load ("open" for Z_L = ∞).
const loadField = zl => (zl.inf ? 'open' : zField(zl.z));
// Power in W, mW, µW or nW.
function fmtW(P){
  if(!isFinite(P)) return '—';
  const a = Math.abs(P); if(a === 0) return '0 W';
  const u = P_UNITS.find(([s]) => a >= s) || P_UNITS[P_UNITS.length - 1];
  return fx(P / u[0], DEC_P) + ' ' + u[1];
}
// Power in dBm (1 mW reference), power with its dBm, and a power ratio in dB.
const fmtDbm = P => (!(P > 0) ? MINUS + INF + ' dBm' : fx(10 * Math.log10(P / MW), DEC_DBM) + ' dBm');
const fmtPow = P => fmtW(P) + ' (' + fmtDbm(P) + ')';
const fmtRatioDb = r => (!(r > 0) ? MINUS + INF + ' dB' : fx(10 * Math.log10(r), DEC_DB) + ' dB');
// ── END FORMATTING ────────────────────────────────────────────

// ── FIELDS ────────────────────────────────────────────────────
/* A validated text field. parse(text) returns the value or null; ok(v) stores it. Invalid text flags the field
   (red outline, aria-invalid and a message) and the last valid value is kept, so no output is computed from 0. */
function field(o){
  const msg = h('span', { cls: 'err', id: o.id + 'Err', attrs: { 'aria-live': 'polite' } });
  const inp = h('input', { type: 'text', id: o.id, value: o.text, spellcheck: false, autocomplete: 'off', attrs: { 'aria-describedby': o.id + 'Err' } });
  inp.addEventListener('input', () => {
    const v = o.parse(inp.value);
    const bad = v === null || v === undefined;
    inp.classList.toggle('invalid', bad); inp.setAttribute('aria-invalid', String(bad));
    msg.textContent = bad ? (o.err || 'not a valid value') + ' — keeping the last valid value' : '';
    if(!bad){ o.ok(v); compute(); }
  });
  return h('label', { cls: 'f', htmlFor: o.id }, h('span', {}, ...o.label), inp, msg);
}
// A real number (true minus sign accepted), or null.
function parseReal(text){ const c = parseComplex(text, 'deg'); return c && c.im === 0 ? c.re : null; }
// Label pieces: "Z" with subscript "s" and so on.
const sb = (base, sub, rest) => [base, h('sub', { text: sub }), rest || ''];
// ── END FIELDS ────────────────────────────────────────────────

// ── SETTINGS COLUMN ───────────────────────────────────────────
// A segmented button group.
function segGroup(label, items, cur, onpick){
  return h('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': label } }, items.map(([v, t]) =>
    h('button', { type: 'button', id: 'lab_' + v, text: t, attrs: { 'aria-pressed': String(v === cur) }, onclick: () => onpick(v) })));
}
// Build the settings column.
function buildSettings(){
  const left = $('labLeft'), div = LB.topo === 'divider';
  const src = h('fieldset', {}, h('legend', { text: 'Source' }),
    field({ id: 'vsMag', label: sb('V', 's', ' magnitude (peak, V)'), text: String(LB.vsMag), parse: t => { const v = parseReal(t); return v !== null && v >= 0 ? v : null; }, err: 'a real number ≥ 0', ok: v => { LB.vsMag = v; } }),
    field({ id: 'vsAng', label: sb('V', 's', ' angle (' + (LB.unit === 'rad' ? 'rad' : '°') + ')'), text: String(LB.unit === 'rad' ? +(LB.vsAng / DEG).toFixed(5) : LB.vsAng),
      parse: parseReal, err: 'a real number', ok: v => { LB.vsAng = LB.unit === 'rad' ? v * DEG : v; } }),
    field({ id: 'zs', label: sb('Z', 's', ' source impedance (Ω)'), text: zField(LB.zs), parse: t => { const z = parseComplex(t, LB.unit); return z && cabs(cadd(z, C(LB.z0, 0))) > EPS_ZERO ? z : null; },
      err: 'a complex impedance, e.g. 50 or 25+j10', ok: v => { LB.zs = v; } }));
  const ref = h('fieldset', {}, h('legend', { text: 'Reference' }),
    field({ id: 'z0', label: sb('Z', '0', ' reference impedance (Ω, real 1–1000)'), text: String(LB.z0), parse: parseZ0, err: 'a real value from 1 to 1000 Ω', ok: v => { LB.z0 = v; } }),
    h('p', { cls: 'note', text: 'Impedances: 50, 75+j30. S entries: 0.5∠−90 or 0.2+j0.1. Load: open, short.' }));
  left.replaceChildren(h('h2', { text: 'Settings' }),
    segGroup('Topology', [['cascade', 'Single cascade'], ['divider', 'Power divider']], LB.topo, v => { LB.topo = v; buildLab(); renderLab(); }),
    segGroup('Angle unit (display only)', [['deg', 'Degrees'], ['rad', 'Radians']], LB.unit, v => { LB.unit = v; buildLab(); renderLab(); }),
    src, ref, div ? dividerSet() : loadSet('zl', 'Load', 'L', 'Z_L'));
}
// The load fieldset: text field plus Matched, Short and Open buttons (spec A.9).
function loadSet(key, legend, sub){
  const setTo = zl => { LB[key] = zl; const f = $(key); f.value = loadField(zl); f.classList.remove('invalid'); f.setAttribute('aria-invalid', 'false'); $(key + 'Err').textContent = ''; compute(); };
  return h('fieldset', {}, h('legend', { text: legend }),
    field({ id: key, label: sb('Z', sub, ' load impedance (Ω)'), text: loadField(LB[key]), parse: t => parseLoad(t, LB.unit), err: 'an impedance, open or short', ok: v => { LB[key] = v; } }),
    h('div', { cls: 'btnrow' }, h('button', { type: 'button', id: key + 'Match', text: 'Matched', onclick: () => setTo(zLoad(C(LB.z0, 0))) }),
      h('button', { type: 'button', id: key + 'Short', text: 'Short', onclick: () => setTo(zLoad(ZERO)) }),
      h('button', { type: 'button', id: key + 'Open', text: 'Open', onclick: () => setTo(OPEN_LOAD) })));
}
// The divider fieldset: type, split slider (fixed 50 % for resistive and T-junction) and the type note.
function dividerSet(){
  const fixed = !!DIV_EQUAL_ONLY[LB.divType], v = fixed ? 50 : LB.split;
  const sel = h('select', { id: 'divType', onchange: e => { LB.divType = e.target.value; buildLab(); renderLab(); } },
    Object.keys(DIV_NAME).map(k => h('option', { value: k, text: DIV_NAME[k], selected: k === LB.divType })));
  const sl = slider({ id: 'split', label: 'Power split into branch A' + (fixed ? ' (fixed)' : ''), min: 1, max: 99, step: 1, value: v, unit: '%',
    fmt: x => 'A ' + x + ' percent, B ' + (100 - x) + ' percent', onset: x => { LB.split = x; compute(); } });
  if(fixed) sl.querySelectorAll('input').forEach(i => { i.disabled = true; });
  return h('fieldset', {}, h('legend', { text: 'Power divider' }), h('label', { cls: 'f', htmlFor: 'divType' }, 'Type', sel), sl, h('p', { cls: 'note', id: 'divNote', text: DIV_NOTE[LB.divType] }));
}
// ── END SETTINGS COLUMN ───────────────────────────────────────

// ── CHAIN COLUMN ──────────────────────────────────────────────
// One device card: type, parameter and the four S entries (canonical C, shown in the current angle unit).
function devCard(key, list, i){
  const d = list[i], id = key + i, unit = PRESET_UNIT[d.type];
  const sIn = {};
  const sGrid = h('div', { cls: 'sg' }, ['s11', 's12', 's21', 's22'].map(k => {
    const f = field({ id: id + k, label: [h('span', { cls: k, text: S_NAME[k] })], text: polarField(d.S[k]), parse: t => parseComplex(t, LB.unit), err: 'a complex number',
      ok: v => { d.S[k] = v; if(d.type !== 'custom'){ d.type = 'custom'; typeSel.value = 'custom'; prm.classList.add('hidden'); } } });
    sIn[k] = f.querySelector('input'); return f; }));
  const typeSel = h('select', { id: id + 'type', attrs: { 'aria-label': 'Device ' + (i + 1) + ' type' }, onchange: e => {
    d.type = e.target.value; if(d.type !== 'custom'){ d.param = LAB_DEFAULT_PARAM[d.type]; d.S = labPresetS(d.type, d.param); }
    buildChains(); compute(); $(id + 'type').focus(); } },
    LAB_PRESETS.concat(['custom']).map(t => h('option', { value: t, text: PRESET_NAME[t], selected: t === d.type })));
  const prm = unit ? field({ id: id + 'p', label: [(PRESET_HINT[d.type] || '') + ' (' + unit + ')'], text: String(d.param), parse: t => { const v = parseReal(t); return v !== null && (d.type === 'phase' || v >= 0) ? v : null; },
    err: d.type === 'phase' ? 'a real number' : 'a real number ≥ 0', ok: v => { d.param = v; d.S = labPresetS(d.type, v); S_KEYS.forEach(k => { sIn[k].value = polarField(d.S[k]); sIn[k].classList.remove('invalid'); }); } }) : h('span', {});
  const rm = h('button', { type: 'button', text: '×', disabled: list.length <= 1, attrs: { 'aria-label': 'Remove device ' + (i + 1) + (key === 'main' ? '' : ' of branch ' + key) },
    onclick: () => { list.splice(i, 1); buildChains(); compute(); } });
  return h('div', { cls: 'dev', attrs: { 'data-dev': id } }, h('div', { cls: 'row' }, h('b', { text: 'Device ' + (i + 1) }), typeSel, rm), prm, sGrid);
}
// One chain (main, A or B) with its add button.
function chainBox(key, title, loadKey){
  const list = LB.chains[key];
  const add = h('button', { type: 'button', text: '+ Add device', disabled: list.length >= MAX_DEVS, attrs: { 'aria-label': 'Add a device' + (key === 'main' ? '' : ' to branch ' + key) + ' (up to ' + MAX_DEVS + ')' },
    onclick: () => { list.push(newDev('thru', 0)); buildChains(); compute(); } });
  return h('div', { cls: 'chainBox' }, h('div', { cls: 'row' }, h('h2', { text: title }), add),
    loadKey ? loadSet(loadKey, 'Load ' + key, 'L' + key) : null,
    h('div', { cls: 'chain', attrs: { role: 'group', 'aria-label': title } }, list.map((_, i) => devCard(key, list, i))));
}
// Build the chain column: chains, reset, the flow visual and the node table(s).
function buildChains(){
  const div = LB.topo === 'divider';
  const head = h('div', { cls: 'row' }, h('h2', { text: div ? 'Branches: source → divider → two loads' : 'Device chain: source → load' }),
    h('button', { type: 'button', id: 'labReset', text: 'Reset to example', onclick: () => { resetChain(div ? 'div' : 'main'); buildChains(); compute(); } }));
  const parts = div ? [chainBox('A', 'Branch A', 'zlA'), chainBox('B', 'Branch B', 'zlB')] : [chainBox('main', 'Devices')];
  $('labMid').replaceChildren(head, ...parts, h('div', { id: 'flowBox' }), h('div', { id: 'nodeBox' }));
}
// ── END CHAIN COLUMN ──────────────────────────────────────────

// ── FLOW VISUAL ───────────────────────────────────────────────
/* Schematic with power-flow bars: at every interface a vertical bar whose height is the net power there as a fraction
   of the available source power P_avs (A.7: length ∝ quantity, one scale for all bars, the 100 % line drawn), and at
   the input a stacked reflected segment. lanes: [{ name, nodes, devs, top }] — the main chain, or branches A and B. */
function flowSvg(W, Hh, lanes, R, refP, refName){
  const fs = WINDOW_PX.any, pad = fs * 2.6, fr = [R.pinFrac, R.reflFrac];
  lanes.forEach(l => l.nodes.forEach(n => fr.push(n.P / refP)));
  const span = Math.max(1, ...fr.filter(isFinite)), laneH = (Hh - pad * 2) / lanes.length, x0 = fs * 5.5, W2 = W - x0 - fs;
  let s = patterns();
  const bw = Math.max(10, FLOW.bw * W);
  // One bar segment from yBase up, height ∝ f; returns its top y.
  const bar = (x, yBase, f, Hfull, q, col, fill) => {
    const hgt = Math.max(0, f) / span * Hfull, y = yBase - hgt;
    s += el('g', { class: 'seg', 'data-q': q, 'data-v': +f.toPrecision(12), 'data-ref': n2(Hfull / span) }, el('rect', { x: x - bw / 2, y, width: bw, height: hgt, fill, stroke: col, 'stroke-width': 2 }));
    return y; };
  lanes.forEach((ln, li) => {
    const yTop = pad + li * laneH, yBase = yTop + laneH - fs * 1.8, Hfull = (laneH - fs * 3.6), n = ln.nodes.length;
    const step = W2 / Math.max(1, n), xs = k => x0 + step * (k + 0.5);
    s += el('line', { x1: x0 - 4, y1: yBase - Hfull / span, x2: W - fs, y2: yBase - Hfull / span, stroke: 'var(--txt)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' });
    s += txt(x0 - 8, yBase - Hfull / span, '100%', { anchor: 'end', size: fs, fill: 'var(--mut)' });
    s += el('line', { x1: x0 - 4, y1: yBase, x2: W - fs, y2: yBase, stroke: 'var(--line)', 'stroke-width': 1.5 });
    s += txt(x0 - 8, yBase - Hfull / span - fs * 1.4, ln.name, { anchor: 'end', size: fs });
    ln.nodes.forEach((nd, k) => {
      const f = nd.P / refP, x = xs(k);
      if(ln.input && k === 0){   // at the input: net power and, beside it, the power reflected at the input
        const xn = x - bw * 0.6, xr = x + bw * 0.6, yn = bar(xn, yBase, f, Hfull, ln.q + k, 'var(--s21)', 'var(--s21)');
        const yr = bar(xr, yBase, R.reflFrac, Hfull, 'P_refl_in', 'var(--s11)', 'url(#pRefl)');
        s += txt(xn + bw / 2, yn - FLOW.label - fs * 0.5, 'net ' + fmtPct(f), { anchor: 'end', size: fs, fill: 'var(--s21)' });
        s += txt(xr - bw / 2, yr - FLOW.label - fs * 1.7, 'reflected ' + fmtPct(R.reflFrac), { size: fs, fill: 'var(--s11)' });
      } else { const yb = bar(x, yBase, f, Hfull, ln.q + k, 'var(--s21)', 'var(--s21)');
        s += txt(x, yb - FLOW.label - fs * 0.5, fmtPct(f), { anchor: 'middle', size: fs, fill: 'var(--s21)' }); }
      s += txt(x, yBase + fs * 0.9, k === 0 ? 'in' : k === n - 1 ? 'load' : k + '|' + (k + 1), { anchor: 'middle', size: fs, fill: 'var(--mut)', weight: 400 });
      if(k < n - 1) s += txt((x + xs(k + 1)) / 2, yBase + fs * 0.9, PRESET_NAME[ln.devs[k].type].split(' ')[0], { anchor: 'middle', size: fs, weight: 400 });
    });
  });
  s += txt(4, Hh - fs * 0.9, 'Net power at each interface, % of ' + refName, { size: fs, fill: 'var(--mut)', weight: 400 });
  return el('svg', { id: 'flow', width: n2(W), height: n2(Hh), role: 'img', 'aria-label': 'Power flow along the chain' }, s);
}
// ── END FLOW VISUAL ───────────────────────────────────────────

// ── RESULTS COLUMN ────────────────────────────────────────────
// A key/value table.
function kv(rows){ return h('table', { cls: 'res' }, rows.map(([k, v]) => h('tr', {}, h('td', {}, ...[].concat(k)), h('td', { cls: 'v', text: v })))); }
// A node table: interface, V, I, net power.
function nodeTable(nodes, endword, caption){
  const N = nodes.length - 1;
  return h('table', { cls: 'res nodes' }, caption ? h('caption', { text: caption }) : null,
    h('tr', {}, ['Interface', 'Voltage', 'Current', 'Net power → ' + endword].map(t => h('th', { text: t }))),
    nodes.map((nd, k) => h('tr', {}, h('td', { text: k === 0 ? 'Input (port 1)' : k === N ? 'Output → ' + endword : 'Dev ' + k + ' ↔ Dev ' + (k + 1) }),
      h('td', { text: polarU(nd.V, 'V') }), h('td', { text: polarU(nd.I, 'A') }), h('td', { text: fmtPow(nd.P) }))));
}
// The overall S matrix: each entry in polar (current unit) and rectangular.
function sMatrix(S){
  return h('div', { cls: 'smat' }, ['s11', 's12', 's21', 's22'].map(k => h('div', { cls: k }, h('b', { text: S_NAME[k] + ' ' }), polarU(S[k]), h('br'), fmtRect(S[k]))));
}
// |S21| in dB and the everyday insertion loss or gain (PF-5, D4.2): insertion loss = −|S21|dB.
function s21Lines(S){
  const m = cabs(S.s21), db = dbOf(m);
  const ev = db > 0 ? ['gain', '+' + fmtDb(db).replace(/^\+/, '')] : ['insertion loss', db === -Infinity ? INF + ' dB' : fmtDb(-db)];
  return [[['|S', h('sub', { text: '21' }), '| (dB)'], fmtDb(db)], [ev[0], ev[1]]];
}
// Source and input-port rows (shared by cascade and divider).
function inputRows(R){
  return [[sb('Γ', 's'), polarU(R.Gs)], [sb('Γ', 'in'), polarU(R.Gin)], [sb('Z', 'in'), R.Zin ? fmtRect(R.Zin, 3) + ' Ω' : INF + ' (open)'],
    ['input VSWR', fmtVswr(cabs(R.Gin))], ['mismatch at the input, −20·log|Γin| (with this load)', cabs(R.Gin) <= EPS_ZERO ? INF + ' dB' : fmtDb(-dbOf(cabs(R.Gin)))],
    [sb('I', 's', ' source current'), polarU(R.I1, 'A')], [sb('V', '1'), polarU(R.V1, 'V')],
    [sb('P', 'in', ' into the network'), fmtPow(R.Pin)], [sb('P', 'avs', ' available'), fmtPow(R.Pavs)]];
}
// Load rows for a chain end.
function loadRows(nodes, GL, Pavs, tag){
  const n = nodes[nodes.length - 1], PL = n.P, gt = Pavs > 0 ? PL / Pavs : NaN;
  return [[sb('Γ', 'L' + tag), polarU(GL)], ['load VSWR', fmtVswr(cabs(GL))], [sb('V', 'L' + tag), polarU(n.V, 'V')], [sb('I', 'L' + tag), polarU(n.I, 'A')],
    [sb('P', 'L' + tag, ' to the load'), fmtPow(PL)], [sb('G', 'T', tag ? ' (vs. P_avs)' : ' transducer gain'), isFinite(gt) ? fx(gt, 4) + ' (' + fmtRatioDb(gt) + ')' : '—']];
}
// ── END RESULTS COLUMN ────────────────────────────────────────

// ── COMPUTE ───────────────────────────────────────────────────
// Source phasor V_s from the stored magnitude and angle (degrees).
const vsC = () => polar(LB.vsMag, LB.vsAng);
// Solve the current topology and render the flow visual and the results.
function compute(){
  if(app.mode !== 'lab') return;
  const right = $('labRight'), fb = $('flowBox'), nb = $('nodeBox'), W = Math.max(200, $('labMid').clientWidth - 24);
  if(LB.topo === 'cascade'){
    const devs = LB.chains.main.map(d => d.S), r = solveCascade(devs, vsC(), LB.zs, LB.zl, LB.z0), n0 = r.nodes[0];
    const R = Object.assign({}, r, { V1: n0.V, I1: n0.I });
    const refP = R.Pavs > 0 ? R.Pavs : (R.Pin + R.reflIn) || 1, refName = R.Pavs > 0 ? 'P_avs' : 'incident power';
    R.pinFrac = R.Pin / refP; R.reflFrac = R.reflIn / refP;
    fb.innerHTML = flowSvg(W, Math.max(170, WINDOW_PX.any * 13), [{ name: 'chain', nodes: r.nodes, devs: LB.chains.main, q: 'P_node', input: true }], R, refP, refName);
    nb.replaceChildren(nodeTable(r.nodes, 'load'));
    right.replaceChildren(h('h2', { text: 'Results' }), h('h3', { text: 'Overall S (cascade)' }), sMatrix(r.St), kv(s21Lines(r.St)),
      h('h3', { text: 'Source and input port' }), kv(inputRows(R)), h('h3', { text: 'Load' }), kv(loadRows(r.nodes, r.GL, r.Pavs, '')));
  } else {
    const A = LB.chains.A.map(d => d.S), B = LB.chains.B.map(d => d.S), alpha = (DIV_EQUAL_ONLY[LB.divType] ? 50 : LB.split) / 100;
    const r = solveDivider(LB.divType, alpha, vsC(), LB.zs, LB.z0, A, LB.zlA, B, LB.zlB);
    const b1 = cscale(csub(r.V1, cscale(r.I1, LB.z0)), 0.5 / Math.sqrt(LB.z0)), refl = 0.5 * cabs(b1) ** 2;
    const R = Object.assign({}, r), refP = R.Pavs > 0 ? R.Pavs : (R.Pin + refl) || 1, refName = R.Pavs > 0 ? 'P_avs' : 'incident power';
    R.pinFrac = R.Pin / refP; R.reflFrac = refl / refP;
    const inLane = { name: 'input', nodes: [{ P: R.Pin }], devs: [], q: 'P_div_in', input: true };
    fb.innerHTML = flowSvg(W, Math.max(260, WINDOW_PX.any * 20), [inLane, { name: 'A', nodes: r.nodesA, devs: LB.chains.A, q: 'P_A_node' }, { name: 'B', nodes: r.nodesB, devs: LB.chains.B, q: 'P_B_node' }], R, refP, refName);
    nb.replaceChildren(nodeTable(r.nodesA, 'load A', 'Branch A'), nodeTable(r.nodesB, 'load B', 'Branch B'));
    const fA = r.Pin > 0 ? r.PbrA / r.Pin : NaN, fB = r.Pin > 0 ? r.PbrB / r.Pin : NaN;
    right.replaceChildren(h('h2', { text: 'Results' }), h('h3', { text: 'Source and input port' }), kv(inputRows(R)),
      h('h3', { text: 'Divider and power split' }), kv([['type', DIV_NAME[r.type]], ['set split (A / B)', fx(r.alpha * 100, 1) + '% / ' + fx(100 - r.alpha * 100, 1) + '%'],
        ['power into branch A', fmtW(r.PbrA) + ' (' + (isFinite(fA) ? fmtPct(fA) : '—') + ')'], ['power into branch B', fmtW(r.PbrB) + ' (' + (isFinite(fB) ? fmtPct(fB) : '—') + ')'],
        ['divider dissipation', fmtW(Math.max(0, r.Pdiss)) + (r.Pin > 0 ? ' (' + fmtPct(Math.max(0, r.Pdiss) / r.Pin) + ')' : '')]]),
      h('h3', { text: 'Branch A → load' }), kv(loadRows(r.nodesA, r.GLA, r.Pavs, 'A')), h('h3', { text: 'Branch B → load' }), kv(loadRows(r.nodesB, r.GLB, r.Pavs, 'B')));
  }
}
// Build all three Lab columns from the state (topology, unit or chain structure changed).
function buildLab(){ buildSettings(); buildChains(); }
// Render the Lab results (after a size change or on entering Lab).
function renderLab(){ compute(); }
// ── END COMPUTE ───────────────────────────────────────────────
