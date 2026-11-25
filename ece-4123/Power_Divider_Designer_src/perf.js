/* Power Divider Designer — Performance page.
   ============================================================
   TABLE OF CONTENTS
   1. Traces           — which S-parameters exist for this design, their colours and data (magnitude or phase)
   2. Plot             — S-parameters vs frequency, −15 dB line, usable band, marker (click), pinned design dashed
   3. Bandwidths       — −15 dB bandwidth of S11, S22, S33, S23 (or worst output / isolation); narrowest = usable
   4. Power flow       — where the input power goes at f₀ and at the marker (RF Cascade colours, fading)
   5. S-matrix         — magnitude and phase at f₀, the checks, the three-port theorem line
   6. Compare          — pinned design B against the current design A; tree against the direct N-way dividers
   ============================================================ */

// ── 1. TRACES ─────────────────────────────────────────────────
const OUT_COLS = ['#15803d', '#1d4ed8', '#0e7490', '#b45309', '#9333ea', '#be123c', '#4d7c0f', '#0369a1'];
/* Trace list for a sweep with p ports: S11; Si1 per output; Sii per output; isolation per pair (up to 6 pairs) or the
   worst pair. Each { key, label, col, i, j | worst } */
function traceList(p){
  const n = p - 1, t = [{ key: 'S11', label: 'S11', col: 'var(--s11)', i: 0, j: 0 }];
  for(let i = 1; i <= n; i++) t.push({ key: 'S' + (i + 1) + '1', label: 'S' + (i + 1) + ',1', col: n <= 2 ? (i === 1 ? 'var(--s21)' : 'var(--s31)') : OUT_COLS[(i - 1) % 8], i, j: 0, grp: 'thru' });
  for(let i = 1; i <= n; i++) t.push({ key: 'S' + (i + 1) + (i + 1), label: 'S' + (i + 1) + ',' + (i + 1), col: n <= 2 ? (i === 1 ? '#dc2626' : '#e11d48') : OUT_COLS[(i - 1) % 8], i, j: i, grp: 'match', dash: '6 3' });
  if(n > 2){ const outs = []; for(let i = 1; i <= n; i++) outs.push([i, i]); t.push({ key: 'Smatch', label: 'worst Sjj', col: '#dc2626', worst: outs, grp: 'match', dash: '6 3' }); }
  const pairs = []; for(let i = 1; i <= n; i++) for(let j = i + 1; j <= n; j++) pairs.push([i, j]);
  if(pairs.length <= 6) pairs.forEach(([i, j], k) => t.push({ key: 'S' + (i + 1) + (j + 1), label: 'S' + (i + 1) + ',' + (j + 1), col: k === 0 ? 'var(--s23)' : OUT_COLS[(k + 3) % 8], i, j, grp: 'iso', dash: '2 3' }));
  else t.push({ key: 'Siso', label: 'worst Sij', col: 'var(--s23)', worst: pairs, grp: 'iso', dash: '2 3' });
  return t;
}
/* Default traces: S11, the first two transmissions, and the output match and isolation — per port for a 2-way, the
   worst case beyond. A key set by the student wins. */
const traceKeyOn = key => { const v = S.perf.traces[key]; if(v != null) return v;
  return ['S11', 'S21', 'S31', 'Siso', 'Smatch', 'S23'].includes(key) || (nOut() <= 2 && (key === 'S22' || key === 'S33')); };
// The curve of trace t over the sweep (dB, or phase in degrees).
function traceData(sw, t, mode){
  return sw.S.map(M => {
    if(t.worst) return Math.max(...t.worst.map(([i, j]) => sdb(M, i, j)));
    const v = mget(M, t.i, t.j);
    if(mode === 'phase'){ if(t.j !== 0 || t.i === 0) return NaN; const ref = mget(M, 1, 0); return wrap180((carg(v) - carg(ref)) * DEG) + (t.i === 1 ? carg(ref) * DEG : 0); }
    return dB20(cabs(v));
  });
}
// ── END 1 ─────────────────────────────────────────────────────

