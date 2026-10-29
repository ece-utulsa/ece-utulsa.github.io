/* Power Divider Designer — engine. Pure functions, no DOM.
   ============================================================
   TABLE OF CONTENTS
   1. Complex arithmetic
   2. Complex matrices       — dense re/im arrays, Gauss–Jordan inverse, linear solve
   3. Nodal solver           — lossy line π stamps, resistors, Kron reduction of internal nodes, Y → S
   4. Loaded solve           — matched source, mismatched loads, node voltages, the energy balance
   5. Microstrip             — Pozar (Wheeler) synthesis; Hammerstad–Jensen with Kirschning–Jansen dispersion
   6. Impedance tapers       — binomial and Chebyshev multisection transformers
   7. Isolation resistors    — odd-mode minimax optimisation (equal split), full-solver refinement (unequal)
   8. Divider synthesis      — Wilkinson, T-junction, resistive, corporate tree (structure only; the layout adds lengths)
   9. Network build          — structure (+ interconnect lengths) → nodes, lines, resistors, ports
   10. Analysis              — sweep, operating point, bandwidths, S-matrix checks
   ============================================================
   References: D. M. Pozar, Microwave Engineering, 4th ed., Wiley, 2012 (§3.8, §5.6–5.8, §7.1–7.3);
     E. J. Wilkinson, IRE Trans. MTT 8(1), 1960; S. B. Cohn, IEEE Trans. MTT 16(2), 1968;
     E. Hammerstad, Ø. Jensen, IEEE MTT-S Digest 1980; M. Kirschning, R. H. Jansen, Electron. Lett. 18(6), 1982. */

// ── 1. COMPLEX ARITHMETIC ─────────────────────────────────────
const C0 = 299792458;                       // speed of light (m/s)
const cx = (re, im) => ({ re, im: im || 0 });
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cscale = (a, s) => ({ re: a.re * s, im: a.im * s });
const cconj = a => ({ re: a.re, im: -a.im });
function cdiv(a, b){ const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; }
const cabs = a => Math.hypot(a.re, a.im);
const carg = a => Math.atan2(a.im, a.re);
const cpolar = (m, rad) => ({ re: m * Math.cos(rad), im: m * Math.sin(rad) });
const csinh = z => ({ re: Math.sinh(z.re) * Math.cos(z.im), im: Math.cosh(z.re) * Math.sin(z.im) });
const ccosh = z => ({ re: Math.cosh(z.re) * Math.cos(z.im), im: Math.sinh(z.re) * Math.sin(z.im) });
const dB20 = m => 20 * Math.log10(Math.max(m, 1e-12));
const DEG = 180 / Math.PI;
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. COMPLEX MATRICES ───────────────────────────────────────
// A dense n×m complex matrix: { n, m, re: Float64Array, im: Float64Array }, row-major.
const cmat = (n, m) => ({ n, m: m || n, re: new Float64Array(n * (m || n)), im: new Float64Array(n * (m || n)) });
const mget = (M, i, j) => ({ re: M.re[i * M.m + j], im: M.im[i * M.m + j] });
// Inverse by Gauss–Jordan with partial pivoting.
function cmatInv(M){
  const n = M.n, w = 2 * n, re = new Float64Array(n * w), im = new Float64Array(n * w);
  for(let i = 0; i < n; i++){ for(let j = 0; j < n; j++){ re[i * w + j] = M.re[i * n + j]; im[i * w + j] = M.im[i * n + j]; } re[i * w + n + i] = 1; }
  for(let c = 0; c < n; c++){
    let p = c, best = -1;
    for(let r = c; r < n; r++){ const a = re[r * w + c] ** 2 + im[r * w + c] ** 2; if(a > best){ best = a; p = r; } }
    if(p !== c) for(let j = 0; j < w; j++){ let t = re[p * w + j]; re[p * w + j] = re[c * w + j]; re[c * w + j] = t; t = im[p * w + j]; im[p * w + j] = im[c * w + j]; im[c * w + j] = t; }
    const dr = re[c * w + c], di = im[c * w + c], dd = dr * dr + di * di, ir = dr / dd, ii = -di / dd;
    for(let j = 0; j < w; j++){ const a = re[c * w + j], b = im[c * w + j]; re[c * w + j] = a * ir - b * ii; im[c * w + j] = a * ii + b * ir; }
    for(let r = 0; r < n; r++){
      if(r === c) continue; const fr = re[r * w + c], fi = im[r * w + c]; if(fr === 0 && fi === 0) continue;
      for(let j = 0; j < w; j++){ const a = re[c * w + j], b = im[c * w + j]; re[r * w + j] -= fr * a - fi * b; im[r * w + j] -= fr * b + fi * a; }
    }
  }
  const out = cmat(n);
  for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){ out.re[i * n + j] = re[i * w + n + j]; out.im[i * n + j] = im[i * w + n + j]; }
  return out;
}
// Solve A·x = b (A n×n, b length-n complex arrays) by Gaussian elimination with partial pivoting.
function cmatSolve(A, bre, bim){
  const n = A.n, re = Float64Array.from(A.re), im = Float64Array.from(A.im), xr = Float64Array.from(bre), xi = Float64Array.from(bim);
  for(let c = 0; c < n; c++){
    let p = c, best = -1;
    for(let r = c; r < n; r++){ const a = re[r * n + c] ** 2 + im[r * n + c] ** 2; if(a > best){ best = a; p = r; } }
    if(p !== c){ for(let j = c; j < n; j++){ let t = re[p * n + j]; re[p * n + j] = re[c * n + j]; re[c * n + j] = t; t = im[p * n + j]; im[p * n + j] = im[c * n + j]; im[c * n + j] = t; }
      let t = xr[p]; xr[p] = xr[c]; xr[c] = t; t = xi[p]; xi[p] = xi[c]; xi[c] = t; }
    const dr = re[c * n + c], di = im[c * n + c], dd = dr * dr + di * di, ir = dr / dd, ii = -di / dd;
    for(let r = c + 1; r < n; r++){
      const ar = re[r * n + c], ai = im[r * n + c]; if(ar === 0 && ai === 0) continue;
      const fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for(let j = c; j < n; j++){ const a = re[c * n + j], b = im[c * n + j]; re[r * n + j] -= fr * a - fi * b; im[r * n + j] -= fr * b + fi * a; }
      xr[r] -= fr * xr[c] - fi * xi[c]; xi[r] -= fr * xi[c] + fi * xr[c];
    }
  }
  for(let c = n - 1; c >= 0; c--){
    let sr = xr[c], si = xi[c];
    for(let j = c + 1; j < n; j++){ const a = re[c * n + j], b = im[c * n + j]; sr -= a * xr[j] - b * xi[j]; si -= a * xi[j] + b * xr[j]; }
    const dr = re[c * n + c], di = im[c * n + c], dd = dr * dr + di * di;
    xr[c] = (sr * dr + si * di) / dd; xi[c] = (si * dr - sr * di) / dd;
  }
  return { re: xr, im: xi };
}
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. NODAL SOLVER ───────────────────────────────────────────
/* A network: { n, ports: [node…] (port 1 first), z0, lines: [{ a, b, Z, th0, id }], res: [{ a, b, R, id }] }.
   Node −1 is ground. th0 is a line's electrical length at f0 (rad); at frequency f it is th0·f/f0 (TEM, no dispersion).
   Loss is a(dB per guided wavelength), so αℓ = a·(θ/2π)/8.686 Np. A floor of 1e-7 Np keeps the matrix regular at
   exact multiples of 90°. */
