// Build one self-contained page per scene: node build.mjs [--test]
// Inputs: src/kit.jsx, src/<scene>.jsx, src/gate.jsx (test build only), the React 18.3.1 UMD files, fonts and
// clips taken from the unpacked Design bundles (../u1, ../u2, ../u3), optional new clips in ../clips_new/.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('/opt/node22/lib/node_modules/typescript');
const TEST = process.argv.includes('--test');
const VERSION = 'v1.1.0', RELEASED = '2026-11-22';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAGES = [
  { id: 'pfe1', u: 'u1', n: 14, name: 'Simple Poles', file: 'Inverse_Laplace_Simple_Poles_' + VERSION + '.html', of: '1 of 3' },
  { id: 'pfe2', u: 'u2', n: 16, name: 'Repeated Poles', file: 'Inverse_Laplace_Repeated_Poles_' + VERSION + '.html', of: '2 of 3' },
  { id: 'pfe3', u: 'u3', n: 15, name: 'Complex Poles', file: 'Inverse_Laplace_Complex_Poles_' + VERSION + '.html', of: '3 of 3' },
];
const sha = (s) => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');

function parseClips(js) {              // window.__CLIP_URLS = Object.assign(..., { "name": "data:..." , ... });
  const out = {}; const re = /"([^"]+\.mp3)":\s*"(data:audio\/mpeg;base64,[A-Za-z0-9+/=]+)"/g; let m;
  while ((m = re.exec(js))) out[m[1]] = m[2];
  return out;
}
function inRange(cp, ranges) {
  return ranges.split(',').some((r) => { r = r.trim().replace(/^U\+/i, ''); const [a, b] = r.split('-'); const lo = parseInt(a, 16), hi = b ? parseInt(b, 16) : lo; return cp >= lo && cp <= hi; });
}
function fontCss(u, used, report) {    // keep only the woff2 subsets whose unicode-range holds a character the page uses
  const tpl = read('../' + u + '/template.html'); const meta = JSON.parse(read('../' + u + '/meta.json'));
  const blocks = tpl.match(/@font-face\s*{[^}]*}/g); const seen = new Set(); let css = '';
  for (const b of blocks) {
    const fam = /font-family:\s*'([^']+)'/.exec(b)[1], w = /font-weight:\s*(\d+)/.exec(b)[1];
    const uid = /url\("([^"]+)"\)/.exec(b)[1], range = /unicode-range:\s*([^;]+);/.exec(b)[1];
    if (fam === 'IBM Plex Mono' && w === '500') continue;                 // weight 500 is not used
    const hits = [...used].filter((cp) => inRange(cp, range));
    if (!hits.length) continue;
    const key = fam + '|' + uid; if (seen.has(key)) continue; seen.add(key);
    const bytes = fs.readFileSync(path.join(HERE, '../' + u + '/res/' + meta[uid].file));
    const weight = fam === 'IBM Plex Sans' ? '400 600' : w;               // Plex Sans is one variable file for 400-600
    css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');unicode-range:${range.trim()}}\n`;
    report.push(`${fam} ${weight} ${bytes.length} B (${hits.length} chars)`);
  }
  return css;
}

