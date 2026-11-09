// Regenerate the guide's screenshots from the built tool (change briefing C2). Rerun on every release, after build.py,
// so the pictures always match the tool. Opens the built-in lecture example (week 6) and captures four tabs at
// 1440 x 860, JPEG quality 82, into ../guide-img/. Each file must stay under 250 kB.
//
//   NODE_PATH=$(npm root -g) node screenshots.js                 # guide pictures
//   NODE_PATH=$(npm root -g) node screenshots.js --release DIR   # also all six tabs and the guide page, for a pull request
'use strict';
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const SITE = path.join(__dirname, '..'), OUT = path.join(SITE, 'guide-img');
const VERSION = /VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, 'build.py'), 'utf8'))[1];
const TOOL = path.join(SITE, `WBS_Schedule_EV_Tool_v${VERSION}.html`);
const rel = process.argv.indexOf('--release'), RELDIR = rel > 0 ? path.resolve(process.argv[rel + 1]) : null;
const MAX = 250 * 1024;

(async () => {
  if(!fs.existsSync(TOOL)) throw new Error('Build first: ' + TOOL + ' is missing.');
  const b = await chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + TOOL);
  await pg.click('#bExample');
  const shot = async (file, full) => { await pg.mouse.move(0, 0); await pg.screenshot({ path: file, type: 'jpeg', quality: 82, fullPage: !!full }); };
  const guide = [
    ['wbs.jpg', async () => { await pg.click('#t-wbs'); await pg.selectOption('[data-key=level-wbs]', '4');
      const id = await pg.evaluate(() => [...document.querySelectorAll('.namebtn')].find(x => x.textContent === 'Schematic capture').dataset.id);
      await pg.click(`[data-key="row:${id}"]`); }],
    ['schedule.jpg', async () => { await pg.click('#t-gantt'); await pg.selectOption('[data-key=level-gantt]', '4'); await pg.selectOption('[data-key=zoom]', 'sd1'); }],
    ['this-week.jpg', async () => { await pg.click('#t-week'); await pg.evaluate(() => { const c = document.querySelector('#p-week .card:nth-child(2)'); if(c) c.scrollIntoView(); }); }],
    ['earned-value.jpg', async () => { await pg.click('#t-ev'); await pg.evaluate(() => window.scrollTo(0, 0)); }],
  ];
  for(const [file, go] of guide){
    await go(); await pg.waitForTimeout(150);
    const f = path.join(OUT, file); await shot(f);
    const kb = fs.statSync(f).size / 1024;
    console.log(`${file}  ${kb.toFixed(0)} kB`);
    if(kb * 1024 > MAX) errs.push(`${file} is ${kb.toFixed(0)} kB, over 250 kB`);
  }
  if(RELDIR){
    fs.mkdirSync(RELDIR, { recursive: true });
    await pg.evaluate(() => window.scrollTo(0, 0));
    for(const t of ['wbs', 'gantt', 'status', 'week', 'ev', 'report']){ await pg.click('#t-' + t); await pg.waitForTimeout(150); await shot(path.join(RELDIR, `tab-${t}.jpg`), true); }
    await pg.goto('file://' + path.join(SITE, 'WBS_Schedule_EV_Tool_Guide.html')); await pg.waitForTimeout(300);
    await shot(path.join(RELDIR, 'guide-page.jpg'), true);
    console.log('release screenshots in', RELDIR);
  }
  await b.close();
  if(errs.length){ console.error('FAIL\n' + errs.join('\n')); process.exit(1); }
})();
