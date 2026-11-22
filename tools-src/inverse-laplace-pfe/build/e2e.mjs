// End-to-end on the SHIP build, real time: node e2e.mjs  -> e2e_result.json
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const sum = JSON.parse(fs.readFileSync('out/summary.json'));
const b = await chromium.launch();
const run = async (pg) => {
  const kind = ['Simple', 'Repeated', 'Complex'].find((k) => pg.file.includes(k));
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true }); const p = await ctx.newPage();
  const errs = [], reqs = [], fails = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('request', (r) => { const u = r.url(); if (!(u.startsWith('file://') && decodeURI(u).endsWith(pg.file)) && !u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u); });
  await p.addInitScript(() => {
    const log = []; const t0 = () => performance.now() / 1000; let speak = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { log.push({ ev: 'play', clip: this.dataset.clip, t: t0(), from: this.currentTime }); return play.apply(this, arguments); };
    document.addEventListener('ended', (e) => { log.push({ ev: 'ended', clip: e.target.dataset.clip, t: t0(), dur: e.target.duration }); }, true);
    document.addEventListener('securitypolicyviolation', (e) => { log.push({ ev: 'csp', what: e.violatedDirective + ' ' + e.blockedURI }); });
    if (window.speechSynthesis) window.speechSynthesis.speak = () => { speak++; };
    Object.defineProperty(window, 'e2eLog', { value: () => ({ log, speak }), enumerable: false });
  });
  const t0 = Date.now();
  await p.goto('file://' + path.resolve('out', pg.file)); await p.waitForSelector('[data-card="opening"]');
  const firstInteractive = (Date.now() - t0) / 1000;
  await p.waitForTimeout(1200);
  // identity: header comment, meta, title, badge
  const html = fs.readFileSync(path.resolve('out', pg.file), 'utf8');
  const id = { comment: /Version: (v[\d.]+)/.exec(html)[1], meta: await p.getAttribute('meta[name="version"]', 'content'), title: await p.title(),
    file: pg.file, cardStamp: await p.evaluate(() => document.querySelector('[data-card="opening"]').textContent.match(/v\d+\.\d+\.\d+/)[0]) };
  // opening card
  const card = await p.evaluate(() => document.querySelector('[data-card="opening"]').innerText);
  const before = await p.evaluate(() => window.e2eLog().log.length);
  if (before) fails.push('audio before Start');
  const globals = await p.evaluate(() => Object.getOwnPropertyNames(window).filter((k) => /^__|^CX|PFE|CX_GATE|^SFX$|^VO$/.test(k)));
  if (globals.length) fails.push('test/global objects: ' + globals.join(','));
  const runTime = await p.textContent('[data-running-time]');
  await p.click('button:has-text("Start")'); const tStart = await p.evaluate(() => performance.now() / 1000);
  await p.waitForTimeout(3000);
  id.badge = await p.textContent('[data-version-badge]');
  const headText = await p.evaluate(() => document.querySelector('[data-gate="header"]').innerText);
  const bars = await p.evaluate(() => document.querySelectorAll('[role="slider"]').length);
  const durLabel = await p.evaluate(() => +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'));
  await p.waitForSelector('[data-gate="replay"]', { timeout: (durLabel + 30) * 1000 });
  const tEnd = await p.evaluate(() => performance.now() / 1000);
  const { log, speak } = await p.evaluate(() => window.e2eLog());
  const plays = log.filter((l) => l.ev === 'play'), ended = log.filter((l) => l.ev === 'ended');
  const order = plays.map((l) => l.clip); const n = +/line(\d+)/.exec(order[order.length - 1] || 'line0')[1];
  const prefix = { Simple: 'pfe1', Repeated: 'pfe2', Complex: 'pfe3' }[kind];
  const want = Array.from({ length: n }, (_, i) => prefix + '_line' + (i + 1) + '.mp3');
  if (JSON.stringify(order) !== JSON.stringify(want)) fails.push('play order ' + order.join(','));
  if (JSON.stringify(ended.map((l) => l.clip)) !== JSON.stringify(want)) fails.push('ended order ' + ended.map((l) => l.clip).join(','));
  if (speak) fails.push('speechSynthesis.speak called ' + speak);
  if (log.some((l) => l.ev === 'csp')) fails.push('CSP violation ' + JSON.stringify(log.filter((l) => l.ev === 'csp')));
  // timeline: start of each clip (s after Start) and its duration; schedule = LEAD 1.0 + sum(dur + GAP 1.2)
  let exp = 1.0; const timeline = plays.map((pl, i) => { const d = ended[i] ? ended[i].dur : NaN; const row = { clip: pl.clip, dur: +d.toFixed(3), start: +(pl.t - tStart).toFixed(2), sched: +exp.toFixed(2) }; exp += d + 1.2; return row; });
  const total = exp - 1.2 + 3.0; const drift = Math.max(...timeline.map((r) => Math.abs(r.start - r.sched)));
  if (drift > 0.5) fails.push('clip start drift ' + drift.toFixed(2) + ' s');
  // Your turn at the end
  if (!(await p.$('[data-card="yourturn"]'))) fails.push('no Your-turn card at the end');
  await p.focus('button:has-text("Show solution")'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  const answer = (await p.$('[data-yt-answer]')) ? await p.textContent('[data-yt-answer]') : null;
  if (!answer) fails.push('Space on Show solution did not show it');
  const replayStill = !!(await p.$('[data-gate="replay"]')); if (!replayStill) fails.push('Space on a button also toggled playback');
  // band controls
  await p.click('[aria-label="previous step"]'); await p.waitForTimeout(100);
  const stepTxt = await p.textContent('[data-step]'); if (stepTxt !== 'step 2 of 3') fails.push('previous step -> ' + stepTxt);
  if (await p.$('[data-card="yourturn"]')) fails.push('card stays over the work zone after a band control');
  await p.click('[aria-label="next step"]'); await p.waitForTimeout(100);
  if ((await p.textContent('[data-step]')) !== 'step 3 of 3') fails.push('next step');
  let extra = {};
  if (kind !== 'Complex') {
    await p.click('button:has-text("A · residue")'); await p.waitForTimeout(100);
    const a = await p.evaluate(() => document.querySelector('[data-gate="work"]').innerText.split('\n')[1]);
    await p.click('button:has-text("B · algebra")'); await p.waitForTimeout(100);
    const c = await p.evaluate(() => document.querySelector('[data-gate="work"]').innerText.split('\n')[1]);
    if (!/RESIDUE/.test(a) || !/ALGEBRA/.test(c)) fails.push('method toggle ' + a + ' / ' + c);
  } else {
    // Explore sliders: random valid (b, c); check the partial-fraction and split identities from the DISPLAYED numbers
    const setR = async (label, v) => p.evaluate(([label, v]) => { const el = document.querySelector('input[aria-label="quadratic coefficient ' + label + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]);
    const val = (s) => parseFloat(s.replace('−', '-')); let worst = 0, nC = 0, nR = 0, odd = [];
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let k = 0; k < 60; k++) {
      const bq = 0.5 + 0.5 * Math.floor(rnd() * 18), cq = 1 + 0.5 * Math.floor(rnd() * 59);
      await setR('b', bq); await setR('c', cq); await p.waitForTimeout(40);
      const tape = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('[data-tape]')).map((e) => [e.dataset.tape, e.textContent])));
      const quad = await p.textContent('[data-quad]'); const A = val(tape.A), B = val(tape.B), C = val(tape.C);
      const over = await p.evaluate(() => Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate));
      if (over.length) odd.push('b=' + bq + ' c=' + cq + ' overflow ' + over.join(','));
      if (!isFinite(A)) { odd.push('b=' + bq + ' c=' + cq + ' A="' + tape.A + '"'); continue; }
      for (const s of [0.3, 1.7, -0.4]) { const lhs = 60 / ((s + 1) * (s * s + bq * s + cq)), rhs = A / (s + 1) + (B * s + C) / (s * s + bq * s + cq); worst = Math.max(worst, Math.abs(lhs - rhs) / Math.max(1, Math.abs(lhs))); }
      if (bq * bq < 4 * cq) { nC++; const al = val(tape['α']), be = val(tape['β']), A1 = val(tape['A₁']), B1 = val(tape['B₁']);
        worst = Math.max(worst, Math.abs(al - bq / 2), Math.abs(be - Math.sqrt(cq - bq * bq / 4)), Math.abs(A1 - B) , Math.abs((A1 * al + B1 * be) - C) / Math.max(1, Math.abs(C)), Math.abs(A + A1) /* f(0) = 0 */);
      } else { nR++; if (tape['α'] !== '—') odd.push('b=' + bq + ' c=' + cq + ' shows alpha for real roots'); }
    }
    extra = { sweep: { points: 60, complex: nC, real: nR, worstIdentityError: +worst.toExponential(2), odd } };
    if (worst > 5e-3) fails.push('identity error ' + worst);
  }
  const clipHash = await p.evaluate(() => JSON.parse(document.getElementById('clip-data').textContent));
  const hashes = Object.fromEntries(Object.entries(clipHash).map(([k, v]) => [k, crypto.createHash('sha256').update(Buffer.from(v.split(',')[1], 'base64')).digest('hex').slice(0, 12)]));
  await ctx.close();
  return { page: kind, file: pg.file, firstInteractive, id, runTime, headText, sliders: bars, card, consoleErrors: errs, requests: reqs, fails, timeline, totalFromClips: +total.toFixed(2), wallClock: +(tEnd - tStart).toFixed(2), maxStartDrift: +drift.toFixed(3), answer, hashes, ...extra };
};
const res = await Promise.all(sum.map(run)); await b.close();
fs.writeFileSync('e2e_result.json', JSON.stringify(res, null, 1));
for (const r of res) console.log(r.page, '| fails:', r.fails.length ? r.fails.map((f) => f.slice(0, 200)) : 'none', '| console:', r.consoleErrors.length, r.consoleErrors.slice(0, 3), '| requests:', r.requests.length, '| clips played:', r.timeline.length, '| total', r.totalFromClips, 'wall', r.wallClock, 'drift', r.maxStartDrift, '|', r.runTime, '| first interactive', r.firstInteractive, r.sweep ? JSON.stringify(r.sweep) : '');
