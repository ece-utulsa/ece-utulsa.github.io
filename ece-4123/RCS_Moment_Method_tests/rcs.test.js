/* RCS Moment Method — developer checks (Playwright, Chromium). Run:
     NODE_PATH=$(npm root -g) node ece-4123/RCS_Moment_Method_tests/rcs.test.js [path/to/RCS_Moment_Method_v1.0.0.html]
   Known input → known output: Bessel values (Abramowitz & Stegun), the circle against the exact series (TM and TE, several
   sizes and discretisations), broadside strip / square / triangle against physical optics (σ/λ = 2πw²), and the page. */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'RCS_Moment_Method_v1.0.0.html'));
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if(ok){ pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + JSON.stringify(detail) : '')); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } }), errs = [], reqs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('request', r => reqs.push(r.url()));
  await p.goto('file://' + FILE); await p.waitForTimeout(300);
  const bes = await p.evaluate(() => { const M = window.RCSMoM; return [M.J0(1), M.Y0(1), M.J1(5), M.Y1(5), M.Jn(5, 3), M.Yn(3, 2), M.Jn(20, 10)]; });
  const ref = [0.7651976866, 0.0882569642, -0.3275791376, 0.1478631434, 0.0430284348, -1.1277837768, 1.151336925e-5];
  check('Bessel J0, Y0, J1, Y1, J5(3), Y3(2), J20(10) match tables (|error| < 1e-7)', bes.every((v, i) => Math.abs(v - ref[i]) < 1e-7), bes);
  const circ = await p.evaluate(() => { const M = window.RCSMoM, out = [];
    for(const pol of ['TM', 'TE']) for(const a of [0.25, 0.5, 1, 2]){ const body = M.makeBody('circle', { a }, 20), S = M.factor(body, pol), [r, i] = M.currents(S, Math.PI), c = M.exactCoeffs(pol, a);
      let e = 0, top = -1e9; const ex = [], mo = [];
      for(let k = 0; k < 360; k++){ const ph = k * Math.PI / 180, psi = ((ph - 2 * Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); ex.push(10 * Math.log10(M.exactRcs(c, psi))); mo.push(10 * Math.log10(M.rcs(body, pol, r, i, ph))); top = Math.max(top, ex[k]); }
      ex.forEach((v, k) => { if(v > top - 20) e = Math.max(e, Math.abs(v - mo[k])); }); out.push([pol, a, +e.toFixed(3)]); }
    return out; });
  check('circle, 20 segments/λ, a = 0.25…2 λ: bistatic σ/λ within 0.1 dB of the exact series wherever it is within 20 dB of its peak (TM and TE)', circ.every(x => x[2] < 0.1), circ);
  const po = await p.evaluate(() => { const M = window.RCSMoM, db = v => 10 * Math.log10(v), one = (shape, d, pol, deg) => { const body = M.makeBody(shape, d, 20), S = M.factor(body, pol), ph = deg * Math.PI / 180, [r, i] = M.currents(S, ph); return db(M.rcs(body, pol, r, i, ph)); };
    return [one('strip', { w: 2 }, 'TM', 90), one('rect', { w: 1, h: 1 }, 'TM', 180), one('rect', { w: 1, h: 1 }, 'TE', 180), one('tri', { s: 1 }, 'TM', 270)]; });
  const poRef = [10 * Math.log10(2 * Math.PI * 4), 10 * Math.log10(2 * Math.PI), 10 * Math.log10(2 * Math.PI), 10 * Math.log10(2 * Math.PI)];
  check('broadside strip (2λ), square face (1λ, TM and TE), triangle face (1λ): within 0.5 dB of physical optics σ/λ = 2πw²', po.every((v, i) => Math.abs(v - poRef[i]) < 0.5), { po, poRef });
  const ro = async id => p.$eval('#ro_' + id, e => e.textContent);
  check('page: circle a = 0.5λ TM by default; backscatter 2.16 dB (exact 2.15 dB); max error ≤ 0.05 dB', (await ro('backscatter')) === '2.16 dB' && (await ro('exact')) === '2.15 dB' && parseFloat(await ro('max')) <= 0.05);
  await p.click('#pol_TE'); await p.waitForTimeout(150);
  check('TE: exact and MoM backscatter agree (2.26 dB)', (await ro('backscatter')) === '2.26 dB' && (await ro('exact')) === '2.26 dB');
  await p.click('#sh_strip'); await p.waitForTimeout(150);
  check('the strip is TM only (TE button disabled)', await p.isDisabled('#pol_TE') && (await p.textContent('#plotTitle')).includes('(TM)'));
  await p.click('#mode_mono'); await p.waitForTimeout(300);
  check('monostatic vs angle draws 361 points', (await p.$eval('#plot path.mom', e => e.getAttribute('d').split('L').length)) === 361);
  await p.click('#sh_circle'); await p.click('#mode_freq'); await p.waitForTimeout(3000);
  check('monostatic vs size: 81 sizes, MoM and exact both drawn', (await p.$eval('#plot path.mom', e => e.getAttribute('d').split('L').length)) === 81 && !!(await p.$('#plot path.exact')));
  check('no page scroll at 1600×1000; side panel text has no "null" or "[object"', await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && !/null|\[object/.test(document.getElementById('side').innerText)));
  check('no console errors; only the file itself requested', errs.length === 0 && reqs.every(u => u.startsWith('file:') || u.startsWith('data:')), errs);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
