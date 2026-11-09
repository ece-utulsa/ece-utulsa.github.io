// Builder's smoke check of the calculation core (Node, no DOM). NOT the acceptance suite: Test writes that from the
// briefing, independently of the build. Run: node tests/build-check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..'), ctx = {}; vm.createContext(ctx);
vm.runInContext(['model.js', 'ev.js', 'tests/fixture.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + '\n;this.api = { t1Project, loadProject, serialize, indexTree, statusIndex, evTasks, counts, measures, measuresFromInputs, lateTasks, series, measureRows, checks };', ctx);
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
let threw = false; try { A.loadProject({ app: 'sd-wbs-ev', schema: 99 }); } catch { threw = true; } ok('newer schema refused', threw);
console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
