/* RF Cascade Analyzer — engine: complex arithmetic, reflection, S-parameter cascades, the terminated two-port, the
   divider S matrices and the linear solver, network properties, device presets, input parsing and number display.
   Pure functions only (no DOM), used by the three views and loaded on its own by the developer tests.
   Equation numbers E1..E14 are those of spec A.10 (spec v1.1.0). v1.8.1: the helpers no view calls were removed
   (CQ-RFC-008); number parsing is a strict, linear-time decimal grammar (SEC-RFC-001, -006); one dB formatter. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — tolerances, limits, unit symbols
   2. Complex numbers  — C, arithmetic, polar form
   3. Reflection       — Γ (E1), VSWR (E2), power split (E3), standing wave (E4)
   4. Two-ports        — cascade (E11), Γ_in (E7), forward/terminated waves (E6), chain propagation (E5)
   5. Three-port       — linear solver, divider S matrices (E14)
   6. Properties       — reciprocal, symmetric, lossless, passive (E10, σ_max)
   7. Devices          — Teaching example, gallery presets, chain-block presets
   8. Parsing          — complex text, real numbers, loads (open/short), reference impedance
   9. Display          — A.5.0 number formats, true minus sign, dB text
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
const OPEN_WORDS = ['open', '∞'];   // Z_L = ∞ (spec A.9); v1.8.1: "inf"/"Infinity" are refused (DEFECT-RFC-002, finite values only)
const SHORT_WORDS = ['short'];   // Z_L = 0
const DECADE = 10;               // base of the logarithms (dB)
const INPUT_MAXLEN = 64;         // longest typed entry accepted (characters); longer text is refused, so parsing stays cheap
const DB_POWER = 10;             // a power ratio in dB = 10·log10(ratio)
const DB_ROUND = 10;             // dB text is rounded to 1/DB_ROUND dB
const PEAK = 0.5;                // peak phasors: a wave a carries ½|a|² of power; P = ½Re{VI*}
const P_ZERO = 1e-12;            // a net power within this fraction of the waves' power is rounding (an open, a short), not a flow
const RESISTIVE_S = 0.5;         // resistive divider: every |S| off the diagonal is ½ (6 dB)
const TEE_S11 = -1 / 3, TEE_S21 = 2 / 3;   // T-junction of three equal Z0 lines
const TEACHING_S = { s11: [0.3, 40], s21: [0.6, -70], s12: [0.6, -70], s22: [0.4, -20] };   // Teaching example [|S|, °] (spec A.5.0)
// ── END CONSTANTS ─────────────────────────────────────────────

// ── COMPLEX NUMBERS ───────────────────────────────────────────
// A complex number.
const C = (re = 0, im = 0) => ({ re, im });
const ZERO = C(0, 0), ONE = C(1, 0);
// a + b (complex numbers).
const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
// a − b
const csub = (a, b) => C(a.re - b.re, a.im - b.im);
// a·b
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
// a/b
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
// a·k for a real k.
const cscale = (a, k) => C(a.re * k, a.im * k);
// complex conjugate
const conj = a => C(a.re, -a.im);
// |a|
const cabs = a => Math.hypot(a.re, a.im);
// angle of a (radians)
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
/* Net power ½(|a|² − |b|²) of a forward wave a and a backward wave b (peak phasors); a value within P_ZERO of the
   waves' own power is rounding, not a flow, and is returned as 0 (an open or a short gives exactly zero, never a tiny
   negative power read as "flows out"). */
