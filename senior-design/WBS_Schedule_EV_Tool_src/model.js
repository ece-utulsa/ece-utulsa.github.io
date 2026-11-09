/* ════════════════════════════════════════════════════════════════════════════════════════════
   model.js — the project record, the Senior Design template, the WBS tree, task status, baselines,
   rule checks, file load (validation + schema migration) and CSV. No DOM: Test can call it directly.
   All dates are week numbers 1..weeks. No hours are stored anywhere (briefing §2, §3).
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const APP_ID = 'sd-wbs-ev';
const SCHEMA = 1;                         // schema version written into every project file
const MAX_WEEKS = 60;
const LIMITS = { elements: 2000, status: 20000, baselines: 200, members: 30, text: 200, long: 4000, preds: 50 };
const TYPES = ['task', 'milestone', 'lead'];
const TYPE_LABEL = { task: 'Task', milestone: 'Milestone', lead: 'Lead time' };
const STATES = ['not', 'started', 'finished'];
const STATE_LABEL = { not: 'Not started', started: 'Started', finished: 'Finished' };
const AREA_COLOR = ['#10668a', '#18744a', '#8a5700', '#6a4fc8'];   // 1.0 Design, 2.0 Testing, 3.0 Manufacture, 4.0 PM
const AREA_COLOR_OTHER = '#4f5b62';

/* The lecture's Senior Design template: four major areas and their 14 sub-areas, exactly (briefing §2). */
const TEMPLATE = [
  ['Design', ['Conceptual design', 'Analysis', 'Simulation and modeling', 'Detail design', 'Design reviews']],
  ['Testing', ['Test plan', 'Testing', 'Final test report']],
  ['Manufacture', ['Manufacturing plan', 'Procurement', 'Build to the plan']],
  ['Project Management', ['Reporting', 'Schedule, WBS and earned value', 'Customer contact']],
];

/* ── PROJECT ────────────────────────────────────────────────────────────────────────────────── */

function newProject(name){
  const p = { app: APP_ID, schema: SCHEMA, name: name || 'Senior Design project', members: [], weeks: 30, currentWeek: 0,
    nextId: 1, elements: [{ id: 'root', parent: null, name: name || 'Senior Design project', order: 0, pkg: null }],
    status: [], baselines: [], actions: '' };
  TEMPLATE.forEach(([area, subs], i) => {
    const a = addElement(p, 'root', area, false);
    subs.forEach(s => addElement(p, a.id, s, false));
    void i;
  });
  return p;
}

function newId(p){ return 'e' + (p.nextId++).toString(36); }

function blankPkg(type){ return { type: type || 'task', owner: '', start: 1, finish: 1, preds: [], deliverable: '' }; }

/** Add an element under parentId (last among its siblings). isPkg makes it a work package (a leaf). */
function addElement(p, parentId, name, isPkg, type){
  const sibs = p.elements.filter(e => e.parent === parentId);
  const e = { id: newId(p), parent: parentId, name: name || (isPkg ? 'New task' : 'New element'),
    order: sibs.length ? Math.max(...sibs.map(s => s.order)) + 1 : 0, pkg: isPkg ? blankPkg(type) : null };
  p.elements.push(e);
  return e;
}

/* ── TREE INDEX ─────────────────────────────────────────────────────────────────────────────── */

/** Everything derived from the tree: children in order, WBS numbers, levels, major area, depth-first order.
    WBS numbers come from the tree position only (never typed in). Root = level 1 (the project, no number);
    major areas = level 2 "k.0"; level 3 "k.j"; deeper levels append ".i". */
function indexTree(p){
  const byId = new Map(), kids = new Map();
  for(const e of p.elements){ byId.set(e.id, e); kids.set(e.id, []); }
  for(const e of p.elements) if(e.parent !== null && kids.has(e.parent)) kids.get(e.parent).push(e);
  for(const list of kids.values()) list.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  const num = new Map(), level = new Map(), area = new Map(), order = [], pos = new Map();
  const walk = (e, lev, n, ar) => {
    num.set(e.id, n); level.set(e.id, lev); area.set(e.id, ar); pos.set(e.id, order.length); order.push(e);
    kids.get(e.id).forEach((c, i) => {
      const k = i + 1;
      if(lev === 1) walk(c, 2, k + '.0', k);
      else if(lev === 2) walk(c, 3, n.split('.')[0] + '.' + k, ar);
      else walk(c, lev + 1, n + '.' + k, ar);
    });
  };
  const root = byId.get('root');
  if(root) walk(root, 1, '', 0);
  return { byId, kids, num, level, area, order, pos, root };
}

