// Developer test for Paralleling Lab v2.0.0 (not acceptance). Drives the built page with Playwright (Chromium) through its own controls
// (no test hooks in the shipped file) and writes tests/out/dev_result.json for check_values.py, which recomputes the spec §4 values.
// Usage: node tests/dev_test.js   (from Paralleling_Lab_src/)
'use strict';
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', '..', 'Paralleling_Lab_v2.0.0.html');
const OUT = path.join(__dirname, 'out');
const SHOTS = path.join(__dirname, '..', 'release-shots', 'v2.0.0');
const SIZES = [[1366, 768, '1366x768'], [1093, 614, '125pct'], [1024, 768, '1024x768'], [1920, 1080, '1920x1080']];
const res = {checks: [], values: {}, console: [], requests: [], figText: {}};
const check = (name, ok, info) => { res.checks.push({name, ok: !!ok, info: info === undefined ? '' : String(info)}); };
const wait = (p, ms) => p.waitForTimeout(ms);
const txt = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);

// Go to slide n, line i (shown, not played): the slide pager, then the line buttons.
async function goto(p, n, i) {
  await p.evaluate(([n, i]) => { for (let k = 0; k < 9; k++) document.getElementById('slPrev').click(); for (let k = 1; k < n; k++) document.getElementById('slNext').click();
    for (let k = 0; k < i; k++) document.getElementById('nextL').click(); }, [n, i]);
}
// Read the instruments a §4 value is shown on.
async function snap(p) {
  return p.evaluate(() => { const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : ''; };
    return {surge: t('surgeTxt'), result: t('result'), rl: t('rl'), vg: t('mVg'), fg: t('mFg'), n: t('nO'), tag: t('tag'), lamps: [...document.querySelectorAll('#phases text')].filter(e => /kV$/.test(e.textContent)).map(e => e.textContent.trim()),
      day: t('itDayRo'), units: [...document.querySelectorAll('#dayG text')].map(e => e.textContent).filter(s => /MW|off|synchron/.test(s)), wk: [...document.querySelectorAll('#wk tr')].map(r => r.textContent), cap: t('cap'), line: t('lineNo'), chk: t('chk'), ready: t('readyTxt')}; });
}
async function lab(p) { await p.click('nav.tabs button[data-page=lab]'); }
async function expSetup(p, label, idx) {
  await p.click('nav.tabs button[data-page=exp]');
  await p.evaluate(([l, i]) => { const b = [...document.querySelectorAll('button.try')].filter(x => x.textContent.trim() === l)[i || 0]; b.click(); }, [label, idx]);
}

