// Developer tests for Two Generators PQ v2.0.0 (not acceptance). Usage: node dev_test.js [file.html] [--shots dir]
// Reads the built page in headless Chromium (Playwright) and checks: every spec §5 value as shown (expected strings come from
// check_values.py, an independent recomputation), layout at four window sizes, narration, Lab, Experiments, worksheet, console and network.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FILE = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', '..', 'Two_Generators_PQ_v2.0.0.html'));
const SHOTS = process.argv.includes('--shots') ? path.resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;
const SIZES = [[1366, 768, '1366x768'], [1093, 614, '125pct'], [1024, 768, '1024x768'], [1920, 1080, '1920x1080']];
const MIN_PX = 11;                        // least figure text size, CSS px (spec §7)
const EXP = JSON.parse(execFileSync('python3', ['-I', path.join(__dirname, 'check_values.py')], { encoding: 'utf8' }));
let fails = 0;
const ok = (c, name, got) => { console.log((c ? 'PASS ' : 'FAIL ') + name + (c || got === undefined ? '' : '  → ' + got)); if (!c) fails++; };

(async () => {
  const br = await chromium.launch();
  const open = async (w, h, opts) => {
    const pg = await br.newPage(Object.assign({ viewport: { width: w, height: h } }, opts || {}));
    pg.errs = []; pg.reqs = [];
    pg.on('console', m => { if (m.type() === 'error') pg.errs.push(m.text()); }); pg.on('pageerror', e => pg.errs.push(String(e)));
    pg.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) pg.reqs.push(r.url()); });
    await pg.goto('file://' + FILE); await pg.waitForTimeout(250);
    return pg;
  };
  // All text now on screen: HTML text plus the text of every visible SVG label (subscripts joined to their letters).
  const shown = pg => pg.evaluate(() => { const vis = e => e.getClientRects().length > 0; return [...document.querySelectorAll('main:not([hidden]) svg text, section:not([hidden]) svg text')].filter(vis).map(t => t.textContent).join(' | ') + ' | ' + document.body.innerText.replace(/\s+/g, ' '); });
  const squash = s => s.replace(/[₁₂]/g, m => (m === '₁' ? '1' : '2')).replace(/\s+/g, ' ');
  const has = async (pg, name, ...needles) => { const t = squash(await shown(pg)); const miss = needles.filter(n => !t.includes(n)); ok(!miss.length, name + ': shows ' + needles.join(', '), 'missing ' + miss.join(', ')); };
  const slide = async (pg, n) => { for (;;) { const cur = +(await pg.textContent('#slPos')).match(/(\d+)\//)[1]; if (cur === n) break; await pg.click(cur < n ? '#slNext' : '#slPrev'); } };
  const lineTo = async (pg, n) => { for (;;) { const cur = +(await pg.textContent('#lineNo')).match(/(\d+)\//)[1]; if (cur === n) break; await pg.click(cur < n ? '#next' : '#prev'); } };
  const lines = async pg => +(await pg.textContent('#lineNo')).split('/')[1];
  const setR = async (pg, sel, v) => { await pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input')); }, [sel, v]); };
  const range = (pg, n) => `#ctl .ctlrow:nth-of-type(${n}) input`;

  /* ── 1. Spec §5 values, as shown ── */
  let pg = await open(1366, 768);
  const html = fs.readFileSync(FILE, 'utf8');
  ok(/Version: v2\.0\.0/.test(html) && /name="version" content="v2\.0\.0"/.test(html) && /<title>[^<]*v2\.0\.0<\/title>/.test(html) && (await pg.textContent('.badge')).includes('v2.0.0') && path.basename(FILE).includes('v2.0.0'), 'version agrees in file name, comment, meta, title and badge');
  await slide(pg, 1); await lineTo(pg, 3); await has(pg, 'slide 1 at 5.0 MW', 'fsys ' + EXP.s1_5[0], 'P1 = ' + EXP.s1_5[1], 'P2 = ' + EXP.s1_5[1], 'walls 5.0 MW apart');
  await lineTo(pg, 4); await has(pg, 'slide 1 at 7.0 MW', 'fsys ' + EXP.s1_7[0], 'P1 = ' + EXP.s1_7[1], 'walls 7.0 MW apart');
  await lineTo(pg, 5); await has(pg, 'slide 1 at 3.0 MW', 'fsys ' + EXP.s1_3[0], 'walls 3.0 MW apart');
  await lineTo(pg, 1); ok(!(squash(await shown(pg))).includes('fsys 5'), 'slide 1 lines 1–2 show the walls only');
  await setR(pg, range(pg, 1), 6.3); await has(pg, 'slide 1 load slider', 'walls 6.3 MW apart', '6.3 MW');
  await slide(pg, 2); await has(pg, 'slide 2 line 1', 'fnl,1 61.00 Hz', 'fnl,2 61.00 Hz', 'fsys 59.89 Hz');
  await lineTo(pg, 3); await has(pg, 'slide 2, G1 at 61.24 only', 'fnl,1 61.24 Hz', 'fsys ' + EXP.s2_g1[0], 'P1 = ' + EXP.s2_g1[1], 'P2 = ' + EXP.s2_g1[2]);
  await lineTo(pg, 6); await has(pg, 'slide 2, 61.24 / 60.98', 'fnl,2 60.98 Hz', 'fsys ' + EXP.s2_both[0], 'P1 = ' + EXP.s2_both[1], 'P2 = ' + EXP.s2_both[2], EXP.s2_both[3] + ' Hz', '✓ at 60 Hz');
  await pg.click('#ctl .ctlrow:nth-of-type(1) .fine >> nth=1'); ok(Math.abs(await pg.evaluate(() => +document.querySelector('#ctl .ctlrow input').value) - 61.25) < 0.011, 'slide 2: + moves G1 set point by 0.001 Hz');
  await pg.click('text=Reset set points'); await has(pg, 'slide 2 Reset', 'fnl,1 61.00 Hz', 'fnl,2 61.00 Hz');
  await slide(pg, 3); await lineTo(pg, 6); await has(pg, 'slide 3 at 2.8 MW, 0.90 lag', ...EXP.s3.map((v, i) => ['IL ', 'IA1 ', 'IA2 ', 'EA1 ', 'EA2 '][i] + v), 'KCL at the node');
  await lineTo(pg, 7); await has(pg, 'slide 3 at unity', 'IA1 ' + EXP.s3_unity[0], 'IA2 ' + EXP.s3_unity[1], 'G2 is at ' + EXP.s3_unity[2] + ', above its 4 MVA rating.', 'EA1 ' + EXP.s3_unity[3], 'EA2 ' + EXP.s3_unity[4]);
  for (const [n, parts] of [[1, []], [3, ['IL 867']], [4, ['IA1 431']], [5, ['IA2 451']]]) { await lineTo(pg, n); const t = squash(await shown(pg)); ok(parts.every(p => t.includes(p)) && !t.includes('EA1 3,') && (n >= 3 || !t.includes('IL 867')), 'slide 3 line ' + n + ' builds its part only'); }
  await slide(pg, 4); await lineTo(pg, 3); await has(pg, 'slide 4 start', EXP.s4_start[0], EXP.s4_start[1], '3.75 Mvar', 'P1 = 2.8 MW line', 'P2 = 2.2 MW line');
  await lineTo(pg, 5); await has(pg, 'slide 4 at Q1 2.5', 'Q1 2.5', EXP.s4_moved[0], 'EA1 ' + EXP.s4_moved[1], 'EA2 ' + EXP.s4_moved[2], 'pf ' + EXP.s4_moved[3], 'pf ' + EXP.s4_moved[4]);
  await setR(pg, range(pg, 1), 3.25); await has(pg, 'slide 4 rating warning at Q1 3.25', 'G1 is at 4.3 MVA, above its 4 MVA rating.');
  await slide(pg, 5); await lineTo(pg, 5); await has(pg, 'slide 5 worked case', ...EXP.s5);
  await lineTo(pg, 2); ok(await pg.evaluate(() => [...document.querySelectorAll('table.steps tr')].map(r => r.className).join(',')) === ',lit,wait,wait,wait', 'slide 5: one row lit per line, later rows hidden');
  await slide(pg, 6); ok(await pg.evaluate(() => document.querySelectorAll('.kcard math').length) === 10 && await pg.evaluate(() => document.querySelectorAll('.kcard.on').length) === 5, 'slide 6: ten equation cards, left column lit on line 1');
  await lineTo(pg, 3); ok(await pg.evaluate(() => document.querySelectorAll('.kcard.on').length) === 10, 'slide 6 line 3: all cards lit');
  const body = (await pg.evaluate(() => document.documentElement.textContent)).replace(/data:audio[^"']*/g, '');
  ok(!/one phase|textbook|chapman|homework|\bHW\b/i.test(body), 'no "one phase", textbook or homework wording');
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|speechSynthesis/.test(html.replace(/data:audio[^"']*/g, '')), 'no innerHTML, document.write, eval or speechSynthesis in the file');
  ok((body.match(/governor/gi) || []).every((_, i, a) => true) && /governor set points on the prime movers/i.test(body), '"governor" appears tied to the prime movers');

  /* ── 2. Lab ── */
  await pg.click('button[data-page=lab]'); await has(pg, 'Lab start', 'fsys 60.00 Hz', '61.24 Hz', '60.98 Hz', '2.8 / 2.2 MW', '1.4 / 2.4 Mvar', '0.90 lag');
  await setR(pg, '#labCtl .ctlrow:nth-of-type(4) input', 5.25); await has(pg, 'Lab rating warning', 'G1 is at', 'above its 4 MVA rating.');
  await setR(pg, '#labCtl .ctlrow:nth-of-type(2) input', 60.5); await setR(pg, '#labCtl .ctlrow:nth-of-type(3) input', 61.8); await setR(pg, '#labCtl .ctlrow:nth-of-type(1) input', 3); await has(pg, 'Lab at its most unequal split (P1 stays above 0, so no motoring warning can show)', '0.0 / 3.0 MW');
  await pg.click('#labBtns >> text=Reset'); await has(pg, 'Lab Reset', 'fsys 60.00 Hz', '2.8 / 2.2 MW'); ok(!(await shown(pg)).includes('rating.'), 'Lab Reset clears the warnings');
  await pg.click('#labBtns >> text=Listen'); await pg.waitForTimeout(700); ok((await pg.textContent('#labNo')).startsWith('1/3') && (await pg.textContent('#labCap')).startsWith('The Lab puts both pictures'), 'Lab Listen starts line 1 of 3 with its caption');
  await setR(pg, '#labCtl .ctlrow:nth-of-type(1) input', 6); await pg.waitForTimeout(200); ok((await pg.textContent('#labBtns')).includes('Stop'), 'a Lab control does not stop Listen');
  await pg.click('button[data-page=exp]'); await pg.click('button[data-page=lab]'); ok((await pg.textContent('#labBtns')).includes('▶ Listen') && (await pg.textContent('#labCap')) === '', 'changing tab stops Listen');

  /* ── 3. Experiments and worksheet ── */
  await pg.click('button[data-page=exp]');
  const cards = await pg.evaluate(() => [...document.querySelectorAll('.exp-card h3')].map(h => h.textContent)); ok(cards.length === 5 && cards[4] === 'Your turn', 'five experiment cards, E5 is Your turn');
  for (let n = 1; n <= 4; n++) await pg.click(`.exp-card:nth-of-type(${n}) >> text=Show answer`);
  await has(pg, 'E1–E4 answers', EXP.e1[0], 'P1 = P2 = ' + EXP.e1[1], EXP.e2[1] + ' Hz', EXP.e2[0] + ' each', 'Both at ' + EXP.e3[0], '|EA1| = ' + EXP.e3[2], 'between ' + EXP.e4[0] + ' and ' + EXP.e4[1] + ' Mvar');
  await pg.click('.exp-card:nth-of-type(1) >> text=Set up the Lab'); await has(pg, 'E1 Set up the Lab', 'fsys ' + EXP.e1[0], '3.0 / 3.0 MW', 'walls 6.0 MW apart');
  await pg.click('button[data-page=exp]'); await pg.click('.exp-card:nth-of-type(3) >> text=Set up the Lab'); await setR(pg, '#labCtl .ctlrow:nth-of-type(4) input', 2.1); await has(pg, 'E3 in the Lab at Q1 2.1', '0.80 lag / 0.80 lag', '4,151 /');
  await pg.click('button[data-page=exp]'); await pg.click('#e5 >> text=Check'); ok((await pg.textContent('#turnMsg')).startsWith('Fill in'), 'E5: empty boxes are refused and named');
  const fill = async vals => { const ins = await pg.$$('#e5 .grid6 input'); for (let i = 0; i < 6; i++) await ins[i].fill(String(vals[i])); await pg.click('#e5 >> text=Check'); return pg.textContent('#turnMsg'); };
  ok((await fill(['2.4', 'abc', '0.70', '472.9', '4229', '19.8'])).includes('Not a number: Q2'), 'E5: a non-number is refused and named');
  ok((await fill(['2.4', '2.4', '0.70', '472.9', '4,229', '19.8'])) === 'All six correct.', 'E5: the values as printed are accepted (with a thousands comma)');
  await has(pg, 'E5 solution', ...EXP.e5);
  const raw = EXP.e5_raw, tol = [0.02, 0.05, 0.01, 5, 20, 0.5];
  for (let i = 0; i < 6; i++) { const inside = raw.map((v, k) => k === i ? v + tol[k] * 0.9 : v), outside = raw.map((v, k) => k === i ? v + tol[k] * 1.25 : v);
    ok((await fill(inside.map(v => v.toFixed(4)))) === 'All six correct.' && (await fill(outside.map(v => v.toFixed(4)))).startsWith('Check'), 'E5 tolerance ' + tol[i] + ' on answer ' + (i + 1)); }
  await pg.fill('[data-k=e1]', 'falls; shared equally'); ok((await pg.textContent('#sheetStatus')).includes('Saved'), 'worksheet saves');
  ok(await pg.evaluate(() => Object.keys(localStorage).join(',')) === 'two-generators-pq-worksheet-v2', 'only the worksheet key in localStorage');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#exportBtn')]); const txt = fs.readFileSync(await dl.path(), 'utf8'); ok(txt.includes('falls; shared equally') && txt.includes('v2.0.0') && txt.includes('[e5p]'), 'export holds the answers');
  await pg.evaluate(() => localStorage.setItem('two-generators-pq-worksheet-v2', JSON.stringify({ e1: 'kept', bogus: 'x', e2: 5 }))); await pg.reload(); await pg.click('button[data-page=exp]');
  ok((await pg.inputValue('[data-k=e1]')) === 'kept' && (await pg.textContent('#sheetStatus')).includes('2 stored entries were invalid'), 'a stored record is validated: bad entries are refused and named');
  ok(pg.errs.length === 0 && pg.reqs.length === 0, 'console errors 0, network requests 0 (values, Lab, Experiments)', pg.errs.concat(pg.reqs).join(' | '));
  await pg.close();

  /* ── 4. Narration ── */
  pg = await open(1366, 768);
  const clips = await pg.evaluate(() => new Promise(res => { const m = document.querySelector('script').textContent.match(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g); res([m.length, m.every(c => c.length > 20000)]); }));
  ok(clips[0] === 40 && clips[1], '40 embedded clips, none empty');
  await pg.click('#play'); await pg.waitForTimeout(2500);
  const st = await pg.evaluate(() => [document.getElementById('play').textContent, parseFloat(document.getElementById('bar').style.width), document.getElementById('voice').textContent, document.querySelector('#side .voiceMsg').hidden]);
  ok(st[0].includes('Pause') && st[1] > 0, 'Play narration runs (' + st[2] + (st[3] ? '' : ', timed captions after the voice could not start') + ')', st.join(' / '));
  await pg.click('#play'); ok((await pg.textContent('#play')).includes('Play'), 'Pause stops it');
  await pg.click('#voice'); if ((await pg.textContent('#voice')) !== 'voice off') await pg.click('#voice');
  await slide(pg, 6); await pg.click('#play'); await pg.waitForFunction(() => document.getElementById('lineNo').textContent.startsWith('line 2'), null, { timeout: 30000 }); ok(true, 'voice off: timed captions advance to the next line');
  await pg.waitForFunction(() => document.getElementById('play').textContent.includes('Play') && document.getElementById('lineNo').textContent.startsWith('line 3'), null, { timeout: 60000 }); ok(true, 'narration stops at the end of the slide');
  await slide(pg, 1); await lineTo(pg, 4); await pg.click('#play'); const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < 20000 && (await pg.textContent('#lineNo')).startsWith('line 4')) { seen.push(parseFloat((await pg.evaluate(() => [...document.querySelectorAll('#fig text')].map(t => t.textContent).find(t => t.startsWith('walls')))).split(' ')[1])); await pg.waitForTimeout(250); }
  ok(seen[0] === 5 && Math.max(...seen) === 7 && seen.some(v => v > 5.2 && v < 6.8) && seen.every((v, i) => i === 0 || v >= seen[i - 1]), 'slide 1 line 4: the load moves smoothly from 5.0 to 7.0 MW over the line', seen.join(' '));
  await pg.waitForTimeout(600); await setR(pg, range(pg, 1), 4); ok((await pg.textContent('#play')).includes('Play'), 'using a Lecture control pauses the narration');
  await pg.click('button[data-page=exp]'); await pg.click('.exp-card:nth-of-type(2) >> text=Listen'); await pg.waitForTimeout(400); ok((await pg.textContent('.exp-card:nth-of-type(2) .btns')).includes('Stop'), 'an Experiment card Listen plays');
  await pg.click('.exp-card:nth-of-type(2) >> text=Stop'); ok((await pg.textContent('.exp-card:nth-of-type(2) .btns')).includes('▶ Listen'), 'and stops');
  ok(pg.errs.length === 0 && pg.reqs.length === 0, 'console errors 0, network requests 0 (narration)', pg.errs.concat(pg.reqs).join(' | '));
  await pg.close();

  /* ── 5. Layout at four window sizes: every slide, every line, slider ends; the Lab; Experiments ── */
  for (const [w, h, tag] of SIZES) {
    pg = await open(w, h); let bad = [], small = 99, states = 0;
    const probe = async name => {
      states++;
      const r = await pg.evaluate(() => {
        const out = [], de = document.documentElement, lec = !document.getElementById('lec').hidden; let small = 99;
        const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        if (lec && (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1)) out.push('page scrolls ' + de.scrollWidth + '×' + de.scrollHeight);
        if (lec) for (const id of ['left', 'side', 'stage', 'cap']) { const e = document.getElementById(id); if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) out.push('#' + id + ' overflows ' + e.scrollWidth + '×' + e.scrollHeight + ' in ' + e.clientWidth + '×' + e.clientHeight); }
        for (const svg of document.querySelectorAll('main:not([hidden]) svg')) { if (!vis(svg)) continue;
          const S = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sc = Math.min(S.width / vb.width, S.height / vb.height), ox = S.left + (S.width - vb.width * sc) / 2, oy = S.top + (S.height - vb.height * sc) / 2;
          const T = [...svg.querySelectorAll('text')].filter(t => t.textContent && vis(t)).map(t => ({ t: t.textContent, b: t.getBoundingClientRect(), px: parseFloat(t.getAttribute('font-size')) * sc }));
          for (const a of T) { small = Math.min(small, a.px); if (a.b.left < ox - 1 || a.b.right > ox + vb.width * sc + 1 || a.b.top < oy - 1 || a.b.bottom > oy + vb.height * sc + 1) out.push('clipped "' + a.t + '"'); }
          for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i].b, b = T[j].b, ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 2 && iy > 3 && iy > 0.2 * Math.min(a.height, b.height)) out.push('overlap "' + T[i].t + '" / "' + T[j].t + '"'); } }
        return [out, small]; });
      r[0].forEach(x => bad.push(name + ': ' + x)); small = Math.min(small, r[1]);
    };
    const shot = async name => { if (SHOTS && (tag === '1366x768' || tag === '125pct')) await pg.screenshot({ path: path.join(SHOTS, tag + '_' + name + '.png'), fullPage: name === 'lab' || name === 'experiment5' }); };
    for (let s = 1; s <= 6; s++) { await slide(pg, s); const n = await lines(pg); for (let i = 1; i <= n; i++) { await lineTo(pg, i); await probe('slide ' + s + ' line ' + i); } await shot('slide' + s);
      const k = await pg.evaluate(() => document.querySelectorAll('#ctl input[type=range]').length);
      for (let c = 1; c <= k; c++) for (const end of ['min', 'max']) { const v = await pg.evaluate(([sel, end]) => document.querySelector(sel)[end], [range(pg, c), end]); await setR(pg, range(pg, c), v); await probe('slide ' + s + ' slider ' + c + ' at ' + v); }
      if (s === 3) { await setR(pg, range(pg, 1), 2.5); await setR(pg, range(pg, 2), 0.8); await probe('slide 3 equal split'); await setR(pg, range(pg, 1), 2); await setR(pg, range(pg, 2), 1); await probe('slide 3 P1 2.0 unity'); } }
    await pg.click('button[data-page=lab]'); await pg.waitForTimeout(150); await probe('Lab start'); await shot('lab');
    for (const [c, v] of [[1, 3], [1, 7], [4, 0], [4, 5.25], [2, 60.5], [3, 61.8], [2, 61.8], [3, 60.5], [1, 3], [3, 61.8], [2, 60.5], [3, 60.5]]) { await setR(pg, `#labCtl .ctlrow:nth-of-type(${c}) input`, v); await probe('Lab control ' + c + ' at ' + v); }
    const labSmall = small; const labScroll = await pg.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
    await pg.click('button[data-page=exp]'); const ins = await pg.$$('#e5 .grid6 input'); const vals = ['2.4', '2.4', '0.70', '472.9', '4229', '19.8']; for (let i = 0; i < 6; i++) await ins[i].fill(vals[i]); await pg.click('#e5 >> text=Check');
    const expBad = await pg.evaluate(() => [...document.querySelectorAll('.exp-card, .exp-card *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length + (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0));
    await pg.locator('#e5').scrollIntoViewIfNeeded(); await shot('experiment5');
    ok(bad.length === 0, tag + ': ' + states + ' states, no Lecture scrollbar, no clipped or overlapping figure text', '\n   ' + [...new Set(bad)].slice(0, 25).join('\n   '));
    ok(small >= MIN_PX, tag + ': smallest figure text ' + small.toFixed(1) + ' px (Lecture and Lab), at least ' + MIN_PX + ' px' + (labScroll ? '; the Lab page scrolls at this width' : ''), labSmall);
    ok(expBad === 0, tag + ': Experiments page has no sideways overflow');
    ok(pg.errs.length === 0 && pg.reqs.length === 0, tag + ': console errors 0, network requests 0', pg.errs.concat(pg.reqs).join(' | '));
    await pg.close();
  }
  await br.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
