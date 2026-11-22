// S-Domain Circuit Analysis: developer tests. node sd3test.mjs  (test build for sweeps, ship build for the real-time run)
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const FILE = 'S-Domain_Circuit_Analysis_v1.1.0.html';
const src = fs.readFileSync('check.mjs', 'utf8'); const a0 = src.indexOf('const audit = () => {'); const a1 = src.indexOf('\nlet bad = 0;');
const audit = new Function('return (' + src.slice(a0 + 'const audit = '.length, a1).trim().replace(/;$/, '') + ')')();
const b = await chromium.launch(); const out = { fails: [] }; const fail = (m) => out.fails.push(m);
const SUPS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '·': '.' };
const val = (s) => parseFloat(s.replace(/−\s*/g, '-').replace(/\+\s*/g, ''));
for (const v of [{ n: '100%', w: 1366, h: 768, d: 1 }, { n: '125%', w: 1093, h: 614, d: 1.25 }]) {
  const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.d }); const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve('out_test', FILE)); await p.waitForTimeout(900);
  const issues = new Set(); const add = (w, a) => { for (const k of ['clip', 'font', 'contrast', 'overlap']) for (const x of a[k]) issues.add(w + ' [' + k + '] ' + x); };
  add('card', await p.evaluate(audit));
  const beats = await p.evaluate(() => window.__PFE_TEST.beats()); const ix = Object.fromEntries(beats.map((x, i) => [x.id, i]));
  for (let i = 0; i < beats.length; i++) {
    await p.evaluate((i) => { const T = window.__PFE_TEST, bs = T.beats(); const t1 = i + 1 < bs.length ? bs[i + 1].start : T.sched().total - 3; T.setTime(bs[i].start + 0.8 * (t1 - bs[i].start)); }, i); await p.waitForTimeout(110); add(beats[i].id, await p.evaluate(audit));
    const s = await p.evaluate(() => ({ sliders: document.querySelectorAll('input[type="range"]').length, icC: !!document.querySelector('[data-icmodel="C"]'), icL: !!document.querySelector('[data-icmodel="L"]'), plot: !!document.querySelector('[data-plot]'), curve: !!document.querySelector('[data-curve]'),
      uni: Array.from(document.querySelectorAll('[data-uni]')).map((e) => e.dataset.uni).join(','), slots: Object.fromEntries(Array.from(document.querySelectorAll('[data-slot]')).map((e) => [e.dataset.slot, (e.querySelector('[data-tape]') || e).textContent])) }));
    if (s.sliders) fail(v.n + ' ' + beats[i].id + ': sliders visible during the tour');
    if (s.icC !== (i >= ix.icC)) fail(v.n + ' ' + beats[i].id + ': capacitor IC model ' + s.icC); if (s.icL !== (i >= ix.icL2)) fail(v.n + ' ' + beats[i].id + ': inductor IC model ' + s.icL);
    if (s.plot !== (i >= ix.form) || s.curve !== (i >= ix.it)) fail(v.n + ' ' + beats[i].id + ': plot ' + s.plot + ' curve ' + s.curve);
    const wantUni = ['dc', 'ac', 'full'].filter((k) => i >= ix[k]).join(','); if (s.uni !== wantUni) fail(v.n + ' ' + beats[i].id + ': table rows ' + s.uni);
    for (const [k, want] of [['tR', '2'], ['tL', 's'], ['tIC', '3 V'], ['tV', '10/s'], ['A', '5'], ['B', '−2']]) if (k in s.slots) { const w = i >= ix[k] ? want : '?'; if (s.slots[k] !== w) fail(v.n + ' ' + beats[i].id + ': slot ' + k + ' reads ' + s.slots[k]); }
    if (i >= ix.tr && i < ix.yt && Object.keys(s.slots).filter((k) => k[0] === 't').length !== 4) fail(v.n + ' ' + beats[i].id + ': s-circuit slots ' + Object.keys(s.slots));
  }
  // table text (spec item 4) at the end of line 13
  await p.evaluate(() => { const T = window.__PFE_TEST; T.setTime(T.beats().find((x) => x.id === 'arc').start - 0.3); }); await p.waitForTimeout(110);
  const rows = await p.evaluate(() => Array.from(document.querySelectorAll('[data-uni]')).map((e) => e.textContent)); out.rows = rows;
  if (rows[0] !== 's → 0: i(∞) = V_S/R = 5 A (L is a short)') fail('DC row: ' + rows[0]);
  if (rows[1] !== 'AC: a 10 V sinusoid at ω = 10 rad/s → Z = R + jωL, |I| = 0.98 A ∠−78.7°') fail('AC row: ' + rows[1]);
  // Your turn (line 16)
  await p.evaluate(() => { const T = window.__PFE_TEST, s = T.sched(); T.setTime(s.starts[15] + 0.9 * s.durs[15]); }); await p.waitForTimeout(120);
  if (!(await p.$('[data-card="yourturn"]'))) fail(v.n + ': no Your-turn card'); if (await p.$('[data-solution]')) fail(v.n + ': solution shown early');
  if (await p.$('input[type="range"]')) fail(v.n + ': sliders during the Your-turn clip');
  const pre = await p.evaluate(() => document.getElementById('stage').innerText); if (/3e⁻ᵗ|3\/\(s \+ 1\)/.test(pre)) fail(v.n + ': Your-turn answer visible before Show solution');
  add('yt', await p.evaluate(audit)); out.problem = await p.evaluate(() => document.querySelector('[data-yt-problem]').textContent);
  await p.click('text=Show solution'); await p.waitForTimeout(120); add('yt solution', await p.evaluate(audit));
  const key = await p.evaluate(() => ({ steps: Array.from(document.querySelectorAll('[data-yt-step]')).map((e) => e.innerText.replace(/\s+/g, ' ')), ans: document.querySelector('[data-yt-answer]').textContent, src: document.querySelector('[data-gate="out"]').dataset.ftSource,
    ft: document.querySelector('[data-ft-text]').textContent.trim(), d: document.querySelector('[data-curve]').getAttribute('d'), svgH: +document.querySelector('[data-plot]').getAttribute('height') })); out.key = key;
  if (key.ans !== 'i(t) = 3e⁻ᵗ A' || key.ft !== 'i(t) = 3e⁻ᵗ A' || key.src !== 'yourturn') fail(v.n + ': Your-turn answer ' + JSON.stringify(key));
  const WANT = ['transform R → 2; C → 1/(sC) = 2/s, in series with the source 4/s; the step becomes 10/s', 'KVL 10/s = I(s)(2 + 2/s) + 4/s, so I(s)(2 + 2/s) = 6/s', 'solve I(s) = 3/(s + 1)', 'check i(0) = (10 − 4)/2 = 3 A; i(∞) = 0 (C is open at DC)'];
  if (JSON.stringify(key.steps) !== JSON.stringify(WANT)) fail(v.n + ': Your-turn steps ' + JSON.stringify(key.steps));
  { const pts = key.d.trim().split(/[ML]/).filter(Boolean).map((q) => q.trim().split(' ').map(Number)); const yA = pts[0][1], yB = pts[pts.length - 1][1], y0 = key.svgH - 20;   // 3 A at t = 0 falling to 3e^-5 at 5 tau
    const ratio = (y0 - yB) / (y0 - yA); if (Math.abs(ratio - Math.exp(-5)) > 0.01) fail(v.n + ': Your-turn curve end/start ' + ratio); }
  await p.click('text=back to the worked example'); await p.waitForTimeout(80);
  await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200); add('end', await p.evaluate(audit));
  if ((await p.$$('input[type="range"]')).length !== 4) fail(v.n + ': sliders missing after the tour');
  const gate = await p.evaluate(() => window.__PFE_TEST.gate()); if (!gate.pass) fail(v.n + ': OverlapGate ' + gate.fails.join('; '));
  // Explore sweep: random valid circuit values; physics identities read back from the display
  const setR = (label, x) => p.evaluate(([label, x]) => { const el = document.querySelector('input[aria-label="' + label + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, x]);
  let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; const pick = (lo, hi, st) => lo + st * Math.floor(rnd() * ((hi - lo) / st + 1));
  const combos = [[2, 0, 0.5, 0.25], [24, 8, 10, 4], [24, 0, 0.5, 4], [2, 8, 10, 0.25], [10, 5, 2, 1], [8, 8, 1, 1]]; for (let k = 0; k < 60; k++) combos.push([pick(2, 24, 1), pick(0, 8, 0.5), pick(0.5, 10, 0.5), pick(0.25, 4, 0.25)]);
  let worst = 0;
  for (const [VS, I0, R, L] of combos) {
    await setR('source voltage', VS); await setR('initial current', I0); await setR('resistance', R); await setR('inductance', L); await p.waitForTimeout(40);
    const r = await p.evaluate(() => ({ focus: document.querySelector('[data-focus]').innerText, rows: Array.from(document.querySelectorAll('[data-uni]')).map((e) => e.textContent), done: Array.from(document.querySelectorAll('[data-done-row]')).map((e) => e.textContent),
      slots: Object.fromEntries(Array.from(document.querySelectorAll('[data-slot]')).map((e) => [e.dataset.slot, (e.querySelector('[data-tape]') || e).textContent])), d: document.querySelector('[data-curve]').getAttribute('d'), text: document.getElementById('stage').innerText,
      over: Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate) }));
    const tag = `VS=${VS} I0=${I0} R=${R} L=${L}: `; if (r.over.length) fail(v.n + ' ' + tag + 'overflow ' + r.over.join(',')); if (/NaN|Infinity|undefined/.test(r.text)) fail(tag + 'bad number on screen');
    const m = /i\(t\) = (−?[\d.]+) ([+−] [\d.]+)e⁻([⁰¹²³⁴⁵⁶⁷⁸⁹·]+)ᵗ A/.exec(r.focus); if (!m) { fail(tag + 'i(t) text ' + r.focus); continue; }
    const pf = /I\(s\) = (−?[\d.]+)\/s ([+−] [\d.]+)\/\(s \+ ([\d.]+)\)/.exec(r.done[2]); if (!pf || Math.abs(val(pf[1]) - VS / R) > 0.006 || Math.abs(val(pf[2]) - (I0 - VS / R)) > 0.006 || Math.abs(+pf[3] - R / L) > 0.006) fail(tag + 'PFE row ' + r.done[2]);
    const A = val(m[1]), B = val(m[2]), pp = parseFloat(m[3].split('').map((c) => SUPS[c]).join(''));
    const e = Math.max(Math.abs(A - VS / R), Math.abs(B - (I0 - VS / R)), Math.abs(pp - R / L), Math.abs(A + B - I0)); worst = Math.max(worst, e);   // i(0) = A + B = I0; i(inf) = A = VS/R; pole = -R/L
    if (r.slots.tR !== String(R).replace('-', '−') || val(r.slots.tIC) !== Math.round(L * I0 * 100) / 100 || r.slots.tV !== VS + '/s') fail(tag + 's-circuit ' + JSON.stringify(r.slots));
    const ac = /\|I\| = ([\d.]+) A ∠(−?[\d.]+)°/.exec(r.rows[1]); const zM = Math.hypot(R, 10 * L); if (!ac || Math.abs(+ac[1] - VS / zM) > 0.006 || Math.abs(val(ac[2]) + Math.atan2(10 * L, R) * 180 / Math.PI) > 0.06) fail(tag + 'AC row ' + r.rows[1]);
    if (!r.rows[0].includes('= ' + String(Math.round(VS / R * 100) / 100) + ' A')) fail(tag + 'DC row ' + r.rows[0]);
    if (!r.done[0].includes('= ' + VS + '/s + ' + Math.round(L * I0 * 100) / 100)) fail(tag + 'KVL row ' + r.done[0]);
  }
  if (worst > 0.006) fail(v.n + ': identity error ' + worst);
  await p.click('text=reset'); await p.waitForTimeout(60); const f0 = await p.textContent('[data-focus]'); if (!/5 − 2e⁻²ᵗ A/.test(f0)) fail('reset -> ' + f0);
  for (const [name, i] of [['DC', 0], ['AC', 1], ['full', 2]]) { await p.click(`button:has-text("${name}")`); await p.waitForTimeout(50); const on = await p.evaluate(() => Array.from(document.querySelectorAll('[data-uni]')).map((e) => !/transparent|rgba\(0, 0, 0, 0\)/.test(getComputedStyle(e).borderTopColor)).indexOf(true)); if (on !== i) fail('view ' + name + ' marks row ' + on); }
  add('explore', await p.evaluate(audit));
  out[v.n] = { issues: [...issues].slice(0, 30), nIssues: issues.size, consoleErrors: errs.length, gate: gate.pass + ' (' + gate.beats + ' beats)', sweep: combos.length, worstIdentity: +worst.toExponential(2) };
  if (issues.size || errs.length) fail(v.n + ': ' + issues.size + ' layout issues, ' + errs.length + ' console ' + errs.slice(0, 2));
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
  const want = Array.from({ length: 16 }, (_, i) => 'sd3_line' + (i + 1) + '.mp3');
  if (JSON.stringify(plays.map((l) => l.clip)) !== JSON.stringify(want)) fail('play order ' + plays.map((l) => l.clip)); if (JSON.stringify(ended.map((l) => l.clip)) !== JSON.stringify(want)) fail('ended order');
  if (speak) fail('device speech'); if (log.some((l) => l.ev === 'csp')) fail('CSP violation');
  let exp = 1.0; out.timeline = plays.map((pl, i) => { const d = ended[i].dur; const row = { clip: pl.clip, dur: +d.toFixed(3), start: +(pl.t - t0).toFixed(2), sched: +exp.toFixed(2) }; exp += d + 1.5; return row; });
  out.total = +(exp - 1.5 + 3).toFixed(2); out.wall = +(t1 - t0).toFixed(2); out.drift = Math.max(...out.timeline.map((r) => Math.abs(r.start - r.sched)));
  if (out.drift > 0.5) fail('drift ' + out.drift);
  if ((await p.$$('input[type="range"]')).length !== 4) fail('ship: sliders missing after the tour');
  await p.focus('button:has-text("Show solution")'); await p.keyboard.press('Space'); await p.waitForTimeout(120); if (!(await p.$('[data-solution]'))) fail('Space on Show solution');
  await p.click('[aria-label="previous line"]'); await p.waitForTimeout(80); const st = await p.textContent('[data-step]'); if (st !== 'line 36 of 37') fail('previous line -> ' + st);
  if (await p.$('[data-card="yourturn"]')) fail('card stays after a band control');
  out.shipConsole = errs.length; out.shipRequests = reqs.length; if (errs.length || reqs.length) fail('ship: console ' + errs.slice(0, 2) + ' requests ' + reqs.slice(0, 2));
  await ctx.close(); }
await b.close(); fs.writeFileSync('sd3_result.json', JSON.stringify(out, null, 1));
console.log('fails:', out.fails.length ? out.fails.slice(0, 14) : 'none', out.fails.length); console.log(JSON.stringify({ '100%': out['100%'], '125%': out['125%'] }).slice(0, 1500)); console.log('id', JSON.stringify(out.id).slice(0, 900)); console.log('run', out.runTime, 'total', out.total, 'wall', out.wall, 'drift', out.drift, 'console', out.shipConsole, 'requests', out.shipRequests);
