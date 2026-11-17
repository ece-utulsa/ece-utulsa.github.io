// Builder's smoke check of the calculation core (Node, no DOM). NOT the acceptance suite: Test writes that from the
// briefing, independently of the build. Run: node tests/build-check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..'), ctx = {}; vm.createContext(ctx);
vm.runInContext(['model.js', 'ev.js', 'example.js', 'tests/fixture.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + '\n;this.api = { t1Project, loadProject, serialize, indexTree, statusIndex, evTasks, wbsTasks, counts, measures, measuresFromInputs, lateTasks, series, measureRows, checks };', ctx);
const A = ctx.api; let fail = 0;
const ok = (name, cond, got) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined ? '  ' + got : '')); if(!cond) fail++; };
const near = (a, b, t) => a !== null && Math.abs(a - b) <= t;
const p = A.loadProject(JSON.parse(A.t1Project())), ix = A.indexTree(p), sx = A.statusIndex(p);
const c = A.counts(A.evTasks(p, ix), sx, 6), m = A.measures(c, 6);
ok('counts', c.Sp === 10 && c.Fp === 8 && c.Sa === 8 && c.Fa === 6 && c.BAC === 40 && c.T === 15, JSON.stringify(c));
ok('PV EV SV', near(m.PV, 9, .05) && near(m.EV, 7, .05) && near(m.SV, -2, .05) && near(m.SVpct, -22.2, .05));
ok('indices', near(m.SPI, .78, .01) && near(m.SR, .80, .01) && near(m.FR, .75, .01) && near(m.TSPI, 1.06, .01));
ok('pct Tf togo', near(m.pct, 17.5, .05) && near(m.Tf, 19.3, .1) && near(m.togo, 33, .05));
ok('signal', m.signal === 'Re-plan', m.signal);
ok('late list', A.lateTasks(p, ix, sx, 6).map(l => l.num).join(' ') === '2.1.1 1.4.2 1.4.1');
const q = A.measuresFromInputs({ BAC: 60, T: 15, Sp: 34, Fp: 28, Sa: 30, Fa: 22 });
ok('practice problem', near(q.PV, 31, .05) && near(q.EV, 26, .05) && near(q.SPI, .84, .01) && near(q.SR, .88, .01) && near(q.FR, .79, .01) && near(q.pct, 43.3, .05) && near(q.Tf, 17.9, .1) && near(q.TSPI, 1.17, .01) && q.signal === 'Re-plan');
ok('week 0 undefined', A.measureRows(A.measures(c, 0)).every(r => r[2] === 'not yet defined'));
ok('plan complete', A.measureRows(A.measures({ BAC: 4, T: 2, Sp: 4, Fp: 4, Sa: 4, Fa: 3 }, 3)).find(r => r[0] === 'TSPI')[2] === 'plan complete');
const ser = A.series(p, ix, sx), sum = { Sp: 0, Fp: 0, Sa: 0, Fa: 0 }; for(let w = 1; w <= 6; w++) for(const k in sum) sum[k] += ser[w].wk[k];
const e = A.measures({ BAC: 10, T: 8, Sp: 3, Fp: 0, Sa: 2, Fa: 0 }, 2);
ok('signal on starts', e.signal === 'Watch' && e.basis === 'starts', e.signal + ' / ' + e.basis);
ok('per-week sums = cumulative', sum.Sp === 10 && sum.Fp === 8 && sum.Sa === 8 && sum.Fa === 6);
ok('round trip', A.serialize(A.loadProject(JSON.parse(A.serialize(p)))) === A.serialize(p));
// The WBS is a living document: a task added after the baseline counts at once; a deleted task drops out.
vm.runInContext('var lp = loadProject(JSON.parse(t1Project())); var lix = indexTree(lp); var add = addElement(lp, lix.order.find(e => lix.num.get(e.id) === "2.1").id, "Test rig", true); Object.assign(add.pkg, { start: 5, finish: 6 }); setStatus(lp, add.id, 6, "started"); deleteElement(lp, lix.order.find(e => lix.num.get(e.id) === "1.4.2").id); lix = indexTree(lp); var lc = counts(evTasks(lp, lix), statusIndex(lp), 6);', ctx);
ok('living WBS (add 2.1.2, delete 1.4.2)', ctx.lc.BAC === 40 && ctx.lc.Sp === 10 && ctx.lc.Fp === 9 && ctx.lc.Sa === 9 && ctx.lc.Fa === 6, JSON.stringify(ctx.lc));
// Change briefing v1.0.3: the built-in lecture example gives exactly the numbers of §0
vm.runInContext(`var ex = loadProject(JSON.parse(serialize(lectureExample()))), eix = indexTree(ex), esx = statusIndex(ex), ec = counts(evTasks(ex, eix), esx, 6), em = measures(ec, 6), erd = readings(em);
  var eWarn = checks(ex, eix); var t411 = eix.order.find(e => eix.num.get(e.id) === '4.1.1'); t411.pkg.longOk = true; t411.pkg.longWhy = 'Ongoing';
  var eWarn2 = checks(ex, eix), eAcc = acceptedExceptions(ex, eix), em2 = measures(counts(evTasks(ex, eix), esx, 6), 6);`, ctx);
