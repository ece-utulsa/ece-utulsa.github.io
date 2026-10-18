/* Digital Logic Breadboard — board canvas: drawing + pointer interaction.
   Pointer Events, so mouse, pen and touch all work (tablets, touch Chromebooks). A finger gets a larger pin
   target; two fingers pan and pinch-zoom; a long press on a part or wire removes it (the touch right-click).
   Area mode (pickArea) turns the next drag into a selection box; the parts inside go to a callback (Make subsystem).
   Drawing is requested, not done at once: requestDraw() coalesces every request in a frame into one draw (CQ-DL-004). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — view, gestures, zoom, routing, stroke widths, 7-segment patterns, part glyph geometry
   2. Helpers          — rr, uprightText, distSeg, routePts
   3. Board            — construction
      3.1 Draw scheduling   — requestDraw, resize
      3.2 View              — pointer to board coordinates, zoom, fit
      3.3 Selection and editing — select, rename, arm, area mode, remove, wire
      3.4 Hit tests         — pin, part, wire, tee handle, wire route
      3.5 Pointer routing   — mouse, pen and touch: pinch, double tap, long press
      3.6 Mouse / pen logic — press, move, release, double click, wheel
      3.7 Keyboard          — Delete, rotate, LED colour, nudge, Escape
      3.8 Drawing           — board, parts, pin markers
   4. Part glyphs      — drawGate, drawSeg and one draw function per part shape (SHAPES table)
   5. Export           — window.DLB.Board
   ============================================================ */