(async () => {
  fs.mkdirSync(OUT, {recursive: true}); fs.mkdirSync(SHOTS, {recursive: true});
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await b.newPage({viewport: {width: 1366, height: 768}});
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') res.console.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => res.console.push('pageerror: ' + e));
  p.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) res.requests.push(u); });
  await p.goto('file://' + FILE); await wait(p, 300);
  const raw = fs.readFileSync(FILE, 'utf8');
  const ver = await p.evaluate(() => ({title: document.title, meta: document.querySelector('meta[name=version]').content, badge: document.querySelector('.badge').textContent}));
  check('version v2.0.0 in title, meta, badge and header comment', ver.title.endsWith('v2.0.0') && ver.meta === 'v2.0.0' && ver.badge.includes('v2.0.0') && /Version: v2\.0\.0/.test(raw.slice(0, 400)), JSON.stringify(ver));
  check('no innerHTML / eval / document.write / new Function; no window.__ hooks', !/innerHTML|\beval\(|document\.write|new Function|window\.__/.test(raw));
  const say = await p.evaluate(() => [...document.querySelectorAll('.sl')].length);
  check('8 slides; kickers "n of 8"', say === 8 && (await p.evaluate(() => [...document.querySelectorAll('.sl .kick')].every((k, i) => k.textContent.startsWith((i + 1) + ' of 8')))));
  check('speaker notes, Watch cues and Notes button gone', !(await p.$('#notesBox')) && !(await p.$('.watch')) && !(await p.$('#slNbtn')));

  // ── §4 values, slide by slide (lines shown in order; demos run as the line says) ──
  const V = res.values;
  await goto(p, 1, 2); await wait(p, 300); V.s1 = await snap(p);
  await goto(p, 2, 1); await wait(p, 300); V.s2a = await snap(p);
  await goto(p, 2, 2); await wait(p, 300); V.s2b = await snap(p);
  await goto(p, 3, 1); await wait(p, 300); V.s3a = await snap(p);
  await goto(p, 3, 2); await wait(p, 4500); V.s3b = await snap(p);
  await goto(p, 4, 0); await wait(p, 300); V.s4a = await snap(p);
  await goto(p, 4, 2); await wait(p, 300); V.s4b = await snap(p);
  await goto(p, 4, 3); await wait(p, 4500); V.s4c = await snap(p);
  await goto(p, 5, 1); await wait(p, 4000); V.s5a = await snap(p);
  await goto(p, 5, 2); await wait(p, 4000); V.s5b = await snap(p);
  await goto(p, 6, 0); await wait(p, 300); V.s6a = await snap(p);
  await goto(p, 6, 1); await wait(p, 4000); V.s6f = await snap(p);
  await goto(p, 6, 2); await wait(p, 4000); V.s6s = await snap(p);
  await goto(p, 6, 3); await wait(p, 4000); V.s6x = await snap(p);
  await goto(p, 7, 4); await wait(p, 300); V.s7 = await snap(p);
  const keys = await p.evaluate(() => { document.getElementById('slNext').click(); for (let i = 0; i < 2; i++) document.getElementById('nextL').click();
    return {cards: document.querySelectorAll('#itKeys .kcard').length, ringed: document.getElementById('kP').classList.contains('ringed'), mathPx: Math.min(...[...document.querySelectorAll('#itKeys math')].map(m => parseFloat(getComputedStyle(m).fontSize)))}; });
  check('slide 8: seven key-equation cards, P card ringed on line 3, MathML ≥ 18 px', keys.cards === 7 && keys.ringed && keys.mathPx >= 18, JSON.stringify(keys));

  // ── Experiments E1–E5 (as v1.4.0) and E6 ──
  const closeAndRead = async () => { await p.click('#closeBtn'); await wait(p, 1400); return snap(p); };
  await expSetup(p, '▶ Set up 90°'); V.e3a = await closeAndRead();
  await expSetup(p, '▶ Set up 180°'); V.e3b = await closeAndRead();
  await expSetup(p, '▶ Set up 5°'); V.e3c = await closeAndRead();
  await expSetup(p, '▶ Set up', 2);   // E4 (field low): close when the lamps are darkest
  await p.waitForFunction(() => { const v = [...document.querySelectorAll('#phases text')].filter(e => /kV$/.test(e.textContent)).map(e => parseFloat(e.textContent)); return v.length && Math.max(...v) < 3.30; }, null, {timeout: 30000});
  V.e4open = await snap(p); V.e4 = await closeAndRead();
  await expSetup(p, '▶ Set up', 3);   // E5 (slow): close when the lamps are dark
  await p.waitForFunction(() => { const v = [...document.querySelectorAll('#phases text')].filter(e => /kV$/.test(e.textContent)).map(e => parseFloat(e.textContent)); return v.length && Math.max(...v) < 0.30; }, null, {timeout: 30000});
  V.e5 = await closeAndRead();
  // E6: your turn, done with the Lab controls.
  await expSetup(p, '▶ Set up', 4);
  const turnShown = await p.evaluate(() => document.getElementById('itTurn').classList.contains('on'));
  await p.click('#runUp'); await wait(p, 3200);
  await p.click('#excite'); await wait(p, 2500);
  await p.evaluate(() => { const s = document.getElementById('vgS'); s.value = '13.8'; s.dispatchEvent(new Event('input')); });
  await p.click('#swapBtn');
  await p.evaluate(() => { const s = document.getElementById('fgS'); s.value = '60.05'; s.dispatchEvent(new Event('input')); });
  await wait(p, 400);
  await p.waitForFunction(() => { const v = [...document.querySelectorAll('#phases text')].filter(e => /kV$/.test(e.textContent)).map(e => parseFloat(e.textContent)); return v.length && Math.max(...v) < 0.20; }, null, {timeout: 30000});
  V.e6 = await closeAndRead();
  V.e6steps = await p.evaluate(() => [...document.querySelectorAll('#itTurn [data-step]')].map(li => li.classList.contains('ok')));
  V.e6card = await p.evaluate(() => [...document.querySelectorAll('#sheet [data-step]')].map(li => li.classList.contains('ok')));
  V.e6sum = await txt(p, '#itTurn .turnSum');
  check('E6: the five-step panel shows in the Lab after its set-up', turnShown);
  check('E6: clean close, all five steps ✓ in the Lab and on the card', V.e6steps.every(Boolean) && V.e6card.every(Boolean) && /IN STEP/.test(V.e6.tag), V.e6.surge + ' · ' + V.e6.tag + ' · ' + V.e6sum);

  // ── Narration: voice on plays and advances; voice off times captions; Lab Listen; a Lecture control pauses it ──
  await p.click('nav.tabs button[data-page=lec]'); await goto(p, 1, 0);
  await p.click('#play'); await wait(p, 1500);
  const playing = await p.evaluate(() => ({btn: document.getElementById('play').textContent, bar: document.getElementById('bar').style.width, msg: [...document.querySelectorAll('.voiceMsg')].some(m => !m.hidden)}));
  check('Play narration: plays (button shows Pause, progress moves)', /Pause/.test(playing.btn) && parseFloat(playing.bar) > 0, JSON.stringify(playing));
  await p.click('#play');
  await p.click('#voice'); await goto(p, 8, 2); await p.click('#play');
  const tStart = Date.now(); await p.waitForFunction(() => /Play narration/.test(document.getElementById('play').textContent), null, {timeout: 30000});
  check('voice off: the last line runs as a timed caption and the narration stops at the end', Date.now() - tStart > 2000, (Date.now() - tStart) + ' ms');
  await p.click('#voice');
  await goto(p, 2, 0); await p.click('#play'); await wait(p, 600); await p.click('#runUp'); await wait(p, 200);
  check('using a Lecture control pauses the narration', /Play narration/.test(await txt(p, '#play')));
  await lab(p); await p.click('#listenBtn'); await wait(p, 800);
  const ln = await p.evaluate(() => ({no: document.getElementById('labNo').textContent, cap: document.getElementById('cap').hidden ? '' : document.getElementById('cap').textContent}));
  await p.click('#runUp'); await wait(p, 300);
  const still = await txt(p, '#labNo');
  await p.click('nav.tabs button[data-page=exp]'); await wait(p, 200);
  const after = await txt(p, '#labNo');
  check('Lab Listen plays its 3 lines; a Lab control does not stop it; changing tab does', /^1\/3/.test(ln.no) && ln.cap.startsWith('This is the Lab') && /^1\/3/.test(still) && after === '', JSON.stringify(ln) + ' | ' + still + ' | ' + after);
  const listens = await p.evaluate(() => document.querySelectorAll('#sheet button.listen').length);
  check('one Listen button per Experiment (6)', listens === 6, listens);

  // ── Layout: every slide at four sizes, no page scrollbar; smallest figure text; screenshots ──
  await p.click('nav.tabs button[data-page=lec]');
  for (const [w, h, tag] of SIZES) {
    await p.setViewportSize({width: w, height: h});
    let worst = 99, where = '', scroll = [];
    for (let n = 1; n <= 8; n++) {
      await goto(p, n, 0); await wait(p, 350);
      const m = await p.evaluate(() => {
        const de = document.documentElement; let min = 99, at = '';
        for (const t of document.querySelectorAll('#stage .it.on svg text')) { if (!t.textContent.trim() || t.closest('[display="none"]')) continue;
          const M = t.getScreenCTM(); if (!M) continue; const px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(M.a, M.b); if (px > 0 && px < min) { min = px; at = t.textContent.trim().slice(0, 30); } }
        return {scroll: de.scrollHeight > de.clientHeight || de.scrollWidth > de.clientWidth, min, at};
      });
      if (m.scroll) scroll.push(n);
      if (m.min < worst) { worst = m.min; where = 'slide ' + n + ' "' + m.at + '"'; }
      if (w === 1366 || w === 1093) await p.screenshot({path: path.join(SHOTS, `${tag}_slide${n}.png`)});
    }
    check(`layout ${tag}: no Lecture scrollbar on any slide`, scroll.length === 0, 'scrolls on ' + scroll.join(','));
    res.figText[tag] = {min: +worst.toFixed(1), where};
    check(`layout ${tag}: figure text ≥ 11 px`, worst >= 11, worst.toFixed(1) + ' px at ' + where);
    if (w === 1366 || w === 1093) { await lab(p); await wait(p, 300); await p.screenshot({path: path.join(SHOTS, `${tag}_lab.png`)}); await p.click('nav.tabs button[data-page=exp]'); await p.screenshot({path: path.join(SHOTS, `${tag}_experiments.png`)}); await p.click('nav.tabs button[data-page=lec]'); }
  }
  check('zero console errors', res.console.filter(x => /^(error|pageerror)/.test(x)).length === 0, res.console.join(' | '));
  check('zero network requests', res.requests.length === 0, res.requests.join(' '));
  await b.close();
  fs.writeFileSync(path.join(OUT, 'dev_result.json'), JSON.stringify(res, null, 1));
  for (const c of res.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : '  — ' + c.info));
  const fails = res.checks.filter(c => !c.ok).length;
  console.log(`dev_test.js: ${res.checks.length - fails} PASS, ${fails} FAIL`);
})();