const X = ctx.em;
ok('example counts', ctx.ec.Sp === 10 && ctx.ec.Sa === 8 && ctx.ec.Fp === 8 && ctx.ec.Fa === 6 && ctx.ec.BAC === 40 && ctx.ec.T === 15 && ctx.ex.currentWeek === 6 && ctx.ex.baselines.length === 1, JSON.stringify(ctx.ec));
ok('example measures', X.PV === 9 && X.EV === 7 && X.SV === -2 && near(X.SVpct, -22.2, .05) && near(X.SPI, .78, .01) && near(X.SR, .8, .01) && near(X.FR, .75, .01) && near(X.pct, 17.5, .05) && near(X.Tf, 19.3, .1) && X.togo === 33 && near(X.TSPI, 1.06, .01) && X.signal === 'Re-plan');
ok('example late tasks', vm.runInContext("lateTasks(ex, eix, esx, 6).map(l => l.num).join(' ')", ctx) === '2.1.1 1.4.2 1.4.1');
ok('example owners 10 each, flagged as example', ctx.ex.example === true && ['Ana', 'Ben', 'Cara', 'Dev'].every(o => vm.runInContext(`eix.order.filter(e => isTask(e) && e.pkg.owner === '${o}').length`, ctx) === 10));
ok('example has no predecessor or owner warnings', ctx.eWarn.every(w => w.kind === 'long'), ctx.eWarn.map(w => w.kind).join(','));
ok('readings in words', ctx.erd.spi === 'Behind: 78% of planned progress.' && ctx.erd.forecast === 'About 4 weeks late at this pace.' && ctx.erd.ratios === 'Starting late (0.80) and finishing late (0.75).' && ctx.erd.signal === 'Behind on both starts and finishes.', JSON.stringify(ctx.erd));
ok('accepted exception: 4.1.1 leaves the warnings, numbers unchanged', ctx.eWarn2.length === ctx.eWarn.length - 1 && ctx.eAcc.length === 2 && ctx.eAcc.some(a => /4\.1\.1/.test(a.text)) && ctx.em2.EV === 7 && ctx.em2.BAC === 40);
// Change briefing v1.0.4, E12: the example opens with 4.1.2 already accepted (with a reason), so it is not in the warnings
vm.runInContext(`var ex4 = lectureExample(), ex4ix = indexTree(ex4), ex4w = checks(ex4, ex4ix), ex4a = acceptedExceptions(ex4, ex4ix), t412 = ex4ix.order.find(e => ex4ix.num.get(e.id) === '4.1.2');`, ctx);
ok('E12 example opens with 4.1.2 accepted', ctx.ex4a.length === 1 && /4\.1\.2/.test(ctx.ex4a[0].text) && !ctx.ex4w.some(w => /4\.1\.2/.test(w.text)) && ctx.t412.pkg.longOk === true && ctx.t412.pkg.longWhy.length > 0 && ctx.t412.name === 'Status reports, weeks 7–15');
// Ruling R1 (D3): the WBS task count is known before the first baseline; PV, EV and the measures still wait for it
vm.runInContext(`var nb = newProject('No baseline'), nbix = indexTree(nb), nbsub = nbix.order.find(e => nbix.num.get(e.id) === '1.1').id, nbids = [1, 2, 3].map(i => addElement(nb, nbsub, 'Task ' + i, true).id);
  var ms0 = addElement(nb, nbsub, 'PDR', true, 'milestone'); nb.currentWeek = 2; setStatus(nb, nbids[0], 1, 'started'); setStatus(nb, nbids[0], 2, 'finished'); setStatus(nb, nbids[1], 2, 'started');
  nbix = indexTree(nb); var nbsx = statusIndex(nb), nbw = counts(wbsTasks(nb, nbix), nbsx, 2), nbe = counts(evTasks(nb, nbix), nbsx, 2), nbm = measures(nbe, 2);
  addBaseline(nb, 'Initial'); var nbSame = JSON.stringify(wbsTasks(nb, nbix)) === JSON.stringify(evTasks(nb, nbix));`, ctx);
