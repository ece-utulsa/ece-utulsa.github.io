/* RF Cascade Analyzer — engine: complex arithmetic, reflection and standing waves, S-parameter cascades, the
   terminated two-port and three-port, network properties, device presets, input parsing and number display.
   Pure functions only (no DOM), shared by Lecture and Lab mode and loaded on its own by the developer tests.
   Equation numbers E1..E14 are those of spec A.10 (spec_RF_Cascade_Analyzer_v1.1.0.md). The v1.0.0 engine (complex
   helpers, cascade combine, Γ recursion, wave propagation, divider S matrices, 3-port solve) is kept as Research
   confirmed it; v1.1.0 adds the open load, the VSWR guard, strict parsing and the property tests. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — tolerances, limits, unit symbols
   2. Complex numbers  — C, arithmetic, polar form
   3. Reflection       — Γ (E1), VSWR (E2), power split (E3), standing wave (E4)
   4. Two-ports        — cascade (E11), Γ_in (E7), forward/terminated waves (E6), chain propagation (E5)
   5. Three-port       — linear solver, divider S matrices (E14), terminated divider
   6. Properties       — reciprocal, symmetric, lossless, passive (E10, σ_max)
   7. Devices          — Teaching example, lecture gallery presets, Lab presets
   8. Parsing          — complex text, loads (open/short), reference impedance
   9. Display          — A.5.0 number formats, true minus sign
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const EPS_BADGE = 1e-3;          // badge equality tolerance ε (spec A.5.5, D0.5)
const EPS_UNIT = 1e-9;           // |Γ| within this of 1 counts as 1 (VSWR = ∞)
const EPS_ZERO = 1e-12;          // a magnitude below this is zero
const Z0_MIN = 1, Z0_MAX = 1000; // Lab reference impedance range (Ω, real; spec A.9)
const DEG = 180 / Math.PI;       // degrees per radian
const FULL_TURN = 360;           // degrees in a turn
const HALF_TURN = 180;
const MINUS = '−';          // true minus sign (spec A.5.0)
const INF = '∞';            // ∞
const ANGLE_SIGN = '∠';     // ∠
const DB_PER_DECADE = 20;        // |S|dB = 20·log10|S| (E8)
const PCT = 100;                 // fraction -> percent
const SIG_FIG_BELOW = 1;         // percentages below 1 % show 2 significant figures
const SIG_FIGS = 2;
const DEC_MAG = 3, DEC_ANG = 1, DEC_DB = 1, DEC_PCT = 1, DEC_VSWR = 2;   // display resolution (A.5.0)
const OPEN_WORDS = ['open', 'inf', 'infinity', '∞', '+inf', '+infinity'];   // Z_L = ∞ (spec A.9)
const SHORT_WORDS = ['short'];   // Z_L = 0
// ── END CONSTANTS ─────────────────────────────────────────────

// ── COMPLEX NUMBERS ───────────────────────────────────────────
// A complex number.
const C = (re = 0, im = 0) => ({ re, im });
const ZERO = C(0, 0), ONE = C(1, 0);
// Sum, difference, product and quotient of complex numbers.
const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
const csub = (a, b) => C(a.re - b.re, a.im - b.im);
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
// Real multiple, conjugate, magnitude and angle (radians).
const cscale = (a, k) => C(a.re * k, a.im * k);
const conj = a => C(a.re, -a.im);
const cabs = a => Math.hypot(a.re, a.im);
const carg = a => Math.atan2(a.im, a.re);
// Complex number from magnitude and angle in degrees.
const polar = (mag, deg) => C(mag * Math.cos(deg / DEG), mag * Math.sin(deg / DEG));
// Angle in degrees wrapped to (−180°, 180°].
function wrapDeg(d){ let w = ((d % FULL_TURN) + FULL_TURN) % FULL_TURN; if(w > HALF_TURN) w -= FULL_TURN; return w; }
// ── END COMPLEX NUMBERS ───────────────────────────────────────

// ── REFLECTION ────────────────────────────────────────────────
/* A load impedance is { z: C, inf: bool }; inf marks Z_L = ∞ (an open), whose Γ is +1 exactly (E1, the limit).
   v1.0.0 read an open as 0 Ω, a short (physics finding PF-1). */
