/* RF Cascade Analyzer — Lecture mode: the six guided steps of spec A.5, each a list of beats (pre-set states, like
   slide builds), a stage visual drawn in SVG from the engine, readouts and controls. Steps 2–5 share one "current
   two-port" (L.dev); a beat may show a named device for that beat only (L.over). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — step titles and slides, layout fractions, device names
   2. State            — lecture state, current device, beat application helpers
   3. Step 1           — Reflections: interface (1a) and load with standing wave (1b)
   4. Step 2           — Naming: two-port, wave arrows, coloured matrix
   5. Step 3           — Measuring one port at a time: forward / reverse, load off Z0
   6. Step 4           — Reading dB: power bars, dB ladder, return-loss explorer
   7. Step 5           — Properties: column-sum bars, badges, editor
   8. Step 6           — Common devices: gallery cards
   9. Steps table      — STEPS: title, slides, beats, stage, readouts, controls
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const Z0_LECT = 50;              // reference impedance in Lecture mode (Ω, fixed; spec A.5.0)
const WAVE_HZ = 0.5;             // on-screen wave frequency (spec A.6.8: 0.25–1 Hz)
const LINE_LAMBDA = 2;           // Step 1b shows 2λ of line
const EXT_RANGE = 0.5;           // extremum markers are drawn for 0 ≤ d ≤ λ/2 from the load
const WAVE_SAMPLES = 240;        // points along a drawn wave
const R_MAX = 1000, R_POS = 1000;   // R_L slider: 0, then 1 Ω..1000 Ω on a log taper, then the ∞ detent
const X_MAX = 500, X_DETENT = 5;    // X_L slider ±500 Ω with a detent at 0
const Z02_MIN = 5, Z02_MAX = 500;   // Step 1a Z02 slider (log taper)
const GLYPH_W = 0.6;             // IBM Plex Mono advance width (em), to size label tags
const BAR_SPAN = 4;              // an active power bar is scaled so 400 % fits (spec A.5.4)
const LADDER_TOP = 30, LADDER_BOT = -50, LADDER_TICK = 10;   // Step 4 dB ladder (dB)
const EXPL_MIN = -40, EXPL_MAX = 0;  // Step 4 explorer slider (dB)
const LOG_DECADES = 4, LOG_FLOOR = 0.0001;   // explorer log-power bar: 0.01 % .. 100 %
const SUM_FULL = 2;              // Step 5 column-sum bars: full height = 2 (the line at 1 sits half way)
const MAG_MAX_SLIDER = 2, MAG_MAX_BOX = 100;   // Step 5 editor magnitude limits
const STEP_INFO = [
  { title: 'Reflections', slides: 'slides 4–6' }, { title: 'Naming', slides: 'slides 10–11' },
  { title: 'Measuring one port at a time', slides: 'slides 12, 9' }, { title: 'Reading dB', slides: 'slide 13' },
  { title: 'Properties', slides: 'slide 14' }, { title: 'Common devices', slides: 'slide 15' } ];
const GALLERY = ['through', 'atten', 'amp', 'isolator'];
const GAL_SHORT = { teach: 'Teaching', through: 'Through', atten: 'Attenuator', amp: 'Amplifier', isolator: 'Isolator' };
const GAL_NAME = { teach: 'Teaching example', through: 'Ideal through', atten: 'Matched attenuator', amp: 'Amplifier', isolator: 'Isolator', custom: 'Custom' };
const BADGES = [['reciprocal', 'Reciprocal', ['S12 = S21']], ['symmetric', 'Symmetric', ['S11 = S22', 'S12 = S21']],
                ['lossless', 'Lossless', ['[S] unitary']], ['passive', 'Passive', ['σmax(S) ≤ 1']]];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
const L = {
  step: 1, beat: 1,
  z02: 50, view1: 'iface', load: { r: 100, x: 0, inf: false },               // Step 1
  dev: { kind: 'teach', name: GAL_NAME.teach, S: TEACHING() }, over: null,   // shared device, beat override
  gal: Object.fromEntries(Object.entries(GALLERY_DEFAULTS).map(([k, v]) => [k, Object.assign({}, v)])),
  sel: null, matrix: false,                                                  // Step 2
  dir: 'fwd', gl: { mag: 0, ang: 0 },                                         // Step 3
  view4: 'bar', db: 0,                                                       // Step 4
  edit: 's11', card: 'through',                                              // Step 5, 6
  t0: 0, tNow: 0,                                                            // animation clock (s)
};
// The two-port Steps 2–5 show: the beat's device, else the shared device.
const curDev = () => L.over || L.dev;
// A gallery device as a named two-port.
const galDev = kind => ({ kind, name: GAL_NAME[kind], S: galleryS(kind, L.gal[kind]) });
// Load impedance of Step 1b.
const loadZ = () => (L.load.inf ? OPEN_LOAD : zLoad(C(L.load.r, L.load.x)));
// Which slide-6 row the Step 1b load matches, or null.
function loadPreset(){ const z = L.load; if(z.inf) return 'open'; if(z.x === 0 && z.r === 0) return 'short'; if(z.x === 0 && z.r === Z0_LECT) return 'matched'; return null; }
// ── END STATE ─────────────────────────────────────────────────

// ── STEP 1 ────────────────────────────────────────────────────
const LY1A = { m: 0.04, top: 0.14, bandTop: 0.2, bandBot: 0.72, yInc: 0.34, yRef: 0.56, lref: 0.4, bal1: 0.82, bal2: 0.92 };
// Step 1a stage: two regions, the interface and three power arrows (incident, reflected ∝ |Γ|², transmitted ∝ 1 − |Γ|²).
function stage1a(W, H){
  const y = f => f * H, xi = W / 2, m = LY1A.m * W, g = gammaInterface(Z0_LECT, L.z02), split = powerSplit(Math.abs(g)), Lref = LY1A.lref * W;
  let s = patterns();
  s += el('rect', { x: m, y: y(LY1A.bandTop), width: xi - m, height: y(LY1A.bandBot - LY1A.bandTop), fill: 'var(--bg2)', stroke: 'var(--line)' });
  s += el('rect', { x: xi, y: y(LY1A.bandTop), width: W - m - xi, height: y(LY1A.bandBot - LY1A.bandTop), fill: 'var(--panel)', stroke: 'var(--line)' });
  s += txt(m, y(LY1A.top) - sz.label * 0.2, 'Region 1: Z_01 = 50 Ω', { size: sz.label });
  s += txt(W - m, y(LY1A.top) - sz.label * 0.2, 'Region 2: Z_02 = ' + fx(L.z02, 0) + ' Ω', { size: sz.label, anchor: 'end' });
  s += el('line', { x1: xi, y1: y(LY1A.top) + sz.label * 0.5, x2: xi, y2: y(LY1A.bandBot) + 6, stroke: 'var(--s22)', 'stroke-width': sw(3), 'stroke-dasharray': '10 8' });
  const inc = powArrow(xi - Lref, y(LY1A.yInc), 1, 1, Lref, { q: 'P_inc', col: 'var(--neutral)' });
  const ref = powArrow(xi, y(LY1A.yRef), -1, split.refl, Lref, { q: 'P_refl', col: 'var(--s11)', fill: 'url(#pRefl)', dashed: true });
  const tra = powArrow(xi, y(LY1A.yInc), 1, split.deliv, Lref, { q: 'P_trans', col: 'var(--s21)' });
  const lab = (x, yy, t, col, anchor) => txt(x, yy, t, { fill: col, anchor, size: sz.label });
  const off = sw(STROKE_POWER) + sz.label * 0.5 + 4;
  s += inc.svg + lab(xi - Lref, y(LY1A.yInc) - off, 'Incident ' + fmtPct(1), 'var(--neutral)', 'start');
  s += ref.svg + lab(xi - 6, y(LY1A.yRef) + off, 'Reflected ' + fmtPct(split.refl), 'var(--s11)', 'end');
  s += tra.svg + lab(xi + 6, y(LY1A.yInc) - off, 'Transmitted ' + fmtPct(split.deliv), 'var(--s21)', 'start');
  s += txt(xi + 12, y(LY1A.bandBot) - sz.label * 0.7, (Math.abs(g) < EPS_ZERO ? 'Z_01 = Z_02: matched' : 'Z_01 ≠ Z_02'), { size: sz.label, fill: 'var(--mut)' });
  const pr = fmtPct(split.refl), pt = fmtPct(split.deliv);
  s += txt(W / 2, y(LY1A.bal1), 'Incident − Reflected = Transmitted', { anchor: 'middle', size: sz.label });
  s += txt(W / 2, y(LY1A.bal2), fmtPct(1) + ' − ' + pr + ' = ' + pt, { anchor: 'middle', size: sz.label, cls: 'balance' });
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Interface: incident, reflected and transmitted power' }, el('g', { class: 'visual' }, s));
}
const LY1B = { m: 0.02, box: 0.11, yHead: 0.045, yInc: 0.22, yRef: 0.39, amp: 0.055, yMain: 0.62, full: 0.28, yAxis: 0.83, yBar: 0.89, barH: 0.055 };
// Step 1b geometry for a stage of W × H.
function geo1b(W, H){
  const m = LY1B.m * W, bw = LY1B.box * W, xs = m + bw, xe = W - m - bw;
  return { W, H, m, bw, xs, xe, pl: (xe - xs) / LINE_LAMBDA, a: LY1B.amp * H, yI: LY1B.yInc * H, yR: LY1B.yRef * H, yM: LY1B.yMain * H, F: LY1B.full * H };
}
// x of a point d wavelengths from the load.
const xOfD = (G, d) => G.xe - d * G.pl;
// Wave path d-attribute: y = yc − amp·fn(d) sampled along the line.
function wavePath(G, yc, amp, fn){
  let p = '';
  for(let k = 0; k <= WAVE_SAMPLES; k++){ const d = LINE_LAMBDA * k / WAVE_SAMPLES; p += (k ? 'L' : 'M') + n2(xOfD(G, d)) + ' ' + n2(yc - amp * fn(d)); }
  return p;
}
// The three wave paths at time t (s): incident (→ load), reflected (← source) and the total on the line.
function wavePaths(G, Gm, t){
  const wt = 2 * Math.PI * WAVE_HZ * t, gm = cabs(Gm), th = carg(Gm), tw = 2 * Math.PI;
  return { inc: wavePath(G, G.yI, G.a, d => Math.cos(wt + tw * d)), ref: wavePath(G, G.yR, G.a, d => gm * Math.cos(wt - tw * d + th)),
           tot: wavePath(G, G.yM, G.F / 4, d => Math.cos(wt + tw * d) + gm * Math.cos(wt - tw * d + th)) };
}
// Step 1b stage: source, 2λ line, load; incident and reflected waves; envelope with V_max / V_min; load power bar.
function stage1b(W, H){
  const G = geo1b(W, H), Gm = gammaLoad(loadZ(), Z0_LECT), gm = cabs(Gm), split = powerSplit(Math.min(1, gm));
  let s = patterns();
  const boxTop = G.yI - G.a - 6, boxH = G.yM + G.F / 2 - boxTop;
  s += el('rect', { x: G.m, y: boxTop, width: G.bw - 6, height: boxH, fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 });
  s += el('rect', { x: G.xe + 6, y: boxTop, width: G.bw - 6, height: boxH, fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 });
  s += txt(G.m + (G.bw - 6) / 2, boxTop + sz.label * 0.8, 'source', { anchor: 'middle', size: sz.any });
  s += txtLines(G.m + (G.bw - 6) / 2, boxTop + sz.label * 0.8 + sz.any * 1.3, ['Z_S', '= Z_0'], { anchor: 'middle', size: sz.any });
  s += txt(G.xe + 6 + (G.bw - 6) / 2, boxTop + sz.label * 0.8, 'load', { anchor: 'middle', size: sz.any });
  s += txt(G.xe + 6 + (G.bw - 6) / 2, boxTop + sz.label * 0.8 + sz.any * 1.3, 'Z_L', { anchor: 'middle', size: sz.any });
  s += txt(W / 2, G.H * LY1B.yHead, 'Z_L = ' + zText(), { anchor: 'middle', size: sz.label });
  // lanes: line axes
  for(const yc of [G.yI, G.yR, G.yM]) s += el('line', { x1: G.xs, y1: yc, x2: G.xe, y2: yc, stroke: 'var(--line)', 'stroke-width': sw(1.5) });
  // envelope band |V(d)| (extent ∝ |V|, 2 = full height F)
  let top = '', bot = '';
  for(let k = 0; k <= WAVE_SAMPLES; k++){ const d = LINE_LAMBDA * k / WAVE_SAMPLES, v = envelope(Gm, d) * G.F / 4, x = n2(xOfD(G, d));
    top += (k ? 'L' : 'M') + x + ' ' + n2(G.yM - v); bot = 'L' + x + ' ' + n2(G.yM + v) + bot; }
  s += el('path', { d: top + bot + 'Z', fill: 'var(--s12)', 'fill-opacity': 0.22, stroke: 'var(--s12)', 'stroke-width': sw(2), class: 'envelope',
                    'data-q': 'envelope', 'data-v': +gm.toPrecision(12), 'data-scale': n2(G.F / 4), 'data-x0': n2(G.xe), 'data-px-per-lambda': n2(G.pl) });
  const P = wavePaths(G, Gm, L.tNow);
  s += el('path', { id: 'wInc', d: P.inc, fill: 'none', stroke: 'var(--neutral)', 'stroke-width': sw(3), 'data-q': 'V_inc', 'data-v': 1, 'data-ref': n2(G.a) });
  s += el('path', { id: 'wRef', d: P.ref, fill: 'none', stroke: 'var(--s11)', 'stroke-width': sw(3), 'stroke-dasharray': DASH, 'data-q': 'V_refl', 'data-v': +gm.toPrecision(12), 'data-ref': n2(G.a) });
  s += el('path', { id: 'wTot', d: P.tot, fill: 'none', stroke: 'var(--txt)', 'stroke-width': sw(2.5) });
  s += txt(G.xs, G.yI - G.a - sz.label * 0.55, 'incident |V⁺| = 1 →', { size: sz.label });
  s += txt(G.xs, G.yR - Math.min(1, gm) * G.a - sz.label * 0.55 - 2, '← reflected |Γ_L||V⁺| = ' + fmtMag(gm), { size: sz.label, fill: 'var(--s11)' });
  // V_max / V_min markers in 0 ≤ d ≤ λ/2
  const ex = extrema(Gm, EXT_RANGE);
  const marker = (d, kind) => { const v = envelope(Gm, d), x = xOfD(G, d), e = v * G.F / 4, up = kind === 'max';
    const col = kind === 'max' ? 'var(--s21)' : 'var(--s22)', name = kind === 'max' ? 'V_max' : 'V_min';
    s += el('line', { x1: x, y1: G.yM - e, x2: x, y2: G.yM + e, stroke: col, 'stroke-width': sw(5), class: 'marker', 'data-q': name, 'data-v': +v.toPrecision(12), 'data-d': +d.toPrecision(12) });
    s += el('circle', { cx: x, cy: G.yM, r: sw(5), fill: col });
    const lh = sz.label * 1.25, y0 = up ? G.yM - Math.max(e, 2) - 4 - lh * 1.5 : G.yM + Math.max(e, 2) + 4 + lh * 0.5, anchor = d < 0.05 ? 'end' : 'middle';
    s += txtLines(anchor === 'end' ? x + sw(3) : x, y0, [name, fx(v, 2)], { anchor, fill: col, size: sz.label }); };
  ex.max.forEach(d => marker(d, 'max')); ex.min.forEach(d => marker(d, 'min'));
  s += txt(G.xs, G.yM - (1 + Math.min(1, gm)) * G.F / 4 - sz.label * 0.55 - 2, gm <= EPS_ZERO ? 'VSWR = 1.00 (flat: no standing wave)' : 'VSWR = V_max/V_min = ' + fmtVswr(gm), { size: sz.label, cls: 'vswr' });
  // d axis (from the load toward the source)
  const ya = LY1B.yAxis * G.H; s += el('line', { x1: G.xs, y1: ya, x2: G.xe, y2: ya, stroke: 'var(--mut)', 'stroke-width': sw(1.5) });
  for(let d = 0; d <= LINE_LAMBDA; d += 0.5){ const x = xOfD(G, d); s += el('line', { x1: x, y1: ya - 6, x2: x, y2: ya + 6, stroke: 'var(--mut)' });
    s += txt(x, ya + sz.any * 0.85, d === 0 ? 'd=0' : fx(d, 1) + 'λ', { anchor: 'middle', size: sz.any, fill: 'var(--mut)', weight: 400 }); }
  // load power bar
  const yb = LY1B.yBar * G.H, W100 = G.xe - G.xs, bh = LY1B.barH * G.H;
  const dl = barSeg(G.xs, yb, Math.max(0, split.deliv), W100, { fill: 'var(--s21)', col: 'var(--s21)', q: 'P_deliv', h: bh });
  const rf = barSeg(G.xs + dl.w, yb, split.refl, W100, { fill: 'url(#pRefl)', col: 'var(--s11)', q: 'P_refl', h: bh });
  s += dl.svg + rf.svg + el('line', { x1: G.xe, y1: yb - 6, x2: G.xe, y2: yb + bh + 6, stroke: 'var(--txt)', 'stroke-width': sw(2) });
  s += txt(G.xs, yb + bh + sz.any * 0.7, 'delivered ' + fmtPct(split.deliv), { size: sz.label * 0.75 < sz.any ? sz.any : sz.label * 0.75, fill: 'var(--s21)' });
  s += txt(G.xe, yb + bh + sz.any * 0.7, 'reflected ' + fmtPct(split.refl), { size: sz.label * 0.75 < sz.any ? sz.any : sz.label * 0.75, fill: 'var(--s11)', anchor: 'end' });
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Line with incident and reflected waves and the standing-wave envelope' }, el('g', { class: 'visual' }, s));
}
// Z_L text for Step 1b.
function zText(){ const z = L.load; if(z.inf) return '∞ (open)'; return fmtRect(C(z.r, z.x), 1) + ' Ω'; }
// R_L slider position <-> ohms: 0 → 0 Ω, 1..R_POS−1 → 1..1000 Ω (log), R_POS → ∞.
const rFromPos = p => (p <= 0 ? 0 : p >= R_POS ? Infinity : Math.pow(10, 3 * (p - 1) / (R_POS - 2)));
// ohms -> R_L slider position.
const posFromR = r => (r === Infinity ? R_POS : r < 1 ? 0 : Math.round(1 + (R_POS - 2) * Math.log10(r) / 3));
// Step 1 readouts.
function readouts1(){
  if(L.view1 === 'iface'){ const g = gammaInterface(Z0_LECT, L.z02), p = powerSplit(Math.abs(g));
    return [ro('Γ (interface)', fx(g, 3), 'head'), ro('% reflected', fmtPct(p.refl), 'head'), ro('% transmitted', fmtPct(p.deliv), 'head')]; }
  const G = gammaLoad(loadZ(), Z0_LECT), g = cabs(G), p = powerSplit(Math.min(1, g)), pre = loadPreset();
  const row = (k, a, b, c, d) => h('tr', { cls: pre === k ? 'hl' : '' }, h('td', { text: a }), h('td', { text: b }), h('td', { text: c }), h('td', { text: d }));
  return [ro('ΓL', fmtPolar(G), 'line'), h('div', { cls: 'heads' }, ro('|ΓL|', fmtMag(g), 'head'), ro('VSWR', fmtVswr(g), 'head')),
    ro('% delivered', fmtPct(p.deliv), 'head'), ro('% reflected', fmtPct(p.refl), 'head'),
    h('table', { cls: 't6' }, h('tr', {}, h('th', { text: 'Load' }), h('th', { text: 'Γ' }), h('th', { text: 'VSWR' }), h('th', { text: 'Power' })),
      row('matched', 'Z0', '0', '1', 'all'), row('short', '0', '−1', '∞', 'none'), row('open', '∞', '+1', '∞', 'none'))];
}
// Step 1 controls.
function controls1(){
  if(L.view1 === 'iface') return [slider({ id: 'z02', label: 'Z02 (region 2)', min: Z02_MIN, max: Z02_MAX, smin: 0, smax: 1000, sstep: 1, value: L.z02, unit: 'Ω',
    toSlider: v => Math.round(1000 * Math.log(v / Z02_MIN) / Math.log(Z02_MAX / Z02_MIN)), fromSlider: p => +(Z02_MIN * Math.pow(Z02_MAX / Z02_MIN, p / 1000)).toPrecision(4),
    fmt: v => 'Z02 ' + v + ' ohms', onset: v => { L.z02 = v; refresh(); } })];
  const set = (r, x, inf) => { L.load = { r, x, inf }; rebuild(); };
  return [h('div', { cls: 'btnrow' }, h('button', { type: 'button', id: 'bMatch', text: 'Matched', onclick: () => set(Z0_LECT, 0, false) }),
      h('button', { type: 'button', id: 'bShort', text: 'Short', onclick: () => set(0, 0, false) }), h('button', { type: 'button', id: 'bOpen', text: 'Open', onclick: () => set(0, 0, true) })),
    slider({ id: 'rl', label: 'R_L', min: 0, max: R_MAX, smin: 0, smax: R_POS, sstep: 1, value: L.load.inf ? Infinity : L.load.r, unit: 'Ω',
      toSlider: posFromR, fromSlider: p => { const r = rFromPos(p); return r === Infinity ? r : +r.toPrecision(3); }, numText: v => (v === Infinity ? '' : v),
      fmt: v => (v === Infinity ? 'R_L infinite, open' : 'R_L ' + v + ' ohms'), onset: v => { L.load.inf = v === Infinity; if(v !== Infinity) L.load.r = v; refresh(); } }),
    slider({ id: 'xl', label: 'X_L', min: -X_MAX, max: X_MAX, step: 1, value: L.load.x, unit: 'Ω',
      fromSlider: p => (Math.abs(p) <= X_DETENT ? 0 : p), fmt: v => 'X_L ' + v + ' ohms', onset: v => { L.load.x = v; if(L.load.inf && v !== 0){ L.load.inf = false; L.load.r = R_MAX; } refresh(); } })];
}
// ── END STEP 1 ────────────────────────────────────────────────

// ── STEP 2 ────────────────────────────────────────────────────
const LY2 = { box: 0.24, boxTop: 0.1, boxH: 0.42, lref: 0.15, feed: 0.03, mat: 0.75 };
/* The two-port with its four wave arrows for drive `dir` (a1 = 1 or a2 = 1) and termination Γ_T. hi: S keys whose
   path is highlighted (null: none highlighted, all drawn normally). opt.feed: [x1, x2] where the port lines start and
   end (default: the stage margins). Returns { svg, box, waves }. Shared by Steps 2, 3, 6. */
