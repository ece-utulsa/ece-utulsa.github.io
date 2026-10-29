/* Power Divider Designer — browser tests (Playwright, Chromium) of the built page: every page renders without console
   errors and without a network request; the in-page Tests page passes in full (acceptance tests, raster footprint,
   layout scale, timing); a seeded random walk over the Designer's controls raises no error.
   Run:  NODE_PATH=$(npm root -g) node tests/browser.test.js [path/to/Power_Divider_Designer_v2.0.0.html]
   Set CHROMIUM=/path/to/chromium to use a particular browser binary. */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const FILE = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'Power_Divider_Designer_v2.0.0.html'));
let pass = 0, fail = 0;
function check(name, ok, detail){ if(ok){ pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + JSON.stringify(detail) : '')); } }
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } }), errors = [], requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { if(!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  await page.goto('file://' + FILE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  check('light theme by default', await page.evaluate(() => !document.body.classList.contains('dark')));
  check('layout drawn with copper', await page.evaluate(() => document.querySelectorAll('#layout .el .cu').length > 3));
  for(const t of ['perf', 'params', 'theory', 'exp', 'designer']){ await page.click('#tab_' + t); await page.waitForTimeout(400);
    check('page ' + t + ' renders', await page.evaluate(t => document.getElementById('pg_' + t).innerText.length > 50, t)); }
  await page.click('#tab_tests');
  await page.waitForFunction(() => document.getElementById('testsBody').dataset.done, null, { timeout: 180000 });
  const done = await page.evaluate(() => document.getElementById('testsBody').dataset.done), [np, nt] = done.split('/').map(Number);
  check('in-page tests: ' + done + ' passed', np === nt, await page.evaluate(() => [...document.querySelectorAll('tr.tfail')].map(r => r.innerText)));
  // random walk over the Designer's controls
  await page.click('#tab_designer'); await page.waitForTimeout(200);
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for(let i = 0; i < 300; i++){
    await page.evaluate(([a, b]) => { const els = [...document.querySelectorAll('#side button, #side select, #layoutBar button, #v3bar button')]; const e = els[Math.floor(a * els.length)];
      if(e.tagName === 'SELECT'){ e.value = e.options[Math.floor(b * e.options.length)].value; e.dispatchEvent(new Event('change', { bubbles: true })); } else e.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, [rnd(), rnd()]);
  }
  await page.waitForTimeout(500);
  check('no console errors or warnings', errors.length === 0, errors.slice(0, 5));
  check('no network requests', requests.length === 0, requests.slice(0, 5));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