const ALPHA_FLOOR = 1e-7;
// γℓ for a line at the frequency ratio u = f/f0.
function gammaL(th0, u, lossDb){ const th = th0 * u; return cx(Math.max((lossDb || 0) * th / (2 * Math.PI) / 8.685889638, ALPHA_FLOOR), th); }
// Two-port Y of a line: y11 = y22 = coth(γℓ)/Zc, y12 = y21 = −1/(Zc·sinh γℓ).
function lineY(Z, gl){
  const sh = csinh(gl), ch = ccosh(gl);
  return { y11: cscale(cdiv(ch, sh), 1 / Z), y12: cscale(cdiv(cx(1), sh), -1 / Z) };
}
// Assemble the nodal admittance matrix at u = f/f0.
function assembleY(net, u, lossDb){
  const n = net.n, Y = cmat(n);
  const add = (i, j, y) => { Y.re[i * n + j] += y.re; Y.im[i * n + j] += y.im; };
  const stamp = (a, b, y) => { if(a >= 0) add(a, a, y); if(b >= 0) add(b, b, y); if(a >= 0 && b >= 0){ add(a, b, cscale(y, -1)); add(b, a, cscale(y, -1)); } };
  for(const L of net.lines){
    const { y11, y12 } = lineY(L.Z, gammaL(L.th0, u, lossDb));
    stamp(L.a, L.b, cscale(y12, -1)); stamp(L.a, -1, cadd(y11, y12)); stamp(L.b, -1, cadd(y11, y12));
  }
  for(const r of net.res) stamp(r.a, r.b, cx(1 / r.R));
  return Y;
}
/* Kron reduction: eliminate every node not in keep (keep order preserved), one node at a time. The networks are
   chains and trees, so the fill-in stays small. */
function kron(Y, keep){
  const n = Y.n, re = Y.re, im = Y.im, isKeep = new Uint8Array(n);
  keep.forEach(k => { isKeep[k] = 1; });
  const left = []; for(let i = 0; i < n; i++) if(!isKeep[i]) left.push(i);
  if(n <= 40) kronDense(re, im, n, left, isKeep);
  else kronSparse(re, im, n, left);
  const p = keep.length, out = cmat(p);
  for(let a = 0; a < p; a++) for(let b = 0; b < p; b++){ out.re[a * p + b] = re[keep[a] * n + keep[b]]; out.im[a * p + b] = im[keep[a] * n + keep[b]]; }
  return out;
}
// Small networks: eliminate in turn the remaining internal node with the largest |Ykk| (dense updates).
function kronDense(re, im, n, left, isKeep){
  const alive = Uint8Array.from({ length: n }, () => 1);
  while(left.length){
    let bi = 0, bm = -1;
    left.forEach((c, i) => { const m = re[c * n + c] ** 2 + im[c * n + c] ** 2; if(m > bm){ bm = m; bi = i; } });
    const k = left[bi]; left.splice(bi, 1); alive[k] = 0;
    const pr = re[k * n + k], pi = im[k * n + k], pd = pr * pr + pi * pi, ir = pr / pd, ii = -pi / pd;
    for(let i = 0; i < n; i++){
      if(!alive[i]) continue; const ar = re[i * n + k], ai = im[i * n + k]; if(ar === 0 && ai === 0) continue;
      const fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for(let j = 0; j < n; j++){ if(!alive[j]) continue; const br = re[k * n + j], bi2 = im[k * n + j]; if(br === 0 && bi2 === 0) continue;
        re[i * n + j] -= fr * br - fi * bi2; im[i * n + j] -= fr * bi2 + fi * br; }
    }
  }
  void isKeep;
}
// Large networks (trees): lowest degree first, largest |Ykk| among equals, neighbour sets track the fill-in.
function kronSparse(re, im, n, leftArr){
  const nb = [];
  for(let i = 0; i < n; i++){ const s = new Set(); for(let j = 0; j < n; j++) if(i !== j && (re[i * n + j] !== 0 || im[i * n + j] !== 0)) s.add(j); nb.push(s); }
  const left = new Set(leftArr);
  while(left.size){
    let k = -1, kd = Infinity, km = -1;
    for(const c of left){ const d = nb[c].size, m = re[c * n + c] ** 2 + im[c * n + c] ** 2; if(d < kd || (d === kd && m > km)){ k = c; kd = d; km = m; } }
    left.delete(k);
    const pr = re[k * n + k], pi = im[k * n + k], pd = pr * pr + pi * pi, ir = pr / pd, ii = -pi / pd, js = [...nb[k]];
    for(const i of js){
      const ar = re[i * n + k], ai = im[i * n + k], fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for(const j of js){ const br = re[k * n + j], bi = im[k * n + j]; re[i * n + j] -= fr * br - fi * bi; im[i * n + j] -= fr * bi + fi * br; }
      nb[i].delete(k); for(const j of js) if(j !== i) nb[i].add(j);
    }
  }
}
// Port Y → S referred to z0: S = (y0·I − Y)(y0·I + Y)⁻¹.
function yToS(Yp, z0){
  const p = Yp.n, y0 = 1 / z0, A = cmat(p), B = cmat(p);
  for(let i = 0; i < p; i++) for(let j = 0; j < p; j++){ const k = i * p + j, d = i === j ? y0 : 0;
    A.re[k] = d - Yp.re[k]; A.im[k] = -Yp.im[k]; B.re[k] = d + Yp.re[k]; B.im[k] = Yp.im[k]; }
  const Bi = cmatInv(B), S = cmat(p);
  for(let i = 0; i < p; i++) for(let j = 0; j < p; j++){
    let sr = 0, si = 0;
    for(let t = 0; t < p; t++){ const ar = A.re[i * p + t], ai = A.im[i * p + t], br = Bi.re[t * p + j], bi = Bi.im[t * p + j]; sr += ar * br - ai * bi; si += ar * bi + ai * br; }
    S.re[i * p + j] = sr; S.im[i * p + j] = si;
  }
  return S;
}
// S-matrix of a network at u = f/f0.
function solveS(net, u, lossDb){ return yToS(kron(assembleY(net, u, lossDb), net.ports), net.z0); }
/* Compiled solve for sweeps: the elimination order (lowest degree first) and its fill pattern depend only on the
   network's structure, so they are found once; each frequency then only stamps and eliminates. A pivot smaller than
   1e-12 of its row falls back to the pivoting reduction above for that frequency. */
