// Developer test for Phasor Lab v1.0.0 (not acceptance). Drives the built page with Playwright (Chromium) through its controls only
// (no test hooks in the shipped file) and writes tests/out/dev_result.json for check_values.py, which recomputes every value independently.
// Usage: node tests/dev_test.js   (from Phasor_Lab_src/)
'use strict';
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', '..', 'Phasor_Lab_v1.0.0.html');
const OUT = path.join(__dirname, 'out');
const SHOTS = path.join(__dirname, '..', 'release-shots', 'v1.0.0');
const SIZES = [[1366, 768, '1366x768'], [1093, 614, '125pct']];   // 125 % zoom on a 1366 × 768 laptop is 1093 × 614 CSS px
const N_RANDOM = 50;
const MIN_FIG_PX = 11;

let seed = 20261127;                       // fixed seed: the 50 cases are the same on every run
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];
const res = {checks: [], cases: [], acceptance: {}, console: [], requests: []};
const check = (name, ok, info) => { res.checks.push({name, ok: !!ok, info: info === undefined ? '' : String(info)}); };

// Page helpers (all through the visible controls).
async function readTable(p) {
  return p.evaluate(() => {
    const rows = {}; for (const tr of document.querySelectorAll('#read tr')) { const c = [...tr.children].map(x => x.textContent.trim()); if (c[0]) rows[c[0]] = c.slice(1); }
    return {rows, note: document.getElementById('readNote').textContent, steps: document.getElementById('stepList').textContent,
      limit: [...document.querySelectorAll('#warn .limitbox')].map(x => x.textContent), warn: [...document.querySelectorAll('#warn .warnbox')].map(x => x.textContent),
      info: [...document.querySelectorAll('#warn p')].map(x => x.textContent), circ: document.getElementById('circ').textContent};
  });
}
// Set the slider whose aria-label is aria to v (as a user drag would) and return the value the input then holds.
// If the page then shows a limit (the move was stopped or clamped), the global 'limited' is set: a random case with one is not used.
let limited = false;
async function slide(p, aria, v) {
  const r = await p.evaluate(([a, val]) => { const i = document.querySelector('input[type=range][aria-label="' + a + '"]'); if (!i) return null; i.value = String(val); i.dispatchEvent(new Event('input', {bubbles: true}));
    return {v: Number(i.value), lim: document.querySelectorAll('#warn .limitbox').length}; }, [aria, v]);
  if (r === null) throw new Error('no slider ' + aria);
  if (r.lim) limited = true;
  return r.v;
}
async function typed(p, aria, v) {
  return p.evaluate(([a, val]) => { const i = document.querySelector('input[aria-label="' + a + '"]'); if (!i) return false; i.value = String(val); i.dispatchEvent(new Event('change', {bubbles: true})); return true; }, [aria, v]);
}
const clickText = (p, sel, text) => p.evaluate(([s, t]) => { const b = [...document.querySelectorAll(s)].find(x => x.textContent.trim() === t); if (b) b.click(); return !!b; }, [sel, text]);
const hold = (p, v) => p.selectOption('#holdSel', v);
const reset = p => clickText(p, '#ctl button', 'Reset');

