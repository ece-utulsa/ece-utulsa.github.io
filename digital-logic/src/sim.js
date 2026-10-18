/* Digital Logic Breadboard — circuit model + ideal simulator.
   Combinational: iterate to fixed point (max SETTLE_MAX passes). Sequential: edge-triggered
   update after settle, repeated until no FF changes (handles ripple counters).
   Edge memory: each sequential part keeps prevClk, the clock level seen at the end of the last
   update. Reset, Clear and Load PRIME prevClk from the settled clock level instead of zeroing it,
   so a clock input that is already HIGH is never mistaken for a rising edge (DL-001/002/004).
   prevClk is persisted in the file (format v2) so a reload restores the exact edge memory.
   Subsystems (format v3): a circuit collapsed into one block. Each instance runs its own inner Circuit: the block's
   fn() drives the inner input ports and settles the inner circuit, and update() runs the inner edge detectors in the
   same edge round as the outer ones, so a subsystem gives the same logic as the flat circuit it replaced.
   Work bound: one update spends at most WORK_MAX part evaluations, counted through every subsystem level, and blocks
   nest at most NEST_MAX levels; an oscillating loop deep inside blocks is flagged UNSTABLE in bounded time instead of
   multiplying its cost by SETTLE_MAX per level (CQ-DL-025, SEC-DL-015). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — settle / edge limits, file format, import caps, truth-table budget
   2. Helpers          — part output reading, state copies, feedback loops, time slicing, Import field checks
   3. Subsystems       — registry, part definitions, expansion and depth, flip-flop clocks, saved inner state
   4. Circuit          — parts, wires, labels, change events, simulation, file format, validation
      4.1 Subsystems   — make, ungroup and delete subsystem blocks
   5. Checker          — checkVectors: experiment vectors on a private copy, in time slices
   6. Truth table      — truthTable: every switch combination, in time slices
   7. Export           — window.DLB namespace
   ============================================================ */
