/* ════════════════════════════════════════════════════════════════════════════════════════════
   status.js — Tab 3: the task status bar chart (Sp, Sa, Fp, Fa by week, per week or cumulative, filtered by area
   and owner) with its table and one-line reading; Tab 4: This week (set each task's status, then read the numbers).
   ════════════════════════════════════════════════════════════════════════════════════════════ */

function noBaselineNote(){
  return h('div', { class: 'note' }, 'No baseline yet. Planned counts and PV come from the baseline: ',
    h('button', { type: 'button', class: 'primary', 'data-key': 'nb-bl', onclick: doBaseline }, 'Baseline the schedule…'));
}

function renderStatus(root){
  const filter = { area: V.farea, owner: V.fowner }, ser = series(P, IX, SX, filter), cur = P.currentWeek;
  const tb = h('div', { class: 'toolbar' },
    h('span', { class: 'seg', role: 'group', 'aria-label': 'Counts' },
      h('button', { type: 'button', 'aria-pressed': V.mode === 'week', 'data-key': 'm-week', onclick: () => { V.mode = 'week'; saveView(); render(); } }, 'Per week'),
      h('button', { type: 'button', 'aria-pressed': V.mode === 'cum', 'data-key': 'm-cum', onclick: () => { V.mode = 'cum'; saveView(); render(); } }, 'Cumulative')),
    zoomSelect(),
    h('label', null, 'Major area', h('select', { 'data-key': 'f-area', onchange: ev => { V.farea = Number(ev.target.value); render(); } }, areaOptions(V.farea))),
    h('label', null, 'Owner', h('select', { 'data-key': 'f-owner', onchange: ev => { V.fowner = ev.target.value; render(); } }, ownerOptions(V.fowner))));
  const m = ser[Math.min(cur, P.weeks)];
  append(root, [activeBaseline(P) ? null : noBaselineNote(), tb,
    h('p', { class: 'reading', 'aria-live': 'polite' }, statusLine(m)),
    statusChart(ser, cur, V.mode === 'cum'),
    h('div', { class: 'legend', style: 'margin:6px 0 12px' },
      legendKey('outline', 'var(--start)', 'Planned to start (Sp)'), legendKey('solid', 'var(--start)', 'Actually started (Sa)'),
      legendKey('outline', 'var(--finish)', 'Planned to finish (Fp)'), legendKey('solid', 'var(--finish)', 'Actually finished (Fa)'),
      h('span', { class: 'mut' }, `Weeks after week ${cur} show planned bars only. Milestones and lead-time items are not tasks and are not counted.`)),
    statusTable(ser, cur, V.mode === 'cum')]);
}

function legendKey(kind, col, text){
  return h('span', null, h('span', { class: 'swatch', style: kind === 'solid' ? `background:${col}` : `border:2px solid ${col};background:#fff;width:12px;height:12px`, 'aria-hidden': 'true' }), text);
}

/** Grouped bars: for each week, planned start (outlined blue), actual start (solid blue), planned finish (outlined green),
    actual finish (solid green). */
