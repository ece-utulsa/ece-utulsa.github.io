// RF Cascade Analyzer — developer tests of the engine (Node, no browser). Run: node tests/engine.test.js
// Expected values are worked by hand from the spec's equations (A.10), not read from the tool. Developer tests, not
// the acceptance suite.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8') + '\n;this.E = { C, cabs, carg, polar, gammaLoad, gammaInterface, tauInterface, vswr, powerSplit, envelope, OPEN_LOAD, zLoad, ' +
  'combine, overallS, gammaIn, drive, solveCascade, properties, sigmaMax, TEACHING, galleryS, labPresetS, devPolar, fromDb, parseComplex, parseRealStrict, parseLoad, parseZ0, ' +
  'fmtMag, dbOf, dbPow, fmtDbVal, fmtPct, fmtVswr, wrapDeg, csolve, dividerS, source, branchSetup, propagate, INPUT_MAXLEN, loopPole, chainPole, POLE_TOL };', ctx, { filename: 'engine.js' });
const E = ctx.E;
/* The Cascade view's solver (cascade.js, with the helpers it uses from ui.js and devices.js) in its own context, no DOM:
   these tests cover the divider that ships (divWaves/solveAt), not a separate engine copy (CQ-RFC-008). */
const cx = {}; vm.createContext(cx);
vm.runInContext(['engine.js', 'ui.js', 'devices.js', 'cascade.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') +
  '\n;this.X = { K, solveAt, sweepCached, resetExample, newBlock, fmtPow, ratioText, isActive, polarField, zLoad, C, OPEN_LOAD, refOf, dividerS, source, branchSetup, propagate, csolve, gammaLoad, devS, angShown, polarU, checkZ0, checkZ, checkS, REFUSED, S_ENTRY_MAX, AMP_G_MAX_DB, Z_MAX_TEXT, BAND_REL_TEXT, ACTIVE_NOTE, DIV_NOTE, minusZ0 };',
  cx, { filename: 'cascade-bundle.js' });
const X = cx.X;

let pass = 0, fail = 0;
function t(name, fn){ try { fn(); pass++; console.log('PASS', name); } catch(e){ fail++; console.log('FAIL', name, '-', e.message); } }
function near(a, b, tol, m){ if(!(Math.abs(a - b) <= (tol || 1e-9))) throw new Error((m || '') + ' got ' + a + ' want ' + b); }
function eq(a, b, m){ const x = JSON.stringify(a), y = JSON.stringify(b); if(x !== y) throw new Error((m || '') + ' got ' + x + ' want ' + y); }
function ok(v, m){ if(!v) throw new Error(m || 'expected true'); }
const Z = (re, im) => E.zLoad(E.C(re, im || 0));

