// Digital Logic Breadboard — developer browser tests (Playwright + Chromium). Developer tests, not acceptance.
// Run from digital-logic/src:  python3 build.py && NODE_PATH=$(npm root -g) node tests/browser.test.js
// Serves the built bundle over a local HTTP server and drives it like a user.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
// The newest bundle: an older one may stay in the folder until its gates pass.
const vnum = f => f.match(/v(\d+)\.(\d+)\.(\d+)\.html$/).slice(1).reduce((n, x) => n*1000 + Number(x), 0);
const FILE = fs.readdirSync(ROOT).filter(f => /^Digital Logic Breadboard v\d+\.\d+\.\d+\.html$/.test(f)).sort((a, b) => vnum(a) - vnum(b)).pop();
const VERSION = FILE.match(/(v[\d.]+)\.html$/)[1];

let pass = 0, fail = 0;
async function t(name, fn){ try { await fn(); pass++; console.log('PASS', name); } catch(e){ fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
function ok(v, m){ if(!v) throw new Error(m || 'expected true'); }
function eq(a, b, m){ const x = JSON.stringify(a), y = JSON.stringify(b); if(x !== y) throw new Error((m||'')+' got '+x+' want '+y); }

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(ROOT) || !f.endsWith('.html') || !fs.existsSync(f)){ res.writeHead(204); res.end(); return; }   // favicon etc.: no content
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const URL = 'http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(FILE);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  // Fresh page; init() runs before the page's scripts. Collects page errors and console errors.
  async function open(init, opts){
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {}));
    const page = await ctx.newPage(); page.errors = [];
    page.on('pageerror', e => page.errors.push(String(e)));
    page.on('console', m => { if(m.type() === 'error') page.errors.push(m.text()); });
    page.on('dialog', d => { page.lastDialog = d.message(); d.type() === 'prompt' ? d.accept(page.promptAnswer || '') : d.accept(); });
    if(init) await page.addInitScript(init);
    await page.goto(URL); await page.waitForSelector('#pg-tut .wrap', { state: 'attached' }); await page.waitForTimeout(150);
    return page;
  }
  // Press an experiment card's Check and wait for its result (Check runs in time slices, CQ-DL-041).
  async function check(card){
    const chk = await card.$('button:has-text("Check")'); await chk.click();
    await card.waitForSelector('button:has-text("Check"):not([disabled])'); await card.waitForSelector('.res:not(:empty)');
  }
  // Load a circuit file through the real Import button.
  async function importJSON(page, j, name){
    await page.setInputFiles('#file', { name: name || 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j)) });
    await page.waitForTimeout(200);
  }

  await t('Loads clean: no page or console errors, version in title / meta / badge / stamp', async () => {
    const page = await open();
    eq(page.errors, []);
    eq(await page.title(), 'Digital Logic Breadboard '+VERSION);
    eq(await page.$eval('meta[name=version]', m => m.content), VERSION);
    eq(await page.$eval('.nav .ver', e => e.textContent), VERSION);
    const raw = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
    ok(/^<!DOCTYPE html>\n<!--\n  Digital Logic Breadboard\n  Version: v\d+\.\d+\.\d+\n  Released: \d{4}-\d\d-\d\d\n  Changelog: .+\n  Author: .+\n-->/.test(raw), 'stamp block (SEC-DL-001)');
    ok(!/preconnect/.test(raw), 'no preconnect hints (SEC-DL-010)');
    await page.context().close();
  });

  await t('No test hooks or test-only exports in the shipped page (SEC-DL-002; ruling 2026-10-17 (4), CQ-DL-031)', async () => {
    const page = await open();
    eq(await page.evaluate(() => [typeof window.__dlb, typeof window.DLB.EXPS]), ['undefined','undefined']);
    eq(await page.evaluate(() => ['readOut','FILE_V','SEG_7448'].filter(k => k in window.DLB)), []);
    eq(await page.$$eval('#__om-edit-overrides', a => a.length), 0);
    await page.context().close();
  });

  // The 7-SEG patterns themselves are checked against board.js in the model tests (the page no longer exports them).
  await t('7-SEG text: Experiment 8 and Tutorial §5 name the 7448 patterns, 6 and 9 without tails', async () => {
    const page = await open();
    const text = await page.$eval('#pg-exp', e => e.textContent);
    ok(/6 and 9 without tails/.test(text), 'Experiment 8 names 6 and 9');
    ok(/BCD to 7-segment \(7448\)/.test(text) && !/Hex to 7-segment/.test(text), 'Experiment 8 title');
    const tut = await page.$eval('#pg-tut', e => e.textContent);
    ok(/7448/.test(tut) && /carry-in/.test(tut) && !/in hexadecimal/.test(tut), 'Tutorial §5');
    await page.context().close();
  });

  await t('Run: reloading clock demos while running keeps one clock loop (CQ-DL-006)', async () => {
    const page = await open();
    for(let i=0;i<3;i++){ await page.click('#demos button:has-text("Binary counter")'); await page.waitForTimeout(30); }
    const n = await page.evaluate(() => new Promise(r => { let k = 0; const el = document.querySelector('#r-ck');
      const mo = new MutationObserver(() => k++); mo.observe(el, { childList:true, characterData:true, subtree:true });
      setTimeout(() => { mo.disconnect(); r(k); }, 2000); }));
    // 2 Hz = 4 toggles per second; a duplicated loop would toggle about twice as fast.
    ok(n >= 6 && n <= 10, 'toggles in 2 s at 2 Hz: '+n);
    await page.context().close();
  });

  await t('Run: a 3 s stall is not replayed as a burst of clock toggles (CQ-DL-007)', async () => {
    const page = await open();
    await page.click('#demos button:has-text("Binary counter")'); await page.waitForTimeout(300);
    const n = await page.evaluate(() => new Promise(r => { const t0 = performance.now(); while(performance.now() - t0 < 3000){} let k = 0;
      const el = document.querySelector('#r-ck'), mo = new MutationObserver(() => k++); mo.observe(el, { childList:true, characterData:true, subtree:true });
      setTimeout(() => { mo.disconnect(); r(k); }, 500); }));
    ok(n <= 3, 'toggles in 0.5 s after a 3 s stall: '+n+' (v1.0.0 gives about 12)');
    await page.context().close();
  });

  await t('Loading a demo draws the board at most twice (CQ-DL-004)', async () => {
    const page = await open(() => { const orig = CanvasRenderingContext2D.prototype.clearRect;
      window.__draws = 0; CanvasRenderingContext2D.prototype.clearRect = function(...a){ if(this.canvas.id === 'board') window.__draws++; return orig.apply(this, a); }; });
    await page.evaluate(() => { window.__draws = 0; });
    await page.click('#demos button:has-text("Half adder")'); await page.waitForTimeout(200);
    const n = await page.evaluate(() => window.__draws);
    ok(n >= 1 && n <= 2, 'board draws for one demo load: '+n+' (v1.0.0 about 25)');
    await page.context().close();
  });

  await t('Mouse moves over the Tutorial page do not redraw the board (CQ-DL-016)', async () => {
    const page = await open(() => { const orig = CanvasRenderingContext2D.prototype.clearRect;
      window.__draws = 0; CanvasRenderingContext2D.prototype.clearRect = function(...a){ if(this.canvas.id === 'board') window.__draws++; return orig.apply(this, a); }; });
    await page.click('.tabs button[data-pg=tut]'); await page.waitForTimeout(100);
    await page.evaluate(() => { window.__draws = 0; });
    for(let i=0;i<20;i++) await page.mouse.move(300 + i*20, 300 + i*5);
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => window.__draws), 0);
    await page.context().close();
  });

  await t('Storage blocked: tool starts fully, no error banner (CQ-DL-009)', async () => {
    const page = await open(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'QuotaExceededError'); }; });
    eq(page.errors, []);
    ok(await page.$eval('#pg-exp', e => e.querySelectorAll('.card').length) === 13, 'Experiments built');
    ok(await page.$eval('#themes', e => e.children.length) === 3, 'Tweaks built');
    eq(await page.$$eval('#__bundler_err', a => a.length), 0);
    await page.click('#demos button:has-text("Half adder")'); await page.waitForTimeout(100);
    eq(page.errors, []);
    await page.context().close();
  });

  await t('Tampered storage falls back to defaults (SEC-DL-006)', async () => {
    const page = await open(() => { if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
      localStorage.setItem('dlb.tweaks', '{"theme":"Nope","grid":"yes"}'); localStorage.setItem('dlb.hz', '-5'); localStorage.setItem('dlb.page', '"zzz"'); localStorage.setItem('dlb.timing', '"x"'); } });
    eq(page.errors, []);
    eq(await page.$eval('#hzv', e => e.textContent), '2 Hz');
    eq(await page.$eval('#themes button.on', e => e.textContent), 'Charcoal');
    ok(await page.$eval('#pg-sim', e => e.classList.contains('on')), 'Sim page shown');
    await page.context().close();
  });

  await t('Hostile Import is rejected with a named message; board unchanged (SEC-DL-004)', async () => {
    const page = await open();
    const before = await page.$eval('#r-n', e => e.textContent);
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:0, y:0, label:'A', state: JSON.parse('{"__proto__":{"p":1}}') }], wires:[] });
    ok(/unknown field/.test(page.lastDialog || ''), 'dialog: '+page.lastDialog);
    eq(await page.$eval('#r-n', e => e.textContent), before);
    page.lastDialog = null;
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:0, y:0, label:'<img src=x onerror=alert(1)>'.repeat(2) }], wires:[] });
    ok(/label/.test(page.lastDialog || ''), 'long label refused: '+page.lastDialog);
    eq(page.errors, []);
    await page.context().close();
  });

  await t('Truth table: 8 switches, 256 rows, no long task over 50 ms (CQ-DL-008)', async () => {
    const page = await open(() => { window.__long = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(e.duration))).observe({ type:'longtask' }); });
    const comps = [{ id:1, type:'ADD4', x:200, y:100 }], wires = [];
    for(let i=0;i<8;i++){ comps.push({ id:10+i, type:'SW', x:40, y:40*i, label:'I'+i }); wires.push({ from:{c:10+i,pin:0}, to:{c:1,pin:i} }); }
    for(let i=0;i<5;i++){ comps.push({ id:30+i, type:'PROBE', x:400, y:40*i, label:'O'+i }); wires.push({ from:{c:1,pin:i}, to:{c:30+i,pin:0} }); }
    let prev = 10; for(let i=0;i<60;i++){ comps.push({ id:100+i, type:'XOR', x:600, y:40*i }); wires.push({ from:{c:prev,pin:0}, to:{c:100+i,pin:0} }, { from:{c:11,pin:0}, to:{c:100+i,pin:1} }); prev = 100+i; }
    await importJSON(page, { v:2, comps, wires });
    await page.evaluate(() => { window.__long = []; });
    await page.click('#ttb');
    await page.waitForFunction(() => document.querySelectorAll('#ttbody table tr').length === 257, null, { timeout: 10000 });
    const long = await page.evaluate(() => window.__long);
    ok(!long.some(d => d > 50), 'long tasks: '+JSON.stringify(long.map(Math.round)));
    eq(page.errors, []);
    await page.context().close();
  });

  await t('Copy CSV quotes fields and neutralises formulas (SEC-DL-005)', async () => {
    const page = await open(null, { permissions: ['clipboard-read','clipboard-write'] });
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:40, y:40, label:'=1+1' }, { id:2, type:'PROBE', x:200, y:40, label:'a,"b' }], wires:[{ from:{c:1,pin:0}, to:{c:2,pin:0} }] });
    await page.click('#ttb'); await page.waitForSelector('#ttbody table');
    await page.click('#ttcopy'); await page.waitForTimeout(100);
    const csv = await page.evaluate(() => navigator.clipboard.readText());
    eq(csv.split('\n')[0], '"\'=1+1","a,""b"');
    eq(csv.split('\n')[1], '"0","0"');
    await page.context().close();
  });

  await t('Wiring onto a used input replaces the wire and says so; Undo brings it back (DL-010)', async () => {
    const page = await open();
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:40, y:40, label:'A' }, { id:2, type:'SW', x:40, y:160, label:'B' }, { id:3, type:'NOT', x:200, y:40 }],
                             wires:[{ from:{c:1,pin:0}, to:{c:3,pin:0} }] });
    // pin positions in page pixels: board view after import is unchanged (demo view 40,20 at scale 1)
    const pts = await page.evaluate(() => { const D = window.DLB, r = document.querySelector('#board').getBoundingClientRect(), v = { ox:40, oy:20, s:1 };
      const at = q => ({ x: r.left + v.ox + q.x*v.s, y: r.top + v.oy + q.y*v.s });
      return { from: at(D.pinPos({ type:'SW', x:40, y:160, rot:0 }, 'out', 0)), to: at(D.pinPos({ type:'NOT', x:200, y:40, rot:0 }, 'in', 0)) }; });
    await page.mouse.move(pts.from.x, pts.from.y); await page.mouse.down(); await page.mouse.move(pts.to.x, pts.to.y, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(100);
    const note = await page.$eval('#note', e => e.hidden ? '' : e.textContent);
    ok(/Replaced the wire into NOT input A/.test(note), 'notice: '+note);
    eq(await page.$eval('#r-w', e => e.textContent), '1');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
    eq(await page.$eval('#r-w', e => e.textContent), '1', 'still one wire after undo');
    await page.context().close();
  });

  await t('Experiment 7 Check passes a Q̄-chained ripple counter; card 8 has no Check', async () => {
    const page = await open();
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:40, y:40, label:'CK' }, { id:2, type:'DFF', x:160, y:40 }, { id:3, type:'DFF', x:320, y:40 },
      { id:4, type:'PROBE', x:480, y:40, label:'Q0' }, { id:5, type:'PROBE', x:480, y:120, label:'Q1' }],
      wires:[{ from:{c:2,pin:1}, to:{c:2,pin:0} }, { from:{c:3,pin:1}, to:{c:3,pin:0} }, { from:{c:1,pin:0}, to:{c:2,pin:1} }, { from:{c:2,pin:1}, to:{c:3,pin:1} },
             { from:{c:2,pin:0}, to:{c:4,pin:0} }, { from:{c:3,pin:0}, to:{c:5,pin:0} }] });
    await page.click('.tabs button[data-pg=exp]');
    const cards = await page.$$('#pg-exp .card');
    await check(cards[6]);
    ok(/PASS/.test(await cards[6].$eval('.res', e => e.textContent)), 'Exp 7 PASS');
    eq(await cards[7].$$eval('button', b => b.map(x => x.textContent)), ['Open board']);
    await page.context().close();
  });

  await t('Rename refuses a duplicate signal label across types (CQ-DL-010)', async () => {
    const page = await open();
    await importJSON(page, { v:2, comps:[{ id:1, type:'SW', x:40, y:40, label:'A' }, { id:2, type:'LED', x:200, y:40, label:'L1' }], wires:[] });
    const p = await page.evaluate(() => { const r = document.querySelector('#board').getBoundingClientRect(); return { x: r.left + 40 + 220, y: r.top + 20 + 60 }; });
    page.promptAnswer = 'A';
    await page.mouse.dblclick(p.x, p.y); await page.waitForTimeout(150);
    ok(/already the label of a SWITCH/.test(page.lastDialog || ''), 'refusal: '+page.lastDialog);
    await page.context().close();
  });

  await t('A v1.0.0 board saved with blank / duplicate labels reloads with fresh labels and a notice (CQ-DL-010)', async () => {
    const page = await open(() => { if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
      localStorage.setItem('dlb.circuit', JSON.stringify({ v:2, comps:[{id:1,type:'SW',x:40,y:40,rot:0,label:'',state:{on:0},prevClk:0},{id:2,type:'SW',x:40,y:120,rot:0,label:'',state:{on:1},prevClk:0},
        {id:3,type:'PROBE',x:200,y:40,rot:0,label:'P',state:{},prevClk:0},{id:4,type:'LED',x:200,y:120,rot:0,color:'red',label:'P',state:{},prevClk:0}], wires:[] })); } });
    eq(page.errors, []);
    eq(await page.$eval('#r-n', e => e.textContent), '4', 'board restored, not replaced by the demo');
    ok(/3 were changed/.test(await page.$eval('#note', e => e.textContent)), 'notice');
    await page.context().close();
  });

  // Board point -> page pixels, for the view an Import leaves (demo view 40,20 at scale 1).
  const atPage = (page, q) => page.evaluate(q => { const r = document.querySelector('#board').getBoundingClientRect(); return { x: r.left + 40 + q.x, y: r.top + 20 + q.y }; }, q);
  // The board as last saved to storage (saving is debounced, so wait for it).
  const saved = async page => { await page.waitForTimeout(600); return page.evaluate(() => JSON.parse(localStorage.getItem('dlb.circuit'))); };
  // Drag with the mouse between two page points.
  const drag = async (page, a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(100); };

  await t('A selected wire can be dragged by its middle; its tee handle sits beside it and still tees off (revision 2026-10-15)', async () => {
    const page = await open();
    // SW out (92,60) -> NOT in (188,160): Z route, vertical run at mx = 140
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:40, y:40, label:'A' }, { id:2, type:'NOT', x:200, y:140 }, { id:3, type:'NOT', x:200, y:260 }],
                             wires:[{ from:{c:1,pin:0}, to:{c:2,pin:0} }] });
    const mid = await atPage(page, { x:140, y:110 });
    await page.mouse.click(mid.x, mid.y); await page.waitForTimeout(100);
    await drag(page, mid, { x: mid.x + 20, y: mid.y });
    eq((await saved(page)).wires[0].mx, 160, 'second drag on the selected wire moved it');
    await drag(page, { x: mid.x + 20, y: mid.y }, { x: mid.x + 40, y: mid.y });
    eq((await saved(page)).wires[0].mx, 180, 'and again');
    // the handle: TEE_OFFSET (16) right of the vertical run's middle; drag it to the second NOT's input
    await drag(page, await atPage(page, { x:196, y:110 }), await atPage(page, { x:188, y:280 }));
    eq(await page.$eval('#r-w', e => e.textContent), '2', 'tee from the handle made a second wire');
    eq(page.errors, []);
    await page.context().close();
  });

  const HALF_ADDER = { v:3, comps:[{ id:1, type:'SW', x:0, y:100, label:'A' }, { id:2, type:'SW', x:0, y:180, label:'B' }, { id:3, type:'XOR', x:120, y:80 }, { id:4, type:'AND', x:120, y:200 },
      { id:5, type:'LED', x:260, y:100, label:'S' }, { id:6, type:'LED', x:260, y:220, label:'C' }],
    wires:[{ from:{c:1,pin:0}, to:{c:3,pin:0} }, { from:{c:2,pin:0}, to:{c:3,pin:1} }, { from:{c:1,pin:0}, to:{c:4,pin:0} }, { from:{c:2,pin:0}, to:{c:4,pin:1} },
           { from:{c:3,pin:0}, to:{c:5,pin:0} }, { from:{c:4,pin:0}, to:{c:6,pin:0} }] };
  await t('Make subsystem: box, name, one block; it is listed, survives reload, Undo and Ungroup bring the gates back', async () => {
    const page = await open(); page.promptAnswer = 'HA';
    await importJSON(page, HALF_ADDER);
    await page.click('#mksub'); ok(!(await page.$eval('#areachip', e => e.hidden)), 'area chip shown');
    await drag(page, await atPage(page, { x:100, y:60 }), await atPage(page, { x:220, y:300 }));
    eq(await page.$eval('#r-n', e => e.textContent), '5'); eq(await page.$eval('#r-w', e => e.textContent), '4');
    eq(await page.$$eval('#palette .sub button:first-child', b => b.map(x => x.textContent)), ['HA']);
    ok(/inputs A, B; outputs S, C/.test(await page.$eval('#note', e => e.textContent)), 'notice names the pins');
    await saved(page); await page.reload(); await page.waitForSelector('#pg-tut .wrap', { state: 'attached' }); await page.waitForTimeout(200);
    eq(await page.$eval('#r-n', e => e.textContent), '5', 'restored after reload');
    eq(await page.$$eval('#palette .sub button:first-child', b => b.map(x => x.textContent)), ['HA'], 'listed after reload');
    const blk = await atPage(page, { x:150, y:110 }); await page.mouse.click(blk.x, blk.y); await page.click('#ungrp'); await page.waitForTimeout(100);
    eq(await page.$eval('#r-n', e => e.textContent), '6', 'ungrouped'); eq(await page.$eval('#r-w', e => e.textContent), '6');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(100); eq(await page.$eval('#r-n', e => e.textContent), '5', 'undo ungroup');
    eq(page.errors, []);
    await page.context().close();
  });

  await t('Experiment 9 refuses a MUX hidden inside a subsystem', async () => {
    const page = await open(); page.promptAnswer = 'M';
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:0, y:40, label:'I0' }, { id:2, type:'SW', x:0, y:120, label:'I1' }, { id:3, type:'SW', x:140, y:-80, label:'S' },
      { id:4, type:'MUX2', x:120, y:40 }, { id:5, type:'PROBE', x:280, y:60, label:'Y' }],
      wires:[{ from:{c:1,pin:0}, to:{c:4,pin:0} }, { from:{c:2,pin:0}, to:{c:4,pin:1} }, { from:{c:3,pin:0}, to:{c:4,pin:2} }, { from:{c:4,pin:0}, to:{c:5,pin:0} }] });
    await page.click('#mksub'); await drag(page, await atPage(page, { x:110, y:30 }), await atPage(page, { x:210, y:130 }));
    eq(await page.$eval('#r-n', e => e.textContent), '5', 'MUX collapsed into M');
    await page.click('.tabs button[data-pg=exp]');
    const card = (await page.$$('#pg-exp .card'))[8]; await check(card);
    ok(/remove the MUX 2:1 part \(subsystems included\)/.test(await card.$eval('.res', e => e.textContent)), await card.$eval('.res', e => e.textContent));
    await page.context().close();
  });

  await t('Reduced motion turns off the timing-panel transition (CQ-DL-017)', async () => {
    const page = await open(null, { reducedMotion: 'reduce' });
    eq(await page.$eval('#timing', e => getComputedStyle(e).transitionDuration), '0s');
    await page.context().close();
  });

  await t('A saved board that fails validation: the demo loads and a notice names the cause (ruling 2026-10-17 (7))', async () => {
    const page = await open(() => { if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
      localStorage.setItem('dlb.circuit', JSON.stringify({ v:3, comps:[{ id:1, type:'NOPE', x:0, y:0 }], wires:[] })); } });
    eq(page.errors, []);
    eq(await page.$eval('#r-n', e => e.textContent), '8', 'Binary counter demo loaded');
    const note = await page.$eval('#note', e => e.hidden ? '' : e.textContent);
    ok(/could not be restored \(comps\[0\]: unknown part type "NOPE"\), so the Binary counter demo is shown/.test(note), 'notice: '+note);
    await page.context().close();
    const page2 = await open(() => { if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.setItem('dlb.circuit', '{not json'); } });
    ok(/the saved data is not readable/.test(await page2.$eval('#note', e => e.textContent)), 'unreadable storage named');
    await page2.context().close();
  });

  await t('CQ-DL-026 through the UI: Undo after clocking with CK HIGH fires no phantom edge', async () => {
    const page = await open();
    // D (0) and CK (0) switches into a D FF; a NOT to select and rotate (the edit Undo takes back); X triggers an update
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:40, y:40, label:'D' }, { id:2, type:'SW', x:40, y:140, label:'CK' }, { id:3, type:'DFF', x:160, y:60 },
      { id:4, type:'PROBE', x:320, y:60, label:'Q' }, { id:5, type:'NOT', x:160, y:240 }, { id:6, type:'SW', x:40, y:240, label:'X' }],
      wires:[{ from:{c:1,pin:0}, to:{c:3,pin:0} }, { from:{c:2,pin:0}, to:{c:3,pin:1} }, { from:{c:3,pin:0}, to:{c:4,pin:0} }] });
    const click = async q => { const p = await atPage(page, q); await page.mouse.click(p.x, p.y); await page.waitForTimeout(60); };
    const q = async () => (await saved(page)).comps.find(c => c.id === 3).state.q;
    await click({ x:200, y:260 }); await page.keyboard.press('r'); await page.waitForTimeout(60);   // edit: rotate the NOT
    await click({ x:60, y:160 });     // CK HIGH: Q = D = 0
    await click({ x:60, y:60 });      // D = 1 with CK HIGH: no edge
    eq(await q(), 0, 'Q before Undo');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
    await click({ x:60, y:260 });     // an unrelated switch: an ordinary update
    const j = await saved(page);
    eq([j.comps.find(c => c.id === 2).state.on, j.comps.find(c => c.id === 1).state.on, j.comps.find(c => c.id === 3).state.q], [0, 0, 0], 'CK, D, Q after Undo and an update');
    eq(page.errors, []);
    await page.context().close();
  });

  await t('Experiment 12 passes a synchronous counter built inside a subsystem (CQ-DL-038)', async () => {
    const page = await open();
    const inner = { comps:[{ id:1, type:'SW', x:0, y:0, label:'CK' }, { id:2, type:'TFF', x:100, y:0 }, { id:3, type:'TFF', x:100, y:100 }, { id:4, type:'HI', x:0, y:100 },
      { id:5, type:'PROBE', x:300, y:0, label:'Q0' }, { id:6, type:'PROBE', x:300, y:100, label:'Q1' }],
      wires:[{ from:{c:4,pin:0}, to:{c:2,pin:0} }, { from:{c:1,pin:0}, to:{c:2,pin:1} }, { from:{c:2,pin:0}, to:{c:3,pin:0} }, { from:{c:1,pin:0}, to:{c:3,pin:1} },
             { from:{c:2,pin:0}, to:{c:5,pin:0} }, { from:{c:3,pin:0}, to:{c:6,pin:0} }], ins:[1], outs:[5,6], auto:[] };
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:40, y:40, label:'CK' }, { id:2, type:'SUB:SC', x:160, y:40 },
      { id:3, type:'PROBE', x:320, y:40, label:'Q0' }, { id:4, type:'PROBE', x:320, y:120, label:'Q1' }],
      wires:[{ from:{c:1,pin:0}, to:{c:2,pin:0} }, { from:{c:2,pin:0}, to:{c:3,pin:0} }, { from:{c:2,pin:1}, to:{c:4,pin:0} }], subs:{ SC: inner } });
    eq(await page.$eval('#r-n', e => e.textContent), '4', 'imported');
    await page.click('.tabs button[data-pg=exp]');
    const card = (await page.$$('#pg-exp .card'))[11]; await check(card);
    const res = await card.$eval('.res', e => e.textContent); ok(/^PASS/.test(res), 'result: '+res);
    await page.context().close();
  });

  await t('Truth table flags a NOR latch built from gates as memory (DL-016)', async () => {
    const page = await open();
    await page.click('#demos button:has-text("SR latch")'); await page.waitForTimeout(100);
    await page.click('#ttb'); await page.waitForSelector('#ttbody table');
    ok(/This circuit has memory/.test(await page.$eval('#ttbody', e => e.textContent)), 'memory note');
    await page.context().close();
  });

  // ── Fix pass v1.3.1 ──
  // A board for Experiment 13 (SWITCH X, SWITCH CK, PROBE Z) that spends the whole work budget on every update: an
  // oscillator nested four subsystems deep, plus a chain of 390 gates (about 56 KB as a file).
  function workCapFile(){
    const subs = { L1: { comps:[{id:1,type:'SW',x:0,y:0,label:'I'},{id:2,type:'NOT',x:0,y:0},{id:3,type:'NOT',x:0,y:0},{id:4,type:'NOT',x:0,y:0},{id:5,type:'PROBE',x:0,y:0,label:'O'}],
      wires:[{from:{c:2,pin:0},to:{c:3,pin:0}},{from:{c:3,pin:0},to:{c:4,pin:0}},{from:{c:4,pin:0},to:{c:2,pin:0}},{from:{c:4,pin:0},to:{c:5,pin:0}}], ins:[1], outs:[5], auto:[] } };
    for(let L=2; L<=4; L++) subs['L'+L] = { comps:[{id:1,type:'SW',x:0,y:0,label:'I'},{id:2,type:'SUB:L'+(L-1),x:0,y:0},{id:3,type:'PROBE',x:0,y:0,label:'O'}],
      wires:[{from:{c:1,pin:0},to:{c:2,pin:0}},{from:{c:2,pin:0},to:{c:3,pin:0}}], ins:[1], outs:[3], auto:[] };
    const comps = [{id:1,type:'SW',x:40,y:40,label:'X'},{id:2,type:'SW',x:40,y:120,label:'CK'},{id:3,type:'DFF',x:160,y:40},{id:4,type:'PROBE',x:320,y:40,label:'Z'},{id:5,type:'SUB:L4',x:160,y:200}];
    const wires = [{from:{c:1,pin:0},to:{c:3,pin:0}},{from:{c:2,pin:0},to:{c:3,pin:1}},{from:{c:3,pin:0},to:{c:4,pin:0}},{from:{c:1,pin:0},to:{c:5,pin:0}}];
    let prev = 1; for(let i=0;i<390;i++){ const id = 100+i; comps.push({id,type:'XOR',x:400+(i%20)*100,y:300+Math.floor(i/20)*80}); wires.push({from:{c:prev,pin:0},to:{c:id,pin:0}},{from:{c:2,pin:0},to:{c:id,pin:1}}); prev = id; }
    return { v:3, comps, wires, subs };
  }
  const longTasks = () => { window.__long = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ type:'longtask' }); };

  await t('CQ-DL-041 / SEC-DL-018: Check on a work-cap board — no task over 50 ms, button disabled while running, same result as v1.3.0', async () => {
    const page = await open(longTasks);
    await importJSON(page, workCapFile()); await page.waitForTimeout(300);
    await page.click('.tabs button[data-pg=exp]'); await page.evaluate(() => { window.__long = []; });
    const card = (await page.$$('#pg-exp .card'))[12], chk = await card.$('button:has-text("Check")');
    await chk.click();
    ok(await chk.evaluate(b => b.disabled), 'Check disabled while it runs');
    await chk.click({ force:true }).catch(() => {});   // a second press while running is ignored
    await page.waitForFunction(b => !b.disabled, chk, { timeout: 20000 }); await page.waitForTimeout(200);
    const res = await card.$eval('.res', e => e.textContent);
    ok(/^FAIL — 10 of 22 vectors differ/.test(res), 'result: '+res.slice(0, 60));
    eq(await card.$$eval('.res table', a => a.length), 1, 'one result table (the second press did not run again)');
    const long = await page.evaluate(() => window.__long); ok(!long.some(d => d > 50), 'long tasks: '+JSON.stringify(long));
    eq(page.errors, []);
    await page.context().close();
  });

  await t('CQ-DL-041: truth table of a work-cap board — no task over 50 ms', async () => {
    const page = await open(longTasks);
    await importJSON(page, workCapFile()); await page.waitForTimeout(300); await page.evaluate(() => { window.__long = []; });
    await page.click('#ttb'); await page.waitForFunction(() => document.querySelectorAll('#ttbody table tr').length === 5, null, { timeout: 20000 }); await page.waitForTimeout(200);
    const long = await page.evaluate(() => window.__long); ok(!long.some(d => d > 50), 'long tasks: '+JSON.stringify(long));
    await page.context().close();
  });

  await t('SEC-DL-019: Import refuses a bidi control in a label, naming it; Rename refuses it too', async () => {
    const page = await open();
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:40, y:40, label:'A\u202E' }], wires:[] });
    ok(/label holds a bidirectional control character \(U\+202E\)/.test(page.lastDialog || ''), 'Import: '+page.lastDialog);
    await importJSON(page, { v:3, comps:[{ id:1, type:'SW', x:40, y:40, label:'A' }], wires:[] });
    const p = await atPage(page, { x:60, y:60 }); page.promptAnswer = 'B\u2067';
    await page.mouse.dblclick(p.x, p.y); await page.waitForTimeout(150);
    ok(/bidirectional control character \(U\+2067\)/.test(page.lastDialog || ''), 'Rename: '+page.lastDialog);
    await page.context().close();
  });

  await browser.close(); server.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail ? 1 : 0);
})();
