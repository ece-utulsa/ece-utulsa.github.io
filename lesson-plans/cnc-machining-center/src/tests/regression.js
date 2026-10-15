// CNC Machining Center developer test: every part's example plan passes inspection (2 stars), a tuned plan earns 3,
// and each built-in mistake produces its defect. Machining runs at full speed, without waiting for the screen.
// Build first, then:  NODE_PATH=$(npm root -g) node tests/regression.js      (from src/)
// It writes a debug copy of the Teacher edition (internals exposed as window.__dbg) to the system temp folder.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const built = path.join(__dirname, '..', '..', 'CNC Machining Center - Teacher.html');
const end = "resize();setView('iso');requestAnimationFrame(frame);\n})();";
let s = fs.readFileSync(built, 'utf8');
if (s.split(end).length !== 2) { console.error('cannot find the end of the app script'); process.exit(1); }
s = s.replace(end, 'window.__dbg={RUN,plans,PARTS,MATS,autoPlan,choosePart,chooseMat,cycleStart,step,resetRun,goTo,get LAST(){return LAST}};\n' + end);
const dbg = path.join(os.tmpdir(), 'cnc-machining-debug.html'); fs.writeFileSync(dbg, s);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + dbg); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  // Make part k in material m with the example plan changed by `edit` (a function body given `pl`); return the inspection.
  const run = (k, m, edit) => page.evaluate(([k, m, edit]) => {
    const d = __dbg; d.choosePart(k); d.chooseMat(m); const pl = d.autoPlan(d.PARTS[k], d.MATS[m]); new Function('pl', edit || '')(pl);
    d.plans[k] = pl; d.goTo('run'); d.resetRun(true); d.cycleStart(); if (d.RUN.state !== 'running') return { refused: true };
    let n = 0; while (d.RUN.state === 'running' && n++ < 20000) d.step(2, true);
    const L = d.LAST; return { status: L.status, stars: L.stars, time: Math.round(L.time), target: L.target, fails: L.rows.filter(r => !r.pass).map(r => r.key) };
  }, [k, m, edit]);
  for (const k of ['tag', 'plate', 'opener', 'hub']) for (const m of ['wax', 'hdpe', 'al']) {
    const r = await run(k, m); check(r.status === 'ok' && r.stars === 2 && !r.fails.length, `example plan: ${k} in ${m}, ${r.time} s, ${r.stars} stars`); }
  const has = (r, keys) => keys.every(k => r.fails.includes(k));
  const cases = [
    ['no facing', 'tag', 'wax', 'pl.splice(0,1)', r => r.stars === 1 && has(r, ['out:T', 'P1:Z'])],
    ['no spot drill', 'tag', 'wax', 'pl.splice(1,1)', r => r.stars === 1 && has(r, ['H1:X', 'H1:Y'])],
    ['no tabs', 'tag', 'wax', 'pl[pl.length-1].tabs=false', r => r.status === 'loose' && r.stars === 0],
    ['wrong drill', 'tag', 'wax', 'pl.find(o=>o.type==="drill").tool=10', r => r.stars === 1 && has(r, ['H1:D'])],
    ['end mill too big for the corners', 'tag', 'wax', 'pl.find(o=>o.type==="pocket").tool=4', r => r.stars === 1 && has(r, ['P1:R'])],
    ['outline cut before other features', 'tag', 'wax', 'const q=pl.pop();pl.splice(2,0,q)', r => r.stars === 1 && has(r, ['P1:L', 'H1:X'])],
    ['no peck on deep holes', 'plate', 'al', 'pl.find(o=>o.type==="drill"&&o.feat==="d0.201").peck=false', r => r.status === 'broken'],
    ['feed far too high', 'plate', 'al', 'pl.find(o=>o.type==="pocket").feed=90', r => r.status === 'broken'],
    ['tool too big to fit the pocket', 'opener', 'al', 'pl.find(o=>o.type==="pocket").tool=2', r => r.refused === true],
    ['tuned plan: three stars', 'tag', 'wax', 'pl.forEach(o=>{o.feed=Math.round(o.feed*1.45);if(o.step)o.step=+(o.step*1.6).toFixed(3)})', r => r.status === 'ok' && r.stars === 3],
  ];
  for (const [what, k, m, edit, ok] of cases) { const r = await run(k, m, edit); check(ok(r), `${what}: ${JSON.stringify(r)}`); }
  // A plan made for wax, run in aluminum, breaks a tool.
  const al = await page.evaluate(() => { const d = __dbg; d.choosePart('tag'); d.chooseMat('wax'); d.plans.tag = d.autoPlan(d.PARTS.tag, d.MATS.wax); d.chooseMat('al');
    d.resetRun(true); d.cycleStart(); let n = 0; while (d.RUN.state === 'running' && n++ < 20000) d.step(2, true); return d.LAST.status; });
  check(al === 'broken', `wax feeds in aluminum break a tool (${al})`);
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
