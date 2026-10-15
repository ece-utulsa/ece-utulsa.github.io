/* Digital Logic Breadboard — page wiring: palette, demos, undo/redo, clock, board actions, truth table,
   import/export, pages and tweaks. Runs after defs.js, sim.js, board.js, timing.js and learn.js. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants      — clock, zoom, storage, import and notice settings, background themes
   2. Storage        — guarded localStorage access and validated restore
   3. Setup          — circuit, board, timing diagram, board notices
   4. Demos          — DEMOS table (layout data) and loadDemo
   5. Undo / redo    — snapshot before each edit, one step per edit or batch
   6. Palette        — component buttons, and the Subsystems list
   7. Readouts       — part / wire / open-input / clock readouts and debounced saving
   8. Clock          — Run / Step and the frequency slider
   9. Board actions  — LED colour, demos, rotate, reset, clear, undo, delete, rename, subsystems, zoom, keys
   10. Truth table   — modal, Σm lists, Copy CSV
   11. Files         — export, import, timing panel
   12. Pages         — Sim / Tutorial / Experiments
   13. Tweaks        — background theme and display toggles
   ============================================================ */
(function(){
const { DEFS, CATS, LED_COLORS, SUB_PREFIX, Circuit, Board, Timing, pages, truthTable, TT_MAX_IN, refreshTheme } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const HZ_DEFAULT = 2, HZ_MIN = 0.5, HZ_MAX = 10, HZ_STEP = 0.5;   // clock frequency slider (Hz)
const MS_PER_HZ_HALF = 500;      // half period in ms = MS_PER_HZ_HALF / f (1000 ms per second, two halves per period)
const ZOOM_STEP = 1.2;           // − / + buttons
const HIST_MAX = 100;            // undo steps kept
const PERSIST_MS = 400;          // board saved this long after the last change (and when the page is hidden)
const COPIED_MS = 1200;          // "Copied" shows this long on the CSV button
const TT_RENDER_ROWS = 32;       // truth-table rows added to the page per frame, so layout of a long table is spread out
const NOTICE_MS = 6000;          // board notices (replaced wire, relabelled parts) show this long
const IMPORT_MAX_MB = 1, IMPORT_MAX_BYTES = IMPORT_MAX_MB * 1e6;   // a circuit file larger than this is refused (SEC-DL-004)
const PAGES = ['sim','tut','exp'];
const DEMO_VIEW = { ox: 40, oy: 20, s: 1 };
const STORE_PREFIX = 'dlb.';
const BG_THEMES = {
  Charcoal: { '--bg':'#0f1218','--bg2':'#161b22','--bg3':'#1c222b','--inset':'#090c11','--line':'#262d38','--line2':'#333c49' },
  Slate:    { '--bg':'#0d141c','--bg2':'#141d27','--bg3':'#1a2531','--inset':'#070c12','--line':'#22303d','--line2':'#2f4150' },
  Black:    { '--bg':'#060709','--bg2':'#0d0f13','--bg3':'#13161c','--inset':'#000000','--line':'#1c222b','--line2':'#2a3340' },
};
const TWEAKS_DEFAULT = { theme:'Charcoal', grid:true, pins:true, wire:true };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STORAGE ───────────────────────────────────────────────────
// Element by selector.
const $ = s => document.querySelector(s);
// Save a value. Storage can be blocked (sandboxed embed, policy, quota): the tool then runs without saving (CQ-DL-009).
function store(k, v){ try { localStorage.setItem(STORE_PREFIX+k, JSON.stringify(v)); } catch(e){ /* not saved: storage unavailable */ } }
// Read a saved value, or d when it is missing, unreadable, or fails the check ok(v) (SEC-DL-006).
function load(k, d, ok){
  try { const s = localStorage.getItem(STORE_PREFIX+k); if(s === null) return d; const v = JSON.parse(s); return !ok || ok(v) ? v : d; }
  catch(e){ return d; }
}
// True for true / false.
const isBool = v => typeof v === 'boolean';
// True if k is one of o's own keys (never a prototype key such as "constructor").
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// A frequency the slider can show.
const validHz = v => Number.isFinite(v) && v >= HZ_MIN && v <= HZ_MAX && Number.isInteger((v - HZ_MIN) / HZ_STEP);
// Saved tweaks, field by field, falling back to the defaults.
function loadTweaks(){
  const t = load('tweaks', null, v => v && typeof v === 'object' && !Array.isArray(v)) || {};
  return { theme: own(BG_THEMES, t.theme) ? t.theme : TWEAKS_DEFAULT.theme,
           grid: isBool(t.grid) ? t.grid : TWEAKS_DEFAULT.grid, pins: isBool(t.pins) ? t.pins : TWEAKS_DEFAULT.pins, wire: isBool(t.wire) ? t.wire : TWEAKS_DEFAULT.wire };
}
// ── END STORAGE ───────────────────────────────────────────────

// ── SETUP ─────────────────────────────────────────────────────
refreshTheme();
const ckt = new Circuit(), board = new Board($('#board'), ckt), timing = new Timing($('#tdiag'), ckt);
let noteT = 0;
// Show a notice on the board for NOTICE_MS (replaced wire, relabelled parts).
function notice(t){ const n = $('#note'); n.textContent = t; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, NOTICE_MS); }
// Tell the student what a loaded board needed changed: blank or duplicate signal labels (boards saved by v1.0.0) and
// wires into the old LED cathode (boards saved before v1.2.0, when the LED had two pins).
function relabelNotice(what, res){
  const t = [];
  if(res.relabelled.length) t.push('Signal labels must be unique and not blank, so '+res.relabelled.length+' were changed: '+res.relabelled.join('; ')+'.');
  if(res.ledWires) t.push('LEDs now have one input, so '+res.ledWires+' wire'+(res.ledWires>1?'s':'')+' into an LED cathode (K) '+(res.ledWires>1?'were':'was')+' removed.');
  if(t.length) notice(what+'. '+t.join(' '));
}
// ── END SETUP ─────────────────────────────────────────────────

// ── DEMOS ─────────────────────────────────────────────────────
/* Demo circuits (layout data). Coordinates are chosen so every wire between aligned pins runs straight; adj sets a
   wire's route offset. Labels go through ckt.setLabel, so a demo obeys the same label rules as the student. */
// Label a demo part; a refused label is a bug in the demo table.
function named(c, t){ const why = ckt.setLabel(c, t); if(why) throw new Error('Demo label: '+why); return c; }
// Wire output pin fp of part f to input pin tp of part t, with an optional route offset.
function W(f, fp, t, tp, adj){ ckt.connect({c:f.id,pin:fp},{c:t.id,pin:tp}); if(adj) Object.assign(ckt.wires[ckt.wires.length-1], adj); }
const DEMOS = {
  'Binary counter': { clock:true, build(){
    const K = ckt.add('CLK',40,140), R = named(ckt.add('SW',40,220), 'RST'), C = ckt.add('CNT4',160,120), S = ckt.add('SEG7',360,120);
    W(K,0,C,0); W(R,0,C,1); for(let i=0;i<4;i++) W(C,i,S,i);
    const xs = [460,400,340,280];
    for(let i=0;i<4;i++){ const l = named(ckt.add('LED',xs[i],300), 'Q'+i); l.rot = 1; l.color = ['red','amber','green','blue'][i]; W(C,i,l,0); } } },
  'LED chaser': { clock:true, build(){
    const K = ckt.add('CLK',40,380), R = ckt.add('SHR4',160,320), N = ckt.add('NOT',160,520); N.rot = 2;
    W(K,0,R,1); W(R,3,N,0,{my:480}); W(N,0,R,0,{my:440});
    const xs = [460,400,340,280];
    for(let i=0;i<4;i++){ const l = named(ckt.add('LED',xs[i],480), 'Q'+i); l.rot = 1; l.color = ['red','amber','green','blue'][i]; W(R,i,l,0); } } },
  'Half adder': { build(){
    const A = ckt.add('SW',40,100), B = ckt.add('SW',40,180), X = ckt.add('XOR',160,80), N = ckt.add('AND',160,200);
    W(A,0,X,0,{mx:120}); W(A,0,N,0,{mx:110}); W(B,0,X,1,{mx:130}); W(B,0,N,1,{mx:120});
    const S = named(ckt.add('LED',300,100), 'S'), C = named(ckt.add('LED',300,220), 'C'); S.color='green'; C.color='red';
    W(X,0,S,0); W(N,0,C,0); } },
  '4-bit adder': { build(){
    const AD = ckt.add('ADD4',200,100), S = ckt.add('SEG7',400,140);
    for(let i=0;i<4;i++){ const s = named(ckt.add('SW',140-40*i,20), 'A'+i); s.rot = 1; W(s,0,AD,i); }
    for(let i=0;i<4;i++){ const s = named(ckt.add('SW',20+40*i,340), 'B'+i); s.rot = 3; W(s,0,AD,4+i); }
    const Z = ckt.add('LO',100,260); W(Z,0,AD,8);
    W(AD,0,S,0); W(AD,1,S,1); W(AD,2,S,2,{mx:360}); W(AD,3,S,3,{mx:330});
    const C = named(ckt.add('LED',400,280), 'Cout'); C.color='red'; W(AD,4,C,0,{mx:310}); } },
  'SR latch': { build(){
    const S = ckt.add('SW',40,240), R = ckt.add('SW',40,80), N1 = ckt.add('NOR',160,80), N2 = ckt.add('NOR',160,200); named(S,'S'); named(R,'R');
    W(R,0,N1,0); W(S,0,N2,1);
    W(N1,0,N2,0,{ax:264,my:190,bx:136}); W(N2,0,N1,1,{ax:276,my:170,bx:124});
    const Q = named(ckt.add('LED',320,100), 'Q'), QB = named(ckt.add('LED',320,220), 'Q̄'); Q.color='green'; QB.color='amber';
    W(N1,0,Q,0); W(N2,0,QB,0); } },
};
// Replace the board with a demo: one undo step, one redraw (CQ-DL-004).
function loadDemo(name){ const d = DEMOS[name]; if(!d) return; setRun(false);
  ckt.batch(() => { ckt.clear(); d.build(); ckt.update(); });
  timing.clear(); board.view = Object.assign({}, DEMO_VIEW); board.select(null); if(d.clock) setRun(true); }
// ── END DEMOS ─────────────────────────────────────────────────

// ── UNDO / REDO ───────────────────────────────────────────────
/* Every edit that changes the circuit's structure (parts, positions, rotation, labels, colours, wires) is one step;
   switch flips and clock ticks are not edits and cost nothing here (CQ-DL-014). The board is copied just before the
   edit (onBeforeEdit) and pushed once the edit is announced. A batch (demo, clear, import) is one step. */
const hist = { undo: [], redo: [], rev: null, pending: null, mute: 0 };
// Enable / disable the Undo and Redo buttons.
function histUpd(){ $('#undo').disabled = !hist.undo.length; $('#redo').disabled = !hist.redo.length; }
// Before an edit: keep the board as it was.
ckt.onBeforeEdit(() => { if(!hist.mute && hist.rev !== null) hist.pending = ckt.toJSON(); });
// After a change: if it was an edit, the kept board becomes an undo step.
function histTrack(){
  if(hist.mute || ckt.rev === hist.rev) return;
  if(hist.rev !== null && hist.pending){ hist.undo.push(hist.pending); if(hist.undo.length > HIST_MAX) hist.undo.shift(); hist.redo = []; }
  hist.rev = ckt.rev; hist.pending = null; histUpd();
}
// Move one step from one stack to the other and load it.
function histGo(from, to){ if(!from.length) return; const j = from.pop(); to.push(ckt.toJSON());
  setRun(false); hist.mute++; try { ckt.batch(() => ckt.load(j)); } finally { hist.mute--; }
  hist.rev = ckt.rev; hist.pending = null; timing.clear(); board.select(null); histUpd(); }
// Undo and redo one step.
const undo = () => histGo(hist.undo, hist.redo), redo = () => histGo(hist.redo, hist.undo);
ckt.onChange(histTrack);
// ── END UNDO / REDO ───────────────────────────────────────────

// ── PALETTE ───────────────────────────────────────────────────
const pal = $('#palette');
CATS.forEach(cat => { const hd = document.createElement('div'); hd.className='hint pal-cat'; hd.textContent = cat; pal.append(hd);
  const grid = document.createElement('div'); grid.className='pal';
  Object.keys(DEFS).filter(k=>DEFS[k].cat===cat).forEach(k => { const b = document.createElement('button'); b.textContent = DEFS[k].name; b.dataset.t = k; b.onclick = ()=>board.arm(k); grid.append(b); });
  pal.append(grid); });
// Subsystems: one button per definition in the board's library, rebuilt when the library changes. × removes one.
const subHd = document.createElement('div'), subGrid = document.createElement('div'); let subsShown = null;
subHd.className = 'hint pal-cat'; subHd.textContent = 'Subsystems'; subGrid.className = 'pal'; pal.append(subHd, subGrid);
// Rebuild the Subsystems list if the library changed.
function syncSubs(){
  if(ckt.subs === subsShown) return; subsShown = ckt.subs;
  subGrid.replaceChildren(); subHd.hidden = !ckt.subs.size;
  for(const name of ckt.subs.keys()){ const t = SUB_PREFIX + name, row = document.createElement('div'), b = document.createElement('button'), x = document.createElement('button');
    row.className = 'sub'; b.textContent = name; b.title = name+' — '+DEFS[t].ins.length+' in, '+DEFS[t].outs.length+' out'; b.dataset.t = t; b.onclick = () => board.arm(t);
    x.className = 'x'; x.textContent = '×'; x.title = 'Remove '+name+' from the list'; x.setAttribute('aria-label', x.title);
    x.onclick = () => { const why = ckt.deleteSub(name); if(why) alert(why); };
    row.append(b, x); subGrid.append(row); }
  board.onArm(board.armed && DEFS[board.armed] ? board.armed : null);
}
ckt.onChange(syncSubs);
// Highlight the armed part's button and show the "Placing" chip.
board.onArm = t => { pal.querySelectorAll('button').forEach(b => b.classList.toggle('arm', !!t && b.dataset.t===t)); $('#armchip').hidden = !t; if(t) $('#armchip b').textContent = DEFS[t].name; };
// ── END PALETTE ───────────────────────────────────────────────

// ── READOUTS ──────────────────────────────────────────────────
// Readouts on every change.
ckt.onChange(()=>{ $('#r-n').textContent = ckt.comps.length; $('#r-w').textContent = ckt.wires.length; $('#unst').hidden = !ckt.unstable;
  const op = ckt.openInputs(); $('#r-open').textContent = op; $('#r-open').classList.toggle('warn', !!op);
  const c = ckt.comps.find(x=>x.type==='CLK'); $('#r-ck').textContent = c ? (c.out[0]?'1':'0') : '—'; });
// Saving: debounced to one write per PERSIST_MS, and flushed when the page is hidden or closed (CQ-DL-014).
let saveT = 0;
// Write the board now.
function persistNow(){ if(saveT){ clearTimeout(saveT); saveT = 0; } store('circuit', ckt.toJSON()); }
// Write the board soon.
function persistSoon(){ if(!saveT) saveT = setTimeout(persistNow, PERSIST_MS); }
ckt.onChange(persistSoon);
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if(document.hidden) persistNow(); });
// ── END READOUTS ──────────────────────────────────────────────

