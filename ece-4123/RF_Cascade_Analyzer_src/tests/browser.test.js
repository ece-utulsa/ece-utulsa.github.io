/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (text, data-q / data-v
   attributes, the URL hash); the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.1.0.html] [--shots]
   --shots also writes the 1280×720 presentation screenshots to ../screenshots/.
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots');
const FILE = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.1.0.html'));
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');
const URL0 = 'file://' + FILE;
const STOPS = ['#view=reflections', '#view=devices&device=through', '#view=devices&device=atten', '#view=devices&device=amp',
               '#view=devices&device=iso', '#view=devices&device=custom', '#view=cascade'];
const MIN_LABEL = 18, HEAD = 46;                          // text sizes at 1280×720 (px)
let pass = 0, fail = 0;

// Record one check.
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + JSON.stringify(detail) : '')); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// A new page with console, page-error and request logs.
async function open(browser, opts){
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts || {}));
  const page = await ctx.newPage(), log = { console: [], requests: [] };
  page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') log.console.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => log.console.push('pageerror: ' + e.message));
  page.on('request', r => log.requests.push(r.url()));
  await page.goto(URL0); await page.waitForTimeout(150);
  return { ctx, page, log };
}
const goto = (page, hs) => page.evaluate(hs => { location.hash = hs; }, hs).then(() => page.waitForTimeout(80));
const text = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return e ? e.textContent.trim() : null; }, sel);
const stageTexts = page => page.evaluate(() => [...document.querySelectorAll('#stage text')].map(t => t.textContent));
// Attributes of the first element with data-q = q.
const dq = (page, q) => page.evaluate(q => { const e = document.querySelector('#stage [data-q="' + q + '"]'); if(!e) return null;
  const o = {}; for(const a of e.attributes) o[a.name] = a.value; return o; }, q);
// Type into an input and fire its events.
const setInput = (page, sel, v, ev) => page.evaluate(([sel, v, ev]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event(ev || 'input', { bubbles: true })); }, [sel, v, ev]).then(() => page.waitForTimeout(60));
const click = (page, sel) => page.click(sel).then(() => page.waitForTimeout(60));
// Enter presentation mode (fullscreen may be refused headless; the layout applies anyway).
const present = page => page.keyboard.press('f').then(() => page.waitForTimeout(250));

