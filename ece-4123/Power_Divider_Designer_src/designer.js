/* Power Divider Designer — Designer page: controls, the to-scale layout (the centrepiece), the width-versus-ratio plot
   and the design-parameter sheet.
   ============================================================
   TABLE OF CONTENTS
   1. State            — design parameters, persistence
   2. Derived design   — synthesis, microstrip per section, layout, S at f0
   3. Controls         — sidebar builders and wiring (ratio slider + ratio / percent entry)
   4. Layout view      — SVG at true scale: board, copper, resistor pads, ports and powers, scale bar, hover
   5. Width vs ratio   — the two arm widths (and transformers) from 1:1 to 6:1, current ratio marked
   6. Parameter sheet  — one row per element, substrate block, totals
   ============================================================ */

// ── 1. STATE ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SUBSTRATES = { 'FR-4': [4.4, 1.6], 'RO4003C': [3.55, 0.508], 'RT/duroid 5880': [2.2, 0.787], 'RO3010': [10.2, 0.635] };
const DEFAULTS = { topology: 'wilkinson', N: 2, ratioDB: 0, M: 1, taper: 'binomial', rippleDB: -20, z0: 50, f0: 2.4e9,
  er: 4.4, h: 1.6, msModel: 'pozar', shape: 'straight', turns: 2, gapH: 3, bend: 'mitre', arcDeg: 180,
  fp: '0603', launch: 5, pitch: 15, minW: 0.15, pinW: 1, resOn: true, rMult: 1 };
const LS_KEY = 'pdd.state.v2';
const S = (() => { try { const j = JSON.parse(localStorage.getItem(LS_KEY)); if(j && typeof j === 'object') return Object.assign({}, DEFAULTS, j); } catch(e){ /* storage blocked */ }
  return Object.assign({}, DEFAULTS); })();