// ── CLOCK ─────────────────────────────────────────────────────
let running = false, frame = 0, acc = 0, last = 0, hz = load('hz', HZ_DEFAULT, validHz);
const hzIn = $('#hz'); hzIn.min = HZ_MIN; hzIn.max = HZ_MAX; hzIn.step = HZ_STEP; hzIn.value = hz; $('#hzv').textContent = hz+' Hz';
hzIn.oninput = e => { const v = +e.target.value; if(!validHz(v)) return; hz = v; $('#hzv').textContent = hz+' Hz'; store('hz', hz); };
// One animation frame of the Run loop: at most one clock toggle per frame. Time the page spent hidden or stalled
// is dropped rather than replayed, so the clock resumes at the set rate (CQ-DL-007).
function loop(t){
  frame = 0; if(!running) return;
  const half = MS_PER_HZ_HALF/hz; acc += Math.max(0, t-last); last = t;
  if(acc >= half){ acc -= half; if(acc >= half) acc = 0; if(!ckt.tickClocks()){ setRun(false); return; } }
  frame = requestAnimationFrame(loop);
}
// Start or stop the clock. Exactly one frame chain runs, however often this is called (CQ-DL-006).
function setRun(on){ running = on; $('#run').textContent = on?'Stop':'Run'; $('#run').classList.toggle('on', on); store('run', on);
  if(frame){ cancelAnimationFrame(frame); frame = 0; }
  if(on){ last = performance.now(); acc = 0; frame = requestAnimationFrame(loop); } }
