/* ============================================================================
   microstrip.js -- the ONE substrate and microstrip-line model shared by the
   ECE 4123/6423 matching tools (L-section, stub matching, Pi/T).
   University of Tulsa, Fall 2026.

   Closed-form only -- the same formulas circuit simulators use for a line;
   nothing here solves for fields:
     Z0, eps_eff   Hammerstad & Jensen (1980), with their strip-thickness
                   correction
     dispersion    Kirschning & Jansen (1982), eps_eff(f)
     conductor     skin effect, Hammerstad-Jensen current-distribution factor
     loss          and Hammerstad's surface-roughness factor
     dielectric    filling-factor formula
   Not modelled (they need an EM solver): junction and step parasitics,
   open-end fringing, via inductance, radiation, coupling.

   The substrate the reader picks is remembered in localStorage under ONE key,
   so every tool opens on the same board.
   ========================================================================= */
(function(root){
"use strict";
const CLIGHT=299792458, ETA0=376.730313, MU0=4e-7*Math.PI, SIGMA_CU=5.8e7;

/* ---------- complex arithmetic (self-contained) ---------- */
const C=(re,im)=>({re:re,im:im===undefined?0:im});
const add=(a,b)=>C(a.re+b.re,a.im+b.im);
const sub=(a,b)=>C(a.re-b.re,a.im-b.im);
const mul=(a,b)=>C(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const inv=a=>{const d=a.re*a.re+a.im*a.im;return C(a.re/d,-a.im/d);};
const div=(a,b)=>mul(a,inv(b));
const abs=a=>Math.hypot(a.re,a.im);
const cosh=a=>C(Math.cosh(a.re)*Math.cos(a.im),Math.sinh(a.re)*Math.sin(a.im));
const sinh=a=>C(Math.sinh(a.re)*Math.cos(a.im),Math.cosh(a.re)*Math.sin(a.im));

/* ---------- substrates ---------- */
const PRESETS={
  fr4:   {name:"FR-4",    er:4.4,  h:1.6,   tand:0.02},
  ro4350:{name:"RO4350B", er:3.66, h:0.508, tand:0.0037},
  ro4003:{name:"RO4003C", er:3.55, h:0.508, tand:0.0027},
  alu:   {name:"Alumina", er:9.8,  h:0.635, tand:0.0001}
};
const KEY="ece4123.substrate";

/* ---------- line model ---------- */
function hjZ01(u){
  const fu=6+(2*Math.PI-6)*Math.exp(-Math.pow(30.666/u,0.7528));
  return ETA0/(2*Math.PI)*Math.log(fu/u+Math.sqrt(1+4/(u*u)));
}
function hjEe(u,er){
  const a=1+Math.log((Math.pow(u,4)+Math.pow(u/52,2))/(Math.pow(u,4)+0.432))/49+
          Math.log(1+Math.pow(u/18.1,3))/18.7;
  const b=0.564*Math.pow((er-0.9)/(er+3),0.053);
  return (er+1)/2+(er-1)/2*Math.pow(1+10/u,-a*b);
}
/* static Z0 and eps_eff of a strip of width W (m) on substrate s (SI) */
function lineStatic(W,s){
  const u=W/s.h, er=s.er;
  if(!(s.t>0)){const ee=hjEe(u,er);return {Z0:hjZ01(u)/Math.sqrt(ee),ee:ee};}
  const tn=s.t/s.h, x=Math.sqrt(6.517*u), cth=1/Math.tanh(x);
  const du1=tn/Math.PI*Math.log(1+4*Math.E/(tn*cth*cth));
  const dur=0.5*(1+1/Math.cosh(Math.sqrt(Math.max(0,er-1))))*du1;
  const u1=u+du1, ur=u+dur, eer=hjEe(ur,er);
  return {Z0:hjZ01(ur)/Math.sqrt(eer), ee:eer*Math.pow(hjZ01(u1)/hjZ01(ur),2)};
}
/* Kirschning-Jansen eps_eff at f (Hz) */
function eeAt(ee0,W,s,f){
  const u=W/s.h, er=s.er, fn=f*1e-9*s.h*1e3;              /* GHz*mm */
  const P1=0.27488+(0.6315+0.525/Math.pow(1+0.0157*fn,20))*u-0.065683*Math.exp(-8.7513*u);
  const P2=0.33622*(1-Math.exp(-0.03442*er));
  const P3=0.0363*Math.exp(-4.6*u)*(1-Math.exp(-Math.pow(fn/38.7,4.97)));
  const P4=1+2.751*(1-Math.exp(-Math.pow(er/15.916,8)));
  const P=P1*P2*Math.pow((0.1844+P3*P4)*fn,1.5763);
  return er-(er-ee0)/(1+P);
}
/* everything about one strip at frequency f */
function line(W,s,f){
  const st=lineStatic(W,s), ee=eeAt(st.ee,W,s,f);
  const beta=2*Math.PI*f*Math.sqrt(ee)/CLIGHT;
  const sig=s.sigma||SIGMA_CU;
  const delta=1/Math.sqrt(Math.PI*f*MU0*sig), Rs=1/(sig*delta);
  const Ki=Math.exp(-1.2*Math.pow(st.Z0/ETA0,0.7));
  const Kr=1+2/Math.PI*Math.atan(1.4*Math.pow((s.rough||0)/delta,2));
  const ac=Rs/(st.Z0*W)*Ki*Kr;
  const ad=s.er>1?Math.PI*f/CLIGHT*s.er/(s.er-1)*(ee-1)/Math.sqrt(ee)*s.tand:0;
  return {W:W,Z0:st.Z0,ee0:st.ee,ee:ee,beta:beta,lg:2*Math.PI/beta,
          ac:ac,ad:ad,alpha:ac+ad};
}
/* width for a wanted Z0 (bisection on ln W/h; Z0 falls as W grows) */
function synth(Z,s){
  let lo=Math.log(0.005), hi=Math.log(200);
  const z=lu=>lineStatic(Math.exp(lu)*s.h,s).Z0;
  if(!(Z>0)||Z>z(lo)||Z<z(hi))return NaN;
  for(let i=0;i<80;i++){const m=(lo+hi)/2; if(z(m)>Z)lo=m; else hi=m;}
  return Math.exp((lo+hi)/2)*s.h;
}
/* layout sanity checks a board designer makes -- none of them EM */
function checks(name,m,s,f){
  const w=[], u=m.W/s.h;
  if(m.W<1e-4)w.push(name+" is "+(m.W*1e3).toPrecision(3)+" mm wide — below the ~0.1 mm a "+
    "typical PCB shop etches reliably.");
  if(u<0.1||u>100)w.push(name+" has W/h = "+u.toPrecision(3)+", outside the 0.1–100 range "+
    "the dispersion model was fitted to.");
  if(m.W>m.lg/8)w.push(name+" is wider than λ<sub>g</sub>/8 — it starts to act as a "+
    "patch, not a line.");
  return w;
}
function fhCheck(s,f){
  const fn=f*1e-9*s.h*1e3;
  return fn>25?["f·h = "+fn.toPrecision(3)+" GHz·mm is beyond the dispersion model's "+
    "25 GHz·mm limit."]:[];
}

/* ---------- two-port pieces (ABCD, normalized to the system Z0) ---------- */
const M=(a,b,c,d)=>({A:a,B:b,C:c,D:d});
const I2=()=>M(C(1),C(0),C(0),C(1));
function mmul(m,n){
  return M(add(mul(m.A,n.A),mul(m.B,n.C)),add(mul(m.A,n.B),mul(m.B,n.D)),
           add(mul(m.C,n.A),mul(m.D,n.C)),add(mul(m.C,n.B),mul(m.D,n.D)));
}
const ser=z=>M(C(1),z,C(0),C(1));
const sh=y=>M(C(1),C(0),y,C(1));
/* a strip of width W and physical length len at f; z0sys normalizes */
function gammaL(W,s,f,len){
  const m=line(W,s,f);
  return {gl:C(m.alpha*len,m.beta*len), zc:m.Z0, m:m};
}
function lineM(W,s,f,len,z0sys){
  const g=gammaL(W,s,f,len), zc=g.zc/z0sys, ch=cosh(g.gl), sn=sinh(g.gl);
  return M(ch,mul(C(zc),sn),mul(C(1/zc),sn),ch);
}
/* input impedance (normalized) of a stub: open or shorted far end */
function stubZ(W,s,f,len,opened,z0sys){
  const g=gammaL(W,s,f,len), zc=g.zc/z0sys, ch=cosh(g.gl), sn=sinh(g.gl);
  return mul(C(zc),opened?div(ch,sn):div(sn,ch));
}
/* drive a cascade: zs source (Z_T* for a match to Z_T), zl load, both
   normalized.  Returns |Gamma_in| against zT and the transducer gain.   */
function drive(Mx,zl,zT){
  const zs=C(zT.re,-zT.im);
  const v1=add(mul(Mx.A,zl),Mx.B), i1=add(mul(Mx.C,zl),Mx.D), zin=div(v1,i1);
  const vs=add(v1,mul(zs,i1));
  return {zin:zin, G:abs(div(sub(zin,zT),add(zin,zs))),
          GT:4*zs.re*zl.re/Math.pow(abs(vs),2)};
}
/* the -10 dB band around f0 for a function g(f) -> |Gamma| */
function band(g,f0){
  if(g(f0)>0.3162)return null;
  const edge=function(dir){
    let a=f0, step=f0*0.002;
    for(let k=0;k<2000;k++){const b=a+dir*step; if(b<=0)return NaN;
      if(g(b)>0.3162){let lo=a,hi=b;for(let j=0;j<40;j++){const m=(lo+hi)/2;
        if(g(m)>0.3162)hi=m;else lo=m;}return (lo+hi)/2;}
      a=b; step*=1.02; if(a>f0*20)return NaN;}
    return NaN;
  };
  return [edge(-1),edge(1)];
}
/* the load across a sweep: R holds, the reactance is an L (X > 0) or a
   C (X < 0) fixed at f0, in series with R or in parallel with it      */
function parZ(r,x){ return Math.abs(x)<1e-12?C(r,0):div(C(0,r*x),C(r,x)); }
function loadAt(form,r,x,f0,f){
  const k=f/f0, xf=x>=0?x*k:x/k;
  return form==="par"?parZ(r,xf):C(r,xf);
}

/* ---------- |S11| sweep plot ---------- */
function sweepSVG(svg,curves,f0,unitExp){
  const W=440,H=230,L=46,R=12,T=12,B=34, fa=0.5*f0, fb=1.5*f0, N=160;
  const ln=(a,b,c,d,col,w,da)=>'<line x1="'+a.toFixed(1)+'" y1="'+b.toFixed(1)+'" x2="'+
    c.toFixed(1)+'" y2="'+d.toFixed(1)+'" stroke="'+col+'" stroke-width="'+(w||1)+'"'+
    (da?' stroke-dasharray="'+da+'"':'')+'/>';
  const tx=(x,y,t,o)=>'<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+
    (o.s||10)+'" fill="'+(o.c||"#555")+'" text-anchor="'+(o.a||"middle")+
    '" dominant-baseline="middle"'+(o.b?' font-weight="bold"':'')+'>'+t+'</text>';
  const xf=f=>L+(f-fa)/(fb-fa)*(W-L-R), yd=d=>T+Math.min(40,Math.max(0,-d))/40*(H-T-B);
  const us=Math.pow(10,unitExp), un=unitExp===9?"GHz":"MHz";
  let s='<rect x="'+L+'" y="'+T+'" width="'+(W-L-R)+'" height="'+(H-T-B)+
    '" fill="#fff" stroke="#9a9a95"/>';
  for(let d=0;d<=40;d+=10){const y=yd(-d);
    s+=d===10?ln(L,y,W-R,y,"#1a7a35",1.2,"5 4"):ln(L,y,W-R,y,"#e2e2de",1);
    s+=tx(L-5,y,d?"−"+d:"0",{a:"end"});}
  for(let k=0;k<=4;k++){const f=fa+k*(fb-fa)/4,x=xf(f);
    s+=ln(x,T,x,H-B,"#ececea",1);
    s+=tx(x,H-B+13,(f/us).toPrecision(4),{});}
  s+=tx((L+W-R)/2,H-6,"frequency ("+un+")",{s:10.5});
  s+='<text x="12" y="'+((T+H-B)/2)+'" font-size="10.5" fill="#555" text-anchor="middle" '+
     'transform="rotate(-90 12 '+((T+H-B)/2)+')">|S₁₁| (dB)</text>';
  curves.forEach(function(cv,ci){
    let d="";
    for(let i=0;i<=N;i++){const f=fa+(fb-fa)*i/N, G=cv.g(f);
      const db=20*Math.log10(Math.max(G,1e-6));
      d+=(i?"L":"M")+xf(f).toFixed(1)+" "+yd(db).toFixed(1)+" ";}
    s+='<path d="'+d+'" fill="none" stroke="'+cv.col+'" stroke-width="'+(cv.w||2.4)+'"'+
       (cv.dash?' stroke-dasharray="'+cv.dash+'"':'')+' stroke-linejoin="round"/>';
    s+=tx(W-R-4,T+12+14*ci,cv.name,{s:10.5,b:ci===0,c:cv.col,a:"end"});
  });
  s+=ln(xf(f0),T,xf(f0),H-B,"#141414",0.8,"2 3");
  s+=tx(L+4,yd(-10)-6,"−10 dB",{c:"#1a7a35",a:"start"});
  svg.innerHTML=s;
}

/* ---------- the shared substrate panel ---------- */
const PANEL_HTML=
  '<label class="f">Substrate</label>'+
  '<select data-ms="preset" style="width:100%">'+
    Object.keys(PRESETS).map(function(k){const p=PRESETS[k];
      return '<option value="'+k+'">'+p.name+' — εr '+p.er+', h '+p.h+
        ' mm, tanδ '+p.tand+'</option>';}).join("")+
    '<option value="custom">custom</option></select>'+
  '<div class="row">'+
    '<div style="flex:1"><label class="f">ε<sub>r</sub></label><input type="text" data-ms="er"></div>'+
    '<div style="flex:1"><label class="f">h (mm)</label><input type="text" data-ms="h"></div>'+
    '<div style="flex:1"><label class="f">tanδ</label><input type="text" data-ms="tand"></div>'+
  '</div><div class="row">'+
    '<div style="flex:1"><label class="f">copper t (µm)</label><input type="text" data-ms="t"></div>'+
    '<div style="flex:1"><label class="f">roughness (µm rms)</label><input type="text" data-ms="rough"></div>'+
  '</div>'+
  '<div class="note">Same substrate in every matching tool. Line model: Hammerstad–Jensen '+
  'Z₀ and ε<sub>eff</sub> with strip thickness, Kirschning–Jansen dispersion, '+
  'copper conductor loss (skin effect, current crowding, roughness) and dielectric loss. '+
  'Not modelled: junction and step parasitics, open-end fringing, via inductance, '+
  'radiation — those need an EM solver.</div>';
const DEF={preset:"fr4",er:4.4,h:1.6,tand:0.02,t:35,rough:1};
function loadSaved(){
  try{const v=JSON.parse(localStorage.getItem(KEY)||"null");
    if(v&&typeof v==="object")return Object.assign({},DEF,v);}catch(e){}
  return Object.assign({},DEF);
}
function save(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch(e){}}
/* mount(el, onChange) -> {get()} : get() returns the substrate in SI units */
function mount(el,onChange){
  el.innerHTML=PANEL_HTML;
  const q=k=>el.querySelector('[data-ms="'+k+'"]');
  const put=function(v){q("preset").value=v.preset;
    ["er","h","tand","t","rough"].forEach(function(k){q(k).value=v[k];});};
  const read=function(){
    const n=(k,d)=>{const x=parseFloat(q(k).value);return isFinite(x)?x:d;};
    return {preset:q("preset").value,er:n("er",4.4),h:n("h",1.6),tand:Math.max(0,n("tand",0)),
            t:Math.max(0,n("t",0)),rough:Math.max(0,n("rough",0))};
  };
  put(loadSaved());
  q("preset").onchange=function(){
    const p=PRESETS[this.value];
    if(p){q("er").value=p.er;q("h").value=p.h;q("tand").value=p.tand;}
    save(read()); onChange();
  };
  ["er","h","tand"].forEach(function(k){q(k).addEventListener("input",function(){
    q("preset").value="custom"; save(read()); onChange();});});
  ["t","rough"].forEach(function(k){q(k).addEventListener("input",function(){
    save(read()); onChange();});});
  /* another tool open in another tab changed the board: follow it */
  window.addEventListener("storage",function(e){
    if(e.key===KEY){put(loadSaved()); onChange();}});
  return {get:function(){const v=read();
    return {er:v.er,h:v.h*1e-3,tand:v.tand,t:v.t*1e-6,rough:v.rough*1e-6,sigma:SIGMA_CU,
            name:(PRESETS[v.preset]||{name:"custom"}).name};}};
}

root.MS={CLIGHT:CLIGHT,ETA0:ETA0,PRESETS:PRESETS,
  lineStatic:lineStatic,eeAt:eeAt,line:line,synth:synth,checks:checks,fhCheck:fhCheck,
  C:C,cosh:cosh,sinh:sinh,
  M:M,I2:I2,mmul:mmul,ser:ser,sh:sh,lineM:lineM,stubZ:stubZ,drive:drive,band:band,
  parZ:parZ,loadAt:loadAt,sweepSVG:sweepSVG,mount:mount};
})(this);
