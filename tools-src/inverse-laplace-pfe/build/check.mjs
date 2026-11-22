// Developer checks on the TEST build (same sources + gate hook): node check.mjs
// Sweeps every narration line at 1366x768 @100 % and @125 % zoom (1093x614 CSS px, DPR 1.25).
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const sum = JSON.parse(fs.readFileSync('out_test/summary.json'));
const VIEWS = [{ name: '100%', w: 1366, h: 768, dpr: 1 }, { name: '125%', w: 1093, h: 614, dpr: 1.25 }];
const KEYS = {
  Simple: { ans: 'f(t) = ( 3e⁻ᵗ − e⁻³ᵗ ) u(t)', f: (t) => 3 * Math.exp(-t) - Math.exp(-3 * t), tmax: 6, tape: { A: '−5', B: '20', C: '−15' },
    ft: 'f(t) = ( −5e⁻ᵗ + 20e⁻²ᵗ − 15e⁻³ᵗ ) u(t)' },
  Repeated: { ans: 'f(t) = ( 3 − 2·t e⁻ᵗ − 3e⁻ᵗ ) u(t)', f: (t) => 3 - 2 * t * Math.exp(-t) - 3 * Math.exp(-t), tmax: 8, tape: { A: '2', B: '−1.5', C: '−3.25', D: '2.25' },
    ft: 'f(t) = ( 2 − 1.5·t e⁻ᵗ − 3.25e⁻ᵗ + 2.25e⁻³ᵗ ) u(t)' },
  Complex: { ans: 'f(t) = ( 2e⁻²ᵗ − 2e⁻ᵗcos 3t + (2/3)e⁻ᵗsin 3t ) u(t)', f: (t) => 2 * Math.exp(-2 * t) - 2 * Math.exp(-t) * Math.cos(3 * t) + (2 / 3) * Math.exp(-t) * Math.sin(3 * t), tmax: 5,
    tape: { A: '6', B: '−6', C: '−18', 'α': '2', 'β': '3', 'A₁': '−6', 'B₁': '−2' },
    ft: 'f(t) = ( 6e⁻ᵗ − 6e⁻2ᵗcos 3t − 2e⁻2ᵗsin 3t ) u(t)' },
};
// in-page audit of the current frame: clipping, font size, contrast, overlaps
const audit = () => {
  const out = { clip: [], font: [], contrast: [], overlap: [], unk: [] };
  const stage = document.getElementById('stage'); const sr = stage.getBoundingClientRect(); const scale = sr.width / 1280;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
  const lum = (a) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); };
  const bgOf = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && !/, 0(\.0+)?\)$/.test(b) && !/rgba\(0, 0, 0, 0\.0\d+\)/.test(b)) return rgb(b); } return [250, 250, 247]; };
  // text nodes
  const tw = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) {
    const txt = n.textContent.trim(); if (!txt) continue; const el = n.parentElement;
    if (el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el); let op = 1; for (let e = el; e && e !== stage.parentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op < 0.99) continue;                                   // mid-fade frames are not settled states
    const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (!b.width) continue;
    const fs = parseFloat(cs.fontSize); if (fs < 13 - 1e-6) out.font.push(fs + 'px "' + txt.slice(0, 30) + '"');
    const isSvg = el instanceof SVGElement; const col = rgb(isSvg ? cs.fill : cs.color); const bg = bgOf(el);
    const L1 = lum(col), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const need = el.closest('.up') || cs.color === 'rgb(133, 138, 148)' ? 3 : 4.5;
    if (cr < need) out.contrast.push(cr.toFixed(2) + ' <' + need + ' "' + txt.slice(0, 30) + '"');
    // text must stay inside the stage and inside its panel
    const host = el.closest('[data-gate]');
    if (b.left < sr.left - 1 || b.right > sr.right + 1 || b.top < sr.top - 1 || b.bottom > sr.bottom + 1) out.clip.push('outside stage "' + txt.slice(0, 30) + '"');
    if (host) { const h = host.getBoundingClientRect(); if (b.left < h.left - 1 || b.right > h.right + 1 || b.top < h.top - 1 || b.bottom > h.bottom + 1) out.clip.push(host.dataset.gate + ' clips "' + txt.slice(0, 40) + '" by ' + Math.round(Math.max(h.left - b.left, b.right - h.right, h.top - b.top, b.bottom - h.bottom) / scale) + 'px'); }
    for (let e = el; e && e !== stage; e = e.parentElement) { const s = getComputedStyle(e); if ((s.overflow === 'hidden' || s.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 1 && !e.dataset.gate && e.id !== 'stage') { out.clip.push('ellipsis/overflow "' + txt.slice(0, 40) + '"'); break; } }
  }
  document.querySelectorAll('[data-gate]').forEach((p) => { if (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1) out.clip.push(p.dataset.gate + ' content overflows panel by ' + (p.scrollHeight - p.clientHeight) + 'x' + (p.scrollWidth - p.clientWidth)); });
  // sibling text boxes inside one panel must not collide (labels overlapping labels)
  const els = Array.from(document.querySelectorAll('[data-gate]'));
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], c = els[j]; if (a.contains(c) || c.contains(a) || a.dataset.gate === c.dataset.gate) continue;
    const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect(); if (!ra.width || !rc.width) continue;
    const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
    if (ox > 0.5 && oy > 0.5) out.overlap.push(a.dataset.gate + ' x ' + c.dataset.gate);
  }
  const svgT = Array.from(document.querySelectorAll('svg[data-plot] text')).map((t) => ({ r: t.getBoundingClientRect(), s: t.textContent }));
  for (let i = 0; i < svgT.length; i++) for (let j = i + 1; j < svgT.length; j++) {
    const a = svgT[i].r, c = svgT[j].r; if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5) out.overlap.push('plot labels "' + svgT[i].s + '" x "' + svgT[j].s + '"');
  }
  document.querySelectorAll('[data-unk]').forEach((u) => { if (!u.closest('.up') && /^[ABCD]$/.test(u.textContent)) { const c = rgb(getComputedStyle(u).color); out.unk.push(u.textContent + ':' + c.join(',')); } });
  return out;
};
let bad = 0; const report = [];
const b = await chromium.launch();
for (const pg of sum) {
  const kind = ['Simple', 'Repeated', 'Complex'].find((k) => pg.file.includes(k)); const key = KEYS[kind];
  for (const v of VIEWS) {
    const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.dpr }); const p = await ctx.newPage();
    const errs = [], reqs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith('file://') || !u.endsWith(encodeURI(pg.file))) if (!u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u); });
    await p.goto('file://' + path.resolve('out_test', pg.file)); await p.waitForTimeout(900);
    const issues = [];
    const add = (where, a) => { for (const k of ['clip', 'font', 'contrast', 'overlap']) for (const x of a[k]) issues.push(where + ' [' + k + '] ' + x); };
    add('opening card', await p.evaluate(audit));
    const hScroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
    if (hScroll) issues.push('page scrolls');
    const n = await p.evaluate(() => window.__PFE_TEST.sched().starts.length);
    const unkColours = new Set();
    for (let i = 0; i < n; i++) for (const fr of [0.5, 0.9]) {
      await p.evaluate(([i, fr]) => { const s = window.__PFE_TEST.sched(); window.__PFE_TEST.setTime(s.starts[i] + fr * s.durs[i]); }, [i, fr]); await p.waitForTimeout(120);
      const a = await p.evaluate(audit); add('line ' + (i + 1) + '@' + fr, a); a.unk.forEach((u) => unkColours.add(u.split(':')[1]));
    }
    // worked-example numbers at the last line before Your turn
    await p.evaluate(() => { const s = window.__PFE_TEST.sched(); const k = s.starts.length - 2; window.__PFE_TEST.setTime(s.starts[k] + 0.9 * s.durs[k]); }); await p.waitForTimeout(120);
    const tape = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('[data-tape]')).map((e) => [e.dataset.tape, e.textContent])));
    const ftText = await p.evaluate(() => document.querySelector('[data-ft-text]').textContent);
    if (JSON.stringify(tape) !== JSON.stringify(key.tape)) issues.push('tape ' + JSON.stringify(tape));
    if (ftText !== key.ft) issues.push('f(t) text "' + ftText + '"');
    // Your turn: card present on the last line, solution hidden until asked
    await p.evaluate(() => { const s = window.__PFE_TEST.sched(); const k = s.starts.length - 1; window.__PFE_TEST.setTime(s.starts[k] + 0.9 * s.durs[k]); }); await p.waitForTimeout(120);
    if (!(await p.$('[data-card="yourturn"]'))) issues.push('no Your-turn card on the last line');
    if (await p.$('[data-solution]')) issues.push('solution visible before Show solution');
    if ((await p.getAttribute('[data-gate="ft"]', 'data-ft-source')) !== 'example') issues.push('f(t) panel switched before Show solution');
    await p.click('text=Show solution'); await p.waitForTimeout(120);
    add('your turn solution', await p.evaluate(audit));
    const ans = await p.textContent('[data-yt-answer]'); if (ans !== key.ans) issues.push('Your-turn answer "' + ans + '"');
    const panelFt = await p.textContent('[data-ft-text]'); if (panelFt !== key.ans) issues.push('Your-turn panel f(t) "' + panelFt + '"');
    // the plotted curve must be the key f(t): read the path back through the axis ticks
    const plot = await p.evaluate(() => {
      const svg = document.querySelector('svg[data-plot]'); const paths = Array.from(svg.querySelectorAll('path')); const d = paths[paths.length - 1].getAttribute('d');
      const pts = d.trim().split(/[ML]/).filter(Boolean).map((s) => s.trim().split(' ').map(Number));
      const texts = Array.from(svg.querySelectorAll('text')).map((t) => ({ s: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'), a: t.getAttribute('text-anchor') }));
      return { pts, yt: texts.filter((t) => t.a === 'end' && t.s !== 't, s'), tt: texts.filter((t) => t.a === 'middle') };
    });
    const val = (s) => parseFloat(s.replace('−', '-'));
    const ya = plot.yt[0], yb = plot.yt[plot.yt.length - 1]; const ta = plot.tt[0], tb = plot.tt[plot.tt.length - 1];
    let maxErr = 0; for (const [x, y] of plot.pts) { const t = val(ta.s) + (x - ta.x) / (tb.x - ta.x) * (val(tb.s) - val(ta.s)); const yy = val(ya.s) + ((y + 4.5) - ya.y) / (yb.y - ya.y) * (val(yb.s) - val(ya.s)); maxErr = Math.max(maxErr, Math.abs(yy - key.f(t))); }
    const span = Math.abs(val(yb.s) - val(ya.s)); if (maxErr > span * 0.01) issues.push('plot differs from key f(t): max error ' + maxErr.toFixed(4));
    if (val(tb.s) !== key.tmax || plot.tt.length !== key.tmax + 1) issues.push('t ticks ' + plot.tt.map((t) => t.s).join(','));
    // back to the worked example, reopen, end state
    await p.click('text=back to the worked example'); await p.waitForTimeout(100);
    if (await p.$('[data-card="yourturn"]')) issues.push('card did not close');
    add('explore after your turn', await p.evaluate(audit));
    await p.click('button:has-text("Your turn")'); await p.waitForTimeout(100);
    if (!(await p.$('[data-card="yourturn"]'))) issues.push('card did not reopen');
    await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(250);
    add('end', await p.evaluate(audit));
    const gate = await p.evaluate(() => window.__PFE_TEST.gate());
    if (!gate.pass) issues.push('OverlapGate FAIL ' + gate.fails.join('; '));
    if (unkColours.size !== 1) issues.push('unknowns not one colour: ' + [...unkColours].join(' | '));
    const uniq = [...new Set(issues)];
    report.push({ page: kind, view: v.name, issues: uniq.length, gate: gate.pass + ' (' + gate.beats + ' beats, ' + gate.tagged.length + ' tagged)', consoleErrors: errs.length, requests: reqs.length, unknownColour: [...unkColours][0], plotMaxErr: +maxErr.toFixed(4) });
    if (uniq.length || errs.length || reqs.length) { bad++; console.log('--', kind, v.name); uniq.slice(0, 40).forEach((x) => console.log('   ', x)); errs.slice(0, 5).forEach((x) => console.log('    console:', x)); reqs.slice(0, 5).forEach((x) => console.log('    request:', x)); }
    await ctx.close();
  }
}
await b.close();
console.table(report); console.log(bad ? 'FAILURES: ' + bad : 'ALL CHECKS PASS');