$('#run').onclick = ()=>setRun(!running);
$('#step').onclick = ()=>{ setRun(false); ckt.tickClocks(); };
const saved = load('circuit', null), restored = saved ? ckt.load(saved) : null;
if(restored && restored.ok){ relabelNotice('Restored your board', restored); if(load('run', false, isBool) && ckt.comps.some(c=>c.type==='CLK')) setRun(true); }
else loadDemo('Binary counter');
// ── END CLOCK ─────────────────────────────────────────────────

// ── BOARD ACTIONS ─────────────────────────────────────────────
Object.entries(LED_COLORS).forEach(([k,v]) => { const b = document.createElement('button'); b.title = k; b.setAttribute('aria-label', k+' LED'); b.className = 'swatch'; b.style.background = v; b.dataset.k = k;
  b.onclick = ()=>{ if(board.sel && board.sel.type==='LED') ckt.setColor(board.sel, k); }; $('#ledcol').append(b); });
// Show the selected LED's colour.
function syncLed(){ const l = board.sel && board.sel.type==='LED' ? board.sel : null; $('#ledsel').textContent = l ? l.label+' · '+l.color : 'select an LED';
  $('#ledcol').querySelectorAll('button').forEach(b => b.classList.toggle('cur', !!l && b.dataset.k===l.color)); }
