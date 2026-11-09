/* ════════════════════════════════════════════════════════════════════════════════════════════
   wbs.js — Tab 1: the WBS tree (or org-chart diagram) with the Show to level control, the side-panel editor,
   tasks by major area and by student, and the rule-check warnings.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

function renderWbs(root){
  const rows = visibleRows();
  const tb = h('div', { class: 'toolbar' }, levelSelect(),
    h('span', { class: 'seg', role: 'group', 'aria-label': 'Layout' },
      h('button', { type: 'button', 'aria-pressed': V.layout === 'tree', 'data-key': 'lay-tree', onclick: () => { V.layout = 'tree'; saveView(); render(); } }, 'Tree'),
      h('button', { type: 'button', 'aria-pressed': V.layout === 'diagram', 'data-key': 'lay-diag', onclick: () => { V.layout = 'diagram'; saveView(); render(); } }, 'Diagram')),
    h('span', { class: 'mut small' }, `${rows.length} rows shown. Select a row to edit it in the panel.`));
  const main = h('div', null, V.layout === 'tree' ? wbsTable(rows) : wbsDiagram(rows), summaryCard(), warningsCard());
  append(root, [tb, h('div', { class: 'wbs-grid' }, main, editorPanel())]);
}

/* ── TREE ── */
function wbsTable(rows){
  const tbody = h('tbody', { onkeydown: treeKeys });
  for(const r of rows){
    const e = r.e, id = e.id, ru = rollup(id), sel = V.sel === id;
    let owner, weeks, tasks, status;
    if(isPkg(e)){
      const k = e.pkg, t = trackAt(SX.get(id), P.currentWeek), lf = lateFlags(P, e, SX, P.currentWeek);
      owner = k.owner || h('span', { class: 'late' }, 'no owner');
      weeks = k.type === 'milestone' ? 'wk ' + k.start : `${weekRange(k.start, k.finish)} (${k.finish - k.start + 1})`;
      tasks = k.type === 'task' ? '1' : h('span', { class: 'tag' }, TYPE_LABEL[k.type]);
      status = [stateText(t.state), lf.lateStart ? h('span', { class: 'late' }, ' · Late start') : null, lf.lateFinish ? h('span', { class: 'late' }, ' · Late finish') : null];
    } else {
      owner = ru.owners ? `${ru.owners} owner${ru.owners > 1 ? 's' : ''}` : '—';
      weeks = weekRange(ru.start, ru.finish);
      tasks = String(ru.tasks);
      status = ru.tasks ? `${ru.fin} of ${ru.tasks} finished` : h('span', { class: 'mut' }, 'no tasks');
    }
    const area = IX.area.get(id);
    const tw = r.hasKids ? h('button', { type: 'button', class: 'tw', tabindex: -1, 'aria-label': r.open ? 'Collapse' : 'Expand',
      onclick: ev => { ev.stopPropagation(); V.open[id] = !r.open; render(); } }, r.open ? '▼' : '▶') : h('span', { class: 'tw' });
    const name = h('button', { type: 'button', class: 'namebtn', 'data-key': 'row:' + id, 'data-id': id, tabindex: sel ? 0 : -1,
      'aria-expanded': r.hasKids ? String(r.open) : null, 'aria-level': r.lev, onclick: () => { V.sel = id; render(); } }, e.name);
    tbody.append(h('tr', { class: `lev${r.lev}${sel ? ' sel' : ''}`, 'aria-selected': sel ? 'true' : null },
      h('td', { class: 'wnum' }, area ? areaSwatch(area) : null, IX.num.get(id) || ''),
      h('td', null, h('div', { class: 'tree-name', style: `padding-left:${(r.lev - 1) * 18}px` }, tw, name)),
      h('td', null, owner), h('td', { class: 'num' }, weeks), h('td', { class: 'n' }, tasks), h('td', null, status)));
  }
  if(!rows.some(r => V.sel === r.e.id)){ const f = tbody.querySelector('.namebtn'); if(f) f.tabIndex = 0; }
  return h('div', { class: 'tablewrap', style: 'max-height:none' }, h('table', { class: 'grid', 'aria-label': 'Work breakdown structure' },
    h('thead', null, h('tr', null, h('th', null, 'WBS'), h('th', null, 'Name'), h('th', null, 'Owner'), h('th', null, 'Planned weeks'), h('th', { class: 'n' }, 'Tasks'), h('th', null, `Status at week ${P.currentWeek}`))),
    tbody));
}