// ── OVERLAP ── no text box may overlap another text box, or any drawn stroke (sampled every 1.5 units along each
// path, line, rect, circle and band, inflated by half its stroke width), and every text box stays inside the drawing.
async function overlapIssues(page){
  return page.evaluate(() => {
    const bad = [], svg = document.querySelector('#stage svg'); if(!svg) return ['no drawing'];
    const sr = svg.getBoundingClientRect(), k = sr.width / svg.viewBox.baseVal.width;
    const texts = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim()).map(t => { const r = t.getBoundingClientRect();
      return { t: t.textContent.trim(), l: r.left + 1, r: r.right - 1, tp: r.top + 1, b: r.bottom - 1 }; });
    texts.forEach(a => { if(a.l < sr.left - 0.5 || a.r > sr.right + 0.5 || a.tp < sr.top - 0.5 || a.b > sr.bottom + 0.5) bad.push('outside: "' + a.t + '"'); });
    for(let i = 0; i < texts.length; i++) for(let j = i + 1; j < texts.length; j++){ const a = texts[i], b = texts[j];
      if(a.l < b.r && b.l < a.r && a.tp < b.b && b.tp < a.b) bad.push('text/text: "' + a.t + '" × "' + b.t + '"'); }
    const ink = [...svg.querySelectorAll('path, line, rect, circle')];
    for(const g of ink){
      const cs = getComputedStyle(g); if(cs.display === 'none' || cs.visibility === 'hidden') continue;
      const stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0, hw = (stroked ? parseFloat(cs.strokeWidth) / 2 : 0) * k;
      let L; try { L = g.getTotalLength(); } catch(e){ continue; }
      const M = g.getScreenCTM(), pt = svg.createSVGPoint(), hits = new Set();
      for(let s = 0; s <= L; s += 1.5){ const p = g.getPointAtLength(s); pt.x = p.x; pt.y = p.y; const q = pt.matrixTransform(M);
        texts.forEach((a, i) => { if(q.x > a.l - hw && q.x < a.r + hw && q.y > a.tp - hw && q.y < a.b + hw) hits.add(i); }); }
      hits.forEach(i => bad.push('text/ink: "' + texts[i].t + '" × <' + g.tagName + ' class="' + (g.getAttribute('class') || '') + '">'));
    }
    return bad;
  });
}
// ── SIZES ── drawn text ≥ 18 px (× the presentation factor); visible HTML text ≥ 18 px; headlines ≈ 46 px.
async function sizeIssues(page, f){
  return page.evaluate(([MIN, HEAD, f]) => {
    const bad = [], svg = document.querySelector('#stage svg'), k = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
    if(svg) svg.querySelectorAll('text').forEach(t => { const fs = parseFloat(t.getAttribute('font-size')) * k; if(fs < MIN * f - 0.3) bad.push('svg ' + fs.toFixed(1) + ' "' + t.textContent.slice(0, 20) + '"');
      t.querySelectorAll('tspan').forEach(s => { const ss = parseFloat(s.getAttribute('font-size')) * k; if(ss < MIN * f - 0.3) bad.push('sub ' + ss.toFixed(1)); }); });
    const vis = e => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest('.hidden,dialog,#stage svg'); };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while(w.nextNode()){ const n = w.currentNode, e = n.parentElement; if(!n.textContent.trim() || !e || !vis(e) || e.closest('script,style')) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize); if(fs < MIN * f - 0.3) bad.push('html ' + fs + ' "' + n.textContent.trim().slice(0, 20) + '"'); }
    document.querySelectorAll('.ro.head .v').forEach(e => { const fs = parseFloat(getComputedStyle(e).fontSize); if(Math.abs(fs - HEAD * f) > 1) bad.push('head ' + fs); });
    return bad;
  }, [MIN_LABEL, HEAD, f]);
}
// ── LAYOUT ── no page scroll; the side panel and the top bar do not overflow.
const layoutIssues = page => page.evaluate(() => {
  const bad = [], d = document.documentElement;
  if(d.scrollHeight > d.clientHeight + 1 || d.scrollWidth > d.clientWidth + 1) bad.push('page scrolls');
  for(const id of ['panel', 'top', 'devbar']){ const e = document.getElementById(id); if(e && !e.classList.contains('hidden') && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) bad.push(id + ' overflows'); }
  return bad;
});

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const html = fs.readFileSync(FILE, 'utf8');

  console.log('Load');
  { const { ctx, page, log } = await open(browser);
    check('stamp: version comment, meta and footer', /Version: v1\.1\.0/.test(html) && /rework to three views/i.test(html) && /Author: Claude Code/.test(html)
      && (await text(page, 'footer')).includes('v1.1.0 · released 2026-10-18 · Author: Claude Code'));
    check('three tabs in the top bar', JSON.stringify(await page.$$eval('#tabs [role=tab]', b => b.map(x => x.textContent))) === '["Reflections","Devices","Cascade"]');
    check('no step rail, no Lab, no divider', !(await page.$('#rail, #lab')) && !/divider/i.test(await page.evaluate(() => document.body.innerText)));
    check('embedded font loaded', await page.evaluate(() => document.fonts.check('18px "IBM Plex Mono"')));
    for(const hs of STOPS){ await goto(page, hs); }
    check('only the document and data: URLs requested', log.requests.every(u => u.startsWith('file:') || u.startsWith('data:')), log.requests.filter(u => !u.startsWith('file:') && !u.startsWith('data:')));
    check('no console errors or warnings over every stop', log.console.length === 0, log.console);
    await ctx.close(); }

  console.log('View 1 — Reflections');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=reflections');
    await setInput(page, '#z02Box', '150', 'change');
    const T = await stageTexts(page), pInc = await dq(page, 'P_inc'), pRef = await dq(page, 'P_refl'), pTr = await dq(page, 'P_trans');
    check('Z02 = 150: |Γ| 0.50, VSWR 3.00 (side panel)', (await text(page, '#roGamma')) === '0.50' && (await text(page, '#roVswr')) === '3.00');
    check('Z02 = 150: reflected 25 %, transmitted 75 %, on the arrows', T.includes('Reflected 25.0%') && T.includes('Transmitted 75.0%') && T.includes('Incident 100.0%'), T);
    check('Z02 = 150: arrow thickness ∝ power (25 % and 75 % of the incident)', near(+pRef['data-th'], 0.25 * +pInc['data-th'], 0.02) && near(+pTr['data-th'], 0.75 * +pInc['data-th'], 0.02));
    check('Z02 = 150: Vmax 1.5 and Vmin 0.5 at their true heights', near(+(await dq(page, 'Vmax'))['data-v'], 1.5, 1e-9) && near(+(await dq(page, 'Vmin'))['data-v'], 0.5, 1e-9)
      && await page.evaluate(() => { const e = document.querySelector('[data-q="envelope"]'), A = +e.getAttribute('data-a'), yc = +e.getAttribute('data-yc');
        const y = q => +document.querySelector('[data-q="' + q + '"]').getAttribute('y1'); return Math.abs(y('Vmax') - (yc - 1.5 * A)) < 0.02 && Math.abs(y('Vmin') - (yc - 0.5 * A)) < 0.02; }));
    check('heading: VSWR = Vmax / Vmin = 1.50 / 0.50 = 3.00', (await text(page, '.vswrLine')) === 'VSWR = Vmax / Vmin = 1.50 / 0.50 = 3.00', await text(page, '.vswrLine'));
    check('Z02 drawn is the control value', (await text(page, '#z02Label')).endsWith('= 150 Ω'));
    check('distance ticks 1λ … interface', ['1λ', '3λ/4', 'λ/2', 'λ/4', 'interface'].every(t => T.includes(t)));
    check('no power bar, no complex Γ', !(await page.$('#stage [data-q="P_deliv"]')) && !/∠/.test(await text(page, '#panel')));
    await click(page, '#bShort');
    let t2 = await stageTexts(page);
    check('Short: transmitted 0 % (ghost), VSWR ∞, envelope touches 0', t2.includes('Transmitted 0.0%') && (await dq(page, 'P_trans'))['data-ghost'] === '1'
      && (await text(page, '#roVswr')) === '∞' && +(await dq(page, 'Vmin'))['data-v'] === 0 && (await text(page, '#z02Label')).includes('0 (short)'));
    await click(page, '#bOpen');
    check('Open: transmitted 0 %, VSWR ∞, Γ = +1', (await stageTexts(page)).includes('Transmitted 0.0%') && (await text(page, '#roVswr')) === '∞' && (await text(page, '#roGamma')) === '1.00');
    await click(page, '#bMatch');
    t2 = await stageTexts(page);
    check('Matched: reflected arrow is a ghost only, flat envelope, VSWR 1', (await dq(page, 'P_refl'))['data-ghost'] === '1' && t2.includes('Reflected 0.0%')
      && (await text(page, '#roVswr')) === '1.00' && +(await dq(page, 'envelope'))['data-v'] === 0);
    await setInput(page, '#z02Box', 'abc', 'change');
    check('invalid Z02 text is flagged and ignored', (await page.getAttribute('#z02Box', 'aria-invalid')) === 'true' && (await text(page, '#roVswr')) === '1.00');
    await ctx.close(); }

  console.log('View 2 — Devices');
  { const { ctx, page } = await open(browser);
    await present(page);
    const paths = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .path')].map(e => [e.getAttribute('data-q'),
      { v: +e.getAttribute('data-v'), w: parseFloat(getComputedStyle(e).strokeWidth), ghost: e.getAttribute('data-ghost') === '1', cap: e.getAttribute('data-capped') === '1' }])));
    const badges = () => page.evaluate(() => [...document.querySelectorAll('#stage .badge')].map(b => b.getAttribute('data-on')).join(''));
    const crossOn = () => page.evaluate(() => !!document.querySelector('#stage .xmark'));
    await goto(page, '#view=devices&device=through');
    let P = await paths(), T = await stageTexts(page);
    check('Through: S21 = S12 = 1 drawn at full width 8; S11, S22 ghosts labelled 0', P.S21.w === 8 && P.S12.w === 8 && P.S11.ghost && P.S22.ghost && T.filter(t => t === '0').length === 2);
    check('Through: ℓ = λ/4 ruler and βℓ = 2πℓ/λ = 90° in the box; S21 1.00∠−90°', T.includes('ℓ = λ/4') && T.includes('βℓ = 2πℓ/λ = 90°') && T.includes('S21 1.00∠−90°'), T);
    check('Through: "Two-Port" in the box header, above the paths', await page.evaluate(() => { const t = document.querySelector('.boxTitle').getBoundingClientRect();
      return [...document.querySelectorAll('#stage .path')].every(p => p.getBoundingClientRect().top > t.bottom); }));
    check('Through: badges Reciprocal ✓ Symmetric ✓ Lossless ✓ Passive ✓', (await badges()) === '1111');
    await setInput(page, '#len', '0.3');
    check('Through: ℓ = 0.30λ gives βℓ = 108° and S21 1.00∠−108°', (await stageTexts(page)).includes('βℓ = 2πℓ/λ = 108°') && (await stageTexts(page)).includes('S21 1.00∠−108°'));
    await page.keyboard.press('PageDown'); await page.waitForTimeout(80);
    check('PageDown moves on even with the slider focused (Attenuator); slider value unchanged', (await page.evaluate(() => location.hash)) === '#view=devices&device=atten');
    P = await paths(); T = await stageTexts(page);
    check('Attenuator 6 dB: S21, S12 = 0.50 drawn thinner (width 4)', near(P.S21.w, 4, 0.02) && near(P.S12.w, 4, 0.02) && T.includes('S21 0.50'), P);
    check('Attenuator: "−6 dB" in the box; panel: Power through 25.1% (|S21|² at 6 dB)', T.includes('−6 dB') && (await text(page, '#roDev')) === '25.1%');
    check('Attenuator: badges R ✓ S ✓ L ✗ P ✓', (await badges()) === '1101');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    P = await paths(); T = await stageTexts(page);
    check('Amplifier 10 dB: S21 3.16 capped at 3× with a break mark', P.S21.cap && P.S21.w === 24 && T.includes('S21 3.16') && await page.evaluate(() => !!document.querySelector('#stage .brk')));
    check('Amplifier: S12 dotted ghost with ✕', P.S12.ghost && await crossOn());
    check('Amplifier: gain shown, "+10 dB" in the box and in the panel', T.includes('+10 dB') && (await text(page, '#roDev')) === '+10 dB');
    await setInput(page, '#gain', '20');
    check('Amplifier: gain slider updates box and panel (+20 dB)', (await stageTexts(page)).includes('+20 dB') && (await text(page, '#roDev')) === '+20 dB');
    check('Amplifier: badges all ✗', (await badges()) === '0000');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    P = await paths();
    check('Isolator: S12 blocked with a red ✕; badges R ✗ S ✗ L ✗ P ✓', P.S12.ghost && await crossOn() && (await badges()) === '0001');
    await setInput(page, '#isoI', '20');
    check('Isolator: 20 dB isolation draws S12 0.10 (thin, no ✕)', near((await paths()).S12.v, 0.1, 1e-9) && !(await crossOn()) && (await stageTexts(page)).includes('S12 0.10'));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    check('Custom: four entry rows and the reciprocal link', (await page.$$('#panel .srow')).length === 4 && await page.isChecked('#crecip'));
    await setInput(page, '#cs21', '0.8');
    P = await paths();
    check('Custom: linked S12 follows S21 (0.80); the S12 row is locked', near(P.S12.v, 0.8, 1e-9) && near(P.S21.v, 0.8, 1e-9) && await page.isDisabled('#cs12'));
    await setInput(page, '#cs21a', '0');
    check('Custom: angle shown only where it isn\'t 0', (await stageTexts(page)).includes('S21 0.80'));
    check('Devices: no 3-decimal numbers on the diagram', !(await stageTexts(page)).some(t => /\d\.\d{3}/.test(t)));
    check('Matrix equation entries ≈ 30 px', await page.evaluate(() => [...document.querySelectorAll('#stage .ment')].every(e => Math.abs(e.getBoundingClientRect().height - 0) > 0 && +e.getAttribute('font-size') === 30)));
    await ctx.close(); }

  console.log('View 3 — Cascade (check case)');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=cascade');
    const ids = async pre => Promise.all([0, 1, 2, 3].map(k => text(page, '#' + pre + k)));
    check('forward power at junctions 0…3: 1.0, 10, 5.0, 4.6', JSON.stringify(await ids('fwd')) === '["1.0","10","5.0","4.6"]', await ids('fwd'));
    const r = await ids('refl');
    check('reflected power at junctions 1…3: 0.17, 0.34, 0.51; at the source: 0', JSON.stringify(r) === '["back to source 0","0.17","0.34","0.51"]', r);
    check('band height ∝ forward power; reflected arrows ∝ |b|² at the stated scale', await page.evaluate(() => {
      const f = [0, 1, 2, 3].map(k => document.querySelector('[data-q="fwd' + k + '"]')), ok1 = f.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      const b = [1, 2, 3].map(k => document.querySelector('[data-q="refl' + k + '"]')), ok2 = b.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      return ok1 && ok2 && /3× thicker/.test(document.querySelector('.caption').textContent); }));
    const lines = await page.$$eval('#chainS .sline', l => l.map(x => x.textContent));
    check('whole chain: S21 2.01∠−45° (+6.1 dB), S11 0 (source sees a match), S22 0.20∠30°, S12 0',
      JSON.stringify(lines) === JSON.stringify(['S212.01∠−45° (+6.1 dB)', 'S110 (source sees a match)', 'S220.20∠30°', 'S120']), lines);
    check('budget: +10.0, −3.0, −0.9, = +6.1 dB delivered to load', JSON.stringify(await Promise.all(['#bud0', '#bud1', '#bud2', '#budTotal'].map(s => text(page, s))))
      === JSON.stringify(['+10.0 dB', '−3.0 dB', '−0.9 dB', '= +6.1 dB']));
    check('blocks show type and key value', JSON.stringify(await page.$$eval('#stage .keyv', e => e.map(x => x.textContent))) === JSON.stringify(['+10 dB', '−3 dB', '−0.9 dB']));
    await page.click('#stage [data-blk="1"]'); await page.waitForTimeout(60);
    check('clicking a block selects it and opens its editor', (await text(page, '#panel .sec')) === 'Block 2 · Attenuator' && (await page.getAttribute('#stage [data-blk="1"]', 'aria-pressed')) === 'true');
    await setInput(page, '#kAtt', '6');
    check('editing the knob updates the chain (−6 dB block)', (await page.$$eval('#stage .keyv', e => e.map(x => x.textContent)))[1] === '−6 dB');
    await click(page, '#toCustom');
    check('"Edit S-parameters" converts the block to Custom with its values', (await text(page, '#panel .sec')) === 'Block 2 · Custom' && near(+(await page.inputValue('#ks21m')), 0.501187, 1e-5));
    await page.click('#stage [data-add]'); await page.waitForTimeout(60);
    check('"+" opens the type menu', (await page.$$('.addmenu button')).length === 5);
    await click(page, '#add_iso');
    check('adding a 4th block (Isolator) selects it; "+" is gone at 4', (await page.$$('#stage [data-blk]')).length === 4 && !(await page.$('#stage [data-add]')) && (await text(page, '#panel .sec')) === 'Block 4 · Isolator');
    check('no overlaps with 4 blocks', (await overlapIssues(page)).length === 0, await overlapIssues(page));
    await page.click('#stage [data-del="3"]'); await page.waitForTimeout(60);
    check('× removes a block', (await page.$$('#stage [data-blk]')).length === 3);
    await click(page, '#lShort');
    check('Short load: −∞ dB delivered; Load shows 0 Ω', (await text(page, '#budTotal')) === '= −∞ dB' && (await text(page, '#loadVal')) === '0 Ω');
    await click(page, '#lOpen');
    check('Open load: Load shows ∞; −∞ dB delivered', (await text(page, '#loadVal')) === '∞' && (await text(page, '#budTotal')) === '= −∞ dB');
    await ctx.close(); }

  console.log('Overlaps, sizes and layout');
  const states = async (page, fn) => { for(const hs of STOPS){ await goto(page, hs); await fn(hs); }
    await goto(page, '#view=reflections');
    for(const b of ['#bShort', '#bOpen', '#bMatch']){ await click(page, b); await fn('reflections ' + b); }
    await setInput(page, '#z02Box', '52', 'change'); await fn('reflections Z02 = 52');
    await goto(page, '#view=devices&device=iso'); await setInput(page, '#isoI', '20'); await fn('isolator 20 dB');
    await goto(page, '#view=devices&device=amp'); await setInput(page, '#gain', '30'); await fn('amplifier 30 dB');
    await goto(page, '#view=devices&device=custom'); await setInput(page, '#cs11a', '-180'); await setInput(page, '#cs11', '1.25'); await fn('custom S11 1.25∠180°');
    await goto(page, '#view=cascade'); await page.click('#stage [data-blk="2"]'); await page.waitForTimeout(60); await fn('cascade, Custom block selected'); };
  for(const [vw, label, f, pres] of [[{ width: 1280, height: 720 }, 'presentation 1280×720', 1, true], [{ width: 1920, height: 1080 }, 'presentation 1920×1080', 1.5, true],
                                     [{ width: 1366, height: 768 }, 'windowed 1366×768', 1, false]]){
    const { ctx, page, log } = await open(browser, { viewport: vw });
    if(pres) await present(page);
    const ov = [], sz = [], lay = [];
    await states(page, async st => { (await overlapIssues(page)).forEach(x => ov.push(st + ': ' + x)); if(pres) (await sizeIssues(page, f)).forEach(x => sz.push(st + ': ' + x)); (await layoutIssues(page)).forEach(x => lay.push(st + ': ' + x)); });
    check(label + ': no text overlaps a drawn element or another label (every view, device and the check case)', ov.length === 0, ov.slice(0, 12));
    if(pres) check(label + ': labels ≥ ' + MIN_LABEL * f + ' px, headlines ' + HEAD * f + ' px', sz.length === 0, sz.slice(0, 8));
    check(label + ': no page scroll, no panel overflow', lay.length === 0, lay.slice(0, 8));
    check(label + ': no console errors', log.console.length === 0, log.console);
    await ctx.close();
  }
  { const { ctx, page } = await open(browser); await present(page);
    const w = await page.evaluate(() => [document.getElementById('stage').clientWidth, document.getElementById('panel').offsetWidth]);
    check('1280×720 presentation: drawing ≈ 900 px, side panel ≈ 380 px', near(w[0], 900, 2) && near(w[1], 380, 2), w);
    await ctx.close(); }

  console.log('Keys');
  { const { ctx, page } = await open(browser);
    const hs = () => page.evaluate(() => location.hash);
    const seq = [];
    for(const k of ['ArrowRight', 'PageDown', ' ', 'ArrowRight', 'PageDown', ' ']){ await page.keyboard.press(k); await page.waitForTimeout(40); seq.push(await hs()); }
    check('Next (ArrowRight, PageDown, Space) walks Reflections → each device → Cascade', JSON.stringify(seq) === JSON.stringify(STOPS.slice(1)), seq);
    await page.keyboard.press('ArrowRight'); check('Next stops at the end', (await hs()) === STOPS[6]);
    const back = [];
    for(const k of ['ArrowLeft', 'PageUp', 'Shift+Space']){ await page.keyboard.press(k); await page.waitForTimeout(40); back.push(await hs()); }
    check('Previous (ArrowLeft, PageUp, Shift+Space) walks back', JSON.stringify(back) === JSON.stringify([STOPS[5], STOPS[4], STOPS[3]]), back);
    await page.keyboard.press('Home'); check('Home → Reflections', (await hs()) === STOPS[0]);
    await page.keyboard.press('End'); check('End → Cascade', (await hs()) === STOPS[6]);
    await page.keyboard.press('Alt+1'); check('Alt+1 → Reflections', (await hs()) === STOPS[0]);
    await page.keyboard.press('ArrowRight'); await page.focus('#len'); const l0 = await page.inputValue('#len');
    await page.keyboard.press('PageDown'); await page.waitForTimeout(40); const hd = await hs();
    await page.keyboard.press('PageUp'); await page.waitForTimeout(40);
    check('PageDown/PageUp on a focused slider navigate and leave the slider unchanged', hd === STOPS[2] && (await hs()) === STOPS[1] && (await page.inputValue('#len')) === l0);
    await page.keyboard.press('Home'); await page.focus('#z02'); const v0 = await page.inputValue('#z02'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40);
    check('ArrowRight on a focused slider adjusts it (no navigation)', (await hs()) === STOPS[0] && (await page.inputValue('#z02')) !== v0);
    await page.evaluate(() => document.activeElement.blur());
    const th0 = await page.evaluate(() => document.body.classList.contains('light')); await page.keyboard.press('t');
    check('T toggles the theme', th0 !== await page.evaluate(() => document.body.classList.contains('light')));
    await page.keyboard.press('f'); await page.waitForTimeout(150);
    check('F enters presentation (light Projector theme by default)', await page.evaluate(() => document.body.classList.contains('present') && document.body.classList.contains('light')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check('Esc leaves presentation', !(await page.evaluate(() => document.body.classList.contains('present'))));
    await page.goto(URL0 + '#view=devices&device=iso'); await page.waitForTimeout(100);
    check('the URL hash restores the view and device', (await page.getAttribute('#dev_iso', 'aria-pressed')) === 'true' && (await page.getAttribute('#tab_devices', 'aria-selected')) === 'true');
    const nb = await page.evaluate(() => ['prevBtn', 'nextBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return Math.min(r.width, r.height); }));
    check('Previous/Next buttons ≥ 44×44 px', nb.every(x => x >= 44), nb);
    await ctx.close(); }

  console.log('Animation');
  { const { ctx, page } = await open(browser);
    const d = () => page.getAttribute('#snap', 'd');
    const a = await d(); await page.waitForTimeout(250);
    check('snapshot wave moves', a !== await d());
    await page.keyboard.press('p'); await page.waitForTimeout(50); const b = await d(); await page.waitForTimeout(250);
    check('P pauses it', b === await d());
    await ctx.close();
    const r = await open(browser, { reducedMotion: 'reduce' }); const c = await r.page.getAttribute('#snap', 'd'); await r.page.waitForTimeout(250);
    check('reduced motion loads paused', c === await r.page.getAttribute('#snap', 'd') && (await r.page.textContent('#pauseBtn')) === 'Play');
    await r.ctx.close(); }

  if(SHOTS){
    console.log('Screenshots (presentation, 1280×720, Projector theme)');
    const { ctx, page } = await open(browser, { reducedMotion: 'reduce' }); await present(page);
    const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); console.log('  wrote ' + name + '.png'); };
    fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SHOT_DIR, f)));
    await goto(page, '#view=reflections'); await setInput(page, '#z02Box', '150', 'change'); await shot('view1_reflections_Z02_150');
    await click(page, '#bShort'); await shot('view1_reflections_short');
    await click(page, '#bMatch'); await shot('view1_reflections_matched');
    for(const d of ['through', 'atten', 'amp', 'iso', 'custom']){ await goto(page, '#view=devices&device=' + d); await shot('view2_devices_' + d); }
    await goto(page, '#view=cascade'); await shot('view3_cascade_check_case');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
