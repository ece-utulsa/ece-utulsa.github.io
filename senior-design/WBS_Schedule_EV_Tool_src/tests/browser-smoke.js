// Builder's browser smoke test: every tab renders with the T1 project, no console error, no network request.
// NOT the acceptance suite. Run: NODE_PATH=$(npm root -g) node tests/browser-smoke.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { chromium } = require('playwright');
const SRC = path.join(__dirname, '..'), ctx = {}; vm.createContext(ctx);
vm.runInContext(['model.js', 'ev.js', 'tests/fixture.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + '\n;this.json = t1Project();', ctx);
const page = 'file://' + path.resolve(SRC, '..', fs.readdirSync(path.join(SRC, '..')).filter(f => /^WBS_Schedule_EV_Tool_v.*\.html$/.test(f)).sort().pop());
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1600, height: 1000 } }), errs = [];
  pg.on('console', m => { if(m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push(e.message));
  pg.on('request', r => { if(!/^(file|blob|data):/.test(r.url())) errs.push('network: ' + r.url()); });
  await pg.addInitScript(j => { if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded', 1); localStorage.setItem('sd-wbs-ev:project', j); } }, ctx.json);
  await pg.goto(page);
  for(const t of ['wbs', 'gantt', 'status', 'week', 'ev', 'report']){ await pg.click('#t-' + t); if(!(await pg.locator('#p-' + t).innerText()).trim()) errs.push('empty tab ' + t); }
  await pg.click('#t-status'); const line = await pg.textContent('.reading');
  if(line !== 'By week 6: 10 planned to start, 8 started; 8 planned to finish, 6 finished.') errs.push('reading: ' + line);
  if((await pg.textContent('#sig')) !== 'Week 6: Re-plan') errs.push('signal: ' + await pg.textContent('#sig'));
  await pg.click('#bExample'); await pg.waitForTimeout(100);
  if(!(await pg.title()).startsWith('Example')) errs.push('example title: ' + await pg.title());
  if((await pg.textContent('#sig')) !== 'Week 6: Re-plan') errs.push('example signal: ' + await pg.textContent('#sig'));
  await b.close();
  console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'browser smoke passed'); process.exit(errs.length ? 1 : 0);
})();
