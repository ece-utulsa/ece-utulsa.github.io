// Developer tests for Static Stability Limit v2.0.0 (not acceptance). Run: node tests/dev_test.js
// Needs Playwright with Chromium. Drives the built page through its own controls; the shipped file has no test hooks.
// The Lab and Experiments 1–4 are compared with the published v1.2.0 file when it is present beside the build.
'use strict';
const path = require('path');
const fs = require('fs');
const {chromium} = require('playwright');

const FILE = path.resolve(__dirname, '..', '..', 'Static_Stability_Limit_v2.0.0.html');
const OLD = path.resolve(__dirname, '..', '..', 'Static_Stability_Limit_v1.2.0.html');
const SHOTS = process.env.SSL_SHOTS || '';           // folder for screenshots; empty = none
const VIEWS = [[1366, 768, '1366x768'], [1093, 614, '125pct'], [1024, 768, '1024x768'], [1920, 1080, '1920x1080']];   // CSS px; 125pct = 1366×768 at 125 % zoom
let fails = 0, passes = 0;
function check(name, ok, detail) { if (ok) passes++; else fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  ' + detail : '')); }

// Set a range input and fire its input event, as a drag would.
async function setRange(page, sel, v) { await page.evaluate(([s, val]) => { const e = document.querySelector(s); e.value = val; e.dispatchEvent(new Event('input', {bubbles: true})); }, [sel, v]); }
// Text of the value span in the Lecture control row whose label starts with the given text.
async function readout(page, label) { return page.evaluate(l => { for (const r of document.querySelectorAll('#ctl .row')) if (r.firstElementChild.textContent.startsWith(l) && r.children.length > 1) return r.lastElementChild.textContent; return null; }, label); }
// Overflow (px) of the document and of each panel; figure text that overlaps other text, is struck by a line or leaves the figure; text below the size floors.
async function layout(page) {
  return page.evaluate(() => {
    const d = document.documentElement, over = id => { const e = document.getElementById(id); return e.scrollHeight - e.clientHeight; };
    const fig = document.getElementById('fig'), bad = [];
    if (!fig.hasAttribute('hidden')) {
      const vb = fig.viewBox.baseVal, ts = [...fig.querySelectorAll('text')].map(t => ({s: t.textContent, b: t.getBBox()}));
      for (const t of ts) if (t.b.x < 0 || t.b.y < 0 || t.b.x + t.b.width > vb.width || t.b.y + t.b.height > vb.height) bad.push('clipped: ' + t.s);
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i].b, b = ts[j].b, m = 1;        // 1 unit of slack for glyph side bearings
        if (a.x + m < b.x + b.width && b.x + m < a.x + a.width && a.y + m < b.y + b.height && b.y + m < a.y + a.height) bad.push('overlap: "' + ts[i].s + '" / "' + ts[j].s + '"');
      }
      // a visible stroke through a label (Visual/UX v2.0 V-M3): sample every stroked shape, test against each text box inset by 1 unit
      const faint = ['#e3e7eb'];                       // grid lines: below 1.5:1 on white, not counted
      for (const sh of fig.querySelectorAll('line, path, circle, rect')) {
        const stroke = sh.getAttribute('stroke'), op = Number(sh.getAttribute('opacity') || 1);
        if (!stroke || stroke === 'none' || faint.includes(stroke) || op < 0.3) continue;
        const len = sh.getTotalLength();
        for (let q = 0; q <= len; q += 2) {
          const p = sh.getPointAtLength(q);
          const hit = ts.find(t => p.x > t.b.x + 1 && p.x < t.b.x + t.b.width - 1 && p.y > t.b.y + 1 && p.y < t.b.y + t.b.height - 1);
          if (hit) { bad.push('struck: "' + hit.s + '" by ' + sh.tagName + ' ' + stroke); break; }
        }
      }
      // smallest rendered figure text, CSS px (V-M9: body 11 px, sub/superscript 8 px)
      const r = fig.getBoundingClientRect(), k = Math.min(r.width / vb.width, r.height / vb.height);
      for (const t of fig.querySelectorAll('text')) {
        const px = Number(t.getAttribute('font-size')) * k;
        if (px < 11) bad.push('small text ' + px.toFixed(1) + ' px: ' + t.textContent);
        for (const sp of t.querySelectorAll('tspan[font-size]')) { const q = Number(sp.getAttribute('font-size')) * k; if (q < 8) bad.push('small script ' + q.toFixed(1) + ' px: ' + t.textContent); }
      }
    }
    for (const e of document.querySelectorAll('main *')) {
      if (e.closest('svg') || e.closest('math') || e.closest('[hidden]') || e.id === 'capMeasure' || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const px = parseFloat(getComputedStyle(e).fontSize), script = e.tagName === 'SUB' || e.tagName === 'SUP';
      if (px < (script ? 8 : 11)) bad.push('small html text ' + px.toFixed(1) + ' px: ' + e.textContent.slice(0, 20));
    }
    return {doc: Math.max(d.scrollHeight - d.clientHeight, d.scrollWidth - d.clientWidth), left: over('left'), side: over('side'), stage: over('stage'), bad};
  });
}

