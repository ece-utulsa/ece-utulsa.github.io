/* Digital Logic Breadboard — Tutorial + Experiments content and the truth-table checker UI. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants    — 2-bit counter vector size, gates tabulated in the Tutorial
   2. Helpers      — DOM builders h/p/b/i, gateTable, resultTable, upCount2, noParts, syncClocks
   3. Tutorial     — the Tutorial page
   4. Experiments  — EXPS card data and the Experiments page with its Check buttons
   5. Export       — window.DLB.pages
   ============================================================ */
(function(){
const { DEFS, checkVectors, typesUsed, flipFlops, rowBits, NEST_MAX } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const COUNTER_STATES = 4;        // a 2-bit counter has 4 states; its checker steps through one full cycle
const TUTORIAL_GATES = ['AND','OR','NOT','NAND','NOR','XOR','XNOR'];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────────
// Element with a class and children (strings become text nodes, never HTML).
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if(cls) e.className = cls; kids.flat().forEach(k => e.append(k instanceof Node ? k : document.createTextNode(String(k)))); return e; };
// Paragraph, bold and italic shorthands.
const p = (...k) => h('p','',...k), b = t => h('b','',t), i = t => h('i','',t);

// Truth table for a gate def over all input combinations.
function gateTable(type){
  const d = DEFS[type], n = d.ins.length, tb = h('table','tt'); tb.append(h('caption','',d.name));
  const tr = h('tr'); d.ins.forEach(x=>tr.append(h('th','',x))); d.outs.forEach(x=>tr.append(h('th','',x))); tb.append(tr);
  for(let k=0;k<(1<<n);k++){ const inv = rowBits(k, n), out = d.fn(inv,{}); const r = h('tr');
    inv.forEach(v=>r.append(h('td',v?'h':'l',v))); out.forEach(v=>r.append(h('td',v?'h':'l',v))); tb.append(r); }
  return tb;
}
// Checker result: inputs, then wanted and measured value for each output; mismatches marked.
function resultTable(res){
  const tb = h('table','tt'); const ins = Object.keys(res.rows[0].in), outs = Object.keys(res.rows[0].want);
  const tr = h('tr'); ins.forEach(x=>tr.append(h('th','',x))); outs.forEach(x=>{ tr.append(h('th','',x+' want')); tr.append(h('th','',x+' got')); }); tb.append(tr);
  res.rows.forEach(r=>{ const row = h('tr'); ins.forEach(x=>row.append(h('td',r.in[x]?'h':'l',r.in[x])));
    outs.forEach(x=>{ row.append(h('td',r.want[x]?'h':'l',r.want[x])); row.append(h('td', r.got[x]===r.want[x] ? (r.got[x]?'h':'l') : 'bad', r.got[x])); }); tb.append(row); });
  return tb;
}
// Vectors for a 2-bit up-counter clocked by CK: one full cycle, each edge then the clock's return LOW.
function upCount2(){
  const v = []; let n = 0;
  for(let e=0;e<COUNTER_STATES;e++){ const m = (n+1) % COUNTER_STATES;
    v.push({in:{CK:1},out:{Q0:m&1,Q1:(m>>1)&1}}); n = m; v.push({in:{CK:0},out:{Q0:n&1,Q1:(n>>1)&1}}); }
  return v;
}
// A rule that forbids packaged parts, so a "build it from gates" experiment is built from gates. Parts inside a
// subsystem count too.
function noParts(types){ return ckt => { const used = types.filter(t => typesUsed(ckt.comps).has(t)); return used.length ? 'build it from gates \u2014 remove the '+used.map(t=>DEFS[t].name).join(', ')+' part'+(used.length>1?'s':'')+(ckt.comps.some(c => DEFS[c.type].sub) ? ' (subsystems included)' : '')+'.' : null; }; }
// The synchronous-counter rule: at least two flip-flops, each clocked straight from SWITCH CK, counting the ones
// inside subsystems (a block's flip-flop is clocked straight from CK when its port is, CQ-DL-038).
function syncClocks(ckt){
  const ck = ckt.comps.find(c => c.type==='SW' && c.label==='CK'); if(!ck) return null;
  const f = flipFlops(ckt.comps, ckt.wires, from => from.c === ck.id);
  if(f.total < 2) return 'use two flip-flops (found '+f.total+(ckt.comps.some(c => DEFS[c.type].sub) ? ', subsystems included' : '')+').';
  return f.unclocked ? f.unclocked+' flip-flop clock'+(f.unclocked>1?'s are':' is')+' not driven straight from CK \u2014 that is a ripple counter, not a synchronous one.' : null;
}
// ── END HELPERS ───────────────────────────────────────────────

// ── TUTORIAL ──────────────────────────────────────────────────
// The Tutorial page.
function tutorial(){
  const w = h('div','wrap');
  w.append(h('h1','','Digital Logic ', b('Tutorial')),
    p('', h('span','lead','A digital signal takes one of two values: 0 (LOW) and 1 (HIGH). Every component on the board is a function from input bits to output bits — the simulator evaluates those functions literally, so what you see is the Boolean algebra, not an approximation of it.')));
  w.append(h('h2','','1 · Gates and truth tables'));
  w.append(p('A gate\u2019s behavior is fully specified by its ', b('truth table'), ': one row per input combination. The tables below are generated from the same functions the board uses.'));
  const g = h('div','tt-grid'); TUTORIAL_GATES.forEach(t=>g.append(gateTable(t))); w.append(g);
  w.append(h('h2','','2 · Boolean algebra'));
  w.append(h('div','eq', 'Identity   A·1 = A    A+0 = A', h('br'), 'Null       A·0 = 0    A+1 = 1', h('br'), 'Idempotent A·A = A    A+A = A', h('br'), 'Complement A·A\u0304 = 0    A+A\u0304 = 1', h('br'), 'Distributive A·(B+C) = A·B + A·C    A+(B·C) = (A+B)·(A+C)', h('br'), i('De Morgan'), '  (A·B)\u0304 = A\u0304 + B\u0304     (A+B)\u0304 = A\u0304 · B\u0304'));
  w.append(p('De Morgan\u2019s laws are why ', b('NAND'), ' and ', b('NOR'), ' are each ', b('universal'), ': any Boolean function can be built from one of them alone. Experiment 1 asks you to prove the NOT case on the board.'));
  w.append(h('h2','','3 · Combinational vs. sequential'));
  w.append(p('A ', b('combinational'), ' circuit\u2019s outputs depend only on its present inputs (gates, adders, comparators). A ', b('sequential'), ' circuit has ', b('state'), ' — its outputs depend on the history of inputs. The simplest state element is the ', b('SR latch'), ': two cross-coupled NOR gates. S=1 sets Q=1, R=1 resets Q=0, and S=R=0 ', i('holds'), ' the last value. S=R=1 is forbidden (both outputs go 0 and the release order decides the state).'));
  w.append(p('A ', b('flip-flop'), ' adds a clock: the output changes only on the clock\u2019s ', b('rising edge'), ' (the \u25B7 mark on the CK pin). The D flip-flop copies D to Q on each edge; T toggles when T=1; JK sets, resets, holds, or toggles for JK = 10, 01, 00, 11.'));
  w.append(h('div','eq','D FF    Q\u207A = D', h('br'), 'T FF    Q\u207A = T \u2295 Q', h('br'), 'JK FF   Q\u207A = J·Q\u0304 + K\u0304·Q', h('br'), 'SR latch  Q\u207A = S + R\u0304·Q   (S·R = 0 required)'));
  w.append(h('h2','','4 · Counters and registers'));
  w.append(p('Tie T=1 on a T flip-flop (or Q\u0304 back to D on a D flip-flop) and it ', b('divides the clock by 2'), '. Chain ', b('Q\u0304'), ' of one stage into CK of the next and each stage divides again — a ', b('ripple counter'), ' that counts ', b('up'), '. The direction matters because the flip-flops are rising-edge: stage 1 must advance when stage 0 falls from 1 to 0 (the carry), and that falling edge of Q is a rising edge of Q\u0304. Chaining Q instead clocks stage 1 when stage 0 rises, which counts ', b('down'), '. The simulator propagates these edges stage by stage, so you can watch the carry ripple in the timing diagram. CTR 4 is a packaged 4-bit counter; REG 4 and SHIFT 4 load in parallel or serially on each edge.'));
  w.append(h('h2','','5 · Adders'));
  w.append(h('div','eq','Half adder   S = A \u2295 B      C = A·B', h('br'), 'Full adder   S = A \u2295 B \u2295 Cin      Cout = A·B + Cin·(A \u2295 B)'));
  w.append(p('Chaining full adders Cout\u2192Cin builds a ripple-carry adder of any width. ', b('ADD 4'), ' packages four of them and keeps a ', b('carry-in'), ' (Cin), like the 74LS283: two ADD 4 blocks cascade Cout\u2192Cin into an 8-bit adder. Tie an unused Cin to 0 or GND (an open Cin reads 0).'));
  w.append(p('Wire the sum to a ', b('BCD 7-SEG'), ' (inputs D0..D3, LSB at the top — same order as the counter and adder outputs, so the wires run straight). It decodes like a ', b('7448'), ' BCD-to-7-segment decoder: codes 0\u20139 show the decimal digits (6 and 9 without tails, as the 7448 draws them), and codes 10\u201315 show the 7448\u2019s non-digit patterns (15 is blank). It is a BCD display, so a sum above 9 does not appear as a hex letter: read it from the Cout and S3..S0 LEDs, or as the 7448 pattern.'));
  w.append(p('The plain ', b('7-SEG'), ' exposes every segment: inputs a\u2013g and DP each light one segment while HIGH (a at the top, then clockwise b, c, d, e, f, and g in the middle). Drive it from your own decoder \u2014 gates, or a subsystem (\u00a712) \u2014 to show any pattern you like.'));
  w.append(h('h2','','6 · Multiplexers and decoders'));
  w.append(p('A ', b('multiplexer'), ' is a data selector: the select bits pick which input reaches Y. MUX 2:1 passes I0 when S=0 and I1 when S=1; MUX 4:1 uses S1 S0 as a 2-bit number to pick I0\u2026I3. The select inputs are on the top edge of the block (S0 at the left), the data inputs on the left. A ', b('decoder'), ' does the opposite job: it reads an n-bit address and raises exactly one of its 2\u207F outputs (only while EN=1). DEC 2:4 and DEC 3:8 have address bits A0 (LSB) upward.'));
  w.append(h('div','eq','MUX 2:1   Y = S\u0304·I0 + S·I1', h('br'), 'DEC 2:4   Y0 = A\u03041·A\u03040·EN   Y1 = A\u03041·A0·EN   Y2 = A1·A\u03040·EN   Y3 = A1·A0·EN'));
  w.append(p('A decoder makes every ', b('minterm'), ' of its inputs, so a decoder plus an OR gate builds any function: OR together the outputs listed in the function\u2019s \u03a3m. A 2\u207F:1 multiplexer can do the same by tying its data inputs to 0 and 1.'));
  w.append(h('h2','','7 · Truth tables from the board'));
  w.append(p('The ', b('Truth table'), ' button (Board panel) tabulates your circuit: every combination of the switches, in label order, with what each probe and LED reads, and each output\u2019s ', b('\u03a3m'), ' minterm list. Use it to check a design against the table you derived, or to read a function off a circuit and simplify it with a K-map. Circuits with memory (flip-flops, or gates wired in a feedback loop such as a latch) are tabulated from reset and flagged.'));
  w.append(h('h2','','8 · More flip-flops and counters'));
  w.append(p(b('D FF P/C'), ' adds asynchronous ', b('preset'), ' (PRE) and ', b('clear'), ' (CLR): they act at once, without waiting for a clock edge, and CLR wins if both are HIGH. On this board they are active HIGH, so an unwired PRE or CLR is inactive (real 74-series parts are usually active LOW, drawn with a bubble). ', b('CTR U/D'), ' counts up on each rising edge while UP=1 and down while UP=0, wrapping 15\u21920 and 0\u219215; RST clears it immediately.'));
  w.append(p('A ', b('synchronous'), ' counter clocks every flip-flop from the same clock and uses gates to decide which ones toggle: bit k toggles when all lower bits are 1 (T1 = Q0, T2 = Q0·Q1, \u2026). All bits change on the same edge, unlike the ripple counter of \u00a74, whose carry travels stage by stage.'));
  w.append(h('h2','','9 · State machines'));
  w.append(p('A ', b('finite state machine'), ' is flip-flops that hold the state, next-state logic that computes the next state from the present state and the inputs, and output logic. In a ', b('Moore'), ' machine the outputs depend on the state only, so they change just after a clock edge. Design one in the usual steps: state diagram \u2192 state table \u2192 assign bits to states \u2192 next-state and output equations (K-maps) \u2192 build with D flip-flops, one per state bit. Experiment 13 is a sequence detector built this way.'));
  w.append(h('h2','','10 · Power, resistors and LEDs'));
  w.append(p(b('VCC'),' is a constant 1 and ',b('GND'),' a constant 0 — the logic-level view of the supply rails. The ',b('R'),' part is an ideal series element: it passes the logic level unchanged, so VCC→R→input is a pull-up, GND→R→input a pull-down, and gate→R→LED the usual current-limited indicator. The simulator is two-valued, so no voltage drop, current, or resistance value is modeled; R documents the circuit’s intent rather than changing its logic. The ',b('LED'),' is a logic indicator with one input: it lights while that input is HIGH. It needs no VCC, GND or resistor — wire any output straight to it.'));
  w.append(h('h2','','11 · About the simulator'));
  w.append(p('Gates are ', b('ideal'), ': zero propagation delay, no fan-out limit. An ', b('open'), ' (unwired) input reads 0 by convention and is drawn with a dashed stub and hollow ring; a PROBE on an open input shows OPEN rather than 0, and the Open-inputs readout counts them. The board iterates all gates to a fixed point after every change; a loop that never settles (e.g. a ring of an odd number of inverters) is flagged ', h('span','', 'UNSTABLE'), ' and each gate is marked ~. Flip-flops sample on the rising edge after the combinational logic has settled, then settle again — repeated until no further edge fires, which is what makes ripple counters work. Reset FFs, Import and reload restore state without firing an edge, even if a clock input is HIGH at that moment. Each input takes one wire: wiring a second driver to an input replaces the first, and the board says so (Undo brings it back). Signal labels (switches, buttons, clocks, probes, LEDs) are unique and never blank, so every trace, table column and checker name means one part. Glitches and race conditions caused by real gate delays are therefore ', b('not'), ' modeled.'));
  w.append(h('h2','','12 · Subsystems'));
  w.append(p('A ', b('subsystem'), ' hides a circuit inside one block, the way a chip hides its gates. Build and test the circuit, press ', b('Make subsystem'), ', drag a box around it and give it a name: the parts in the box become a single block. Each SWITCH (or BUTTON, CLOCK) in the box becomes an input pin and each PROBE or LED an output pin, named by its label and ordered top to bottom; a wire that crossed the box edge becomes a pin too, so the block stays connected to the rest of the board. The block keeps the state of any flip-flops inside.'));
  w.append(p('The new subsystem is added to ', b('Components \u203a Subsystems'), ': place as many copies as you need, each with its own state \u2014 a full adder made once becomes four for a 4-bit adder. A subsystem can contain other subsystems, up to '+NEST_MAX+' levels deep. ', b('Ungroup'), ' puts a block\u2019s circuit back on the board. Export saves the subsystems with the board.'));
  return w;
}
// ── END TUTORIAL ──────────────────────────────────────────────

// ── EXPERIMENTS ───────────────────────────────────────────────
// Card data: title, tag, goal text, checker vectors (null = no checker) and an optional circuit rule.
const EXPS = [
  { t:'NOT from a NAND', tag:'Universal gates', goal:['Build an inverter using only a ', b('NAND'),' gate. Inputs: SWITCH ',b('A'),'. Output: PROBE ',b('Y'),' (or an LED). Hint: tie both NAND inputs to A.'],
    vec:[{in:{A:0},out:{Y:1}},{in:{A:1},out:{Y:0}}] },
  { t:'OR from NANDs', tag:'De Morgan', goal:['Build ', b('A + B'),' using only NAND gates (three is enough). Inputs ',b('A'),', ',b('B'),'; output PROBE ',b('Y'),'.'],
    vec:[0,1,2,3].map(k=>({in:{A:k>>1,B:k&1},out:{Y:(k>>1|k&1)}})) },
  { t:'Half adder', tag:'Arithmetic', goal:['From an XOR and an AND, build a half adder. Inputs ',b('A'),', ',b('B'),'; PROBE ',b('S'),' (sum) and PROBE ',b('C'),' (carry).'],
    vec:[0,1,2,3].map(k=>{const a=k>>1,b2=k&1;return {in:{A:a,B:b2},out:{S:a^b2,C:a&b2}};}) },
  { t:'Full adder', tag:'Arithmetic', goal:['Build a full adder from two half adders (HALF ADD blocks or gates) and an OR. Inputs ',b('A'),', ',b('B'),', ',b('Ci'),'; PROBE ',b('S'),' and PROBE ',b('Co'),'.'],
    vec:[0,1,2,3,4,5,6,7].map(k=>{const a=k>>2&1,b2=k>>1&1,c=k&1,n=a+b2+c;return {in:{A:a,B:b2,Ci:c},out:{S:n&1,Co:n>1?1:0}};}) },
  { t:'SR latch from NOR gates', tag:'Sequential', goal:['Cross-couple two ',b('NOR'),' gates. Inputs ',b('S'),', ',b('R'),'; output PROBE ',b('Q'),'. The checker sets, holds, resets, and holds — the hold rows only pass if your circuit remembers.'],
    vec:[{in:{S:0,R:1},out:{Q:0}},{in:{S:0,R:0},out:{Q:0}},{in:{S:1,R:0},out:{Q:1}},{in:{S:0,R:0},out:{Q:1}},{in:{S:0,R:1},out:{Q:0}},{in:{S:0,R:0},out:{Q:0}}] },
  { t:'Divide-by-2', tag:'Sequential', goal:['Make a ',b('D FF'),' toggle on every clock edge (feed Q\u0304 back to D). Use SWITCH ',b('CK'),' as a manual clock; PROBE ',b('Q'),'. The checker pulses CK 0\u21921\u21920 and expects Q to alternate.'],
    vec:[{in:{CK:0},out:{Q:0}},{in:{CK:1},out:{Q:1}},{in:{CK:0},out:{Q:1}},{in:{CK:1},out:{Q:0}},{in:{CK:0},out:{Q:0}},{in:{CK:1},out:{Q:1}}] },
  { t:'2-bit ripple counter', tag:'Sequential', goal:['Chain two toggling flip-flops: SWITCH ',b('CK'),' clocks stage 0; its ',b('Q\u0304'),' clocks stage 1 (clocking from Q would count down — see Tutorial §4). PROBE ',b('Q0'),', PROBE ',b('Q1'),'. The checker expects an up-count 1, 2, 3, 0. Watch the carry ripple in the timing diagram.'],
    vec:upCount2() },
  { t:'BCD to 7-segment (7448)', tag:'Display \u00b7 not checked', goal:['Wire four switches ',b('D0'),'\u2026',b('D3'),' to a BCD 7-SEG, then a 4-bit sum from ADD 4. No checker \u2014 step the code from 0 to 15 and compare the display with the 7448 function table: 0\u20139 are the decimal digits (6 and 9 without tails), 10\u201315 the decoder\u2019s non-digit patterns, and 15 is blank.'], vec:null },
  { t:'2:1 multiplexer from gates', tag:'Combinational', goal:['Build Y = S\u0304\u00b7I0 + S\u00b7I1 from AND, OR and NOT gates (not the MUX part). Inputs ',b('I0'),', ',b('I1'),', ',b('S'),'; PROBE ',b('Y'),'. Compare your circuit\u2019s ',b('Truth table'),' with the equation.'],
    rule: noParts(['MUX2','MUX4']),
    vec:[0,1,2,3,4,5,6,7].map(k=>{const s=k>>2&1,i1=k>>1&1,i0=k&1;return {in:{S:s,I1:i1,I0:i0},out:{Y:s?i1:i0}};}) },
  { t:'2-to-4 decoder from gates', tag:'Combinational', goal:['Build a decoder from AND and NOT gates (not the DEC part). Inputs ',b('A1'),', ',b('A0'),'; PROBEs ',b('Y0'),'\u2026',b('Y3'),' \u2014 exactly one output HIGH, the one whose number is A1 A0.'],
    rule: noParts(['DEC2','DEC3']),
    vec:[0,1,2,3].map(k=>({in:{A1:k>>1,A0:k&1},out:{Y0:+(k===0),Y1:+(k===1),Y2:+(k===2),Y3:+(k===3)}})) },
  { t:'1-bit magnitude comparator', tag:'Combinational', goal:['From gates (not the CMP part), compare two bits. Inputs ',b('A'),', ',b('B'),'; PROBEs ',b('GT'),' (A>B), ',b('EQ'),' (A=B), ',b('LT'),' (A<B). Hint: GT = A\u00b7B\u0304, EQ is an XNOR.'],
    rule: noParts(['CMP']),
    vec:[0,1,2,3].map(k=>{const a=k>>1,bb=k&1;return {in:{A:a,B:bb},out:{GT:+(a>bb),EQ:+(a===bb),LT:+(a<bb)}};}) },
  { t:'2-bit synchronous counter', tag:'Sequential', goal:['Clock ',b('both'),' flip-flops from SWITCH ',b('CK'),' (no ripple): stage 0 toggles every edge, stage 1 toggles when Q0 = 1. Use T or JK flip-flops. PROBE ',b('Q0'),', PROBE ',b('Q1'),'. The checker expects 1, 2, 3, 0 and also checks that every flip-flop\u2019s clock comes straight from CK.'],
    rule: syncClocks,
    vec:upCount2() },
  { t:'Sequence detector (101)', tag:'State machine', goal:['Design a ',b('Moore'),' machine that sets ',b('Z'),' = 1 after the last three bits sampled from ',b('X'),' were 1, 0, 1 (overlapping: 10101 detects twice). Sample X on the rising edge of SWITCH ',b('CK'),'; PROBE ',b('Z'),'. Use D flip-flops for the state; Z must depend on the state only. Start: all flip-flops 0 = nothing seen yet.'],
    vec:(()=>{const xs=[1,0,1,0,1,1,0,1,0,0,1],v=[];let h=[0,0,0],z=0;xs.forEach(x=>{v.push({in:{X:x,CK:0},out:{Z:z}});h=[h[1],h[2],x];z=+(h[0]===1&&h[1]===0&&h[2]===1);v.push({in:{X:x,CK:1},out:{Z:z}});});return v;})() },
];
// The Experiments page: one card per experiment, Check runs the vectors on a copy of the board.
function experiments(ckt, gotoSim){
  const w = h('div','wrap');
  w.append(h('h1','','Guided ', b('Experiments')), p('', h('span','lead','Build each circuit on the Sim board using the exact SWITCH and PROBE labels named (double-click a component to rename it), then press Check. The checker runs on a copy of your board — flip-flops start from reset, the named switches start LOW, then the switches are driven through every vector in order and the probes are read. Your board is not changed.')));
  const cards = h('div','cards');
  EXPS.forEach((ex,k)=>{
    const card = h('div','card'); card.append(h('h3','', (k+1)+' · '+ex.t, h('span','',ex.tag)), h('p','goal',...ex.goal));
    const res = h('div','res'); const acts = h('div','acts');
    const go = h('button','btn','Open board'); go.onclick = gotoSim; acts.append(go);
    if(ex.vec){ const chk = h('button','btn','Check'); acts.append(chk);
      chk.onclick = ()=>{ const r = checkVectors(ckt, ex.vec); res.replaceChildren(); res.className = 'res '+(r.ok?'ok':'bad');
        if(r.missing.length){ res.append('Missing on board: '+r.missing.join(', ')); return; }
        if(r.duplicates.length){ res.append('Two parts share a label: '+r.duplicates.join(', ')+'. Rename one so the checker knows which to use.'); return; }
        const why = ex.rule ? ex.rule(ckt) : null;
        if(why){ res.className = 'res bad'; res.append('FAIL \u2014 '+why); return; }
        res.append(r.ok ? 'PASS — all '+r.rows.length+' vectors match.' : 'FAIL — '+r.rows.filter(x=>!x.ok).length+' of '+r.rows.length+' vectors differ.', resultTable(r)); }; }
    card.append(acts, res); cards.append(card);
  });
  w.append(cards); return w;
}
// ── END EXPERIMENTS ───────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
window.DLB.pages = { tutorial, experiments };
// ── END EXPORT ────────────────────────────────────────────────
})();
