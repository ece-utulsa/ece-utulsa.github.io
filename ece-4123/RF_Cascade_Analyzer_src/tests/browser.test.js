/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (text, data-q / data-v
   attributes, the URL hash); the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.4.1.html] [--shots]
   --shots also writes the 1280×720 presentation screenshots to ../screenshots/.
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots');
const FILE = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.4.1.html'));
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');
const URL0 = 'file://' + FILE;
const STOPS = ['#view=reflections&vr=0', '#view=devices&device=through&drive=fwd', '#view=devices&device=atten&drive=fwd', '#view=devices&device=amp&drive=fwd',
               '#view=devices&device=iso&drive=fwd', '#view=devices&device=custom&drive=fwd', '#view=cascade'];
const REV_STOPS = STOPS.slice(1, 6).map(x => x.replace('drive=fwd', 'drive=rev'));
const SVG_FS = [14, 18], PANEL_FS = [13, 16], HEAD_MAX = 32;   // v1.4.1 §0 on-screen text sizes (px) at 1920×1080 windowed and 1280×720 presentation
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
// Text with the inline subscript digits (₀…₉, v1.4.1) read as plain digits, so "b₂" compares as "b2".
const SUBS = '(t => t.replace(/[\u2080-\u2089]/g, c => String(c.charCodeAt(0) - 0x2080)))';
const text = (page, sel) => page.evaluate(([sel, S]) => { const e = document.querySelector(sel), f = eval(S); return e ? f(e.textContent.trim()) : null; }, [sel, SUBS]);
const stageTexts = page => page.evaluate(S => { const f = eval(S); return [...document.querySelectorAll('#stage text')].map(t => f(t.textContent)); }, SUBS);
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
// ── SIZES ── (v1.4.1 §0) every drawn <text> 14–18 px on screen (its font size × the drawing's scale); side-panel text
// 13–16 px; headline readouts ≤ 32 px. Returns { bad, svg: [min, max], panel: [min, max], head: max }.
async function sizeReport(page){
  return page.evaluate(([SV, PN, HM]) => {
    const bad = [], svg = document.querySelector('#stage svg'), k = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1, mm = { svg: [99, 0], panel: [99, 0], head: 0 };
    const note = (key, v) => { mm[key][0] = Math.min(mm[key][0], v); mm[key][1] = Math.max(mm[key][1], v); };
    if(svg) svg.querySelectorAll('text').forEach(t => { if(!t.textContent.trim()) return; const fs = parseFloat(getComputedStyle(t).fontSize) * k; note('svg', fs);
      if(fs < SV[0] - 0.3 || fs > SV[1] + 0.3) bad.push('svg ' + fs.toFixed(1) + ' "' + t.textContent.slice(0, 20) + '"'); });
    const w = document.createTreeWalker(document.getElementById('panel'), NodeFilter.SHOW_TEXT);
    while(w.nextNode()){ const n = w.currentNode, e = n.parentElement, r = e.getBoundingClientRect(); if(!n.textContent.trim() || !r.width) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if(e.closest('.ro.head .v')){ mm.head = Math.max(mm.head, fs); if(fs > HM + 0.3) bad.push('headline ' + fs); continue; }
      note('panel', fs); if(fs < PN[0] - 0.3 || fs > PN[1] + 0.3) bad.push('panel ' + fs + ' "' + n.textContent.trim().slice(0, 20) + '"'); }
    return { bad, mm };
  }, [SVG_FS, PANEL_FS, HEAD_MAX]);
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
// the box no text but the four S name tags, which stay inside it (v1.3.0 items 1, 6; v1.4.0 B.2); each port drawn as
// the two-port symbol — two solid terminal wires from a terminal dot at the 16 px edge to the box, never faded, the top
// wires in line with the S21 lane and the bottom wires with the S12 lane (v1.4.1 B.1, as revised by Douglas: the paths
// join the ports, signal-flow style); S tags ≥ 8 px clear of every lane
// and U-turn (v1.4.1 B.2); matrix entries ≤ 20 px, row 2 ≤ 16 px, badge text ≤ 16 px (v1.4.1 B.3).
const devGapIssues = page => page.evaluate(() => {
  const bad = [], R = e => e.getBoundingClientRect(), sv = document.querySelector('#stage svg'), svg = R(sv), box = R(document.querySelector('#stage .box')), k = svg.width / sv.viewBox.baseVal.width;
  const mat = R(document.querySelector('#stage .matrix')), num = R(document.getElementById('numRow')), badges = [...document.querySelectorAll('#stage .badge')].map(R);
  const g = (name, v, min) => { if(v < min - 0.05) bad.push(name + ' ' + v.toFixed(1) + ' < ' + min); };
  g('box→matrix', mat.top - box.bottom, 16);
  g('numeric row→badges', Math.min(...badges.map(r => r.top)) - num.bottom, 12); g('badges→screen bottom', window.innerHeight - Math.max(...badges.map(r => r.bottom)), 12);
  g('matrix rows from left edge', Math.min(mat.left, num.left) - svg.left, 16); g('matrix rows from divider', svg.right - Math.max(mat.right, num.right), 16);
  g('row 1 → row 2', num.top - mat.bottom, 4);
  const pl = [...document.querySelectorAll('#stage .portline')], cyOf = e => { const r = R(e); return (r.top + r.bottom) / 2; };
  const ends = k => { const e = document.querySelector('#stage .lane.' + k), M = e.getScreenCTM(), xs = e.getAttribute('d').match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0), P = (x, y) => new DOMPoint(x, y).matrixTransform(M); return [P(0, 0), P(Math.max(...xs), 0)]; };
  const yT = ends('s21')[0].y, yB = ends('s21')[1].y;   // the a nodes (top) and b nodes (bottom)
  if(pl.length !== 4) bad.push('port wires: ' + pl.length);
  if(document.querySelectorAll('#stage .term').length !== 4) bad.push('terminal dots: ' + document.querySelectorAll('#stage .term').length);
  pl.forEach(l => { const r = R(l), cs = getComputedStyle(l), port = l.dataset.port;
    if(cs.strokeDasharray !== 'none' || l.closest('[opacity]') || l.getAttribute('stroke') !== 'var(--txt)' || +l.getAttribute('stroke-width') !== 3) bad.push('port line ' + port + ' not solid');
    const y = (r.top + r.bottom) / 2; if(Math.min(Math.abs(y - yT), Math.abs(y - yB)) > 1) bad.push('port wire ' + port + ' not in line with a lane');
    if(port === '1' ? (Math.abs(r.left - svg.left - 21 * k) > 1 || Math.abs(r.right - box.left) > 2) : (Math.abs(svg.right - r.right - 21 * k) > 1 || Math.abs(r.left - box.right) > 2)) bad.push('port line ' + port + ' ends'); });
  // the paths' outlines sampled on screen (lanes may be diagonal, so their boxes say nothing), less half a stroke
  const ink = [...document.querySelectorAll('#stage .lane, #stage .uturn, #stage .brk')].flatMap(e => { const M = e.getScreenCTM(), Ln = e.getTotalLength(), o = e.classList.contains('lane') ? 0 : (parseFloat(getComputedStyle(e).strokeWidth) || 0) / 2 * k, out = [];
    for(let t = 0; t <= Ln; t += 1.5){ const p = e.getPointAtLength(t), q = new DOMPoint(p.x, p.y).matrixTransform(M); out.push([q.x, q.y, o]); } return out; });
  ['vs11', 'vs21', 'vs12', 'vs22'].forEach(id => { const t = R(document.getElementById(id));
    const dmin = Math.min(...ink.map(([x, y, o]) => Math.hypot(Math.max(t.left - x, 0, x - t.right), Math.max(t.top - y, 0, y - t.bottom)) - o)); if(dmin < 8 * k - 0.5) bad.push(id + ' within 8 px of a path (' + dmin.toFixed(1) + ')'); });
  const texts = [...document.querySelectorAll('#stage svg text')].filter(t => !t.closest('.matrix, .badge, .numrow'));
  texts.forEach(t => { const r = R(t), name = t.id || t.textContent.slice(0, 12); g(name + ' from left edge', r.left - svg.left, 16); g(name + ' from divider', svg.right - r.right, 16);
    const inside = r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top, sLab = /^vs(11|21|12|22)$/.test(t.id);
    if(inside && !sLab) bad.push('text inside the box: "' + t.textContent + '"');
    if(sLab && !(r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom)) bad.push(t.id + ' not inside the box'); });
  if([...document.querySelectorAll('#stage .ment')].some(e => +e.getAttribute('font-size') > 20)) bad.push('matrix entries > 20');
  if([...document.querySelectorAll('#stage .nent')].some(e => +e.getAttribute('font-size') > 16)) bad.push('row 2 entries > 16');
  if([...document.querySelectorAll('#stage .badge text')].some(e => +e.getAttribute('font-size') > 16)) bad.push('badge text > 16');
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
    check('version v1.4.1: header comment, Released, meta, title; changelog v1.4.1 on top, then v1.4.0, v1.3.0, v1.2.1, v1.2.0 and v1.1.0 as history',
      /Version: v1\.4\.1/.test(html) && /Released: 2026-10-19/.test(html) && /<meta name="version" content="v1\.4\.1">/.test(html) && /<title>RF Cascade Analyzer v1\.4\.1<\/title>/.test(html)
      && /v1\.4\.1 - Declutter: smaller text at all window sizes; Reflections — separate power rows, voltage plot\s+enlarged, titles\/legend\/caption to the side panel, VSWR equation and extra labels removed, incident\/reflected\s+off by default; Devices — one port line per side, waves as arrows beside it, thinner paths, smaller matrix;\s+Cascade — S-parameter editor shown on selection\./.test(html)
      && ['v1.4.1', 'v1.4.0', 'v1.3.0', 'v1.2.1', 'v1.2.0', 'v1.1.0'].every((v, n, a) => n === 0 || html.indexOf(a[n - 1] + ' - ') < html.indexOf(v + ' - '))
      && /spec_RF_Cascade_Analyzer_v1\.1\.0/.test(html) && !/RF Cascade Analyzer v1\.(1\.0|2\.[01]|3\.0|4\.0)|content="v1\.(1\.0|2\.[01]|3\.0|4\.0)"/.test(html));
    check('footer: v1.4.1 · released 2026-10-19 · Author: Claude Code', (await text(page, 'footer')).includes('v1.4.1 · released 2026-10-19 · Author: Claude Code'));
    const stamp = async () => page.evaluate(() => { const v = document.getElementById('verStamp'), r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const btns = [...document.querySelectorAll('#top button')].filter(b => b.getBoundingClientRect().width), last = btns[btns.length - 1].getBoundingClientRect(), top = document.getElementById('top').getBoundingClientRect();
      return { text: v.textContent, fs: parseFloat(cs.fontSize), mut: cs.color === getComputedStyle(document.querySelector('.note') || document.body).color || cs.color !== getComputedStyle(document.body).color,
        right: r.left >= last.right && r.right <= top.right + 0.5, shown: r.width > 0 && cs.visibility !== 'hidden', body: document.body.innerText.includes('v1.4.1'),
        oneRow: btns.every(b => { const r = b.getBoundingClientRect(), r0 = btns[0].getBoundingClientRect(); return Math.abs((r.top + r.bottom) - (r0.top + r0.bottom)) < 2; }) }; });
    let st = await stamp();
    check('stamp "v1.4.1" in the top bar, right of the last button, 14 px, muted (windowed)', st.text === 'v1.4.1' && st.fs === 14 && st.right && st.shown && st.mut && st.oneRow, st);
    const wBtn = await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(','));
    await present(page); st = await stamp();
    check('presentation (light): stamp visible right of Present; body.innerText contains "v1.4.1"; buttons one row', st.shown && st.right && st.body && st.oneRow && st.fs === 14, st);
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

  console.log('View 1 — Reflections (v1.4.0 A.6, v1.4.1 layout)');
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
      ['150', '+0.50', '1.50', '1 + 0.50 = 1.50', 'Pₜ = Vₜ²·Z01/Z02 = 1.50² × 50/150 = 75 %', ['25 %', '75 %'], null, '3.0', 'VSWR = Vmax/Vmin = 1.5/0.50 = 3.0'],
      ['16.7', '−0.50', '0.50', '1 + (−0.50) = 0.50', 'Pₜ = Vₜ²·Z01/Z02 = 0.50² × 50/16.7 = 75 %', ['25 %', '75 %'], null, '3.0', 'VSWR = Vmax/Vmin = 1.5/0.50 = 3.0'],
      ['50', '0', '1.00', '1 + 0 = 1.00', 'Pₜ = 100 %', ['0 %', '100 %'], 'P_refl', '1.0', 'VSWR = Vmax/Vmin = 1.0/1.0 = 1.0'],
      ['0', '−1.00', '0', '1 + (−1.00) = 0', 'Vₜ = 0 → Pₜ = 0 %', ['100 %', '0 %'], 'P_trans', '∞', 'VSWR = Vmax/Vmin = 2.0/0 = ∞'],
      ['open', '+1.00', '2.00', '1 + 1.00 = 2.00', 'Pₜ = 0 % (Z02 = ∞)', ['100 %', '0 %'], 'P_trans', '∞', 'VSWR = Vmax/Vmin = 2.0/0 = ∞'] ];
    for(const [z, gm, tau, l1, l2, [pr, pt], ghost, vs, vline] of A6){
      await setInput(page, '#z02Box', z, 'change');
      const T = { g: await text(page, '#roGamma'), vs: await text(page, '#roVswr'), tau: await text(page, '#roTau'), r1: await text(page, '#readV'), r2: await text(page, '#readP'),
        inc: await text(page, '#pInc'), refl: await text(page, '#pRefl'), tr: await text(page, '#pTrans'), vl: await page.$('.vswrLine') };
      const gh = await page.evaluate(() => ['P_inc', 'P_refl', 'P_trans'].filter(q => document.querySelector('[data-q="' + q + '"]').getAttribute('data-ghost') === '1').join(','));
      check('Z02 = ' + z + ': Γ ' + gm + ', τ ' + tau + ', VSWR ' + vs + ' (panel); readout "' + l1 + '" / "' + l2 + '"; arrows 100 / ' + pr + ' / ' + pt + (ghost ? ' (' + ghost + ' ghost)' : '') + '; no VSWR line on the drawing',
        T.g === gm && T.vs === vs && T.tau === 'τ = 1 + Γ = ' + tau && flat(T.r1) === 'V⁺ + V⁻ = Vₜ ' + l1 && T.r1.includes('Vₜ\u00a0\u00a0 1') && T.r2 === l2
        && T.inc === 'Incident 100 %' && T.refl === 'Reflected |Γ|² = ' + pr && T.tr === 'Transmitted 1 − |Γ|² = ' + pt && gh === (ghost || '') && T.vl === null, T);
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
    check('Z02 drawn is the control value; titles, legend and caption in the side panel, not on the drawing', (await text(page, '#z02Label')).endsWith('= 150 Ω')
      && await page.evaluate(() => { const P = document.getElementById('panel').innerText, T = document.getElementById('stage').textContent;
        return P.includes('Power at the interface — arrow thickness = share of the power (incident = 100 %)') && P.includes('Voltage on the lines (incident amplitude = 1)')
          && P.includes('Both regions have the same propagation speed (same λ). Region 2 is infinitely long.') && !/Power at the interface|Voltage on the lines|Both regions|continues to|VSWR|Region 1 · 50 Ω/.test(T); }));
    check('side-panel legend under the switch: incident v⁺, reflected v⁻, total (Region 1), transmitted vₜ, envelope', JSON.stringify(await page.$$eval('#panel .legend li', e => e.map(x => x.textContent))) === JSON.stringify(['incident v⁺', 'reflected v⁻', 'total (Region 1)', 'transmitted vₜ', 'envelope'])
      && await page.evaluate(() => document.querySelector('#panel .chk').compareDocumentPosition(document.querySelector('#panel .legend')) === Node.DOCUMENT_POSITION_FOLLOWING));
    check('distance ticks 2λ, 3λ/2, λ, λ/2, interface; Region 2 λ/4, λ/2', JSON.stringify((await stageTexts(page)).filter(t => /^(\d?λ(\/\d)?|3λ\/2|interface)$/.test(t))) === JSON.stringify(['2λ', '3λ/2', 'λ', 'λ/2', 'interface', 'λ/4', 'λ/2']));
    check('"Vmax 1.5" and "Vmin 0.50": short labels (≤ 16 px) at the left end of the envelope; no Vmax / Vmin lines across the plot', (await stageTexts(page)).includes('Vmax 1.5') && (await stageTexts(page)).includes('Vmin 0.50')
      && await page.evaluate(() => { const env = document.querySelector('[data-q="envelope"]').getBoundingClientRect();
        return ['lvVmax', 'lvVmin'].every(id => { const e = document.getElementById(id); return +e.getAttribute('font-size') <= 16 && e.getBoundingClientRect().right <= env.left; }) && !document.querySelector('#stage line.level'); }));
    check('line weights: total and transmitted 3, incident / reflected 1.5 dashed, envelope edge 1.5 with a ~12 % fill', await page.evaluate(() => { const a = (id, n) => document.getElementById(id).getAttribute(n);
      return a('vTot', 'stroke-width') === '3' && a('vTr', 'stroke-width') === '3' && a('vInc', 'stroke-width') === '1.5' && a('vRef', 'stroke-width') === '1.5' && !!a('vInc', 'stroke-dasharray')
        && document.querySelector('[data-q="envelope"]').getAttribute('stroke-width') === '1.5' && document.querySelector('#stage .shade').getAttribute('fill-opacity') === '0.12'; }));
    check('panels: power ≈ 30 % of the drawing; the plot (axis to top of the curve area) ≥ 55 %', await page.evaluate(() => { const sv = document.querySelector('#stage svg'), H = sv.viewBox.baseVal.height;
      const box = sv.querySelector('rect').getBBox(), e = sv.querySelector('[data-q="envelope"]'), A = +e.dataset.a, yc = +e.dataset.yc, axis = [...sv.querySelectorAll('line')].find(l => l.getAttribute('stroke') === 'var(--mut)' && l.getAttribute('y1') === l.getAttribute('y2'));
      return Math.abs((box.y + box.height) / H - 0.28) < 0.04 && (+axis.getAttribute('y1') + 8 - (yc - 2 * A)) / H >= 0.55; }));
    check('readout: line 1 ≤ 18 px bold, line 2 ≤ 15 px; in the top-right corner, above the curves', await page.evaluate(() => { const r = document.querySelector('#stage .readout rect').getBoundingClientRect(), sv = document.querySelector('#stage svg').getBoundingClientRect();
      const tint = [...document.querySelectorAll('#stage .tint')].map(t => t.getBoundingClientRect().top);
      return +document.getElementById('readV').getAttribute('font-size') <= 18 && document.getElementById('readV').getAttribute('font-weight') === '700' && +document.getElementById('readP').getAttribute('font-size') <= 15
        && r.bottom <= Math.min(...tint) && Math.abs(sv.right - r.right - 16 * sv.width / 900) < 1 && r.left > (sv.left + sv.right) / 2; }));
    await setInput(page, '#z02Box', 'open', 'change');
    check('Open: incident and reflected bands on separate rows, ≥ 10 px clear at their thickest', await page.evaluate(() => { const b = q => document.querySelector('[data-q="' + q + '"]').getBoundingClientRect();
      return b('P_refl').top - b('P_inc').bottom >= 10 && Math.abs((b('P_trans').top + b('P_trans').bottom) / 2 - (b('P_inc').top + b('P_inc').bottom) / 2) < 1; }));
    await setInput(page, '#z02Box', '150', 'change');
    check('no complex Γ on this view', !/∠/.test(await text(page, '#panel')) && !(await stageTexts(page)).some(t => /∠/.test(t)));
    // the incident/reflected switch and its hash
    const shown = () => page.evaluate(() => ['vInc', 'vRef', 'vTot', 'vTr'].map(id => getComputedStyle(document.getElementById(id)).display !== 'none').join(','));
    await page.goto(URL0 + '#view=devices'); await page.waitForTimeout(100); await page.goto(URL0); await page.reload(); await page.waitForTimeout(200);
    check('"Show incident and reflected" off by default: envelope, total and transmitted only; hash vr=0', !(await page.isChecked('#showVR')) && (await shown()) === 'false,false,true,true' && (await page.evaluate(() => location.hash)) === '#view=reflections&vr=0');
    await page.click('#showVR'); await page.waitForTimeout(60);
    check('ticked: the incident and reflected curves added; hash vr=1', (await shown()) === 'true,true,true,true' && (await page.evaluate(() => location.hash)) === '#view=reflections&vr=1');
    await page.goto(URL0 + '#view=reflections&vr=0'); await page.waitForTimeout(150); await page.goto(URL0 + '#view=reflections&vr=1'); await page.waitForTimeout(150);
    check('hash round-trip: #view=reflections&vr=1 restores the switch on', (await page.isChecked('#showVR')) && (await shown()) === 'true,true,true,true');
    await click(page, '#bShort'); await setInput(page, '#z02Box', 'abc', 'change');
    check('invalid Z02 text is flagged and ignored', (await page.getAttribute('#z02Box', 'aria-invalid')) === 'true' && (await text(page, '#roVswr')) === '∞');
    await setInput(page, '#z02Box', '150', 'change'); await page.evaluate(() => document.activeElement.blur());
    if((await page.textContent('#pauseBtn')) === 'Pause') await page.keyboard.press('p');   // a hash-only goto keeps the pause state
    await page.waitForTimeout(50);
    const d0 = await page.getAttribute('#vTot', 'd'); await page.keyboard.press('t'); await page.waitForTimeout(80);
    const d1 = await page.getAttribute('#vTot', 'd');
    check('the total wave keeps its phase across a theme change', d0 === d1);
    await ctx.close(); }

  console.log('View 2 — Devices (v1.3.0 two-port, v1.4.0 matrix rows and colours, v1.4.1 port lines and sizes)');
  { const { ctx, page } = await open(browser);
    await present(page);
    // lanes (S21, S12) and U-turns (S11, S22): |S|, end width, blocked / capped flags, the group's drive state and opacity
    const paths = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .lane, #stage .uturn')].map(e => [e.getAttribute('data-q'),
      { v: +e.getAttribute('data-v'), w1: +e.getAttribute('data-w1'), lane: e.classList.contains('lane'), blocked: e.getAttribute('data-blocked') === '1', cap: e.getAttribute('data-capped') === '1',
        dotted: !!e.getAttribute('stroke-dasharray'), op: +(e.getAttribute('opacity') || 1), live: e.closest('.pathg').getAttribute('data-live') === '1', gop: +(e.closest('.pathg').getAttribute('opacity') || 1) }])));
    // a lane's drawn width (design units) at its entry and just before its arrowhead
    const laneW = k => page.evaluate(k => { const e = document.querySelector('#stage .lane.' + k);
      const n = e.getAttribute('d').match(/-?[\d.]+/g).map(Number), pts = []; for(let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      return { w0: Math.abs(pts[pts.length - 1][1] - pts[0][1]), wEnd: pts.length > 3 ? Math.abs(pts[pts.length - 2][1] - pts[1][1]) : 0 }; }, k);
    const badges = () => page.evaluate(() => [...document.querySelectorAll('#stage .badge')].map(b => b.getAttribute('data-on')).join(''));
    const cross = () => page.evaluate(() => { const x = document.querySelector('#stage .xmark'); if(!x) return null; const box = document.querySelector('#stage .box').getBoundingClientRect(), r = x.getBoundingClientRect();
      return { s: x.getAttribute('data-s'), outside: r.right <= box.left + 1 || r.left >= box.right - 1, strong: !x.closest('[opacity]'), red: x.querySelector('path').getAttribute('stroke') === 'var(--bad)' }; });
    const waves = () => page.evaluate(S => { const f = eval(S); return Object.fromEntries(['a1', 'a2', 'b1', 'b2'].map(k => [k, f(document.getElementById('w' + k).textContent)])); }, SUBS);
    const powerLine = () => page.evaluate(S => { const e = document.getElementById(location.hash.includes('drive=rev') ? 'pb1' : 'pb2'); return e ? eval(S)(e.textContent) : null; }, SUBS);
    const ghostW = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .wave')].map(e => [e.getAttribute('data-q'), e.getAttribute('data-ghost') === '1'])));
    const heads = async () => [null, await text(page, '#roPower')];
    const keys = async () => [null, await page.evaluate(() => document.getElementById('roPower').previousSibling.textContent)];
    const outLabel = () => page.evaluate(() => { const d = location.hash.includes('drive=rev') ? 'wb1' : 'wb2', e = document.getElementById(d); return { size: +e.getAttribute('font-size'), weight: e.getAttribute('font-weight') }; });
    const sLab = k => text(page, '#v' + k), ent = k => text(page, '#n_' + k), row2 = () => page.getAttribute('#numRow', 'data-text');
    const W0 = 16;
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
      ['Custom (S11 0.30∠40°, S21 = S12 0.60∠−70°, S22 0.40∠−20°), Forward (S11 U-turn max(2, 0.09 W0) = 2)', '#view=devices&device=custom&drive=fwd', null, null, async (P) => near(P.S11.w1, Math.max(2, W0 * 0.09), 0.01) && P.S11.live && !P.S22.live && near(P.S22.gop, 0.22, 1e-9)
        && near(P.S21.w1, W0 * 0.36, 0.02) && near(P.S12.w1, W0 * 0.36, 0.02) && (await waves()).b1 === 'b1 = 0.30∠40°', 'b2 = 0.60∠−70°', '|b2|² = 0.36'] ];
    for(const [name, hs, ctl, v, lanes, wave, power] of CASES){
      await goto(page, hs); if(ctl) await setInput(page, '#' + ctl, v);
      const P = await paths(), L21 = await laneW('s21'), L12 = await laneW('s12'), W = await waves(), out = hs.includes('drive=rev') ? 'b1' : 'b2';
      check(name + ': lanes and U-turns as specified', await lanes(P, L21, L12), { P, L21, L12 });
      check(name + ': ' + wave + ', ' + power, W[out] === wave && (await powerLine()) === power, { W, p: await powerLine() });
    }
    // general rules
    await goto(page, '#view=devices&device=atten&drive=fwd');
    { const L = await laneW('s21'); check('taper: a lane starts at W0 = 16 for the input power 1 and narrows linearly (3 dB: towards ½ W0 at the exit)', near(L.w0, 16, 0.1) && L.wEnd < L.w0 && L.wEnd > 8, L); }
    const noText = await page.evaluate(() => { const box = document.querySelector('#stage .box').getBoundingClientRect();
      return [...document.querySelectorAll('#stage svg text')].filter(t => { const r = t.getBoundingClientRect(); return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top; }).map(t => t.id).sort().join(','); });
    check('inside the box: only the four S labels (no "Two-Port", dB caption, ruler or isolator text)', noText === 'vs11,vs12,vs21,vs22', noText);
    check('the box is a plain rounded rectangle (rx 14, 3 px border); no header line', await page.evaluate(() => { const b = document.querySelector('#stage .box');
      return b.getAttribute('rx') === '14' && b.getAttribute('stroke-width') === '3' && !document.querySelector('#stage .headline, #stage .boxTitle, #boxCaption'); }));
    check('port layout (textbook two-port signal-flow graph): two terminal wires per port with dots at the outer ends — the top wires at the a nodes, the bottom wires at the b nodes; "Port 1/2" above the wires; a1 and a2 in above the top wires, b1 and b2 out below the bottom wires; S21 a1 → b2 and S12 a2 → b1 cross; S11 runs down port 1 (a1 → b1), S22 down port 2 (a2 → b2)', await page.evaluate(() => {
      const q = s => document.querySelector('#stage ' + s), r = n => q('.wave[data-q="' + n + '"]').getBoundingClientRect(), cy = e => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; };
      const dir = n => -Math.sign(+q('.wave[data-q="' + n + '"] path:last-child').getAttribute('d').match(/^M(-?[\d.]+) -?[\d.]+l(-?[\d.]+)/)[2]);
      const ends = k => { const e = document.querySelector('#stage .lane.' + k), M = e.getScreenCTM(), xs = e.getAttribute('d').match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0), P = (x, y) => new DOMPoint(x, y).matrixTransform(M); return [P(0, 0), P(Math.max(...xs), 0)]; };
      const [a1, b2] = ends('s21'), [a2, b1] = ends('s12'), yT = a1.y, yB = b2.y, box = q('.box').getBoundingClientRect();
      const wires = n => [...document.querySelectorAll('#stage .portline[data-port="' + n + '"]')].map(cy).sort((a, b) => a - b);
      const ports = [...document.querySelectorAll('#stage .port')].map(e => e.getBoundingClientRect()), u11 = q('.uturn.s11').getBoundingClientRect(), u22 = q('.uturn.s22').getBoundingClientRect();
      const inLine = (w) => w.length === 2 && Math.abs(w[0] - yT) < 1 && Math.abs(w[1] - yB) < 1, near = (p, x, y) => Math.abs(p.x - x) < 16 && Math.abs(p.y - y) < 1;
      return inLine(wires(1)) && inLine(wires(2)) && document.querySelectorAll('#stage .term').length === 4
        && near(a1, box.left, yT) && near(b2, box.right, yB) && near(a2, box.right, yT) && near(b1, box.left, yB) && Math.abs(a2.y - yT) < 1 && Math.abs(b1.y - yB) < 1
        && r('a1').bottom <= yT && r('a2').bottom <= yT && r('b1').top >= yB && r('b2').top >= yB && dir('a1') === 1 && dir('b1') === -1 && dir('a2') === -1 && dir('b2') === 1
        && ['a1', 'b1', 'b2', 'a2'].every(n => Math.abs(r(n).width - 120) < 2) && ports.length === 2 && ports.every(p => p.bottom <= yT)
        && u11.left >= box.left - 1 && u11.top >= yT && u11.bottom <= yB && u11.bottom - u11.top > 0.6 * (yB - yT) && u22.right <= box.right + 1 && u22.top >= yT && u22.bottom <= yB; }));
    check('paths stay inside the box (the crossing diagonals start inset from the a corners)', await page.evaluate(() => { const box = document.querySelector('#stage .box').getBoundingClientRect();
      // sampled outline points (a rotated lane's bounding box is the box of its rotated rectangle, not of the shape)
      return [...document.querySelectorAll('#stage .lane')].every(e => { const M = e.getScreenCTM(), Ln = e.getTotalLength();
        for(let t = 0; t <= Ln; t += 1){ const p = e.getPointAtLength(t), q = new DOMPoint(p.x, p.y).matrixTransform(M); if(q.x < box.left - 0.5 || q.x > box.right + 0.5 || q.y < box.top || q.y > box.bottom) return false; } return true; }); }));
    check('Forward: S21 lane and S11 U-turn solid; S12 and S22 faded to 22 %; undriven a2 wire dotted', await (async () => { const P = await paths(), g = await ghostW();
      return P.S21.live && P.S11.live && P.S21.gop === 1 && near(P.S12.gop, 0.22, 1e-9) && near(P.S22.gop, 0.22, 1e-9) && g.a2 && !g.a1; })());
    check('S tags: S21 and S12 above the crossing, each beside its own diagonal near its a node (S21 left, S12 right); S11 left of S22 at mid height; all inside the box', await page.evaluate(() => { const R = id => document.getElementById(id).getBoundingClientRect(), c = r => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
      const box = document.querySelector('#stage .box').getBoundingClientRect(), midY = (box.top + box.bottom) / 2, [x21, y21] = c(R('vs21')), [x12, y12] = c(R('vs12'));
      return y21 < midY && y12 < midY && x21 < x12 && R('vs11').right < R('vs22').left && ['vs11', 'vs21', 'vs12', 'vs22'].every(id => { const r = R(id); return r.left > box.left && r.right < box.right && r.top > box.top && r.bottom < box.bottom; }); }));
    check('S11 0 drawn as a faint dotted U (2 px, 45 % opacity) when |S| < 0.05; tag "S11" in the box, "0" in the matrix', await (async () => { const P = await paths(); return P.S11.dotted && near(P.S11.op, 0.45, 1e-9) && (await sLab('s11')) === 'S11' && (await ent('s11')) === '0'; })());
    check('the driven output label (b2 in Forward) is 18 px bold, the others 16 px; its |b2|² line 16 px regular', JSON.stringify(await outLabel()) === '{"size":18,"weight":"700"}' && +(await page.getAttribute('#wb1', 'font-size')) === 16
      && +(await page.getAttribute('#pb2', 'font-size')) === 16 && (await page.getAttribute('#pb2', 'font-weight')) === '400');
    check('panel: the power only (power out = |b2|² = 50 %); caption about normalized waves; never "power wave"', (await heads())[1] === '50 %' && (await keys())[1] === 'power out = |b2|²'
      && (await text(page, '#panel')).includes('a, b = normalized waves (a = V⁺/√Z0). Power = |wave|².') && !/power wave/i.test(await page.evaluate(() => document.body.innerText)));
    check('no numeric line "[b] = [S] · [a]" any more; one numeric row', !(await page.$('#numLine')) && (await page.$$('#stage .numrow')).length === 1);
    check('Attenuator: badges R ✓ S ✓ L ✗ P ✓', (await badges()) === '1101');
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30');
    { const P = await paths(); check('Amplifier 30 dB (max): S21 still capped at 3 W0 = 48 with the break mark; b2 = 31.6∠0°, |b2|² = 1000; badges all ✗', P.S21.cap && near(P.S21.w1, 48, 0.01)
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
    check('Matrix row 1 entries 18 px; row 2 entries 16 px (Custom, four long entries, fits without the 14 px fallback); badges 32 high, text 16', await page.evaluate(() => [...document.querySelectorAll('#stage .ment')].every(e => +e.getAttribute('font-size') === 18)
      && [...document.querySelectorAll('#stage .nent')].every(e => +e.getAttribute('font-size') === 16) && document.getElementById('numRow').dataset.fs === '16'
      && [...document.querySelectorAll('#stage .badge rect')].every(e => +e.getAttribute('height') === 32) && [...document.querySelectorAll('#stage .badge text')].every(e => +e.getAttribute('font-size') === 16)));
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
    check('B.1 Through Forward: "|b2|² = 1.0" on the outer side of "b2 = 1.00∠−90°" (below it: b2 is on the bottom wire), clear of "Port 2"', await page.evaluate(() => { const R = id => document.getElementById(id).getBoundingClientRect();
      const p = R('pb2'), w = R('wb2'), port = [...document.querySelectorAll('#stage .port')][1].getBoundingClientRect();
      return p.top >= w.bottom && !(p.left < port.right && port.left < p.right && p.top < port.bottom && port.top < p.bottom) && document.getElementById('pb2').textContent === '|b₂|² = 1.0'; }));
    check('B.2 no S value inside the box; each name tag once', await page.evaluate(S => { const f = eval(S); return ['s11', 's21', 's12', 's22'].every(k => f(document.getElementById('v' + k).textContent) === 'S' + k.slice(1))
      && [...document.querySelectorAll('#stage svg text')].filter(t => /^S(11|21|12|22)$/.test(f(t.textContent)) && !t.closest('.matrix')).length === 4; }, SUBS));
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
    check('no "Edit S-parameters" button; the S entries show with the knob (Attenuator 6 dB: S21 0.501187)', !(await page.$('#toCustom')) && near(+(await page.inputValue('#ks21m')), 0.501187, 1e-5) && !!(await page.$('#kAtt')));
    await setInput(page, '#ks11a', '0');
    check('editing an S entry converts the block to Custom with its values (knob gone)', (await text(page, '#panel .sec')) === 'Block 2 · Custom' && near(+(await page.inputValue('#ks21m')), 0.501187, 1e-5) && !(await page.$('#kAtt')));
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

  console.log('Cascade S editor (v1.4.1 C.2)');
  { const { ctx, page } = await open(browser); await present(page); await goto(page, '#view=cascade');
    const S = () => page.evaluate(() => Object.fromEntries(['s11', 's21', 's12', 's22'].map(k => [k, [+document.getElementById('k' + k + 'm').value, +document.getElementById('k' + k + 'a').value]])));
    let v = await S();
    check('Amplifier 10 dB selected by default: its knob and S21 3.16, S12 0, S11 0, S22 0 shown at once', (await text(page, '#panel .sec')) === 'Block 1 · Amplifier' && !!(await page.$('#kGain'))
      && near(v.s21[0], 3.16228, 1e-4) && v.s12[0] === 0 && v.s11[0] === 0 && v.s22[0] === 0 && !(await page.isChecked('#krecip')), v);
    await setInput(page, '#kGain', '20'); v = await S();
    check('moving the gain knob updates S21 live (20 dB: 10.0), the panel not rebuilt', near(v.s21[0], 10, 1e-9) && !!(await page.$('#kGain')), v);
    await setInput(page, '#kGain', '10');
    for(const [i, name, k, m] of [[1, 'Attenuator', 's21', 0.707946], [2, 'Custom', 's21', 0.9]]){ await page.click('#stage [data-blk="' + i + '"]'); await page.waitForTimeout(60);
      check('selecting block ' + (i + 1) + ' (' + name + ') shows its S values (' + k.toUpperCase() + ' ' + m + ')', (await text(page, '#panel .sec')) === 'Block ' + (i + 1) + ' · ' + name && near((await S())[k][0], m, 1e-5)); }
    await page.click('#stage [data-blk="0"]'); await page.waitForTimeout(60);
    await setInput(page, '#ks11m', '0.1'); v = await S();
    check('editing S11 turns the Amplifier into Custom with S21 still 3.16', (await text(page, '#panel .sec')) === 'Block 1 · Custom' && !(await page.$('#kGain')) && near(v.s21[0], 3.16228, 1e-4) && near(v.s11[0], 0.1, 1e-9)
      && (await page.$$eval('#stage .keyv', e => e.map(x => x.textContent)))[0] === '+10 dB', v);
    await ctx.close(); }

  console.log('Overlaps, sizes and layout');
  const states = async (page, fn) => { for(const hs of STOPS.concat(REV_STOPS)){ await goto(page, hs); await fn(hs); }
    for(const vr of ['1', '0']){ await goto(page, '#view=reflections&vr=' + vr);
      for(const z of ['150', '16.7', '50', '0', 'open', '52']){ await setInput(page, '#z02Box', z, 'change');
        for(let n = 0; n < 8; n++){ await page.waitForTimeout(250); await fn('reflections Z02 = ' + z + ', vr=' + vr + ', t' + n); } } }   // 8 instants over one 2 s period
    await goto(page, '#view=reflections&vr=0'); await setInput(page, '#z02Box', '150', 'change');
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
  for(const [vw, label, pres, sizes] of [[{ width: 1280, height: 720 }, 'presentation 1280×720', true, true], [{ width: 1920, height: 1080 }, 'windowed 1920×1080', false, true],
                                         [{ width: 1920, height: 1080 }, 'presentation 1920×1080', true, false], [{ width: 1366, height: 768 }, 'windowed 1366×768', false, false]]){
    const { ctx, page, log } = await open(browser, { viewport: vw });
    if(pres) await present(page);
    const ov = [], sz = [], lay = [], ed = [], mm = { svg: [99, 0], panel: [99, 0], head: 0 };
    await states(page, async st => { (await overlapIssues(page)).forEach(x => ov.push(st + ': ' + x)); (await layoutIssues(page)).forEach(x => lay.push(st + ': ' + x));
      if(sizes){ const r = await sizeReport(page); r.bad.forEach(x => sz.push(st + ': ' + x));
        ['svg', 'panel'].forEach(key => { mm[key][0] = Math.min(mm[key][0], r.mm[key][0]); mm[key][1] = Math.max(mm[key][1], r.mm[key][1]); }); mm.head = Math.max(mm.head, r.mm.head); }
      (await edgeIssues(page)).forEach(x => ed.push(st + ': ' + x)); });
    check(label + ': no text overlaps a drawn element or another label (every view and device, both themes, both C.5 chains, 4 blocks; Reflections 5 cases, switch on and off, 8 instants)', ov.length === 0, ov.slice(0, 12));
    check(label + ': every label ≥ 16 px from the screen edges and the drawing/panel divider (all views)', ed.length === 0, ed.slice(0, 12));
    if(sizes){ check(label + ': drawn text 14–18 px, side-panel text 13–16 px, headlines ≤ 32 px', sz.length === 0, sz.slice(0, 8));
      console.log('       font sizes on screen: drawing ' + mm.svg.map(x => x.toFixed(1)).join('–') + ' px, side panel ' + mm.panel.map(x => x.toFixed(1)).join('–') + ' px, headlines ' + mm.head.toFixed(1) + ' px'); }
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
    console.log('Screenshots (1280×720 presentation and 1920×1080 windowed, Projector theme)');
    fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SHOT_DIR, f)));
    for(const [vw, pres, tag] of [[{ width: 1280, height: 720 }, true, 'p1280'], [{ width: 1920, height: 1080 }, false, 'w1920']]){
      const { ctx, page } = await open(browser, { viewport: vw, reducedMotion: 'reduce' });
      if(pres) await present(page); else { await page.keyboard.press('t'); await page.waitForTimeout(80); }   // windowed opens dark; T gives the Projector theme
      const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
      const shot = async name => { await blur(); await page.waitForTimeout(120); await page.screenshot({ path: path.join(SHOT_DIR, tag + '_' + name + '.png') }); console.log('  wrote ' + tag + '_' + name + '.png'); };
      await goto(page, '#view=reflections&vr=0'); await setInput(page, '#z02Box', '150', 'change'); await shot('reflections_150_switch_off');
      await goto(page, '#view=reflections&vr=1'); await shot('reflections_150_switch_on');
      await goto(page, '#view=devices&device=through&drive=fwd'); await shot('devices_through_forward');
      await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '10'); await shot('devices_amp_10dB_forward');
      await goto(page, '#view=devices&device=custom&drive=rev'); await shot('devices_custom_reverse');
      await goto(page, '#view=cascade'); await page.click('#stage [data-blk="0"]'); await page.waitForTimeout(60); await shot('cascade_check_chain_amplifier_selected');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
