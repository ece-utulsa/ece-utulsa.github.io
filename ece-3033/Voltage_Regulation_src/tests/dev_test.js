// Developer tests for Voltage Regulation v2.0.0 (not acceptance). Run: node tests/dev_test.js
// Needs Playwright with Chromium. Drives the built page through its own controls; the shipped file has no test hooks.
'use strict';
const path = require('path');
const fs = require('fs');
const {chromium} = require('playwright');

const FILE = path.resolve(__dirname, '..', '..', 'Voltage_Regulation_v2.0.0.html');
const SHOTS = process.env.VR_SHOTS || '';            // folder for screenshots; empty = none
const VIEWS = [[1366, 768, '1366x768'], [1093, 614, '125pct'], [1024, 768, '1024x768'], [1920, 1080, '1920x1080']];   // CSS px; 125pct = 1366×768 at 125 % zoom
const K85 = 30;                                       // slider index of power factor 0.85 (0.005 per step)
let fails = 0, passes = 0;
function check(name, ok, detail) { if (ok) passes++; else fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  ' + detail : '')); }

// Set a range input and fire its input event, as a drag would.
async function setRange(page, sel, v) { await page.evaluate(([s, val]) => { const e = document.querySelector(s); e.value = val; e.dispatchEvent(new Event('input', {bubbles: true})); }, [sel, v]); }
// Text of the value span in the control row whose label starts with the given text.
async function readout(page, label) { return page.evaluate(l => { for (const r of document.querySelectorAll('#ctl .row')) if (r.firstElementChild.textContent.startsWith(l)) return r.lastElementChild.textContent; return null; }, label); }
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

(async () => {
  const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const src = fs.readFileSync(FILE, 'utf8');

  // ── Static checks on the shipped file ──
  const code = src.replace(/"data:audio[^"]*"/g, '""');
  check('no innerHTML / outerHTML / insertAdjacentHTML / document.write / eval / new Function', !/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(code));
  check('no global test objects (window.__)', !/window\.__/.test(code));
  check('no localStorage / network API', !/localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket/.test(code));
  check('true minus only: no ASCII hyphen-minus before a digit in visible strings', !/['"`> ]-\d+(\.\d+)? ?%/.test(code));

  for (const [w, h, tag] of VIEWS) {
    const page = await browser.newPage({viewport: {width: w, height: h}});
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e));
    await page.goto('file://' + FILE);
    const first = tag === VIEWS[0][2];
    const lay = [];                                   // layout problems collected over every state
    const note = async where => { const r = await layout(page); if (r.doc > 1 || r.left > 1 || r.side > 1 || r.stage > 1 || r.bad.length) lay.push(where + ' ' + JSON.stringify(r)); };
    const shot = async name => { if (SHOTS) await page.screenshot({path: path.join(SHOTS, tag + '_' + name + '.png'), scale: 'css'}); };

    // ── Lecture: every line of every slide ──
    let lines = 0;
    const seen = {};
    for (let s = 1; s <= 8; s++) {
      const n = await page.evaluate(() => Number(document.getElementById('lineNo').textContent.split(' of ')[1]));
      for (let i = 1; i <= n; i++) {
        lines++;
        const cap = await page.textContent('#cap');
        if (!cap.trim()) lay.push('empty caption s' + s + ' l' + i);
        await note('slide ' + s + ' line ' + i);
        if (i < n) await page.click('#next');
      }
      seen[s] = await page.evaluate(() => document.querySelector('main').textContent);
      await shot('slide' + s);
      if (s === 1) { await page.click('#prev'); await page.click('#prev'); await page.click('#prev'); await shot('slide1_unity_open'); }
      if (s === 7) { await page.click('#prev'); await shot('slide7_step5'); }
      if (s < 8) await page.click('#slNext');
    }
    if (first) {
      check('lecture has 47 narration lines over 8 slides', lines === 47, String(lines));
      const has = (s, t) => check('slide ' + s + ' shows ' + t, seen[s].includes(t));
      has(5, '4,001.4∠26.8°'); has(5, '+66.6'); has(5, '3,570.4'); has(5, '1,806.6'); has(5, '347.0∠−31.8°'); has(5, '41.6∠−31.8°'); has(5, '2,151.2∠58.2°');
      has(6, '3,255.4∠41.4°'); has(6, '+35.5'); has(6, '2,443.4'); has(6, '2,151.2∠90.0°');
      has(7, '2,263.7∠54.8°'); has(7, '−5.7'); has(7, '1,304.0'); has(7, '1,850.4'); has(7, '2,151.2∠121.8°'); has(7, '2.1 / 4.7'); has(7, '2.5 / 3.8'); has(7, '2.1 / 2.6');
      has(8, '0.885 lead'); has(4, '0.894'); has(4, '0.448'); has(4, '26.6°'); has(4, '4,803.6'); has(4, '0.970 lead'); has(3, '0.885 lead'); has(3, '2,151.6');
    }

    // ── Slide controls ──
    await page.evaluate(() => { for (let i = 0; i < 8; i++) document.getElementById('slPrev').click(); });
    for (const [k, fld, vr] of [['0.85 lag', '1.67 ×', '+66.6'], ['unity', '1.36 ×', '+35.5'], ['0.85 lead', '0.94 ×', '−5.7']]) {
      await page.click('#ctl .seg button:has-text("' + k + '")');
      const f = await readout(page, 'Field');
      await page.click('#ctl button.primary');
      const fig = await page.textContent('#fig');
      if (first) check('slide 1 ' + k + ': field ' + fld + ', VR ' + vr + ' % after opening the breaker', f === fld && fig.includes('VR = ' + vr + ' %'), f);
      await note('slide 1 ' + k + ' open');
    }
    await page.click('#slNext');                       // slide 2: every step at each power factor
    for (const k of ['0.85 lag', 'unity', '0.85 lead']) {
      await page.click('#ctl .seg button:has-text("' + k + '")');
      for (let i = 0; i < 5; i++) await page.click('text=− step');
      for (let i = 0; i <= 5; i++) { await note('slide 2 ' + k + ' step ' + i); if (i < 5) await page.click('text=+ step'); }
    }
    await page.click('#slNext');                       // slide 3: whole slider range
    for (let k = -100; k <= 100; k += 1) { await setRange(page, '#ctl input', k); await note('slide 3 k=' + k); }
    await setRange(page, '#ctl input', K85);
    if (first) check('slide 3 slider at 0.85 lead reads VR −5.7 %', (await readout(page, 'VR')) === '−5.7 %');
    await page.click('#slNext');                       // slide 4: load slider
    for (let v = 0.1; v < 1.001; v += 0.05) { await setRange(page, '#ctl input', v.toFixed(2)); await note('slide 4 sf=' + v.toFixed(2)); }
    await setRange(page, '#ctl input', 0.5);
    if (first) check('slide 4 half load: VR = 0 at 0.970 lead', (await readout(page, 'VR = 0 at')) === '0.970 lead');
    for (let s = 5; s <= 7; s++) { await page.click('#slNext'); for (let i = 0; i < 5; i++) { await page.click('text=− step'); await note('slide ' + s + ' step back ' + i); } }

    // ── Lab ──
    await page.click('nav.tabs button[data-page=lab]');
    await shot('lab');
    const lab3 = async () => { const out = []; for (const k of [-K85, 0, K85]) { await setRange(page, '#ctl input', k); out.push(await readout(page, 'VR')); } return out.join(' / ') + ' ; ' + await readout(page, 'VR = 0 at'); };
    const pick = async t => page.click('#ctl .seg button:has-text("' + t + '")');
    const sRange = '#ctl input[aria-label="Load apparent power"]';
    if (first) {
      check('Lab rated: +66.6 / +35.5 / −5.7 %, VR = 0 at 0.885 lead', (await lab3()) === '+66.6 % / +35.5 % / −5.7 % ; 0.885 lead', await lab3());
      await setRange(page, sRange, 0.5);
      check('E2 half load: +29.9 / +10.4 / −13.8 %, VR = 0 at 0.970 lead', (await lab3()) === '+29.9 % / +10.4 % / −13.8 % ; 0.970 lead', await lab3());
      await setRange(page, sRange, 1); await pick('3.1 Ω');
      check('E3 X_S = 3.1 Ω: +30.5 / +11.2 / −12.9 %, VR = 0 at 0.965 lead', (await lab3()) === '+30.5 % / +11.2 % / −12.9 % ; 0.965 lead', await lab3());
      await pick('9.3 Ω');
      check('E3 X_S = 9.3 Ω: +106.2 / +68.5 / +19.1 %, VR = 0 at 0.732 lead', (await lab3()) === '+106.2 % / +68.5 % / +19.1 % ; 0.732 lead', await lab3());
      const warnAt = async k => { await setRange(page, '#ctl input', k); return [await page.textContent('#ctl .row .val'), await page.isVisible('#ctl .warn')]; };
      const a = await warnAt(68), b = await warnAt(69);
      check('E5 X_S = 9.3 Ω: warning absent at 0.660 lead, present at 0.655 lead', a[0] === '0.660 lead' && !a[1] && b[0] === '0.655 lead' && b[1], JSON.stringify([a, b]));
      await shot('lab_E5_warning');
      await pick('6.2 Ω'); await pick('ignored');
      check('E4 R_A ignored: +65.7 / +34.2 / −7.3 %, VR = 0 at 0.894 lead', (await lab3()) === '+65.7 % / +34.2 % / −7.3 % ; 0.894 lead', await lab3());
      await pick('in'); await setRange(page, '#ctl input', -K85);
      await page.click('#ctl button.primary');
      check('Lab breaker open: terminal voltage reads |E_A| = 4,001.4 V', (await readout(page, 'Terminal')) === '4,001.4 V');
      await page.click('#ctl button.primary');
      check('Lab rated 0.85 lag: field 1.67 ×, P / P_max 2.1 / 4.7 MW', (await readout(page, 'Field')) === '1.67 ×' && (await readout(page, 'P / P')) === '2.1 / 4.7 MW');
    }
    // every Lab setting on a coarse grid: layout only
    for (const xs of ['3.1 Ω', '6.2 Ω', '9.3 Ω']) { await pick(xs); for (const sf of [0.1, 0.5, 1]) { await setRange(page, sRange, sf); for (let k = -100; k <= 100; k += 4) { await setRange(page, '#ctl input', k); await note('lab ' + xs + ' sf=' + sf + ' k=' + k); } } }
    await page.click('#ctl button.primary'); await note('lab open'); await shot('lab_0.5lead_9.3_open');
    await page.click('#ctl button.primary'); await shot('lab_0.5lead_9.3');

    // ── Experiments ──
    await page.click('nav.tabs button[data-page=exp]');
    for (let e = 1; e <= 5; e++) {
      await page.click('#left .seg button:has-text("E' + e + '")');
      await page.click('text=Set up the Lab');
      await page.click('text=Show answer');
      await note('experiment ' + e + ' answer shown');
      if (e === 3 || e === 5) await shot('exp' + e);
    }
    if (first) check('E5 set-up: X_S = 9.3 Ω at 0.850 lead, δ 75.1°', (await readout(page, '|E')) === '2,861.3 V, 75.1°');
    check(tag + ': no scrollbar, no clipped or overlapping figure text in any state', lay.length === 0, lay.length + ' state(s): ' + lay.slice(0, process.env.VR_ALL ? 9999 : 6).join(' | '));
    check(tag + ': no console or page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  // ── Model: random sweep of physics identities (uses the page's own op() and cross()) ──
  const page = await browser.newPage({viewport: {width: 1366, height: 768}});
  await page.goto('file://' + FILE);
  const sweep = await page.evaluate(() => {
    let worst = {kvl: 0, pow: 0, q: 0, cross: 0, sign: 0}, n = 0, seed = 20261124;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 20000; i++) {
      const th = -60 + 120 * rnd(), sf = 0.1 + 0.9 * rnd(), xs = 3.1 + 6.2 * rnd(), ra = rnd() < 0.5 ? 0 : 0.12 * rnd(), o = op(th, sf, xs, ra);
      const I = sf * I_RATED, c = Math.cos(th * DEG), s = Math.sin(th * DEG), d = o.d * DEG;
      // KVL: E_A − V_φ − (R_A + jX_S) I_A = 0
      worst.kvl = Math.max(worst.kvl, Math.hypot(o.er - V_PHI - (ra * I * c - xs * I * s), o.ei - (ra * I * s + xs * I * c)));
      // power balance: Re(E_A I_A*) = V_φ I cos θ + R_A I²; Im(E_A I_A*) = −V_φ I sin θ … + X_S I²
      worst.pow = Math.max(worst.pow, Math.abs(o.E * I * Math.cos(d - th * DEG) - (V_PHI * I * c + ra * I * I)) / (V_PHI * I));
      worst.q = Math.max(worst.q, Math.abs(o.E * I * Math.sin(d - th * DEG) - (-V_PHI * I * s + xs * I * I)) / (V_PHI * I));
      // sign of VR follows |E_A| against |V_φ|, and VR = 0 at cross()
      if ((o.VR > 0) !== (o.E > V_PHI)) worst.sign++;
      const x = cross(sf, xs, ra);
      worst.cross = Math.max(worst.cross, Math.abs(op(x, sf, xs, ra).VR));
      n++;
    }
    // R_A = 0: sin φ = X_S I_A / (2 V_φ) is exactly the crossover
    const x0 = cross(1, X_S, 0);
    return {n, worst, formula: Math.abs(Math.sin(x0 * DEG) - X_S * I_RATED / (2 * V_PHI))};
  });
  check('random sweep, ' + sweep.n + ' operating points: KVL residual < 1e-9 V', sweep.worst.kvl < 1e-9, String(sweep.worst.kvl));
  check('random sweep: real and reactive power balance < 1e-12 pu', sweep.worst.pow < 1e-12 && sweep.worst.q < 1e-12, sweep.worst.pow + ' ' + sweep.worst.q);
  check('random sweep: sign of VR matches |E_A| against |V_φ|; VR at cross() < 1e-9 %', sweep.worst.sign === 0 && sweep.worst.cross < 1e-9, JSON.stringify(sweep.worst));
  check('R_A = 0 crossover equals sin φ = X_S I_A / (2 V_φ) to 1e-12', sweep.formula < 1e-12, String(sweep.formula));

  // ── Narration: every clip decodes; total duration; play, timed events, pause, voice off ──
  const clips = await page.evaluate(async () => {
    const all = [].concat(...CLIPS.slides, CLIPS.lab, CLIPS.exp), texts = [].concat(...SAY.slides, SAY.lab, SAY.exp);
    let total = 0, bad = 0;
    for (const c of all) { const a = new Audio(c); await new Promise(r => { a.onloadedmetadata = r; a.onerror = () => { bad++; r(); }; }); total += a.duration || 0; }
    return {n: all.length, texts: texts.length, total, bad};
  });
  check('55 clips, 55 caption lines, all decode', clips.n === 55 && clips.texts === 55 && clips.bad === 0, JSON.stringify(clips));
  console.log('INFO  narration total ' + clips.total.toFixed(1) + ' s = ' + (clips.total / 60).toFixed(2) + ' min');
  await page.click('#next');                           // slide 1 line 2: breaker opens at 12 % of the clip
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('fig').textContent.includes('breaker OPEN'), null, {timeout: 15000}).then(() => check('playing line 2 opens the breaker on cue (voice on)', true), () => check('playing line 2 opens the breaker on cue (voice on)', false));
  const barMid = await page.evaluate(() => parseFloat(document.getElementById('bar').style.width));
  check('progress bar advances with the clip', barMid > 0 && barMid < 100, String(barMid));
  await page.click('#ctl .seg button:has-text("unity")');
  check('using a control pauses the narration', (await page.textContent('#play')).includes('Play'));
  await page.click('#voice');
  await page.evaluate(() => { for (let i = 0; i < 7; i++) document.getElementById('slNext').click(); });
  await page.click('#next'); await page.click('#next'); await page.click('#next');      // slide 8, last line (26 words ≈ 10 s)
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('play').textContent.includes('Play'), null, {timeout: 20000}).then(() => check('voice off: the last line runs on the timer and stops at the end of the slide', true), () => check('voice off: timer mode ends', false));
  await page.click('#voice');
  await page.click('nav.tabs button[data-page=lab]');
  await page.click('text=Listen: how to use the Lab');
  check('Lab Listen button plays and shows Stop', (await page.textContent('#left button.wide')).includes('Stop'));
  await page.click('nav.tabs button[data-page=lec]');
  check('changing tab stops the narration', (await page.textContent('#play')).includes('Play'));
  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