board.onSelect = syncLed; ckt.onChange(syncLed);
Object.keys(DEMOS).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = ()=>{ if(!ckt.comps.length || confirm('Replace the board with "'+n+'"?')) loadDemo(n); }; $('#demos').append(b); });
$('#rot').onclick = ()=>{ if(board.sel && board.sel.type) ckt.rotate(board.sel, 1); };
$('#rst').onclick = ()=>{ ckt.resetState(); timing.clear(); };
$('#clr').onclick = ()=>{ if(confirm('Clear the board? (Undo brings it back.)')){ setRun(false); ckt.clear(); timing.clear(); board.select(null); } };
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#del').onclick = ()=>board.deleteSelection();
$('#ren').onclick = ()=>{ if(board.sel && board.sel.type) board.rename(board.sel); };
// Make subsystem: box the circuit, name it, collapse it into one block (one undo step).
board.onArea = on => { $('#areachip').hidden = !on; $('#mksub').classList.toggle('on', on); };
$('#mksub').onclick = ()=>{ if(board.areaCb){ board.pickArea(null); return; }
  board.pickArea(parts => {
    if(!parts.length){ notice('No parts inside the box. Press Make subsystem and drag a box around the circuit.'); return; }
    let name = '', why = null;
    do { const v = prompt((why ? why+'\n\n' : '')+'Name for the subsystem ('+parts.length+' part'+(parts.length>1?'s':'')+', up to 10 characters)', name); if(v === null) return; name = v.trim(); why = ckt.subNameProblem(name); } while(why);
    const r = ckt.makeSubsystem(name, parts); if(r.error){ alert(r.error); return; }
    board.select(r.comp); const d = DEFS[r.comp.type];
    notice('Made subsystem '+name+': inputs '+(d.ins.join(', ') || 'none')+'; outputs '+(d.outs.join(', ') || 'none')+'. Place more copies from Components › Subsystems; Ungroup opens it again.'); }); };