const isPkg = e => !!(e && e.pkg);
const isTask = e => !!(e && e.pkg && e.pkg.type === 'task');
function packages(p, ix){ return ix.order.filter(isPkg); }
function areaColor(a){ return AREA_COLOR[a - 1] || AREA_COLOR_OTHER; }
function label(ix, id){ const e = ix.byId.get(id); return e ? ((ix.num.get(id) ? ix.num.get(id) + ' ' : '') + e.name) : '(deleted)'; }

/** All descendants of id (not including id). */
function descendants(ix, id){
  const out = [], stack = [...ix.kids.get(id) || []];
  while(stack.length){ const e = stack.shift(); out.push(e); stack.unshift(...ix.kids.get(e.id)); }
  return out;
}

/* ── EDITS ──────────────────────────────────────────────────────────────────────────────────── */

function renumberSiblings(p, parentId){
  p.elements.filter(e => e.parent === parentId).sort((a, b) => a.order - b.order).forEach((e, i) => { e.order = i; });
}

/** Move an element up (-1) or down (+1) among its siblings. */
function moveSibling(p, id, dir){
  const e = p.elements.find(x => x.id === id); if(!e || e.parent === null) return false;
  renumberSiblings(p, e.parent);
  const sibs = p.elements.filter(x => x.parent === e.parent).sort((a, b) => a.order - b.order);
  const i = sibs.indexOf(e), j = i + dir;
  if(j < 0 || j >= sibs.length) return false;
  [sibs[i].order, sibs[j].order] = [sibs[j].order, sibs[i].order];
  return true;
}

/** Can element id be moved under newParent? Not under itself or a descendant, not under a package, packages not under the root. */
function canReparent(p, id, newParent){
  const ix = indexTree(p), e = ix.byId.get(id), np = ix.byId.get(newParent);
  if(!e || !np || id === 'root' || id === newParent) return false;
  if(isPkg(np)) return false;
  if(isPkg(e) && newParent === 'root') return false;
  return !descendants(ix, id).some(d => d.id === newParent);
}

function reparent(p, id, newParent){
  if(!canReparent(p, id, newParent)) return false;
  const e = p.elements.find(x => x.id === id), old = e.parent;
  const sibs = p.elements.filter(x => x.parent === newParent && x !== e);
  e.parent = newParent; e.order = sibs.length ? Math.max(...sibs.map(s => s.order)) + 1 : 0;
  renumberSiblings(p, old); renumberSiblings(p, newParent);
  return true;
}

/** Indent: make the element the last child of its previous sibling. Outdent: move it after its parent. */
function indent(p, id){
  const ix = indexTree(p), e = ix.byId.get(id); if(!e || e.parent === null) return false;
  const sibs = ix.kids.get(e.parent), i = sibs.indexOf(e);
  if(i < 1) return false;
  return reparent(p, id, sibs[i - 1].id);
}
function outdent(p, id){
  const ix = indexTree(p), e = ix.byId.get(id); if(!e || e.parent === null) return false;
  const par = ix.byId.get(e.parent); if(!par || par.parent === null) return false;
  if(!canReparent(p, id, par.parent)) return false;
  const gp = par.parent;
  p.elements.filter(x => x.parent === gp && x.order > par.order).forEach(x => { x.order += 1; });
  e.parent = gp; e.order = par.order + 1;
  renumberSiblings(p, gp);
  return true;
}

/** Delete an element and everything under it; drop it from predecessor lists and the status history.
    Baselines are frozen copies and are left unchanged. */
function deleteElement(p, id){
  if(id === 'root') return false;
  const ix = indexTree(p); if(!ix.byId.has(id)) return false;
  const gone = new Set([id, ...descendants(ix, id).map(e => e.id)]);
  const parent = ix.byId.get(id).parent;
  p.elements = p.elements.filter(e => !gone.has(e.id));
  for(const e of p.elements) if(e.pkg) e.pkg.preds = e.pkg.preds.filter(q => !gone.has(q));
  p.status = p.status.filter(s => !gone.has(s.id));
  renumberSiblings(p, parent);
  return true;
}

/** Turn a summary element with no children into a package, or a package back into a summary element. */
function setIsPackage(p, id, on){
  const ix = indexTree(p), e = ix.byId.get(id);
  if(!e || id === 'root') return false;
  if(on){ if(ix.kids.get(id).length || e.parent === 'root') return false; if(!e.pkg) e.pkg = blankPkg('task'); }
  else if(e.pkg){ e.pkg = null; p.status = p.status.filter(s => s.id !== id); for(const x of p.elements) if(x.pkg) x.pkg.preds = x.pkg.preds.filter(q => q !== id); }
  return true;
}

