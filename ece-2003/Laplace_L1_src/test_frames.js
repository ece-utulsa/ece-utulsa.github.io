// Developer test: every beat at 100 %, 125 % and reduced motion. Usage: node test_frames.js <page.html> <pack.json> <scene.js> <outdir>
const { chromium } = require('playwright');
const fs = require('fs');
const [page_path, pack_path, scene_path, out] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(pack_path, 'utf8')).clips;
const scene = fs.readFileSync(scene_path, 'utf8');
const BEATS = [...scene.matchAll(/\{ id: '(\w+)', line: (\d+), from: ([\d.]+), sec: (-?\d+),(?: land: '(\w)',)?/g)].map((m) => ({ id: m[1], line: +m[2], from: +m[3], sec: +m[4], land: m[5] || '' }));
const LEAD = 1.0, GAP = 1.5, TAIL = 3.0;
const starts = []; let t = LEAD; for (const c of pack) { starts.push(t); t += c.dur + GAP; }
const total = t - GAP + TAIL;
const bStart = (i) => starts[BEATS[i].line - 1] + BEATS[i].from * pack[BEATS[i].line - 1].dur;
const IX = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const PAIRS = [{ k: 'u', first: IX.u0, at: IX.u4b, v: '1/s' }, { k: 'e', first: IX.e0, at: IX.e4, v: '1/(s + a)' }, { k: 'd', first: IX.d0, at: IX.d4, v: '1' }];
const MODES = [
  { name: '100', viewport: { width: 1366, height: 768 }, dpr: 1, reduced: false },
  { name: '125', viewport: { width: 1093, height: 614 }, dpr: 1.25, reduced: false },
  { name: 'rm', viewport: { width: 1366, height: 768 }, dpr: 1, reduced: true },
];
(async () => {
  const browser = await chromium.launch();
  let fails = 0; const table = [];
  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport: mode.viewport, deviceScaleFactor: mode.dpr, reducedMotion: mode.reduced ? 'reduce' : 'no-preference', offline: true });
    const page = await ctx.newPage();
    const errors = [], requests = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
    await page.goto('file://' + page_path);
    await page.waitForSelector('[data-card="opening"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${mode.name}_00_card.png` });
    const card = await page.evaluate(() => { const c = document.querySelector('[data-card="opening"] > div').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return { inside: c.top >= s.top && c.bottom <= s.bottom, rt: document.querySelector('[data-running-time]').textContent, text: document.querySelector('[data-card="opening"]').innerText }; });
    if (!card.inside) { fails++; console.log(mode.name, 'CARD overflows stage'); }
    if (mode.name === '100') console.log('card:', card.rt, '|', card.text.replace(/\n+/g, ' | '));
    await page.click('text=▶ Start');
    await page.waitForTimeout(300);
    await page.click('[aria-label="Pause"]');
    const pageTotal = await page.evaluate(() => +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'));
    if (Math.abs(pageTotal - total) > 1) { fails++; console.log('duration mismatch', pageTotal, total); }
    const seek = async (time) => { const r = await page.evaluate(() => { const b = document.querySelector('[role="slider"]').getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; }); await page.mouse.click(r.x + (time / total) * r.w, r.y); await page.waitForTimeout(120); };
    const probe = () => page.evaluate(() => {
      const stage = document.getElementById('stage'), sr = stage.getBoundingClientRect(), k = 1280 / sr.width;
      const R = (el) => { const r = el.getBoundingClientRect(); return { l: (r.left - sr.left) * k, t: (r.top - sr.top) * k, r: (r.right - sr.left) * k, b: (r.bottom - sr.top) * k }; };
      const fz = (el) => parseFloat(getComputedStyle(el).fontSize);
      const focus = [...document.querySelectorAll('[data-focus]')];
      const work = document.querySelector('[data-gate="work"]:not([data-card])');
      const o = { focusIds: focus.map((f) => f.getAttribute('data-focus')), issues: [] };
      if (focus[0]) { const f = focus[0], fl = f.querySelector('[data-focus-line]'); o.focusFs = fz(fl); o.bar = getComputedStyle(f).borderLeftWidth; o.focusText = f.innerText.replace(/\s+/g, ' '); }
      // text nodes: size floors and work-zone ceilings
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
      let n; let minFs = 99;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue; const el = n.parentElement; const cs = getComputedStyle(el);
        if (el.closest('.sr-only') || cs.visibility === 'hidden' || el.closest('[style*="visibility: hidden"]')) continue;
        const r = el.getBoundingClientRect(); if (!r.width) continue;
        const s = fz(el); if (s < minFs) minFs = s;
        if (s < 13) o.issues.push('small text ' + s + ' "' + n.textContent.slice(0, 20) + '"');
        if (work && work.contains(el) && s > 16 && !el.closest('[data-focus-line]') && !el.closest('[data-landing-from]')) o.issues.push('work-zone text ' + s + 'px outside focus: ' + n.textContent.slice(0, 20));
      }
      o.minFs = minFs;
      // panels inside the stage, contents inside panels, panels not overlapping
      const gates = [...document.querySelectorAll('[data-gate]')].map((el) => ({ el, name: el.getAttribute('data-gate') + (el.getAttribute('data-card') ? ':card' : ''), r: R(el) }));
      for (const g of gates) {
        if (g.r.l < -0.5 || g.r.t < -0.5 || g.r.r > 1280.5 || g.r.b > 720.5) o.issues.push(g.name + ' outside stage');
        if (g.el.scrollWidth > g.el.clientWidth + 1 || g.el.scrollHeight > g.el.clientHeight + 1) o.issues.push(g.name + ' content overflows (' + g.el.scrollWidth + 'x' + g.el.scrollHeight + ' in ' + g.el.clientWidth + 'x' + g.el.clientHeight + ')');
      }
      for (let i = 0; i < gates.length; i++) for (let j = i + 1; j < gates.length; j++) {
        const a = gates[i], b = gates[j]; if (a.name === 'work:card' || b.name === 'work:card') { if (a.name === 'work' || b.name === 'work') continue; }
        if (a.r.l < b.r.r - 1 && b.r.l < a.r.r - 1 && a.r.t < b.r.b - 1 && b.r.t < a.r.b - 1) o.issues.push('overlap ' + a.name + ' / ' + b.name);
      }
      o.slots = Object.fromEntries([...document.querySelectorAll('[data-slot]')].map((s) => [s.getAttribute('data-slot'), { vis: getComputedStyle(s).visibility, val: s.querySelector('[data-pair]').textContent, border: getComputedStyle(s).borderTopWidth, outline: getComputedStyle(s).outlineStyle }]));
      o.value = [...document.querySelectorAll('[data-landing-from]')].map((v) => ({ k: v.getAttribute('data-landing-from'), fs: fz(v), text: v.textContent }));
      o.landing = document.querySelectorAll('[data-landing]').length;
      o.def = [...document.querySelectorAll('[data-def]')].map((d) => d.getAttribute('data-def'));
      o.next = document.querySelectorAll('[data-next]').length;
      o.rows = [...document.querySelectorAll('[data-done-row]')].map((d) => d.getAttribute('data-done-row'));
      o.rail = document.querySelectorAll('[data-rail]').length;
      o.caption = (document.querySelector('[data-gate="caption"]') || {}).innerText || '';
      return o;
    });
    for (let i = 0; i < BEATS.length; i++) {
      const b = BEATS[i];
      // just before this beat: the previous beat must still be on screen (nothing early)
      if (i > 0) { await seek(bStart(i) - 0.12); const p = await probe(); const exp = BEATS[i - 1].id; if (p.focusIds.join() !== exp) { fails++; console.log(mode.name, b.id, 'EARLY: before start focus is', p.focusIds.join(), 'expected', exp); } }
      await seek(bStart(i) + 0.55);
      const p = await probe(); const iss = p.issues.slice();
      const isYt = b.id === 'yt';
      if (!isYt) {
        if (p.focusIds.length !== 1 || p.focusIds[0] !== b.id) iss.push('focus ' + p.focusIds.join() + ' != ' + b.id);
        if (p.focusFs < 24) iss.push('focus font ' + p.focusFs);
        if (p.bar !== '5px') iss.push('bar ' + p.bar);
      }
      if (i >= IX.u0) for (const pr of PAIRS) {
        const s = p.slots[pr.k]; if (!s) { iss.push('slot missing ' + pr.k); continue; }
        if ((s.vis === 'visible') !== (i >= pr.first)) iss.push('slot ' + pr.k + ' visibility ' + s.vis);
        if (s.val !== (i >= pr.at ? pr.v : '?')) iss.push('slot ' + pr.k + ' shows ' + s.val);
      } else if (Object.keys(p.slots).length) iss.push('pairs panel early');
      const expVal = b.land && !isYt ? 1 : 0;
      if (p.value.length !== expVal) iss.push('value count ' + p.value.length);
      if (expVal && p.value[0].fs < 30) iss.push('value font ' + p.value[0].fs);
      if (p.landing !== (b.land && !mode.reduced ? 1 : 0)) iss.push('landing paths ' + p.landing);
      if (b.land && mode.reduced && p.slots[b.land].outline !== 'solid') iss.push('reduced-motion outline missing');
      const expDef = ['def', 'svar', 'zero', 'zero2'].filter((d) => i > IX[d]);
      if (p.def.join() !== expDef.join()) iss.push('def panel ' + p.def.join() + ' != ' + expDef.join());
      if (p.next !== (i >= IX.key2 ? 1 : 0)) iss.push('next link ' + p.next);
      if ((p.rail > 0) !== (i >= IX.ode)) iss.push('rail ' + p.rail);
      const file = `${mode.name}_${String(i + 1).padStart(2, '0')}_${b.id}.png`;
      await page.screenshot({ path: `${out}/${file}` });
      if (iss.length) { fails++; console.log(mode.name, b.id, 'ISSUES:', iss.join('; ')); }
      if (mode.name === '100') table.push({ n: i + 1, id: b.id, line: b.line, at: bStart(i).toFixed(2), focus: isYt ? '(Your-turn card)' : p.focusText, rows: p.rows.join(','), slots: PAIRS.map((pr) => (p.slots[pr.k] && p.slots[pr.k].vis === 'visible' ? p.slots[pr.k].val : '–')).join(' | '), cap: p.caption.replace(/\s+/g, ' '), ok: iss.length ? 'FAIL' : 'ok', file });
    }
    // Your turn: card, Show solution
    await seek(starts[15] + 1);
    const yt0 = await page.evaluate(() => ({ card: !!document.querySelector('[data-card="yourturn"]'), sol: !!document.querySelector('[data-solution]'), problem: (document.querySelector('[data-yt-problem]') || {}).innerText }));
    await page.click('text=Show solution'); await page.waitForTimeout(150);
    const p2 = await probe();
    const yt1 = await page.evaluate(() => ({ ans: document.querySelector('[data-yt-answer]').innerText.replace(/\s+/g, ''), steps: document.querySelector('[data-solution]').innerText }));
    await page.screenshot({ path: `${out}/${mode.name}_yt_solution.png` });
    if (!yt0.card || yt0.sol || yt1.ans !== 'cosωt↔s/(s2+ω2)' || p2.issues.length) { fails++; console.log(mode.name, 'YOUR TURN', JSON.stringify(yt0), yt1.ans, p2.issues.join('; ')); }
    if (mode.name === '100') console.log('your turn:', yt0.problem, '=>', yt1.steps.replace(/\n+/g, ' | '));
    // hand stepping: ◀ twice from the end, ▶ once
    await page.click('text=← back to the lecture'); await page.click('[aria-label="previous line"]'); await page.click('[aria-label="previous line"]'); await page.click('[aria-label="next line"]'); await page.waitForTimeout(100);
    const hs = await page.evaluate(() => ({ step: document.querySelector('[data-step]').textContent, focus: document.querySelector('[data-focus]').getAttribute('data-focus') }));
    if (hs.focus !== BEATS[IX.key2 - 1].id) { fails++; console.log(mode.name, 'hand step', JSON.stringify(hs)); }
    // end of the timeline
    await seek(total - 0.05); await page.waitForTimeout(700);
    const pe = await probe(); await page.screenshot({ path: `${out}/${mode.name}_zz_end.png` });
    if (pe.issues.length) { fails++; console.log(mode.name, 'END', pe.issues.join('; ')); }
    const ver = await page.evaluate(() => ({ title: document.title, meta: document.querySelector('meta[name=version]').content, badge: document.querySelector('[data-version-badge]').textContent, globals: Object.keys(window).filter((k) => k.startsWith('__')), href: (document.querySelector('[data-next] a') || {}).href }));
    console.log(mode.name, 'errors', errors.length, errors.slice(0, 3), 'requests', requests.length, 'ver', JSON.stringify(ver), 'minFs seen', pe.minFs);
    if (errors.length || requests.length) fails++;
    await ctx.close();
  }
  fs.writeFileSync(`${out}/frame_table.json`, JSON.stringify(table, null, 1));
  console.log('beats', BEATS.length, 'total', total.toFixed(2), 'FAILS', fails);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
