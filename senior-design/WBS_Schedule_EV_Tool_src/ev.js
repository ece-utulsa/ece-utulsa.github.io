/* ════════════════════════════════════════════════════════════════════════════════════════════
   ev.js — earned value in tasks (briefing §4): the four counts, PV and EV by the 50/50 rule, the derived measures,
   the start/finish signal, weekly series and the late-task list. Pure functions, no DOM.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const UNDEF = 'not yet defined';

/** The derived measures from the four counts. Inputs: { BAC, T, Sp, Fp, Sa, Fa } and the week w.
    Every value is computed at full precision; an undefined value is null, with the reason in why[key].
    Week 0 (before the project starts) leaves every measure undefined (briefing T3). */
function measures(c, w){
  const keys = ['PV', 'EV', 'SV', 'SVpct', 'SPI', 'pct', 'SR', 'FR', 'Tf', 'togo', 'TSPI'];
  const m = { w, BAC: c.BAC, T: c.T, Sp: c.Sp, Fp: c.Fp, Sa: c.Sa, Fa: c.Fa, why: {} };
  if(!(w >= 1) || !(c.BAC > 0)){
    const r = !(c.BAC > 0) ? 'no baselined tasks' : 'week 0';
    for(const k of keys){ m[k] = null; m.why[k] = r; }
    m.signal = null; return m;
  }
  m.PV = (c.Sp + c.Fp) / 2;
  m.EV = (c.Sa + c.Fa) / 2;
  m.SV = m.EV - m.PV;
  m.pct = m.EV / c.BAC * 100;
  m.togo = c.BAC - m.EV;
  if(m.PV > 0){ m.SPI = m.EV / m.PV; m.SVpct = m.SV / m.PV * 100; } else { m.SPI = m.SVpct = null; m.why.SPI = m.why.SVpct = 'PV = 0'; }
  if(c.Sp > 0) m.SR = c.Sa / c.Sp; else { m.SR = null; m.why.SR = 'Sp = 0'; }
  if(c.Fp > 0) m.FR = c.Fa / c.Fp; else { m.FR = null; m.why.FR = 'Fp = 0'; }
  if(m.SPI) m.Tf = c.T / m.SPI; else { m.Tf = null; m.why.Tf = m.SPI === 0 ? 'SPI = 0' : 'SPI not yet defined'; }
  if(c.BAC !== m.PV) m.TSPI = (c.BAC - m.EV) / (c.BAC - m.PV); else { m.TSPI = null; m.why.TSPI = 'plan complete'; }
  m.signal = signal(m.SR, m.FR);
  m.basis = m.SR !== null && m.FR === null ? 'starts' : m.SR === null && m.FR !== null ? 'finishes' : m.signal ? 'both' : null;
  return m;
}

/** The start/finish quadrant signal: both ratios ≥ 1 → On plan; one below 1 → Watch; both below 1 → Re-plan.
    With only one ratio defined (early weeks, nothing planned to finish yet) it is judged alone: ≥ 1 On plan, else Watch. */
function signal(SR, FR){
  const r = [SR, FR].filter(x => x !== null && x !== undefined);
  if(!r.length) return null;
  const below = r.filter(x => x < 1).length;
  if(below === 0) return 'On plan';
  if(below === 2) return 'Re-plan';
  return 'Watch';
}

/** Measures straight from inputs (for the lecture's practice problem, T2). */
function measuresFromInputs(inp){ return measures({ BAC: inp.BAC, T: inp.T, Sp: inp.Sp, Fp: inp.Fp, Sa: inp.Sa, Fa: inp.Fa }, inp.w === undefined ? 1 : inp.w); }

/** The tasks that count in earned value: every type-"task" package in the WBS now (the WBS is a living document).
    Planned weeks come from the active baseline for tasks in it, and from the current plan for tasks added since.
    Deleted tasks, and tasks changed to another type, drop out. Nothing counts until the schedule is first baselined.
    filter = { area: 0 (all) or 1..n, owner: '' (all) or a name }. */
function evTasks(p, ix, filter){
  const b = activeBaseline(p); if(!b) return [];
  const f = filter || {}, out = [];
  for(const e of ix.order){
    if(!isTask(e)) continue;
    const id = e.id, x = b.plan[id], area = ix.area.get(id), owner = e.pkg.owner.trim();
    if(f.area && area !== f.area) continue;
    if(f.owner && owner !== f.owner) continue;
    const base = !!(x && x.t === 'task');
    out.push({ id, s: base ? x.s : e.pkg.start, f: base ? x.f : e.pkg.finish, base, area, owner, live: true, num: ix.num.get(id), name: e.name, pos: ix.pos.get(id) });
  }
  return out;
}

/** The four counts at week w and BAC, T for a list from evTasks(). Sa and Fa come from the status at w. */
function counts(tasks, sx, w){
  let Sp = 0, Fp = 0, Sa = 0, Fa = 0, T = 0;
  for(const t of tasks){
    if(t.s <= w) Sp++;
    if(t.f <= w) Fp++;
    T = Math.max(T, t.f);
    if(!t.live) continue;
    const st = trackAt(sx.get(t.id), w).state;
    if(st !== 'not') Sa++;
    if(st === 'finished') Fa++;
  }
  return { BAC: tasks.length, T, Sp, Fp, Sa, Fa };
}