function compileNet(net){
  const n = net.n, nb = Array.from({ length: n }, () => new Set()), isKeep = new Uint8Array(n);
  net.ports.forEach(k => { isKeep[k] = 1; });
  const link = (a, b) => { if(a >= 0 && b >= 0 && a !== b){ nb[a].add(b); nb[b].add(a); } };
  net.lines.forEach(L => link(L.a, L.b)); net.res.forEach(r => link(r.a, r.b));
  const left = new Set(); for(let i = 0; i < n; i++) if(!isKeep[i]) left.add(i);
  const steps = [], touched = new Set();
  for(let i = 0; i < n; i++){ touched.add(i * n + i); nb[i].forEach(j => touched.add(i * n + j)); }
  while(left.size){
    let k = -1, kd = Infinity; for(const c of left){ const d = nb[c].size; if(d < kd){ k = c; kd = d; } }
    left.delete(k); const js = [...nb[k]];
    steps.push({ k, js: Int32Array.from(js) });
    for(const i of js){ nb[i].delete(k); for(const j of js){ if(j !== i) nb[i].add(j); touched.add(i * n + j); } }
  }
  // only the entries that stamps or fill-in ever touch are cleared per frequency; line data packed in typed arrays
  const nl = net.lines.length, LA = new Int32Array(nl), LB = new Int32Array(nl), LZ = new Float64Array(nl), LT = new Float64Array(nl);
  net.lines.forEach((L, i) => { LA[i] = L.a; LB[i] = L.b; LZ[i] = L.Z; LT[i] = L.th0; });
  return { net, n, steps, touched: Int32Array.from(touched), re: new Float64Array(n * n), im: new Float64Array(n * n), LA, LB, LZ, LT };
}
function solveSc(c, u, lossDb){
  const net = c.net, n = c.n, re = c.re, im = c.im, tz = c.touched, LA = c.LA, LB = c.LB, LZ = c.LZ, LT = c.LT;
  for(let t = 0; t < tz.length; t++){ re[tz[t]] = 0; im[tz[t]] = 0; }
  const add = (i, j, r, x) => { re[i * n + j] += r; im[i * n + j] += x; };
  const lk = (lossDb || 0) / (2 * Math.PI) / 8.685889638;
  for(let i = 0; i < LA.length; i++){
    const th = LT[i] * u, a = Math.max(lk * th, ALPHA_FLOOR), Z = LZ[i];
    const sha = Math.sinh(a), cha = Math.cosh(a), co = Math.cos(th), si = Math.sin(th);
    const shr = sha * co, shi = cha * si, chr = cha * co, chi = sha * si, d = (shr * shr + shi * shi) * Z;
    const cr = (chr * shr + chi * shi) / d, ci = (chi * shr - chr * shi) / d;   // coth(γℓ)/Z = y11
    const sr = shr / d, sm = -shi / d;                                          // 1/(Z sinh γℓ) = −y12
    const A = LA[i], B = LB[i];
    if(A >= 0){ re[A * n + A] += cr; im[A * n + A] += ci; }
    if(B >= 0){ re[B * n + B] += cr; im[B * n + B] += ci; }
    if(A >= 0 && B >= 0){ re[A * n + B] -= sr; im[A * n + B] -= sm; re[B * n + A] -= sr; im[B * n + A] -= sm; }
  }
  for(const r of net.res){ const g = 1 / r.R; if(r.a >= 0) add(r.a, r.a, g, 0); if(r.b >= 0) add(r.b, r.b, g, 0); if(r.a >= 0 && r.b >= 0){ add(r.a, r.b, -g, 0); add(r.b, r.a, -g, 0); } }
  for(const st of c.steps){
    const k = st.k, js = st.js, pr = re[k * n + k], pi = im[k * n + k], pd = pr * pr + pi * pi;
    let row = 0; for(let t = 0; t < js.length; t++){ const j = js[t]; row = Math.max(row, re[k * n + j] ** 2 + im[k * n + j] ** 2); }
    if(pd < 1e-24 * row) return solveS(net, u, lossDb);
    const ir = pr / pd, ii = -pi / pd;
    for(let a = 0; a < js.length; a++){
      const i = js[a], ar = re[i * n + k], ai = im[i * n + k], fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for(let b = 0; b < js.length; b++){ const j = js[b], br = re[k * n + j], bi = im[k * n + j]; re[i * n + j] -= fr * br - fi * bi; im[i * n + j] -= fr * bi + fi * br; }
    }
  }
  const keep = net.ports, p = keep.length, Yp = cmat(p);
  for(let a = 0; a < p; a++) for(let b = 0; b < p; b++){ Yp.re[a * p + b] = re[keep[a] * n + keep[b]]; Yp.im[a * p + b] = im[keep[a] * n + keep[b]]; }
  return yToS(Yp, net.z0);
}

// ── END 3 ─────────────────────────────────────────────────────

// ── 4. LOADED SOLVE ───────────────────────────────────────────
// Load impedance for a reflection coefficient Γ = |Γ|∠deg on z0 (|Γ| < 1).
function loadZ(z0, g, deg){ const G = cpolar(g, (deg || 0) / DEG); return cscale(cdiv(cadd(cx(1), G), csub(cx(1), G)), z0); }
/* Drive port 1 with incident wave a1 = 1 (source 2√z0 behind z0, available power ½), terminate output k in
   loads[k] = { g, deg }, and solve the node voltages. Every power is a fraction of the available power and is
   computed from its own element: |Γin|², ½|V|²Re(yL) per load, ½|ΔV|²/R per resistor, ½Re(Va·Ia* + Vb·Ib*) per line.
   The four kinds are not forced to sum to 1: their sum is the energy-balance check. */