$('#ungrp').onclick = ()=>{ const c = board.sel; if(!c || !c.type || !DEFS[c.type].sub){ notice('Select a subsystem block to ungroup.'); return; } ckt.ungroup(c); board.select(null); };
$('#zin').onclick = ()=>board.zoomBy(ZOOM_STEP); $('#zout').onclick = ()=>board.zoomBy(1/ZOOM_STEP); $('#zfit').onclick = ()=>board.fit();
// Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, on the Sim page only.
window.addEventListener('keydown', e => {
  if(!(e.ctrlKey || e.metaKey) || !$('#board').offsetParent || ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if(k === 'z' && !e.shiftKey){ e.preventDefault(); undo(); } else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); redo(); } });
board.onNotice = notice;
// ── END BOARD ACTIONS ─────────────────────────────────────────

// ── TRUTH TABLE ───────────────────────────────────────────────
let ttLast = null, ttBusy = false;
// Add a note paragraph to the truth-table modal (warn = amber).
function ttNote(t, warn){ const p = document.createElement('p'); p.className = 'note' + (warn ? ' warn' : ''); p.textContent = t; $('#ttbody').append(p); return p; }
// Let the browser render a frame and run other tasks before continuing.
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
// Compute and show the truth table. Long tables are computed and drawn in slices, so no task blocks the page
// for more than the 50 ms Long Tasks limit (CQ-DL-008).
async function showTT(){
  if(ttBusy) return; ttBusy = true; $('#ttb').disabled = true;
  const bd = $('#ttbody'); bd.replaceChildren(); ttLast = null; $('#ttm').classList.add('on');
  const prog = ttNote('Computing…');
  let T;
  try { T = await truthTable(ckt, (done, total) => { prog.textContent = 'Computing… '+done+' of '+total+' rows'; }); }
  finally { ttBusy = false; $('#ttb').disabled = false; }
  bd.replaceChildren(); ttLast = T;
  if(!T.ins.length || !T.outs.length){ ttNote('Place at least one SWITCH (input) and one PROBE or LED (output). The table lists every switch combination and what the probes read.'); return; }
  if(T.tooMany){ ttNote(T.ins.length + ' switches would need ' + (1 << T.ins.length) + ' rows; the table handles up to ' + TT_MAX_IN + ' switches (' + (1 << TT_MAX_IN) + ' rows).', true); return; }
  ttNote('Inputs are the switches, outputs the probes and LEDs, each in label order (first label = most significant bit). Each row is applied to a copy of your board taken when you pressed Truth table; the board itself is not changed.');
  if(T.seq) ttNote('This circuit has memory (a latch or flip-flop). Each row starts from reset with every switch LOW, so the table shows what the circuit does from reset, not every behaviour. Clocks are held LOW: to tabulate a flip-flop, clock it from a switch.', true);
  if(T.rows.some(r => r.unstable)) ttNote('Some rows did not settle (a combinational loop): those outputs are marked ~.', true);
  const tb = document.createElement('table'); tb.className = 'tt';
  const hr = document.createElement('tr'), th = (t, c) => { const e = document.createElement('th'); e.textContent = t; if(c) e.className = c; hr.append(e); };
  th('#'); T.ins.forEach(n => th(n)); T.outs.forEach((n, j) => th(n, j ? '' : 'sep')); tb.append(hr);
  bd.append(tb);
  let part = document.createDocumentFragment();
  for(let k = 0; k < T.rows.length; k++){ const r = T.rows[k], tr = document.createElement('tr'), td = (v, c) => { const e = document.createElement('td'); e.textContent = v; e.className = c; tr.append(e); };
    td(k, 'l'); r.in.forEach(v => td(v, v ? 'h' : 'l'));
    r.out.forEach((v, j) => td(r.unstable ? '~' : v === null ? 'open' : v, (v ? 'h' : v === null ? 'bad' : 'l') + (j ? '' : ' sep'))); part.append(tr);
    if((k+1) % TT_RENDER_ROWS === 0){ tb.append(part); part = document.createDocumentFragment(); await nextFrame(); if(ttLast !== T) return; } }
  tb.append(part);
  // minterm list per output: the canonical sum of products in compact form
  const mt = document.createElement('div'); mt.className = 'mt';
  T.outs.forEach((n, j) => { const ms = T.rows.map((r, k) => r.out[j] === 1 ? k : -1).filter(k => k >= 0);
    const line = document.createElement('div'), b = document.createElement('b'); b.textContent = n;
    line.append(b, ' = ' + (ms.length ? 'Σm(' + ms.join(', ') + ')' : '0') + (T.rows.some(r => r.out[j] === null) ? '   (probe not connected)' : '')); mt.append(line); });
  const vars = document.createElement('div'); vars.className = 'mt-vars'; vars.textContent = 'Minterm index: ' + T.ins.join(' ') + ' read as a binary number, ' + T.ins[0] + ' the most significant bit.'; mt.append(vars);
  bd.append(mt);
}
// One CSV field: quoted, quotes doubled, and a leading = + - @ tab or CR neutralised so a spreadsheet
// does not run it as a formula (SEC-DL-005).
function csvCell(v){ let s = String(v); if(/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
$('#ttb').onclick = showTT;
$('#ttclose').onclick = ()=>$('#ttm').classList.remove('on');
$('#ttm').onclick = e => { if(e.target.id === 'ttm') $('#ttm').classList.remove('on'); };
window.addEventListener('keydown', e => { if(e.key === 'Escape') $('#ttm').classList.remove('on'); });
$('#ttcopy').onclick = ()=>{ const T = ttLast; if(!T || !T.rows.length) return;
  const line = cells => cells.map(csvCell).join(',');   // one CSV row
  const csv = [line(T.ins.concat(T.outs))].concat(T.rows.map(r => line(r.in.concat(r.out.map(v => v === null ? 'open' : v))))).join('\n');
  const done = () => { $('#ttcopy').textContent = 'Copied';   // confirm on the button, then restore its text
    setTimeout(() => $('#ttcopy').textContent = 'Copy CSV', COPIED_MS); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(csv).then(done, () => prompt('Copy the table:', csv)); else prompt('Copy the table:', csv); };
// ── END TRUTH TABLE ───────────────────────────────────────────

// ── FILES ─────────────────────────────────────────────────────
$('#exp').onclick = ()=>{ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(ckt.toJSON(),null,1)],{type:'application/json'})); a.download = 'circuit.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#imp').onclick = ()=>$('#file').click();
// Import: size cap, JSON parse, full validation, then one undoable load. The board is untouched on any failure.
$('#file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  if(f.size > IMPORT_MAX_BYTES){ alert('Could not load "'+f.name+'": the file is larger than '+IMPORT_MAX_MB+' MB. The board was not changed.'); return; }
  f.text().then(t => { let j; try { j = JSON.parse(t); } catch(err){ alert('Could not read "'+f.name+'": not valid JSON. The board was not changed.'); return; }
    const v = Circuit.validate(j); if(!v.ok){ alert('Could not load "'+f.name+'". The board was not changed.\n\n'+v.errors.join('\n')); return; }
    setRun(false); let res; ckt.batch(() => { res = ckt.load(j); }); timing.clear(); board.select(null);
    relabelNotice('Loaded "'+f.name+'"', res); }); };
