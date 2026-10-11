/* Digital Logic Breadboard — circuit model + ideal simulator.
   Combinational: iterate to fixed point (max SETTLE_MAX passes). Sequential: edge-triggered
   update after settle, repeated until no FF changes (handles ripple counters).
   Edge memory: each sequential part keeps prevClk, the clock level seen at the end of the last
   update. Reset, Clear and Load PRIME prevClk from the settled clock level instead of zeroing it,
   so a clock input that is already HIGH is never mistaken for a rising edge (DL-001/002/004).
   prevClk is persisted in the file (format v2) so a reload restores the exact edge memory. */
(function(){
const { DEFS, ledLit } = window.DLB;
const SETTLE_MAX = 64, EDGE_MAX = 32, FILE_V = 2;

class Circuit {
  constructor(){ this.comps = []; this.wires = []; this.nextId = 1; this.unstable = false; this.listeners = []; }
  onChange(f){ this.listeners.push(f); }
  emit(){ this.listeners.forEach(f=>f()); }
  autoLabel(type){
    const d = DEFS[type]; if(!d.auto) return '';
    if(d.auto === 'CLK'){ const used = new Set(this.comps.filter(c=>c.type==='CLK').map(c=>c.label)); if(!used.has('CLK')) return 'CLK'; let k = 2; while(used.has('CLK'+k)) k++; return 'CLK'+k; }
    const used = new Set(this.comps.filter(c=>c.type===type).map(c=>c.label));
    if(d.auto.length > 1){ for(const ch of d.auto) if(!used.has(ch)) return ch; return d.auto[0] + this.nextId; }
    let k = 1; while(used.has(d.auto + k)) k++; return d.auto + k;
  }
  add(type, x, y){
    const d = DEFS[type];
    const c = { id: this.nextId++, type, x, y, rot: d.rot0||0, color: d.color0, label: this.autoLabel(type), state: d.init ? d.init() : {}, out: d.outs.map(()=>0), inv: d.ins.map(()=>0), drv: d.ins.map(()=>0), prevClk: 0 };
    this.comps.push(c); this.update(); return c;
  }
  setColor(c, col){ c.color = col; this.emit(); }
  rotate(c, dir){ c.rot = ((c.rot||0) + (dir||1) + 4) % 4; this.emit(); }
  remove(c){
    this.wires = this.wires.filter(w => w.from.c !== c.id && w.to.c !== c.id);
    this.comps = this.comps.filter(x => x !== c); this.update();
  }
  removeWire(w){ this.wires = this.wires.filter(x => x !== w); this.update(); }
  comp(id){ return this.comps.find(c => c.id === id); }
  // Wire: from {c, pin} output -> to {c, pin} input. One driver per input.
  connect(from, to){
    this.wires = this.wires.filter(w => !(w.to.c === to.c && w.to.pin === to.pin));
    this.wires.push({ from, to }); this.update(); return true;
  }
  inputDriven(c, pin){ return this.wires.some(w => w.to.c === c.id && w.to.pin === pin); }
  // Undriven input pins across the board (floating-input convention R-1: read 0, shown visibly).
  openInputs(){ let n = 0; for(const c of this.comps) for(let k=0;k<DEFS[c.type].ins.length;k++) if(!this.inputDriven(c,k)) n++; return n; }
  clear(){ this.comps = []; this.wires = []; this.unstable = false; this.update(); }

  // One combinational pass; returns true if any output changed.
  pass(){
    let changed = false;
    for(const c of this.comps){
      const d = DEFS[c.type];
      const inv = d.ins.map(()=>0), drv = d.ins.map(()=>0);
      for(const w of this.wires) if(w.to.c === c.id){ const s = this.comp(w.from.c); if(s){ inv[w.to.pin] = s.out[w.from.pin]; drv[w.to.pin] = 1; } }
      c.inv = inv; c.drv = drv;
      const out = d.fn(inv, c.state);
      for(let k=0;k<out.length;k++) if(out[k] !== c.out[k]){ changed = true; }
      c.out = out;
    }
    return changed;
  }
  settle(){
    let n = 0; while(this.pass() && n < SETTLE_MAX) n++;
    this.unstable = n >= SETTLE_MAX;
  }
  // Settle combinationally and arm every edge detector at the present clock level — no edge fires.
  prime(){
    this.settle();
    for(const c of this.comps){ const d = DEFS[c.type]; if(d.seq) c.prevClk = c.inv[d.seq.clk]; }
    this.emit();
  }
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
  tickClocks(){
    const clks = this.comps.filter(c => c.type === 'CLK'); if(!clks.length) return false;
    clks.forEach(c => c.state.on = c.state.on ? 0 : 1); this.update(); return true;
  }
  // Reset: every stateful part (except switches/buttons/clock level) to its init state. Not itself an edge.
  resetState(){
    for(const c of this.comps){ const d = DEFS[c.type]; if(d.init && !['SW','BTN','CLK'].includes(c.type)) c.state = d.init(); }
    this.prime();
  }
  // Signals shown in the timing diagram: clocks, switches, buttons, probes, LEDs.
  signals(){
    return this.comps.filter(c => ['CLK','SW','BTN','PROBE','LED'].includes(c.type)).map(c => ({
      name: c.label || DEFS[c.type].name, val: c.type==='LED' ? (ledLit(c)?1:0) : c.type==='PROBE' ? c.inv[0] : c.out[0], kind: c.type }));
  }
  toJSON(){
    return { v: FILE_V, comps: this.comps.map(c => ({ id:c.id, type:c.type, x:c.x, y:c.y, rot:c.rot||0, color:c.color, label:c.label, state:c.state, prevClk:c.prevClk||0 })),
             wires: this.wires.map(w => ({ from:w.from, to:w.to, mx:w.mx, my:w.my, ax:w.ax, bx:w.bx })) };
  }
  // Validate a whole file before touching the board. Returns { ok, errors[] } — errors name every problem found (DL-005).
  static validate(j){
    const errors = [];
    if(!j || typeof j !== 'object') return { ok:false, errors:['Not a JSON object.'] };
    if(!Array.isArray(j.comps)) errors.push('Missing "comps" list.');
    if(!Array.isArray(j.wires)) errors.push('Missing "wires" list.');
    if(errors.length) return { ok:false, errors };
    const ids = new Map();
    j.comps.forEach((s,k) => {
      const where = 'comps['+k+']';
      if(!s || typeof s !== 'object'){ errors.push(where+': not an object.'); return; }
      if(!DEFS[s.type]) errors.push(where+': unknown part type "'+s.type+'".');
      if(!Number.isFinite(s.x) || !Number.isFinite(s.y)) errors.push(where+': position is not numeric.');
      if(!Number.isInteger(s.id) || s.id < 1) errors.push(where+': id must be a positive integer.');
      else if(ids.has(s.id)) errors.push(where+': duplicate id '+s.id+'.'); else ids.set(s.id, s);
    });
    j.wires.forEach((w,k) => {
      const where = 'wires['+k+']';
      if(!w || !w.from || !w.to){ errors.push(where+': missing from/to.'); return; }
      const f = ids.get(w.from.c), t = ids.get(w.to.c);
      if(!f) errors.push(where+': from part id '+w.from.c+' does not exist.');
      else if(DEFS[f.type] && !(Number.isInteger(w.from.pin) && w.from.pin >= 0 && w.from.pin < DEFS[f.type].outs.length)) errors.push(where+': '+f.type+' has no output pin '+w.from.pin+'.');
      if(!t) errors.push(where+': to part id '+w.to.c+' does not exist.');
      else if(DEFS[t.type] && !(Number.isInteger(w.to.pin) && w.to.pin >= 0 && w.to.pin < DEFS[t.type].ins.length)) errors.push(where+': '+t.type+' has no input pin '+w.to.pin+'.');
    });
    return { ok: !errors.length, errors };
  }
  // Load a validated file. Board is untouched if validation fails. Edge memory restored exactly (v2) or primed (v1).
  load(j){
    const v = Circuit.validate(j); if(!v.ok) return v;
    this.comps = []; this.wires = [];
    for(const s of j.comps){ const d = DEFS[s.type];
      this.comps.push({ id:s.id, type:s.type, x:s.x, y:s.y, rot:(s.rot||0)%4, color:s.color||d.color0, label:s.label||'', state: Object.assign(d.init?d.init():{}, s.state||{}), out:d.outs.map(()=>0), inv:d.ins.map(()=>0), drv:d.ins.map(()=>0), prevClk:0 }); }
    this.wires = j.wires.map(w => ({ from:w.from, to:w.to, mx:w.mx, my:w.my, ax:w.ax, bx:w.bx }));
    this.nextId = Math.max(0, ...this.comps.map(c=>c.id)) + 1;
    this.settle();
    for(const c of this.comps){ const d = DEFS[c.type]; if(d.seq) c.prevClk = c.inv[d.seq.clk]; }
    if((j.v||1) >= 2) for(const s of j.comps){ const c = this.comp(s.id); if(c && DEFS[c.type].seq && s.prevClk !== undefined) c.prevClk = s.prevClk ? 1 : 0; }
    this.emit();
    return v;
  }
}

/* Truth-table checker: vectors applied in order (so sequential tests work).
   Runs on a private copy of the circuit — the student's board is never touched (DL-004).
   Flip-flops start from reset and the named switches start LOW (so a switch left HIGH on the board
   is not an edge, DL-003); other switches keep their positions.
   inputs by SWITCH label, outputs by PROBE/LED label. Returns {ok, rows, missing}. */
function checkVectors(ckt, vectors){
  const sim = new Circuit(); sim.load(ckt.toJSON());
  const bySw = {}, byOut = {};
  for(const c of sim.comps){ if(c.type==='SW') bySw[c.label]=c; if(c.type==='PROBE'||c.type==='LED') byOut[c.label]=c; }
  const missing = [];
  const inNames = Object.keys(vectors[0].in), outNames = Object.keys(vectors[0].out);
  inNames.forEach(n => { if(!bySw[n]) missing.push('SWITCH "'+n+'"'); });
  outNames.forEach(n => { if(!byOut[n]) missing.push('PROBE "'+n+'"'); });
  if(missing.length) return { ok:false, rows:[], missing };
  inNames.forEach(n => { bySw[n].state.on = 0; });   // named inputs start LOW so the first vector's transitions are real
  sim.resetState();
  const rows = vectors.map(v => {
    inNames.forEach(n => bySw[n].state.on = v.in[n]); sim.update();
    const got = {}; let ok = true;
    outNames.forEach(n => { const o = byOut[n]; got[n] = o.type==='LED' ? (ledLit(o)?1:0) : o.inv[0]; if(got[n] !== v.out[n]) ok = false; });
    return { in:v.in, want:v.out, got, ok };
  });
  return { ok: rows.every(r=>r.ok), rows, missing };
}
/* v1.0: truth table of the board as built. Inputs are the SWITCHes, outputs the PROBEs and LEDs, each ordered by label
   (first label = most significant bit). Every row is evaluated on its own fresh copy, reset, with all switches LOW
   first and then set to the row: so a combinational circuit gives its exact table, and a circuit with memory (latches,
   flip-flops) gives what it does from reset -- flagged so the student knows the table is not the whole story.
   Clocks are held LOW; drive sequential parts from a switch to tabulate them. Returns null when there is nothing to tabulate. */
const TT_MAX_IN = 8;
function truthTable(ckt){
  const lab = c => c.label || (DEFS[c.type].name + '#' + c.id), byLab = (a,b) => lab(a).localeCompare(lab(b), undefined, { numeric:true });
  const ins = ckt.comps.filter(c => c.type==='SW').sort(byLab), outs = ckt.comps.filter(c => c.type==='PROBE' || c.type==='LED').sort(byLab);
  if(!ins.length || !outs.length) return { ins: ins.map(lab), outs: outs.map(lab), rows: [], seq: false, tooMany: false };
  if(ins.length > TT_MAX_IN) return { ins: ins.map(lab), outs: outs.map(lab), rows: [], seq: false, tooMany: true };
  const seq = ckt.comps.some(c => DEFS[c.type].seq || c.type==='SR');
  const base = ckt.toJSON(), n = ins.length, rows = [];
  for(let k=0;k<(1<<n);k++){
    const sim = new Circuit(); sim.load(base);
    const sw = ins.map(c => sim.comp(c.id)), pr = outs.map(c => sim.comp(c.id));
    sim.comps.forEach(c => { if(c.type==='SW' || c.type==='BTN' || c.type==='CLK') c.state.on = 0; });
    sim.resetState();
    const bits = sw.map((_,j) => (k >> (n-1-j)) & 1);
    sw.forEach((c,j) => { c.state.on = bits[j]; }); sim.update();
    rows.push({ in: bits, out: pr.map(o => o.type==='LED' ? (ledLit(o)?1:0) : (sim.inputDriven(o,0) ? o.inv[0] : null)), unstable: sim.unstable });
  }
  return { ins: ins.map(lab), outs: outs.map(lab), rows, seq, tooMany: false };
}
window.DLB.Circuit = Circuit; window.DLB.checkVectors = checkVectors; window.DLB.truthTable = truthTable; window.DLB.TT_MAX_IN = TT_MAX_IN;
})();
