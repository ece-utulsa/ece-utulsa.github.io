// Laplace lecture pages: developer tests. node lecttest.mjs <l9|l10>  (test build for sweeps, ship build for the real-time run)
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const PG = process.argv[2]; const REPO = '/home/user/ece-utulsa.github.io/ece-2003/';
const CFG = {
  l9: { file: 'Laplace_L9_Mesh_Analysis_s-Domain_v1.0.0.html', n: 17, lines: 64,
    slots: { tVL: ['4e⁻²ᵗu(t) V', '4/(s+2)'], tVR: ['2e⁻ᵗu(t) V', '2/(s+1)'], tC: ['1/3 F', '3/s'], tL: ['4 H', '4s'], tR: ['10 Ω', '10'], D: ['?', '(40s² + 12s + 30)/s'], I1: ['?', '16s³ + 76s² + 80s(s+1)(s+2)(40s² + 12s + 30)'], I2: ['?', '60s² + 86s + 12(s+1)(s+2)(40s² + 12s + 30)'],
      c11: ['?', '0.841'], c12: ['?', '0.198'], c13: ['?', '−0.345'], c14: ['?', '−0.096'], c21: ['?', '0.723'], c22: ['?', '0.473'], c23: ['?', '−0.241'], c24: ['?', '−0.482'] },
    key: ['matrix [1+s, −s; −s, 1+s][I₁; I₂] = [1/s; 0]', 'Δ (1+s)² − s² = 2s + 1', 'I₂(s) Δ₂/Δ = 1/(2s + 1)', 'also I₁ = (s+1)/(s(2s+1)), so i₁ = 1 − 0.5e−t/2 A', 'check i₂(0⁺) = 0.5 A ✓ (the inductor is open at t = 0⁺)'],
    answer: 'i₂(t) = 0.5e−t/2 u(t) A', ytRatio: Math.exp(-5), ytBase: 0, vsrc: ['plus-top', 'minus-top'],
    shown: [['v1a', /i₁\(0⁺\) = 0\.4 A/], ['v2a', /i₂\(0⁺\) = 0/]] },
  l10: { file: 'Laplace_L10_Node_Analysis_s-Domain_v1.0.0.html', n: 13, lines: 51,
    slots: { tI: ['2u(−t) + δ(t) A|2 A (t < 0)', '1 A'], tC: ['1 F|1 F: open', '1/s'], tL: ['1 H|1 H: short', 's'], tCs: [null, '1 A'], tLs: [null, '1/s'], icL: ['?', '1 A'], icC: ['?', '1 V'], D: ['?', '(s² + 2s + 2)/s'], VC: ['?', '2s + 1s² + 2s + 2'], vc: ['?', 'e⁻ᵗ(2 cos t − sin t) V'] },
    key: ['node V_C (s + 2)V_C − V_L = 1', 'node V_L −V_C + ((s+1)/s)V_L = 0', 'V_C(s) (s + 1)/(s² + 2s + 2) = (s+1)/((s+1)² + 1)', 'check v_C(0⁺) = 1 V ✓ (1 C delivered to 1 F)'],
    answer: 'v_C(t) = e⁻ᵗ cos t u(t) V', ytRatio: Math.exp(-6) * Math.cos(6), ytBase: 0, isrc: ['up', 'up', 'down'],
    shown: [['ivt', /v_C\(0⁺\) = 2 V/], ['icC', /v_C =1 V|v_C = ?1 V/]] },
}[PG];
const FILE = CFG.file;
const src = fs.readFileSync('check.mjs', 'utf8'); const a0 = src.indexOf('const audit = () => {'); const a1 = src.indexOf('\nlet bad = 0;');
const audit = new Function('return (' + src.slice(a0 + 'const audit = '.length, a1).trim().replace(/;$/, '') + ')')();
const b = await chromium.launch(); const out = { fails: [] }; const fail = (m) => out.fails.push(m);
for (const v of [{ n: '100%', w: 1366, h: 768, d: 1 }, { n: '125%', w: 1093, h: 614, d: 1.25 }]) {
  const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.d }); const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve('out_test', FILE)); await p.waitForTimeout(900);
  const issues = new Set(); const add = (w, a) => { for (const k of ['clip', 'font', 'contrast', 'overlap']) for (const x of a[k]) issues.add(w + ' [' + k + '] ' + x); };
  add('card', await p.evaluate(audit));
  const beats = await p.evaluate(() => window.__PFE_TEST.beats()); const ix = Object.fromEntries(beats.map((x, i) => [x.id, i]));
  for (let i = 0; i < beats.length; i++) {
    await p.evaluate((i) => { const T = window.__PFE_TEST, bs = T.beats(); const t1 = i + 1 < bs.length ? bs[i + 1].start : T.sched().total - 3; T.setTime(bs[i].start + 0.8 * (t1 - bs[i].start)); }, i); await p.waitForTimeout(110); add(beats[i].id, await p.evaluate(audit));
    const s = await p.evaluate(() => ({ slots: Object.fromEntries(Array.from(document.querySelectorAll('[data-slot]')).map((e) => [e.dataset.slot, (e.querySelector('[data-tape]') || e).textContent])), yt: !!document.querySelector('[data-card="yourturn"]'),
      board: (document.querySelector('[data-gate="board"]') || { innerText: '' }).innerText.replace(/\s+/g, ' '), links: document.querySelectorAll('[data-link]').length, plot: !!document.querySelector('[data-curve]'),
      vsrc: Array.from(document.querySelectorAll('[data-gate="circuit"] [data-vsrc]')).map((e) => e.dataset.vsrc), isrc: Array.from(document.querySelectorAll('[data-gate="circuit"] [data-isrc]')).map((e) => e.dataset.isrc), marks: Array.from(document.querySelectorAll('[data-mark]')).map((e) => e.dataset.mark).join(',') }));
    const tag = v.n + ' ' + beats[i].id + ': ';
    if (!s.yt) for (const [k, [was, now]] of Object.entries(CFG.slots)) {
      const got = i >= ix[({ D: 'dB', I1: 'i1C', I2: 'i2C' })[k] || k];
      if (!(k in s.slots)) { if (got && !(PG === 'l9' && (/^c|^D$|^I/.test(k)))) fail(tag + 'slot ' + k + ' missing'); continue; }
      if (got ? s.slots[k] !== now : (was == null || !was.split('|').includes(s.slots[k]))) fail(tag + 'slot ' + k + ' reads ' + s.slots[k]);
    }
    for (const [id, re] of CFG.shown) if ((i >= ix[id]) !== re.test(s.board) && !s.yt && !(PG === 'l9' && i < ix.t1 && i >= ix[id])) fail(tag + 'board ' + re + ' is ' + re.test(s.board));
    if (s.links && i < ix.yt) fail(tag + 'links shown early');
    if (!s.yt && CFG.vsrc && JSON.stringify(s.vsrc) !== JSON.stringify(CFG.vsrc)) fail(tag + 'source polarities ' + s.vsrc);
    if (!s.yt && CFG.isrc) { const want = ['up'].concat(i >= ix.tCs ? ['up'] : [], i >= ix.tLs ? ['down'] : []); if (JSON.stringify(s.isrc) !== JSON.stringify(want)) fail(tag + 'source arrows ' + s.isrc); }
    if (PG === 'l10' && !s.yt) { const want = [i >= ix.ivt ? 'after' : '', i >= ix.bef ? 'before' : ''].filter(Boolean).join(','); if (s.marks !== want) fail(tag + 'plot marks ' + s.marks); if (s.plot !== (i >= ix.vc)) fail(tag + 'plot curve ' + s.plot); }
    if (PG === 'l9' && !s.yt && s.plot !== (i >= ix.c14)) fail(tag + 'plot curve ' + s.plot);
  }
  // Your turn (last clip)
  await p.evaluate(() => { const T = window.__PFE_TEST, s = T.sched(), n = s.starts.length - 1; T.setTime(s.starts[n] + 0.9 * s.durs[n]); }); await p.waitForTimeout(120);
  if (!(await p.$('[data-card="yourturn"]'))) fail(v.n + ': no Your-turn card'); if (await p.$('[data-solution]')) fail(v.n + ': solution shown early');
  const pre = await p.evaluate(() => document.querySelector('[data-card="yourturn"]').innerText); if (/2s \+ 1\)|cos t|0\.5e/.test(pre)) fail(v.n + ': Your-turn answer visible before Show solution');
  add('yt', await p.evaluate(audit)); out.problem = await p.evaluate(() => document.querySelector('[data-yt-problem]').textContent);
  await p.click('text=Show solution'); await p.waitForTimeout(120); add('yt solution', await p.evaluate(audit));
  const key = await p.evaluate(() => ({ steps: Array.from(document.querySelectorAll('[data-yt-step]')).map((e) => e.innerText.replace(/\s+/g, ' ')), ans: document.querySelector('[data-yt-answer]').textContent, src: document.querySelector('[data-gate="plot"]').dataset.plotSource,
    d: document.querySelector('[data-curve]').getAttribute('d') })); out.key = key;
  if (key.ans !== CFG.answer || key.src !== 'yourturn') fail(v.n + ': Your-turn answer ' + key.ans + ' ' + key.src);
  if (JSON.stringify(key.steps) !== JSON.stringify(CFG.key)) fail(v.n + ': Your-turn steps ' + JSON.stringify(key.steps));
  { const pts = key.d.trim().split(/[ML]/).filter(Boolean).map((q) => q.trim().split(' ').map(Number)); const zero = await p.evaluate(() => { const l = Array.from(document.querySelectorAll('[data-plot] line')).find((e) => e.getAttribute('stroke-width') === '1' && e.getAttribute('y1') === e.getAttribute('y2')); return +l.getAttribute('y1'); });
    const ratio = (zero - pts[pts.length - 1][1]) / (zero - pts[0][1]); if (Math.abs(ratio - CFG.ytRatio) > 0.012) fail(v.n + ': Your-turn curve end/start ' + ratio + ' want ' + CFG.ytRatio); out.ytRatio = ratio; }
  const links = await p.evaluate(() => Array.from(document.querySelectorAll('[data-link] a')).map((a) => a.getAttribute('href'))); out.links = links;
  for (const l of links) if (!fs.existsSync(REPO + l) && !fs.existsSync(path.resolve('out', l))) fail('link target missing: ' + l);
  await p.click('text=back to the worked example'); await p.waitForTimeout(80);
  await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200); add('end', await p.evaluate(audit));
  const gate = await p.evaluate(() => window.__PFE_TEST.gate()); if (!gate.pass) fail(v.n + ': OverlapGate ' + gate.fails.join('; '));
  out[v.n] = { issues: [...issues].slice(0, 30), nIssues: issues.size, consoleErrors: errs.length, gate: gate.pass + ' (' + gate.beats + ' beats)' };
  if (issues.size || errs.length) fail(v.n + ': ' + issues.size + ' layout issues, ' + errs.length + ' console ' + errs.slice(0, 2));
  await ctx.close();
}
// ---- real-time play of the ship build, offline
if (!process.env.SKIP_RT) { const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true }); const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { const u = r.url(); if (!(u.startsWith('file://') && decodeURI(u).endsWith(FILE)) && !u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u); });
  await p.addInitScript(() => { const log = []; let speak = 0; const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { log.push({ ev: 'play', clip: this.dataset.clip, t: performance.now() / 1000 }); return play.apply(this, arguments); };
    document.addEventListener('ended', (e) => log.push({ ev: 'ended', clip: e.target.dataset.clip, dur: e.target.duration }), true); document.addEventListener('securitypolicyviolation', (e) => log.push({ ev: 'csp', what: e.violatedDirective }));
    if (window.speechSynthesis) window.speechSynthesis.speak = () => { speak++; }; Object.defineProperty(window, 'e2eLog', { value: () => ({ log, speak }) }); });
  await p.goto('file://' + path.resolve('out', FILE)); await p.waitForSelector('[data-card="opening"]'); await p.waitForTimeout(1000);
  const html = fs.readFileSync(path.resolve('out', FILE), 'utf8');
  out.id = { file: FILE, bytes: html.length, comment: /Version: (v[\d.]+)/.exec(html)[1], meta: await p.getAttribute('meta[name="version"]', 'content'), title: await p.title(), card: await p.evaluate(() => document.querySelector('[data-card="opening"]').innerText.replace(/\n+/g, ' | ')) };
  if ((await p.evaluate(() => window.e2eLog().log.length))) fail('audio before Start');
  const globals = await p.evaluate(() => Object.getOwnPropertyNames(window).filter((k) => /^__|^CX|PFE|CX_GATE|^SFX$|^VO$/.test(k))); if (globals.length) fail('globals ' + globals);
  out.runTime = await p.textContent('[data-running-time]');
  await p.click('button:has-text("Start")'); const t0 = await p.evaluate(() => performance.now() / 1000); await p.waitForTimeout(2500); out.id.badge = await p.textContent('[data-version-badge]');
  const dur = await p.evaluate(() => +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'));
  await p.waitForSelector('[data-gate="replay"]', { timeout: (dur + 30) * 1000 }); const t1 = await p.evaluate(() => performance.now() / 1000);
  const { log, speak } = await p.evaluate(() => window.e2eLog()); const plays = log.filter((l) => l.ev === 'play'), ended = log.filter((l) => l.ev === 'ended');
  const want = Array.from({ length: CFG.n }, (_, i) => PG + '_line' + (i + 1) + '.mp3');
  if (JSON.stringify(plays.map((l) => l.clip)) !== JSON.stringify(want)) fail('play order ' + plays.map((l) => l.clip)); if (JSON.stringify(ended.map((l) => l.clip)) !== JSON.stringify(want)) fail('ended order');
  if (speak) fail('device speech'); if (log.some((l) => l.ev === 'csp')) fail('CSP violation');
  let exp = 1.0; out.timeline = plays.map((pl, i) => { const d = ended[i].dur; const row = { clip: pl.clip, dur: +d.toFixed(3), start: +(pl.t - t0).toFixed(2), sched: +exp.toFixed(2) }; exp += d + 1.5; return row; });
  out.total = +(exp - 1.5 + 3).toFixed(2); out.wall = +(t1 - t0).toFixed(2); out.drift = Math.max(...out.timeline.map((r) => Math.abs(r.start - r.sched)));
  if (out.drift > 0.5) fail('drift ' + out.drift);
  await p.focus('button:has-text("Show solution")'); await p.keyboard.press('Space'); await p.waitForTimeout(120); if (!(await p.$('[data-solution]'))) fail('Space on Show solution');
  await p.click('[aria-label="previous line"]'); await p.waitForTimeout(80); const st = await p.textContent('[data-step]'); if (st !== 'line ' + (CFG.lines - 1) + ' of ' + CFG.lines) fail('previous line -> ' + st);
  if (await p.$('[data-card="yourturn"]')) fail('card stays after a band control');
  out.shipConsole = errs.length; out.shipRequests = reqs.length; if (errs.length || reqs.length) fail('ship: console ' + errs.slice(0, 2) + ' requests ' + reqs.slice(0, 2));
  await ctx.close(); }
await b.close(); fs.writeFileSync(PG + (process.env.SKIP_RT ? '_resultA.json' : '_result.json'), JSON.stringify(out, null, 1));
console.log(PG, 'fails:', out.fails.length ? out.fails.slice(0, 14) : 'none', out.fails.length); console.log(JSON.stringify({ '100%': out['100%'], '125%': out['125%'] }).slice(0, 1200)); console.log('id', JSON.stringify(out.id || '').slice(0, 700)); console.log('run', out.runTime, 'total', out.total, 'wall', out.wall, 'drift', out.drift, 'console', out.shipConsole, 'requests', out.shipRequests);