// Show or hide the timing diagram.
function setTiming(on){ timing.enabled = on; $('#timing').classList.toggle('on', on); $('#tim').classList.toggle('on', on); store('timing', on); requestAnimationFrame(()=>requestAnimationFrame(()=>{ board.resize(); timing.draw(); })); }
$('#tim').onclick = ()=>setTiming(!timing.enabled);
setTiming(load('timing', false, isBool));
// ── END FILES ─────────────────────────────────────────────────

// ── PAGES ─────────────────────────────────────────────────────
$('#pg-tut').append(pages.tutorial());
$('#pg-exp').append(pages.experiments(ckt, ()=>showPage('sim')));
// Show one page (Sim, Tutorial, Experiments).
function showPage(id){ if(!PAGES.includes(id)) id = PAGES[0];
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id==='pg-'+id)); document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.pg===id)); store('page', id);
  if(id==='sim') requestAnimationFrame(()=>requestAnimationFrame(()=>{ board.resize(); timing.draw(); })); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = ()=>showPage(b.dataset.pg));
showPage(load('page', PAGES[0], v => PAGES.includes(v)));
// ── END PAGES ─────────────────────────────────────────────────

// ── TWEAKS ────────────────────────────────────────────────────
const tw = loadTweaks();
$('#twk').onclick = ()=>$('#tweaks').classList.toggle('on');
Object.keys(BG_THEMES).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = ()=>{ tw.theme = n; applyTweaks(); }; $('#themes').append(b); });
['grid','pins','wire'].forEach(k => { $('#t-'+k).checked = tw[k]; $('#t-'+k).onchange = e => { tw[k] = e.target.checked; applyTweaks(); }; });
// Apply the theme and toggles, refresh the colour cache and redraw.
function applyTweaks(){ Object.entries(BG_THEMES[tw.theme]).forEach(([k,v]) => document.documentElement.style.setProperty(k, v)); refreshTheme();
  $('#themes').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent===tw.theme));
  board.showGrid = tw.grid; board.showPinNames = tw.pins; board.wireColor = tw.wire; board.requestDraw(); timing.draw(); store('tweaks', tw); }
applyTweaks();
ckt.emit();
// ── END TWEAKS ────────────────────────────────────────────────
})();