ok('R1 no baseline: WBS count 3, Sa 2, Fa 1; EV list empty and measures undefined', ctx.nbw.BAC === 3 && ctx.nbw.Sa === 2 && ctx.nbw.Fa === 1 && ctx.nbe.BAC === 0 && ctx.nbm.PV === null && ctx.nbm.EV === null && ctx.nbm.why.PV === 'no baselined tasks', JSON.stringify(ctx.nbw));
ok('R1 with a baseline: the WBS list is the EV list', ctx.nbSame === true);
// Main briefing T4 (rule checks) and T5 (schedule), through the model
vm.runInContext(`var r4 = loadProject(JSON.parse(t1Project())), r4ix = indexTree(r4), by = n => r4ix.order.find(e => r4ix.num.get(e.id) === n);
  by('1.1.1').pkg.owner = 'Team'; by('1.2.1').pkg.finish = 5; by('1.1.2').pkg.deliverable = '';
  for(const e of r4ix.order.filter(e => isPkg(e) && r4ix.area.get(e.id) === 3)) deleteElement(r4, e.id);
  r4ix = indexTree(r4); for(const e of r4ix.order.filter(isTask).slice(0, 20)) e.pkg.owner = e.pkg.owner === 'Team' ? 'Team' : 'Ana';
  var r4k = checks(r4, r4ix);
  var r5 = loadProject(JSON.parse(t1Project())), r5ix = indexTree(r5), b5 = n => r5ix.order.find(e => r5ix.num.get(e.id) === n);
  b5('1.4.1').pkg.start = 5; b5('1.4.1').pkg.finish = 6; b5('1.3.1').pkg.finish = 6; var r5pred = checks(r5, r5ix).filter(c => c.kind === 'pred');
  var lead = r5ix.order.find(e => isPkg(e) && e.pkg.type === 'lead'), leadLen = lead.pkg.finish - lead.pkg.start + 1, leadCounted = evTasks(r5, r5ix).some(t => t.id === lead.id);
  var b1 = JSON.stringify(r5.baselines[0]); b5('1.4.2').pkg.start = 8; b5('1.4.2').pkg.finish = 9; var pvBefore = measures(counts(evTasks(r5, r5ix), statusIndex(r5), 6), 6).PV;
  addBaseline(r5, 'Re-plan'); var pvAfter = measures(counts(evTasks(r5, r5ix), statusIndex(r5), 6), 6).PV, b1Same = JSON.stringify(r5.baselines[0]) === b1, nBase = r5.baselines.length;`, ctx);
const kinds = ctx.r4k.map(c => c.kind);
ok('T4 rule checks: Team owner, 3 weeks, no deliverable, empty area, overload', ['teamOwner', 'long', 'noDeliverable', 'emptyArea', 'overload'].every(k => kinds.includes(k))
  && ctx.r4k.some(c => c.kind === 'teamOwner' && /1\.1\.1/.test(c.text)) && ctx.r4k.some(c => c.kind === 'long' && /1\.2\.1/.test(c.text) && /3 weeks/.test(c.text))
  && ctx.r4k.some(c => c.kind === 'noDeliverable' && /1\.1\.2/.test(c.text)) && ctx.r4k.some(c => c.kind === 'emptyArea' && /3\.0/.test(c.text)) && ctx.r4k.some(c => c.kind === 'overload' && c.who === 'Ana'), kinds.join(','));