(function(){
const { DEFS, LED_COLORS, ledLit, GRID, PIN_LEN, LABEL_MAX, snap, geom, geom0, localPin, pinPos, pinDir, colors } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const VIEW0 = { ox: 60, oy: 40, s: 1 };   // initial / empty-board view origin (px) and scale
const HIT_R_MOUSE = 8, HIT_R_TOUCH = 14;   // pin hit radius (px) for a mouse and for a finger
const DOUBLE_TAP_MS = 350, DOUBLE_TAP_PX = 24;   // a second tap this soon and this close renames
const LONG_PRESS_MS = 650, LONG_PRESS_SLOP_PX = 10;   // hold this long without moving this far to remove
const ZOOM_MIN = .4, ZOOM_MAX = 2.5, WHEEL_STEP = 1.1;   // view scale limits; one wheel notch
const FIT_MARGIN = 30, FIT_MARGIN_BOTTOM = 40;   // space kept around the circuit by Fit (labels sit above parts)
const WIRE_HIT_PX = 6;           // a click this close to a wire selects it
const TEE_HIT_PX = 8, TEE_R = 5; // tee-off handle: hit radius and drawn radius
const TEE_OFFSET = 16;           // the handle sits this far off the wire, so dragging the wire itself still moves it
const PLACE_OFFSET = 20;         // a placed part's corner sits this far up-left of the pointer (half a small part)
const NUDGE_BIG = 5;             // Shift+arrow nudges this many grid steps
const ROUTE_STUB = 12;           // a wire leaves a pin straight for this long before turning
const ROUTE_FACING_MIN = 24;     // pins at least this far apart, facing each other, get a Z route
const ROUTE_CLAMP = 8;           // a Z route's vertical run stays this far out from either pin
const ROUTE_CLEAR = PIN_LEN + ROUTE_STUB;   // a run moved round a body clears its side pins by a stub (DL-018)
// Route shapes by point count (see routePts), and the segments of a wrap route that a drag moves.
const ROUTE_PTS = { straight: 2, z: 4, l: 5 };   // anything longer is a wrap (6 points)
const WRAP_SEG = { ax: 1, my: 2, bx: 3 };
const GRID_DOT = 1.5;            // grid dot size
const WIRE_W_HI = 3, WIRE_W_LO = 2.2, WIRE_W_DRAG = 2;   // wire stroke widths
const SEL_HALO_W = 6, SEL_HALO_ALPHA = .35;   // selected wire halo
const AREA_FILL_ALPHA = .08;     // selection box fill (Make subsystem)
const ARMED_ALPHA = .45;         // ghost of the part being placed
const STROKE = 2, THIN = 1.5;    // body / pin strokes, and fine strokes (markers, pin dots)
const DASH_DRAG = [6,5], DASH_OPEN = [3,3], DASH_PROBE_OPEN = [4,3];
const CORNER_R = 6;              // rounded body corner radius
const PIN_DOT_R = 3.2, PIN_OPEN_R = 4, PIN_HOVER_R = 5;   // pin markers: driven, open, under the pointer
const LABEL_GAP = 5;             // a part label sits this far above the body (and above any pins on its top edge)
const FONT_LABEL = 12, FONT_SMALL = 9, FONT_PROBE = 20, FONT_OPEN = 10, FONT_CONST = 18, FONT_VCC = 10;
const BLOCK_TITLE_Y = 5;         // block name offset from the top edge
const CLK_MARK_H = 5, CLK_MARK_W = 6;   // ▷ clock-input marker on edge-triggered blocks
const PIN_NAME_INSET = 4, PIN_NAME_INSET_CLK = 8;   // pin name offset from the body edge (past the ▷ on CK)
const UNSTABLE_GAP = 2;          // ~ marker below a part when the board is UNSTABLE
const KNOB_ON = '#0b2e1a';       // dark knob on a switch that is on
// 7-segment patterns, bit 0..6 = segments a..g: the 7448 decoder's function table. 0-9 are the decimal digits, with
// 6 and 9 drawn as the 7448 draws them, without tails (6 = c d e f g, 9 = a b c f g; principal ruling 2026-10-17,
// DL-015); 10-15 are its non-digit patterns (ruling 2026-10-11, replacing hex A-F): 10 ⊏-like (d e g), 11 (c d g),
// 12 (b f g), 13 (a d f g), 14 (d e f g), 15 blank.
const SEG_7448 = [0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7c,0x07,0x7f,0x67, 0x58,0x4c,0x62,0x69,0x78,0x00];
const SEG_DP_BIT = 7;            // bit of the decimal point in a segment mask (after a..g)
// Segment rectangles [x, y, w, h] around the display centre, a..g, for segment length SEG_L and thickness SEG_T.
const SEG_L = 14, SEG_T = 3;
const SEG_BIG = 2;               // 7-SEG (all segments exposed) draws its digit this many times larger
const SEG_BIG_DX = 6;            // ... shifted right of centre, clear of the pin names
const SEG_DP_R = 2.5;            // decimal point radius (unscaled)
const SEG_RECTS = [[-SEG_L/2,-SEG_L-2,SEG_L,SEG_T],[SEG_L/2-1,-SEG_L-1,SEG_T,SEG_L],[SEG_L/2-1,1,SEG_T,SEG_L],[-SEG_L/2,SEG_L,SEG_L,SEG_T],
                   [-SEG_L/2-2,1,SEG_T,SEG_L],[-SEG_L/2-2,-SEG_L-1,SEG_T,SEG_L],[-SEG_L/2,-1,SEG_L,SEG_T]];
// Gate outline: AND nose radius as a fraction of body width; OR/XOR curve control; XOR back offset; bubble radius.
const GATE = { andNose: .6, orCtrl: .7, backDepth: 16, xorGap: 8, bubbleR: 4, notInset: 2 };
// Small-part glyphs, in body coordinates (the body is a SMALL_PART square, origin at its top-left corner).
const SW_G = { track: { x: 8, y: 14, w: 24, h: 12 }, knobY: 20, knobOff: 14, knobOn: 26, knobR: 4 };
const BTN_G = { c: 20, r: 9 };
const CLK_WAVE = [[7,26],[13,26],[13,14],[20,14],[20,26],[27,26],[27,14],[33,14]];
const VCC_G = { bar: 14, half: 12, text: 20 };
const GND_G = { bars: [[10,12],[16,7],[22,3]] };   // [distance from the pin edge, half-length]
const RES_G = { lead: 6, teeth: 6, amp: 6, pitch: 5 };
const LED_G = { c: 20, r: 13, glow: 18, offAlpha: .35 };
// Shapes drawn without pin names (their pins are obvious or unnamed).
const NO_PIN_NAMES = ['and','nand','or','nor','xor','xnor','not','sw','btn','clk','const','led','probe','vcc','gnd','res'];
const GATE_SHAPES = ['and','nand','or','nor','xor','xnor','not'];
const TAP_RENAME_EXEMPT = ['SW','BTN'];   // students tap these quickly: a double tap toggles, never renames
// ── END CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────────
// Rounded-rectangle path.
function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
// Draw text upright at (x, y) inside a part rotated by rot quarter turns: paint(ctx) draws around the origin.
function uprightText(ctx, x, y, rot, font, fill, paint){
  ctx.save(); ctx.translate(x, y); ctx.rotate(-(rot||0)*Math.PI/2);
  ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; paint(ctx); ctx.restore();
}
// Distance from point p to segment ab.
function distSeg(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy||1; let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
/* Orthogonal route from output pin a to input pin b. da/db are the pins' outward directions.
   Both horizontal & facing: Z route (adjustable mx). Both horizontal, not facing: wrap below (ax/my/bx).
   One vertical: L route via a single adjustable run; into a vertical pin from its far side (e.g. into a MUX select
   pin from below), wrap round via ax / my so the wire does not cross the body: when the default run ax would pass
   through the destination's body or its side pins (box {x0, y0, x1, y1}), it moves past the body's side and pins,
   in the direction the wire leaves its pin, or on the source's own side when the source is level with the body
   (DL-018); a run the student has dragged (w.ax set) stays where it is. Both vertical: U route via my. */
function routePts(a,b,below,w,da,db,body){
  w = w || {}; da = da || {dx:1,dy:0}; db = db || {dx:-1,dy:0};
  const a1 = { x:a.x+da.dx*ROUTE_STUB, y:a.y+da.dy*ROUTE_STUB }, b1 = { x:b.x+db.dx*ROUTE_STUB, y:b.y+db.dy*ROUTE_STUB };
  if(da.dy===0 && db.dy===0){
    const facing = da.dx*(b.x-a.x) >= ROUTE_FACING_MIN && db.dx*(a.x-b.x) >= ROUTE_FACING_MIN;
    if(facing){ if(a.y===b.y) return [a,b]; let mx = w.mx ?? Math.round((a.x+b.x)/2);
      const lo = Math.min(a.x+da.dx*ROUTE_CLAMP, b.x+db.dx*ROUTE_CLAMP), hi = Math.max(a.x+da.dx*ROUTE_CLAMP, b.x+db.dx*ROUTE_CLAMP);
      mx = Math.max(lo, Math.min(hi, mx)); return [a,{x:mx,y:a.y},{x:mx,y:b.y},b]; }
    const my = w.my ?? snap(below), ax = w.ax ?? a1.x, bx = w.bx ?? b1.x;
    return [a,{x:ax,y:a.y},{x:ax,y:my},{x:bx,y:my},{x:bx,y:b.y},b];
  }
  if(da.dy!==0 && db.dy===0){ const my = w.my ?? b.y; return [a,{x:a.x,y:my},{x:b1.x,y:my},b1,b]; }
  if(da.dy===0 && db.dy!==0){
    if((a.y-b.y)*db.dy >= ROUTE_STUB){ const mx = w.mx ?? b.x; return [a,a1,{x:mx,y:a1.y},{x:mx,y:b.y},b]; }
    const my = w.my ?? b1.y; let ax = w.ax ?? a1.x;
    if(w.ax === undefined && body && ax > body.x0 - ROUTE_CLEAR && ax < body.x1 + ROUTE_CLEAR && Math.max(a.y, my) > body.y0 && Math.min(a.y, my) < body.y1){
      const beside = a.y > body.y0 && a.y < body.y1;   // a source level with the body goes round on its own side
      ax = (da.dx > 0) !== beside ? body.x1 + ROUTE_CLEAR : body.x0 - ROUTE_CLEAR; }
    return [a,{x:ax,y:a.y},{x:ax,y:my},{x:b.x,y:my},b1,b]; }
  const my = w.my ?? snap((a1.y+b1.y)/2);
  return [a,a1,{x:a1.x,y:my},{x:b1.x,y:my},b1,b];
}
// Keep a view scale inside the zoom limits.
const clampZoom = s => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
// ── END HELPERS ───────────────────────────────────────────────

// ── BOARD ─────────────────────────────────────────────────────
class Board {
  // Attach to a canvas and a circuit; every circuit change requests a draw.
  constructor(canvas, ckt){
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ckt = ckt;
    this.view = Object.assign({}, VIEW0); this.armed = null; this.sel = null; this.hover = null;
    this.drag = null; this.mouse = null; this.showGrid = true; this.showPinNames = true; this.wireColor = true;
    this.onArm = ()=>{}; this.onSelect = ()=>{}; this.onNotice = ()=>{}; this.onArea = ()=>{};
    this.areaCb = null;      // area mode: the next drag draws a box and passes the parts inside to areaCb
    this.areaSel = null;     // parts inside the box being dragged (drawn highlighted)
    this.frame = 0;          // pending requestAnimationFrame handle (0 = none)
    this.touches = new Map(); this.pinch = null; this.hitR = HIT_R_MOUSE; this.longT = null; this.lastTap = null;
    const ro = new ResizeObserver(()=>this.resize()); ro.observe(canvas.parentElement); this.resize();
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e=>this.pdown(e)); window.addEventListener('pointermove', e=>this.pmove(e));
    window.addEventListener('pointerup', e=>this.pup(e)); window.addEventListener('pointercancel', e=>this.pup(e, true)); canvas.addEventListener('dblclick', e=>this.dbl(e));
    canvas.addEventListener('wheel', e=>this.wheel(e), { passive:false }); canvas.addEventListener('contextmenu', e=>e.preventDefault());
    window.addEventListener('keydown', e=>this.key(e));
    ckt.onChange(()=>this.requestDraw());
  }

  // ── 3.1 DRAW SCHEDULING ───────────────────────────────────────
  // Ask for a redraw; all requests in one frame produce one draw. Skipped while the Sim page is hidden: showing it
  // again resizes and redraws the board.
  requestDraw(){ if(!this.frame) this.frame = requestAnimationFrame(()=>{ this.frame = 0; if(this.cv.offsetParent) this.draw(); }); }
  // Match the canvas backing store to its box and draw at once. The store is reallocated (and cleared) only when the
  // size changed (CQ-DL-032).
  resize(){ const r = this.cv.parentElement.getBoundingClientRect(), w = Math.max(1, Math.round(r.width*devicePixelRatio)), h = Math.max(1, Math.round(r.height*devicePixelRatio));
    if(this.cv.width !== w) this.cv.width = w; if(this.cv.height !== h) this.cv.height = h; this.cv.style.height = r.height+'px'; this.draw(); }

  // ── END 3.1 DRAW SCHEDULING ───────────────────────────────────

  // ── 3.2 VIEW ──────────────────────────────────────────────────
  // Board coordinates of a pointer event.
  world(e){ const r = this.cv.getBoundingClientRect(); return { x:(e.clientX-r.left-this.view.ox)/this.view.s, y:(e.clientY-r.top-this.view.oy)/this.view.s }; }
  // Nearest grid line.
  snap(v){ return snap(v); }
  // Set the scale to s (clamped), keeping the board point under canvas point (mx, my) fixed.
  zoomAbout(mx, my, s){ s = clampZoom(s); this.view.ox = mx - (mx-this.view.ox)*s/this.view.s; this.view.oy = my - (my-this.view.oy)*s/this.view.s; this.view.s = s; this.requestDraw(); }
  // Zoom about the canvas centre (− / + buttons).
  zoomBy(k){ const r = this.cv.getBoundingClientRect(); this.zoomAbout(r.width/2, r.height/2, this.view.s*k); }
  // Fit the whole circuit in view (or reset the view when the board is empty).
  fit(){ const cs = this.ckt.comps; if(!cs.length){ this.view = Object.assign({}, VIEW0); this.requestDraw(); return; }
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    cs.forEach(c => { const g = geom(c.type,c.rot); x0=Math.min(x0,c.x-FIT_MARGIN); y0=Math.min(y0,c.y-FIT_MARGIN); x1=Math.max(x1,c.x+g.w+FIT_MARGIN); y1=Math.max(y1,c.y+g.h+FIT_MARGIN_BOTTOM); });
    const r = this.cv.getBoundingClientRect(), s = clampZoom(Math.min(r.width/(x1-x0), r.height/(y1-y0)));
    this.view = { s, ox: (r.width - (x1-x0)*s)/2 - x0*s, oy: (r.height - (y1-y0)*s)/2 - y0*s }; this.requestDraw(); }

  // ── END 3.2 VIEW ──────────────────────────────────────────────

  // ── 3.3 SELECTION AND EDITING ─────────────────────────────────
  // Select a part, a wire, or nothing.
  select(x){ this.sel = x || null; this.onSelect(this.sel); this.requestDraw(); }
  // Ask for a label. Signal labels (switches, buttons, clocks, probes, LEDs) must be unique and not blank, so the
  // timing diagram, truth table and experiment checker can tell them apart.
  rename(c){ if(!c || !c.type) return;
    const v = prompt('Label for '+DEFS[c.type].name+' (up to '+LABEL_MAX+' characters)', c.label); if(v===null) return;
    const why = this.ckt.setLabel(c, v.trim().slice(0,LABEL_MAX)); if(why) alert(why); }
  // Arm a part type for placement (toggle).
  arm(type){ this.pickArea(null); this.armed = this.armed===type ? null : type; this.select(null); this.onArm(this.armed); }
  // Area mode: the next drag on the board draws a box; cb(parts) gets the parts whose centre is inside. null cancels.
  pickArea(cb){ this.areaCb = cb || null; this.areaSel = null; if(cb){ this.armed = null; this.onArm(null); this.select(null); }
    if(this.drag && this.drag.kind==='area') this.drag = null;
    this.cv.style.cursor = cb ? 'crosshair' : ''; this.onArea(!!cb); this.requestDraw(); }
  // Parts whose body centre lies inside the box with corners a and b.
  partsIn(a, b){ const x0 = Math.min(a.x,b.x), x1 = Math.max(a.x,b.x), y0 = Math.min(a.y,b.y), y1 = Math.max(a.y,b.y);
    return this.ckt.comps.filter(c => { const g = geom(c.type,c.rot), cx = c.x+g.w/2, cy = c.y+g.h/2; return cx>=x0 && cx<=x1 && cy>=y0 && cy<=y1; }); }
  // Remove a part or wire and clear the selection if it was selected.
  removeItem(x){ if(!x) return; this.ckt.removeItem(x); if(this.sel === x) this.select(null); }
  // Remove whatever is under board point p (right-click, long press).
  removeAt(p){ const c = this.hitComp(p); if(c){ this.removeItem(c); return; } const hw = this.hitWire(p); if(hw) this.removeItem(hw.w); }
  // Remove the selection (Delete key and button).
  deleteSelection(){ this.removeItem(this.sel); }
  // Wire an output to an input. An input has one driver, so an existing wire there is replaced: say so (DL-010).
  wire(from, to){
    const old = this.ckt.connect(from, to); if(!old) return;
    const c = this.ckt.comp(to.c), name = c.label ? c.label : DEFS[c.type].name;
    this.onNotice('Replaced the wire into '+name+' input '+DEFS[c.type].ins[to.pin]+' — one wire per input. Undo brings the old wire back.');
  }

  // ── END 3.3 SELECTION AND EDITING ─────────────────────────────

  // ── 3.4 HIT TESTS ─────────────────────────────────────────────
  // Pin under board point p.
  hitPin(p){
    for(const c of this.ckt.comps){ const d = DEFS[c.type];
      for(let i=0;i<d.outs.length;i++){ const q = pinPos(c,'out',i); if(Math.hypot(q.x-p.x,q.y-p.y) < this.hitR) return { c, side:'out', pin:i }; }
      for(let i=0;i<d.ins.length;i++){ const q = pinPos(c,'in',i); if(Math.hypot(q.x-p.x,q.y-p.y) < this.hitR) return { c, side:'in', pin:i }; } }
    return null;
  }
  // Topmost part under board point p.
  hitComp(p){ for(let k=this.ckt.comps.length-1;k>=0;k--){ const c=this.ckt.comps[k], g=geom(c.type,c.rot); if(p.x>=c.x&&p.x<=c.x+g.w&&p.y>=c.y&&p.y<=c.y+g.h) return c; } return null; }
  // Wire segment under board point p.
  hitWire(p){
    for(const w of this.ckt.wires){ const pts = this.route(w); for(let i=0;i<pts.length-1;i++){ if(distSeg(p, pts[i], pts[i+1]) < WIRE_HIT_PX) return { w, seg:i }; } } return null;
  }
  // Middle of the wire's adjustable segment (m) and the tee handle (t), which sits TEE_OFFSET off the wire: above a
  // horizontal segment, right of a vertical one. Off the wire, it never covers the place a student grabs to move it.
  teePos(w){ const pts = this.route(w), k = Math.floor((pts.length-2)/2), a = pts[k], b = pts[k+1], m = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
    const vertical = Math.abs(b.x-a.x) < Math.abs(b.y-a.y);
    return { x: m.x + (vertical ? TEE_OFFSET : 0), y: m.y - (vertical ? 0 : TEE_OFFSET), m }; }
  // Route points of a wire.
  route(w){
    const ca = this.ckt.comp(w.from.c), cb = this.ckt.comp(w.to.c);
    const a = pinPos(ca,'out',w.from.pin), b = pinPos(cb,'in',w.to.pin);
    const gb = geom(cb.type,cb.rot), below = Math.max(ca.y+geom(ca.type,ca.rot).h, cb.y+gb.h) + GRID;
    return routePts(a,b,below,w,pinDir(ca,'out',w.from.pin),pinDir(cb,'in',w.to.pin),{ x0:cb.x, y0:cb.y, x1:cb.x+gb.w, y1:cb.y+gb.h });
  }

  // ── END 3.4 HIT TESTS ─────────────────────────────────────────

  // ── 3.5 POINTER ROUTING ───────────────────────────────────────
  // One pointer drives the mouse logic; a second one turns the gesture into pan + pinch.
  // Pointer down: mouse goes straight through; touch tracks fingers, double tap and long press.
  pdown(e){
    if(e.pointerType === 'mouse'){ this.hitR = HIT_R_MOUSE; this.down(e); return; }
    this.hitR = HIT_R_TOUCH; this.touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    try { this.cv.setPointerCapture(e.pointerId); } catch(_){ /* pointer already gone */ }
    if(this.touches.size === 2){ this.cancelLong(); this.drag = null; const [a,b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x-b.x, a.y-b.y) || 1, cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, s:this.view.s, ox:this.view.ox, oy:this.view.oy }; this.requestDraw(); return; }
    if(this.touches.size > 2) return;
    const now = performance.now(), lt = this.lastTap, tc = this.hitComp(this.world(e));
    if(lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(lt.x-e.clientX, lt.y-e.clientY) < DOUBLE_TAP_PX && tc && !TAP_RENAME_EXEMPT.includes(tc.type)){ this.lastTap = null; this.rename(tc); return; }
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    this.down(e);
    const p = this.world(e), sx = e.clientX, sy = e.clientY;
    if(!this.armed && !this.areaCb && !this.hitPin(p) && (this.hitComp(p) || this.hitWire(p)))
      this.longT = { t: setTimeout(()=>{ this.longT = null; this.drag = null; this.removeAt(p); }, LONG_PRESS_MS), x:sx, y:sy };
  }
  // Abandon a pending long press.
  cancelLong(){ if(this.longT){ clearTimeout(this.longT.t); this.longT = null; } }
  // Pointer move: mouse goes straight through; two fingers pinch-zoom and pan.
  pmove(e){
    if(e.pointerType === 'mouse'){ this.move(e); return; }
    if(!this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(this.longT && Math.hypot(e.clientX-this.longT.x, e.clientY-this.longT.y) > LONG_PRESS_SLOP_PX) this.cancelLong();
    if(this.pinch && this.touches.size >= 2){ const [a,b] = [...this.touches.values()], P = this.pinch, r = this.cv.getBoundingClientRect();
      // zoom about the pinch's starting centre from the view it started with, then pan by how far the centre moved
      Object.assign(this.view, { s:P.s, ox:P.ox, oy:P.oy }); this.zoomAbout(P.cx - r.left, P.cy - r.top, P.s * Math.hypot(a.x-b.x, a.y-b.y) / P.d);
      this.view.ox += (a.x+b.x)/2 - P.cx; this.view.oy += (a.y+b.y)/2 - P.cy; return; }
    this.move(e);
  }
  // Pointer up / cancel.
  pup(e, cancel){
    if(e.pointerType === 'mouse'){ this.up(e); return; }
    if(!this.touches.has(e.pointerId)) return;
    this.touches.delete(e.pointerId); this.cancelLong();
    if(this.pinch){ if(this.touches.size === 0) this.pinch = null; return; }
    if(cancel){ this.drag = null; this.requestDraw(); return; }
    this.up(e);
  }

  // ── END 3.5 POINTER ROUTING ───────────────────────────────────

  // ── 3.6 MOUSE / PEN LOGIC ─────────────────────────────────────
  // Press: remove (right button), place an armed part, start a tee, a wire, a part drag, a segment drag or a pan.
  down(e){
    const p = this.world(e); this.mouse = p;
    if(e.button === 2){ if(this.areaCb) this.pickArea(null); else this.removeAt(p); return; }
    if(this.areaCb){ this.drag = { kind:'area', a:p, b:p }; this.areaSel = new Set(); return; }
    if(this.armed){ const why = this.ckt.addProblem(this.armed); if(why){ this.onNotice(why); return; }   // SEC-DL-016
      const c = this.ckt.add(this.armed, this.snap(p.x)-PLACE_OFFSET, this.snap(p.y)-PLACE_OFFSET); this.select(c); if(!e.shiftKey){ this.armed=null; this.onArm(null); } return; }
    if(this.sel && !this.sel.type){ const t = this.teePos(this.sel); if(Math.hypot(t.x-p.x,t.y-p.y) < TEE_HIT_PX){ this.drag = { kind:'wire', from:{ c:this.ckt.comp(this.sel.from.c), side:'out', pin:this.sel.from.pin } }; return; } }
    const pin = this.hitPin(p);
    if(pin){ this.drag = { kind:'wire', from:pin }; return; }
    const c = this.hitComp(p);
    if(c){ this.select(c); this.drag = { kind:'comp', c, dx:p.x-c.x, dy:p.y-c.y, moved:false };
      if(DEFS[c.type].press){ DEFS[c.type].press(c.state, true); this.ckt.update(); } return; }
    const hw = this.hitWire(p); if(hw){ this.select(hw.w); this.drag = { kind:'seg', w:hw.w, seg:hw.seg, n:this.route(hw.w).length, kindV: pinDir(this.ckt.comp(hw.w.from.c),'out',hw.w.from.pin).dy!==0, moved:false }; return; }
    this.select(null); this.drag = { kind:'pan', x:e.clientX, y:e.clientY, ox:this.view.ox, oy:this.view.oy };
  }
  // Move: hover highlight over the board only (CQ-DL-016), or carry on the current drag.
  move(e){
    const d = this.drag;
    if(!d){
      if(e.target !== this.cv){ if(this.hover || this.mouse){ this.hover = null; this.mouse = null; if(this.armed) this.requestDraw(); } return; }
      const p = this.world(e); this.mouse = p;
      const h = this.hitPin(p);
      if((h&&h.c)!==(this.hover&&this.hover.c) || (h&&h.pin)!==(this.hover&&this.hover.pin) || !!h!==!!this.hover){ this.hover=h; this.requestDraw(); }
      else if(this.armed) this.requestDraw();
      return;
    }
    const p = this.world(e); this.mouse = p;
    if(d.kind==='pan'){ this.view.ox = d.ox + e.clientX-d.x; this.view.oy = d.oy + e.clientY-d.y; }
    else if(d.kind==='area'){ d.b = p; this.areaSel = new Set(this.partsIn(d.a, d.b)); }
    else if(d.kind==='comp'){ const nx=this.snap(p.x-d.dx), ny=this.snap(p.y-d.dy); if(nx!==d.c.x||ny!==d.c.y){ if(!d.moved) this.ckt.touch(); d.c.x=nx; d.c.y=ny; d.moved=true; } }
    else if(d.kind==='wire'){ this.hover = this.hitPin(p); }
    else if(d.kind==='seg'){ const w = d.w, gx = this.snap(p.x), gy = this.snap(p.y), before = [w.mx, w.my, w.ax, w.bx].join();
      const set = (k, v) => { if(w[k] !== v){   // move one route offset; the first change opens the edit
        if(!d.moved) this.ckt.touch(); d.moved = true; w[k] = v; } };
      if(d.n===ROUTE_PTS.z || d.n===ROUTE_PTS.straight) set('mx', gx);
      else if(d.n===ROUTE_PTS.l){ if(d.kindV) set('my', gy); else set('mx', gx); }
      else { if(d.seg===WRAP_SEG.ax) set('ax', gx); else if(d.seg===WRAP_SEG.my) set('my', gy); else if(d.seg===WRAP_SEG.bx) set('bx', gx); }
      if(before === [w.mx, w.my, w.ax, w.bx].join()) return; }
    this.requestDraw();
  }
  // Release: toggle / release a switch or button, commit a move, or finish a wire.
  up(e){
    const d = this.drag; this.drag = null; if(!d) return;
    if(d.kind==='comp'){ const def = DEFS[d.c.type];
      if(def.press){ def.press(d.c.state,false); this.ckt.update(); }
      else if(!d.moved && def.click){ def.click(d.c.state); this.ckt.update(); }
      if(d.moved) this.ckt.edited(); }   // a moved part is saved (and undoable) like any other edit
    if(d.kind==='seg' && d.moved) this.ckt.edited();
    if(d.kind==='area'){ const cb = this.areaCb, parts = this.partsIn(d.a, this.world(e)); this.pickArea(null); if(cb) cb(parts); }
    if(d.kind==='wire'){ const pw = this.world(e), t = this.hitPin(pw);
      if(t && t.side !== d.from.side){ const o = d.from.side==='out'?d.from:t, i = d.from.side==='in'?d.from:t; this.wire({c:o.c.id,pin:o.pin},{c:i.c.id,pin:i.pin}); }
      else if(!t && d.from.side==='in'){ const hw = this.hitWire(pw); if(hw) this.wire({c:hw.w.from.c,pin:hw.w.from.pin},{c:d.from.c.id,pin:d.from.pin}); } }
    this.requestDraw();
  }
  // Double click renames a part.
  dbl(e){ const c = this.hitComp(this.world(e)); if(c) this.rename(c); }
  // Wheel zooms about the pointer.
  wheel(e){ e.preventDefault(); const r = this.cv.getBoundingClientRect(); this.zoomAbout(e.clientX-r.left, e.clientY-r.top, this.view.s*(e.deltaY<0 ? WHEEL_STEP : 1/WHEEL_STEP)); }

  // ── END 3.6 MOUSE / PEN LOGIC ─────────────────────────────────

  // ── 3.7 KEYBOARD ──────────────────────────────────────────────
  // Board keys: Delete, R rotate, C LED colour, arrows nudge, Escape. Only while the Sim page shows.
  key(e){ if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(!this.cv.offsetParent) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    const c = this.sel && this.sel.type ? this.sel : null;
    if((e.key==='Delete'||e.key==='Backspace') && this.sel) this.deleteSelection();
    if((e.key==='r'||e.key==='R') && c) this.ckt.rotate(c, e.shiftKey?-1:1);
    if((e.key==='c'||e.key==='C') && c && c.type==='LED'){ const ks = Object.keys(LED_COLORS); this.ckt.setColor(c, ks[(ks.indexOf(c.color)+1)%ks.length]); }
    if(e.key.startsWith('Arrow') && c){ e.preventDefault(); const st = e.shiftKey ? GRID*NUDGE_BIG : GRID; this.ckt.touch();
      if(e.key==='ArrowUp') c.y -= st; else if(e.key==='ArrowDown') c.y += st; else if(e.key==='ArrowLeft') c.x -= st; else if(e.key==='ArrowRight') c.x += st; this.ckt.edited(); }
    if(e.key==='Escape'){ this.armed=null; this.onArm(null); this.select(null); this.pickArea(null); } }

  // ── END 3.7 KEYBOARD ──────────────────────────────────────────

  // ── 3.8 DRAWING ───────────────────────────────────────────────
  // Draw the whole board: grid, wires, tee handle, wire being dragged, parts, part being placed.
  draw(){
    const ctx = this.ctx, W = this.cv.width/devicePixelRatio, H = this.cv.height/devicePixelRatio, v = this.view, C = colors;
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,H);
    ctx.fillStyle = C.INSET; ctx.fillRect(0,0,W,H);
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    if(this.showGrid){ ctx.fillStyle = C.LINE; const x0=Math.floor(-v.ox/v.s/GRID)*GRID, y0=Math.floor(-v.oy/v.s/GRID)*GRID, x1=x0+W/v.s+GRID, y1=y0+H/v.s+GRID;
      for(let x=x0;x<x1;x+=GRID) for(let y=y0;y<y1;y+=GRID) ctx.fillRect(x-GRID_DOT/2,y-GRID_DOT/2,GRID_DOT,GRID_DOT); }
    ctx.lineJoin='round'; ctx.lineCap='round';
    for(const w of this.ckt.wires){ const val = this.ckt.comp(w.from.c).out[w.from.pin], pts = this.route(w);
      ctx.beginPath(); pts.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));
      if(w===this.sel){ ctx.strokeStyle = C.ACC; ctx.lineWidth = SEL_HALO_W; ctx.globalAlpha = SEL_HALO_ALPHA; ctx.stroke(); ctx.globalAlpha=1; }
      ctx.strokeStyle = this.wireColor ? (val?C.HI:C.LO) : C.MUT; ctx.lineWidth = val?WIRE_W_HI:WIRE_W_LO; ctx.stroke(); }
    if(this.sel && !this.sel.type && this.ckt.wires.includes(this.sel)){ const t = this.teePos(this.sel);
      ctx.strokeStyle = C.ACC; ctx.lineWidth = THIN; ctx.beginPath(); ctx.moveTo(t.m.x,t.m.y); ctx.lineTo(t.x,t.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(t.x,t.y,TEE_R,0,2*Math.PI); ctx.fillStyle = C.ACC; ctx.fill(); ctx.strokeStyle = C.BG; ctx.stroke(); }
    if(this.drag && this.drag.kind==='wire' && this.mouse){ const f=this.drag.from, a = pinPos(f.c,f.side,f.pin); ctx.setLineDash(DASH_DRAG); ctx.strokeStyle=C.ACC; ctx.lineWidth=WIRE_W_DRAG; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(this.mouse.x,this.mouse.y); ctx.stroke(); ctx.setLineDash([]); }
    for(const c of this.ckt.comps) this.drawComp(ctx, c, C);
    if(this.drag && this.drag.kind==='area'){ const { a, b } = this.drag; ctx.setLineDash(DASH_DRAG); ctx.strokeStyle = C.ACC; ctx.fillStyle = C.ACC; ctx.lineWidth = THIN;
      ctx.globalAlpha = AREA_FILL_ALPHA; ctx.fillRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y)); ctx.globalAlpha = 1;
      ctx.strokeRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y)); ctx.setLineDash([]); }
    if(this.armed && this.mouse){ const d = DEFS[this.armed]; ctx.globalAlpha = ARMED_ALPHA;
      this.drawComp(ctx, { type:this.armed, x:this.snap(this.mouse.x)-PLACE_OFFSET, y:this.snap(this.mouse.y)-PLACE_OFFSET, rot:d.rot0||0, label:'', state:d.init?d.init():{}, out:d.outs.map(()=>0), inv:d.ins.map(()=>0) }, C, true);
      ctx.globalAlpha=1; }
  }
  // Draw one part: pins, body glyph, pin names, label, UNSTABLE marker. ghost = the part being placed (not on the board).
  drawComp(ctx, c, C, ghost){
    const d = DEFS[c.type], W = geom(c.type, c.rot), { w, h } = geom0(c.type), isSel = c===this.sel || !!(this.areaSel && this.areaSel.has(c));
    ctx.save(); ctx.translate(c.x + W.w/2, c.y + W.h/2); ctx.rotate((c.rot||0) * Math.PI/2);
    const x = -w/2, y = -h/2, lp = (side,i) => { const q = localPin(c,side,i); return { x:x+q.x, y:y+q.y, ex:x+q.ex, ey:y+q.ey, top:q.dy<0 }; };
    for(let i=0;i<d.ins.length;i++){ const p = lp('in',i), driven = !ghost && this.ckt.inputDriven(c,i);
      ctx.strokeStyle = driven ? (c.inv[i]?C.HI:C.LO) : C.OPEN; ctx.lineWidth=STROKE; if(!driven) ctx.setLineDash(DASH_OPEN);
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.ex,p.ey); ctx.stroke(); ctx.setLineDash([]); this.pinDot(ctx, p, c, 'in', i, C, driven); }
    for(let i=0;i<d.outs.length;i++){ const p = lp('out',i); ctx.strokeStyle = c.out[i]?C.HI:C.LO; ctx.lineWidth=STROKE; ctx.beginPath(); ctx.moveTo(p.ex,p.ey); ctx.lineTo(p.x,p.y); ctx.stroke(); this.pinDot(ctx, p, c, 'out', i, C, true); }
    ctx.lineWidth = STROKE; ctx.strokeStyle = isSel ? C.ACC : C.TXT; ctx.fillStyle = C.BG3;
    const g = { x, y, w, h, cy: y + h/2, d, isSel, open: d.shape==='probe' && (ghost || !this.ckt.inputDriven(c,0)) };
    (SHAPES[GATE_SHAPES.includes(d.shape) ? 'gate' : d.shape] || drawBlock)(ctx, c, g, C, lp);
    if(this.showPinNames && !NO_PIN_NAMES.includes(d.shape)){
      ctx.fillStyle=C.MUT; ctx.font=FONT_SMALL+'px '+C.MONO; ctx.textBaseline='middle';
      d.ins.forEach((n,i)=>{ const p=lp('in',i);
        if(p.top){ ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(n, p.x, y+PIN_NAME_INSET); ctx.textBaseline='middle'; }
        else { ctx.textAlign='left'; ctx.fillText(n, x+(d.seq&&d.seq.clk===i?PIN_NAME_INSET_CLK:PIN_NAME_INSET), p.y); } });
      d.outs.forEach((n,i)=>{ const p=lp('out',i); ctx.textAlign='right'; ctx.fillText(n, x+w-PIN_NAME_INSET, p.y); }); }
    ctx.restore();
    if(c.label){ const up = d.ins.some((_, i) => pinDir(c,'in',i).dy < 0) || d.outs.some((_, i) => pinDir(c,'out',i).dy < 0);
      ctx.fillStyle = C.ACC; ctx.font='600 '+FONT_LABEL+'px '+C.MONO; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(c.label, c.x+W.w/2, c.y-LABEL_GAP-(up?PIN_LEN:0)); }
    if(!ghost && this.ckt.unstable && d.ins.length && d.outs.length){ ctx.fillStyle=C.RED; ctx.font=FONT_SMALL+'px '+C.MONO; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('~', c.x+W.w/2, c.y+W.h+UNSTABLE_GAP); }
  }
  // Pin marker. Driven: filled dot, HIGH/LOW colored. Open (undriven input): hollow amber ring — reads 0 by convention (R-1) but is visibly unconnected.
  pinDot(ctx, p, c, side, i, C, driven){
    const hov = this.hover && this.hover.c===c && this.hover.side===side && this.hover.pin===i;
    ctx.beginPath(); ctx.arc(p.x,p.y,hov?PIN_HOVER_R:driven?PIN_DOT_R:PIN_OPEN_R,0,2*Math.PI);
    const val = side==='in'?c.inv[i]:c.out[i];
    ctx.fillStyle = hov ? C.ACC : driven ? (val?C.HI:C.BG3) : C.INSET; ctx.fill();
    ctx.strokeStyle = hov ? C.ACC : driven ? (val ? C.HI : C.MUT) : C.OPEN; ctx.lineWidth=THIN; ctx.stroke();
  }
  // ── END 3.8 DRAWING ───────────────────────────────────────────
}
// ── END BOARD ─────────────────────────────────────────────────