function solveLoaded(net, u, lossDb, loads){
  const n = net.n, z0 = net.z0, Y = assembleY(net, u, lossDb), Pav = 0.5;
  const yL = net.ports.slice(1).map((p, k) => { const L = loads && loads[k]; return L && L.g > 1e-9 ? cdiv(cx(1), loadZ(z0, L.g, L.deg)) : cx(1 / z0); });
  const p1 = net.ports[0];
  Y.re[p1 * n + p1] += 1 / z0;
  net.ports.slice(1).forEach((p, k) => { Y.re[p * n + p] += yL[k].re; Y.im[p * n + p] += yL[k].im; });
  const bre = new Float64Array(n), bim = new Float64Array(n); bre[p1] = 2 * Math.sqrt(z0) / z0;
  const V = cmatSolve(Y, bre, bim), v = i => (i < 0 ? cx(0) : cx(V.re[i], V.im[i]));
  const b1 = csub(cscale(v(p1), 1 / Math.sqrt(z0)), cx(1));
  const pRefl = cabs(b1) ** 2;
  const pLoad = net.ports.slice(1).map((p, k) => 0.5 * cabs(v(p)) ** 2 * yL[k].re / Pav);
  const pResEach = net.res.map(r => 0.5 * cabs(csub(v(r.a), v(r.b))) ** 2 / r.R / Pav);
  const pLineEach = net.lines.map(L => {
    const { y11, y12 } = lineY(L.Z, gammaL(L.th0, u, lossDb)), Va = v(L.a), Vb = v(L.b);
    const Ia = cadd(cmul(y11, Va), cmul(y12, Vb)), Ib = cadd(cmul(y12, Va), cmul(y11, Vb));
    return 0.5 * (cmul(Va, cconj(Ia)).re + cmul(Vb, cconj(Ib)).re) / Pav;
  });
  const sum = a => a.reduce((s, x) => s + x, 0);
  const pRes = sum(pResEach), pLine = sum(pLineEach), pDeliv = sum(pLoad);
  return { pRefl, pLoad, pDeliv, pRes, pResEach, pLine, pLineEach, total: pRefl + pDeliv + pRes + pLine,
    gin: b1, V: k => v(k) };
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. MICROSTRIP ─────────────────────────────────────────────
/* Two models (zero strip thickness):
   'pozar' — Pozar eq. 3.195–3.197 (Wheeler's synthesis): W/h from Z and εr, quasi-static ε_eff, no dispersion.
   'hj'    — Hammerstad–Jensen (1980) Z and ε_eff, W/h found by bisection, then the Kirschning–Jansen (1982)
             dispersion of ε_eff at f0 for the guided wavelength. Z is not corrected for dispersion. */
const ETA0 = 376.730313668;
function msPozarWh(Z, er){
  const A = Z / 60 * Math.sqrt((er + 1) / 2) + (er - 1) / (er + 1) * (0.23 + 0.11 / er);
  let wh = 8 * Math.exp(A) / (Math.exp(2 * A) - 2);
  if(!(wh > 0 && wh < 2)){
    const B = ETA0 * Math.PI / (2 * Z * Math.sqrt(er));
    wh = (2 / Math.PI) * (B - 1 - Math.log(2 * B - 1) + (er - 1) / (2 * er) * (Math.log(B - 1) + 0.39 - 0.61 / er));
  }
  return wh;
}
const msPozarEeff = (er, wh) => (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / wh);
function msHjEeff(er, u){
  const a = 1 + Math.log((u ** 4 + (u / 52) ** 2) / (u ** 4 + 0.432)) / 49 + Math.log(1 + (u / 18.1) ** 3) / 18.7;
  const b = 0.564 * ((er - 0.9) / (er + 3)) ** 0.053;
  return (er + 1) / 2 + (er - 1) / 2 * (1 + 10 / u) ** (-a * b);
}
function msHjZ(er, u){
  const f = 6 + (2 * Math.PI - 6) * Math.exp(-((30.666 / u) ** 0.7528));
  return ETA0 / (2 * Math.PI) * Math.log(f / u + Math.sqrt(1 + (2 / u) ** 2)) / Math.sqrt(msHjEeff(er, u));
}
// Kirschning–Jansen: ε_eff(f) from the static value; f in GHz, h in mm.
function msKjEeff(er, u, eeff0, fGHz, hmm){
  const fn = fGHz * hmm;
  const P1 = 0.27488 + (0.6315 + 0.525 / (1 + 0.0157 * fn) ** 20) * u - 0.065683 * Math.exp(-8.7513 * u);
  const P2 = 0.33622 * (1 - Math.exp(-0.03442 * er));
  const P3 = 0.0363 * Math.exp(-4.6 * u) * (1 - Math.exp(-((fn / 38.7) ** 4.97)));
  const P4 = 1 + 2.751 * (1 - Math.exp(-((er / 15.916) ** 8)));
  const P = P1 * P2 * ((0.1844 + P3 * P4) * fn) ** 1.5763;
  return er - (er - eeff0) / (1 + P);
}
/* Synthesis: { wh, W (mm), eeff, lambdaG (mm), lenQ (mm, λg/4) } for impedance Z on (εr, h mm) at f (Hz). */
function microstrip(Z, er, h, f, model){
  let wh, eeff;
  if(model === 'hj'){
    let lo = 1e-3, hi = 100;                        // Z falls as W/h grows
    for(let i = 0; i < 80; i++){ const m = Math.sqrt(lo * hi); if(msHjZ(er, m) > Z) lo = m; else hi = m; }
    wh = Math.sqrt(lo * hi); eeff = msKjEeff(er, wh, msHjEeff(er, wh), f / 1e9, h);
  } else { wh = msPozarWh(Z, er); eeff = msPozarEeff(er, wh); }
  const lambdaG = C0 / (f * Math.sqrt(eeff)) * 1000;
  return { wh, W: wh * h, eeff, lambdaG, lenQ: lambdaG / 4 };
}
const MS_MODEL_NAME = { pozar: 'Pozar (Wheeler) quasi-static synthesis, no dispersion', hj: 'Hammerstad–Jensen with Kirschning–Jansen dispersion' };
// ── END 5 ─────────────────────────────────────────────────────

// ── 6. IMPEDANCE TAPERS ───────────────────────────────────────
function binom(n, k){ let r = 1; for(let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; }
/* M section impedances from Za (first) to Zb (last). Binomial (maximally flat, Pozar §5.7):
   ln Z(n+1) − ln Z(n) = 2^−M·C(M, n)·ln(Zb/Za). Chebyshev (equal ripple |Γ|max = gm, Pozar §5.8, logarithmic
   form so the sections end exactly on Zb). A ripple larger than the step itself falls back to binomial. */
function taper(Za, Zb, M, kind, gm){
  if(M < 1) return [];
  const lnR = Math.log(Zb / Za); let G;
  if(kind === 'cheby' && M > 1 && gm > 0 && Math.abs(lnR) / (2 * gm) > 1){
    const secm = Math.cosh(Math.acosh(Math.abs(lnR) / (2 * gm)) / M);
    // T_M(secm·cosθ) expanded in cos(kθ): power coefficients of T_M, then cos^m θ = 2^−m Σ C(m,i) cos((m−2i)θ).
    let t0 = [1], t1 = [0, 1];
    for(let k = 2; k <= M; k++){ const t2 = new Array(k + 1).fill(0); t1.forEach((c, i) => { t2[i + 1] += 2 * c; }); t0.forEach((c, i) => { t2[i] -= c; }); t0 = t1; t1 = t2; }
    const TM = M === 1 ? [0, 1] : t1, d = new Array(M + 1).fill(0);
    TM.forEach((c, m) => { if(!c) return; const sm = c * secm ** m / 2 ** m; for(let i = 0; i <= m; i++) d[Math.abs(m - 2 * i)] += sm * binom(m, i); });
    G = [];
    for(let n = 0; n <= M; n++){ const j = Math.abs(M - 2 * n); G.push(gm * Math.sign(lnR) * (j === 0 ? d[0] : d[j] / 2)); }
  } else G = Array.from({ length: M + 1 }, (_, n) => lnR * binom(M, n) / 2 ** (M + 1));
  const Z = []; let lz = Math.log(Za);
  for(let n = 0; n < M; n++){ lz += 2 * G[n]; Z.push(Math.exp(lz)); }
  return Z;
}
// ── END 6 ─────────────────────────────────────────────────────

// ── 7. ISOLATION RESISTORS ────────────────────────────────────
/* Even/odd modes of a symmetric divider (Cohn 1968). One arm, normalised to the port impedance 1: sections t[0]
   (junction side) … t[M−1] (port side), all λ/4 at f0. Even mode: the N arms share the source, so the junction end
   of one arm sees r = N (r = (1 + K²)/K for a scaled unequal pair). Odd mode: the junction is a virtual ground and
   each isolation resistor is a shunt g at its node (g = R/2 for a two-way bridge, g = R for an N-way star).
   Both return the complex Γ seen from the port. */
function armGamma(t, g, zj, u){
  let Vr = zj === 0 ? 0 : zj, Vi = 0, Ir = 1, Ii = 0;           // junction end: V = zj·I (zj = 0: short)
  const th = Math.PI / 2 * u, c = Math.cos(th), s = Math.sin(th);
  for(let k = 0; k < t.length; k++){
    const Z = t[k];                                   // [V; I] ← [cos θ, jZ sin θ; j sin θ / Z, cos θ]·[V; I]
    const nVr = c * Vr - Z * s * Ii, nVi = c * Vi + Z * s * Ir, nIr = c * Ir - s / Z * Vi, nIi = c * Ii + s / Z * Vr;
    Vr = nVr; Vi = nVi; Ir = nIr; Ii = nIi;
    if(g){ Ir += Vr / g[k]; Ii += Vi / g[k]; }
  }
  const d = Ir * Ir + Ii * Ii, zr = (Vr * Ir + Vi * Ii) / d, zi = (Vi * Ir - Vr * Ii) / d;   // Zin = V/I at the port
  return cdiv(cx(zr - 1, zi), cx(zr + 1, zi));
}
// Output match and isolation of a symmetric N-way from its modes: Sjj = (Γe + (N−1)Γo)/N, Sij = (Γe − Γo)/N.
function modeOutputs(ge, go, N){ return { sjj: cabs(cadd(ge, cscale(go, N - 1))) / N, sij: cabs(csub(ge, go)) / N }; }
// Nelder–Mead minimiser (small dimension).
function nelderMead(f, x0, step, iters){
  const n = x0.length; let P = [x0.slice()];
  for(let i = 0; i < n; i++){ const x = x0.slice(); x[i] += step; P.push(x); }
  let F = P.map(f);
  for(let it = 0; it < iters; it++){
    const ord = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); P = ord.map(i => P[i]); F = ord.map(i => F[i]);
    if(F[n] - F[0] < 1e-7 * (F[0] + 1e-6)) break;
    const c = new Array(n).fill(0); for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) c[j] += P[i][j] / n;
    const pt = a => c.map((v, j) => v + a * (P[n][j] - v)), xr = pt(-1), fr = f(xr);
    if(fr < F[0]){ const xe = pt(-2), fe = f(xe); if(fe < fr){ P[n] = xe; F[n] = fe; } else { P[n] = xr; F[n] = fr; } }
    else if(fr < F[n - 1]){ P[n] = xr; F[n] = fr; }
    else { const xc = pt(0.5), fc = f(xc);
      if(fc < F[n]){ P[n] = xc; F[n] = fc; }
      else for(let i = 1; i <= n; i++){ P[i] = P[i].map((v, j) => P[0][j] + 0.5 * (v - P[0][j])); F[i] = f(P[i]); } }
  }
  let b = 0; F.forEach((v, i) => { if(v < F[b]) b = i; });
  return { x: P[b], f: F[b] };
}
// The contiguous band around u = 1 where fn(u) ≤ lim, searched on [lo, hi] in steps of du (edges refined by bisection).
function bandAround(fn, lim, lo, hi, du){
  if(!(fn(1) <= lim)) return null;
  const edge = (dir) => {
    let a = 1, b = 1 + dir * du;
    while(dir > 0 ? b <= hi : b >= lo){ if(!(fn(b) <= lim)) break; a = b; b += dir * du; }
    if(dir > 0 ? b > hi : b < lo) return a;
    for(let i = 0; i < 30; i++){ const m = (a + b) / 2; if(fn(m) <= lim) a = m; else b = m; }
    return a;
  };
  return { lo: edge(-1), hi: edge(1) };
}
const RES_CACHE = new Map();
const ISO_BAND_DB = -20;                              // resistors are optimised over the S11 ≤ −20 dB band
/* Shunts g (normalised) for an N-way symmetric taper t of junction ratio r: minimise the largest output match or
   isolation, max(|Sjj|, |Sij|), over the band where |S11| ≤ −20 dB (25 points), by Nelder–Mead on ln g from a start
   near Cohn's tables. One section has the exact value g = 1. */
