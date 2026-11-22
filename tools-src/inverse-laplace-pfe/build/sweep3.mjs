// Complex Poles Explore: random (b, c) at every derivation line; no panel may overflow. node sweep3.mjs
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const file = path.resolve('out_test', fs.readdirSync('out_test').find((f) => f.includes('Complex_Poles_v1.2.0.html')));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + file); await p.waitForTimeout(800);
await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200);
const setR = (label, v) => p.evaluate(([label, v]) => { const el = document.querySelector('input[aria-label="quadratic coefficient ' + label + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]);
let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const bad = new Map(); let n = 0;
const combos = [[9, 30], [8.5, 29.5], [0.5, 1], [4.5, 13.5], [7.5, 6.5], [9, 1]]; for (let k = 0; k < 24; k++) combos.push([0.5 + 0.5 * Math.floor(rnd() * 18), 1 + 0.5 * Math.floor(rnd() * 59)]);
for (const [bq, cq] of combos) {
  await setR('b', bq); await setR('c', cq); await p.waitForTimeout(30);
  for (let k = 0; k < 40; k++) {
    const r = await p.evaluate(() => ({ step: document.querySelector('[data-step]').textContent, focus: (document.querySelector('[data-focus]') || { dataset: {} }).dataset.focus,
      over: Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate + ' ' + (e.scrollHeight - e.clientHeight) + 'x' + (e.scrollWidth - e.clientWidth)) }));
    n++; if (r.over.length) bad.set(r.focus + ' ' + r.over.join(','), 'b=' + bq + ' c=' + cq);
    if (/^line 1 of/.test(r.step)) break;
    await p.click('[aria-label="previous line"]'); await p.waitForTimeout(25);
  }
  for (let k = 0; k < 40; k++) { await p.click('[aria-label="next line"]'); } await p.waitForTimeout(25);
}
console.log('frames', n, 'overflowing kinds', bad.size, 'console errors', errs.length, errs.slice(0, 2)); for (const [k, v] of bad) console.log('  ', k, '@', v);
await b.close();