// Load impedance object from a complex value, or an open.
const zLoad = z => ({ z, inf: false });
const OPEN_LOAD = { z: C(Infinity, 0), inf: true };
// Γ of load ZL against reference Z0 (E1): (ZL − Z0)/(ZL + Z0); +1 for an open.
function gammaLoad(ZL, Z0){
  if(ZL.inf) return C(1, 0);
  const z0 = C(Z0, 0); return cdiv(csub(ZL.z, z0), cadd(ZL.z, z0));
}
// Γ at an interface from region 1 (Z01) into region 2 (Z02), both real (E1).
const gammaInterface = (Z01, Z02) => (Z02 - Z01) / (Z02 + Z01);
// Voltage transmission coefficient τ = 1 + Γ at that interface (v1.4.0): Z02 = ∞ (open) gives 2, Z02 = 0 (short) gives 0.
const tauInterface = (Z01, Z02) => (Z02 === Infinity ? 2 : 1 + gammaInterface(Z01, Z02));
// VSWR of a reflection magnitude (E2): { kind:'num', v } for |Γ| < 1, { kind:'inf' } for |Γ| = 1 and
// { kind:'over' } for |Γ| > 1, where VSWR is not defined (PF-3; v1.0.0 showed a negative VSWR).
function vswr(g){
  if(Math.abs(g - 1) <= EPS_UNIT) return { kind: 'inf', v: Infinity };
  if(g > 1) return { kind: 'over', v: NaN };
  return { kind: 'num', v: (1 + g) / (1 - g) };
}
// Fractions of incident power reflected and delivered by a reflection magnitude g (E3).
const powerSplit = g => ({ refl: g * g, deliv: 1 - g * g });
// |V(d)|/|V⁺| on a lossless line, d in wavelengths from the load toward the source (E4).
function envelope(G, d){ return cabs(cadd(ONE, cmul(G, polar(1, -2 * FULL_TURN * d)))); }
// Positions (in wavelengths from the load, 0 ≤ d ≤ dMax) of the envelope maxima and minima (E4): a maximum where
// θ_Γ − 2βd = −2nπ, a minimum λ/4 from each maximum. Empty for a matched load (flat envelope).
function extrema(G, dMax){
  const out = { max: [], min: [] }; if(cabs(G) <= EPS_ZERO) return out;
  const theta = carg(G) / (2 * Math.PI);           // θ_Γ in turns
  const first = (((theta / 2) % 0.5) + 0.5) % 0.5; // first maximum: d = θ/(4π)·λ, wrapped to [0, λ/2)
  const near = (a, b) => Math.abs(a - b) < EPS_UNIT;
  for(let d = first; d <= dMax + EPS_UNIT; d += 0.5) out.max.push(near(d, 0) ? 0 : d);
  for(let d = (first + 0.25) % 0.5; d <= dMax + EPS_UNIT; d += 0.5) out.min.push(near(d, 0) ? 0 : d);
  return out;
}
// ── END REFLECTION ────────────────────────────────────────────

// ── TWO-PORTS ─────────────────────────────────────────────────
/* A two-port is { s11, s12, s21, s22 }, each a C. */
// Cascade of two-ports A then B (E11).
function combine(A, B){
  const D = csub(ONE, cmul(A.s22, B.s11));
  return { s11: cadd(A.s11, cdiv(cmul(cmul(A.s12, A.s21), B.s11), D)),
           s12: cdiv(cmul(A.s12, B.s12), D), s21: cdiv(cmul(A.s21, B.s21), D),
           s22: cadd(B.s22, cdiv(cmul(cmul(B.s21, B.s12), A.s22), D)) };
}
// Overall S of a chain of two-ports, combined left to right.
function overallS(devs){ let S = devs[0]; for(let i = 1; i < devs.length; i++) S = combine(S, devs[i]); return S; }
// Γ_in of two-port S terminated in Γ_L at port 2 (E7).
const gammaIn = (S, GL) => cadd(S.s11, cdiv(cmul(cmul(S.s12, S.s21), GL), csub(ONE, cmul(S.s22, GL))));
/* The waves of a two-port driven at one port by a unit incident wave, the other port terminated in Γ_T (E6, E7).
   dir 'fwd': a1 = 1, a2 = Γ_T·b2. dir 'rev': a2 = 1, a1 = Γ_T·b1. Returns { a1, a2, b1, b2 } (C). */