function statusChart(ser, cur, cum, width){
  const [a, b] = chartRange('status', ser[cur]), nW = b - a + 1, val = (m, k) => cum ? m[k] : m.wk[k];
  let max = 1;
  for(let w = a; w <= b; w++) for(const k of ['Sp', 'Fp', 'Sa', 'Fa']) if(k[1] === 'p' || w <= cur) max = Math.max(max, val(ser[w], k));
  const tk = ticks(max, 5), top = tk[tk.length - 1];
  const L = 52, R = 12, T = 14, B = 50, gw = Math.max(26, Math.min(96, Math.floor(((width || 1390) - L - R) / nW)));
  const W = L + R + nW * gw, H = 340, ph = H - T - B, Y = v => T + ph - v / top * ph, bw = (gw - 8) / 4;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'max-width:100%;height:auto', 'aria-label': `Task status bar chart, ${cum ? 'cumulative' : 'per week'}, weeks ${a} to ${b}. The values are in the table below.` });
  for(const v of tk){ svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#e3e8eb' }), s('text', { x: L - 8, y: Y(v) + 5, 'font-size': 13, 'text-anchor': 'end', fill: '#4f5b62' }, v)); }
  const series4 = [['Sp', '#10668a', false], ['Sa', '#10668a', true], ['Fp', '#18744a', false], ['Fa', '#18744a', true]];
  for(let w = a; w <= b; w++){
    const x0 = L + (w - a) * gw + 4;
    series4.forEach(([k, col, solid], j) => {
      if(solid && w > cur) return;
      const v = val(ser[w], k); if(!v) return;
      const y = Y(Math.max(0, v)), hgt = Math.abs(Y(0) - Y(v));
      svg.append(s('rect', { x: x0 + j * bw + 0.75, y: v >= 0 ? y : Y(0), width: bw - 1.5, height: Math.max(1, hgt), fill: solid ? col : '#fff', stroke: col, 'stroke-width': solid ? 0 : 1.8 },
        s('title', { text: `Week ${w}: ${{ Sp: 'planned to start', Sa: 'started', Fp: 'planned to finish', Fa: 'finished' }[k]} ${v}` })));
    });
    svg.append(s('text', { x: x0 + (gw - 8) / 2, y: H - B + 20, 'font-size': 13, 'text-anchor': 'middle', fill: w === cur ? '#b42318' : '#4f5b62', 'font-weight': w === cur ? 700 : 400 }, w));
  }
  svg.append(s('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), stroke: '#4f5b62' }),
    s('text', { x: L + (W - L - R) / 2, y: H - 8, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'),
    s('text', { x: 16, y: T + ph / 2, 'font-size': 14, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 16 ${T + ph / 2})` }, cum ? 'Tasks (cumulative)' : 'Tasks per week'));
  if(cur >= a && cur < b){ const x = L + (cur - a + 1) * gw; svg.append(s('line', { x1: x, x2: x, y1: T, y2: Y(0), stroke: '#b42318', 'stroke-dasharray': '5 3', 'stroke-width': 1.5 }),
    halo({ x: x + 6, y: T + 16, 'font-size': 14, 'font-weight': 700, fill: '#b42318' }, `Week ${cur}`)); }
  return h('div', { class: 'chartbox' }, svg);
}

/** The counts by week: weeks 1 to the current week plus 4 by default, or all weeks (change briefing C6). */
function statusTable(ser, cur, cum){
  const v = (m, k) => cum ? m[k] : m.wk[k], last = V.allWeeks ? P.weeks : Math.min(P.weeks, Math.max(1, cur) + 4);
  return h('div', null,
    h('div', { class: 'toolbar', style: 'margin:0 0 6px' }, h('label', null, h('input', { type: 'checkbox', checked: V.allWeeks, 'data-key': 'allweeks',
      onchange: ev => { V.allWeeks = ev.target.checked; render(); } }), 'Show all weeks'),
      h('span', { class: 'mut small' }, V.allWeeks ? `Weeks 1–${P.weeks}.` : `Weeks 1–${last} (the current week plus 4).`)),
    h('div', { class: 'tablewrap' }, h('table', { class: 'grid', 'aria-label': 'Task status counts by week' },
    h('thead', null, h('tr', null, h('th', null, 'Week'), h('th', { class: 'n' }, 'Planned to start'), h('th', { class: 'n' }, 'Actually started'),
      h('th', { class: 'n' }, 'Planned to finish'), h('th', { class: 'n' }, 'Actually finished'))),
    h('tbody', null, ser.slice(1, last + 1).map(m => h('tr', { class: m.w === cur ? 'sel' : null }, h('td', null, m.w === cur ? `${m.w} (current)` : m.w),
      h('td', { class: 'n' }, v(m, 'Sp')), h('td', { class: 'n' }, m.w <= cur ? v(m, 'Sa') : ''),
      h('td', { class: 'n' }, v(m, 'Fp')), h('td', { class: 'n' }, m.w <= cur ? v(m, 'Fa') : '')))))));
}

/* ── TAB 4: THIS WEEK ── */
function renderWeek(root){
  const w = P.currentWeek;
  const pk = IX.order.filter(isPkg);
  const active = e => {
    const pl = drawnPlan(e), t = trackAt(SX.get(e.id), w);
    return (pl.s <= w && w <= pl.f) || t.state === 'started' || (t.state === 'not' && pl.s <= w);
  };
  const list = V.showAll ? pk : pk.filter(active);
  const ser = series(P, IX, SX), m = ser[Math.min(w, P.weeks)];
  const step1 = h('div', { class: 'card' }, h('h2', null, `1. Mark each open task at week ${w}`),
    h('div', { class: 'toolbar' }, h('label', null, h('input', { type: 'checkbox', checked: V.showAll, 'data-key': 'showall', onchange: ev => { V.showAll = ev.target.checked; saveView(); render(); } }), 'Show all packages'),
      h('span', { class: 'mut small' }, V.showAll ? `${list.length} packages.` : `${list.length} of ${pk.length} packages: active in the plan this week, or still open.`)),
    w < 1 ? h('p', { class: 'note' }, 'The current week is 0. Set it to week 1 or later (top bar) to record status.') :
    list.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'grid', 'aria-label': 'Status this week' },
      h('thead', null, h('tr', null, h('th', null, 'WBS'), h('th', null, 'Task'), h('th', null, 'Owner'), h('th', null, 'Planned'), h('th', null, `Status at week ${w}`), h('th', null, 'Flag'))),
      h('tbody', null, list.map(e => {
        const pl = drawnPlan(e), t = trackAt(SX.get(e.id), w), lf = lateFlags(P, e, SX, w);
        return h('tr', null, h('td', { class: 'wnum' }, areaSwatch(IX.area.get(e.id)), IX.num.get(e.id)),
          h('td', null, e.name, e.pkg.type !== 'task' ? h('span', { class: 'tag', style: 'margin-left:6px' }, TYPE_LABEL[e.pkg.type]) : null),
          h('td', null, e.pkg.owner || '—'), h('td', { class: 'num' }, weekRange(pl.s, pl.f)), h('td', null, statusRadios(e.id, t.state)),
          h('td', { class: 'late' }, [lf.lateStart ? 'Late start' : '', lf.lateFinish ? 'Late finish' : ''].filter(Boolean).join(', ')));
      })))) : h('p', { class: 'mut' }, 'No packages are active or open this week.'));
  const step2 = h('div', { class: 'card' }, h('h2', null, '2. Read the numbers'),
    activeBaseline(P) ? null : noBaselineNote(),
    h('p', { class: 'reading' }, statusLine(m), ' ', signalChip(m)),
    weekNumbers(m));
  append(root, [step1, step2]);
}

/** This week's numbers (change briefing C7): a headline row of four large cards, each with a reading in words, then
    smaller cards for the counts and for value and variance. Each formula is in a tooltip shown on hover or focus. */
function weekNumbers(m){
  const rd = readings(m), mr = Object.fromEntries(measureRows(m).map(r => [r[0], r]));
  const u = v => v === UNDEF || v === 'plan complete' || v === 'Signal not yet defined' || v === 'Planning (week 0)';
  let tipN = 0;
  const card = (big, key, value, reading, formula, extra) => {
    const id = 'tip-' + (++tipN);
    return h('div', { class: 'kpi' + (big ? ' big' : ''), tabindex: formula ? 0 : null, 'aria-describedby': formula ? id : null, 'data-key': 'kpi:' + key },
      h('div', { class: 'k' }, key), h('div', { class: 'v' + (u(value) ? ' u' : '') + (extra || '') }, value),
      reading ? h('div', { class: 'r' }, reading) : null,
      formula ? h('div', { class: 'f', role: 'tooltip', id }, formula) : null);
  };
  const sig = signalText(m);
  const head = h('div', { class: 'kpis headline' },
    card(true, 'Signal', sig, rd.signal, 'From the start ratio SR and the finish ratio FR: both ≥ 1 On plan; one below 1 Watch; both below 1 Re-plan.', ' sig-' + signalClass(m.signal)),
    card(true, 'SPI', mr.SPI[2], rd.spi, 'Schedule performance index = EV / PV'),
    card(true, 'SR and FR', m.SR === null && m.FR === null ? UNDEF : `${fmtIndex(m.SR)} / ${fmtIndex(m.FR)}`, rd.ratios, 'Start ratio SR = Sa / Sp; finish ratio FR = Fa / Fp'),
    card(true, 'Forecast finish', m.Tf === null ? UNDEF : `Week ${m.Tf.toFixed(1)}`, (m.T ? `Plan: week ${m.T}. ` : '') + rd.forecast, 'Forecast duration Tf = T / SPI, where T is the planned finish week'));
  const counts = [['Sp', 'Planned to start', m.Sp], ['Sa', 'Actually started', m.Sa], ['Fp', 'Planned to finish', m.Fp], ['Fa', 'Actually finished', m.Fa], ['BAC', 'Tasks in the WBS', m.BAC]]
    .map(([k, d, v]) => card(false, k, String(v ?? 0), d, null));
  const vals = ['PV', 'EV', 'SV', 'SV%', '% complete', 'To go', 'TSPI'].map(k => card(false, k, mr[k][2], mr[k][1], `${mr[k][1]} = ${mr[k][3]}`));
  return h('div', null, head,
    h('h3', null, 'Counts'), h('div', { class: 'kpis small' }, counts),
    h('h3', null, 'Value and variance'), h('div', { class: 'kpis small' }, vals),
    h('p', { class: 'mut small' }, 'Hover over a card, or move to it with Tab, to see its formula. All the formulas are in Help.'));
}