function twoPort(W, H, S, dir, GT, hi, opt){
  opt = opt || {};
  const bw = (opt.box || LY2.box) * W, bx = (W - bw) / 2, by = (opt.boxTop !== undefined ? opt.boxTop : LY2.boxTop) * H, bh = (opt.boxH || LY2.boxH) * H;
  const Lref = (opt.lref || LY2.lref) * W, yA = by + bh * 0.25, yB = by + bh * 0.8, w = drive(S, dir, GT), fs = opt.size || sz.label;
  const colB1 = dir === 'fwd' ? 'var(--s11)' : 'var(--s12)', colB2 = dir === 'fwd' ? 'var(--s21)' : 'var(--s22)';
  const pathB1 = dir === 'fwd' ? 's11' : 's12', pathB2 = dir === 'fwd' ? 's21' : 's22';   // the S entry producing b1, b2
  // port lines: a two-wire line into each port (the reference planes are the box edges)
  const feed = opt.feed || [LY2.feed * W, W - LY2.feed * W], yw1 = by + bh * 0.04, yw2 = by + bh * 0.96;
  let s = '';
  [[feed[0], bx], [bx + bw, feed[1]]].forEach(([x1, x2]) => { [yw1, yw2].forEach(yy => { s += el('line', { x1, y1: yy, x2, y2: yy, stroke: 'var(--mut)', 'stroke-width': sw(1.5), class: 'portline' }); }); });
  s += el('rect', { x: bx, y: by, width: bw, height: bh, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': sw(2.5), rx: 6 });
  if(!opt.mini) s += txt(bx + bw / 2, by + bh / 2, opt.boxName || 'Two-Port', { anchor: 'middle', size: fs, fill: 'var(--mut)' });
  // internal paths: reflections dashed, transmissions solid (spec A.5.0)
  const ip = (k, d, dashed) => el('path', { d, fill: 'none', stroke: 'var(--' + k + ')', 'stroke-width': sw(hi && hi.includes(k) ? 5 : 2), 'stroke-dasharray': dashed ? '8 6' : null, opacity: hi && !hi.includes(k) ? 0.25 : 0.9, class: 'path ' + k });
  const i1 = bx + bw * 0.12, i2 = bx + bw * 0.88;
  s += ip('s11', 'M' + n2(bx) + ' ' + n2(yA) + 'H' + n2(i1) + 'V' + n2(yB) + 'H' + n2(bx), true) + ip('s22', 'M' + n2(bx + bw) + ' ' + n2(yA) + 'H' + n2(i2) + 'V' + n2(yB) + 'H' + n2(bx + bw), true);
  s += ip('s21', 'M' + n2(bx) + ' ' + n2(yA) + 'L' + n2(bx + bw) + ' ' + n2(yB), false) + ip('s12', 'M' + n2(bx + bw) + ' ' + n2(yA) + 'L' + n2(bx) + ' ' + n2(yB), false);
  // waves: a into the ports (top), b out of the ports (bottom); lengths ∝ |wave| with a_ref = 1
  const arrowIn = (v, y, side, q, lab, col, hiOn, dashed) => {
    const len = v < ARROW_GHOST ? Lref : Math.min(v, ARROW_CAP) * Lref, x0 = side < 0 ? bx - len : bx + bw + len;
    return ampArrow(x0, y, side < 0 ? 1 : -1, v, Lref, { q, col, dim: !hiOn, dashed, label: lab, lab: 'above', size: fs, lx: side < 0 ? bx - 8 : bx + bw + 8, la: side < 0 ? 'end' : 'start' }).svg; };
  const arrowOut = (v, y, side, q, lab, col, hiOn, dashed) => ampArrow(side < 0 ? bx : bx + bw, y, side < 0 ? -1 : 1, v, Lref,
    { q, col, dim: !hiOn, dashed, label: lab, lab: 'below', size: fs, lx: side < 0 ? bx - 8 : bx + bw + 8, la: side < 0 ? 'end' : 'start' }).svg;
  const lbl = (name, c) => opt.mini ? name + ' ' + fmtMag(cabs(c)) : name + ' = ' + (cabs(c) < ARROW_GHOST ? '0' : fmtPolar(c));
  const aOn = k => !hi || hi.some(x => S_PORT[x][1] === k), bOn = k => !hi || hi.some(x => S_PORT[x][0] === k);
  s += arrowIn(cabs(w.a1), yA, -1, 'a1', lbl('a_1', w.a1), 'var(--neutral)', aOn(1), false);
  s += arrowIn(cabs(w.a2), yA, 1, 'a2', lbl('a_2', w.a2), 'var(--neutral)', aOn(2), false);
  s += arrowOut(cabs(w.b1), yB, -1, 'b1', lbl('b_1', w.b1), colB1, bOn(1), pathB1 === 's11');
  s += arrowOut(cabs(w.b2), yB, 1, 'b2', lbl('b_2', w.b2), colB2, bOn(2), pathB2 === 's22');
  if(!opt.mini){ s += txt(bx - 6, by - fs * 0.6, 'Port 1', { anchor: 'end', size: fs, fill: 'var(--mut)' }); s += txt(bx + bw + 6, by - fs * 0.6, 'Port 2', { size: fs, fill: 'var(--mut)' }); }
  return { svg: s, box: { bx, by, bw, bh, yA, yB, Lref, yw1, yw2 }, waves: w };
}
// Coloured matrix equation [b1; b2] = [S11 S12; S21 S22][a1; a2] centred at (cx, cy); entries are buttons.
function matrixEq(cx, cy, sel){
  const fs = sz.label * 1.2, cw = fs * 2.6, rh = fs * 1.35, x0 = cx - cw * 3;
  const brk = (x, w) => el('path', { d: 'M' + n2(x + 8) + ' ' + n2(cy - rh) + 'h-8v' + n2(2 * rh) + 'h8M' + n2(x + w - 8) + ' ' + n2(cy - rh) + 'h8v' + n2(2 * rh) + 'h-8', fill: 'none', stroke: 'var(--txt)', 'stroke-width': sw(2) });
  let s = brk(x0, cw) + txt(x0 + cw / 2, cy - rh / 2, 'b_1', { anchor: 'middle', size: fs }) + txt(x0 + cw / 2, cy + rh / 2, 'b_2', { anchor: 'middle', size: fs });
  s += txt(x0 + cw * 1.3, cy, '=', { anchor: 'middle', size: fs });
  const mx = x0 + cw * 1.7; s += brk(mx, cw * 2.2);
  const ent = (k, col, row) => { const x = mx + cw * (col === 0 ? 0.6 : 1.6), y = cy + (row === 0 ? -rh / 2 : rh / 2), on = !sel || sel.includes(k);
    return el('g', { class: 'sent', 'data-s': k, role: 'button', tabindex: 0, 'aria-label': S_NAME[k] + ' ' + S_TITLE[k], 'aria-pressed': sel && sel.length === 1 && sel[0] === k ? 'true' : 'false', style: 'cursor:pointer' },
      el('rect', { x: x - cw * 0.5, y: y - rh * 0.48, width: cw, height: rh * 0.96, fill: on && sel ? 'var(--bg2)' : 'transparent', stroke: on && sel ? 'var(--' + k + ')' : 'none', 'stroke-width': sw(2), rx: 6 })
      + txt(x, y, 'S_' + k.slice(1), { anchor: 'middle', size: fs, fill: 'var(--' + k + ')', cls: on ? null : 'dim' })); };
  s += ent('s11', 0, 0) + ent('s12', 1, 0) + ent('s21', 0, 1) + ent('s22', 1, 1);
  const ax = mx + cw * 2.6; s += brk(ax, cw) + txt(ax + cw / 2, cy - rh / 2, 'a_1', { anchor: 'middle', size: fs }) + txt(ax + cw / 2, cy + rh / 2, 'a_2', { anchor: 'middle', size: fs });
  return s;
}
// Drive for Step 2: S12 and S22 are measured with a2 = 1, a1 = 0.
const dir2 = () => (L.sel === 's12' || L.sel === 's22' ? 'rev' : 'fwd');
// Step 2 stage.
function stage2(W, H){
  const hi = L.sel === 'all' ? S_KEYS : L.sel ? [L.sel] : null, tp = twoPort(W, H, curDev().S, dir2(), ZERO, hi);
  let s = tp.svg;
  if(L.matrix) s += matrixEq(W / 2, LY2.mat * H, hi);
  else s += txt(W / 2, LY2.mat * H, 'a = wave into a port · b = wave out of a port', { anchor: 'middle', size: sz.label, fill: 'var(--mut)' });
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Two-port with waves a1, a2 in and b1, b2 out' }, el('g', { class: 'visual' }, s));
}
// Step 2 readouts: the selected entry's caption, and every S entry in its colour.
function readouts2(){
  const S = curDev().S, out = [];
  if(L.sel && L.sel !== 'all'){ const k = L.sel, [i, j] = S_PORT[k];
    out.push(ro(S_TITLE[k], S_NAME[k], 'head', k), h('div', { text: S_MEANING[k] }),
      h('div', {}, 'out at port ', h('b', { cls: 's22', text: String(i) }), ', in at port ', h('b', { cls: 's12', text: String(j) }))); }
  else if(L.sel === 'all') out.push(h('div', { text: 'Sij: out at port i, in at port j' }));
  S_KEYS.forEach(k => out.push(ro(S_NAME[k], fmtPolar(S[k]), 'line', k)));
  return out;
}
// Step 2 controls: S entry buttons (also keys 1–4).
function controls2(){
  return [h('div', { cls: 'btnrow', attrs: { role: 'group', 'aria-label': 'Highlight an S entry (keys 1 to 4)' } },
    S_KEYS.map((k, n) => h('button', { type: 'button', id: 'sel' + k, cls: k, text: S_NAME[k], attrs: { 'aria-pressed': L.sel === k ? 'true' : 'false', 'aria-label': S_NAME[k] + ' ' + S_TITLE[k] + ' (key ' + (n + 1) + ')' },
      onclick: () => selectS(k) })))];
}
// Highlight S entry k in Step 2: its beat (the drive follows: a2 = 1 for S12 and S22).
function selectS(k){ go(2, S_KEYS.indexOf(k) + 2); }
// ── END STEP 2 ────────────────────────────────────────────────

// ── STEP 3 ────────────────────────────────────────────────────
const LY3 = { box: 0.22, boxTop: 0.2, boxH: 0.36, lref: 0.13, src: 0.045, res: 0.955, eq: 0.74, cap: 0.04 };
// Termination reflection of Step 3 (Γ_L of the non-driven port).
const gl3 = () => polar(L.gl.mag, L.gl.ang);
// Step 3 stage: drive source, two-port, termination, arrows and the measured ratios.
function stage3(W, H){
  const S = curDev().S, GT = gl3(), fwd = L.dir === 'fwd', matched = L.gl.mag <= EPS_ZERO;
  const sx = (fwd ? LY3.src : LY3.res) * W, tx = (fwd ? LY3.res : LY3.src) * W, r = sw(18);
  const tp = twoPort(W, H, S, L.dir, GT, null, { box: LY3.box, boxTop: LY3.boxTop, boxH: LY3.boxH, lref: LY3.lref, feed: [LY3.src * W, LY3.res * W] }), b = tp.box, w = tp.waves;
  let s = tp.svg;
  // source (circle with ~) across the driven port's line and the termination across the other
  const ym = (b.yw1 + b.yw2) / 2, wire = (x, y1, y2) => el('line', { x1: x, y1, x2: x, y2, stroke: 'var(--mut)', 'stroke-width': sw(1.5) });
  s += wire(sx, b.yw1, ym - r) + wire(sx, ym + r, b.yw2);
  s += el('circle', { cx: sx, cy: ym, r, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': sw(2.5) }) + txt(sx, ym, '~', { anchor: 'middle', size: sz.label });
  const rh = (b.yw2 - b.yw1) * 0.5, zig = Array.from({ length: 6 }, (_, k) => 'l' + (k % 2 ? -12 : 12) + ' ' + n2(rh / 7)).join('');
  s += wire(tx, b.yw1, ym - rh / 2) + wire(tx, ym + rh / 2, b.yw2);
  s += el('path', { d: 'M' + n2(tx) + ' ' + n2(ym - rh / 2) + 'l0 ' + n2(rh / 14) + zig + 'l0 ' + n2(rh / 14), fill: 'none', stroke: 'var(--txt)', 'stroke-width': sw(2.5), class: 'termination' });
  const tlab = matched ? 'Z_0 (matched)' : 'Z_L: Γ_L = ' + fmtPolar(GT);
  s += txt(tx, b.by + b.bh + sz.label * 1.2, tlab, { anchor: fwd ? 'end' : 'start', size: sz.label, cls: 'termlabel' });
  s += txt(W / 2, Math.max(LY3.cap * H, sz.label * 0.8), 'network analyzer: ' + (fwd ? 'forward sweep' : 'reverse sweep'), { anchor: 'middle', size: sz.label, fill: 'var(--mut)' });
  const y1 = LY3.eq * H, y2 = y1 + sz.label * 1.5;
  if(fwd){ s += txt(W / 2, y1, (matched ? 'S_11' : 'Γ_in') + ' = b_1/a_1 = ' + fmtPolar(cdiv(w.b1, w.a1)), { anchor: 'middle', size: sz.label, fill: 'var(--s11)' });
           s += txt(W / 2, y2, (matched ? 'S_21 = ' : '') + 'b_2/a_1 = ' + fmtPolar(cdiv(w.b2, w.a1)), { anchor: 'middle', size: sz.label, fill: 'var(--s21)' }); }
  else { s += txt(W / 2, y1, (matched ? 'S_22' : 'Γ_out') + ' = b_2/a_2 = ' + fmtPolar(cdiv(w.b2, w.a2)), { anchor: 'middle', size: sz.label, fill: 'var(--s22)' });
         s += txt(W / 2, y2, (matched ? 'S_12 = ' : '') + 'b_1/a_2 = ' + fmtPolar(cdiv(w.b1, w.a2)), { anchor: 'middle', size: sz.label, fill: 'var(--s12)' }); }
  s += txt(W / 2, y2 + sz.label * 1.6, 'With port 2 matched, S_11 is the Γ that sets the VSWR', { anchor: 'middle', size: sz.any, fill: 'var(--mut)', weight: 400 });
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Measuring one port at a time' }, el('g', { class: 'visual' }, s));
}
// Step 3 readouts.
function readouts3(){
  const S = curDev().S, GT = gl3(), w = drive(S, L.dir, GT), fwd = L.dir === 'fwd', matched = L.gl.mag <= EPS_ZERO, out = [];
  if(matched){ if(fwd) out.push(ro('S11 = b1/a1', fmtPolar(w.b1), 'head', 's11'), ro('S21 = b2/a1', fmtPolar(w.b2), 'head', 's21'));
               else out.push(ro('S22 = b2/a2', fmtPolar(w.b2), 'head', 's22'), ro('S12 = b1/a2', fmtPolar(w.b1), 'head', 's12')); }
  else { const gIn = fwd ? cdiv(w.b1, w.a1) : cdiv(w.b2, w.a2), sRef = fwd ? S.s11 : S.s22, same = cabs(csub(gIn, sRef)) <= EPS_BADGE;
    const nm = fwd ? ['Γin = b1/a1', 'S11'] : ['Γout = b2/a2', 'S22'];
    out.push(ro(nm[0], fmtPolar(gIn), 'head'), ro(nm[1], fmtPolar(sRef), 'lab', fwd ? 's11' : 's22'),
      h('div', {}, h('span', { cls: 'badge' + (same ? '' : ' off'), text: (fwd ? 'Γin ' : 'Γout ') + (same ? '= ' : '≠ ') + nm[1] }))); }
  out.push(h('details', {}, h('summary', { text: 'show the math' }), h('div', { text: 'Γin = S11 + S12·S21·ΓL / (1 − S22·ΓL)' })));
  return out;
}
// Step 3 controls: direction and the "move the load off Z0" panel.
function controls3(){
  return [h('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': 'Sweep direction (key R)' } },
      h('button', { type: 'button', id: 'dFwd', text: 'Forward', attrs: { 'aria-pressed': String(L.dir === 'fwd') }, onclick: () => { L.dir = 'fwd'; rebuild(); } }),
      h('button', { type: 'button', id: 'dRev', text: 'Reverse', attrs: { 'aria-pressed': String(L.dir === 'rev') }, onclick: () => { L.dir = 'rev'; rebuild(); } })),
    h('div', { cls: 'k', text: 'Move the load off Z0:' }),
    slider({ id: 'glm', label: '|ΓL|', min: 0, max: 1, step: 0.001, value: L.gl.mag, unit: '', fmt: v => '|Gamma L| ' + v, onset: v => { L.gl.mag = v; refresh(); } }),
    slider({ id: 'gla', label: '∠ΓL', min: -180, max: 180, step: 0.1, value: L.gl.ang, unit: '°', fmt: v => 'angle ' + v + ' degrees', onset: v => { L.gl.ang = v; refresh(); } }),
    h('button', { type: 'button', id: 'glReset', text: 'Reset to Z0', onclick: () => { L.gl = { mag: 0, ang: 0 }; rebuild(); } })];
}
// ── END STEP 3 ────────────────────────────────────────────────

// ── STEP 4 ────────────────────────────────────────────────────
const LY4 = { m: 0.03, title: 0.06, bar1: 0.16, bar2: 0.6, barH: 0.13 };
// One power bar (forward or reverse): reflected, transmitted and absorbed or added, of the incident 100 %.
function powerBar(x, y, Wav, refl, trans, colR, colT, patR, nameR, nameT, qs){
  const sum = refl + trans, active = sum > 1 + EPS_BADGE, W100 = active ? Wav / BAR_SPAN : Wav, bh = sw(LY4.barH * 300);
  let s = '';
  const r = barSeg(x, y, refl, W100, { fill: patR, col: colR, q: qs[0], h: bh });
  const t = barSeg(x + r.w, y, trans, W100, { fill: colT, col: colT, q: qs[1], h: bh, cap: active ? BAR_SPAN - refl : undefined });
  s += r.svg + t.svg;
  const lab = (xx, yy, str, col, anchor) => txt(xx, yy, str, { fill: col, anchor, size: sz.label });
  s += lab(x, y - sz.label * 0.6, nameR + ' ' + fmtPct(refl), colR, 'start');
  s += lab(x + r.w, y + bh + sz.label * 0.65, nameT + ' ' + fmtPct(trans), colT, 'start');
  if(active){ const x100 = x + W100, xEnd = x + r.w + t.w;
    const aw = Math.max(0, xEnd - x100), tag = 'added by device +' + fmtPct(sum - 1), tw = tag.length * sz.label * GLYPH_W + 12;
    s += el('g', { class: 'seg', 'data-q': qs[3], 'data-v': +(sum - 1).toPrecision(12), 'data-ref': n2(W100), 'data-capped': sum > BAR_SPAN ? 1 : null },
      el('rect', { x: x100, y: y - 6, width: aw, height: bh + 12, fill: 'url(#pAdd)', stroke: 'var(--s21)', 'stroke-width': sw(2) }));
    // the label sits on a plain tag inside the added segment (or above it when the segment is too short)
    if(aw >= tw){ const cx = x100 + aw / 2; s += el('rect', { x: cx - tw / 2, y: y + bh / 2 - sz.label * 0.65, width: tw, height: sz.label * 1.3, rx: 6, fill: 'var(--bg)', stroke: 'var(--s21)' }) + txt(cx, y + bh / 2, tag, { anchor: 'middle', size: sz.label, fill: 'var(--s21)' }); }
    else s += lab(xEnd, y - sz.label * 0.6, tag, 'var(--s21)', 'end');
    if(sum > BAR_SPAN) s += lab(xEnd, y + bh + sz.label * 1.9, '≈ capped at ' + fmtPct(BAR_SPAN), 'var(--mut)', 'end'); }
  else { const a = barSeg(x + r.w + t.w, y, 1 - sum, W100, { fill: 'url(#pAbs)', col: 'var(--abs)', q: qs[2], h: bh });
    s += a.svg + lab(x + W100, y - sz.label * 0.6, 'absorbed ' + fmtPct(Math.max(0, 1 - sum)), 'var(--abs)', 'end'); }
  const x100 = x + W100; s += el('line', { x1: x100, y1: active ? y - 8 : y - sz.label * 1.2, x2: x100, y2: y + bh + 8, stroke: 'var(--txt)', 'stroke-width': sw(3), 'stroke-dasharray': active ? '6 4' : null, class: 'mark100' });
  if(active) s += txt(x100, y + bh + sz.label * 1.9, '100%', { size: sz.label, anchor: 'middle' });
  return s;
}
// Step 4 forward and reverse bars.
function bars4(W, H){
  const S = curDev().S, m = LY4.m * W, Wav = W - 2 * m, pw = c => cabs(c) ** 2;
  let s = patterns() + txt(m, LY4.title * H, 'Forward: drive port 1 (incident = 100%)', { size: sz.label });
  s += powerBar(m, LY4.bar1 * H + sz.label, Wav, pw(S.s11), pw(S.s21), 'var(--s11)', 'var(--s21)', 'url(#pRefl)', 'reflected |S11|²', 'transmitted |S21|²', ['P_refl_fwd', 'P_trans_fwd', 'P_abs_fwd', 'P_added_fwd']);
  s += txt(m, (LY4.bar2 - 0.1) * H, 'Reverse: drive port 2', { size: sz.label });
  s += powerBar(m, LY4.bar2 * H + sz.label * 0.6, Wav, pw(S.s22), pw(S.s12), 'var(--s22)', 'var(--s12)', 'url(#pRev)', 'reflected |S22|²', 'transmitted |S12|²', ['P_refl_rev', 'P_trans_rev', 'P_abs_rev', 'P_added_rev']);
  return s;
}
const LY4L = { axis: 0.075, top: 0.1, bot: 0.92, col0: 0.085, colW: 0.228, mark: 18 };
// Everyday name and value of an S entry in dB (spec E8): [name lines..., value].
function everyday(k, m){
  const db = dbOf(m), neg = db === -Infinity ? '∞ dB' : fmtDb(-db);
  if(k === 's11') return ['return', 'loss', '= ' + neg];
  if(k === 's21') return m > 1 ? ['gain', '= ' + fmtDb(db)] : ['insertion', 'loss', '= ' + neg];
  if(k === 's12') return ['isolation', '= ' + neg];
  return ['output', 'return', 'loss', '= ' + neg];
}
// Step 4 dB ladder: a vertical +30..−50 dB scale with a coloured marker for each S entry in its own column.
function ladder4(W, H){
  const S = curDev().S, ax = LY4L.axis * W, yt = LY4L.top * H, yb = LY4L.bot * H, yOf = db => yt + (LADDER_TOP - db) / (LADDER_TOP - LADDER_BOT) * (yb - yt);
  let s = el('line', { x1: ax, y1: yt, x2: ax, y2: yb, stroke: 'var(--txt)', 'stroke-width': sw(2), class: 'ladder', 'data-top': LADDER_TOP, 'data-bot': LADDER_BOT, 'data-y-top': n2(yt), 'data-y-bot': n2(yb) });
  for(let d = LADDER_TOP; d >= LADDER_BOT; d -= LADDER_TICK){ const y = yOf(d);
    s += el('line', { x1: ax - 8, y1: y, x2: W - 6, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }) + txt(ax - 10, y, (d > 0 ? '+' : '') + fx(d, 0), { anchor: 'end', size: sz.label * 0.8 > sz.any ? sz.label * 0.8 : sz.any, fill: 'var(--mut)' }); }
  s += txt(ax - 10, yt - sz.any * 0.9, 'dB', { anchor: 'end', size: sz.any, fill: 'var(--mut)' });
  S_KEYS.forEach((k, n) => { const m = cabs(S[k]), db = dbOf(m), x = (LY4L.col0 + n * LY4L.colW) * W;
    const clip = db === -Infinity || db < LADDER_BOT ? 'bot' : db > LADDER_TOP ? 'top' : null, y = clip === 'bot' ? yb : clip === 'top' ? yt : yOf(db), mw = sw(LY4L.mark);
    s += el('g', { class: 'mark', 'data-q': 'dB_' + k, 'data-v': db === -Infinity ? '-Infinity' : +db.toPrecision(12), 'data-clipped': clip },
      el('rect', { x, y: y - sw(4), width: mw, height: sw(8), fill: 'var(--' + k + ')' }) + el('path', { d: 'M' + n2(x) + ' ' + n2(y) + 'l-10 -9v18z', fill: 'var(--' + k + ')' }));
    const lines = ['S_' + k.slice(1), fmtDb(db)].concat(everyday(k, m)), lh = sz.label * 1.15, bh = lh * lines.length;
    const top = Math.max(yt - sz.label * 0.5, Math.min(yb - bh + sz.label * 0.5, y - lh * 0.5));
    lines.forEach((t, i) => { s += txt(x + mw + 4, top + i * lh, t, { size: sz.label, fill: 'var(--' + k + ')' }); }); });
  return s;
}
// Step 4 return-loss explorer: |S11| (dB) → |S11| → % reflected → VSWR, and a log-scale reflected-power bar.
function explorer4(W, H){
  const m = fromDb(L.db), p = m * m, cells = [['|S11| (dB)', fmtDb(L.db)], ['|S11|', fmtMag(m)], ['% power reflected', fmtPct(p)], ['VSWR', fmtVswr(m)]];
  const cw = W * 0.47, ch = H * 0.24;
  let s = '';
  cells.forEach(([k, v], i) => { const x = (i % 2 ? 0.51 : 0.02) * W, y = (i < 2 ? 0.04 : 0.32) * H;
    s += el('rect', { x, y, width: cw, height: ch, fill: 'var(--panel)', stroke: 'var(--line)', rx: 8 }) + txt(x + 12, y + sz.label * 0.8, (i ? '→ ' : '') + k, { size: sz.label, fill: 'var(--mut)' })
       + txt(x + 12, y + ch * 0.66, v, { size: sz.head, cls: 'headline', fill: i === 0 || i === 1 ? 'var(--s11)' : 'var(--txt)' }); });
  // log reflected-power bar: 0.01 % .. 100 %
  const x0 = 0.04 * W, x1 = 0.96 * W, y = 0.68 * H, bh = 0.08 * H, lx = f => x0 + (Math.log10(Math.max(f, LOG_FLOOR)) + LOG_DECADES) / LOG_DECADES * (x1 - x0);
  s += patterns() + el('rect', { x: x0, y, width: x1 - x0, height: bh, fill: 'none', stroke: 'var(--line)' });
  s += el('g', { class: 'seg', 'data-q': 'P_refl_log', 'data-v': +p.toPrecision(12), 'data-scale': 'log', 'data-x0': n2(x0), 'data-x1': n2(x1) },
    el('rect', { x: x0, y, width: Math.max(0, lx(p) - x0), height: bh, fill: 'url(#pRefl)', stroke: 'var(--s11)', 'stroke-width': sw(2) }));
  [1, 0.1, 0.01, 0.001, 0.0001].forEach(f => { const x = lx(f); s += el('line', { x1: x, y1: y - 6, x2: x, y2: y + bh + 6, stroke: 'var(--txt)', 'stroke-width': sw(1.5) })
    + txt(x, y + bh + sz.label * 0.75, fmtPct(f), { anchor: f === 1 ? 'end' : f === 0.0001 ? 'start' : 'middle', size: sz.label }); });
  s += txt(x0, y - sz.label * 0.65, 'reflected power ' + fmtPct(p) + ' (log scale)', { size: sz.label, fill: 'var(--s11)' });
  return s;
}
// Step 4 stage by view.
function stage4(W, H){
  const s = L.view4 === 'bar' ? bars4(W, H) : L.view4 === 'ladder' ? ladder4(W, H) : explorer4(W, H);
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Reading S-parameters in dB' }, el('g', { class: 'visual' }, s));
}
// Step 4 readouts: every S entry linear, dB, everyday name, % power; port VSWRs.
function readouts4(){
  const S = curDev().S, out = [];
  S_KEYS.forEach(k => { const m = cabs(S[k]), ev = everyday(k, m);
    out.push(h('div', { cls: 'ro' }, h('span', {}, h('b', { cls: 's-name ' + k, text: S_NAME[k] }), ' ' + fmtMag(m) + ' · ' + fmtDb(dbOf(m))),
      h('span', { text: ev.slice(0, -1).join(' ') + ' ' + ev[ev.length - 1] }), h('span', { cls: 'k', text: fmtPct(m * m) + ' of the power' }))); });
  out.push(ro('VSWR port 1 · port 2', fmtVswr(cabs(S.s11)) + ' · ' + fmtVswr(cabs(S.s22)), 'lab'));
  return out;
}
// Step 4 controls: the explorer slider.
function controls4(){
  if(L.view4 !== 'explorer') return [];
  return [slider({ id: 'expl', label: '|S11|', min: EXPL_MIN, max: EXPL_MAX, step: 0.1, value: L.db, unit: 'dB', fmt: v => '|S11| ' + v + ' dB', onset: v => { L.db = v; refresh(); } })];
}
// ── END STEP 4 ────────────────────────────────────────────────

// ── STEP 5 ────────────────────────────────────────────────────
const LY5 = { barX: 0.05, barW: 0.1, gap: 0.1, top: 0.14, bot: 0.76, badgeX: 0.5, badgeW: 0.48, badgeGap: 6 };
// Step 5 stage: column-sum bars against the line at 1, and the four badges stacked beside them.
function stage5(W, H){
  const S = curDev().S, P = properties(S), yt = LY5.top * H, yb = LY5.bot * H, full = yb - yt;
  let s = txt(LY5.barX * W, yt - sz.label * 1.2, 'power out, driving', { size: sz.label });
  P.sums.forEach((v, i) => { const x = (LY5.barX + i * (LY5.barW + LY5.gap)) * W, bw = LY5.barW * W, capped = v > SUM_FULL, hgt = Math.min(v, SUM_FULL) / SUM_FULL * full;
    s += el('rect', { x, y: yt, width: bw, height: full, fill: 'none', stroke: 'var(--line)' });
    s += el('g', { class: 'seg', 'data-q': i ? 'colsum2' : 'colsum1', 'data-v': +v.toPrecision(12), 'data-ref': n2(full / SUM_FULL), 'data-capped': capped ? 1 : null },
      el('rect', { x, y: yb - hgt, width: bw, height: hgt, fill: i ? 'url(#pRev)' : 'var(--s21)', stroke: i ? 'var(--s12)' : 'var(--s21)', 'stroke-width': sw(2) }));
    s += txt(x + bw / 2, Math.max(yt + sz.label * 0.6, yb - hgt - sz.label * 0.6), fx(v, 3), { anchor: 'middle', size: sz.label });
    s += txt(x + bw / 2, yb + sz.label * 0.75, 'port ' + (i + 1), { anchor: 'middle', size: sz.label });
    s += txtLines(x + bw / 2, yb + sz.label * 1.5 + sz.any * 0.5, i ? ['|S12|²', '+|S22|²'] : ['|S11|²', '+|S21|²'], { anchor: 'middle', size: sz.any, fill: 'var(--mut)', weight: 400 }); });
  const y1 = yb - full / SUM_FULL, xr = (LY5.barX + 2 * LY5.barW + LY5.gap) * W + 10;
  s += el('line', { x1: LY5.barX * W - 8, y1, x2: xr, y2: y1, stroke: 'var(--txt)', 'stroke-width': sw(3), 'stroke-dasharray': '8 5' }) + txt(xr + 4, y1, '1', { size: sz.label });
  const bx = LY5.badgeX * W, bw = LY5.badgeW * W, bh = sz.label * 2.7 + 12;
  BADGES.forEach(([key, name, cond], i) => { const y = yt - sz.label * 1.8 + i * (bh + LY5.badgeGap);
    const lit = P[key], label = key === 'passive' && !lit ? 'Active' : name;
    s += el('g', { class: 'badge-svg', 'data-q': 'badge_' + key, 'data-v': P[key] ? 1 : 0 },
      el('rect', { x: bx, y, width: bw, height: bh, rx: 10, fill: lit ? 'var(--panel)' : 'none', stroke: lit ? 'var(--txt)' : 'var(--mut)', 'stroke-width': sw(lit ? 4 : 2), 'stroke-dasharray': lit ? null : '8 6' }));
    s += txt(bx + 12, y + 6 + sz.label * 0.68, (lit ? '✓ ' : key === 'passive' ? '! ' : '✗ ') + label, { size: sz.label, fill: lit ? 'var(--txt)' : 'var(--mut)' });
    s += txt(bx + 12, y + 6 + sz.label * 2.03, key === 'passive' && !lit ? 'σmax(S) > 1' : cond.join(', '), { size: sz.label, fill: 'var(--mut)', weight: 400 }); });
  const yn = yt - sz.label * 1.8 + 4 * (bh + LY5.badgeGap) + sz.any * 0.6;
  s += txtLines(bx, yn, ['Linear: assumed —', 'required for S-parameters'], { size: sz.any, fill: 'var(--mut)', weight: 400 });
  if(P.disagree) s += txtLines(bx, yn + sz.any * 2.6, ['column sums ≤ 1 but the network', 'can still deliver gain — see ‖S‖'], { size: sz.any, fill: 'var(--bad)', cls: 'disagree' });
  return el('svg', { class: 'vis', role: 'img', 'aria-label': 'Properties of the current two-port' }, el('g', { class: 'visual' }, patterns() + s));
}
// Step 5 readouts.
function readouts5(){
  const S = curDev().S, P = properties(S);
  return [ro('σmax(S)', fx(P.sigmaMax, 3), 'line'), ...S_KEYS.map(k => ro(S_NAME[k], fmtPolar(S[k]), 'line', k))];
}
// Make the shared device editable: a copy of the shown device, named Custom.
function editable(){ if(L.over || L.dev.kind !== 'custom'){ const S = curDev().S; L.dev = { kind: 'custom', name: GAL_NAME.custom, S: { s11: S.s11, s21: S.s21, s12: S.s12, s22: S.s22 } }; L.over = null; } }
// Step 5 controls: the device editor (one entry at a time) and the gallery shortcuts.
function controls5(){
  const S = curDev().S, k = L.edit, set = (mag, ang) => { editable(); L.dev.S[k] = polar(mag, ang); if(L.beat !== 6){ L.beat = 6; syncHash(); } refresh(); };
  return [h('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': 'Entry to edit' } }, S_KEYS.map(x => h('button', { type: 'button', id: 'ed' + x, cls: x, text: S_NAME[x], attrs: { 'aria-pressed': String(x === k) }, onclick: () => { L.edit = x; rebuild(); } }))),
    slider({ id: 'edm', label: '|' + S_NAME[k] + '|', min: 0, max: MAG_MAX_BOX, smin: 0, smax: MAG_MAX_SLIDER, step: 0.001, value: +cabs(S[k]).toFixed(4), unit: '', fmt: v => S_NAME[k] + ' magnitude ' + v,
      onset: v => set(v, wrapDeg(carg(curDev().S[k]) * DEG)) }),
    slider({ id: 'eda', label: '∠' + S_NAME[k], min: -180, max: 180, step: 0.1, value: +wrapDeg(carg(S[k]) * DEG).toFixed(1), unit: '°', fmt: v => S_NAME[k] + ' angle ' + v + ' degrees',
      onset: v => set(cabs(curDev().S[k]), v) }),
    h('div', { cls: 'btnrow', attrs: { role: 'group', 'aria-label': 'Gallery shortcuts' } }, ['teach'].concat(GALLERY).map(g => h('button', { type: 'button', text: GAL_SHORT[g],
      attrs: { 'aria-label': 'Load ' + GAL_NAME[g] }, onclick: () => { L.dev = g === 'teach' ? { kind: 'teach', name: GAL_NAME.teach, S: TEACHING() } : galDev(g); L.over = null; L.beat = 6; syncHash(); rebuild(); } })))];
}
// ── END STEP 5 ────────────────────────────────────────────────

