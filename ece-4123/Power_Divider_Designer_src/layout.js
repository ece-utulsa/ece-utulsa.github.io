/* Power Divider Designer — layout: the to-scale microstrip top view (mm). Pure geometry, no DOM.
   ============================================================
   TABLE OF CONTENTS
   1. Footprints        — 0402 / 0603 resistor land patterns
   2. Centreline paths  — polylines with sharp, optimum-mitre or round corners; arcs; lengths; outlines
   3. Section shapes    — straight, arc (ring), mitred bracket, meander, each fitted to λg/4 along its centreline
   4. Placement         — quarter-turn transforms (a stage drawn in its own frame, placed rotated in a tree)
   5. Two-arm stage     — junction, arms, resistors, output transformers, rule checks
   6. Star stage        — N lanes, star resistors to an air-bridged centre (non-planar for N > 2)
   7. Resistive         — Y (and Δ for N = 2) single dividers; resistive-Y tree junction
   8. Single divider    — a stage with its input launch and output launches fanned to the port pitch
   9. Tree              — binary or H-tree placement, interconnects, output lines with delay lines (equal paths)
   10. Bounding box and totals
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
/* A circular-arc centreline from p0 to p1 of radius r and angle phi; sweep 1 = clockwise on screen. Written as two
   half-arcs (each under 180°) at 1 µm resolution: a single arc near 180° is ill-conditioned, its drawn length would
   follow the rounding of r. */
