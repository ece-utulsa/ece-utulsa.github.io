/* Digital Logic Breadboard — circuit model + ideal simulator.
   Combinational: iterate to fixed point (max SETTLE_MAX passes). Sequential: edge-triggered
   update after settle, repeated until no FF changes (handles ripple counters).
   Edge memory: each sequential part keeps prevClk, the clock level seen at the end of the last
   update. Reset, Clear and Load PRIME prevClk from the settled clock level instead of zeroing it,
   so a clock input that is already HIGH is never mistaken for a rising edge (DL-001/002/004).
   prevClk is persisted in the file (format v2) so a reload restores the exact edge memory. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — settle / edge limits, file format, import caps, truth-table budget
   2. Helpers          — part output reading, Import field checks
   3. Circuit          — parts, wires, labels, change events, simulation, file format, validation
   4. Checker          — checkVectors: experiment vectors on a private copy
   5. Truth table      — truthTable: every switch combination, in time slices
   6. Export           — window.DLB namespace
   ============================================================ */
(function(){
const { DEFS, ledLit, LED_COLORS, LABEL_MAX, SIGNAL_TYPES, MANUAL_INPUTS, QUARTER_TURNS } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const SETTLE_MAX = 64;       // combinational passes before a loop is declared UNSTABLE
const EDGE_MAX = 32;         // rounds of edge updates per update() (ripple chains)
const FILE_V = 2;            // circuit file format written by toJSON()
const IMPORT_MAX_PARTS = 500;    // a circuit file may hold at most this many parts ...
const IMPORT_MAX_WIRES = 2000;   // ... and this many wires (SEC-DL-004)
const ERRORS_MAX = 12;       // validation stops collecting after this many problems
const TT_MAX_IN = 8;         // truth table: at most 2^8 = 256 rows
const TT_SLICE_MS = 25;      // truth table: work per task before yielding (W3C Long Tasks limit is 50 ms)
const WIRE_ROUTE_KEYS = ['mx','my','ax','bx'];   // optional wire route offsets kept in the file
// ── END CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────────
// What an output part shows: LED lit 1/0; PROBE level, or null when its input is open.
function readOut(ckt, c){
  if(c.type === 'LED') return ledLit(c) ? 1 : 0;
  return ckt.inputDriven(c, 0) ? c.inv[0] : null;
}
// True for 0 or 1.
const isBit = v => v === 0 || v === 1;
// Part definition for a type read from a file, or null (own keys only, so "constructor" is not a part).
const defOf = type => typeof type === 'string' && Object.prototype.hasOwnProperty.call(DEFS, type) ? DEFS[type] : null;
// Problem with an imported state object against the part's init() shape, or null if it is valid.
function stateProblem(d, st){
  if(st === undefined || st === null) return null;
  if(typeof st !== 'object' || Array.isArray(st)) return 'state is not an object';
  const init = d.init ? d.init() : {};
  for(const k of Object.keys(st)){
    if(!Object.prototype.hasOwnProperty.call(init, k)) return 'state has an unknown field "'+String(k).slice(0, LABEL_MAX)+'"';
    const want = init[k], v = st[k];
    if(Array.isArray(want)){ if(!Array.isArray(v) || v.length !== want.length || !v.every(isBit)) return 'state.'+k+' must be '+want.length+' bits'; }
    else { const max = (d.stateMax && d.stateMax[k]) || 1; if(!Number.isInteger(v) || v < 0 || v > max) return 'state.'+k+' must be an integer 0..'+max; }
  }
  return null;
}
// Copy of an imported state over the part's init() state (validated first, so no foreign keys get in).
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
// ── END HELPERS ───────────────────────────────────────────────

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
  // Place a new part and simulate.
  add(type, x, y){
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
  // Remove everything.
  clear(){ this.touch(); this.comps = []; this.wires = []; this.unstable = false; this.relink(); this.update(); }

  // One combinational pass; returns true if any output changed.
  pass(){
    const into = this.index().into; let changed = false;
    for(const c of this.comps){
      const d = DEFS[c.type], inv = d.ins.map(()=>0), drv = d.ins.map(()=>0);
      for(const l of into.get(c.id)){ inv[l.pin] = l.src.out[l.sp]; drv[l.pin] = 1; }
      c.inv = inv; c.drv = drv;
      const out = d.fn(inv, c.state);
      for(let k=0;k<out.length;k++) if(out[k] !== c.out[k]) changed = true;
      c.out = out;
    }
    return changed;
  }
  // Iterate passes to a fixed point; flag a loop that does not settle.
  settle(){
    let n = 0; while(this.pass() && n < SETTLE_MAX) n++;
    this.unstable = n >= SETTLE_MAX;
  }
  // Arm every edge detector at the present (settled) clock level, so no edge fires.
  primeEdges(){ for(const c of this.comps){ const d = DEFS[c.type]; if(d.seq) c.prevClk = c.inv[d.seq.clk]; } }
  // Settle combinationally and arm the edge detectors — no edge fires.
  prime(){ this.settle(); this.primeEdges(); this.emit(); }
  // Full update: settle, then apply rising-edge updates until quiescent.
  update(){
    this.settle();
    for(let e=0; e<EDGE_MAX; e++){
      let any = false;
      for(const c of this.comps){
        const d = DEFS[c.type]; if(!d.seq) continue;
        const clk = c.inv[d.seq.clk];
        if(clk && !c.prevClk){ Object.assign(c.state, d.seq.next(c.inv, c.state)); any = true; }
        c.prevClk = clk;
      }
      if(!any) break;
      this.settle();
    }
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
  // The board as a circuit file (format FILE_V).
  toJSON(){
    return { v: FILE_V, comps: this.comps.map(c => ({ id:c.id, type:c.type, x:c.x, y:c.y, rot:c.rot||0, color:c.color, label:c.label, state:c.state, prevClk:c.prevClk||0 })),
             wires: this.wires.map(wireFrom) };
  }
  // Validate a whole file before touching the board. Returns { ok, errors[] } — errors name every problem found
  // (DL-005, CQ-DL-020, SEC-DL-004), up to ERRORS_MAX.
  static validate(j){
    const errors = [], err = t => { if(errors.length < ERRORS_MAX) errors.push(t); };
    if(!j || typeof j !== 'object' || Array.isArray(j)) return { ok:false, errors:['Not a circuit file (expected a JSON object).'] };
    if(j.v !== undefined && !(Number.isInteger(j.v) && j.v >= 1)) err('Format version "v" must be a positive integer.');
    else if(j.v > FILE_V) err('File format v'+j.v+' is newer than this tool reads (v'+FILE_V+'). Open it in a newer version.');
    if(!Array.isArray(j.comps)) err('Missing "comps" list.');
    if(!Array.isArray(j.wires)) err('Missing "wires" list.');
    if(errors.length) return { ok:false, errors };
    if(j.comps.length > IMPORT_MAX_PARTS) return { ok:false, errors:['Too many parts: '+j.comps.length+' (at most '+IMPORT_MAX_PARTS+').'] };
    if(j.wires.length > IMPORT_MAX_WIRES) return { ok:false, errors:['Too many wires: '+j.wires.length+' (at most '+IMPORT_MAX_WIRES+').'] };
    const ids = new Map();
    j.comps.forEach((s,k) => {
      const where = 'comps['+k+']';
      if(!s || typeof s !== 'object' || Array.isArray(s)){ err(where+': not an object.'); return; }
      const d = defOf(s.type);
      if(!d) err(where+': unknown part type "'+String(s.type).slice(0, LABEL_MAX)+'".');
      if(!Number.isFinite(s.x) || !Number.isFinite(s.y)) err(where+': position is not numeric.');
      if(!Number.isInteger(s.id) || s.id < 1) err(where+': id must be a positive integer.');
      else if(ids.has(s.id)) err(where+': duplicate id '+s.id+'.'); else ids.set(s.id, s);
      if(s.rot !== undefined && !(Number.isInteger(s.rot) && s.rot >= 0 && s.rot < QUARTER_TURNS)) err(where+': rot must be an integer 0..'+(QUARTER_TURNS-1)+'.');
      if(s.label !== undefined && s.label !== null && (typeof s.label !== 'string' || s.label.length > LABEL_MAX)) err(where+': label must be text of at most '+LABEL_MAX+' characters.');
      if(s.color !== undefined && s.color !== null && !(typeof s.color === 'string' && Object.prototype.hasOwnProperty.call(LED_COLORS, s.color))) err(where+': unknown LED color.');
      if(s.prevClk !== undefined && !isBit(s.prevClk)) err(where+': prevClk must be 0 or 1.');
      if(d){ const why = stateProblem(d, s.state); if(why) err(where+': '+why+'.'); }
    });
    const fed = new Set();
    j.wires.forEach((w,k) => {
      const where = 'wires['+k+']';
      if(!w || typeof w !== 'object' || !w.from || !w.to || typeof w.from !== 'object' || typeof w.to !== 'object'){ err(where+': missing from/to.'); return; }
      const f = ids.get(w.from.c), t = ids.get(w.to.c);
      if(!f) err(where+': from part id '+String(w.from.c).slice(0, LABEL_MAX)+' does not exist.');
      else if(defOf(f.type) && !(Number.isInteger(w.from.pin) && w.from.pin >= 0 && w.from.pin < defOf(f.type).outs.length)) err(where+': '+f.type+' has no output pin '+String(w.from.pin).slice(0, LABEL_MAX)+'.');
      if(!t) err(where+': to part id '+String(w.to.c).slice(0, LABEL_MAX)+' does not exist.');
      else if(defOf(t.type) && !(Number.isInteger(w.to.pin) && w.to.pin >= 0 && w.to.pin < defOf(t.type).ins.length)) err(where+': '+t.type+' has no input pin '+String(w.to.pin).slice(0, LABEL_MAX)+'.');
      else if(defOf(t.type)){ const key = w.to.c+':'+w.to.pin; if(fed.has(key)) err(where+': a second wire into '+t.type+' input '+defOf(t.type).ins[w.to.pin]+' (one driver per input).'); fed.add(key); }
      for(const r of WIRE_ROUTE_KEYS) if(w[r] !== undefined && w[r] !== null && !Number.isFinite(w[r])) err(where+': route offset '+r+' is not numeric.');
    });
    return { ok: !errors.length, errors };
  }
  // Load a validated file. Board is untouched if validation fails. Edge memory restored exactly (v2) or primed (v1).
  // Blank or duplicate signal labels (allowed by v1.0.0) get fresh labels, listed in the result's relabelled[].
  load(j){
    const v = Circuit.validate(j); if(!v.ok) return Object.assign(v, { relabelled: [] });
    this.touch();
    this.comps = j.comps.map(s => { const d = DEFS[s.type];
      return { id:s.id, type:s.type, x:s.x, y:s.y, rot:s.rot||0, color:s.color || d.color0, label:s.label || '', state:stateFrom(d, s.state),
               out:d.outs.map(()=>0), inv:d.ins.map(()=>0), drv:d.ins.map(()=>0), prevClk:0 }; });
    this.wires = j.wires.map(wireFrom);
    this.nextId = Math.max(0, ...this.comps.map(c=>c.id)) + 1;
    this.relink();
    const relabelled = [], seen = new Set();
    for(const c of this.comps){ if(!SIGNAL_TYPES.includes(c.type)) continue;
      if(c.label && !seen.has(c.label)){ seen.add(c.label); continue; }
      const old = c.label; c.label = this.autoLabel(c.type); seen.add(c.label);
      relabelled.push(DEFS[c.type].name+' '+(old ? '"'+old+'" (duplicate)' : '(no label)')+' → "'+c.label+'"'); }
    this.settle(); this.primeEdges();
    if((j.v||1) >= 2) for(const s of j.comps){ const c = this.comp(s.id); if(c && DEFS[c.type].seq && s.prevClk !== undefined) c.prevClk = s.prevClk; }
    this.emit();
    return Object.assign(v, { relabelled });
  }
}
// ── END CIRCUIT ───────────────────────────────────────────────

// ── CHECKER ───────────────────────────────────────────────────
/* Truth-table checker: vectors applied in order (so sequential tests work).
   Runs on a private copy of the circuit — the student's board is never touched (DL-004).
   Flip-flops start from reset and the named switches start LOW (so a switch left HIGH on the board
   is not an edge, DL-003); other switches keep their positions.
   inputs by SWITCH label, outputs by PROBE/LED label. Returns {ok, rows, missing, duplicates}:
   a name used by two parts is reported, never resolved silently (DL-011, CQ-DL-010). */
function checkVectors(ckt, vectors){
  const inNames = Object.keys(vectors[0].in), outNames = Object.keys(vectors[0].out);
  const isOut = c => c.type==='PROBE' || c.type==='LED';   // parts the checker reads
  const count = (pred, n) => ckt.comps.filter(c => pred(c) && c.label === n).length;   // parts of a kind carrying label n
  const missing = [], duplicates = [];
  inNames.forEach(n => { const k = count(c => c.type==='SW', n); if(!k) missing.push('SWITCH "'+n+'"'); else if(k > 1) duplicates.push('SWITCH "'+n+'"'); });
  outNames.forEach(n => { const k = count(isOut, n); if(!k) missing.push('PROBE "'+n+'"'); else if(k > 1) duplicates.push('PROBE/LED "'+n+'"'); });
  if(missing.length || duplicates.length) return { ok:false, rows:[], missing, duplicates };
  const sim = new Circuit(); sim.load(ckt.toJSON());
  const bySw = {}, byOut = {};
  for(const c of sim.comps){ if(c.type==='SW') bySw[c.label] = c; if(isOut(c)) byOut[c.label] = c; }
  inNames.forEach(n => { bySw[n].state.on = 0; });   // named inputs start LOW so the first vector's transitions are real
  sim.resetState();
  const rows = vectors.map(v => {
    inNames.forEach(n => bySw[n].state.on = v.in[n]); sim.update();
    const got = {}; let ok = true;
    outNames.forEach(n => { const o = byOut[n]; got[n] = o.type==='LED' ? readOut(sim, o) : o.inv[0]; if(got[n] !== v.out[n]) ok = false; });
    return { in:v.in, want:v.out, got, ok };
  });
  return { ok: rows.every(r=>r.ok), rows, missing, duplicates };
}
// ── END CHECKER ───────────────────────────────────────────────

// ── TRUTH TABLE ───────────────────────────────────────────────
/* Truth table of the board as built. Inputs are the SWITCHes, outputs the PROBEs and LEDs, each ordered by label
   (first label = most significant bit). Every row starts from reset with all switches LOW and then sets the row,
   so a combinational circuit gives its exact table, and a circuit with memory (latches, flip-flops) gives what it
   does from reset -- flagged so the student knows the table is not the whole story. Clocks are held LOW; drive
   sequential parts from a switch to tabulate them.
   Async: rows are computed in slices of TT_SLICE_MS and the main thread is released between slices (CQ-DL-008).
   onProgress(done, total) is called after each slice. The board is copied at the call; it is never changed. */
async function truthTable(ckt, onProgress){
  const byLab = (a,b) => a.label.localeCompare(b.label, undefined, { numeric:true });   // label order, I2 before I10
  const ins = ckt.comps.filter(c => c.type==='SW').sort(byLab), outs = ckt.comps.filter(c => c.type==='PROBE' || c.type==='LED').sort(byLab);
  const head = { ins: ins.map(c => c.label), outs: outs.map(c => c.label) };
  if(!ins.length || !outs.length) return Object.assign(head, { rows: [], seq: false, tooMany: false });
  if(ins.length > TT_MAX_IN) return Object.assign(head, { rows: [], seq: false, tooMany: true });
  const seq = ckt.comps.some(c => DEFS[c.type].seq || c.type==='SR');
  const sim = new Circuit(); sim.load(ckt.toJSON());
  const sw = ins.map(c => sim.comp(c.id)), pr = outs.map(c => sim.comp(c.id)), n = ins.length, total = 1 << n, rows = [];
  const manual = sim.comps.filter(c => MANUAL_INPUTS.includes(c.type));
  let sliceStart = performance.now();
  for(let k=0; k<total; k++){
    manual.forEach(c => { c.state.on = 0; });
    sim.resetState();
    const bits = sw.map((_,j) => (k >> (n-1-j)) & 1);
    sw.forEach((c,j) => { c.state.on = bits[j]; }); sim.update();
    rows.push({ in: bits, out: pr.map(o => readOut(sim, o)), unstable: sim.unstable });
    if(performance.now() - sliceStart > TT_SLICE_MS && k < total-1){
      if(onProgress) onProgress(k+1, total);
      await new Promise(r => setTimeout(r, 0));
      sliceStart = performance.now();
    }
  }
  if(onProgress) onProgress(total, total);
  return Object.assign(head, { rows, seq, tooMany: false });
}
// ── END TRUTH TABLE ───────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
Object.assign(window.DLB, { Circuit, checkVectors, truthTable, readOut, TT_MAX_IN, FILE_V });
// ── END EXPORT ────────────────────────────────────────────────
})();
