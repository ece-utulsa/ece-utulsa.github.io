// Power Divider Designer — the page's acceptance tests run in Node, without a browser: engine.js, layout.js, ui.js and
// tests.js are loaded into one context and every test of TESTS() is run. Tests that need the DOM (the drawn SVG, the
// raster and timing tests) are reported as skipped here; tests/browser.test.js runs them in Chromium.
// Run: node tests/engine.test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
const ctx = { console }; vm.createContext(ctx);
const code = ['engine.js', 'layout.js', 'ui.js', 'tests.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
vm.runInContext(code + '\n;this.T = TESTS();', ctx, { filename: 'pdd-node' });
let pass = 0, fail = 0, skip = 0;
for(const [name, fn] of ctx.T){
  let r; try { r = fn(); } catch(e){ if(/document|is not defined/.test(e.message)){ skip++; console.log('SKIP', name, '(needs the DOM)'); continue; } r = { pass: false, got: 'error: ' + e.message }; }
  if(r.pass){ pass++; console.log('PASS', name, '\n     ', r.got); } else { fail++; console.log('FAIL', name, '\n     ', r.got); }
}
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
