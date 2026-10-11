(function(){
const { DEFS, CATS, LED_COLORS, Circuit, Board, Timing, pages, truthTable, TT_MAX_IN } = window.DLB;
const BG_THEMES = {
  Charcoal: { '--bg':'#0f1218','--bg2':'#161b22','--bg3':'#1c222b','--inset':'#090c11','--line':'#262d38','--line2':'#333c49' },
  Slate:    { '--bg':'#0d141c','--bg2':'#141d27','--bg3':'#1a2531','--inset':'#070c12','--line':'#22303d','--line2':'#2f4150' },
  Black:    { '--bg':'#060709','--bg2':'#0d0f13','--bg3':'#13161c','--inset':'#000000','--line':'#1c222b','--line2':'#2a3340' },
};
const $ = s => document.querySelector(s);
const store = (k,v) => localStorage.setItem('dlb.'+k, JSON.stringify(v));
const load = (k,d) => { try { const v = localStorage.getItem('dlb.'+k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } };

const ckt = new Circuit(), board = new Board($('#board'), ckt), timing = new Timing($('#tdiag'), ckt);
/* Demo circuits. Coordinates are chosen so every wire between aligned pins runs straight; adj sets a wire's route offset. */
const DEMOS = {
  'Binary counter': { clock:true, build(){
    const K = ckt.add('CLK',40,140), R = ckt.add('SW',40,220), C = ckt.add('CNT4',160,120), S = ckt.add('SEG7',360,120); R.label = 'RST';
    W(K,0,C,0); W(R,0,C,1); for(let i=0;i<4;i++) W(C,i,S,i);
    const xs = [460,400,340,280], L = [];
    for(let i=0;i<4;i++){ const l = ckt.add('LED',xs[i],300); l.rot = 1; l.color = ['red','amber','green','blue'][i]; l.label = 'Q'+i; L.push(l); W(C,i,l,0); }
    const G = ckt.add('GND',560,380); G.rot = 2; L.forEach(l => W(G,0,l,1)); } },
  'LED chaser': { clock:true, build(){
    const K = ckt.add('CLK',40,380), R = ckt.add('SHR4',160,320), N = ckt.add('NOT',160,520); N.rot = 2;
    W(K,0,R,1); W(R,3,N,0,{my:480}); W(N,0,R,0,{my:440});
    const xs = [460,400,340,280], L = [];
    for(let i=0;i<4;i++){ const l = ckt.add('LED',xs[i],480); l.rot = 1; l.color = ['red','amber','green','blue'][i]; l.label = 'Q'+i; L.push(l); W(R,i,l,0); }
    const G = ckt.add('GND',560,560); G.rot = 2; L.forEach(l => W(G,0,l,1)); } },
  'Half adder': { build(){
    const A = ckt.add('SW',40,100), B = ckt.add('SW',40,180), X = ckt.add('XOR',160,80), N = ckt.add('AND',160,200);
    W(A,0,X,0,{mx:120}); W(A,0,N,0,{mx:110}); W(B,0,X,1,{mx:130}); W(B,0,N,1,{mx:120});
    const S = ckt.add('LED',300,100), C = ckt.add('LED',300,220); S.label='S'; S.color='green'; C.label='C'; C.color='red';
    W(X,0,S,0); W(N,0,C,0);
    const G = ckt.add('GND',420,160); G.rot = 2; W(G,0,S,1,{mx:380}); W(G,0,C,1,{mx:380}); } },
  '4-bit adder': { build(){
    const AD = ckt.add('ADD4',200,100), S = ckt.add('SEG7',400,140);
    for(let i=0;i<4;i++){ const s = ckt.add('SW',140-40*i,20); s.rot = 1; s.label = 'A'+i; W(s,0,AD,i); }
    for(let i=0;i<4;i++){ const s = ckt.add('SW',20+40*i,340); s.rot = 3; s.label = 'B'+i; W(s,0,AD,4+i); }
    const Z = ckt.add('LO',100,260); W(Z,0,AD,8);
    W(AD,0,S,0); W(AD,1,S,1); W(AD,2,S,2,{mx:360}); W(AD,3,S,3,{mx:330});
    const C = ckt.add('LED',400,280); C.label='Cout'; C.color='red'; W(AD,4,C,0,{mx:310});
    const G = ckt.add('GND',500,280); G.rot = 2; W(G,0,C,1); } },
  'SR latch': { build(){
    const S = ckt.add('SW',40,240), R = ckt.add('SW',40,80), N1 = ckt.add('NOR',160,80), N2 = ckt.add('NOR',160,200); S.label='S'; R.label='R';
    W(R,0,N1,0); W(S,0,N2,1);
    W(N1,0,N2,0,{ax:264,my:190,bx:136}); W(N2,0,N1,1,{ax:276,my:170,bx:124});
    const Q = ckt.add('LED',320,100), QB = ckt.add('LED',320,220); Q.label='Q'; Q.color='green'; QB.label='Q\u0304'; QB.color='amber';
    W(N1,0,Q,0); W(N2,0,QB,0);
    const G = ckt.add('GND',440,160); G.rot = 2; W(G,0,Q,1,{mx:400}); W(G,0,QB,1,{mx:400}); } },
};
/* v1.0: undo / redo. Every edit that changes the circuit's structure (parts, positions, rotation, labels, colours,
   wires) pushes the board as it was; switch flips and clock ticks are not edits. A batch (demo, clear, import) is one step. */
const HIST_MAX = 100, hist = { undo: [], redo: [], last: null, mute: 0 };
const sigOf = j => JSON.stringify({ c: j.comps.map(c => [c.id, c.type, c.x, c.y, c.rot, c.color, c.label]), w: j.wires });
function histUpd(){ $('#undo').disabled = !hist.undo.length; $('#redo').disabled = !hist.redo.length; }
function histTrack(){
  if(hist.mute) return; const j = ckt.toJSON(), sg = sigOf(j);
  if(hist.last && sg !== hist.last.sig){ hist.undo.push(hist.last.json); if(hist.undo.length > HIST_MAX) hist.undo.shift(); hist.redo = []; }
  hist.last = { sig: sg, json: j }; histUpd();
}
function batch(fn){ hist.mute++; try { fn(); } finally { hist.mute--; } histTrack(); }
function histGo(from, to){ if(!from.length) return; const j = from.pop(); to.push(ckt.toJSON());
  hist.mute++; try { setRun(false); ckt.load(j); } finally { hist.mute--; } hist.last = { sig: sigOf(j), json: j }; timing.clear(); board.sel = null; board.draw(); histUpd(); }
const undo = () => histGo(hist.undo, hist.redo), redo = () => histGo(hist.redo, hist.undo);
function W(f, fp, t, tp, adj){ ckt.connect({c:f.id,pin:fp},{c:t.id,pin:tp}); if(adj) Object.assign(ckt.wires[ckt.wires.length-1], adj); }
function loadDemo(name){ const d = DEMOS[name]; if(!d) return; setRun(false); batch(() => { ckt.clear(); d.build(); ckt.update(); }); timing.clear(); board.view = { ox: 40, oy: 20, s: 1 }; board.sel = null; board.draw(); if(d.clock) setRun(true); }
/* palette */
const pal = $('#palette');
CATS.forEach(cat => { const hd = document.createElement('div'); hd.className='hint'; hd.style.margin='6px 0 3px'; hd.textContent = cat; pal.append(hd);
  const grid = document.createElement('div'); grid.className='pal';
  Object.keys(DEFS).filter(k=>DEFS[k].cat===cat).forEach(k => { const b = document.createElement('button'); b.textContent = DEFS[k].name; b.dataset.t = k; b.onclick = ()=>board.arm(k); grid.append(b); });
  pal.append(grid); });
board.onArm = t => { pal.querySelectorAll('button').forEach(b => b.classList.toggle('arm', b.dataset.t===t)); $('#armchip').hidden = !t; if(t) $('#armchip b').textContent = DEFS[t].name; };

/* readouts + persistence on every change */
let ckSteps = 0;
ckt.onChange(histTrack);
ckt.onChange(()=>{ $('#r-n').textContent = ckt.comps.length; $('#r-w').textContent = ckt.wires.length; $('#unst').hidden = !ckt.unstable; const op = ckt.openInputs(); $('#r-open').textContent = op; $('#r-open').style.color = op ? 'var(--open)' : '';
  const c = ckt.comps.find(x=>x.type==='CLK'); $('#r-ck').textContent = c ? (c.out[0]?'1':'0') : '—'; store('circuit', ckt.toJSON()); });

/* clock */
let running = false, hz = load('hz', 2), acc = 0, last = 0;
$('#hz').value = hz; $('#hzv').textContent = hz+' Hz';
$('#hz').oninput = e => { hz = +e.target.value; $('#hzv').textContent = hz+' Hz'; store('hz', hz); };
function loop(t){ if(!running) return; acc += (t-last); last = t; const half = 500/hz; if(acc >= half){ acc -= half; if(!ckt.tickClocks()) setRun(false); } requestAnimationFrame(loop); }
function setRun(on){ running = on; $('#run').textContent = on?'Stop':'Run'; $('#run').classList.toggle('on', on); store('run', on); if(on){ last = performance.now(); acc = 0; requestAnimationFrame(loop); } }
$('#run').onclick = ()=>setRun(!running);
$('#step').onclick = ()=>{ setRun(false); ckt.tickClocks(); };
const saved = load('circuit', null);
if(saved && ckt.load(saved).ok){ if(load('run', false) && ckt.comps.some(c=>c.type==='CLK')) setRun(true); } else loadDemo('Binary counter');

/* board actions */
Object.entries(LED_COLORS).forEach(([k,v]) => { const b = document.createElement('button'); b.title = k; b.setAttribute('aria-label', k+' LED'); b.style.cssText = 'flex:1;height:22px;padding:0;background:'+v+';border:2px solid var(--line2);border-radius:5px'; b.dataset.k = k;
  b.onclick = ()=>{ if(board.sel && board.sel.type==='LED') ckt.setColor(board.sel, k); }; $('#ledcol').append(b); });
function syncLed(){ const l = board.sel && board.sel.type==='LED' ? board.sel : null; $('#ledsel').textContent = l ? (l.label||'LED')+' · '+l.color : 'select an LED'; $('#ledcol').querySelectorAll('button').forEach(b => b.style.borderColor = l && b.dataset.k===l.color ? 'var(--txt)' : 'var(--line2)'); }
ckt.onChange(syncLed); $('#board').addEventListener('mouseup', ()=>setTimeout(syncLed,0));
Object.keys(DEMOS).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = ()=>{ if(!ckt.comps.length || confirm('Replace the board with "'+n+'"?')) loadDemo(n); }; $('#demos').append(b); });
$('#rot').onclick = ()=>{ if(board.sel && board.sel.type) ckt.rotate(board.sel, 1); };
$('#rst').onclick = ()=>{ ckt.resetState(); timing.clear(); };
$('#clr').onclick = ()=>{ if(confirm('Clear the board? (Undo brings it back.)')){ setRun(false); batch(() => ckt.clear()); timing.clear(); } };
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#del').onclick = ()=>{ const x = board.sel; if(!x) return; if(x.type) ckt.remove(x); else ckt.removeWire(x); board.sel = null; board.draw(); };
$('#ren').onclick = ()=>{ if(board.sel && board.sel.type) board.rename(board.sel); };
$('#zin').onclick = ()=>board.zoomBy(1.2); $('#zout').onclick = ()=>board.zoomBy(1/1.2); $('#zfit').onclick = ()=>board.fit();
window.addEventListener('keydown', e => {
  if(!(e.ctrlKey || e.metaKey) || !$('#board').offsetParent || ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if(k === 'z' && !e.shiftKey){ e.preventDefault(); undo(); } else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); redo(); } });
