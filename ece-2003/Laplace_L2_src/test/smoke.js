// smoke: load, start, pause, step every beat by hand; report console errors, requests, focus-line counts, overflow
const { chromium } = require('playwright');
const file = process.argv[2], shots = process.argv[3], zoom = parseFloat(process.argv[4] || '1'), reduced = process.argv[5] === 'reduced';
(async () => {
  const br = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await br.newContext({ viewport: { width: Math.round(1366 / zoom), height: Math.round(768 / zoom) }, deviceScaleFactor: zoom, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [], reqs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) reqs.push(r.url()); });
  await page.goto('file://' + file);
  await page.waitForSelector('[data-card="opening"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: shots + '/00_opening.png' });
  const run = await page.textContent('[data-running-time]');
  await page.click('text=▶ Start');
  await page.waitForTimeout(6500);
  await page.click('[aria-label="Pause"]');
  const out = [];
  // go to first beat by hand: seek slider Home then next/prev
  const total = 41;
  for (let i = 0; i < total; i++) {
    if (i === 0) { for (let k = 0; k < 6; k++) await page.click('[aria-label="previous line"]'); }
    else await page.click('[aria-label="next line"]');
    await page.waitForTimeout(120);
    const info = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const f = [...document.querySelectorAll('[data-focus]')].filter(vis);
      const st = document.getElementById('stage').getBoundingClientRect(), k = 1280 / st.width;
      const over = [];
      document.querySelectorAll('[data-gate]').forEach((p) => {
        const pr = p.getBoundingClientRect();
        if (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1) over.push(p.getAttribute('data-gate') + ' scroll ' + p.scrollWidth + 'x' + p.scrollHeight + ' > ' + p.clientWidth + 'x' + p.clientHeight);
      });
      let minFs = 99, minEl = '';
      document.querySelectorAll('#stage *').forEach((e) => { if (!vis(e)) return; const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) return; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < minFs) { minFs = fs; minEl = e.textContent.slice(0, 30); } });
      const fl = f[0]; const ffs = fl ? parseFloat(getComputedStyle(fl).fontSize) : 0;
      const slots = [...document.querySelectorAll('[data-tape]')].map((e) => e.getAttribute('data-tape') + '=' + e.textContent).join(' | ');
      return { focus: f.map((e) => e.getAttribute('data-focus')).join(','), n: f.length, ffs, text: fl ? fl.textContent : '', over, minFs, minEl, slots, step: (document.querySelector('[data-step]') || {}).textContent };
    });
    out.push(info);
    await page.screenshot({ path: shots + '/b' + String(i).padStart(2, '0') + '_' + info.focus + '.png' });
  }
  console.log('running time:', run);
  for (const [i, o] of out.entries()) console.log(i, o.focus, 'n=' + o.n, 'fs=' + o.ffs, 'min=' + o.minFs + (o.minFs < 13 ? '[' + o.minEl + ']' : ''), JSON.stringify(o.text), o.slots, o.over.join('; '));
  console.log('ERRORS', errs.length, errs.slice(0, 8)); console.log('REQUESTS', reqs.length, reqs.slice(0, 5));
  await br.close();
})();
