/* Power Divider Designer — Designer page: the sidebar, the to-scale layout (the centrepiece), hover and selection, the
   output-power table and readouts, and the width-versus-ratio plot.
   ============================================================
   TABLE OF CONTENTS
   1. Sidebar          — topology, outputs, split (or the selected tree junction), tree, stages, shapes, substrate,
                         resistors, power and loss, loads, layout options
   2. Layout view      — board, copper at true width, resistor land patterns, ports with their power, scale bar,
                         footprint box, straight-vs-folded side by side, power-flow overlay, growth animation
   3. Hover            — tooltips and highlighting shared by the layout, the schematic and the sheet
   4. Outputs          — per-output power (W, dBm, %) solved beside ideal, phase, imbalance, loss, bandwidth, R
   5. Width vs ratio   — the two arm widths and the output transformers from 1:1 to 6:1, current ratio marked
   ============================================================ */

// ── 1. SIDEBAR ────────────────────────────────────────────────
// The 2-way split being edited: the single divider's, or the selected tree junction's.
function splitTarget(D){
  if(!isTree()) return { get: () => S.ratioDB, set: v => { S.ratioDB = v; }, label: 'Power split P2 : P3', enabled: S.N === 2 && S.topology !== 'resistive' };
  const nd = D && D.design.tree.junctions.find(j => j.path === (S.sel || '')) || D && D.design.tree.root;
  const path = nd ? nd.path : '';
  return { get: () => (S.tree.ratios[path] != null ? S.tree.ratios[path] : nd ? nd.auto : 0), set: v => { S.tree.ratios[path] = v; },
    label: 'Junction ' + (path || 'root') + ' split (upper : lower)', enabled: !nd || nd.module !== 'resY', nd, path };
}
function buildSide(D){
  const side = $('side'); side.replaceChildren();
  const g = (title, ...rows) => side.append(el('section', { class: 'grp' }, el('h3', { text: title }), ...rows.filter(Boolean)));
  g('Topology',
    seg('Divider', 'topology', [['wilkinson', 'Wilkinson'], ['tee', 'T-junction'], ['resistive', 'Resistive'], ['tree', 'Tree']], 'topoSeg'),
    isTree() ? segCtl('Outputs N', () => S.tree.N, v => { S.tree.N = v; S.tree.ratios = {}; S.tree.mods = {}; S.sel = ''; }, [2, 3, 4, 5, 6, 8, 12, 16].map(n => [n, String(n)]), 'nSeg')
      : seg('Outputs N', 'N', [2, 3, 4, 5, 6].map(n => [n, String(n)]), 'nSeg'),
    isTree() ? segCtl('Depth', () => (Math.log2(S.tree.N) % 1 === 0 ? Math.log2(S.tree.N) : 0), v => { S.tree.N = 2 ** v; S.tree.ratios = {}; S.tree.mods = {}; S.sel = ''; }, [[1, '1'], [2, '2'], [3, '3'], [4, '4']]) : null,
    S.topology === 'tee' ? chk('λ/4 output transformers', 'teeX', () => S.teeXfmr, v => { S.teeXfmr = v; }) : null,
    S.topology === 'resistive' && S.N === 2 ? seg('Form', 'resForm', [['Y', 'Y (Z₀/3)'], ['delta', 'Δ (Z₀)']]) : null,
    el('div', { class: 'hint', text: topologyHint() }));
  // power split
  const tgt = splitTarget(D);
  if(tgt.enabled){
    const v0 = tgt.get();
    const rng = el('input', { type: 'range', id: 'ratioSlider', min: '-10', max: '10', step: '0.05', value: String(v0), 'aria-label': tgt.label + ' in dB' });
    rng.addEventListener('input', () => { tgt.set(+rng.value); update(false); });
    rng.addEventListener('change', () => update(true));
    const txt = el('input', { type: 'text', id: 'ratioText', value: ratioText(v0), 'aria-label': 'Split as a ratio (2:1), percent (67/33) or dB' });
    txt.addEventListener('change', () => { const v = parseRatio(txt.value), ok = v != null && Math.abs(v) <= 10; txt.classList.toggle('invalid', !ok);
      if(ok){ tgt.set(v); update(true); } });
    g(tgt.label,
      el('div', { class: 'row' }, el('span', { id: 'ratioVal', class: 'num' }), el('span', { class: 'hint', id: 'ratioPct' })),
      rng,
      el('div', { class: 'row' }, el('label', { for: 'ratioText', text: 'Enter 2:1, 67/33 or dB' }), txt),
      el('div', { class: 'row' }, ...[[0, '1:1'], [3.0103, '2:1'], [4.7712, '3:1'], [6.0206, '4:1']].map(([v, t]) => el('button', { text: t, on: { click: () => { tgt.set(v); update(true); } } })),
        isTree() && S.tree.ratios[tgt.path] != null ? el('button', { text: 'Auto', title: 'Back to the ratio of the outputs below', on: { click: () => { delete S.tree.ratios[tgt.path]; update(true); } } }) : null));
  }
  if(isTree()) buildTreeSide(g, D);
  // stages
  const canSec = !(S.topology === 'resistive') && !(S.topology === 'tee' && !S.teeXfmr);
  g('Stages',
    canSec ? seg('Sections per arm', 'M', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], 'mSeg') : el('div', { class: 'hint', text: 'Sections: not used by this divider.' }),
    canSec ? seg('Taper', 'taper', [['binomial', 'Binomial'], ['cheby', 'Chebyshev']]) : null,
    canSec && S.taper === 'cheby' && S.M > 1 ? numCtl('Ripple |Γ|max', 'ripple', () => S.rippleDB, v => { S.rippleDB = v; }, -40, -6, 1, 'dB') : null);
  // shapes
  if(S.topology !== 'resistive'){
    const K = maxSections(D);
    const all = S.shapes.slice(0, K).every(x => x === S.shapes[0]) ? S.shapes[0] : null;
    const rows = [segCtl('All sections', () => all, v => { S.shapes = new Array(MAX_SEC).fill(v); }, SHAPES, 'shapeSeg')];
    if(K > 1){
      const per = el('div', { class: 'row persec' }, el('span', { class: 'lbl', text: 'Per section' }));
      for(let k = 0; k < K; k++){ const s = el('select', { 'aria-label': 'Shape of section ' + (k + 1) }); SHAPES.forEach(([v, t]) => s.append(el('option', { value: v, text: (k + 1) + ': ' + t })));
        s.value = S.shapes[k]; s.addEventListener('change', () => { S.shapes[k] = s.value; update(true); }); per.append(s); }
      rows.push(per);
    }
    const used = new Set(S.shapes.slice(0, K));
    if(used.has('arc')) rows.push(numCtl('Arc angle', 'arcDeg', () => S.arcDeg, v => { S.arcDeg = v; }, 60, 300, 10, '°'));
    if(used.has('meander')) rows.push(seg('Turns', 'turns', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]), seg('Bends', 'bend', [['mitre', 'Mitred'], ['round', 'Round']]),
      seg('Gap (× h)', 'gapH', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]));
    g('Section shape (each λ/4)', ...rows, el('div', { class: 'hint', text: 'Length is held at λg/4 along the centreline. Bends and coupling are not in the circuit model.' }));
  }
  // substrate
  g('Substrate and frequency',
    el('div', { class: 'row wrap' }, ...Object.entries(SUBSTRATES).map(([n, [er, h]]) => el('button', { 'aria-pressed': String(S.er === er && S.h === h), text: n,
      on: { click: () => { S.er = er; S.h = h; update(true); } } }))),
    numCtl('εr', 'er', () => S.er, v => { S.er = v; }, 1, 15, 0.01),
    numCtl('h', 'hsub', () => S.h, v => { S.h = v; }, 0.05, 5, 0.01, 'mm'),
    numCtl('f₀', 'f0', () => S.f0 / 1e9, v => { S.f0 = v * 1e9; }, 0.1, 40, 0.01, 'GHz'),
    numCtl('Z₀', 'z0', () => S.z0, v => { S.z0 = v; }, 20, 120, 1, 'Ω'),
    segCtl('Microstrip model', () => S.msModel, v => { S.msModel = v; }, [['pozar', 'Pozar (Wheeler)'], ['hj', 'H–J + K–J']]),
    el('div', { class: 'hint num', id: 'subInfo' }));
  g('Resistors',
    S.topology === 'wilkinson' || isTree() ? chk('Isolation resistors fitted', 'resOn', () => S.resOn, v => { S.resOn = v; }) : null,
    seg('Footprint', 'fp', [['0402', '0402'], ['0603', '0603']]),
    S.topology === 'wilkinson' || isTree() ? numCtl('R scale', 'rMult', () => S.rMult, v => { S.rMult = v; }, 0.1, 5, 0.05, '×') : null);
  // power and loss
  g('Input power and line loss',
    el('div', { class: 'row' }, el('label', { for: 'pin', text: 'Input power' }),
      (() => { const i = el('input', { type: 'number', id: 'pin', value: String(S.pin), step: 'any', 'aria-label': 'Input power' });
        i.addEventListener('change', () => { const v = parseFloat(i.value), ok = isFinite(v) && (S.pinUnit === 'dBm' ? v > -100 && v < 80 : v > 0 && v < 1e5);
          i.classList.toggle('invalid', !ok); if(ok){ S.pin = v; update(true); } }); return i; })(),
      el('div', { class: 'seg' }, ...['W', 'dBm'].map(u => el('button', { text: u, 'aria-pressed': String(S.pinUnit === u), on: { click: () => {
        if(u !== S.pinUnit){ const w = pinW(); S.pinUnit = u; S.pin = u === 'W' ? +w.toPrecision(6) : +dbm(w).toFixed(2); } update(true); } } })))),
    chk('Line loss', 'lossOn', () => S.lossOn, v => { S.lossOn = v; }),
    S.lossOn ? numCtl('Loss', 'lossDb', () => S.lossDb, v => { S.lossDb = v; }, 0, 5, 0.05, 'dB/λg') : null);
  // loads
  g('Output loads', ...loadRows(D), el('div', { class: 'hint', text: 'Γ of each output load (reference Z₀). The energy balance is on the Performance page.' }));
  g('Layout',
    numCtl(isTree() ? 'Min output pitch' : 'Port pitch', 'pitch', () => S.pitch, v => { S.pitch = v; }, 1, 200, 0.5, 'mm'),
    numCtl('Port launch', 'launch', () => S.launch, v => { S.launch = v; }, 0, 50, 0.5, 'mm'),
    numCtl('Minimum W', 'minW', () => S.minW, v => { S.minW = v; }, 0.01, 2, 0.01, 'mm'),
    el('button', { class: 'wide', text: 'Reset everything to defaults', on: { click: () => { const f = freshState(); for(const k in f) S[k] = f[k]; S.sel = ''; update(true); } } }));
  side.append(el('div', { id: 'warnBox', role: 'status', 'aria-live': 'polite' }));
}
function topologyHint(){
  switch(S.topology){
    case 'tee': return 'Lossless T: input matched (with transformers); outputs neither matched nor isolated.';
    case 'resistive': return 'Resistive: every port matched, −6.02 dB per output for N = 2, no isolation.';
    case 'tree': return 'Branching cascade of 2-way junctions. Click a junction (schematic or layout) to set its module and ratio.';
    default: return S.N > 2 ? 'N-way Wilkinson: star of resistors at each section plane (not planar).' : 'Matched at every port, outputs isolated.';
  }
}
function maxSections(D){
  if(!D) return S.M;
  const d = D.design;
  if(d.topology === 'tree') return Math.max(1, ...d.tree.junctions.map(j => j.stage.arms ? Math.max(...j.stage.arms.map(a => a.length)) : 0));
  return d.stage.arms ? Math.max(...d.stage.arms.map(a => a.length)) : 0;
}
function loadRows(D){
  const n = Math.min(nOut(), 16), rows = [];
  S.loads = Array.from({ length: n }, (_, i) => { const L = S.loads[i] || {}; return { g: Math.min(0.95, Math.max(0, +L.g || 0)), deg: isFinite(+L.deg) ? +L.deg : 0 }; });
  const show = n <= 4 ? [...Array(n).keys()] : [...Array(n).keys()].filter(i => S.loads[i].g > 0 || i === 0);
  show.forEach(i => {
    const L = S.loads[i], r = el('input', { type: 'range', min: '0', max: '0.9', step: '0.01', value: String(L.g), id: 'g' + i, 'aria-label': 'P' + (i + 2) + ' |Γ|' });
    const v = el('span', { class: 'num', text: L.g.toFixed(2) });
    r.addEventListener('input', () => { L.g = +r.value; v.textContent = L.g.toFixed(2); update(false); });
    r.addEventListener('change', () => update(true));
    rows.push(el('div', { class: 'row' }, el('label', { for: 'g' + i, text: 'P' + (i + 2) + ' |Γ|' }), r, v));
  });
  if(n > 4){ const s = el('select', { 'aria-label': 'Add a mismatched output' }); s.append(el('option', { value: '', text: 'Mismatch another output…' }));
    for(let i = 1; i < n; i++) if(!show.includes(i)) s.append(el('option', { value: String(i), text: 'P' + (i + 2) }));
    s.addEventListener('change', () => { if(s.value){ S.loads[+s.value].g = 0.5; update(true); } }); rows.push(s); }
  const ang = el('input', { type: 'range', min: '-180', max: '180', step: '5', value: String(S.loads[0] ? S.loads[0].deg : 0), id: 'gAng', 'aria-label': 'Angle of every load Γ' });
  ang.addEventListener('input', () => { S.loads.forEach(L => { L.deg = +ang.value; }); update(false); });
  rows.push(el('div', { class: 'row' }, el('label', { for: 'gAng', text: '∠Γ (all)' }), ang, el('span', { class: 'num', text: (S.loads[0] ? S.loads[0].deg : 0) + '°' })),
    el('div', { class: 'row' }, el('button', { text: 'All matched', on: { click: () => { S.loads.forEach(L => { L.g = 0; }); update(true); } } })));
  return rows;
}
function buildTreeSide(g, D){
  const T = S.tree, tr = D && D.design.tree, depth = tr ? tr.maxDepth : 2;
  const lvl = [];
  for(let l = 0; l < depth; l++){
    const s = el('select', { 'aria-label': 'Module of level ' + (l + 1) });
    [['', 'Tree default'], ['wilk', 'Wilkinson'], ['branch', 'Branching line'], ['resY', 'Resistive Y']].forEach(([v, t]) => s.append(el('option', { value: v, text: t })));
    s.value = T.levelMods[l] || ''; s.addEventListener('change', () => { T.levelMods[l] = s.value || undefined; update(true); });
    lvl.push(el('div', { class: 'row' }, el('span', { class: 'lbl', text: 'Level ' + (l + 1) }), s));
  }
  const nd = tr && tr.junctions.find(j => j.path === (S.sel || ''));
  g('Tree',
    segCtl('Layout', () => T.layout, v => { T.layout = v; }, [['binary', 'Binary'], ['H', 'H-tree']]),
    T.layout === 'H' && (T.N & (T.N - 1)) ? el('div', { class: 'warnline', text: 'H-tree needs N = 2, 4, 8 or 16: drawn as a binary tree.' }) : null,
    segCtl('Module (all)', () => T.module, v => { T.module = v; T.levelMods = []; T.mods = {}; }, [['wilk', 'Wilkinson'], ['branch', 'Branching'], ['resY', 'Resistive Y']]),
    ...lvl,
    segCtl('Output taper', () => T.amp, v => { T.amp = v; T.ratios = {}; }, [['uniform', 'Uniform'], ['cosine', 'Cosine on pedestal']]),
    T.amp === 'cosine' ? numCtl('Edge level', 'edgeDB', () => T.edgeDB, v => { T.edgeDB = v; }, -30, 0, 0.5, 'dB') : null,
    chk('Equal path lengths (delay lines)', 'eqOn', () => T.equalise, v => { T.equalise = v; }),
    numCtl('Path error on P2', 'pathErr', () => T.pathErr, v => { T.pathErr = v; }, 0, 100, 0.5, 'mm'),
    nd ? el('div', { class: 'junction-box' },
      el('div', { class: 'row' }, el('b', { text: 'Junction ' + (nd.path || 'root') }), el('span', { class: 'hint', text: nd.n + ' outputs below: ' + Math.floor(nd.n / 2) + ' : ' + Math.ceil(nd.n / 2) })),
      segCtl('Module', () => T.mods[nd.path] || '', v => { if(v) T.mods[nd.path] = v; else delete T.mods[nd.path]; },
        [['', 'Level'], ['wilk', 'Wilkinson'], ['branch', 'Branching'], ['resY', 'Res. Y']]),
      nd.module === 'resY' && Math.abs(nd.stage.asked) > 1e-6 ? el('div', { class: 'warnline', text: 'A resistive Y splits 1:1 only (asked ' + ratioText(nd.stage.asked) + ').' }) : null)
      : el('div', { class: 'hint', text: 'Click a junction to edit it.' }));
}
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. LAYOUT VIEW ────────────────────────────────────────────
let prevIds = new Set(), prevKey = '';
const tfAttr = tf => tf && (tf.x || tf.y || tf.q) ? `translate(${tf.x.toFixed(4)} ${tf.y.toFixed(4)}) rotate(${tf.q * 90})` : null;
const grpOf = id => id.startsWith('ic') ? 'j' + id.slice(2, -1) : id.startsWith('j') ? id.split('.')[0] : null;
/* Draw one layout into group gRoot shifted by dy; returns nothing. k = px per mm (for hairlines and text). */
// Label boxes already placed (mm): place(box) is true and keeps the box if it overlaps none of them.
function labelSpace(){ const boxes = []; return { boxes, place(b){ if(boxes.some(o => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1)) return false; boxes.push(b); return true; } }; }
function drawOneLayout(gRoot, L, D, k, dy, opts){
  opts.labels = opts.labels || labelSpace();
  const fs = 12 / k, root = svgEl('g', { transform: dy ? `translate(0 ${dy.toFixed(4)})` : null }); gRoot.append(root);
  const bb = L.bbox, mx = Math.max(3, bb.w * 0.03);
  root.append(svgEl('rect', { class: 'board', x: bb.x0 - mx, y: bb.y0 - mx, width: bb.w + 2 * mx, height: bb.h + 2 * mx, rx: 1, 'stroke-width': 1 / k }));
  root.append(svgEl('rect', { class: 'fpbox', 'data-fp': opts.main ? 'main' : 'ref', x: bb.x0, y: bb.y0, width: bb.w, height: bb.h, 'stroke-width': 1 / k, 'stroke-dasharray': (4 / k) + ' ' + (3 / k) }));
  const cu = svgEl('g', { class: 'copper' }); root.append(cu);
  const ids = new Set(), grow = opts.main && prevKey === opts.key;
  for(const e of L.els){
    const grp = grpOf(e.id);
    const g = svgEl('g', { class: 'el' + (e.warn && e.warn.length ? ' warned' : ''),
      'data-id': opts.main ? e.id : null, 'data-grp': opts.main ? grp : null, transform: tfAttr(e.tf) });
    if(e.warn && e.warn.length) g.append(svgEl('path', { class: 'halo', d: e.path.d, 'stroke-width': e.W + 5 / k }));
    if(e.outline) g.append(svgEl('polygon', { class: 'cu', points: ptsAttr(e.outline) }));
    else g.append(svgEl('path', { class: 'cu cus', d: e.path.d, 'stroke-width': e.W }));
    if(opts.main) g.append(svgEl('path', { class: 'hit cl', d: e.path.d, 'stroke-width': Math.max(e.W, 8 / k), 'data-len': e.path.len.toFixed(4), 'data-w': e.W.toFixed(4) }));
    if(opts.main){ ids.add(e.id); if(grow && !prevIds.has(e.id)) g.classList.add('grow'); }
    cu.append(g);
  }
  const showRLabels = L.res.length <= 12 && k > 6;
  for(const r of L.res){
    const fp = r.fp, Lr = dist(r.a, r.b), ang = Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x) * DEG, m = P((r.a.x + r.b.x) / 2, (r.a.y + r.b.y) / 2);
    const g = svgEl('g', { class: 'el res', 'data-id': opts.main ? r.id : null, 'data-grp': opts.main ? grpOf(r.id) : null, transform: tfAttr(r.tf) });
    const inner = svgEl('g', { transform: `translate(${m.x.toFixed(4)} ${m.y.toFixed(4)}) rotate(${ang.toFixed(3)})` }); g.append(inner);
    const pe = fp.gap / 2 + fp.padL;
    if(Lr / 2 > pe){ inner.append(svgEl('rect', { class: 'cu', x: -Lr / 2, y: -fp.padW / 4, width: Lr / 2 - pe, height: fp.padW / 2 }), svgEl('rect', { class: 'cu', x: pe, y: -fp.padW / 4, width: Lr / 2 - pe, height: fp.padW / 2 })); }
    inner.append(svgEl('rect', { class: 'pad', x: -pe, y: -fp.padW / 2, width: fp.padL, height: fp.padW }), svgEl('rect', { class: 'pad', x: fp.gap / 2, y: -fp.padW / 2, width: fp.padL, height: fp.padW }));
    inner.append(svgEl('rect', { class: 'rbody', x: -fp.bodyL / 2, y: -fp.bodyW / 2, width: fp.bodyL, height: fp.bodyW, rx: fp.bodyW * 0.1 }));
    if(opts.main) inner.append(svgEl('rect', { class: 'hit', x: -Math.max(Lr, 2 * pe) / 2, y: -Math.max(fp.padW, 8 / k) / 2, width: Math.max(Lr, 2 * pe), height: Math.max(fp.padW, 8 / k), fill: 'transparent' }));
    if(opts.main){ ids.add(r.id); if(grow && !prevIds.has(r.id)) g.classList.add('grow'); }
    cu.append(g);
    if(showRLabels){ const q = applyTf(r.tf || TF0, m), vert = Math.abs(Math.cos(ang / DEG + (r.tf ? r.tf.q : 0) * Math.PI / 2)) < 0.5, t = r.R.toFixed(1) + ' Ω';
      const x = q.x + (vert ? fp.padW / 2 + 3 / k : 0), y = q.y + (vert ? fs * 0.35 : -fp.padW / 2 - 3 / k), w = t.length * fs * 0.62;
      const box = { x0: vert ? x : x - w / 2, x1: vert ? x + w : x + w / 2, y0: y - fs * 0.8, y1: y + fs * 0.2 };
      if(opts.labels.place(box)) root.append(svgEl('text', { class: 'rlab', x, y, 'font-size': fs, 'text-anchor': vert ? 'start' : 'middle', 'stroke-width': 3 / k }, t)); }
  }
  (L.labels || []).forEach(b => { if(b.kind !== 'bridge') return; const p0 = applyTf(b.tf || TF0, b.pts[0]), p1 = applyTf(b.tf || TF0, b.pts[1]);
    root.append(svgEl('line', { class: 'bridge', x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, 'stroke-width': 1.5 / k, 'stroke-dasharray': (3 / k) + ' ' + (2 / k) }));
    root.append(svgEl('circle', { cx: (p0.x + p1.x) / 2, cy: (p0.y + p1.y) / 2, r: 2.5 / k, class: 'bridgedot' })); });
  if(opts.title) root.append(svgEl('text', { x: bb.x0, y: bb.y0 - mx - 4 / k, 'font-size': fs, 'font-weight': 600 }, opts.title));
  if(opts.main && isTree() && S.sel != null){
    const sel = 'j' + S.sel, pts = [];
    L.els.forEach(e => { if(grpOf(e.id) === sel && e.role !== 'ic') pts.push(...copperPoints(e)); }); L.res.forEach(r => { if(grpOf(r.id) === sel) pts.push(...resistorPoints(r)); });
    if(pts.length){ const xs = pts.map(p => p.x), ys = pts.map(p => p.y), pad = 4 / k;
      root.append(svgEl('rect', { class: 'selbox', x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + 2 * pad, height: Math.max(...ys) - Math.min(...ys) + 2 * pad,
        'stroke-width': 2 / k, 'stroke-dasharray': (6 / k) + ' ' + (3 / k), rx: 2 / k })); }
  }
  return ids;
}
function drawLayout(D){
  const svg = $('layout'), W = svg.clientWidth, H = svg.clientHeight;
  if(W <= 0 || H <= 0) return;
  const L = D.lay, both = S.compare && D.ref !== D.lay, R = both ? D.ref : null;
  const bb = L.bbox, rb = R ? R.bbox : null;
  const gap = both ? Math.max(bb.h, rb.h) * 0.25 + 6 : 0;
  const top = rb ? rb.y0 : bb.y0, totH = (rb ? rb.h + gap : 0) + bb.h, minX = Math.min(bb.x0, rb ? rb.x0 : Infinity), maxX = Math.max(bb.x1, rb ? rb.x1 : -Infinity);
  const totW = maxX - minX, padPx = 70;
  const k = Math.max(1e-6, Math.min((W - 2 * padPx - 120) / (totW * 1.06 + 6), (H - 2 * padPx) / (totH * 1.06 + 6)));
  const vw = W / k, vh = H / k, mx0 = (minX + maxX) / 2, my0 = top + totH / 2;
  svg.setAttribute('viewBox', [mx0 - vw / 2, my0 - vh / 2 + 6 / k, vw, vh].map(v => v.toFixed(4)).join(' '));
  svg.dataset.scale = k.toFixed(6);
  svg.replaceChildren();
  const g = svgEl('g'); svg.append(g);
  const fs = 12 / k;
  let dyMain = 0;
  if(R){ drawOneLayout(g, R, D, k, 0, { title: 'Straight (reference), ' + rb.w.toFixed(1) + ' × ' + rb.h.toFixed(1) + ' mm' }); dyMain = rb.y1 - bb.y0 + gap; }
  const key = S.topology + '|' + nOut() + '|' + S.tree.layout;
  const labels = labelSpace();
  const ids = drawOneLayout(g, L, D, k, dyMain, { main: true, key, labels, title: both ? 'Folded, ' + bb.w.toFixed(1) + ' × ' + bb.h.toFixed(1) + ' mm' : null });
  prevIds = ids; prevKey = key;
  const main = g.lastChild;
  // ports with their solved power
  const pin = pinW();
  L.ports.forEach(p => {
    const left = p.i === 0, d = p.dir % 4, w = left ? pin : pin * D.L0.pLoad[p.i - 1];
    const off = (S.overlay ? (left ? 70 : 40) : 4) / k, anchor = d === 2 ? 'end' : d === 0 ? 'start' : 'middle';
    const x = p.at.x + (d === 0 ? off : d === 2 ? -off : 0), y = p.at.y + (d === 1 ? off + fs : d === 3 ? -off : fs * 0.35);
    // the full label, else a short one, else the name only; nothing when even the name would overlap
    const texts = left ? [p.name + '  ' + fmtW(pin) + ' in', p.name] : [p.name + '  ' + fmtW(w) + ' · ' + fmt(dbm(w), 1) + ' dBm', p.name + ' ' + fmtW(w), p.name];
    for(const t of texts){
      const tw = t.length * fs * 0.62, bx = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
      if(labels.place({ x0: bx, x1: bx + tw, y0: y - fs * 0.85, y1: y + fs * 0.25 })){
        main.append(svgEl('text', { class: 'plab', x, y, 'font-size': fs, 'text-anchor': anchor, 'font-weight': 600, 'data-port': p.i, 'stroke-width': 3 / k }, t)); break; }
    }
  });
  if(S.overlay) drawFlowOverlay(main, D, k);
  // scale bar and footprint
  const target = bb.w / 5, pow = 10 ** Math.floor(Math.log10(target)), bar = [1, 2, 5, 10].map(m => m * pow).filter(v => v <= target).pop() || pow;
  const bx = bb.x0, by = bb.y1 + Math.max(3, bb.w * 0.03) + 10 / k;
  main.append(svgEl('path', { id: 'scaleBar', d: `M${bx} ${by - 3 / k} V${by} H${bx + bar} V${by - 3 / k}`, fill: 'none', stroke: 'var(--txt)', 'stroke-width': 1.5 / k, 'data-mm': bar }));
  main.append(svgEl('text', { x: bx + bar + 5 / k, y: by + fs * 0.3, 'font-size': fs }, bar + ' mm'));
  const sv = (1 - bb.area / D.ref.bbox.area) * 100;
  $('layoutInfo').textContent = `footprint ${bb.w.toFixed(1)} × ${bb.h.toFixed(1)} mm = ${bb.area.toFixed(0)} mm²` + (D.ref !== D.lay ? ` · ${sv >= 0 ? 'saves' : 'adds'} ${Math.abs(sv).toFixed(0)} % vs straight` : '') +
    ` · trace ${L.totals.all.toFixed(1)} mm`;
  wireHover(svg, D);
  svg.querySelectorAll('[data-grp]').forEach(n => n.addEventListener('click', () => { const gname = n.dataset.grp; if(gname && isTree()){ S.sel = gname.slice(1); update(true); } }));
}
// Power-flow overlay: an arrow into P1 and out of each output, width ∝ power; reflected power back out of P1 (amber); a
// disc on each resistor, area ∝ the power it absorbs (purple).
function drawFlowOverlay(main, D, k){
  const L = D.lay, Ld = D.L0, wmax = 22 / k, len = 26 / k;
  const arrow = (p, dir, frac, cls, out) => {
    if(frac < 1e-4) return;
    const w = Math.max(1.5 / k, wmax * frac), u = rotQ(P(1, 0), dir), n = rotQ(P(0, 1), dir);
    const base = P(p.x + u.x * (out ? 6 / k : 6 / k + len), p.y + u.y * (out ? 6 / k : 6 / k + len)), s = out ? 1 : -1;
    const tip = P(base.x + u.x * len * s, base.y + u.y * len * s), hw = w / 2, hl = Math.min(len * 0.45, w * 1.2 + 4 / k);
    const back = P(tip.x - u.x * hl * s, tip.y - u.y * hl * s);
    const pts = [P(base.x + n.x * hw, base.y + n.y * hw), P(back.x + n.x * hw, back.y + n.y * hw), P(back.x + n.x * (hw + 3 / k), back.y + n.y * (hw + 3 / k)), tip,
      P(back.x - n.x * (hw + 3 / k), back.y - n.y * (hw + 3 / k)), P(back.x - n.x * hw, back.y - n.y * hw), P(base.x - n.x * hw, base.y - n.y * hw)];
    main.append(svgEl('polygon', { class: 'flow ' + cls, points: ptsAttr(pts) }));
  };
  L.ports.forEach(p => {
    if(p.i === 0){ const hIn = wmax / 2, hR = Math.max(1.5 / k, wmax * Ld.pRefl) / 2;
      arrow(P(p.at.x - len - 12 / k, p.at.y - hIn - 2 / k), 0, 1, 'f-in', true);                 // incident: into P1, above the line
      arrow(P(p.at.x - 6 / k, p.at.y + hR + 5 / k), 2, Ld.pRefl, 'f-refl', true); }             // reflected: out of P1, below it
    else arrow(p.at, p.dir, Ld.pLoad[p.i - 1], 'f-out', true);
  });
  D.net.res.forEach((r, i) => {
    const pr = Ld.pResEach[i]; if(!(pr > 1e-5)) return;
    const lr = L.res.find(x => x.id === r.id) || L.res.find(x => r.id.startsWith(x.id)); if(!lr) return;
    const m = applyTf(lr.tf || TF0, P((lr.a.x + lr.b.x) / 2, (lr.a.y + lr.b.y) / 2));
    main.append(svgEl('circle', { class: 'flow f-res', cx: m.x, cy: m.y, r: Math.max(2 / k, wmax * Math.sqrt(pr)) }));
  });
}
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. HOVER ──────────────────────────────────────────────────
function findEl(D, id){ return D.lay.els.find(x => x.id === id) || D.lay.res.find(x => x.id === id); }
function elInfo(D, id){
  if(/^j[LR]*$/.test(id) && isTree()){
    const nd = D.design.tree.junctions.find(j => 'j' + j.path === id); if(!nd) return '';
    const st = nd.stage;
    return `<b>Junction ${nd.path || 'root'}</b> · ${MODULE_NAME[nd.module]}<br>split ${ratioText(st.ratioDB)} (${fmt(st.ratioDB, 2)} dB)${nd.edited ? ', set by hand' : ', auto'}<br>` +
      (st.arms ? 'arms ' + st.arms.map(a => a.map(s => s.Z.toFixed(1)).join('→')).join(' | ') + ' Ω<br>' : '') +
      (st.res ? 'R ' + st.res.filter(r => r != null).map(r => (r * S.rMult).toFixed(1)).join(' / ') + ' Ω' : 'R ' + st.R.toFixed(1) + ' Ω ×3');
  }
  const r = D.lay.res.find(x => x.id === id);
  if(r){ const i = D.net.res.findIndex(x => x.id === id || x.id.startsWith(id + '.')); const p = i >= 0 ? D.L0.pResEach[i] : 0;
    return `<b>Resistor</b> ${id}<br>R = ${r.R.toFixed(1)} Ω, ${S.fp}<br>absorbs ${(p * 100).toFixed(2)} % of the input (${fmtW(p * pinW())})`; }
  const e = findEl(D, id); if(!e) return '';
  const role = { arm: 'λ/4 arm section', xfmr: 'λ/4 transformer section', eq: 'λ/4 phase-equalising line', launch: 'Port launch (z₀, drawn, not modelled)',
    junction: 'Junction (drawn, not modelled)', ic: 'Interconnect (z₀, modelled)', out: 'Output line (z₀, modelled)', pad: 'Pad (drawn, not modelled)' }[e.role] || e.role;
  let s = `<b>${role}</b>` + (e.arm != null ? ` · arm ${e.arm + 1}, section ${e.k + 1}` : '') + `<br>${id}<br>`;
  if(e.Z) s += `Z = ${e.Z.toFixed(1)} Ω · W = ${e.W.toFixed(3)} mm<br>`; else s += `W = ${e.W.toFixed(3)} mm<br>`;
  s += `centreline ${e.path.len.toFixed(2)} mm` + (e.lenTarget ? ` (λg/4 = ${e.lenTarget.toFixed(2)} mm, ε_eff = ${e.eeff.toFixed(3)})` : '') + '<br>';
  if(e.delay > 1e-3) s += `delay line ${e.delay.toFixed(2)} mm (${e.delayN} period${e.delayN > 1 ? 's' : ''})<br>`;
  if(e.shape && e.shape !== 'straight') s += shapeSpec(e) + '<br>';
  (e.warn || []).forEach(w => { s += `<span class="bad">⚠ ${w}</span><br>`; });
  return s;
}
function shapeSpec(e){
  const p = e.spec || {};
  if(e.shape === 'arc') return `arc r = ${p.r.toFixed(2)} mm, ${(p.phi * DEG).toFixed(0)}°`;
  if(e.shape === 'meander') return `meander ${p.turns} turn${p.turns > 1 ? 's' : ''}, fold ${p.A.toFixed(2)} mm, gap ${p.gap.toFixed(2)} mm, ${p.bend === 'round' ? 'round bends r ' + (p.pitch / 2).toFixed(2) + ' mm' : 'mitred bends'}`;
  if(e.shape === 'mitred') return `bracket rise ${p.rise.toFixed(2)} mm, run ${p.run.toFixed(2)} mm, optimum mitre`;
  if(p.bump) return `straight + ${p.bump.toFixed(2)} mm bump (length match)`;
  return 'straight';
}
function wireHover(root, D){
  const tip = $('tip');
  root.querySelectorAll('[data-id]').forEach(g => {
    g.addEventListener('mouseenter', () => { highlight(g.dataset.id, g.dataset.grp, true); const h = elInfo(D, g.dataset.id); if(h){ tip.innerHTML = h; tip.style.display = 'block'; } });
    g.addEventListener('mousemove', ev => { const r = $('pg_designer').getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - tw - 8) + 'px'; tip.style.top = Math.min(ev.clientY - r.top + 14, r.height - th - 8) + 'px'; });
    g.addEventListener('mouseleave', () => { highlight(g.dataset.id, g.dataset.grp, false); tip.style.display = 'none'; });
  });
}
function highlight(id, grp, on){
  const q = '[data-id="' + id + '"],[data-grp="' + id + '"]' + (grp ? ',[data-id="' + grp + '"]' : '');
  document.querySelectorAll(q).forEach(n => n.classList.toggle('hl', on));
}
// ── END 3 ─────────────────────────────────────────────────────