function oddShunts(t, r, N){
  const M = t.length; if(M === 1) return { g: [1], band: null, worst: 0 };
  const key = 'o' + N + ':' + r.toFixed(6) + ':' + t.map(z => z.toFixed(6)).join(',');
  if(RES_CACHE.has(key)) return RES_CACHE.get(key);
  const band = bandAround(u => cabs(armGamma(t, null, r, u)), 10 ** (ISO_BAND_DB / 20), 0.05, 1.95, 0.01) || { lo: 0.95, hi: 1.05 };
  const U = Array.from({ length: 25 }, (_, i) => band.lo + (band.hi - band.lo) * i / 24), GE = U.map(u => armGamma(t, null, r, u));
  const cost = lg => { const g = lg.map(Math.exp); let w = 0;
    U.forEach((u, i) => { const o = modeOutputs(GE[i], armGamma(t, g, 0, u), N); w = Math.max(w, o.sjj, o.sij); }); return w; };
  const x0 = t.map((z, k) => Math.log(k === M - 1 ? 2.5 : 1.2 * Math.sqrt(t[k] * (t[k + 1] || 1))));
  let best = nelderMead(cost, x0, 0.4, 400); best = nelderMead(cost, best.x, 0.1, 300);
  const out = { g: best.x.map(Math.exp), band, worst: best.f };
  RES_CACHE.set(key, out);
  return out;
}
// ── END 7 ─────────────────────────────────────────────────────

// ── 8. DIVIDER SYNTHESIS ──────────────────────────────────────
/* A two-arm stage (2-way Wilkinson, equal or unequal, or a lossless T): arms[0] → port 2, arms[1] → port 3, each a
   list of sections { Z, role: 'arm' | 'xfmr' | 'eq' } junction → port, every one λ/4 at f0. res[k] = R bridging the
   arms after section k (null = none). frac = [P2, P3] / Pin. */
