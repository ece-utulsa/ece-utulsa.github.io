/* ════════════════════════════════════════════════════════════════════════════════════════════
   evtab.js — Tab 5: the cumulative earned value chart (PV, EV, SV bracket, forecast at the current SPI), the SPI trend,
   the start-versus-finish quadrant with the team's weekly path, the measures table and the late-task list.
   Tab 6: the one-page printable status report.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

function evFilter(){ return { area: V.evarea }; }

function renderEv(root){
  const ser = series(P, IX, SX, evFilter()), cur = P.currentWeek, m = ser[cur];
  const tb = h('div', { class: 'toolbar' },
    h('label', null, 'Measures for', h('select', { 'data-key': 'ev-area', onchange: ev => { V.evarea = Number(ev.target.value); render(); } },
      areaOptions(V.evarea).map((o, i) => { if(i === 0) o.textContent = 'Whole project'; return o; }))),
    zoomSelect(), h('span', null, 'Signal at week ' + cur + ': ', signalChip(m)));
  append(root, [activeBaseline(P) ? null : noBaselineNote(), tb,
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Cumulative earned value (tasks)'), evChart(ser, cur, 1380), evLegend()),
    h('div', { class: 'ev-charts' },
      h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'SPI by week'), spiChart(ser, cur)),
      h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Start versus finish'), quadChart(ser, cur))),
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, `Late tasks at week ${cur}`), lateList(cur)),
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Every measure by week'), measuresTable(ser, cur))]);
}

function evLegend(){
  return h('div', { class: 'legend', style: 'margin-top:6px' },
    h('span', null, lineKey('#55636b', 'dashed'), 'PV — planned value'), h('span', null, lineKey('#10668a', 'solid'), 'EV — earned value'),
    h('span', null, 'SV — bracket at the current week'), h('span', null, lineKey('#10668a', 'dotted'), 'Forecast at the current SPI'));
}
function lineKey(col, style){
  return h('span', { 'aria-hidden': 'true', style: `display:inline-block;width:26px;border-top:3px ${style} ${col};vertical-align:middle;margin-right:5px` });
}

/** PV across the baseline, EV to the current week, the SV bracket, the forecast at the current SPI, plan finish T and
    forecast Tf (change briefing C4, C5: text ≥ 13 px, key annotations 15 px bold, labels clear of lines and of each other). */
