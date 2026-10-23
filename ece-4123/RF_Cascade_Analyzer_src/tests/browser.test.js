/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (text, data-q / data-v
   attributes, the URL hash); the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.7.0.html] [--shots]
   --shots also writes the 1280×720 presentation screenshots to ../screenshots/.
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots');
const FILE = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.7.0.html'));
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
  for(const id of ['panel', 'top', 'devbar']){ const e = document.getElementById(id), vscroll = id === 'panel' && document.body.classList.contains('vcascade');   // the Cascade panel scrolls (v1.7.0)
    if(e && !e.classList.contains('hidden') && ((!vscroll && e.scrollHeight > e.clientHeight + 1) || e.scrollWidth > e.clientWidth + 1)) bad.push(id + ' overflows'); }
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
// ── DEVICES LAYOUT (v1.6.0 flow diagram) ── on screen, in px: the diagram above the matrix (≥ 12); numeric row →
// badges ≥ 12; badges → bottom of the screen ≥ 12; matrix rows ≥ 16 from the drawing's edges; the DUT box holds only the
// device's name ("(edited)" under it); the incident waves grey, each S path in its S colour; V1⁺ top-left and V2⁺
// bottom-right; S21 and S11 leave the V1⁺ junction, S12 and S22 the V2⁺ junction; the braces gather the outgoing waves.
const devGapIssues = page => page.evaluate(() => {
  const bad = [], R = e => e.getBoundingClientRect(), sv = document.querySelector('#stage svg'), svg = R(sv), box = R(document.querySelector('#stage .box'));
  const mat = R(document.querySelector('#stage .matrix')), num = R(document.getElementById('numRow')), badges = [...document.querySelectorAll('#stage .badge')].map(R);
  const g = (name, v, min) => { if(v < min - 0.05) bad.push(name + ' ' + v.toFixed(1) + ' < ' + min); };
  const flows = [...document.querySelectorAll('#stage .flow')], fb = flows.map(R), diagBottom = Math.max(...fb.map(r => r.bottom), ...[...document.querySelectorAll('#stage .flabel text')].map(t => R(t).bottom));
  g('diagram→matrix', mat.top - diagBottom, 12);
  g('numeric row→badges', Math.min(...badges.map(r => r.top)) - num.bottom, 12); g('badges→screen bottom', window.innerHeight - Math.max(...badges.map(r => r.bottom)), 12);
  g('matrix rows from left edge', Math.min(mat.left, num.left) - svg.left, 16); g('matrix rows from divider', svg.right - Math.max(mat.right, num.right), 16);
  g('row 1 → row 2', num.top - mat.bottom, 4);
  const inBox = [...document.querySelectorAll('#stage svg text')].filter(t => { const r = R(t); return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top; }).map(t => t.id).sort().join(',');
  if(!/^dut(Edited,dutName|Name)$/.test(inBox)) bad.push('text inside the DUT box: ' + inBox);
  const q = s => document.querySelector('#stage ' + s), col = k => q('.flow.path.' + k + ' .fline').getAttribute('stroke');
  if(['s11', 's21', 's12', 's22'].some(k => col(k) !== 'var(--' + k + ')')) bad.push('path colours');
  if(['#inc1', '#inc2'].some(id => q(id + ' .fline').getAttribute('stroke') !== 'var(--grey)')) bad.push('incident not grey');
  const pts = k => q('.flow.' + k + ' .fline').getAttribute('d').match(/-?[\d.]+/g).map(Number), first = k => pts(k).slice(0, 2), lastOf = id => { const p = q(id + ' .fline').getAttribute('d').match(/-?[\d.]+/g).map(Number); return p.slice(-2); };
  const j1 = lastOf('#inc1'), j2 = lastOf('#inc2');
  if(!['s21', 's11'].every(k => first(k)[0] === j1[0] && first(k)[1] === j1[1])) bad.push('S21/S11 do not leave the V1⁺ junction');
  if(!['s12', 's22'].every(k => first(k)[0] === j2[0] && first(k)[1] === j2[1])) bad.push('S12/S22 do not leave the V2⁺ junction');
  const startOf = id => q(id + ' .fline').getAttribute('d').match(/-?[\d.]+/g).map(Number).slice(0, 2);
  if(!(j1[1] < j2[1] && startOf('#inc1')[0] < j1[0] && startOf('#inc2')[0] > j2[0])) bad.push('V1⁺ not top-left / V2⁺ not bottom-right');
  if(document.querySelectorAll('#stage .brace').length !== 2) bad.push('braces');
  return bad;
});
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const html = fs.readFileSync(FILE, 'utf8');

  console.log('Load');
  { const { ctx, page, log } = await open(browser);
    check('version v1.7.0: header comment, Released, meta, title; changelog v1.7.0 on top, then v1.6.0 … v1.1.0 as history',
      /Version: v1\.7\.0/.test(html) && /Released: 2026-10-23/.test(html) && /<meta name="version" content="v1\.7\.0">/.test(html) && /<title>RF Cascade Analyzer v1\.7\.0<\/title>/.test(html)
      && /v1\.7\.0 - Cascade: v1\.1\.0's Lab brought back/.test(html)
      && /v1\.6\.0 - Devices: drawn as the incident \/ reflected \/ transmitted flow diagram/.test(html) && /every device's S entries editable, keeping the device as "<Device> \(edited\)" with a reset\./.test(html)
      && ['v1.7.0', 'v1.6.0', 'v1.5.0', 'v1.4.1', 'v1.4.0', 'v1.3.0', 'v1.2.1', 'v1.2.0', 'v1.1.0'].every((v, n, a) => n === 0 || html.indexOf(a[n - 1] + ' - ') < html.indexOf(v + ' - '))
      && /spec_RF_Cascade_Analyzer_v1\.1\.0/.test(html) && !/RF Cascade Analyzer v1\.(1\.0|2\.[01]|3\.0|4\.[01]|5\.0|6\.0)|content="v1\.(1\.0|2\.[01]|3\.0|4\.[01]|5\.0|6\.0)"/.test(html));
    check('footer: v1.7.0 · released 2026-10-23 · Author: Claude Code', (await text(page, 'footer')).includes('v1.7.0 · released 2026-10-23 · Author: Claude Code'));
    const stamp = async () => page.evaluate(() => { const v = document.getElementById('verStamp'), r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const btns = [...document.querySelectorAll('#top button')].filter(b => b.getBoundingClientRect().width), last = btns[btns.length - 1].getBoundingClientRect(), top = document.getElementById('top').getBoundingClientRect();
      return { text: v.textContent, fs: parseFloat(cs.fontSize), mut: cs.color === getComputedStyle(document.querySelector('.note') || document.body).color || cs.color !== getComputedStyle(document.body).color,
        right: r.left >= last.right && r.right <= top.right + 0.5, shown: r.width > 0 && cs.visibility !== 'hidden', body: document.body.innerText.includes('v1.7.0'),
        oneRow: btns.every(b => { const r = b.getBoundingClientRect(), r0 = btns[0].getBoundingClientRect(); return Math.abs((r.top + r.bottom) - (r0.top + r0.bottom)) < 2; }) }; });
    let st = await stamp();
    check('stamp "v1.7.0" in the top bar, right of the last button, 14 px, muted (windowed)', st.text === 'v1.7.0' && st.fs === 14 && st.right && st.shown && st.mut && st.oneRow, st);
    const wBtn = await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(','));
    await present(page); st = await stamp();
    check('presentation (light): stamp visible right of Present; body.innerText contains "v1.7.0"; buttons one row', st.shown && st.right && st.body && st.oneRow && st.fs === 14, st);
    await page.keyboard.press('t'); await page.waitForTimeout(60); st = await stamp();
    check('presentation (dark): stamp still visible', st.shown && st.body && await page.evaluate(() => !document.body.classList.contains('light')));
    await page.keyboard.press('t'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('the stamp does not resize the buttons', wBtn === await page.evaluate(() => [...document.querySelectorAll('#top button')].map(b => Math.round(b.getBoundingClientRect().width)).join(',')));
    check('three tabs in the top bar', JSON.stringify(await page.$$eval('#tabs [role=tab]', b => b.map(x => x.textContent))) === '["Reflections","Devices","Cascade"]');
    check('no step rail, no Lab tab', !(await page.$('#rail, #lab')));
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
      if(z === 'open') check('Open: total at d = 0 is twice the incident (amplitude 2: τ = 2 is the voltage across the open)', near(G.tot[0][1] - G.yc, 2 * (G.inc[0][1] - G.yc), 1));
      if(z === 'open' || z === '0'){   // Douglas, 2026-10-19: nothing travels into Region 2 at an open or a short
        const E = await page.evaluate(() => { const m = document.getElementById('vIf'), t = document.getElementById('vTot').getAttribute('d').match(/^M(-?[\d.]+) (-?[\d.]+)/);
          return { hidden: getComputedStyle(document.getElementById('vTr')).display === 'none', toinf: !!document.querySelector('#stage .toinf'), my: m ? +m.getAttribute('cy') : null, mx: m ? +m.getAttribute('cx') : null, ty: +t[2], tx: +t[1],
            note: [...document.querySelectorAll('#stage .endnote')].map(e => e.textContent).join(' / '), env2: document.querySelector('[data-q="envelope"]').getAttribute('d').split('L').length }; });
        check((z === 'open' ? 'Open' : 'Short') + ': no transmitted wave or Region 2 envelope; a marker on the interface at the voltage there (with the total); note "' + E.note + '"', E.hidden && !E.toinf && E.my !== null && near(E.mx, E.tx, 0.01) && near(E.my, E.ty, 1)
          && E.note === (z === 'open' ? 'Open circuit: / V = 2V⁺, I = 0 / no power enters / Region 2' : 'Short circuit: / V = 0, I = 2I⁺ / no power enters / Region 2') && E.env2 === 241, E); }
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
    check('line weights: total and transmitted 3, incident / reflected 2.5 dashed, envelope edge 1.5; envelope fill ~12 %, faint (4 %) while incident and reflected are shown (v1.7.0)', await page.evaluate(() => { const a = (id, n) => document.getElementById(id).getAttribute(n);
      const vr = getComputedStyle(document.getElementById('vInc')).display !== 'none';
      return a('vTot', 'stroke-width') === '3' && a('vTr', 'stroke-width') === '3' && a('vInc', 'stroke-width') === '2.5' && a('vRef', 'stroke-width') === '2.5' && !!a('vInc', 'stroke-dasharray')
        && document.querySelector('[data-q="envelope"]').getAttribute('stroke-width') === '1.5' && document.querySelector('#stage .shade').getAttribute('fill-opacity') === (vr ? '0.04' : '0.12'); }));
    await page.click('#showVR'); await page.waitForTimeout(60);
    check('…and with incident and reflected shown, the envelope fill drops to 4 % so they stand out', (await page.getAttribute('#stage .shade', 'fill-opacity')) === (await page.isChecked('#showVR') ? '0.04' : '0.12'));
    await page.click('#showVR'); await page.waitForTimeout(60);
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

  console.log('View 2 — Devices (v1.6.0 flow diagram)');
  { const { ctx, page } = await open(browser); await present(page);
    // each flow element: |S|, drawn width, faded (opacity), dash pattern, excited; and its labels' opacity
    const flow = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stage .flow')].map(e => [e.classList.contains('inc') ? e.id : e.dataset.s,
      { v: +e.dataset.v, w: +e.dataset.w, faded: e.dataset.faded === '1', live: e.dataset.live === '1', op: +(e.getAttribute('opacity') || 1),
        sw: parseFloat(e.querySelector('.fline').getAttribute('stroke-width')), dash: !!e.querySelector('.fline').getAttribute('stroke-dasharray') }])));
    const labs = () => page.evaluate(S => { const f = eval(S); return Object.fromEntries([...document.querySelectorAll('#stage .flabel text')].map(t => [t.id, { t: f(t.textContent), op: +(t.parentElement.getAttribute('opacity') || 1) }])); }, SUBS);
    const W0 = 16, wOf = m => Math.max(3, W0 * Math.min(m * m, 3));
    // KIKO: the 10 cases (5 devices × 2 drives) — values, power shares, braces, widths, fading, dashes
    const CASES = [
      ['through', 'fwd', { s21: ['S21 = 1.00∠−90°', 'Transmitted · 100 %'], s11: ['S11 = 0', 'Reflected · 0 %'] }, ['V2− value', '1.00∠−90°', 'V1−', '0']],
      ['through', 'rev', { s12: ['S12 = 1.00∠−90°', 'Transmitted · 100 %'], s22: ['S22 = 0', 'Reflected · 0 %'] }, ['V1− value', '1.00∠−90°', 'V2−', '0']],
      ['atten', 'fwd', { s21: ['S21 = 0.71', 'Transmitted · 50 %'] }, ['V2− value', '0.71∠0°', 'V1−', '0']],
      ['atten', 'rev', { s12: ['S12 = 0.71', 'Transmitted · 50 %'] }, ['V1− value', '0.71∠0°', 'V2−', '0']],
      ['amp', 'fwd', { s21: ['S21 = 3.16', 'Transmitted · ×10'] }, ['V2− value', '3.16∠0°', 'V1−', '0']],
      ['amp', 'rev', { s12: ['S12 = 0', 'Transmitted · 0 %'] }, ['V1− value', '0', 'V2−', '0']],
      ['iso', 'fwd', { s21: ['S21 = 0.94', 'Transmitted · 89 %'] }, ['V2− value', '0.94∠0°', 'V1−', '0']],
      ['iso', 'rev', { s12: ['S12 = 0', 'Transmitted · 0 %'] }, ['V1− value', '0', 'V2−', '0']],
      ['custom', 'fwd', { s21: ['S21 = 0.60∠−70°', 'Transmitted · 36 %'], s11: ['S11 = 0.30∠40°', 'Reflected · 9.0 %'] }, ['V2− value', '0.60∠−70°', 'V1−', '0.30∠40°']],
      ['custom', 'rev', { s12: ['S12 = 0.60∠−70°', 'Transmitted · 36 %'], s22: ['S22 = 0.40∠−20°', 'Reflected · 16 %'] }, ['V1− value', '0.60∠−70°', 'V2−', '0.40∠−20°']] ];
    for(const [d, dr, want, [, out, , other]] of CASES){
      await goto(page, '#view=devices&device=' + d + '&drive=' + dr);
      const F = await flow(), L = await labs(), live = dr === 'fwd' ? ['s11', 's21'] : ['s12', 's22'], fwd = dr === 'fwd';
      const vOut = await text(page, fwd ? '#vV2m' : '#vV1m'), vOther = await text(page, fwd ? '#vV1m' : '#vV2m');
      const valsOk = Object.entries(want).every(([k, [v, t]]) => L['lv_' + k].t === v && L['lt_' + k].t === t) && vOut === out && vOther === other;
      // widths ∝ |S|² on excited, unblocked paths; unexcited faded (≥ 0.35, labels ≥ 0.55); excited |S| < 0.05 solid, unfaded, width 3, "0"
      const keys = ['s11', 's21', 's12', 's22'];
      const widthOk = keys.filter(k => live.includes(k) && F[k].v >= 0.05).every(k => near(F[k].sw, wOf(F[k].v), 0.01) && !F[k].faded && F[k].op === 1);
      const fadeOk = keys.filter(k => !live.includes(k)).every(k => F[k].faded && F[k].op >= 0.35 && F[k].op <= 0.45 && L['lv_' + k].op >= 0.55)
        && (fwd ? F.inc2.faded && F.inc2.op >= 0.35 && !F.inc1.faded : F.inc1.faded && F.inc1.op >= 0.35 && !F.inc2.faded) && near(F[fwd ? 'inc1' : 'inc2'].sw, W0, 0.01);
      const zeroOk = keys.every(k => !F[k].dash) && keys.filter(k => live.includes(k) && F[k].v < 0.05).every(k => !F[k].faded && F[k].op === 1 && near(F[k].sw, 3, 0.01) && L['lv_' + k].op === 1 && L['lv_' + k].t === k.toUpperCase() + ' = 0');
      check(d + ' ' + dr + ': ' + Object.values(want).map(x => x.join(', ')).join('; ') + '; ' + (fwd ? 'V2−' : 'V1−') + ' = ' + out + '; widths ∝ |S|², unexcited faded (0.35–0.45), no path dashed: a zero path stays solid, unfaded, minimum width 3, "0" (v1.7.0)',
        valsOk && widthOk && fadeOk && zeroOk, { valsOk, widthOk, fadeOk, zeroOk, F, L: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.t])), vOut, vOther });
    }
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30');
    { const F = await flow(); check('Amplifier 30 dB (max): S21 capped at 3 W0 = 48 with the break mark; label "×1000"', near(F.s21.sw, 48, 0.01) && !!(await page.$('#stage .flow.s21 .brk')) && (await text(page, '#lt_s21')) === 'Transmitted · ×1000'); }
    await setInput(page, '#gain', '0');
    { const F = await flow(); check('Amplifier 0 dB (min): S21 = 1.00, width W0, no break mark', near(F.s21.sw, 16, 0.01) && !(await page.$('#stage .flow.s21 .brk')) && (await text(page, '#lv_s21')) === 'S21 = 1.00'); }
    await setInput(page, '#gain', '10');
    await goto(page, '#view=devices&device=atten&drive=fwd'); await setInput(page, '#att', '40');
    { const F = await flow(); check('Attenuator 40 dB (max): S21 0.01 < 0.05 — solid, not faded, minimum width, "0"', !F.s21.dash && !F.s21.faded && near(F.s21.sw, 3, 0.01) && (await text(page, '#lv_s21')) === 'S21 = 0' && (await text(page, '#lt_s21')) === 'Transmitted · 0 %'); }
    await setInput(page, '#att', '3');
    // B.4 (v1.4.0) matrix row 2 unchanged; the braces' values are the matrix's b entries
    const B4 = [['through', 'fwd', '= [0  1.00∠−90°; 1.00∠−90°  0] [1∠0°; 0] = [0; 1.00∠−90°]'], ['through', 'rev', '= [0  1.00∠−90°; 1.00∠−90°  0] [0; 1∠0°] = [1.00∠−90°; 0]'],
      ['atten', 'fwd', '= [0  0.71; 0.71  0] [1∠0°; 0] = [0; 0.71∠0°]'], ['amp', 'fwd', '= [0  0; 3.16  0] [1∠0°; 0] = [0; 3.16∠0°]'],
      ['custom', 'fwd', '= [0.30∠40°  0.60∠−70°; 0.60∠−70°  0.40∠−20°] [1∠0°; 0] = [0.30∠40°; 0.60∠−70°]']];
    for(const [d, dr, want] of B4){ await goto(page, '#view=devices&device=' + d + '&drive=' + dr);
      const got = await page.getAttribute('#numRow', 'data-text'), braces = await page.evaluate(() => document.getElementById('vV1m').textContent === document.getElementById('n_b1').textContent && document.getElementById('vV2m').textContent === document.getElementById('n_b2').textContent);
      check('B.4 ' + d + ' ' + dr + ': row 2 ' + want + '; the braces show b1, b2', got === want && braces, got); }
    await goto(page, '#view=devices&device=custom&drive=fwd');
    check('labels: V1⁺, V1⁻, V2⁺, V2⁻ on the diagram; Port 1, Port 2 under the DUT stubs; the DUT box shows the device name', JSON.stringify(await Promise.all(['#nV1p', '#nV1m', '#nV2p', '#nV2m', '#dutName'].map(x => text(page, x))))
      === JSON.stringify(['V1⁺', 'V1⁻ =', 'V2⁺', 'V2⁻ =', 'Custom']) && JSON.stringify(await page.$$eval('#stage .port', e => e.map(x => x.textContent))) === '["Port 1","Port 2"]');
    check('matrix entries in the S colours; badges unchanged (Custom: R ✓ S ✗ L ✗ P ✓)', await page.evaluate(() => ['s11', 's21', 's12', 's22'].every(k => document.getElementById('n_' + k).getAttribute('fill') === 'var(--' + k + ')'))
      && (await page.evaluate(() => [...document.querySelectorAll('#stage .badge')].map(b => b.getAttribute('data-on')).join(''))) === '1001');
    check('panel: power out = |b2|² = 36 %; the device title "Custom"; caption about normalized waves', (await text(page, '#roPower')) === '36 %' && (await page.evaluate(() => document.getElementById('roPower').previousSibling.textContent)) === 'power out = |b2|²');
    await setInput(page, '#cs21', '0.8');
    { const F = await flow(); check('Custom: linked S12 follows S21 (0.80); the S12 row is locked', near(F.s12.v, 0.8, 1e-9) && near(F.s21.v, 0.8, 1e-9) && await page.isDisabled('#cs12')); }
    await page.goto(URL0 + '#view=devices&device=iso&drive=rev'); await page.waitForTimeout(150);
    check('hash round-trip: #view=devices&device=iso&drive=rev restores the Isolator in Reverse', (await page.getAttribute('#dev_iso', 'aria-pressed')) === 'true' && (await page.getAttribute('#drive_rev', 'aria-pressed')) === 'true');
    await page.keyboard.press('PageUp'); await page.waitForTimeout(80);
    check('Previous keeps the drive (Amplifier, Reverse)', (await page.evaluate(() => location.hash)) === '#view=devices&device=amp&drive=rev');
    await page.keyboard.press('t'); await page.waitForTimeout(60);
    check('dark theme: faded paths keep their opacity (0.4) and colour variables', await page.evaluate(() => !document.body.classList.contains('light') && [...document.querySelectorAll('#stage .flow[data-faded="1"]')].every(e => +e.getAttribute('opacity') === 0.4)));
    await ctx.close(); }

  console.log('Devices layout (v1.6.0)');
  { const { ctx, page } = await open(browser); await present(page);
    const gi = [], add = async st => (await devGapIssues(page)).forEach(x => gi.push(st + ': ' + x));
    for(const hs of STOPS.slice(1, 6).concat(REV_STOPS)){ await goto(page, hs); await add(hs.replace('#view=devices&', '')); }
    await goto(page, '#view=devices&device=amp&drive=fwd'); await setInput(page, '#gain', '30'); await add('amp 30 dB'); await click(page, '#drive_rev'); await add('amp 30 dB rev'); await click(page, '#drive_fwd');
    await goto(page, '#view=devices&device=custom&drive=fwd'); for(const k of ['s11', 's21', 's22']) await setInput(page, '#c' + k, '0.98'); await add('custom all |S| 0.98');
    await click(page, '#drive_rev'); await add('custom all |S| 0.98 rev');
    check('flow diagram layout: junctions, colours, braces, DUT, matrix and badge gaps (every device, Forward and Reverse; amp 30 dB; Custom |S| ≈ 1)', gi.length === 0, gi.slice(0, 10));
    await ctx.close(); }

  console.log('View 3 — Cascade (v1.7.0: v1.1.0 Lab, divider at any junction, a frequency band through the circuit)');
  { const { ctx, page } = await open(browser);
    await present(page); await goto(page, '#view=cascade');
    const keyv = () => page.$$eval('#stage .keyv', e => e.map(x => x.textContent));
    const spec = ids => Promise.all(ids.map(id => text(page, '#' + id)));
    const panelHas = s => page.evaluate(s => document.getElementById('panel').innerText.includes(s), s);
    check('example chain: Amplifier +12 dB → Band-pass 1 GHz → Attenuator −3 dB → 50 Ω', JSON.stringify(await keyv()) === JSON.stringify(['+12 dB', '1 GHz', '−3 dB']) && (await text(page, '#loadVal')) === '50 Ω', await keyv());
    let sp = await spec(['specM0', 'specM1', 'specM2', 'specM3']);
    check('spectrum at each junction, value at the 1 GHz marker: in 0.0, 1|2 +12.0, 2|3 +12.0, load +9.0 dB (of P_avs)', JSON.stringify(sp) === JSON.stringify(['in 0.0 dB', '1|2 +12.0 dB', '2|3 +12.0 dB', 'load +9.0 dB']), sp);
    check('results at 1 GHz (v1.1.0 numbers): P_avs 2.5000 mW, P_L 19.8582 mW (12.98 dBm), G_T 9.0 dB; whole chain S21 2.818∠0.0° (+9 dB)',
      await panelHas('2.5000 mW (3.98 dBm)') && await panelHas('19.8582 mW (12.98 dBm)') && await panelHas('7.9433 (9.0 dB)') && (await text(page, '#chainS .sline .sv')) === '2.818∠0.0° (+9 dB)');
    const curve = await page.evaluate(() => document.querySelector('[data-q="plotL"]').getAttribute('d').split('L').length);
    check('the response across the band is drawn at 201 frequencies (load and reflected curves, the marker)', curve === 201 && !!(await page.$('[data-q="plotR"]')) && near(+(await page.getAttribute('[data-q="marker"]', 'data-v')), 1e9, 1));
    await setInput(page, '#fmN', '1.1');
    const x = (1.1 - 1 / 1.1) / 0.2, t2 = 10 * Math.log10(1 / (1 + x ** 6)), dbT = d => (d > 0 ? '+' : '') + d.toFixed(1) + ' dB', wantT = dbT(9 + t2);
    check('marker 1.1 GHz: the band-pass edge (Butterworth n = 3, BW 200 MHz) passes |S21|² = ' + dbT(t2) + ': load ' + wantT + '; the rest is reflected, so the net power at 1|2 is ' + dbT(12 + t2),
      (await text(page, '#specM3')) === 'load ' + wantT && (await text(page, '#specM1')) === '1|2 ' + dbT(12 + t2)
      && (await text(page, '#resTitle')) === 'Results at 1.100 GHz', await text(page, '#specM3'));
    const box = await (await page.$('[data-plot]')).boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2); await page.waitForTimeout(80);
    check('clicking the plot moves the marker (a quarter across: 0.75 GHz)', near(+(await page.getAttribute('[data-q="marker"]', 'data-v')), 0.75e9, 0.01e9), await page.getAttribute('[data-q="marker"]', 'data-v'));
    await click(page, '#seg_ss'); await setInput(page, '#bandS', '0.8'); await setInput(page, '#bandE', '1.2');
    const st = await stageTexts(page);
    check('start–stop entry 0.8 to 1.2 GHz: the axis spans it; the marker stays inside the band', st.includes('0.8 GHz') && st.includes('1.2 GHz') && near(+(await page.getAttribute('[data-q="marker"]', 'data-v')), 0.8e9, 1));
    await click(page, '#seg_cs');
    check('centre ± span shows the same band: centre 1, span 0.4 GHz', (await page.inputValue('#bandC')) === '1' && (await page.inputValue('#bandW')) === '0.4');
    await setInput(page, '#bandW', '1'); await setInput(page, '#bandC', '0.4');
    check('an impossible band (centre 0.4 GHz with span 1 GHz starts below 0) is flagged and ignored', (await page.getAttribute('#bandC', 'aria-invalid')) === 'true' && (await stageTexts(page)).includes('0.5 GHz'));
    await setInput(page, '#bandC', '1');
    await page.selectOption('#fUnit', 'MHz'); await page.waitForTimeout(60);
    check('MHz: the band-pass block reads 1000 MHz, the axis 500 … 1500 MHz', (await keyv())[1] === '1000 MHz' && (await stageTexts(page)).includes('1500 MHz'));
    await page.selectOption('#fUnit', 'GHz'); await page.waitForTimeout(60); await setInput(page, '#fmN', '1');
    await page.click('#stage [data-add="main:0"]'); await page.waitForTimeout(60);
    check('the "+" before block 1 opens the menu: 9 block types and the power divider', (await page.$$('.addmenu button')).length === 10 && !!(await page.$('#add_div')));
    await click(page, '#add_thru');
    check('a Through line inserted at the front: λ/4 at f0, S21 = 1∠−90° at 1 GHz', (await keyv())[0] === 'ℓ = λ/4' && (await text(page, '#kTitle')) === 'Block 1 · Through line' && (await page.inputValue('#ks21')) === '1∠-90');
    await setInput(page, '#fmN', '1.2');
    check('…and S21 = 1∠−108° at 1.2 GHz (βℓ grows with frequency)', (await page.inputValue('#ks21')) === '1∠-108', await page.inputValue('#ks21'));
    await page.click('#stage [data-del="main:0"]'); await page.waitForTimeout(60); await setInput(page, '#fmN', '1');
    await page.click('#stage [data-add="main:2"]'); await page.waitForTimeout(60); await click(page, '#add_div');
    sp = await spec(['specM0', 'specM2', 'specA0', 'specA1', 'specB0', 'specB1']);
    check('a Wilkinson divider inserted after the band-pass: Attenuator in branch A, a copy in B; div in +12.0, A in +9.0, load A +6.0, B in +9.0, load B +6.0 dB',
      JSON.stringify(sp) === JSON.stringify(['in 0.0 dB', 'div in +12.0 dB', 'A in +9.0 dB', 'load A +6.0 dB', 'B in +9.0 dB', 'load B +6.0 dB']) && (await text(page, '#kTitle')) === 'Power divider'
      && (await page.$$('#stage .load')).length === 2 && (await keyv()).length === 4, sp);
    check('divider results: 50 % into each branch, nothing dissipated', await panelHas('into branch A') && (await page.evaluate(() => document.getElementById('cres').innerText)).includes('(50.0%)'));
    await setInput(page, '#split', '75');
    sp = await spec(['specA1', 'specB1']);
    check('split 75 %: load A +7.8 dB, load B +3.0 dB (+12 − 1.25 − 3 and +12 − 6.02 − 3)', JSON.stringify(sp) === JSON.stringify(['load A +7.8 dB', 'load B +3.0 dB']), sp);
    await page.selectOption('#divType', 'resistive'); await page.waitForTimeout(60);
    sp = await spec(['specA1', 'specB1']);
    check('resistive divider: split fixed at 50 %, each output −6 dB (loads +3.0 dB), 50 % dissipated', JSON.stringify(sp) === JSON.stringify(['load A +3.0 dB', 'load B +3.0 dB']) && await page.isDisabled('#split')
      && (await page.evaluate(() => document.getElementById('cres').innerText)).includes('dissipated'), sp);
    await page.click('#stage [data-add="B:1"]'); await page.waitForTimeout(60); await click(page, '#add_amp');
    check('an Amplifier added to branch B only: load B +13.0 dB, load A unchanged; at 4 columns only branch A (the shorter) keeps its "+"', (await text(page, '#specB2')) === 'load B +13.0 dB' && (await text(page, '#specA1')) === 'load A +3.0 dB'
      && JSON.stringify(await page.$$eval('#stage [data-add]', e => e.map(x => x.dataset.add))) === '["A:0","A:1"]' && (await text(page, '#kTitle')) === 'Branch B, block 2 · Amplifier');
    await page.click('#stage [data-load="A"]'); await page.waitForTimeout(60); await click(page, '#lShort');
    check('Load A shorted: load A −∞ dB; its box reads 0 Ω',
      (await text(page, '#specA1')) === 'load A −∞ dB' && (await text(page, '#loadValA')) === '0 Ω');
    await page.click('#stage [data-del="div"]'); await page.waitForTimeout(60);
    check('× on the divider: branch A joins the chain, B goes, the load is load A', JSON.stringify(await keyv()) === JSON.stringify(['+12 dB', '1 GHz', '−3 dB']) && (await text(page, '#loadVal')) === '0 Ω' && !(await page.$('#stage .divbox')));
    await click(page, '#lMatch');
    await page.click('#stage [data-src]'); await page.waitForTimeout(60); await setInput(page, '#vsMag', '2');
    check('the source: V_s = 2 V gives P_avs 10.0000 mW; ratios unchanged (load +9.0 dB)', (await text(page, '#kTitle')) === 'Source and reference' && await panelHas('10.0000 mW (10.00 dBm)') && (await text(page, '#specM3')) === 'load +9.0 dB');
    await setInput(page, '#zs', '50+jx');
    check('an invalid Z_s is flagged and the last valid value kept', (await page.getAttribute('#zs', 'aria-invalid')) === 'true' && await panelHas('keeping the last valid value'));
    await page.click('#stage [data-load="L"]'); await page.waitForTimeout(60); await click(page, '#lOpen');
    check('Open load: the Load reads ∞; load −∞ dB', (await text(page, '#loadVal')) === '∞' && (await text(page, '#specM3')) === 'load −∞ dB');
    await click(page, '#cReset');
    check('Reset to example', JSON.stringify(await keyv()) === JSON.stringify(['+12 dB', '1 GHz', '−3 dB']) && (await text(page, '#specM3')) === 'load +9.0 dB' && (await text(page, '#kTitle')) === 'Block 1 · Amplifier');
    await page.focus('#stage [data-blk="main:2"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    check('Enter on a focused block selects it', (await text(page, '#kTitle')) === 'Block 3 · Attenuator');
    await page.click('#stage [data-add="main:1"]'); await page.waitForTimeout(60); await page.keyboard.press('Escape'); await page.waitForTimeout(60);
    check('Esc closes the "+" menu', !(await page.$('.addmenu')));
    await ctx.close(); }

  console.log('Devices S editor (v1.6.0: every device editable, "(edited)", reset)');
  { const { ctx, page } = await open(browser); await present(page);
    const S = () => page.evaluate(() => Object.fromEntries(['s11', 's21', 's12', 's22'].map(k => [k, [+document.getElementById('c' + k + 'm').value, +document.getElementById('c' + k + 'a').value]])));
    const KNOB = { through: '#len', atten: '#att', amp: '#gain', iso: '#isoIL' }, NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator' };
    for(const d of ['through', 'atten', 'amp', 'iso']){
      await goto(page, '#view=devices&device=' + d + '&drive=fwd'); const before = await S(), mat0 = await page.getAttribute('#numRow', 'data-text');
      await setInput(page, '#cs11m', '0.2');
      const after = await S(), ed = { hash: await page.evaluate(() => location.hash), title: await text(page, '#devTitle'), dut: await text(page, '#dutName'), tag: await text(page, '#dutEdited'),
        knobOn: !(await page.isDisabled(KNOB[d])), reset: await text(page, '#devReset'), s11: await text(page, '#lv_s11'), mat: await page.getAttribute('#numRow', 'data-text') };
      check(d + ': editing S11 keeps the device ("' + NAME[d] + ' (edited)", same hash), the diagram and matrix update live, the knob stays live, "Reset to ' + NAME[d] + '" shown',
        ed.hash === '#view=devices&device=' + d + '&drive=fwd' && ed.title === NAME[d] + ' (edited)' && ed.dut === NAME[d] && ed.tag === '(edited)' && ed.knobOn && ed.reset === 'Reset to ' + NAME[d]
        && near(after.s11[0], 0.2, 1e-9) && ed.s11 === 'S11 = 0.20' && ed.mat !== mat0 && (await page.getAttribute('#dev_' + d, 'aria-pressed')) === 'true', ed);
      await click(page, '#devReset');
      const reset = await S();
      check(d + ': "Reset to ' + NAME[d] + '" restores the preset values exactly; title and DUT back to "' + NAME[d] + '"', JSON.stringify(reset) === JSON.stringify(before) && (await text(page, '#devTitle')) === NAME[d]
        && !(await page.$('#dutEdited')) && !(await page.$('#devReset')) && !(await page.isDisabled(KNOB[d])) && (await page.getAttribute('#numRow', 'data-text')) === mat0, { before, reset });
    }
    await goto(page, '#view=devices&device=atten&drive=fwd'); await setInput(page, '#att', '6');
    check('unedited: moving the Attenuator knob to 6 dB updates S21 and S12 live (0.501187), panel not rebuilt', near((await S()).s21[0], 0.501187, 1e-5) && near((await S()).s12[0], 0.501187, 1e-5) && !!(await page.$('#att')));
    await setInput(page, '#att', '3'); await setInput(page, '#cs11m', '0.2'); await setInput(page, '#att', '6');
    { const s = await S(); check('edited: the Attenuator knob (6 dB) still sets S21 and S12 (0.501187); the S11 edit (0.2) stays; still "Attenuator (edited)"',
        near(s.s21[0], 0.501187, 1e-5) && near(s.s12[0], 0.501187, 1e-5) && near(s.s11[0], 0.2, 1e-9) && (await text(page, '#devTitle')) === 'Attenuator (edited)' && (await text(page, '#lv_s21')) === 'S21 = 0.50', s); }
    await click(page, '#devReset');
    { const s = await S(); check('Reset after a knob move keeps the knob (6 dB preset: S11 0, S21 0.501187)', near(s.s11[0], 0, 1e-12) && near(s.s21[0], 0.501187, 1e-5) && (await text(page, '#devTitle')) === 'Attenuator', s); }
    await goto(page, '#view=devices&device=iso&drive=fwd'); await setInput(page, '#cs12m', '0.05'); await setInput(page, '#isoIL', '1');
    { const s = await S(); check('edited Isolator: the insertion-loss knob sets S21 (1 dB → 0.891251); the S12 edit (0.05) stays', near(s.s21[0], 0.891251, 1e-5) && near(s.s12[0], 0.05, 1e-9) && (await text(page, '#devTitle')) === 'Isolator (edited)', s); }
    await click(page, '#devReset');
    await goto(page, '#view=devices&device=atten&drive=fwd'); await setInput(page, '#att', '6');
    check('unedited: moving the Attenuator knob to 6 dB updates S21 and S12 live (0.501187), panel not rebuilt', near((await S()).s21[0], 0.501187, 1e-5) && near((await S()).s12[0], 0.501187, 1e-5) && !!(await page.$('#att')));
    await setInput(page, '#att', '3');
    // long tasks during slider drags (< 50 ms)
    await page.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: false }); });
    for(const [id, lo, hi] of [['#att', 0, 40], ['#cs21', 0, 2]]){ for(let n = 0; n <= 30; n++){ await page.evaluate(([id, v]) => { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, lo + (hi - lo) * n / 30]); } }
    await page.waitForTimeout(200);
    const lt = await page.evaluate(() => window.__lt);
    check('slider drags (Attenuator knob, S21 |S|): no long task ≥ 50 ms (' + lt.length + ' long tasks, longest ' + (lt.length ? Math.max(...lt).toFixed(0) : 0) + ' ms)', lt.every(d => d < 50), lt);
    await ctx.close(); }

  console.log('Cascade block editor (v1.7.0)');
  { const { ctx, page } = await open(browser); await present(page); await goto(page, '#view=cascade');
    const keyv = () => page.$$eval('#stage .keyv', e => e.map(x => x.textContent));
    check('Block 1 · Amplifier selected by default: gain 12 dB, S21 3.98107∠0 at the marker', (await text(page, '#kTitle')) === 'Block 1 · Amplifier' && (await page.inputValue('#kp_G')) === '12' && (await page.inputValue('#ks21')) === '3.98107∠0');
    await setInput(page, '#kp_G', '20');
    check('gain 20 dB: S21 10∠0, the block reads +20 dB, 1|2 +20.0 dB, the field keeps focus', (await page.inputValue('#ks21')) === '10∠0' && (await keyv())[0] === '+20 dB' && (await text(page, '#specM1')) === '1|2 +20.0 dB');
    await setInput(page, '#kp_G', '-3');
    check('a negative gain is flagged and ignored', (await page.getAttribute('#kp_G', 'aria-invalid')) === 'true' && (await keyv())[0] === '+20 dB');
    await setInput(page, '#ks11', '0.1∠0');
    check('editing S11 makes the block Custom with its S at the marker (S21 still 10)', (await text(page, '#kTitle')) === 'Block 1 · Custom' && (await keyv())[0] === '+20 dB' && (await page.inputValue('#ks21')) === '10∠0');
    await page.click('#stage [data-blk="main:1"]'); await page.waitForTimeout(60);
    check('Block 2 · Band-pass filter: fc 1, BW 0.2 GHz, order 3', (await text(page, '#kTitle')) === 'Block 2 · Band-pass filter' && (await page.inputValue('#kp_fc')) === '1' && (await page.inputValue('#kp_bw')) === '0.2' && (await page.inputValue('#kp_n')) === '3');
    await setInput(page, '#kp_n', '2.5');
    check('a non-integer order is flagged', (await page.getAttribute('#kp_n', 'aria-invalid')) === 'true');
    await page.selectOption('#kType', 'lpf'); await page.waitForTimeout(60);
    check('changing the type to Low-pass: cut-off 1.2 GHz', (await text(page, '#kTitle')) === 'Block 2 · Low-pass filter' && (await keyv())[1] === '1.2 GHz');
    await page.selectOption('#kType', 'hpf'); await page.waitForTimeout(60); await setInput(page, '#fmN', '0.5');
    const t2 = 1 / (1 + (0.8 / 0.5) ** 6), want = 10 * Math.log10(t2) + 20 - 3;
    check('High-pass fc 0.8 GHz at 0.5 GHz: load ' + want.toFixed(1) + ' dB', (await text(page, '#specM3')) === 'load ' + (want > 0 ? '+' : '') + want.toFixed(1) + ' dB', await text(page, '#specM3'));
    await click(page, '#seg_rad');
    check('Radians: S fields and results in rad', /∠-?[\d.]+$/.test(await page.inputValue('#ks21')) && (await page.evaluate(() => document.getElementById('cres').innerText)).includes(' rad'));
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
    await goto(page, '#view=cascade'); await page.click('#stage [data-blk="main:2"]'); await page.waitForTimeout(60); await fn('cascade, Attenuator selected');
    await page.click('#stage [data-add="main:3"]'); await page.waitForTimeout(60); await click(page, '#add_thru'); await fn('cascade, 4 blocks');
    await page.click('#stage [data-add="main:4"]'); await page.waitForTimeout(60); await fn('cascade, "+" menu open'); await page.keyboard.press('Escape');
    await page.click('#stage [data-del="main:3"]'); await page.waitForTimeout(60);
    await page.selectOption('#fUnit', 'MHz'); await page.waitForTimeout(60); await fn('cascade, MHz'); await page.selectOption('#fUnit', 'GHz'); await page.waitForTimeout(60);
    await page.click('#stage [data-add="main:2"]'); await page.waitForTimeout(60); await click(page, '#add_div'); await fn('cascade, divider (2 + 1 columns)');
    await page.click('#stage [data-add="A:1"]'); await page.waitForTimeout(60); await click(page, '#add_lpf'); await fn('cascade, divider, 4 columns');
    await page.click('#stage [data-load="B"]'); await page.waitForTimeout(60); await click(page, '#lOpen'); await fn('cascade, divider, load B open');
    await page.keyboard.press('t'); await page.waitForTimeout(60); await fn('cascade, divider, dark'); await goto(page, '#view=devices&device=custom&drive=fwd'); await fn('devices custom, dark');
    await goto(page, '#view=reflections&vr=1'); await fn('reflections, dark'); await page.keyboard.press('t'); await page.waitForTimeout(60);
    await goto(page, '#view=cascade'); await click(page, '#cReset'); await fn('cascade, example'); };
  for(const [vw, label, pres, sizes] of [[{ width: 1280, height: 720 }, 'presentation 1280×720', true, true], [{ width: 1920, height: 1080 }, 'windowed 1920×1080', false, true],
                                         [{ width: 1920, height: 1080 }, 'presentation 1920×1080', true, false], [{ width: 1366, height: 768 }, 'windowed 1366×768', false, false]]){
    const { ctx, page, log } = await open(browser, { viewport: vw });
    if(pres) await present(page);
    const ov = [], sz = [], lay = [], ed = [], mm = { svg: [99, 0], panel: [99, 0], head: 0 };
    await states(page, async st => { (await overlapIssues(page)).forEach(x => ov.push(st + ': ' + x)); (await layoutIssues(page)).forEach(x => lay.push(st + ': ' + x));
      if(sizes){ const r = await sizeReport(page); r.bad.forEach(x => sz.push(st + ': ' + x));
        ['svg', 'panel'].forEach(key => { mm[key][0] = Math.min(mm[key][0], r.mm[key][0]); mm[key][1] = Math.max(mm[key][1], r.mm[key][1]); }); mm.head = Math.max(mm.head, r.mm.head); }
      (await edgeIssues(page)).forEach(x => ed.push(st + ': ' + x)); });
    check(label + ': no text overlaps a drawn element or another label (every view and device, both themes, both load cases, 4 blocks; Reflections 5 cases, switch on and off, 8 instants)', ov.length === 0, ov.slice(0, 12));
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
    console.log('Screenshots (1280×720 presentation and 1920×1080 windowed; Projector theme, Devices also dark)');
    fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SHOT_DIR, f)));
    for(const [vw, pres, tag] of [[{ width: 1280, height: 720 }, true, 'p1280'], [{ width: 1920, height: 1080 }, false, 'w1920']]){
      const { ctx, page } = await open(browser, { viewport: vw, reducedMotion: 'reduce' });
      if(pres) await present(page); else { await page.keyboard.press('t'); await page.waitForTimeout(80); }   // windowed opens dark; T gives the Projector theme
      const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
      const shot = async name => { await blur(); await page.waitForTimeout(120); await page.screenshot({ path: path.join(SHOT_DIR, tag + '_' + name + '.png') }); console.log('  wrote ' + tag + '_' + name + '.png'); };
      await goto(page, '#view=reflections&vr=0'); await setInput(page, '#z02Box', '150', 'change'); await shot('reflections_150_switch_off');
      await goto(page, '#view=reflections&vr=1'); await shot('reflections_150_switch_on');
      // v1.6.0: the 10 Devices cases, light (Projector) and dark
      for(const th of ['light', 'dark']){ if(th === 'dark'){ await page.keyboard.press('t'); await page.waitForTimeout(80); }
        for(const d of ['through', 'atten', 'amp', 'iso', 'custom']) for(const dr of ['fwd', 'rev']){ await goto(page, '#view=devices&device=' + d + '&drive=' + dr); await shot('devices_' + d + '_' + dr + '_' + th); } }
      await page.keyboard.press('t'); await page.waitForTimeout(80);
      await goto(page, '#view=cascade'); await click(page, '#cReset'); await shot('cascade_example_light');
      await page.click('#stage [data-blk="main:1"]'); await page.waitForTimeout(60); await setInput(page, '#fmN', '1.1'); await shot('cascade_bandpass_selected_marker_1.1GHz');
      await setInput(page, '#fmN', '1'); await page.click('#stage [data-add="main:2"]'); await page.waitForTimeout(60); await shot('cascade_add_menu');
      await click(page, '#add_div'); await shot('cascade_divider_light');
      await page.keyboard.press('t'); await page.waitForTimeout(80); await shot('cascade_divider_dark'); await click(page, '#cReset'); await shot('cascade_example_dark');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