ok('T5 predecessor warning, 3-week lead item not a task, re-baseline keeps baseline 1 and PV uses the new one', ctx.r5pred.length === 1 && /1\.4\.1/.test(ctx.r5pred[0].text) && ctx.leadLen === 3 && ctx.leadCounted === false
  && ctx.b1Same === true && ctx.nBase === 2 && ctx.pvBefore === 9 && ctx.pvAfter === 8.5, `PV ${ctx.pvBefore} -> ${ctx.pvAfter}`);
// Random sweep (CLAUDE.md §6): random valid projects; every week's counts are recounted independently from the project
// record and PV, EV, SV, SPI, SR, FR, Tf and TSPI must hold their identities.
{
  let seed = 20261117; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const eq = (a, b) => a === b || (a !== null && b !== null && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)));
  let cases = 0, weeksChecked = 0, bad = [];
  for(let n = 0; n < 400; n++){
    ctx.cfg = { weeks: ri(1, 40), nTasks: ri(0, 45), r: Array.from({ length: 600 }, rnd), late: rnd() < 0.5 };
    vm.runInContext(`var sp = newProject('Sweep'), six = indexTree(sp), subs = six.order.filter(e => six.level.get(e.id) === 3), ri = 0, R = () => cfg.r[ri++ % cfg.r.length];
      sp.weeks = cfg.weeks; var mk = () => { var e = addElement(sp, subs[Math.floor(R() * subs.length)].id, 'T', true, R() < 0.85 ? 'task' : R() < 0.5 ? 'milestone' : 'lead');
        var s = 1 + Math.floor(R() * cfg.weeks), f = Math.min(cfg.weeks, s + Math.floor(R() * 4)); e.pkg.start = s; e.pkg.finish = e.pkg.type === 'milestone' ? s : f; return e; };
      var made = []; for(var i = 0; i < cfg.nTasks; i++) made.push(mk());
      addBaseline(sp, 'b1');
      if(cfg.late){ for(var j = 0; j < 3; j++) made.push(mk()); if(made.length > 4){ deleteElement(sp, made[0].id); made.shift(); made[1].pkg.start = Math.min(cfg.weeks, made[1].pkg.start + 1); made[1].pkg.finish = Math.max(made[1].pkg.finish, made[1].pkg.start); } }
      for(var e of made){ var u = R(); if(u < 0.3) continue; var ws = 1 + Math.floor(R() * cfg.weeks); setStatus(sp, e.id, ws, 'started'); if(u > 0.6) setStatus(sp, e.id, Math.min(cfg.weeks, ws + Math.floor(R() * 3)), 'finished'); if(u > 0.95) setStatus(sp, e.id, cfg.weeks, 'not'); }
      sp = loadProject(JSON.parse(serialize(sp))); six = indexTree(sp); var ssx = statusIndex(sp), sser = series(sp, six, ssx), sbase = activeBaseline(sp).plan;
      var raw = sp.elements.filter(e => e.pkg && e.pkg.type === 'task').map(e => ({ s: sbase[e.id] && sbase[e.id].t === 'task' ? sbase[e.id].s : e.pkg.start, f: sbase[e.id] && sbase[e.id].t === 'task' ? sbase[e.id].f : e.pkg.finish,
        st: sp.status.filter(z => z.id === e.id).sort((a, b) => a.week - b.week) }));`, ctx);
    cases++;
    const raw = ctx.raw, BAC = raw.length, T = raw.reduce((t, x) => Math.max(t, x.f), 0), cum = { Sp: 0, Fp: 0, Sa: 0, Fa: 0 };
    let prev = null;
    for(const m of ctx.sser){
      const w = m.w, stAt = x => { let st = 'not'; for(const z of x.st) if(z.week <= w) st = z.state; return st; };
      const Sp = raw.filter(x => x.s <= w).length, Fp = raw.filter(x => x.f <= w).length, Sa = raw.filter(x => stAt(x) !== 'not').length, Fa = raw.filter(x => stAt(x) === 'finished').length;
      const e = []; const need = (name, c) => { if(!c) e.push(name); };
      need('counts', m.Sp === Sp && m.Fp === Fp && m.Sa === Sa && m.Fa === Fa && m.BAC === BAC && m.T === T);
      need('order', Fp <= Sp && Fa <= Sa && Sa <= BAC && Sp <= BAC);
      if(prev) need('planned counts never fall', m.Sp >= prev.Sp && m.Fp >= prev.Fp);
      for(const k in cum) cum[k] += m.wk[k];
      need('per-week sums', cum.Sp === Sp && cum.Fp === Fp && cum.Sa === Sa && cum.Fa === Fa);
      if(w < 1 || BAC === 0) need('undefined at week 0 / no tasks', ['PV', 'EV', 'SV', 'SPI', 'SR', 'FR', 'Tf', 'TSPI'].every(k => m[k] === null) && m.signal === null);
      else {
        const PV = (Sp + Fp) / 2, EV = (Sa + Fa) / 2;
        need('PV', m.PV === PV); need('EV', m.EV === EV); need('SV', m.SV === EV - PV);
        need('SPI', PV > 0 ? eq(m.SPI, EV / PV) && eq(m.SVpct, (EV - PV) / PV * 100) : m.SPI === null && m.SVpct === null);
        need('SR', Sp > 0 ? eq(m.SR, Sa / Sp) : m.SR === null); need('FR', Fp > 0 ? eq(m.FR, Fa / Fp) : m.FR === null);
        need('Tf', PV > 0 && EV > 0 ? eq(m.Tf, T * PV / EV) && eq(m.Tf * m.SPI, T) : m.Tf === null);
        need('TSPI', BAC !== PV ? eq(m.TSPI, (BAC - EV) / (BAC - PV)) && eq(m.TSPI * (BAC - PV), BAC - EV) : m.TSPI === null && m.why.TSPI === 'plan complete');
        need('pct togo', eq(m.pct, EV / BAC * 100) && m.togo === BAC - EV && eq(m.EV + m.togo, BAC));
        const below = [m.SR, m.FR].filter(x => x !== null && x < 1).length, defd = [m.SR, m.FR].filter(x => x !== null).length;
        need('signal', m.signal === (!defd ? null : below === 0 ? 'On plan' : below === 2 ? 'Re-plan' : 'Watch'));
        need('bounds', m.EV >= 0 && m.EV <= BAC && m.PV >= 0 && m.PV <= BAC && (m.SPI === null || m.SPI >= 0));
      }
      if(e.length) bad.push(`case ${n} week ${w}: ${e.join(', ')}`);
      prev = m; weeksChecked++;
    }
  }
  ok(`random sweep: ${cases} projects, ${weeksChecked} project-weeks, identities hold`, bad.length === 0, bad.slice(0, 5).join(' | '));
}
// Old project files (made by v1.0.0 and v1.0.2) open and give the same numbers as those versions computed
for(const v of ['1.0.0', '1.0.2']){
  const raw = fs.readFileSync(path.join(SRC, 'tests', 'fixtures', `project_v${v}.json`), 'utf8'), exp = JSON.parse(fs.readFileSync(path.join(SRC, 'tests', 'fixtures', `expected_v${v}.json`), 'utf8'));
  ctx.raw = raw; vm.runInContext('var op = loadProject(JSON.parse(raw)), oix = indexTree(op), osx = statusIndex(op), oser = []; for(var w = 0; w <= 8; w++) oser.push(measures(counts(evTasks(op, oix), osx, w), w));', ctx);
  const same = exp.weeks.every(r => { const m = ctx.oser[r[0]]; return exp.columns.every((k, i) => i === 0 || (k === 'signal' ? m.signal === r[i] : m[k] === r[i])); });
  ok(`v${v} project file opens with the same numbers`, same);
}
let threw = false; try { A.loadProject({ app: 'sd-wbs-ev', schema: 99 }); } catch { threw = true; } ok('newer schema refused', threw);
console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
