/* ════════════════════════════════════════════════════════════════════════════════════════════
   gantt.js — Tab 2: the week-based Gantt chart (same rows as the WBS tab), its table view, and baselining.
   Baseline bars are outlined; actual bars are solid; summary bars span their packages in the area colour.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

function zoomRange(){
  const N = P.weeks, half = Math.ceil(N / 2), c = Math.max(1, P.currentWeek);
  if(V.zoom === 'sd1') return [1, half];
  if(V.zoom === 'sd2') return [Math.min(N, half + 1), N];
  if(V.zoom === 'near'){ let a = Math.max(1, c - 3), b = Math.min(N, a + 7); a = Math.max(1, b - 7); return [a, b]; }
  return [1, N];
}

function renderGantt(root){
  const b = activeBaseline(P);
  const tb = h('div', { class: 'toolbar' }, levelSelect(),
    h('label', null, 'Zoom', h('select', { 'data-key': 'zoom', onchange: ev => { V.zoom = ev.target.value; saveView(); render(); } },
      [['all', 'Whole project'], ['sd1', 'Senior Design 1'], ['sd2', 'Senior Design 2'], ['near', '8 weeks around today']].map(([v, t]) => h('option', { value: v, selected: V.zoom === v }, t)))),
    h('span', { class: 'seg', role: 'group', 'aria-label': 'View' },
      h('button', { type: 'button', 'aria-pressed': V.gview === 'chart', 'data-key': 'gv-chart', onclick: () => { V.gview = 'chart'; saveView(); render(); } }, 'Chart'),
      h('button', { type: 'button', 'aria-pressed': V.gview === 'table', 'data-key': 'gv-table', onclick: () => { V.gview = 'table'; saveView(); render(); } }, 'Table')),
    h('button', { type: 'button', class: 'primary', 'data-key': 'g-bl', onclick: doBaseline }, b ? 'Re-baseline…' : 'Baseline the schedule…'),
    h('span', { class: 'mut small' }, b ? `Active: baseline ${b.n} (${b.date}${b.reason ? ', ' + b.reason : ''})` : 'No baseline yet: outlined bars show the current plan.'));
  const rows = visibleRows();
  const preds = checks(P, IX).filter(c => c.kind === 'pred');
  append(root, [tb, V.gview === 'chart' ? ganttChart(rows) : ganttTable(rows),
    preds.length ? h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Predecessor warnings'),
      h('ul', { class: 'plain warnlist' }, preds.map((c, i) => h('li', null, h('button', { type: 'button', 'data-key': 'gw:' + i, onclick: () => goTo(c.id) }, '⚠ ', c.text))))) : null,
    h('p', { class: 'mut small' }, 'Outlined bar: baseline (planned start to planned finish). Solid bar: actual (first marked started to marked finished, or to today if still open). ',
      'Dashed outline: added after the baseline (it counts from its planned weeks). Hatched bar: lead time (no work). Diamond: milestone. Arrows: finish-to-start predecessors. A thin dashed line under a bar shows the current plan where it differs from the baseline.')]);
}

/** Planned weeks of a package as drawn: the active baseline if the package is in it, else the current plan. */
function drawnPlan(e){
  const b = activeBaseline(P), x = b && b.plan[e.id];
  return x ? { s: x.s, f: x.f, base: true } : { s: e.pkg.start, f: e.pkg.finish, base: false };
}

