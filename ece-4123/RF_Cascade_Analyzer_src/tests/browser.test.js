/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (text, data-q / data-v
   attributes, the URL hash); the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.4.0.html] [--shots]
   --shots also writes the 1280×720 presentation screenshots to ../screenshots/.
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots');
const FILE = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.4.0.html'));
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');
const URL0 = 'file://' + FILE;
const STOPS = ['#view=reflections&vr=1', '#view=devices&device=through&drive=fwd', '#view=devices&device=atten&drive=fwd', '#view=devices&device=amp&drive=fwd',
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
      const cs = getComputedStyle(g); if(cs.display === 'none' || cs.visibility === 'hidden' || g.closest('defs, mask')) continue;   // mask shapes draw nothing
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
    // captions (class caption16) are ~16 px muted by design (v1.4.0 A.2, C.3)
    if(svg) svg.querySelectorAll('text').forEach(t => { const fs = parseFloat(t.getAttribute('font-size')) * k; if(fs < (t.classList.contains('caption16') ? 16 : MIN) * f - 0.3) bad.push('svg ' + fs.toFixed(1) + ' "' + t.textContent.slice(0, 20) + '"');
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

// ── CLEARANCE ── every drawn label ≥ 16 px from the screen's left and bottom edges and from the drawing/panel divider
// (v1.4.0, all views).
const edgeIssues = page => page.evaluate(() => {
  const bad = [], svg = document.querySelector('#stage svg').getBoundingClientRect();
  document.querySelectorAll('#stage svg text').forEach(t => { const r = t.getBoundingClientRect(), n = '"' + t.textContent.slice(0, 16) + '"'; if(!r.width) return;
    if(r.left - svg.left < 15.5) bad.push(n + ' left ' + (r.left - svg.left).toFixed(1)); if(svg.right - r.right < 15.5) bad.push(n + ' divider ' + (svg.right - r.right).toFixed(1));
    if(window.innerHeight - r.bottom < 15.5) bad.push(n + ' bottom ' + (window.innerHeight - r.bottom).toFixed(1)); });
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
// ── DEVICES LAYOUT ── on screen, in px: box → matrix ≥ 16; numeric row → badges ≥ 12; badges → bottom of the screen
// ≥ 12; every label and both matrix rows ≥ 16 from the drawing's left edge and from the drawing/panel divider; inside
// the box no text but the four S name tags, which stay inside it (v1.3.0 items 1, 6; v1.4.0 B.2); between a port's two
// wires no text but its Port label (v1.4.0 B.1).
const devGapIssues = page => page.evaluate(() => {
  const bad = [], R = e => e.getBoundingClientRect(), svg = R(document.querySelector('#stage svg')), box = R(document.querySelector('#stage .box'));
  const mat = R(document.querySelector('#stage .matrix')), num = R(document.getElementById('numRow')), badges = [...document.querySelectorAll('#stage .badge')].map(R);
  const g = (name, v, min) => { if(v < min - 0.05) bad.push(name + ' ' + v.toFixed(1) + ' < ' + min); };
  g('box→matrix', mat.top - box.bottom, 16);
  g('numeric row→badges', Math.min(...badges.map(r => r.top)) - num.bottom, 12); g('badges→screen bottom', window.innerHeight - Math.max(...badges.map(r => r.bottom)), 12);
  g('matrix rows from left edge', Math.min(mat.left, num.left) - svg.left, 16); g('matrix rows from divider', svg.right - Math.max(mat.right, num.right), 16);
  g('row 1 → row 2', num.top - mat.bottom, 4);
  const wy = q => { const r = R(document.querySelector('#stage .wave[data-q="' + q + '"]')); return (r.top + r.bottom) / 2; };
  [...document.querySelectorAll('#stage svg text')].filter(t => !t.closest('.matrix, .badge, .numrow') && !t.classList.contains('port')).forEach(t => { const r = R(t), c = (r.top + r.bottom) / 2;
    if((r.right <= box.left && c > wy('a1') && c < wy('b1')) || (r.left >= box.right && c > wy('b2') && c < wy('a2'))) bad.push('between the wires: "' + t.textContent + '"'); });
  const texts = [...document.querySelectorAll('#stage svg text')].filter(t => !t.closest('.matrix, .badge, .numrow'));
  texts.forEach(t => { const r = R(t), name = t.id || t.textContent.slice(0, 12); g(name + ' from left edge', r.left - svg.left, 16); g(name + ' from divider', svg.right - r.right, 16);
    const inside = r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top, sLab = /^vs(11|21|12|22)$/.test(t.id);
    if(inside && !sLab) bad.push('text inside the box: "' + t.textContent + '"');
    if(sLab && !(r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom)) bad.push(t.id + ' not inside the box'); });
  if([...document.querySelectorAll('#stage .ment')].some(e => +e.getAttribute('font-size') < 30)) bad.push('matrix entries < 30');
  if([...document.querySelectorAll('#stage .badge text')].some(e => +e.getAttribute('font-size') < 18)) bad.push('badge text < 18');
  return bad;
});
// ── ALIGNMENT ── Cascade: reflected arrows and values centred on their junction (the forward-power marker's x), budget
// values and river arithmetic centred on their block, within ±6 px on screen.
const alignIssues = page => page.evaluate(() => {
  const bad = [], cxOf = e => { const r = e.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const svg = document.querySelector('#stage svg'), M = svg.getScreenCTM();
  const blocks = [...document.querySelectorAll('#stage .block')];
  for(let k = 0; ; k++){ const j = document.querySelector('#stage [data-q="fwd' + k + '"]'); if(!j) break;
    const jx = +j.getAttribute('x1') * M.a + M.e, arrow = document.querySelector('#stage [data-q="refl' + k + '"]'), val = document.getElementById('refl' + k);
    if(Math.abs(cxOf(arrow) - jx) > 6) bad.push('reflected arrow ' + k + ' off by ' + (cxOf(arrow) - jx).toFixed(1));
    if(k > 0 && Math.abs(cxOf(val) - jx) > 6) bad.push('reflected value ' + k + ' off by ' + (cxOf(val) - jx).toFixed(1));
    if(k === 0 && Math.abs(cxOf(val) - jx) > 6 && val.getBoundingClientRect().left > svg.getBoundingClientRect().left + 8) bad.push('back-to-source value off by ' + (cxOf(val) - jx).toFixed(1)); }
  blocks.forEach((b, i) => { const v = document.getElementById('bud' + i), a = document.getElementById('ar' + i);
    if(Math.abs(cxOf(v) - cxOf(b)) > 6) bad.push('budget ' + i + ' off by ' + (cxOf(v) - cxOf(b)).toFixed(1));
    if(Math.abs(cxOf(a) - cxOf(b)) > 6) bad.push('arithmetic ' + i + ' off by ' + (cxOf(a) - cxOf(b)).toFixed(1)); });
  return bad;
});

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const html = fs.readFileSync(FILE, 'utf8');

  console.log('Load');
  { const { ctx, page, log } = await open(browser);
    check('version v1.4.0: header comment, Released, meta, title; changelog v1.4.0 on top, then v1.3.0, v1.2.1, v1.2.0 and v1.1.0 as history',
      /Version: v1\.4\.0/.test(html) && /Released: 2026-10-19/.test(html) && /<meta name="version" content="v1\.4\.0">/.test(html) && /<title>RF Cascade Analyzer v1\.4\.0<\/title>/.test(html)
      && /v1\.4\.0 - Reflections: titled power panel; voltage panel with incident, reflected, total and transmitted waves\s+\(Region 2 to ∞\) and V⁺ \+ V⁻ = Vₜ readout; signed Γ and τ\. Devices: S values moved into a numeric matrix row;\s+power line clear of the port labels; waves neutral\/text colour, path colours for S only\. Cascade: junction\s+powers labelled × input; dB with power factor; river arithmetic; budget shows dB adding\./.test(html)
      && html.indexOf('v1.4.0 - ') < html.indexOf('v1.3.0 - ') && html.indexOf('v1.3.0 - ') < html.indexOf('v1.2.1 - ') && html.indexOf('v1.2.1 - ') < html.indexOf('v1.2.0 - ') && html.indexOf('v1.2.0 - ') < html.indexOf('v1.1.0 - ')
      && /spec_RF_Cascade_Analyzer_v1\.1\.0/.test(html) && !/RF Cascade Analyzer v1\.(1\.0|2\.[01]|3\.0)|content="v1\.(1\.0|2\.[01]|3\.0)"/.test(html));
    check('footer: v1.4.0 · released 2026-10-19 · Author: Claude Code', (await text(page, 'footer')).includes('v1.4.0 · released 2026-10-19 · Author: Claude Code'));
    const stamp = async () => page.evaluate(() => { const v = document.getElementById('verStamp'), r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const btns = [...document.querySelectorAll('#top button')].filter(b => b.getBoundingClientRect().width), last = btns[btns.length - 1].getBoundingClientRect(), top = document.getElementById('top').getBoundingClientRect();
      return { text: v.textContent, fs: parseFloat(cs.fontSize), mut: cs.color === getComputedStyle(document.querySelector('.note') || document.body).color || cs.color !== getComputedStyle(document.body).color,
        right: r.left >= last.right && r.right <= top.right + 0.5, shown: r.width > 0 && cs.visibility !== 'hidden', body: document.body.innerText.includes('v1.4.0'),
        oneRow: btns.every(b => { const r = b.getBoundingClientRect(), r0 = btns[0].getBoundingClientRect(); return Math.abs((r.top + r.bottom) - (r0.top + r0.bottom)) < 2; }) }; });
    let st = await stamp();
    check('stamp "v1.4.0" in the top bar, right of the last button, 14 px, muted (windowed)', st.text === 'v1.4.0' && st.fs === 14 && st.right && st.shown && st.mut && st.oneRow, st);
    const wBtn = await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(','));
    await present(page); st = await stamp();
    check('presentation (light): stamp visible right of Present; body.innerText contains "v1.4.0"; buttons one row', st.shown && st.right && st.body && st.oneRow && st.fs === 14, st);
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

  console.log('View 1 — Reflections (v1.4.0 A.6)');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=reflections'); await page.keyboard.press('p'); await page.waitForTimeout(50);
    // the curves' points (design units) and the plot's centre line and scale
    const geo = () => page.evaluate(() => { const pts = e => { const n = e.getAttribute('d').match(/-?[\d.]+/g).map(Number), p = [];
        for(let i = 0; i < n.length; i += 2) p.push([n[i], n[i + 1]]); return p; }, by = id => pts(document.getElementById(id));
      const e = document.querySelector('[data-q="envelope"]');
      return { inc: by('vInc'), ref: by('vRef'), tot: by('vTot'), tr: by('vTr'), env: pts(e), yc: +e.dataset.yc, A: +e.dataset.a, tau: +e.dataset.tau }; });
    const qv = async q => { const a = await dq(page, q); return a && a['data-v'] !== undefined ? +a['data-v'] : null; };
    const flat = t => t.replace(/\s+/g, ' ');
    const A6 = [
      ['150', '+0.50', '1.50', '1 + 0.50 = 1.50', 'Pₜ = Vₜ² · Z01/Z02 = 1.50² × 50/150 = 75 %', ['25 %', '75 %'], null, '3.0', 'VSWR = Vmax/Vmin = 1.5/0.50 = 3.0'],
      ['16.7', '−0.50', '0.50', '1 + (−0.50) = 0.50', 'Pₜ = Vₜ² · Z01/Z02 = 0.50² × 50/16.7 = 75 %', ['25 %', '75 %'], null, '3.0', 'VSWR = Vmax/Vmin = 1.5/0.50 = 3.0'],
      ['50', '0', '1.00', '1 + 0 = 1.00', 'Pₜ = 100 %', ['0 %', '100 %'], 'P_refl', '1.0', 'VSWR = Vmax/Vmin = 1.0/1.0 = 1.0'],
      ['0', '−1.00', '0', '1 + (−1.00) = 0', 'Vₜ = 0 → Pₜ = 0 %', ['100 %', '0 %'], 'P_trans', '∞', 'VSWR = Vmax/Vmin = 2.0/0 = ∞'],
      ['open', '+1.00', '2.00', '1 + 1.00 = 2.00', 'Pₜ = 0 % (Z02 = ∞)', ['100 %', '0 %'], 'P_trans', '∞', 'VSWR = Vmax/Vmin = 2.0/0 = ∞'] ];
    for(const [z, gm, tau, l1, l2, [pr, pt], ghost, vs, vline] of A6){
      await setInput(page, '#z02Box', z, 'change');
      const T = { g: await text(page, '#roGamma'), vs: await text(page, '#roVswr'), tau: await text(page, '#roTau'), r1: await text(page, '#readV'), r2: await text(page, '#readP'),
        inc: await text(page, '#pInc'), refl: await text(page, '#pRefl'), tr: await text(page, '#pTrans'), vl: await text(page, '.vswrLine') };
      const gh = await page.evaluate(() => ['P_inc', 'P_refl', 'P_trans'].filter(q => document.querySelector('[data-q="' + q + '"]').getAttribute('data-ghost') === '1').join(','));
      check('Z02 = ' + z + ': Γ ' + gm + ', τ ' + tau + ', VSWR ' + vs + ' (panel); readout "' + l1 + '" / "' + l2 + '"; arrows 100 / ' + pr + ' / ' + pt + (ghost ? ' (' + ghost + ' ghost)' : '') + '; ' + vline,
        T.g === gm && T.vs === vs && T.tau === 'τ = 1 + Γ = ' + tau && flat(T.r1) === 'V⁺ + V⁻ = Vₜ ' + l1 && T.r1.includes('Vₜ\u00a0\u00a0 1') && T.r2 === l2
        && T.inc === 'Incident power 100 %' && T.refl === 'Reflected power |Γ|² = ' + pr && T.tr === 'Transmitted power 1 − |Γ|² = ' + pt && gh === (ghost || '') && T.vl === vline, T);
      const g = await qv('Gamma'), t = await qv('tau');
      check('Z02 = ' + z + ': data hooks Gamma, tau, V_inc = 1, V_refl = Γ, V_trans = τ, V_tot (no value)', near(t, 1 + g, 1e-9) && (await qv('V_inc')) === 1 && near(await qv('V_refl'), g, 1e-12)
        && near(await qv('V_trans'), t, 1e-12) && (await dq(page, 'V_tot'))['data-v'] === undefined && !!(await dq(page, 'Vmax')) && !!(await dq(page, 'Vmin')));
      const G = await geo(), amp2 = Math.max(...G.tr.filter(p => p[0] <= G.tr[0][0] + 0.75 * (G.tr[0][0] - G.inc[G.inc.length - 1][0]) / 2 + 0.01).map(p => Math.abs(p[1] - G.yc)));
      const envAt = x => G.env.filter(p => Math.abs(p[0] - x) < 0.02).map(p => G.yc - p[1]);
      check('Z02 = ' + z + ': Region 2 amplitude and its envelope = |τ|; Region 1 envelope at the interface = |τ|', near(amp2, G.tau * G.A, 1) && envAt(G.tr[0][0]).every(v => near(v, G.tau * G.A, 0.05))
        && near(G.yc - G.env[G.env.length - 1][1], G.tau * G.A, 0.05), { amp2, tA: G.tau * G.A, env: envAt(G.tr[0][0]) });
      if(z === '16.7') check('16.7 Ω: at d = 0 the reflected wave is opposite in sign to the incident (−0.50 ×)', (G.ref[0][1] - G.yc) * (G.inc[0][1] - G.yc) <= 0 && near(G.ref[0][1] - G.yc, -0.5 * (G.inc[0][1] - G.yc), 1));
      if(z === '0') check('Short: total 0 at d = 0, λ/2, λ, 3λ/2, 2λ; Region 2 flat at 0', [0, 60, 120, 180, 240].every(i => near(G.tot[i][1], G.yc, 1)) && G.tr.every(p => near(p[1], G.yc, 1)));
      if(z === 'open') check('Open: total at d = 0 is twice the incident (amplitude 2); Region 2 amplitude 2', near(G.tot[0][1] - G.yc, 2 * (G.inc[0][1] - G.yc), 1) && near(amp2, 2 * G.A, 1));
      if(z === '50') check('Matched: reflected flat at 0; envelope flat at 1 on both sides', G.ref.every(p => near(p[1], G.yc, 0.5)) && G.env.every(p => near(G.yc - p[1], G.A, 0.05)));
    }
    // the total and the transmitted wave meet at the interface at every instant (5 times, running)
    await setInput(page, '#z02Box', '150', 'change'); await page.keyboard.press('p');
    const gaps = []; for(let i = 0; i < 5; i++){ await page.waitForTimeout(170); gaps.push(await page.evaluate(() => { const f = id => document.getElementById(id).getAttribute('d').match(/^M(-?[\d.]+) (-?[\d.]+)/);
      const a = f('vTot'), b = f('vTr'); return Math.hypot(a[1] - b[1], a[2] - b[2]); })); }
    check('interface: |v_total(d = 0) − vₜ(x = 0)| < 1 px at 5 different times', gaps.every(x => x < 1), gaps);
    await page.keyboard.press('p');
    check('Z02 drawn is the control value; heading and caption present', (await text(page, '#z02Label')).endsWith('= 150 Ω') && (await stageTexts(page)).includes('Power at the interface (incident power = 100 %)')
      && (await stageTexts(page)).includes('Voltage on the lines (incident amplitude = 1)') && (await stageTexts(page)).includes('Both regions have the same propagation speed (same λ). Region 2 is infinitely long.')
      && (await stageTexts(page)).join(' ').includes('Region 2 continues to ∞ — no further reflections'));
    check('legend: incident v⁺, reflected v⁻, total (Region 1), transmitted vₜ, envelope', JSON.stringify(await page.$$eval('#stage .legend text', e => e.map(x => x.textContent))) === JSON.stringify(['incident v⁺', 'reflected v⁻', 'total (Region 1)', 'transmitted vₜ', 'envelope']));
    check('distance ticks 2λ, 3λ/2, λ, λ/2, interface; Region 2 λ/4, λ/2', JSON.stringify((await stageTexts(page)).filter(t => /^(\d?λ(\/\d)?|3λ\/2|interface)$/.test(t))) === JSON.stringify(['2λ', '3λ/2', 'λ', 'λ/2', 'interface', 'λ/4', 'λ/2']));
    check('Vmax / Vmin labels in Region 1, neutral text colour', (await stageTexts(page)).includes('Vmax 1.5') && (await stageTexts(page)).includes('Vmin 0.50')
      && await page.evaluate(() => [...document.querySelectorAll('#stage .level')].every(e => e.getAttribute('stroke') === 'var(--txt)' && +e.getAttribute('x2') <= +document.getElementById('vTr').getAttribute('d').match(/^M(-?[\d.]+)/)[1] + 0.01)));
    check('no complex Γ on this view', !/∠/.test(await text(page, '#panel')) && !(await stageTexts(page)).some(t => /∠/.test(t)));
    // the incident/reflected switch and its hash
    const shown = () => page.evaluate(() => ['vInc', 'vRef', 'vTot', 'vTr'].map(id => getComputedStyle(document.getElementById(id)).display !== 'none').join(','));
    check('"Show incident and reflected" on by default: all four curves; hash vr=1', (await page.isChecked('#showVR')) && (await shown()) === 'true,true,true,true' && (await page.evaluate(() => location.hash)) === '#view=reflections&vr=1');
    await page.click('#showVR'); await page.waitForTimeout(60);
    check('unticked: only the incident and reflected curves hidden; hash vr=0', (await shown()) === 'false,false,true,true' && (await page.evaluate(() => location.hash)) === '#view=reflections&vr=0');
    await page.goto(URL0 + '#view=reflections&vr=1'); await page.waitForTimeout(150); await page.goto(URL0 + '#view=reflections&vr=0'); await page.waitForTimeout(150);
    check('hash round-trip: #view=reflections&vr=0 restores the switch off', !(await page.isChecked('#showVR')) && (await shown()) === 'false,false,true,true');
    await page.click('#showVR'); await page.waitForTimeout(60);
    await click(page, '#bShort'); await setInput(page, '#z02Box', 'abc', 'change');
    check('invalid Z02 text is flagged and ignored', (await page.getAttribute('#z02Box', 'aria-invalid')) === 'true' && (await text(page, '#roVswr')) === '∞');
    await setInput(page, '#z02Box', '150', 'change'); await page.evaluate(() => document.activeElement.blur());
    if((await page.textContent('#pauseBtn')) === 'Pause') await page.keyboard.press('p');   // a hash-only goto keeps the pause state
    await page.waitForTimeout(50);
    const d0 = await page.getAttribute('#vTot', 'd'); await page.keyboard.press('t'); await page.waitForTimeout(80);
    const d1 = await page.getAttribute('#vTot', 'd');
    check('the total wave keeps its phase across a theme change', d0 === d1);
    await ctx.close(); }

  console.log('View 2 — Devices (v1.3.0 two-port, v1.4.0 matrix rows and colours)');
  { const { ctx, page } = await open(browser);
    await present(page);
    // lanes (S21, S12) and U-turns (S11, S22): |S|, end width, blocked / capped flags, the group's drive state and opacity
    const paths = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .lane, #stage .uturn')].map(e => [e.getAttribute('data-q'),
      { v: +e.getAttribute('data-v'), w1: +e.getAttribute('data-w1'), lane: e.classList.contains('lane'), blocked: e.getAttribute('data-blocked') === '1', cap: e.getAttribute('data-capped') === '1',
        dotted: !!e.getAttribute('stroke-dasharray'), op: +(e.getAttribute('opacity') || 1), live: e.parentElement.getAttribute('data-live') === '1', gop: +(e.parentElement.getAttribute('opacity') || 1) }])));
    // a lane's drawn width (design units) at its entry and just before its arrowhead
    const laneW = k => page.evaluate(k => { const e = document.querySelector('#stage .lane.' + k);
      const n = e.getAttribute('d').match(/-?[\d.]+/g).map(Number), pts = []; for(let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      return { w0: Math.abs(pts[pts.length - 1][1] - pts[0][1]), wEnd: pts.length > 3 ? Math.abs(pts[pts.length - 2][1] - pts[1][1]) : 0 }; }, k);
    const badges = () => page.evaluate(() => [...document.querySelectorAll('#stage .badge')].map(b => b.getAttribute('data-on')).join(''));
    const cross = () => page.evaluate(() => { const x = document.querySelector('#stage .xmark'); if(!x) return null; const box = document.querySelector('#stage .box').getBoundingClientRect(), r = x.getBoundingClientRect();
      return { s: x.getAttribute('data-s'), outside: r.right <= box.left + 1 || r.left >= box.right - 1, strong: !x.closest('[opacity]'), red: x.querySelector('path').getAttribute('stroke') === 'var(--bad)' }; });
    const waves = () => page.evaluate(() => Object.fromEntries(['a1', 'a2', 'b1', 'b2'].map(k => [k, document.getElementById('w' + k).textContent])));
    const powerLine = () => page.evaluate(() => { const e = document.getElementById(location.hash.includes('drive=rev') ? 'pb1' : 'pb2'); return e ? e.textContent : null; });
    const ghostW = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .wave')].map(e => [e.getAttribute('data-q'), e.getAttribute('data-ghost') === '1'])));
    const heads = async () => [null, await text(page, '#roPower')];
    const keys = async () => [null, await page.evaluate(() => document.getElementById('roPower').previousSibling.textContent)];
    const outLabel = () => page.evaluate(() => { const d = location.hash.includes('drive=rev') ? 'wb1' : 'wb2', e = document.getElementById(d); return { size: +e.getAttribute('font-size'), weight: e.getAttribute('font-weight') }; });
    const sLab = k => text(page, '#v' + k), ent = k => text(page, '#n_' + k), row2 = () => page.getAttribute('#numRow', 'data-text');
    const W0 = 36;
    // the v1.3.0 check table
    const CASES = [
      ['Through, ℓ = λ/4, Forward', '#view=devices&device=through&drive=fwd', null, null, async (P, L21, L12) => near(L21.w0, W0, 0.1) && near(L21.wEnd, W0, 0.5) && near(L12.wEnd, W0, 0.5) && P.S11.dotted && P.S22.dotted
        && (await sLab('s21')) === 'S21' && (await ent('s21')) === '1.00∠−90°' && (await ent('s12')) === '1.00∠−90°', 'b2 = 1.00∠−90°', '|b2|² = 1.0'],
      ['Attenuator, 3 dB, Forward', '#view=devices&device=atten&drive=fwd', 'att', '3', async (P) => near(P.S21.w1, W0 * 0.5012, 0.02) && near(P.S12.w1, W0 * 0.5012, 0.02) && (await sLab('s21')) === 'S21' && (await ent('s21')) === '0.71',
        'b2 = 0.71∠0°', '|b2|² = 0.50'],
      ['Amplifier, +3 dB, Forward', '#view=devices&device=amp&drive=fwd', 'gain', '3', async (P) => { const x = await cross(); return near(P.S21.w1, W0 * 1.995, 0.05) && P.S12.blocked && x && x.s === 's12' && x.outside && x.red; },
        'b2 = 1.41∠0°', '|b2|² = 2.0'],
      ['Amplifier, +10 dB, Forward', '#view=devices&device=amp&drive=fwd', 'gain', '10', async (P) => P.S21.cap && near(P.S21.w1, 3 * W0, 0.01) && await page.evaluate(() => !!document.querySelector('#stage .pathg.s21 .brk')),
        'b2 = 3.16∠0°', '|b2|² = 10'],
      ['Amplifier, +10 dB, Reverse', '#view=devices&device=amp&drive=rev', null, null, async (P) => { const x = await cross(); return P.S12.blocked && P.S12.live && P.S12.gop === 1 && !P.S21.live && near(P.S21.gop, 0.22, 1e-9)
        && x && x.s === 's12' && x.strong && (await waves()).a2 === 'a2 = 1∠0°'; }, 'b1 = 0', '|b1|² = 0'],
      ['Isolator, 0.5 dB, Forward', '#view=devices&device=iso&drive=fwd', null, null, async (P) => near(P.S21.w1, W0 * 0.8913, 0.02) && P.S12.blocked && !!(await cross()), 'b2 = 0.94∠0°', '|b2|² = 0.89'],
      ['Custom (S11 0.30∠40°, S21 = S12 0.60∠−70°, S22 0.40∠−20°), Forward (S11 U-turn max(3, 0.09 W0) = 3.24)', '#view=devices&device=custom&drive=fwd', null, null, async (P) => near(P.S11.w1, Math.max(3, W0 * 0.09), 0.01) && P.S11.live && !P.S22.live && near(P.S22.gop, 0.22, 1e-9)
        && near(P.S21.w1, W0 * 0.36, 0.02) && near(P.S12.w1, W0 * 0.36, 0.02) && (await waves()).b1 === 'b1 = 0.30∠40°', 'b2 = 0.60∠−70°', '|b2|² = 0.36'] ];
    for(const [name, hs, ctl, v, lanes, wave, power] of CASES){
      await goto(page, hs); if(ctl) await setInput(page, '#' + ctl, v);
      const P = await paths(), L21 = await laneW('s21'), L12 = await laneW('s12'), W = await waves(), out = hs.includes('drive=rev') ? 'b1' : 'b2';
      check(name + ': lanes and U-turns as specified', await lanes(P, L21, L12), { P, L21, L12 });
      check(name + ': ' + wave + ', ' + power, W[out] === wave && (await powerLine()) === power, { W, p: await powerLine() });
    }
    // general rules
    await goto(page, '#view=devices&device=atten&drive=fwd');
    { const L = await laneW('s21'); check('taper: a lane starts at W0 = 36 for the input power 1 and narrows linearly (3 dB: towards ½ W0 at the exit)', near(L.w0, 36, 0.1) && L.wEnd < L.w0 && L.wEnd > 18, L); }
    const noText = await page.evaluate(() => { const box = document.querySelector('#stage .box').getBoundingClientRect();
      return [...document.querySelectorAll('#stage svg text')].filter(t => { const r = t.getBoundingClientRect(); return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top; }).map(t => t.id).sort().join(','); });
    check('inside the box: only the four S labels (no "Two-Port", dB caption, ruler or isolator text)', noText === 'vs11,vs12,vs21,vs22', noText);
    check('the box is a plain rounded rectangle (rx 14, 3 px border); no header line', await page.evaluate(() => { const b = document.querySelector('#stage .box');
      return b.getAttribute('rx') === '14' && b.getAttribute('stroke-width') === '3' && !document.querySelector('#stage .headline, #stage .boxTitle, #boxCaption'); }));
    check('port layout: a1 in (top) and b1 out (bottom) at port 1; b2 out (top) and a2 in (bottom) at port 2; "Port 1/2" between their wires', await page.evaluate(() => {
      const y = q => { const r = document.querySelector('#stage .wave[data-q="' + q + '"]').getBoundingClientRect(); return (r.top + r.bottom) / 2; }, x = q => document.querySelector('#stage .wave[data-q="' + q + '"]').getBoundingClientRect();
      const box = document.querySelector('#stage .box').getBoundingClientRect(), ports = [...document.querySelectorAll('#stage .port')].map(e => e.getBoundingClientRect());
      return y('a1') < y('b1') && y('b2') < y('a2') && x('a1').right <= box.left + 1 && x('b1').right <= box.left + 1 && x('b2').left >= box.right - 1 && x('a2').left >= box.right - 1
        && ports.length === 2 && ports[0].top > y('a1') && ports[0].bottom < y('b1') && ports[1].top > y('b2') && ports[1].bottom < y('a2'); }));
    check('no crossing paths: S21 lane straight along the top, S12 along the bottom', await page.evaluate(() => { const a = document.querySelector('#stage .lane.s21').getBoundingClientRect(), b = document.querySelector('#stage .lane.s12').getBoundingClientRect(); return a.bottom < b.top; }));
    check('Forward: S21 lane and S11 U-turn solid; S12 and S22 faded to 22 %; undriven a2 wire dotted', await (async () => { const P = await paths(), g = await ghostW();
      return P.S21.live && P.S11.live && P.S21.gop === 1 && near(P.S12.gop, 0.22, 1e-9) && near(P.S22.gop, 0.22, 1e-9) && g.a2 && !g.a1; })());
    check('S tags: S21 above the top lane, S12 below the bottom lane, S11 and S22 between the lanes (S11 left of S22)', await page.evaluate(() => { const R = id => document.getElementById(id).getBoundingClientRect();
      const t = document.querySelector('#stage .lane.s21').getBoundingClientRect(), b = document.querySelector('#stage .lane.s12').getBoundingClientRect();
      return R('vs21').bottom <= t.top && R('vs12').top >= b.bottom && ['vs11', 'vs22'].every(id => R(id).top >= t.bottom && R(id).bottom <= b.top) && R('vs11').right < R('vs22').left; }));
    check('S11 0 drawn as a faint dotted U (2 px, 45 % opacity) when |S| < 0.05; tag "S11" in the box, "0" in the matrix', await (async () => { const P = await paths(); return P.S11.dotted && near(P.S11.op, 0.45, 1e-9) && (await sLab('s11')) === 'S11' && (await ent('s11')) === '0'; })());
    check('the driven output label (b2 in Forward) is 22 px bold; its |b2|² line 18 px regular', JSON.stringify(await outLabel()) === '{"size":22,"weight":"700"}' && +(await page.getAttribute('#wb1', 'font-size')) === 18
      && +(await page.getAttribute('#pb2', 'font-size')) === 18 && (await page.getAttribute('#pb2', 'font-weight')) === '400');
    check('panel: the power only (power out = |b2|² = 50 %); caption about normalized waves; never "power wave"', (await heads())[1] === '50 %' && (await keys())[1] === 'power out = |b2|²'
      && (await text(page, '#panel')).includes('a, b = normalized waves (a = V⁺/√Z0). Power = |wave|².') && !/power wave/i.test(await page.evaluate(() => document.body.innerText)));
    check('no numeric line "[b] = [S] · [a]" any more; one numeric row', !(await page.$('#numLine')) && (await page.$$('#stage .numrow')).length === 1);
    check('Attenuator: badges R ✓ S ✓ L ✗ P ✓', (await badges()) === '1101');
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30');
    { const P = await paths(); check('Amplifier 30 dB (max): S21 still capped at 3 W0 with the break mark; b2 = 31.6∠0°, |b2|² = 1000; badges all ✗', P.S21.cap && near(P.S21.w1, 108, 0.01)
      && (await waves()).b2 === 'b2 = 31.6∠0°' && (await powerLine()) === '|b2|² = 1000' && (await badges()) === '0000'); }
    await setInput(page, '#gain', '10');
    await goto(page, '#view=devices&device=iso&drive=fwd'); await setInput(page, '#isoI', '20');
    { const P = await paths(); check('Isolator, 20 dB isolation: S12 0.10 is a thin lane, not blocked (no ✕)', near(P.S12.v, 0.1, 1e-9) && !P.S12.blocked && !(await cross()) && (await ent('s12')) === '0.10'); }
    await click(page, '#drive_rev');
    { const W = await waves(); check('Isolator Reverse, 20 dB: a2 = 1∠0°, b1 = 0.10∠0°, |b1|² = 0.010; power out 1.0 %', W.a2 === 'a2 = 1∠0°' && W.b1 === 'b1 = 0.10∠0°' && (await powerLine()) === '|b1|² = 0.010' && (await heads())[1] === '1.0 %', W); }
    await page.evaluate(() => { const r = document.getElementById('isoI'); r.value = 61; r.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(60);
    check('Isolator Reverse, ∞ isolation: b1 = 0, |b1|² = 0, blocked with ✕', (await waves()).b1 === 'b1 = 0' && (await powerLine()) === '|b1|² = 0' && !!(await cross()));
    await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    check('Previous keeps the drive (Amplifier, Reverse)', (await page.evaluate(() => location.hash)) === '#view=devices&device=amp&drive=rev');
    await page.keyboard.press('PageUp'); await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    { const W = await waves(); check('Through Reverse: b1 = 1.00∠−90°, |b1|² = 1.0, b2 = 0', W.b1 === 'b1 = 1.00∠−90°' && (await powerLine()) === '|b1|² = 1.0' && W.b2 === 'b2 = 0', W); }
    await page.goto(URL0 + '#view=devices&device=custom&drive=rev'); await page.waitForTimeout(150);
    check('hash round-trip: #view=devices&device=custom&drive=rev restores Custom in Reverse', (await page.getAttribute('#dev_custom', 'aria-pressed')) === 'true'
      && (await page.getAttribute('#drive_rev', 'aria-pressed')) === 'true' && (await page.evaluate(() => location.hash)) === '#view=devices&device=custom&drive=rev');
    await click(page, '#drive_fwd');
    await setInput(page, '#cs21', '0.8');
    { const P = await paths(); check('Custom: linked S12 follows S21 (0.80); the S12 row is locked', near(P.S12.v, 0.8, 1e-9) && near(P.S21.v, 0.8, 1e-9) && await page.isDisabled('#cs12')); }
    check('Devices: no 3-decimal numbers on the diagram', !(await stageTexts(page)).some(t => /\d\.\d{3}/.test(t)));
    check('Matrix row 1 entries 30 px; row 2 entries 24 px (Custom, four long entries, fits without the 20 px fallback)', await page.evaluate(() => [...document.querySelectorAll('#stage .ment')].every(e => +e.getAttribute('font-size') === 30)
      && [...document.querySelectorAll('#stage .nent')].every(e => +e.getAttribute('font-size') === 24) && document.getElementById('numRow').dataset.fs === '24'));
    // v1.4.0 B.4: row 2 for each case; the drawn entries are the row's text and the wire labels' values
    const B4 = [['Through, ℓ = λ/4, Forward', '#view=devices&device=through&drive=fwd', null, null, '= [0  1.00∠−90°; 1.00∠−90°  0] [1∠0°; 0] = [0; 1.00∠−90°]'],
      ['Through, ℓ = λ/4, Reverse', '#view=devices&device=through&drive=rev', null, null, '= [0  1.00∠−90°; 1.00∠−90°  0] [0; 1∠0°] = [1.00∠−90°; 0]'],
      ['Attenuator 3 dB, Forward', '#view=devices&device=atten&drive=fwd', null, null, '= [0  0.71; 0.71  0] [1∠0°; 0] = [0; 0.71∠0°]'],
      ['Amplifier 10 dB, Forward', '#view=devices&device=amp&drive=fwd', 'gain', '10', '= [0  0; 3.16  0] [1∠0°; 0] = [0; 3.16∠0°]'],
      ['Custom default, Forward', '#view=devices&device=custom&drive=fwd', null, null, '= [0.30∠40°  0.60∠−70°; 0.60∠−70°  0.40∠−20°] [1∠0°; 0] = [0.30∠40°; 0.60∠−70°]']];
    await page.goto(URL0); await page.waitForTimeout(150); await present(page);
    for(const [name, hs, ctl, v, want] of B4){
      await goto(page, hs); if(ctl) await setInput(page, '#' + ctl, v);
      const got = await row2(), drawn = await page.evaluate(() => { const t = id => document.getElementById(id).textContent;
        return '= [' + t('n_s11') + '  ' + t('n_s12') + '; ' + t('n_s21') + '  ' + t('n_s22') + '] [' + t('n_a1') + '; ' + t('n_a2') + '] = [' + t('n_b1') + '; ' + t('n_b2') + ']'; });
      const W = await waves(), same = await page.evaluate(() => ['a1', 'a2', 'b1', 'b2'].every(k => document.getElementById('w' + k).textContent.endsWith(' = ' + document.getElementById('n_' + k).textContent)));
      check('B.4 ' + name + ': row 2 ' + want, got === want && drawn === want && same, { got, drawn, W });
    }
    await goto(page, '#view=devices&device=through&drive=fwd');
    check('B.1 Through Forward: "|b2|² = 1.0" above "b2 = 1.00∠−90°", clear of "Port 2"', await page.evaluate(() => { const R = id => document.getElementById(id).getBoundingClientRect();
      const p = R('pb2'), w = R('wb2'), port = [...document.querySelectorAll('#stage .port')][1].getBoundingClientRect();
      return p.bottom <= w.top && !(p.left < port.right && port.left < p.right && p.top < port.bottom && port.top < p.bottom) && document.getElementById('pb2').textContent === '|b2|² = 1.0'; }));
    check('B.2 no S value inside the box; each name tag once', await page.evaluate(() => ['s11', 's21', 's12', 's22'].every(k => document.getElementById('v' + k).textContent === 'S' + k.slice(1))
      && [...document.querySelectorAll('#stage svg text')].filter(t => /^S(11|21|12|22)$/.test(t.textContent) && !t.closest('.matrix')).length === 4));
    await goto(page, '#view=devices&device=through&drive=rev');
    check('B.1 Through Reverse: "|b1|² = 1.0" below "b1 = 1.00∠−90°"', await page.evaluate(() => document.getElementById('pb1').getBoundingClientRect().top >= document.getElementById('wb1').getBoundingClientRect().bottom));
    // B.3 colours: b wires, labels, power line and entries the text colour; a grey; S entries their path colours — the same in Forward and Reverse, both themes
    const cols = () => page.evaluate(() => { const c = e => getComputedStyle(e).fill, body = getComputedStyle(document.body).color;
      const b = ['wb1', 'wb2', 'n_b1', 'n_b2'].map(id => c(document.getElementById(id))).concat([...document.querySelectorAll('#stage .wave[data-q^="b"] path')].map(e => e.getAttribute('stroke') === 'var(--txt)' ? body : 'x'));
      const a = ['wa1', 'wa2', 'n_a1', 'n_a2'].map(id => document.getElementById(id).getAttribute('fill'));
      const sOk = ['s11', 's21', 's12', 's22'].every(k => document.getElementById('n_' + k).getAttribute('fill') === 'var(--' + k + ')' && document.getElementById('v' + k).getAttribute('fill') === 'var(--' + k + ')');
      const pw = document.querySelector('#stage .plabel'); return { b: b.every(x => x === body) && c(pw) === body, a: a.every(x => x === 'var(--grey)'), sOk, body }; });
    const C = [];
    for(const th of ['light', 'dark']){ for(const dr of ['fwd', 'rev']){ await goto(page, '#view=devices&device=custom&drive=' + dr); C.push([th, dr, await cols()]); } await page.keyboard.press('t'); await page.waitForTimeout(60); }
    await page.keyboard.press('t');
    check('B.3 b₁, b₂ (wires, labels, power line, entries) in the text colour, a₁, a₂ grey, S entries in path colours — Forward and Reverse, both themes', C.every(([, , x]) => x.a && x.b && x.sOk) && C[0][2].body !== C[2][2].body, C);
    await ctx.close(); }

  console.log('Devices layout (v1.3.0 items 1, 6)');
  { const { ctx, page } = await open(browser); await present(page);
    const gi = [], add = async st => (await devGapIssues(page)).forEach(x => gi.push(st + ': ' + x));
    for(const hs of STOPS.slice(1, 6).concat(REV_STOPS)){ await goto(page, hs); await add(hs.replace('#view=devices&', '')); }
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30'); await add('amp 30 dB'); await click(page, '#drive_rev'); await add('amp 30 dB rev'); await click(page, '#drive_fwd');
    await goto(page, '#view=devices&device=custom&drive=fwd'); for(const k of ['s11', 's21', 's22']) await setInput(page, '#c' + k, '0.98'); await add('custom all |S| 0.98');
    await click(page, '#drive_rev'); await add('custom all |S| 0.98 rev');
    check('box→matrix ≥ 16, numeric→badges ≥ 12, badges→bottom ≥ 12; no text inside the box but the S labels (every device, Forward and Reverse; amp 30 dB; Custom |S| ≈ 1)', gi.length === 0, gi.slice(0, 10));
    check('every label ≥ 16 px from the left edge and the divider', !gi.some(x => /edge|divider/.test(x)));
    await ctx.close(); }

  console.log('View 3 — Cascade (check case)');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=cascade');
    const ids = async pre => Promise.all([0, 1, 2, 3].map(k => text(page, '#' + pre + k)));
    const dt = async pre => page.evaluate(pre => [0, 1, 2, 3].map(k => { const e = document.getElementById(pre + k); return e ? e.dataset.text : null; }), pre);
    const budget = () => page.evaluate(() => [0, 1, 2].map(i => [...document.querySelectorAll('#bud' + i + ' text')].map(t => t.textContent).join(' / ')));
    const C5 = async (name, fwd, refl, ar, rere) => {
      const f = await ids('fwd'), r = await dt('refl'), a = (await dt('ar')).slice(0, 3), b = await budget(), tot = await text(page, '#budTotal'), rc = await text(page, '#rereCap');
      check('C.5 ' + name + ': forward ' + fwd.join(' / ') + '; reflected ' + refl.join(' / ') + '; arithmetic ' + ar.join('; ') + '; budget',
        JSON.stringify(f) === JSON.stringify(fwd.map(x => x + ' × input')) && JSON.stringify(r) === JSON.stringify(refl) && JSON.stringify(a) === JSON.stringify(ar)
        && JSON.stringify(b) === JSON.stringify(['+10.0 dB / = ×10', '−3.0 dB / = ×0.50', '−0.9 dB / = ×0.81']) && tot === '+10.0 − 3.0 − 0.9 = +6.1 dB delivered to load'
        && (rere ? rc === '↺ forward power here includes waves reflected back from later in the chain.' : rc === null), { f, r, a, b, tot, rc }); };
    check('heading "Forward power at each junction (input power = 1)"; the thickness caption under it', (await stageTexts(page)).includes('Forward power at each junction (input power = 1)')
      && /^reflected arrows drawn [\d.]+× thicker$/.test(await text(page, '#thickCap')));
    await C5('100 Ω load', ['1', '10', '5.0', '4.6'], ['back to source 0', '0.17 × input', '0.34 × input', '0.51 × input'], ['1 × 10 = 10', '10 × 0.50 = 5.0', '× 0.81 ↺'], true);
    await click(page, '#lMatch');
    await C5('matched load', ['1', '10', '5.0', '4.1'], ['back to source 0', '0.10 × input', '0.20 × input', '0'], ['1 × 10 = 10', '10 × 0.50 = 5.0', '5.0 × 0.81 = 4.1'], false);
    check('matched load: no overlaps; alignment ±6 px', (await overlapIssues(page)).length === 0 && (await alignIssues(page)).length === 0, (await overlapIssues(page)).concat(await alignIssues(page)));
    await setInput(page, '#loadZ', '100');
    const al = await alignIssues(page);
    check('alignment: each reflected arrow and value centred under its junction, each budget value under its block (±6 px)', al.length === 0, al);
    check('band height ∝ forward power; reflected arrows ∝ |b|², exaggerated by the factor the caption states', await page.evaluate(() => {
      const f = [0, 1, 2, 3].map(k => document.querySelector('[data-q="fwd' + k + '"]')), ok1 = f.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      const b = [1, 2, 3].map(k => document.querySelector('[data-q="refl' + k + '"]')), ok2 = b.every(e => Math.abs(+e.dataset.th - +e.dataset.v * +e.dataset.ref) < 0.02);
      const m = /drawn ([\d.]+)× thicker/.exec(document.getElementById('thickCap').textContent), sc = +f[0].dataset.ref;
      return ok1 && ok2 && !!m && b.every(e => Math.abs(+e.dataset.ref / sc - +m[1]) < 0.051); }));
    const lines = await page.$$eval('#chainS .sline', l => l.map(x => x.textContent));
    check('whole chain: S21 2.01∠−45° (+6.1 dB), S11 0 (source sees a match), S22 0.20∠30°, S12 0',
      JSON.stringify(lines) === JSON.stringify(['S212.01∠−45° (+6.1 dB)', 'S110 (source sees a match)', 'S220.20∠30°', 'S120']), lines);
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
    check('Short load: the block sum and G_T differ, so both are shown: "blocks: +3.1 dB · delivered to load: −∞ dB"; Load shows 0 Ω', (await text(page, '#budTotal')) === 'blocks: +3.1 dB · delivered to load: −∞ dB' && (await text(page, '#loadVal')) === '0 Ω', await text(page, '#budTotal'));
    await click(page, '#lOpen');
    check('Open load: Load shows ∞; −∞ dB delivered', (await text(page, '#loadVal')) === '∞' && (await text(page, '#budTotal')) === 'blocks: +3.1 dB · delivered to load: −∞ dB');
    await ctx.close(); }

  console.log('Overlaps, sizes and layout');
  const states = async (page, fn) => { for(const hs of STOPS.concat(REV_STOPS)){ await goto(page, hs); await fn(hs); }
    for(const vr of ['1', '0']){ await goto(page, '#view=reflections&vr=' + vr);
      for(const z of ['150', '16.7', '50', '0', 'open', '52']){ await setInput(page, '#z02Box', z, 'change'); await fn('reflections Z02 = ' + z + ', vr=' + vr); } }
    await goto(page, '#view=reflections&vr=1'); await setInput(page, '#z02Box', '150', 'change');
    await goto(page, '#view=devices&device=iso'); await setInput(page, '#isoI', '20'); await fn('isolator 20 dB');
    await goto(page, '#view=devices&device=amp'); await setInput(page, '#gain', '30'); await fn('amplifier 30 dB');
    await goto(page, '#view=devices&device=custom'); await setInput(page, '#cs11a', '-180'); await setInput(page, '#cs11', '1.25'); await fn('custom S11 1.25∠180°');
    await goto(page, '#view=devices&device=amp&drive=rev'); await fn('amplifier 30 dB, reverse');
    await goto(page, '#view=devices&device=atten&drive=fwd'); await setInput(page, '#att', '40'); await fn('attenuator 40 dB (max loss)');
    await goto(page, '#view=devices&device=atten&drive=rev'); await fn('attenuator 40 dB, reverse'); await setInput(page, '#att', '3');
    await goto(page, '#view=devices&device=iso&drive=fwd'); await setInput(page, '#isoIL', '3'); await fn('isolator 3 dB forward loss'); await setInput(page, '#isoIL', '0.5');
    await goto(page, '#view=devices&device=custom&drive=fwd'); for(const k of ['s11', 's21', 's22']) await setInput(page, '#c' + k, '0.98'); await fn('custom all |S| 0.98');
    await click(page, '#drive_rev'); await fn('custom all |S| 0.98, reverse'); await click(page, '#drive_fwd');
    await goto(page, '#view=cascade'); await page.click('#stage [data-blk="2"]'); await page.waitForTimeout(60); await fn('cascade, Custom block selected');
    await click(page, '#lMatch'); await fn('cascade, matched load'); await setInput(page, '#loadZ', '100');
    await page.keyboard.press('t'); await page.waitForTimeout(60); await fn('cascade, dark'); await goto(page, '#view=devices&device=custom&drive=fwd'); await fn('devices custom, dark');
    await goto(page, '#view=reflections&vr=1'); await fn('reflections, dark'); await page.keyboard.press('t'); await page.waitForTimeout(60); await goto(page, '#view=cascade');
    await page.click('#stage [data-add]'); await page.waitForTimeout(60); await click(page, '#add_amp'); await fn('cascade, 4 blocks');
    await page.click('#stage [data-del="3"]'); await page.waitForTimeout(60); };
  for(const [vw, label, f, pres] of [[{ width: 1280, height: 720 }, 'presentation 1280×720', 1, true], [{ width: 1920, height: 1080 }, 'presentation 1920×1080', 1.5, true],
                                     [{ width: 1366, height: 768 }, 'windowed 1366×768', 1, false]]){
    const { ctx, page, log } = await open(browser, { viewport: vw });
    if(pres) await present(page);
    const ov = [], sz = [], lay = [], ed = [];
    await states(page, async st => { (await overlapIssues(page)).forEach(x => ov.push(st + ': ' + x)); if(pres) (await sizeIssues(page, f)).forEach(x => sz.push(st + ': ' + x)); (await layoutIssues(page)).forEach(x => lay.push(st + ': ' + x));
      (await edgeIssues(page)).forEach(x => ed.push(st + ': ' + x)); });
    check(label + ': no text overlaps a drawn element or another label (every view, device, both C.5 chains, Reflections 5 cases with the switch on and off)', ov.length === 0, ov.slice(0, 12));
    check(label + ': every label ≥ 16 px from the screen edges and the drawing/panel divider (all views)', ed.length === 0, ed.slice(0, 12));
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
    const d = () => page.evaluate(() => ['vInc', 'vRef', 'vTot', 'vTr'].map(id => document.getElementById(id).getAttribute('d')));
    const a = await d(); await page.waitForTimeout(250); const a2 = await d();
    check('all four Reflections curves move', a.every((x, i) => x !== a2[i]));
    await page.keyboard.press('p'); await page.waitForTimeout(50); const b = await d(); await page.waitForTimeout(250);
    check('P pauses all four curves', JSON.stringify(b) === JSON.stringify(await d()));
    await page.keyboard.press('p'); await page.waitForTimeout(50);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange')); window.__raf = 0; const r = window.requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return r(f); }; });
    await page.waitForTimeout(80); const h0 = await d(), n0 = await page.evaluate(() => window.__raf); await page.waitForTimeout(250);
    check('hidden tab: no animation frames requested, curves still', JSON.stringify(h0) === JSON.stringify(await d()) && (await page.evaluate(() => window.__raf)) === n0);
    await ctx.close();
    const r = await open(browser, { reducedMotion: 'reduce' }); const c = await r.page.getAttribute('#vTot', 'd'); await r.page.waitForTimeout(250);
    check('reduced motion loads paused (static curves)', c === await r.page.getAttribute('#vTot', 'd') && (await r.page.textContent('#pauseBtn')) === 'Play');
    await r.ctx.close(); }

  if(SHOTS){
    console.log('Screenshots (presentation, 1280×720, Projector theme)');
    const { ctx, page } = await open(browser, { reducedMotion: 'reduce' }); await present(page);
    const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); console.log('  wrote ' + name + '.png'); };
    fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SHOT_DIR, f)));
    const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
    // v1.4.0: each A.6 row, and Z02 = 150 with the switch off
    await goto(page, '#view=reflections&vr=1');
    for(const [z, n] of [['150', '150'], ['16.7', '16_7'], ['50', 'matched'], ['0', 'short'], ['open', 'open']]){ await setInput(page, '#z02Box', z, 'change'); await blur(); await shot('a6_reflections_' + n); }
    await setInput(page, '#z02Box', '150', 'change'); await page.click('#showVR'); await blur(); await shot('a6_reflections_150_switch_off'); await page.click('#showVR');
    // Devices
    await goto(page, '#view=devices&device=through&drive=fwd'); await shot('b_devices_through_forward');
    await goto(page, '#view=devices&device=through&drive=rev'); await shot('b_devices_through_reverse');
    await goto(page, '#view=devices&device=atten&drive=fwd'); await shot('b_devices_atten_3dB');
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '10'); await blur(); await shot('b_devices_amp_10dB');
    await goto(page, '#view=devices&device=custom&drive=fwd'); await shot('b_devices_custom_forward');
    // Cascade, both C.5 chains
    await goto(page, '#view=cascade'); await shot('c_cascade_100ohm'); await click(page, '#lMatch'); await blur(); await shot('c_cascade_matched'); await setInput(page, '#loadZ', '100'); await blur();
    // dark theme
    await page.keyboard.press('t'); await page.waitForTimeout(80);
    await goto(page, '#view=reflections&vr=1'); await setInput(page, '#z02Box', '150', 'change'); await blur(); await shot('dark_reflections_150');
    await goto(page, '#view=devices&device=custom&drive=fwd'); await shot('dark_devices_custom');
    await goto(page, '#view=cascade'); await shot('dark_cascade_100ohm');
    await page.keyboard.press('t');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