// ── 4. OUTPUTS ────────────────────────────────────────────────
function phaseImbalance(S0, n){
  const ph = []; for(let i = 1; i <= n; i++) ph.push(carg(mget(S0, i, 0)) * DEG);
  const ref = ph[0], d = ph.map(p => wrap180(p - ref));
  return { ph, spread: Math.max(...d) - Math.min(...d) };
}
function drawOutputs(D){
  const n = D.net.ports.length - 1, pin = pinW(), Ld = D.L0, imb = phaseImbalance(D.S0, n);
  const rows = [];
  for(let i = 0; i < n; i++){
    const w = pin * Ld.pLoad[i], wi = pin * D.ideal[i];
    rows.push(`<tr data-port="${i + 1}"><td>P${i + 2}</td><td>${fmtW(w)}</td><td>${fmt(dbm(w), 2)}</td><td>${(Ld.pLoad[i] * 100).toFixed(2)}</td><td>${fmtDb(10 * Math.log10(Math.max(Ld.pLoad[i], 1e-15)))}</td>` +
      `<td class="mut">${fmtW(wi)}</td><td class="mut">${(D.ideal[i] * 100).toFixed(2)}</td><td>${fmt(carg(mget(D.S0, i + 1, 0)) * DEG, 1)}</td></tr>`);
  }
  const tot = Ld.pDeliv, bw = D.bw, use = bw && bw.usable;
  const s11 = dB20(cabs(mget(D.S0, 0, 0)));
  let worstJ = -Infinity, worstIso = -Infinity;
  for(let i = 1; i <= n; i++){ worstJ = Math.max(worstJ, dB20(cabs(mget(D.S0, i, i)))); for(let j = i + 1; j <= n; j++) worstIso = Math.max(worstIso, dB20(cabs(mget(D.S0, i, j)))); }
  const idealLoss = n > 0 ? 10 * Math.log10(n) : 0, mean = 10 * Math.log10(Math.max(tot, 1e-15) / n);
  const kv = (k, v, cls) => `<div class="kv"><span>${k}</span><b class="num ${cls || ''}">${v}</b></div>`;
  let html = `<h4>Outputs at f₀ <span class="hint">(${fmtW(pin)} in; solved, with ideal beside)</span></h4>
    <table class="sheet outs"><thead><tr><th>Port</th><th>Power</th><th>dBm</th><th>% in</th><th>dB re in</th><th>ideal</th><th>ideal %</th><th>∠S<sub>i1</sub> (°)</th></tr></thead><tbody>${rows.join('')}</tbody>
    <tfoot><tr><td>Σ</td><td>${fmtW(tot * pin)}</td><td></td><td>${(tot * 100).toFixed(2)}</td><td></td><td class="mut">${fmtW(pin)}</td><td class="mut">100</td><td></td></tr></tfoot></table>
    <div class="kvs">` +
    kv('S11 at f₀', fmtDb(s11, 1) + ' dB', s11 > -15 ? 'bad' : '') + kv('worst output match', fmtDb(worstJ, 1) + ' dB', worstJ > -15 ? 'bad' : '') +
    (n > 1 ? kv('worst isolation', fmtDb(worstIso, 1) + ' dB', worstIso > -15 ? 'bad' : '') : '') +
    kv('phase P2…P' + (n + 1), `∠S21 ${fmt(imb.ph[0], 1)}°` + (n > 1 ? `, ∠S31 ${fmt(imb.ph[1], 1)}°, imbalance ${imb.spread.toFixed(2)}°` : ''), imb.spread > 5 ? 'bad' : '') +
    kv('usable −15 dB bandwidth', use && use.bw ? (use.bw.frac * 100).toFixed(1) + ' % (' + use.label + ')' : 'none: ' + (use ? use.label : '') + ' above −15 dB at f₀', !use || !use.bw ? 'bad' : '') +
    kv('ideal split 10·log₁₀N', idealLoss.toFixed(2) + ' dB; actual mean ' + fmt(-mean, 2) + ' dB below input') +
    kv('reflected · resistors · lines', `${(Ld.pRefl * 100).toFixed(2)} % · ${(Ld.pRes * 100).toFixed(2)} % · ${(Ld.pLine * 100).toFixed(2)} %`) +
    kv('resistors', resistorCount(D.design) + (D.design.stage && D.design.stage.res ? ' · ' + D.design.stage.res.filter(r => r != null).map(r => (r * S.rMult).toFixed(1)).join(' / ') + ' Ω' : '')) +
    `</div>`;
  if(isTree()) html += treeLossTable(D);
  $('outputs').innerHTML = html;
}
/* Interstage line loss by level (sections of the junctions at that depth, and the interconnects leaving them, then the
   output lines): grows with depth when line loss is on. */