/* truth table */
let ttLast = null;
function showTT(){
  const T = truthTable(ckt), bd = $('#ttbody'); bd.replaceChildren(); ttLast = T;
  const note = (t, w) => { const p = document.createElement('p'); p.className = 'note' + (w ? ' warn' : ''); p.textContent = t; bd.append(p); };
  if(!T.ins.length || !T.outs.length){ note('Place at least one SWITCH (input) and one PROBE or LED (output). The table lists every switch combination and what the probes read.'); $('#ttm').classList.add('on'); return; }
  if(T.tooMany){ note(T.ins.length + ' switches would need ' + (1 << T.ins.length) + ' rows; the table handles up to ' + TT_MAX_IN + ' switches (' + (1 << TT_MAX_IN) + ' rows).', true); $('#ttm').classList.add('on'); return; }
  note('Inputs are the switches, outputs the probes and LEDs, each in label order (first label = most significant bit). Each row is applied to a fresh copy of your board; the board itself is not changed.');
  if(T.seq) note('This circuit has memory (a latch or flip-flop). Each row starts from reset with every switch LOW, so the table shows what the circuit does from reset, not every behaviour. Clocks are held LOW: to tabulate a flip-flop, clock it from a switch.', true);
  if(T.rows.some(r => r.unstable)) note('Some rows did not settle (a combinational loop): those outputs are marked ~.', true);
  const tb = document.createElement('table'); tb.className = 'tt';
  const hr = document.createElement('tr'); const th = (t, c) => { const e = document.createElement('th'); e.textContent = t; if(c) e.className = c; hr.append(e); };
  th('#'); T.ins.forEach(n => th(n)); T.outs.forEach((n, j) => th(n, j ? '' : 'sep')); tb.append(hr);
  T.rows.forEach((r, k) => { const tr = document.createElement('tr'), td = (v, c) => { const e = document.createElement('td'); e.textContent = v; e.className = c; tr.append(e); };
    td(k, 'l'); r.in.forEach(v => td(v, v ? 'h' : 'l'));
    r.out.forEach((v, j) => td(r.unstable ? '~' : v === null ? 'open' : v, (v ? 'h' : v === null ? 'bad' : 'l') + (j ? '' : ' sep'))); tb.append(tr); });
  bd.append(tb);
  // minterm list per output: the canonical sum of products in compact form
  const mt = document.createElement('div'); mt.className = 'mt';
  T.outs.forEach((n, j) => { const ms = T.rows.map((r, k) => r.out[j] === 1 ? k : -1).filter(k => k >= 0);
    const line = document.createElement('div'); const b = document.createElement('b'); b.textContent = n;
    line.append(b, ' = ' + (ms.length ? '\u03a3m(' + ms.join(', ') + ')' : '0') + (T.rows.some(r => r.out[j] === null) ? '   (probe not connected)' : '')); mt.append(line); });
  const vars = document.createElement('div'); vars.style.color = 'var(--mut)'; vars.textContent = 'Minterm index: ' + T.ins.join(' ') + ' read as a binary number, ' + T.ins[0] + ' the most significant bit.'; mt.append(vars);
  bd.append(mt); $('#ttm').classList.add('on');
}
$('#ttb').onclick = showTT;
$('#ttclose').onclick = ()=>$('#ttm').classList.remove('on');
$('#ttm').onclick = e => { if(e.target.id === 'ttm') $('#ttm').classList.remove('on'); };
window.addEventListener('keydown', e => { if(e.key === 'Escape') $('#ttm').classList.remove('on'); });
$('#ttcopy').onclick = ()=>{ const T = ttLast; if(!T || !T.rows.length) return;
  const csv = [T.ins.concat(T.outs).join(',')].concat(T.rows.map(r => r.in.concat(r.out.map(v => v === null ? 'open' : v)).join(','))).join('\n');
  const done = () => { $('#ttcopy').textContent = 'Copied'; setTimeout(() => $('#ttcopy').textContent = 'Copy CSV', 1200); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(csv).then(done, () => prompt('Copy the table:', csv)); else prompt('Copy the table:', csv); };
$('#exp').onclick = ()=>{ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(ckt.toJSON(),null,1)],{type:'application/json'})); a.download = 'circuit.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#imp').onclick = ()=>$('#file').click();
$('#file').onchange = e => { const f = e.target.files[0]; if(!f) return; f.text().then(t => { let j; try { j = JSON.parse(t); } catch(err){ alert('Could not read "'+f.name+'": not valid JSON. The board was not changed.'); return; }
  const v = Circuit.validate(j); if(!v.ok){ alert('Could not load "'+f.name+'". The board was not changed.\n\n'+v.errors.slice(0,12).join('\n')+(v.errors.length>12?'\n…and '+(v.errors.length-12)+' more':'')); return; }
  setRun(false); batch(() => ckt.load(j)); timing.clear(); board.sel = null; board.draw(); }); e.target.value=''; };
