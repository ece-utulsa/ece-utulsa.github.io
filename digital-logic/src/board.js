/* Digital Logic Breadboard — board canvas: drawing + pointer interaction.
   v1.0: Pointer Events, so mouse, pen and touch all work (tablets, touch Chromebooks). A finger gets a larger pin
   target; two fingers pan and pinch-zoom; a long press on a part or wire removes it (the touch right-click). */
(function(){
const { DEFS, LED_COLORS, ledLit, GRID, PIN_LEN, geom, geom0, localPin, pinPos, pinDir } = window.DLB;
const SEG = [0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f,0x77,0x7c,0x39,0x5e,0x79,0x71];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

class Board {
  constructor(canvas, ckt){
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ckt = ckt;
    this.view = { ox: 60, oy: 40, s: 1 }; this.armed = null; this.sel = null; this.hover = null;
    this.drag = null; this.mouse = null; this.showGrid = true; this.showPinNames = true; this.wireColor = true;
    this.onArm = ()=>{};
    const ro = new ResizeObserver(()=>this.resize()); ro.observe(canvas.parentElement); this.resize();
    this.touches = new Map(); this.pinch = null; this.hitR = 8; this.longT = null; this.lastTap = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e=>this.pdown(e)); window.addEventListener('pointermove', e=>this.pmove(e));
    window.addEventListener('pointerup', e=>this.pup(e)); window.addEventListener('pointercancel', e=>this.pup(e, true)); canvas.addEventListener('dblclick', e=>this.dbl(e));
    canvas.addEventListener('wheel', e=>this.wheel(e), { passive:false }); canvas.addEventListener('contextmenu', e=>e.preventDefault());
    window.addEventListener('keydown', e=>this.key(e));
    ckt.onChange(()=>this.draw());
  }
  resize(){ const r = this.cv.parentElement.getBoundingClientRect(); this.cv.width = Math.max(1, r.width*devicePixelRatio); this.cv.height = Math.max(1, r.height*devicePixelRatio); this.cv.style.height = r.height+'px'; this.draw(); }
  world(e){ const r = this.cv.getBoundingClientRect(); return { x:(e.clientX-r.left-this.view.ox)/this.view.s, y:(e.clientY-r.top-this.view.oy)/this.view.s }; }
  snap(v){ return Math.round(v/GRID)*GRID; }
  /* ---- pointer routing: one pointer drives the mouse logic, a second one turns the gesture into pan + pinch ---- */
  pdown(e){
    if(e.pointerType === 'mouse'){ this.hitR = 8; this.down(e); return; }
    this.hitR = 14; this.touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    try { this.cv.setPointerCapture(e.pointerId); } catch(_){}
    if(this.touches.size === 2){ this.cancelLong(); this.drag = null; const [a,b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x-b.x, a.y-b.y) || 1, cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, s:this.view.s, ox:this.view.ox, oy:this.view.oy }; this.draw(); return; }
    if(this.touches.size > 2) return;
    // a double tap renames, like a double click -- except on switches and buttons, which students tap quickly
    const now = performance.now(), lt = this.lastTap, tc = this.hitComp(this.world(e));
    if(lt && now - lt.t < 350 && Math.hypot(lt.x-e.clientX, lt.y-e.clientY) < 24 && tc && !['SW','BTN'].includes(tc.type)){ this.lastTap = null; this.rename(tc); return; }
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    this.down(e);
    // long press (no movement) on a part or wire removes it
    const p = this.world(e), sx = e.clientX, sy = e.clientY;
    if(!this.armed && !this.hitPin(p) && (this.hitComp(p) || this.hitWire(p)))
      this.longT = { t: setTimeout(()=>{ this.longT = null; this.drag = null; this.down({ button:2, clientX:sx, clientY:sy, shiftKey:false }); this.draw(); }, 650), x:sx, y:sy };
  }
  cancelLong(){ if(this.longT){ clearTimeout(this.longT.t); this.longT = null; } }
  pmove(e){
    if(e.pointerType === 'mouse'){ this.move(e); return; }
    if(!this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(this.longT && Math.hypot(e.clientX-this.longT.x, e.clientY-this.longT.y) > 10) this.cancelLong();
    if(this.pinch && this.touches.size >= 2){ const [a,b] = [...this.touches.values()], P = this.pinch, r = this.cv.getBoundingClientRect();
      const s = Math.min(2.5, Math.max(.4, P.s * Math.hypot(a.x-b.x, a.y-b.y) / P.d)), cx = (a.x+b.x)/2, cy = (a.y+b.y)/2;
      const mx = P.cx - r.left, my = P.cy - r.top;
      this.view.s = s; this.view.ox = mx - (mx-P.ox)*s/P.s + (cx-P.cx); this.view.oy = my - (my-P.oy)*s/P.s + (cy-P.cy); this.draw(); return; }
    this.move(e);
  }
  pup(e, cancel){
    if(e.pointerType === 'mouse'){ this.up(e); return; }
    if(!this.touches.has(e.pointerId)) return;
    this.touches.delete(e.pointerId); this.cancelLong();
    if(this.pinch){ if(this.touches.size === 0) this.pinch = null; return; }
    if(cancel){ this.drag = null; this.draw(); return; }
    this.up(e);
  }
  zoomBy(k){ const r = this.cv.getBoundingClientRect(), mx = r.width/2, my = r.height/2, s = Math.min(2.5, Math.max(.4, this.view.s*k));
    this.view.ox = mx - (mx-this.view.ox)*s/this.view.s; this.view.oy = my - (my-this.view.oy)*s/this.view.s; this.view.s = s; this.draw(); }
  // Fit the whole circuit in view (or reset the view when the board is empty).
  fit(){ const cs = this.ckt.comps; if(!cs.length){ this.view = { ox:60, oy:40, s:1 }; this.draw(); return; }
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; cs.forEach(c => { const g = geom(c.type,c.rot); x0=Math.min(x0,c.x-30); y0=Math.min(y0,c.y-30); x1=Math.max(x1,c.x+g.w+30); y1=Math.max(y1,c.y+g.h+40); });
    const r = this.cv.getBoundingClientRect(), s = Math.min(2.5, Math.max(.4, Math.min(r.width/(x1-x0), r.height/(y1-y0))));
    this.view = { s, ox: (r.width - (x1-x0)*s)/2 - x0*s, oy: (r.height - (y1-y0)*s)/2 - y0*s }; this.draw(); }
  // Ask for a label; signal labels (switches, buttons, clocks, probes, LEDs) must be unique so the timing diagram,
  // truth table and experiment checker can tell them apart.
  rename(c){ if(!c || !c.type) return; const def = DEFS[c.type];
    const v = prompt('Label for '+def.name+' (up to 10 characters)', c.label); if(v===null) return;
    const t = v.trim().slice(0,10), sig = ['SW','BTN','CLK','PROBE','LED'];
    if(t && sig.includes(c.type)){ const clash = this.ckt.comps.find(o => o!==c && sig.includes(o.type) && o.label===t);
      if(clash){ alert('"'+t+'" is already the label of a '+DEFS[clash.type].name+'. Signal labels must be unique.'); return; } }
    c.label = t; this.ckt.update(); }
  arm(type){ this.armed = this.armed===type ? null : type; this.sel = null; this.onArm(this.armed); this.draw(); }

  hitPin(p){
    for(const c of this.ckt.comps){ const d = DEFS[c.type];
      for(let i=0;i<d.outs.length;i++){ const q = pinPos(c,'out',i); if(Math.hypot(q.x-p.x,q.y-p.y) < this.hitR) return { c, side:'out', pin:i }; }
      for(let i=0;i<d.ins.length;i++){ const q = pinPos(c,'in',i); if(Math.hypot(q.x-p.x,q.y-p.y) < this.hitR) return { c, side:'in', pin:i }; } }
    return null;
  }
  hitComp(p){ for(let k=this.ckt.comps.length-1;k>=0;k--){ const c=this.ckt.comps[k], g=geom(c.type,c.rot); if(p.x>=c.x&&p.x<=c.x+g.w&&p.y>=c.y&&p.y<=c.y+g.h) return c; } return null; }
  hitWire(p){
    for(const w of this.ckt.wires){ const pts = this.route(w); for(let i=0;i<pts.length-1;i++){ if(distSeg(p, pts[i], pts[i+1]) < 6) return { w, seg:i }; } } return null;
  }
  // Tee handle sits mid-way along the wire's adjustable segment.
  teePos(w){ const pts = this.route(w), k = Math.floor((pts.length-2)/2); return { x:(pts[k].x+pts[k+1].x)/2, y:(pts[k].y+pts[k+1].y)/2 }; }
  route(w){
    const ca = this.ckt.comp(w.from.c), cb = this.ckt.comp(w.to.c);
    const a = pinPos(ca,'out',w.from.pin), b = pinPos(cb,'in',w.to.pin);
    const below = Math.max(ca.y+geom(ca.type,ca.rot).h, cb.y+geom(cb.type,cb.rot).h) + GRID;
    return routePts(a,b,below,w,pinDir(ca,'out',w.from.pin),pinDir(cb,'in',w.to.pin));
  }
  down(e){
    const p = this.world(e); this.mouse = p;
    if(e.button === 2){ const c = this.hitComp(p); if(c){ this.ckt.remove(c); this.sel=null; } else { const hw=this.hitWire(p); if(hw) this.ckt.removeWire(hw.w); } return; }
    if(this.armed){ const c = this.ckt.add(this.armed, this.snap(p.x)-20, this.snap(p.y)-20); this.sel = c; if(!e.shiftKey){ this.armed=null; this.onArm(null); } this.draw(); return; }
    if(this.sel && !this.sel.type){ const t = this.teePos(this.sel); if(Math.hypot(t.x-p.x,t.y-p.y) < 8){ this.drag = { kind:'wire', from:{ c:this.ckt.comp(this.sel.from.c), side:'out', pin:this.sel.from.pin }, tee:true }; return; } }
    const pin = this.hitPin(p);
    if(pin){ this.drag = { kind:'wire', from:pin }; return; }
    const c = this.hitComp(p);
    if(c){ this.sel = c; this.drag = { kind:'comp', c, dx:p.x-c.x, dy:p.y-c.y, moved:false };
      if(DEFS[c.type].press){ DEFS[c.type].press(c.state, true); this.ckt.update(); } this.draw(); return; }
    const hw = this.hitWire(p); if(hw){ this.sel = hw.w; this.drag = { kind:'seg', w:hw.w, seg:hw.seg, n:this.route(hw.w).length, kindV: pinDir(this.ckt.comp(hw.w.from.c),'out',hw.w.from.pin).dy!==0 }; this.draw(); return; }
    this.sel = null; this.drag = { kind:'pan', x:e.clientX, y:e.clientY, ox:this.view.ox, oy:this.view.oy }; this.draw();
  }
  move(e){
    const p = this.world(e); this.mouse = p;
    if(!this.drag){ const h = this.hitPin(p); if((h&&h.c)!==(this.hover&&this.hover.c) || (h&&h.pin)!==(this.hover&&this.hover.pin) || !!h!==!!this.hover){ this.hover=h; this.draw(); } else if(this.armed) this.draw(); return; }
    const d = this.drag;
    if(d.kind==='pan'){ this.view.ox = d.ox + e.clientX-d.x; this.view.oy = d.oy + e.clientY-d.y; }
    else if(d.kind==='comp'){ const nx=this.snap(p.x-d.dx), ny=this.snap(p.y-d.dy); if(nx!==d.c.x||ny!==d.c.y){ d.c.x=nx; d.c.y=ny; d.moved=true; } }
    else if(d.kind==='wire'){ this.hover = this.hitPin(p); }
    else if(d.kind==='seg'){ const w = d.w, gx = this.snap(p.x), gy = this.snap(p.y);
      if(d.n===4 || d.n===2){ w.mx = gx; }
      else if(d.n===5){ if(d.kindV) w.my = gy; else w.mx = gx; }
      else { if(d.seg===1) w.ax = gx; else if(d.seg===2) w.my = gy; else if(d.seg===3) w.bx = gx; } }
    this.draw();
  }
  up(e){
    const d = this.drag; this.drag = null; if(!d) return;
    if(d.kind==='comp'){ const def = DEFS[d.c.type]; if(def.press){ def.press(d.c.state,false); this.ckt.update(); } else if(!d.moved && def.click){ def.click(d.c.state); this.ckt.update(); }
      else if(d.moved) this.ckt.emit(); }   // v1.0: a moved part is saved (and undoable) like any other edit
    if(d.kind==='seg'){ this.ckt.emit(); }
    if(d.kind==='wire'){ const pw = this.world(e), t = this.hitPin(pw);
      if(t && t.side !== d.from.side){ const o = d.from.side==='out'?d.from:t, i = d.from.side==='in'?d.from:t; this.ckt.connect({c:o.c.id,pin:o.pin},{c:i.c.id,pin:i.pin}); }
      else if(!t && d.from.side==='in'){ const hw = this.hitWire(pw); if(hw) this.ckt.connect({c:hw.w.from.c,pin:hw.w.from.pin},{c:d.from.c.id,pin:d.from.pin}); } }
    this.draw();
  }
  dbl(e){ const c = this.hitComp(this.world(e)); if(c) this.rename(c); }
  wheel(e){ e.preventDefault(); const r=this.cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top; const k = e.deltaY<0?1.1:1/1.1; const s = Math.min(2.5, Math.max(.4, this.view.s*k));
    this.view.ox = mx - (mx-this.view.ox)*s/this.view.s; this.view.oy = my - (my-this.view.oy)*s/this.view.s; this.view.s = s; this.draw(); }
  key(e){ if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(!this.cv.offsetParent) return;   // v1.0: the board's keys act only while the Sim page is showing
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if((e.key==='Delete'||e.key==='Backspace') && this.sel){ if(this.sel.type) this.ckt.remove(this.sel); else this.ckt.removeWire(this.sel); this.sel=null; this.draw(); }
    if((e.key==='r'||e.key==='R') && this.sel && this.sel.type){ this.ckt.rotate(this.sel, e.shiftKey?-1:1); }
    if((e.key==='c'||e.key==='C') && this.sel && this.sel.type==='LED'){ const ks = Object.keys(LED_COLORS); this.ckt.setColor(this.sel, ks[(ks.indexOf(this.sel.color)+1)%ks.length]); }
    if(e.key.startsWith('Arrow') && this.sel && this.sel.type){ e.preventDefault(); const st = e.shiftKey ? GRID*5 : GRID; const c = this.sel;
      if(e.key==='ArrowUp') c.y -= st; else if(e.key==='ArrowDown') c.y += st; else if(e.key==='ArrowLeft') c.x -= st; else if(e.key==='ArrowRight') c.x += st; this.ckt.emit(); }
    if(e.key==='Escape'){ this.armed=null; this.sel=null; this.onArm(null); this.draw(); } }

  /* ---- drawing ---- */
  draw(){
    const ctx = this.ctx, W = this.cv.width/devicePixelRatio, H = this.cv.height/devicePixelRatio, v = this.view;
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,H);
    ctx.fillStyle = css('--inset'); ctx.fillRect(0,0,W,H);
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    if(this.showGrid){ ctx.fillStyle = css('--line'); const x0=Math.floor(-v.ox/v.s/GRID)*GRID, y0=Math.floor(-v.oy/v.s/GRID)*GRID, x1=x0+W/v.s+GRID, y1=y0+H/v.s+GRID;
      for(let x=x0;x<x1;x+=GRID) for(let y=y0;y<y1;y+=GRID) ctx.fillRect(x-.75,y-.75,1.5,1.5); }
    const HI = css('--hi'), LO = css('--mut2'), TXT = css('--txt'), MUT = css('--mut'), ACC = css('--acc'), L2 = css('--line2'), OPEN = css('--open') || ACC;
    ctx.lineJoin='round'; ctx.lineCap='round';
    for(const w of this.ckt.wires){ const s = this.ckt.comp(w.from.c), val = s.out[w.from.pin]; const pts = this.route(w);
      ctx.beginPath(); pts.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));
      if(w===this.sel){ ctx.strokeStyle = ACC; ctx.lineWidth = 6; ctx.globalAlpha=.35; ctx.stroke(); ctx.globalAlpha=1; }
      ctx.strokeStyle = this.wireColor ? (val?HI:LO) : MUT; ctx.lineWidth = val?3:2.2; ctx.stroke(); }
    if(this.sel && !this.sel.type && this.ckt.wires.includes(this.sel)){ const t = this.teePos(this.sel); ctx.beginPath(); ctx.arc(t.x,t.y,5,0,7); ctx.fillStyle = ACC; ctx.fill(); ctx.strokeStyle = css('--bg'); ctx.lineWidth = 1.5; ctx.stroke(); }
    if(this.drag && this.drag.kind==='wire' && this.mouse){ const f=this.drag.from, a = pinPos(f.c,f.side,f.pin); ctx.setLineDash([6,5]); ctx.strokeStyle=ACC; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(this.mouse.x,this.mouse.y); ctx.stroke(); ctx.setLineDash([]); }
    for(const c of this.ckt.comps) this.drawComp(ctx, c, { HI, LO, TXT, MUT, ACC, L2, OPEN });
    if(this.armed && this.mouse){ ctx.globalAlpha=.45; this.drawComp(ctx, { type:this.armed, x:this.snap(this.mouse.x)-20, y:this.snap(this.mouse.y)-20, rot:DEFS[this.armed].rot0||0, label:'', state:DEFS[this.armed].init?DEFS[this.armed].init():{}, out:DEFS[this.armed].outs.map(()=>0), inv:DEFS[this.armed].ins.map(()=>0) }, { HI, LO, TXT, MUT, ACC, L2, OPEN }); ctx.globalAlpha=1; }
  }
  drawComp(ctx, c, C){
    const d = DEFS[c.type], W = geom(c.type, c.rot), { w, h } = geom0(c.type), isSel = c===this.sel, mono = css('--mono');
    ctx.save(); ctx.translate(c.x + W.w/2, c.y + W.h/2); ctx.rotate((c.rot||0) * Math.PI/2);
    const x = -w/2, y = -h/2, lp = (side,i) => { const q = localPin(c,side,i); return { x:x+q.x, y:y+q.y }; };
    for(let i=0;i<d.ins.length;i++){ const p = lp('in',i), driven = this.ckt.inputDriven(c,i); ctx.strokeStyle = driven ? (c.inv[i]?C.HI:C.LO) : C.OPEN; ctx.lineWidth=2; if(!driven) ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(x,p.y); ctx.stroke(); ctx.setLineDash([]); this.pinDot(ctx, p, c, 'in', i, C, driven); }
    for(let i=0;i<d.outs.length;i++){ const p = lp('out',i); ctx.strokeStyle = c.out[i]?C.HI:C.LO; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x+w,p.y); ctx.lineTo(p.x,p.y); ctx.stroke(); this.pinDot(ctx, p, c, 'out', i, C, true); }
    ctx.lineWidth = 2; ctx.strokeStyle = isSel ? C.ACC : C.TXT; ctx.fillStyle = css('--bg3');
    const sh = d.shape, cy = y + h/2;
    if(['and','nand','or','nor','xor','xnor','not'].includes(sh)) drawGate(ctx, sh, x, y, w, h, C, c.out[0]);
    else if(sh==='sw'||sh==='btn') { rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); const on = c.state.on; ctx.fillStyle = on?C.HI:css('--inset'); if(sh==='sw'){ rr(ctx,x+8,y+14,24,12,6); ctx.fill(); ctx.strokeStyle=C.L2; ctx.stroke(); ctx.fillStyle=on?'#0b2e1a':C.LO; ctx.beginPath(); ctx.arc(on?x+26:x+14,y+20,4,0,7); ctx.fill(); } else { ctx.beginPath(); ctx.arc(x+20,y+20,9,0,7); ctx.fill(); ctx.strokeStyle=C.L2; ctx.stroke(); } }
    else if(sh==='clk'){ rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c.out[0]?C.HI:C.MUT; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x+7,y+26); ctx.lineTo(x+13,y+26); ctx.lineTo(x+13,y+14); ctx.lineTo(x+20,y+14); ctx.lineTo(x+20,y+26); ctx.lineTo(x+27,y+26); ctx.lineTo(x+27,y+14); ctx.lineTo(x+33,y+14); ctx.stroke(); }
    else if(sh==='const'){ rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.out[0]?C.HI:C.MUT; ctx.font='bold 18px '+mono; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(d.name, x+w/2, cy+1); }
    else if(sh==='vcc'){ ctx.strokeStyle = isSel?C.ACC:C.HI; ctx.beginPath(); ctx.moveTo(x+w,cy); ctx.lineTo(x+w-14,cy); ctx.moveTo(x+w-14,cy-12); ctx.lineTo(x+w-14,cy+12); ctx.stroke(); ctx.save(); ctx.translate(x+w-20,cy); ctx.rotate(-(c.rot||0)*Math.PI/2); ctx.fillStyle=C.HI; ctx.font='bold 10px '+mono; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('VCC',0,0); ctx.restore(); }
    else if(sh==='gnd'){ ctx.strokeStyle = isSel?C.ACC:C.MUT; ctx.beginPath(); ctx.moveTo(x+w,cy); ctx.lineTo(x+w-10,cy); ctx.moveTo(x+w-10,cy-12); ctx.lineTo(x+w-10,cy+12); ctx.moveTo(x+w-16,cy-7); ctx.lineTo(x+w-16,cy+7); ctx.moveTo(x+w-22,cy-3); ctx.lineTo(x+w-22,cy+3); ctx.stroke(); }
    else if(sh==='res'){ ctx.strokeStyle = isSel?C.ACC:C.TXT; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,cy); ctx.lineTo(x+6,cy); let px=x+6; for(let k=0;k<6;k++){ ctx.lineTo(px+2.5, cy+(k%2?6:-6)); px+=5; ctx.lineTo(px, cy); } ctx.lineTo(x+w,cy); ctx.stroke(); }
    else if(sh==='led'){ const on = ledLit(c), col = LED_COLORS[c.color] || LED_COLORS.red; ctx.beginPath(); ctx.arc(x+20,y+20,13,0,7); ctx.fillStyle = on?col:css('--inset'); if(on){ ctx.shadowColor=col; ctx.shadowBlur=18; } ctx.fill(); ctx.shadowBlur=0; if(!on){ ctx.globalAlpha=.35; ctx.fillStyle=col; ctx.fill(); ctx.globalAlpha=1; } ctx.strokeStyle = isSel?C.ACC:(on?col:C.L2); ctx.stroke();
      ctx.save(); ctx.translate(x+20,y+20); ctx.rotate(-(c.rot||0)*Math.PI/2); ctx.fillStyle = on?'#0e1116':C.MUT; ctx.font='bold 9px '+mono; ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillText('A', -7, 0); ctx.fillText('K', 7, 0); ctx.restore(); }
    else if(sh==='probe'){ const open = !this.ckt.inputDriven(c,0); if(open) ctx.setLineDash([4,3]); rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.save(); ctx.translate(x+w/2,cy+1); ctx.rotate(-(c.rot||0)*Math.PI/2); ctx.textAlign='center'; ctx.textBaseline='middle';
      if(open){ ctx.fillStyle = C.OPEN; ctx.font='bold 10px '+mono; ctx.fillText('OPEN', 0, 0); } else { ctx.fillStyle = c.inv[0]?C.HI:C.MUT; ctx.font='bold 20px '+mono; ctx.fillText(String(c.inv[0]), 0, 0); } ctx.restore(); }
    else if(sh==='seg7'){ rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); const n = c.inv[0]|c.inv[1]<<1|c.inv[2]<<2|c.inv[3]<<3; drawSeg(ctx, x+w/2, cy, SEG[n], C); }
    else { rr(ctx,x,y,w,h,6); ctx.fill(); ctx.stroke(); ctx.fillStyle=C.MUT; ctx.font='600 9px '+mono; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(d.name, x+w/2, y+5);
      if(d.seq){ const p = lp('in',d.seq.clk); ctx.strokeStyle=C.MUT; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,p.y-5); ctx.lineTo(x+6,p.y); ctx.lineTo(x,p.y+5); ctx.stroke(); } }
    if(this.showPinNames && !['and','nand','or','nor','xor','xnor','not','sw','btn','clk','const','led','probe','vcc','gnd','res'].includes(sh)){
      ctx.fillStyle=C.MUT; ctx.font='9px '+mono; ctx.textBaseline='middle';
      d.ins.forEach((n,i)=>{ const p=lp('in',i); ctx.textAlign='left'; ctx.fillText(n, x+(d.seq&&d.seq.clk===i?8:4), p.y); });
      d.outs.forEach((n,i)=>{ const p=lp('out',i); ctx.textAlign='right'; ctx.fillText(n, x+w-4, p.y); }); }
    ctx.restore();
    if(c.label){ ctx.fillStyle = C.ACC; ctx.font='600 12px '+mono; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(c.label, c.x+W.w/2, c.y-5); }
    if(this.ckt.unstable && d.ins.length && d.outs.length){ ctx.fillStyle=css('--red'); ctx.font='9px '+mono; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('~', c.x+W.w/2, c.y+W.h+2); }
  }
  // Pin marker. Driven: filled dot, HIGH/LOW colored. Open (undriven input): hollow amber ring — reads 0 by convention (R-1) but is visibly unconnected.
  pinDot(ctx, p, c, side, i, C, driven){
    const hov = this.hover && this.hover.c===c && this.hover.side===side && this.hover.pin===i;
    ctx.beginPath(); ctx.arc(p.x,p.y,hov?5:driven?3.2:4,0,7);
    const val = side==='in'?c.inv[i]:c.out[i];
    ctx.fillStyle = hov ? C.ACC : driven ? (val?C.HI:css('--bg3')) : css('--inset'); ctx.fill();
    ctx.strokeStyle = hov ? C.ACC : driven ? (val ? C.HI : C.MUT) : C.OPEN; ctx.lineWidth=1.5; ctx.stroke();
  }
}
function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawGate(ctx, sh, x, y, w, h, C, out){
  const inv = sh==='nand'||sh==='nor'||sh==='xnor'||sh==='not', bw = inv ? w-8 : w, cy = y+h/2;
  ctx.beginPath();
  if(sh==='and'||sh==='nand'){ const r = Math.min(h/2, bw*.6); ctx.moveTo(x,y); ctx.lineTo(x+bw-r,y); ctx.arc(x+bw-r,cy,r,-Math.PI/2,Math.PI/2); ctx.lineTo(x,y+h); ctx.closePath(); }
  else if(sh==='not'){ ctx.moveTo(x,y+2); ctx.lineTo(x+bw,cy); ctx.lineTo(x,y+h-2); ctx.closePath(); }
  else { const xo = (sh==='xor'||sh==='xnor') ? 8 : 0; ctx.moveTo(x+xo,y); ctx.quadraticCurveTo(x+bw*.7,y,x+bw,cy); ctx.quadraticCurveTo(x+bw*.7,y+h,x+xo,y+h); ctx.quadraticCurveTo(x+xo+16,cy,x+xo,y); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  if(sh==='xor'||sh==='xnor'){ ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+16,cy,x,y+h); ctx.stroke(); }
  if(inv){ ctx.beginPath(); ctx.arc(x+bw+4,cy,4,0,7); ctx.fillStyle = out?C.HI:css('--inset'); ctx.fill(); ctx.stroke(); }
}
function drawSeg(ctx, cx, cy, m, C){
  const L=14, t=3, segs=[[-L/2,-L-2,L,t],[L/2-1,-L-1,t,L],[L/2-1,1,t,L],[-L/2,L,L,t],[-L/2-2,1,t,L],[-L/2-2,-L-1,t,L],[-L/2,-1,L,t]];
  segs.forEach((s,i)=>{ ctx.fillStyle = (m>>i)&1 ? C.HI : css('--inset'); ctx.fillRect(cx+s[0],cy+s[1],s[2],s[3]); });
}
/* Orthogonal route from output pin a to input pin b. da/db are the pins' outward directions.
   Both horizontal & facing: Z route (adjustable mx). Both horizontal, not facing: wrap below (ax/my/bx).
   One vertical: L route via a single adjustable run. Both vertical: U route via my. */