// ── PART GLYPHS ───────────────────────────────────────────────
// Gate body: AND/NAND, OR/NOR, XOR/XNOR, NOT, with an output bubble on the inverting ones.
function drawGate(ctx, sh, x, y, w, h, C, out){
  const inv = sh==='nand'||sh==='nor'||sh==='xnor'||sh==='not', bw = inv ? w-2*GATE.bubbleR : w, cy = y+h/2;
  ctx.beginPath();
  if(sh==='and'||sh==='nand'){ const r = Math.min(h/2, bw*GATE.andNose); ctx.moveTo(x,y); ctx.lineTo(x+bw-r,y); ctx.arc(x+bw-r,cy,r,-Math.PI/2,Math.PI/2); ctx.lineTo(x,y+h); ctx.closePath(); }
  else if(sh==='not'){ ctx.moveTo(x,y+GATE.notInset); ctx.lineTo(x+bw,cy); ctx.lineTo(x,y+h-GATE.notInset); ctx.closePath(); }
  else { const xo = (sh==='xor'||sh==='xnor') ? GATE.xorGap : 0;
    ctx.moveTo(x+xo,y); ctx.quadraticCurveTo(x+bw*GATE.orCtrl,y,x+bw,cy); ctx.quadraticCurveTo(x+bw*GATE.orCtrl,y+h,x+xo,y+h); ctx.quadraticCurveTo(x+xo+GATE.backDepth,cy,x+xo,y); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  if(sh==='xor'||sh==='xnor'){ ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+GATE.backDepth,cy,x,y+h); ctx.stroke(); }
  if(inv){ ctx.beginPath(); ctx.arc(x+bw+GATE.bubbleR,cy,GATE.bubbleR,0,2*Math.PI); ctx.fillStyle = out?C.HI:C.INSET; ctx.fill(); ctx.stroke(); }
}
// 7-segment digit centred at (cx, cy) for segment mask m (bit 7 = decimal point, drawn only when dp is set),
// k times the normal size.
function drawSeg(ctx, cx, cy, m, C, k, dp){
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k||1, k||1);
  SEG_RECTS.forEach((s,i)=>{ ctx.fillStyle = (m>>i)&1 ? C.HI : C.INSET; ctx.fillRect(s[0],s[1],s[2],s[3]); });
  if(dp){ ctx.fillStyle = (m>>SEG_DP_BIT)&1 ? C.HI : C.INSET; ctx.beginPath(); ctx.arc(SEG_L/2+SEG_T+SEG_DP_R, SEG_L+SEG_T/2, SEG_DP_R, 0, 2*Math.PI); ctx.fill(); }
  ctx.restore();
}
// Rounded body outline, filled and stroked with the current styles.
function body(ctx, g){ rr(ctx,g.x,g.y,g.w,g.h,CORNER_R); ctx.fill(); ctx.stroke(); }
// Generic block: body, name at the top (in the middle when the top edge has pins), ▷ on the clock input.
function drawBlock(ctx, c, g, C, lp){
  body(ctx, g); ctx.fillStyle=C.MUT; ctx.font='600 '+FONT_SMALL+'px '+C.MONO; ctx.textAlign='center';
  if(g.d.top){ ctx.textBaseline='middle'; ctx.fillText(g.d.name, g.x+g.w/2, g.cy); } else { ctx.textBaseline='top'; ctx.fillText(g.d.name, g.x+g.w/2, g.y+BLOCK_TITLE_Y); }
  if(g.d.seq){ const p = lp('in',g.d.seq.clk); ctx.strokeStyle=C.MUT; ctx.lineWidth=THIN; ctx.beginPath(); ctx.moveTo(g.x,p.y-CLK_MARK_H); ctx.lineTo(g.x+CLK_MARK_W,p.y); ctx.lineTo(g.x,p.y+CLK_MARK_H); ctx.stroke(); }
}
// One draw function per part shape; anything not listed is a generic block.
const SHAPES = {
  // Logic gate.
  gate(ctx, c, g, C){ drawGate(ctx, g.d.shape, g.x, g.y, g.w, g.h, C, c.out[0]); },
  // Toggle switch: track with a knob left (off) or right (on).
  sw(ctx, c, g, C){ body(ctx, g); const on = c.state.on, T = SW_G.track;
    ctx.fillStyle = on?C.HI:C.INSET; rr(ctx,g.x+T.x,g.y+T.y,T.w,T.h,T.h/2); ctx.fill(); ctx.strokeStyle=C.L2; ctx.stroke();
    ctx.fillStyle = on?KNOB_ON:C.LO; ctx.beginPath(); ctx.arc(g.x+(on?SW_G.knobOn:SW_G.knobOff),g.y+SW_G.knobY,SW_G.knobR,0,2*Math.PI); ctx.fill(); },
  // Push button: round cap, lit while held.
  btn(ctx, c, g, C){ body(ctx, g); ctx.fillStyle = c.state.on?C.HI:C.INSET; ctx.beginPath(); ctx.arc(g.x+BTN_G.c,g.y+BTN_G.c,BTN_G.r,0,2*Math.PI); ctx.fill(); ctx.strokeStyle=C.L2; ctx.stroke(); },
  // Clock: square-wave icon, bright while the output is HIGH.
  clk(ctx, c, g, C){ body(ctx, g); ctx.strokeStyle = c.out[0]?C.HI:C.MUT; ctx.lineWidth=STROKE; ctx.beginPath();
    CLK_WAVE.forEach(([px,py],i) => i ? ctx.lineTo(g.x+px,g.y+py) : ctx.moveTo(g.x+px,g.y+py)); ctx.stroke(); },
  // Constant 1 / 0.
  const(ctx, c, g, C){ body(ctx, g); ctx.fillStyle = c.out[0]?C.HI:C.MUT; ctx.font='bold '+FONT_CONST+'px '+C.MONO; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(g.d.name, g.x+g.w/2, g.cy+1); },
  // VCC rail: bar and upright label.
  vcc(ctx, c, g, C){ const bx = g.x+g.w-VCC_G.bar; ctx.strokeStyle = g.isSel?C.ACC:C.HI; ctx.beginPath(); ctx.moveTo(g.x+g.w,g.cy); ctx.lineTo(bx,g.cy); ctx.moveTo(bx,g.cy-VCC_G.half); ctx.lineTo(bx,g.cy+VCC_G.half); ctx.stroke();
    uprightText(ctx, g.x+g.w-VCC_G.text, g.cy, c.rot, 'bold '+FONT_VCC+'px '+C.MONO, C.HI, t => t.fillText('VCC',0,0)); },
  // Ground: three shrinking bars.
  gnd(ctx, c, g, C){ ctx.strokeStyle = g.isSel?C.ACC:C.MUT; ctx.beginPath(); ctx.moveTo(g.x+g.w,g.cy); ctx.lineTo(g.x+g.w-GND_G.bars[0][0],g.cy);
    for(const [dx,half] of GND_G.bars){ ctx.moveTo(g.x+g.w-dx,g.cy-half); ctx.lineTo(g.x+g.w-dx,g.cy+half); } ctx.stroke(); },
  // Resistor zigzag.
  res(ctx, c, g, C){ ctx.strokeStyle = g.isSel?C.ACC:C.TXT; ctx.lineWidth=STROKE; ctx.beginPath(); ctx.moveTo(g.x,g.cy); ctx.lineTo(g.x+RES_G.lead,g.cy);
    let px = g.x+RES_G.lead; for(let k=0;k<RES_G.teeth;k++){ ctx.lineTo(px+RES_G.pitch/2, g.cy+(k%2?RES_G.amp:-RES_G.amp)); px+=RES_G.pitch; ctx.lineTo(px, g.cy); }
    ctx.lineTo(g.x+g.w,g.cy); ctx.stroke(); },
  // LED: glowing disc while its one input is HIGH.
  led(ctx, c, g, C){ const on = ledLit(c), col = LED_COLORS[c.color] || LED_COLORS.red, cx = g.x+LED_G.c, cy = g.y+LED_G.c;
    ctx.beginPath(); ctx.arc(cx,cy,LED_G.r,0,2*Math.PI); ctx.fillStyle = on?col:C.INSET; if(on){ ctx.shadowColor=col; ctx.shadowBlur=LED_G.glow; } ctx.fill(); ctx.shadowBlur=0;
    if(!on){ ctx.globalAlpha *= LED_G.offAlpha; ctx.fillStyle=col; ctx.fill(); ctx.globalAlpha /= LED_G.offAlpha; } ctx.strokeStyle = g.isSel?C.ACC:(on?col:C.L2); ctx.stroke(); },
  // Logic probe: 1 / 0, or OPEN with a dashed outline when its input has no wire (DL-006).
  probe(ctx, c, g, C){ if(g.open) ctx.setLineDash(DASH_PROBE_OPEN); body(ctx, g); ctx.setLineDash([]);
    if(g.open) uprightText(ctx, g.x+g.w/2, g.cy+1, c.rot, 'bold '+FONT_OPEN+'px '+C.MONO, C.OPEN, t => t.fillText('OPEN', 0, 0));
    else uprightText(ctx, g.x+g.w/2, g.cy+1, c.rot, 'bold '+FONT_PROBE+'px '+C.MONO, c.inv[0]?C.HI:C.MUT, t => t.fillText(String(c.inv[0]), 0, 0)); },
  // 7-segment display: 7448 patterns for the 4-bit code on D3..D0.
  seg7(ctx, c, g, C){ body(ctx, g); drawSeg(ctx, g.x+g.w/2, g.cy, SEG_7448[c.inv[0]|c.inv[1]<<1|c.inv[2]<<2|c.inv[3]<<3], C); },
  // 7-segment display with every segment exposed: input k lights segment k (a..g, then DP).
  seg7s(ctx, c, g, C){ body(ctx, g); drawSeg(ctx, g.x+g.w/2+SEG_BIG_DX, g.cy, c.inv.reduce((m, v, k) => m | (v ? 1 << k : 0), 0), C, SEG_BIG, true); },
};
// ── END PART GLYPHS ───────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
Object.assign(window.DLB, { Board });
// ── END EXPORT ────────────────────────────────────────────────
})();