// What the Lab shows: readouts, verdict and every drawn label, as one string (used to compare with v1.2.0).
async function labText(page) {
  return page.evaluate(() => ['itRo', 'callout', 'flowG', 'phG', 'cvG', 'dlG', 'pmO', 'ifO'].map(id => id + ': ' + [...document.getElementById(id).querySelectorAll('text, .ro, b')].map(e => e.textContent).join(' | ') + ' # ' + (document.getElementById(id).children.length ? '' : document.getElementById(id).textContent)).join('\n'));
}
// Put the Lab of either version at input power pm (MW) and field current iF (A) and let δ settle.
async function labSet(page, pm, iF) { await setRange(page, '#pmS', pm); await setRange(page, '#ifS', iF); await page.waitForTimeout(2200); }

(async () => {
  const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const src = fs.readFileSync(FILE, 'utf8');

  // ── Static checks on the shipped file ──
  const code = src.replace(/"data:audio[^"]*"/g, '""');
  check('no innerHTML / outerHTML / insertAdjacentHTML / document.write / eval / new Function', !/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(code));
  check('no global test objects (window.__)', !/window\.__/.test(code));
  check('no network API; localStorage only through the worksheet key', !/sessionStorage|fetch\(|XMLHttpRequest|WebSocket/.test(code) && (code.match(/localStorage\.\w+\(([^,)]+)/g) || []).every(m => m.endsWith('SHEET_KEY')));
  check('true minus only: no ASCII hyphen-minus before a digit in visible strings', !/['"`> ]-\d+(\.\d+)? ?(%|MW|kV|°)/.test(code));

  for (const [w, h, tag] of VIEWS) {
    const page = await browser.newPage({viewport: {width: w, height: h}});
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e));
    await page.goto('file://' + FILE);
    const first = tag === VIEWS[0][2];
    const lay = [];                                   // layout problems collected over every Lecture state
    const note = async where => { const r = await layout(page); if (r.doc > 1 || r.left > 1 || r.side > 1 || r.stage > 1 || r.bad.length) lay.push(where + ' ' + JSON.stringify(r)); };
    const shot = async name => { if (SHOTS) await page.screenshot({path: path.join(SHOTS, tag + '_' + name + '.png'), scale: 'css'}); };

    // ── Lecture: every line of every slide ──
    let lines = 0;
    const seen = {};
    for (let s = 1; s <= 7; s++) {
      const n = await page.evaluate(() => Number(document.getElementById('lineNo').textContent.split(' of ')[1]));
      seen[s] = '';
      for (let i = 1; i <= n; i++) {
        lines++;
        if (!(await page.textContent('#cap')).trim()) lay.push('empty caption s' + s + ' l' + i);
        await note('slide ' + s + ' line ' + i);
        seen[s] += ' ¦ ' + await page.evaluate(() => document.getElementById('lec').textContent);
        if (first && ((s === 1 && (i === 1 || i === 4)) || (s === 2 && i === 2) || (s === 3 && i === 5) || (s === 5 && i === 2) || (s === 6 && i === 3))) await shot('slide' + s + '_line' + i);
        if (i < n) await page.click('#next');
      }
      await shot('slide' + s);
      if (s < 7) await page.click('#slNext');
    }
    if (first) {
      check('lecture has 38 narration lines over 7 slides', lines === 38, String(lines));
      const has = (s, t) => check('slide ' + s + ' shows ' + t, seen[s].includes(t));
      for (const t of ['9.56 kV', 'Pmax = 30.0 MW', '30.0°', 'margin 15.0 MW', '8.00 A: Pmax 40.0 MW', 'breaker OPEN', 'Pole slip · breaker trip']) has(1, t);
      for (const t of ['stray 241.7 kW', 'copper 234.0 kW', '24.41 MW', '24.17 MW', '96.7 %', 'F&W 150.0 kW', 'core 200.0 kW']) has(2, t);
      for (const t of ['EA = 11.15 kV', '25.4°', '686 A', '23.8°', '4.78 kV', '7.97 kV']) has(3, t);
      for (const t of ['Pmax = 30.0 MW', '159.2 kN·m', '188.5 rad/s']) has(4, t);
      for (const t of ['6.37 kV', '6.40 A', '10.20 kV', '12.75 kV', '30.0°', '0.901 lag', '9.6 Mvar', '40.0 MW', '9.56 kV', '41.8°']) has(5, t);
      for (const t of ['5.00 A7.97 kV25.0 MW53.1°5.0 MW0.894 lead', '6.00 A9.56 kV30.0 MW41.8°10.0 MW0.991 lead', '8.00 A12.75 kV40.0 MW30.0°20.0 MW0.901 lag']) has(6, t);
      check('slide 7 shows ten equations', (await page.locator('#eqs .kcard math').count()) === 10);
      check('every left-column and stage equation is MathML with no raw source text', !/\\frac|\\t\{|rac\{/.test(Object.values(seen).join('')));
    }

    // ── Lecture controls ──
    await page.evaluate(() => { for (let i = 0; i < 7; i++) document.getElementById('slPrev').click(); });
    for (const [p, dTxt] of [[15, '30.0°'], [20, '41.8°'], [25, '56.4°'], [30, '90.0°']]) {
      await setRange(page, '#ctl input', p);
      const d = await readout(page, 'Torque angle');
      if (first) check('slide 1 slider at ' + p + ' MW: δ ' + dTxt, d === dTxt, d);
      await note('slide 1 P=' + p);
    }
    for (let p = 0; p <= 30; p += 0.5) { await setRange(page, '#ctl input', p); await note('slide 1 P=' + p); }
    await setRange(page, '#ctl input', 32);
    await page.waitForFunction(() => document.getElementById('fig').textContent.includes('Pole slip'), null, {timeout: 20000}).then(() => { if (first) check('slide 1 slider at 32 MW: δ runs away, then pole slip and breaker trip', true); }, () => check('slide 1 slider at 32 MW: pole slip', false));
    if (first) check('after the trip: P_out reads 0.0 MW and the breaker is open', (await readout(page, 'Pout')) === '0.0 MW' && (await page.textContent('#fig')).includes('breaker OPEN'));
    await note('slide 1 tripped');
    await setRange(page, '#ctl input', 10);
    if (first) check('moving the slider back under P_max clears the trip', (await readout(page, 'Torque angle')) === '19.5°');
    await page.click('#slNext'); await page.click('#slNext'); await page.click('#slNext');     // slide 4
    for (let p = 0; p <= 28; p += 0.5) { await setRange(page, '#ctl input', p); await note('slide 4 P=' + p); }
    await setRange(page, '#ctl input', 15);
    if (first) check('slide 4 slider at 15 MW: δ 30.0°, margin 15.0 MW, line 7 shown', (await readout(page, 'δ')) === '30.0°' && (await readout(page, 'Margin')) === '15.0 MW' && (await page.textContent('#lineNo')) === 'line 7 of 7');
    await page.click('#slNext');                                                               // slide 5
    for (let a = 5; a <= 8.5001; a += 0.05) { await setRange(page, '#ctl input', a.toFixed(2)); await note('slide 5 IF=' + a.toFixed(2)); }
    await setRange(page, '#ctl input', 6.4);
    if (first) check('slide 5 slider at 6.40 A: unity power factor, E_A 10.20 kV', (await readout(page, 'Power factor')) === 'unity' && (await readout(page, 'EA')) === '10.20 kV', await readout(page, 'Power factor'));
    await setRange(page, '#ctl input', 5);
    if (first) check('slide 5 slider at 5.00 A: 0.894 lead, δ 53.1°, P_max 25.0 MW', (await readout(page, 'Power factor')) === '0.894 lead' && (await readout(page, 'δ')) === '53.1°' && (await readout(page, 'Pmax')) === '25.0 MW');
    check(tag + ': Lecture has no scrollbar, no clipped, overlapping or struck figure text in any state', lay.length === 0, lay.length + ' state(s): ' + lay.slice(0, process.env.SSL_ALL ? 9999 : 5).join(' | '));

    // ── Lab and Experiments ──
    await page.click('nav.tabs button[data-page=lab]');
    await page.waitForTimeout(600);
    await shot('lab');
    if (first) {
      check('Lab opens at 15.0 MW, 6.00 A: δ 30.0°, P_max 30.0 MW, in step', (await page.textContent('#itRo')).includes('δ 30.0°') && (await page.textContent('#rPm')) === '30.0' && (await page.textContent('#callout')).startsWith('In step'));
      await labSet(page, 35, 6);
      await page.waitForFunction(() => document.getElementById('callout').textContent.startsWith('Breaker tripped'), null, {timeout: 60000}).then(() => check('Lab above P_max: pole slip, then breaker trip and locked sliders', true), () => check('Lab trip', false));
      check('Lab sliders are locked after the trip; Reset restores 15.0 MW', await page.isDisabled('#pmS'));
      await page.click('#resetBtn');
      check('Lab Reset: 15.0 MW, in step', (await page.textContent('#pmO')) === '15.0 MW' && !(await page.isDisabled('#pmS')));
      await labSet(page, 25, 6);
      check('Lab at 25 MW, 6.00 A: low-margin warning (δ 56.4°)', (await page.textContent('#callout')).includes('56.4°') && (await page.getAttribute('#lmLow', 'class')).includes('on'));
    }
    await page.click('nav.tabs button[data-page=exp]');
    await shot('experiments');
    if (first) {
      check('Experiments: five cards, E5 last', (await page.locator('.exp-card').count()) === 5 && (await page.textContent('#e5 h3')).includes('18 MW'));
      await page.click('#e5 button.try');
      check('E5 Set up: Lab at 18.0 MW and 6.00 A', (await page.textContent('#pmO')) === '18.0 MW' && (await page.textContent('#ifO')) === '6.00 A' && (await page.getAttribute('nav.tabs button[data-page=lab]', 'aria-pressed')) === 'true');
      await page.click('nav.tabs button[data-page=exp]');
      await page.click('#chkBtn');
      check('E5 Check with empty boxes names each refused entry', (await page.textContent('#turnMsg')).includes('E_A: type a value.') || (await page.textContent('#turnMsg')).includes('EA: type a value.'), await page.textContent('#turnMsg'));
      await page.fill('#eIn', '12.2'); await page.fill('#ifIn', 'abc'); await page.fill('#pmIn', '38.3'); await page.click('#chkBtn');
      check('E5 refuses a non-number and checks nothing', (await page.textContent('#turnMsg')).includes('not a number'));
      await page.fill('#ifIn', '7.0'); await page.click('#chkBtn');
      check('E5 wrong I_F: marked ✗ with the step to check', (await page.textContent('#turnMsg')).includes('✗') && (await page.textContent('#turnMsg')).includes('Check I'));
      await page.click('#hintBtn');
      check('E5 Hint shows the rearrangement', (await page.textContent('#turnMsg')).startsWith('Hint'));
      await page.fill('#eIn', '12.26'); await page.fill('#ifIn', '7.69'); await page.fill('#pmIn', '38.5'); await page.click('#chkBtn');
      check('E5 accepts answers inside the tolerances (12.26 kV, 7.69 A, 38.5 MW)', (await page.textContent('#turnMsg')).includes('Correct'));
      check('E5 solved: the new curve is drawn with 7.67 A: P_max 38.3 MW', (await page.textContent('#c6G')).includes('7.67 A: Pmax 38.3 MW'));
      await page.click('#solBtn');
      const sol = await page.textContent('#sol');
      check('E5 solution: E_A 12.22 kV, I_F 7.67 A, P_max 38.3 MW', sol.includes('= 12.22 kV') && sol.includes('= 7.67 A') && sol.includes('= 38.3 MW'), sol.replace(/\n/g, ' / '));
      await page.fill('textarea[data-k=e5q1]', 'rise');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
      const txt = fs.readFileSync(await dl.path(), 'utf8');
      check('worksheet export carries E5 (prediction and three answers) and the version', txt.includes('v2.0.0') && txt.includes('[e5q1]') && txt.includes('rise') && txt.includes('[e5ea]') && txt.includes('12.26') && txt.includes('[e5pm]'), txt.split('\n').filter(l => l.includes('e5')).join(' / '));
      await page.reload(); await page.click('nav.tabs button[data-page=exp]');
      check('worksheet answers are restored after a reload', (await page.inputValue('#eIn')) === '12.26' && (await page.inputValue('textarea[data-k=e5q1]')) === 'rise');
      page.once('dialog', d => d.accept()); await page.click('#clearBtn');
      check('Clear my answers empties the worksheet and resets E5', (await page.inputValue('#eIn')) === '' && (await page.textContent('#turnMsg')) === '' && (await page.isHidden('#sol')));
    }
    check(tag + ': no console or page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  // ── Lab and Experiments 1–4 against the published v1.2.0 ──
  if (fs.existsSync(OLD)) {
    const a = await browser.newPage({viewport: {width: 1366, height: 768}}), b = await browser.newPage({viewport: {width: 1366, height: 768}});
    await a.goto('file://' + FILE); await b.goto('file://' + OLD);
    for (const p of [a, b]) await p.click('nav.tabs button[data-page=lab]');
    let same = 0, diff = [];
    for (const [pm, iF] of [[15, 6], [5, 6], [25, 6], [0, 5], [10, 3], [20, 8], [28, 7.5], [16.6, 6], [20, 9.45], [34.9, 10], [12.3, 4.35]]) {
      await Promise.all([labSet(a, pm, iF), labSet(b, pm, iF)]);
      const [ta, tb] = [await labText(a), await labText(b)];
      if (ta === tb) same++; else diff.push(pm + ' MW ' + iF + ' A');
    }
    check('Lab readouts, verdict and every drawn label equal v1.2.0 at 11 settings', diff.length === 0, same + ' same; differ at: ' + diff.join(', '));
    for (const p of [a, b]) await p.click('nav.tabs button[data-page=exp]');
    const cards = p => p.evaluate(() => [...document.querySelectorAll('.exp-card')].slice(0, 4).map(c => c.textContent.replace(/\s+/g, ' ')).join('\n'));
    check('Experiments 1–4 text equals v1.2.0', (await cards(a)) === (await cards(b)));
    const tries = p => p.evaluate(() => [...document.querySelectorAll('.exp-card')].slice(0, 4).map(c => c.querySelector('button.try').dataset.try).join(';'));
    check('Experiments 1–4 set-ups equal v1.2.0', (await tries(a)) === (await tries(b)), await tries(a));
    await a.close(); await b.close();
  } else console.log('INFO  v1.2.0 file not present: Lab comparison skipped');

  // ── Model: random sweep of physics identities (the page's own point(), pMaxAt(), flowLec(), flowLab()) ──
  const page = await browser.newPage({viewport: {width: 1366, height: 768}});
  await page.goto('file://' + FILE);
  const sweep = await page.evaluate(() => {
    const worst = {kvl: 0, p: 0, q: 0, vert: 0, lec: 0, lab: 0, peak: 0};
    let n = 0, seed = 20261125;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 20000; i++) {
      const iF = 3 + 7 * rnd(), E = eAt(iF), m = pMaxAt(iF), pw = m * rnd(), d = Math.asin(pw / m), o = point(d, E);
      // KVL with R_A ignored: E_A∠δ − V_φ − jX_S·I_A = 0
      worst.kvl = Math.max(worst.kvl, Math.hypot(E * Math.cos(d) - V_PH + X_S * o.ii, E * Math.sin(d) - X_S * o.ir));
      worst.p = Math.max(worst.p, Math.abs(o.P - pw), Math.abs(o.P - 3 * V_PH * o.I * o.pf));
      worst.q = Math.max(worst.q, Math.abs(o.Q - 3 * V_PH * (E * Math.cos(d) - V_PH) / X_S));
      worst.vert = Math.max(worst.vert, Math.abs(o.vert - X_S * o.I * o.pf));
      worst.peak = Math.max(worst.peak, Math.abs(point(Math.PI / 2, E).P - m));
      const pin = 5 + 20 * rnd(), iL = 5.5 + 2.5 * rnd(), F = flowLec(pin, iL), G = flowLab(pin);
      worst.lec = Math.max(worst.lec, Math.abs(F.pin - (F.po + F.stray + F.fw + F.core + F.copper)), Math.abs(F.copper - 3 * F.I * F.I * R_A), Math.abs(F.stray - STRAY_K * F.po));
      worst.lab = Math.max(worst.lab, Math.abs(G.pin - (G.po + G.stray + G.fw + G.core + G.copper)));
      n++;
    }
    return {n, worst};
  });
  check('random sweep, ' + sweep.n + ' operating points: KVL residual < 1e-9 kV', sweep.worst.kvl < 1e-9, String(sweep.worst.kvl));
  check('random sweep: P = P_max sin δ = 3V_φ I_A cos θ, Q, and E_A sin δ = X_S I_A cos θ to 1e-9', sweep.worst.p < 1e-9 && sweep.worst.q < 1e-9 && sweep.worst.vert < 1e-9 && sweep.worst.peak < 1e-9, JSON.stringify(sweep.worst));
  check('random sweep: slide-2 and Lab power flows balance (input = output + losses) to 1e-6 MW', sweep.worst.lec < 1e-6 && sweep.worst.lab < 1e-9, sweep.worst.lec + ' ' + sweep.worst.lab);

  // ── Narration: every clip decodes; total duration; play, animated lines, pause, voice off, Lab Listen ──
  const clipSrc = src.match(/"data:audio\/mpeg;base64,[^"]+"/g) || [];
  const clips = await page.evaluate(async list => {
    let total = 0, bad = 0;
    for (const c of list) { const a = new Audio(c); await new Promise(r => { a.onloadedmetadata = r; a.onerror = () => { bad++; r(); }; }); total += a.duration || 0; }
    return {n: list.length, total, bad};
  }, clipSrc.map(s => JSON.parse(s)));
  check('41 clips, all decode', clips.n === 41 && clips.bad === 0, JSON.stringify(clips));
  console.log('INFO  narration total ' + clips.total.toFixed(1) + ' s = ' + (clips.total / 60).toFixed(2) + ' min');
  await page.click('#next');                           // slide 1 line 2: input ramps 15 → 25 MW
  await page.click('#play');
  await page.waitForFunction(() => { const v = parseFloat(document.querySelector('#ctl .row .val').textContent); return v > 16 && v < 24.5; }, null, {timeout: 15000}).then(() => check('playing slide 1 line 2 ramps the input power with the clip (voice on)', true), () => check('line 2 ramp', false));
  const barMid = await page.evaluate(() => parseFloat(document.getElementById('bar').style.width));
  check('progress bar advances with the clip', barMid > 0 && barMid < 100, String(barMid));
  await setRange(page, '#ctl input', 12);
  check('using a Lecture control pauses the narration', (await page.textContent('#play')).includes('Play'));
  await page.click('#next'); await page.click('#next'); await page.click('#prev');   // line 4: past P_max
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('fig').textContent.includes('δ running away'), null, {timeout: 15000}).then(() => check('playing slide 1 line 4: δ runs away on cue', true), () => check('line 4 run-away', false));
  await page.waitForFunction(() => document.getElementById('fig').textContent.includes('breaker OPEN'), null, {timeout: 25000}).then(() => check('playing slide 1 line 4: pole slip and breaker trip', true), () => check('line 4 trip', false));
  await page.click('#play');
  await page.click('#voice');
  await page.evaluate(() => { for (let i = 0; i < 6; i++) document.getElementById('slNext').click(); });
  await page.click('#next'); await page.click('#next');                                // slide 7, last line (12 words ≈ 5 s)
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('play').textContent.includes('Play'), null, {timeout: 20000}).then(() => check('voice off: the last line runs on the timer and stops at the end of the slide', true), () => check('voice off: timer mode ends', false));
  await page.click('#voice');
  await page.click('nav.tabs button[data-page=lab]');
  await page.click('#labListen');
  await page.waitForTimeout(600);
  check('Lab Listen plays: button shows Stop, caption shows line 1 of 3', (await page.textContent('#labListen')).includes('Stop') && (await page.textContent('#labNo')) === '1/3' && (await page.textContent('#labCap')).startsWith('This is G3'));
  await setRange(page, '#pmS', 22);
  check('a Lab control does not stop the Lab narration', (await page.textContent('#labListen')).includes('Stop'));
  await page.click('nav.tabs button[data-page=exp]');
  check('changing tab stops the narration', (await page.textContent('#labListen')).includes('Listen'));
  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
