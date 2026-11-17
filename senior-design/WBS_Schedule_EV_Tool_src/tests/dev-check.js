// Builder's developer checks in Chromium for change briefing v1.0.4 (D1-D3, E1-E12, V1) and the main-briefing tests that
// need the page (T1, T3, T6, T8, T9, T10). NOT the acceptance suite: Test writes that independently.
// Run after build.py:  NODE_PATH=$(npm root -g) node tests/dev-check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { chromium } = require('playwright');
const SRC = path.join(__dirname, '..'), SITE = path.join(SRC, '..');
const VERSION = /VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(SRC, 'build.py'), 'utf8'))[1];
const FILE = path.join(SITE, `WBS_Schedule_EV_Tool_v${VERSION}.html`), URL = 'file://' + FILE;
const MIN_TEXT_PX = 13, MIN_KEY_PX = 15;       // D1, measured in rendered pixels (ruling R4)
const WIDTHS = [[1440, 860], [1920, 1080]];    // the test widths of ruling R4

// a project with 3 tasks and a milestone, no baseline, week 2: one task finished, one started (D3)
const ctx = {}; vm.createContext(ctx);
vm.runInContext(['model.js', 'ev.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
  ;var p = newProject('Three tasks'), ix = indexTree(p), sub = ix.order.find(e => ix.num.get(e.id) === '1.1').id, ids = [1, 2, 3].map(i => addElement(p, sub, 'Task ' + i, true).id);
  addElement(p, sub, 'PDR', true, 'milestone'); p.currentWeek = 2; setStatus(p, ids[0], 1, 'started'); setStatus(p, ids[0], 2, 'finished'); setStatus(p, ids[1], 2, 'started');
  this.noBaseline = serialize(p);`, ctx);

let fail = 0;
const ok = (name, cond, got) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined && got !== '' ? '  ' + got : '')); if(!cond) fail++; };

(async () => {
  const b = await chromium.launch(), errs = [];
  const open = async (vw, vh, seed) => {
    const pg = await b.newPage({ viewport: { width: vw, height: vh } });
    pg.on('console', m => { if(m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push(e.message));
    pg.on('request', r => { if(!/^(file|blob|data):/.test(r.url())) errs.push('network: ' + r.url()); });
    if(seed) await pg.addInitScript(j => { localStorage.setItem('sd-wbs-ev:project', j); }, seed);
    await pg.goto(URL);
    return pg;
  };
  const card = (pg, k) => pg.locator(`#p-week [data-key="kpi:${k}"] .v`).textContent();

  /* ── V1: the version in four places, and the file name ── */
  const html = fs.readFileSync(FILE, 'utf8'), v = 'v' + VERSION;
  let pg = await open(1440, 860);
  ok('V1 version agrees: header comment, meta, title, visible badge, file name', html.includes(`Version: ${v}\n`) && html.includes(`<meta name="version" content="${v}">`)
    && html.includes(`<title>Senior Design WBS, Schedule and Earned Value ${v}</title>`) && (await pg.locator('footer b').first().textContent()) === v && /Author: Claude Code/.test(html), v);
  ok('V1 CSP: script allowed by hash only', /script-src 'sha256-[A-Za-z0-9+/=]{44}';/.test(html) && !/script-src[^;]*unsafe/.test(html), (/script-src [^;]+/.exec(html) || [''])[0]);

  /* ── T9: the unedited template (a fresh browser opens it at week 0) ── */
  const rowsAt = async l => { await pg.selectOption('[data-key=level-wbs]', l); return pg.locator('#p-wbs table.grid tbody tr').count(); };
  const r2 = await rowsAt('2'), r3 = await rowsAt('3');
  await pg.click('[data-key=lay-diag]'); const d3 = await pg.locator('#p-wbs svg [data-key^="box:"]').count(); await pg.click('[data-key=lay-tree]');
  await pg.click('#t-gantt'); const g3 = await pg.locator('#p-gantt .gantt-row').count();
  ok('T9 template: level 2 = project + 4 areas, level 3 adds 14 sub-areas; diagram and Gantt show the same rows', r2 === 5 && r3 === 19 && d3 === 19 && g3 === 19, `${r2}, ${r3}, ${d3}, ${g3}`);
  /* ── T3: week 0 ── */
  await pg.click('#t-week');
  const w0 = await pg.locator('#p-week .kpis.small:last-of-type .v').allTextContents();
  ok('T3 week 0: every measure "not yet defined"', w0.length === 7 && w0.every(t => t === 'not yet defined') && (await pg.textContent('#sig')) === 'Week 0: planning', w0[0]);

  /* ── the lecture example at each test width ── */
  for(const [vw, vh] of WIDTHS){
    await pg.close(); pg = await open(vw, vh); await pg.click('#bExample');
    const tag = `@${vw}`;
    // D1 + E5: rendered text size of every chart; the SPI and quadrant charts fill their boxes
    let sizes = [];
    for(const t of ['wbs', 'gantt', 'status', 'ev', 'report']){
      await pg.click('#t-' + t);
      if(t === 'wbs'){ await pg.selectOption('[data-key=level-wbs]', '4'); await pg.click('[data-key=lay-diag]'); }
      sizes = sizes.concat(await pg.evaluate(tab => [...document.querySelectorAll('main section.on svg[role=img]')].map(svg => {
        const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width, pb = svg.parentElement, cs = getComputedStyle(pb);
        const ts = [...svg.querySelectorAll('text')].map(x => ({ px: parseFloat(getComputedStyle(x).fontSize) * k, s: x.textContent }));
        const key = ts.filter(x => /^(Plan finish|Forecast|SV =)/.test(x.s));
        return { tab, name: (svg.getAttribute('aria-label') || '').split(/[.,:]/)[0], w: r.width, inner: pb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          min: Math.min(...ts.map(x => x.px)), key: key.length ? Math.min(...key.map(x => x.px)) : null, nKey: key.length, fit: pb.classList.contains('fit') };
      }), t));
    }
    const small = sizes.filter(x => x.min < MIN_TEXT_PX || (x.key !== null && x.key < MIN_KEY_PX));
    ok(`D1 ${tag}: all chart text ≥ ${MIN_TEXT_PX} px, key labels ≥ ${MIN_KEY_PX} px (rendered)`, small.length === 0 && sizes.filter(x => x.nKey === 3).length === 2,
      sizes.map(x => `${x.tab}/${x.name.slice(0, 22)} ${x.min.toFixed(1)}${x.key !== null ? '/' + x.key.toFixed(1) : ''}`).join('; '));
    const fitted = sizes.filter(x => x.fit);
    ok(`E5 ${tag}: Earned value, SPI, quadrant and report charts fill their boxes (no scaling, no gap)`, fitted.length === 4 && fitted.every(x => Math.abs(x.w - Math.floor(x.inner)) < 1),
      fitted.map(x => `${Math.round(x.w)}/${Math.round(x.inner)}`).join(' '));
    await pg.click('#t-ev');
    const gap = await pg.evaluate(() => [...document.querySelectorAll('#p-ev .ev-charts .card')].map(c => { const r = c.getBoundingClientRect(), s = c.querySelector('svg').getBoundingClientRect(); return [Math.round(r.right - s.right), Math.round(r.bottom - s.bottom)]; }));
    ok(`E5 ${tag}: no large gap beside or under the SPI and quadrant charts`, gap.every(([x, y]) => x <= 16 && y <= 16), JSON.stringify(gap));
    // D2: quadrant labels
    const q = await pg.evaluate(() => [...document.querySelectorAll('#p-ev svg[aria-label^="Start versus finish"] text')].map(t => t.textContent).filter(t => /^[A-Z][a-z-]/.test(t) && !/ratio|Week/.test(t)));
    ok(`D2 ${tag}: quadrant labels as on the lecture slide; top right "On plan" only`, JSON.stringify(q) === JSON.stringify(['Watch', 'Starting late, finishing well', 'On plan', 'Re-plan', 'Behind on both', 'Watch', 'Starting, not finishing']), q.join(' | '));
    // E8: every legend entry has a symbol
    const leg = await pg.evaluate(() => [...document.querySelectorAll('#p-ev .legend > span')].map(sp => !!sp.querySelector('[aria-hidden=true]')));
    ok(`E8 ${tag}: every Earned value legend entry has a symbol`, leg.length === 4 && leg.every(Boolean), leg.join(','));
    // T1 numbers on the Earned value table (current-week row)
    const row = await pg.locator('#p-ev table.grid tbody tr.sel td').allTextContents();
    ok(`T1 ${tag}: Earned value table at week 6`, row.join('|') === '6|10|8|8|6|9.0|7.0|−2.0|−22.2%|0.78|0.80|0.75|17.5%|19.3|33.0|1.06|Re-plan', row.join('|'));
    const late = await pg.locator('#p-ev ul.plain li').allTextContents();
    ok(`T1 ${tag}: late tasks 2.1.1 (start and finish), 1.4.2 (start), 1.4.1 (finish)`, late.length === 3 && /^2\.1\.1 .*late start and late finish$/.test(late[0]) && /^1\.4\.2 .*: late start$/.test(late[1]) && /^1\.4\.1 .*: late finish$/.test(late[2]));

    // This week: T1 cards, E4, E7
    await pg.click('#t-week');
    const got = {}; for(const k of ['Sp', 'Sa', 'Fp', 'Fa', 'BAC', 'PV', 'EV', 'SV', 'SV%', '% complete', 'To go', 'TSPI', 'SPI', 'Signal', 'Forecast finish', 'SR and FR']) got[k] = await card(pg, k);
    ok(`T1 ${tag}: This week cards give the briefing §0 numbers`, JSON.stringify(got) === JSON.stringify({ Sp: '10', Sa: '8', Fp: '8', Fa: '6', BAC: '40', PV: '9.0', EV: '7.0', SV: '−2.0', 'SV%': '−22.2%',
      '% complete': '17.5%', 'To go': '33.0', TSPI: '1.06', SPI: '0.78', Signal: 'Re-plan', 'Forecast finish': 'Week 19.3', 'SR and FR': '0.80 / 0.75' }), JSON.stringify(got));
    const cap = await pg.evaluate(() => { const r = document.querySelector('#p-week [data-key="kpi:TSPI"] .r'); return { t: r.textContent, lines: Math.round(r.getBoundingClientRect().height / parseFloat(getComputedStyle(r).lineHeight)) }; });
    const rowsFill = await pg.evaluate(() => [...document.querySelectorAll('#p-week .kpis.small')].map(g => { const gr = g.getBoundingClientRect(), last = g.lastElementChild.getBoundingClientRect(), tops = new Set([...g.children].map(c => Math.round(c.getBoundingClientRect().top)));
      return { right: Math.round(gr.right - last.right), rows: tops.size }; }));
    ok(`E4 ${tag}: TSPI captioned "To-complete SPI" on ≤ 2 lines; the small cards fill their rows`, cap.t === 'To-complete SPI' && cap.lines <= 2 && rowsFill.every(x => x.right <= 1 && x.rows === 1), JSON.stringify([cap, rowsFill]));
    const chips = await pg.evaluate(() => [...document.querySelectorAll('.chip')].filter(c => c.offsetParent !== null).map(c => c.textContent));
    ok(`E7 ${tag}: one signal chip on This week`, chips.length === 1 && chips[0] === 'Week 6: Re-plan', chips.join(' | '));

    // Status report: E3, E6, T1 headline
    await pg.click('#t-report');
    const fc = await pg.evaluate(() => { const c = [...document.querySelectorAll('#report .kpi')].find(x => x.querySelector('.k').textContent === 'Forecast finish'), o = [...document.querySelectorAll('#report .kpi')][0];
      const v = c.querySelector('.v'), r = c.querySelector('.r');
      return { v: v.textContent, r: r.textContent, vLines: Math.round(v.getBoundingClientRect().height / parseFloat(getComputedStyle(v).lineHeight)), rPx: parseFloat(getComputedStyle(r).fontSize), vPx: parseFloat(getComputedStyle(v).fontSize),
        rLines: Math.round(r.getBoundingClientRect().height / parseFloat(getComputedStyle(r).lineHeight)) }; });
    ok(`E3 ${tag}: Forecast finish card: "week 19.3", then "plan: week 15" smaller on a second line, no wrapping`, fc.v === 'week 19.3' && fc.r === 'plan: week 15' && fc.vLines === 1 && fc.rLines === 1 && fc.rPx < fc.vPx, JSON.stringify(fc));
    const head = await pg.locator('#report .kpi .v').allTextContents();
    ok(`T1 ${tag}: Status report headline numbers`, head.join('|') === '9.0|7.0|−2.0|0.78|0.80|0.75|17.5%|week 19.3|1.06', head.join('|'));
    const moved = await pg.evaluate(() => { const h3 = [...document.querySelectorAll('#report h3')].find(x => /started or finished in week/.test(x.textContent)); return [...h3.nextElementSibling.querySelectorAll('li')].map(li => li.textContent); });
    ok(`E6 ${tag}: "Started → Finished" in one capitalisation`, moved.length > 0 && moved.every(t => /: (Not started|Started|Finished) → (Not started|Started|Finished)$/.test(t)), moved.join(' | '));

    // Task status: T8
    await pg.click('#t-status');
    const line = async () => pg.textContent('#p-status .reading');
    const all = await line(); await pg.selectOption('[data-key=f-area]', '4'); const a4 = await line(); await pg.selectOption('[data-key=f-area]', '3'); const a3 = await line(); await pg.selectOption('[data-key=f-area]', '0');
    await pg.click('[data-key=m-week]');
    const per = await pg.evaluate(() => [...document.querySelectorAll('#p-status table.grid tbody tr')].slice(0, 6).map(tr => [...tr.children].slice(1).map(td => Number(td.textContent))).reduce((s, r) => s.map((x, i) => x + r[i]), [0, 0, 0, 0]));
    await pg.click('[data-key=m-cum]');
    ok(`T8 ${tag}: reading, area filters 4.0 and 3.0, per-week sums`, all === 'By week 6: 10 planned to start, 8 started; 8 planned to finish, 6 finished.' && a4 === 'By week 6: 2 planned to start, 2 started; 2 planned to finish, 2 finished.'
      && a3 === 'By week 6: 1 planned to start, 1 started; 0 planned to finish, 0 finished.' && per.join(',') === '10,8,8,6', `${a4} / ${a3} / ${per}`);

    // WBS: E1, E2, E12
    await pg.click('#t-wbs'); await pg.click('[data-key=lay-tree]'); await pg.selectOption('[data-key=level-wbs]', '4');
    const ms = await pg.evaluate(() => [...document.querySelectorAll('#p-wbs table.grid tbody tr')].filter(tr => tr.children[4].textContent === 'Milestone').map(tr => { const c = tr.children[2], sp = c.querySelector('span');
      return { t: c.textContent, red: !!c.querySelector('.late'), col: sp ? getComputedStyle(sp).color : '' }; }));
    ok(`E1 ${tag}: a milestone with no owner shows a grey "—", no red text`, ms.length === 3 && ms.every(x => x.t === '—' && !x.red && x.col === 'rgb(79, 91, 98)'), JSON.stringify(ms[0]));
    const warn = await pg.locator('#p-wbs .warnlist:not(.accepted) li').allTextContents(), acc = await pg.locator('#p-wbs .warnlist.accepted li').allTextContents();
    ok(`E12 ${tag}: the example opens with 4.1.2 under Accepted exceptions, with its reason, not in the warnings`, acc.length === 1 && /4\.1\.2 Status reports, weeks 7–15/.test(acc[0]) && /Ongoing all term/.test(acc[0]) && !warn.some(t => /4\.1\.2/.test(t)), acc.join(' | '));
    await pg.click('[data-key=lay-diag]');
    const dg = await pg.evaluate(() => [...document.querySelectorAll('#p-wbs svg [data-key^="box:"]')].map(g => { const full = g.querySelector('title').textContent, ts = [...g.querySelectorAll('text')], name = ts.slice(0, -1).map(t => t.textContent).join(' ');
      const box = g.querySelector('rect').getBoundingClientRect(), over = ts.some(t => { const r = t.getBoundingClientRect(); return r.right > box.right - 2 || r.bottom > box.bottom || r.left < box.left; });
      return { full, same: name === full, lines: ts.length - 1, over }; }));
    ok(`E2 ${tag}: every diagram name is whole (wrapped to ≤ 2 lines, inside its box)`, dg.length === 63 && dg.every(x => x.same && x.lines <= 2 && !x.over) && dg.some(x => x.lines === 2),
      `${dg.length} boxes, ${dg.filter(x => x.lines === 2).length} wrapped; ${dg.filter(x => !x.same || x.over).map(x => x.full).join(' | ')}`);

    // Gantt: T10, E9
    await pg.click('#t-gantt'); await pg.selectOption('[data-key=level-gantt]', '4');
    for(const z of ['all', 'sd1', 'near']){
      await pg.selectOption('[data-key=zoom]', z);
      const g = await pg.evaluate(() => { const svg = document.querySelector('#p-gantt svg'), lines = [...svg.querySelectorAll('line')].filter(l => l.getAttribute('x1') === l.getAttribute('x2')).map(l => ({ x: l.getBoundingClientRect().left + l.getBoundingClientRect().width / 2, today: l.getAttribute('stroke') === '#b42318' }));
        const open = [...svg.querySelectorAll('text')].filter(t => t.textContent === 'open').map(t => t.getBoundingClientRect());
        const today = lines.find(l => l.today);
        return { n: open.length, gapToday: Math.min(...open.map(r => r.left - today.x)), haloed: [...svg.querySelectorAll('text')].filter(t => t.textContent === 'open').every(t => t.getAttribute('paint-order') === 'stroke') }; });
      ok(`E9 ${tag} zoom ${z}: "open" labels clear the today line (white halo over week lines)`, g.n === 2 && g.gapToday >= 5 && g.haloed, `${g.n} labels, ${g.gapToday.toFixed(1)} px from the today line`);
    }
    await pg.selectOption('[data-key=level-gantt]', '3');
    const t10 = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#p-gantt .gantt-row')].map(g => [...g.querySelectorAll('text')].map(t => t.textContent)); return rows.length; });
    await pg.selectOption('[data-key=level-gantt]', '4');
    const flags = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#p-gantt .gantt-row')].map(g => [...g.querySelectorAll('text')].map(t => t.textContent)).filter(r => r.length === 2).map(r => [r[0].split('  ')[0], r[1]])));
    await pg.click('#t-wbs'); await pg.click('[data-key=lay-tree]'); const wbsRows = await pg.locator('#p-wbs table.grid tbody tr').count(); await pg.click('#t-gantt'); const ganttRows = await pg.locator('#p-gantt .gantt-row').count();
    ok(`T10 ${tag}: late flags on the Gantt; same rows as the WBS tab`, JSON.stringify(flags) === JSON.stringify({ '1.4.1': 'Late finish', '1.4.2': 'Late start', '2.1.1': 'Late start & finish' }) && t10 === 19 && wbsRows === ganttRows && ganttRows === 63, JSON.stringify(flags) + ` ${wbsRows}/${ganttRows}`);

    // Help: E10, E11 (the guide inside the tool)
    await pg.click('#bHelp'); const guide = await pg.textContent('#guideBody'); await pg.click('#helpClose');
    ok(`E10 E11 ${tag}: guide arithmetic and zoom text`, guide.includes('15 × 9/7 = 19.3 weeks') && !guide.includes('15 / 0.78') && /Earned value chart starts at week 0/.test(guide) && /SPI chart runs to the current week plus 4/.test(guide));
    // as built: the EV chart's first week tick is 0 and the SPI chart's last is the current week + 4
    await pg.click('#t-ev');
    const ax = await pg.evaluate(() => [...document.querySelectorAll('#p-ev .fit svg')].slice(0, 2).map(svg => { const y = Math.max(...[...svg.querySelectorAll('text')].filter(t => /^\d+$/.test(t.textContent) && t.getAttribute('text-anchor') === 'middle').map(t => +t.getAttribute('y')));
      const n = [...svg.querySelectorAll('text')].filter(t => /^\d+$/.test(t.textContent) && +t.getAttribute('y') === y).map(t => +t.textContent); return [Math.min(...n), Math.max(...n)]; }));
    // the SPI axis is weeks 1 to 10 (current week 6 plus 4), labelled every 2 weeks: 1, 3, 5, 7, 9
    ok(`E11 ${tag}: as built, the Earned value axis starts at week 0 and the SPI axis runs from week 1 to week 10`, ax[0][0] === 0 && ax[1][0] === 1 && ax[1][1] === 9, JSON.stringify(ax));
    // T6: CSV export and Save
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => { document.getElementById('cEv').click(); })]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').split('\r\n');
    ok(`T6 ${tag}: earned value CSV columns and week-6 row`, csv[0] === '﻿Week,Sp,Fp,Sa,Fa,BAC,T,PV,EV,SV,SV%,SPI,SR,FR,% complete,Forecast duration (weeks),Tasks to go,TSPI,Signal' && csv[7].startsWith('6,10,8,8,6,40,15,9,7,-2,') && dl.suggestedFilename().endsWith('.csv'), csv[7]);
    const [sv] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]);
    const saved = fs.readFileSync(await sv.path(), 'utf8');
    await pg.setInputFiles('#file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(saved) }); await pg.waitForTimeout(150);
    const [sv2] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]);
    ok(`T6 ${tag}: Save then Open gives an identical project; file named Lecture-example-week-6.json`, fs.readFileSync(await sv2.path(), 'utf8') === saved && sv.suggestedFilename() === 'Lecture-example-week-6.json');
    // a bad file is refused with the cause and leaves the project unchanged
    await pg.setInputFiles('#file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') }); await pg.waitForTimeout(150);
    const refused = await pg.locator('#dlgTitle').textContent(); await pg.click('#dlgOk');
    ok(`T6 ${tag}: a wrong file is refused and the project is unchanged`, refused === 'Cannot open the file' && (await pg.textContent('#sig')) === 'Week 6: Re-plan');
  }

  /* ── D3: 3 tasks, no baseline ── */
  for(const [vw, vh] of WIDTHS){
    await pg.close(); pg = await open(vw, vh, ctx.noBaseline);
    await pg.click('#t-week');
    const c = {}; for(const k of ['Sp', 'Sa', 'Fp', 'Fa', 'BAC', 'PV', 'EV', 'TSPI']) c[k] = await card(pg, k);
    const note = await pg.locator('#p-week .note').textContent();
    await pg.click('#t-wbs'); const wbs = await pg.evaluate(() => { const tr = document.querySelector('#p-wbs table.grid tbody tr'); return [tr.children[4].textContent, tr.children[5].textContent]; });
    const total = await pg.locator('#p-wbs .card h3').first().textContent();
    ok(`D3 @${vw}: 3 tasks, no baseline: BAC 3; Sa 2 and Fa 1 agree with the WBS tab; planned counts and measures wait for the baseline`,
      c.BAC === '3' && c.Sa === '2' && c.Fa === '1' && c.Sp === 'not yet defined' && c.Fp === 'not yet defined' && c.PV === 'not yet defined' && c.EV === 'not yet defined' && /^No baseline yet/.test(note)
      && wbs[0] === '3' && wbs[1] === '1 of 3 finished' && total === 'Tasks by major area (3 tasks)', JSON.stringify(c) + ' WBS: ' + wbs.join(', '));
    await pg.click('#t-ev'); const evMsg = await pg.locator('#p-ev .fit svg').first().textContent();
    ok(`D3 @${vw}: Earned value still asks for the baseline`, /No baselined tasks yet: baseline the schedule\./.test(evMsg));
    for(const t of ['gantt', 'status', 'report']) await pg.click('#t-' + t);
  }

  /* ── resize: charts are redrawn at the new width ── */
  await pg.close(); pg = await open(1920, 1080); await pg.click('#bExample'); await pg.click('#t-ev');
  await pg.setViewportSize({ width: 1440, height: 860 }); await pg.waitForTimeout(200);
  const rs = await pg.evaluate(() => [...document.querySelectorAll('#p-ev .fit')].map(b => { const s = b.querySelector('svg'), cs = getComputedStyle(b); return s.getBoundingClientRect().width - (b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); }));
  ok('D1 after resizing 1920 → 1440 the charts are redrawn at the new width', rs.every(d => Math.abs(d) < 1), rs.map(d => d.toFixed(1)).join(' '));
  await pg.close(); await b.close();
  ok('no console errors and no network requests (all tabs, both widths)', errs.length === 0, errs.join(' | '));
  console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
})();