function treeLossTable(D){
  const tr = D.design.tree, by = new Array(tr.maxDepth + 1).fill(0);
  D.net.lines.forEach((ln, i) => { const id = ln.id; let lv;
    if(id.startsWith('o')) lv = tr.maxDepth; else if(id.startsWith('ic')) lv = id.length - 3; else lv = id.split('.')[0].length - 1;
    by[Math.min(lv, tr.maxDepth)] += D.L0.pLineEach[i]; });
  const head = by.map((v, i) => `<th>${i < tr.maxDepth ? 'level ' + (i + 1) : 'outputs'}</th>`).join(''), cells = by.map(v => `<td>${(v * 100).toFixed(3)}</td>`).join('');
  return `<h4 style="margin-top:6px">Line loss by level <span class="hint">(% of input${S.lossOn ? '' : '; line loss off'})</span></h4><table class="sheet"><thead><tr>${head}</tr></thead><tbody><tr>${cells}</tr></tbody></table>`;
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. WIDTH VS RATIO ─────────────────────────────────────────
function drawRatioPlot(D){
  const box = $('ratioPlot'), tgt = splitTarget(D);
  const module = isTree() ? (tgt.nd ? tgt.nd.module : 'wilk') : S.topology === 'tee' ? 'branch' : 'wilk';
  if(!tgt.enabled || module === 'resY' || (!isTree() && (S.N !== 2 || S.topology === 'resistive'))){
    box.innerHTML = `<h4>Arm width vs ratio</h4><p class="hint">Shown for a 2-way Wilkinson or branching-line split (the divider, or the selected tree junction).</p>`; return; }
  const w = Math.max(240, box.clientWidth - 24), h = Math.max(130, box.clientHeight - 48), ms = msFactory(), pts = [];
  for(let i = 0; i <= 60; i++){
    const r = 1 + 5 * i / 60, st = module === 'branch' ? teeStage(S.z0, 2, 10 * Math.log10(r), 1, 'binomial', 0, true) : wilkinsonStage(S.z0, 10 * Math.log10(r), 1, 'binomial', 0, false);
    const a = st.arms;
    pts.push({ r, w2: ms(a[0][0].Z).W, w3: ms(a[1][0].Z).W, t2: a[0][1] ? ms(a[0][1].Z).W : null, t3: a[1][1] ? ms(a[1][1].Z).W : null });
  }
  const ymax = Math.max(1, Math.ceil(Math.max(...pts.map(p => Math.max(p.w2, p.t2 || 0))) * 1.08));
  const pl = 44, pb = 22, pt = 8, pr = 62, X = r => pl + (w - pl - pr) * (r - 1) / 5, Y = v => pt + (h - pt - pb) * (1 - v / ymax);
  const line = (key, col, dash) => pts[0][key] == null ? '' : `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + X(p.r).toFixed(1) + ' ' + Y(p[key]).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  let s = `<svg width="${w}" height="${h}" role="img" aria-label="Arm widths versus power ratio">`;
  const step = ymax > 8 ? 2 : ymax > 3 ? 1 : 0.5;
  for(let v = 0; v <= ymax + 1e-9; v += step) s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end">${v}</text>`;
  for(let r = 1; r <= 6; r++) s += `<text x="${X(r)}" y="${h - 6}" font-size="11" text-anchor="middle">${r}:1</text>`;
  s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(S.minW)}" y2="${Y(S.minW)}" stroke="var(--bad)" stroke-dasharray="3 3"/><text x="${X(1.08)}" y="${Y(S.minW) - 4}" font-size="11" fill="var(--bad)">min W ${S.minW} mm</text>`;
  s += line('w2', 'var(--s21)') + line('w3', 'var(--s31)') + line('t2', 'var(--s21)', 1) + line('t3', 'var(--s31)', 1);
  const last = pts[pts.length - 1];
  s += `<text x="${w - pr + 4}" y="${Y(last.w2) + 4}" font-size="11" fill="var(--s21)">high arm</text><text x="${w - pr + 4}" y="${Math.min(h - pb - 2, Y(last.w3) + 4)}" font-size="11" fill="var(--s31)">low arm</text>`;
  const rr = 10 ** (Math.abs(tgt.get()) / 10);
  if(rr <= 6) s += `<line x1="${X(rr)}" x2="${X(rr)}" y1="${pt}" y2="${h - pb}" stroke="var(--txt)" stroke-width="1.5"/><text x="${X(rr) + 4}" y="${pt + 10}" font-size="11">${ratioText(Math.abs(tgt.get()))}</text>`;
  s += `<text x="12" y="${(pt + h - pb) / 2}" font-size="11" fill="var(--mut)" transform="rotate(-90 12 ${(pt + h - pb) / 2})" text-anchor="middle">W (mm)</text></svg>`;
  box.innerHTML = `<h4>Arm width vs ratio <span class="hint">(${module === 'branch' ? 'branching line' : 'Wilkinson'}, one section; solid arms, dashed output transformers)</span></h4>` + s;
}
// ── END 5 ─────────────────────────────────────────────────────
