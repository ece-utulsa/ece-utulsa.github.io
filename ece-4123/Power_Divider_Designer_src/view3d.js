/* Power Divider Designer — 3D view of the layout: the substrate (true thickness h) on its ground plane, the copper
   traces, the resistor land patterns and bodies, and an edge-launch SMA at every port. A small canvas renderer (no
   library): faces are projected in perspective, shaded by their normal, and painted back to front in three layers
   (substrate, copper, parts), which is exact for views from above the board. Drag to orbit, wheel to zoom.
   Copper and part heights can be exaggerated so the 35 µm foil is visible; the substrate is always to scale. */

// ── SMA (edge launch) ─────────────────────────────────────────
// Dimensions (mm) in the port's own frame: +x out of the board, the centre pin lying on the trace.
const SMA = { pinL: 3.0, pinW: 1.27, legL: 4.0, legW: 1.0, legOff: 2.54, flangeT: 1.6, flangeW: 9.5, barrelL: 8.5, barrelD: 6.35, label: 'SMA (edge launch)' };
const smaLegOffset = W0 => Math.max(SMA.legOff, W0 / 2 + 0.6 + SMA.legW / 2);
// A port at the copper's outer edge, facing out, takes an edge-launch SMA; any other (inside an H-tree) a vertical one.
function portOnEdge(L, p){ const bb = L.bbox, d = p.dir % 4, e = 1e-6;
  return (d === 0 && p.at.x >= bb.x1 - e) || (d === 2 && p.at.x <= bb.x0 + e) || (d === 1 && p.at.y >= bb.y1 - e) || (d === 3 && p.at.y <= bb.y0 + e); }
const VSMA = { pad: 6.35, hole: 1.3, body: 6.35, height: 8.5 };   // vertical (through-board) SMA: square base, 4 ground posts
// ── END SMA ───────────────────────────────────────────────────