function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){ /* storage blocked */ } }
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. DERIVED DESIGN ─────────────────────────────────────────
const fmt = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const dbm = w => 10 * Math.log10(w * 1000);
function synthParams(){ return { topology: S.topology, N: S.N, ratioDB: S.ratioDB, M: S.M, taper: S.taper, gm: 10 ** (S.rippleDB / 20), z0: S.z0 }; }
const msFor = () => { const cache = new Map(); return Z => { const k = Z.toFixed(6); if(!cache.has(k)) cache.set(k, microstrip(Z, S.er, S.h, S.f0, S.msModel)); return cache.get(k); }; };
function layoutFor(stage, shape){
  return layoutTwoArm({ stage, ms: msFor(), z0: S.z0, h: S.h, shapes: [shape], fp: S.fp, launch: S.launch, pitch: S.pitch, minW: S.minW, pfx: 'x',
    shapeOpt: { phi: S.arcDeg / DEG, turns: S.turns, gap: S.gapH * S.h, bend: S.bend }, resOn: S.resOn, rMult: S.rMult });
}
function derive(){
  const design = synthesize(synthParams());
  const lay = layoutFor(design.stage, S.shape);
  const ref = S.shape === 'straight' ? lay : layoutFor(design.stage, 'straight');
  const net = buildNetwork(design, { z0: S.z0, resOn: S.resOn, rMult: S.rMult });
  const S0 = solveS(net, 1, 0), L = solveLoaded(net, 1, 0, []);
  return { design, lay, ref, net, S0, L };
}
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. CONTROLS ───────────────────────────────────────────────
function el(tag, attrs, ...kids){ const e = document.createElement(tag); for(const k in attrs || {}){ if(k === 'on') for(const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if(k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } kids.forEach(c => e.append(c)); return e; }
function seg(label, key, opts, after){
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  opts.forEach(([v, t]) => box.append(el('button', { 'aria-pressed': String(S[key] === v), 'data-k': key, 'data-v': String(v), text: t,
    on: { click: () => { S[key] = v; if(after) after(); update(true); } } })));
  return el('div', { class: 'row' }, el('label', { text: label }), box);
}
// Ratio text: "2:1", "67/33" (percent), or a dB value; returns dB (P2/P3) or null.
function parseRatio(t){
  t = String(t).trim().replace(/\s+/g, '');
  let m = t.match(/^(\d*\.?\d+):(\d*\.?\d+)$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^(\d*\.?\d+)%?\/(\d*\.?\d+)%?$/); if(m && +m[1] > 0 && +m[2] > 0) return 10 * Math.log10(+m[1] / +m[2]);
  m = t.match(/^(-?\d*\.?\d+)(dB)?$/i); if(m) return +m[1];
  return null;
}
const ratioText = dB => { const r = 10 ** (dB / 10); return r >= 1 ? r.toFixed(2).replace(/\.?0+$/, '') + ':1' : '1:' + (1 / r).toFixed(2).replace(/\.?0+$/, ''); };
function buildSide(){
  const side = $('side'); side.replaceChildren();
  const g = (title, ...rows) => side.append(el('section', { class: 'grp' }, el('h3', { text: title }), ...rows));
  // power split
  const rng = el('input', { type: 'range', id: 'ratioSlider', min: '-10', max: '10', step: '0.05', value: String(S.ratioDB), 'aria-label': 'Split P2:P3 in dB' });
  rng.addEventListener('input', () => { S.ratioDB = +rng.value; update(false); });
  const txt = el('input', { type: 'text', id: 'ratioText', value: ratioText(S.ratioDB), 'aria-label': 'Split as a ratio (2:1), percent (67/33) or dB' });
  txt.addEventListener('change', () => { const v = parseRatio(txt.value); txt.classList.toggle('invalid', v == null || Math.abs(v) > 10);
    if(v != null && Math.abs(v) <= 10){ S.ratioDB = v; rng.value = String(v); update(false); } });
  g('Power split P2 : P3',
    el('div', { class: 'row' }, el('span', { id: 'ratioVal', class: 'num' }), el('span', { class: 'hint', id: 'ratioPct' })),
    rng,
    el('div', { class: 'row' }, el('label', { for: 'ratioText', text: 'Enter 2:1, 67/33 or dB' }), txt),
    el('div', { class: 'row' }, ...[[0, '1:1'], [3.0103, '2:1'], [4.7712, '3:1'], [6.0206, '4:1']].map(([v, t]) => el('button', { text: t, on: { click: () => { S.ratioDB = v; rng.value = String(v); update(true); } } }))));
  g('Stages',
    seg('Sections per arm', 'M', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]),
    seg('Taper', 'taper', [['binomial', 'Binomial'], ['cheby', 'Chebyshev']]));
  g('Section shape (each λ/4)',
    seg('Shape', 'shape', [['straight', 'Straight'], ['arc', 'Arc'], ['meander', 'Meander'], ['mitred', 'Mitred']]),
    ...(S.shape === 'meander' ? [seg('Turns', 'turns', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]), seg('Bends', 'bend', [['mitre', 'Mitred'], ['round', 'Round']]),
      seg('Gap (× h)', 'gapH', [[1, '1'], [2, '2'], [3, '3'], [4, '4']])] : []));
  g('Substrate',
    el('div', { class: 'row' }, ...Object.entries(SUBSTRATES).map(([n, [er, h]]) => el('button', { 'aria-pressed': String(S.er === er && S.h === h), text: n,
      on: { click: () => { S.er = er; S.h = h; update(true); } } }))),
    el('div', { class: 'hint num', id: 'subInfo' }),
    seg('Resistor', 'fp', [['0402', '0402'], ['0603', '0603']]));
  side.append(el('div', { id: 'warnBox' }));
}
// ── END 3 ─────────────────────────────────────────────────────