fs.mkdirSync(path.join(HERE, TEST ? 'out_test' : 'out'), { recursive: true });
const summary = [];
for (const pg of PAGES) {
  if (!fs.existsSync(path.join(HERE, 'src/' + pg.id + '.jsx'))) continue;
  let src = read('src/kit.jsx') + '\n' + (TEST ? read('src/gate.jsx') + '\n' : '') + read('src/' + pg.id + '.jsx')
    + '\n/* ═══ MOUNT ═══ */\nReactDOM.createRoot(document.getElementById(\'root\')).render(<Scene />);\n';
  src = src.replace('{/*#GATE*/}', TEST ? '<OverlapGate sched={sched} />' : '');
  if (!TEST && /OverlapGate|__PFE_TEST/.test(src)) throw new Error('test code in ship build');
  const js = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, removeComments: false, newLine: ts.NewLineKind.LineFeed } }).outputText;
  const app = `/* Inverse Laplace — ${pg.name} ${VERSION} — application script (precompiled from JSX; no in-browser compiler) */\n(function () {\n'use strict';\n${js}\n})();\n`;
  if (app.includes('</script')) throw new Error('script terminator in app');

  // clips: old embedded set, with any delivered v1.1.0 clip merged over the clip of the same name
  const clips = parseClips(read('../' + pg.u + '/audio.js'));
  if (Object.keys(clips).length !== pg.n) throw new Error(pg.id + ': expected ' + pg.n + ' clips, found ' + Object.keys(clips).length);
  const newFile = path.join(HERE, '../clips_new/' + pg.id + '_clips_' + VERSION + '.js'); const merged = [];
  if (fs.existsSync(newFile)) for (const [k, v] of Object.entries(parseClips(fs.readFileSync(newFile, 'utf8')))) {
    if (!(k in clips)) throw new Error('unknown clip ' + k); clips[k] = v; merged.push(k);
  }
  const clipJson = JSON.stringify(clips);

  // characters the page can show -> font subsets
  const used = new Set(); const text = js.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (const ch of text) used.add(ch.codePointAt(0));
  const fontReport = []; const fonts = fontCss(pg.u, used, fontReport);

  const meta = JSON.parse(read('../' + pg.u + '/meta.json'));
  const res = (needle) => { for (const v of Object.values(meta)) { const p = path.join(HERE, '../' + pg.u + '/res/' + v.file); if (v.mime === 'text/javascript' && fs.readFileSync(p, 'utf8').slice(0, 200).includes(needle)) return fs.readFileSync(p, 'utf8'); } throw new Error(needle); };
  const react = res('react.production.min.js'), reactDom = res('react-dom.production.min.js');

  const css = fonts + `html,body{margin:0;height:100%;background:#F1EFE8}
#root{position:fixed;inset:0}
button{font:inherit}
button:focus-visible,[role="slider"]:focus-visible,input:focus-visible{outline:3px solid oklch(0.50 0.14 255);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.up,.up *{color:#858A94 !important;border-color:#D5D8DD !important}
.up .bar{background:#858A94 !important}
noscript{position:fixed;left:12px;bottom:12px;font:14px/1.4 system-ui,sans-serif;color:#23262E}
`;
  const title = `Inverse Laplace — ${pg.name} ${VERSION}`;
  const csp = `default-src 'none'; script-src ${sha(react)} ${sha(reactDom)} ${sha(app)}; style-src ${sha(css)}; font-src data:; media-src blob:; base-uri 'none'; form-action 'none'`;
  const html = `<!DOCTYPE html>
<!--
  Inverse Laplace — ${pg.name} (ECE 2003, Inverse Laplace ${pg.of})
  Version: ${VERSION}${TEST ? ' TEST BUILD — not for publication' : ''}
  Released: ${RELEASED}
  Author: Claude Code. Owner: Douglas Jussaume, University of Tulsa ECE.
  Changelog: ${VERSION} — rebuilt from the Design bundle as one precompiled file (spec v1.1.0, items G1–G6, V1–V7):
  no in-browser compiler and no bundle loader; opening summary card; key-point line; F(s) and f(t) on all three pages;
  Your-turn problem with Show solution; unknowns in amber; contrast and 13 px minimum text; one playback bar;
  numbered f(t) axes; heading "Inverse Laplace". The worked example and its numbers are unchanged.
  Third-party: React 18.3.1 and ReactDOM 18.3.1 (MIT, production builds, inlined); IBM Plex Sans and IBM Plex Mono
  (SIL OFL 1.1, subsets inlined). Narration: pre-rendered en-GB clips, embedded.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="version" content="${VERSION}">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>This page needs JavaScript to play.</noscript>
<script type="application/json" id="clip-data">${clipJson}</script>
<script>${react}</script>
<script>${reactDom}</script>
<script>${app}</script>
</body>
</html>
`;
  const out = path.join(HERE, TEST ? 'out_test' : 'out', pg.file);
  fs.writeFileSync(out, html);
  fs.writeFileSync(path.join(HERE, (TEST ? 'out_test/' : 'out/') + pg.id + '.app.js'), app);
  summary.push({ file: pg.file, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex'),
    parts: { clips: clipJson.length, react: react.length + reactDom.length, app: Buffer.byteLength(app), css: Buffer.byteLength(css) },
    csp: { react: sha(react), reactDom: sha(reactDom), app: sha(app), style: sha(css) }, fonts: fontReport, mergedClips: merged });
}
fs.writeFileSync(path.join(HERE, TEST ? 'out_test/summary.json' : 'out/summary.json'), JSON.stringify(summary, null, 1));
for (const s of summary) console.log(s.file, s.bytes, JSON.stringify(s.parts), s.fonts.join(' | '), 'merged:', s.mergedClips.join(',') || 'none');
