// screenshots of a lecture page: opening card, Your turn with the solution, end state. node lshots.mjs <l9|l10> <outdir>
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [PG, outdir] = process.argv.slice(2); const FILE = fs.readdirSync('out_test').find((f) => f.startsWith('Laplace_' + PG.toUpperCase() + '_'));
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await p.goto('file://' + path.resolve('out_test', FILE)); await p.waitForTimeout(900); await p.screenshot({ path: outdir + '/x_card.png' });
await p.evaluate(() => { const T = window.__PFE_TEST, s = T.sched(), n = s.starts.length - 1; T.setTime(s.starts[n] + 0.9 * s.durs[n]); }); await p.waitForTimeout(150);
await p.click('text=Show solution'); await p.waitForTimeout(150); await p.screenshot({ path: outdir + '/x_yt.png' });
console.log(await p.evaluate(() => Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate + ' ' + e.scrollHeight + '/' + e.clientHeight + ' ' + e.scrollWidth + '/' + e.clientWidth)));
await p.click('text=back to the worked example'); await p.evaluate(() => window.__PFE_TEST.setTime(window.__PFE_TEST.sched().total)); await p.waitForTimeout(200); await p.screenshot({ path: outdir + '/x_end.png' });
await b.close();