function ganttChart(rows){
  const [w0, w1] = zoomRange(), nW = w1 - w0 + 1;
  const LW = 430, rowH = 28, headH = 46, cw = Math.max(22, Math.min(64, Math.floor(1080 / nW)));
  const W = LW + nW * cw + 10, H = headH + rows.length * rowH + 6;
  const X = w => LW + (w - w0) * cw;               // left edge of week w
  const half = Math.ceil(P.weeks / 2), cur = P.currentWeek;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Gantt chart, weeks ${w0} to ${w1}. The same rows are in the Table view.` });
  const defs = s('defs', null,
    s('clipPath', { id: 'gclip' }, s('rect', { x: LW, y: 0, width: nW * cw, height: H })),
    s('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#7b878d', 'stroke-width': 2 })),
    s('marker', { id: 'arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0 0L8 4L0 8z', fill: '#4f5b62' })));
  svg.append(defs);
  // semester bands and week numbers
  for(const [a, bnd, t] of [[1, half, 'Senior Design 1'], [half + 1, P.weeks, 'Senior Design 2']]){
    const a2 = Math.max(a, w0), b2 = Math.min(bnd, w1); if(a2 > b2) continue;
    svg.append(s('rect', { x: X(a2), y: 2, width: (b2 - a2 + 1) * cw, height: 20, fill: t.endsWith('1') ? '#e3edf2' : '#ece7f7', stroke: '#fff' }),
      s('text', { x: X(a2) + 6, y: 16, 'font-size': 12, 'font-weight': 600, fill: '#1b2328' }, t));
  }
  for(let w = w0; w <= w1; w++){
    svg.append(s('text', { x: X(w) + cw / 2, y: 38, 'font-size': 11, 'text-anchor': 'middle', fill: w === cur ? '#b42318' : '#4f5b62', 'font-weight': w === cur ? 700 : 400 }, w));
    svg.append(s('line', { x1: X(w), y1: headH - 4, x2: X(w), y2: H, stroke: w === half + 1 ? '#9aa5ab' : '#e3e8eb' }));
  }
  svg.append(s('text', { x: 6, y: 38, 'font-size': 12, 'font-weight': 600, fill: '#4f5b62' }, 'WBS  Name'), s('text', { x: LW - 8, y: 38, 'font-size': 12, 'text-anchor': 'end', 'font-weight': 600, fill: '#4f5b62' }, 'Flag'));
  const yOf = new Map(), body = s('g', { 'clip-path': 'url(#gclip)' });
  rows.forEach((r, i) => {
    const e = r.e, id = e.id, y = headH + i * rowH, a = IX.area.get(id), col = a ? areaColor(a) : '#1b2328';
    yOf.set(id, y);
    const g = s('g', { class: 'gantt-row' }, s('rect', { class: 'hov', x: 0, y, width: W, height: rowH, fill: i % 2 ? '#fafbfc' : '#fff' }));
    svg.append(g);
    const nm = (IX.num.get(id) ? IX.num.get(id) + '  ' : '') + e.name;
    g.append(s('text', { x: 6 + Math.max(0, r.lev - 1) * 10, y: y + 18, 'font-size': 13, 'font-weight': r.lev <= 2 ? 700 : r.lev === 3 ? 600 : 400, fill: '#1b2328' }, clip(nm, 330 - (r.lev - 1) * 10)),
      s('title', { text: nm }));
    if(isPkg(e)){
      const lf = lateFlags(P, e, SX, cur);
      const flag = lf.lateStart && lf.lateFinish ? 'Late start & finish' : lf.lateStart ? 'Late start' : lf.lateFinish ? 'Late finish' : '';
      if(flag) g.append(s('text', { x: LW - 8, y: y + 18, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'end', fill: '#b42318' }, flag));
      const k = e.pkg, pl = drawnPlan(e), t = trackAt(SX.get(id), cur);
      if(k.type === 'milestone'){
        const cx = X(pl.s) + cw / 2, cy = y + rowH / 2;
        body.append(s('path', { d: `M${cx} ${cy - 9}L${cx + 9} ${cy}L${cx} ${cy + 9}L${cx - 9} ${cy}z`, fill: t.state === 'finished' ? col : '#fff', stroke: col, 'stroke-width': 2 }),
          s('text', { x: cx + 13, y: cy + 4, 'font-size': 11, fill: '#1b2328' }, e.name));
      } else {
        body.append(s('rect', { x: X(pl.s) + 1, y: y + 4, width: (pl.f - pl.s + 1) * cw - 2, height: 9, rx: 2,
          fill: k.type === 'lead' ? 'url(#hatch)' : '#fff', stroke: col, 'stroke-width': 1.6, 'stroke-dasharray': pl.base ? null : '4 2' }));
        if(pl.base && (k.start !== pl.s || k.finish !== pl.f))
          body.append(s('line', { x1: X(k.start) + 1, y1: y + rowH - 2, x2: X(k.finish + 1) - 1, y2: y + rowH - 2, stroke: col, 'stroke-dasharray': '3 2' }));
        if(t.start !== null){
          const end = t.finish !== null ? t.finish : Math.max(t.start, cur);
          body.append(s('rect', { x: X(t.start) + 1, y: y + 15, width: (end - t.start + 1) * cw - 2, height: 9, rx: 2, fill: col, opacity: k.type === 'lead' ? 0.6 : 1 }));
          if(t.finish === null) body.append(s('text', { x: X(end + 1) + 3, y: y + 23, 'font-size': 10, fill: '#4f5b62' }, 'open'));
        }
      }
    } else {
      const ru = rollup(id);
      if(ru.start !== null){
        const x1 = X(ru.start), x2 = X(ru.finish + 1);
        body.append(s('path', { d: `M${x1} ${y + 8}H${x2}V${y + 20}L${x2 - 5} ${y + 14}H${x1 + 5}L${x1} ${y + 20}z`, fill: col }));
      }
    }
  });
  svg.append(body);
  // predecessor arrows between visible packages
  const arrows = s('g', { 'clip-path': 'url(#gclip)', fill: 'none', stroke: '#4f5b62', 'stroke-width': 1.2 });
  for(const r of rows){
    if(!isPkg(r.e)) continue;
    for(const q of r.e.pkg.preds){
      if(!yOf.has(q)) continue;
      const pe = IX.byId.get(q), pa = drawnPlan(pe), pb = drawnPlan(r.e);
      const xa = pe.pkg.type === 'milestone' ? X(pa.s) + cw / 2 + 9 : X(pa.f + 1) - 1, ya = yOf.get(q) + 9;
      const xb = r.e.pkg.type === 'milestone' ? X(pb.s) + cw / 2 - 9 : X(pb.s) + 1, yb = yOf.get(r.e.id) + 9;
      const mid = Math.max(xa + 6, Math.min(xb - 6, xa + 6));
      arrows.append(s('path', { d: `M${xa} ${ya}H${mid}V${yb}H${xb}`, 'marker-end': 'url(#arrow)', stroke: xb <= xa ? '#b42318' : '#4f5b62' }));
    }
  }
  svg.append(arrows);
  // today line at the end of the current week
  if(cur >= w0 - 1 && cur <= w1){
    const xt = X(cur + 1);
    svg.append(s('line', { x1: xt, y1: 24, x2: xt, y2: H, stroke: '#b42318', 'stroke-width': 2 }),
      s('text', { x: xt - 3, y: H - 4, 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end', fill: '#b42318' }, `Today: end of week ${cur}`));
  }
  return h('div', { class: 'chartbox' }, svg);
}

function ganttTable(rows){
  const tb = h('tbody');
  for(const r of rows){
    const e = r.e, id = e.id;
    let cells;
    if(isPkg(e)){
      const k = e.pkg, pl = drawnPlan(e), t = trackAt(SX.get(id), P.currentWeek), lf = lateFlags(P, e, SX, P.currentWeek);
      cells = [TYPE_LABEL[k.type], k.owner, pl.s, pl.f, pl.base ? 'baseline' : 'plan', t.start ?? '—', t.finish ?? (t.start !== null ? 'open' : '—'),
        h('span', { class: 'late' }, [lf.lateStart ? 'Late start' : '', lf.lateFinish ? 'Late finish' : ''].filter(Boolean).join(', '))];
    } else {
      const ru = rollup(id);
      cells = ['Summary', ru.owners ? ru.owners + ' owners' : '', ru.start ?? '—', ru.finish ?? '—', 'span', '', '', `${ru.fin} of ${ru.tasks} finished`];
    }
    tb.append(h('tr', { class: 'lev' + r.lev }, h('td', { class: 'wnum' }, IX.num.get(id) || ''), h('td', null, h('span', { style: `padding-left:${(r.lev - 1) * 14}px` }, e.name)),
      cells.map((c, i) => h('td', { class: i >= 2 && i <= 6 && i !== 4 ? 'n' : null }, c))));
  }
  return h('div', { class: 'tablewrap', style: 'max-height:none' }, h('table', { class: 'grid', 'aria-label': 'Schedule table' },
    h('thead', null, h('tr', null, ['WBS', 'Name', 'Type', 'Owner', 'Planned start', 'Planned finish', 'From', 'Actual start', 'Actual finish', `Late at week ${P.currentWeek}`]
      .map((t, i) => h('th', { class: i >= 4 && i <= 8 && i !== 6 ? 'n' : null }, t)))), tb));
}