function setTiming(on){ timing.enabled = on; $('#timing').classList.toggle('on', on); $('#tim').classList.toggle('on', on); store('timing', on); requestAnimationFrame(()=>requestAnimationFrame(()=>{ board.resize(); timing.draw(); })); }
$('#tim').onclick = ()=>setTiming(!timing.enabled);
setTiming(load('timing', false));

/* pages */
$('#pg-tut').append(pages.tutorial());
$('#pg-exp').append(pages.experiments(ckt, ()=>showPage('sim')));
function showPage(id){ document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id==='pg-'+id)); document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.pg===id)); store('page', id);
  if(id==='sim') requestAnimationFrame(()=>requestAnimationFrame(()=>{ board.resize(); timing.draw(); })); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = ()=>showPage(b.dataset.pg));
showPage(load('page','sim'));

/* tweaks */
const tw = load('tweaks', { theme:'Charcoal', grid:true, pins:true, wire:true });
$('#twk').onclick = ()=>$('#tweaks').classList.toggle('on');
Object.keys(BG_THEMES).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = ()=>{ tw.theme = n; applyTweaks(); }; $('#themes').append(b); });
['grid','pins','wire'].forEach(k => { $('#t-'+k).checked = tw[k]; $('#t-'+k).onchange = e => { tw[k] = e.target.checked; applyTweaks(); }; });
function applyTweaks(){ Object.entries(BG_THEMES[tw.theme]).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
  $('#themes').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent===tw.theme));
  board.showGrid = tw.grid; board.showPinNames = tw.pins; board.wireColor = tw.wire; board.draw(); timing.draw(); store('tweaks', tw); }
applyTweaks();
ckt.emit();
window.__dlb = { ckt, board, hist, undo, redo, showTT };   // test hook
})();
