// reduced motion: no landing path, slot outlined; missing clip: ClipHalt banner; network blocked: page still plays
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const br = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const html = fs.readFileSync(process.argv[2], 'utf8');
  // 1 reduced motion at a landing beat (lin2 = beat 18)
  let ctx = await br.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce', offline: true });
  let page = await ctx.newPage(); await page.goto('file://' + process.argv[2]); await page.waitForTimeout(500);
  await page.click('text=▶ Start'); await page.waitForTimeout(6500); await page.click('[aria-label=Pause]');
  for (let k = 0; k < 6; k++) await page.click('[aria-label="previous line"]');
  for (let k = 0; k < 18; k++) await page.click('[aria-label="next line"]');
  await page.waitForTimeout(200);
  console.log('reduced: beat', await page.getAttribute('[data-focus]', 'data-focus'), 'landing svg', !!(await page.$('[data-landing]')), 'slot outline', await page.$eval('[data-slot=L1]', (e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth));
  await ctx.close();
  // 1b normal motion: landing svg present
  ctx = await br.newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); await page.goto('file://' + process.argv[2]); await page.waitForTimeout(500);
  await page.click('text=▶ Start'); await page.waitForTimeout(6500); await page.click('[aria-label=Pause]');
  for (let k = 0; k < 6; k++) await page.click('[aria-label="previous line"]');
  for (let k = 0; k < 18; k++) await page.click('[aria-label="next line"]');
  await page.waitForTimeout(200);
  console.log('normal: landing svg', !!(await page.$('[data-landing]')), 'value font px', await page.$eval('[data-landing-from=L1]', (e) => getComputedStyle(e).fontSize), 'slot border', await page.$eval('[data-slot=L1]', (e) => getComputedStyle(e).borderTopWidth + ' ' + getComputedStyle(e).borderTopColor));
  // cover box on fs2 (beat 24)
  for (let k = 0; k < 6; k++) await page.click('[aria-label="next line"]');
  console.log('cover: beat', await page.getAttribute('[data-focus]', 'data-focus'), await page.$eval('[data-cover]', (e) => e.textContent + ' ' + getComputedStyle(e).backgroundColor + ' ' + getComputedStyle(e).borderTopColor));
  // keyboard: space toggles play
  await page.keyboard.press('Tab');
  await ctx.close();
  // 2 missing clip
  const cut = html.replace(/"laplace_l2_line3\.mp3":"[^"]+",/, '');
  fs.writeFileSync(process.argv[3], cut);
  ctx = await br.newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); await page.goto('file://' + process.argv[3]); await page.waitForTimeout(500);
  console.log('missing clip: alert', await page.textContent('[role=alert]'), 'playing', !!(await page.$('[aria-label=Pause]')), 'errors', errs.length);
  await br.close();
})();
