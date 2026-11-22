import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
await p.goto('file:///home/user/ece-utulsa.github.io/ece-2003/index.html'); await p.waitForTimeout(800);
const links = await p.evaluate(() => Array.from(document.querySelectorAll('a')).filter((a) => /Inverse Laplace/.test(a.textContent)).map((a) => ({ href: decodeURI(a.getAttribute('href')), text: a.innerText.replace(/\s+/g, ' ').slice(0, 170) })));
console.log(JSON.stringify(links, null, 1), 'page errors', errs.length);
for (const l of links) { const q = await b.newPage(); await q.goto('file:///home/user/ece-utulsa.github.io/ece-2003/' + l.href); console.log(l.href, '->', await q.title()); await q.close(); }
await b.close();