function drive(S, dir, GT){
  GT = GT || ZERO;
  if(dir === 'fwd'){ const b2 = cdiv(S.s21, csub(ONE, cmul(S.s22, GT))), a2 = cmul(GT, b2);
    return { a1: ONE, a2, b1: cadd(S.s11, cmul(S.s12, a2)), b2 }; }
  const b1 = cdiv(S.s12, csub(ONE, cmul(S.s11, GT))), a1 = cmul(GT, b1);
  return { a1, a2: ONE, b1, b2: cadd(S.s22, cmul(S.s21, a1)) };
}
// Γ looking into each node of a chain ending in Γ_L (node k = input of device k+1; node N = the load). E7 applied
// right to left. Returns { N, Gr, Gin }.
function branchSetup(devs, GL){
  const N = devs.length, Gr = new Array(N + 1); Gr[N] = GL;
  for(let k = N; k >= 1; k--) Gr[k - 1] = gammaIn(devs[k - 1], Gr[k]);
  return { N, Gr, Gin: Gr[0] };
}
// Node voltage, current and net power along a chain from the wave a_in entering node 0 (E5, peak phasors).
function propagate(devs, setup, ain, Z0){
  const { N, Gr } = setup, sq = Math.sqrt(Z0), Ar = new Array(N + 1);
  Ar[0] = ain;
  for(let k = 1; k <= N; k++){ const d = devs[k - 1]; Ar[k] = cdiv(cmul(d.s21, Ar[k - 1]), csub(ONE, cmul(d.s22, Gr[k]))); }
  const nodes = [];
  for(let k = 0; k <= N; k++){ const a = Ar[k], b = cmul(Gr[k], a);
    nodes.push({ a, b, V: cscale(cadd(a, b), sq), I: cscale(csub(a, b), 1 / sq), P: 0.5 * (cabs(a) ** 2 - cabs(b) ** 2) }); }
  return nodes;
}
// Source wave and reflection (E12): b_s = V_s·√Z0/(Z_s + Z0), Γ_s, and P_avs = |b_s|²/(2(1 − |Γ_s|²)).
function source(Vs, Zs, Z0){
  const z0 = C(Z0, 0), bs = cdiv(cscale(Vs, Math.sqrt(Z0)), cadd(Zs, z0)), Gs = cdiv(csub(Zs, z0), cadd(Zs, z0));
  const den = 1 - cabs(Gs) ** 2;
  return { bs, Gs, Pavs: den > EPS_ZERO ? cabs(bs) ** 2 / (2 * den) : NaN };
}
// Transducer gain G_T of overall S between Γ_s and Γ_L (E13).
function transducerGain(S, Gs, GL){
  const num = cabs(S.s21) ** 2 * (1 - cabs(Gs) ** 2) * (1 - cabs(GL) ** 2);
  const den = csub(cmul(csub(ONE, cmul(S.s11, Gs)), csub(ONE, cmul(S.s22, GL))), cmul(cmul(S.s12, S.s21), cmul(Gs, GL)));
  return num / cabs(den) ** 2;
}
// Impedance seen for reflection G against Z0 (∞ for G = 1).
function zFromGamma(G, Z0){ const den = csub(ONE, G); if(cabs(den) <= EPS_ZERO) return null; return cdiv(cscale(cadd(ONE, G), Z0), den); }
// The cascade as Lab mode shows it: overall S, source and load reflections, input quantities, node table, powers.
function solveCascade(devs, Vs, Zs, ZL, Z0){
  const St = overallS(devs), src = source(Vs, Zs, Z0), GL = gammaLoad(ZL, Z0);
  const setup = branchSetup(devs, GL), Gin = setup.Gin;
  const a1 = cdiv(src.bs, csub(ONE, cmul(src.Gs, Gin)));
  const nodes = propagate(devs, setup, a1, Z0), N = devs.length;
  return { St, Gs: src.Gs, GL, Gin, Zin: zFromGamma(Gin, Z0), nodes, N, Pin: nodes[0].P, PL: nodes[N].P, Pavs: src.Pavs,
           GT: transducerGain(St, src.Gs, GL), reflIn: 0.5 * cabs(nodes[0].b) ** 2 };
}
// ── END TWO-PORTS ─────────────────────────────────────────────