/** Keyboard in the tree: ↑/↓ move, → opens (or goes to the first child), ← closes (or goes to the parent), Home/End. */
function treeKeys(ev){
  const btns = [...ev.currentTarget.querySelectorAll('.namebtn')], i = btns.indexOf(document.activeElement);
  if(i < 0) return;
  const id = btns[i].dataset.id, e = IX.byId.get(id);
  const focus = j => { if(j >= 0 && j < btns.length){ btns.forEach(b => { b.tabIndex = -1; }); btns[j].tabIndex = 0; btns[j].focus(); } };
  if(ev.key === 'ArrowDown') focus(i + 1);
  else if(ev.key === 'ArrowUp') focus(i - 1);
  else if(ev.key === 'Home') focus(0);
  else if(ev.key === 'End') focus(btns.length - 1);
  else if(ev.key === 'ArrowRight'){ if(IX.kids.get(id).length && !isOpen(e)){ V.open[id] = true; V.sel = id; render(); } else focus(i + 1); }
  else if(ev.key === 'ArrowLeft'){
    if(IX.kids.get(id).length && isOpen(e)){ V.open[id] = false; V.sel = id; render(); }
    else if(e.parent){ V.sel = e.parent; render(); const b = document.querySelector(`[data-key="row:${CSS.escape(e.parent)}"]`); if(b) b.focus(); }
  } else return;
  ev.preventDefault();
}

