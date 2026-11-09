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
  const N = P.weeks, val = (m, k) => cum ? m[k] : m.wk[k];
  let max = 1;
  for(let w = 1; w <= N; w++) for(const k of ['Sp', 'Fp', 'Sa', 'Fa']) if(k[1] === 'p' || w <= cur) max = Math.max(max, val(ser[w], k));
  const tk = ticks(max, 5), top = tk[tk.length - 1];
  const L = 44, R = 10, T = 12, B = 34, gw = Math.max(26, Math.min(48, Math.floor(((width || 1150) - L - R) / N)));
  const W = L + R + N * gw, H = 300, ph = H - T - B, Y = v => T + ph - v / top * ph, bw = (gw - 6) / 4;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Task status bar chart, ${cum ? 'cumulative' : 'per week'}. The values are in the table below.` });
  for(const v of tk){ svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#e3e8eb' }), s('text', { x: L - 6, y: Y(v) + 4, 'font-size': 11, 'text-anchor': 'end', fill: '#4f5b62' }, v)); }
  const series4 = [['Sp', '#10668a', false], ['Sa', '#10668a', true], ['Fp', '#18744a', false], ['Fa', '#18744a', true]];
  for(let w = 1; w <= N; w++){
    const x0 = L + (w - 1) * gw + 3;
    series4.forEach(([k, col, solid], j) => {
      if(solid && w > cur) return;
      const v = val(ser[w], k); if(!v) return;
      const y = Y(Math.max(0, v)), hgt = Math.abs(Y(0) - Y(v));
      svg.append(s('rect', { x: x0 + j * bw + 0.5, y: v >= 0 ? y : Y(0), width: bw - 1, height: Math.max(1, hgt), fill: solid ? col : '#fff', stroke: col, 'stroke-width': solid ? 0 : 1.5 },
        s('title', { text: `Week ${w}: ${{ Sp: 'planned to start', Sa: 'started', Fp: 'planned to finish', Fa: 'finished' }[k]} ${v}` })));
    });
    svg.append(s('text', { x: x0 + (gw - 6) / 2, y: H - B + 16, 'font-size': 11, 'text-anchor': 'middle', fill: w === cur ? '#b42318' : '#4f5b62', 'font-weight': w === cur ? 700 : 400 }, w));
  }
  svg.append(s('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), stroke: '#4f5b62' }),
    s('text', { x: L + (W - L - R) / 2, y: H - 4, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62' }, 'Week'),
    s('text', { x: 12, y: T + ph / 2, 'font-size': 12, 'text-anchor': 'middle', fill: '#4f5b62', transform: `rotate(-90 12 ${T + ph / 2})` }, cum ? 'Tasks (cumulative)' : 'Tasks per week'));
  if(cur >= 1 && cur < N){ const x = L + cur * gw; svg.append(s('line', { x1: x, x2: x, y1: T, y2: Y(0), stroke: '#b42318', 'stroke-dasharray': '4 3' })); }
  return h('div', { class: 'chartbox' }, svg);
}

function statusTable(ser, cur, cum){
  const v = (m, k) => cum ? m[k] : m.wk[k];
  return h('div', { class: 'tablewrap' }, h('table', { class: 'grid', 'aria-label': 'Task status counts by week' },
    h('thead', null, h('tr', null, h('th', null, 'Week'), h('th', { class: 'n' }, 'Planned to start'), h('th', { class: 'n' }, 'Actually started'),
      h('th', { class: 'n' }, 'Planned to finish'), h('th', { class: 'n' }, 'Actually finished'))),
    h('tbody', null, ser.slice(1).map(m => h('tr', { class: m.w === cur ? 'sel' : null }, h('td', null, m.w === cur ? `${m.w} (current)` : m.w),
      h('td', { class: 'n' }, v(m, 'Sp')), h('td', { class: 'n' }, m.w <= cur ? v(m, 'Sa') : ''),
      h('td', { class: 'n' }, v(m, 'Fp')), h('td', { class: 'n' }, m.w <= cur ? v(m, 'Fa') : ''))))));
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
    kpiGrid(m));
  append(root, [step1, step2]);
}

/** The four counts and every measure as tiles; undefined values say "not yet defined" in words. */
function kpiGrid(m, only){
  const tiles = [['Sp', 'Planned to start', m.Sp], ['Sa', 'Actually started', m.Sa], ['Fp', 'Planned to finish', m.Fp], ['Fa', 'Actually finished', m.Fa], ['BAC', 'Tasks in baseline', m.BAC]]
    .map(([k, d, v]) => [k, String(v ?? 0), d]);
  const rows = measureRows(m).map(r => [r[0], r[2], r[1] + ' = ' + r[3]]);
  const all = [...tiles, ...rows].filter(t => !only || only.includes(t[0]));
  return h('div', { class: 'kpis' }, all.map(([k, v, d]) => h('div', { class: 'kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' + (v === UNDEF || v === 'plan complete' ? ' u' : '') }, v), h('div', { class: 'd' }, d))));
}
