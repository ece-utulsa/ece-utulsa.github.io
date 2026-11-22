// Factoring the Denominator: developer tests. node fdtest.mjs  (ship build for the real-time run, test build for sweeps)
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const FILE = 'Factoring_the_Denominator_v1.1.0.html'; const REPO = '/home/user/ece-utulsa.github.io/ece-2003/';
const src = fs.readFileSync('check.mjs', 'utf8'); const a0 = src.indexOf('const audit = () => {'); const a1 = src.indexOf('\nlet bad = 0;');
const audit = new Function('return (' + src.slice(a0 + 'const audit = '.length, a1).trim().replace(/;$/, '') + ')')();
const b = await chromium.launch(); const out = { fails: [] }; const fail = (m) => out.fails.push(m);
// ---- A. layout sweep on the test build at 100 % and 125 %
for (const v of [{ n: '100%', w: 1366, h: 768, d: 1 }, { n: '125%', w: 1093, h: 614, d: 1.25 }]) {
  const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.d }); const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve('out_test', FILE)); await p.waitForTimeout(900);
  const issues = new Set(); const add = (w, a) => { for (const k of ['clip', 'font', 'contrast', 'overlap']) for (const x of a[k]) issues.add(w + ' [' + k + '] ' + x); };
  add('card', await p.evaluate(audit));
  const beats = await p.evaluate(() => window.__PFE_TEST.beats());
  for (let i = 0; i < beats.length; i++) { await p.evaluate((i) => { const T = window.__PFE_TEST, bs = T.beats(); const t1 = i + 1 < bs.length ? bs[i + 1].start : T.sched().total - 3; T.setTime(bs[i].start + 0.8 * (t1 - bs[i].start)); }, i); await p.waitForTimeout(110); add(beats[i].id, await p.evaluate(audit)); }
  // readout hidden during the tour
  await p.evaluate(() => { const T = window.__PFE_TEST; T.setTime(T.beats()[10].start + 0.2); }); await p.waitForTimeout(100);
  if (await p.$('[data-readout]')) fail(v.n + ': live readout visible during the tour');
  // Your turn
  await p.evaluate(() => { const T = window.__PFE_TEST, s = T.sched(); T.setTime(s.starts[10] + 0.9 * s.durs[10]); }); await p.waitForTimeout(120);
  if (!(await p.$('[data-card="yourturn"]'))) fail(v.n + ': no Your-turn card'); if (await p.$('[data-solution]')) fail(v.n + ': solution shown early');
  const probs = await p.evaluate(() => Array.from(document.querySelectorAll('[data-yt]')).map((e) => e.innerText.replace(/\s+/g, ' ')));
  await p.click('text=Show solution'); await p.waitForTimeout(100); add('yt solution', await p.evaluate(audit));
  const ans = await p.evaluate(() => Array.from(document.querySelectorAll('[data-solution]')).map((e) => e.innerText.replace(/\s+/g, ' ')));
  const KEY = ['Δ = 49 − 48 = 1 > 0 → (s+3)(s+4), poles −3, −4', 'Δ = 36 − 36 = 0 → (s+3)², repeated pole −3', 'Δ = 36 − 100 = −64 < 0 → (s+3)² + 16, α = 3, β = 4'];
  if (JSON.stringify(ans) !== JSON.stringify(KEY)) fail(v.n + ': Your-turn key ' + JSON.stringify(ans));
  out.problems = probs; out.key = ans;
  await p.click('text=back to the worked examples'); await p.waitForTimeout(80);
  await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200); add('end', await p.evaluate(audit));
  if (!(await p.$('[data-readout]'))) fail(v.n + ': live readout missing after the tour');
  const gate = await p.evaluate(() => window.__PFE_TEST.gate()); if (!gate.pass) fail(v.n + ': OverlapGate ' + gate.fails.join('; '));
  // Explore sweep: presets and random (b, c); identities from the displayed text
  const setR = (label, val) => p.evaluate(([label, val]) => { const el = document.querySelector('input[aria-label="quadratic coefficient ' + label + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, val]);
  let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; const val = (s) => parseFloat(s.replace('−', '-'));
  const combos = [[5, 6], [4, 4], [4, 13], [-8, -12], [12, 40], [-8, 40], [12, -12], [0, 0], [0, 4], [-4, 4], [2, 1]]; for (let k = 0; k < 50; k++) combos.push([-8 + 0.5 * Math.floor(rnd() * 41), -12 + 0.5 * Math.floor(rnd() * 105)]);
  let worst = 0, kinds = { simple: 0, rep: 0, cplx: 0 };
  for (const [bq, cq] of combos) {
    await setR('b', bq); await setR('c', cq); await p.waitForTimeout(35);
    const r = await p.evaluate(() => ({ tape: Object.fromEntries(Array.from(document.querySelectorAll('[data-tape]')).map((e) => [e.dataset.tape, e.textContent])), focus: document.querySelector('[data-focus]').innerText, ro: (document.querySelector('[data-readout]') || {}).innerText || '',
      roots: Array.from(document.querySelectorAll('[data-root]')).map((e) => e.dataset.root), routeOn: Array.from(document.querySelectorAll('[data-route]')).filter((e) => !/transparent|rgba\(0, 0, 0, 0\)/.test(getComputedStyle(e).borderTopColor)).map((e) => e.dataset.route),
      over: Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate) }));
    const D = bq * bq - 4 * cq, kind = Math.abs(D) < 1e-6 ? 'rep' : D > 0 ? 'simple' : 'cplx'; kinds[kind]++; const tag = 'b=' + bq + ' c=' + cq + ': ';
    if (r.over.length) fail(v.n + ' ' + tag + 'overflow ' + r.over.join(','));
    if (Math.abs(val(r.tape['Δ']) - D) > 0.006) fail(tag + 'Delta shown ' + r.tape['Δ']);
    if (JSON.stringify(r.routeOn) !== JSON.stringify([kind])) fail(tag + 'route marked ' + r.routeOn);
    if (kind === 'simple') { const r1 = val(r.tape['p₁']), r2 = val(r.tape['p₂']); worst = Math.max(worst, Math.abs(r1 + r2 + bq), Math.abs(r1 * r2 - cq) / Math.max(1, Math.abs(cq))); if (r.roots.length !== 2) fail(tag + 'axis roots ' + r.roots); }
    else if (kind === 'rep') { worst = Math.max(worst, Math.abs(val(r.tape.p) + bq / 2)); if (r.roots.length !== 1) fail(tag + 'axis roots ' + r.roots); }
    else { const al = val(r.tape['α']), be = val(r.tape['β']); worst = Math.max(worst, Math.abs(al - bq / 2), Math.abs(al * al + be * be - cq) / Math.max(1, Math.abs(cq))); if (r.roots.length) fail(tag + 'roots drawn for a complex pair'); }
  }
  if (worst > 0.1) fail(v.n + ': identity error ' + worst);   // roots are displayed to 2 decimals: sum/product read back from the display can be off by about 0.005 x (|r1| + |r2|)
  // links resolve (relative to the page's folder in the repo)
  const links = await p.evaluate(() => Array.from(document.querySelectorAll('[data-route] a')).map((a) => a.getAttribute('href')));
  for (const l of links) if (!fs.existsSync(REPO + l)) fail('link target missing in repo: ' + l);
  out[v.n] = { issues: [...issues].slice(0, 30), nIssues: issues.size, consoleErrors: errs.length, gate: gate.pass + ' (' + gate.beats + ' beats)', sweep: combos.length, kinds, worstIdentity: +worst.toExponential(2), links };
  if (issues.size || errs.length) fail(v.n + ': ' + issues.size + ' layout issues, ' + errs.length + ' console');
  await ctx.close();
}
// ---- B. real-time play of the ship build, offline
{ const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true }); const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { const u = r.url(); if (!(u.startsWith('file://') && decodeURI(u).endsWith(FILE)) && !u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u); });
  await p.addInitScript(() => { const log = []; let speak = 0; const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { log.push({ ev: 'play', clip: this.dataset.clip, t: performance.now() / 1000 }); return play.apply(this, arguments); };
    document.addEventListener('ended', (e) => log.push({ ev: 'ended', clip: e.target.dataset.clip, dur: e.target.duration }), true); document.addEventListener('securitypolicyviolation', (e) => log.push({ ev: 'csp', what: e.violatedDirective }));
    if (window.speechSynthesis) window.speechSynthesis.speak = () => { speak++; }; Object.defineProperty(window, 'e2eLog', { value: () => ({ log, speak }) }); });
  await p.goto('file://' + path.resolve('out', FILE)); await p.waitForSelector('[data-card="opening"]'); await p.waitForTimeout(1000);
  const html = fs.readFileSync(path.resolve('out', FILE), 'utf8');
  out.id = { file: FILE, comment: /Version: (v[\d.]+)/.exec(html)[1], meta: await p.getAttribute('meta[name="version"]', 'content'), title: await p.title(), card: await p.evaluate(() => document.querySelector('[data-card="opening"]').innerText.replace(/\n+/g, ' | ')) };
  if ((await p.evaluate(() => window.e2eLog().log.length))) fail('audio before Start');
  const globals = await p.evaluate(() => Object.getOwnPropertyNames(window).filter((k) => /^__|^CX|PFE|CX_GATE|^SFX$|^VO$/.test(k))); if (globals.length) fail('globals ' + globals);
  out.runTime = await p.textContent('[data-running-time]');
  await p.click('button:has-text("Start")'); const t0 = await p.evaluate(() => performance.now() / 1000); await p.waitForTimeout(2500); out.id.badge = await p.textContent('[data-version-badge]');
  const dur = await p.evaluate(() => +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'));
  await p.waitForSelector('[data-gate="replay"]', { timeout: (dur + 30) * 1000 }); const t1 = await p.evaluate(() => performance.now() / 1000);
  const { log, speak } = await p.evaluate(() => window.e2eLog()); const plays = log.filter((l) => l.ev === 'play'), ended = log.filter((l) => l.ev === 'ended');
  const want = Array.from({ length: 11 }, (_, i) => 'sd2a_line' + (i + 1) + '.mp3');
  if (JSON.stringify(plays.map((l) => l.clip)) !== JSON.stringify(want)) fail('play order ' + plays.map((l) => l.clip)); if (JSON.stringify(ended.map((l) => l.clip)) !== JSON.stringify(want)) fail('ended order');
  if (speak) fail('device speech'); if (log.some((l) => l.ev === 'csp')) fail('CSP violation');
  let exp = 1.0; out.timeline = plays.map((pl, i) => { const d = ended[i].dur; const row = { clip: pl.clip, dur: +d.toFixed(3), start: +(pl.t - t0).toFixed(2), sched: +exp.toFixed(2) }; exp += d + 1.5; return row; });
  out.total = +(exp - 1.5 + 3).toFixed(2); out.wall = +(t1 - t0).toFixed(2); out.drift = Math.max(...out.timeline.map((r) => Math.abs(r.start - r.sched)));
  if (out.drift > 0.5) fail('drift ' + out.drift);
  await p.focus('button:has-text("Show solution")'); await p.keyboard.press('Space'); await p.waitForTimeout(120); if (!(await p.$('[data-solution]'))) fail('Space on Show solution');
  await p.click('[aria-label="previous line"]'); await p.waitForTimeout(80); const st = await p.textContent('[data-step]'); if (st !== 'line 28 of 29') fail('previous line -> ' + st);
  if (await p.$('[data-card="yourturn"]')) fail('card stays after a band control');
  await p.click('button:has-text("s²+3s+2")'); await p.waitForTimeout(80); const f = await p.textContent('[data-focus]'); if (!/\(s \+ 1\)\(s \+ 2\)/.test(f)) fail('preset focus ' + f);
  out.shipConsole = errs.length; out.shipRequests = reqs.length; if (errs.length || reqs.length) fail('ship: console ' + errs.slice(0, 2) + ' requests ' + reqs.slice(0, 2));
  await ctx.close(); }
await b.close(); fs.writeFileSync('fd_result.json', JSON.stringify(out, null, 1));
console.log('fails:', out.fails.length ? out.fails.slice(0, 12) : 'none'); console.log(JSON.stringify({ '100%': out['100%'], '125%': out['125%'] }).slice(0, 900)); console.log('id', JSON.stringify(out.id).slice(0, 700)); console.log('run', out.runTime, 'total', out.total, 'wall', out.wall, 'drift', out.drift, 'console', out.shipConsole, 'requests', out.shipRequests);