// ── THREE-PORT ────────────────────────────────────────────────
// Solve the complex linear system M·x = b by Gauss–Jordan elimination with partial pivoting; null if singular.
function csolve(M, b){
  const n = M.length, A = M.map((row, i) => row.map(c => ({ ...c })).concat([{ ...b[i] }]));
  for(let col = 0; col < n; col++){
    let piv = col, mx = cabs(A[col][col]);
    for(let r = col + 1; r < n; r++){ const m = cabs(A[r][col]); if(m > mx){ mx = m; piv = r; } }
    if(mx < EPS_ZERO * EPS_ZERO) return null;
    const tmp = A[col]; A[col] = A[piv]; A[piv] = tmp;
    const d = A[col][col]; for(let c = col; c <= n; c++) A[col][c] = cdiv(A[col][c], d);
    for(let r = 0; r < n; r++) if(r !== col){ const f = A[r][col]; for(let c = col; c <= n; c++) A[r][c] = csub(A[r][c], cmul(f, A[col][c])); }
  }
  return A.map(row => row[n]);
}
// Divider 3-port S matrix (port 1 in, 2 = branch A, 3 = branch B) for power fraction alpha into A (E14).
function dividerS(type, alpha){
  const t = Math.sqrt(alpha), r = Math.sqrt(1 - alpha), R = x => C(x, 0);
  if(type === 'ideal') return [[R(0), R(t), R(r)], [R(t), R(r * r), R(-t * r)], [R(r), R(-t * r), R(t * t)]];
  if(type === 'wilkinson'){ const jn = v => C(0, -v); return [[R(0), jn(t), jn(r)], [jn(t), R(0), R(0)], [jn(r), R(0), R(0)]]; }
  if(type === 'resistive') return [[R(0), R(0.5), R(0.5)], [R(0.5), R(0), R(0.5)], [R(0.5), R(0.5), R(0)]];
  const s = R(-1 / 3), x = R(2 / 3);   // T-junction of three equal Z0 lines
  return [[s, x, x], [x, s, x], [x, x, s]];
}
const DIV_EQUAL_ONLY = { resistive: true, tee: true };   // divider types fixed at a 50 % split
// The divider driven from the source with branch chains A and B ending in their loads: waves at the three ports,
// input quantities and the power into each branch.
function solveDivider(type, alpha, Vs, Zs, Z0, devsA, ZLA, devsB, ZLB){
  if(DIV_EQUAL_ONLY[type]) alpha = 0.5;
  const S = dividerS(type, alpha), src = source(Vs, Zs, Z0);
  const GLA = gammaLoad(ZLA, Z0), GLB = gammaLoad(ZLB, Z0), setA = branchSetup(devsA, GLA), setB = branchSetup(devsB, GLB);
  const Z = ZERO, I = ONE, neg = c => cscale(c, -1);
  // unknowns [a1, a2, a3, b1, b2, b3]: b = S·a; branch A and B reflect a2 = Γ_A·b2, a3 = Γ_B·b3; a1 = b_s + Γ_s·b1
  const M = [[neg(S[0][0]), neg(S[0][1]), neg(S[0][2]), I, Z, Z], [neg(S[1][0]), neg(S[1][1]), neg(S[1][2]), Z, I, Z],
             [neg(S[2][0]), neg(S[2][1]), neg(S[2][2]), Z, Z, I], [Z, I, Z, Z, neg(setA.Gin), Z],
             [Z, Z, I, Z, Z, neg(setB.Gin)], [I, Z, Z, neg(src.Gs), Z, Z]];
  const x = csolve(M, [Z, Z, Z, Z, Z, src.bs]) || [Z, Z, Z, Z, Z, Z];
  const [a1, a2, a3, b1, b2, b3] = x, sq = Math.sqrt(Z0);
  const Pin = 0.5 * (cabs(a1) ** 2 - cabs(b1) ** 2), PbrA = 0.5 * (cabs(b2) ** 2 - cabs(a2) ** 2), PbrB = 0.5 * (cabs(b3) ** 2 - cabs(a3) ** 2);
  const Gin = cabs(a1) > EPS_ZERO ? cdiv(b1, a1) : ZERO;
  return { type, alpha, S, Gs: src.Gs, Pavs: src.Pavs, Gin, Zin: zFromGamma(Gin, Z0), V1: cscale(cadd(a1, b1), sq), I1: cscale(csub(a1, b1), 1 / sq),
           Pin, PbrA, PbrB, Pdiss: Pin - PbrA - PbrB, GLA, GLB,
           nodesA: propagate(devsA, setA, b2, Z0), nodesB: propagate(devsB, setB, b3, Z0) };
}
// ── END THREE-PORT ────────────────────────────────────────────

