/* Power Divider Designer — schematic. Element ids match the layout's (x.a<arm>.<k>, x.r<k>, j<path>…), so hovering
   either view highlights the same element in both.
   Single dividers: one lane per arm, a box per λ/4 section (its Z), resistors between the lanes at their nodes.
   Trees: a block per junction (module and ratio) in depth columns, outputs on the right. */
function drawSchematic(D, box){
  const W = Math.max(240, box.clientWidth - 16), H = Math.max(150, box.clientHeight - 30);
  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Schematic' });
  const T = (x, y, t, a) => svg.append(svgEl('text', Object.assign({ x, y, 'font-size': 11, 'text-anchor': 'middle' }, a || {}), t));
  const ln = (x1, y1, x2, y2, a) => svg.append(svgEl('line', Object.assign({ x1, y1, x2, y2, stroke: 'var(--txt)', 'stroke-width': 1.5 }, a || {})));
  const design = D.design;
  if(design.topology === 'tree') schemTree(D, svg, W, H, T, ln);
  else if(design.stage.kind === 'resistive') schemResistive(design.stage, svg, W, H, T, ln);
  else schemLanes(design.stage, svg, W, H, T, ln);
  box.replaceChildren(el('h4', { text: 'Schematic' }), svg);
  wireHover(svg, D);
}
// Port dot with its name.
function schemPort(svg, x, y, name, left){
  svg.append(svgEl('circle', { cx: x, cy: y, r: 4, fill: 'var(--txt)' }));
  svg.append(svgEl('text', { x: x + (left ? -8 : 8), y: y + 4, 'font-size': 11, 'text-anchor': left ? 'end' : 'start', 'font-weight': 600 }, name));
}
// Zig-zag resistor from (x, y0) to (x, y1) with its value.
function schemResistor(svg, x, y0, y1, id, label){
  const g = svgEl('g', { class: 'el sres', 'data-id': id }), m = (y0 + y1) / 2, zh = Math.min(10, Math.abs(y1 - y0) / 3), n = 6;
  let d = `M${x} ${y0} L${x} ${m - zh}`; for(let i = 0; i < n; i++) d += ` L${x + (i % 2 ? -4 : 4)} ${m - zh + 2 * zh * (i + 0.5) / n}`; d += ` L${x} ${m + zh} L${x} ${y1}`;
  g.append(svgEl('path', { d, fill: 'none', stroke: 'var(--sR)', 'stroke-width': 1.6 }), svgEl('rect', { class: 'hit', x: x - 8, y: Math.min(y0, y1), width: 16, height: Math.abs(y1 - y0), fill: 'transparent' }));
  if(label) g.append(svgEl('text', { x: x + 7, y: m + 4, 'font-size': 10, fill: 'var(--sR)' }, label));
  svg.append(g);
}
function schemLanes(st, svg, W, H, T, ln){
  const N = st.arms.length, nSec = st.arms[0].length, x0 = 34, xj = 64, xe = W - 46, top = 22, bot = H - 14;
  const ys = Array.from({ length: N }, (_, i) => N === 1 ? (top + bot) / 2 : top + (bot - top) * i / (N - 1)), yj = (ys[0] + ys[N - 1]) / 2;
  schemPort(svg, x0, yj, 'P1', true); ln(x0, yj, xj, yj); ln(xj, ys[0], xj, ys[N - 1]);
  const sw = (xe - xj - 10) / nSec;
  ys.forEach((y, a) => {
    st.arms[a].forEach((s, k) => {
      const xa = xj + 5 + k * sw, g = svgEl('g', { class: 'el ssec', 'data-id': 'x.a' + a + '.' + k });
      g.append(svgEl('rect', { class: 'sbox', x: xa + 3, y: y - 7, width: sw - 6, height: 14, rx: 2 }));
      g.append(svgEl('text', { x: xa + sw / 2, y: y - 10, 'font-size': 10, 'text-anchor': 'middle' }, s.Z.toFixed(1) + ' Ω'));
      svg.append(g); ln(xa, y, xa + 3, y); ln(xa + sw - 3, y, xa + sw, y);
    });
    ln(xj, y, xj + 5, y); ln(xe - 5, y, xe, y); schemPort(svg, xe, y, 'P' + (a + 2));
  });
  st.res.forEach((R, k) => {
    if(R == null || S.resOn === false) return;
    const x = xj + 5 + (k + 1) * sw;
    if(st.kind === 'star'){
      ys.forEach((y, a) => schemResistor(svg, x, y + 7, y + Math.min(26, (ys[1] - ys[0]) * 0.55 || 26), 'x.r' + k + '.' + a, a === 0 ? (R * S.rMult).toFixed(0) + ' Ω ★' : null));
    } else schemResistor(svg, x, ys[0] + 7, ys[1] - 7, 'x.r' + k, (R * S.rMult).toFixed(1) + ' Ω');
  });
  T((xj + xe) / 2, H - 2, 'each box: λ/4 at f₀' + (st.res.some(r => r != null) ? '' : ' · no resistor'), { fill: 'var(--mut)' });
}
function schemResistive(st, svg, W, H, T, ln){
  const N = st.N, xc = W * 0.45, cy = H / 2, ys = Array.from({ length: N }, (_, i) => N === 1 ? cy : 26 + (H - 52) * i / (N - 1));
  schemPort(svg, 34, cy, 'P1', true);
  if(st.form === 'delta'){
    const A = [xc - 40, cy], B = [xc + 30, ys[0]], C = [xc + 30, ys[1]];
    ln(34, cy, A[0], A[1]); ln(B[0], B[1], W - 46, ys[0]); ln(C[0], C[1], W - 46, ys[1]);
    [[A, B, 'x.r01'], [A, C, 'x.r02'], [B, C, 'x.r12']].forEach(([p, q, id]) => { const g = svgEl('g', { class: 'el sres', 'data-id': id });
      g.append(svgEl('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'var(--sR)', 'stroke-width': 4 })); svg.append(g); });
  } else {
    const g0 = svgEl('g', { class: 'el sres', 'data-id': 'x.r0' }); g0.append(svgEl('rect', { x: 60, y: cy - 5, width: xc - 70, height: 10, fill: 'none', stroke: 'var(--sR)', 'stroke-width': 1.6 })); svg.append(g0);
    ln(34, cy, 60, cy); ln(xc - 10, cy, xc, cy); ln(xc, ys[0], xc, ys[N - 1]);
    ys.forEach((y, i) => { const g = svgEl('g', { class: 'el sres', 'data-id': 'x.r' + (i + 1) });
      g.append(svgEl('rect', { x: xc + 12, y: y - 5, width: W - xc - 80, height: 10, fill: 'none', stroke: 'var(--sR)', 'stroke-width': 1.6 })); svg.append(g);
      ln(xc, y, xc + 12, y); ln(W - 68, y, W - 46, y); });
  }
  ys.forEach((y, i) => schemPort(svg, W - 46, y, 'P' + (i + 2)));
  T(W / 2, H - 2, 'R = ' + st.R.toFixed(1) + ' Ω each (' + (st.form === 'delta' ? 'Δ' : 'Y') + ')', { fill: 'var(--mut)' });
}
function schemTree(D, svg, W, H, T, ln){
  const tr = D.design.tree, depth = tr.maxDepth, N = tr.N, x0 = 30, xe = W - 50, cw = (xe - x0 - 20) / Math.max(depth, 1);
  // leaves evenly spaced; a junction sits at the mean height of its leaves
  const yLeaf = i => 14 + (H - 30) * (N === 1 ? 0.5 : i / (N - 1));
  const yOf = nd => { if(nd.leaf) return yLeaf(nd.idx); return (yOf(nd.children[0]) + yOf(nd.children[1])) / 2; };
  const draw = (nd, xp, yp) => {
    if(nd.leaf){ ln(xp, yp, xe, yLeaf(nd.idx), { 'stroke-width': 1 }); schemPort(svg, xe, yLeaf(nd.idx), 'P' + (nd.idx + 2)); return; }
    const x = x0 + 20 + nd.depth * cw, y = yOf(nd), bw = Math.min(46, cw * 0.7), bh = 16;
    ln(xp, yp, x, y, { 'stroke-width': 1 });
    const g = svgEl('g', { class: 'el sblk' + (S.sel === nd.path ? ' sel' : ''), 'data-id': 'j' + nd.path, 'data-junction': nd.path, role: 'button', tabindex: 0,
      'aria-label': 'Junction ' + (nd.path || 'root') + ': ' + MODULE_NAME[nd.module] + ' ' + ratioText(nd.stage.ratioDB) });
    g.append(svgEl('rect', { class: 'sbox', x, y: y - bh / 2, width: bw, height: bh, rx: 3 }));
    g.append(svgEl('text', { x: x + bw / 2, y: y + 4, 'font-size': 9, 'text-anchor': 'middle' }, { wilk: 'W', branch: 'BL', resY: 'Y' }[nd.module] + ' ' + ratioText(nd.stage.ratioDB)));
    svg.append(g);
    nd.children.forEach(c => draw(c, x + bw, y));
  };
  schemPort(svg, x0 - 10, yOf(tr.root), 'P1', true);
  draw(tr.root, x0 - 10, yOf(tr.root));
  svg.querySelectorAll('[data-junction]').forEach(b => { const pick = () => { S.sel = b.dataset.junction; update(true); };
    b.addEventListener('click', pick); b.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } }); });
}
