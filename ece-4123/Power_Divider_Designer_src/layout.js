/* Power Divider Designer — layout: the to-scale microstrip top view (mm). Pure geometry, no DOM.
   ============================================================
   TABLE OF CONTENTS
   1. Footprints        — 0402 / 0603 resistor land patterns
   2. Centreline paths  — polylines with sharp, optimum-mitre or round corners; arcs; lengths; outlines
   3. Section shapes    — straight, arc (ring), mitred bracket, meander, each fitted to λg/4 along its centreline
   4. Two-arm stage     — junction, arms, resistors, output transformers, output launches, rule checks
   5. Bounding box
   ============================================================
   Coordinates: x to the right, y down (SVG), millimetres. Arm 0 (port 2) is drawn above the axis, arm 1 (port 3)
   below. Electrical length is measured along the centreline (F5): a mitred corner counts to the sharp corner, a round
   corner along its arc. The junction bar, bends, steps in width and meander coupling are drawn but not modelled. */

// ── 1. FOOTPRINTS ─────────────────────────────────────────────
// Chip-resistor land patterns (mm): body L × W, pad length (along the resistor) × width, gap between the pads.
const FOOTPRINTS = {
  '0402': { bodyL: 1.0, bodyW: 0.5, padL: 0.5, padW: 0.6, gap: 0.5 },
  '0603': { bodyL: 1.6, bodyW: 0.8, padL: 0.8, padW: 0.9, gap: 0.8 },
};
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. CENTRELINE PATHS ───────────────────────────────────────
const f3 = v => (Math.round(v * 1000) / 1000).toString();
const P = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
// Optimum mitre of a right-angle bend (Douville & James 1978): m = 52 + 65·e^(−1.35 W/h) %, of the corner diagonal.
const optMitre = (W, h) => (52 + 65 * Math.exp(-1.35 * W / h)) / 100;
/* A polyline centreline. corner = 'sharp' | 'mitre' | 'round' (radius rb). Returns { d, len, pts, corner, rb }:
   d is the SVG centreline (round corners as arcs), len its length. */
