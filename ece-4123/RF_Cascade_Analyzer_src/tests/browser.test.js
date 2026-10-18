/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (text, data-q / data-v
   attributes, the URL hash); the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.2.0.html] [--shots]
   --shots also writes the 1280×720 presentation screenshots to ../screenshots/.
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots');
const FILE = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.2.0.html'));
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');
const URL0 = 'file://' + FILE;
const STOPS = ['#view=reflections', '#view=devices&device=through&drive=fwd', '#view=devices&device=atten&drive=fwd', '#view=devices&device=amp&drive=fwd',
               '#view=devices&device=iso&drive=fwd', '#view=devices&device=custom&drive=fwd', '#view=cascade'];
const REV_STOPS = STOPS.slice(1, 6).map(x => x.replace('drive=fwd', 'drive=rev'));
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
      if(!stroked && (cs.fill === 'none' || g.tagName === 'line')) continue;   // draws nothing (e.g. a zero-width data marker)
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
    const vis = e => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest('.hidden,dialog,#stage svg'); };   // #verStamp is 14 px by design (v1.2.0 1c)
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while(w.nextNode()){ const n = w.currentNode, e = n.parentElement; if(!n.textContent.trim() || !e || !vis(e) || e.closest('script,style,#verStamp')) continue;
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

// ── CASCADE "+" ── the "+" sits on the wire between the last block and the Load with ≥ 8 px clear on each side, and does
// not overlap any block, the Load or a × button (v1.2.0 item 5).
const plusIssues = page => page.evaluate(() => {
  const bad = [], p = document.querySelector('#stage [data-add] circle').getBoundingClientRect(), wire = document.querySelector('#stage .wire').getBoundingClientRect();
  const blocks = [...document.querySelectorAll('#stage .block')].map(b => b.getBoundingClientRect()), last = blocks[blocks.length - 1], load = document.querySelector('#stage .load').getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  if(p.left - last.right < 8) bad.push('too close to the last block: ' + (p.left - last.right).toFixed(1));
  if(load.left - p.right < 8) bad.push('too close to the Load: ' + (load.left - p.right).toFixed(1));
  if(!(p.top < wire.top + 1 && p.bottom > wire.bottom - 1)) bad.push('not on the wire');
  blocks.concat([load], [...document.querySelectorAll('#stage [data-del]')].map(d => d.getBoundingClientRect())).forEach((r, i) => { if(hit(p, r)) bad.push('overlaps element ' + i); });
  return bad;
});
// ── DEVICES GAPS ── on screen, in px: box bottom → b labels ≥ 24; b labels → matrix ≥ 16; numeric line → badges ≥ 12;
// badges → bottom of the screen ≥ 12; every a/b label ≥ 16 from the drawing's left edge and from the drawing/panel divider.
const devGapIssues = page => page.evaluate(() => {
  const bad = [], R = e => e.getBoundingClientRect(), svg = R(document.querySelector('#stage svg')), box = R(document.querySelector('#stage .box'));
  const labs = ['wa1', 'wa2', 'wb1', 'wb2'].map(id => [id, R(document.getElementById(id))]), b = labs.filter(([id]) => id[1] === 'b').map(([, r]) => r);
  const mat = R(document.querySelector('#stage .matrix')), num = R(document.getElementById('numLine')), badges = [...document.querySelectorAll('#stage .badge')].map(R);
  const g = (name, v, min) => { if(v < min - 0.05) bad.push(name + ' ' + v.toFixed(1) + ' < ' + min); };
  b.forEach(r => g('box→b label', r.top - box.bottom, 24)); b.forEach(r => g('b label→matrix', mat.top - r.bottom, 16));
  g('numeric line→badges', Math.min(...badges.map(r => r.top)) - num.bottom, 12); g('badges→screen bottom', window.innerHeight - Math.max(...badges.map(r => r.bottom)), 12);
  labs.forEach(([id, r]) => { g(id + ' from left edge', r.left - svg.left, 16); g(id + ' from divider', svg.right - r.right, 16); });
  const head = +document.querySelector('#stage .box').nextElementSibling.getAttribute('y1') - +document.querySelector('#stage .box').getAttribute('y');
  if(head > 90) bad.push('header band ' + head);
  if([...document.querySelectorAll('#stage .ment')].some(e => +e.getAttribute('font-size') < 30)) bad.push('matrix entries < 30');
  if([...document.querySelectorAll('#stage .badge text')].some(e => +e.getAttribute('font-size') < 18)) bad.push('badge text < 18');
  return bad;
});
// ── ALIGNMENT ── Cascade: reflected arrows and values centred on their junction (the forward-power marker's x), budget
// values centred on their block, within ±6 px on screen.
const alignIssues = page => page.evaluate(() => {
  const bad = [], cxOf = e => { const r = e.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const svg = document.querySelector('#stage svg'), M = svg.getScreenCTM();
  const blocks = [...document.querySelectorAll('#stage .block')];
  for(let k = 0; ; k++){ const j = document.querySelector('#stage [data-q="fwd' + k + '"]'); if(!j) break;
    const jx = +j.getAttribute('x1') * M.a + M.e, arrow = document.querySelector('#stage [data-q="refl' + k + '"]'), val = document.getElementById('refl' + k);
    if(Math.abs(cxOf(arrow) - jx) > 6) bad.push('reflected arrow ' + k + ' off by ' + (cxOf(arrow) - jx).toFixed(1));
    if(k > 0 && Math.abs(cxOf(val) - jx) > 6) bad.push('reflected value ' + k + ' off by ' + (cxOf(val) - jx).toFixed(1));
    if(k === 0 && Math.abs(cxOf(val) - jx) > 6 && val.getBoundingClientRect().left > svg.getBoundingClientRect().left + 8) bad.push('back-to-source value off by ' + (cxOf(val) - jx).toFixed(1)); }
  blocks.forEach((b, i) => { const v = document.getElementById('bud' + i); if(Math.abs(cxOf(v) - cxOf(b)) > 6) bad.push('budget ' + i + ' off by ' + (cxOf(v) - cxOf(b)).toFixed(1)); });
  return bad;
});

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const html = fs.readFileSync(FILE, 'utf8');

  console.log('Load');
  { const { ctx, page, log } = await open(browser);
    check('version v1.2.0: header comment, Released, meta, title; the changelog starts a v1.2.0 entry and keeps v1.1.0 below it',
      /Version: v1\.2\.0/.test(html) && /Released: 2026-10-18/.test(html) && /<meta name="version" content="v1\.2\.0">/.test(html) && /<title>RF Cascade Analyzer v1\.2\.0<\/title>/.test(html)
      && /v1\.2\.0 - Three views \(Reflections, Devices, Cascade\); normalized waves a\/b on Devices with forward\/reverse drive; version stamp in presentation mode; layout fixes\./.test(html)
      && html.indexOf('v1.2.0 - Three views') < html.indexOf('v1.1.0 - ') && /spec_RF_Cascade_Analyzer_v1\.1\.0/.test(html) && !/RF Cascade Analyzer v1\.1\.0|content="v1\.1\.0"/.test(html));
    check('footer: v1.2.0 · released 2026-10-18 · Author: Claude Code', /Author: Claude Code/.test(html)
      && (await text(page, 'footer')).includes('v1.2.0 · released 2026-10-18 · Author: Claude Code'));
    const stamp = async () => page.evaluate(() => { const v = document.getElementById('verStamp'), r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const btns = [...document.querySelectorAll('#top button')].filter(b => b.getBoundingClientRect().width), last = btns[btns.length - 1].getBoundingClientRect(), top = document.getElementById('top').getBoundingClientRect();
      return { text: v.textContent, fs: parseFloat(cs.fontSize), mut: cs.color === getComputedStyle(document.querySelector('.note') || document.body).color || cs.color !== getComputedStyle(document.body).color,
        right: r.left >= last.right && r.right <= top.right + 0.5, shown: r.width > 0 && cs.visibility !== 'hidden', body: document.body.innerText.includes('v1.2.0'),
        oneRow: btns.every(b => { const r = b.getBoundingClientRect(), r0 = btns[0].getBoundingClientRect(); return Math.abs((r.top + r.bottom) - (r0.top + r0.bottom)) < 2; }) }; });
    let st = await stamp();
    check('stamp "v1.2.0" in the top bar, right of the last button, 14 px, muted (windowed)', st.text === 'v1.2.0' && st.fs === 14 && st.right && st.shown && st.mut && st.oneRow, st);
    const wBtn = await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(','));
    await present(page); st = await stamp();
    check('presentation (light): stamp visible right of Present; body.innerText contains "v1.2.0"; buttons one row', st.shown && st.right && st.body && st.oneRow && st.fs === 14, st);
    await page.keyboard.press('t'); await page.waitForTimeout(60); st = await stamp();
    check('presentation (dark): stamp still visible', st.shown && st.body && await page.evaluate(() => !document.body.classList.contains('light')));
    await page.keyboard.press('t'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('the stamp does not resize the buttons', wBtn === await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(',')));
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
    check('Z02 = 150: |Γ| 0.50, VSWR 3.0 (side panel, 2 significant figures)', (await text(page, '#roGamma')) === '0.50' && (await text(page, '#roVswr')) === '3.0');
    check('Z02 = 150: reflected 25 %, transmitted 75 %, on the arrows', T.includes('Reflected 25 %') && T.includes('Transmitted 75 %') && T.includes('Incident 100 %'), T);
    check('Z02 = 150: arrow thickness ∝ power (25 % and 75 % of the incident)', near(+pRef['data-th'], 0.25 * +pInc['data-th'], 0.02) && near(+pTr['data-th'], 0.75 * +pInc['data-th'], 0.02));
    check('Z02 = 150: Vmax 1.5 and Vmin 0.5 at their true heights', near(+(await dq(page, 'Vmax'))['data-v'], 1.5, 1e-9) && near(+(await dq(page, 'Vmin'))['data-v'], 0.5, 1e-9)
      && await page.evaluate(() => { const e = document.querySelector('[data-q="envelope"]'), A = +e.getAttribute('data-a'), yc = +e.getAttribute('data-yc');
        const y = q => +document.querySelector('[data-q="' + q + '"]').getAttribute('y1'); return Math.abs(y('Vmax') - (yc - 1.5 * A)) < 0.02 && Math.abs(y('Vmin') - (yc - 0.5 * A)) < 0.02; }));
    check('heading: VSWR = Vmax / Vmin = 1.5 / 0.50 = 3.0', (await text(page, '.vswrLine')) === 'VSWR = Vmax / Vmin = 1.5 / 0.50 = 3.0', await text(page, '.vswrLine'));
    check('Vmax / Vmin labels "Vmax 1.5", "Vmin 0.50" in the neutral text colour (not an S colour)', T.includes('Vmax 1.5') && T.includes('Vmin 0.50')
      && await page.evaluate(() => [...document.querySelectorAll('#stage .level')].every(e => e.getAttribute('stroke') === 'var(--txt)')
        && [...document.querySelectorAll('#stage text')].filter(t => /^Vm(ax|in)/.test(t.textContent)).every(t => t.getAttribute('fill') === 'var(--txt)')));
    check('Z02 drawn is the control value', (await text(page, '#z02Label')).endsWith('= 150 Ω'));
    check('distance ticks 1λ … interface', ['1λ', '3λ/4', 'λ/2', 'λ/4', 'interface'].every(t => T.includes(t)));
    check('no power bar, no complex Γ', !(await page.$('#stage [data-q="P_deliv"]')) && !/∠/.test(await text(page, '#panel')));
    await click(page, '#bShort');
    let t2 = await stageTexts(page);
    check('Short: transmitted 0 % (ghost), VSWR ∞, envelope touches 0', t2.includes('Transmitted 0 %') && (await dq(page, 'P_trans'))['data-ghost'] === '1'
      && (await text(page, '#roVswr')) === '∞' && +(await dq(page, 'Vmin'))['data-v'] === 0 && (await text(page, '#z02Label')).includes('0 (short)'));
    await click(page, '#bOpen');
    check('Open: transmitted 0 %, VSWR ∞, |Γ| 1.0', (await stageTexts(page)).includes('Transmitted 0 %') && (await text(page, '#roVswr')) === '∞' && (await text(page, '#roGamma')) === '1.0');
    await click(page, '#bMatch');
    t2 = await stageTexts(page);
    check('Matched: reflected arrow is a ghost only, flat envelope, VSWR 1.0', (await dq(page, 'P_refl'))['data-ghost'] === '1' && t2.includes('Reflected 0 %')
      && (await text(page, '#roVswr')) === '1.0' && +(await dq(page, 'envelope'))['data-v'] === 0);
    await setInput(page, '#z02Box', 'abc', 'change');
    check('invalid Z02 text is flagged and ignored', (await page.getAttribute('#z02Box', 'aria-invalid')) === 'true' && (await text(page, '#roVswr')) === '1.0');
    await setInput(page, '#z02Box', '150', 'change'); await page.keyboard.press('p'); await page.waitForTimeout(50);
    const d0 = await page.getAttribute('#snap', 'd'); await page.keyboard.press('t'); await page.waitForTimeout(80);
    const d1 = await page.getAttribute('#snap', 'd'), dark = await page.evaluate(() => !document.body.classList.contains('light'));
    check('snapshot wave: the same phase in the dark and the light theme (theme change does not move it)', dark && d0 === d1);
    await ctx.close(); }

  console.log('View 2 — Devices');
  { const { ctx, page } = await open(browser);
    await present(page);
    const paths = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .path')].map(e => [e.getAttribute('data-q'),
      { v: +e.getAttribute('data-v'), w: parseFloat(getComputedStyle(e).strokeWidth), ghost: e.getAttribute('data-ghost') === '1', cap: e.getAttribute('data-capped') === '1',
        op: +e.getAttribute('opacity'), live: e.parentElement.getAttribute('data-live') === '1', gop: +(e.parentElement.getAttribute('opacity') || 1) }])));
    const badges = () => page.evaluate(() => [...document.querySelectorAll('#stage .badge')].map(b => b.getAttribute('data-on')).join(''));
    const crossOn = () => page.evaluate(() => !!document.querySelector('#stage .xmark'));
    const waves = () => page.evaluate(() => Object.fromEntries(['a1', 'a2', 'b1', 'b2'].map(k => [k, document.getElementById('w' + k).textContent])));
    const ghostW = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .wave')].map(e => [e.getAttribute('data-q'), e.getAttribute('data-ghost') === '1'])));
    const heads = async () => [null, await text(page, '#roPower')];
    const keys = async () => [null, await page.evaluate(() => document.getElementById('roPower').previousSibling.textContent)];
    const outLabel = () => page.evaluate(() => { const d = location.hash.includes('drive=rev') ? 'wb1' : 'wb2', e = document.getElementById(d); return { size: +e.getAttribute('font-size'), weight: e.getAttribute('font-weight') }; });
    // Forward check cases
    await goto(page, '#view=devices&device=through');
    check('Devices defaults to Forward; hash gains &drive=fwd', (await page.evaluate(() => location.hash)) === STOPS[1] && (await page.getAttribute('#drive_fwd', 'aria-pressed')) === 'true');
    let W = await waves(), P = await paths(), T = await stageTexts(page);
    check('Through ℓ = λ/4, Forward: a1 = 1∠0°, a2 = 0, b1 = 0, b2 = 1.00∠−90°', JSON.stringify(W) === JSON.stringify({ a1: 'a1 = 1∠0°', a2: 'a2 = 0', b1: 'b1 = 0', b2: 'b2 = 1.00∠−90°' }), W);
    { const gw = await ghostW(); check('Through Forward: zero waves a2, b1 drawn as ghosts', gw.a1 === false && gw.b1 === true && gw.a2 === true && gw.b2 === false, gw); }
    check('Through Forward panel: the power only, power out = |b2|² = 100 %; no "b2 =" headline (item 4)', (await heads())[1] === '100 %' && (await keys())[1] === 'power out = |b2|²'
      && (await page.$$('#panel .ro.head')).length === 1 && !/b2 =/.test(await text(page, '#panel')));
    check('the driven output label (b2 in Forward) is 22 px bold', JSON.stringify(await outLabel()) === '{"size":22,"weight":"700"}' && +(await page.getAttribute('#wb1', 'font-size')) === 18);
    check('Forward: S11, S21 at full strength; S12, S22 faded to 25 %', P.S11.live && P.S21.live && !P.S12.live && !P.S22.live && P.S12.gop === 0.25 && P.S22.gop === 0.25);
    check('numeric line: [0 ; 1.00∠−90°] = [S] · [1∠0° ; 0]', (await text(page, '#numLine')) === '[0 ; 1.00∠−90°] = [S] · [1∠0° ; 0]', await text(page, '#numLine'));
    check('caption: "a, b = normalized waves (a = V⁺/√Z0). Power = |wave|²."; never "power wave"', (await text(page, '#panel')).includes('a, b = normalized waves (a = V⁺/√Z0). Power = |wave|².')
      && !/power wave/i.test(await page.evaluate(() => document.body.innerText)));
    check('Through: S21 = S12 = 1 drawn at full width 8; S11, S22 ghosts labelled 0 at ≥ 60 % opacity', P.S21.w === 8 && P.S12.w === 8 && P.S11.ghost && P.S22.ghost && P.S11.op >= 0.6 && T.filter(t => t === '0').length === 2);
    check('|S| printed on every path (S11, S21, S12, S22)', await page.evaluate(() => ['vs11', 'vs21', 'vs12', 'vs22'].every(id => !!document.getElementById(id))));
    check('Through: ℓ = λ/4 ruler and βℓ = 2πℓ/λ = 90° in the box; S21 1.00∠−90°', T.includes('ℓ = λ/4') && T.includes('βℓ = 2πℓ/λ = 90°') && T.includes('S21 1.00∠−90°'), T);
    check('Through: "Two-Port" in the box header, above the paths', await page.evaluate(() => { const t = document.querySelector('.boxTitle').getBoundingClientRect();
      return [...document.querySelectorAll('#stage .path')].every(p => p.getBoundingClientRect().top > t.bottom); }));
    check('Through: badges Reciprocal ✓ Symmetric ✓ Lossless ✓ Passive ✓; badge text ≥ 18 px', (await badges()) === '1111'
      && await page.evaluate(() => [...document.querySelectorAll('#stage .badge text')].every(t => +t.getAttribute('font-size') >= 18)));
    await setInput(page, '#len', '0.3');
    check('Through: ℓ = 0.30λ gives βℓ = 108°, S21 1.00∠−108° and b2 = 1.00∠−108°', (await stageTexts(page)).includes('βℓ = 2πℓ/λ = 108°') && (await stageTexts(page)).includes('S21 1.00∠−108°') && (await waves()).b2 === 'b2 = 1.00∠−108°');
    await setInput(page, '#len', '0.25');
    await page.keyboard.press('PageDown'); await page.waitForTimeout(80);
    check('PageDown moves on even with the slider focused (Attenuator), keeping Forward', (await page.evaluate(() => location.hash)) === STOPS[2]);
    P = await paths(); T = await stageTexts(page); W = await waves();
    check('Attenuator opens at 3 dB: "−3 dB" in the box; S21, S12 = 0.71 drawn thinner', T.includes('−3 dB') && near(P.S21.w, 8 * 0.7079, 0.02) && T.includes('S21 0.71'), P);
    check('Attenuator 3 dB, Forward: b1 = 0, b2 = 0.71∠0°; power out = |b2|² = 50 %', W.b1 === 'b1 = 0' && W.b2 === 'b2 = 0.71∠0°' && (await heads())[1] === '50 %');
    check('Attenuator: badges R ✓ S ✓ L ✗ P ✓', (await badges()) === '1101');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    P = await paths(); T = await stageTexts(page); W = await waves();
    check('Amplifier 10 dB, Forward: b1 = 0, b2 = 3.16∠0°; |b2|² = 10 × input', W.b1 === 'b1 = 0' && W.b2 === 'b2 = 3.16∠0°' && (await heads())[1] === '10 × input');
    check('Amplifier: S21 3.16 capped at 3× with a break mark', P.S21.cap && P.S21.w === 24 && T.includes('S21 3.16') && await page.evaluate(() => !!document.querySelector('#stage .brk')));
    check('Amplifier: S12 dotted ghost with ✕', P.S12.ghost && await crossOn());
    const chev = () => page.evaluate(() => { const g = document.querySelector('#stage .pathg.s21'), c = g.querySelector('.chev'), p = g.querySelector('.path'), r = c.getBBox(), w = parseFloat(getComputedStyle(p).strokeWidth);
      return { fill: c.getAttribute('fill'), fits: Math.max(r.width, r.height) <= w + 0.5 }; });
    check('Amplifier 10 dB: the S21 direction triangle is background-coloured inside the thick band (item 6)', JSON.stringify(await chev()) === '{"fill":"var(--bg)","fits":true}', await chev());
    check('Amplifier: gain shown, "+10 dB" in the box', T.includes('+10 dB'));
    await setInput(page, '#gain', '20');
    await setInput(page, '#gain', '30');
    check('Amplifier 30 dB (maximum): the triangle is still background-coloured inside the band', JSON.stringify(await chev()) === '{"fill":"var(--bg)","fits":true}');
    await setInput(page, '#gain', '20');
    check('Amplifier: gain slider updates the box and the waves (+20 dB, b2 = 10.00∠0°, 100 × input)', (await stageTexts(page)).includes('+20 dB') && (await waves()).b2 === 'b2 = 10.00∠0°' && (await heads())[1] === '100 × input');
    check('Amplifier: badges all ✗', (await badges()) === '0000');
    await setInput(page, '#gain', '10');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    P = await paths(); W = await waves();
    check('Isolator: S12 blocked with a red ✕; badges R ✗ S ✗ L ✗ P ✓', P.S12.ghost && await crossOn() && (await badges()) === '0001');
    check('Isolator Forward: b1 = 0; b2 follows the forward loss (0.5 dB → 0.94∠0°, 89 %)', W.b1 === 'b1 = 0' && W.b2 === 'b2 = 0.94∠0°' && (await heads())[1] === '89 %');
    await setInput(page, '#isoIL', '1');
    check('Isolator Forward: 1 dB forward loss → b2 = 0.89∠0°, 79 %', (await waves()).b2 === 'b2 = 0.89∠0°' && (await heads())[1] === '79 %');
    await setInput(page, '#isoIL', '0.5');
    await setInput(page, '#isoI', '20');
    check('Isolator: 20 dB isolation draws S12 0.10 (thin, no ✕)', near((await paths()).S12.v, 0.1, 1e-9) && !(await crossOn()) && (await stageTexts(page)).includes('S12 0.10'));
    // Reverse check cases
    await click(page, '#drive_rev');
    check('Reverse button: hash &drive=rev', (await page.evaluate(() => location.hash)) === '#view=devices&device=iso&drive=rev');
    W = await waves(); P = await paths();
    check('Isolator Reverse, 20 dB: a2 = 1∠0°, b1 = |S12| = 0.10∠0°, b2 = 0', W.a2 === 'a2 = 1∠0°' && W.a1 === 'a1 = 0' && W.b1 === 'b1 = 0.10∠0°' && W.b2 === 'b2 = 0', W);
    check('Reverse: S12, S22 at full strength; S21, S11 faded', P.S12.live && P.S22.live && !P.S21.live && !P.S11.live && P.S21.gop === 0.25);
    check('Reverse panel: power out = |b1|² = 1.0 %; the driven output label is now b1 (22 px bold)', (await keys())[1] === 'power out = |b1|²' && (await heads())[1] === '1.0 %'
      && JSON.stringify(await outLabel()) === '{"size":22,"weight":"700"}' && +(await page.getAttribute('#wb2', 'font-size')) === 18);
    await setInput(page, '#isoI', '60'); await page.evaluate(() => { const r = document.getElementById('isoI'); r.value = 61; r.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(60);
    check('Isolator Reverse, ∞ isolation: b1 = 0, shown blocked (✕), box shows ∞ placeholder', (await waves()).b1 === 'b1 = 0' && await crossOn() && (await page.inputValue('#isoIN')) === '');
    await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    check('Previous keeps the drive (Amplifier, Reverse)', (await page.evaluate(() => location.hash)) === '#view=devices&device=amp&drive=rev');
    W = await waves();
    check('Amplifier Reverse: b1 = 0, blocked with ✕; b2 = S22·a2 = 0', W.b1 === 'b1 = 0' && W.b2 === 'b2 = 0' && await crossOn() && (await heads())[1] === '0 %');
    check('numeric line (Amplifier, Reverse): [0 ; 0] = [S] · [0 ; 1∠0°]', (await text(page, '#numLine')) === '[0 ; 0] = [S] · [0 ; 1∠0°]');
    await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    check('Attenuator Reverse: b1 = 0.71∠0°, 50 %', (await waves()).b1 === 'b1 = 0.71∠0°' && (await heads())[1] === '50 %');
    await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    W = await waves();
    check('Through Reverse: b1 = 1.00∠−90°, b2 = 0', W.b1 === 'b1 = 1.00∠−90°' && W.b2 === 'b2 = 0', W);
    await click(page, '#drive_fwd');
    await page.goto(URL0 + '#view=devices&device=custom&drive=rev'); await page.waitForTimeout(150);
    check('hash round-trip: #view=devices&device=custom&drive=rev restores Custom in Reverse', (await page.getAttribute('#dev_custom', 'aria-pressed')) === 'true'
      && (await page.getAttribute('#drive_rev', 'aria-pressed')) === 'true' && (await page.evaluate(() => location.hash)) === '#view=devices&device=custom&drive=rev');
    await click(page, '#drive_fwd');
    check('Custom: four entry rows and the reciprocal link', (await page.$$('#panel .srow')).length === 4 && await page.isChecked('#crecip'));
    await setInput(page, '#cs21', '0.8');
    P = await paths();
    check('Custom: linked S12 follows S21 (0.80); the S12 row is locked', near(P.S12.v, 0.8, 1e-9) && near(P.S21.v, 0.8, 1e-9) && await page.isDisabled('#cs12'));
    await setInput(page, '#cs21a', '0');
    check('Custom: |S| angle shown only where it isn\'t 0; the wave shows ∠0° (b2 = 0.80∠0°)', (await stageTexts(page)).includes('S21 0.80') && (await waves()).b2 === 'b2 = 0.80∠0°');
    check('Devices: no 3-decimal numbers on the diagram', !(await stageTexts(page)).some(t => /\d\.\d{3}/.test(t)));
    check('Matrix equation entries 30 px; numeric line 22 px', await page.evaluate(() => [...document.querySelectorAll('#stage .ment')].every(e => +e.getAttribute('font-size') === 30)
      && +document.getElementById('numLine').getAttribute('font-size') === 22));
    await ctx.close(); }

  console.log('Devices layout (v1.2.0 items 2, 3)');
  { const { ctx, page } = await open(browser); await present(page);
    const gi = [];
    for(const hs of STOPS.slice(1, 6).concat(REV_STOPS)){ await goto(page, hs); (await devGapIssues(page)).forEach(x => gi.push(hs.replace('#view=devices&', '') + ': ' + x)); }
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30'); (await devGapIssues(page)).forEach(x => gi.push('amp 30 dB: ' + x));
    await goto(page, '#view=devices&device=custom&drive=fwd'); await setInput(page, '#cs11a', '-180'); await setInput(page, '#cs11', '1.25'); (await devGapIssues(page)).forEach(x => gi.push('custom S11 1.25∠180°: ' + x));
    check('gaps: box→b labels ≥ 24, labels→matrix ≥ 16, numeric→badges ≥ 12, badges→bottom ≥ 12; header ≤ 90 (every device, Forward and Reverse)', gi.length === 0, gi.slice(0, 10));
    check('labels ≥ 16 px from the left edge and the divider (all devices F/R; Custom 0.60∠−70°, 0.30∠40°, 0.40∠−20°; amp 30 dB; S11 1.25∠180°)', !gi.some(x => /edge|divider/.test(x)));
    await ctx.close(); }

  console.log('View 3 — Cascade (check case)');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=cascade');
    const ids = async pre => Promise.all([0, 1, 2, 3].map(k => text(page, '#' + pre + k)));
    check('forward power at junctions 0…3: 1.0, 10, 5.0, 4.6', JSON.stringify(await ids('fwd')) === '["1.0","10","5.0","4.6"]', await ids('fwd'));
    const r = await ids('refl');
    check('reflected power at junctions 1…3: 0.17, 0.34, 0.51; at the source: 0', JSON.stringify(r) === '["back to source 0","0.17","0.34","0.51"]', r);
    const al = await alignIssues(page);
    check('alignment: each reflected arrow and value centred under its junction, each budget value under its block (±6 px)', al.length === 0, al);
    check('band height ∝ forward power; reflected arrows ∝ |b|², exaggerated by the factor the caption states', await page.evaluate(() => {
      const f = [0, 1, 2, 3].map(k => document.querySelector('[data-q="fwd' + k + '"]')), ok1 = f.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      const b = [1, 2, 3].map(k => document.querySelector('[data-q="refl' + k + '"]')), ok2 = b.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      const m = /drawn ([\d.]+)× thicker/.exec(document.querySelector('.caption').textContent), sc = +f[0].dataset.ref;
      return ok1 && ok2 && !!m && b.every(e => Math.abs(+e.dataset.ref / sc - +m[1]) < 0.051); }));
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
    check('"+" has its own slot on the wire after the last block, before the Load, clear of both (item 5)', (await plusIssues(page)).length === 0, await plusIssues(page));
    await page.click('#stage [data-add]'); await page.waitForTimeout(60);
    check('"+" opens the type menu', (await page.$$('.addmenu button')).length === 5);
    await click(page, '#add_iso');
    check('adding a 4th block (Isolator) selects it; "+" is disabled and greyed at 4', (await page.$$('#stage [data-blk]')).length === 4 && (await page.getAttribute('#stage [data-add]', 'aria-disabled')) === 'true'
      && (await page.getAttribute('#stage [data-add]', 'opacity')) === '0.35' && (await text(page, '#panel .sec')) === 'Block 4 · Isolator');
    await page.click('#stage [data-add]', { force: true }); await page.waitForTimeout(60);
    check('the disabled "+" does not open the menu', !(await page.$('.addmenu')));
    check('4 blocks: the "+" tooltip reads "Up to 4 blocks"; still clear of blocks, Load and × buttons', (await page.textContent('#stage [data-add] title')) === 'Up to 4 blocks' && (await plusIssues(page)).length === 0, await plusIssues(page));
    check('no overlaps with 4 blocks', (await overlapIssues(page)).length === 0, await overlapIssues(page));
    check('alignment with 4 blocks (±6 px)', (await alignIssues(page)).length === 0, await alignIssues(page));
    await page.click('#stage [data-del="3"]'); await page.waitForTimeout(60);
    check('× removes a block; the "+" is enabled again and still clear', (await page.$$('#stage [data-blk]')).length === 3 && !(await page.getAttribute('#stage [data-add]', 'aria-disabled')) && (await plusIssues(page)).length === 0);
    await click(page, '#lShort');
    check('Short load: −∞ dB delivered; Load shows 0 Ω', (await text(page, '#budTotal')) === '= −∞ dB' && (await text(page, '#loadVal')) === '0 Ω');
    await click(page, '#lOpen');
    check('Open load: Load shows ∞; −∞ dB delivered', (await text(page, '#loadVal')) === '∞' && (await text(page, '#budTotal')) === '= −∞ dB');
    await ctx.close(); }

  console.log('Overlaps, sizes and layout');
  const states = async (page, fn) => { for(const hs of STOPS.concat(REV_STOPS)){ await goto(page, hs); await fn(hs); }
    await goto(page, '#view=reflections');
    for(const b of ['#bShort', '#bOpen', '#bMatch']){ await click(page, b); await fn('reflections ' + b); }
    await setInput(page, '#z02Box', '52', 'change'); await fn('reflections Z02 = 52');
    await goto(page, '#view=devices&device=iso'); await setInput(page, '#isoI', '20'); await fn('isolator 20 dB');
    await goto(page, '#view=devices&device=amp'); await setInput(page, '#gain', '30'); await fn('amplifier 30 dB');
    await goto(page, '#view=devices&device=custom'); await setInput(page, '#cs11a', '-180'); await setInput(page, '#cs11', '1.25'); await fn('custom S11 1.25∠180°');
    await goto(page, '#view=devices&device=amp&drive=rev'); await fn('amplifier 30 dB, reverse');
    await goto(page, '#view=devices&device=custom&drive=fwd');
    await goto(page, '#view=cascade'); await page.click('#stage [data-blk="2"]'); await page.waitForTimeout(60); await fn('cascade, Custom block selected');
    await page.click('#stage [data-add]'); await page.waitForTimeout(60); await click(page, '#add_amp'); await fn('cascade, 4 blocks');
    await page.click('#stage [data-del="3"]'); await page.waitForTimeout(60); };
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
    for(const d of ['through', 'atten', 'amp', 'iso', 'custom']){ await goto(page, '#view=devices&device=' + d + '&drive=fwd'); await shot('view2_devices_' + d + '_forward'); }
    for(const d of ['through', 'amp', 'custom']){ await goto(page, '#view=devices&device=' + d + '&drive=rev'); await shot('view2_devices_' + d + '_reverse'); }
    await goto(page, '#view=devices&device=through&drive=fwd');
    await goto(page, '#view=cascade'); await shot('view3_cascade_check_case');
    await page.click('#stage [data-add]'); await page.waitForTimeout(60); await click(page, '#add_iso'); await shot('view3_cascade_4_blocks');
    await page.click('#stage [data-del="3"]'); await page.waitForTimeout(60); await shot('view3_cascade_4_blocks_then_remove_one');
    await goto(page, '#view=reflections'); await page.keyboard.press('t'); await page.waitForTimeout(80); await shot('dark_reflections_version_stamp');
    await page.keyboard.press('t');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
