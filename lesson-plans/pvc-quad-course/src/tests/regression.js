// PVC Quad Course developer test: the example path, the three block programs and the autopilot fly the original
// course with 3 stars and no contacts, and the autopilot flies every preset course from the designer.
// Build first, then:  NODE_PATH=$(npm root -g) node tests/regression.js      (from src/)
// It writes a debug copy of the Teacher edition (internals exposed as window.__dbg) to the system temp folder.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const built = path.join(__dirname, '..', '..', 'PVC Quad Course - Teacher.html');
const end = 'requestAnimationFrame(frame);\n})();';
let s = fs.readFileSync(built, 'utf8');
if (s.split(end).length !== 2) { console.error('cannot find the end of the app script'); process.exit(1); }
s = s.replace(end, 'window.__dbg={S,setLevel,setMode,applyCourse,COURSE0,scoreNow,get level(){return level},speed:v=>speedMul=v};\n' + end);
const dbg = path.join(os.tmpdir(), 'pvc-quad-debug.html'); fs.writeFileSync(dbg, s);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('file://' + dbg); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  // Fly in the current mode at 4x and wait for the end of the flight.
  const fly = async (startSel) => {
    await page.evaluate(() => __dbg.speed(4)); await page.$eval(startSel, b => b.click());
    for (let i = 0; i < 600; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => __dbg.S.done)) break; }
    return page.evaluate(() => { const sc = __dbg.scoreNow(); return { stars: sc.stars, met: sc.met, n: sc.L.length, contacts: __dbg.S.contacts, t: +__dbg.S.t.toFixed(1) }; });
  };
  const ok3 = (r, what) => check(r.stars === 3 && r.met === r.n && r.contacts === 0, `${what}: ${r.met}/${r.n} goals, ${r.contacts} contacts, ${r.t} s, ${r.stars} stars`);
  await page.$eval('#lnav [data-go="plan2"]', b => b.click()); await page.click('#pedExample');
  ok3(await fly('#btnGo'), 'path example, full course');
  await page.$eval('#lnav [data-go="prog"]', b => b.click());
  for (const [btn, what] of [['#blkEx1', 'program: Gate 1 and back'], ['#blkEx2', 'program: pick and drop with a sensor'], ['#blkEx3', 'program: full course']]) {
    await page.click(btn); await page.waitForTimeout(200); ok3(await fly('#blkRun'), what); }
  await page.$eval('#lnav [data-go="auto"]', b => b.click()); await page.evaluate(() => __dbg.setLevel(3));
  ok3(await fly('#btnGo'), 'autopilot, full course');
  await page.$eval('#lnav [data-go="design"]', b => b.click());
  for (const k of ['slalom', 'high', 'empty']) {
    await page.click(`[data-pre="${k}"]`); await page.waitForTimeout(200); await page.click('#desCheck0'); await page.waitForTimeout(300);
    check(await page.$$eval('#desCheck li', l => l.length > 0 && l.every(x => x.className === 'ok')), `course check passes: ${k}`);
    await page.evaluate(() => { __dbg.setLevel(3); __dbg.setMode('auto'); });
    ok3(await fly('#btnGo'), `autopilot on preset course: ${k}`);
  }
  await page.click('[data-pre="orig"]');
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