(function(){
const { DEFS, ledLit, LED_COLORS, LABEL_MAX, SIGNAL_TYPES, MANUAL_INPUTS, QUARTER_TURNS, SUB_PREFIX, GRID, bit, own, snap, rowBits, pinPos } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const SETTLE_MAX = 64;       // combinational passes before a loop is declared UNSTABLE
const EDGE_MAX = 32;         // rounds of edge updates per update() (ripple chains)
const FILE_V = 3;            // circuit file format written by toJSON() (v3: subsystems, one-pin LED)
const LED_ONE_PIN_V = 3;     // files older than this have a two-pin LED: their wires into the cathode are dropped
const IMPORT_MAX_PARTS = 500;    // a circuit file may hold at most this many parts ...
const IMPORT_MAX_WIRES = 2000;   // ... and this many wires (SEC-DL-004)
const ERRORS_MAX = 12;       // validation stops collecting after this many problems
const TT_MAX_IN = 8;         // truth table: at most 2^8 = 256 rows
const SLICE_MS = 10;         // checker and truth table: work per task before yielding; one more update (at most
                             // WORK_MAX evaluations) still fits under the W3C Long Tasks limit of 50 ms (CQ-DL-041)
const WIRE_ROUTE_KEYS = ['mx','my','ax','bx'];   // optional wire route offsets kept in the file
const SUBS_MAX = 50;         // subsystem definitions in one file
const PORTS_MAX = 16;        // inputs, and outputs, on one subsystem block
const AUTO_MAX = 2 * PORTS_MAX;   // a subsystem's auto list names ports only
const EXPAND_MAX = 5000;     // parts on a board, or in one subsystem, counted through every subsystem level
const NEST_MAX = 4;          // subsystem levels: a block holds blocks at most this many levels deep (CQ-DL-025)
const WORK_MAX = 100000;     // part evaluations one update may spend, through every subsystem level (CQ-DL-025)
const SAVED_PART_LEN = 3;    // a subsystem's saved inner part is [id, state, prevClk]
const OUT_TYPES = ['PROBE','LED'];   // parts that become a subsystem's outputs (MANUAL_INPUTS become its inputs)
const PORT_GAP_OUT = 40;     // a port made for a wire crossing the subsystem boundary sits this far right of an output pin ...
const PORT_GAP_IN = 3 * PORT_GAP_OUT;   // ... and this far left of an input pin (room for the switch body and its wire)
// Characters refused in text that shows on the board (SEC-DL-016, -019): a subsystem name refuses control and format
// characters (bidi overrides, zero-width) and the line and paragraph separators; a part label refuses bidi controls.
const NAME_BAD = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const LABEL_BAD = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const BIDI_ONLY = new RegExp('^' + LABEL_BAD.source + '$', 'u');
const CODE_DIGITS = 4;       // a code point is named U+ and at least this many hex digits
// ── END CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────────
// What an output part shows: LED lit 1/0; PROBE level, or null when its input is open.
function readOut(ckt, c){
  if(c.type === 'LED') return ledLit(c) ? 1 : 0;
  return ckt.inputDriven(c, 0) ? c.inv[0] : null;
}
// True for 0 or 1.
const isBit = v => v === 0 || v === 1;
// True for a plain object (not null, not an array).
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
// Built-in part definition for a type read from a file, or null (own keys only, so "constructor" is not a part).
const defOf = type => typeof type === 'string' && !type.startsWith(SUB_PREFIX) && own(DEFS, type) ? DEFS[type] : null;
// Problem with an imported state object against the part's init() shape, or null if it is valid.
function stateProblem(d, st){
  if(st === undefined || st === null) return null;
  if(typeof st !== 'object' || Array.isArray(st)) return 'state is not an object';
  const init = d.init ? d.init() : {};
  for(const k of Object.keys(st)){
    if(!own(init, k)) return 'state has an unknown field "'+String(k).slice(0, LABEL_MAX)+'"';
    const want = init[k], v = st[k];
    if(Array.isArray(want)){ if(!Array.isArray(v) || v.length !== want.length || !v.every(isBit)) return 'state.'+k+' must be '+want.length+' bits'; }
    else { const max = (d.stateMax && d.stateMax[k]) || 1; if(!Number.isInteger(v) || v < 0 || v > max) return 'state.'+k+' must be an integer 0..'+max; }
  }
  return null;
}
// Copy of a state over the part's init() state: arrays are copied too, so the copy shares nothing with st. Used for
// imported states (validated first, so no foreign keys get in) and for saved and snapshot states (CQ-DL-026).
function stateFrom(d, st){
  const s = d.init ? d.init() : {};
  if(st) for(const k of Object.keys(s)) if(st[k] !== undefined) s[k] = Array.isArray(st[k]) ? st[k].slice() : st[k];
  return s;
}
// Copy of a wire's endpoints and route offsets.
function wireFrom(w){
  const o = { from:{ c:w.from.c, pin:w.from.pin }, to:{ c:w.to.c, pin:w.to.pin } };
  for(const k of WIRE_ROUTE_KEYS) if(Number.isFinite(w[k])) o[k] = w[k];
  return o;
}
// True if the wires make a loop through the parts: feedback, as in a latch or a ring built from gates (DL-016).
// Iterative depth-first search, so a long chain cannot overflow the stack.
function hasLoop(comps, wires){
  const next = new Map(comps.map(s => [s.id, []]));
  for(const w of wires){ const l = next.get(w.from.c); if(l && next.has(w.to.c)) l.push(w.to.c); }
  const seen = new Map();   // part id -> 1 while on the search path, 2 once every path from it is done
  for(const start of next.keys()){
    if(seen.has(start)) continue;
    const path = [[start, 0]]; seen.set(start, 1);
    while(path.length){
      const top = path[path.length-1], out = next.get(top[0]);
      if(top[1] === out.length){ seen.set(top[0], 2); path.pop(); continue; }
      const t = out[top[1]++], st = seen.get(t);
      if(st === 1) return true;
      if(!st){ seen.set(t, 1); path.push([t, 0]); }
    }
  }
  return false;
}
// True if a circuit can hold state: a flip-flop, counter, register, the SR LATCH, a block with memory inside, or a
// feedback loop built from gates (DL-016).
const hasMemory = (comps, wires) => comps.some(s => { const d = DEFS[s.type]; return !!(d.seq || d.mem) || s.type === 'SR'; }) || hasLoop(comps, wires);
// Time slicer for a long simulation job (checker, truth table): await the returned function after each update. Once
// SLICE_MS of work has run (or at once, given now = true) it calls onYield (progress), then releases the main thread
// before the next update, so no task runs much past one update (CQ-DL-041, SEC-DL-018).
function slicer(onYield){
  let start = performance.now();
  return async now => { if(!now && performance.now() - start < SLICE_MS) return; if(onYield) onYield();
    await new Promise(r => setTimeout(r, 0)); start = performance.now(); };
}
// The first character of text t that pattern re refuses, named for a message ("a bidirectional control character
// (U+202E)"), or null when there is none.
function badChar(t, re){
  const m = re.exec(t); if(!m) return null;
  const c = m[0], code = 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(CODE_DIGITS, '0');
  const kind = /\p{Cc}/u.test(c) ? 'a control character' : c === '\u2028' ? 'a line separator' : c === '\u2029' ? 'a paragraph separator'
    : BIDI_ONLY.test(c) ? 'a bidirectional control character' : 'a formatting character';
  return kind + ' (' + code + ')';
}
// Check a board's (or a subsystem's) parts and wires from a file; report through err with `at` before each place.
// defFor(type) gives a part's pins, or null for an unknown type. legacy: a two-pin-LED file, whose wires into the LED
// cathode (pin 1) are allowed here and dropped by load(). Returns the parts by id.
function checkNet(comps, wires, at, defFor, legacy, err){
  const ids = new Map();
  comps.forEach((s,k) => {
    const where = at+'comps['+k+']';
    if(!isObj(s)){ err(where+': not an object.'); return; }
    const d = defFor(s.type);
    if(!d) err(where+': unknown part type "'+String(s.type).slice(0, LABEL_MAX)+'".');
    if(!Number.isFinite(s.x) || !Number.isFinite(s.y)) err(where+': position is not numeric.');
    if(!Number.isInteger(s.id) || s.id < 1) err(where+': id must be a positive integer.');
    else if(ids.has(s.id)) err(where+': duplicate id '+s.id+'.'); else ids.set(s.id, s);
    if(s.rot !== undefined && !(Number.isInteger(s.rot) && s.rot >= 0 && s.rot < QUARTER_TURNS)) err(where+': rot must be an integer 0..'+(QUARTER_TURNS-1)+'.');
    if(s.label !== undefined && s.label !== null && (typeof s.label !== 'string' || s.label.length > LABEL_MAX)) err(where+': label must be text of at most '+LABEL_MAX+' characters.');
    else if(typeof s.label === 'string' && badChar(s.label, LABEL_BAD)) err(where+': label holds '+badChar(s.label, LABEL_BAD)+'.');
    if(s.color !== undefined && s.color !== null && !(typeof s.color === 'string' && own(LED_COLORS, s.color))) err(where+': unknown LED color.');
    if(s.prevClk !== undefined && !isBit(s.prevClk)) err(where+': prevClk must be 0 or 1.');
    if(d && !d.sub){ const why = stateProblem(d, s.state); if(why) err(where+': '+why+'.'); }
  });
  const fed = new Set();
  wires.forEach((w,k) => {
    const where = at+'wires['+k+']';
    if(!isObj(w) || !isObj(w.from) || !isObj(w.to)){ err(where+': missing from/to.'); return; }
    const f = ids.get(w.from.c), t = ids.get(w.to.c), df = f && defFor(f.type), dt = t && defFor(t.type);
    if(!f) err(where+': from part id '+String(w.from.c).slice(0, LABEL_MAX)+' does not exist.');
    else if(df && !(Number.isInteger(w.from.pin) && w.from.pin >= 0 && w.from.pin < df.outs.length)) err(where+': '+f.type+' has no output pin '+String(w.from.pin).slice(0, LABEL_MAX)+'.');
    if(!t) err(where+': to part id '+String(w.to.c).slice(0, LABEL_MAX)+' does not exist.');
    else if(legacy && t.type === 'LED' && w.to.pin === 1){ /* old LED cathode: dropped on load */ }
    else if(dt && !(Number.isInteger(w.to.pin) && w.to.pin >= 0 && w.to.pin < dt.ins.length)) err(where+': '+t.type+' has no input pin '+String(w.to.pin).slice(0, LABEL_MAX)+'.');
    else if(dt){ const key = w.to.c+':'+w.to.pin; if(fed.has(key)) err(where+': a second wire into '+t.type+' input '+dt.ins[w.to.pin]+' (one driver per input).'); fed.add(key); }
    for(const r of WIRE_ROUTE_KEYS) if(w[r] !== undefined && w[r] !== null && !Number.isFinite(w[r])) err(where+': route offset '+r+' is not numeric.');
  });
  return ids;
}
// ── END HELPERS ───────────────────────────────────────────────

// ── SUBSYSTEMS ────────────────────────────────────────────────
/* A subsystem definition (sd) is a small circuit: comps (id, type, x, y, rot, color, label), wires, and the ids of its
   port parts -- ins (SWITCH / BUTTON / CLOCK, in block pin order), outs (PROBE / LED), and auto: the ports that were
   made for wires crossing the boundary (Ungroup removes them again). Definitions live in a file's "subs" table by
   name; nested subsystems refer to other names in the same table. Every loaded definition is registered here and in
   DEFS under SUB_PREFIX + name, so the rest of the tool treats a subsystem block like any other part. */
const SUBS = new Map();
// Inner circuit for one instance of subsystem `name`, every part in its initial state.
function innerCircuit(name){
  const sd = SUBS.get(name), k = new Circuit();
  k.comps = sd.comps.map(s => newComp(s, DEFS[s.type].init ? DEFS[s.type].init() : {}));
  k.wires = sd.wires.map(wireFrom); k.nextId = Math.max(0, ...k.comps.map(c => c.id)) + 1;
  k.ports = { ins: sd.ins, outs: sd.outs }; k.relink(); return k;
}
// Register a table of definitions (Map name -> sd), each after the subsystems it contains.
function registerSubs(table){
  const done = new Set();
  // Register definition `name` after every subsystem it contains.
  const visit = name => { if(done.has(name)) return; done.add(name); const sd = table.get(name);
    sd.comps.forEach(s => { if(s.type.startsWith(SUB_PREFIX)) visit(s.type.slice(SUB_PREFIX.length)); });
    // A block pin is named after its port part's label.
    const port = id => sd.comps.find(s => s.id === id).label;
    SUBS.set(name, sd);
    DEFS[SUB_PREFIX+name] = { name, cat:'Subsystems', sub:name, ins: sd.ins.map(port), outs: sd.outs.map(port),
      mem: hasMemory(sd.comps, sd.wires),
      init: () => ({ inner: innerCircuit(name) }), fn: (i, st) => st.inner.evalPorts(i) }; };
  for(const name of table.keys()) visit(name);
}
// Size and depth of a board (or a subsystem's parts) through every subsystem level: n parts, counted inside every
// block, and depth, the levels of blocks inside blocks (0 with no block). n is Infinity for a definition that contains
// itself; counting stops once n passes EXPAND_MAX. memo keeps each definition's result by name; stack holds the names
// being expanded.
function expansion(comps, table, memo, stack){
  let n = 0, depth = 0;
  for(const s of comps){
    if(typeof s.type !== 'string' || !s.type.startsWith(SUB_PREFIX)){ n++; continue; }
    const name = s.type.slice(SUB_PREFIX.length);
    if(!table.has(name)){ n++; continue; }
    if(stack.has(name)) return { n: Infinity, depth: Infinity };
    if(!memo.has(name)){ stack.add(name); memo.set(name, expansion(table.get(name).comps, table, memo, stack)); stack.delete(name); }
    const e = memo.get(name); n += e.n; depth = Math.max(depth, e.depth + 1);
    if(n > EXPAND_MAX) break;
  }
  return { n, depth };
}
// Why a board holding `comps` would be too big or nest too deep with library `table`, or null.
function expansionProblem(comps, table){
  const e = expansion(comps, table, new Map(), new Set());
  if(e.n > EXPAND_MAX) return 'The board would hold more than '+EXPAND_MAX+' parts counting every subsystem level.';
  if(e.depth > NEST_MAX) return 'Subsystems nest at most '+NEST_MAX+' levels deep; this would make '+e.depth+'.';
  return null;
}
// Every part type used on a board, through every subsystem level (an experiment's "build it from gates" rule).
function typesUsed(comps, seen){
  seen = seen || new Set(); const types = new Set();
  for(const c of comps){ types.add(c.type); const d = DEFS[c.type];
    if(d && d.sub && !seen.has(d.sub) && SUBS.has(d.sub)){ seen.add(d.sub); typesUsed(SUBS.get(d.sub).comps, seen).forEach(t => types.add(t)); } }
  return types;
}
// Flip-flops on a board counted through every subsystem level, and how many of them are not clocked straight from
// one source: fromClock(end) says whether a wire's source end is that source. Inside a block the source is any input
// port whose block pin is fed straight from it (an experiment's "synchronous counter" rule, CQ-DL-038).
function flipFlops(comps, wires, fromClock){
  let total = 0, unclocked = 0;
  for(const c of comps){ const d = DEFS[c.type];
    if(d.seq){ total++; if(!wires.some(w => w.to.c === c.id && w.to.pin === d.seq.clk && fromClock(w.from))) unclocked++; }
    else if(d.sub && SUBS.has(d.sub)){ const sd = SUBS.get(d.sub);
      const fed = new Set(sd.ins.filter((id, k) => wires.some(w => w.to.c === c.id && w.to.pin === k && fromClock(w.from))));
      const r = flipFlops(sd.comps, sd.wires, from => fed.has(from.c)); total += r.total; unclocked += r.unclocked; } }
  return { total, unclocked };
}
// Problem with a saved subsystem state ({ parts: [[id, state, prevClk], ...] }) against definition `name`, or null.
// byId(name) gives the definition's parts by id.
function subStateProblem(table, byId, name, st){
  if(st === undefined || st === null) return null;
  if(!isObj(st) || !Array.isArray(st.parts) || Object.keys(st).some(k => k !== 'parts')) return 'state must be { parts: [...] }';
  const sd = table.get(name), parts = byId(name); if(st.parts.length > sd.comps.length) return 'state lists more parts than the subsystem has';
  for(const e of st.parts){
    if(!Array.isArray(e) || e.length !== SAVED_PART_LEN || !isBit(e[2])) return 'state.parts entries must be [id, state, prevClk]';
    const s = parts.get(e[0]); if(!s) return 'state names a part the subsystem does not have';
    const why = s.type.startsWith(SUB_PREFIX) ? subStateProblem(table, byId, s.type.slice(SUB_PREFIX.length), e[1]) : stateProblem(DEFS[s.type], e[1]);
    if(why) return why;
  }
  return null;
}
// Saved form of a part's state, a value copy that later changes to the part cannot reach (CQ-DL-026): an undo
// snapshot keeps the state, the edge memory and the clock level of one moment. A subsystem saves every inner
// part's state and edge memory.
function savedState(c){ const d = DEFS[c.type]; return d.sub ? { parts: c.state.inner.comps.map(ic => [ic.id, savedState(ic), ic.prevClk||0]) } : stateFrom(d, c.state); }
// State of a part being loaded from a validated file.
function loadedState(d, st){ if(!d.sub) return stateFrom(d, st); const s = d.init(); if(st) restoreInner(s.inner, st.parts, false); return s; }
// Put saved inner states back (edges = false) or saved inner edge memory (edges = true, after the board is primed).
function restoreInner(k, parts, edges){
  for(const [id, st, pc] of parts){ const ic = k.comp(id); if(!ic) continue; const d = DEFS[ic.type];
    if(d.sub){ if(st) restoreInner(ic.state.inner, st.parts, edges); }
    else if(edges){ if(d.seq) ic.prevClk = pc; }
    else ic.state = stateFrom(d, st); }
}
// A part as the board holds it, from its file form and a state.
function newComp(s, state){
  const d = DEFS[s.type];
  return { id:s.id, type:s.type, x:s.x, y:s.y, rot:s.rot||0, color:s.color || d.color0, label:s.label || '', state,
           out:d.outs.map(()=>0), inv:d.ins.map(()=>0), drv:d.ins.map(()=>0), prevClk:0 };
}
// Problem with a subsystem name, or null. Names show on the block and in the palette.
function subNameProblem(name, table){
  if(typeof name !== 'string' || !name.trim()) return 'A subsystem needs a name.';
  if(name.length > LABEL_MAX) return 'A subsystem name has at most '+LABEL_MAX+' characters.';
  const bad = badChar(name, NAME_BAD); if(bad) return 'A subsystem name cannot hold '+bad+'.';
  if(name !== name.trim()) return 'A subsystem name cannot start or end with a space.';
  if(table && table.has(name)) return 'There is already a subsystem called "'+name+'".';
  return null;
}
// ── END SUBSYSTEMS ────────────────────────────────────────────

// ── CIRCUIT ───────────────────────────────────────────────────
class Circuit {
  // Empty board.
  constructor(){
    this.comps = []; this.wires = []; this.nextId = 1; this.unstable = false;
    this.listeners = []; this.editListeners = [];
    this.rev = 0;            // structural revision: changes on every edit (not on switch flips or clock ticks)
    this.editOpen = false;   // an edit has started (touch) and not yet been announced (emit)
    this.quiet = 0; this.pending = false;   // batch(): emits are held and sent once at the end
    this.links = null;       // connectivity index, rebuilt after any part or wire change
    this.subs = new Map();   // subsystem library: name -> definition (saved with the board)
    this.ports = null;       // inner circuit of a subsystem: { ins, outs } port part ids
    this.work = { left: 0 }; // part evaluations left in this update; a subsystem's inner circuit shares its board's
  }
  // Register a listener for every change (board drawn, readouts, timing, persistence).
  onChange(f){ this.listeners.push(f); }
  // Register a listener called once just before an edit changes the board (undo snapshot).
  onBeforeEdit(f){ this.editListeners.push(f); }
  // Announce a change; held while a batch is open. Closes an open edit by advancing the revision.
  emit(){
    if(this.quiet){ this.pending = true; return; }
    this.pending = false;
    if(this.editOpen){ this.editOpen = false; this.rev++; }
    this.listeners.forEach(f=>f());
  }
  // Run fn with emits held, then announce once (demo build, import, undo).
  batch(fn){ this.quiet++; try { fn(); } finally { this.quiet--; } if(!this.quiet && this.pending) this.emit(); }
  // Mark the start of an edit: listeners see the board as it was, once per edit.
  touch(){ if(this.editOpen) return; this.editOpen = true; this.editListeners.forEach(f=>f()); }
  // An edit made directly on part or wire fields (move, nudge, wire route): announce it.
  edited(){ this.touch(); this.emit(); }
  // Parts and wires changed: drop the connectivity index.
  relink(){ this.links = null; }
  // Connectivity index: part by id, and for each part the wires into it.
  index(){
    if(this.links) return this.links;
    const byId = new Map(this.comps.map(c => [c.id, c])), into = new Map(this.comps.map(c => [c.id, []]));
    for(const w of this.wires){ const src = byId.get(w.from.c), list = into.get(w.to.c); if(src && list) list.push({ pin:w.to.pin, src, sp:w.from.pin }); }
    return (this.links = { byId, into });
  }
  // A free signal label for a new part of this type. Signal labels share one namespace across types (CQ-DL-010).
  autoLabel(type){
    const d = DEFS[type]; if(!d.auto) return '';
    const used = new Set(this.comps.filter(c => SIGNAL_TYPES.includes(c.type)).map(c => c.label));
    if(d.auto === 'CLK'){ if(!used.has('CLK')) return 'CLK'; let k = 2; while(used.has('CLK'+k)) k++; return 'CLK'+k; }
    if(d.auto.length > 1){ for(const ch of d.auto) if(!used.has(ch)) return ch; let k = 1; while(used.has(d.auto[0]+k)) k++; return d.auto[0]+k; }
    let k = 1; while(used.has(d.auto + k)) k++; return d.auto + k;
  }
  // Check a proposed label for part c. Returns an error message, or null if the label is allowed.
  labelProblem(c, t){
    if(typeof t !== 'string') return 'A label must be text.';
    if(t.length > LABEL_MAX) return 'A label has at most '+LABEL_MAX+' characters.';
    const bad = badChar(t, LABEL_BAD); if(bad) return 'A label cannot hold '+bad+'.';
    if(!SIGNAL_TYPES.includes(c.type)) return null;
    if(!t) return 'A '+DEFS[c.type].name+' needs a label: the timing diagram, truth table and checker name signals by label.';
    const clash = this.comps.find(o => o !== c && SIGNAL_TYPES.includes(o.type) && o.label === t);
    return clash ? '"'+t+'" is already the label of a '+DEFS[clash.type].name+'. Signal labels must be unique.' : null;
  }
  // Set a label if it is allowed. Returns null on success, or the reason it was refused.
  setLabel(c, t){
    const why = this.labelProblem(c, t); if(why) return why;
    if(c.label !== t){ this.touch(); c.label = t; this.emit(); }
    return null;
  }
  // Why a part of this type cannot be placed, or null: a subsystem block must keep the board within EXPAND_MAX parts
  // counting every level (SEC-DL-016).
  addProblem(type){ return DEFS[type].sub ? expansionProblem(this.comps.concat([{ type }]), this.subs) : null; }
  // Place a new part and simulate. Returns the part, or null if addProblem refuses it.
  add(type, x, y){
    if(this.addProblem(type)) return null;
    const d = DEFS[type]; this.touch();
    const c = { id: this.nextId++, type, x, y, rot: d.rot0||0, color: d.color0, label: this.autoLabel(type), state: d.init ? d.init() : {}, out: d.outs.map(()=>0), inv: d.ins.map(()=>0), drv: d.ins.map(()=>0), prevClk: 0 };
    this.comps.push(c); this.relink(); this.update(); return c;
  }
  // Change an LED's colour.
  setColor(c, col){ if(!LED_COLORS[col]) return; this.touch(); c.color = col; this.emit(); }
  // Rotate a part a quarter turn (dir 1 clockwise, -1 counter-clockwise).
  rotate(c, dir){ this.touch(); c.rot = ((c.rot||0) + (dir||1) + QUARTER_TURNS) % QUARTER_TURNS; this.emit(); }
  // Remove a part and every wire on it.
  remove(c){
    this.touch();
    this.wires = this.wires.filter(w => w.from.c !== c.id && w.to.c !== c.id);
    this.comps = this.comps.filter(x => x !== c); this.relink(); this.update();
  }
  // Remove one wire.
  removeWire(w){ this.touch(); this.wires = this.wires.filter(x => x !== w); this.relink(); this.update(); }
  // Remove a part or a wire, whichever x is.
  removeItem(x){ if(x.type) this.remove(x); else this.removeWire(x); }
  // Part by id.
  comp(id){ return this.index().byId.get(id); }
  // Wire: from {c, pin} output -> to {c, pin} input. One driver per input: returns the wire it replaced, or null.
  connect(from, to){
    this.touch();
    const old = this.wires.find(w => w.to.c === to.c && w.to.pin === to.pin) || null;
    if(old) this.wires = this.wires.filter(w => w !== old);
    this.wires.push({ from, to }); this.relink(); this.update(); return old;
  }
  // True if an input pin has a wire.
  inputDriven(c, pin){ const l = this.index().into.get(c.id); return !!l && l.some(x => x.pin === pin); }
  // Undriven input pins across the board (floating-input convention R-1: read 0, shown visibly).
  openInputs(){ let n = 0; for(const c of this.comps) for(let k=0;k<DEFS[c.type].ins.length;k++) if(!this.inputDriven(c,k)) n++; return n; }
  // Remove every part and wire. The subsystem library is kept.
  clear(){ this.touch(); this.comps = []; this.wires = []; this.unstable = false; this.relink(); this.update(); }

  // One combinational pass; returns true if any output changed. Stops early, reporting no change, once the update's
  // work budget is spent. A subsystem's inner circuit spends the same budget.
  pass(){
    const into = this.index().into; let changed = false;
    for(const c of this.comps){
      if(--this.work.left < 0) return false;
      const d = DEFS[c.type], inv = d.ins.map(()=>0), drv = d.ins.map(()=>0);
      if(d.sub) c.state.inner.work = this.work;
      for(const l of into.get(c.id)){ inv[l.pin] = l.src.out[l.sp]; drv[l.pin] = 1; }
      c.inv = inv; c.drv = drv;
      const out = d.fn(inv, c.state);
      for(let k=0;k<out.length;k++) if(out[k] !== c.out[k]) changed = true;
      c.out = out;
    }
    return changed;
  }
  // Iterate passes to a fixed point; flag a loop that does not settle (here or inside a subsystem), or that used up
  // the update's work budget.
  settle(){
    let n = 0; while(this.pass() && n < SETTLE_MAX) n++;
    this.unstable = n >= SETTLE_MAX || this.work.left < 0 || this.comps.some(c => DEFS[c.type].sub && c.state.inner.unstable);
  }
  // Start an update on a board: a fresh work budget for it and every subsystem inside.
  begin(){ this.work.left = WORK_MAX; }
  // Arm every edge detector at the present (settled) clock level, so no edge fires. Subsystems arm theirs too.
  primeEdges(){ for(const c of this.comps){ const d = DEFS[c.type]; if(d.seq) c.prevClk = c.inv[d.seq.clk]; else if(d.sub) c.state.inner.primeEdges(); } }
  // One round of rising-edge updates on the settled board, inside subsystems too. Returns true if any edge fired.
  edgeRound(){
    let any = false;
    for(const c of this.comps){
      const d = DEFS[c.type];
      if(d.sub){ if(c.state.inner.edgeRound()) any = true; continue; }
      if(!d.seq) continue;
      const clk = c.inv[d.seq.clk];
      if(clk && !c.prevClk){ Object.assign(c.state, d.seq.next(c.inv, c.state)); any = true; }
      c.prevClk = clk;
    }
    return any;
  }
  // Inner circuit of a subsystem: drive the input ports, settle, and read the output ports (an open output reads 0).
  evalPorts(i){
    this.ports.ins.forEach((id, k) => { this.comp(id).state.on = bit(i[k]); });
    this.settle();
    return this.ports.outs.map(id => { const p = this.comp(id); return bit(p.drv[0] && p.inv[0]); });
  }
  // Settle combinationally and arm the edge detectors — no edge fires.
  prime(){ this.begin(); this.settle(); this.primeEdges(); this.emit(); }
  // Full update: settle, then apply rising-edge updates until quiescent.
  update(){
    this.begin(); this.settle();
    for(let e=0; e<EDGE_MAX && this.edgeRound(); e++) this.settle();
    this.emit();
  }
  // Toggle every CLOCK part once (half a period). Returns false when there is no clock.
  tickClocks(){
    const clks = this.comps.filter(c => c.type === 'CLK'); if(!clks.length) return false;
    clks.forEach(c => c.state.on = c.state.on ? 0 : 1); this.update(); return true;
  }
  // Reset: every stateful part (except switches/buttons/clock level) to its init state. Not itself an edge.
  resetState(){
    for(const c of this.comps){ const d = DEFS[c.type]; if(d.init && !MANUAL_INPUTS.includes(c.type)) c.state = d.init(); }
    this.prime();
  }
  // Signals shown in the timing diagram: clocks, switches, buttons, probes, LEDs. val is null for an open probe.
  signals(){
    return this.comps.filter(c => SIGNAL_TYPES.includes(c.type)).map(c => ({
      id: c.id, name: c.label, kind: c.type, val: c.type==='LED' || c.type==='PROBE' ? readOut(this, c) : c.out[0] }));
  }
  // The board as a circuit file (format FILE_V), with its subsystem library.
  toJSON(){
    return { v: FILE_V, comps: this.comps.map(c => ({ id:c.id, type:c.type, x:c.x, y:c.y, rot:c.rot||0, color:c.color, label:c.label, state:savedState(c), prevClk:c.prevClk||0 })),
             wires: this.wires.map(wireFrom), subs: Object.fromEntries(this.subs) };
  }
  // Validate a whole file before touching the board. Returns { ok, errors[] } — errors name every problem found
  // (DL-005, CQ-DL-020, SEC-DL-004), up to ERRORS_MAX. Subsystem definitions get the same checks as the board, and
  // nesting is bounded: no definition may contain itself, every definition and the board counted through every level
  // stay within EXPAND_MAX parts, and blocks nest at most NEST_MAX levels (SEC-DL-015, -016). Port lists are checked
  // for length before any net check, and each subsystem's pins are worked out once (SEC-DL-017).
  static validate(j){
    const errors = [], err = t => { if(errors.length < ERRORS_MAX) errors.push(t); };
    if(!isObj(j)) return { ok:false, errors:['Not a circuit file (expected a JSON object).'] };
    if(j.v !== undefined && !(Number.isInteger(j.v) && j.v >= 1)) err('Format version "v" must be a positive integer.');
    else if(j.v > FILE_V) err('File format v'+j.v+' is newer than this tool reads (v'+FILE_V+'). Open it in a newer version.');
    if(!Array.isArray(j.comps)) err('Missing "comps" list.');
    if(!Array.isArray(j.wires)) err('Missing "wires" list.');
    if(j.subs !== undefined && j.subs !== null && !isObj(j.subs)) err('"subs" must be an object of subsystem definitions.');
    if(errors.length) return { ok:false, errors };
    if(j.comps.length > IMPORT_MAX_PARTS) return { ok:false, errors:['Too many parts: '+j.comps.length+' (at most '+IMPORT_MAX_PARTS+').'] };
    if(j.wires.length > IMPORT_MAX_WIRES) return { ok:false, errors:['Too many wires: '+j.wires.length+' (at most '+IMPORT_MAX_WIRES+').'] };
    const names = j.subs ? Object.keys(j.subs) : [], table = new Map();
    if(names.length > SUBS_MAX) return { ok:false, errors:['Too many subsystems: '+names.length+' (at most '+SUBS_MAX+').'] };
    for(const n of names){
      const sd = j.subs[n], where = 'subs["'+String(n).slice(0, LABEL_MAX)+'"]', why = subNameProblem(n);
      if(why) err(where+': '+why);
      else if(!isObj(sd) || ![sd.comps, sd.wires, sd.ins, sd.outs].every(Array.isArray) || (sd.auto !== undefined && !Array.isArray(sd.auto))) err(where+': needs comps, wires, ins and outs lists.');
      else if(sd.comps.length > IMPORT_MAX_PARTS || sd.wires.length > IMPORT_MAX_WIRES) err(where+': too many parts or wires.');
      else if(sd.ins.length > PORTS_MAX) err(where+'.ins: at most '+PORTS_MAX+' ports.');
      else if(sd.outs.length > PORTS_MAX) err(where+'.outs: at most '+PORTS_MAX+' ports.');
      else if(sd.auto && sd.auto.length > AUTO_MAX) err(where+'.auto: at most '+AUTO_MAX+' ports.');
      else table.set(n, sd);
    }
    if(errors.length) return { ok:false, errors };
    // Each definition's parts by id (first of a duplicated id; checkNet reports the duplicate), and its pins.
    const byIds = new Map(), pins = new Map();
    for(const [n, sd] of table){ const m = new Map(); sd.comps.forEach(s => { if(isObj(s) && !m.has(s.id)) m.set(s.id, s); }); byIds.set(n, m);
      // A pin is named after its port part's label (or its id when that is not a label).
      const pin = id => { const s = m.get(id); return s && typeof s.label === 'string' ? s.label : String(id); };
      pins.set(n, { sub: n, ins: sd.ins.map(pin), outs: sd.outs.map(pin) }); }
    // A part type: built in, or a subsystem in this file's table (its port lists give its pins).
    const defFor = type => defOf(type) || (typeof type === 'string' && type.startsWith(SUB_PREFIX) && pins.get(type.slice(SUB_PREFIX.length))) || null;
    for(const [n, sd] of table){
      const where = 'subs["'+n+'"]', ids = checkNet(sd.comps, sd.wires, where+'.', defFor, false, err);
      // Port list: distinct ids of parts of the given types.
      const ports = (list, types, key) => {
        if(new Set(list).size !== list.length || !list.every(id => ids.has(id) && types.includes(ids.get(id).type))) err(where+'.'+key+' must list distinct '+types.join(' / ')+' part ids.'); };
      ports(sd.ins, MANUAL_INPUTS, 'ins'); ports(sd.outs, OUT_TYPES, 'outs');
      if(!sd.ins.length && !sd.outs.length) err(where+': needs at least one input or output.');
      if(sd.auto && !sd.auto.every(id => sd.ins.includes(id) || sd.outs.includes(id))) err(where+'.auto must list port ids.');
      const labels = [...ids.values()].filter(s => SIGNAL_TYPES.includes(s.type)).map(s => s.label);
      if(labels.some(l => !l) || new Set(labels).size !== labels.length) err(where+': signal labels must be unique and not blank.');
    }
    const legacy = (j.v||1) < LED_ONE_PIN_V;
    checkNet(j.comps, j.wires, '', defFor, legacy, err);
    if(errors.length) return { ok:false, errors };
    // Every definition, placed or only in the library, is bounded like the board (SEC-DL-016).
    const memo = new Map();
    for(const n of table.keys()){ const e = expansion([{ type:SUB_PREFIX+n }], table, memo, new Set()), where = 'subs["'+n+'"]: ';
      if(e.n === Infinity) err(where+'a subsystem cannot contain itself.');
      else if(e.n > EXPAND_MAX) err(where+'more than '+EXPAND_MAX+' parts counting every subsystem level.');
      else if(e.depth > NEST_MAX) err(where+'subsystems nest '+e.depth+' levels deep (at most '+NEST_MAX+').'); }
    if(errors.length) return { ok:false, errors };
    if(expansion(j.comps, table, memo, new Set()).n > EXPAND_MAX) err('Too many parts counting every subsystem level (more than '+EXPAND_MAX+').');
    // A definition's parts by id, for the saved-state check.
    const byId = name => byIds.get(name);
    j.comps.forEach((s,k) => { const d = defFor(s.type); if(d.sub){ const why = subStateProblem(table, byId, d.sub, s.state); if(why) err('comps['+k+']: '+why+'.'); } });
    return { ok: !errors.length, errors };
  }
  // Load a validated file. Board is untouched if validation fails. Edge memory restored exactly (v2+) or primed (v1).
  // Blank or duplicate signal labels (allowed by v1.0.0) get fresh labels, listed in the result's relabelled[].
  // Files older than v3 had a two-pin LED: wires into its cathode are dropped and counted in the result's ledWires.
  load(j){
    const v = Circuit.validate(j); if(!v.ok) return Object.assign(v, { relabelled: [], ledWires: 0 });
    this.touch();
    const table = new Map(Object.keys(j.subs || {}).map(n => { const sd = j.subs[n];
      return [n, { comps: sd.comps.map(s => ({ id:s.id, type:s.type, x:s.x, y:s.y, rot:s.rot||0, color:s.color, label:s.label || '' })),
                   wires: sd.wires.map(wireFrom), ins: sd.ins.slice(), outs: sd.outs.slice(), auto: (sd.auto || []).slice() }]; }));
    registerSubs(table); this.subs = table;
    this.comps = j.comps.map(s => newComp(s, loadedState(DEFS[s.type], s.state)));
    const typeOf = new Map(j.comps.map(s => [s.id, s.type])), cathode = w => (j.v||1) < LED_ONE_PIN_V && typeOf.get(w.to.c) === 'LED' && w.to.pin === 1;
    this.wires = j.wires.filter(w => !cathode(w)).map(wireFrom);
    this.nextId = Math.max(0, ...this.comps.map(c=>c.id)) + 1;
    this.relink();
    const relabelled = [], seen = new Set();
    for(const c of this.comps){ if(!SIGNAL_TYPES.includes(c.type)) continue;
      if(c.label && !seen.has(c.label)){ seen.add(c.label); continue; }
      const old = c.label; c.label = this.autoLabel(c.type); seen.add(c.label);
      relabelled.push(DEFS[c.type].name+' '+(old ? '"'+old+'" (duplicate)' : '(no label)')+' → "'+c.label+'"'); }
    this.begin(); this.settle(); this.primeEdges();
    if((j.v||1) >= 2) for(const s of j.comps){ const c = this.comp(s.id), d = DEFS[c.type];
      if(d.seq && s.prevClk !== undefined) c.prevClk = s.prevClk; else if(d.sub && s.state) restoreInner(c.state.inner, s.state.parts, true); }
    this.emit();
    return Object.assign(v, { relabelled, ledWires: j.wires.length - this.wires.length });
  }

  // ── 4.1 SUBSYSTEMS ────────────────────────────────────────────
  // Problem with a name for a new subsystem, or null.
  subNameProblem(name){ return subNameProblem(name, this.subs); }
  // Collapse parts into a new subsystem block called `name`, in one edit. Switches, buttons and clocks among the parts
  // become the block's inputs and probes and LEDs its outputs, ordered top to bottom; every wire crossing the boundary
  // gets a port of its own (one input per outside driver, one output per inside source) and is reconnected to the
  // block. The parts keep their state. Returns { comp } or { error }.
  makeSubsystem(name, parts){
    const bad = subNameProblem(name, this.subs); if(bad) return { error: bad };
    if(!parts.length) return { error: 'No parts selected: drag a box around the circuit to collapse.' };
    const ids = new Set(parts.map(c => c.id));
    const sd = { comps: parts.map(c => ({ id:c.id, type:c.type, x:c.x, y:c.y, rot:c.rot||0, color:c.color, label:c.label })),
                 wires: this.wires.filter(w => ids.has(w.from.c) && ids.has(w.to.c)).map(wireFrom), ins: [], outs: [], auto: [] };
    const used = new Set(sd.comps.filter(s => SIGNAL_TYPES.includes(s.type)).map(s => s.label));
    // A port label: `want` if it is free, else pre1, pre2, ...
    const label = (want, pre) => { let t = String(want||'').slice(0, LABEL_MAX); if(!t || used.has(t)){ let n = 1; while(used.has(pre+n)) n++; t = pre+n; } used.add(t); return t; };
    // Wires crossing the boundary, grouped by driver: outside driver -> inside inputs, inside source -> outside inputs.
    const crossIn = new Map(), crossOut = new Map();
    for(const w of this.wires){ const fi = ids.has(w.from.c); if(fi === ids.has(w.to.c)) continue;
      const m = fi ? crossOut : crossIn, key = w.from.c+':'+w.from.pin;
      if(!m.has(key)) m.set(key, { from: { c:w.from.c, pin:w.from.pin }, to: [] }); m.get(key).to.push({ c:w.to.c, pin:w.to.pin }); }
    let nextId = this.nextId;   // port part ids: clear of every id on the board
    const ext = new Map();      // port id -> its outside wiring: { from } for an input, { to: [...] } for an output
    for(const g of crossIn.values()){ const src = this.comp(g.from.c), t0 = g.to[0], dst = this.comp(t0.c), p = pinPos(dst, 'in', t0.pin), id = nextId++;
      sd.comps.push({ id, type:'SW', x: snap(p.x - PORT_GAP_IN), y: snap(p.y - GRID), rot:0, label: label(SIGNAL_TYPES.includes(src.type) ? src.label : DEFS[dst.type].ins[t0.pin], 'IN') });
      g.to.forEach(t => sd.wires.push({ from:{ c:id, pin:0 }, to:t })); sd.auto.push(id); ext.set(id, { from: g.from }); }
    // An output is named after the probe or LED it feeds outside, else its source's label or pin name.
    for(const g of crossOut.values()){ const src = this.comp(g.from.c), p = pinPos(src, 'out', g.from.pin), id = nextId++;
      const shown = g.to.map(t => this.comp(t.c)).find(c => OUT_TYPES.includes(c.type));
      sd.comps.push({ id, type:'PROBE', x: snap(p.x + PORT_GAP_OUT), y: snap(p.y - GRID), rot:0,
        label: label(shown ? shown.label : SIGNAL_TYPES.includes(src.type) ? src.label : DEFS[src.type].outs[g.from.pin], 'OUT') });
      sd.wires.push({ from: g.from, to:{ c:id, pin:0 } }); sd.auto.push(id); ext.set(id, { to: g.to }); }
    // Port order: top to bottom, then left to right.
    const byPlace = (a, b) => a.y - b.y || a.x - b.x;
    sd.ins = sd.comps.filter(s => MANUAL_INPUTS.includes(s.type)).sort(byPlace).map(s => s.id);
    sd.outs = sd.comps.filter(s => OUT_TYPES.includes(s.type)).sort(byPlace).map(s => s.id);
    if(!sd.ins.length && !sd.outs.length) return { error: 'These parts have no inputs or outputs. Include a SWITCH or a PROBE, or parts wired to the rest of the board.' };
    if(sd.ins.length > PORTS_MAX || sd.outs.length > PORTS_MAX) return { error: 'A subsystem has at most '+PORTS_MAX+' inputs and '+PORTS_MAX+' outputs; this one would have '+sd.ins.length+' and '+sd.outs.length+'.' };
    const table = new Map(this.subs).set(name, sd), type = SUB_PREFIX + name;
    const big = expansionProblem(this.comps.filter(c => !ids.has(c.id)).concat([{ type }]), table); if(big) return { error: big };
    this.touch(); registerSubs(table); this.subs = table;
    const blk = newComp({ id: nextId++, type, x: snap(Math.min(...parts.map(c => c.x))), y: snap(Math.min(...parts.map(c => c.y))) }, DEFS[type].init());
    this.nextId = nextId;
    const was = new Map(parts.map(c => [c.id, c]));
    for(const ic of blk.state.inner.comps){ const o = was.get(ic.id); if(o){ ic.state = o.state; ic.prevClk = o.prevClk; } }
    this.wires = this.wires.filter(w => !ids.has(w.from.c) && !ids.has(w.to.c));
    this.comps = this.comps.filter(c => !ids.has(c.id)).concat([blk]);
    sd.ins.forEach((id, k) => { const e = ext.get(id); if(e) this.wires.push({ from: e.from, to:{ c:blk.id, pin:k } }); });
    sd.outs.forEach((id, k) => { const e = ext.get(id); if(e) e.to.forEach(t => this.wires.push({ from:{ c:blk.id, pin:k }, to:t })); });
    this.relink(); this.update(); return { comp: blk };
  }
  // Put a subsystem block's circuit back on the board in one edit, where the block was. Its parts keep their state;
  // ports made for boundary wires are removed again, and the block's wires reconnect to the parts inside (a SWITCH
  // port driven from outside is removed too, since a switch has no input). Returns the parts placed.
  ungroup(blk){
    const d = DEFS[blk.type]; if(!d || !d.sub) return [];
    const k = blk.state.inner, sd = SUBS.get(d.sub), auto = new Set(sd.auto);
    const extIn = sd.ins.map((_, p) => this.wires.find(w => w.to.c === blk.id && w.to.pin === p));
    const extOut = sd.outs.map((_, p) => this.wires.filter(w => w.from.c === blk.id && w.from.pin === p));
    const drop = new Set(sd.ins.filter((id, p) => extIn[p] || auto.has(id)).concat(sd.outs.filter(id => auto.has(id))));
    const keep = k.comps.filter(c => !drop.has(c.id)), idMap = new Map();
    if(!keep.length) return [];
    this.touch();
    const dx = blk.x - Math.min(...keep.map(c => c.x)), dy = blk.y - Math.min(...keep.map(c => c.y));
    keep.forEach(c => { idMap.set(c.id, this.nextId); Object.assign(c, { id: this.nextId++, x: c.x+dx, y: c.y+dy }); });
    const at = e => ({ c: idMap.get(e.c), pin: e.pin });   // an inner wire end, in board ids
    const wires = k.wires.filter(w => !drop.has(w.from.c) && !drop.has(w.to.c)).map(w => { const o = wireFrom(w);
      for(const r of ['mx','ax','bx']) if(r in o) o[r] += dx; if('my' in o) o.my += dy; o.from = at(w.from); o.to = at(w.to); return o; });
    sd.ins.forEach((id, p) => { const e = extIn[p]; if(e) k.wires.filter(w => w.from.c === id && !drop.has(w.to.c)).forEach(w => wires.push({ from:{ c:e.from.c, pin:e.from.pin }, to: at(w.to) })); });
    sd.outs.forEach((id, p) => { const src = k.wires.find(w => w.to.c === id); if(src && !drop.has(src.from.c)) extOut[p].forEach(w => wires.push({ from: at(src.from), to:{ c:w.to.c, pin:w.to.pin } })); });
    this.comps = this.comps.filter(c => c !== blk).concat(keep);
    this.wires = this.wires.filter(w => w.from.c !== blk.id && w.to.c !== blk.id).concat(wires);
    this.relink();
    for(const c of keep) if(SIGNAL_TYPES.includes(c.type) && this.labelProblem(c, c.label)) c.label = this.autoLabel(c.type);
    this.update(); return keep;
  }
  // Remove subsystem `name` from the library. Returns null, or why it was refused (still in use).
  deleteSub(name){
    const type = SUB_PREFIX + name;
    if(this.comps.some(c => c.type === type)) return 'Delete the '+name+' blocks on the board first.';
    const user = [...this.subs].find(([, sd]) => sd.comps.some(s => s.type === type));
    if(user) return 'Subsystem "'+user[0]+'" contains '+name+'.';
    this.touch(); this.subs = new Map(this.subs); this.subs.delete(name); this.emit(); return null;
  }
  // ── END 4.1 SUBSYSTEMS ────────────────────────────────────────
}
// ── END CIRCUIT ───────────────────────────────────────────────

// ── CHECKER ───────────────────────────────────────────────────
/* Truth-table checker: vectors applied in order (so sequential tests work).
   Runs on a private copy of the circuit — the student's board is never touched (DL-004).
   Flip-flops start from reset and the named switches start LOW (so a switch left HIGH on the board
   is not an edge, DL-003); other switches keep their positions.
   inputs by SWITCH label, outputs by PROBE/LED label. Resolves to {ok, rows, missing, duplicates}:
   a name used by two parts is reported, never resolved silently (DL-011, CQ-DL-010).
   Async: the board is copied at the call, then the vectors run in time slices (slicer) so the page stays responsive
   on a board that spends the whole work budget on every update (CQ-DL-041, SEC-DL-018). */
async function checkVectors(ckt, vectors){
  const inNames = Object.keys(vectors[0].in), outNames = Object.keys(vectors[0].out);
  const isOut = c => OUT_TYPES.includes(c.type);   // parts the checker reads
  const count = (pred, n) => ckt.comps.filter(c => pred(c) && c.label === n).length;   // parts of a kind carrying label n
  const missing = [], duplicates = [];
  inNames.forEach(n => { const k = count(c => c.type==='SW', n); if(!k) missing.push('SWITCH "'+n+'"'); else if(k > 1) duplicates.push('SWITCH "'+n+'"'); });
  outNames.forEach(n => { const k = count(isOut, n); if(!k) missing.push('PROBE "'+n+'"'); else if(k > 1) duplicates.push('PROBE/LED "'+n+'"'); });
  if(missing.length || duplicates.length) return { ok:false, rows:[], missing, duplicates };
  const copy = ckt.toJSON(), pause = slicer(), sim = new Circuit();
  await pause(true); sim.load(copy); await pause();   // the press's own task ends at the copy
  const bySw = {}, byOut = {};
  for(const c of sim.comps){ if(c.type==='SW') bySw[c.label] = c; if(isOut(c)) byOut[c.label] = c; }
  inNames.forEach(n => { bySw[n].state.on = 0; });   // named inputs start LOW so the first vector's transitions are real
  sim.resetState(); await pause();
  const rows = [];
  for(const v of vectors){
    inNames.forEach(n => bySw[n].state.on = v.in[n]); sim.update();
    const got = {}; let ok = true;
    outNames.forEach(n => { const o = byOut[n]; got[n] = o.type==='LED' ? readOut(sim, o) : o.inv[0]; if(got[n] !== v.out[n]) ok = false; });
    rows.push({ in:v.in, want:v.out, got, ok }); await pause();
  }
  return { ok: rows.every(r=>r.ok), rows, missing, duplicates };
}
// ── END CHECKER ───────────────────────────────────────────────

// ── TRUTH TABLE ───────────────────────────────────────────────
/* Truth table of the board as built. Inputs are the SWITCHes, outputs the PROBEs and LEDs, each ordered by label
   (first label = most significant bit). Every row starts from reset with all switches LOW and then sets the row,
   so a combinational circuit gives its exact table, and a circuit with memory (latches, flip-flops) gives what it
   does from reset -- flagged so the student knows the table is not the whole story. A latch built from gates counts:
   any feedback loop flags the table (DL-016). Clocks are held LOW; drive
   sequential parts from a switch to tabulate them.
   Async: rows are computed in time slices (slicer) and the main thread is released between them, also between a
   row's reset and its update (CQ-DL-008, CQ-DL-041). onProgress(done, total) is called after each slice. The board is copied at the call; it is never changed. */
async function truthTable(ckt, onProgress){
  const byLab = (a,b) => a.label.localeCompare(b.label, undefined, { numeric:true });   // label order, I2 before I10
  const ins = ckt.comps.filter(c => c.type==='SW').sort(byLab), outs = ckt.comps.filter(c => OUT_TYPES.includes(c.type)).sort(byLab);
  const head = { ins: ins.map(c => c.label), outs: outs.map(c => c.label) };
  if(!ins.length || !outs.length) return Object.assign(head, { rows: [], seq: false, tooMany: false });
  if(ins.length > TT_MAX_IN) return Object.assign(head, { rows: [], seq: false, tooMany: true });
  const seq = hasMemory(ckt.comps, ckt.wires);
  const copy = ckt.toJSON(), sim = new Circuit(), n = ins.length, total = 1 << n, rows = [];
  const pause = slicer(() => { if(onProgress) onProgress(rows.length, total); });
  await pause(true); sim.load(copy); await pause();   // the press's own task ends at the copy
  const sw = ins.map(c => sim.comp(c.id)), pr = outs.map(c => sim.comp(c.id));
  const manual = sim.comps.filter(c => MANUAL_INPUTS.includes(c.type));
  for(let k=0; k<total; k++){
    manual.forEach(c => { c.state.on = 0; });
    sim.resetState(); await pause();
    const bits = rowBits(k, n);
    sw.forEach((c,j) => { c.state.on = bits[j]; }); sim.update();
    rows.push({ in: bits, out: pr.map(o => readOut(sim, o)), unstable: sim.unstable });
    if(k < total-1) await pause();
  }
  if(onProgress) onProgress(total, total);
  return Object.assign(head, { rows, seq, tooMany: false });
}
// ── END TRUTH TABLE ───────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
Object.assign(window.DLB, { Circuit, checkVectors, truthTable, typesUsed, flipFlops, TT_MAX_IN, NEST_MAX });
// ── END EXPORT ────────────────────────────────────────────────
})();
