// RF Cascade Analyzer — developer tests of the engine (Node, no browser). Run: node tests/engine.test.js
// Expected values are worked by hand from the spec's equations (A.10), not read from the tool. Developer tests, not
// the acceptance suite.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8') + '\n;this.E = { C, cabs, carg, polar, gammaLoad, gammaInterface, vswr, powerSplit, envelope, extrema, OPEN_LOAD, zLoad, ' +
  'combine, overallS, gammaIn, drive, solveCascade, solveDivider, properties, sigmaMax, TEACHING, galleryS, labPresetS, LAB_PRESETS, parseComplex, parseLoad, parseZ0, ' +
  'fmtMag, fmtAng, fmtPolar, fmtDb, dbOf, fmtPct, fmtVswr, wrapDeg };', ctx, { filename: 'engine.js' });
const E = ctx.E;

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
t('PF-1: "open", "inf", "∞", "Infinity" are an open (Γ = +1); "short" is 0 Ω', () => {
  for(const w of ['open', 'inf', '∞', 'Infinity', ' OPEN ']) eq(E.fmtPolar(E.gammaLoad(E.parseLoad(w, 'deg'), 50)), '1.000∠0.0°', w);
  eq(E.fmtPolar(E.gammaLoad(E.parseLoad('short', 'deg'), 50)), '1.000∠180.0°');
});
t('E1 interface and E3 split at Z02 = 5, 25, 50, 150, 500 Ω', () => {
  for(const z of [5, 25, 50, 150, 500]){ const g = E.gammaInterface(50, z), p = E.powerSplit(Math.abs(g));
    near(g, (z - 50) / (z + 50)); near(p.refl + p.deliv, 1); }
  eq(E.fmtPct(E.powerSplit(0.5).refl), '25.0%');
});
t('E2 / PF-3: VSWR, ∞ at |Γ| = 1, undefined above 1', () => {
  near(E.vswr(1 / 3).v, 2); eq(E.fmtVswr(1), '∞'); eq(E.fmtVswr(E.cabs(E.gammaLoad(Z(0, 50), 50))), '∞');
  eq(E.fmtVswr(E.cabs(E.gammaLoad(Z(-25), 50))), '— (|Γ| > 1)'); eq(E.fmtVswr(0), '1.00');
});
t('E4: envelope and extremum positions (short, open, 100 Ω, 25 Ω)', () => {
  const s = E.extrema(E.gammaLoad(Z(0), 50), 0.5); eq(s.min, [0, 0.5]); eq(s.max, [0.25]);
  const o = E.extrema(E.gammaLoad(E.OPEN_LOAD, 50), 0.5); eq(o.max, [0, 0.5]); eq(o.min, [0.25]);
  eq(E.extrema(E.gammaLoad(Z(100), 50), 0.5).max[0], 0); eq(E.extrema(E.gammaLoad(Z(25), 50), 0.5).min[0], 0);
  const G = E.gammaLoad(Z(30, 40), 50); for(const d of [0, 0.1, 0.2, 0.3, 0.45]){
    const want = E.cabs(E.C(1 + 0.5 * Math.cos(Math.PI / 2 - 4 * Math.PI * d), 0.5 * Math.sin(Math.PI / 2 - 4 * Math.PI * d))); near(E.envelope(G, d), want, 1e-12); }
  const x = E.extrema(G, 0.5); near(x.max[0], 0.125, 1e-12); near(x.min[0], 0.375, 1e-12);   // θ = 90°: d = θλ/(4π) = λ/8
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
  const r = E.solveCascade([E.labPresetS('filter', 20), E.labPresetS('phase', 45), E.labPresetS('thru'), E.labPresetS('atten', 2)], E.C(1, 0), E.C(25, 10), Z(100, -30), 50);
  for(let k = 1; k < r.nodes.length; k++) ok(r.nodes[k].P <= r.nodes[k - 1].P + 1e-15, 'node ' + k);
});
t('E14: dividers — resistive quarter power and half dissipated, T-junction |Γ_in| = 1/3, Wilkinson 25/75', () => {
  const thru = [E.labPresetS('thru')], m = Z(50), Vs = E.C(1, 0), Zs = E.C(50);
  const r = E.solveDivider('resistive', 0.5, Vs, Zs, 50, thru, m, thru, m);
  near(E.cabs(r.Gin), 0, 1e-12); near(r.PbrA / r.Pin, 0.25, 1e-12); near(r.Pdiss / r.Pin, 0.5, 1e-12);
  near(E.cabs(E.solveDivider('tee', 0.5, Vs, Zs, 50, thru, m, thru, m).Gin), 1 / 3, 1e-12);
  for(const ty of ['wilkinson', 'ideal']){ const w = E.solveDivider(ty, 0.25, Vs, Zs, 50, thru, m, thru, m);
    near(w.PbrA / w.PbrB, 1 / 3, 1e-9, ty); near(w.Pdiss, 0, 1e-15, ty); }
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
  eq(E.fmtAng(E.galleryS('through', { bl: 180 }).s21), '180.0°', 'wrapped to (−180°, 180°]');
  near(E.cabs(E.galleryS('atten', { A: 10 }).s21), Math.pow(10, -0.5)); near(E.cabs(E.galleryS('amp', { G: 10, I: 40 }).s12), 0.01);
  near(E.cabs(E.galleryS('isolator', { IL: 0.5, I: 20 }).s21), Math.pow(10, -0.025));
});
t('PF-6: parser rejects garbage; Z0 must be real 1..1000 Ω', () => {
  for(const s of ['abc', '1∠', '', '5jj', 'j5j', '1,5']) eq(E.parseComplex(s, 'deg'), null, s);
  eq([E.parseZ0('0'), E.parseZ0('-50'), E.parseZ0('2000'), E.parseZ0('50')], [null, null, null, 50]);
  const z = E.parseComplex('0.5∠45', 'rad'); near(E.carg(z), Math.atan2(Math.sin(45), Math.cos(45)), 1e-12, 'a polar angle is read in the unit it was typed in');
});
t('Display formats (A.5.0)', () => {
  eq(E.fmtPct(0.001), '0.10%'); eq(E.fmtPct(0.000316), '0.032%'); eq(E.fmtPct(0.111), '11.1%');
  eq(E.fmtDb(E.dbOf(0)), '−∞ dB'); eq(E.fmtDb(E.dbOf(0.5)), '−6.0 dB');
  eq(E.fmtPolar(E.polar(0.3, 40)), '0.300∠40.0°'); eq(E.fmtPolar(E.polar(1, -180)), '1.000∠180.0°');
  eq(E.fmtVswr(0.5), '3.00');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