function routePts(a,b,below,w,da,db){
  w = w || {}; da = da || {dx:1,dy:0}; db = db || {dx:-1,dy:0};
  const S = 12;
  const a1 = { x:a.x+da.dx*S, y:a.y+da.dy*S }, b1 = { x:b.x+db.dx*S, y:b.y+db.dy*S };
  if(da.dy===0 && db.dy===0){
    const facing = da.dx*(b.x-a.x) >= 24 && db.dx*(a.x-b.x) >= 24;
    if(facing){ if(a.y===b.y) return [a,b]; let mx = w.mx ?? Math.round((a.x+b.x)/2); const lo = Math.min(a.x+da.dx*8, b.x+db.dx*8), hi = Math.max(a.x+da.dx*8, b.x+db.dx*8); mx = Math.max(lo, Math.min(hi, mx)); return [a,{x:mx,y:a.y},{x:mx,y:b.y},b]; }
    const my = w.my ?? Math.round(below/GRID)*GRID, ax = w.ax ?? a1.x, bx = w.bx ?? b1.x;
    return [a,{x:ax,y:a.y},{x:ax,y:my},{x:bx,y:my},{x:bx,y:b.y},b];
  }
  if(da.dy!==0 && db.dy===0){ const my = w.my ?? b.y; return [a,{x:a.x,y:my},{x:b1.x,y:my},b1,b]; }
  if(da.dy===0 && db.dy!==0){ const mx = w.mx ?? b.x; return [a,a1,{x:mx,y:a1.y},{x:mx,y:b.y},b]; }
  const my = w.my ?? Math.round((a1.y+b1.y)/2/GRID)*GRID;
  return [a,a1,{x:a1.x,y:my},{x:b1.x,y:my},b1,b];
}
function distSeg(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy||1; let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
window.DLB.Board = Board;
})();