/** Counts and measures for every week 0..weeks. Per-week counts are the week-on-week change of the cumulative counts,
    so per-week bars summed over weeks 1..w always equal the cumulative bars at w (briefing T8). */
function series(p, ix, sx, filter){
  const tasks = evTasks(p, ix, filter), rows = [];
  for(let w = 0; w <= p.weeks; w++){
    const c = counts(tasks, sx, w), m = measures(c, w);
    const prev = rows.length ? rows[rows.length - 1] : { Sp: 0, Fp: 0, Sa: 0, Fa: 0 };
    m.wk = { Sp: c.Sp - prev.Sp, Fp: c.Fp - prev.Fp, Sa: c.Sa - prev.Sa, Fa: c.Fa - prev.Fa };
    rows.push(m);
  }
  return rows;
}

/** Tasks late at week w, oldest first: past the baseline start and not started (late start), past the baseline finish
    and not finished (late finish). One entry per task; ordered by the earliest missed week, a late start before a
    late finish in the same week, then WBS order. */
function lateTasks(p, ix, sx, w, filter){
  const out = [];
  for(const t of evTasks(p, ix, filter)){
    if(!t.live) continue;
    const st = trackAt(sx.get(t.id), w).state;
    const ls = t.s <= w && st === 'not', lf = t.f <= w && st !== 'finished';
    if(!ls && !lf) continue;
    out.push({ id: t.id, num: t.num, name: t.name, owner: t.owner, s: t.s, f: t.f, lateStart: ls, lateFinish: lf,
      missed: ls ? t.s : t.f, pos: t.pos });
  }
  out.sort((a, b) => a.missed - b.missed || (b.lateStart - a.lateStart) || a.pos - b.pos);
  return out;
}

/** Late flags for any package (tasks, lead-time items, milestones) against its baseline, or its plan if not baselined. */
function lateFlags(p, e, sx, w){
  const b = activeBaseline(p), x = b && b.plan[e.id];
  const s = x ? x.s : e.pkg.start, f = x ? x.f : e.pkg.finish;
  const st = trackAt(sx.get(e.id), w).state;
  return { lateStart: s <= w && st === 'not', lateFinish: f <= w && st !== 'finished' };
}

/* ── FORMATS ── indices to 2 decimals, counts to 1 decimal, weeks to 1 decimal (briefing §4) */
const MINUS = '−';
function sgn(s){ return s.replace(/^-/, MINUS); }
function fmtCount(v){ return v === null || v === undefined ? UNDEF : sgn(v.toFixed(1)); }
function fmtIndex(v){ return v === null || v === undefined ? UNDEF : sgn(v.toFixed(2)); }
function fmtPct(v){ return v === null || v === undefined ? UNDEF : sgn(v.toFixed(1)) + '%'; }
function fmtWeeks(v){ return v === null || v === undefined ? UNDEF : v.toFixed(1) + ' weeks'; }
function fmtTSPI(m){ return m.TSPI === null ? (m.why.TSPI === 'plan complete' && m.w >= 1 && m.BAC > 0 ? 'plan complete' : UNDEF) : fmtIndex(m.TSPI); }

/** The headline measures in display form, in the lecture's order, with the definition of each. */
function measureRows(m){
  return [
    ['PV', 'Planned value', fmtCount(m.PV), '½(Sp + Fp)'],
    ['EV', 'Earned value', fmtCount(m.EV), '½(Sa + Fa)'],
    ['SV', 'Schedule variance', fmtCount(m.SV), 'EV − PV'],
    ['SV%', 'Schedule variance %', fmtPct(m.SVpct), 'SV / PV × 100'],
    ['SPI', 'Schedule performance index', fmtIndex(m.SPI), 'EV / PV'],
    ['SR', 'Start ratio', fmtIndex(m.SR), 'Sa / Sp'],
    ['FR', 'Finish ratio', fmtIndex(m.FR), 'Fa / Fp'],
    ['% complete', 'Percent complete', fmtPct(m.pct), 'EV / BAC × 100'],
    ['Tf', 'Forecast duration', fmtWeeks(m.Tf), 'T / SPI'],
    ['To go', 'Tasks to go', fmtCount(m.togo), 'BAC − EV'],
    ['TSPI', 'To-complete schedule performance index', fmtTSPI(m), '(BAC − EV) / (BAC − PV)'],
  ];
}

/** The one-line task status reading for week w (briefing §5 tab 3). */
/** The signal in words. Week 0 is the planning week. With nothing planned to finish yet, progress is judged on starts. */
function signalText(m){
  if(!(m.w >= 1)) return 'Planning (week 0)';
  if(!m.signal) return 'Signal not yet defined';
  return m.basis === 'starts' ? m.signal + ' (on starts)' : m.basis === 'finishes' ? m.signal + ' (on finishes)' : m.signal;
}

function statusLine(m){
  if(!(m.w >= 1)) return 'Week 0: planning. The project starts at week 1.';
  return `By week ${m.w}: ${m.Sp} planned to start, ${m.Sa} started; ${m.Fp} planned to finish, ${m.Fa} finished.`;
}
