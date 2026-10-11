/* Digital Logic Breadboard — timing diagram. One column is pushed per circuit change
   (event-stepped, not real-time); the last MAX_COLS columns are shown. Each signal part has its own
   trace, keyed by part id; a PROBE whose input is open draws a dashed mid-level line, not LOW (CQ-DL-022). */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants  — history length, layout and font sizes
   2. Timing     — record a column per change, draw the traces
   3. Export     — window.DLB.Timing
   ============================================================ */
(function(){
const { theme } = window.DLB;

// ── CONSTANTS ─────────────────────────────────────────────────
const MAX_COLS = 48;             // columns kept and shown
const HEIGHT = 200;              // canvas height (px); matches #tdiag in the page CSS
const LABEL_W = 64;              // left gutter for signal names
const TOP = 26;                  // first row starts here (caption above)
const ROW_MAX = 30;              // tallest row
const MARGIN_R = 16, MARGIN_B = 8;   // right and bottom margins
const COL_MIN = 10;              // narrowest column
const ROW_HI = 4, ROW_LO = 6;    // HIGH level sits ROW_HI below the row top, LOW level ROW_LO above its bottom
const NAME_CHARS = 7;            // signal names are cut to this many characters
const NAME_GAP = 8;              // space between a name and its trace
const FONT = 11, FONT_CAPTION = 10;
const CAPTION_DY = 12;           // caption sits this far above the first row
const EMPTY_DY = 20;             // empty-board hint offset below TOP
const MIN_WIDTH = 10;            // panel narrower than this (hidden) is not drawn
const TRACE_W = 2;               // trace stroke width
const DASH_OPEN = [3,3];         // open-probe trace
// ── END CONSTANTS ─────────────────────────────────────────────

// ── TIMING ────────────────────────────────────────────────────
class Timing {
  // Attach to a canvas and a circuit; every change records a column.
  constructor(canvas, ckt){
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ckt = ckt; this.hist = []; this.enabled = false;
    ckt.onChange(()=>this.record());
    new ResizeObserver(()=>this.draw()).observe(canvas.parentElement);
  }
  // Push a column if any signal changed since the last one.
  record(){
    const sig = this.ckt.signals(); if(!sig.length){ this.hist = []; this.draw(); return; }
    const col = {}; sig.forEach(s => col[s.id] = s.val);
    const last = this.hist[this.hist.length-1];
    if(last && Object.keys(last).length === sig.length && sig.every(s => last[s.id] === s.val)) return;   // unchanged: no new column
    this.hist.push(col); if(this.hist.length > MAX_COLS) this.hist.shift();
    this.draw();
  }
  // Forget the history and start from the present state.
  clear(){ this.hist = []; this.record(); }
  // Size the backing store to the panel; only reallocates when the size changed (CQ-DL-015).
  fitCanvas(width){
    const w = Math.round(width*devicePixelRatio), h = Math.round(HEIGHT*devicePixelRatio);
    if(this.cv.width !== w) this.cv.width = w;
    if(this.cv.height !== h) this.cv.height = h;
  }
  // Draw every signal's trace over the recorded columns.
  draw(){
    if(!this.enabled) return;
    const r = this.cv.parentElement.getBoundingClientRect(); if(r.width < MIN_WIDTH) return;
    this.fitCanvas(r.width);
    const ctx = this.ctx, W = r.width, mono = theme['--mono'];
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,HEIGHT);
    const sig = this.ckt.signals();
    const rowH = Math.min(ROW_MAX, (HEIGHT-TOP-MARGIN_B)/Math.max(1,sig.length)), n = this.hist.length, colW = Math.max(COL_MIN, (W-LABEL_W-MARGIN_R)/MAX_COLS);
    ctx.font = FONT+'px '+mono; ctx.textBaseline='middle';
    if(!sig.length){ ctx.fillStyle=theme['--mut2']; ctx.textAlign='left'; ctx.fillText('Add a SWITCH, CLOCK, LED or PROBE to see signals here.', LABEL_W, TOP+EMPTY_DY); return; }
    sig.forEach((s,k)=>{
      const y0 = TOP + k*rowH, yh = y0 + ROW_HI, yl = y0 + rowH - ROW_LO, ym = (yh+yl)/2;
      ctx.fillStyle = theme['--line']; ctx.fillRect(LABEL_W, yl+1, W-LABEL_W-MARGIN_R, 1);
      ctx.fillStyle = theme['--mut']; ctx.textAlign='right'; ctx.fillText(s.name.slice(0,NAME_CHARS), LABEL_W-NAME_GAP, ym);
      ctx.strokeStyle = s.kind==='CLK' ? theme['--acc'] : s.kind==='SW'||s.kind==='BTN' ? theme['--blue'] : theme['--hi']; ctx.lineWidth = TRACE_W;
      // y of a value (open = mid level), and the value of this signal in column i (absent = 0)
      const level = v => v === null ? ym : v ? yh : yl, at = i => { const v = this.hist[i][s.id]; return v === undefined ? 0 : v; };
      for(let i=0;i<n;i++){ const v = at(i), y = level(v), x = LABEL_W + i*colW;
        if(i > 0){ const py = level(at(i-1)); if(py !== y){ ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, y); ctx.stroke(); } }
        if(v === null) ctx.setLineDash(DASH_OPEN);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+colW, y); ctx.stroke(); ctx.setLineDash([]); }
    });
    ctx.fillStyle = theme['--mut2']; ctx.textAlign='right'; ctx.font=FONT_CAPTION+'px '+mono;
    ctx.fillText(n+' of '+MAX_COLS+' columns · one column per state change · dashed = open probe →', W-MARGIN_R, TOP-CAPTION_DY);
  }
}
// ── END TIMING ────────────────────────────────────────────────

// ── EXPORT ────────────────────────────────────────────────────
window.DLB.Timing = Timing;
// ── END EXPORT ────────────────────────────────────────────────
})();