// ── STEP 6 ────────────────────────────────────────────────────
// The mini two-port SVG of a gallery card (forward drive, a1 = 1).
function cardSvg(kind, W, H){
  const tp = twoPort(W, H, galleryS(kind, L.gal[kind]), 'fwd', ZERO, null, { box: 0.24, boxTop: 0.12, boxH: 0.6, lref: 0.15, mini: true, size: sz.label });
  return el('svg', { width: n2(W), height: n2(H), role: 'img', 'aria-label': GAL_NAME[kind] + ' forward waves' }, tp.svg);
}
// Step 6 stage: the four cards (HTML), each with its mini two-port, colour-coded [S], badges and "Use this device".
function stage6(W, H){
  const wrap = h('div', { cls: 'overlay' }), grid = h('div', { cls: 'cards' });
  GALLERY.forEach(kind => { const S = galleryS(kind, L.gal[kind]), P = properties(S), cur = kind === L.card;
    const card = h('div', { cls: 'card' + (cur ? ' cur' : ''), attrs: { 'data-card': kind } });
    const mat = h('div', { cls: 'smat' }, ['s11', 's12', 's21', 's22'].map(k => h('div', { cls: k, text: S_NAME[k] + ' ' + fmtPolar(S[k]) })));
    const badges = h('div', { cls: 'badges' }, BADGES.map(([key, name]) => h('span', { cls: 'badge' + (P[key] ? '' : ' off'), text: (P[key] ? '✓ ' : key === 'passive' ? '! ' : '✗ ') + (key === 'passive' && !P.passive ? 'Active' : name) })));
    const use = h('button', { type: 'button', text: 'Use this device', attrs: { 'aria-label': 'Use ' + GAL_NAME[kind] + ' in Steps 2 to 5' }, onclick: () => useDevice(kind) });
    card.append(h('h3', { text: GAL_NAME[kind] }));
    const sv = h('div', { cls: 'mini', attrs: { style: 'flex:1;min-height:0' } }); card.append(sv, mat, h('div', { cls: 'foot' }, badges, use));
    grid.append(card); });
  const thumbs = h('div', { cls: 'thumbs' }, GALLERY.map(k => h('button', { type: 'button', text: GAL_SHORT[k], attrs: { 'aria-pressed': String(k === L.card) }, onclick: () => goCard(k) })));
  grid.append(thumbs); wrap.append(grid);
  return wrap;
}
// Fill the cards' mini SVGs once the cards are laid out (their size sets the drawing).
function fillCards(){
  document.querySelectorAll('#stage .card').forEach(card => { const box = card.querySelector('.mini'); const r = box.getBoundingClientRect();
    if(r.width > 0 && r.height > 0) box.innerHTML = cardSvg(card.dataset.card, r.width, r.height); });
}
// Show gallery card k (its beat).
function goCard(k){ go(6, GALLERY.indexOf(k) + 1); }
// "Use this device": make gallery device k the shared device and open Step 2.
function useDevice(k){ L.dev = galDev(k); L.over = null; go(2, 1); }
// Step 6 readouts.
function readouts6(){ const S = galleryS(L.card, L.gal[L.card]); return [h('div', { cls: 'ro lab' }, h('span', { cls: 'v', text: GAL_NAME[L.card] })), ...S_KEYS.map(k => ro(S_NAME[k], fmtPolar(S[k]), 'line', k))]; }
// Step 6 controls: the current card's parameters, and Custom.
function controls6(){
  const g = L.gal[L.card], out = [], upd = () => refresh();
  const isoS = (id, label, lo, hi, key) => slider({ id, label, min: lo, max: hi + 1, smin: lo, smax: hi + 1, step: 0.5, value: g[key] === Infinity ? hi + 1 : g[key], unit: 'dB',
    numText: v => (v > hi ? '' : v), fmt: v => (v > hi ? label + ' infinite (S12 = 0)' : label + ' ' + v + ' dB'), onset: v => { g[key] = v > hi ? Infinity : v; upd(); } });
  if(L.card === 'through') out.push(slider({ id: 'bl', label: 'βℓ', min: 0, max: 360, step: 1, value: g.bl, unit: '°', fmt: v => 'beta l ' + v + ' degrees', onset: v => { g.bl = v; upd(); } }));
  if(L.card === 'atten') out.push(slider({ id: 'attA', label: 'A', min: 0, max: 40, step: 0.1, value: g.A, unit: 'dB', fmt: v => 'attenuation ' + v + ' dB', onset: v => { g.A = v; upd(); } }));
  if(L.card === 'amp') out.push(slider({ id: 'ampG', label: 'G', min: 0, max: 40, step: 0.1, value: g.G, unit: 'dB', fmt: v => 'gain ' + v + ' dB', onset: v => { g.G = v; upd(); } }),
    isoS('ampI', 'isolation I (right end = ∞)', 20, 80, 'I'));
  if(L.card === 'isolator') out.push(slider({ id: 'isoIL', label: 'IL', min: 0, max: 3, step: 0.05, value: g.IL, unit: 'dB', fmt: v => 'insertion loss ' + v + ' dB', onset: v => { g.IL = v; upd(); } }),
    isoS('isoI', 'isolation I (right end = ∞)', 10, 60, 'I'));
  out.push(h('button', { type: 'button', text: 'Custom… (Step 5 editor)', onclick: () => { editable(); go(5, 6); } }));
  return out;
}
// ── END STEP 6 ────────────────────────────────────────────────

