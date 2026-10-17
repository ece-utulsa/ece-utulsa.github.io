/* Digital Logic Breadboard — component definitions, part geometry and shared constants.
   Each def: name, cat, ins[], outs[], fn(inputs, state) -> outputs (combinational),
   optional init() -> state, optional seq: {clk: pinIndex, next(inputs, state) -> newState},
   optional top: the last `top` inputs sit on the top edge, left to right (select bits).
   Subsystem defs (cat 'Subsystems') are added at run time by sim.js under the type 'SUB:<name>'. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — grid, pin and body geometry, label and type lists
   2. Helpers          — bit(), own(), snap(), rowBits(), gate factory G()
   3. Part definitions — DEFS table, LED colours, palette categories
   4. Geometry         — body size, pin positions and directions
   5. Theme cache      — CSS custom properties and the canvas colour palette, read once per theme change
   6. Export           — window.DLB namespace
   ============================================================ */
(function(){
// ── CONSTANTS ─────────────────────────────────────────────────
const GRID = 20;                 // board grid pitch (px); every pin lands on it
const PIN_LEN = 12;              // pin stub length outside the body (px)
const BODY_W = 80;               // width of a block body (px)
const SMALL_PART = 40;           // width and height of a small part (switch, LED, probe, ...)
const MIN_SIDE_UNITS = 2;        // a body side is at least two grid units tall
const QUARTER_TURNS = 4;         // rotations are 0..3 quarter turns clockwise
const COUNT_MASK = 15;           // 4-bit counter wrap (0..15)
const LABEL_MAX = 10;            // longest label Rename and Import accept (characters)
// Parts whose labels name signals: they share one namespace so the timing diagram, truth table and checker
// can tell every signal apart (CQ-DL-010).
const SIGNAL_TYPES = ['SW','BTN','CLK','PROBE','LED'];
// Parts whose level the user sets: Reset FFs leaves them alone.
const MANUAL_INPUTS = ['SW','BTN','CLK'];
const SMALL_TYPES = ['SW','BTN','HI','LO','LED','PROBE','CLK','VCC','GND','RES'];
const SUB_PREFIX = 'SUB:';       // a subsystem part's type is SUB_PREFIX + its name
// CSS custom properties the canvases draw with (read into the theme cache).
const THEME_VARS = ['--bg','--bg3','--inset','--line','--line2','--txt','--mut','--mut2','--acc','--hi','--red','--blue','--open','--mono'];
// Board colour palette: name -> the CSS custom property it is read from.
const PALETTE_VARS = { HI:'--hi', LO:'--mut2', TXT:'--txt', MUT:'--mut', ACC:'--acc', L2:'--line2', OPEN:'--open',
                       BG:'--bg', BG3:'--bg3', INSET:'--inset', LINE:'--line', RED:'--red', MONO:'--mono' };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────────
// Truthy -> 1, falsy -> 0.
const bit = v => v ? 1 : 0;
// True if k is one of o's own keys (never a prototype key such as "constructor"); k must be a string.
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// Nearest grid line to v.
const snap = v => Math.round(v/GRID)*GRID;
// The n input bits of truth-table row k, most significant first.
const rowBits = (k, n) => Array.from({ length:n }, (_, j) => (k >> (n-1-j)) & 1);
// Gate definition from a name, input names and a Boolean function of the input array.
const G = (name, ins, f, shape) => ({ name, cat:'Gates', ins, outs:['Y'], fn: i => [bit(f(i))], shape });
// ── END HELPERS ───────────────────────────────────────────────

// ── PART DEFINITIONS ──────────────────────────────────────────
// stateMax: the largest value a numeric state field may take on Import (default 1, i.e. a bit).
const DEFS = {
  AND:  G('AND', ['A','B'], i=>i[0]&&i[1], 'and'),
  OR:   G('OR',  ['A','B'], i=>i[0]||i[1], 'or'),
  NOT:  G('NOT', ['A'], i=>!i[0], 'not'),
  NAND: G('NAND',['A','B'], i=>!(i[0]&&i[1]), 'nand'),
  NOR:  G('NOR', ['A','B'], i=>!(i[0]||i[1]), 'nor'),
  XOR:  G('XOR', ['A','B'], i=>i[0]!==i[1], 'xor'),
  XNOR: G('XNOR',['A','B'], i=>i[0]===i[1], 'xnor'),
  AND3: G('AND3',['A','B','C'], i=>i[0]&&i[1]&&i[2], 'and'),
  OR3:  G('OR3', ['A','B','C'], i=>i[0]||i[1]||i[2], 'or'),
  NAND3:G('NAND3',['A','B','C'], i=>!(i[0]&&i[1]&&i[2]), 'nand'),
  NOR3: G('NOR3', ['A','B','C'], i=>!(i[0]||i[1]||i[2]), 'nor'),
  AND4: G('AND4', ['A','B','C','D'], i=>i[0]&&i[1]&&i[2]&&i[3], 'and'),
  OR4:  G('OR4',  ['A','B','C','D'], i=>i[0]||i[1]||i[2]||i[3], 'or'),
  NAND4:G('NAND4',['A','B','C','D'], i=>!(i[0]&&i[1]&&i[2]&&i[3]), 'nand'),
  NOR4: G('NOR4', ['A','B','C','D'], i=>!(i[0]||i[1]||i[2]||i[3]), 'nor'),

  // Combinational building blocks. Select / address inputs are binary, LSB first (S0, A0).
  // MUX select bits sit on the top edge (customer revision 2026-10-15), S0 at the left.
  MUX2:{ name:'MUX 2:1', cat:'Combinational', ins:['I0','I1','S'], outs:['Y'], top:1, fn:i=>[bit(i[2] ? i[1] : i[0])] },
  MUX4:{ name:'MUX 4:1', cat:'Combinational', ins:['I0','I1','I2','I3','S0','S1'], outs:['Y'], top:2, fn:i=>[bit(i[(i[4]?1:0) + (i[5]?2:0)])] },
  DEC2:{ name:'DEC 2:4', cat:'Combinational', ins:['A0','A1','EN'], outs:['Y0','Y1','Y2','Y3'],
         fn:i=>{ const n = (i[0]?1:0) + (i[1]?2:0); return [0,1,2,3].map(k => bit(i[2] && k===n)); } },
  DEC3:{ name:'DEC 3:8', cat:'Combinational', ins:['A0','A1','A2','EN'], outs:['Y0','Y1','Y2','Y3','Y4','Y5','Y6','Y7'],
         fn:i=>{ const n = (i[0]?1:0) + (i[1]?2:0) + (i[2]?4:0); return [0,1,2,3,4,5,6,7].map(k => bit(i[3] && k===n)); } },

  SW:  { name:'SWITCH', cat:'Inputs', ins:[], outs:['Q'], fn:(i,s)=>[bit(s.on)], init:()=>({on:0}), click:s=>{s.on=s.on?0:1;}, auto:'ABCDEFGH', shape:'sw' },
  BTN: { name:'BUTTON', cat:'Inputs', ins:[], outs:['Q'], fn:(i,s)=>[bit(s.on)], init:()=>({on:0}), press:(s,d)=>{s.on=d?1:0;}, auto:'ABCDEFGH', shape:'btn' },
  CLK: { name:'CLOCK', cat:'Inputs', ins:[], outs:['CK'], fn:(i,s)=>[bit(s.on)], init:()=>({on:0}), auto:'CLK', shape:'clk', isClock:true },
  HI:  { name:'1', cat:'Inputs', ins:[], outs:['Q'], fn:()=>[1], shape:'const' },
  LO:  { name:'0', cat:'Inputs', ins:[], outs:['Q'], fn:()=>[0], shape:'const' },
  VCC: { name:'VCC', cat:'Power', ins:[], outs:['+'], fn:()=>[1], shape:'vcc', rot0:1 },
  GND: { name:'GND', cat:'Power', ins:[], outs:['⏚'], fn:()=>[0], shape:'gnd', rot0:3 },
  // Resistor: ideal series element — passes the logic level (pull-up from VCC, pull-down to GND, LED limiter). No drop or current modeled.
  RES: { name:'R', cat:'Power', ins:['1'], outs:['2'], fn:i=>[bit(i[0])], shape:'res' },

  // LED: one input pin; lit while it is driven HIGH (customer revision 2026-10-15: no VCC, GND or R needed).
  LED:   { name:'LED', cat:'Outputs', ins:['A'], outs:[], fn:()=>[], auto:'L', shape:'led', color0:'red' },
  PROBE: { name:'PROBE', cat:'Outputs', ins:['A'], outs:[], fn:()=>[], auto:'P', shape:'probe' },
  // 7-SEG: every segment exposed (customer revision 2026-10-15). Segment a..g or DP lights while its input is HIGH.
  SEG7S: { name:'7-SEG', cat:'Outputs', ins:['a','b','c','d','e','f','g','DP'], outs:[], fn:()=>[], shape:'seg7s' },
  // BCD 7-SEG: the v1.x display with a built-in 7448 decoder (type SEG7 kept so saved boards still load).
  SEG7:  { name:'BCD 7-SEG', cat:'Outputs', ins:['D0','D1','D2','D3'], outs:[], fn:()=>[], shape:'seg7' },

  SR:  { name:'SR LATCH', cat:'Sequential', ins:['S','R'], outs:['Q','Q̄'], init:()=>({q:0}),
         fn:(i,s)=>{ if(i[0]&&i[1]) return [0,0]; if(i[0]) s.q=1; else if(i[1]) s.q=0; return [s.q,bit(!s.q)]; } },
  DFF: { name:'D FF', cat:'Sequential', ins:['D','CK'], outs:['Q','Q̄'], init:()=>({q:0}),
         fn:(i,s)=>[s.q,bit(!s.q)], seq:{clk:1, next:(i,s)=>({q:bit(i[0])})} },
  // D FF with asynchronous preset / clear (active HIGH here, so an open PRE/CLR reads 0 = inactive). CLR wins over PRE.
  DFFPC:{ name:'D FF P/C', cat:'Sequential', ins:['D','CK','PRE','CLR'], outs:['Q','Q̄'], init:()=>({q:0}),
         fn:(i,s)=>{ if(i[3]) s.q=0; else if(i[2]) s.q=1; return [s.q,bit(!s.q)]; },
         seq:{clk:1, next:(i,s)=>({q: i[3] ? 0 : i[2] ? 1 : bit(i[0])})} },
  TFF: { name:'T FF', cat:'Sequential', ins:['T','CK'], outs:['Q','Q̄'], init:()=>({q:0}),
         fn:(i,s)=>[s.q,bit(!s.q)], seq:{clk:1, next:(i,s)=>({q: i[0] ? bit(!s.q) : s.q})} },
  JKFF:{ name:'JK FF', cat:'Sequential', ins:['J','CK','K'], outs:['Q','Q̄'], init:()=>({q:0}),
         fn:(i,s)=>[s.q,bit(!s.q)], seq:{clk:1, next:(i,s)=>({q: i[0]&&i[2] ? bit(!s.q) : i[0] ? 1 : i[2] ? 0 : s.q})} },
  CNT4:{ name:'CTR 4', cat:'Sequential', ins:['CK','RST'], outs:['Q0','Q1','Q2','Q3'], init:()=>({n:0}), stateMax:{ n:COUNT_MASK },
         fn:(i,s)=>{ if(i[1]) s.n=0; return [s.n&1,(s.n>>1)&1,(s.n>>2)&1,(s.n>>3)&1]; }, seq:{clk:0, next:(i,s)=>({n: i[1]?0:(s.n+1)&COUNT_MASK})} },
  // Up/down counter: counts up on each rising edge when UP = 1, down when UP = 0; RST clears it at once (asynchronous).
  UDC4:{ name:'CTR U/D', cat:'Sequential', ins:['CK','UP','RST'], outs:['Q0','Q1','Q2','Q3'], init:()=>({n:0}), stateMax:{ n:COUNT_MASK },
         fn:(i,s)=>{ if(i[2]) s.n=0; return [s.n&1,(s.n>>1)&1,(s.n>>2)&1,(s.n>>3)&1]; },
         seq:{clk:0, next:(i,s)=>({n: i[2] ? 0 : (s.n + (i[1] ? 1 : COUNT_MASK)) & COUNT_MASK})} },
  REG4:{ name:'REG 4', cat:'Sequential', ins:['D0','D1','D2','D3','CK'], outs:['Q0','Q1','Q2','Q3'], init:()=>({v:[0,0,0,0]}),
         fn:(i,s)=>s.v.slice(), seq:{clk:4, next:(i)=>({v:[bit(i[0]),bit(i[1]),bit(i[2]),bit(i[3])]})} },
  SHR4:{ name:'SHIFT 4', cat:'Sequential', ins:['SI','CK'], outs:['Q0','Q1','Q2','Q3'], init:()=>({v:[0,0,0,0]}),
         fn:(i,s)=>s.v.slice(), seq:{clk:1, next:(i,s)=>({v:[bit(i[0]),s.v[0],s.v[1],s.v[2]]})} },

  HA:  { name:'HALF ADD', cat:'Arithmetic', ins:['A','B'], outs:['S','C'], fn:i=>[bit(i[0]!==i[1]), bit(i[0]&&i[1])] },
  FA:  { name:'FULL ADD', cat:'Arithmetic', ins:['A','B','Cin'], outs:['S','Cout'], fn:i=>{const n=i[0]+i[1]+i[2];return [n&1,bit(n>1)];} },
  CMP: { name:'CMP 1', cat:'Arithmetic', ins:['A','B'], outs:['A<B','A=B','A>B'], fn:i=>[bit(i[0]<i[1]),bit(i[0]===i[1]),bit(i[0]>i[1])] },
  // ADD 4: 4-bit ripple-carry adder with carry-in (74LS283 function), so blocks cascade Cout→Cin to any width.
  // The carry-in is kept by principal ruling 2026-10-11 (supersedes the earlier no-carry-in scope).
  ADD4:{ name:'ADD 4', cat:'Arithmetic', ins:['A0','A1','A2','A3','B0','B1','B2','B3','Cin'], outs:['S0','S1','S2','S3','Cout'],
         fn:i=>{const a=i[0]|i[1]<<1|i[2]<<2|i[3]<<3, b=i[4]|i[5]<<1|i[6]<<2|i[7]<<3, s=a+b+(i[8]?1:0); return [s&1,(s>>1)&1,(s>>2)&1,(s>>3)&1,(s>>4)&1];} },
};
const LED_COLORS = { red:'#ff5d5d', green:'#3ddc84', amber:'#ffb02e', blue:'#5b9dff', white:'#e6ebf2' };
const CATS = ['Inputs','Power','Gates','Combinational','Sequential','Arithmetic','Outputs'];
// ── END PART DEFINITIONS ──────────────────────────────────────

// ── GEOMETRY ──────────────────────────────────────────────────
// All pins land on the GRID so wires between on-grid parts run straight.
// A side with m pins occupies m+1 grid units if m is odd, m+2 if even (one-unit gap at center); body height = tallest side.
const sideUnits = m => m<=1 ? MIN_SIDE_UNITS : (m%2 ? m+1 : m+2);
// Offset of pin k of m along a side of length h (unrotated body coordinates).
function sideY(m, k, h){ const c = h/2; if(m<=1) return c; if(m%2) return c + (k-(m-1)/2)*GRID; return k < m/2 ? c - (m/2-k)*GRID : c + (k-m/2+1)*GRID; }
// Size of the unrotated body.
function geom0(type){
  const d = DEFS[type], T = d.top||0;
  if(SMALL_TYPES.includes(type)) return { w:SMALL_PART, h:SMALL_PART };
  const units = Math.max(sideUnits(d.ins.length-T), sideUnits(d.outs.length), MIN_SIDE_UNITS);
  return { w: Math.max(BODY_W, sideUnits(T)*GRID), h: units*GRID };
}
// Size of the body after rotation.
function geom(type, rot){ const g = geom0(type); return (rot||0)%2 ? { w:g.h, h:g.w } : g; }
// Pin tip relative to the unrotated body's top-left corner, with its outward direction (dx, dy) and the point where
// it meets the body (ex, ey). Inputs on the left, outputs on the right, the last d.top inputs on the top edge.
function localPin(c, side, idx){
  const d = DEFS[c.type], { w, h } = geom0(c.type), T = d.top||0, L = d.ins.length - T;
  if(side==='in' && idx >= L){ const x = sideY(T, idx - L, w); return { x, y: -PIN_LEN, dx: 0, dy: -1, ex: x, ey: 0 }; }
  const right = side!=='in', y = right ? sideY(d.outs.length, idx, h) : sideY(L, idx, h);
  return right ? { x: w + PIN_LEN, y, dx: 1, dy: 0, ex: w, ey: y } : { x: -PIN_LEN, y, dx: -1, dy: 0, ex: 0, ey: y };
}
// Rotate a vector by r quarter turns clockwise.
function turn(dx, dy, r){ for(let k=0;k<r;k++){ const t = dx; dx = -dy; dy = t; } return { dx, dy }; }
// An LED is lit while its input is driven HIGH.
const ledLit = c => !!(c.drv && c.drv[0] && c.inv[0]);
// Board position of a pin tip.
function pinPos(c, side, idx){
  const { w, h } = geom0(c.type), W = geom(c.type, c.rot), lp = localPin(c, side, idx);
  const v = turn(lp.x - w/2, lp.y - h/2, (c.rot||0)%QUARTER_TURNS);
  return { x: Math.round(c.x + W.w/2 + v.dx), y: Math.round(c.y + W.h/2 + v.dy) };
}
// Unit vector pointing out of the body along the pin, after rotation.
function pinDir(c, side, idx){
  const lp = localPin(c, side, idx);
  return turn(lp.dx, lp.dy, (c.rot||0)%QUARTER_TURNS);
}
// ── END GEOMETRY ──────────────────────────────────────────────

// ── THEME CACHE ───────────────────────────────────────────────
// The canvases read colours from these objects instead of calling getComputedStyle on every draw (CQ-DL-005);
// colors is the board's palette, built here so a draw does not rebuild it (CQ-DL-032).
// refreshTheme() is called at startup and after every theme change.
const theme = {}, colors = {};
// Read every THEME_VARS property into the theme cache and rebuild the palette.
function refreshTheme(){
  const cs = getComputedStyle(document.documentElement);
  for(const v of THEME_VARS) theme[v] = cs.getPropertyValue(v).trim();
  if(!theme['--open']) theme['--open'] = theme['--acc'];
  for(const [k, v] of Object.entries(PALETTE_VARS)) colors[k] = theme[v];
}
// ── END THEME CACHE ───────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
window.DLB = Object.assign(window.DLB||{}, { DEFS, CATS, LED_COLORS, ledLit, GRID, PIN_LEN, QUARTER_TURNS, LABEL_MAX, SIGNAL_TYPES, MANUAL_INPUTS, SUB_PREFIX,
  bit, own, snap, rowBits, geom, geom0, localPin, pinPos, pinDir, theme, colors, refreshTheme });
// ── END EXPORT ────────────────────────────────────────────────
})();