function polyPath(pts, corner, rb){
  if(corner !== 'round' || pts.length < 3){
    let len = 0; for(let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
    return { d: 'M' + pts.map(p => f3(p.x) + ' ' + f3(p.y)).join(' L'), len, pts, corner };
  }
  let d = 'M' + f3(pts[0].x) + ' ' + f3(pts[0].y), len = 0, cur = pts[0];
  for(let i = 1; i < pts.length - 1; i++){
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const u1 = { x: (b.x - a.x) / dist(a, b), y: (b.y - a.y) / dist(a, b) }, u2 = { x: (c.x - b.x) / dist(b, c), y: (c.y - b.y) / dist(b, c) };
    const cr = u1.x * u2.y - u1.y * u2.x, th = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
    const t = rb * Math.tan(th / 2), p1 = P(b.x - u1.x * t, b.y - u1.y * t), p2 = P(b.x + u2.x * t, b.y + u2.y * t);
    len += dist(cur, p1) + rb * th;
    d += ' L' + f3(p1.x) + ' ' + f3(p1.y) + ' A' + f3(rb) + ' ' + f3(rb) + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + f3(p2.x) + ' ' + f3(p2.y);
    cur = p2;
  }
  const last = pts[pts.length - 1]; len += dist(cur, last);
  d += ' L' + f3(last.x) + ' ' + f3(last.y);
  return { d, len, pts, corner, rb };
}
/* Copper outline of a sharp or mitred polyline of width W: offset both sides, join at the miter points; a mitred
   right-angle corner has its outer point cut back along the diagonal by m·√2·W (m = optimum mitre fraction). */
function polyOutline(pts, W, mitre){
  const n = pts.length, h = W / 2, L = [], R = [];
  const dir = (a, b) => { const l = dist(a, b); return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
  const nrm = u => ({ x: -u.y, y: u.x });
  for(let i = 0; i < n; i++){
    if(i === 0 || i === n - 1){ const u = i === 0 ? dir(pts[0], pts[1]) : dir(pts[n - 2], pts[n - 1]), q = nrm(u);
      L.push(P(pts[i].x + q.x * h, pts[i].y + q.y * h)); R.push(P(pts[i].x - q.x * h, pts[i].y - q.y * h)); continue; }
    const u1 = dir(pts[i - 1], pts[i]), u2 = dir(pts[i], pts[i + 1]), n1 = nrm(u1), n2 = nrm(u2);
    const bis = { x: n1.x + n2.x, y: n1.y + n2.y }, bl = Math.hypot(bis.x, bis.y), cosh2 = (n1.x * n2.x + n1.y * n2.y + 1) / 2;
    const k = h / Math.sqrt(Math.max(cosh2, 1e-9)), off = { x: bis.x / bl * k, y: bis.y / bl * k };
    const pl = P(pts[i].x + off.x, pts[i].y + off.y), pr = P(pts[i].x - off.x, pts[i].y - off.y);
    const cross = u1.x * u2.y - u1.y * u2.x, right90 = Math.abs(u1.x * u2.x + u1.y * u2.y) < 1e-6;
    // the outer side of the turn is L for a right (clockwise on screen) turn when cross > 0
    const outerIsL = cross < 0;
    if(mitre && right90){
      const cut = mitre * Math.SQRT2 * W, o = outerIsL ? pl : pr;      // cut back from the outer corner along both outer edges
      const a = P(o.x - u1.x * cut, o.y - u1.y * cut), b = P(o.x + u2.x * cut, o.y + u2.y * cut);
      if(outerIsL){ L.push(a, b); R.push(pr); } else { R.push(a, b); L.push(pl); }
    } else { L.push(pl); R.push(pr); }
  }
  return L.concat(R.reverse());
}
// A circular-arc centreline from p0 to p1 of radius r; sweep 1 = clockwise on screen.
function arcPath(p0, p1, r, large, sweep, phi){
  return { d: 'M' + f3(p0.x) + ' ' + f3(p0.y) + ' A' + f3(r) + ' ' + f3(r) + ' 0 ' + (large ? 1 : 0) + ' ' + sweep + ' ' + f3(p1.x) + ' ' + f3(p1.y),
    len: r * phi, arc: { p0, p1, r, large, sweep, phi } };
}
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. SECTION SHAPES ─────────────────────────────────────────
/* A section from (x0, y0) to (x0 + dx, y0), bulging toward sgn·y (−1 up, +1 down), centreline length len.
   shape = { kind: 'straight' | 'arc' | 'mitred' | 'meander', phi (arc angle, rad), turns, gap (mm, edge to edge),
   bend: 'mitre' | 'round' }. Natural dx (for the shared node spacing): */
function naturalDx(kind, len, opt, pitch){
  switch(kind){
    case 'arc': { const phi = opt.phi || Math.PI; return 2 * (len / phi) * Math.sin(phi / 2); }
    case 'mitred': return len / 2;
    case 'meander': return 2 * opt.turnsFit * pitch;
    default: return len;
  }
}
// Fit length len into the run dx. Returns { path, kind, spec, rise, warn[] }.
function fitSection(kind, x0, y0, dx, len, sgn, W, opt, pitch, h){
  const warn = [];
  if(kind === 'arc'){
    // chord dx, arc length len: sin(φ/2)/(φ/2) = dx/len, φ ∈ (0, 2π)
    const q = Math.min(dx / len, 1 - 1e-9); let lo = 1e-6, hi = 2 * Math.PI - 1e-6;
    for(let i = 0; i < 80; i++){ const m = (lo + hi) / 2; if(Math.sin(m / 2) / (m / 2) > q) lo = m; else hi = m; }
    const phi = (lo + hi) / 2, r = len / phi;
    const path = arcPath(P(x0, y0), P(x0 + dx, y0), r, phi > Math.PI, sgn < 0 ? 1 : 0, phi);
    const rise = r * (1 - Math.cos(phi / 2));
    if(r < 3 * W) warn.push('radius ' + r.toFixed(2) + ' mm < 3W = ' + (3 * W).toFixed(2) + ' mm');
    return { path, kind, rise, spec: { r, phi }, warn };
  }
  if(kind === 'mitred' || kind === 'meander'){
    const round = kind === 'meander' && opt.bend === 'round', lead = kind === 'mitred' ? opt.lead : pitch / 2;
    const N = kind === 'mitred' ? 1 : opt.turnsFit, step = kind === 'mitred' ? dx - 2 * opt.lead : pitch;
    const build = A => {
      const pts = [P(x0, y0)]; let x = x0 + lead;
      for(let t = 0; t < N; t++){
        pts.push(P(x, y0), P(x, y0 + sgn * A), P(x + step, y0 + sgn * A), P(x + step, y0));
        x += step; if(t < N - 1) x += step;
      }
      pts.push(P(x0 + dx, y0));
      return polyPath(pts, round ? 'round' : 'sharp', round ? pitch / 2 : 0);
    };
    // the centreline grows by 2N per unit of fold height: two Newton steps from the sharp-corner estimate
    let A = Math.max((len - dx) / (2 * N), W);
    for(let i = 0; i < 4; i++){ A = Math.max(A + (len - build(A).len) / (2 * N), W); }
    const path = build(A);
    const spec = kind === 'mitred' ? { rise: A, run: step, lead } : { turns: N, A, pitch, gap: pitch - W, bend: round ? 'round' : 'mitre' };
    if(Math.abs(path.len - len) > 1e-3 * len) warn.push('cannot fold ' + len.toFixed(2) + ' mm into this run');
    if(kind === 'meander' && N < (opt.turns || 2)) warn.push(N + ' turn' + (N > 1 ? 's' : '') + ' fit (asked ' + opt.turns + ')');
    if(kind === 'meander' && pitch - W < 3 * h - 1e-9) warn.push('meander gap ' + (pitch - W).toFixed(2) + ' mm < 3h = ' + (3 * h).toFixed(2) + ' mm: coupling');
    if(round && pitch / 2 < 3 * W) warn.push('bend radius ' + (pitch / 2).toFixed(2) + ' mm < 3W = ' + (3 * W).toFixed(2) + ' mm');
    return { path, kind, rise: A, spec, warn, mitred: !round };
  }
  // straight: a longer arm than the run takes up the difference in a shallow bump
  if(len <= dx + 1e-9) return { path: polyPath([P(x0, y0), P(x0 + dx, y0)], 'sharp'), kind, rise: 0, spec: {}, warn };
  const a = (len - dx) / 2, run = Math.min(dx / 3, Math.max(2 * W, 1)), xa = x0 + (dx - run) / 2;
  const path = polyPath([P(x0, y0), P(xa, y0), P(xa, y0 + sgn * a), P(xa + run, y0 + sgn * a), P(xa + run, y0), P(x0 + dx, y0)], 'sharp');
  return { path, kind, rise: a, spec: { bump: a }, warn, mitred: true };
}
// ── END 3 ─────────────────────────────────────────────────────

// ── 4. TWO-ARM STAGE ──────────────────────────────────────────
/* Layout of a two-arm stage (2-way Wilkinson or T). g = { stage, ms(Z) → microstrip, z0, h, shapes[k] (per section
   index along the arm), shapeOpt, fp (footprint key), launch, pitch (port centre spacing, mm), minW }.
   Returns { els: [ { id, role, Z, W, len, path, outline?, shape, spec, warn } ], res: [ { id, R, x, y0, y1 } ],
   ports: [ { name, x, y, dir } ], bbox, warnings, nodesX }. */
function layoutTwoArm(g){
  const st = g.stage, fp = FOOTPRINTS[g.fp || '0603'], els = [], res = [], warnings = [];
  const W0 = g.ms(g.z0).W, nSec = st.arms[0].length;
  const sec = st.arms.map(arm => arm.map(s => { const m = g.ms(s.Z); return { Z: s.Z, W: m.W, len: m.lenQ, eeff: m.eeff, role: s.role }; }));
  // arm centre spacing: the widest pair at any node plus the pad gap, never below the pad pitch
  let s = fp.gap + 2 * fp.padL;
  for(let k = 0; k < nSec; k++){ const w0 = Math.max(sec[0][k].W, (sec[0][k + 1] || sec[0][k]).W), w1 = Math.max(sec[1][k].W, (sec[1][k + 1] || sec[1][k]).W);
    s = Math.max(s, (w0 + w1) / 2 + fp.gap); }
  if(g.tee) s = Math.max(s, 3 * g.h + Math.max(sec[0][0].W, sec[1][0].W));
  const y = [-s / 2, s / 2], sgn = [-1, 1];
  // input launch and junction bar
  const L0 = g.launch;
  els.push({ id: g.pfx + '.in', role: 'launch', Z: g.z0, W: W0, path: polyPath([P(-L0, 0), P(0, 0)], 'sharp'), model: false });
  const wj = Math.max(sec[0][0].W, sec[1][0].W);
  els.push({ id: g.pfx + '.jn', role: 'junction', W: wj, path: polyPath([P(0, y[0]), P(0, y[1])], 'sharp'), model: false });
  // sections
  let x = 0; const nodesX = [0];
  const pitchFor = k => (g.shapeOpt.gap != null ? g.shapeOpt.gap : 3 * g.h) + Math.max(sec[0][k].W, sec[1][k].W);
  for(let k = 0; k < nSec; k++){
    const asked = g.shapes[k] || g.shapes[0] || 'straight', wmax = Math.max(sec[0][k].W, sec[1][k].W), lmin = Math.min(sec[0][k].len, sec[1][k].len);
    // a fold needs room: a meander tooth at least 7W of line (gap W/2, height 2W), a bracket 8W; else drawn straight
    const kind = (asked === 'meander' && lmin < 7 * wmax) || (asked === 'mitred' && lmin < 8 * wmax) ? 'straight' : asked;
    const tooWide = kind !== asked ? ['too wide (W = ' + wmax.toFixed(2) + ' mm) to fold ' + lmin.toFixed(1) + ' mm: drawn straight'] : [];
    let pitch = pitchFor(k);
    const opt = Object.assign({}, g.shapeOpt, { lead: Math.max(fp.padW, 2 * wmax) });
    if(kind === 'meander'){
      /* N teeth use 2N·pitch of run and need a fold height of at least 2W: N ≤ ℓ / (2(pitch + 2W)). When even one
         tooth does not fit at the asked gap, the gap shrinks to fit (and the coupling warning shows). */
      const nmax = Math.floor(lmin / (2 * (pitch + 2 * wmax)));
      opt.turnsFit = Math.max(1, Math.min(opt.turns || 2, nmax));
      if(nmax < 1) pitch = Math.max(wmax * 1.5, lmin / 2 - 2 * wmax);
    }
    let dx = Math.min(naturalDx(kind, sec[0][k].len, opt, pitch), naturalDx(kind, sec[1][k].len, opt, pitch));
    if(kind === 'mitred') dx = Math.max(dx, 2 * opt.lead + 3 * Math.max(sec[0][k].W, sec[1][k].W));
    for(let a = 0; a < 2; a++){
      const S = sec[a][k], f = fitSection(kind, x, y[a], dx, S.len, sgn[a], S.W, opt, pitch, g.h);
      const el = { id: g.pfx + '.a' + a + '.' + k, role: S.role, arm: a, k, Z: S.Z, W: S.W, eeff: S.eeff, lenTarget: S.len, len: f.path.len, path: f.path,
        shape: kind, spec: f.spec, warn: tooWide.concat(f.warn), rise: f.rise, model: true };
      if(f.mitred || kind === 'straight') el.outline = polyOutline(f.path.pts, S.W, kind === 'straight' ? 0 : optMitre(S.W, g.h));
      if(S.W < g.minW) el.warn = el.warn.concat(['W = ' + S.W.toFixed(3) + ' mm below the ' + g.minW + ' mm minimum']);
      els.push(el);
      el.warn.forEach(w => warnings.push(el.id + ': ' + w));
    }
    x += dx; nodesX.push(x);
    if(st.res[k] != null && g.resOn !== false){
      const wa = Math.max(sec[0][k].W, (sec[0][k + 1] || sec[0][k]).W), wb = Math.max(sec[1][k].W, (sec[1][k + 1] || sec[1][k]).W);
      res.push({ id: g.pfx + '.r' + k, R: st.res[k] * (g.rMult || 1), x, y0: y[0] + wa / 2, y1: y[1] - wb / 2, fp });
    }
  }
  // output launches: forward, out to the port pitch, forward
  const lead = Math.max(1.5 * W0, 2), half = Math.max(g.pitch / 2, s / 2);
  const ports = [];
  for(let a = 0; a < 2; a++){
    const yy = y[a], ye = sgn[a] * half, pts = [P(x, yy)];
    if(Math.abs(ye - yy) > 1e-6){ pts.push(P(x + lead, yy), P(x + lead, ye)); }
    pts.push(P(x + lead + L0, ye));
    els.push({ id: g.pfx + '.out' + a, role: 'launch', Z: g.z0, W: W0, path: polyPath(pts, 'sharp'), outline: polyOutline(pts, W0, optMitre(W0, g.h)), model: false });
    ports.push({ name: 'P' + (a + 2), x: x + lead + L0, y: ye, dir: 0 });
  }
  ports.unshift({ name: 'P1', x: -L0, y: 0, dir: Math.PI });
  const out = { els, res, ports, nodesX, s, warnings, W0 };
  out.bbox = bboxOf(out);
  return out;
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. BOUNDING BOX ───────────────────────────────────────────
// Extent of all copper and resistor pads: polyline outlines or centrelines ± W/2, arcs from their circle and extremes.
function bboxOf(L){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const pt = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for(const e of L.els){
    const h = e.W / 2;
    if(e.outline) e.outline.forEach(p => pt(p.x, p.y));
    else if(e.path.arc){
      const a = e.path.arc, mx = (a.p0.x + a.p1.x) / 2, c = dist(a.p0, a.p1) / 2;
      const off = Math.sqrt(Math.max(a.r * a.r - c * c, 0)), bulge = a.sweep === 1 ? -1 : 1;     // sweep 1: bulges up (−y)
      const cy = a.p0.y - bulge * (a.large ? -off : off), cxx = mx;
      // sample the arc densely (exact enough for a readout at 0.01 mm)
      const a0 = Math.atan2(a.p0.y - cy, a.p0.x - cxx); let a1 = Math.atan2(a.p1.y - cy, a.p1.x - cxx);
      const dirn = a.sweep === 1 ? 1 : -1; let span = (a1 - a0) * dirn; while(span <= 0) span += 2 * Math.PI; if(Math.abs(span - a.phi) > 1e-3) span = a.phi;
      for(let i = 0; i <= 360; i++){ const t = a0 + dirn * span * i / 360, rr = [a.r - h, a.r + h];
        rr.forEach(r => pt(cxx + r * Math.cos(t), cy + r * Math.sin(t))); }
    } else if(e.path.pts){
      if(e.path.corner === 'round'){ // round meander: sample along its points; corners lie inside the sharp polyline
        e.path.pts.forEach(p => { pt(p.x - h, p.y - h); pt(p.x + h, p.y + h); });
      } else e.path.pts.forEach((p, i, arr) => {
        const q = arr[i === 0 ? 1 : i - 1], horiz = Math.abs(q.y - p.y) < 1e-9;
        if(horiz) { pt(p.x, p.y - h); pt(p.x, p.y + h); } else { pt(p.x - h, p.y); pt(p.x + h, p.y); }
      });
    }
  }
  for(const r of L.res || []){ const fp = r.fp, ym = (r.y0 + r.y1) / 2, half = Math.max(fp.gap / 2 + fp.padL, (r.y1 - r.y0) / 2);
    pt(r.x - fp.padW / 2, ym - half); pt(r.x + fp.padW / 2, ym + half); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, area: (x1 - x0) * (y1 - y0) };
}
// Total centreline length of the modelled sections (and of every trace).
function traceTotals(L){
  let sec = 0, all = 0; L.els.forEach(e => { if(e.role === 'junction') return; all += e.path.len; if(e.model) sec += e.path.len; });
  return { sec, all };
}
// ── END 5 ─────────────────────────────────────────────────────
