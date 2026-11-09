// Builder's smoke check of the calculation core (Node, no DOM). NOT the acceptance suite: Test writes that from the
// briefing, independently of the build. Run: node tests/build-check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..'), ctx = {}; vm.createContext(ctx);
vm.runInContext(['model.js', 'ev.js', 'example.js', 'tests/fixture.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + '\n;this.api = { t1Project, loadProject, serialize, indexTree, statusIndex, evTasks, counts, measures, measuresFromInputs, lateTasks, series, measureRows, checks };', ctx);
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
ok('accepted exception: 4.1.1 leaves the warnings, numbers unchanged', ctx.eWarn2.length === ctx.eWarn.length - 1 && ctx.eAcc.length === 1 && /4\.1\.1/.test(ctx.eAcc[0].text) && ctx.em2.EV === 7 && ctx.em2.BAC === 40);
// Old project files (made by v1.0.0 and v1.0.2) open and give the same numbers as those versions computed
for(const v of ['1.0.0', '1.0.2']){
  const raw = fs.readFileSync(path.join(SRC, 'tests', 'fixtures', `project_v${v}.json`), 'utf8'), exp = JSON.parse(fs.readFileSync(path.join(SRC, 'tests', 'fixtures', `expected_v${v}.json`), 'utf8'));
  ctx.raw = raw; vm.runInContext('var op = loadProject(JSON.parse(raw)), oix = indexTree(op), osx = statusIndex(op), oser = []; for(var w = 0; w <= 8; w++) oser.push(measures(counts(evTasks(op, oix), osx, w), w));', ctx);
  const same = exp.weeks.every(r => { const m = ctx.oser[r[0]]; return exp.columns.every((k, i) => i === 0 || (k === 'signal' ? m.signal === r[i] : m[k] === r[i])); });
  ok(`v${v} project file opens with the same numbers`, same);
}
let threw = false; try { A.loadProject({ app: 'sd-wbs-ev', schema: 99 }); } catch { threw = true; } ok('newer schema refused', threw);
console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