// ── PROPERTIES ────────────────────────────────────────────────
// Column power sums |S11|² + |S21|² (driving port 1) and |S12|² + |S22|² (driving port 2).
const columnSums = S => [cabs(S.s11) ** 2 + cabs(S.s21) ** 2, cabs(S.s12) ** 2 + cabs(S.s22) ** 2];
// Largest singular value of the 2×2 matrix S: √ of the larger eigenvalue of the Hermitian SᴴS.
function sigmaMax(S){
  const p = cabs(S.s11) ** 2 + cabs(S.s21) ** 2, q = cabs(S.s12) ** 2 + cabs(S.s22) ** 2;
  const r = cadd(cmul(conj(S.s11), S.s12), cmul(conj(S.s21), S.s22));   // off-diagonal of SᴴS
  const disc = Math.sqrt(((p - q) / 2) ** 2 + cabs(r) ** 2);
  return Math.sqrt((p + q) / 2 + disc);
}
// Largest |(SᴴS − I)_ij| (zero for a lossless network).
function unitaryError(S){
  const [p, q] = columnSums(S), r = cabs(cadd(cmul(conj(S.s11), S.s12), cmul(conj(S.s21), S.s22)));
  return Math.max(Math.abs(p - 1), Math.abs(q - 1), r);
}
// The four badge tests of spec A.5.5 (E10, ε = 1e-3) and the column-sum note.
function properties(S){
  const reciprocal = cabs(csub(S.s12, S.s21)) <= EPS_BADGE;
  const symmetric = reciprocal && cabs(csub(S.s11, S.s22)) <= EPS_BADGE;
  const lossless = unitaryError(S) <= EPS_BADGE;
  const smax = sigmaMax(S), passive = smax <= 1 + EPS_BADGE, sums = columnSums(S);
  const sumsPass = sums[0] <= 1 + EPS_BADGE && sums[1] <= 1 + EPS_BADGE;
  return { reciprocal, symmetric, lossless, passive, sigmaMax: smax, sums, disagree: sumsPass && !passive };
}
// ── END PROPERTIES ────────────────────────────────────────────

