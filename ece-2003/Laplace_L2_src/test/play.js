// real-time playback: sample which clip is playing and what is on screen; check nothing appears before its word (R4)
const { chromium } = require('playwright');
const fs = require('fs');
const file = process.argv[2], words = JSON.parse(fs.readFileSync(process.argv[3])), shots = process.argv[4];
// beat -> [line, word index]; slot -> beat
const W = { intro: [1, 4], table: [2, 0], tge0: [2, 13], seven: [3, 0], p_delta: [3, 6], p_u: [3, 8], p_t: [3, 10], p_exp: [3, 12], p_texp: [3, 14], p_esin: [3, 18], p_ecos: [3, 21], props: [4, 0], pr_lin: [4, 4], pr_fs: [4, 5], pr_ts: [4, 8], ref: [4, 10], lin0: [5, 0], lin1: [5, 9], lin2: [5, 20], lin3: [5, 27], lin4: [5, 32], fs0: [6, 0], fs1: [6, 17], fs1v: [6, 23], fs2: [6, 29], fs3: [6, 40], ts0: [7, 0], wave: [8, 0], w1: [8, 5], w2: [8, 10], w3: [8, 16], st0: [9, 0], st1: [9, 4], st2: [9, 8], st3: [9, 15], tr0: [9, 22], tr1: [9, 25], tr2: [9, 28], tr3: [9, 37], key: [10, 0], yt: [11, 0] };
const SLOT = { L1: 'lin2', L2: 'lin3', L3: 'lin4', F1: 'fs1v', F2: 'fs3', T1: 'tr1', T2: 'tr2', T3: 'tr3' };
(async () => {
  const br = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await br.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errs = [], reqs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) reqs.push(r.url()); });
  await page.goto('file://' + file);
  await page.waitForTimeout(600);
  await page.click('text=▶ Start');
  const firstFocus = {}, firstSlot = {}, firstRow = {}; let n = 0, maxFocus = 0, done = false;
  const t0 = Date.now();
  while (!done && Date.now() - t0 < 200000) {
    const s = await page.evaluate(() => {
      const vis = (e) => getComputedStyle(e).visibility !== 'hidden';
      const a = [...document.querySelectorAll('audio')].find((x) => !x.paused);
      return { clip: a ? a.getAttribute('data-clip') : null, ct: a ? a.currentTime : -1,
        focus: [...document.querySelectorAll('[data-focus]')].map((e) => e.getAttribute('data-focus')),
        slots: [...document.querySelectorAll('[data-tape]')].filter((e) => e.textContent !== '?').map((e) => e.getAttribute('data-tape')),
        rows: [...document.querySelectorAll('[data-view=table] [data-pair],[data-view=table] [data-prop]')].filter(vis).map((e) => e.getAttribute('data-pair') || e.getAttribute('data-prop')),
        yt: !!document.querySelector('[data-card=yourturn]'), finish: !!document.querySelector('[data-gate=finish]'), playing: !!document.querySelector('[aria-label=Pause]') };
    });
    n++; maxFocus = Math.max(maxFocus, s.focus.length);
    const line = s.clip ? parseInt(s.clip.match(/line(\d+)/)[1], 10) : 0;
    for (const f of s.focus) if (!(f in firstFocus) && line) firstFocus[f] = [line, s.ct];
    for (const k of s.slots) if (!(k in firstSlot) && line) firstSlot[k] = [line, s.ct];
    for (const r of s.rows) if (!(r in firstRow) && line) firstRow[r] = [line, s.ct];
    if (s.yt && !done && !firstFocus.__yt) { firstFocus.__yt = [line, s.ct]; await page.screenshot({ path: shots + '/yt_open.png' }); }
    if (!s.playing && n > 20) done = true;
    await page.waitForTimeout(60);
  }
  let bad = 0;
  const chk = (what, id, got, beat) => {
    const [line, wi] = W[beat], off = wi === 0 ? 0 : words[String(line)].words[wi][1];
    const early = got[0] < line || (got[0] === line && got[1] < off - 0.15), late = got[0] > line || got[1] > off + 0.6;
    if (early || late) { bad++; console.log('FAIL', what, id, 'seen at line', got[0], got[1].toFixed(2), 'word at line', line, off.toFixed(2), early ? 'EARLY' : 'LATE'); }
  };
  for (const b of Object.keys(W)) { if (b === 'yt') continue; if (!firstFocus[b]) { bad++; console.log('MISSING focus', b); } else chk('focus', b, firstFocus[b], b); }
  for (const k of Object.keys(SLOT)) { if (!firstSlot[k]) { bad++; console.log('MISSING slot', k); } else chk('slot', k, firstSlot[k], SLOT[k]); }
  const RB = { delta: 'p_delta', u: 'p_u', t: 'p_t', exp: 'p_exp', texp: 'p_texp', esin: 'p_esin', ecos: 'p_ecos', lin: 'pr_lin', fshift: 'pr_fs', tshift: 'pr_ts' };
  for (const r of Object.keys(firstRow)) chk('row', r, firstRow[r], RB[r] || 'ref');
  console.log('samples', n, 'max focus lines', maxFocus, 'rows seen', Object.keys(firstRow).length, 'yt card at', firstFocus.__yt, 'checks failed', bad);
  // end state: Your turn
  await page.screenshot({ path: shots + '/end.png' });
  console.log('finish strip', !!(await page.$('[data-gate=finish]')), 'replay', !!(await page.$('[data-gate=replay]')));
  await page.click('text=Show solution'); await page.waitForTimeout(200);
  console.log('answer:', await page.textContent('[data-yt-answer]'));
  console.log('problem:', await page.textContent('[data-yt-problem]'));
  const links = await page.$$eval('a[data-next]', (as) => as.map((a) => a.getAttribute('href')));
  console.log('links', links.map((l) => l + (fs.existsSync(process.argv[5] + '/' + l) ? ' [exists]' : ' [NOT on this branch]')));
  const over = await page.evaluate(() => [...document.querySelectorAll('[data-gate]')].filter((p) => p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1).map((p) => p.getAttribute('data-gate')));
  console.log('overflow with solution', over);
  await page.screenshot({ path: shots + '/yt_solution.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 5), 'REQUESTS', reqs.length);
  await br.close();
})();