/** Keep a package's weeks whole and inside 1..weeks; a milestone is zero length (finish = start). */
function normalizePkg(p, pkg){
  const W = p.weeks;
  pkg.start = clampInt(pkg.start, 1, W, 1);
  pkg.finish = clampInt(pkg.finish, 1, W, pkg.start);
  if(pkg.type === 'milestone') pkg.finish = pkg.start;
}

/* ── STATUS ─────────────────────────────────────────────────────────────────────────────────── */

/** Status entries grouped by package and sorted by week. */
function statusIndex(p){
  const m = new Map();
  for(const s of p.status){ if(!m.has(s.id)) m.set(s.id, []); m.get(s.id).push(s); }
  for(const list of m.values()) list.sort((a, b) => a.week - b.week);
  return m;
}

/** State of one package at the end of week w: the latest entry at or before w. Also the actual start (the week it
    was first marked started or finished in its current run) and actual finish (the week it was marked finished). */
function trackAt(list, w){
  let state = 'not', start = null, finish = null;
  if(list) for(const s of list){
    if(s.week > w) break;
    if(state === 'not' && s.state !== 'not') start = s.week;
    if(s.state === 'not') start = null;
    if(s.state === 'finished' && state !== 'finished') finish = s.week;
    if(s.state !== 'finished') finish = null;
    state = s.state;
  }
  return { state, start, finish };
}

/** Record a package's state at week w. One entry per package per week; an entry that only repeats the state
    already in effect is not stored. */
function setStatus(p, id, w, state){
  if(!STATES.includes(state)) return false;
  p.status = p.status.filter(s => !(s.id === id && s.week === w));
  const before = trackAt(statusIndex(p).get(id), w - 1).state;
  if(state !== before) p.status.push({ id, week: w, state });
  return true;
}

/* ── BASELINES ──────────────────────────────────────────────────────────────────────────────── */

/** Freeze every package's planned start and finish weeks. Earlier baselines are kept unchanged. */
function addBaseline(p, reason, dateISO){
  const ix = indexTree(p), plan = {};
  for(const e of packages(p, ix)) plan[e.id] = { s: e.pkg.start, f: e.pkg.finish, t: e.pkg.type, a: ix.area.get(e.id),
    num: ix.num.get(e.id), name: e.name, owner: e.pkg.owner };
  const b = { n: p.baselines.length + 1, date: dateISO || new Date().toISOString().slice(0, 10), reason: String(reason || '').slice(0, LIMITS.text), plan };
  p.baselines.push(b);
  return b;
}
/** The active baseline: always the latest one (PV is computed from it). */
function activeBaseline(p){ return p.baselines.length ? p.baselines[p.baselines.length - 1] : null; }

/* ── SCHEDULE AND RULE CHECKS ───────────────────────────────────────────────────────────────── */

/** Earliest start of a package from its finish-to-start predecessors (no lag): the week after the latest
    predecessor finish, or week 1. Predecessors in a loop are reported by checks() and ignored here. */
function earliestStart(p, ix, id, seen){
  const e = ix.byId.get(id); if(!isPkg(e)) return 1;
  seen = seen || new Set(); if(seen.has(id)) return 1; seen.add(id);
  let es = 1;
  for(const q of e.pkg.preds){ const pe = ix.byId.get(q); if(isPkg(pe)) es = Math.max(es, pe.pkg.finish + 1); }
  return es;
}

function hasCycle(ix, id){
  const stack = [...(ix.byId.get(id)?.pkg?.preds || [])], seen = new Set();
  while(stack.length){
    const q = stack.pop(); if(q === id) return true;
    if(seen.has(q)) continue; seen.add(q);
    const e = ix.byId.get(q); if(isPkg(e)) stack.push(...e.pkg.preds);
  }
  return false;
}

