/* ════════════════════════════════════════════════════════════════════════════════════════════
   ui.js — DOM and SVG builders (text only, never HTML strings from data), the view state, autosave to browser
   storage, project files (Save / Open), CSV export, dialogs, and the rows shared by the WBS and Gantt tabs.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const LS_PROJECT = 'sd-wbs-ev:project', LS_VIEW = 'sd-wbs-ev:view';
const $ = id => document.getElementById(id);

/** Element builder. attrs: on* → listeners, other keys → attributes; children: nodes or text. */
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  setAttrs(el, attrs); append(el, kids); return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids){
  const el = document.createElementNS(SVGNS, tag);
  setAttrs(el, attrs); append(el, kids); return el;
}
function setAttrs(el, attrs){
  if(!attrs) return;
  for(const [k, v] of Object.entries(attrs)){
    if(v === null || v === undefined || v === false) continue;
    if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if(k === 'text') el.textContent = v;
    else if(k === 'value' && 'value' in el && el.namespaceURI !== SVGNS) el.value = v;
    else if(k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}
function append(el, kids){
  for(const k of kids.flat(Infinity)){
    if(k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); return el; }

/* ── STATE ─────────────────────────────────────────────────────────────────────────────────── */

let P = null;                        // the project
const V = {                          // the view (kept per browser, not in the project file)
  tab: 'wbs', level: '3', open: {}, sel: 'root', layout: 'tree', zoom: 'all', gview: 'chart',
  mode: 'cum', farea: 0, fowner: '', evarea: 0, showAll: false,
};
let IX = null, SX = null;            // tree index and status index of P, rebuilt after every change
let saveTimer = 0, lastSaved = null, storageOK = true, fileDirty = false;

function reindex(){ IX = indexTree(P); SX = statusIndex(P); }

function loadView(){
  try {
    const j = JSON.parse(localStorage.getItem(LS_VIEW) || 'null');
    if(j && typeof j === 'object'){
      if(['wbs', 'gantt', 'status', 'week', 'ev', 'report'].includes(j.tab)) V.tab = j.tab;
      if(['1', '2', '3', '4', 'all'].includes(j.level)) V.level = j.level;
      if(['tree', 'diagram'].includes(j.layout)) V.layout = j.layout;
      if(['all', 'sd1', 'sd2', 'near'].includes(j.zoom)) V.zoom = j.zoom;
      if(['chart', 'table'].includes(j.gview)) V.gview = j.gview;
      if(['cum', 'week'].includes(j.mode)) V.mode = j.mode;
      V.showAll = j.showAll === true;
    }
  } catch { /* storage blocked or unreadable: defaults */ }
}
function saveView(){
  try { localStorage.setItem(LS_VIEW, JSON.stringify({ tab: V.tab, level: V.level, layout: V.layout, zoom: V.zoom, gview: V.gview, mode: V.mode, showAll: V.showAll })); } catch { /* ignore */ }
}

/** Load the autosaved project, or start from the Senior Design template. */
function loadStart(){
  let p = null;
  try { const raw = localStorage.getItem(LS_PROJECT); if(raw) p = loadProject(JSON.parse(raw)); } catch { p = null; }
  P = p || newProject();
  reindex();
}

function autosave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_PROJECT, serialize(P)); lastSaved = new Date(); storageOK = true; }
    catch { storageOK = false; }
    showSaved();
  }, 300);
}
function showSaved(){
  const el = $('saved');
  if(!storageOK){ el.textContent = 'Not saved in this browser (storage blocked or full). Use Save.'; el.className = 'warn'; return; }
  el.className = fileDirty ? 'warn' : '';
  el.textContent = (lastSaved ? 'Last saved in this browser ' + lastSaved.toLocaleTimeString() : 'Not changed yet') + (fileDirty ? ' · changes not yet saved to a file' : '');
}

/** Apply a change to the project, then re-index, autosave and redraw. */
function change(fn){
  const r = fn();
  if(r === false) return;
  for(const e of P.elements) if(e.pkg) normalizePkg(P, e.pkg);
  P.currentWeek = clampInt(P.currentWeek, 0, P.weeks, 0);
  P.elements.find(e => e.id === 'root').name = P.name;
  reindex();
  if(!IX.byId.has(V.sel)) V.sel = 'root';
  fileDirty = true;
  autosave(); render();
}

/* ── DIALOGS ───────────────────────────────────────────────────────────────────────────────── */

/** A modal question. opts.input → resolves to the text (or null on cancel); otherwise resolves true/false. */
function ask(title, text, opts){
  opts = opts || {};
  return new Promise(res => {
    const d = $('dlg'), inp = $('dlgIn'), lab = $('dlgInLab');
    $('dlgTitle').textContent = title; $('dlgText').textContent = text || '';
    $('dlgOk').textContent = opts.ok || 'OK';
    $('dlgCancel').style.display = opts.alert ? 'none' : '';
    inp.style.display = lab.style.display = opts.input ? '' : 'none';
    lab.textContent = opts.input || ''; inp.value = opts.value || '';
    d.returnValue = 'cancel';
    const done = () => { d.removeEventListener('close', done); res(d.returnValue === 'ok' ? (opts.input ? inp.value : true) : (opts.input ? null : false)); };
    d.addEventListener('close', done);
    d.showModal();
    (opts.input ? inp : $('dlgOk')).focus();
  });
}

