// Digital Logic Breadboard — developer model tests (Node, no browser). Run: node tests/model.test.js
// Loads defs.js and sim.js into a minimal window shim and checks the simulator, labels, validation,
// checker and truth table. These are developer tests, not the acceptance suite.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
global.window = {};
for(const f of ['defs.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
const { DEFS, Circuit, checkVectors, truthTable } = window.DLB;

let pass = 0, fail = 0;
function t(name, fn){ return Promise.resolve().then(fn).then(() => { pass++; console.log('PASS', name); }, e => { fail++; console.log('FAIL', name, '-', e.message); }); }
function eq(a, b, m){ const x = JSON.stringify(a), y = JSON.stringify(b); if(x !== y) throw new Error((m||'')+' got '+x+' want '+y); }
function ok(v, m){ if(!v) throw new Error(m || 'expected true'); }

// Helpers: build circuits on the model.
const W = (k, f, fp, to, tp) => k.connect({ c:f.id, pin:fp }, { c:to.id, pin:tp });
const lab = (k, c, s) => { const why = k.setLabel(c, s); if(why) throw new Error(why); return c; };
function dff(k){ return k.add('DFF', 0, 0); }

(async () => {
// ── Combinational ──
await t('ADD 4 with carry-in: all 512 vectors equal A+B+Cin', () => {
  for(let n=0;n<512;n++){ const a = n & 15, b = (n >> 4) & 15, ci = n >> 8;
    const i = [a&1,a>>1&1,a>>2&1,a>>3&1, b&1,b>>1&1,b>>2&1,b>>3&1, ci];
    const o = DEFS.ADD4.fn(i), s = o[0] | o[1]<<1 | o[2]<<2 | o[3]<<3 | o[4]<<4; eq(s, a+b+ci, 'n='+n); }
});
await t('Gates: AND/OR/XOR/NAND/NOR/XNOR/NOT tables', () => {
  const T = { AND:[0,0,0,1], OR:[0,1,1,1], XOR:[0,1,1,0], NAND:[1,1,1,0], NOR:[1,0,0,0], XNOR:[1,0,0,1] };
  for(const [g, want] of Object.entries(T)) eq([0,1,2,3].map(k => DEFS[g].fn([k>>1, k&1])[0]), want, g);
  eq([DEFS.NOT.fn([0])[0], DEFS.NOT.fn([1])[0]], [1,0], 'NOT');
});

// ── Edge memory regressions (DL-001..004) ──
await t('DL-001: Reset FFs with CK HIGH leaves Q = 0', () => {
  const k = new Circuit(), one = k.add('HI',0,0), sw = k.add('SW',0,0), f = dff(k), pr = k.add('PROBE',0,0);
  W(k,one,0,f,0); W(k,sw,0,f,1); W(k,f,0,pr,0); sw.state.on = 1; k.update(); eq(f.state.q, 1, 'before');
  k.resetState(); eq(f.state.q, 0, 'after reset'); eq(pr.inv[0], 0);
});
await t('DL-002: export/import with CK HIGH does not apply an edge (v2 and v1 files)', () => {
  const k = new Circuit(), d = k.add('SW',0,0), ck = k.add('SW',0,0), f = dff(k);
  W(k,d,0,f,0); W(k,ck,0,f,1); ck.state.on = 1; k.update(); d.state.on = 1; k.update(); eq(f.state.q, 0);
  const j = k.toJSON(), k2 = new Circuit(); ok(k2.load(j).ok); eq(k2.comp(f.id).state.q, 0, 'v2');
  const j1 = JSON.parse(JSON.stringify(j)); j1.v = 1; j1.comps.forEach(c => delete c.prevClk);
  const k3 = new Circuit(); ok(k3.load(j1).ok); eq(k3.comp(f.id).state.q, 0, 'v1');
});
await t('DL-003/004: Exp 6 and Exp 7 circuits pass with CK left HIGH; board unchanged by Check', () => {
  const k = new Circuit(), ck = lab(k, k.add('SW',0,0), 'CK'), f0 = dff(k), f1 = dff(k), q0 = lab(k, k.add('PROBE',0,0), 'Q0'), q1 = lab(k, k.add('PROBE',0,0), 'Q1');
  W(k,f0,1,f0,0); W(k,f1,1,f1,0); W(k,ck,0,f0,1); W(k,f0,1,f1,1); W(k,f0,0,q0,0); W(k,f1,0,q1,0);
  ck.state.on = 1; k.update(); const before = JSON.stringify(k.toJSON());
  const v = []; let n = 0; for(let e=0;e<4;e++){ const m = (n+1)%4; v.push({in:{CK:1},out:{Q0:m&1,Q1:m>>1&1}}); n = m; v.push({in:{CK:0},out:{Q0:n&1,Q1:n>>1&1}}); }
  const r = checkVectors(k, v); ok(r.ok, 'Exp 7 ripple Q̄-chained should pass: '+JSON.stringify(r.rows.filter(x=>!x.ok)));
  eq(JSON.stringify(k.toJSON()), before, 'board unchanged');
});

// ── Labels (CQ-DL-010) ──
await t('Auto labels are unique across signal types', () => {
  const k = new Circuit(), s = k.add('SW',0,0); lab(k, s, 'L1');
  const l = k.add('LED',0,0); ok(l.label !== 'L1', 'LED must not reuse L1, got '+l.label);
  const p = k.add('PROBE',0,0); lab(k, p, 'P9'); const p2 = k.add('PROBE',0,0); ok(p2.label !== 'P9');
});
await t('setLabel refuses blank and duplicate signal labels, allows blank on a gate', () => {
  const k = new Circuit(), a = k.add('SW',0,0), b = k.add('LED',0,0), g = k.add('AND',0,0);
  ok(k.setLabel(a, ''), 'blank refused'); ok(k.setLabel(b, a.label), 'duplicate across types refused');
  ok(k.setLabel(a, 'x'.repeat(11)), 'too long refused'); eq(k.setLabel(g, ''), null, 'gate blank ok');
});
await t('Import repairs blank and duplicate signal labels and reports them', () => {
  const j = { v:2, comps:[{id:1,type:'SW',x:0,y:0,label:'A'},{id:2,type:'SW',x:0,y:0,label:'A'},{id:3,type:'PROBE',x:0,y:0,label:''},{id:4,type:'PROBE',x:0,y:0}], wires:[] };
  const k = new Circuit(), r = k.load(j); ok(r.ok); eq(r.relabelled.length, 3);
  const labels = k.comps.map(c => c.label); eq(new Set(labels).size, 4, 'unique'); ok(labels.every(Boolean), 'none blank');
});
await t('Checker reports duplicate labels instead of resolving them', () => {
  const k = new Circuit(), a = k.add('SW',0,0), b = k.add('SW',0,0), p = k.add('PROBE',0,0); W(k,a,0,p,0);
  a.label = 'A'; b.label = 'A'; p.label = 'Y';   // forced past setLabel, as an old build could produce
  const r = checkVectors(k, [{in:{A:0},out:{Y:0}}]); ok(!r.ok); eq(r.duplicates, ['SWITCH "A"']);
});

// ── Import validation (CQ-DL-020, SEC-DL-004) ──
const base = () => ({ v:2, comps:[{id:1,type:'SW',x:0,y:0,label:'A',state:{on:0}},{id:2,type:'NOT',x:0,y:0,state:{}},{id:3,type:'SW',x:0,y:0,label:'B',state:{on:1}}],
                       wires:[{from:{c:1,pin:0},to:{c:2,pin:0}}] });
const bad = (mut, frag) => () => { const j = base(); mut(j); const r = Circuit.validate(j); ok(!r.ok, 'should be rejected'); ok(r.errors.join(' ').includes(frag), 'message "'+frag+'" in '+JSON.stringify(r.errors)); };
await t('Valid file passes', () => { ok(Circuit.validate(base()).ok); });
await t('Reject __proto__ in state', bad(j => { j.comps[0].state = JSON.parse('{"__proto__":{"x":1},"on":0}'); }, 'unknown field'));
await t('Reject long label', bad(j => { j.comps[0].label = 'x'.repeat(5040); }, 'label'));
await t('Reject non-string label', bad(j => { j.comps[0].label = 42; }, 'label'));
await t('Reject unknown colour', bad(j => { j.comps[0].color = '__proto__'; }, 'color'));
await t('Reject non-numeric rot', bad(j => { j.comps[0].rot = 'x'; }, 'rot'));
await t('Reject state value out of range', bad(j => { j.comps[0].state = { on: 2 }; }, 'state.on'));
await t('Reject second wire into one input', bad(j => { j.wires.push({from:{c:3,pin:0},to:{c:2,pin:0}}); }, 'second wire'));
await t('Reject newer file format', bad(j => { j.v = 3; }, 'newer'));
await t('Reject too many parts', bad(j => { j.comps = Array.from({length:501}, (_,i) => ({id:i+1,type:'AND',x:0,y:0})); j.wires = []; }, 'Too many parts'));
await t('Reject unknown part type named "constructor"', bad(j => { j.comps[1].type = 'constructor'; }, 'unknown part type'));
await t('Counter state accepts 0..15 and rejects 16', () => {
  const j = { v:2, comps:[{id:1,type:'CNT4',x:0,y:0,state:{n:15}}], wires:[] }; ok(Circuit.validate(j).ok);
  j.comps[0].state.n = 16; ok(!Circuit.validate(j).ok);
});
await t('Failed load leaves the board unchanged', () => {
  const k = new Circuit(); k.add('AND',0,0); const r = k.load({ comps:[{id:1,type:'OR',x:0,y:0}] }); ok(!r.ok); eq(k.comps.length, 1); eq(k.comps[0].type, 'AND');
});

// ── Wires, signals, batching ──
await t('connect() returns the wire it replaced (DL-010)', () => {
  const k = new Circuit(), a = k.add('SW',0,0), b = k.add('SW',0,0), n = k.add('NOT',0,0);
  eq(W(k,a,0,n,0), null); const old = W(k,b,0,n,0); ok(old && old.from.c === a.id); eq(k.wires.length, 1);
});
await t('Open probe reports null in signals() (CQ-DL-022)', () => {
  const k = new Circuit(), p = k.add('PROBE',0,0); eq(k.signals().find(s => s.id === p.id).val, null);
});
await t('batch(): one change event and one revision for a multi-step build (CQ-DL-004)', () => {
  const k = new Circuit(); let n = 0; k.onChange(() => n++); const r0 = k.rev;
  k.batch(() => { const a = k.add('SW',0,0), g = k.add('NOT',0,0), p = k.add('PROBE',0,0); W(k,a,0,g,0); W(k,g,0,p,0); });
  eq(n, 1, 'events'); eq(k.rev, r0 + 1, 'rev');
});
await t('Switch flips and clock ticks are not edits (rev unchanged)', () => {
  const k = new Circuit(), s = k.add('SW',0,0), c = k.add('CLK',0,0), r0 = k.rev;
  DEFS.SW.click(s.state); k.update(); k.tickClocks(); eq(k.rev, r0);
});
await t('onBeforeEdit sees the board before the edit, once per edit', () => {
  const k = new Circuit(); k.add('SW',0,0); const seen = []; k.onBeforeEdit(() => seen.push(k.comps.length));
  k.batch(() => { k.add('NOT',0,0); k.add('NOT',0,0); }); eq(seen, [1]);
});

// ── Truth table (CQ-DL-008) ──
await t('Truth table: half adder exact, rows in label order', async () => {
  const k = new Circuit(), a = lab(k,k.add('SW',0,0),'A'), b = lab(k,k.add('SW',0,0),'B'), x = k.add('XOR',0,0), n = k.add('AND',0,0), s = lab(k,k.add('PROBE',0,0),'S'), c = lab(k,k.add('PROBE',0,0),'C');
  W(k,a,0,x,0); W(k,b,0,x,1); W(k,a,0,n,0); W(k,b,0,n,1); W(k,x,0,s,0); W(k,n,0,c,0);
  const T = await truthTable(k); eq(T.ins, ['A','B']); eq(T.outs, ['C','S']); eq(T.rows.map(r => r.out), [[0,0],[0,1],[0,1],[1,0]]); eq(T.seq, false);
});
await t('Truth table: 8-switch ADD 4 board, 256 rows correct, no slice over 50 ms', async () => {
  const k = new Circuit(), ad = k.add('ADD4',0,0), sw = [], pr = [];
  for(let i=0;i<8;i++){ const s = lab(k, k.add('SW',0,0), 'I'+i); sw.push(s); W(k,s,0,ad,i); }
  for(let i=0;i<5;i++){ const p = lab(k, k.add('PROBE',0,0), 'O'+i); pr.push(p); W(k,ad,i,p,0); }
  // a chain of 60 XOR gates on the side, as in the CQ timing case
  let prev = sw[0]; for(let i=0;i<60;i++){ const g = k.add('XOR',0,0); W(k,prev,0,g,0); W(k,sw[1],0,g,1); prev = g; }
  let worst = 0, lastT = performance.now(); const t0 = lastT;
  const T = await truthTable(k, () => { const now = performance.now(); worst = Math.max(worst, now - lastT); lastT = now; });
  worst = Math.max(worst, performance.now() - lastT);
  eq(T.rows.length, 256);
  T.rows.forEach((r, row) => { const bits = r.in, val = q => parseInt(q.map(String).join(''), 2);
    // labels sort I0..I7 (I0 = MSB of the row index); ADD4 A = I0..I3 (bit i), B = I4..I7
    const a = bits[0] | bits[1]<<1 | bits[2]<<2 | bits[3]<<3, b = bits[4] | bits[5]<<1 | bits[6]<<2 | bits[7]<<3;
    const s = r.out[0] | r.out[1]<<1 | r.out[2]<<2 | r.out[3]<<3 | r.out[4]<<4; if(s !== a+b) throw new Error('row '+row); void val; });
  console.log('     total', (performance.now()-t0).toFixed(1), 'ms; longest slice', worst.toFixed(1), 'ms');
  ok(worst < 50, 'longest slice '+worst.toFixed(1)+' ms');
});

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail ? 1 : 0);
})();
