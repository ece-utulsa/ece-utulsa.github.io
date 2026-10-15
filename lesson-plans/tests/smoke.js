// Smoke test for all lesson plans: both editions of every lesson open, every section shows without a page error,
// nothing is fetched from the network, and the Student editions carry no teacher-only content.
// Run from anywhere:  NODE_PATH=$(npm root -g) node lesson-plans/tests/smoke.js
// Needs Playwright with Chromium. Set CHROMIUM=/path/to/chromium to use a particular browser binary.
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const LESSONS = [['tolerances-and-fits', 'Tolerances and Fits'], ['pvc-quad-course', 'PVC Quad Course'], ['cnc-machining-center', 'CNC Machining Center']];
// Teacher-only content: the plan section and answer paragraphs.
const TEACHER_ONLY = [/<section id="plan"/, /class="small ans"/, /Teacher notes/, /Learning objectives/];
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [dir, name] of LESSONS) for (const ed of ['Teacher', 'Student']) {
    console.log(`${name} — ${ed}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [], remote = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) remote.push(r.url()); });
    await page.goto('file://' + path.join(ROOT, dir, `${name} - ${ed}.html`));
    await page.waitForTimeout(1200);
    check((await page.title()).includes(ed + ' edition'), `title says "${ed} edition"`);
    const ids = await page.$$eval('#lnav .tabsrow [data-go]', bs => bs.map(b => b.dataset.go));
    check(ids.length >= 5, `section bar lists ${ids.length} sections`);
    for (const id of ids) { await page.$eval(`#lnav [data-go="${id}"]`, b => b.click()); await page.waitForTimeout(250);
      check(await page.$eval('#' + id, s => !s.hidden), `section ${id} shows`); }
    const html = await page.content();
    if (ed === 'Student') check(!TEACHER_ONLY.some(re => re.test(html)), 'no teacher-only content in the file');
    else check(TEACHER_ONLY.some(re => re.test(html)), 'teacher content present');
    check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    check(!remote.length, 'no network requests' + (remote.length ? ': ' + remote.join(' ') : ''));
    await page.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