// ── 2. PLOT ───────────────────────────────────────────────────
let PIN = null;                                       // pinned design B: { label, sw, summary }
/* The plot-range fields f min, f max (GHz) and floor (dB) on the numCtl refusal path (CQ-PDD-007, DEFECT-PDD-012,
   VIS-PDD-005): limits from RANGES, the field returns to the value in use, a message names the cause. */
function plotField(lab, key, id, unit, step, toShow, fromShown, why){
  const P0 = S.perf, msg = refuseMsg(id), cur = () => toShow(P0[key]);
  const inp = el('input', { type: 'number', id, value: cur(), step, 'aria-label': lab + ' (' + unit + ')', 'aria-describedby': id + '_msg' });
  inp.addEventListener('change', () => { const t = inp.value, v = fromShown(parseFloat(t));
    if(t.trim() === '' || !isFinite(v)) return refuse(inp, msg, t, 'not a number', cur());
    const bad = why(v); if(bad) return refuse(inp, msg, t, bad, cur());
    accept(inp, msg); P0[key] = v; update(true); });
  return { label: el('label', { class: 'mini' }, lab + ' ', inp, ' ' + unit), msg };
}
// The three plot-range fields with their limits and cause texts (frequencies shown in GHz, stored as f/f0).
function plotRangeFields(){
  const P0 = S.perf, ghz = u => String(+(u * S.f0 / 1e9).toFixed(3)), fromGhz = g => g * 1e9 / S.f0;
  // Cause text when the range would be narrower than PLOT_MIN_SPAN, else empty.
  const span = (k, v) => k === 'uLo' ? (v < P0.uHi - PLOT_MIN_SPAN ? '' : 'f min must be below f max (' + ghz(P0.uHi) + ' GHz) by at least ' + ghz(PLOT_MIN_SPAN) + ' GHz')
    : (v > P0.uLo + PLOT_MIN_SPAN ? '' : 'f max must be above f min (' + ghz(P0.uLo) + ' GHz) by at least ' + ghz(PLOT_MIN_SPAN) + ' GHz');
  // A frequency field of the plot range (shown in GHz, limits from RANGES).
  const freq = (lab, k) => plotField(lab, k, 'rng_' + k, 'GHz', 'any', ghz, fromGhz,
    v => inRange(k, v) ? span(k, v) : 'allowed ' + ghz(RANGES[k][0]) + ' to ' + ghz(RANGES[k][1]) + ' GHz (' + rangeText(k) + ')');
  return [freq('f min', 'uLo'), freq('f max', 'uHi'),
    plotField('floor', 'dbMin', 'rng_db', 'dB', '5', v => String(v), v => v, v => inRange('dbMin', v) ? '' : 'allowed ' + rangeText('dbMin'))];
}
// S-parameter plot with its range fields, trace chips, marker and readouts.
function drawPerfPlot(D){
  const box = $('perfPlot'), P0 = S.perf, sw = D.sw, ts = traceList(sw.p), plotFields = plotRangeFields();
  const head = el('div', { class: 'row wrap' },
    el('div', { class: 'seg', role: 'group', 'aria-label': 'Plot mode' }, ...[['mag', '|S| (dB)'], ['phase', 'Phase (∠Si1, imbalance)']].map(([v, t]) =>
      el('button', { text: t, 'aria-pressed': String(P0.mode === v), on: { click: () => { P0.mode = v; update(true); } } }))),
    ...plotFields.map(f => f.label),
    el('button', { text: PIN ? 'Unpin B' : 'Pin as B (compare)', on: { click: () => { PIN = PIN ? null : pinCurrent(D); update(true); } } }));
  const chips = el('div', { class: 'row wrap chips' }, ...ts.map(t => el('button', { class: 'tchip', 'aria-pressed': String(traceKeyOn(t.key)), style: '--c:' + t.col, text: t.label,
    on: { click: () => { S.perf.traces[t.key] = !traceKeyOn(t.key); update(true); } } })));
  const w = Math.max(320, box.clientWidth - 20), h = 340;
  const svg = svgEl('svg', { width: w, height: h, id: 'perfSvg', role: 'img', 'aria-label': 'S-parameters versus frequency' });
  const pl = 52, pr = 14, pt = 10, pb = 34, x0 = pl, x1 = w - pr, y0 = pt, y1 = h - pb;
  const uL = P0.uLo, uH = P0.uHi, phase = P0.mode === 'phase';
  const yLo = phase ? -180 : P0.dbMin, yHi = phase ? 180 : 0;
  // Plot x of a frequency ratio u; Y(v) is the plot y of a value.
  const X = u => x0 + (x1 - x0) * (u - uL) / (uH - uL), Y = v => y0 + (y1 - y0) * (yHi - Math.max(yLo, Math.min(yHi, v))) / (yHi - yLo);
  // grid
  const ystep = phase ? 45 : (yHi - yLo) > 60 ? 20 : 10;
  for(let v = yLo; v <= yHi + 1e-9; v += ystep){ svg.append(svgEl('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), class: 'grid' })); svg.append(svgEl('text', { x: x0 - 6, y: Y(v) + 4, 'font-size': 11, 'text-anchor': 'end' }, String(v))); }
  const gs = niceStep((uH - uL) * S.f0 / 1e9 / 6);
  for(let fg = Math.ceil(uL * S.f0 / 1e9 / gs) * gs; fg <= uH * S.f0 / 1e9 + 1e-9; fg += gs){ const u = fg * 1e9 / S.f0; svg.append(svgEl('line', { x1: X(u), x2: X(u), y1: y0, y2: y1, class: 'grid' }));
    svg.append(svgEl('text', { x: X(u), y: y1 + 14, 'font-size': 11, 'text-anchor': 'middle' }, fg.toFixed(gs < 0.1 ? 2 : gs < 1 ? 1 : 0))); }
  svg.append(svgEl('text', { x: (x0 + x1) / 2, y: h - 4, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--mut)' }, 'frequency (GHz)'));
  svg.append(svgEl('text', { x: 12, y: (y0 + y1) / 2, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--mut)', transform: `rotate(-90 12 ${(y0 + y1) / 2})` }, phase ? 'phase (°): ∠S21, others relative to it' : '|S| (dB)'));
  // usable band and −15 dB line
  const use = D.bw && D.bw.usable && D.bw.usable.bw;
  if(!phase && use) svg.append(svgEl('rect', { x: X(Math.max(uL, use.lo)), y: y0, width: Math.max(0, X(Math.min(uH, use.hi)) - X(Math.max(uL, use.lo))), height: y1 - y0, class: 'useband' }));
  if(!phase) svg.append(svgEl('line', { x1: x0, x2: x1, y1: Y(-15), y2: Y(-15), class: 'ref15' }));
  svg.append(svgEl('line', { x1: X(1), x2: X(1), y1: y0, y2: y1, class: 'f0line' }));
  svg.append(svgEl('text', { x: X(1) + 3, y: y0 + 11, 'font-size': 11 }, 'f₀'));
  const clip = svgEl('clipPath', { id: 'pclip' }); clip.append(svgEl('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 })); svg.append(clip);
  const plotG = svgEl('g', { 'clip-path': 'url(#pclip)' }); svg.append(plotG);
  // Draw one trace (dashed for the pinned design B).
  const curve = (u, data, t, dashed, op) => {
    let d = '', pen = false;
    data.forEach((v, i) => { if(!isFinite(v)){ pen = false; return; } d += (pen ? 'L' : 'M') + X(u[i]).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    plotG.append(svgEl('path', { d, fill: 'none', stroke: t.col, 'stroke-width': dashed ? 1.6 : 2.2, 'stroke-dasharray': dashed ? '7 4' : t.dash, opacity: op || 1, 'data-trace': t.key + (dashed ? 'B' : '') }));
  };
  const shown = ts.filter(t => traceKeyOn(t.key) && (!phase || (t.j === 0 && t.i > 0)));
  if(PIN) shown.forEach(t => { const tb = traceList(PIN.sw.p).find(x => x.key === t.key); if(tb) curve(PIN.sw.u, traceData(PIN.sw, tb, P0.mode), t, true, 0.85); });
  shown.forEach(t => curve(sw.u, traceData(sw, t, P0.mode), t, false));
  // marker
  const mu = D.mu;                                    // the marker, solved at exactly this f/f0 (DEFECT-PDD-014)
  svg.append(svgEl('line', { x1: X(mu), x2: X(mu), y1: y0, y2: y1, class: 'marker' }));
  shown.forEach(t => { const v = traceData({ S: [D.Sm] }, t, P0.mode)[0]; if(isFinite(v)) svg.append(svgEl('circle', { cx: X(mu), cy: Y(v), r: 3.5, fill: t.col })); });
  svg.addEventListener('click', ev => { const r = svg.getBoundingClientRect(), u = uL + (uH - uL) * (ev.clientX - r.left - x0) / (x1 - x0); if(u >= uL && u <= uH){ S.perf.marker = u; update(true); } });
  svg.style.cursor = 'crosshair';
  const mrows = shown.map(t => { const v = traceData({ S: [D.Sm] }, t, P0.mode)[0];
    return el('span', { class: 'mk', style: '--c:' + t.col, text: t.label + ' ' + (isFinite(v) ? (phase ? fmtDeg(v, 2) + '°' : fmt(v, 2) + ' dB') : '—') }); });
  box.replaceChildren(el('h4', {}, 'S-parameters ', el('span', { class: 'hint', text: '(click the plot to move the marker' + (PIN ? '; dashed: pinned ' + PIN.label : '') + ')' })), head, ...plotFields.map(f => f.msg), chips, svg,
    el('div', { class: 'markers num' }, el('b', { text: 'marker ' + fmtGHz(mu) }), ...mrows));
}
// A round grid step near x (1, 2 or 5 × 10^k).
function niceStep(x){ const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
// A short label of the design on screen.
function designLabel(D){
  const d = D.design, shp = [...new Set(S.shapes.slice(0, Math.max(1, maxSections(D))))].join('/');
  if(d.topology === 'tree') return `tree N=${d.tree.N} (${MODULE_NAME[S.tree.module]}), ${S.M} sec, ${shp}`;
  return `${{ wilkinson: 'Wilkinson', tee: 'T-junction', resistive: 'Resistive' }[d.topology]} ${S.N}-way ${S.N === 2 && d.topology !== 'resistive' ? ratioText(S.ratioDB) : ''}, ${d.topology === 'resistive' ? '' : S.M + ' sec, ' + shp}`;
}
// Snapshot of the current design as the pinned design B.
function pinCurrent(D){ return { label: 'B: ' + designLabel(D), sw: D.sw, summary: summaryOf(D, 'B') }; }
// ── END 2 ─────────────────────────────────────────────────────

// ── 3. BANDWIDTHS ─────────────────────────────────────────────
function drawBandwidths(D){
  const rows = D.bw.rows.map(r => { const b = r.bw, use = D.bw.usable === r;
    return { cls: use ? 'use' : null, cells: [{ text: r.label + (use ? ' ← usable' : '') }, b ? (b.frac * 100).toFixed(1) + ' %' : 'fails at f₀',
      { text: (b ? fmtGHz(b.lo) + ' – ' + fmtGHz(b.hi) : '') + (b && (b.clipLo || b.clipHi) ? ' (past the plot range)' : '') }] }; });
  $('perfBw').replaceChildren(el('h4', { text: '−15 dB bandwidths' }), table('sheet', ['Parameter', 'Δf/f₀', 'band'], rows),
    el('p', { class: 'hint', text: 'The usable bandwidth is the narrowest: every port matched and the outputs isolated to −15 dB.' }));
}
// ── END 3 ─────────────────────────────────────────────────────

// ── 4. POWER FLOW ─────────────────────────────────────────────
/* One flow diagram: the input band on the left splits into a band per output (green, fading for small shares), the
   resistors (purple), line loss (grey) and the reflected band returning to the source (amber). Widths ∝ power. */
function flowSvg(Ld, title, n){
  const W = 420, rows = n + 3, H = Math.max(180, 24 * rows + 40), x0 = 70, x1 = W - 120, top = 30, hMax = 90;
  const svg = svgEl('svg', { width: W, height: H, role: 'img', 'aria-label': 'Power flow ' + title, class: 'flowsvg' });
  svg.append(svgEl('text', { x: 6, y: 16, 'font-size': 12, 'font-weight': 600 }, title));
  const parts = Ld.pLoad.map((p, i) => ({ v: p, label: 'P' + (i + 2), cls: 'fo' })).concat([{ v: Ld.pRes, label: 'resistors', cls: 'fr' }, { v: Ld.pLine, label: 'line loss', cls: 'fl' }]);
  const gapY = (H - top - 20) / parts.length, inW = hMax, yIn = top + (H - top - 20) / 2;
  svg.append(svgEl('rect', { x: 10, y: yIn - inW / 2, width: x0 - 10, height: inW, class: 'fin' }));
  svg.append(svgEl('text', { x: 14, y: yIn - inW / 2 - 4, 'font-size': 11 }, 'in 100 %'));
  let acc = yIn - inW / 2;
  parts.forEach((p, i) => {
    const w = Math.max(0.6, hMax * p.v), ys = acc + w / 2; acc += hMax * p.v;
    const ye = top + gapY * (i + 0.5), faded = p.v < 0.01 ? ' faded' : '';
    svg.append(svgEl('path', { d: `M${x0} ${ys} C${(x0 + x1) / 2} ${ys} ${(x0 + x1) / 2} ${ye} ${x1} ${ye}`, class: 'fband ' + p.cls + faded, 'stroke-width': w }));
    svg.append(svgEl('text', { x: x1 + 6, y: ye + 4, 'font-size': 11, class: faded ? 'fadedtxt' : '' }, `${p.label} ${(p.v * 100).toFixed(2)} %`));
  });
  const wr = Math.max(0.6, hMax * Ld.pRefl);
  svg.append(svgEl('path', { d: `M${x0} ${yIn + inW / 2 + 8 + wr / 2} H 10`, class: 'fband fre' + (Ld.pRefl < 0.01 ? ' faded' : ''), 'stroke-width': wr }));
  svg.append(svgEl('text', { x: 14, y: yIn + inW / 2 + 22 + wr, 'font-size': 11, class: Ld.pRefl < 0.01 ? 'fadedtxt' : '' }, `reflected ${(Ld.pRefl * 100).toFixed(2)} %`));
  const sum = Ld.total;
  svg.append(svgEl('text', { x: 6, y: H - 4, 'font-size': 11, fill: Math.abs(sum - 1) < 1e-3 ? 'var(--s21)' : 'var(--bad)' },
    `balance: reflected + delivered + R + lines = ${(sum * 100).toFixed(3)} %`));
  return svg;
}
// Power-flow panels at f0 and at the marker.
function drawFlow(D){
  const n = D.net.ports.length - 1;
  $('perfFlow').replaceChildren(el('h4', { text: 'Power flow (output loads as set on the Designer)' }),
    el('div', { class: 'row wrap' }, flowSvg(D.L0, 'at f₀ = ' + (S.f0 / 1e9).toFixed(3) + ' GHz', n), flowSvg(D.Lm, 'at the marker, ' + fmtGHz(D.mu), n)));
}
// ── END 4 ─────────────────────────────────────────────────────

// ── 5. S-MATRIX ───────────────────────────────────────────────
/* The theorem sentence under the badges (PPR-PDD-002, -003, -007, -014): built from the same checks as the badges, for
   the state on screen, in few words (VIS-PDD-018); the detail is in Theory §1 and §4. "Three-port theorem" only for
   three-ports; for more ports the N-port statement that does hold. With line loss on, the sums name it. */
function theoremText(D, ck){
  const n = D.net.ports.length - 1, c3 = ck.col.map(x => x.toFixed(3)), outs = c3.slice(1);
  const cols = 'column sums ' + (n > 2 && outs.every(x => x === outs[0]) ? c3[0] + ' at the input, ' + outs[0] + ' at each output' : c3.join(', '));
  const lineLoss = S.lossOn && lossDb() > 0, oddR = D.design.topology === 'wilkinson' && S.resOn;
  let state;
  if(ck.match && ck.iso && !ck.lossless) state = 'matched and isolated, so not lossless: ' +
    (lineLoss ? 'line loss takes part of the input power; R and line loss take power entering an output (' :
      oddR ? 'R absorbs only the odd-mode part of power entering an output (' : 'the resistors absorb part of power entering an output (') + cols + ').';
  else if(ck.match && !ck.lossless) state = 'matched but lossy (' + cols + (lineLoss ? '; line loss is on' : '') + ')' + (n > 1 && !ck.iso ? '; outputs not isolated.' : '.');
  else if(ck.lossless && ck.recip) state = 'lossless and reciprocal, so not matched everywhere: ' + (ck.inMatch ? 'input matched, outputs not' : 'input not matched') +
    (n > 1 ? (ck.iso ? '; outputs isolated.' : '; outputs not isolated.') : '.');
  else state = 'neither matched everywhere nor lossless (' + cols + (lineLoss ? '; line loss is on' : '') + ').';
  const tree = D.design.topology === 'tree' ? ' Each junction keeps what its module does (Theory §7).' : '';
  if(n === 2) return { head: 'Three-port theorem.', text: 'No three-port is lossless, reciprocal and matched at all ports. This one is ' + state + tree };
  return { head: 'Matched, isolated, lossless?', text: 'A divider matched at every port with isolated outputs cannot be lossless. This ' + (n + 1) + '-port is ' + state + tree };
}
// S-matrix at f0 with its property checks and the theorem sentence.
function drawSMatrix(D){
  const S0 = D.S0, p = S0.n, ck = sChecks(S0), box = $('perfS');
  let grid;
  if(p <= 5){
    const rows = [];
    for(let i = 0; i < p; i++){ const cells = [{ text: String(i + 1), th: true }]; for(let j = 0; j < p; j++){ const v = mget(S0, i, j);
      cells.push({ t: fmtDb(dB20(cabs(v)), 2) + ' dB<br><span class="mut">∠' + fmtDeg(carg(v) * DEG, 1) + '°</span>', cls: i === j ? 'diag' : null }); } rows.push({ cells }); }
    grid = table('sheet smat' + (p === 5 ? ' smat5' : ''), ['i \\ j', ...[...Array(p).keys()].map(j => String(j + 1))], rows);
  } else {
    const c = 16, g = svgEl('svg', { width: 30 + p * c, height: 20 + p * c, role: 'img', 'aria-label': '|S| at f0 as a grid' });
    for(let i = 0; i < p; i++) for(let j = 0; j < p; j++){ const db = sdb(S0, i, j), t = Math.max(0, Math.min(1, (db + 60) / 60));
      const r = svgEl('rect', { x: 24 + j * c, y: 14 + i * c, width: c - 1, height: c - 1, fill: 'var(--s31)', 'fill-opacity': (0.06 + 0.94 * t).toFixed(3) });
      r.append(svgEl('title', {}, 'S' + (i + 1) + ',' + (j + 1) + ': ' + fmtDb(db, 2) + ' dB ∠' + fmtDeg(carg(mget(S0, i, j)) * DEG, 1) + '°')); g.append(r); }
    g.append(svgEl('text', { x: 24, y: 10, 'font-size': 10 }, 'j →'), svgEl('text', { x: 2, y: 20 + p * c / 2, 'font-size': 10 }, 'i'));
    grid = el('div', {}, g, el('p', { class: 'hint' }, rich('|S<sub>ij</sub>| at f₀, darker = larger (0 to −60 dB); hover a cell for its value.')));
  }
  // A check line: ✓ text when b holds, ✗ the other text when not.
  const yes = (b, t, f) => el('li', { class: b ? 'ok' : 'no', text: (b ? '✓ ' : '✗ ') + (b ? t : f) });
  const th = theoremText(D, ck);
  box.replaceChildren(el('h4', { text: 'S-matrix at f₀' }), grid, el('ul', { class: 'checks' },
    yes(ck.match, 'matched: every |Sii| < −20 dB', 'not matched at every port (some |Sii| ≥ −20 dB)'),
    yes(ck.recip, 'reciprocal: Sij = Sji', 'not reciprocal'),
    yes(ck.iso, 'outputs isolated: every |Sij| < −20 dB', 'outputs not isolated'),
    yes(ck.lossless, 'lossless: every column Σ|Sij|² = 1', 'lossy: column power sums ' + ck.col.map(x => x.toFixed(3)).join(', '))),
    el('p', { class: 'theorem' }, el('b', { text: th.head }), ' ' + th.text));
}
// ── END 5 ─────────────────────────────────────────────────────

// ── 6. COMPARE ────────────────────────────────────────────────
// Summary figures of one design for the comparison tables.
function summaryOf(D, label){
  const n = D.net.ports.length - 1, { worstJ, worstIso } = worstOut(D.S0);
  return { label, n, s11: sdb(D.S0, 0, 0), worstJ, worstIso, deliv: D.L0.pDeliv, loss: D.L0.pRes + D.L0.pLine,
    use: D.bw && D.bw.usable && D.bw.usable.bw ? D.bw.usable.bw.frac : 0, fp: D.lay.bbox, nR: resistorCount(D.design), spread: phaseImbalance(D.S0, n).spread };
}
// Comparison table, one column per design summary (plain text cells).
function compareTable(list){
  // A comparison-table row of key k with the value f(s) for each design.
  const r = (k, f) => ({ cells: [{ text: k }, ...list.map(s => ({ text: f(s) }))] });
  return table('sheet cmp', [{ text: '' }, ...list.map(s => ({ text: s.label, th: true }))], [
    r('delivered (matched loads)', s => (s.deliv * 100).toFixed(2) + ' % (' + fmt(10 * Math.log10(s.deliv / s.n), 2) + ' dB each)'),
    r('S11 at f₀', s => fmtDb(s.s11, 1) + ' dB'), r('worst output match', s => fmtDb(s.worstJ, 1) + ' dB'),
    r('worst isolation', s => s.n > 1 ? fmtDb(s.worstIso, 1) + ' dB' : '—'), r('usable −15 dB band', s => (s.use * 100).toFixed(1) + ' %'),
    r('phase imbalance', s => s.spread.toFixed(2) + '°'), r('footprint', s => s.fp.w.toFixed(2) + ' × ' + s.fp.h.toFixed(2) + ' mm (' + s.fp.area.toFixed(0) + ' mm²)'),
    r('resistors', s => String(s.nR))]);
}
let DIRECT = { key: '', list: null };
// Comparison tables: pinned design B, and the tree against the direct N-way divider.
function drawCompare(D){
  const box = $('perfCmp'), parts = [el('h4', { text: 'Compare' })];
  const A = summaryOf(D, 'A: ' + designLabel(D));
  if(PIN) parts.push(compareTable([A, PIN.summary]));
  else parts.push(el('p', { class: 'hint', text: 'Pin a design as B (button above the plot), change the design, and the two are compared here and overlaid on the plot — e.g. 1 vs 3 sections, or Wilkinson vs T vs resistive.' }));
  const n = nOut();
  if(isTree() || (S.topology === 'wilkinson' && n > 2)){
    const key = JSON.stringify([S.topology, n, S.M, S.taper, S.rippleDB, S.er, S.h, S.f0, S.z0, S.tree, S.shapes, S.lossOn, S.lossDb, S.fp, S.perf.uLo, S.perf.uHi]);
    if(DIRECT.key !== key){
      const star = analyse(synthesize(Object.assign(synthParams(), { topology: 'wilkinson', N: n })));
      const resY = analyse(synthesize(Object.assign(synthParams(), { topology: 'resistive', N: n, resForm: 'Y' })));
      DIRECT = { key, list: [summaryOf(star, 'Wilkinson star ' + n + '-way'), summaryOf(resY, 'Resistive Y ' + n + '-way (R = ' + (S.z0 * (n - 1) / (n + 1)).toFixed(1) + ' Ω)')] };
    }
    parts.push(el('h4', { text: 'Against a direct ' + n + '-way divider (same N, matched loads)' }), compareTable((isTree() ? [A] : []).concat(DIRECT.list)),
      el('p', { class: 'hint', text: 'A star of N > 2 resistors is not planar (air bridges). The resistive Y loses 10·log₁₀N² dB per output instead of 10·log₁₀N.' }));
  }
  box.replaceChildren(...parts);
}
// Draw every panel of the Performance page.
function drawPerf(D){ drawPerfPlot(D); drawBandwidths(D); drawFlow(D); drawSMatrix(D); drawCompare(D); }
// ── END 6 ─────────────────────────────────────────────────────