/** Rule checks (briefing §2): warnings, never blocks. Each has the element id it belongs to, a kind and plain words. */
function checks(p, ix){
  ix = ix || indexTree(p);
  const out = [], L = id => label(ix, id);
  const tasks = ix.order.filter(isTask);
  // Major areas with no tasks
  for(const a of ix.kids.get('root') || []){
    if(isPkg(a)) continue;
    if(!descendants(ix, a.id).some(isTask)) out.push({ id: a.id, kind: 'emptyArea', text: `${L(a.id)} has no work packages.` });
  }
  for(const e of ix.order.filter(isPkg)){
    const k = e.pkg, n = L(e.id);
    if(k.type === 'task'){
      const o = k.owner.trim();
      if(!o) out.push({ id: e.id, kind: 'noOwner', text: `${n} has no owner.` });
      else if(o.toLowerCase() === 'team') out.push({ id: e.id, kind: 'teamOwner', text: `${n} is owned by "Team". Give it one student.` });
      const d = k.finish - k.start + 1;
      if(d > 2) out.push({ id: e.id, kind: 'long', text: `${n} is planned for ${d} weeks, more than 2. Split it into smaller tasks.` });
      if(!k.deliverable.trim()) out.push({ id: e.id, kind: 'noDeliverable', text: `${n} has no deliverable.` });
    }
    if(k.finish < k.start) out.push({ id: e.id, kind: 'order', text: `${n} finishes (week ${k.finish}) before it starts (week ${k.start}).` });
    if(k.start > p.weeks || k.finish > p.weeks) out.push({ id: e.id, kind: 'range', text: `${n} runs past the last week of the project (week ${p.weeks}).` });
    if(hasCycle(ix, e.id)) out.push({ id: e.id, kind: 'cycle', text: `${n} is in a loop of predecessors.` });
    for(const q of k.preds){
      const pe = ix.byId.get(q); if(!isPkg(pe)) continue;
      if(k.start <= pe.pkg.finish) out.push({ id: e.id, kind: 'pred',
        text: `${n} starts in week ${k.start}, before its predecessor ${L(q)} finishes (week ${pe.pkg.finish}). Earliest start: week ${pe.pkg.finish + 1}.` });
    }
  }
  // A student who owns more than 1.5 times the team's average number of tasks
  const members = p.members.length ? p.members : [...new Set(tasks.map(e => e.pkg.owner.trim()).filter(o => o && o.toLowerCase() !== 'team'))];
  if(members.length){
    const count = new Map(members.map(m => [m, 0]));
    for(const e of tasks){ const o = e.pkg.owner.trim(); if(count.has(o)) count.set(o, count.get(o) + 1); }
    const avg = [...count.values()].reduce((a, b) => a + b, 0) / members.length;
    for(const [m, c] of count) if(avg > 0 && c > 1.5 * avg)
      out.push({ id: 'root', kind: 'overload', who: m, text: `${m} owns ${c} tasks, more than 1.5 times the team average (${avg.toFixed(1)}).` });
  }
  return out;
}

/* ── FILES ──────────────────────────────────────────────────────────────────────────────────── */

function clampInt(v, lo, hi, dflt){ v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; }
function str(v, max){ return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max || LIMITS.text) : ''; }
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** Schema migrations: MIGRATE[n] turns a schema-n project into schema n+1. Empty while SCHEMA = 1. */
const MIGRATE = {};

/** Read a project from parsed JSON (an opened file or browser storage). Checks the app id and schema, migrates older
    schemas, and rebuilds every field from known keys with bounded types, so a file cannot inject anything.
    Throws an Error with plain words if the file is not a project of this tool. */
function loadProject(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This file is not a project file.');
  if(raw.app !== APP_ID) throw new Error('This file was not made by the Senior Design WBS, Schedule and Earned Value Tool.');
  let o = raw, v = Number(raw.schema);
  if(!Number.isInteger(v) || v < 1) throw new Error('The file has no valid schema version.');
  if(v > SCHEMA) throw new Error(`The file was made by a newer version of the tool (schema ${v}). Open it with that version.`);
  while(v < SCHEMA){ o = MIGRATE[v](o); v++; }
  return sanitize(o);
}