const f6 = v => (Math.round(v * 1e6) / 1e6).toString();
function arcPath(p0, p1, r, large, sw, phi){
  const arc = { p0, p1, r, large, sweep: sw, phi }, c = arcCentre(arc), t0 = Math.atan2(p0.y - c.y, p0.x - c.x), tm = t0 + (sw ? 1 : -1) * phi / 2;
  const m = P(c.x + r * Math.cos(tm), c.y + r * Math.sin(tm)), A = q => ' A' + f6(r) + ' ' + f6(r) + ' 0 0 ' + sw + ' ' + f6(q.x) + ' ' + f6(q.y);
  return { d: 'M' + f6(p0.x) + ' ' + f6(p0.y) + A(m) + A(p1), len: r * phi, arc };
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

// ── 4. PLACEMENT ──────────────────────────────────────────────
/* A transform { x, y, q }: global = (x, y) + R(q)·local, R a quarter-turn clockwise on screen q times
   (q = 1: local +x points down). Elements keep their local geometry and carry their transform. */
const TF0 = { x: 0, y: 0, q: 0 };
function rotQ(p, q){ switch(((q % 4) + 4) % 4){ case 1: return P(-p.y, p.x); case 2: return P(-p.x, -p.y); case 3: return P(p.y, -p.x); default: return P(p.x, p.y); } }
const applyTf = (tf, p) => { const r = rotQ(p, tf.q); return P(tf.x + r.x, tf.y + r.y); };
const composeTf = (a, b) => { const o = applyTf(a, P(b.x, b.y)); return { x: o.x, y: o.y, q: (a.q + b.q) % 4 }; };
// Re-place a geometry { els, res, labels } under the transform tf (composed with any it already has).
function placeGeom(gm, tf){
  const re = x => Object.assign({}, x, { tf: composeTf(tf, x.tf || TF0) });
  return { els: gm.els.map(re), res: gm.res.map(re), labels: (gm.labels || []).map(re) };
}
// A z0 line along a polyline: modelled (an interconnect or output line) or not (a launch).
function zLine(id, role, pts, W0, h, model, extra){
  const path = polyPath(pts, 'sharp');
  return Object.assign({ id, role, W: W0, path, outline: polyOutline(pts, W0, optMitre(W0, h)), model, len: path.len }, extra || {});
}
/* Fan N lane ends (x, ys[i]) heading +x out to the port positions yp[i]: the outer lanes turn first so no two lines
   cross. Returns the polylines, all ending at xEnd. */
function fanOut(x, ys, yp, lead, step, xEnd){
  const N = ys.length, mid = (N - 1) / 2;
  return ys.map((y, i) => {
    const pts = [P(x, y)];
    if(Math.abs(yp[i] - y) > 1e-6){ const xt = x + lead + step * (Math.ceil(mid) - Math.abs(i - mid)); pts.push(P(xt, y), P(xt, yp[i])); }
    pts.push(P(xEnd, yp[i]));
    return pts;
  });
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. TWO-ARM STAGE ──────────────────────────────────────────
/* Microstrip of every section of a stage's arms. */
const secOf = (st, ms) => st.arms.map(arm => arm.map(s => { const m = ms(s.Z); return { Z: s.Z, W: m.W, len: m.lenQ, eeff: m.eeff, role: s.role }; }));
/* Draw the sections of one lane set. lanes = [{ y, sgn, secs }]; all lanes share the node positions. Returns the
   elements, the node x positions and the largest rise. */
function drawSections(g, pfx, lanes, nSec){
  const els = [], nodesX = [0], fp = FOOTPRINTS[g.fp]; let x = 0, maxRise = 0;
  for(let k = 0; k < nSec; k++){
    const secs = lanes.map(l => l.secs[k]);
    const asked = (g.shapes && (g.shapes[k] || g.shapes[0])) || 'straight', wmax = Math.max(...secs.map(c => c.W)), lmin = Math.min(...secs.map(c => c.len));
    // a fold needs room: a meander tooth at least 7W of line (gap W/2, height 2W), a bracket 8W; else drawn straight
    const kind = (asked === 'meander' && lmin < 7 * wmax) || (asked === 'mitred' && lmin < 8 * wmax) ? 'straight' : asked;
    const tooWide = kind !== asked ? ['too wide (W = ' + wmax.toFixed(2) + ' mm) to fold ' + lmin.toFixed(1) + ' mm: drawn straight'] : [];
    let pitch = (g.shapeOpt.gap != null ? g.shapeOpt.gap : 3 * g.h) + wmax;
    const opt = Object.assign({}, g.shapeOpt, { lead: Math.max(fp.padW, 2 * wmax) });
    if(kind === 'meander'){
      /* N teeth use 2N·pitch of run and need a fold height of at least 2W: N ≤ ℓ / (2(pitch + 2W)). When even one
         tooth does not fit at the asked gap, the gap shrinks to fit (and the coupling warning shows). */
      const nmax = Math.floor(lmin / (2 * (pitch + 2 * wmax)));
      opt.turnsFit = Math.max(1, Math.min(opt.turns || 2, nmax));
      if(nmax < 1) pitch = Math.max(wmax * 1.5, lmin / 2 - 2 * wmax);
    }
    let dx = Math.min(...secs.map(c => naturalDx(kind, c.len, opt, pitch)));
    if(kind === 'mitred') dx = Math.max(dx, 2 * opt.lead + 3 * wmax);
    lanes.forEach((ln, a) => {
      const c = ln.secs[k], f = fitSection(kind, x, ln.y, dx, c.len, ln.sgn, c.W, opt, pitch, g.h);
      const it = { id: pfx + '.a' + a + '.' + k, role: c.role, arm: a, k, Z: c.Z, W: c.W, eeff: c.eeff, lenTarget: c.len, len: f.path.len, path: f.path,
        shape: kind, spec: f.spec, warn: tooWide.concat(f.warn), rise: f.rise, model: true };
      if(f.mitred || kind === 'straight') it.outline = polyOutline(f.path.pts, c.W, kind === 'straight' ? 0 : optMitre(c.W, g.h));
      if(c.W < g.minW) it.warn = it.warn.concat(['W = ' + c.W.toFixed(3) + ' mm below the ' + g.minW + ' mm minimum']);
      maxRise = Math.max(maxRise, f.rise + c.W / 2);
      els.push(it);
    });
    x += dx; nodesX.push(x);
  }
  return { els, nodesX, maxRise, lastShape: els.slice(-lanes.length).map(e => ({ kind: e.shape, spec: e.spec, W: e.W })) };
}
/* A two-arm stage (2-way Wilkinson or branching line) in its own frame: input at (0, 0) heading +x, arm 0 (to the
   first output) above, arm 1 below; ends at (xEnd, ∓s/2). */
function stageTwoArm(g, st, pfx){
  const fp = FOOTPRINTS[g.fp], sec = secOf(st, g.ms), nSec = sec[0].length, res = [];
  // arm centre spacing: the widest pair at any resistor node plus the pad gap, never below the land pattern
  let s = fp.gap + 2 * fp.padL;
  for(let k = 0; k < nSec; k++){ const w0 = Math.max(sec[0][k].W, (sec[0][k + 1] || sec[0][k]).W), w1 = Math.max(sec[1][k].W, (sec[1][k + 1] || sec[1][k]).W);
    s = Math.max(s, (w0 + w1) / 2 + fp.gap); }
  if(st.tee) s = Math.max(s, 3 * g.h + Math.max(sec[0][0].W, sec[1][0].W));
  const y = [-s / 2, s / 2];
  const d = drawSections(g, pfx, [{ y: y[0], sgn: -1, secs: sec[0] }, { y: y[1], sgn: 1, secs: sec[1] }], nSec);
  const els = [{ id: pfx + '.jn', role: 'junction', W: Math.max(sec[0][0].W, sec[1][0].W), path: polyPath([P(0, y[0]), P(0, y[1])], 'sharp'), model: false }].concat(d.els);
  st.res.forEach((R, k) => {
    if(R == null || g.resOn === false) return;
    const x = d.nodesX[k + 1], wa = Math.max(sec[0][k].W, (sec[0][k + 1] || sec[0][k]).W), wb = Math.max(sec[1][k].W, (sec[1][k + 1] || sec[1][k]).W);
    res.push({ id: pfx + '.r' + k, R: R * (g.rMult || 1), a: P(x, y[0] + wa / 2), b: P(x, y[1] - wb / 2), fp });
  });
  const xEnd = d.nodesX[nSec];
  const last = sec.map(a => a[a.length - 1]), W0 = g.ms(g.z0).W, clr = 0.3;
  /* The outputs leave as two separate z0 lines that turn straight outward at the output node (s apart, so they never
     merge). Where the last section's own copper is in the way — an arc arriving vertically, or the last leg of a meander
     or bracket closer than the z0 half-width — each arm first continues at its own width for the shortest stub that
     clears it. */
  const stub = Math.max(0, ...d.lastShape.map(ls => {
    if(ls.kind === 'arc') return ls.W / 2 + W0 / 2 + clr;
    if(ls.kind === 'meander') return W0 / 2 + clr - (ls.spec.pitch / 2 - ls.W / 2);
    if(ls.kind === 'mitred') return W0 / 2 + clr - (ls.spec.lead - ls.W / 2);
    return 0;
  }));
  return { els, res, labels: [], ends: [P(xEnd, y[0]), P(xEnd, y[1])], xEnd, s, half: s / 2 + d.maxRise, nodesX: d.nodesX,
    stub, endW: last.map(c => c.W), endZ: last.map(c => c.Z) };
}
// ── END 5 ─────────────────────────────────────────────────────

// ── 6. STAR STAGE ─────────────────────────────────────────────
/* N lanes, every section bulging up; at each resistor node every lane has a resistor down to a tap, and the taps meet
   at the star centre over an air bridge (drawn dashed: an N-way Wilkinson is not planar for N > 2). */
function stageStar(g, st, pfx){
  const fp = FOOTPRINTS[g.fp], sec = secOf(st, g.ms), N = sec.length, nSec = sec[0].length, Lr = fp.gap + 2 * fp.padL;
  // lane pitch from a trial with all lanes on one line
  const trial = drawSections(g, pfx, sec.map(c => ({ y: 0, sgn: -1, secs: c })), nSec);
  const wmax = Math.max(...sec.flat().map(c => c.W)), hasR = st.res.some(r => r != null) && g.resOn !== false;
  const Ls = trial.maxRise + wmax / 2 + Math.max(3 * g.h, 1) + (hasR ? Lr + 0.5 : 0);
  const ys = sec.map((c, i) => (i - (N - 1) / 2) * Ls);
  const d = drawSections(g, pfx, sec.map((c, i) => ({ y: ys[i], sgn: -1, secs: c })), nSec);
  const els = [{ id: pfx + '.jn', role: 'junction', W: Math.max(...sec.map(c => c[0].W)), path: polyPath([P(0, ys[0]), P(0, ys[N - 1])], 'sharp'), model: false }].concat(d.els);
  const res = [], labels = [];
  st.res.forEach((R, k) => {
    if(R == null || g.resOn === false) return;
    const x = d.nodesX[k + 1], taps = [];
    ys.forEach((yy, i) => { const w = Math.max(sec[i][k].W, (sec[i][k + 1] || sec[i][k]).W), a0 = P(x, yy + w / 2), b0 = P(x, yy + w / 2 + Lr);
      res.push({ id: pfx + '.r' + k + '.' + i, R: R * (g.rMult || 1), a: a0, b: b0, fp }); taps.push(b0); });
    if(N > 1) labels.push({ kind: 'bridge', id: pfx + '.r' + k, pts: [taps[0], taps[N - 1]], x, y: (ys[0] + ys[N - 1]) / 2 });
  });
  const xEnd = d.nodesX[nSec];
  return { els, res, labels, ends: ys.map(yy => P(xEnd, yy)), xEnd, s: Ls, half: ys[N - 1] + Ls / 2, ys };
}
// ── END 6 ─────────────────────────────────────────────────────

// ── 7. RESISTIVE ──────────────────────────────────────────────
// Copper pad (a square z0-wide stub) as a not-modelled element.
const padEl = (id, c, w) => ({ id, role: 'pad', W: w, path: polyPath([P(c.x - w / 2, c.y), P(c.x + w / 2, c.y)], 'sharp'), outline: polyOutline([P(c.x - w / 2, c.y), P(c.x + w / 2, c.y)], w, 0), model: false });
/* Resistive divider, N outputs, as a single stage. Y: input resistor to a centre bar, one resistor per output lane.
   Δ (N = 2): three resistors on a triangle of pads. Ends at (xEnd, ys[i]). */
function stageResistive(g, st, pfx){
  const fp = FOOTPRINTS[g.fp], Lr = fp.gap + 2 * fp.padL, W0 = g.ms(g.z0).W, N = st.N, pw = Math.max(W0, fp.padW);
  const els = [], res = [];
  if(st.form === 'delta'){
    const A = P(0, 0), B = P(Lr * Math.cos(Math.PI / 6) + pw, -Lr / 2 - pw / 2), Cc = P(B.x, -B.y);
    [['A', A], ['B', B], ['C', Cc]].forEach(([n, c]) => els.push(padEl(pfx + '.p' + n, c, pw)));
    res.push({ id: pfx + '.r01', R: st.R, a: A, b: B, fp }, { id: pfx + '.r02', R: st.R, a: A, b: Cc, fp }, { id: pfx + '.r12', R: st.R, a: B, b: Cc, fp });
    return { els, res, labels: [], ends: [B, Cc], xEnd: B.x + pw / 2, s: Cc.y - B.y, ys: [B.y, Cc.y] };
  }
  const lane = Math.max(pw + 1, fp.padW + 1.2), ys = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * lane);
  const xc = Lr + pw / 2;                                             // centre bar
  els.push({ id: pfx + '.c', role: 'pad', W: pw, path: polyPath([P(xc, ys[0] - pw / 2), P(xc, ys[N - 1] + pw / 2)], 'sharp'), model: false });
  res.push({ id: pfx + '.r0', R: st.R, a: P(0, 0), b: P(xc - pw / 2, 0), fp });
  ys.forEach((yy, i) => { const e = P(xc + pw / 2 + Lr, yy); res.push({ id: pfx + '.r' + (i + 1), R: st.R, a: P(xc + pw / 2, yy), b: e, fp }); els.push(padEl(pfx + '.p' + i, P(e.x + pw / 2, yy), pw)); });
  const xEnd = xc + pw / 2 + Lr + pw;
  return { els, res, labels: [], ends: ys.map(yy => P(xEnd, yy)), xEnd, s: lane, ys };
}
/* Resistive-Y tree junction (two outputs): input resistor, centre pad, one resistor up and one down; ends heading +x. */
function stageResY(g, st, pfx){
  const fp = FOOTPRINTS[g.fp], Lr = fp.gap + 2 * fp.padL, W0 = g.ms(g.z0).W, pw = Math.max(W0, fp.padW);
  const xc = Lr + pw / 2, e0 = P(xc, -pw / 2 - Lr - pw / 2), e1 = P(xc, pw / 2 + Lr + pw / 2);
  const els = [padEl(pfx + '.c', P(xc, 0), pw), padEl(pfx + '.p0', e0, pw), padEl(pfx + '.p1', e1, pw)];
  const res = [{ id: pfx + '.r0', R: st.R, a: P(0, 0), b: P(xc - pw / 2, 0), fp }, { id: pfx + '.r1', R: st.R, a: P(xc, -pw / 2), b: P(xc, e0.y + pw / 2), fp },
    { id: pfx + '.r2', R: st.R, a: P(xc, pw / 2), b: P(xc, e1.y - pw / 2), fp }];
  return { els, res, labels: [], ends: [P(xc + pw / 2, e0.y), P(xc + pw / 2, e1.y)], xEnd: xc + pw / 2, s: e1.y - e0.y, half: e1.y + pw / 2 };
}
// ── END 7 ─────────────────────────────────────────────────────

// ── 8. SINGLE DIVIDER ─────────────────────────────────────────
/* A single divider (Wilkinson 2-way or N-way, T, resistive) with its input launch and the output launches fanned out to
   the port pitch. Launches are drawn, not modelled: the ports are at the divider's terminals. */
function layoutSingle(g, design){
  const st = design.stage, W0 = g.ms(g.z0).W, L0 = g.launch, pfx = 'x';
  const sg = st.kind === 'resistive' ? stageResistive(g, st, pfx) : st.kind === 'star' ? stageStar(g, st, pfx) : stageTwoArm(g, st, pfx);
  const els = sg.els.slice(), N = sg.ends.length;
  els.unshift(zLine(pfx + '.in', 'launch', [P(-L0, 0), P(0, 0)], W0, g.h, false));
  const ys = sg.ends.map(e => e.y), span = Math.max(g.pitch * (N - 1), ys[N - 1] - ys[0]);
  const yp = ys.map((y, i) => N === 1 ? y : -span / 2 + span * i / (N - 1));
  if(sg.stub != null){
    // two-arm: (a stub at the arm's width if needed, then) the z0 line turns straight out to the port pitch and runs to the edge
    const xs = sg.xEnd + sg.stub, half = Math.max(span / 2, sg.s / 2, (W0 + 1) / 2), xEnd = xs + Math.max(L0, W0);
    sg.ends.forEach((e, i) => {
      if(sg.stub > 1e-9) els.push({ id: pfx + '.st' + i, role: 'stub', Z: sg.endZ[i], W: sg.endW[i], path: polyPath([e, P(xs, e.y)], 'sharp'), outline: polyOutline([e, P(xs, e.y)], sg.endW[i], 0), model: false });
      const yo = (i === 0 ? -1 : 1) * half;
      els.push(zLine(pfx + '.out' + i, 'launch', [P(xs, e.y), P(xs, yo), P(xEnd, yo)], W0, g.h, false, { port: i }));
    });
    const ports = [{ name: 'P1', at: P(-L0, 0), dir: 2, i: 0 }].concat([-half, half].map((y, i) => ({ name: 'P' + (i + 2), at: P(xEnd, y), dir: 0, i: i + 1 })));
    return finish({ els, res: sg.res, labels: sg.labels, ports, s: sg.s, W0 });
  }
  const lead = Math.max(1.5 * W0, 2), step = W0 + Math.max(1, 3 * g.h), xEnd = sg.xEnd + lead + step * Math.ceil((N - 1) / 2) + L0;
  fanOut(sg.xEnd, ys, yp, lead, step, xEnd).forEach((pts, i) => { pts[0] = sg.ends[i]; els.push(zLine(pfx + '.out' + i, 'launch', pts, W0, g.h, false, { port: i })); });
  const ports = [{ name: 'P1', at: P(-L0, 0), dir: 2, i: 0 }].concat(yp.map((y, i) => ({ name: 'P' + (i + 2), at: P(xEnd, y), dir: 0, i: i + 1 })));
  return finish({ els, res: sg.res, labels: sg.labels, ports, s: sg.s, W0 });
}
// ── END 8 ─────────────────────────────────────────────────────

// ── 9. TREE ───────────────────────────────────────────────────
/* Corporate tree. Every junction is drawn in its own frame and placed: binary — all junctions heading +x, the two
   subtrees above and below, far enough apart that their boxes clear; H-tree — the subtrees turn up and down (and the
   next level left and right…), the classic H. Interconnects ('ic<path><k>') and output lines ('o<i>') are z0 lines and
   are modelled; their electrical lengths are returned in lens. Every output line carries a delay line (a square-wave
   serpentine) that brings its path to the longest path's electrical length, so all outputs are in phase at f0
   (g.equalise; g.pathErr adds an extra length to output 1 to show the imbalance). */
function layoutTree(g, design){
  const T = design.tree, W0 = g.ms(g.z0).W, lg0 = g.ms(g.z0).lambdaG, L0 = g.launch, h = g.h;
  const lead = Math.max(1.5 * W0, 2), clr = Math.max(2 * W0, 3 * h, 1.5), H = g.treeLayout === 'H' && (T.N & (T.N - 1)) === 0;
  const els = [], res = [], labels = [], lens = {}, zs = {}, leaves = [], warnings = [];
  const leafHalf = Math.max(g.pitch / 2, W0 / 2 + clr / 2), stages = new Map();      // stage geometry per junction (own frame)
  // place(nd, tf): draws the subtree at transform tf; returns its box in tf's frame
  const place = (nd, tf, thPath, delayRun) => {
    if(nd.leaf){ leaves.push({ nd, tf, th: thPath }); return { x0: 0, x1: H ? delayRun : 0, y0: -leafHalf, y1: leafHalf }; }
    const pfx = 'j' + nd.path, st = nd.stage;
    if(!stages.has(nd.path)) stages.set(nd.path, st.kind === 'resY' ? stageResY(g, st, pfx) : stageTwoArm(g, st, pfx));
    const sg = stages.get(nd.path);
    const local = { x0: 0, x1: sg.xEnd, y0: -sg.half, y1: sg.half };
    const thArm = k => st.kind === 'resY' ? 0 : st.arms[k].length * Math.PI / 2;
    // children boxes in their own frames (a dry run), then their offsets
    const dry = nd.children.map(c => measure(c));
    let d0, d1;
    if(!H){
      d0 = d1 = Math.max((dry[0].y1 - dry[1].y0 + clr) / 2, sg.s / 2 + W0);
    } else {
      d0 = Math.max(sg.half + clr - dry[0].x0, sg.s / 2 + lead); d1 = Math.max(sg.half + clr - dry[1].x0, sg.s / 2 + lead);
    }
    const xv = sg.xEnd + (sg.stub != null ? sg.stub : lead), box = Object.assign({}, local);
    const grow = (bx, ctf) => { [P(bx.x0, bx.y0), P(bx.x1, bx.y0), P(bx.x0, bx.y1), P(bx.x1, bx.y1)].forEach(p => { const q = applyTf(ctf, p);
      box.x0 = Math.min(box.x0, q.x); box.x1 = Math.max(box.x1, q.x); box.y0 = Math.min(box.y0, q.y); box.y1 = Math.max(box.y1, q.y); }); };
    const g0 = placeGeom(sg, tf); els.push(...g0.els); res.push(...g0.res); labels.push(...g0.labels);
    nd.children.forEach((c, k) => {
      const yc = k === 0 ? -d0 : d1, e0 = sg.ends[k], id = 'ic' + nd.path + k;
      let thStub = 0, e = e0;
      if(sg.stub > 1e-9){
        const sid = 'sb' + nd.path + k, sp = [e0, P(xv, e0.y)], m = g.ms(sg.endZ[k]);
        els.push(placeGeom({ els: [{ id: sid, role: 'stub', Z: sg.endZ[k], W: sg.endW[k], path: polyPath(sp, 'sharp'), outline: polyOutline(sp, sg.endW[k], 0), model: true, grp: pfx }], res: [] }, tf).els[0]);
        thStub = lens[sid] = 2 * Math.PI * dist(sp[0], sp[1]) / m.lambdaG; zs[sid] = sg.endZ[k]; e = sp[1];
      }
      const pts = [e]; if(Math.abs(yc - e.y) > 1e-9){ if(Math.abs(e.x - xv) > 1e-9) pts.push(P(xv, e.y)); pts.push(P(xv, yc)); }
      let ctf;
      if(H){ ctf = { x: xv, y: yc, q: k === 0 ? 3 : 1 }; if(pts.length === 1) pts.push(P(xv, e.y)); }
      else { pts.push(P(xv + lead, yc)); ctf = { x: xv + lead, y: yc, q: 0 }; }
      const line = zLine(id, 'ic', pts, W0, h, true, { grp: pfx });
      const ln = placeGeom({ els: [line], res: [] }, tf).els[0]; els.push(ln);
      lens[id] = 2 * Math.PI * line.path.len / lg0;
      const cb = place(c, composeTf(tf, ctf), thPath + thArm(k) + thStub + lens[id], delayRun);
      grow(cb, ctf); grow({ x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) }, TF0);
    });
    return box;
  };
  // measure: the box of a subtree in its own frame (a dry run, nothing kept; memoised per junction)
  const boxes = new Map();
  const measure = nd => {
    if(boxes.has(nd.path)) return boxes.get(nd.path);
    const keep = [els.length, res.length, labels.length, leaves.length], b = place(nd, TF0, 0, delayRunH);
    els.length = keep[0]; res.length = keep[1]; labels.length = keep[2]; leaves.length = keep[3]; boxes.set(nd.path, b); return b; };
  let delayRunH = 2 * lead + L0;
  place(T.root, TF0, 0, delayRunH);
  // output lines: equalise every path to the longest
  const baseRun = H ? lead + L0 : 0;
  let xOut = 0; leaves.forEach(l => { xOut = Math.max(xOut, applyTf(l.tf, P(0, 0)).x); }); xOut += lead;
  const leafPos = leaves.map(l => applyTf(l.tf, P(0, 0)));
  const runLen = leaves.map((l, i) => H ? baseRun : xOut - leafPos[i].x);
  const thLeaf = leaves.map((l, i) => l.th + 2 * Math.PI * runLen[i] / lg0);
  const thMax = Math.max(...thLeaf);
  const order = leafPos.map((p, i) => i).sort((a, b) => leafPos[a].y - leafPos[b].y);
  let eqRun = 0; const plan = [];
  leaves.forEach((l, i) => {
    let dL = g.equalise === false ? 0 : (thMax - thLeaf[i]) / (2 * Math.PI) * lg0;
    if(l.nd.idx === 0) dL += g.pathErr || 0;
    // room for the serpentine: half the gap to the nearest neighbouring output line
    let room = 6 * W0;
    if(!H){ const j = order.indexOf(i), up = j > 0 ? leafPos[i].y - leafPos[order[j - 1]].y : Infinity, dn = j < order.length - 1 ? leafPos[order[j + 1]].y - leafPos[i].y : Infinity;
      room = Math.min(up, dn) / 2 - W0 - 0.2; if(!isFinite(room)) room = 6 * W0; }
    const a = Math.max(room, W0), p = Math.max(3 * W0, 1), n = dL > 1e-3 ? Math.ceil(dL / (4 * a)) : 0;
    plan.push({ dL, n, amp: n ? dL / (4 * n) : 0, p });
    eqRun = Math.max(eqRun, n * 2 * p + p);
  });
  if(eqRun > 0 && !H) eqRun += lead;
  const xPort = xOut + eqRun + L0;
  leaves.forEach((l, i) => {
    const pl = plan[i], id = 'o' + l.nd.idx;
    let pts, ltf;
    if(H){ ltf = l.tf; const start = P(0, 0), x1 = lead; pts = [start, P(x1, 0)].concat(serp(x1, 0, pl)); const xe = (pts[pts.length - 1].x) + L0; pts.push(P(xe, 0)); }
    else { ltf = TF0; const p0 = leafPos[i]; pts = [p0, P(xOut, p0.y)].concat(serp(xOut, p0.y, pl)); pts.push(P(xPort, p0.y)); }
    pts = dedupe(pts);
    const line = zLine(id, 'out', pts, W0, h, true, { port: l.nd.idx, delay: pl.dL, delayN: pl.n });
    const placed = placeGeom({ els: [line], res: [] }, ltf).els[0]; els.push(placed);
    lens[id] = 2 * Math.PI * line.path.len / lg0;
    l.port = { name: 'P' + (l.nd.idx + 2), at: applyTf(ltf, pts[pts.length - 1]), dir: ltf.q, i: l.nd.idx + 1 };
  });
  // root input launch (drawn, not modelled)
  els.push(zLine('in', 'launch', [P(-L0, 0), P(0, 0)], W0, h, false));
  const ports = [{ name: 'P1', at: P(-L0, 0), dir: 2, i: 0 }].concat(leaves.map(l => l.port).sort((a, b) => a.i - b.i));
  const out = finish({ els, res, labels, ports, W0, lens, zs, warnings, thMax, thLeaf: leaves.map((l, i) => ({ idx: l.nd.idx, th: thLeaf[i] + 2 * Math.PI * plan[i].dL / lg0 })) });
  return out;
}
// Square-wave serpentine adding plan.dL of line: n periods of (up a, across p, down 2a, across p, up a), from (x, y).
function serp(x, y, pl){
  if(!pl.n) return [];
  const pts = []; let xx = x + pl.p / 2;
  for(let i = 0; i < pl.n; i++){ pts.push(P(xx, y), P(xx, y - pl.amp), P(xx + pl.p, y - pl.amp), P(xx + pl.p, y + pl.amp), P(xx + 2 * pl.p, y + pl.amp), P(xx + 2 * pl.p, y)); xx += 2 * pl.p; }
  pts.push(P(xx + pl.p / 2, y));
  return pts;
}
// Drop repeated points and merge collinear runs (keeps polyline corners clean).
function dedupe(pts){
  const o = [];
  pts.forEach(p => { if(!o.length || dist(o[o.length - 1], p) > 1e-9) o.push(p); });
  for(let i = o.length - 2; i > 0; i--){ const a = o[i - 1], b = o[i], c = o[i + 1]; if(Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-12) o.splice(i, 1); }
  return o;
}
// ── END 9 ─────────────────────────────────────────────────────