// ── DEVICES ───────────────────────────────────────────────────
// A two-port from magnitude/angle pairs [mag, deg] for S11, S21, S12, S22.
const devPolar = (s11, s21, s12, s22) => ({ s11: polar(...s11), s21: polar(...s21), s12: polar(...s12), s22: polar(...s22) });
// The Teaching example (spec A.5.0): reciprocal, not symmetric, passive and lossy.
const TEACHING = () => devPolar([0.3, 40], [0.6, -70], [0.6, -70], [0.4, -20]);
// Lecture gallery presets (spec A.5.6), with their defaults. iso = Infinity means S12 = 0.
const GALLERY_DEFAULTS = { through: { bl: 90 }, atten: { A: 3 }, amp: { G: 20, I: Infinity }, isolator: { IL: 0.5, I: Infinity } };
const fromDb = db => Math.pow(10, db / DB_PER_DECADE);   // |S| from |S|dB
// S of a gallery device for its parameters.
function galleryS(kind, p){
  const iso = I => (I === Infinity ? 0 : fromDb(-I));
  switch(kind){
    case 'through': return devPolar([0, 0], [1, -p.bl], [1, -p.bl], [0, 0]);
    case 'atten': { const k = fromDb(-p.A); return devPolar([0, 0], [k, 0], [k, 0], [0, 0]); }
    case 'amp': return devPolar([0, 0], [fromDb(p.G), 0], [iso(p.I), 0], [0, 0]);
    case 'isolator': return devPolar([0, 0], [fromDb(-p.IL), 0], [iso(p.I), 0], [0, 0]);
  }
  return TEACHING();
}
// Lab presets (spec A.9; the Circulator is removed, E-Q4). param is in dB, or degrees for the phase shift.
const LAB_PRESETS = ['thru', 'atten', 'amp', 'phase', 'filter', 'isolator'];
const LAB_DEFAULT_PARAM = { atten: 3, amp: 10, phase: 45, filter: 20, isolator: 0.5 };
// S of a Lab preset with parameter p.
function labPresetS(type, p){
  switch(type){
    case 'thru': return devPolar([0, 0], [1, 0], [1, 0], [0, 0]);
    case 'atten': { const k = fromDb(-p); return devPolar([0, 0], [k, 0], [k, 0], [0, 0]); }
    case 'amp': return devPolar([0, 0], [fromDb(p), 0], [0, 0], [0, 0]);
    case 'phase': return devPolar([0, 0], [1, -p], [1, -p], [0, 0]);
    case 'filter': { const t = fromDb(-p), r = Math.sqrt(Math.max(0, 1 - t * t));   // lossless reflective
      return devPolar([r, 90], [t, 0], [t, 0], [r, 90]); }
    case 'isolator': return devPolar([0, 0], [fromDb(-p), 0], [0, 0], [0, 0]);
  }
  return null;
}
// ── END DEVICES ───────────────────────────────────────────────

// ── PARSING ───────────────────────────────────────────────────
const NUM = '(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';         // an unsigned decimal number
const RE_NUM = new RegExp('^[+-]?' + NUM + '$', 'i');
const RE_POLAR = new RegExp('^([+-]?' + NUM + ')(?:\u2220|<|@)([+-]?' + NUM + ')$', 'i');
/* Parse complex text: rectangular "30+j40", "30+40j", "−j50", "25"; polar "0.5∠45", "0.5<45", "0.5@45" with the angle
   in `unit` ('deg' or 'rad'). Returns a C, or null for text that is not a number (spec A.9: invalid input is flagged,
   never read as 0). */