t('E1: Γ of matched, short, open, 100 Ω, 30+j40 Ω', () => {
  near(E.cabs(E.gammaLoad(Z(50), 50)), 0); near(E.gammaLoad(Z(0), 50).re, -1);
  const G = E.gammaLoad(E.OPEN_LOAD, 50); near(G.re, 1); near(G.im, 0);
  near(E.gammaLoad(Z(100), 50).re, 1 / 3);
  const g = E.gammaLoad(Z(30, 40), 50);   // (−20 + j40)/(80 + j40) = j0.5
  near(g.re, 0, 1e-12); near(g.im, 0.5, 1e-12);
});
t('PF-1: "open" and "∞" are an open (Γ = +1); "short" is 0 Ω; v1.8.1: "inf" and "Infinity" are refused (DEFECT-RFC-002)', () => {
  for(const w of ['open', '∞', ' OPEN ']){ const g = E.gammaLoad(E.parseLoad(w, 'deg'), 50); near(g.re, 1, 0, w); near(g.im, 0, 0, w); }
  near(E.gammaLoad(E.parseLoad('short', 'deg'), 50).re, -1, 0);
  for(const w of ['inf', 'Infinity', '+inf', '1e309', '0x10']) eq(E.parseLoad(w, 'deg'), null, w);
});
t('E1 interface and E3 split at Z02 = 5, 25, 50, 150, 500 Ω', () => {
  for(const z of [5, 25, 50, 150, 500]){ const g = E.gammaInterface(50, z), p = E.powerSplit(Math.abs(g));
    near(g, (z - 50) / (z + 50)); near(p.refl + p.deliv, 1); }
  eq(E.fmtPct(E.powerSplit(0.5).refl), '25.0%');
});
t('v1.4.0 τ = 1 + Γ at an interface: 150, 16.7, 50 Ω, short, open', () => {
  near(E.tauInterface(50, 150), 1.5, 1e-12); near(E.tauInterface(50, 50 / 3), 0.5, 1e-12); near(E.tauInterface(50, 50), 1, 1e-12);
  near(E.tauInterface(50, 0), 0, 1e-12); eq(E.tauInterface(50, Infinity), 2);
  for(const z of [5, 25, 75, 500]) near(E.tauInterface(50, z), 1 + E.gammaInterface(50, z), 1e-15);
  // power balance: transmitted power τ²·Z01/Z02 = 1 − Γ²
  for(const z of [16.7, 150, 500]){ const g = E.gammaInterface(50, z), t = E.tauInterface(50, z); near(t * t * 50 / z, 1 - g * g, 1e-12); }
});
t('E2 / PF-3: VSWR, ∞ at |Γ| = 1, undefined above 1', () => {
  near(E.vswr(1 / 3).v, 2); eq(E.fmtVswr(1), '∞'); eq(E.fmtVswr(E.cabs(E.gammaLoad(Z(0, 50), 50))), '∞');
  eq(E.fmtVswr(E.cabs(E.gammaLoad(Z(-25), 50))), '— (|Γ| > 1)'); eq(E.fmtVswr(0), '1.00');
});
t('E4: envelope |1 + Γe^(−j2βd)| (30 + j40 Ω: Γ = j0.5); a short gives 0 at the load and 2 at λ/4', () => {
  const G = E.gammaLoad(Z(30, 40), 50); for(const d of [0, 0.1, 0.2, 0.3, 0.45]){
    const want = E.cabs(E.C(1 + 0.5 * Math.cos(Math.PI / 2 - 4 * Math.PI * d), 0.5 * Math.sin(Math.PI / 2 - 4 * Math.PI * d))); near(E.envelope(G, d), want, 1e-12); }
  const s = E.gammaLoad(Z(0), 50); near(E.envelope(s, 0), 0, 1e-12); near(E.envelope(s, 0.25), 2, 1e-12);
});
t('E11: cascades — two 3 dB attenuators, amp then attenuator, two arbitrary complex devices (vs T matrices)', () => {
  const a = E.labPresetS('atten', 3), S = E.overallS([a, a]); near(E.dbOf(E.cabs(S.s21)), -6, 1e-9);
  const S2 = E.overallS([E.labPresetS('amp', 12), E.labPresetS('atten', 3)]); near(E.dbOf(E.cabs(S2.s21)), 9, 1e-9);
  const A = { s11: E.C(0.2, 0.1), s21: E.C(0.7, -0.3), s12: E.C(0.1, 0.05), s22: E.C(-0.15, 0.25) };
  const B = { s11: E.C(-0.3, 0.2), s21: E.C(0.5, 0.4), s12: E.C(0.2, -0.1), s22: E.C(0.1, -0.35) };
  // T = [[−det/S21, S11/S21], [−S22/S21, 1/S21]]; cascade T = TA·TB; then back to S
  const mul = (x, y) => E.C(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re), sub = (x, y) => E.C(x.re - y.re, x.im - y.im), add = (x, y) => E.C(x.re + y.re, x.im + y.im);
  const div = (x, y) => { const d = y.re ** 2 + y.im ** 2; return E.C((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d); };
  const T = s => { const det = sub(mul(s.s11, s.s22), mul(s.s12, s.s21)); return [[div(E.C(-det.re, -det.im), s.s21), div(s.s11, s.s21)], [div(E.C(-s.s22.re, -s.s22.im), s.s21), div(E.C(1, 0), s.s21)]]; };
  const mm = (P, Q) => [[add(mul(P[0][0], Q[0][0]), mul(P[0][1], Q[1][0])), add(mul(P[0][0], Q[0][1]), mul(P[0][1], Q[1][1]))], [add(mul(P[1][0], Q[0][0]), mul(P[1][1], Q[1][0])), add(mul(P[1][0], Q[0][1]), mul(P[1][1], Q[1][1]))]];
  const Tt = mm(T(A), T(B)), s21 = div(E.C(1, 0), Tt[1][1]), s11 = div(Tt[0][1], Tt[1][1]), s22 = div(E.C(-Tt[1][0].re, -Tt[1][0].im), Tt[1][1]);
  const s12 = sub(Tt[0][0], div(mul(Tt[0][1], Tt[1][0]), Tt[1][1]));
  const S3 = E.combine(A, B);
  for(const [x, y] of [[S3.s11, s11], [S3.s21, s21], [S3.s22, s22], [S3.s12, s12]]){ near(x.re, y.re, 1e-12); near(x.im, y.im, 1e-12); }
});
t('E7: Γ_in for the Teaching example and Γ_L = 0.5∠0°; isolator gives Γ_in = S11', () => {
  const S = E.TEACHING(), GL = E.polar(0.5, 0), g = E.gammaIn(S, GL);
  const w = E.drive(S, 'fwd', GL); near(w.b1.re, g.re, 1e-12); near(w.b1.im, g.im, 1e-12);   // b1/a1 with a1 = 1
  near(E.cabs(E.C(w.a2.re - 0.5 * w.b2.re, w.a2.im - 0.5 * w.b2.im)), 0, 1e-12, 'a2 = Γ_L·b2');
  ok(E.cabs(E.C(g.re - S.s11.re, g.im - S.s11.im)) > 1e-3, 'Γ_in ≠ S11');
  const iso = E.galleryS('isolator', { IL: 0.5, I: Infinity }); near(E.cabs(E.gammaIn(iso, E.polar(0.8, -45))), 0, 1e-12);
});
t('E12/E13: G_T equals P_L/P_avs (Amp 12 dB + Atten 3 dB, Z_s = 25 + j10, Z_L = 100 − j30)', () => {
  const r = E.solveCascade([E.labPresetS('amp', 12), E.labPresetS('atten', 3)], E.C(1, 0), E.C(25, 10), Z(100, -30), 50);
  near(r.GT, r.PL / r.Pavs, 1e-12); near(r.Pin, r.nodes[0].P, 1e-15);
  const m = E.solveCascade([E.labPresetS('atten', 3)], E.C(1, 0), E.C(50), Z(50), 50);   // matched: P_avs = 1/(8·50) W
  near(m.Pavs, 1 / 400, 1e-15); near(m.PL / m.Pavs, Math.pow(10, -0.3), 1e-12);
});
t('D7.4: net power is non-increasing along a passive chain', () => {
  const t20 = E.fromDb(-20), r20 = Math.sqrt(1 - t20 * t20), refl = E.devPolar([r20, 90], [t20, 0], [t20, 0], [r20, 90]);   // a lossless reflective two-port
  const r = E.solveCascade([refl, E.labPresetS('phase', 45), E.labPresetS('thru'), E.labPresetS('atten', 2)], E.C(1, 0), E.C(25, 10), Z(100, -30), 50);
  for(let k = 1; k < r.nodes.length; k++) ok(r.nodes[k].P <= r.nodes[k - 1].P + 1e-15, 'node ' + k);
});
/* An independent check of the shipped divider: the 3-port and its source solved as one 6×6 system for the waves
   [a1, a2, a3, b1, b2, b3] (b = S·a; a2 = Γ_A·b2, a3 = Γ_B·b3; a1 = b_s + Γ_s·b1), not the 2×2 reduction cascade.js uses. */
function divider6(type, alpha, Vs, Zs, Z0, GA, GB){
  const S = E.dividerS(type, alpha), src = E.source(Vs, Zs, Z0), Zr = E.C(0, 0), I = E.C(1, 0), neg = c => E.C(-c.re, -c.im);
  const M = [[neg(S[0][0]), neg(S[0][1]), neg(S[0][2]), I, Zr, Zr], [neg(S[1][0]), neg(S[1][1]), neg(S[1][2]), Zr, I, Zr],
             [neg(S[2][0]), neg(S[2][1]), neg(S[2][2]), Zr, Zr, I], [Zr, I, Zr, Zr, neg(GA), Zr], [Zr, Zr, I, Zr, Zr, neg(GB)], [I, Zr, Zr, neg(src.Gs), Zr, Zr]];
  const [a1, a2, a3, b1, b2, b3] = E.csolve(M, [Zr, Zr, Zr, Zr, Zr, src.bs]), P = (a, b) => 0.5 * (E.cabs(a) ** 2 - E.cabs(b) ** 2);
  return { Pin: P(a1, b1), PA: P(b2, a2), PB: P(b3, a3), Gin: E.C((b1.re * a1.re + b1.im * a1.im) / E.cabs(a1) ** 2, (b1.im * a1.re - b1.re * a1.im) / E.cabs(a1) ** 2) };
}
// Put the Cascade view's circuit in a state: a divider of type and split, branch loads, an empty main chain.
function setDivider(type, split, zlA, zlB, zs){
  const K = X.K; X.resetExample(); K.main = []; K.A = []; K.B = []; K.div = { type, split }; K.zlA = zlA; K.zlB = zlB; if(zs) K.zs = zs; K.cache = null;
}
t('E14: shipped divider (cascade.js) — resistive quarter power and half dissipated, T-junction |Γ_in| = 1/3, Wilkinson and ideal 25/75', () => {
  setDivider('resistive', 50, X.zLoad(X.C(50, 0)), X.zLoad(X.C(50, 0)));
  let r = X.solveAt(1e9); near(E.cabs(r.Gin), 0, 1e-12); near(r.PA / r.Pin, 0.25, 1e-12); near(r.Pdiss / r.Pin, 0.5, 1e-12);
  setDivider('tee', 50, X.zLoad(X.C(50, 0)), X.zLoad(X.C(50, 0))); near(E.cabs(X.solveAt(1e9).Gin), 1 / 3, 1e-12);
  for(const ty of ['wilkinson', 'ideal']){ setDivider(ty, 25, X.zLoad(X.C(50, 0)), X.zLoad(X.C(50, 0))); r = X.solveAt(1e9);
    near(r.PA / r.PB, 1 / 3, 1e-9, ty); near(r.Pdiss, 0, 1e-15, ty); }
});
t('E14: shipped divider equals the independent 6×6 solve (every type, mismatched and reactive branch loads, Zs = 25 + j10)', () => {
  for(const ty of ['ideal', 'wilkinson', 'resistive', 'tee']) for(const [za, zb] of [[[50, 0], [50, 0]], [[100, -30], [20, 15]], [[0, 0], [75, 0]]]){
    const sp = ['resistive', 'tee'].includes(ty) ? 50 : 30, ZA = X.zLoad(X.C(...za)), ZB = X.zLoad(X.C(...zb));
    setDivider(ty, sp, ZA, ZB, X.C(25, 10)); const r = X.solveAt(1e9);
    const o = divider6(ty, sp / 100, X.C(1, 0), X.C(25, 10), 50, X.gammaLoad(ZA, 50), X.gammaLoad(ZB, 50));
    near(r.Pin, o.Pin, 1e-15, ty + ' Pin'); near(r.PA, o.PA, 1e-15, ty + ' PA'); near(r.PB, o.PB, 1e-15, ty + ' PB'); near(r.Gin.re, o.Gin.re, 1e-12); near(r.Gin.im, o.Gin.im, 1e-12); }
});
t('E10: badges — D5.1..D5.6 cases', () => {
  const P = S => E.properties(S), T = E.TEACHING();
  const th = bl => E.galleryS('through', { bl }), at = E.galleryS('atten', { A: 3 }), amp = E.galleryS('amp', { G: 20, I: Infinity }), iso = E.galleryS('isolator', { IL: 0.5, I: Infinity });
  eq([P(T).reciprocal, P(th(90)).reciprocal, P(at).reciprocal, P(amp).reciprocal, P(iso).reciprocal], [true, true, true, false, false], 'reciprocal');
  eq([P(th(90)).symmetric, P(at).symmetric, P(T).symmetric], [true, true, false], 'symmetric');
  eq([0, 90, 237].map(b => P(th(b)).lossless).concat([P(at).lossless, P(T).lossless, P(amp).lossless, P(iso).lossless]), [true, true, true, false, false, false, false], 'lossless');
  const d54 = { s11: E.polar(0.6, 0), s22: E.polar(0.6, 0), s21: E.polar(0.8, 0), s12: E.polar(0.8, 0) };
  eq(P(d54).lossless, false, 'D5.4 column sums 1 but not orthogonal'); near(P(d54).sums[0], 1, 1e-12);
  eq([P(th(90)).passive, P(at).passive, P(T).passive, P(iso).passive, P(amp).passive], [true, true, true, true, false], 'passive');
  const d56 = { s11: E.polar(0.3, -60), s22: E.polar(0.3, -60), s21: E.polar(0.8, -45), s12: E.polar(0.8, -45) }, p = P(d56);
  ok(p.sums[0] <= 1 && p.sums[1] <= 1, 'column sums ≤ 1'); eq(p.passive, false, 'σ_max > 1'); eq(p.disagree, true, 'note shown');
});
t('σ_max: a scaled unitary matrix has σ_max equal to its scale', () => {
  const k = 0.7, S = { s11: E.C(0.6 * k, 0), s21: E.C(0.8 * k, 0), s12: E.C(0.8 * k, 0), s22: E.C(-0.6 * k, 0) };   // k·(unitary)
  near(E.sigmaMax(S), k, 1e-12);
});
t('Gallery presets (D6.1–D6.4)', () => {
  for(const bl of [0, 90, 180, 300]){ const S = E.galleryS('through', { bl }); near(E.cabs(S.s21), 1); near(E.wrapDeg(E.carg(S.s21) * 180 / Math.PI), E.wrapDeg(-bl), 1e-9); }
  near(E.wrapDeg(E.carg(E.galleryS('through', { bl: 180 }).s21) * 180 / Math.PI), 180, 1e-9, 'wrapped to (−180°, 180°]');
  near(E.cabs(E.galleryS('atten', { A: 10 }).s21), Math.pow(10, -0.5)); near(E.cabs(E.galleryS('amp', { G: 10, I: 40 }).s12), 0.01);
  near(E.cabs(E.galleryS('isolator', { IL: 0.5, I: 20 }).s21), Math.pow(10, -0.025));
});
t('PF-6: parser rejects garbage; Z0 must be real 1..1000 Ω', () => {
  for(const s of ['abc', '1∠', '', '5jj', 'j5j', '1,5']) eq(E.parseComplex(s, 'deg'), null, s);
  eq([E.parseZ0('0'), E.parseZ0('-50'), E.parseZ0('2000'), E.parseZ0('50')], [null, null, null, 50]);
  const z = E.parseComplex('0.5∠45', 'rad'); near(E.carg(z), Math.atan2(Math.sin(45), Math.cos(45)), 1e-12, 'a polar angle is read in the unit it was typed in');
});
t('Display formats (A.5.0) and the one dB formatter', () => {
  eq(E.fmtPct(0.001), '0.10%'); eq(E.fmtPct(0.000316), '0.032%'); eq(E.fmtPct(0.111), '11.1%');
  eq(E.fmtDbVal(E.dbOf(0)), '−∞ dB'); eq(E.fmtDbVal(E.dbOf(0.5)), '−6.0 dB'); eq(E.fmtDbVal(10, { plus: true, trim: true }), '+10 dB');
  eq(E.fmtDbVal(0.04, { plus: true }), '0.0 dB'); eq(E.fmtDbVal(12, { plus: true }), '+12.0 dB'); eq(E.fmtDbVal(Infinity), '∞ dB');
  eq([E.dbPow(-1), E.dbPow(0), E.dbPow(10)], [null, -Infinity, 10], 'a power ratio ≤ 0 has no dB value; zero is −∞');
  eq(E.fmtVswr(0.5), '3.00');
});
t('SEC-RFC-001/-006: strict decimal grammar, finite only, bounded length, linear time', () => {
  eq(['75', '-1.5e2', '\u22122', '.5', '5.'].map(E.parseRealStrict), [75, -150, -2, 0.5, 5]);
  for(const w of ['0x10', '1e309', 'Infinity', '1_0', '0b11', '1e', '--1', 'j']) eq(E.parseRealStrict(w), null, w);
  eq(E.parseRealStrict('1'.repeat(E.INPUT_MAXLEN + 1)), null, 'over-length');
  eq(E.parseComplex('1e309∠0', 'deg'), null, 'polar overflow');
  const t0 = process.hrtime.bigint(); for(const tail of ['x', '.x', '∠x', 'jx']){ const s = '9'.repeat(30000) + tail; E.parseComplex(s.slice(0, 60) + tail, 'deg');
    new RegExp('^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?$').test(s); }
  ok(Number(process.hrtime.bigint() - t0) / 1e6 < 200, 'a 30 000-digit failing entry is rejected in linear time');
});
t('PPR-RFC-001: a power ≤ 0 has no dB value; it is written with its direction; an active load is named', () => {
  const K = X.K; X.resetExample(); K.zl = X.zLoad(X.C(-25, 0)); K.cache = null;
  const r = X.solveAt(1e9), PL = r.nodesM[r.nodesM.length - 1].P;
  ok(PL < 0, 'ZL = −25 Ω: power flows out of the load'); ok(X.isActive(r), 'active circuit named');
  const s = X.fmtPow(PL, 'flows out of the load: an active load'); ok(/flows out of the load/.test(s) && !/dB/.test(s.replace('no dB value', '')), s);
  eq(X.ratioText(-0.3), 'P < 0 (no dB)'); eq(X.fmtPow(0), '0 W (no power)');
  X.resetExample(); K.zl = X.OPEN_LOAD; K.cache = null; eq(X.solveAt(1e9).PL, 0, 'an open load takes exactly zero power (no rounding residue)');
  X.resetExample(); K.cache = null; ok(!X.isActive(X.solveAt(1e9)), 'the example is passive (the amplifier is within the model)');
});
t('PPR-RFC-005: Zs = 25 Ω, Z0 = 50 Ω: P_avs = P_in + mismatch loss (5.0000 = 4.4444 + 0.5556 mW)', () => {
  const K = X.K; X.resetExample(); K.zs = X.C(25, 0); K.cache = null; const r = X.solveAt(1e9);
  near(r.Pavs, 5e-3, 1e-15); near(r.Pin, 4.4444444e-3, 1e-9); near(r.Pavs - r.Pin, 0.5555556e-3, 1e-9); near(r.reflIn, 0, 1e-18);
});
t('DEFECT-RFC-004: an S field angle of −180° is written +180°, with the true minus elsewhere', () => {
  X.K.unit = 'deg'; eq(X.polarField(E.polar(1, -180)), '1∠180'); eq(X.polarField(E.polar(0.5, -90)), '0.5∠−90');
});
t('CQ-RFC-016: the sweep is cached while only the marker moves; a circuit change recomputes it', () => {
  const K = X.K; X.resetExample(); K.cache = null; const a = X.sweepCached(); K.fm = 1.1e9; ok(X.sweepCached() === a, 'marker move: same sweep');
  K.main[0].p.G = 15; ok(X.sweepCached() !== a, 'gain change: new sweep'); X.resetExample();
});
/* Random sweep (CLAUDE.md §6): random valid circuits of passive blocks with and without a divider; the physics
   identities must hold at random frequencies: G_T = P_L/P_avs; P_in ≥ ΣP_L for passive chains, with equality when
   every block and the divider are lossless; net power never increases along a passive chain. */
t('Random sweep: power identities over 3000 random passive circuits', () => {
  const K = X.K; let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lossless = ['thru', 'phase', 'lpf', 'hpf', 'bpf'], lossy = ['atten', 'isolator'];
  // a random passive block (lossless only, or any passive)
  const blk = lo => { const ty = (lo ? lossless : lossless.concat(lossy))[Math.floor(R() * (lo ? 5 : 7))], b = X.newBlock(ty);
    if(ty === 'thru') b.p.l = R() * 3; if(ty === 'phase') b.p.ph = R() * 720 - 360; if(ty === 'atten') b.p.A = R() * 20; if(ty === 'isolator') b.p.IL = R() * 3;
    if(b.p.n) b.p.n = 1 + Math.floor(R() * 9); return b; };
  const zr = () => X.zLoad(X.C(R() * 200, R() * 200 - 100));
  let worst = 0;
  for(let n = 0; n < 3000; n++){
    X.resetExample(); const lo = R() < 0.5, div = R() < 0.4;
    K.zs = X.C(5 + R() * 150, R() * 100 - 50); K.z0 = 10 + R() * 140;
    K.main = Array.from({ length: 1 + Math.floor(R() * (div ? 2 : 4)) }, () => blk(lo));
    if(div){ const ty = ['ideal', 'wilkinson', 'resistive', 'tee'][Math.floor(R() * 4)]; K.div = { type: lo && ty === 'resistive' ? 'ideal' : (lo && ty === 'wilkinson' ? 'tee' : ty), split: 1 + Math.floor(R() * 99) };
      K.A = [blk(lo)]; K.B = R() < 0.5 ? [blk(lo)] : []; K.zlA = zr(); K.zlB = zr(); }
    else K.zl = zr();
    K.cache = null; const f = 0.3e9 + R() * 1.5e9, r = X.solveAt(f), ends = div ? [r.nodesA, r.nodesB] : [r.nodesM];
    const PL = ends.reduce((a, nd) => a + nd[nd.length - 1].P, 0), sc = Math.max(r.Pavs, 1e-30);
    ok(PL <= r.Pin + 1e-11 * sc, 'case ' + n + ': loads take no more than the input');
    if(lo) { worst = Math.max(worst, Math.abs(r.Pin - PL) / sc); ok(Math.abs(r.Pin - PL) <= 1e-9 * sc, 'case ' + n + ': lossless, P_in = ΣP_L'); }
    if(!div) near(r.GT, r.PL / r.Pavs, 1e-9 * Math.max(1, r.GT), 'case ' + n + ': G_T');
    for(const nd of [r.nodesM].concat(div ? [r.nodesA, r.nodesB] : [])) for(let k = 1; k < nd.length; k++) ok(nd[k].P <= nd[k - 1].P + 1e-11 * sc, 'case ' + n + ': non-increasing');
  }
  console.log('      lossless balance: worst |P_in − ΣP_L|/P_avs = ' + worst.toExponential(2));
});
/* v1.8.2 (DEFECT-RFC-012): a loop whose reflections reinforce without limit is found where it is and the waves are
   undefined, never NaN; a near-pole circuit stays finite. Hand cases: Γs·S11 = 1 at the input (Γs = 5/6, S11 = 1.2);
   S22·Γ_L = 1 at the load (S22 = 1.5, Γ_L = 2/3, Z_L = 250 Ω on 50 Ω). */
t('DEFECT-RFC-012: loop poles at the source and at the load are found; their waves are undefined (NaN-free flags)', () => {
  const cust = (s11, s21, s12, s22) => ({ s11: E.C(s11), s21: E.C(s21), s12: E.C(s12), s22: E.C(s22) });
  const a = E.solveCascade([cust(1.2, 1, 0, 0)], E.C(1, 0), E.C(550), Z(50), 50);
  eq(a.pole, { chain: 'M', node: 'src' }); ok(Number.isNaN(a.Pin) && Number.isNaN(a.GT), 'undefined input power and G_T');
  const b = E.solveCascade([E.labPresetS('amp', 12), cust(0, 1, 1, 1.5)], E.C(1, 0), E.C(50), Z(250), 50);
  eq(b.pole, { chain: 'M', node: 2 });
  const n = E.solveCascade([E.labPresetS('amp', 12), cust(0, 1, 1, 1.5)], E.C(1, 0), E.C(50), Z(249.99), 50);
  ok(n.pole === null && isFinite(n.PL) && isFinite(n.Pin), 'near the pole: finite');
  ok(E.loopPole(E.C(0.5), E.C(2)) && !E.loopPole(E.C(0.5), E.C(1.99)) && E.loopPole(E.C(Infinity), E.C(0)), 'loopPole');
});
t('DEFECT-RFC-012: the Cascade solver reports a branch pole with a divider and never returns NaN powers unflagged', () => {
  X.resetExample(); const K = X.K; K.A = [X.newBlock('thru')]; K.B = [{ type: 'custom', p: {}, S: { s11: X.C(0), s21: X.C(1), s12: X.C(1), s22: X.C(1.5) } }];
  K.div = { type: 'wilkinson', split: 50 }; K.zlA = X.zLoad(X.C(50)); K.zlB = X.zLoad(X.C(250)); K.cache = null;
  const r = X.solveAt(1e9); eq(r.pole, { chain: 'B', node: 1 }); ok(r.nodesM.every(nd => Number.isNaN(nd.P)), 'main chain undefined');
  K.zlB = X.zLoad(X.C(100)); const q = X.solveAt(1e9); ok(q.pole === null && [q.nodesM, q.nodesA, q.nodesB].every(l => l.every(nd => isFinite(nd.P))), 'regular: all finite');
  ok(X.ratioText(NaN) === 'undefined' && X.fmtPow(NaN) === 'undefined', 'undefined readouts in words');
});
t('DEFECT-RFC-017: an angle at −180° to float noise wraps to +180° (degrees and radians); others unchanged', () => {
  eq(E.wrapDeg(-180), 180); eq(E.wrapDeg(-180 + 1e-12), 180); eq(E.wrapDeg(540), 180); eq(E.wrapDeg(-540), 180); eq(E.wrapDeg(180), 180);
  near(E.wrapDeg(-179.99), -179.99, 1e-9); near(E.wrapDeg(190), -170, 1e-9); eq(E.wrapDeg(0), 0);
  eq(X.angShown(-179.96, 1), 180); near(X.angShown(-179.94, 1), -179.94, 1e-9); eq(X.angShown(-180 + 1e-13, 3, true), Math.PI);
  X.resetExample(); const K = X.K;
  for(const [l, f] of [[1, 1.5e9], [1.5, 1e9], [2, 0.75e9]]){
    const S = X.devS({ type: 'thru', p: { l } }, f);
    K.unit = 'deg'; const d = X.polarU(S.s21); K.unit = 'rad'; const r = X.polarU(S.s21); K.unit = 'deg';
    ok(/∠180\.0°$/.test(d) && /∠3\.142 rad$/.test(r), l + ' λ at ' + f + ': ' + d + ' / ' + r);
  }
  // a sweep of angles within 1e-9° of ±180° and of other odd multiples of 180°: never read −180 or −3.142
  for(let i = 0; i < 2000; i++){ const k = 2 * Math.floor(Math.random() * 20) - 19, a = 180 * k + (Math.random() - 0.5) * 2e-9;
    K.unit = 'deg'; const d = X.polarU(E.polar(1, a)); K.unit = 'rad'; const r = X.polarU(E.polar(1, a));
    ok(!/−180\.0°/.test(d) && !/−3\.142/.test(r), a + ': ' + d + ' ' + r); }
  K.unit = 'deg';
});
t('DEFECT-RFC-018 / CQ-RFC-025: Z0 is checked only against the impedances in the circuit; one Z = −Z0 test and wording', () => {
  X.resetExample(); const K = X.K; K.z0 = 75; K.zl = X.zLoad(X.C(-50));
  const r1 = X.checkZ0('50'); ok(r1 && r1[X.REFUSED] && /Z_L = −Z0/.test(r1[X.REFUSED]), 'no divider: Z_L named');
  K.div = { type: 'wilkinson', split: 50 }; K.zlA = X.zLoad(X.C(30)); K.zlB = X.zLoad(X.C(30));
  eq(X.checkZ0('50'), 50, 'divider present: the stale Z_L is not in the circuit');
  K.zlB = X.zLoad(X.C(-50)); const r2 = X.checkZ0('50'); ok(r2 && /Z_LB = −Z0/.test(r2[X.REFUSED]), 'Z_LB named');
  K.zs = X.C(-60); const r3 = X.checkZ0('60'); ok(r3 && /Z_s = −Z0/.test(r3[X.REFUSED]), 'Z_s named');
  K.z0 = 50; const z = X.checkZ(X.zLoad(X.C(-50)), 'Z_L'); eq(z[X.REFUSED], X.minusZ0('Z_L'), 'the box and the Z0 check share one wording');
  ok(!/try another/.test(X.minusZ0('Z_L')), 'no "try another Z0" (PPR-RFC-018)');
});
t('CQ-RFC-024 / PPR-RFC-019: limits built from their constants and worded as the tool\'s range', () => {
  eq(X.S_ENTRY_MAX, 1000); eq(X.AMP_G_MAX_DB, 60); eq(X.Z_MAX_TEXT, '1 MΩ'); eq(X.BAND_REL_TEXT, 'one part in 10⁹');
  ok(/above 1000 \(60 dB/.test(X.checkS(X.C(1001))[X.REFUSED]));
  ok(/this tool accepts/.test(X.checkZ(X.zLoad(X.C(2e6)), 'Z_s')[X.REFUSED]));
});
t('VIS-RFC-012: notes and refusals at most 25 words', () => {
  const words = s => s.trim().split(/\s+/).length;
  for(const s of [X.ACTIVE_NOTE, X.DIV_NOTE.wilkinson + ' Frequency-independent here.', 'Refused: ' + X.minusZ0('Z_LA') + '; keeping the last valid value'])
    ok(words(s) <= 25, words(s) + ': ' + s);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