function powerSplit(ratioDB){ const k2 = 10 ** (ratioDB / 10); return [k2 / (1 + k2), 1 / (1 + k2)]; }
function wilkinsonStage(z0, ratioDB, M, kind, gm, forceXfmr){
  const K = Math.sqrt(10 ** (ratioDB / 10));            // K² = P2/P3
  const unequal = Math.abs(ratioDB) > 1e-9;
  const Rp = [z0 / K, z0 * K];                         // impedance level at the resistor plane (Pozar §7.3)
  const r = (1 + K * K) / K;                           // junction / plane impedance ratio of both arms (2 when equal)
  const t = taper(r, 1, M, kind, gm);                  // normalised arm, junction → plane
  const arms = Rp.map(rp => t.map(z => ({ Z: z * rp, role: 'arm' })));
  let g;
  if(M === 1) g = [1];
  else g = oddShunts(t, r, 2).g;
  const res = g.map(x => x * (Rp[0] + Rp[1]));       // bridge = g·(Rp2 + Rp3); 2g·z0 when equal
  if(unequal || forceXfmr){
    const tx = Rp.map(rp => taper(rp, z0, M, kind, gm));
    arms.forEach((a, i) => tx[i].forEach(z => a.push({ Z: z, role: unequal ? 'xfmr' : 'eq' })));
    for(let k = 0; k < tx[0].length; k++) res.push(null);
  }
  const st = { kind: 'two', arms, res, ratioDB, K, Rp, frac: powerSplit(ratioDB), t, gNorm: g, unequal, resOptimised: M > 1 };
  if(unequal && M > 1) refineUnequal(st, z0);
  return st;
}
/* Refinement can be deferred (while a slider is dragged): the scaled start is used and the job is queued; runPending()
   does one queued refinement and reports whether any remain. */
const REFINE = { defer: false, pending: new Map() };
function runPending(){
  const it = REFINE.pending.entries().next(); if(it.done) return false;
  const [key, job] = it.value; REFINE.pending.delete(key);
  const was = REFINE.defer; REFINE.defer = false; refineUnequal(job.st, job.z0); REFINE.defer = was;
  return REFINE.pending.size > 0;
}
/* Unequal multisection: the scaled-odd-mode start is refined with the full three-port solver, minimising the largest of
   |S22|, |S33|, |S23| over the S11 ≤ −20 dB band (13 points). Cached per design. */
function refineUnequal(st, z0){
  const key = 'u' + st.arms.map(a => a.map(s => s.Z.toFixed(5)).join(',')).join('|');
  if(RES_CACHE.has(key)){ st.res = RES_CACHE.get(key).slice(); st.refined = true; return; }
  if(REFINE.defer){ REFINE.pending.set(key, { st: Object.assign({}, st, { res: st.res.slice() }), z0 }); st.refined = false; return; }
  st.refined = true;
  const M = st.t.length;
  // one compiled network; only the resistor values change between evaluations
  const net = buildStageNet(st, z0), c = compileNet(net), setR = R => { net.res.forEach((r, k) => { r.R = R[k]; }); };
  const lim = 10 ** (ISO_BAND_DB / 20);
  setR(st.res.slice(0, M));
  const band = bandAround(u => cabs(mget(solveSc(c, u, 0), 0, 0)), lim, 0.05, 1.95, 0.01) || { lo: 0.9, hi: 1.1 };
  const U = Array.from({ length: 13 }, (_, i) => band.lo + (band.hi - band.lo) * i / 12);
  const cost = lr => {
    setR(lr.map(Math.exp)); let w = 0;
    for(const u of U){ const S = solveSc(c, u, 0); w = Math.max(w, cabs(mget(S, 1, 1)), cabs(mget(S, 2, 2)), cabs(mget(S, 1, 2))); }
    return w;
  };
  const x0 = st.res.slice(0, M).map(Math.log);
  const best = nelderMead(cost, x0, 0.15, 140);
  if(best.f < cost(x0)) st.res = best.x.map(Math.exp).concat(st.res.slice(M));
  RES_CACHE.set(key, st.res.slice());
}
// Network of one two-arm stage alone (ports: junction, end of arm 0, end of arm 1).
function buildStageNet(st, z0){
  const net = { n: 1, ports: [0], z0, lines: [], res: [] };
  const ends = addTwoArm(net, st, 0, 'x', null);
  net.ports.push(ends[0], ends[1]);
  return net;
}
/* N-way equal Wilkinson (star of N resistors to a floating node at every section plane; non-planar for N > 2). */
function starStage(z0, N, M, kind, gm){
  const t = taper(N, 1, M, kind, gm);
  const g = M === 1 ? [1] : oddShunts(t, N, N).g;
  return { kind: 'star', N, arms: Array.from({ length: N }, () => t.map(z => ({ Z: z * z0, role: 'arm' }))), res: g.map(x => x * z0),
    frac: new Array(N).fill(1 / N), t, gNorm: g, resOptimised: M > 1 };
}
/* Lossless T-junction: arms of Zj = z0/p (Pozar §7.2). With output transformers each arm is a taper Zj → z0 (one or
   more λ/4 sections); without, each arm is one λ/4 line of Zj ending on a z0 port. No resistors. */
function teeStage(z0, N, ratioDB, M, kind, gm, xfmr){
  const frac = N === 2 ? powerSplit(ratioDB) : new Array(N).fill(1 / N);
  const arms = frac.map(p => { const zj = z0 / p; return xfmr ? taper(zj, z0, M, kind, gm).map(Z => ({ Z, role: 'xfmr' })) : [{ Z: zj, role: 'arm' }]; });
  return { kind: N === 2 ? 'two' : 'star', N, arms, res: arms[0].map(() => null), frac, tee: true, xfmr };
}
/* Resistive divider, N outputs: Y form R = z0(N−1)/(N+1) from every port to a centre; Δ (mesh) form R = z0(N−1)
   between every pair of ports (the star–mesh transform of the Y; planar for N = 2). */
function resistiveStage(z0, N, form){
  return { kind: 'resistive', N, form, R: form === 'delta' ? z0 * (N - 1) : z0 * (N - 1) / (N + 1), frac: new Array(N).fill(1 / N) };
}
/* Output-power weights for an N-output tree: uniform, or cosine on a pedestal with the edge outputs edgeDB below the
   centre (amplitude a = p + (1 − p)·cos(πx/2), x = −1…1 across the outputs, p = 10^(edgeDB/20)); power = a². */
function treeWeights(nOut, amp, edgeDB){
  if(amp !== 'cosine') return new Array(nOut).fill(1);
  const p = 10 ** (edgeDB / 20);
  return Array.from({ length: nOut }, (_, i) => { const x = nOut === 1 ? 0 : -1 + 2 * i / (nOut - 1); const a = p + (1 - p) * Math.cos(Math.PI * x / 2); return a * a; });
}
const MODULE_NAME = { wilk: 'Wilkinson', branch: 'Branching line', resY: 'Resistive Y' };
/* One junction of a tree. 'wilk': symmetrical (or unequal) Wilkinson; 'branch': lossless branching line, a T with λ/4
   transformer tapers and no resistor; 'resY': resistive Y, three z0/3 resistors (equal split only — a matched
   resistive three-port cannot split unequally, so a requested ratio is noted and 1:1 used). */
