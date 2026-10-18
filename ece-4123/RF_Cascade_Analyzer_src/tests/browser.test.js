/* RF Cascade Analyzer — developer browser tests (Playwright, Chromium). These are the developer's own checks before
   the gates, not the blind Test suite. They read the built page only through the DOM (data-q / data-v attributes,
   text, URL hash), the same way Test does; the page has no test hooks.

   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/RF_Cascade_Analyzer_v1.1.0.html]
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'RF_Cascade_Analyzer_v1.1.0.html'));
const URL0 = 'file://' + FILE;
const BEATS = [6, 6, 4, 8, 6, 4];                         // beats per step (spec A.5.1–A.5.6)
const PRESENT = { 720: { any: 24, label: 32, title: 40, head: 56 }, 1080: { any: 36, label: 48, title: 60, head: 84 } };
const TOL_PX = 1.5;                                       // drawn length tolerance (px)
let pass = 0, fail = 0;

// Record one check.
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + JSON.stringify(detail) : '')); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// A new page with console, page-error and request logs.
async function open(browser, opts){
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {}));
  const page = await ctx.newPage(), log = { console: [], requests: [] };
  page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') log.console.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => log.console.push('pageerror: ' + e.message));
  page.on('request', r => log.requests.push(r.url()));
  return { ctx, page, log };
}
const hash = page => page.evaluate(() => location.hash);
const goto = (page, s, b) => page.evaluate(([s, b]) => { location.hash = '#step=' + s + '&beat=' + b; }, [s, b]).then(() => page.waitForTimeout(60));
// data-v of the first element with data-q = q (number), or null.
const dv = (page, q) => page.evaluate(q => { const e = document.querySelector('[data-q="' + q + '"]'); return e ? +e.getAttribute('data-v') : null; }, q);

// ── ENCODING ── every data-q element: length ∝ data-v (A.7), ghost and cap flags, a label within 8 px.
async function encodingIssues(page){
  return page.evaluate(([CAP, GHOST, TOL]) => {
    const bad = [];
    document.querySelectorAll('#stage [data-q], #flow [data-q]').forEach(e => {
      const q = e.getAttribute('data-q'), v = +e.getAttribute('data-v'), ref = +e.getAttribute('data-ref');
      if(!isFinite(v) && e.getAttribute('data-v') !== '-Infinity') bad.push(q + ': data-v not a number');
      if(e.classList.contains('arrow')){
        const g = e.getAttribute('data-ghost') === '1', c = e.getAttribute('data-capped') === '1', w = e.getBBox().width;
        if(g !== (v < GHOST)) bad.push(q + ': ghost flag ' + g + ' for ' + v);
        if(c !== (v > CAP)) bad.push(q + ': cap flag ' + c + ' for ' + v);
        const want = g ? ref : Math.min(v, CAP) * ref;
        if(Math.abs(w - want) > TOL + 1) bad.push(q + ': length ' + w.toFixed(1) + ' want ' + want.toFixed(1));
      } else if(e.classList.contains('power')){
        const g = e.getAttribute('data-ghost') === '1', w = e.getBBox().width, want = g ? ref * 0.5 : v * ref;
        if(g !== (v < GHOST)) bad.push(q + ': ghost flag ' + g + ' for ' + v);
        if(Math.abs(w - want) > TOL + 1) bad.push(q + ': length ' + w.toFixed(1) + ' want ' + want.toFixed(1));
      } else if(e.classList.contains('seg') && ref && !e.getAttribute('data-scale') && !e.getAttribute('data-capped')){
        const r = e.querySelector('rect').getBBox(), want = Math.max(0, v) * ref;
        if(Math.abs(r.width - want) > TOL && Math.abs(r.height - want) > TOL) bad.push(q + ': size ' + r.width.toFixed(1) + '×' + r.height.toFixed(1) + ' want ' + want.toFixed(1));
      }
      // a visible label within 8 px of the element (text inside the same group or a nearby text element)
      const b = e.getBoundingClientRect(), texts = [...document.querySelectorAll('#stage text, #flow text, #stage .card')];
      const close = texts.some(t => { const r = t.getBoundingClientRect(); if(!r.width) return false;
        const dx = Math.max(0, r.left - b.right, b.left - r.right), dy = Math.max(0, r.top - b.bottom, b.top - r.bottom); return dx <= 8 && dy <= 8; });
      if(!close && !e.classList.contains('badge-svg') && b.width + b.height > 0) bad.push(q + ': no label within 8 px');
    });
    return bad;
  }, [2.5, 0.005, TOL_PX]);
}

// ── TEXT SIZES ── every visible text node ≥ "any"; step title, headline readouts and S names at their class size.
async function sizeIssues(page, min){
  return page.evaluate(min => {
    const bad = [], vis = e => { const r = e.getBoundingClientRect(); if(!r.width || !r.height) return false; return !e.closest('.hidden,dialog') && getComputedStyle(e).visibility !== 'hidden'; };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while(w.nextNode()){ const n = w.currentNode, e = n.parentElement; if(!n.textContent.trim() || !e || !vis(e) || e.closest('script,style')) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize); if(fs < min.any - 0.05) bad.push('any ' + fs + ' "' + n.textContent.trim().slice(0, 24) + '"'); }
    const t = parseFloat(getComputedStyle(document.getElementById('stepTitle')).fontSize); if(t < min.title - 0.05) bad.push('title ' + t);
    document.querySelectorAll('.ro.head .v').forEach(e => { if(vis(e)){ const fs = parseFloat(getComputedStyle(e).fontSize); if(fs < min.head - 0.05) bad.push('head ' + fs); } });
    document.querySelectorAll('#stage text').forEach(e => { if(vis(e) && /^S(?:_)?\d\d|^S11|^S21|^S12|^S22/.test(e.textContent)){ const fs = parseFloat(e.getAttribute('font-size')); if(fs < min.label - 0.05) bad.push('S name ' + fs + ' "' + e.textContent.slice(0, 16) + '"'); } });
    return bad;
  }, min);
}
// Page overflow and side-panel overflow.
const overflow = page => page.evaluate(() => { const d = document.documentElement, s = document.getElementById('side');
  return { page: d.scrollWidth > innerWidth || d.scrollHeight > innerHeight, side: s.scrollHeight > s.clientHeight + 1 }; });

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  console.log('Load, stamp, no network, no test hooks');
  {
    // baseline: the window names of an empty page from the same kind of origin (file://, a secure context)
    const blankFile = path.join(os.tmpdir(), 'rfc-blank-' + process.pid + '.html'); fs.writeFileSync(blankFile, '<!DOCTYPE html><title>blank</title>');
    const blank = await open(browser); await blank.page.goto('file://' + blankFile);
    const base = await blank.page.evaluate(() => Object.keys(window)); await blank.ctx.close(); fs.unlinkSync(blankFile);
    const { ctx, page, log } = await open(browser);
    await page.goto(URL0); await page.waitForTimeout(300);
    const html = await page.content();
    check('footer stamp v1.1.0 and Author: Claude Code', /v1\.1\.0/.test(await page.textContent('footer')) && /Author: Claude Code/.test(await page.textContent('footer')));
    check('only the document itself (and data: URLs) requested', log.requests.every(u => u === URL0 || u.startsWith(URL0 + '#') || u.startsWith('data:')), log.requests.filter(u => !u.startsWith('data:')));
    const extra = await page.evaluate(b => Object.keys(window).filter(k => !b.includes(k)), base);
    check('no new window-level names (no test object)', extra.length === 0, extra);
    check('app internals are not reachable from window', await page.evaluate(() => ['L', 'LB', 'app', 'STEPS', 'go', 'solveCascade'].every(k => typeof window[k] === 'undefined')));
    check('no postMessage in the page', !/postMessage/.test(html));
    check('no circulator in any visible text or option', !(await page.evaluate(() => /circulator/i.test(document.body.innerText + [...document.querySelectorAll('option')].map(o => o.textContent).join(' ')))));
    check('font face IBM Plex Mono embedded and loaded', await page.evaluate(() => document.fonts.check("16px 'IBM Plex Mono'")));
    check('no console errors on load', log.console.length === 0, log.console);
    await ctx.close();
  }

  console.log('Beat walk (Next to the end, Previous back), hash, encodings, windowed sizes');
  {
    const { ctx, page, log } = await open(browser);
    await page.goto(URL0 + '#step=1&beat=1'); await page.waitForTimeout(200);
    const seen = [await hash(page)], enc = [], small = [];
    for(let i = 0; i < 40; i++){
      enc.push(...(await encodingIssues(page)).map(x => seen[seen.length - 1] + ' ' + x));
      small.push(...(await sizeIssues(page, { any: 14, label: 14, title: 14, head: 14 })).map(x => seen[seen.length - 1] + ' ' + x));
      await page.keyboard.press('PageDown'); await page.waitForTimeout(40); const h = await hash(page); if(h === seen[seen.length - 1]) break; seen.push(h);
    }
    const want = []; BEATS.forEach((n, s) => { for(let b = 1; b <= n; b++) want.push('#step=' + (s + 1) + '&beat=' + b); });
    check('Next visits every beat in order and stops at Step 6, last beat', JSON.stringify(seen) === JSON.stringify(want), seen);
    const back = [await hash(page)];
    for(let i = 0; i < 40; i++){ await page.keyboard.press('PageUp'); await page.waitForTimeout(30); const h = await hash(page); if(h === back[back.length - 1]) break; back.push(h); }
    check('Previous retraces the same path', JSON.stringify(back) === JSON.stringify(want.slice().reverse()));
    check('every data-q element: length ∝ data-v, ghost/cap flags, label within 8 px', enc.length === 0, enc.slice(0, 8));
    check('windowed 1366×768: no text below 14 px', small.length === 0, small.slice(0, 8));
    await page.reload(); await page.waitForTimeout(200);
    check('reload returns to the same step and beat', await hash(page) === '#step=1&beat=1');
    await goto(page, 4, 3); await page.reload(); await page.waitForTimeout(200);
    check('loading with #step=4&beat=3 opens the explorer at 0 dB', (await dv(page, 'P_refl_log')) === 1);
    check('no console errors through the walk', log.console.length === 0, log.console);
    await ctx.close();
  }

  console.log('Keys (spec A.8)');
  {
    const { ctx, page } = await open(browser);
    await page.goto(URL0 + '#step=2&beat=1'); await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight'); check('ArrowRight → next beat', await hash(page) === '#step=2&beat=2');
    await page.keyboard.press('n'); check('N → next beat', await hash(page) === '#step=2&beat=3');
    await page.keyboard.press('Space'); check('Space → next beat', await hash(page) === '#step=2&beat=4');
    await page.keyboard.press('Shift+Space'); check('Shift+Space → previous beat', await hash(page) === '#step=2&beat=3');
    await page.keyboard.press('ArrowLeft'); check('ArrowLeft → previous beat', await hash(page) === '#step=2&beat=2');
    await page.keyboard.press('Backspace'); check('Backspace is not bound', await hash(page) === '#step=2&beat=2');
    await page.keyboard.press('4'); check('key 4 in Step 2 selects S22 (its beat)', await hash(page) === '#step=2&beat=5');
    await page.keyboard.press('End'); check('End → Step 6, last beat', await hash(page) === '#step=6&beat=4');
    await page.keyboard.press('Home'); check('Home → Step 1, beat 1', await hash(page) === '#step=1&beat=1');
    await page.keyboard.press('Alt+3'); check('Alt+3 → Step 3', await hash(page) === '#step=3&beat=1');
    await page.keyboard.press('r'); check('R in Step 3 → reverse sweep', /reverse sweep/.test(await page.textContent('#stage')));
    // clicker keys on a focused slider: navigate, slider unchanged
    await goto(page, 3, 3); await page.focus('#glm'); const v0 = await page.inputValue('#glm');
    await page.keyboard.press('PageDown'); await page.waitForTimeout(60);
    check('PageDown on a focused slider → next beat', await hash(page) === '#step=3&beat=4');
    check('… and the slider value is unchanged', await page.inputValue('#glm') === v0, [v0, await page.inputValue('#glm')]);
    await page.focus('#glm'); await page.keyboard.press('PageUp'); await page.waitForTimeout(60);
    check('PageUp on a focused slider → previous beat', await hash(page) === '#step=3&beat=3' && await page.inputValue('#glm') === v0);
    await page.focus('#glm'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
    check('ArrowRight on a focused slider adjusts it (no navigation)', await hash(page) === '#step=3&beat=3' && await page.inputValue('#glm') !== v0);
    await page.locator('body').click({ position: { x: 5, y: 700 } });
    const dark = await page.evaluate(() => document.body.classList.contains('light'));
    await page.keyboard.press('t'); check('T toggles the theme', (await page.evaluate(() => document.body.classList.contains('light'))) !== dark);
    await page.keyboard.press('t');
    await page.keyboard.press('f'); await page.waitForTimeout(200);
    check('F enters presentation (rail hidden)', await page.evaluate(() => document.body.classList.contains('present') && getComputedStyle(document.getElementById('rail')).display === 'none'));
    check('presentation defaults to the light Projector theme', await page.evaluate(() => document.body.classList.contains('light')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('Esc leaves presentation', !(await page.evaluate(() => document.body.classList.contains('present'))));
    await page.keyboard.press('?'); check('? opens the keyboard help', await page.evaluate(() => document.getElementById('help').open));
    await page.keyboard.press('Escape');
    const nav = await page.evaluate(() => ['prevBtn', 'nextBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.width, r.height]; }));
    check('Previous/Next buttons ≥ 44×44 px', nav.every(([w, h]) => w >= 44 && h >= 44), nav);
    await ctx.close();
  }

  console.log('Animation (A.6.8)');
  {
    const { ctx, page } = await open(browser);
    await page.goto(URL0 + '#step=1&beat=6'); await page.waitForTimeout(300);
    const d1 = await page.getAttribute('#wInc', 'd'); await page.waitForTimeout(200);
    check('Step 1b waves move', d1 !== await page.getAttribute('#wInc', 'd'));
    await page.keyboard.press('p'); await page.waitForTimeout(50); const d2 = await page.getAttribute('#wInc', 'd'); await page.waitForTimeout(250);
    check('P pauses all motion', d2 === await page.getAttribute('#wInc', 'd'));
    await ctx.close();
    const r = await open(browser, { reducedMotion: 'reduce' });
    await r.page.goto(URL0 + '#step=1&beat=6'); await r.page.waitForTimeout(200); const d3 = await r.page.getAttribute('#wInc', 'd'); await r.page.waitForTimeout(250);
    check('prefers-reduced-motion: loads paused, envelope drawn', d3 === await r.page.getAttribute('#wInc', 'd') && (await r.page.$('.envelope')) !== null);
    await r.ctx.close();
  }

  console.log('Lecture values (spot checks against hand cases)');
  {
    const { ctx, page } = await open(browser);
    await page.goto(URL0 + '#step=1&beat=2'); await page.waitForTimeout(200);
    check('1a Z02 = 150 Ω: reflected 25 %, transmitted 75 %', near(await dv(page, 'P_refl'), 0.25, 1e-9) && near(await dv(page, 'P_trans'), 0.75, 1e-9));
    await goto(page, 1, 5);
    check('1b Open: |Γ_L| = 1 (PF-1), reflected wave = incident', near(await dv(page, 'V_refl'), 1, 1e-12) && /VSWR = V/.test(await page.textContent('#stage')) && /∞/.test(await page.textContent('#readouts')));
    check('1b Open: Γ_L reads +1 (1.000∠0.0°), never −1', /1\.000∠0\.0°/.test(await page.textContent('#readouts')));
    await goto(page, 1, 4);
    check('1b Short: Γ_L = 1.000∠180.0°', /1\.000∠180\.0°/.test(await page.textContent('#readouts')));
    await goto(page, 1, 6);
    check('1b Z_L = 100 Ω: V_max 4/3, V_min 2/3, VSWR 2.00', near(await dv(page, 'V_max'), 4 / 3, 1e-9) && near(await dv(page, 'V_min'), 2 / 3, 1e-9) && /2\.00/.test(await page.textContent('#readouts')));
    await goto(page, 2, 3);
    check('Step 2 S21 beat: b2 = |S21| = 0.6 with a1 = 1', near(await dv(page, 'b2'), 0.6, 1e-12) && near(await dv(page, 'a1'), 1, 1e-12));
    await goto(page, 2, 4);
    check('Step 2 S12 beat: drive a2 = 1, a1 = 0 (ghost)', near(await dv(page, 'a2'), 1, 1e-12) && (await dv(page, 'a1')) === 0);
    await goto(page, 3, 4);
    check('Step 3 isolator with Γ_L = 0.5: Γin = S11 badge', /Γin = S11/.test(await page.textContent('#readouts')));
    await goto(page, 4, 8);
    check('Step 4 amplifier: added by device 9900 %', near(await dv(page, 'P_added_fwd'), 99, 1e-9));
    await goto(page, 4, 2);
    check('Step 4 ladder: S21 everyday "insertion loss = 4.4 dB" (PF-5 sign)', /insertion/.test(await page.textContent('#stage')) && /4\.4 dB/.test(await page.textContent('#stage')));
    await goto(page, 5, 4);
    check('Step 5 amplifier: badge reads Active', /Active/.test(await page.textContent('#stage')) && (await dv(page, 'badge_passive')) === 0);
    await goto(page, 5, 2);
    check('Step 5 ideal through: lossless and passive', (await dv(page, 'badge_lossless')) === 1 && (await dv(page, 'badge_passive')) === 1);
    await ctx.close();
  }

  console.log('Lab (spec A.9, PF fixes)');
  {
    const { ctx, page, log } = await open(browser);
    await page.goto(URL0); await page.waitForTimeout(200); await page.click('#modeLab'); await page.waitForTimeout(100);
    const res = () => page.textContent('#labRight');
    const row = async label => page.evaluate(l => { const tr = [...document.querySelectorAll('#labRight tr')].find(t => t.cells[0] && t.cells[0].textContent.trim().startsWith(l)); return tr ? tr.cells[1].textContent : null; }, label);
    for(const w of ['open', 'inf', '∞', 'Infinity']){
      await page.fill('#zl', w); await page.waitForTimeout(30);
      check('Z_L "' + w + '" → Γ_L = 1.000∠0.0°, load VSWR ∞ (PF-1)', (await row('ΓL')) === '1.000∠0.0°' && (await row('load VSWR')) === '∞', [await row('ΓL'), await row('load VSWR')]);
    }
    await page.fill('#zl', '50'); await page.click('#zlOpen');
    check('Open button → Γ_L = +1', (await row('ΓL')) === '1.000∠0.0°');
    await page.fill('#zl', '-25'); await page.waitForTimeout(30);
    check('Z_L = −25 Ω: load VSWR "— (|Γ| > 1)" (PF-3)', (await row('load VSWR')) === '— (|Γ| > 1)', await row('load VSWR'));
    await page.fill('#zl', '50');
    check('|S21| line and "gain = +9.0 dB" for Amp 12 + Atten 3 (PF-5)', /\|S21\| \(dB\)9\.0 dB/.test(await res()) && (await row('gain')) === '+9.0 dB', await row('gain'));
    check('no "Insertion (S21)" signed label', !/Insertion \(S21\)/.test(await res()));
    // invalid input keeps the last valid value (PF-6)
    const before = await res();
    for(const t of ['abc', '1∠', '']){ await page.fill('#zs', t); await page.waitForTimeout(30);
      check('Z_s "' + t + '" flagged, outputs unchanged', (await page.getAttribute('#zs', 'aria-invalid')) === 'true' && await res() === before); }
    await page.fill('#zs', '50');
    for(const t of ['0', '-50', '2000', 'abc']){ await page.fill('#z0', t); await page.waitForTimeout(30);
      check('Z0 "' + t + '" flagged, outputs unchanged', (await page.getAttribute('#z0', 'aria-invalid')) === 'true' && await res() === before); }
    await page.fill('#z0', '50');
    // Deg/Rad changes display only (PF-2): phase 45° + filter 20 dB
    await page.click('#labReset'); await page.selectOption('#main0type', 'phase'); await page.selectOption('#main1type', 'filter');
    const mags = async () => page.evaluate(() => [...document.querySelectorAll('#labRight .smat div')].map(d => d.textContent.match(/S\d\d ([\d.]+)/)[1]));
    const m0 = await mags(), st0 = await row('|S21| (dB)');
    await page.click('#lab_rad'); const m1 = await mags(), radText = await page.textContent('#labRight .smat');
    await page.click('#lab_deg'); const m2 = await mags();
    check('Deg→Rad→Deg: every magnitude unchanged (PF-2)', JSON.stringify(m0) === JSON.stringify(m1) && JSON.stringify(m0) === JSON.stringify(m2), [m0, m1, m2]);
    check('Radians shows the same angles in rad', /rad/.test(radText) && /−0\.785 rad/.test(radText), radText.slice(0, 80));
    check('Filter stays lossless: |S21| (dB) unchanged after the switch', (await row('|S21| (dB)')) === st0);
    // 10-device cap and the divider
    await page.click('#labReset'); for(let i = 0; i < 12; i++){ const add = page.locator('#labMid button', { hasText: '+ Add device' }); if(await add.isDisabled()) break; await add.click(); }
    check('device chain capped at 10', (await page.locator('.dev').count()) === 10);
    const t0 = Date.now(); await page.fill('#vsMag', '2'); const dt = Date.now() - t0;
    check('a 10-device recompute is quick (' + dt + ' ms round trip)', dt < 200);
    await page.click('#lab_divider');
    for(const [type, gin] of [['wilkinson', '0.000'], ['resistive', '0.000'], ['tee', '0.333']]){
      await page.selectOption('#divType', type); await page.waitForTimeout(30);
      check('divider ' + type + ': |Γin| = ' + gin, (await row('Γin')).startsWith(gin), await row('Γin'));
    }
    await page.selectOption('#divType', 'resistive');
    check('resistive divider: half of P_in dissipated', /\(50\.0%\)/.test(await row('divider dissipation')), await row('divider dissipation'));
    check('flow bars carry data-q / data-v', (await page.locator('#flow [data-q]').count()) > 0);
    const presets = await page.evaluate(() => [...document.querySelectorAll('select[id$="type"] option')].map(o => o.textContent));
    check('preset lists have no Circulator', !presets.some(p => /circulator/i.test(p)));
    check('no console errors in Lab', log.console.length === 0, log.console);
    await ctx.close();
  }

  for(const H of [720, 1080]){
    const W = H === 720 ? 1280 : 1920;
    console.log('Presentation ' + W + '×' + H + ' (A.6.4, A.6.7)');
    const { ctx, page, log } = await open(browser, { viewport: { width: W, height: H } });
    await page.goto(URL0 + '#step=1&beat=1'); await page.waitForTimeout(200); await page.keyboard.press('f'); await page.waitForTimeout(300);
    const sizes = [], over = [];
    for(let s = 1; s <= 6; s++) for(let b = 1; b <= BEATS[s - 1]; b++){
      await goto(page, s, b);
      (await sizeIssues(page, PRESENT[H])).forEach(x => sizes.push(s + '.' + b + ' ' + x));
      const o = await overflow(page); if(o.page || o.side) over.push(s + '.' + b + ' ' + JSON.stringify(o));
    }
    check('text sizes meet ' + JSON.stringify(PRESENT[H]) + ' in every beat', sizes.length === 0, sizes.slice(0, 8));
    check('no page scroll and no panel overflow in every beat', over.length === 0, over);
    check('no console errors', log.console.length === 0, log.console);
    await ctx.close();
  }

  for(const [W, H] of [[1366, 768], [1440, 900], [1920, 1080], [1280, 720]]){
    const { ctx, page } = await open(browser, { viewport: { width: W, height: H } });
    await page.goto(URL0); await page.waitForTimeout(150);
    const bad = [];
    for(let s = 1; s <= 6; s++){ await goto(page, s, 1); const o = await overflow(page); if(o.page) bad.push('step ' + s); }
    await page.click('#modeLab'); await page.waitForTimeout(80); if((await overflow(page)).page) bad.push('lab');
    check('windowed ' + W + '×' + H + ': no page scroll (Lecture steps and Lab)', bad.length === 0, bad);
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