// ── 10. BOUNDING BOX AND TOTALS ───────────────────────────────
// Centre of an SVG arc (rx = ry = r, no rotation), per the SVG implementation notes (F.6.5).
function arcCentre(a){
  const x1 = (a.p0.x - a.p1.x) / 2, y1 = (a.p0.y - a.p1.y) / 2, c2 = x1 * x1 + y1 * y1;
  const k = Math.sqrt(Math.max(a.r * a.r - c2, 0) / c2) * (a.large === !!a.sweep ? -1 : 1);
  return P(k * y1 + (a.p0.x + a.p1.x) / 2, -k * x1 + (a.p0.y + a.p1.y) / 2);
}
// Sample points of an element's copper in global coordinates (outline, or the arc band, or the centreline ± W/2).
function copperPoints(e){
  const tf = e.tf || TF0, out = [], h = e.W / 2, add = p => out.push(applyTf(tf, p));
  if(e.outline) e.outline.forEach(add);
  else if(e.path.arc){
    const a = e.path.arc, c = arcCentre(a), t0 = Math.atan2(a.p0.y - c.y, a.p0.x - c.x), dir = a.sweep ? 1 : -1;
    for(let i = 0; i <= 720; i++){ const t = t0 + dir * a.phi * i / 720; [a.r - h, a.r + h].forEach(r => add(P(c.x + r * Math.cos(t), c.y + r * Math.sin(t)))); }
  } else if(e.path.pts){
    const pts = e.path.pts;
    if(e.path.corner === 'round') pts.forEach(p => { add(P(p.x - h, p.y - h)); add(P(p.x + h, p.y + h)); });
    else pts.forEach((p, i) => { const q = pts[i === 0 ? 1 : i - 1], horiz = Math.abs(q.y - p.y) < 1e-9;
      if(horiz){ add(P(p.x, p.y - h)); add(P(p.x, p.y + h)); } else { add(P(p.x - h, p.y)); add(P(p.x + h, p.y)); } });
  }
  return out;
}
// Corners of a resistor's land pattern (pads and any stubs) in global coordinates.
function resistorPoints(r){
  const tf = r.tf || TF0, fp = r.fp, L = dist(r.a, r.b), u = { x: (r.b.x - r.a.x) / (L || 1), y: (r.b.y - r.a.y) / (L || 1) }, n = { x: -u.y, y: u.x };
  const m = P((r.a.x + r.b.x) / 2, (r.a.y + r.b.y) / 2), half = Math.max(fp.gap / 2 + fp.padL, L / 2), w = fp.padW / 2;
  return [[-half, -w], [-half, w], [half, -w], [half, w]].map(([s, t]) => applyTf(tf, P(m.x + u.x * s + n.x * t, m.y + u.y * s + n.y * t)));
}
function bboxOf(L){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const pt = p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  L.els.forEach(e => copperPoints(e).forEach(pt));
  (L.res || []).forEach(r => resistorPoints(r).forEach(pt));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, area: (x1 - x0) * (y1 - y0) };
}
// Add the bounding box, the warnings and the trace totals to a layout.
function finish(L){
  L.bbox = bboxOf(L);
  L.warnings = (L.warnings || []).concat(...L.els.filter(e => e.warn && e.warn.length).map(e => e.warn.map(w => e.id + ': ' + w)));
  L.totals = traceTotals(L);
  return L;
}
// Total centreline length of the modelled sections, and of every trace.
function traceTotals(L){
  let sec = 0, all = 0; L.els.forEach(e => { if(e.role === 'junction' || e.role === 'pad') return; all += e.path.len; if(e.model && e.role !== 'ic' && e.role !== 'out') sec += e.path.len; });
  return { sec, all };
}
// The layout of a design: a single divider or a tree.
function layoutDesign(g, design){ return design.topology === 'tree' ? layoutTree(g, design) : layoutSingle(g, design); }
// ── END 10 ────────────────────────────────────────────────────