function junctionStage(module, ratioDB, p){
  if(module === 'branch') return Object.assign(teeStage(p.z0, 2, ratioDB, p.M, p.taper, p.gm, true), { module, ratioDB });
  if(module === 'resY') return { kind: 'resY', module, R: p.z0 / 3, ratioDB: 0, asked: ratioDB, frac: [0.5, 0.5] };
  return Object.assign(wilkinsonStage(p.z0, ratioDB, p.M, p.taper, p.gm), { module: 'wilk' });
}
/* N-way branching cascade (corporate tree), any N ≥ 2. Each junction splits its outputs floor(n/2) : ceil(n/2) (N = 3:
   1:2 then 1:1; N = 5: 2:3, then 1:1 and 1:2) in the ratio of the output weights below it, unless the student set the
   ratio. Module per junction: an override, else the level's module, else the tree's. Junction paths: '' (root), 'L',
   'R', 'LR', … tree = { N, amp, edgeDB, module, levelMods: [], mods: { path → module }, ratios: { path → dB } }. */
function treeDesign(p){
  const T = p.tree, N = T.N, w = treeWeights(N, T.amp, T.edgeDB), sum = w.reduce((a, b) => a + b, 0);
  const add = (lo, n) => w.slice(lo, lo + n).reduce((a, b) => a + b, 0);
  let maxDepth = 0;
  const make = (lo, n, path) => {
    if(n === 1){ maxDepth = Math.max(maxDepth, path.length); return { leaf: true, idx: lo, path, depth: path.length }; }
    const nl = Math.floor(n / 2), auto = 10 * Math.log10(add(lo, nl) / add(lo + nl, n - nl));
    const ov = T.ratios && T.ratios[path], ratioDB = ov != null ? ov : (Math.abs(auto) < 1e-9 ? 0 : auto);
    const module = (T.mods && T.mods[path]) || (T.levelMods && T.levelMods[path.length]) || T.module || 'wilk';
    return { leaf: false, path, depth: path.length, n, ratioDB, auto, edited: ov != null, module, stage: junctionStage(module, ratioDB, p),
      children: [make(lo, nl, path + 'L'), make(lo + nl, n - nl, path + 'R')] };
  };
  const root = make(0, N, '');
  const junctions = []; (function walk(nd){ if(!nd.leaf){ junctions.push(nd); nd.children.forEach(walk); } })(root);
  /* a level with an unequal Wilkinson (arms + transformers) gives its equal Wilkinsons λ/4 z0 lines of the same count,
     so the paths stay equal without delay lines */
  for(let l = 0; l <= maxDepth; l++){
    const lv = junctions.filter(j => j.depth === l && j.module === 'wilk');
    if(lv.some(j => j.stage.unequal)) lv.forEach(j => { if(!j.stage.unequal) j.stage = Object.assign(wilkinsonStage(p.z0, 0, p.M, p.taper, p.gm, true), { module: 'wilk' }); });
  }
  return { kind: 'tree', N, weights: w.map(x => x / sum), root, junctions, maxDepth };
}
/* The design for the current parameters. p = { topology, N, ratioDB, M, taper, gm, z0, teeXfmr, resForm, tree }.
   Wilkinson and T with N > 2 are equal split; unequal is 2-way. */
function synthesize(p){
  const gm = p.gm, M = p.M;
  switch(p.topology){
    case 'tee': return { topology: 'tee', stage: teeStage(p.z0, p.N, p.N === 2 ? p.ratioDB : 0, M, p.taper, gm, p.teeXfmr), nOut: p.N };
    case 'resistive': return { topology: 'resistive', stage: resistiveStage(p.z0, p.N, p.N === 2 ? p.resForm : 'Y'), nOut: p.N };
    case 'tree': { const t = treeDesign(p); return { topology: 'tree', tree: t, nOut: t.N }; }
    default: return { topology: 'wilkinson', stage: p.N === 2 ? wilkinsonStage(p.z0, p.ratioDB, M, p.taper, gm) : starStage(p.z0, p.N, M, p.taper, gm), nOut: p.N };
  }
}
// Ideal output fractions of a design (what a lossless, matched divider of this split would deliver).
function idealFractions(design){
  if(design.topology !== 'tree') return design.stage.frac.slice();
  const out = new Array(design.tree.N).fill(0);
  (function walk(nd, f){ if(nd.leaf){ out[nd.idx] = f; return; } const fr = nd.module === 'resY' ? [0.25, 0.25] : powerSplit(nd.ratioDB);
    walk(nd.children[0], f * fr[0]); walk(nd.children[1], f * fr[1]); })(design.tree.root, 1);
  return out;
}
// Number of resistors in a design.
function resistorCount(design){
  const st = design.stage;
  if(design.topology === 'resistive') return st.form === 'delta' ? st.N * (st.N + 1) / 2 : st.N + 1;
  if(design.topology === 'tree') return design.tree.junctions.reduce((a, j) => a + (j.stage.kind === 'resY' ? 3 : j.stage.res.filter(r => r != null).length), 0);
  return st.kind === 'star' ? st.res.filter(r => r != null).length * st.N : st.res.filter(r => r != null).length;
}
// ── END 8 ─────────────────────────────────────────────────────

// ── 9. NETWORK BUILD ──────────────────────────────────────────
const QW = Math.PI / 2;
// Add a two-arm stage at node j0; returns the two end nodes. Element ids: <pfx>.a<arm>.<k> and <pfx>.r<k>.
function addTwoArm(net, st, j0, pfx, endNodes){
  const nodes = st.arms.map(() => [j0]);
  st.arms.forEach((arm, a) => arm.forEach((s, k) => {
    const last = k === arm.length - 1, b = last && endNodes ? endNodes[a] : net.n++;
    net.lines.push({ a: nodes[a][k], b, Z: s.Z, th0: QW, id: pfx + '.a' + a + '.' + k });
    nodes[a].push(b);
  }));
  st.res.forEach((R, k) => { if(R != null && net.resOn !== false) net.res.push({ a: nodes[0][k + 1], b: nodes[1][k + 1], R: R * (net.rMult || 1), id: pfx + '.r' + k }); });
  return [nodes[0][nodes[0].length - 1], nodes[1][nodes[1].length - 1]];
}
function addStar(net, st, j0, pfx){
  const nodes = st.arms.map(() => [j0]);
  st.arms.forEach((arm, a) => arm.forEach((s, k) => { const b = net.n++; net.lines.push({ a: nodes[a][k], b, Z: s.Z, th0: QW, id: pfx + '.a' + a + '.' + k }); nodes[a].push(b); }));
  st.res.forEach((R, k) => {
    if(R == null || net.resOn === false) return;
    const c = net.n++;
    st.arms.forEach((arm, a) => net.res.push({ a: nodes[a][k + 1], b: c, R: R * (net.rMult || 1), id: pfx + '.r' + k + '.' + a }));
  });
  return nodes.map(n => n[n.length - 1]);
}
// A resistive Y junction at node j0: z0/3 from the input, and from each output, to a centre node. Returns the two outputs.
function addResY(net, st, j0, pfx){
  const c = net.n++, e = [net.n++, net.n++];
  net.res.push({ a: j0, b: c, R: st.R, id: pfx + '.r0' }, { a: c, b: e[0], R: st.R, id: pfx + '.r1' }, { a: c, b: e[1], R: st.R, id: pfx + '.r2' });
  return e;
}
/* Network for a design. opts = { z0, resOn, rMult, lens: { id → electrical length at f0 (rad) } }: a tree's
   interconnects ('ic<path><k>') and output lines ('o<i>', with their delay lines) come from the layout; they are z0
   lines. The ports of a tree are at the end of its output lines; a single divider's ports are at its terminals. */
