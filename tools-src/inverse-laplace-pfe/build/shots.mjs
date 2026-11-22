// Screenshots of the test build at chosen moments: node shots.mjs <pfeN> <outdir> [w h]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [id, outdir, W = '1366', H = '768'] = process.argv.slice(2);
const sum = JSON.parse(fs.readFileSync('out_test/summary.json')); const idx = { pfe1: 0, pfe2: 1, pfe3: 2 }[id];
const file = path.resolve('out_test', sum.find((s) => s.file.includes(['Simple', 'Repeated', 'Complex'][idx])).file);
fs.mkdirSync(outdir, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + file); await p.waitForTimeout(800);
await p.screenshot({ path: outdir + '/00_card.png' });
const n = await p.evaluate(() => window.__PFE_TEST.sched().starts.length);
for (let i = 0; i < n; i++) {
  await p.evaluate((i) => { const s = window.__PFE_TEST.sched(); window.__PFE_TEST.setTime(s.starts[i] + 0.9 * s.durs[i]); }, i);
  await p.waitForTimeout(150);
  await p.screenshot({ path: outdir + '/' + String(i + 1).padStart(2, '0') + '.png' });
}
if (await p.$('text=Show solution')) { await p.click('text=Show solution'); await p.waitForTimeout(150); await p.screenshot({ path: outdir + '/yt_solution.png' }); }
await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200);
await p.screenshot({ path: outdir + '/end.png' });
console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
