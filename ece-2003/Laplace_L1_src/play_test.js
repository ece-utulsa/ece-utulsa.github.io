// real-time playback: clips in order, start times vs schedule, console / CSP / network
const { chromium } = require('playwright'); const fs = require('fs');
const [pagePath, packPath] = process.argv.slice(2); const pack = JSON.parse(fs.readFileSync(packPath)).clips;
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true }); const page = await ctx.newPage();
  const errs = [], reqs = [];
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security|speech/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) reqs.push(r.url()); });
  await page.addInitScript(() => { window.addEventListener('securitypolicyviolation', (e) => console.error('Content Security violation ' + e.violatedDirective)); });
  await page.goto('file://' + pagePath); await page.waitForTimeout(1000);
  const durs = await page.evaluate(() => [...document.querySelectorAll('audio')].map((a) => a.duration));
  await page.evaluate(() => { const log = []; const t0 = performance.now(); document.querySelectorAll('audio').forEach((a) => { a.addEventListener('play', () => log.push([a.getAttribute('data-clip'), 'play', (performance.now() - t0) / 1000, a.currentTime])); a.addEventListener('ended', () => log.push([a.getAttribute('data-clip'), 'ended', (performance.now() - t0) / 1000])); }); document.body.setAttribute('data-t0', '1'); document.body.__log = log; });
  await page.click('text=▶ Start');
  const total = await page.evaluate(() => +document.querySelector('[role="slider"]').getAttribute('aria-valuemax'));
  await page.waitForTimeout((total + 3) * 1000);
  const log = await page.evaluate(() => document.body.__log);
  const end = await page.evaluate(() => ({ replay: !!document.querySelector('[data-gate="replay"]'), yt: !!document.querySelector('[data-card="yourturn"]'), finish: !!document.querySelector('[data-gate="finish"]'), speech: 'speechSynthesis' in window && window.speechSynthesis.speaking }));
  let t = 1.0, maxDrift = 0; const plays = log.filter((l) => l[1] === 'play'); const starts = [];
  pack.forEach((c, i) => { const p = plays.filter((l) => l[0] === c.name); starts.push(p.length ? p[0][2] : null); if (p.length) maxDrift = Math.max(maxDrift, Math.abs(p[0][2] - 0 - t - (plays[0][2] - 1.0))); t += durs[i] + 1.5; });
  console.log('measured durs vs ffprobe max diff', Math.max(...durs.map((d, i) => Math.abs(d - pack[i].dur))).toFixed(3));
  console.log('plays', plays.length, 'order ok', plays.map((l) => l[0]).join() === pack.map((c) => c.name).join(), 'ended', log.filter((l) => l[1] === 'ended').length, 'max drift', maxDrift.toFixed(3));
  console.log('starts', starts.map((s) => (s - plays[0][2] + 1).toFixed(2)).join(', '), 'total', total);
  console.log('end', JSON.stringify(end), 'errors', errs.length, errs.slice(0, 3), 'requests', reqs.length);
  await b.close();
})();