function buildNetwork(design, opts){
  const net = { n: 1, ports: [0], z0: opts.z0, lines: [], res: [], resOn: opts.resOn, rMult: opts.rMult };
  if(design.topology === 'resistive'){
    const st = design.stage, N = st.N;
    for(let i = 0; i < N; i++) net.ports.push(net.n++);
    if(st.form === 'delta'){ for(let i = 0; i <= N; i++) for(let j = i + 1; j <= N; j++) net.res.push({ a: net.ports[i], b: net.ports[j], R: st.R, id: 'x.r' + i + j }); }
    else { const c = net.n++; net.ports.forEach((p, i) => net.res.push({ a: p, b: c, R: st.R, id: 'x.r' + i })); }
  } else if(design.topology === 'tree'){
    const lens = opts.lens || {}, ports = [];
    const line = (a0, id) => { const th = lens[id]; if(!(th > 0)) return a0; const b0 = net.n++; net.lines.push({ a: a0, b: b0, Z: opts.z0, th0: th, id }); return b0; };
    const addNode = (nd, inNode) => {
      if(nd.leaf){ ports[nd.idx] = line(inNode, 'o' + nd.idx); return; }
      const pfx = 'j' + nd.path, ends = nd.stage.kind === 'resY' ? addResY(net, nd.stage, inNode, pfx) : addTwoArm(net, nd.stage, inNode, pfx, null);
      nd.children.forEach((c, k) => addNode(c, line(ends[k], 'ic' + nd.path + k)));
    };
    addNode(design.tree.root, 0);
    ports.forEach(n => net.ports.push(n));
  } else {
    const st = design.stage;
    const ends = st.kind === 'star' ? addStar(net, st, 0, 'x') : addTwoArm(net, st, 0, 'x', null);
    ends.forEach(e => net.ports.push(e));
  }
  return net;
}
// ── END 9 ─────────────────────────────────────────────────────

// ── 10. ANALYSIS ──────────────────────────────────────────────
/* Sweep: S at nf points from uLo to uHi (f/f0), returned as per-entry arrays of complex values: get(i, j) → [{re, im}]. */
function sweep(net, uLo, uHi, nf, lossDb){
  const u = Array.from({ length: nf }, (_, i) => uLo + (uHi - uLo) * i / (nf - 1)), c = compileNet(net);
  const S = u.map(x => solveSc(c, x, lossDb));
  return { u, S, p: net.ports.length, get: (i, j) => S.map(M => mget(M, i, j)) };
}
/* −lim dB bandwidth around f0 of a magnitude curve on the sweep grid (contiguous, edges interpolated in dB);
   fractional (Δf/f0) or null when f0 itself fails. */
function bandwidthOf(u, magDb, lim){
  let i0 = 0; u.forEach((x, i) => { if(Math.abs(x - 1) < Math.abs(u[i0] - 1)) i0 = i; });
  if(!(magDb[i0] <= lim)) return null;
  let hi = i0, lo = i0;
  while(hi + 1 < u.length && magDb[hi + 1] <= lim) hi++;
  while(lo - 1 >= 0 && magDb[lo - 1] <= lim) lo--;
  const edge = (a, b) => { const t = (lim - magDb[a]) / (magDb[b] - magDb[a]); return u[a] + (u[b] - u[a]) * Math.max(0, Math.min(1, t)); };
  const uh = hi + 1 < u.length ? edge(hi, hi + 1) : u[hi], ul = lo - 1 >= 0 ? edge(lo, lo - 1) : u[lo];
  return { lo: ul, hi: uh, frac: uh - ul, clipLo: lo === 0, clipHi: hi === u.length - 1 };
}
/* Bandwidths (−15 dB) for S11, the worst output match, the worst isolation; the narrowest is the usable bandwidth. */
function bandwidths(sw, lim){
  const p = sw.p, worst = (pairs) => sw.u.map((_, k) => Math.max(...pairs.map(([i, j]) => dB20(cabs(mget(sw.S[k], i, j))))));
  const outs = [], iso = [];
  for(let i = 1; i < p; i++){ outs.push([i, i]); for(let j = i + 1; j < p; j++) iso.push([i, j]); }
  const rows = [{ key: 'S11', label: 'S11', curve: worst([[0, 0]]) }];
  if(p === 3){ rows.push({ key: 'S22', label: 'S22', curve: worst([[1, 1]]) }, { key: 'S33', label: 'S33', curve: worst([[2, 2]]) }, { key: 'S23', label: 'S23', curve: worst([[1, 2]]) }); }
  else { rows.push({ key: 'Sjj', label: 'worst Sjj', curve: worst(outs) }); if(iso.length) rows.push({ key: 'Sij', label: 'worst Sij (isolation)', curve: worst(iso) }); }
  rows.forEach(r => { r.bw = bandwidthOf(sw.u, r.curve, lim); });
  let use = null; rows.forEach(r => { const f = r.bw ? r.bw.frac : 0; if(!use || f < (use.bw ? use.bw.frac : 0)) use = r; });
  return { rows, usable: use };
}
/* S-matrix checks at one frequency: matched (all |Sii| < −20 dB), reciprocal (|Sij − Sji| < 1e-9), lossless
   (every column power sum = 1 to 1e-6), isolated (all output pairs < −20 dB). */
function sChecks(S){
  const p = S.n; let match = true, recip = true, iso = true; const col = [];
  for(let j = 0; j < p; j++){ let s = 0; for(let i = 0; i < p; i++) s += cabs(mget(S, i, j)) ** 2; col.push(s); }
  for(let i = 0; i < p; i++){
    if(dB20(cabs(mget(S, i, i))) > -20) match = false;
    for(let j = 0; j < p; j++){ if(i !== j && cabs(csub(mget(S, i, j), mget(S, j, i))) > 1e-9) recip = false; if(i > 0 && j > i && dB20(cabs(mget(S, i, j))) > -20) iso = false; }
  }
  const lossless = col.every(s => Math.abs(s - 1) < 1e-6);
  return { match, recip, iso, lossless, col };
}
// ── END 10 ────────────────────────────────────────────────────