const V3 = { az: -35, el: 38, zoom: 1, zx: 5, drag: null, scene: null, raf: 0 };
// Sample an element's copper outline in local coordinates: its polygon, or a band of ±W/2 around its sampled centreline.
let _probe = null;
function bandOutline(e){
  if(e.outline) return e.outline;
  if(!_probe){ _probe = document.createElementNS(NS, 'path'); const s = svgEl('svg', { class: 'testsvg' }); s.append(_probe); document.body.append(s); }
  _probe.setAttribute('d', e.path.d);
  const L = _probe.getTotalLength(), n = Math.max(8, Math.min(160, Math.ceil(L / 0.35))), c = [];
  for(let i = 0; i <= n; i++){ const q = _probe.getPointAtLength(L * i / n); c.push(P(q.x, q.y)); }
  const left = [], right = [], h = e.W / 2;
  c.forEach((p, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(n, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
    left.push(P(p.x + nx * h, p.y + ny * h)); right.push(P(p.x - nx * h, p.y - ny * h)); });
  return left.concat(right.reverse());
}
// Faces of the scene in world coordinates (x, y in the board plane as in the 2D view, z up): { pts: [[x,y,z]…], col, layer }.
function buildScene(D){
  const L = D.lay, h = S.h, t = 0.035 * V3.zx, faces = [], W0 = L.W0;
  const COL = { sub: [205, 214, 190], subSide: [170, 182, 150], gnd: [184, 116, 47], cu: [196, 128, 58], pad: [214, 170, 80], res: [30, 34, 40], cap: [200, 200, 205], gold: [212, 175, 55], pin: [225, 225, 230] };
  // prism of a polygon (local points, transform tf) from z0 to z1
  const prism = (poly, tf, z0, z1, col, layer, sides) => {
    const g = poly.map(p => applyTf(tf || TF0, p));
    faces.push({ pts: g.map(p => [p.x, p.y, z1]), col, layer, top: true });
    if(sides !== false) for(let i = 0; i < g.length; i++){ const a = g[i], b = g[(i + 1) % g.length]; if(Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) continue;
      faces.push({ pts: [[a.x, a.y, z0], [b.x, b.y, z0], [b.x, b.y, z1], [a.x, a.y, z1]], col, layer }); }
  };
  const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  // board: the copper box plus a margin, cut flush at the ports
  const bb = L.bbox, m = Math.max(3, 0.04 * Math.max(bb.w, bb.h)), edge = boardRect(L, m);
  prism(rect(edge.x0, edge.y0, edge.x1, edge.y1), TF0, -h, 0, COL.sub, 0);
  prism(rect(edge.x0, edge.y0, edge.x1, edge.y1), TF0, -h - t, -h, COL.gnd, 0);
  // copper
  L.els.forEach(e => prism(bandOutline(e), e.tf, 0, t, e.role === 'pad' ? COL.pad : COL.cu, 1));
  // resistors: pads, body, end caps
  L.res.forEach(r => {
    const fp = r.fp, Lr = dist(r.a, r.b), ang = Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x), mm = P((r.a.x + r.b.x) / 2, (r.a.y + r.b.y) / 2);
    const tfr = composeTf(r.tf || TF0, { x: 0, y: 0, q: 0 }), at = (u, v) => { const c = Math.cos(ang), s = Math.sin(ang); return P(mm.x + u * c - v * s, mm.y + u * s + v * c); };
    const box = (u0, v0, u1, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], pe = fp.gap / 2 + fp.padL, hb = fp.bodyW * 0.7;
    prism(box(-pe, -fp.padW / 2, -fp.gap / 2, fp.padW / 2), tfr, 0, t, COL.pad, 1);
    prism(box(fp.gap / 2, -fp.padW / 2, pe, fp.padW / 2), tfr, 0, t, COL.pad, 1);
    if(Lr / 2 > pe){ prism(box(-Lr / 2, -fp.padW / 4, -pe, fp.padW / 4), tfr, 0, t, COL.cu, 1); prism(box(pe, -fp.padW / 4, Lr / 2, fp.padW / 4), tfr, 0, t, COL.cu, 1); }
    const zb = t, zt = t + hb * Math.max(1, V3.zx / 5), cap = fp.bodyL * 0.18;
    prism(box(-fp.bodyL / 2 + cap, -fp.bodyW / 2, fp.bodyL / 2 - cap, fp.bodyW / 2), tfr, zb, zt, COL.res, 2);
    prism(box(-fp.bodyL / 2, -fp.bodyW / 2, -fp.bodyL / 2 + cap, fp.bodyW / 2), tfr, zb, zt, COL.cap, 2);
    prism(box(fp.bodyL / 2 - cap, -fp.bodyW / 2, fp.bodyL / 2, fp.bodyW / 2), tfr, zb, zt, COL.cap, 2);
  });
  // SMA connectors
  if(S.sma) L.ports.forEach(p => {
    if(!portOnEdge(L, p)){
      // vertical SMA: square body on the board, threaded barrel up, centre pin at the trace end
      const tv = { x: p.at.x, y: p.at.y, q: 0 }, b2 = VSMA.body / 2, R2 = VSMA.body / 2 * 0.9, n2 = 16, z0 = t, z1 = t + 2, z2 = z1 + VSMA.height;
      prism(rect(-b2, -b2, b2, b2), tv, z0, z1, COL.gold, 2);
      for(let i = 0; i < n2; i++){ const a0 = 2 * Math.PI * i / n2, a1 = 2 * Math.PI * (i + 1) / n2, A = applyTf(tv, P(R2 * Math.cos(a0), R2 * Math.sin(a0))), B = applyTf(tv, P(R2 * Math.cos(a1), R2 * Math.sin(a1)));
        faces.push({ pts: [[A.x, A.y, z1], [B.x, B.y, z1], [B.x, B.y, z2], [A.x, A.y, z2]], col: COL.gold, layer: 2 }); }
      const capV = []; for(let i = 0; i < n2; i++){ const a = 2 * Math.PI * i / n2, q = applyTf(tv, P(R2 * Math.cos(a), R2 * Math.sin(a))); capV.push([q.x, q.y, z2]); }
      faces.push({ pts: capV, col: COL.gold, layer: 2, top: true });
      return;
    }
    const tf = { x: p.at.x, y: p.at.y, q: p.dir }, zc = -h / 2, R = SMA.barrelD / 2, lo = smaLegOffset(W0);
    prism(rect(-SMA.pinL, -SMA.pinW / 2, 0, SMA.pinW / 2), tf, t, t + 0.5, COL.pin, 2);
    [-lo, lo].forEach(v => { prism(rect(-SMA.legL, v - SMA.legW / 2, 0, v + SMA.legW / 2), tf, t, t + 0.8, COL.gold, 2);
      prism(rect(-SMA.legL, v - SMA.legW / 2, 0, v + SMA.legW / 2), tf, -h - 0.8, -h, COL.gold, 2); });
    // flange: a block standing on the board edge
    const fw = SMA.flangeW / 2, fz0 = zc - fw, fz1 = zc + fw, fx0 = 0, fx1 = SMA.flangeT;
    const slab = (x0, x1, y0, y1, z0, z1, col) => { const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => applyTf(tf, P(x, y)));
      const q = (a, b, cc, d) => faces.push({ pts: [a, b, cc, d], col, layer: 2 });
      const v = (pp, z) => [pp.x, pp.y, z];
      q(v(c[0], z1), v(c[1], z1), v(c[2], z1), v(c[3], z1)); q(v(c[3], z0), v(c[2], z0), v(c[1], z0), v(c[0], z0));
      for(let i = 0; i < 4; i++){ const a = c[i], b = c[(i + 1) % 4]; q(v(a, z0), v(b, z0), v(b, z1), v(a, z1)); } };
    slab(fx0, fx1, -fw, fw, fz0, fz1, COL.gold);
    // barrel: a 16-sided prism along +x, centred on the board's mid-plane
    const n = 16;
    for(let i = 0; i < n; i++){
      const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, y0 = R * Math.cos(a0), z0 = zc + R * Math.sin(a0), y1 = R * Math.cos(a1), z1 = zc + R * Math.sin(a1);
      const A = applyTf(tf, P(fx1, y0)), B = applyTf(tf, P(fx1 + SMA.barrelL, y0)), C2 = applyTf(tf, P(fx1 + SMA.barrelL, y1)), Dd = applyTf(tf, P(fx1, y1));
      faces.push({ pts: [[A.x, A.y, z0], [B.x, B.y, z0], [C2.x, C2.y, z1], [Dd.x, Dd.y, z1]], col: COL.gold, layer: 2 });
    }
    const capPts = []; for(let i = 0; i < n; i++){ const a = 2 * Math.PI * i / n, q = applyTf(tf, P(fx1 + SMA.barrelL, R * Math.cos(a))); capPts.push([q.x, q.y, zc + R * Math.sin(a)]); }
    faces.push({ pts: capPts, col: COL.gold, layer: 2 });
    const pinPts = []; for(let i = 0; i < n; i++){ const a = 2 * Math.PI * i / n, q = applyTf(tf, P(fx1 + SMA.barrelL + 0.01, 0.6 * Math.cos(a))); pinPts.push([q.x, q.y, zc + 0.6 * Math.sin(a)]); }
    faces.push({ pts: pinPts, col: [240, 240, 240], layer: 2 });
  });
  const cx0 = (edge.x0 + edge.x1) / 2, cy0 = (edge.y0 + edge.y1) / 2, span = Math.max(edge.x1 - edge.x0, edge.y1 - edge.y0) + (S.sma ? 2 * (SMA.barrelL + SMA.flangeT) : 0);
  return { faces, centre: [cx0, cy0, -h / 2], span };
}
// Board outline: copper box + margin, flush with the board edge at every port (an edge-launch connector sits there).
function boardRect(L, m){ // edges at edge-launch ports are flush
  const bb = L.bbox, r = { x0: bb.x0 - m, y0: bb.y0 - m, x1: bb.x1 + m, y1: bb.y1 + m };
  if(S.sma) L.ports.forEach(p => { const d = p.dir % 4;
    if(d === 0 && p.at.x >= bb.x1 - 1e-6) r.x1 = bb.x1; if(d === 2 && p.at.x <= bb.x0 + 1e-6) r.x0 = bb.x0;
    if(d === 1 && p.at.y >= bb.y1 - 1e-6) r.y1 = bb.y1; if(d === 3 && p.at.y <= bb.y0 + 1e-6) r.y0 = bb.y0; });
  return r;
}
function render3d(){
  V3.raf = 0;
  const cv = $('view3d'), sc = V3.scene; if(!cv || !sc || cv.clientWidth === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dark = document.body.classList.contains('dark');
  g.fillStyle = dark ? '#0f1218' : '#ffffff'; g.fillRect(0, 0, W, H);
  // camera: orbit about the board centre; screen y down, world y down in the plan (as in 2D), z up
  const az = V3.az * Math.PI / 180, elev = V3.el * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(elev), se = Math.sin(elev);
  const dist0 = sc.span * 1.6 / V3.zoom, f = Math.min(W * 0.62, H) * 1.45, [ox, oy, oz] = sc.centre;
  const view = ([x, y, z]) => { const X = x - ox, Y = y - oy, Z = z - oz;
    const x1 = X * ca - Y * sa, y1 = X * sa + Y * ca;                // turn about the vertical
    const yv = y1 * se - Z * ce, depth = y1 * ce + Z * se;             // tilt: elevation from the board plane
    return [x1, yv, dist0 - depth]; };
  const proj = v => [W / 2 + f * v[0] / v[2], H / 2 + f * v[1] / v[2]];
  const light = (() => { const l = [0.35, -0.45, 0.82], n = Math.hypot(...l); return l.map(x => x / n); })();
  const byLayer = [[], [], []];
  for(const fc of sc.faces){
    const v = fc.pts.map(view); if(v.some(p => p[2] < 1e-3)) continue;
    const s = v.map(proj);
    // cull back faces (screen winding) except tops, which are always seen from above
    let area = 0; for(let i = 0; i < s.length; i++){ const a = s[i], b = s[(i + 1) % s.length]; area += a[0] * b[1] - b[0] * a[1]; }
    // world normal for shading
    const p0 = fc.pts[0], p1 = fc.pts[1], p2 = fc.pts[2];
    let n = [(p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]), (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]), (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])];
    const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
    const lam = fc.top ? 0.92 : 0.5 + 0.5 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
    const depth = v.reduce((a, p) => a + p[2], 0) / v.length;
    if(!fc.top && Math.abs(area) < 1e-4) continue;
    byLayer[fc.layer].push({ s, depth, col: fc.col.map(c => Math.round(Math.min(255, c * lam))) });
  }
  for(const layer of byLayer){
    layer.sort((a, b) => b.depth - a.depth);
    for(const f2 of layer){ g.beginPath(); f2.s.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = `rgb(${f2.col[0]},${f2.col[1]},${f2.col[2]})`; g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke(); }
  }
  $('v3info').textContent = `azimuth ${Math.round(V3.az)}°, elevation ${Math.round(V3.el)}° · substrate to scale (h = ${S.h} mm) · copper and parts ×${V3.zx} in height`;
}
const req3d = () => { if(!V3.raf) V3.raf = requestAnimationFrame(render3d); };
function show3d(D){ V3.scene = buildScene(D); $('layoutInfo').textContent = footprintText(D); req3d(); }
function wire3d(){
  const cv = $('view3d');
  cv.addEventListener('pointerdown', e => { V3.drag = { x: e.clientX, y: e.clientY, az: V3.az, el: V3.el }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if(!V3.drag) return; V3.az = V3.drag.az - (e.clientX - V3.drag.x) * 0.4; V3.el = Math.max(8, Math.min(90, V3.drag.el + (e.clientY - V3.drag.y) * 0.3)); req3d(); });
  cv.addEventListener('pointerup', () => { V3.drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); V3.zoom = Math.max(0.4, Math.min(12, V3.zoom * Math.exp(-e.deltaY * 0.0015))); req3d(); }, { passive: false });
  cv.addEventListener('keydown', e => { const k = e.key; if(k === 'ArrowLeft') V3.az += 5; else if(k === 'ArrowRight') V3.az -= 5; else if(k === 'ArrowUp') V3.el = Math.min(90, V3.el + 5); else if(k === 'ArrowDown') V3.el = Math.max(8, V3.el - 5);
    else if(k === '+' || k === '=') V3.zoom *= 1.15; else if(k === '-') V3.zoom /= 1.15; else return; e.preventDefault(); req3d(); });
  $('v3reset').addEventListener('click', () => { Object.assign(V3, { az: -35, el: 38, zoom: 1 }); req3d(); });
  $('v3top').addEventListener('click', () => { Object.assign(V3, { az: 0, el: 90 }); req3d(); });
  $('v3zx').addEventListener('change', e => { V3.zx = +e.target.value; if(D) show3d(D); });
}