// ── STEPS TABLE ───────────────────────────────────────────────
/* Each beat is a function that sets the lecture state (spec A.5.1–A.5.6). Beats reset the override and then apply
   their own state, so stepping is repeatable like slides. */
const beat = fn => () => { L.over = null; fn(); };
const STEPS = [
  { stage: (W, H) => (L.view1 === 'iface' ? stage1a(W, H) : stage1b(W, H)), readouts: readouts1, controls: controls1, anim: () => L.view1 === 'load',
    beats: [beat(() => { L.view1 = 'iface'; L.z02 = 50; }), beat(() => { L.view1 = 'iface'; L.z02 = 150; }),
            beat(() => { L.view1 = 'load'; L.load = { r: 50, x: 0, inf: false }; }), beat(() => { L.view1 = 'load'; L.load = { r: 0, x: 0, inf: false }; }),
            beat(() => { L.view1 = 'load'; L.load = { r: 0, x: 0, inf: true }; }), beat(() => { L.view1 = 'load'; L.load = { r: 100, x: 0, inf: false }; })] },
  { stage: stage2, readouts: readouts2, controls: controls2,
    beats: [beat(() => { L.sel = null; L.matrix = false; })].concat(S_KEYS.map(k => beat(() => { L.sel = k; L.matrix = true; })), [beat(() => { L.sel = 'all'; L.matrix = true; })]) },
  { stage: stage3, readouts: readouts3, controls: controls3,
    beats: [beat(() => { L.dir = 'fwd'; L.gl = { mag: 0, ang: 0 }; }), beat(() => { L.dir = 'rev'; L.gl = { mag: 0, ang: 0 }; }),
            beat(() => { L.dir = 'fwd'; L.gl = { mag: 0.5, ang: 0 }; }), beat(() => { L.dir = 'fwd'; L.gl = { mag: 0.5, ang: 0 }; L.over = galDev('isolator'); })] },
  { stage: stage4, readouts: readouts4, controls: controls4,
    beats: [beat(() => { L.view4 = 'bar'; }), beat(() => { L.view4 = 'ladder'; })].concat([0, -3, -10, -20, -30].map(d => beat(() => { L.view4 = 'explorer'; L.db = d; })),
            [beat(() => { L.view4 = 'bar'; L.over = galDev('amp'); })]) },
  { stage: stage5, readouts: readouts5, controls: controls5,
    beats: [beat(() => {})].concat(GALLERY.map(g => beat(() => { L.over = galDev(g); })), [beat(() => { editable(); })]) },
  { stage: stage6, readouts: readouts6, controls: controls6, after: fillCards,
    beats: GALLERY.map(g => beat(() => { L.card = g; })) },
];
// ── END STEPS TABLE ───────────────────────────────────────────
