/* Power Divider Designer — Tests page: the acceptance tests of the briefing (§2 rows and §5), run in the page against
   the engine, the layout and the drawn SVG. Independent of the Designer's current settings (each test builds its own
   design), except the timing test, which measures a full update of a 16-output, 4-section tree. */
const T_FR4 = { er: 4.4, h: 1.6, f0: 2.4e9, model: 'pozar' };
function tGeom(sub, over){
  const sb = sub || T_FR4, cache = new Map();
  const ms = Z => { const k = Z.toFixed(6); if(!cache.has(k)) cache.set(k, microstrip(Z, sb.er, sb.h, sb.f0, sb.model)); return cache.get(k); };
  return Object.assign({ ms, z0: 50, h: sb.h, shapes: ['straight'], fp: '0603', launch: 5, pitch: 10, minW: 0.15,
    shapeOpt: { phi: Math.PI, turns: 2, gap: 3 * sb.h, bend: 'mitre' }, resOn: true, rMult: 1, treeLayout: 'binary', equalise: true, pathErr: 0 }, over || {});
}
const tTree = (N, more) => Object.assign({ N, amp: 'uniform', edgeDB: -10, module: 'wilk', levelMods: [], mods: {}, ratios: {} }, more || {});
function tDesign(p, gover, sub){
  const d = synthesize(Object.assign({ topology: 'wilkinson', N: 2, ratioDB: 0, M: 1, taper: 'binomial', gm: 0.1, z0: 50, teeXfmr: true, resForm: 'Y', tree: tTree(4) }, p));
  const lay = layoutDesign(tGeom(sub, gover), d), net = buildNetwork(d, { z0: 50, resOn: p.resOn !== false, rMult: 1, lens: lay.lens });
  return { d, lay, net, S: solveS(net, 1, p.loss || 0) };
}
const sdb = (M, i, j) => dB20(cabs(mget(M, i, j))), sdeg = (M, i, j) => carg(mget(M, i, j)) * DEG;
const near = (a, b, t) => Math.abs(a - b) <= t;
function TESTS(){ return [
  ['§2 Equal 2-way, 1 section: S21 = S31 = −3.01 dB ∠−90°; S11, S22, S33, S23 < −140 dB; arm 70.7 Ω; R = 100 Ω', () => {
    const { d, S: s } = tDesign({}); const g = [sdb(s, 1, 0), sdb(s, 2, 0), sdeg(s, 1, 0), sdeg(s, 2, 0)], z = [sdb(s, 0, 0), sdb(s, 1, 1), sdb(s, 2, 2), sdb(s, 1, 2)];
    return { pass: g.slice(0, 2).every(v => near(v, -3.0103, 0.005)) && g.slice(2).every(v => near(v, -90, 0.1)) && z.every(v => v < -140) && near(d.stage.arms[0][0].Z, 70.71, 0.01) && near(d.stage.res[0], 100, 1e-6),
      got: `${fmt(g[0], 3)} / ${fmt(g[1], 3)} dB ∠${fmt(g[2], 2)}°; worst ${fmt(Math.max(...z), 1)} dB; arm ${d.stage.arms[0][0].Z.toFixed(2)} Ω; R ${d.stage.res[0].toFixed(2)} Ω` }; }],
  ['§2 Equal 3-way / 4-way: −4.77 / −6.02 dB per port; arms 86.6 / 100 Ω; star R = 50 Ω', () => {
    const a = tDesign({ N: 3 }), b = tDesign({ N: 4 });
    const ok = [1, 2, 3].every(i => near(sdb(a.S, i, 0), -4.771, 0.005)) && [1, 2, 3, 4].every(i => near(sdb(b.S, i, 0), -6.021, 0.005)) &&
      near(a.d.stage.arms[0][0].Z, 86.60, 0.01) && near(b.d.stage.arms[0][0].Z, 100, 0.01) && near(a.d.stage.res[0], 50, 1e-9) && near(b.d.stage.res[0], 50, 1e-9);
    return { pass: ok, got: `${fmt(sdb(a.S, 1, 0), 3)} / ${fmt(sdb(b.S, 1, 0), 3)} dB; arms ${a.d.stage.arms[0][0].Z.toFixed(2)} / ${b.d.stage.arms[0][0].Z.toFixed(2)} Ω; R ${a.d.stage.res[0]} Ω` }; }],
  ['§2 Unequal 3 dB: S21 = −1.76, S31 = −4.76 dB; all ports matched and isolated; R = 106.0 Ω', () => {
    const { d, S: s } = tDesign({ ratioDB: 3 }); const m = Math.max(sdb(s, 0, 0), sdb(s, 1, 1), sdb(s, 2, 2), sdb(s, 1, 2));
    return { pass: near(sdb(s, 1, 0), -1.76, 0.006) && near(sdb(s, 2, 0), -4.76, 0.006) && m < -100 && near(d.stage.res[0], 106.0, 0.05),
      got: `${fmt(sdb(s, 1, 0), 3)} / ${fmt(sdb(s, 2, 0), 3)} dB; worst match/isolation ${fmt(m, 1)} dB; R ${d.stage.res[0].toFixed(2)} Ω` }; }],
  ['§2 Unequal 6 dB: −0.97 / −6.97 dB; R = 124.8 Ω', () => {
    const { d, S: s } = tDesign({ ratioDB: 6 });
    return { pass: near(sdb(s, 1, 0), -0.97, 0.006) && near(sdb(s, 2, 0), -6.97, 0.006) && near(d.stage.res[0], 124.8, 0.05), got: `${fmt(sdb(s, 1, 0), 3)} / ${fmt(sdb(s, 2, 0), 3)} dB; R ${d.stage.res[0].toFixed(2)} Ω` }; }],
  ['§2 No resistor (lossless T, 70.7 Ω arms): S11 = 0; |S22| = |S33| = |S23| = 0.500', () => {
    const { S: s } = tDesign({ resOn: false }); const v = [cabs(mget(s, 1, 1)), cabs(mget(s, 2, 2)), cabs(mget(s, 1, 2))];
    return { pass: sdb(s, 0, 0) < -100 && v.every(x => near(x, 0.5, 1e-6)), got: `S11 ${fmt(sdb(s, 0, 0), 1)} dB; ${v.map(x => x.toFixed(6)).join(' / ')}` }; }],
  ['§2 Loaded, port 3 |Γ| = 0.5: 6.25 % to source, 6.25 % into R, 50 % to P2, 37.5 % to P3', () => {
    const { net } = tDesign({}); const L = solveLoaded(net, 1, 0, [{ g: 0, deg: 0 }, { g: 0.5, deg: 0 }]);
    return { pass: near(L.pRefl, 0.0625, 1e-4) && near(L.pRes, 0.0625, 1e-4) && near(L.pLoad[0], 0.5, 1e-4) && near(L.pLoad[1], 0.375, 1e-4),
      got: [L.pRefl, L.pRes, L.pLoad[0], L.pLoad[1]].map(x => (x * 100).toFixed(3) + ' %').join(' / ') }; }],
  ['§2 Microstrip 70.7 Ω on FR-4 (1.6 mm, 2.4 GHz): W = 1.62 mm, ε_eff = 3.17, λ/4 = 17.5 mm', () => {
    const m = microstrip(70.71, 4.4, 1.6, 2.4e9, 'pozar');
    return { pass: near(m.W, 1.62, 0.005) && near(m.eeff, 3.17, 0.005) && near(m.lenQ, 17.5, 0.05), got: `W ${m.W.toFixed(3)} mm, ε_eff ${m.eeff.toFixed(3)}, λ/4 ${m.lenQ.toFixed(2)} mm` }; }],
  ['§5 Resistive Y (16.7 Ω each): all Sii = 0; all |Sij| = 0.5 (−6.02 dB)', () => {
    const { d, S: s } = tDesign({ topology: 'resistive' }); let ok = near(d.stage.R, 50 / 3, 1e-9), worst = -Infinity, dev = 0;
    for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++){ if(i === j) worst = Math.max(worst, sdb(s, i, i)); else dev = Math.max(dev, Math.abs(cabs(mget(s, i, j)) - 0.5)); }
    ok = ok && worst < -100 && dev < 1e-9;
    return { pass: ok, got: `R ${d.stage.R.toFixed(2)} Ω; worst Sii ${fmt(worst, 1)} dB; max ||Sij| − 0.5| ${dev.toExponential(1)}` }; }],
  ['§5 Multisection Wilkinson (D1): S22, S33, S23 ≤ −20 dB across the S11 ≤ −20 dB band (binomial and Chebyshev, 2–4 sections; unequal 3 dB, 2–3 sections)', () => {
    const cases = [[2, 'binomial', 0], [3, 'binomial', 0], [4, 'binomial', 0], [2, 'cheby', 0], [3, 'cheby', 0], [4, 'cheby', 0], [2, 'binomial', 3], [3, 'binomial', 3]];
    const res = cases.map(([M, tp, r]) => { const { net } = tDesign({ M, taper: tp, ratioDB: r }); const sw = sweep(net, 0.05, 1.95, 361, 0);
      const b = bandwidthOf(sw.u, sw.u.map((u, k) => sdb(sw.S[k], 0, 0)), -20); let w = -Infinity;
      sw.u.forEach((u, k) => { if(b && u >= b.lo && u <= b.hi) [[1, 1], [2, 2], [1, 2]].forEach(([i, j]) => { w = Math.max(w, sdb(sw.S[k], i, j)); }); });
      return { M, tp, r, w, band: b ? b.frac : 0 }; });
    return { pass: res.every(x => x.w <= -20 && x.band > 0), got: res.map(x => `${x.r ? 'u' : ''}${x.tp === 'cheby' ? 'C' : 'B'}${x.M}: ${fmt(x.w, 1)} dB over ${(x.band * 100).toFixed(0)} %`).join('; ') }; }],
  ['D1 Cohn check: two-section 2:1-band design (1.6398, 1.2197 Z₀): optimised R within 3 % of Cohn 98.0 / 241.0 Ω', () => {
    const t = [1.6398, 1.2197], U = Array.from({ length: 61 }, (_, i) => 2 / 3 + (2 / 3) * i / 60);
    const cost = lg => { const g = lg.map(Math.exp); let w = 0; U.forEach(u => { w = Math.max(w, cabs(armGamma(t, g, 0, u))); }); return w; };
    let b = nelderMead(cost, [0, Math.log(2.5)], 0.4, 400); b = nelderMead(cost, b.x, 0.1, 300);
    const R = b.x.map(x => 2 * 50 * Math.exp(x));
    return { pass: near(R[0], 98.0, 2.94) && near(R[1], 241.0, 7.23), got: R.map(x => x.toFixed(1)).join(' / ') + ' Ω' }; }],
  ['§5 Corporate 1:8 equal tree: each output −9.03 dB, all ports matched, equal phase', () => {
    const { S: s } = tDesign({ topology: 'tree', tree: tTree(8) }); const db = [], ph = []; let worst = -Infinity;
    for(let i = 1; i <= 8; i++){ db.push(sdb(s, i, 0)); ph.push(sdeg(s, i, 0)); } for(let i = 0; i <= 8; i++) worst = Math.max(worst, sdb(s, i, i));
    const spread = Math.max(...ph.map(p => wrap180(p - ph[0]))) - Math.min(...ph.map(p => wrap180(p - ph[0])));
    return { pass: db.every(v => near(v, -9.031, 0.005)) && worst < -40 && spread < 0.1, got: `${fmt(Math.min(...db), 3)} … ${fmt(Math.max(...db), 3)} dB; worst Sii ${fmt(worst, 1)} dB; phase spread ${spread.toFixed(4)}°` }; }],
  ['§5 Unequal tree (8 outputs, cosine taper −10 dB, 2 sections, line loss 0.5 dB/λ): output table sums to 100 % less losses', () => {
    const { net } = tDesign({ topology: 'tree', M: 2, tree: tTree(8, { amp: 'cosine', edgeDB: -10 }) }); const L = solveLoaded(net, 1, 0.5, []);
    const sum = L.pDeliv, rest = 1 - L.pRefl - L.pRes - L.pLine;
    return { pass: near(sum, rest, 1e-3), got: `Σ outputs ${(sum * 100).toFixed(3)} %; 100 % − reflected − R − lines = ${(rest * 100).toFixed(3)} %` }; }],
  ['§5 Power readout: 1 W in, 2:1 first stage, equal second, lossless: 0.333 / 0.333 / 0.167 / 0.167 W (25.2 / 25.2 / 22.2 / 22.2 dBm; −4.77 / −4.77 / −7.78 / −7.78 dB)', () => {
    const { net } = tDesign({ topology: 'tree', tree: tTree(4, { ratios: { '': 10 * Math.log10(2) } }) }); const L = solveLoaded(net, 1, 0, []);
    const w = L.pLoad, want = [1 / 3, 1 / 3, 1 / 6, 1 / 6], dbm2 = w.map(x => dbm(x)), dbr = w.map(x => 10 * Math.log10(x));
    return { pass: w.every((x, i) => near(x, want[i], 5e-4)) && dbm2.every((x, i) => near(x, [25.23, 25.23, 22.22, 22.22][i], 0.05)) && dbr.every((x, i) => near(x, [-4.77, -4.77, -7.78, -7.78][i], 0.01)),
      got: w.map(x => x.toFixed(4)).join(' / ') + ' W; ' + dbm2.map(x => x.toFixed(2)).join(' / ') + ' dBm; ' + dbr.map(x => x.toFixed(2)).join(' / ') + ' dB' }; }],
  ['§5 Ratio table: the F2 reference widths are reproduced to ±0.02 mm (FR-4, 2.4 GHz, Wheeler/Pozar)', () => {
    const ref = [[1, 1.62, 1.62, 3.06, 3.06], [2, 2.91, 0.65, 4.04, 2.27], [3, 3.78, 0.30, 4.70, 1.87], [4, 4.43, 0.14, 5.22, 1.62]];
    const ms = Z => microstrip(Z, 4.4, 1.6, 2.4e9, 'pozar').W, out = [];
    const ok = ref.every(([r, w2, w3, t2, t3]) => { const st = wilkinsonStage(50, 10 * Math.log10(r), 1, 'binomial', 0, false), a = st.arms;
      const g = [ms(a[0][0].Z), ms(a[1][0].Z), a[0][1] ? ms(a[0][1].Z) : ms(50), a[1][1] ? ms(a[1][1].Z) : ms(50)];
      out.push(r + ':1 ' + g.map(x => x.toFixed(2)).join('/') + ' (R ' + st.res[0].toFixed(1) + ')');
      return [w2, w3, t2, t3].every((v, i) => near(g[i], v, 0.02)); });
    return { pass: ok, got: out.join('; ') }; }],
  ['§5 Non-binary tree N = 3 (1:2 then 1:1), 1 W in, ideal lines: 0.333 W per output (−4.77 dB), all ports matched', () => {
    const { d, net, S: s } = tDesign({ topology: 'tree', tree: tTree(3) }); const L = solveLoaded(net, 1, 0, []); let worst = -Infinity; for(let i = 0; i <= 3; i++) worst = Math.max(worst, sdb(s, i, i));
    return { pass: L.pLoad.every(x => near(x, 1 / 3, 5e-4)) && worst < -40 && near(d.tree.root.ratioDB, -3.0103, 1e-3),
      got: `root ${ratioText(d.tree.root.ratioDB)}; ${L.pLoad.map(x => x.toFixed(4)).join(' / ')} W; worst Sii ${fmt(worst, 1)} dB` }; }],
  ['§5 Resistive 8-way tree: −18.06 dB per output (3 stages × 6.02 dB)', () => {
    const { S: s } = tDesign({ topology: 'tree', tree: tTree(8, { module: 'resY' }) }); const v = []; for(let i = 1; i <= 8; i++) v.push(sdb(s, i, 0));
    return { pass: v.every(x => near(x, -18.062, 0.005)), got: fmt(Math.min(...v), 3) + ' … ' + fmt(Math.max(...v), 3) + ' dB' }; }],
  ['§5 Branching-line tree (4 outputs): S11 = 0 at f₀, output reflections non-zero (per output)', () => {
    const { S: s } = tDesign({ topology: 'tree', tree: tTree(4, { module: 'branch' }) }); const o = []; for(let i = 1; i <= 4; i++) o.push(sdb(s, i, i));
    return { pass: sdb(s, 0, 0) < -60 && o.every(x => x > -40), got: `S11 ${fmt(sdb(s, 0, 0), 1)} dB; S22…S55 ${o.map(x => fmt(x, 2)).join(' / ')} dB` }; }],
  ['§5 Energy balance: reflected + delivered + R + line loss = 100 % ± 0.1 % (every topology, loaded or not, lossless or lossy)', () => {
    const designs = [{}, { N: 3, M: 2 }, { ratioDB: 4, M: 2 }, { topology: 'tee' }, { topology: 'tee', teeXfmr: false }, { topology: 'resistive', N: 4 }, { topology: 'resistive', resForm: 'delta' },
      { topology: 'tree', tree: tTree(5) }, { topology: 'tree', tree: tTree(4, { module: 'branch' }) }, { topology: 'tree', tree: tTree(8, { module: 'resY' }) }, { topology: 'tree', M: 2, tree: tTree(6, { levelMods: ['wilk', 'branch', 'resY'] }) }];
    let worst = 0, n = 0;
    designs.forEach(p => { const { net } = tDesign(p), np = net.ports.length - 1;
      [[], Array.from({ length: np }, (_, i) => ({ g: i === np - 1 ? 0.6 : 0, deg: 40 }))].forEach(loads => [0, 0.8].forEach(loss => [1, 0.7, 1.3].forEach(u => {
        const L = solveLoaded(net, u, loss, loads); worst = Math.max(worst, Math.abs(L.total - 1)); n++; }))); });
    return { pass: worst <= 1e-3, got: `${n} cases, worst |sum − 100 %| = ${(worst * 100).toExponential(2)} %` }; }],
  ['§5 Curved / meander layouts: the centreline of every λ/4 section is λg/4 within 0.1 %', () => {
    let worst = 0, n = 0, fails = [];
    [['straight'], ['arc'], ['meander'], ['mitred'], ['arc', 'meander', 'mitred']].forEach(sh => [[{ er: 3.55, h: 0.508, f0: 2.4e9, model: 'pozar' }], [T_FR4]].forEach(([sub]) =>
      [[1, 0], [2, 0], [3, 3]].forEach(([M, r]) => { const { lay } = tDesign({ M, ratioDB: r }, { shapes: sh, shapeOpt: { phi: Math.PI, turns: 2, gap: 3 * sub.h, bend: 'mitre' } }, sub);
        lay.els.filter(e => e.model && e.lenTarget).forEach(e => { const err = Math.abs(e.path.len - e.lenTarget) / e.lenTarget; n++; if(err > worst) worst = err; if(err > 1e-3) fails.push(e.id + ' ' + e.shape); }); })));
    return { pass: worst <= 1e-3, got: `${n} sections, worst ${(worst * 100).toFixed(4)} %` + (fails.length ? '; ' + fails.slice(0, 4).join(', ') : '') }; }],
  ['§5 Rules enforced with visible warnings: arc radius < 3W and meander gap < 3h are flagged and drawn with a red halo', () => {
    const a = tDesign({ M: 1, ratioDB: 3 }, { shapes: ['arc'] }), b = tDesign({ M: 1 }, { shapes: ['meander'], shapeOpt: { phi: Math.PI, turns: 1, gap: 0.5, bend: 'mitre' } }, { er: 3.55, h: 0.508, f0: 2.4e9, model: 'pozar' });
    const wa = a.lay.warnings.some(w => /radius/.test(w)), wb = b.lay.warnings.some(w => /coupling/.test(w));
    const svg = testSvg(); drawOneLayout(svg, a.lay, a, 10, 0, { main: true, key: 't' }); const halo = svg.querySelectorAll('.warned .halo').length;
    return { pass: wa && wb && halo > 0, got: `arc warning ${wa}, meander warning ${wb}, haloed elements ${halo}` }; }],
];}
// Async tests (raster): the footprint readout matches the drawn bounding box; the drawn widths, lengths and scale match.
function ASYNC_TESTS(){ return [
  ['§5 Footprint readout matches the drawn bounding box (rasterised copper, 1 px = 0.05 mm)', async () => {
    const out = [];
    for(const [p, sh] of [[{ M: 2 }, ['arc']], [{ M: 2, ratioDB: 3 }, ['meander']], [{ topology: 'tree', tree: tTree(4) }, ['mitred']], [{ N: 3, M: 2 }, ['arc']]]){
      const t = tDesign(p, { shapes: sh }, { er: 3.55, h: 0.508, f0: 2.4e9, model: 'pozar' }), bb = await rasterBox(t);
      const b = t.lay.bbox, e = Math.max(Math.abs(bb.x0 - b.x0), Math.abs(bb.x1 - b.x1), Math.abs(bb.y0 - b.y0), Math.abs(bb.y1 - b.y1));
      out.push({ e, w: b.w, h: b.h }); }
    const worst = Math.max(...out.map(o => o.e));
    return { pass: worst <= 0.1, got: out.map(o => `${o.w.toFixed(2)}×${o.h.toFixed(2)} mm, worst edge ${o.e.toFixed(3)} mm`).join('; ') }; }],
  ['§5 Layout scale: drawn widths and centreline lengths match the parameter sheet within 1 px; the scale bar is true', async () => {
    const t = tDesign({ M: 2, ratioDB: 3 }, { shapes: ['arc'] }, { er: 3.55, h: 0.508, f0: 2.4e9, model: 'pozar' });
    const svg = testSvg(), k = 9; svg.setAttribute('viewBox', `${t.lay.bbox.x0 - 5} ${t.lay.bbox.y0 - 5} ${(t.lay.bbox.w + 10)} ${(t.lay.bbox.h + 10)}`);
    svg.setAttribute('width', ((t.lay.bbox.w + 10) * k).toFixed(3)); svg.setAttribute('height', ((t.lay.bbox.h + 10) * k).toFixed(3));
    drawOneLayout(svg, t.lay, t, k, 0, { main: true, key: 't' });
    let worstL = 0, worstW = 0, n = 0;
    svg.querySelectorAll('.el[data-id]').forEach(g => { const e = t.lay.els.find(x => x.id === g.dataset.id); if(!e || !e.model) return;
      const hit = g.querySelector('path.hit'), cu = g.querySelector('.cu'); n++;
      worstL = Math.max(worstL, Math.abs(hit.getTotalLength() - e.path.len) * k);
      if(cu.tagName === 'path') worstW = Math.max(worstW, Math.abs(parseFloat(cu.getAttribute('stroke-width')) - e.W) * k);
      else { const r = cu.getBBox(), horiz = Math.abs(e.path.pts[0].y - e.path.pts[e.path.pts.length - 1].y) < 1e-9 && e.path.pts.length === 2;
        if(horiz) worstW = Math.max(worstW, Math.abs(r.height - e.W) * k); } });
    const rect = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, scale = rect.width / vb.width;
    document.body.removeChild(svg);
    return { pass: n > 0 && worstL <= 1 && worstW <= 1 && near(scale, k, 0.01), got: `${n} sections at ${k} px/mm: worst length ${worstL.toFixed(3)} px, worst width ${worstW.toFixed(3)} px; scale ${scale.toFixed(3)} px/mm` }; }],
  ['§6 Performance: a full update of a 16-output tree with 4 sections takes < 100 ms (layout, sweep, drawing)', async () => {
    const keep = JSON.stringify(S), was = currentPage;
    Object.assign(S, { topology: 'tree', M: 4, shapes: new Array(MAX_SEC).fill('straight') }); S.tree = tTree(16); S.tree.layout = 'binary'; S.tree.equalise = true; S.tree.pathErr = 0;
    showPage('designer'); update(true); await new Promise(r => setTimeout(r, 30));
    const times = [];
    for(let i = 0; i < 5; i++){ S.ratioDB = 0.1 * i; const t0 = performance.now(); update(false); times.push(performance.now() - t0); }
    for(let i = 0; i < 3; i++){ S.tree.pathErr = i; const t0 = performance.now(); update(true); times.push(performance.now() - t0); }
    mergeInto(S, JSON.parse(keep)); showPage(was); update(true);
    const med = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)], mx = Math.max(...times);
    return { pass: med < 100, got: `median ${med.toFixed(0)} ms, worst ${mx.toFixed(0)} ms over ${times.length} updates` }; }],
];}
function mergeInto(dst, src){ for(const k in src) dst[k] = src[k]; }
function testSvg(){ const s = svgEl('svg', { class: 'testsvg', width: 400, height: 300, viewBox: '0 0 40 30' }); document.body.append(s); return s; }
// Rasterise the copper of a layout (pads included) at 20 px/mm and return the inked bounding box in mm.
async function rasterBox(t){
  const k = 20, b = t.lay.bbox, m = 3, svg = testSvg();
  const vb = [b.x0 - m, b.y0 - m, b.w + 2 * m, b.h + 2 * m];
  svg.setAttribute('viewBox', vb.join(' ')); svg.setAttribute('width', vb[2] * k); svg.setAttribute('height', vb[3] * k);
  drawOneLayout(svg, t.lay, t, k, 0, { main: false });
  svg.querySelectorAll('.board, .fpbox, text, .halo, .hit, .rbody, .bridge, .bridgedot').forEach(n => n.remove());
  svg.querySelectorAll('polygon, rect').forEach(n => n.setAttribute('fill', '#000'));
  svg.querySelectorAll('path.cu').forEach(n => { n.setAttribute('stroke', '#000'); n.setAttribute('fill', 'none'); });
  svg.setAttribute('xmlns', NS);
  const src = new XMLSerializer().serializeToString(svg); document.body.removeChild(svg);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const cv = document.createElement('canvas'); cv.width = Math.ceil(vb[2] * k); cv.height = Math.ceil(vb[3] * k);
  const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0, cv.width, cv.height);
  const d = g2.getImageData(0, 0, cv.width, cv.height).data; let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for(let y = 0; y < cv.height; y++) for(let x = 0; x < cv.width; x++) if(d[(y * cv.width + x) * 4 + 3] > 127){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  return { x0: vb[0] + x0 / k, x1: vb[0] + (x1 + 1) / k, y0: vb[1] + y0 / k, y1: vb[1] + (y1 + 1) / k };
}
async function runTests(){
  const box = $('testsBody'), rows = [];
  box.innerHTML = '<p class="hint">Running…</p>';
  const run = async ([name, fn]) => { const t0 = performance.now(); let r; try { r = await fn(); } catch(e){ r = { pass: false, got: 'error: ' + e.message }; }
    rows.push({ name, pass: r.pass, got: r.got, ms: performance.now() - t0 }); };
  for(const t of TESTS()) await run(t);
  for(const t of ASYNC_TESTS()) await run(t);
  const np = rows.filter(r => r.pass).length;
  box.innerHTML = `<article class="doc"><h1>Tests</h1><p class="lede"><b class="${np === rows.length ? 'okc' : 'bad'}">${np} of ${rows.length} passed.</b> Each test builds its own design; values are computed now, in this page.</p>
    <table class="sheet tests"><thead><tr><th>Result</th><th class="l">Test</th><th class="l">Measured</th><th>ms</th></tr></thead><tbody>` +
    rows.map(r => `<tr class="${r.pass ? 'tpass' : 'tfail'}"><td>${r.pass ? 'PASS' : 'FAIL'}</td><td class="l">${r.name}</td><td class="l num">${r.got}</td><td>${r.ms.toFixed(0)}</td></tr>`).join('') +
    `</tbody></table><p><button id="rerun">Run again</button></p></article>`;
  $('rerun').addEventListener('click', runTests);
  box.dataset.done = String(np) + '/' + rows.length;
}