function sanitize(o){
  const weeks = clampInt(o.weeks, 1, MAX_WEEKS, 30);
  const p = { app: APP_ID, schema: SCHEMA, name: str(o.name) || 'Senior Design project',
    members: [], weeks, currentWeek: clampInt(o.currentWeek, 0, weeks, 1), nextId: 1,
    elements: [], status: [], baselines: [], actions: str(o.actions, LIMITS.long) };
  const seenM = new Set();
  for(const m of Array.isArray(o.members) ? o.members.slice(0, LIMITS.members) : []){
    const s = str(m).trim(); if(s && !seenM.has(s)){ seenM.add(s); p.members.push(s); }
  }
  // Elements: valid ids, unique, reachable from the root, packages are leaves and not directly under the root.
  const els = Array.isArray(o.elements) ? o.elements.slice(0, LIMITS.elements) : [];
  const byId = new Map();
  for(const e of els){
    if(!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID_RE.test(e.id) || byId.has(e.id)) continue;
    const parent = e.id === 'root' ? null : (typeof e.parent === 'string' ? e.parent : undefined);
    if(parent === undefined) continue;
    let pkg = null;
    if(e.pkg && typeof e.pkg === 'object'){
      const t = TYPES.includes(e.pkg.type) ? e.pkg.type : 'task';
      pkg = { type: t, owner: str(e.pkg.owner), start: clampInt(e.pkg.start, 1, weeks, 1), finish: 1,
        preds: [], deliverable: str(e.pkg.deliverable, 400) };
      pkg.finish = t === 'milestone' ? pkg.start : clampInt(e.pkg.finish, 1, weeks, pkg.start);
      pkg.preds = Array.isArray(e.pkg.preds) ? e.pkg.preds.filter(q => typeof q === 'string' && ID_RE.test(q)).slice(0, LIMITS.preds) : [];
    }
    byId.set(e.id, { id: e.id, parent, name: str(e.name) || 'Untitled', order: clampInt(e.order, 0, 1e6, 0), pkg });
  }
  if(!byId.has('root')) byId.set('root', { id: 'root', parent: null, name: p.name, order: 0, pkg: null });
  const root = byId.get('root'); root.pkg = null; root.name = p.name;
  // keep only elements whose chain reaches the root without a loop; a package may not have children
  const ok = new Map([['root', true]]);
  const reaches = id => {
    const path = []; let cur = id;
    while(!ok.has(cur)){
      const e = byId.get(cur); if(!e || path.includes(cur)){ path.forEach(x => ok.set(x, false)); return false; }
      path.push(cur); cur = e.parent;
    }
    const r = ok.get(cur); path.forEach(x => ok.set(x, r)); return r;
  };
  const keep = [...byId.values()].filter(e => reaches(e.id));
  const keepIds = new Set(keep.map(e => e.id));
  for(const e of keep){
    const par = byId.get(e.parent);
    if(par && par.pkg) par.pkg = null;              // a package that has children becomes a summary element
  }
  for(const e of keep) if(e.pkg && e.parent === 'root') e.pkg = null;
  for(const e of keep) if(e.pkg) e.pkg.preds = [...new Set(e.pkg.preds)].filter(q => q !== e.id && keepIds.has(q) && byId.get(q).pkg);
  p.elements = keep;
  // ids: nextId past every generated id
  let maxN = 0;
  for(const e of keep){ const m = /^e([0-9a-z]+)$/.exec(e.id); if(m) maxN = Math.max(maxN, parseInt(m[1], 36)); }
  p.nextId = Math.max(clampInt(o.nextId, 1, 1e9, 1), maxN + 1);
  // Status: known package, week in range, known state; one entry per package and week (the last one wins)
  const st = new Map();
  for(const s of Array.isArray(o.status) ? o.status.slice(0, LIMITS.status) : []){
    if(!s || typeof s !== 'object' || !keepIds.has(s.id) || !byId.get(s.id).pkg || !STATES.includes(s.state)) continue;
    const w = clampInt(s.week, 1, weeks, NaN); if(!Number.isFinite(w)) continue;
    st.set(s.id + '@' + w, { id: s.id, week: w, state: s.state });
  }
  p.status = [...st.values()];
  // Baselines: frozen, renumbered 1..n in file order
  for(const b of Array.isArray(o.baselines) ? o.baselines.slice(0, LIMITS.baselines) : []){
    if(!b || typeof b !== 'object' || !b.plan || typeof b.plan !== 'object') continue;
    const plan = {};
    for(const id of Object.keys(b.plan).slice(0, LIMITS.elements)){
      const x = b.plan[id]; if(!ID_RE.test(id) || !x || typeof x !== 'object') continue;
      const s = clampInt(x.s, 1, MAX_WEEKS, 1);
      plan[id] = { s, f: clampInt(x.f, 1, MAX_WEEKS, s), t: TYPES.includes(x.t) ? x.t : 'task', a: clampInt(x.a, 0, 99, 0),
        num: str(x.num, 40), name: str(x.name), owner: str(x.owner) };
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : '';
    p.baselines.push({ n: p.baselines.length + 1, date, reason: str(b.reason), plan });
  }
  return p;
}

/** The project file: deterministic JSON of the sanitized project (Save then Open gives an identical project). */
function serialize(p){ return JSON.stringify(sanitize(p), null, 1); }

/* ── CSV ────────────────────────────────────────────────────────────────────────────────────── */

/** One CSV cell. Text that a spreadsheet would read as a formula is prefixed with ' (CSV injection). */
function csvCell(v){
  if(v === null || v === undefined) return '';
  if(typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** Rows → CSV text with a UTF-8 byte-order mark and CRLF line ends, so Excel opens it with the right columns. */
function toCSV(rows){ return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
