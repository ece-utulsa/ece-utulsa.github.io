// Laplace lecture series: index and navigation tests on the repo files. node series_test.mjs [shots dir]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const DIR = '/home/user/ece-utulsa.github.io/ece-2003/'; const SHOTS = process.argv[2];
const S = [['Laplace_L1_What_the_Transform_Does_v1.0.1', 'What the Laplace Transform Does'], ['Laplace_L2_Table_and_Properties_v1.0.1', 'The Table and Its Properties'], ['Laplace_L3_Circuit_Element_Models_v1.0.1', 'From Derivatives to Circuit Models'],
  ['Factoring_the_Denominator_v1.1.1', 'Factoring the Denominator'], ['Inverse_Laplace_Simple_Poles_v1.2.1', 'Inverse Laplace — Simple Poles'], ['Inverse_Laplace_Repeated_Poles_v1.2.1', 'Inverse Laplace — Repeated Poles'], ['Inverse_Laplace_Complex_Poles_v1.2.1', 'Inverse Laplace — Complex Poles'],
  ['S-Domain_Circuit_Analysis_v1.1.1', 'S-Domain Circuit Analysis'], ['Laplace_L9_Mesh_Analysis_s-Domain_v1.0.1', 'Mesh Analysis in the s-Domain'], ['Laplace_L10_Node_Analysis_s-Domain_v1.0.1', 'Node-Voltage Analysis in the s-Domain']];
const fails = []; const fail = (m) => fails.push(m); const out = {};
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
// ---- index
{ const p = await ctx.newPage(); const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_INTERNET_DISCONNECTED/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + DIR + 'index.html'); await p.waitForTimeout(500);
  const all = await p.evaluate(() => Array.from(document.querySelectorAll('#list a[href]')).map((a) => a.getAttribute('href')));
  for (const h of new Set(all)) if (!fs.existsSync(path.resolve(DIR, decodeURI(h)))) fail('index link missing: ' + h);
  await p.click('.chip[data-kind="lecture"]'); await p.waitForTimeout(200);
  const lec = await p.evaluate(() => Array.from(document.querySelectorAll('#list .card')).map((c) => ({ kind: c.querySelector('.card-kind').textContent, title: c.querySelector('h3').textContent, href: c.getAttribute('href'), cls: c.className })));
  out.lectureFilter = lec.length; out.readout = await p.textContent('#readout');
  if (lec.length !== 10) fail('lecture filter shows ' + lec.length);
  lec.forEach((c, i) => { if (c.title !== 'Lecture ' + (i + 1) + ' · ' + S[i][1] || c.href !== S[i][0] + '.html' || c.kind !== 'Lecture' || !/card-lecture/.test(c.cls)) fail('lecture card ' + (i + 1) + ': ' + JSON.stringify(c)); });
  if (SHOTS) await p.screenshot({ path: SHOTS + '/index_lectures.png' });
  await p.click('.chip[data-kind="animation"]'); await p.waitForTimeout(150); const an = await p.evaluate(() => Array.from(document.querySelectorAll('#list .card h3')).map((e) => e.textContent)); out.animations = an.length;
  if (an.some((t) => /^Lecture \d/.test(t))) fail('a lecture is still listed as an animation'); if (!an.includes('Partial Fractions — Properness')) fail('Properness is not an animation');
  await p.click('.chip[data-kind="all"]'); await p.waitForTimeout(150); const order = await p.evaluate(() => Array.from(document.querySelectorAll('#list .card h3')).map((e) => e.textContent));
  const i4 = order.indexOf('Lecture 4 · Factoring the Denominator'); if (order[i4 + 1] !== 'Partial Fractions — Properness' || order[i4 + 2] !== 'Lecture 5 · Inverse Laplace — Simple Poles') fail('order around Lecture 4: ' + order.slice(i4, i4 + 3));
  out.total = order.length; out.indexConsole = errs.length; if (errs.length) fail('index console: ' + errs.slice(0, 2)); await p.close(); }
// ---- each lecture page
out.pages = [];
for (let i = 0; i < S.length; i++) {
  const n = i + 1, file = S[i][0] + '.html', ver = /_(v[\d.]+)$/.exec(S[i][0])[1]; const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u); });
  await p.goto('file://' + DIR + file); await p.waitForSelector('button:has-text("Start")'); await p.waitForTimeout(700);
  const title = await p.title(), meta = await p.getAttribute('meta[name="version"]', 'content'), h1 = await p.evaluate(() => (document.querySelector('[data-card="opening"] h1') || document.querySelector('h1') || { textContent: '' }).textContent);
  const html = fs.readFileSync(DIR + file, 'utf8'), cver = /Version: (v[\d.]+)/.exec(html)[1];
  if (title !== 'Lecture ' + n + ' · ' + S[i][1] + ' ' + ver) fail(file + ': title "' + title + '"'); if (meta !== ver || cver !== ver) fail(file + ': version meta ' + meta + ' comment ' + cver);
  if (h1 !== 'Lecture ' + n + ' · ' + S[i][1]) fail(file + ': opening card heading "' + h1 + '"');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/L' + n + '_card.png' });
  await p.click('button:has-text("Start")'); await p.waitForTimeout(600);
  const sl = p.locator('[role="slider"]').first(); const box = await sl.boundingBox(); await p.mouse.click(box.x + box.width - 1, box.y + box.height / 2); await p.waitForTimeout(400);
  await sl.focus(); await p.keyboard.press('End'); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ now: +document.querySelector('[role="slider"]').getAttribute('aria-valuenow'), max: +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'),
    links: Array.from(document.querySelectorAll('#stage a[href], #root a[href]')).map((a) => ({ href: a.getAttribute('href'), text: a.textContent, vis: a.getBoundingClientRect().width > 0 })),
    over: Array.from(document.querySelectorAll('[data-gate]')).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.gate) }));
  if (st.now < st.max - 0.6) fail(file + ': could not reach the end (' + st.now + '/' + st.max + ')');
  const hrefs = [...new Set(st.links.map((l) => l.href))]; for (const h of hrefs) if (!fs.existsSync(DIR + decodeURI(h))) fail(file + ': link missing ' + h);
  const want = [n > 1 ? S[i - 1][0] + '.html' : null, n < 10 ? S[i + 1][0] + '.html' : null].filter(Boolean);
  for (const w of want) if (!hrefs.includes(w)) fail(file + ': no link to ' + w);
  const texts = st.links.map((l) => l.text).join(' | ');
  if (n > 1 && !new RegExp('← Lecture ' + (n - 1) + '\\b').test(texts)) fail(file + ': previous link text: ' + texts); if (n < 10 && !new RegExp('Lecture ' + (n + 1) + '\\b[^|]*→').test(texts)) fail(file + ': next link text: ' + texts);
  if (st.links.some((l) => !l.vis)) fail(file + ': a link is not visible'); if (st.over.length) fail(file + ': overflow ' + st.over);
  if (errs.length || reqs.length) fail(file + ': console ' + errs.slice(0, 2) + ' requests ' + reqs.slice(0, 2));
  if (SHOTS) await p.screenshot({ path: SHOTS + '/L' + n + '_end.png' });
  out.pages.push({ n, file, title, links: st.links.map((l) => l.text + ' -> ' + l.href), console: errs.length, requests: reqs.length }); await p.close();
}
await b.close(); fs.writeFileSync('series_result.json', JSON.stringify({ out, fails }, null, 1));
console.log('fails:', fails.length ? fails : 'none'); console.log(JSON.stringify(out, null, 1).slice(0, 4200));
