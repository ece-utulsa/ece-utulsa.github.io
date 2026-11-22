// Timeline of the ORIGINAL live bundles (for the G1 "plays identically" comparison): node old_timeline.mjs
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const R = '/home/user/ece-utulsa.github.io/ece-2003/';
const FILES = { Simple: 'Inverse Laplace - Simple Poles Fall2026.html', Repeated: 'Invers Laplace - Repeated Poles Fall2026.html', Complex: 'Inverse Laplace - Complex Poles Fall2026.html' };
const b = await chromium.launch();
const run = async ([kind, f]) => {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, offline: true }); const p = await ctx.newPage();
  const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  p.on('request', (r) => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('blob:') && !u.startsWith('data:')) reqs.push(u.slice(0, 80)); });
  await p.addInitScript(() => {
    const log = []; const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { const all = Array.from(document.querySelectorAll('video')); log.push({ ev: 'play', i: all.indexOf(this), t: performance.now() / 1000 }); return play.apply(this, arguments); };
    document.addEventListener('ended', (e) => { const all = Array.from(document.querySelectorAll('video')); log.push({ ev: 'ended', i: all.indexOf(e.target), t: performance.now() / 1000, dur: e.target.duration }); }, true);
    Object.defineProperty(window, 'e2eLog', { value: () => log });
  });
  const t0 = Date.now(); await p.goto('file://' + R + f);
  await p.waitForSelector('text=click to play with voice-over', { timeout: 60000 }); const ready = (Date.now() - t0) / 1000;
  await p.waitForTimeout(1500);
  await p.mouse.click(683, 360); const tStart = await p.evaluate(() => performance.now() / 1000);
  await p.waitForSelector('text=Replay', { timeout: 260000 });
  const log = await p.evaluate(() => window.e2eLog()); await ctx.close();
  const first = {}; const plays = {}; const ends = {};
  for (const l of log) { if (l.ev === 'play') { plays[l.i] = (plays[l.i] || 0) + 1; if (!(l.i in first)) first[l.i] = +(l.t - tStart).toFixed(2); } else { ends[l.i] = (ends[l.i] || 0) + 1; } }
  return { kind, ready, firstStart: first, playCalls: plays, endedEvents: ends, consoleErrors: errs.length, requests: reqs };
};
const res = await Promise.all(Object.entries(FILES).map(run)); await b.close();
fs.writeFileSync('old_timeline.json', JSON.stringify(res, null, 1));
for (const r of res) console.log(r.kind, 'ready', r.ready, 'starts', Object.values(r.firstStart).join(' '), '| play calls per clip', Object.values(r.playCalls).join(','), '| ended per clip', Object.values(r.endedEvents).join(','), '| console', r.consoleErrors, '| requests', r.requests.length, r.requests.slice(0, 2));