function netPower(a, b){ const pa = cabs(a) ** 2, pb = cabs(b) ** 2, p = PEAK * (pa - pb); return Math.abs(p) <= P_ZERO * PEAK * (pa + pb) ? 0 : p; }
// Node voltage, current and net power along a chain from the wave a_in entering node 0 (E5, peak phasors).
function propagate(devs, setup, ain, Z0){
  const { N, Gr } = setup, sq = Math.sqrt(Z0), Ar = new Array(N + 1);
  Ar[0] = ain;
  for(let k = 1; k <= N; k++){ const d = devs[k - 1]; Ar[k] = cdiv(cmul(d.s21, Ar[k - 1]), csub(ONE, cmul(d.s22, Gr[k]))); }
  const nodes = [];
  for(let k = 0; k <= N; k++){ const a = Ar[k], b = cmul(Gr[k], a);
    nodes.push({ a, b, V: cscale(cadd(a, b), sq), I: cscale(csub(a, b), 1 / sq), P: netPower(a, b) }); }
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
// A single cascade driven by the source: overall S, source and load reflections, input quantities, node table, powers.
function solveCascade(devs, Vs, Zs, ZL, Z0){
  const St = overallS(devs), src = source(Vs, Zs, Z0), GL = gammaLoad(ZL, Z0);
  const setup = branchSetup(devs, GL), Gin = setup.Gin;
  const a1 = cdiv(src.bs, csub(ONE, cmul(src.Gs, Gin)));
  const nodes = propagate(devs, setup, a1, Z0), N = devs.length;
  return { St, Gs: src.Gs, GL, Gin, Zin: zFromGamma(Gin, Z0), nodes, N, Pin: nodes[0].P, PL: nodes[N].P, Pavs: src.Pavs,
           GT: transducerGain(St, src.Gs, GL), reflIn: PEAK * cabs(nodes[0].b) ** 2 };
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
  // √α and √(1 − α): the amplitude split; R(x) is the real number x as a complex
  const t = Math.sqrt(alpha), r = Math.sqrt(1 - alpha), R = x => C(x, 0);
  if(type === 'ideal') return [[R(0), R(t), R(r)], [R(t), R(r * r), R(-t * r)], [R(r), R(-t * r), R(t * t)]];
  // −j·v: the Wilkinson's quarter-wave arms
  if(type === 'wilkinson'){ const jn = v => C(0, -v); return [[R(0), jn(t), jn(r)], [jn(t), R(0), R(0)], [jn(r), R(0), R(0)]]; }
  if(type === 'resistive'){ const q = R(RESISTIVE_S); return [[R(0), q, q], [q, R(0), q], [q, q, R(0)]]; }
  const s = R(TEE_S11), x = R(TEE_S21);   // T-junction of three equal Z0 lines
  return [[s, x, x], [x, s, x], [x, x, s]];
}
const DIV_EQUAL_ONLY = { resistive: true, tee: true };   // divider types fixed at a 50 % split
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
const TEACHING = () => devPolar(TEACHING_S.s11, TEACHING_S.s21, TEACHING_S.s12, TEACHING_S.s22);
// |S| from |S| in dB.
const fromDb = db => Math.pow(DECADE, db / DB_PER_DECADE);
// S of a Devices-view preset for its parameters (spec A.5.6); isolation I = Infinity means S12 = 0.
function galleryS(kind, p){
  // |S12| of an isolation I dB (0 for infinite isolation)
  const iso = I => (I === Infinity ? 0 : fromDb(-I));
  switch(kind){
    case 'through': return devPolar([0, 0], [1, -p.bl], [1, -p.bl], [0, 0]);
    case 'atten': { const k = fromDb(-p.A); return devPolar([0, 0], [k, 0], [k, 0], [0, 0]); }
    case 'amp': return devPolar([0, 0], [fromDb(p.G), 0], [iso(p.I), 0], [0, 0]);
    case 'isolator': return devPolar([0, 0], [fromDb(-p.IL), 0], [iso(p.I), 0], [0, 0]);
  }
  return TEACHING();
}
// S of a Cascade chain preset with parameter p (dB, or degrees for the phase shift; spec A.9).
function labPresetS(type, p){
  switch(type){
    case 'thru': return devPolar([0, 0], [1, 0], [1, 0], [0, 0]);
    case 'atten': { const k = fromDb(-p); return devPolar([0, 0], [k, 0], [k, 0], [0, 0]); }
    case 'amp': return devPolar([0, 0], [fromDb(p), 0], [0, 0], [0, 0]);
    case 'phase': return devPolar([0, 0], [1, -p], [1, -p], [0, 0]);
    case 'isolator': return devPolar([0, 0], [fromDb(-p), 0], [0, 0], [0, 0]);
  }
  return null;
}
// ── END DEVICES ───────────────────────────────────────────────

// ── PARSING ───────────────────────────────────────────────────
// An unsigned decimal number. One way to split any digit run (digits, then an optional fraction), so a failing entry is
// rejected in linear time (SEC-RFC-001; v1.8.0's \d+\.?\d* backtracked quadratically).
const NUM = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const RE_NUM = new RegExp('^[+-]?' + NUM + '$', 'i');
const RE_POLAR = new RegExp('^([+-]?' + NUM + ')(?:\u2220|<|@)([+-]?' + NUM + ')$', 'i');
/* Parse complex text: rectangular "30+j40", "30+40j", "−j50", "25"; polar "0.5∠45", "0.5<45", "0.5@45" with the angle
   in `unit` ('deg' or 'rad'). Returns a C, or null for text that is not a number (spec A.9: invalid input is flagged,
   never read as 0). */
function parseComplex(text, unit){
  if(typeof text !== 'string' || text.length > INPUT_MAXLEN) return null;
  const s = text.trim().replace(/\u2212/g, '-').replace(/\s+/g, '').replace(/i/gi, 'j');
  if(!s) return null;
  const m = s.match(RE_POLAR);
  if(m){ const mag = +m[1], ang = +m[2]; return isFinite(mag) && isFinite(ang) ? polar(mag, unit === 'rad' ? ang * DEG : ang) : null; }
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
// A real number in the strict decimal grammar (optional sign, digits, fraction, exponent; true minus accepted) with a
// finite value, or null: "0x10", "1e309", "Infinity", "1_0" are refused (SEC-RFC-006).
function parseRealStrict(text){
  if(typeof text !== 'string' || text.length > INPUT_MAXLEN) return null;
  const s = text.trim().replace(/\u2212/g, '-'), v = RE_NUM.test(s) ? +s : NaN;
  return isFinite(v) ? v : null;
}
// Parse a load impedance: "open" or "∞" give an open (Γ = +1); "short" gives 0 Ω; otherwise complex text. null when
// invalid.
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
// |S| in dB; −∞ dB for zero.
const dbOf = m => (m <= EPS_ZERO ? -Infinity : DB_PER_DECADE * Math.log10(m));
// A power ratio in dB, or null when it has none (a power ≤ 0 is never given a dB value, PPR-RFC-001); −∞ for zero.
const dbPow = r => (r > 0 ? DB_POWER * Math.log10(r) : r === 0 ? -Infinity : null);
/* A dB value as text, 1 decimal (the one dB formatter, CQ-RFC-017): o.plus writes "+" before a positive value, o.trim
   drops ".0" from a whole number ("+10 dB"); ±∞ written with the true minus. */
function fmtDbVal(db, o){
  o = o || {}; if(db === Infinity) return INF + ' dB'; if(db === -Infinity) return MINUS + INF + ' dB';
  const r = Math.round(db * DB_ROUND) / DB_ROUND, t = o.trim && Number.isInteger(r) ? fx(r, 0) : fx(r, DEC_DB);
  return (o.plus && r > 0 ? '+' : '') + t + ' dB';
}
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
