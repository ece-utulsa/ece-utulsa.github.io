/* Digital Logic Breadboard — component definitions.
   Each def: name, cat, ins[], outs[], fn(inputs, state) -> outputs (combinational),
   optional seq: {clk: pinIndex, next(inputs, state) -> newState}, optional draw(ctx,c,vals). */
(function(){
const GRID = 20, PIN_LEN = 12, BODY_W = 80;
const bit = v => v ? 1 : 0;
const G = (name, ins, f, shape) => ({ name, cat:'Gates', ins, outs:['Y'], fn: i => [bit(f(i))], shape });

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

  // v1.0: combinational building blocks. Select / address inputs are binary, LSB first (S0, A0).
  MUX2:{ name:'MUX 2:1', cat:'Combinational', ins:['I0','I1','S'], outs:['Y'], fn:i=>[bit(i[2] ? i[1] : i[0])] },
  MUX4:{ name:'MUX 4:1', cat:'Combinational', ins:['I0','I1','I2','I3','S0','S1'], outs:['Y'], fn:i=>[bit(i[(i[4]?1:0) + (i[5]?2:0)])] },
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

  // LED: anode A (left) and cathode K (right). Lit only when A is driven HIGH and K is driven LOW — an open cathode is an open circuit.
  LED:   { name:'LED', cat:'Outputs', ins:['A','K'], outs:[], right:1, fn:()=>[], auto:'L', shape:'led', color0:'red' },
  PROBE: { name:'PROBE', cat:'Outputs', ins:['A'], outs:[], fn:()=>[], auto:'P', shape:'probe' },
  SEG7:  { name:'7-SEG', cat:'Outputs', ins:['D0','D1','D2','D3'], outs:[], fn:()=>[], shape:'seg7' },

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
  CNT4:{ name:'CTR 4', cat:'Sequential', ins:['CK','RST'], outs:['Q0','Q1','Q2','Q3'], init:()=>({n:0}),
         fn:(i,s)=>{ if(i[1]) s.n=0; return [s.n&1,(s.n>>1)&1,(s.n>>2)&1,(s.n>>3)&1]; }, seq:{clk:0, next:(i,s)=>({n: i[1]?0:(s.n+1)&15})} },
  // Up/down counter: counts up on each rising edge when UP = 1, down when UP = 0; RST clears it at once (asynchronous).
  UDC4:{ name:'CTR U/D', cat:'Sequential', ins:['CK','UP','RST'], outs:['Q0','Q1','Q2','Q3'], init:()=>({n:0}),
         fn:(i,s)=>{ if(i[2]) s.n=0; return [s.n&1,(s.n>>1)&1,(s.n>>2)&1,(s.n>>3)&1]; },
         seq:{clk:0, next:(i,s)=>({n: i[2] ? 0 : (s.n + (i[1] ? 1 : 15)) & 15})} },
  REG4:{ name:'REG 4', cat:'Sequential', ins:['D0','D1','D2','D3','CK'], outs:['Q0','Q1','Q2','Q3'], init:()=>({v:[0,0,0,0]}),
         fn:(i,s)=>s.v.slice(), seq:{clk:4, next:(i,s)=>({v:[bit(i[0]),bit(i[1]),bit(i[2]),bit(i[3])]})} },
  SHR4:{ name:'SHIFT 4', cat:'Sequential', ins:['SI','CK'], outs:['Q0','Q1','Q2','Q3'], init:()=>({v:[0,0,0,0]}),
         fn:(i,s)=>s.v.slice(), seq:{clk:1, next:(i,s)=>({v:[bit(i[0]),s.v[0],s.v[1],s.v[2]]})} },

  HA:  { name:'HALF ADD', cat:'Arithmetic', ins:['A','B'], outs:['S','C'], fn:i=>[bit(i[0]!==i[1]), bit(i[0]&&i[1])] },
  FA:  { name:'FULL ADD', cat:'Arithmetic', ins:['A','B','Cin'], outs:['S','Cout'], fn:i=>{const n=i[0]+i[1]+i[2];return [n&1,bit(n>1)];} },
  CMP: { name:'CMP 1', cat:'Arithmetic', ins:['A','B'], outs:['A<B','A=B','A>B'], fn:i=>[bit(i[0]<i[1]),bit(i[0]===i[1]),bit(i[0]>i[1])] },
  // ADD 4: 4-bit ripple-carry adder with carry-in (74LS283 function) so blocks cascade Cout→Cin to any width (R-3).
  ADD4:{ name:'ADD 4', cat:'Arithmetic', ins:['A0','A1','A2','A3','B0','B1','B2','B3','Cin'], outs:['S0','S1','S2','S3','Cout'],
         fn:i=>{const a=i[0]|i[1]<<1|i[2]<<2|i[3]<<3, b=i[4]|i[5]<<1|i[6]<<2|i[7]<<3, s=a+b+(i[8]?1:0); return [s&1,(s>>1)&1,(s>>2)&1,(s>>3)&1,(s>>4)&1];} },
};
const LED_COLORS = { red:'#ff5d5d', green:'#3ddc84', amber:'#ffb02e', blue:'#5b9dff', white:'#e6ebf2' };
const CATS = ['Inputs','Power','Gates','Combinational','Sequential','Arithmetic','Outputs'];

// Geometry: all pins land on the GRID so wires between on-grid parts run straight.
// A side with m pins occupies (m+1) grid units if m is odd, (m+2) if even (one-unit gap at center); body height = tallest side.
const sideUnits = m => m<=1 ? 2 : (m%2 ? m+1 : m+2);
function sideY(m, k, h){ const c = h/2; if(m<=1) return c; if(m%2) return c + (k-(m-1)/2)*GRID; return k < m/2 ? c - (m/2-k)*GRID : c + (k-m/2+1)*GRID; }
function geom0(type){
  const d = DEFS[type], R = d.right||0;
  const small = ['SW','BTN','HI','LO','LED','PROBE','CLK','VCC','GND','RES'].includes(type);
  if(small) return { w:40, h:40 };
  const units = Math.max(sideUnits(d.ins.length-R), sideUnits(d.outs.length+R), 2);
  return { w: BODY_W, h: units*GRID };
}
function geom(type, rot){ const g = geom0(type); return (rot||0)%2 ? { w:g.h, h:g.w } : g; }
// Pin position relative to the unrotated body's top-left corner. rot = 0..3 quarter turns CW.
function localPin(c, side, idx){
  const d = DEFS[c.type], { w, h } = geom0(c.type), R = d.right||0;
  let m, k, rightSide;
  if(side==='in'){ const L = d.ins.length - R; if(idx < L){ m = L; k = idx; rightSide = false; } else { m = R; k = idx - L; rightSide = true; } }
  else { m = d.outs.length; k = idx; rightSide = true; }
  return { x: rightSide ? w + PIN_LEN : -PIN_LEN, y: sideY(m, k, h) };
}
const ledLit = c => !!(c.drv && c.drv[0] && c.drv[1] && c.inv[0] && !c.inv[1]);
function pinPos(c, side, idx){
  const { w, h } = geom0(c.type), W = geom(c.type, c.rot), lp = localPin(c, side, idx), r = (c.rot||0)%4;
  let dx = lp.x - w/2, dy = lp.y - h/2;
  for(let k=0;k<r;k++){ const t = dx; dx = -dy; dy = t; }
  return { x: Math.round(c.x + W.w/2 + dx), y: Math.round(c.y + W.h/2 + dy) };
}
// Unit vector pointing out of the body along the pin, after rotation.
function pinDir(c, side, idx){
  const lp = localPin(c, side, idx); let dx = lp.x < 0 ? -1 : 1, dy = 0;
  for(let k=0;k<((c.rot||0)%4);k++){ const t = dx; dx = -dy; dy = t; }
  return { dx, dy };
}
window.DLB = Object.assign(window.DLB||{}, { DEFS, CATS, LED_COLORS, ledLit, GRID, PIN_LEN, geom, geom0, localPin, pinPos, pinDir });
})();