function parseComplex(text, unit){
  if(typeof text !== 'string') return null;
  const s = text.trim().replace(/\u2212/g, '-').replace(/\s+/g, '').replace(/i/gi, 'j');
  if(!s) return null;
  const m = s.match(RE_POLAR);
  if(m){ const mag = +m[1], ang = +m[2]; return polar(mag, unit === 'rad' ? ang * DEG : ang); }
  // terms split before every + or − that is not an exponent sign
  const terms = s.match(/[+-]?(?:[^+-]|(?<=e)[+-])+/gi);
  if(!terms || terms.join('') !== s) return null;
  let re = 0, im = 0;
  for(const t of terms){
    if(/j/i.test(t)){
      const coef = t.replace(/j/i, '');                     // j before or after its coefficient
      if((t.match(/j/gi) || []).length !== 1 || !/^[+-]?j|j$/i.test(t)) return null;
      if(coef === '' || coef === '+') im += 1; else if(coef === '-') im -= 1; else if(RE_NUM.test(coef)) im += +coef; else return null;
    } else if(RE_NUM.test(t)) re += +t; else return null;
  }
  return isFinite(re) && isFinite(im) ? C(re, im) : null;
}
// Parse a load impedance: "open", "inf", "∞", "Infinity" give an open (Γ = +1); "short" gives 0 Ω; otherwise complex
// text. null when invalid.
function parseLoad(text, unit){
  const w = typeof text === 'string' ? text.trim().toLowerCase() : '';
  if(OPEN_WORDS.includes(w)) return OPEN_LOAD;
  if(SHORT_WORDS.includes(w)) return zLoad(ZERO);
  const z = parseComplex(text, unit); return z ? zLoad(z) : null;
}
// Parse a reference impedance: a real number from Z0_MIN to Z0_MAX Ω, or null.
function parseZ0(text){
  const z = parseComplex(text, 'deg'); if(!z || Math.abs(z.im) > 0 || !(z.re >= Z0_MIN && z.re <= Z0_MAX)) return null;
  return z.re;
}
// ── END PARSING ───────────────────────────────────────────────

// ── DISPLAY ───────────────────────────────────────────────────
// Fixed-point text with the true minus sign and no "−0".
function fx(x, d){ let s = (+x).toFixed(d); if(/^-0\.?0*$/.test(s)) s = s.slice(1); return s.replace('-', MINUS); }
// |S| or |Γ| to 3 decimals.
const fmtMag = m => fx(m, DEC_MAG);
// Angle of c in degrees, 1 decimal, wrapped to (−180°, 180°]; 0.0° for a zero magnitude.
function fmtAng(c){ const a = cabs(c) <= EPS_ZERO ? 0 : wrapDeg(carg(c) * DEG); let s = fx(a, DEC_ANG); if(s === fx(-HALF_TURN, DEC_ANG)) s = fx(HALF_TURN, DEC_ANG); return s + '°'; }
// Magnitude∠angle (degrees).
const fmtPolar = c => fmtMag(cabs(c)) + ANGLE_SIGN + fmtAng(c);
// |S| in dB, 1 decimal; −∞ dB for zero.
const dbOf = m => (m <= EPS_ZERO ? -Infinity : DB_PER_DECADE * Math.log10(m));
// |S| in dB as text.
function fmtDb(db){ return db === -Infinity ? MINUS + INF + ' dB' : fx(db, DEC_DB) + ' dB'; }
// A fraction as a percentage: 1 decimal, or 2 significant figures below 1 %.
function fmtPct(f){
  const p = f * PCT; if(p === 0) return '0.0%';
  if(Math.abs(p) < SIG_FIG_BELOW){ const d = Math.max(0, SIG_FIGS - 1 - Math.floor(Math.log10(Math.abs(p)))); return fx(p, d) + '%'; }
  return fx(p, DEC_PCT) + '%';
}
// VSWR text (A.5.0): 2 decimals, "∞" at |Γ| = 1, "— (|Γ| > 1)" above.
function fmtVswr(g){ const v = vswr(g); return v.kind === 'inf' ? INF : v.kind === 'over' ? '— (|Γ| > 1)' : fx(v.v, DEC_VSWR); }
// Rectangular complex text, 3 decimals: "30.000 + j40.000".
function fmtRect(c, d){ d = d === undefined ? DEC_MAG : d; const im = fx(Math.abs(c.im), d);
  return fx(c.re, d) + (c.im < 0 ? ' ' + MINUS + ' j' : ' + j') + im; }
// ── END DISPLAY ───────────────────────────────────────────────