(async () => {
  fs.mkdirSync(OUT, {recursive: true}); fs.mkdirSync(SHOTS, {recursive: true});
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 1366, height: 768}});
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') res.console.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => res.console.push('pageerror: ' + e));
  p.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) res.requests.push(u); });
  await p.goto('file://' + FILE);
  await p.waitForTimeout(200);

  // ── Version in four places ──
  const ver = await p.evaluate(() => ({title: document.title, meta: document.querySelector('meta[name=version]').content, badge: document.querySelector('.badge').textContent,
    head: document.documentElement.outerHTML.slice(0, 0) + (document.firstChild && document.firstChild.nextSibling ? '' : ''), link: document.querySelector('a.xlink').getAttribute('href')}));
  const raw = fs.readFileSync(FILE, 'utf8');
  check('version: title, meta, badge, header comment all v1.0.0', ver.title.includes('v1.0.0') && ver.meta === 'v1.0.0' && ver.badge.includes('v1.0.0') && /Version: v1\.0\.0/.test(raw.slice(0, 600)), JSON.stringify(ver));
  check('Sync Gen lab link is relative and the file exists in ece-3033/', !/^https?:/.test(ver.link) && fs.existsSync(path.resolve(path.dirname(FILE), ver.link)), ver.link);
  check('no innerHTML / eval / document.write in the script', !/innerHTML|\beval\(|document\.write|new Function/.test(raw));
  check('no window.__ test hooks', !/window\.__/.test(raw));

  // ── §8 acceptance values ──
  const A = res.acceptance;
  A.default = await readTable(p);
  // E1..E5 through the Experiments page buttons.
  const setup = async n => { await p.click('nav.tabs button[data-page=exp]'); const btns = await p.$$('.exp-card .btn.pri'); await btns[n].click(); await p.waitForTimeout(100); };
  await setup(0); A.e1 = await readTable(p);
  await setup(1); A.e2 = {};
  for (const P of [3, 6, 9]) { A.e2['p' + P + '_set'] = await slide(p, 'G1 power', P); A.e2['p' + P] = await readTable(p); }
  await setup(2); A.e3 = {};
  for (const E of [8949, 11078, 12000]) { A.e3['e' + E + '_set'] = await slide(p, 'G1 internal voltage', E); A.e3['e' + E] = await readTable(p); }
  await setup(3); A.e4 = await readTable(p);
  await setup(4); A.e5 = await readTable(p);
  // Show answer texts (computed by the page).
  await p.click('nav.tabs button[data-page=exp]');
  A.answers = await p.evaluate(() => { for (const b of [...document.querySelectorAll('.exp-card .btn')].filter(x => x.textContent === 'Show answer')) b.click(); return [...document.querySelectorAll('.exp-card .ans')].map(x => x.textContent); });
  await p.click('nav.tabs button[data-page=lab]');

  // ── Sweep: Hold 3 runs to the least |E_A1| and stops with its message; ghosts every 10 % ──
  await reset(p); await hold(p, 'power');
  await clickText(p, '#ctl button', '▶ Sweep');
  await p.waitForTimeout(6800);
  const sw3 = await readTable(p), g3 = await p.evaluate(() => document.querySelectorAll('#volt line[opacity="0.22"]').length);
  const e1Chip = await p.evaluate(() => document.querySelector('input[aria-label="G1 internal voltage"]').getAttribute('aria-valuetext'));
  check('Sweep (Hold 3) ends at the limit with "not reachable at this P_1"', sw3.limit.some(t => /Not reachable at this P1/.test(t)), sw3.limit.join(' | ') + ' at ' + e1Chip);
  check('Sweep (Hold 3) leaves 11 ghosts of each E_A (every 10 %)', g3 === 22, g3 + ' ghost lines in the voltages panel');
  res.sweep3 = {limit: sw3.limit, at: e1Chip};
  // Hold 2 with P_L above P_max at the held field: the sweep stops at pull-out with its message.
  await reset(p); await clickText(p, '#ctl .seg button', '|EA1|'); await slide(p, 'G1 internal voltage', 10403); await hold(p, 'field'); await slide(p, 'load power', 20);
  await clickText(p, '#ctl button', '▶ Sweep'); await p.waitForTimeout(6800);
  const sw2 = await readTable(p), p1Chip = await p.evaluate(() => document.querySelector('input[aria-label="G1 power"]').getAttribute('aria-valuetext'));
  check('Sweep (Hold 2, P_L 20 MW) stops at G1\'s pull-out limit with its message', sw2.limit.some(t => /pull-out limit for this field/.test(t)) && p1Chip === '16.06 MW', sw2.limit.join(' | ') + ' at ' + p1Chip);
  res.sweep2 = {limit: sw2.limit, at: p1Chip};
  // A drag past the limit in Free (set by |E_A1|) stops at the limit and says so.
  await reset(p); await clickText(p, '#ctl .seg button', '|EA1|'); await slide(p, 'G1 internal voltage', 8000); const st0 = await slide(p, 'G1 power', 24);
  const drag = await readTable(p);
  check('Free, set by |E_A1|: P_1 dragged past pull-out stops at the limit with a message', drag.limit.some(t => /pull-out limit for this field: P1 stopped at/.test(t)), drag.limit.join(' | '));
  // Typed input validation: a bad entry is refused with its cause and leaves the Lab unchanged.
  await reset(p);
  const before = await readTable(p);
  await p.evaluate(() => { document.getElementById('mach').open = true; });
  await typed(p, 'G1 XS (Ω)', 'abc'); const badMsg = await p.evaluate(() => document.querySelector('#mach .nmsg').textContent); const after = await readTable(p);
  check('typed X_S "abc" refused with its cause; Lab unchanged', /not a number/.test(badMsg) && JSON.stringify(before.rows) === JSON.stringify(after.rows), badMsg);
  await typed(p, 'G1 XS (Ω)', '0'); const badMsg2 = await p.evaluate(() => document.querySelector('#mach .nmsg').textContent);
  check('typed X_S 0 refused (out of range) with its cause', /must be from/.test(badMsg2), badMsg2);
  // Warnings.
  await reset(p); await slide(p, 'G1 power', 14);
  const w1 = await readTable(p);
  check('G2 below 0 MW: "motoring: reverse power"', w1.warn.some(t => /G2 motoring: reverse power/.test(t)), w1.warn.join(' | '));
  await reset(p); await slide(p, 'load power', 22);
  const w2 = await readTable(p);
  check('above rating warning', w2.warn.some(t => /above rating/.test(t)), w2.warn.join(' | '));
  check('Q statements: supplies Q (over-excited)', w2.info.some(t => /supplies Q \(over-excited\)/.test(t)), w2.info.join(' | '));
  await reset(p); await clickText(p, '#ctl .seg[aria-label="Load lagging or leading"] button', 'lead'); await clickText(p, '#ctl .seg[aria-label="G1 lagging or leading"] button', 'lead');
  const w3 = await readTable(p);
  check('Q statements: absorbs Q (under-excited)', w3.info.some(t => /absorbs Q \(under-excited\)/.test(t)), w3.info.join(' | '));
  // Scales fixed by ratings: an operating input does not move V_φ's arrow; a rating change does.
  await reset(p);
  const vArrow = () => p.evaluate(() => { const l = [...document.querySelectorAll('#volt line')].find(x => x.getAttribute('stroke') === '#A32D2D'); return l ? l.getAttribute('x2') : null; });
  const iRef = () => p.evaluate(() => document.querySelector('#curr').textContent.match(/right edge = ([\d,]+) A/)[1]);
  const v0 = await vArrow(), i0 = await iRef(); await slide(p, 'G1 power', 9); await slide(p, 'load power', 18); const v1 = await vArrow(), i1 = await iRef();
  check('scales do not change with operating inputs', v0 === v1 && i0 === i1, v0 + '/' + v1 + ' ' + i0 + '/' + i1);
  await p.evaluate(() => { document.getElementById('mach').open = true; }); await typed(p, 'G1 Rating S (MVA)', '20'); const i2 = await iRef();
  check('current scale changes when a rating changes', i2 !== i0, i0 + ' → ' + i2);
  // Reduced motion: Sweep steps 10 % per press, no animation.
  {
    const rp = await b.newPage({viewport: {width: 1366, height: 768}, reducedMotion: 'reduce'});
    await rp.goto('file://' + FILE); await rp.selectOption('#holdSel', 'shift');
    const label0 = await rp.evaluate(() => document.getElementById('sweepBtn').textContent);
    for (let i = 0; i < 3; i++) await rp.click('#sweepBtn');
    const gh = await rp.evaluate(() => document.querySelectorAll('#volt line[opacity="0.22"]').length), pc = await rp.evaluate(() => document.querySelector('input[aria-label="G1 power"]').getAttribute('aria-valuetext'));
    check('reduced motion: Sweep is a 10 % step per press (3 presses → 3 ghosts each, P_1 at 20 %)', /Step/.test(label0) && gh === 6 && pc === '2.40 MW', label0 + '; ' + gh + ' ghost lines; P1 ' + pc);
    await rp.close();
  }

  // ── 50 random valid cases (all Hold conditions, lag and lead, unequal machines) ──
  let tries = 0;
  while (res.cases.length < N_RANDOM && tries < 400) {
    tries++;
    await reset(p); limited = false;
    await p.evaluate(() => { document.getElementById('mach').open = true; });
    const c = {VLL: pick([4.16, 6.9, 11, 13.8, 22, 33]) , ident: rnd() < 0.4, m: [], hold: pick(['free', 'field', 'power', 'shift']), by: pick(['pf', 'q', 'e'])};
    for (let k = 0; k < 2; k++) c.m.push({S: +(2 + rnd() * 48).toFixed(2), R: +(rnd() * 1.5).toFixed(3), X: +(2 + rnd() * 38).toFixed(2)});
    await typed(p, 'Bus V_LL (kV)', c.VLL);
    if (!c.ident) { await p.click('#ident'); }
    for (let k = 0; k < (c.ident ? 1 : 2); k++) { await typed(p, 'G' + (k + 1) + ' Rating S (MVA)', c.m[k].S); await typed(p, 'G' + (k + 1) + ' RA (Ω)', c.m[k].R); await typed(p, 'G' + (k + 1) + ' XS (Ω)', c.m[k].X); }
    if (c.ident) c.m[1] = c.m[0];
    const Ssum = c.m[0].S + c.m[1].S;
    c.PL = await slide(p, 'load power', +(Ssum * (0.2 + 0.7 * rnd())).toFixed(2));
    c.pfL = await slide(p, 'load power factor', +(0.6 + 0.4 * rnd()).toFixed(2));
    c.lagL = rnd() < 0.6; if (!c.lagL) await clickText(p, '#ctl .seg[aria-label="Load lagging or leading"] button', 'lead');
    const P1 = +(c.PL * (0.1 + 0.8 * rnd())).toFixed(2);
    if (c.hold === 'free' || c.hold === 'shift') {
      const by = c.hold === 'shift' ? 'pf' : c.by; c.by = by;
      await clickText(p, '#ctl .seg[aria-label="Set G1 by"] button', {pf: 'pf1', q: 'Q1', e: '|EA1|'}[by]);
      c.P1 = await slide(p, 'G1 power', P1);
      if (by === 'pf') { c.pf1 = await slide(p, 'G1 power factor', +(0.6 + 0.4 * rnd()).toFixed(2)); c.lag1 = rnd() < 0.6; if (!c.lag1) await clickText(p, '#ctl .seg[aria-label="G1 lagging or leading"] button', 'lead'); }
      if (by === 'q') c.Q1 = await slide(p, 'G1 reactive power', +((rnd() * 2 - 0.6) * c.m[0].S * 0.6).toFixed(2));
      if (by === 'e') { const r = await p.evaluate(() => { const i = document.querySelector('input[aria-label="G1 internal voltage"]'); return [Number(i.min), Number(i.max)]; }); c.E1 = await slide(p, 'G1 internal voltage', Math.round(r[0] + 2 + (r[1] - r[0] - 4) * rnd())); }
      if (c.hold === 'shift') { await hold(p, 'shift'); c.P1 = await slide(p, 'G1 power', +(c.PL * rnd()).toFixed(2)); }
    } else if (c.hold === 'field') {
      c.by = 'e'; c.P1 = await slide(p, 'G1 power', P1); await clickText(p, '#ctl .seg[aria-label="Set G1 by"] button', '|EA1|');
      const r = await p.evaluate(() => { const i = document.querySelector('input[aria-label="G1 internal voltage"]'); return [Number(i.min), Number(i.max)]; });
      c.E1 = await slide(p, 'G1 internal voltage', Math.round(r[0] + 2 + (r[1] - r[0] - 4) * rnd()));
      await hold(p, 'field');
      const mx = await p.evaluate(() => Number(document.querySelector('input[aria-label="G1 power"]').max));
      c.P1 = await slide(p, 'G1 power', +(mx * 0.97 * rnd()).toFixed(2));
    } else {
      c.by = 'e'; c.P1 = await slide(p, 'G1 power', P1); await clickText(p, '#ctl .seg[aria-label="Set G1 by"] button', '|EA1|'); await hold(p, 'power');
      const r = await p.evaluate(() => { const i = document.querySelector('input[aria-label="G1 internal voltage"]'); return [Number(i.min), Number(i.max)]; });
      c.E1 = await slide(p, 'G1 internal voltage', Math.round(r[0] + 2 + (r[1] - r[0] - 4) * rnd()));
    }
    const t = await readTable(p);
    if (t.limit.length || limited) continue;          // a refused or limited change: not a clean case, draw another
    c.page = t; res.cases.push(c);
  }
  check('50 random valid cases collected', res.cases.length === N_RANDOM, res.cases.length + ' in ' + tries + ' tries');
  check('every Hold condition, lag and lead, unequal machines among the cases',
    ['free', 'field', 'power', 'shift'].every(h => res.cases.some(c => c.hold === h)) && res.cases.some(c => !c.lagL) && res.cases.some(c => !c.ident));

  // ── Layout: no page scrollbar, figure text ≥ 11 px, every Hold, both sizes; screenshots ──
  for (const [w, h, tag] of SIZES) {
    await p.setViewportSize({width: w, height: h});
    for (const hd of ['free', 'field', 'power', 'shift']) {
      await reset(p); await p.evaluate(() => { document.getElementById('mach').open = false; }); await hold(p, hd); await p.waitForTimeout(80);
      const m = await p.evaluate(() => {
        const de = document.documentElement; let min = 99, where = '';
        for (const t of document.querySelectorAll('#lab svg text')) {
          const leafs = t.querySelectorAll('tspan').length ? [...t.querySelectorAll('tspan')] : [t];
          for (const s of leafs) { if (!s.textContent.trim()) continue; const fs = parseFloat(s.getAttribute('font-size') || t.getAttribute('font-size')), M_ = t.getScreenCTM(), sc = Math.hypot(M_.a, M_.b), px = fs * sc;
            const sub = s.getAttribute('font-size') && parseFloat(s.getAttribute('font-size')) < parseFloat(t.getAttribute('font-size'));
            if (!sub && px < min) { min = px; where = s.textContent; } }
        }
        return {scrollV: de.scrollHeight > de.clientHeight, scrollH: de.scrollWidth > de.clientWidth, min: +min.toFixed(2), where};
      });
      check(`layout ${tag} Hold ${hd}: no page scrollbar`, !m.scrollV && !m.scrollH, JSON.stringify(m));
      check(`layout ${tag} Hold ${hd}: figure text ≥ ${MIN_FIG_PX} px (subscripts excepted)`, m.min >= MIN_FIG_PX, m.min + ' px at "' + m.where + '"');
      await p.screenshot({path: path.join(SHOTS, `${tag}_lab_${hd}.png`)});
    }
    await p.click('nav.tabs button[data-page=exp]'); await p.screenshot({path: path.join(SHOTS, `${tag}_experiments.png`)}); await p.click('nav.tabs button[data-page=lab]');
  }

  // ── Worksheet: save and restore, a corrupt record refused ──
  await p.click('nav.tabs button[data-page=exp]');
  await p.fill('textarea[data-k=e1p]', 'G2 takes all the Q');
  await p.reload(); await p.click('nav.tabs button[data-page=exp]');
  const kept = await p.inputValue('textarea[data-k=e1p]');
  check('worksheet answer restored after reload', kept === 'G2 takes all the Q', kept);
  await p.evaluate(() => localStorage.setItem('phasor-lab-worksheet-v1', '[1,2]')); await p.reload();
  const bad = await p.evaluate(() => document.getElementById('sheetStatus').textContent);
  check('a corrupt stored record is refused with a message', /invalid and was not loaded/.test(bad), bad);
  const keys = await p.evaluate(() => Object.keys(localStorage));
  check('localStorage: only this tool\'s key', keys.every(k => k === 'phasor-lab-worksheet-v1'), keys.join(','));

  check('zero console errors', res.console.filter(x => /^(error|pageerror)/.test(x)).length === 0, res.console.join(' | '));
  check('zero network requests', res.requests.length === 0, res.requests.join(' '));
  await b.close();
  fs.writeFileSync(path.join(OUT, 'dev_result.json'), JSON.stringify(res, null, 1));
  const fails = res.checks.filter(c => !c.ok);
  for (const c of res.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : '  — ' + c.info));
  console.log(`dev_test.js: ${res.checks.length - fails.length} PASS, ${fails.length} FAIL`);
})();