/* ── DIAGRAM: the same rows as an org chart, like the lecture's WBS slide ── */
function wbsDiagram(rows){
  const shown = new Set(rows.map(r => r.e.id));
  const areas = (IX.kids.get('root') || []).filter(a => shown.has(a.id));
  const colW = 230, boxW = 210, boxH = 44, gapY = 12, top = 16;
  const W = Math.max(boxW + 40, areas.length * colW + 20);
  const items = [];
  const rootX = W / 2 - boxW / 2;
  items.push({ e: IX.root, x: rootX, y: top });
  let maxY = top + boxH;
  const y2 = top + boxH + 40;
  areas.forEach((a, i) => {
    const x = 10 + i * colW + (colW - boxW) / 2;
    items.push({ e: a, x, y: y2, parentXY: [W / 2, top + boxH], elbow: true });
    let y = y2 + boxH + gapY;
    for(const d of rows.filter(r => r.lev > 2 && IX.area.get(r.e.id) === i + 1)){
      const ind = Math.min(3, d.lev - 3) * 14;
      items.push({ e: d.e, x: x + 10 + ind, y, w: boxW - 10 - ind, spine: x + 4 + ind });
      y += boxH + gapY;
    }
    maxY = Math.max(maxY, y);
  });
  const svg = s('svg', { width: W, height: maxY + 10, viewBox: `0 0 ${W} ${maxY + 10}`, role: 'img', 'aria-label': 'WBS diagram' });
  // connectors
  if(areas.length){
    const midY = top + boxH + 20;
    svg.append(s('line', { x1: W / 2, y1: top + boxH, x2: W / 2, y2: midY, stroke: '#7b878d' }));
    const xs = items.filter(t => t.elbow).map(t => t.x + boxW / 2);
    svg.append(s('line', { x1: Math.min(...xs), y1: midY, x2: Math.max(...xs), y2: midY, stroke: '#7b878d' }));
    for(const x of xs) svg.append(s('line', { x1: x, y1: midY, x2: x, y2: y2, stroke: '#7b878d' }));
  }
  for(const t of items.filter(t => t.spine !== undefined))
    svg.append(s('path', { d: `M${t.spine} ${t.y - gapY - boxH / 2}V${t.y + boxH / 2}H${t.x}`, fill: 'none', stroke: '#9aa5ab' }));
  for(const t of items){
    const e = t.e, id = e.id, a = IX.area.get(id), col = a ? areaColor(a) : '#1b2328', w = t.w || boxW, ru = rollup(id);
    const sel = V.sel === id, lev = IX.level.get(id);
    const nm = (IX.num.get(id) ? IX.num.get(id) + ' ' : '') + e.name;
    const sub = isPkg(e) ? (e.pkg.type === 'task' ? (e.pkg.owner || 'no owner') + ' · ' + weekRange(e.pkg.start, e.pkg.finish) : TYPE_LABEL[e.pkg.type] + ' · ' + weekRange(e.pkg.start, e.pkg.finish))
      : `${ru.fin} of ${ru.tasks} finished`;
    const g = s('g', { tabindex: 0, role: 'button', 'aria-label': nm + ', ' + sub, 'data-key': 'box:' + id, style: 'cursor:pointer',
      onclick: () => { V.sel = id; render(); }, onkeydown: ev => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); V.sel = id; render(); } } },
      s('title', { text: nm }),
      s('rect', { x: t.x, y: t.y, width: w, height: boxH, rx: 5, fill: lev <= 2 ? col : '#fff', stroke: col, 'stroke-width': sel ? 3.5 : 1.5 }),
      s('text', { x: t.x + 8, y: t.y + 18, 'font-size': 13, 'font-weight': 600, fill: lev <= 2 ? '#fff' : '#1b2328' }, clip(nm, w)),
      s('text', { x: t.x + 8, y: t.y + 35, 'font-size': 13, fill: lev <= 2 ? '#fff' : '#4f5b62' }, clip(sub, w)));
    svg.append(g);
  }
  return h('div', { class: 'chartbox' }, svg);
}
function clip(t, w){ const n = Math.floor((w - 14) / 7); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

/* ── SUMMARY: tasks by major area and by student ── */
function summaryCard(){
  const areas = IX.kids.get('root') || [], byArea = areas.map(a => rollup(a.id).tasks), total = byArea.reduce((x, y) => x + y, 0);
  const bar = h('div', { class: 'bars', role: 'img', 'aria-label': 'Tasks by major area: ' + areas.map((a, i) => `${IX.num.get(a.id)} ${a.name} ${byArea[i]}`).join(', ') },
    areas.map((a, i) => byArea[i] ? h('span', { style: `width:${byArea[i] / total * 100}%;background:${areaColor(i + 1)}` }) : null));
  const legend = h('div', { class: 'legend' }, areas.map((a, i) => h('span', null, areaSwatch(i + 1), `${IX.num.get(a.id)} ${a.name}: ${byArea[i]}`)));
  const tasks = IX.order.filter(isTask), who = new Map(members().map(m => [m, 0]));
  let none = 0;
  for(const e of tasks){ const o = e.pkg.owner.trim(); if(!o || o.toLowerCase() === 'team') none++; else who.set(o, (who.get(o) || 0) + 1); }
  const max = Math.max(1, ...who.values());
  const over = new Set(checks(P, IX).filter(c => c.kind === 'overload').map(c => c.who));
  const rows = [...who].map(([m, c]) => [h('span', null, m), h('div', null, h('div', { class: 'b', style: `width:${c / max * 100}%` })),
    h('span', { class: 'num' }, c, over.has(m) ? h('span', { class: 'late' }, ' high') : null)]);
  return h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, `Tasks by major area (${total} tasks)`), bar, legend,
    h('h3', null, 'Tasks by student'),
    who.size ? h('div', { class: 'who' }, rows) : h('p', { class: 'mut' }, 'Add the team members in the project panel (select the top row).'),
    none ? h('p', { class: 'late' }, `${none} task${none > 1 ? 's have' : ' has'} no single owner.`) : null);
}

function warningsCard(){
  const list = checks(P, IX);
  return h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, `Rule checks (${list.length})`),
    list.length ? h('ul', { class: 'plain warnlist' }, list.map((c, i) => h('li', null,
      h('button', { type: 'button', 'data-key': 'warn:' + i, onclick: () => goTo(c.id) }, '⚠ ', c.text))))
      : h('p', { class: 'mut' }, 'No warnings.'),
    acceptedCard());
}

