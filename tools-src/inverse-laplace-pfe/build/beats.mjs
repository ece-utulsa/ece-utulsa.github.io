// Screenshot every beat of Simple Poles (test build) and check the focus rules: node beats.mjs <outdir> <w> <h> <dpr>
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [PG, outdir, W = '1366', H = '768', DPR = '1', RM = ''] = process.argv.slice(2);
const NAME = { pfe1: 'Simple_Poles_v1.2.0', pfe2: 'Repeated_Poles_v1.2.0', pfe3: 'Complex_Poles_v1.2.0', fd: 'Factoring_the_Denominator_v1.1.0' }[PG];
fs.mkdirSync(outdir, { recursive: true });
const file = path.resolve('out_test', fs.readdirSync('out_test').find((f) => f.includes(NAME + '.html')));
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, reducedMotion: RM ? 'reduce' : 'no-preference' }); const p = await ctx.newPage();
const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + file); await p.waitForTimeout(900);
const beats = await p.evaluate(() => window.__PFE_TEST.beats());
// value -> first beat index at which it may be visible (R4)
const ix = Object.fromEntries(beats.map((x, i) => [x.id, i]));
const RULESETS = {
  pfe1: [
    [/(?<![\d(])−5(?![\de])/, 'A-val', 'A value'], [/(?<![\d.])20(?![\de])/, 'B-val', 'B value'], [/−15(?!e)/, 'C-val', 'C value'],
    [/−5e/, 't1', 'term 1'], [/20e/, 't2', 'term 2'], [/−15e/, 't3', 'term 3'], [/f\(t\) = \(/, 'ft', 'f(t)'],
    [/A \+ B \+ C = 0/, 'eq2', 'equation s2'], [/5A \+ 4B/, 'eq1', 'equation s1'], [/6A \+ 3B/, 'eq0', 'equation s0'],
    [/s²\+5s\+6/, 'expand', 'expanded identity'], [/A\(s\+2\)\(s\+3\)/, 'ident', 'identity'],
  ],
  pfe2: [
    [/= 2(?![.\d])/, 'A-val', 'A value'], [/−1\.5(?!·)/, 'B-val', 'B value'], [/−3\.25(?!e)/, 'C-val', 'C value'], [/2\.25(?!e)/, 'D-val', 'D value'],
    [/1\.5·t e/, 't2', 'term 2'], [/3\.25e/, 't3', 'term 3'], [/2\.25e/, 't4', 'term 4'], [/f\(t\) = \(/, 'ft', 'f(t)'], [/d\/ds/, 'C-dds', 'derivative'],
    [/A \+ C \+ D = 1/, 'eq3', 'equation s3'], [/5A \+ B/, 'eq2', 'equation s2'], [/7A \+ 3B/, 'eq1', 'equation s1'], [/3A = 6/, 'eq0', 'equation s0'],
    [/5s²\+7s/, 'expand', 'expanded identity'], [/A\(s\+1\)²\(s\+3\)/, 'ident', 'identity'], [/\[1 0 1 1/, 'mat4', 'matrix row'],
  ],
  fd: [
    [/Δ = 5²/, 'd1b', 'example 1 numbers'], [/(?<!a )= 1(?![\d.])/, 'd1c', 'disc 1'], [/\(s \+ 2\)\(s \+ 3\)/, 'f1', 'factored form 1'], [/−3/, 'p1b', 'pole -3'],
    [/s² \+ 4s \+ 4/, 'ex2', 'example 2'], [/\(s \+ 2\)²(?! [−+])/, 'f2', 'squared factor'], [/×2/, 'p2', 'double marker'],
    [/s² \+ 4s \+ 13/, 'ex3', 'example 3'], [/−36/, 'd3b', 'disc 3'], [/\(s \+ 2\)² \+ 9/, 'sq3', 'completed square'],
    [/α = (b\/2 = )?2/, 'al', 'alpha'], [/β = (√9 = )?3/, 'be', 'beta'],
    [/Simple Poles/, 'route', 'route links'], [/overdamped/, 'rhyme', 'RLC rhyme'], [/pole type/, 'yt', 'live readout'],
  ],
  pfe3: [
    [/A = 6|(?<![\d(])6(?=\/\(s\+1\))/, 'A-val', 'A value'], [/B = −6/, 'B-val', 'B value'], [/−18(?!\d)/, 'C-val', 'C value'],
    [/\(s ?\+ ?2\)²/, 'sq-done', 'completed square'], [/α = (4\/2 = )?2/, 'al-val', 'alpha'], [/β = (√9 = )?3/, 'be-val', 'beta'],
    [/A₁ = −6/, 'A1-val', 'A1'], [/B₁ = −2/, 'B1-val', 'B1'],
    [/6e⁻ᵗ/, 't1', 'term 1'], [/cos 3t/, 't2', 'term 2'], [/sin 3t/, 't3', 'term 3'], [/f\(t\) = \(/, 'ft', 'f(t)'],
    [/A \+ B = 0/, 'eq2', 'equation s2'], [/4A \+ B \+ C/, 'eq1', 'equation s1'], [/13A \+ C/, 'eq0', 'equation s0'], [/60 = A\(/, 'ident', 'identity'],
  ],
};
const RULES = RULESETS[PG].map(([re, id, name]) => [re, ix[id], name]);
const rows = []; let bad = 0;
for (let i = 0; i < beats.length; i++) {
  for (const [tag, dt] of [['a', 0.05], ['b', 0.75]]) {
    await p.evaluate(([i, dt]) => { const T = window.__PFE_TEST; const bs = T.beats(); const t0 = bs[i].start, t1 = i + 1 < bs.length ? bs[i + 1].start : T.sched().total - 3; T.setTime(t0 + dt * (t1 - t0)); }, [i, dt]);
    await p.waitForTimeout(140);
    const st = await p.evaluate(() => {
      const stage = document.getElementById('stage'); const clone = stage.cloneNode(true); clone.querySelectorAll('.sr-only,[data-card="yourturn"]').forEach((e) => e.remove());
      const vis = Array.from(stage.querySelectorAll('[data-gate="work"],[data-gate="tape"],[data-gate="ft"],[data-gate="caption"],[data-gate="band"]')).filter((e) => !e.closest('[data-card]') && e.dataset.card !== 'yourturn').map((e) => e.innerText).join('\n');
      const focus = Array.from(document.querySelectorAll('[data-focus]')); const f = focus[0];
      const big = []; const tw = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) { const el = n.parentElement; if (!n.textContent.trim() || el.closest('.sr-only')) continue; const fs = parseFloat(getComputedStyle(el).fontSize); const inFocus = !!el.closest('[data-focus]'); const zone = el.closest('[data-gate="work"],[data-gate="tape"],[data-gate="ft"]'); if (zone && !inFocus && fs > 16.01 && !el.closest('[data-card="yourturn"]')) big.push(fs + ':' + n.textContent.trim().slice(0, 20)); if (inFocus && fs < 23.99 && !el.closest('[data-unk]') && el.dataset.unk == null) { const sm = el.closest('[data-focus] div[style*="font-size: 16px"]'); if (!sm) big.push('focus small ' + fs + ':' + n.textContent.trim().slice(0, 20)); } }
      const over = Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate);
      return { vis, nFocus: focus.length, focusId: f ? f.dataset.focus : '', focusText: f ? f.innerText.replace(/\s+/g, ' ') : '', barW: f ? getComputedStyle(f).borderLeftWidth : '', big, over,
        tape: Array.from(document.querySelectorAll('[data-tape]')).map((e) => e.textContent).join(' '), cover: (document.querySelector('[data-cover]') || { dataset: {} }).dataset.cover || '', landing: !!document.querySelector('[data-landing]'),
        done: document.querySelectorAll('[data-done-row]').length, yt: !!document.querySelector('[data-card="yourturn"]') };
    });
    const issues = [];
    if (!st.yt && st.nFocus !== 1) issues.push('focus lines: ' + st.nFocus);
    if (!st.yt && st.focusId !== beats[i].id) issues.push('focus is ' + st.focusId);
    if (!st.yt && st.barW !== '5px') issues.push('bar ' + st.barW);
    for (const [re, from, name] of RULES) if (i < from && re.test(st.vis)) issues.push('EARLY ' + name);
    if (st.big.length) issues.push('size ' + st.big.join(' | '));
    if (st.over.length) issues.push('overflow ' + st.over.join(','));
    if (tag === 'b') { await p.screenshot({ path: `${outdir}/${String(i + 1).padStart(2, '0')}_${beats[i].id}.png` }); rows.push(`| ${i + 1} | ${beats[i].id} | ${beats[i].line} | ${beats[i].start.toFixed(2)} | ${st.focusText.slice(0, 60)} | ${st.tape} | ${st.cover || '–'} | ${st.done} | ${st.landing ? 'path' : '–'} | ${issues.length ? issues.join('; ') : 'ok'} |`); }
    if (issues.length) { bad++; console.log('beat', i + 1, beats[i].id, tag, issues.join('; ')); }
  }
}
fs.writeFileSync(outdir + '/frames.md', '| # | Beat | Line | Start (s) | Focus line | Tape | Cover | Done rows | Landing | Check |\n|---|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
console.log(outdir, 'beats', beats.length, 'bad frames', bad, 'console errors', errs.length, errs.slice(0, 3));
await b.close();
