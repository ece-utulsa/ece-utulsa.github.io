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
    h('span', null, 'Signal at week ' + cur + ': ', signalChip(m.signal)));
  append(root, [activeBaseline(P) ? null : noBaselineNote(), tb,
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Cumulative earned value (tasks)'), evChart(ser, cur, 1100), evLegend()),
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

/** PV across the whole baseline, EV to the current week, the SV bracket, and the forecast line to Tf. */
function evChart(ser, cur, width){
  const m = ser[cur], BAC = m.BAC || 0, T = m.T || 0, N = P.weeks;
  const xMax = Math.max(N, T, m.Tf ? Math.min(Math.ceil(m.Tf) + 1, 2 * N) : 0);
  const L = 50, R = 20, Tm = 20, B = 40, W = width || 900, H = 340, pw = W - L - R, ph = H - Tm - B;
  const tk = ticks(Math.max(1, BAC), 5), top = tk[tk.length - 1];
  const X = w => L + w / xMax * pw, Y = v => Tm + ph - v / top * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `Cumulative earned value chart. At week ${cur}: PV ${fmtCount(m.PV)}, EV ${fmtCount(m.EV)}, SV ${fmtCount(m.SV)}. The values are in the measures table.` });
  for(const v of tk) svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#e3e8eb' }), s('text', { x: L - 6, y: Y(v) + 4, 'font-size': 11, 'text-anchor': 'end', fill: '#4f5b62' }, v));
  for(const w of ticks(xMax, 10)) if(w <= xMax) svg.append(s('text', { x: X(w), y: H - B + 16, 'font-size': 11, 'text-anchor': 'middle', fill: '#4f5b62' }, w));
  svg.append(s('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), stroke: '#4f5b62' }), s('line', { x1: L, x2: L, y1: Tm, y2: Y(0), stroke: '#4f5b62' }),
    s('text', { x: L + pw / 2, y: H - 6, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'),
    s('text', { x: 14, y: Tm + ph / 2, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 14 ${Tm + ph / 2})` }, 'Tasks'));
  if(!BAC){ svg.append(s('text', { x: L + pw / 2, y: Tm + ph / 2, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'No baselined tasks yet: baseline the schedule.')); return h('div', { class: 'chartbox' }, svg); }
  // BAC line and plan finish
  svg.append(s('line', { x1: L, x2: W - R, y1: Y(BAC), y2: Y(BAC), stroke: '#9aa5ab', 'stroke-dasharray': '2 3' }), s('text', { x: W - R - 4, y: Y(BAC) - 4, 'font-size': 11, 'text-anchor': 'end', fill: '#4f5b62' }, `BAC ${BAC}`));
  if(T){ svg.append(s('line', { x1: X(T), x2: X(T), y1: Tm, y2: Y(0), stroke: '#55636b', 'stroke-dasharray': '6 4' }), s('text', { x: X(T) + 4, y: Tm + 10, 'font-size': 11, fill: '#55636b' }, `Plan finish T = week ${T}`)); }
  const pv = ser.map(r => r.PV === null ? null : [X(r.w), Y(r.PV)]).filter(Boolean);
  pv.unshift([X(0), Y(0)]);
  svg.append(s('polyline', { points: pv.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#55636b', 'stroke-width': 2.2, 'stroke-dasharray': '7 4' }));
  if(cur >= 1){
    const ev = [[X(0), Y(0)], ...ser.slice(1, cur + 1).map(r => [X(r.w), Y(r.EV || 0)])];
    svg.append(s('polyline', { points: ev.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#10668a', 'stroke-width': 3 }));
    svg.append(s('circle', { cx: X(cur), cy: Y(m.EV), r: 4, fill: '#10668a' }));
    // SV bracket
    if(m.SV !== null && m.SV !== 0){
      const x = X(cur) + 8, y1 = Y(m.PV), y2 = Y(m.EV);
      svg.append(s('path', { d: `M${x - 4} ${y1}H${x}V${y2}H${x - 4}`, fill: 'none', stroke: '#1b2328', 'stroke-width': 1.5 }),
        s('text', { x: x + 4, y: (y1 + y2) / 2 + 4, 'font-size': 12, 'font-weight': 700, fill: m.SV < 0 ? '#b42318' : '#18744a' }, `SV = ${fmtCount(m.SV)}`));
    }
    if(m.Tf !== null && m.EV < BAC){
      const xf = X(Math.min(m.Tf, xMax));
      svg.append(s('line', { x1: X(cur), y1: Y(m.EV), x2: xf, y2: Y(BAC), stroke: '#10668a', 'stroke-width': 2, 'stroke-dasharray': '2 4' }));
      svg.append(s('line', { x1: xf, x2: xf, y1: Tm, y2: Y(0), stroke: '#10668a', 'stroke-dasharray': '2 4' }),
        s('text', { x: xf + 4, y: Tm + 24, 'font-size': 11, fill: '#10668a' }, `Forecast Tf = ${m.Tf.toFixed(1)}${m.Tf > xMax ? ' (off the chart)' : ''}`));
    }
  }
  return h('div', { class: 'chartbox' }, svg);
}

function spiChart(ser, cur){
  const pts = ser.slice(1, cur + 1).filter(r => r.SPI !== null);
  const W = 520, H = 260, L = 44, R = 12, T = 12, B = 34, pw = W - L - R, ph = H - T - B, N = P.weeks;
  const top = Math.max(1.5, ...pts.map(r => r.SPI)) * 1.05;
  const X = w => L + (w - 1) / Math.max(1, N - 1) * pw, Y = v => T + ph - v / top * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'SPI by week. The values are in the measures table.', style: 'max-width:100%;height:auto' });
  for(const v of [0, 0.5, 1, 1.5, 2].filter(v => v <= top)) svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: v === 1 ? '#4f5b62' : '#e3e8eb', 'stroke-dasharray': v === 1 ? '4 3' : null }),
    s('text', { x: L - 6, y: Y(v) + 4, 'font-size': 11, 'text-anchor': 'end', fill: '#4f5b62' }, v.toFixed(1)));
  for(const w of ticks(N, 8)) if(w >= 1 && w <= N) svg.append(s('text', { x: X(w), y: H - B + 16, 'font-size': 11, 'text-anchor': 'middle', fill: '#4f5b62' }, w));
  svg.append(s('text', { x: L + pw / 2, y: H - 4, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'));
  if(pts.length){
    svg.append(s('polyline', { points: pts.map(r => X(r.w) + ',' + Y(r.SPI)).join(' '), fill: 'none', stroke: '#10668a', 'stroke-width': 2.5 }));
    for(const r of pts) svg.append(s('circle', { cx: X(r.w), cy: Y(r.SPI), r: 3, fill: '#10668a' }, s('title', { text: `Week ${r.w}: SPI ${fmtIndex(r.SPI)}` })));
  } else svg.append(s('text', { x: L + pw / 2, y: T + ph / 2, 'font-size': 13, 'text-anchor': 'middle', fill: '#4f5b62' }, 'SPI not yet defined'));
  return svg;
}

/** Start ratio across, finish ratio up, split at 1; the team's dot week by week. */
function quadChart(ser, cur){
  const pts = ser.slice(1, cur + 1).filter(r => r.SR !== null && r.FR !== null);
  const W = 520, H = 300, L = 44, R = 12, T = 12, B = 38, pw = W - L - R, ph = H - T - B;
  const mx = Math.max(2, ...pts.map(r => r.SR)) * 1.02, my = Math.max(2, ...pts.map(r => r.FR)) * 1.02;
  const X = v => L + v / mx * pw, Y = v => T + ph - v / my * ph;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'max-width:100%;height:auto',
    'aria-label': 'Start versus finish quadrant: start ratio across, finish ratio up. The values are in the measures table.' });
  svg.append(s('rect', { x: L, y: T, width: X(1) - L, height: Y(1) - T, fill: '#fff6e5' }), s('rect', { x: X(1), y: Y(1), width: W - R - X(1), height: Y(0) - Y(1), fill: '#fff6e5' }),
    s('rect', { x: X(1), y: T, width: W - R - X(1), height: Y(1) - T, fill: '#e8f4ed' }), s('rect', { x: L, y: Y(1), width: X(1) - L, height: Y(0) - Y(1), fill: '#fdeceb' }),
    s('line', { x1: X(1), x2: X(1), y1: T, y2: Y(0), stroke: '#4f5b62' }), s('line', { x1: L, x2: W - R, y1: Y(1), y2: Y(1), stroke: '#4f5b62' }),
    s('text', { x: W - R - 6, y: T + 16, 'font-size': 13, 'font-weight': 700, 'text-anchor': 'end', fill: '#18744a' }, 'On plan'),
    s('text', { x: L + 6, y: T + 16, 'font-size': 13, 'font-weight': 700, fill: '#8a5700' }, 'Watch'),
    s('text', { x: W - R - 6, y: Y(0) - 8, 'font-size': 13, 'font-weight': 700, 'text-anchor': 'end', fill: '#8a5700' }, 'Watch'),
    s('text', { x: L + 6, y: Y(0) - 8, 'font-size': 13, 'font-weight': 700, fill: '#b42318' }, 'Re-plan'),
    s('text', { x: L + pw / 2, y: H - 4, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Start ratio SR = Sa / Sp'),
    s('text', { x: 12, y: T + ph / 2, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 12 ${T + ph / 2})` }, 'Finish ratio FR = Fa / Fp'));
  for(const v of [0, 0.5, 1, 1.5, 2]){ if(v <= mx) svg.append(s('text', { x: X(v), y: Y(0) + 14, 'font-size': 11, 'text-anchor': 'middle', fill: '#4f5b62' }, v.toFixed(1)));
    if(v <= my) svg.append(s('text', { x: L - 6, y: Y(v) + 4, 'font-size': 11, 'text-anchor': 'end', fill: '#4f5b62' }, v.toFixed(1))); }
  if(pts.length){
    svg.append(s('polyline', { points: pts.map(r => X(r.SR) + ',' + Y(r.FR)).join(' '), fill: 'none', stroke: '#55636b', 'stroke-width': 1.5 }));
    pts.forEach((r, i) => {
      const last = i === pts.length - 1;
      svg.append(s('circle', { cx: X(r.SR), cy: Y(r.FR), r: last ? 7 : 3.5, fill: last ? '#10668a' : '#9aa5ab', stroke: '#fff' }, s('title', { text: `Week ${r.w}: SR ${fmtIndex(r.SR)}, FR ${fmtIndex(r.FR)}, ${r.signal}` })));
      if(last) svg.append(s('text', { x: X(r.SR) + 10, y: Y(r.FR) - 8, 'font-size': 12, 'font-weight': 700, fill: '#1b2328' }, `Week ${r.w}`));
    });
  } else svg.append(s('text', { x: L + pw / 2, y: T + ph / 2 + 30, 'font-size': 13, 'text-anchor': 'middle', fill: '#4f5b62' }, 'SR and FR not yet both defined'));
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
      h('td', null, signalChip(m.signal)))))));
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
        signalChip(m.signal)),
      h('h3', null, 'Headline numbers (tasks)'),
      h('div', { class: 'kpis' }, head.map(([k, v]) => h('div', { class: 'kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' + (v === UNDEF || v === 'plan complete' ? ' u' : '') }, v)))),
      h('p', { class: 'reading' }, statusLine(m)),
      h('h3', null, 'Cumulative earned value'), evChart(ser, cur, 840),
      h('h3', null, 'Late tasks'), lateList(cur, {}),
      h('h3', null, `Tasks started or finished in week ${cur}`),
      moved.length ? h('ul', { class: 'plain' }, moved.map(x => h('li', null, `${IX.num.get(x.e.id)} ${x.e.name} (${x.e.pkg.owner || 'no owner'}): ${STATE_LABEL[x.was].toLowerCase()} → `, stateText(x.t.state))))
        : h('p', { class: 'mut' }, 'None.'),
      h('h3', null, 'Actions'), ta, h('div', { class: 'printonly', style: 'white-space:pre-wrap;border:1px solid #c6cfd4;padding:8px;min-height:4em' }, P.actions || ' '))]);
}