/** Tasks longer than 2 weeks that the team accepted (change briefing C9), with their reasons. */
function acceptedCard(){
  const list = acceptedExceptions(P, IX);
  if(!list.length) return null;
  return [h('h3', null, `Accepted exceptions (${list.length})`),
    h('ul', { class: 'plain warnlist accepted' }, list.map((c, i) => h('li', null,
      h('button', { type: 'button', 'data-key': 'acc:' + i, onclick: () => goTo(c.id) }, '✓ ', c.text))))];
}

/* ── EDITOR PANEL ── */
function editorPanel(){
  const id = V.sel, e = IX.byId.get(id) || IX.root;
  const panel = h('aside', { class: 'card panel', 'aria-label': 'Editor' });
  if(e.id === 'root') projectEditor(panel);
  else if(isPkg(e)) packageEditor(panel, e);
  else summaryEditor(panel, e);
  return panel;
}

function field(lab, input){ const idf = 'f-' + (input.dataset.key || Math.random().toString(36).slice(2)); input.id = idf; return [h('label', { class: 'f', for: idf }, lab), input]; }
function textField(lab, key, val, set, opts){
  return field(lab, h('input', Object.assign({ type: 'text', 'data-key': key, value: val, maxlength: 200, onchange: ev => change(() => set(ev.target.value)) }, opts || {})));
}

function projectEditor(panel){
  append(panel, [h('h3', null, 'Project'),
    textField('Project name', 'p-name', P.name, v => { P.name = v.trim() || 'Senior Design project'; }),
    field('Team members (one per line)', h('textarea', { rows: 5, 'data-key': 'p-mem', onchange: ev => change(() => {
      P.members = [...new Set(ev.target.value.split(/\n/).map(x => x.trim()).filter(Boolean))].slice(0, LIMITS.members); }) }, P.members.join('\n'))),
    field('Project length (weeks)', h('input', { type: 'number', min: 1, max: MAX_WEEKS, 'data-key': 'p-weeks', value: P.weeks,
      onchange: ev => change(() => { P.weeks = clampInt(ev.target.value, 1, MAX_WEEKS, P.weeks); }) })),
    h('p', { class: 'mut small' }, `Senior Design 1 is weeks 1–${Math.ceil(P.weeks / 2)}; Senior Design 2 is weeks ${Math.ceil(P.weeks / 2) + 1}–${P.weeks}.`),
    h('div', { class: 'btns' }, h('button', { type: 'button', 'data-key': 'add-area', onclick: () => change(() => { V.sel = addElement(P, 'root', 'New major area', false).id; }) }, '+ Major area')),
    h('h3', null, 'Baselines'), baselineList(),
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'primary', 'data-key': 'bl', onclick: doBaseline }, P.baselines.length ? 'Re-baseline…' : 'Baseline the schedule…'))]);
}

function baselineList(){
  if(!P.baselines.length) return h('p', { class: 'mut' }, 'No baseline yet. Baseline the schedule when the plan is agreed; PV and the planned counts come from it.');
  return h('ul', { class: 'plain small' }, P.baselines.slice().reverse().map((b, i) => h('li', null,
    h('b', null, `Baseline ${b.n}`), ` · ${b.date} · ${b.reason || '—'} · ${Object.values(b.plan).filter(x => x.t === 'task').length} tasks`, i === 0 ? h('b', null, ' (active)') : null)));
}

function moveButtons(e){
  return h('div', { class: 'btns' },
    h('button', { type: 'button', 'data-key': 'mv-up', onclick: () => change(() => moveSibling(P, e.id, -1)) }, '↑ Up'),
    h('button', { type: 'button', 'data-key': 'mv-dn', onclick: () => change(() => moveSibling(P, e.id, 1)) }, '↓ Down'),
    h('button', { type: 'button', 'data-key': 'mv-in', onclick: () => change(() => indent(P, e.id)) }, '→ Indent'),
    h('button', { type: 'button', 'data-key': 'mv-out', onclick: () => change(() => outdent(P, e.id)) }, '← Outdent'));
}
function deleteButton(e){
  return h('button', { type: 'button', class: 'danger', 'data-key': 'del', onclick: async () => {
    const n = descendants(IX, e.id).length;
    if(await ask('Delete ' + label(IX, e.id) + '?', n ? `This also deletes the ${n} element${n > 1 ? 's' : ''} under it and their status history. Baselines are not changed.` : 'Its status history is deleted too. Baselines are not changed.', { ok: 'Delete' }))
      change(() => { const par = e.parent; deleteElement(P, e.id); V.sel = par; });
  } }, 'Delete');
}

