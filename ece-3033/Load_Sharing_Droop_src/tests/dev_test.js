// Developer tests for Load Sharing Droop v2.0.0 (not acceptance). Usage: node dev_test.js [file.html] [--shots dir]
// Reads the built page in headless Chromium (Playwright) and checks: every spec §5 value as shown (expected strings come from
// check_values.py, an independent recomputation), layout at four window sizes, narration, Lab, Experiments, worksheet, console and network.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FILE = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', '..', 'Load_Sharing_Droop_v2.0.0.html'));
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
  const squash = s => s.replace(/\s+/g, ' ');
  const has = async (pg, name, ...needles) => { const t = squash(await shown(pg)); const miss = needles.filter(n => !t.includes(n)); ok(!miss.length, name + ': shows ' + needles.join(', '), 'missing ' + miss.join(', ')); };
  const slide = async (pg, n) => { for (;;) { const cur = +(await pg.textContent('#slPos')).match(/(\d+)\//)[1]; if (cur === n) break; await pg.click(cur < n ? '#slNext' : '#slPrev'); } };
  const lineTo = async (pg, n) => { for (;;) { const cur = +(await pg.textContent('#lineNo')).match(/(\d+)\//)[1]; if (cur === n) break; await pg.click(cur < n ? '#next' : '#prev'); } };
  const lines = async pg => +(await pg.textContent('#lineNo')).split('/')[1];
  const setR = async (pg, sel, v) => { await pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input')); }, [sel, v]); };
  const range = (pg, n) => `#ctl .ctlrow:nth-of-type(${n}) input`;
  const lab = n => `#labCtl .ctlrow:nth-of-type(${n}) input`;   // 1 load, 2 area load, 3–5 set points, 6–8 droops

  /* ── 1. Spec §5 values, as shown ── */
  let pg = await open(1366, 768);
  const html = fs.readFileSync(FILE, 'utf8');
  ok(/Version: v2\.0\.0/.test(html) && /name="version" content="v2\.0\.0"/.test(html) && /<title>[^<]*v2\.0\.0<\/title>/.test(html) && (await pg.textContent('.badge')).includes('v2.0.0') && path.basename(FILE).includes('v2.0.0'), 'version agrees in file name, comment, meta, title and badge');
  await slide(pg, 1); await lineTo(pg, 4); await has(pg, 'slide 1 points', 'fnl = ' + EXP.s1[0], 'ffl = ' + EXP.s1[1], EXP.s1[2], 'sP ' + EXP.s1[3]);
  await lineTo(pg, 1); ok(!squash(await shown(pg)).includes('ffl = 59.22 Hz (1,777'), 'slide 1 line 1: the points and bracket wait for line 4');
  await lineTo(pg, 4); await setR(pg, range(pg, 1), 50); await has(pg, 'slide 1 at 50 MW', '= ' + EXP.s1[4], 'shaft ' + EXP.s1[5]);
  await setR(pg, range(pg, 2), 62); await setR(pg, range(pg, 3), 5); await has(pg, 'slide 1 at 62.00 Hz, 5.0 %: still on the plot', 'fnl = 62.00 Hz');
  await setR(pg, range(pg, 2), 60.2); await has(pg, 'slide 1 at 60.20 Hz, 5.0 %: full load below the plot is said', 'below the plot', 'Below the plot\'s 58 Hz: full load');
  await slide(pg, 2); await has(pg, 'slide 2 line 1', EXP.s2[0][1], 'bus ' + EXP.s2[0][2]);
  await lineTo(pg, 3); await has(pg, 'slide 2 line 3', 'fnl = ' + EXP.s2[1][0], EXP.s2[1][1], 'bus ' + EXP.s2[1][2]);
  await lineTo(pg, 5); await has(pg, 'slide 2 line 5', 'fnl = ' + EXP.s2[2][0], EXP.s2[2][1], 'bus ' + EXP.s2[2][2], 'reverse power. It would run as a motor');
  for (let n = 0; n < 5; n++) await pg.click('#ctl .ctlrow:nth-of-type(1) .fine >> nth=1'); await has(pg, 'slide 2: five presses of + move the set point by 0.005 Hz', 'fnl = 59.81 Hz', 'PG1 = −11.0 MW');
  await slide(pg, 3); await lineTo(pg, 1); ok(!squash(await shown(pg)).includes('fsys = 60.14'), 'slide 3 line 1: no load marker');
  await lineTo(pg, 4); await has(pg, 'slide 3 at 150 MW', 'fsys = ' + EXP.s3[0], ...EXP.s3[1].map(v => 'P ' + v + ' MW'), 'Load 150.0 MW = ' + EXP.s3[1].join(' + '));
  await lineTo(pg, 6); await has(pg, 'slide 3 after the step', 'fsys = ' + EXP.s3[2], ...EXP.s3[3].map(v => 'P ' + v + ' MW'), ...EXP.s3[4].map(v => 'ΔP ' + v), 'before: ' + EXP.s3[0]);
  await setR(pg, range(pg, 1), 280); await has(pg, 'slide 3 load slider', 'Load 280.0 MW');
  await slide(pg, 4); await lineTo(pg, 1); await has(pg, 'slide 4 start', 'fsys = ' + EXP.s3[2]);
  await lineTo(pg, 5); await has(pg, 'slide 4 end', 'fsys = ' + EXP.s4[0], ...EXP.s4[1].map(v => 'P ' + v + ' MW'), '✓ back at 60 Hz', '61.34 Hz');
  await pg.click('text=Reset set points'); await has(pg, 'slide 4 Reset', 'fsys = ' + EXP.s3[2]);
  await slide(pg, 5); await lineTo(pg, 5); await has(pg, 'slide 5 worked case', EXP.s5[0] + ' MW/Hz', EXP.s5[1], EXP.s5[2].join(' / '), '= ' + EXP.s5[3] + ' MW', '= ' + EXP.s5[4] + ' MW', '= ' + EXP.s5[5] + ' MW', EXP.s5[6]);
  await lineTo(pg, 2); ok(await pg.evaluate(() => [...document.querySelectorAll('table.steps tr')].map(r => r.className).join(',')) === ',lit,wait,wait,wait', 'slide 5: one row lit per line, later rows hidden');
  await slide(pg, 6); ok(await pg.evaluate(() => document.querySelectorAll('.kcard math').length) === 8 && await pg.evaluate(() => document.querySelectorAll('.kcard.on').length) === 4, 'slide 6: eight equation cards, left column lit on line 1');
  await lineTo(pg, 3); ok(await pg.evaluate(() => document.querySelectorAll('.kcard.on').length) === 8 && await pg.evaluate(() => !!document.querySelector('.kcard.wide.ring')), 'slide 6 line 3: all cards lit, the infinite-bus card ringed');
  const body = (await pg.evaluate(() => document.documentElement.textContent)).replace(/data:audio[^"']*/g, '');
  ok(!/textbook|chapman|homework|\bHW\b|problem 4|governor droops/i.test(body), 'no textbook, homework or "governor droops" wording');
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|speechSynthesis/.test(html.replace(/data:audio[^"']*/g, '')), 'no innerHTML, document.write, eval or speechSynthesis in the file');
  ok(/governor on the prime mover/i.test(body.slice(body.search(/governor/i) - 4, body.search(/governor/i) + 30)), 'first mention: "the governor on the prime mover"');

  /* ── 2. Lab ── */
  await pg.click('button[data-page=lab]'); await has(pg, 'Lab start', 'fsys 60.14 Hz', EXP.s3[1].join(' / ') + ' MW', '56.3 / 42.3 / 67.4 MW/Hz');
  await setR(pg, lab(1), 300); await has(pg, 'Lab at 300 MW: rating and frequency warnings', 'G3 is at', 'above its 100 MW rating.', 'a set point must move.');
  await pg.click('#labBtns >> text=Reset'); ok(!(await shown(pg)).includes('rating.'), 'Lab Reset clears the warnings');
  await pg.click('#modeBus'); await has(pg, 'Lab on the bus', 'infinite bus 60.00 Hz', '60.00 Hz (held)', '56.3 / 93.7 MW');
  ok(await pg.evaluate(() => document.querySelectorAll('#labCtl .ctlrow:not([hidden])').length) === 3, 'Lab on the bus: area load, G1 set point and G1 droop only');
  await setR(pg, lab(3), 59.8); await has(pg, 'Lab bus reverse power', 'G1 is at −11.3 MW: reverse power');
  await pg.click('#modeIso'); ok(await pg.evaluate(() => document.querySelectorAll('#labCtl .ctlrow:not([hidden])').length) === 7, 'Lab isolated: load, three set points, three droops');
  await pg.click('#labBtns >> text=Listen'); await pg.waitForTimeout(700); ok((await pg.textContent('#labNo')).startsWith('1/3') && (await pg.textContent('#labCap')).startsWith('This is the Lab'), 'Lab Listen starts line 1 of 3 with its caption');
  await setR(pg, lab(1), 200); await pg.waitForTimeout(200); ok((await pg.textContent('#labBtns')).includes('Stop'), 'a Lab control does not stop Listen');
  await pg.click('button[data-page=exp]'); await pg.click('button[data-page=lab]'); ok((await pg.textContent('#labBtns')).includes('▶ Listen') && (await pg.textContent('#labCap')) === '', 'changing tab stops Listen');

  /* ── 3. Experiments and worksheet ── */
  await pg.click('button[data-page=exp]');
  const cards = await pg.evaluate(() => [...document.querySelectorAll('.exp-card h3')].map(h => h.textContent)); ok(cards.length === 5 && cards[4] === 'Your turn', 'five experiment cards, E5 is Your turn');
  for (let n = 1; n <= 4; n++) await pg.click(`.exp-card:nth-of-type(${n}) >> text=Show answer`);
  await has(pg, 'E1–E4 answers', 'ΔP G1 ' + EXP.e1[0] + ', G2 ' + EXP.e1[1] + ', G3 ' + EXP.e1[2], 'G3 took ' + EXP.e1[3], 'G1 alone ' + EXP.e2[0] + ' MW, G2 alone ' + EXP.e2[1] + ' MW, G3 alone ' + EXP.e2[2] + ' MW', '= ' + EXP.e3[0], EXP.e4[0] + ' reaches 100 MW first, at a load of ' + EXP.e4[1] + ' (' + EXP.e4[2] + ')');
  await pg.click('.exp-card:nth-of-type(1) >> text=Set up the Lab'); await has(pg, 'E1 Set up the Lab', '56.3 / 42.3 / 34.5 MW/Hz', '5.0 %');
  await pg.click('button[data-page=exp]'); await pg.click('.exp-card:nth-of-type(3) >> text=Set up the Lab'); await has(pg, 'E3 Set up the Lab (bus)', 'infinite bus 60.00 Hz');
  await setR(pg, lab(3), 60); await has(pg, 'E3 in the Lab at 60.00 Hz', 'PG1 = 0.0 MW');
  await pg.click('button[data-page=exp]'); await pg.click('.exp-card:nth-of-type(4) >> text=Set up the Lab'); await setR(pg, lab(1), 287); await has(pg, 'E4 in the Lab at 287 MW', '100.0 MW', 'fsys 59.32 Hz');
  await pg.click('button[data-page=exp]'); await pg.click('#e5 >> text=Check'); ok((await pg.textContent('#turnMsg')).startsWith('Fill in'), 'E5: empty boxes are refused and named');
  const fill = async vals => { const ins = await pg.$$('#e5 .grid6 input'); for (let i = 0; i < 4; i++) await ins[i].fill(String(vals[i])); await pg.click('#e5 >> text=Check'); return pg.textContent('#turnMsg'); };
  ok((await fill(['59.60', 'abc', '80.3', '80.9'])).includes('Not a number: P1'), 'E5: a non-number is refused and named');
  ok((await fill([EXP.e5[0].split(' ')[0], ...EXP.e5[1]])) === 'All four correct.', 'E5: the values as printed are accepted');
  await has(pg, 'E5 solution', EXP.e5[0] + ': below 60 Hz', 'P1 = ' + EXP.e5[1][0] + ' MW, P2 = ' + EXP.e5[1][1] + ' MW, P3 = ' + EXP.e5[1][2] + ' MW');
  const raw = EXP.e5_raw, tol = [0.01, 0.5, 0.5, 0.5];
  for (let i = 0; i < 4; i++) { const inside = raw.map((v, k) => k === i ? v + tol[k] * 0.9 : v), outside = raw.map((v, k) => k === i ? v + tol[k] * 1.25 : v);
    ok((await fill(inside.map(v => v.toFixed(4)))) === 'All four correct.' && (await fill(outside.map(v => v.toFixed(4)))).startsWith('Check'), 'E5 tolerance ' + tol[i] + ' on answer ' + (i + 1)); }
  await pg.fill('[data-k=e1]', 'less; G3 softer'); ok((await pg.textContent('#sheetStatus')).includes('Saved'), 'worksheet saves');
  ok(await pg.evaluate(() => Object.keys(localStorage).join(',')) === 'load-sharing-droop-worksheet-v2', 'only the worksheet key in localStorage');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#exportBtn')]); const txt = fs.readFileSync(await dl.path(), 'utf8'); ok(txt.includes('less; G3 softer') && txt.includes('v2.0.0') && txt.includes('[e5p1]'), 'export holds the answers');
  await pg.evaluate(() => localStorage.setItem('load-sharing-droop-worksheet-v2', JSON.stringify({ e1: 'kept', bogus: 'x', e2: 5 }))); await pg.reload(); await pg.click('button[data-page=exp]');
  ok((await pg.inputValue('[data-k=e1]')) === 'kept' && (await pg.textContent('#sheetStatus')).includes('2 stored entries were invalid'), 'a stored record is validated: bad entries are refused and named');
  ok(pg.errs.length === 0 && pg.reqs.length === 0, 'console errors 0, network requests 0 (values, Lab, Experiments)', pg.errs.concat(pg.reqs).join(' | '));
  await pg.close();

  /* ── 4. Narration ── */
  pg = await open(1366, 768);
  const clips = await pg.evaluate(() => { const m = document.querySelector('script').textContent.match(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g); return [m.length, m.every(c => c.length > 20000)]; });
  ok(clips[0] === 38 && clips[1], '38 embedded clips, none empty');
  await pg.click('#play'); await pg.waitForTimeout(2500);
  const st = await pg.evaluate(() => [document.getElementById('play').textContent, parseFloat(document.getElementById('bar').style.width), document.getElementById('voice').textContent, document.querySelector('#side .voiceMsg').hidden]);
  ok(st[0].includes('Pause') && st[1] > 0, 'Play narration runs (' + st[2] + (st[3] ? '' : ', timed captions after the voice could not start') + ')', st.join(' / '));
  await pg.click('#play'); ok((await pg.textContent('#play')).includes('Play'), 'Pause stops it');
  await pg.click('#voice'); if ((await pg.textContent('#voice')) !== 'voice off') await pg.click('#voice');
  await slide(pg, 6); await pg.click('#play'); await pg.waitForFunction(() => document.getElementById('lineNo').textContent.startsWith('line 2'), null, { timeout: 30000 }); ok(true, 'voice off: timed captions advance to the next line');
  await pg.waitForFunction(() => document.getElementById('play').textContent.includes('Play') && document.getElementById('lineNo').textContent.startsWith('line 3'), null, { timeout: 60000 }); ok(true, 'narration stops at the end of the slide');
  await slide(pg, 1); await lineTo(pg, 3); await pg.click('#play'); const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < 20000 && (await pg.textContent('#lineNo')).startsWith('line 3')) { seen.push(parseFloat(await pg.textContent('#ctl .ctlrow:nth-of-type(1) .val'))); await pg.waitForTimeout(250); }
  ok(seen[0] === 0 && Math.max(...seen) === 100 && seen.some(v => v > 10 && v < 90) && seen.every((v, i) => i === 0 || v >= seen[i - 1]), 'slide 1 line 3: the load rises smoothly from 0 to 100 MW over the line', seen.join(' '));
  await pg.waitForTimeout(600); await setR(pg, range(pg, 1), 40); ok((await pg.textContent('#play')).includes('Play'), 'using a Lecture control pauses the narration');
  await pg.click('button[data-page=exp]'); await pg.click('.exp-card:nth-of-type(2) >> text=Listen'); await pg.waitForTimeout(400); ok((await pg.textContent('.exp-card:nth-of-type(2) .btns')).includes('Stop'), 'an Experiment card Listen plays');
  await pg.click('.exp-card:nth-of-type(2) >> text=Stop'); ok((await pg.textContent('.exp-card:nth-of-type(2) .btns')).includes('▶ Listen'), 'and stops');
  ok(pg.errs.length === 0 && pg.reqs.length === 0, 'console errors 0, network requests 0 (narration)', pg.errs.concat(pg.reqs).join(' | '));
  await pg.close();

  /* ── 5. Layout at four window sizes: every slide, every line, slider ends; the Lab in both modes; Experiments ── */
  for (const [w, h, tag] of SIZES) {
    pg = await open(w, h); let bad = [], small = 99, states = 0, smallAt = '';
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
      r[0].forEach(x => bad.push(name + ': ' + x)); if (r[1] < small) { small = r[1]; smallAt = name; }
    };
    const shot = async name => { if (SHOTS && (tag === '1366x768' || tag === '125pct')) await pg.screenshot({ path: path.join(SHOTS, tag + '_' + name + '.png'), fullPage: name.startsWith('lab') || name === 'experiment5' }); };
    for (let s = 1; s <= 6; s++) { await slide(pg, s); const n = await lines(pg); for (let i = 1; i <= n; i++) { await lineTo(pg, i); await probe('slide ' + s + ' line ' + i); } await shot('slide' + s);
      const k = await pg.evaluate(() => document.querySelectorAll('#ctl input[type=range]').length);
      for (let c = 1; c <= k; c++) for (const end of ['min', 'max']) { const v = await pg.evaluate(([sel, end]) => document.querySelector(sel)[end], [range(pg, c), end]); await setR(pg, range(pg, c), v); await probe('slide ' + s + ' slider ' + c + ' at ' + v); }
      if (s === 1) for (const [fn, sd, L] of [[60.2, 5, 110], [62, 1.5, 0], [62, 5, 110], [60.2, 1.5, 0], [60.5, 3, 60]]) { await setR(pg, range(pg, 2), fn); await setR(pg, range(pg, 3), sd); await setR(pg, range(pg, 1), L); await probe('slide 1 at ' + fn + ' Hz ' + sd + ' % ' + L + ' MW'); }
      if (s === 2) for (const fn of [60, 60.1, 60.2, 60.3, 60.4, 59.9, 61.4, 62]) { await setR(pg, range(pg, 1), fn); await probe('slide 2 at ' + fn + ' Hz'); }
      if (s === 4) for (const [a, b, c] of [[60, 62, 60], [62, 60, 62], [60, 60, 60], [62, 62, 62], [61, 61, 61]]) { await setR(pg, range(pg, 1), a); await setR(pg, range(pg, 2), b); await setR(pg, range(pg, 3), c); await probe('slide 4 at ' + [a, b, c].join('/')); } }
    await pg.click('button[data-page=lab]'); await pg.waitForTimeout(150); await probe('Lab start'); await shot('lab');
    for (const [c, v] of [[1, 0], [1, 300], [3, 59.5], [4, 62], [5, 59.5], [6, 5], [7, 1.5], [8, 5], [1, 150], [3, 62], [4, 59.5], [5, 62], [1, 0]]) { await setR(pg, lab(c), v); await probe('Lab control ' + c + ' at ' + v); }
    await pg.click('#labBtns >> text=Reset'); await pg.click('#modeBus'); await probe('Lab bus start'); await shot('lab_bus');
    for (const [c, v] of [[2, 0], [2, 250], [3, 59.5], [3, 62], [6, 1.5], [6, 5], [3, 60.1], [2, 0]]) { await setR(pg, lab(c), v); await probe('Lab bus control ' + c + ' at ' + v); }
    const labSmall = small; const labScroll = await pg.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
    await pg.click('button[data-page=exp]'); const ins = await pg.$$('#e5 .grid6 input'); const vals = ['59.60', '78.8', '80.3', '80.9']; for (let i = 0; i < 4; i++) await ins[i].fill(vals[i]); await pg.click('#e5 >> text=Check');
    const expBad = await pg.evaluate(() => [...document.querySelectorAll('.exp-card, .exp-card *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length + (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0));
    await pg.locator('#e5').scrollIntoViewIfNeeded(); await shot('experiment5');
    ok(bad.length === 0, tag + ': ' + states + ' states, no Lecture scrollbar, no clipped or overlapping figure text', '\n   ' + [...new Set(bad)].slice(0, 25).join('\n   '));
    ok(small >= MIN_PX, tag + ': smallest figure text ' + small.toFixed(1) + ' px (Lecture and Lab), at least ' + MIN_PX + ' px' + (labScroll ? '; the Lab page scrolls at this width' : ''), labSmall.toFixed(1) + ' px at ' + smallAt);
    ok(expBad === 0, tag + ': Experiments page has no sideways overflow');
    ok(pg.errs.length === 0 && pg.reqs.length === 0, tag + ': console errors 0, network requests 0', pg.errs.concat(pg.reqs).join(' | '));
    await pg.close();
  }
  await br.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