/* ── FILES ─────────────────────────────────────────────────────────────────────────────────── */

function download(name, text, type){
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function slug(t){ return (t || 'project').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'project'; }

function saveFile(){
  download(`${slug(P.name)}_week${P.currentWeek}.json`, serialize(P), 'application/json');
  fileDirty = false; showSaved();
}

function openFile(file){
  if(!file) return;
  if(file.size > 20 * 1024 * 1024){ ask('Cannot open the file', 'The file is larger than 20 MB, so it is not a project file of this tool.', { alert: true }); return; }
  const r = new FileReader();
  r.onload = async () => {
    let p;
    try { p = loadProject(JSON.parse(String(r.result))); }
    catch(e){ ask('Cannot open the file', e instanceof SyntaxError ? 'The file is not valid JSON.' : e.message, { alert: true }); return; }
    if(fileDirty && !(await ask('Open this project?', 'The project open now has changes that are not saved to a file. They will be replaced.', { ok: 'Open' }))) return;
    P = p; V.sel = 'root'; V.open = {}; fileDirty = false; reindex(); autosave(); render();
  };
  r.onerror = () => ask('Cannot open the file', 'The browser could not read the file.', { alert: true });
  r.readAsText(file);
}

async function newFile(){
  const ok = await ask('Start a new project?', 'This replaces the project open now with the Senior Design template. Save the current project to a file first if you want to keep it.', { ok: 'Start new project' });
  if(!ok) return;
  P = newProject(); V.sel = 'root'; V.open = {}; fileDirty = false; reindex(); autosave(); render();
}

/** Ask for a reason and freeze the plan as a new baseline. */
async function doBaseline(){
  const n = P.baselines.length + 1;
  const reason = await ask(n === 1 ? 'Baseline the schedule' : `Re-baseline (baseline ${n})`,
    n === 1 ? 'This freezes every package\'s planned start and finish weeks. PV is computed from the baseline.'
            : `Baseline ${n - 1} is kept unchanged. PV will be computed from baseline ${n}.`,
    { input: 'Reason', value: n === 1 ? 'Initial baseline' : '', ok: 'Baseline' });
  if(reason === null) return;
  change(() => { addBaseline(P, reason.trim() || (n === 1 ? 'Initial baseline' : 'Re-baseline')); });
}

/* ── ROWS SHARED BY THE WBS AND GANTT TABS ─────────────────────────────────────────────────── */

/** Is element e open (its children shown)? The Show to level selector opens every branch above that level and closes
    the rest; a branch opened or closed by hand overrides it until the level is changed. */
function isOpen(e){
  if(Object.prototype.hasOwnProperty.call(V.open, e.id)) return V.open[e.id];
  const L = V.level === 'all' ? 99 : Number(V.level);
  return IX.level.get(e.id) < L;
}
function setLevel(l){ V.level = l; V.open = {}; saveView(); render(); }

/** The visible rows, depth first. */
function visibleRows(){
  const rows = [];
  const walk = e => {
    const kids = IX.kids.get(e.id), open = kids.length > 0 && isOpen(e);
    rows.push({ e, lev: IX.level.get(e.id), hasKids: kids.length > 0, open });
    if(open) kids.forEach(walk);
  };
  if(IX.root) walk(IX.root);
  return rows;
}

/** Roll-up of everything under an element (or the element itself, for a package): tasks, tasks finished at the current
    week, owners, the earliest planned start and latest planned finish. Each row's counts are the sum of its children's. */
function rollup(id){
  const e = IX.byId.get(id), list = isPkg(e) ? [e] : descendants(IX, id).filter(isPkg);
  let tasks = 0, fin = 0, start = Infinity, finish = -Infinity; const owners = new Set();
  for(const x of list){
    start = Math.min(start, x.pkg.start); finish = Math.max(finish, x.pkg.finish);
    if(x.pkg.type !== 'task') continue;
    tasks++;
    if(trackAt(SX.get(x.id), P.currentWeek).state === 'finished') fin++;
    if(x.pkg.owner.trim()) owners.add(x.pkg.owner.trim());
  }
  return { tasks, fin, owners: owners.size, start: list.length ? start : null, finish: list.length ? finish : null };
}

function levelSelect(){
  return h('label', null, 'Show to level',
    h('select', { 'data-key': 'level-' + V.tab, onchange: ev => setLevel(ev.target.value) },
      [['1', '1 (project)'], ['2', '2 (major areas)'], ['3', '3 (sub-areas)'], ['4', '4 (work packages)'], ['all', 'All']]
        .map(([v, t]) => h('option', { value: v, selected: V.level === v }, t))));
}

function weekRange(a, b){ return a === null ? '—' : (a === b ? 'wk ' + a : `wk ${a}–${b}`); }
function areaSwatch(a){ return h('span', { class: 'swatch', style: `background:${areaColor(a)}`, 'aria-hidden': 'true' }); }
function stateText(st){ return h('span', { class: 'st-' + st }, STATE_LABEL[st]); }
function signalClass(sig){ return sig === 'On plan' ? 'on' : sig === 'Watch' ? 'watch' : sig === 'Re-plan' ? 'replan' : 'none'; }
function signalChip(m){ return h('span', { class: 'chip ' + signalClass(m.signal), title: m.basis === 'starts' ? 'Nothing is planned to finish yet, so progress is judged on starts (SR) alone.' : null }, signalText(m)); }
function members(){ return P.members.slice(); }
function areaOptions(sel){
  return [h('option', { value: 0, selected: !sel }, 'All major areas'),
    ...(IX.kids.get('root') || []).map((a, i) => h('option', { value: i + 1, selected: sel === i + 1 }, IX.num.get(a.id) + ' ' + a.name))];
}
function ownerOptions(sel){
  const set = new Set(members());
  for(const e of IX.order) if(isTask(e) && e.pkg.owner.trim()) set.add(e.pkg.owner.trim());
  return [h('option', { value: '', selected: !sel }, 'All owners'), ...[...set].sort().map(o => h('option', { value: o, selected: sel === o }, o))];
}
/** Go to an element on the WBS tab. */
function goTo(id){ V.sel = id; V.tab = 'wbs';
  // open the branch down to it
  let e = IX.byId.get(id); while(e && e.parent){ V.open[e.parent] = true; e = IX.byId.get(e.parent); }
  saveView(); render(); const r = document.querySelector(`[data-key="row:${CSS.escape(id)}"]`); if(r) r.focus();
}

/* ── CSV EXPORTS ───────────────────────────────────────────────────────────────────────────── */

function csvWbs(){
  const b = activeBaseline(P), rows = [['WBS', 'Level', 'Name', 'Type', 'Owner', 'Planned start week', 'Planned finish week', 'Planned weeks',
    'Baseline start week', 'Baseline finish week', 'Predecessors', 'Deliverable', `Status at week ${P.currentWeek}`, 'Actual start week', 'Actual finish week', 'Tasks', 'Tasks finished']];
  for(const r of visibleRows()){
    const e = r.e, id = e.id, ru = rollup(id);
    if(isPkg(e)){
      const k = e.pkg, x = b && b.plan[id], t = trackAt(SX.get(id), P.currentWeek);
      rows.push([IX.num.get(id), r.lev, e.name, TYPE_LABEL[k.type], k.owner, k.start, k.finish, k.type === 'milestone' ? 0 : k.finish - k.start + 1,
        x ? x.s : '', x ? x.f : '', k.preds.map(q => IX.num.get(q)).join(' '), k.deliverable, STATE_LABEL[t.state], t.start ?? '', t.finish ?? '',
        ru.tasks, ru.fin]);
    } else rows.push([IX.num.get(id) || 'Project', r.lev, e.name, 'Summary', '', ru.start ?? '', ru.finish ?? '', '', '', '', '', '', '', '', '', ru.tasks, ru.fin]);
  }
  download(`${slug(P.name)}_WBS_level-${V.level}.csv`, toCSV(rows), 'text/csv');
}
function csvStatus(){
  const rows = [['WBS', 'Name', 'Type', 'Week', 'State']];
  const list = P.status.slice().sort((a, b) => (IX.pos.get(a.id) - IX.pos.get(b.id)) || a.week - b.week);
  for(const st of list){ const e = IX.byId.get(st.id); rows.push([IX.num.get(st.id), e.name, TYPE_LABEL[e.pkg.type], st.week, STATE_LABEL[st.state]]); }
  download(`${slug(P.name)}_status_history.csv`, toCSV(rows), 'text/csv');
}
function csvEv(){
  const rows = [['Week', 'Sp', 'Fp', 'Sa', 'Fa', 'BAC', 'T', 'PV', 'EV', 'SV', 'SV%', 'SPI', 'SR', 'FR', '% complete', 'Forecast duration (weeks)', 'Tasks to go', 'TSPI', 'Signal']];
  const ser = series(P, IX, SX);
  const n = v => v === null ? UNDEF : +v.toFixed(4);
  for(const m of ser.slice(0, P.currentWeek + 1)){
    rows.push([m.w, m.Sp, m.Fp, m.Sa, m.Fa, m.BAC, m.T, n(m.PV), n(m.EV), n(m.SV), n(m.SVpct), n(m.SPI), n(m.SR), n(m.FR), n(m.pct), n(m.Tf), n(m.togo),
      m.TSPI === null ? fmtTSPI(m) : n(m.TSPI), signalText(m)]);
  }
  download(`${slug(P.name)}_earned_value_to_week${P.currentWeek}.csv`, toCSV(rows), 'text/csv');
}

/* ── SMALL SVG CHART HELPERS ───────────────────────────────────────────────────────────────── */

/** Nice integer ticks from 0 to max. */
function ticks(max, n){
  if(max <= 0) return [0, 1];
  const raw = max / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(m => m * mag).find(x => x >= raw) || raw;
  const out = []; for(let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  if(out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}