function summaryEditor(panel, e){
  const lev = IX.level.get(e.id), ru = rollup(e.id), add = (pkg, type, nm) => change(() => { V.open[e.id] = true; V.sel = addElement(P, e.id, nm, pkg, type).id; });
  append(panel, [h('h3', null, `${IX.num.get(e.id)} ${e.name}`), h('p', { class: 'mut small' }, `Level ${lev} · ${ru.tasks} tasks, ${ru.fin} finished · ${weekRange(ru.start, ru.finish)}`),
    textField('Name', 'e-name', e.name, v => { e.name = v.trim() || e.name; }),
    h('h4', null, 'Add under it'),
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'primary', 'data-key': 'add-task', onclick: () => add(true, 'task', 'New task') }, '+ Task'),
      h('button', { type: 'button', 'data-key': 'add-ms', onclick: () => add(true, 'milestone', 'New milestone') }, '+ Milestone'),
      h('button', { type: 'button', 'data-key': 'add-lead', onclick: () => add(true, 'lead', 'New lead-time item') }, '+ Lead time'),
      h('button', { type: 'button', 'data-key': 'add-sub', onclick: () => add(false, null, 'New element') }, '+ Sub-element')),
    h('h4', null, 'Move'), moveButtons(e),
    h('div', { class: 'btns' },
      lev > 2 && !IX.kids.get(e.id).length ? h('button', { type: 'button', 'data-key': 'to-pkg', onclick: () => change(() => setIsPackage(P, e.id, true)) }, 'Make it a work package') : null,
      deleteButton(e))]);
}