function evChart(ser, cur, width, zoom){
  const m = ser[cur], BAC = m.BAC || 0, T = m.T || 0;
  const [a, b] = chartRange('ev', m, zoom), x0 = a - 1, x1 = b;
  const L = 56, R = 28, Tm = 62, B = 50, W = width || 1100, H = 420, pw = W - L - R, ph = H - Tm - B;
  const tk = ticks(Math.max(1, BAC), 5), top = tk[tk.length - 1];
  const X = w => L + (w - x0) / (x1 - x0) * pw, Y = v => Tm + ph - v / top * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'max-width:100%;height:auto',
    'aria-label': `Cumulative earned value chart, weeks ${x0} to ${x1}. At week ${cur}: PV ${fmtCount(m.PV)}, EV ${fmtCount(m.EV)}, SV ${fmtCount(m.SV)}. The values are in the measures table.` });
  svg.append(s('defs', null, s('clipPath', { id: 'evclip' + W }, s('rect', { x: L, y: Tm - 2, width: pw, height: ph + 4 }))));
  for(const v of tk) svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#e3e8eb' }), s('text', { x: L - 8, y: Y(v) + 5, 'font-size': 13, 'text-anchor': 'end', fill: '#4f5b62' }, v));
  const step = ticks(x1 - x0, 10)[1] || 1;
  for(let w = Math.ceil(x0 / step) * step; w <= x1; w += step) svg.append(s('text', { x: X(w), y: H - B + 20, 'font-size': 13, 'text-anchor': 'middle', fill: w === cur ? '#b42318' : '#4f5b62', 'font-weight': w === cur ? 700 : 400 }, w));
  svg.append(s('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), stroke: '#4f5b62' }), s('line', { x1: L, x2: L, y1: Tm, y2: Y(0), stroke: '#4f5b62' }),
    s('text', { x: L + pw / 2, y: H - 8, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'),
    s('text', { x: 16, y: Tm + ph / 2, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 16 ${Tm + ph / 2})` }, 'Tasks'));
  if(!BAC){ svg.append(s('text', { x: L + pw / 2, y: Tm + ph / 2, 'font-size': 15, 'text-anchor': 'middle', fill: '#4f5b62' }, 'No baselined tasks yet: baseline the schedule.')); return h('div', { class: 'chartbox' }, svg); }
  const plot = s('g', { 'clip-path': `url(#evclip${W})` });
  svg.append(plot);
  plot.append(s('line', { x1: L, x2: W - R, y1: Y(BAC), y2: Y(BAC), stroke: '#9aa5ab', 'stroke-dasharray': '2 3' }));
  const pv = [[0, 0], ...ser.filter(r => r.w >= 1 && r.PV !== null).map(r => [r.w, r.PV])].filter(([w]) => w >= x0 - 1 && w <= x1 + 1);
  plot.append(s('polyline', { points: pv.map(([w, v]) => X(w) + ',' + Y(v)).join(' '), fill: 'none', stroke: '#55636b', 'stroke-width': 2.4, 'stroke-dasharray': '8 5' }));
  // plan finish and forecast: vertical lines, labels above the plot on opposite sides so they never overlap
  const inX = w => w >= x0 && w <= x1;
  const lab = [];
  if(T && inX(T)){ plot.append(s('line', { x1: X(T), x2: X(T), y1: Tm, y2: Y(0), stroke: '#55636b', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' })); lab.push({ w: T, text: `Plan finish: week ${T}`, col: '#3d484e' }); }
  if(cur >= 1){
    const ev = [[0, 0], ...ser.slice(1, cur + 1).map(r => [r.w, r.EV || 0])];
    plot.append(s('polyline', { points: ev.map(([w, v]) => X(w) + ',' + Y(v)).join(' '), fill: 'none', stroke: '#10668a', 'stroke-width': 3.2 }));
    if(m.Tf !== null && m.EV < BAC){
      const tf = Math.min(m.Tf, x1);
      plot.append(s('line', { x1: X(cur), y1: Y(m.EV), x2: X(tf), y2: Y(tf < m.Tf ? m.EV + (BAC - m.EV) * (tf - cur) / (m.Tf - cur) : BAC), stroke: '#10668a', 'stroke-width': 2.4, 'stroke-dasharray': '2 5' }));
      if(inX(m.Tf)){ plot.append(s('line', { x1: X(m.Tf), x2: X(m.Tf), y1: Tm, y2: Y(0), stroke: '#10668a', 'stroke-width': 1.5, 'stroke-dasharray': '2 4' })); lab.push({ w: m.Tf, text: `Forecast: week ${m.Tf.toFixed(1)}`, col: '#10668a' }); }
      else lab.push({ w: x1, text: `Forecast: week ${m.Tf.toFixed(1)} →`, col: '#10668a', edge: true });
    }
    svg.append(s('circle', { cx: X(cur), cy: Y(m.EV), r: 5, fill: '#10668a', stroke: '#fff', 'stroke-width': 1.5 }));
    if(m.SV !== null && m.SV !== 0 && inX(cur)){
      const x = X(cur) + 9, y1 = Y(m.PV), y2 = Y(m.EV);
      svg.append(s('path', { d: `M${x - 5} ${y1}H${x}V${y2}H${x - 5}`, fill: 'none', stroke: '#1b2328', 'stroke-width': 2 }),
        halo({ x: x - 2, y: Math.max(y1, y2) + 24, 'font-size': 15, 'font-weight': 700, fill: m.SV < 0 ? '#b42318' : '#18744a' }, `SV = ${fmtCount(m.SV)}`));
    }
  }
  // annotation labels above the plot: the left one ends at its line, the right one starts at its line
  // each label sits beside its line (right side, or left if it would run off the chart); a label that would overlap
  // the one before it moves up a row
  lab.sort((p, q) => p.w - q.w);
  const placed = [];
  lab.forEach((l, i) => {
    const wd = l.text.length * 8.6, xl = l.edge ? W - R : X(l.w), leftFirst = i < lab.length - 1;
    let x0 = l.edge ? xl - wd : leftFirst ? xl - 6 - wd : xl + 6;
    if(x0 < L) x0 = xl + 6;
    if(x0 + wd > W - 2) x0 = xl - 6 - wd;
    x0 = Math.max(L, x0);
    let row = 0;
    while(placed.some(p => p.row === row && x0 < p.x1 + 12 && x0 + wd > p.x0 - 12)) row++;
    placed.push({ x0, x1: x0 + wd, row });
    svg.append(halo({ x: x0, y: Tm - 14 - row * 20, 'font-size': 15, 'font-weight': 700, 'text-anchor': 'start', fill: l.col }, l.text));
  });
  svg.append(halo({ x: L + 8, y: Y(BAC) + 20, 'font-size': 15, 'font-weight': 700, fill: '#3d484e' }, `BAC = ${BAC} tasks`));
  return h('div', { class: 'chartbox' }, svg);
}

function spiChart(ser, cur, zoom){
  const [a, b] = chartRange('spi', ser[cur], zoom);
  const pts = ser.slice(1, cur + 1).filter(r => r.SPI !== null && r.w >= a && r.w <= b);
  const W = 540, H = 300, L = 52, R = 16, T = 16, B = 46, pw = W - L - R, ph = H - T - B;
  const top = Math.max(1.5, ...pts.map(r => r.SPI)) * 1.05;
  const X = w => L + (w - a) / Math.max(1, b - a) * pw, Y = v => T + ph - v / top * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'SPI by week. The values are in the measures table.', style: 'max-width:100%;height:auto' });
  for(const v of [0, 0.5, 1, 1.5, 2].filter(v => v <= top)) svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: v === 1 ? '#4f5b62' : '#e3e8eb', 'stroke-dasharray': v === 1 ? '5 3' : null }),
    s('text', { x: L - 8, y: Y(v) + 5, 'font-size': 13, 'text-anchor': 'end', fill: '#4f5b62' }, v.toFixed(1)));
  const step = ticks(b - a, 8)[1] || 1;
  for(let w = a; w <= b; w += step) svg.append(s('text', { x: X(w), y: H - B + 20, 'font-size': 13, 'text-anchor': 'middle', fill: w === cur ? '#b42318' : '#4f5b62', 'font-weight': w === cur ? 700 : 400 }, w));
  svg.append(s('text', { x: L + pw / 2, y: H - 6, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'),
    halo({ x: W - R - 4, y: Y(1) - 8, 'font-size': 13, 'text-anchor': 'end', fill: '#4f5b62' }, 'SPI = 1: on plan'));
  if(pts.length){
    svg.append(s('polyline', { points: pts.map(r => X(r.w) + ',' + Y(r.SPI)).join(' '), fill: 'none', stroke: '#10668a', 'stroke-width': 2.8 }));
    for(const r of pts) svg.append(s('circle', { cx: X(r.w), cy: Y(r.SPI), r: 4, fill: '#10668a' }, s('title', { text: `Week ${r.w}: SPI ${fmtIndex(r.SPI)}` })));
    const lastP = pts[pts.length - 1];
    svg.append(halo({ x: X(lastP.w) + 8, y: Y(lastP.SPI) + (lastP.SPI < 1 ? 22 : -10), 'font-size': 15, 'font-weight': 700, fill: '#10668a' }, fmtIndex(lastP.SPI)));
  } else svg.append(s('text', { x: L + pw / 2, y: T + ph / 2, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'SPI not yet defined'));
  return svg;
}

/** Start ratio across, finish ratio up, split at 1; the team's dot week by week. Quadrants carry the signal word and the
    lecture's description (change briefing C8). */
function quadChart(ser, cur){
  const pts = ser.slice(1, cur + 1).filter(r => r.SR !== null && r.FR !== null);
  const W = 540, H = 340, L = 52, R = 16, T = 16, B = 46, pw = W - L - R, ph = H - T - B;
  const mx = Math.max(2, ...pts.map(r => r.SR)) * 1.02, my = Math.max(2, ...pts.map(r => r.FR)) * 1.02;
  const X = v => L + v / mx * pw, Y = v => T + ph - v / my * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'max-width:100%;height:auto',
    'aria-label': 'Start versus finish quadrant: start ratio across, finish ratio up. Top left: Watch, starting late, finishing well. Top right: On plan. Bottom left: Re-plan, behind on both. Bottom right: Watch, starting, not finishing. The values are in the measures table.' });
  svg.append(s('rect', { x: L, y: T, width: X(1) - L, height: Y(1) - T, fill: '#fff6e5' }), s('rect', { x: X(1), y: Y(1), width: W - R - X(1), height: Y(0) - Y(1), fill: '#fff6e5' }),
    s('rect', { x: X(1), y: T, width: W - R - X(1), height: Y(1) - T, fill: '#e8f4ed' }), s('rect', { x: L, y: Y(1), width: X(1) - L, height: Y(0) - Y(1), fill: '#fdeceb' }),
    s('line', { x1: X(1), x2: X(1), y1: T, y2: Y(0), stroke: '#4f5b62' }), s('line', { x1: L, x2: W - R, y1: Y(1), y2: Y(1), stroke: '#4f5b62' }));
  const quad = (x, y, anchor, word, desc, col) => [halo({ x, y, 'font-size': 15, 'font-weight': 700, 'text-anchor': anchor, fill: col }, word),
    halo({ x, y: y + 17, 'font-size': 13, 'text-anchor': anchor, fill: '#3d484e' }, desc)];
  append(svg, [quad(L + 8, T + 20, 'start', 'Watch', 'Starting late, finishing well', '#8a5700'),
    quad(W - R - 8, T + 20, 'end', 'On plan', 'Starting and finishing on plan', '#18744a'),
    quad(L + 8, Y(0) - 26, 'start', 'Re-plan', 'Behind on both', '#b42318'),
    quad(W - R - 8, Y(0) - 26, 'end', 'Watch', 'Starting, not finishing', '#8a5700')]);
  svg.append(s('text', { x: L + pw / 2, y: H - 6, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Start ratio SR = Sa / Sp'),
    s('text', { x: 16, y: T + ph / 2, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 16 ${T + ph / 2})` }, 'Finish ratio FR = Fa / Fp'));
  for(const v of [0, 0.5, 1, 1.5, 2]){ if(v <= mx) svg.append(s('text', { x: X(v), y: Y(0) + 20, 'font-size': 13, 'text-anchor': 'middle', fill: '#4f5b62' }, v.toFixed(1)));
    if(v <= my) svg.append(s('text', { x: L - 8, y: Y(v) + 5, 'font-size': 13, 'text-anchor': 'end', fill: '#4f5b62' }, v.toFixed(1))); }
  if(pts.length){
    svg.append(s('polyline', { points: pts.map(r => X(r.SR) + ',' + Y(r.FR)).join(' '), fill: 'none', stroke: '#55636b', 'stroke-width': 1.8 }));
    pts.forEach((r, i) => {
      const last = i === pts.length - 1, cx = X(r.SR), cy = Y(r.FR);
      svg.append(s('circle', { cx, cy, r: last ? 8 : 4, fill: last ? '#10668a' : '#9aa5ab', stroke: '#fff', 'stroke-width': 1.5 }, s('title', { text: `Week ${r.w}: SR ${fmtIndex(r.SR)}, FR ${fmtIndex(r.FR)}, ${r.signal}` })));
      if(last){
        // keep the label off the 1.0 grid lines: put it on the side of the dot away from each line
        const left = r.SR < 1, below = r.FR < 1;
        svg.append(halo({ x: cx + (left ? -14 : 14), y: cy + (below ? 26 : -14), 'font-size': 15, 'font-weight': 700, 'text-anchor': left ? 'end' : 'start', fill: '#1b2328' }, `Week ${r.w}`));
      }
    });
  } else svg.append(s('text', { x: L + pw / 2, y: T + ph / 2 + 4, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'SR and FR not yet both defined'));
  return svg;
}

function lateList(w, filter){
  const list = lateTasks(P, IX, SX, w, filter || evFilter());
  if(!list.length) return h('p', { class: 'mut' }, 'No late tasks.');
  return h('ul', { class: 'plain' }, list.map(l => h('li', { style: 'margin:3px 0' },
    h('b', null, `${l.num} ${l.name}`), ` (${l.owner || 'no owner'}, planned wk ${l.s}–${l.f}): `,
    h('span', { class: 'late' }, [l.lateStart ? 'late start' : '', l.lateFinish ? 'late finish' : ''].filter(Boolean).join(' and ')))));
}

function measuresTable(ser, cur){
  const cols = ['Week', 'Sp', 'Fp', 'Sa', 'Fa', 'PV', 'EV', 'SV', 'SV%', 'SPI', 'SR', 'FR', '% complete', 'Tf (weeks)', 'To go', 'TSPI', 'Signal'];
  return h('div', { class: 'tablewrap' }, h('table', { class: 'grid', 'aria-label': 'Earned value measures by week' },
    h('thead', null, h('tr', null, cols.map((c, i) => h('th', { class: i && i < 16 ? 'n' : null }, c)))),
    h('tbody', null, ser.slice(1, cur + 1).map(m => h('tr', { class: m.w === cur ? 'sel' : null },
      [m.w, m.Sp, m.Fp, m.Sa, m.Fa, fmtCount(m.PV), fmtCount(m.EV), fmtCount(m.SV), fmtPct(m.SVpct), fmtIndex(m.SPI), fmtIndex(m.SR), fmtIndex(m.FR), fmtPct(m.pct),
        m.Tf === null ? UNDEF : m.Tf.toFixed(1), fmtCount(m.togo), fmtTSPI(m)].map((v, i) => h('td', { class: i ? 'n' : null }, v)),
      h('td', null, signalChip(m)))))));
}

/* ── TAB 6: STATUS REPORT ── */
function renderReport(root){
  const cur = P.currentWeek, ser = series(P, IX, SX), m = ser[cur];
  const moved = IX.order.filter(isPkg).filter(e => (SX.get(e.id) || []).some(z => z.week === cur))
    .map(e => ({ e, t: trackAt(SX.get(e.id), cur), was: trackAt(SX.get(e.id), cur - 1).state }));
  const head = [['PV', fmtCount(m.PV)], ['EV', fmtCount(m.EV)], ['SV', fmtCount(m.SV)], ['SPI', fmtIndex(m.SPI)], ['SR', fmtIndex(m.SR)], ['FR', fmtIndex(m.FR)],
    ['Percent complete', fmtPct(m.pct)], ['Forecast finish', m.Tf === null ? UNDEF : `week ${m.Tf.toFixed(1)} (plan: week ${m.T})`], ['TSPI', fmtTSPI(m)]];
  const ta = h('textarea', { class: 'screenonly', rows: 5, 'data-key': 'actions', 'aria-label': 'Actions', maxlength: LIMITS.long,
    onchange: ev => change(() => { P.actions = ev.target.value; }) }, P.actions);
  append(root, [h('div', { class: 'toolbar' }, h('button', { type: 'button', class: 'primary', 'data-key': 'r-print', onclick: () => window.print() }, 'Print or save as PDF'),
      h('span', { class: 'mut small' }, 'One page. Use the browser\'s print dialog to save it as a PDF, then paste it into the weekly status report.')),
    h('article', { id: 'report' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', null, h('h1', null, P.name), h('p', { class: 'mut', style: 'margin:2px 0 0' },
        `Status report · week ${cur} of ${P.weeks} · ${new Date().toISOString().slice(0, 10)}${activeBaseline(P) ? ` · baseline ${activeBaseline(P).n}` : ' · no baseline'}`)),
        signalChip(m)),
      h('h3', null, 'Headline numbers (tasks)'),
      h('div', { class: 'kpis' }, head.map(([k, v]) => h('div', { class: 'kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' + (v === UNDEF || v === 'plan complete' ? ' u' : '') }, v)))),
      h('p', { class: 'reading' }, statusLine(m)),
      h('h3', null, 'Cumulative earned value'), evChart(ser, cur, 840, 'plan'),
      h('h3', null, 'Late tasks'), lateList(cur, {}),
      h('h3', null, `Tasks started or finished in week ${cur}`),
      moved.length ? h('ul', { class: 'plain' }, moved.map(x => h('li', null, `${IX.num.get(x.e.id)} ${x.e.name} (${x.e.pkg.owner || 'no owner'}): ${STATE_LABEL[x.was].toLowerCase()} → `, stateText(x.t.state))))
        : h('p', { class: 'mut' }, 'None.'),
      h('h3', null, 'Actions'), ta, h('div', { class: 'printonly', style: 'white-space:pre-wrap;border:1px solid #c6cfd4;padding:8px;min-height:4em' }, P.actions || ' '))]);
}