// ── 4. LAYOUT VIEW ────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const ptsAttr = pts => pts.map(p => p.x.toFixed(4) + ',' + p.y.toFixed(4)).join(' ');
function drawLayout(D){
  const svg = $('layout'), L = D.lay, bb = L.bbox, W = svg.clientWidth, H = svg.clientHeight;
  if(W <= 0 || H <= 0) return;
  const mx = 6 + bb.w * 0.06, top = 26 / Math.max(1e-6, Math.min(W / (bb.w + 2 * mx), (H - 70) / (bb.h + 2 * mx)));
  const vx = bb.x0 - mx, vw = bb.w + 2 * mx, vy = bb.y0 - mx - top, vh = bb.h + 2 * mx + top + 14 / Math.min(W / vw, H / (bb.h + 2 * mx));
  const k = Math.min(W / vw, H / vh);                              // px per mm
  svg.setAttribute('viewBox', [vx - (W / k - vw) / 2, vy - (H / k - vh) / 2, W / k, H / k].map(v => v.toFixed(4)).join(' '));
  svg.dataset.scale = k.toFixed(6);
  svg.replaceChildren();
  const fs = 12 / k, sw = 1 / k;
  svg.append(svgEl('rect', { x: bb.x0 - mx / 2, y: bb.y0 - mx / 2, width: bb.w + mx, height: bb.h + mx, fill: 'var(--board)', stroke: 'var(--board-edge)', 'stroke-width': sw, rx: 1 }));
  const fpBox = svgEl('rect', { id: 'fpBox', x: bb.x0, y: bb.y0, width: bb.w, height: bb.h, fill: 'none', stroke: 'var(--mut)', 'stroke-width': sw, 'stroke-dasharray': (4 / k) + ' ' + (3 / k) });
  svg.append(fpBox);
  const cu = svgEl('g', { id: 'copper' }); svg.append(cu);
  for(const e of L.els){
    const g = svgEl('g', { class: 'el' + (e.warn && e.warn.length ? ' warned' : ''), 'data-id': e.id });
    if(e.warn && e.warn.length) g.append(svgEl('path', { class: 'halo', d: e.path.d, 'stroke-width': e.W + 5 / k, fill: 'none', 'stroke-linejoin': 'round' }));
    if(e.outline) g.append(svgEl('polygon', { class: 'cu', points: ptsAttr(e.outline) }));
    else g.append(svgEl('path', { class: 'cu', d: e.path.d, 'stroke-width': e.W, 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' }));
    const hit = svgEl('path', { class: 'hit cl', d: e.path.d, 'stroke-width': Math.max(e.W, 8 / k), 'data-len': e.path.len.toFixed(4), 'data-w': e.W.toFixed(4) });
    g.append(hit); cu.append(g);
  }
  for(const r of L.res){
    const fp = r.fp, ym = (r.y0 + r.y1) / 2, gp = Math.max(fp.gap, r.y1 - r.y0 - 2 * fp.padL * 0.6);
    const g = svgEl('g', { class: 'el', 'data-id': r.id });
    const p0 = ym - gp / 2 - fp.padL, p1 = ym + gp / 2;
    // stubs from the pads to the arm edges when the arms are farther apart than the land pattern
    if(p0 > r.y0) g.append(svgEl('rect', { class: 'cu', x: r.x - fp.padW / 4, y: r.y0, width: fp.padW / 2, height: p0 - r.y0 }));
    if(p1 + fp.padL < r.y1) g.append(svgEl('rect', { class: 'cu', x: r.x - fp.padW / 4, y: p1 + fp.padL, width: fp.padW / 2, height: r.y1 - p1 - fp.padL }));
    g.append(svgEl('rect', { x: r.x - fp.padW / 2, y: p0, width: fp.padW, height: fp.padL, fill: 'var(--pad)' }));
    g.append(svgEl('rect', { x: r.x - fp.padW / 2, y: p1, width: fp.padW, height: fp.padL, fill: 'var(--pad)' }));
    g.append(svgEl('rect', { x: r.x - fp.bodyW / 2, y: ym - fp.bodyL / 2, width: fp.bodyW, height: fp.bodyL, fill: 'var(--res)', rx: fp.bodyW * 0.1 }));
    g.append(svgEl('rect', { class: 'hit', x: r.x - 5 / k, y: r.y0, width: 10 / k, height: r.y1 - r.y0, fill: 'transparent' }));
    cu.append(g);
    const t = svgEl('text', { x: r.x + fp.padW / 2 + 4 / k, y: ym + fs * 0.35, 'font-size': fs, fill: 'var(--sR)' }); t.textContent = r.R.toFixed(1) + ' Ω'; svg.append(t);
  }
  // ports with their solved output power (1 W in by default)
  const pin = S.pinW;
  L.ports.forEach((p, i) => {
    const t = svgEl('text', { x: p.x + (i === 0 ? -4 / k : 4 / k), y: p.y + fs * 0.35, 'font-size': fs, 'text-anchor': i === 0 ? 'end' : 'start', 'font-weight': '600' });
    const w = i === 0 ? pin : pin * D.L.pLoad[i - 1];
    t.textContent = p.name + (i === 0 ? '  ' + pin.toFixed(3) + ' W in' : '  ' + w.toFixed(3) + ' W · ' + fmt(dbm(w), 1) + ' dBm');
    svg.append(t);
  });
  // scale bar: a round length about a fifth of the board
  const target = bb.w / 5, pow = 10 ** Math.floor(Math.log10(target)), bar = [1, 2, 5, 10].map(m => m * pow).filter(v => v <= target).pop() || pow;
  const bx = bb.x0, by = bb.y1 + mx * 0.7;
  svg.append(svgEl('path', { d: `M${bx} ${by - 3 / k} V${by} H${bx + bar} V${by - 3 / k}`, fill: 'none', stroke: 'var(--txt)', 'stroke-width': 1.5 / k, id: 'scaleBar', 'data-mm': bar }));
  const st = svgEl('text', { x: bx + bar + 5 / k, y: by + fs * 0.3, 'font-size': fs }); st.textContent = bar + ' mm'; svg.append(st);
  const ft = svgEl('text', { x: bb.x1, y: bb.y0 - 5 / k, 'font-size': fs, 'text-anchor': 'end', fill: 'var(--mut)' });
  ft.textContent = 'footprint ' + bb.w.toFixed(1) + ' × ' + bb.h.toFixed(1) + ' mm'; svg.append(ft);
  wireHover(svg, D);
}
function elInfo(D, id){
  const e = D.lay.els.find(x => x.id === id), r = D.lay.res.find(x => x.id === id);
  if(r) return `<b>Isolation resistor</b><br>R = ${r.R.toFixed(1)} Ω, ${S.fp}`;
  if(!e) return '';
  const role = { arm: 'λ/4 arm section', xfmr: 'λ/4 output transformer', eq: 'λ/4 phase-equalising line', launch: 'Port launch (Z₀, not in the model)', junction: 'Junction (drawn, not modelled)' }[e.role] || e.role;
  let s = `<b>${role}</b>` + (e.arm != null ? ` · arm to P${e.arm + 2}, section ${e.k + 1}` : '') + '<br>';
  if(e.Z) s += `Z = ${e.Z.toFixed(1)} Ω · W = ${e.W.toFixed(3)} mm<br>`;
  s += `centreline ${e.path.len.toFixed(2)} mm` + (e.lenTarget ? ` (λg/4 = ${e.lenTarget.toFixed(2)} mm, ε_eff = ${e.eeff.toFixed(3)})` : '') + '<br>';
  if(e.shape && e.shape !== 'straight') s += shapeSpec(e) + '<br>';
  (e.warn || []).forEach(w => { s += `<span style="color:var(--bad)">⚠ ${w}</span><br>`; });
  return s;
}
function shapeSpec(e){
  const p = e.spec || {};
  if(e.shape === 'arc') return `arc r = ${p.r.toFixed(2)} mm, ${(p.phi * DEG).toFixed(0)}°`;
  if(e.shape === 'meander') return `meander ${p.turns} turn${p.turns > 1 ? 's' : ''}, height ${p.A.toFixed(2)} mm, gap ${p.gap.toFixed(2)} mm, ${p.bend} bends`;
  if(e.shape === 'mitred') return `bracket rise ${p.rise.toFixed(2)} mm, run ${p.run.toFixed(2)} mm, optimum mitre`;
  if(p.bump) return `straight + ${p.bump.toFixed(2)} mm bump (length match)`;
  return 'straight';
}
function wireHover(svg, D){
  const tip = $('tip');
  svg.querySelectorAll('.el').forEach(g => {
    g.addEventListener('mouseenter', () => { highlight(g.dataset.id, true); tip.innerHTML = elInfo(D, g.dataset.id); tip.style.display = 'block'; });
    g.addEventListener('mousemove', ev => { const r = $('layoutWrap').getBoundingClientRect(); tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 330) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px'; });
    g.addEventListener('mouseleave', () => { highlight(g.dataset.id, false); tip.style.display = 'none'; });
  });
}
function highlight(id, on){
  document.querySelectorAll('[data-id="' + id + '"]').forEach(n => n.classList.toggle('hl', on));
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. WIDTH VS RATIO ─────────────────────────────────────────
function drawRatioPlot(){
  const box = $('ratioPlot'), w = Math.max(260, box.clientWidth - 24), h = Math.max(150, box.clientHeight - 60);
  const ms = msFor(), pts = [];
  for(let i = 0; i <= 50; i++){ const r = 1 + 5 * i / 50, st = wilkinsonStage(S.z0, 10 * Math.log10(r), 1, 'binomial', 0, false);
    pts.push({ r, w2: ms(st.arms[0][0].Z).W, w3: ms(st.arms[1][0].Z).W, t2: st.arms[0][1] ? ms(st.arms[0][1].Z).W : ms(S.z0).W, t3: st.arms[1][1] ? ms(st.arms[1][1].Z).W : ms(S.z0).W }); }
  const ymax = Math.ceil(Math.max(...pts.map(p => Math.max(p.w2, p.t2))) + 0.2);
  const pl = 46, pb = 26, pt = 8, pr = 64, X = r => pl + (w - pl - pr) * (r - 1) / 5, Y = v => pt + (h - pt - pb) * (1 - v / ymax);
  const line = (key, col, dash) => `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + X(p.r).toFixed(1) + ' ' + Y(p[key]).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  let s = `<svg width="${w}" height="${h}" role="img" aria-label="Arm widths versus power ratio">`;
  for(let v = 0; v <= ymax; v += 1){ s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end">${v}</text>`; }
  for(let r = 1; r <= 6; r++) s += `<text x="${X(r)}" y="${h - 8}" font-size="11" text-anchor="middle">${r}:1</text>`;
  s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(S.minW)}" y2="${Y(S.minW)}" stroke="var(--bad)" stroke-dasharray="3 3"/><text x="${X(1.1)}" y="${Y(S.minW) - 4}" font-size="11" fill="var(--bad)">min W ${S.minW} mm</text>`;
  s += line('w2', 'var(--s21)') + line('w3', 'var(--s31)') + line('t2', 'var(--s21)', 1) + line('t3', 'var(--s31)', 1);
  const last = pts[pts.length - 1];
  [['w2', 'P2 arm', 'var(--s21)'], ['w3', 'P3 arm', 'var(--s31)']].forEach(([k, t, c]) => { s += `<text x="${w - pr + 4}" y="${Y(last[k]) + 4}" font-size="11" fill="${c}">${t}</text>`; });
  const rr = 10 ** (Math.abs(S.ratioDB) / 10);
  if(rr <= 6){ s += `<line x1="${X(rr)}" x2="${X(rr)}" y1="${pt}" y2="${h - pb}" stroke="var(--txt)" stroke-width="1.5"/>`; }
  s += `<text x="12" y="${(pt + h - pb) / 2}" font-size="11" fill="var(--mut)" transform="rotate(-90 12 ${(pt + h - pb) / 2})" text-anchor="middle">W (mm)</text></svg>`;
  box.innerHTML = `<h4>Arm width vs ratio <span class="hint">(solid: λ/4 arms, dashed: output transformers; ${S.er} / ${S.h} mm, ${(S.f0 / 1e9).toFixed(2)} GHz)</span></h4>` + s;
}
// ── END 5 ─────────────────────────────────────────────────────

// ── 6. PARAMETER SHEET ────────────────────────────────────────
function drawSheet(D){
  const rows = D.lay.els.filter(e => e.model).map(e => `<tr data-id="${e.id}"><td>${e.role === 'xfmr' ? 'Transformer' : 'Arm'} P${e.arm + 2}·${e.k + 1}</td><td>${e.Z.toFixed(1)}</td><td>${e.W.toFixed(3)}</td><td>${e.path.len.toFixed(2)}</td><td>90.0</td><td style="text-align:left">${shapeSpec(e)}</td><td></td></tr>`);
  D.lay.res.forEach(r => rows.push(`<tr data-id="${r.id}"><td>R${r.id.split('.r')[1] * 1 + 1}</td><td></td><td></td><td></td><td></td><td></td><td>${r.R.toFixed(1)} Ω, ${S.fp}</td></tr>`));
  const bb = D.lay.bbox, rb = D.ref.bbox, tt = traceTotals(D.lay), saved = (1 - bb.area / rb.area) * 100;
  $('sheet').innerHTML = `<h4>Design parameters</h4><table class="sheet"><thead><tr><th>Element</th><th>Z (Ω)</th><th>W (mm)</th><th>Length (mm)</th><th>θ (°)</th><th style="text-align:left">Shape</th><th>Resistor</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="hint num" style="margin-top:6px">Footprint ${bb.w.toFixed(1)} × ${bb.h.toFixed(1)} mm = ${bb.area.toFixed(0)} mm² · straight ${rb.w.toFixed(1)} × ${rb.h.toFixed(1)} mm = ${rb.area.toFixed(0)} mm² · saved ${fmt(saved, 0)} % · trace length ${tt.sec.toFixed(1)} mm (sections), ${tt.all.toFixed(1)} mm (all)</p>`;
  $('sheet').querySelectorAll('tr[data-id]').forEach(tr => { tr.addEventListener('mouseenter', () => highlight(tr.dataset.id, true)); tr.addEventListener('mouseleave', () => highlight(tr.dataset.id, false)); });
}
// ── END 6 ─────────────────────────────────────────────────────