function packageEditor(panel, e){
  const k = e.pkg, id = e.id, t = trackAt(SX.get(id), P.currentWeek), es = earliestStart(P, IX, id), b = activeBaseline(P), x = b && b.plan[id];
  const dl = h('datalist', { id: 'dl-members' }, members().map(m => h('option', { value: m })));
  const others = IX.order.filter(o => isPkg(o) && o.id !== id && !k.preds.includes(o.id));
  const predSel = h('select', { 'data-key': 'pred-add', 'aria-label': 'Add a predecessor', onchange: ev => { const v = ev.target.value; if(v) change(() => { k.preds.push(v); }); } },
    h('option', { value: '' }, 'Add a predecessor…'), others.map(o => h('option', { value: o.id }, label(IX, o.id))));
  const hist = (SX.get(id) || []);
  append(panel, [h('h3', null, `${IX.num.get(id)} ${e.name}`),
    h('p', { class: 'mut small' }, `${TYPE_LABEL[k.type]}${k.type === 'task' ? ' (counts as one task in earned value)' : ' (shown on the schedule, not counted as a task)'}`),
    textField('Name', 'e-name', e.name, v => { e.name = v.trim() || e.name; }),
    field('Type', h('select', { 'data-key': 'k-type', onchange: ev => change(() => { k.type = ev.target.value; }) },
      TYPES.map(ty => h('option', { value: ty, selected: k.type === ty }, TYPE_LABEL[ty])))),
    textField('Owner (one student)', 'k-owner', k.owner, v => { k.owner = v.trim(); }, { list: 'dl-members' }), dl,
    h('div', { class: 'row' },
      h('div', null, field(k.type === 'milestone' ? 'Week' : 'Planned start week', h('input', { type: 'number', min: 1, max: P.weeks, 'data-key': 'k-start', value: k.start,
        onchange: ev => change(() => { const v = clampInt(ev.target.value, 1, P.weeks, k.start); const d = k.finish - k.start; k.start = v; if(k.finish < v) k.finish = v + Math.max(0, d); }) }))),
      k.type === 'milestone' ? null : h('div', null, field('Planned finish week', h('input', { type: 'number', min: 1, max: P.weeks, 'data-key': 'k-finish', value: k.finish,
        onchange: ev => change(() => { k.finish = clampInt(ev.target.value, 1, P.weeks, k.finish); }) })))),
    h('p', { class: 'small' + (k.type === 'task' && k.finish - k.start + 1 > 2 && !k.longOk ? ' late' : ' mut') },
      k.type === 'milestone' ? 'A milestone is zero length.' : `${k.finish - k.start + 1} week${k.finish > k.start ? 's' : ''}${k.type === 'task' && k.finish - k.start + 1 > 2 ? (k.longOk ? ' — longer than 2, accepted.' : ' — more than 2: consider splitting it, or accept it below.') : '.'}`,
      x ? ` Baseline ${b.n}: ${weekRange(x.s, x.f)} (PV uses these weeks).` : (b ? ' Added after the baseline: it counts in earned value from these planned weeks.' : ' Not in a baseline yet.')),
    k.type === 'task' && (k.finish - k.start + 1 > 2 || k.longOk) ? h('div', { class: 'accept' },
      h('label', null, h('input', { type: 'checkbox', checked: k.longOk, 'data-key': 'k-longok', onchange: ev => change(() => { k.longOk = ev.target.checked; }) }),
        ' Accepted: longer than 2 weeks'),
      k.longOk ? field('Reason', h('input', { type: 'text', maxlength: 200, 'data-key': 'k-longwhy', value: k.longWhy, placeholder: 'e.g. ongoing all term, one report a week',
        onchange: ev => change(() => { k.longWhy = ev.target.value.trim(); }) })) : null,
      h('p', { class: 'mut small' }, 'An accepted task leaves the warning list and is listed under Accepted exceptions. It still counts as one task.')) : null,
    h('label', { class: 'f' }, 'Predecessors (finish to start)'),
    k.preds.length ? h('ul', { class: 'plain preds' }, k.preds.map(q => {
      const pe = IX.byId.get(q), bad = pe && k.start <= pe.pkg.finish;
      return h('li', null, h('span', { class: bad ? 'late' : '' }, `${label(IX, q)} (finishes wk ${pe.pkg.finish})${bad ? ' — starts too early' : ''}`),
        h('button', { type: 'button', 'aria-label': 'Remove predecessor ' + label(IX, q), 'data-key': 'pred-x:' + q, onclick: () => change(() => { k.preds = k.preds.filter(z => z !== q); }) }, '×'));
    })) : h('p', { class: 'mut small' }, 'None.'),
    predSel,
    h('p', { class: 'small' }, `Earliest start: week ${es}. `, k.start !== es && k.preds.length ? h('button', { type: 'button', 'data-key': 'use-es', onclick: () => change(() => {
      const d = k.finish - k.start; k.start = Math.min(es, P.weeks); k.finish = Math.min(P.weeks, k.start + d); }) }, `Move to week ${es}`) : null),
    field('Deliverable', h('input', { type: 'text', maxlength: 400, 'data-key': 'k-del', value: k.deliverable, onchange: ev => change(() => { k.deliverable = ev.target.value.trim(); }) })),
    h('label', { class: 'f' }, `Status at week ${P.currentWeek}`),
    P.currentWeek >= 1 ? statusRadios(id, t.state) : h('p', { class: 'mut small' }, 'Set the current week to 1 or later to record status.'),
    hist.length ? h('p', { class: 'mut small' }, 'History: ' + hist.map(z => `wk ${z.week} ${STATE_LABEL[z.state].toLowerCase()}`).join(', ')) : null,
    h('h4', null, 'Move'), moveButtons(e),
    h('div', { class: 'btns' }, h('button', { type: 'button', 'data-key': 'to-sum', onclick: () => change(() => setIsPackage(P, id, false)) }, 'Make it a summary element'), deleteButton(e))]);
}

/** Three radio buttons that set a package's state at the current week. */
function statusRadios(id, state){
  const name = 'st-' + id + '-' + V.tab;
  return h('div', { class: 'radios', role: 'radiogroup', 'aria-label': 'Status of ' + label(IX, id) },
    STATES.map(st => h('label', null, h('input', { type: 'radio', name, value: st, checked: state === st, 'data-key': `st:${id}:${st}`,
      onchange: () => change(() => setStatus(P, id, P.currentWeek, st)) }), STATE_LABEL[st])));
}
