/* Digital Logic Breadboard — timing diagram. One column is pushed per circuit update
   (event-stepped, not real-time); the last MAX_COLS columns are shown. */
(function(){
const MAX_COLS = 48;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
class Timing {
  constructor(canvas, ckt){
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ckt = ckt; this.hist = []; this.enabled = false;
    ckt.onChange(()=>this.record());
    new ResizeObserver(()=>this.draw()).observe(canvas.parentElement);
  }
  record(){
    const sig = this.ckt.signals(); if(!sig.length){ this.hist = []; this.draw(); return; }
    const col = {}; sig.forEach(s => col[s.name] = s.val);
    const last = this.hist[this.hist.length-1];
    if(last && JSON.stringify(last) === JSON.stringify(col)) return;   // unchanged state: no new column
    this.hist.push(col); if(this.hist.length > MAX_COLS) this.hist.shift();
    this.draw();
  }
  clear(){ this.hist = []; this.record(); }
  draw(){
    if(!this.enabled) return;
    const r = this.cv.parentElement.getBoundingClientRect(); if(r.width<10) return;
    this.cv.width = r.width*devicePixelRatio; this.cv.height = 200*devicePixelRatio;
    const ctx = this.ctx, W = r.width, H = 200; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,H);
    const sig = this.ckt.signals(); const names = sig.map(s=>s.name);
    const L = 64, top = 26, rowH = Math.min(30, (H-top-8)/Math.max(1,names.length)), n = this.hist.length, colW = Math.max(10, (W-L-16)/MAX_COLS);
    ctx.font = '11px '+css('--mono'); ctx.textBaseline='middle';
    if(!names.length){ ctx.fillStyle=css('--mut2'); ctx.textAlign='left'; ctx.fillText('Add a SWITCH, CLOCK, LED or PROBE to see signals here.', L, top+20); return; }
    names.forEach((nm,k)=>{
      const y0 = top + k*rowH, yh = y0 + 4, yl = y0 + rowH - 6;
      ctx.fillStyle = css('--line'); ctx.fillRect(L, yl+1, W-L-16, 1);
      ctx.fillStyle = css('--mut'); ctx.textAlign='right'; ctx.fillText(nm.slice(0,7), L-8, (yh+yl)/2);
      const kind = sig[k].kind, color = kind==='CLK' ? css('--acc') : kind==='SW'||kind==='BTN' ? css('--blue') : css('--hi');
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      for(let i=0;i<n;i++){ const v = this.hist[i][nm] ?? 0, y = v ? yh : yl, x = L + i*colW;
        if(i===0) ctx.moveTo(x,y); else { const pv = this.hist[i-1][nm] ?? 0; if(pv!==v) ctx.lineTo(x, pv?yh:yl); ctx.lineTo(x,y); }
        ctx.lineTo(x+colW, y); }
      ctx.stroke();
    });
    ctx.fillStyle = css('--mut2'); ctx.textAlign='right'; ctx.font='10px '+css('--mono');
    ctx.fillText(n+' of '+MAX_COLS+' columns · one column per state change →', W-16, top-12);
  }
}
window.DLB.Timing = Timing;
})();
