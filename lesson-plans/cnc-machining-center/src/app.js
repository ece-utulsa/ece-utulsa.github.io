/* CNC Machining Center lesson — application script.
   ============================================================
   TABLE OF CONTENTS
   1. Helpers        — DOM, storage, number formats
   2. Data           — materials, tool library, the four parts (+ the student's own), drawing dimensions
   3. Geometry       — rounded-rectangle and circle shapes: signed distance, offset contours, arcs
   4. CAM            — operations, tool load, the example plan, toolpaths + G-code, plan check, cycle time
   5. Inspection     — measuring the finished part against the drawing, stars, best results
   6. Scene          — renderer, machine (table, vise, gantry, spindle), tools, stock heightmap, chips
   7. Simulation     — running the program: moves, cutting, tool breakage, part coming loose
   8. Deck UI        — modes (jog / part / path / run), controls, DRO, G-code panel, log
   9. Drawing        — the part drawing (SVG) and its dimension table
   10. Plan editor   — §03 operation cards
   11. Designer      — §07 the student's own part
   12. Sections      — §01 jog tasks, tool rack, quizzes; §05 inspection; §06 best results; paging
   13. Loop / boot
   Coordinates: students and G-code use X (right), Y (back), Z (up) in inches from the work zero: the
   front-left corner of the stock, at the top of the finished part. three.js world = (X − Lx/2, Z, −(Y − Wy/2)).
   ============================================================ */
(function(){
"use strict";

/* ---------- 1. helpers ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const store={get(k,d){try{const v=localStorage.getItem('cncl.'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('cncl.'+k,JSON.stringify(v))}catch(e){/* storage unavailable */}}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const f3=v=>(Math.abs(v)<5e-4?0:v).toFixed(3), f4=v=>(Math.abs(v)<5e-5?0:v).toFixed(4);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mmss=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
// Small repeatable "random" numbers, so the same plan always measures the same.
const hash=str=>{let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000};

/* ---------- 2. data ---------- */
// feed1: the most a 1/4 in end mill should feed (in/min); doc: the deepest pass as a fraction of the tool diameter;
// drill: the most a 1/4 in drill should feed; sfm: cutting speed used to pick the spindle speed.
const MATS={
  wax:{name:'Machining wax',short:'wax',feed1:90,doc:1.0,drill:24,sfm:900,face:.12,uncut:0x2C877B,cutc:0x4FB8A9,metal:0,rough:.7},
  hdpe:{name:'HDPE plastic',short:'HDPE',feed1:70,doc:.75,drill:18,sfm:800,face:.1,uncut:0xDCD9CD,cutc:0xF7F6F0,metal:0,rough:.6},
  al:{name:'Aluminum 6061',short:'aluminum',feed1:36,doc:.4,drill:8,sfm:600,face:.06,uncut:0xA3ABB3,cutc:0xE4E8EC,metal:.12,rough:.38}};
const MAXRPM=10000;
const TOOLS=[
  {id:1,kind:'face',d:2,name:'2 in face mill',job:'Skims the top flat and clean.'},
  {id:2,kind:'em',d:.5,name:'1/2 in end mill',job:'Big pockets and outlines, fast.'},
  {id:3,kind:'em',d:.375,name:'3/8 in end mill',job:'Medium pockets and outlines.'},
  {id:4,kind:'em',d:.25,name:'1/4 in end mill',job:'The everyday tool: pockets and outlines.'},
  {id:5,kind:'em',d:.125,name:'1/8 in end mill',job:'Small pockets and tight corners, but slow.'},
  {id:6,kind:'spot',d:.5,name:'1/2 in spot drill',job:'A short, stiff point: marks each hole centre so the drill starts in the right place.'},
  {id:7,kind:'drill',d:.125,name:'Ø0.125 drill (1/8)'},{id:8,kind:'drill',d:.1875,name:'Ø0.1875 drill (3/16)'},
  {id:9,kind:'drill',d:.201,name:'Ø0.201 drill (#7)'},{id:10,kind:'drill',d:.25,name:'Ø0.250 drill (1/4)'},
  {id:11,kind:'drill',d:.3125,name:'Ø0.3125 drill (5/16)'},{id:12,kind:'drill',d:.375,name:'Ø0.375 drill (3/8)'},{id:13,kind:'drill',d:.5,name:'Ø0.500 drill (1/2)'}];
const TOOL=id=>TOOLS.find(t=>t.id===id);
const DRILL_SIZES=TOOLS.filter(t=>t.kind==='drill').map(t=>t.d);
const M=0.5, SKIN=0.3, FACE=0.05;   // stock margin around the part, material left under the part, facing allowance
// Shapes in part coordinates (inches from the lower-left corner of the part):
// {k:'rect', cx, cy, w, h, r} (rounded rectangle; r = h/2 makes a slot) or {k:'circle', cx, cy, r}.
const PARTS={
  tag:{name:'Keychain tag',mat:'wax',T:.25,out:{k:'rect',cx:1.375,cy:.5,w:2.75,h:1,r:.25},
    feats:[{id:'P1',k:'pocket',sh:{k:'rect',cx:1.625,cy:.5,w:1.75,h:.6,r:.0625},depth:.04,name:'name plate'},{id:'H1',k:'hole',x:.4,y:.5,d:.1875,name:'key-ring hole'}]},
  plate:{name:'Motor mount plate',mat:'al',T:.375,out:{k:'rect',cx:1.5,cy:1,w:3,h:2,r:.125},
    feats:[{id:'P1',k:'pocket',sh:{k:'circle',cx:1.5,cy:1,r:.625},depth:.125,name:'bearing seat'},{id:'H1',k:'hole',x:1.5,y:1,d:.5,name:'shaft hole'},
      {id:'H2',k:'hole',x:.3,y:.3,d:.201,name:'bolt hole'},{id:'H3',k:'hole',x:2.7,y:.3,d:.201,name:'bolt hole'},{id:'H4',k:'hole',x:2.7,y:1.7,d:.201,name:'bolt hole'},{id:'H5',k:'hole',x:.3,y:1.7,d:.201,name:'bolt hole'}]},
  opener:{name:'Bottle opener',mat:'al',T:.25,out:{k:'rect',cx:1.75,cy:.625,w:3.5,h:1.25,r:.625},
    feats:[{id:'P1',k:'pocket',sh:{k:'rect',cx:2.6,cy:.625,w:1.1,h:.5,r:.25},thru:true,name:'opener slot'},{id:'H1',k:'hole',x:.55,y:.625,d:.25,name:'key-ring hole'}]},
  hub:{name:'Gear hub',mat:'al',T:.5,out:{k:'circle',cx:1.125,cy:1.125,r:1.125},
    feats:[{id:'P1',k:'pocket',sh:{k:'circle',cx:1.125,cy:1.125,r:.5},depth:.15,name:'recess'},{id:'H1',k:'hole',x:1.125,y:1.125,d:.375,name:'shaft hole'},
      {id:'H2',k:'hole',x:.559,y:.559,d:.1875,name:'bolt hole'},{id:'H3',k:'hole',x:1.691,y:.559,d:.1875,name:'bolt hole'},{id:'H4',k:'hole',x:1.691,y:1.691,d:.1875,name:'bolt hole'},{id:'H5',k:'hole',x:.559,y:1.691,d:.1875,name:'bolt hole'}]}};
const PART_IDS=['tag','plate','opener','hub'];
const bbox=s=>s.k==='circle'?{w:2*s.r,h:2*s.r}:{w:s.w,h:s.h};
const holesOf=p=>p.feats.filter(f=>f.k==='hole'), pocketsOf=p=>p.feats.filter(f=>f.k==='pocket');
const holeGroups=p=>[...new Set(holesOf(p).map(h=>h.d))].map(d=>({key:'d'+d,d,holes:holesOf(p).filter(h=>h.d===d)}));
const pocketDepth=(p,f)=>f.thru?p.T+.02:f.depth;
const stockOf=p=>{const b=bbox(p.out);return {Lx:b.w+2*M,Wy:b.h+2*M,H:p.T+FACE+SKIN}};
const dia=d=>'Ø'+f3(d);
// Every size on the drawing, with its tolerance. key ties a row to its feature for measuring.
function dimsOf(p){const R=[],b=bbox(p.out);
  if(p.out.k==='circle')R.push({key:'out:D',f:'Outline',dim:'Diameter',nom:b.w,tol:.01});
  else{R.push({key:'out:L',f:'Outline',dim:'Length',nom:b.w,tol:.01},{key:'out:W',f:'Outline',dim:'Width',nom:b.h,tol:.01})}
  R.push({key:'out:T',f:'Outline',dim:'Thickness',nom:p.T,tol:.005});
  pocketsOf(p).forEach(f=>{const s=f.sh,id=f.id;
    if(s.k==='circle')R.push({key:id+':D',f:id,dim:'Diameter',nom:2*s.r,tol:.01});
    else{R.push({key:id+':L',f:id,dim:'Length',nom:s.w,tol:.01},{key:id+':W',f:id,dim:'Width',nom:s.h,tol:.01});
      if(s.r>0&&s.r<Math.min(s.w,s.h)/2-1e-6)R.push({key:id+':R',f:id,dim:'Corner radius',nom:s.r,tol:.01})}
    if(!f.thru)R.push({key:id+':Z',f:id,dim:'Depth',nom:f.depth,tol:.005})});
  holesOf(p).forEach(h=>{R.push({key:h.id+':D',f:h.id,dim:'Diameter',nom:h.d,tol:.003},{key:h.id+':X',f:h.id,dim:'Position X',nom:h.x,tol:.005},{key:h.id+':Y',f:h.id,dim:'Position Y',nom:h.y,tol:.005})});
  return R}

/* ---------- 3. geometry ---------- */
function sd(s,x,y){if(s.k==='circle')return Math.hypot(x-s.cx,y-s.cy)-s.r;
  const qx=Math.abs(x-s.cx)-(s.w/2-s.r),qy=Math.abs(y-s.cy)-(s.h/2-s.r);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-s.r}
const shift=(s,dx,dy)=>Object.assign({},s,{cx:s.cx+dx,cy:s.cy+dy});
const grow=(s,o)=>s.k==='circle'?Object.assign({},s,{r:s.r+o}):Object.assign({},s,{w:s.w+2*o,h:s.h+2*o,r:Math.max(0,s.r+o)});
// A closed contour as segments {t:'L'|'A', x, y (end), cx, cy, ccw}, starting at the bottom middle.
function contour(s,ccw){const segs=[];let start;
  if(s.k==='circle'){start={x:s.cx,y:s.cy-s.r};segs.push({t:'A',x:s.cx,y:s.cy+s.r,cx:s.cx,cy:s.cy,ccw:true},{t:'A',x:s.cx,y:s.cy-s.r,cx:s.cx,cy:s.cy,ccw:true})}
  else{const {cx,cy,w,h}=s,r=Math.min(s.r,w/2,h/2),x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2;start={x:cx,y:y0};
    const L=(x,y)=>segs.push({t:'L',x,y}),A=(x,y,ax,ay)=>{if(r>1e-6)segs.push({t:'A',x,y,cx:ax,cy:ay,ccw:true})};
    L(x1-r,y0);A(x1,y0+r,x1-r,y0+r);L(x1,y1-r);A(x1-r,y1,x1-r,y1-r);L(x0+r,y1);A(x0,y1-r,x0+r,y1-r);L(x0,y0+r);A(x0+r,y0,x0+r,y0+r);L(cx,y0)}
  let out=segs.filter((g,i)=>{const p=i?segs[i-1]:start;return Math.hypot(g.x-p.x,g.y-p.y)>1e-6});
  if(!ccw){const pts=[start].concat(out.map(g=>({x:g.x,y:g.y})));out=out.map((g,i)=>Object.assign({},g,{x:pts[i].x,y:pts[i].y,ccw:!g.ccw})).reverse()}
  return {start,segs:out}}
// Points along an arc (for the simulation and the toolpath lines).
function arcPts(p0,g,step=.03){const r=Math.hypot(p0.x-g.cx,p0.y-g.cy);let a0=Math.atan2(p0.y-g.cy,p0.x-g.cx),a1=Math.atan2(g.y-g.cy,g.x-g.cx);
  if(g.ccw){while(a1<=a0+1e-9)a1+=2*Math.PI}else{while(a1>=a0-1e-9)a1-=2*Math.PI}
  const n=Math.max(2,Math.ceil(Math.abs(a1-a0)*r/step)),o=[];for(let i=1;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push({x:g.cx+r*Math.cos(a),y:g.cy+r*Math.sin(a)})}return o}
function contourPts(c,step=.04){let p=c.start;const o=[{x:p.x,y:p.y}];
  for(const g of c.segs){if(g.t==='A')o.push(...arcPts(p,g,step));else{const L=Math.hypot(g.x-p.x,g.y-p.y),n=Math.max(1,Math.ceil(L/step));for(let i=1;i<=n;i++)o.push({x:p.x+(g.x-p.x)*i/n,y:p.y+(g.y-p.y)*i/n})}p=g}return o}

/* ---------- 4. CAM ---------- */
const OPS={
  face:{name:'Face the top',color:'#5C7CFA',kinds:['face','em'],help:'Skims 0.05 in off the top so it is flat. Z 0 is the faced top.'},
  spot:{name:'Spot drill',color:'#E67700',kinds:['spot'],help:'A shallow cone at every hole centre, so the drills start in the right place.'},
  drill:{name:'Drill holes',color:'#C2255C',kinds:['drill'],help:'Drills all the holes of one size. A drill makes a hole its own size.'},
  pocket:{name:'Pocket',color:'#7048E8',kinds:['em'],help:'Clears out a pocket, round and round, a little deeper each pass.'},
  profile:{name:'Profile (cut out)',color:'#2B8A3E',kinds:['em'],help:'Cuts around the outline to free the part. Tabs hold it in place.'}};
const rpmOf=(t,m)=>Math.min(MAXRPM,Math.round(m.sfm*3.82/t.d/100)*100);
const feedMax=(t,m)=>t.kind==='face'?m.feed1*1.3:t.kind==='em'?m.feed1*Math.sqrt(t.d/.25):t.kind==='spot'?m.drill*1.5:m.drill*Math.sqrt(t.d/.25);
const stepMax=(t,m)=>t.kind==='face'?m.face:t.kind==='em'?t.d*m.doc:1;
// How hard a cut pushes the tool: 1 = the limit. Above 1.08 the tool breaks.
function loadOf(op,m){const t=TOOL(op.tool);if(!t)return 0;const fm=feedMax(t,m);
  if(t.kind==='drill'||t.kind==='spot')return op.feed/fm;
  return (op.feed/fm)*(.4+.6*op.step/stepMax(t,m))}
const BREAK=1.08, RISKY=.8, PECK=2;   // drilling deeper than PECK × the drill's diameter needs pecking
let opUid=1;
function newOp(type,p,m,plan){const o={uid:opUid++,type,feat:'',tool:0,step:0,feed:0,peck:false,tabs:true};
  if(type==='face')o.tool=1;
  if(type==='spot'){o.tool=6;o.feat='holes'}
  if(type==='drill'){const done=plan.filter(q=>q.type==='drill').map(q=>q.feat),g=holeGroups(p).find(g=>!done.includes(g.key))||holeGroups(p)[0];o.feat=g?g.key:'';o.tool=0}
  if(type==='pocket'){const done=plan.filter(q=>q.type==='pocket').map(q=>q.feat),f=pocketsOf(p).find(f=>!done.includes(f.id))||pocketsOf(p)[0];o.feat=f?f.id:'';o.tool=4}
  if(type==='profile'){o.tool=4;o.feat='out'}
  return speeds(o,m)}
// Normal ("example") feed and depth for the op's tool: 60% of the most feed, half the deepest pass.
function speeds(o,m){const t=TOOL(o.tool);if(!t)return o;o.feed=Math.max(1,Math.round(.6*feedMax(t,m)));
  if(t.kind==='face')o.step=+Math.min(FACE,stepMax(t,m)*.85).toFixed(3);else if(t.kind==='em')o.step=+Math.max(.01,(.5*stepMax(t,m))).toFixed(2);return o}
function fits(t,f){const s=f.sh;return s.k==='circle'?t.d<2*s.r-.005:t.d<Math.min(s.w,s.h)-.005}
function autoPlan(p,m){const plan=[];const add=(type,set)=>{const o=newOp(type,p,m,plan);Object.assign(o,set);speeds(o,m);plan.push(o)};
  add('face',{});
  if(holesOf(p).length){add('spot',{});holeGroups(p).forEach(g=>{const t=TOOLS.find(t=>t.kind==='drill'&&Math.abs(t.d-g.d)<1e-6);add('drill',{feat:g.key,tool:t?t.id:10,peck:p.T+.1>PECK*g.d})})}
  pocketsOf(p).forEach(f=>{const s=f.sh,corner=s.k==='rect'&&s.r<Math.min(s.w,s.h)/2-1e-6?s.r:9;
    const t=TOOLS.filter(t=>t.kind==='em'&&t.d<=.75*(s.k==='circle'?2*s.r:Math.min(s.w,s.h))&&t.d/2<=corner+1e-9).sort((a,b)=>b.d-a.d)[0]||TOOL(5);add('pocket',{feat:f.id,tool:t.id})});
  add('profile',{tabs:true});return plan}
const featLabel=(p,o)=>{if(o.type==='face')return 'the top';if(o.type==='spot')return 'all holes';if(o.type==='profile')return 'the outline';
  if(o.type==='drill'){const g=holeGroups(p).find(g=>g.key===o.feat);return g?`${g.holes.map(h=>h.id).join(', ')} (${dia(g.d)})`:'?'}
  const f=p.feats.find(f=>f.id===o.feat);return f?`${f.id} (${f.name})`:'?'};
const opTitle=(p,o,i)=>`${i+1} · ${OPS[o.type].name}: ${featLabel(p,o)}`;
// Problems that stop the program from running, and features nobody has planned yet.
function checkPlan(p,plan){const out=[];
  if(!plan.length){out.push(['bad','The plan is empty: add operations, or load the example plan.']);return out}
  plan.forEach((o,i)=>{const t=TOOL(o.tool),n=`Operation ${i+1}`;
    if(!t){out.push(['bad',`${n}: choose a ${o.type==='drill'?'drill':'tool'}.`]);return}
    if(!OPS[o.type].kinds.includes(t.kind)){out.push(['bad',`${n}: the ${t.name} cannot do this job.`]);return}
    if(!(o.feed>0))out.push(['bad',`${n}: the feed must be more than 0.`]);
    if((t.kind==='em'||t.kind==='face')&&!(o.step>0))out.push(['bad',`${n}: the depth per pass must be more than 0.`]);
    if(o.type==='pocket'){const f=p.feats.find(f=>f.id===o.feat);if(f&&!fits(t,f))out.push(['bad',`${n}: the ${t.name} is too big to fit in pocket ${f.id}.`])}
    if(o.type==='drill'&&!holeGroups(p).some(g=>g.key===o.feat))out.push(['bad',`${n}: choose which holes to drill.`])});
  const miss=[];pocketsOf(p).forEach(f=>{if(!plan.some(o=>o.type==='pocket'&&o.feat===f.id))miss.push(`pocket ${f.id}`)});
  holeGroups(p).forEach(g=>{if(!plan.some(o=>o.type==='drill'&&o.feat===g.key))miss.push(`the ${dia(g.d)} hole${g.holes.length>1?'s':''} (${g.holes.map(h=>h.id).join(', ')})`)});
  if(!plan.some(o=>o.type==='profile'))miss.push('the outline (profile)');
  if(miss.length)out.push(['warn',`Not in the plan yet: ${miss.join(', ')}.`]);
  return out}

/* toolpaths + G-code. Stock coordinates: X, Y from the stock's front-left corner; Z from the finished top. */
const SAFE=.1, CLEAR=.5, TCZ=2, RAPID=200, TC_TIME=6, SPIN_TIME=1.5;
function program(p,m,plan){
  const st=stockOf(p),sh=s=>shift(s,M,M),lines=[],moves=[];let cur={x:0,y:st.Wy+.6,z:TCZ},blk=0,opi=-1,lastF=null,tool=null;
  const L=(t,cm)=>{lines.push({t,cm});blk=lines.length-1;return blk};
  const mv=(x,y,z,kind,f)=>{moves.push({x,y,z,kind,f,blk,op:opi,tool:tool&&tool.id});cur={x,y,z}};
  const ax=(x,y,z)=>[x!=null&&Math.abs(x-cur.x)>1e-6?'X'+f4(x):'',y!=null&&Math.abs(y-cur.y)>1e-6?'Y'+f4(y):'',z!=null&&Math.abs(z-cur.z)>1e-6?'Z'+f4(z):''].filter(Boolean).join(' ');
  const G0=(x,y,z)=>{x=x==null?cur.x:x;y=y==null?cur.y:y;z=z==null?cur.z:z;const a=ax(x,y,z);if(!a)return;L('G0 '+a);mv(x,y,z,'r')};
  const G1=(x,y,z,f)=>{x=x==null?cur.x:x;y=y==null?cur.y:y;z=z==null?cur.z:z;const a=ax(x,y,z);if(!a)return;L('G1 '+a+(f!==lastF?' F'+Math.round(f):''));lastF=f;mv(x,y,z,'f',f)};
  const ARC=(g,z,f)=>{const p0={x:cur.x,y:cur.y};L(`${g.ccw?'G3':'G2'} X${f4(g.x)} Y${f4(g.y)} I${f4(g.cx-p0.x)} J${f4(g.cy-p0.y)}${f!==lastF?' F'+Math.round(f):''}`);lastF=f;
    arcPts(p0,g).forEach(q=>mv(q.x,q.y,z,'f',f))};
  const run=(c,z,f)=>{for(const g of c.segs){if(g.t==='A')ARC(g,z,f);else G1(g.x,g.y,z,f)}};
  L('%');L(`(${p.name.toUpperCase()} IN ${m.name.toUpperCase()})`,1);L('(WORK ZERO: X0 Y0 = FRONT-LEFT CORNER OF STOCK, Z0 = FINISHED TOP)',1);
  L('G20 G90 G17 G54',0);lines[blk].c='(INCH, ABSOLUTE, XY PLANE, WORK ZERO)';
  const T=p.T,ranges=[];
  plan.forEach((o,i)=>{opi=i;const t=TOOL(o.tool),R=t.d/2,f=o.feed,start=moves.length,firstLine=lines.length;
    L(`(OP ${i+1}: ${OPS[o.type].name.toUpperCase()} - ${featLabel(p,o).toUpperCase()})`,1);
    if(!tool||tool.id!==t.id){G0(null,null,TCZ);tool=t;L(`T${t.id} M6`);lines[blk].c=`(${t.name.toUpperCase()})`;moves.push({x:cur.x,y:cur.y,z:cur.z,kind:'tc',dur:TC_TIME,blk,op:i,tool:t.id});
      L(`S${rpmOf(t,m)} M3`);lines[blk].c='(SPINDLE ON)';moves.push({x:cur.x,y:cur.y,z:cur.z,kind:'sp',dur:SPIN_TIME,blk,op:i,tool:t.id,rpm:rpmOf(t,m)})}
    lastF=null;
    if(o.type==='face'){const ys=[];if(t.d>=st.Wy+.4)ys.push(st.Wy/2);else for(let y=st.Wy-.8*R;;y-=1.4*R){ys.push(y);if(y-R<=0)break}
      const xa=-R-.2,xb=st.Lx+R+.2;let z=FACE;const zs=[];while(z>1e-6){z=Math.max(0,+(z-o.step).toFixed(4));zs.push(z)}
      zs.forEach(z=>{G0(xa,ys[0],null);G0(null,null,z+.1);G1(null,null,z,f/2);let left=true;
        ys.forEach((y,k)=>{if(k)G1(null,y,null,f);G1(left?xb:xa,null,null,f);left=!left});G0(null,null,CLEAR)})}
    if(o.type==='spot'||o.type==='drill'){const hs=o.type==='spot'?holesOf(p):(holeGroups(p).find(g=>g.key===o.feat)||{holes:[]}).holes;
      const zOf=h=>o.type==='spot'?-Math.min(.24,h.d/2+.005):-(T+.1),peck=o.type==='drill'&&o.peck,q=t.d;
      G0(null,null,CLEAR);
      hs.forEach((h,k)=>{const x=h.x+M,y=h.y+M,z=zOf(h);
        const txt=k===0?(peck?`G83 X${f4(x)} Y${f4(y)} Z${f4(z)} R${f4(SAFE)} Q${f4(q)} F${Math.round(f)}`:`G81 X${f4(x)} Y${f4(y)} Z${f4(z)} R${f4(SAFE)} F${Math.round(f)}`):`X${f4(x)} Y${f4(y)}${o.type==='spot'?' Z'+f4(z):''}`;
        L(txt);if(k===0)lines[blk].c=peck?'(PECK DRILL CYCLE)':o.type==='spot'?'(SPOT CYCLE)':'(DRILL CYCLE)';
        mv(x,y,CLEAR,'r');mv(x,y,SAFE,'r');
        if(peck){let d=0;while(d>z+1e-6){const nd=Math.max(z,d-q);if(d<0)mv(x,y,d+.02,'r');mv(x,y,nd,'f',f);d=nd;mv(x,y,SAFE,'r')}}
        else{mv(x,y,z,'f',f);mv(x,y,SAFE,'r')}
        mv(x,y,CLEAR,'r')});
      L('G80');lines[blk].c='(CANCEL CYCLE)'}
    if(o.type==='pocket'){const ft=p.feats.find(q=>q.id===o.feat),s=sh(ft.sh),depth=pocketDepth(p,ft),so=.45*t.d;
      const path=[];   // contours inside out
      if(s.k==='circle'){const r0=s.r-R;for(let r=r0;r>1e-4;r-=so)path.unshift(contour({k:'circle',cx:s.cx,cy:s.cy,r},true));path.unshift({start:{x:s.cx,y:s.cy},segs:[]})}
      else{const w0=s.w-2*R,h0=s.h-2*R,r0=Math.max(0,s.r-R);for(let o2=0;w0-2*o2>1e-4&&h0-2*o2>1e-4;o2+=so)path.unshift(contour({k:'rect',cx:s.cx,cy:s.cy,w:w0-2*o2,h:h0-2*o2,r:Math.max(0,r0-o2)},true));
        const e=Math.max(0,(Math.abs(w0-h0))/2),a=w0>=h0?{x:s.cx-e,y:s.cy}:{x:s.cx,y:s.cy-e},b=w0>=h0?{x:s.cx+e,y:s.cy}:{x:s.cx,y:s.cy+e};
        path.unshift({start:a,segs:e>1e-4?[{t:'L',x:b.x,y:b.y},{t:'L',x:a.x,y:a.y}]:[]})}
      const zs=[];for(let k=1;;k++){const z=-Math.min(depth,k*o.step);zs.push(+z.toFixed(4));if(-z>=depth-1e-6)break}
      zs.forEach(z=>{G0(null,null,CLEAR);G0(path[0].start.x,path[0].start.y,null);G0(null,null,SAFE);G1(null,null,z,f/2);
        path.forEach((c,k)=>{if(k)G1(c.start.x,c.start.y,z,f);run(c,z,f)});G0(null,null,CLEAR)})}
    if(o.type==='profile'){const c=contour(grow(sh(p.out),R),false),zs=[];const depth=T+.02,tabTop=-(T-.06);
      for(let k=1;;k++){const z=-Math.min(depth,k*o.step);zs.push(+z.toFixed(4));if(-z>=depth-1e-6)break}
      const pts=contourPts(c),cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y));
      const per=cum[cum.length-1],half=.125+R,tabAt=s=>[.125,.375,.625,.875].some(fr=>Math.abs(s-fr*per)<half);
      G0(null,null,CLEAR);G0(c.start.x,c.start.y,null);G0(null,null,SAFE);
      zs.forEach((z,k)=>{G1(c.start.x,c.start.y,z,f/2);
        if(o.tabs&&z<tabTop){L(`(TABS: LIFT TO Z${f4(tabTop)} OVER EACH TAB)`,1);pts.forEach((q,j)=>{if(j)G1(q.x,q.y,tabAt(cum[j])?tabTop:z,f)})}
        else run(c,z,f)});
      G0(null,null,CLEAR)}
    G0(null,null,CLEAR);ranges.push({start,end:moves.length,firstLine})});
  opi=-1;L('M5');lines[blk].c='(SPINDLE OFF)';mv(cur.x,cur.y,cur.z,'r');G0(null,null,TCZ);G0(0,st.Wy+.6,null);L('M30');lines[blk].c='(END OF PROGRAM)';L('%');
  // cycle time
  let tt=0,p0={x:0,y:st.Wy+.6,z:TCZ};const opTime=plan.map(()=>0);
  for(const q of moves){let dt=0;if(q.kind==='tc'||q.kind==='sp')dt=q.dur;else{const d=Math.hypot(q.x-p0.x,q.y-p0.y,q.z-p0.z);dt=d/((q.kind==='r'?RAPID:q.f)/60);p0=q}q.t0=tt;tt+=dt;q.dt=dt;if(q.op>=0)opTime[q.op]+=dt}
  return {lines,moves,ranges,time:tt,opTime,st}}

/* ---------- 5. inspection ---------- */
// Measure the part a run made. Sizes come from the plan that ran: the tool used, what came before what.
function targetTime(p,m){return Math.max(30,Math.round(program(p,m,autoPlan(p,m)).time*.85/5)*5)}
function inspect(p,m,plan,rec){
  const rows=dimsOf(p).map(r=>Object.assign({},r)),done=i=>rec.done.includes(i);
  const faced=plan.some((o,i)=>o.type==='face'&&done(i)),profI=plan.findIndex((o,i)=>o.type==='profile'&&done(i)),cut=profI>=0;
  const shaky=i=>cut&&i>profI,sgn=k=>hash(k+'s')>.5?1:-1;
  rows.forEach(r=>{const [id,d]=r.key.split(':');let v=null,why='';
    if(id==='out'){if(!cut)why='not cut out';else v=d==='T'?p.T+(faced?0:FACE):r.nom}
    else if(id[0]==='P'){const i=plan.findIndex((o,i)=>o.type==='pocket'&&o.feat===id&&done(i));
      if(i<0)why='not machined';else{const t=TOOL(plan[i].tool);v=d==='R'?Math.max(r.nom,t.d/2):d==='Z'?r.nom+(faced?0:FACE):r.nom;if(shaky(i)&&d!=='Z')v+=.014*sgn(r.key)}}
    else{const h=p.feats.find(f=>f.id===id),i=plan.findIndex((o,i)=>o.type==='drill'&&o.feat==='d'+h.d&&done(i));
      if(i<0)why='not drilled';else{const t=TOOL(plan[i].tool);
        if(d==='D')v=t.d+.0012;else{const spotted=plan.some((o,j)=>o.type==='spot'&&done(j)&&j<i);v=r.nom+(spotted?0:(.006+.003*hash(r.key))*sgn(r.key))}
        if(shaky(i)&&d!=='D')v+=.008*sgn(r.key+'x')}}
    if(v!=null)v+=(hash(p.name+r.key)-.5)*.0012;
    r.meas=v;r.why=why;r.pass=v!=null&&Math.abs(v-r.nom)<=r.tol+1e-9});
  const status=rec.broken?'broken':rec.loose?'loose':!rec.finished?'stopped':!cut?'notcut':'ok';
  const allPass=rows.every(r=>r.pass),target=targetTime(p,m);
  const stars=status!=='ok'?0:!allPass?1:rec.time<=target?3:2;
  return {rows,status,stars,allPass,time:rec.time,target,faced,cut,profI,plan:plan.map(o=>Object.assign({},o))}}

/* ---------- 6. scene ---------- */
const view=$('#view'),canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xDDE3E8);
const camera=new THREE.PerspectiveCamera(38,1,.05,300);
const controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=1.2;controls.maxDistance=60;
scene.add(new THREE.HemisphereLight(0xffffff,0x9AA5B1,.75));
const sun=new THREE.DirectionalLight(0xffffff,.75);sun.position.set(6,14,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});sun.shadow.bias=-.0006;scene.add(sun);
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t}
function textSprite(txt,{fg='#17202A',bg='rgba(255,255,255,0.92)',h=.3}={}){const fs=64,pad=20,font=`700 ${fs}px Arial, sans-serif`;
  const m=document.createElement('canvas').getContext('2d');m.font=font;const w=Math.ceil(m.measureText(txt).width)+pad*2,H=96;
  const tex=canvasTex(w,H,ctx=>{ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(16,2);ctx.arcTo(w-2,2,w-2,H-2,16);ctx.arcTo(w-2,H-2,2,H-2,16);ctx.arcTo(2,H-2,2,2,16);ctx.arcTo(2,2,w-2,2,16);ctx.fill();ctx.font=font;ctx.fillStyle=fg;ctx.textBaseline='middle';ctx.fillText(txt,pad,H/2+3)});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false,depthTest:false}));s.renderOrder=5;s.scale.set(h*w/H,h,1);return s}
const box=(w,h,d,mat,x,y,z,parent)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
const cyl=(r1,r2,h,mat,y,parent,seg=28)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),mat);m.position.y=y;m.castShadow=true;parent.add(m);return m};
const MAT={paint:new THREE.MeshStandardMaterial({color:0x4A6D84,roughness:.6}),paint2:new THREE.MeshStandardMaterial({color:0x1395A6,roughness:.55}),
  steel:new THREE.MeshStandardMaterial({color:0xC9D0D6,roughness:.42,metalness:.25}),dark:new THREE.MeshStandardMaterial({color:0x66707A,roughness:.5,metalness:.15}),
  black:new THREE.MeshStandardMaterial({color:0x1E2328,roughness:.5}),gold:new THREE.MeshStandardMaterial({color:0xD4A72C,roughness:.35,metalness:.6}),
  carbide:new THREE.MeshStandardMaterial({color:0x8E969E,roughness:.28,metalness:.75})};
// Fixture (y = 0 at the bottom of the stock): table, vise, parallels, gantry rails.
const fixture=new THREE.Group();scene.add(fixture);
const tableTex=canvasTex(512,256,(c,w,h)=>{c.fillStyle='#8A949D';c.fillRect(0,0,w,h);for(let i=1;i<6;i++){c.fillStyle='#646E77';c.fillRect(0,i*h/6-5,w,10)}});
box(24,1.4,12,new THREE.MeshStandardMaterial({map:tableTex,roughness:.7,metalness:.2}),0,-2.8,0,fixture);
const vise={body:box(7,1.6,4,MAT.paint2,0,-1.3,0,fixture),back:box(6.4,.75,.7,MAT.steel,0,-.125,0,fixture),front:box(6.4,.75,.7,MAT.steel,0,-.125,0,fixture),
  par1:box(5.6,.5,.25,MAT.steel,0,-.25,0,fixture),par2:box(5.6,.5,.25,MAT.steel,0,-.25,0,fixture),
  screw:(()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.6,16),MAT.steel);m.rotation.x=Math.PI/2;m.castShadow=true;fixture.add(m);return m})(),
  handle:box(2.4,.18,.18,MAT.black,0,-1.3,0,fixture)};
[-10.6,10.6].forEach(x=>box(.9,.8,12,MAT.dark,x,-1.7,0,fixture));
// Gantry: the bridge moves in Y, the carriage in X, the Z slide and spindle in Z.
const gantry=new THREE.Group();scene.add(gantry);
const bridge=box(22.2,1.3,1.5,MAT.paint,0,0,0,gantry),legs=[-10.6,10.6].map(x=>box(1,1,1.3,MAT.paint,x,0,0,gantry));
const head=new THREE.Group();scene.add(head);   // origin at the tool tip
const carriage=box(2,1.8,1,MAT.paint2,0,0,0,scene);
const zslide=box(1.3,4.6,.4,MAT.paint,0,0,0,head);
const spindle=new THREE.Group();head.add(spindle);
cyl(.85,.85,3.2,MAT.paint2,1.6+.9,spindle);cyl(.95,.95,.35,MAT.dark,3.4,spindle);cyl(.55,.62,.5,MAT.steel,.65,spindle);cyl(.42,.5,.5,MAT.dark,.25,spindle);
const toolMount=new THREE.Group();head.add(toolMount);let toolObj=null,toolLen=1.5,curTool=null;
const fluteTex=canvasTex(64,256,(c,w,h)=>{c.fillStyle='#C3CAD0';c.fillRect(0,0,w,h);c.strokeStyle='#6E7780';c.lineWidth=10;for(let i=-4;i<8;i++){c.beginPath();c.moveTo(0,i*48);c.lineTo(w,i*48+64);c.stroke()}});
fluteTex.wrapS=fluteTex.wrapT=THREE.RepeatWrapping;
function makeTool(t){const g=new THREE.Group(),r=t.d/2;let L=0;
  const fm=new THREE.MeshStandardMaterial({map:fluteTex,roughness:.35,metalness:.2});
  if(t.kind==='face'){cyl(1,1,.4,MAT.dark,.2,g,40);for(let k=0;k<6;k++){const a=k*Math.PI/3,b=box(.22,.16,.12,MAT.gold,Math.cos(a)*.93,.08,Math.sin(a)*.93,g);b.rotation.y=-a}cyl(.5,.5,.8,MAT.steel,.8,g);L=1.2}
  else if(t.kind==='em'){const fl=Math.min(1,Math.max(.5,3*t.d));const f=cyl(r,r,fl,fm,fl/2,g,20);fm.map=fluteTex.clone();fm.map.needsUpdate=true;fm.map.repeat.set(1,fl*2);f.userData.flute=true;cyl(Math.max(r,.125),Math.max(r,.125),.8,MAT.carbide,fl+.4,g,20);L=fl+.8}
  else{const pt=t.kind==='spot'?r:r*.6,fl=t.kind==='spot'?.45:Math.max(1,6*t.d);
    const c=new THREE.Mesh(new THREE.ConeGeometry(r,pt,20),t.kind==='spot'?MAT.gold:fm);c.rotation.x=Math.PI;c.position.y=pt/2;c.castShadow=true;g.add(c);
    const f=cyl(r,r,fl,t.kind==='spot'?MAT.gold:fm,pt+fl/2,g,20);f.userData.flute=true;if(t.kind!=='spot'){fm.map=fluteTex.clone();fm.map.needsUpdate=true;fm.map.repeat.set(1,fl*2)}
    cyl(Math.max(r,.15),Math.max(r,.15),.6,MAT.carbide,pt+fl+.3,g,20);L=pt+fl+.6}
  g.userData.len=L;return g}
function setTool(id){if(curTool===id&&toolObj)return;curTool=id;if(toolObj){toolMount.remove(toolObj);toolObj.traverse(o=>{if(o.geometry)o.geometry.dispose()})}toolObj=null;
  const t=TOOL(id);if(!t){toolLen=.9;spindle.position.y=toolLen;return}
  toolObj=makeTool(t);toolMount.add(toolObj);toolLen=toolObj.userData.len;spindle.position.y=toolLen}
function breakToolLook(){if(!toolObj)return;toolObj.children.forEach(o=>{if(o.userData.flute){o.scale.y=.35;o.position.y*=.35}});
  const sp=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshBasicMaterial({color:0xC92A2A}));sp.position.y=.2;toolObj.add(sp)}
// world position for a stock point (X, Y, Z)
let ST={Lx:3,Wy:2,H:.6};
const W=(x,y,z)=>V(x-ST.Lx/2,z,-(y-ST.Wy/2));
function placeHead(x,y,z){const p=W(x,y,z);head.position.copy(p);zslide.position.set(0,toolLen+3.2,-1.05);
  const top=8,bz=p.z-1.9,lb=fixture.position.y-1.3;bridge.position.set(0,top,bz);legs.forEach(l=>{l.position.z=bz;l.scale.y=top-lb;l.position.y=(top+lb)/2});
  carriage.position.set(p.x,top,p.z-1.2);zslide.scale.y=Math.max(.2,(top-(p.y+toolLen+.9))/4.6);zslide.position.y=(top+p.y+toolLen+.9)/2-p.y}

/* the stock: a heightmap of Z values, about 0.02 in apart, cut by stamping the tool's shape into it */
const HM={};
const stockGroup=new THREE.Group();scene.add(stockGroup);
function buildStock(p,m){stockGroup.children.slice().forEach(o=>{stockGroup.remove(o);o.geometry.dispose()});
  ST=stockOf(p);const nx=Math.round(ST.Lx/.02)+1,ny=Math.round(ST.Wy/.02)+1;
  Object.assign(HM,{nx,ny,cx:ST.Lx/(nx-1),cy:ST.Wy/(ny-1),h:new Float32Array(nx*ny).fill(FACE),cut:new Uint8Array(nx*ny),bot:FACE-ST.H,dirty:null,
    cu:new THREE.Color(m.uncut),cc:new THREE.Color(m.cutc)});
  const N=nx*ny,pos=new Float32Array(N*3),nor=new Float32Array(N*3),col=new Float32Array(N*3),idx=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;pos[k*3]=i*HM.cx-ST.Lx/2;pos[k*3+2]=-(j*HM.cy-ST.Wy/2)}
  for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;idx.push(a,b,d,a,d,c)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.setIndex(idx);const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:m.rough,metalness:m.metal,side:THREE.DoubleSide});
  HM.top=new THREE.Mesh(g,mat);HM.top.castShadow=HM.top.receiveShadow=true;stockGroup.add(HM.top);
  // four side walls follow the edge heights
  const ring=[];for(let i=0;i<nx;i++)ring.push(i);for(let j=1;j<ny;j++)ring.push(j*nx+nx-1);for(let i=nx-2;i>=0;i--)ring.push((ny-1)*nx+i);for(let j=ny-2;j>0;j--)ring.push(j*nx);ring.push(0);
  const wp=new Float32Array(ring.length*6),wi=[];ring.forEach((k,n)=>{const x=pos[k*3],z=pos[k*3+2];wp.set([x,FACE,z,x,HM.bot,z],n*6);if(n<ring.length-1)wi.push(n*2,n*2+1,n*2+3,n*2,n*2+3,n*2+2)});
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.BufferAttribute(wp,3));wg.setIndex(wi);wg.computeVertexNormals();
  HM.wall=new THREE.Mesh(wg,new THREE.MeshStandardMaterial({color:m.uncut,roughness:m.rough,metalness:m.metal,side:THREE.DoubleSide}));HM.wall.castShadow=HM.wall.receiveShadow=true;HM.ring=ring;stockGroup.add(HM.wall);
  // fixture to suit: stock bottom sits on the parallels, the jaws grip the front and back faces
  fixture.position.y=HM.bot;const hw=ST.Wy/2;
  vise.back.position.z=-hw-.35;vise.front.position.z=hw+.35;vise.par1.position.z=-hw+.2;vise.par2.position.z=hw-.2;
  vise.body.scale.z=(ST.Wy+3.2)/4;vise.body.position.z=.4;vise.screw.position.set(0,-1.3,hw+2.3);vise.handle.position.set(0,-1.3,hw+3.1);
  HM.dirty={i0:0,i1:nx-1,j0:0,j1:ny-1};flushStock();setAxes()}
function flushStock(){const d=HM.dirty;if(!d)return;HM.dirty=null;const {nx,ny,h,cut}=HM,g=HM.top.geometry,pos=g.attributes.position.array,nor=g.attributes.normal.array,col=g.attributes.color.array;
  const i0=Math.max(0,d.i0-1),i1=Math.min(nx-1,d.i1+1),j0=Math.max(0,d.j0-1),j1=Math.min(ny-1,d.j1+1);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*nx+i;pos[k*3+1]=h[k];
    const hx=(h[j*nx+Math.min(nx-1,i+1)]-h[j*nx+Math.max(0,i-1)])/(2*HM.cx),hy=(h[Math.min(ny-1,j+1)*nx+i]-h[Math.max(0,j-1)*nx+i])/(2*HM.cy);
    const L=Math.hypot(hx,1,hy);nor[k*3]=-hx/L;nor[k*3+1]=1/L;nor[k*3+2]=hy/L;const c=cut[k]?HM.cc:HM.cu;col[k*3]=c.r;col[k*3+1]=c.g;col[k*3+2]=c.b}
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=g.attributes.color.needsUpdate=true;g.computeBoundingSphere();
  const wp=HM.wall.geometry.attributes.position;HM.ring.forEach((k,n)=>{wp.array[n*6+1]=h[k]});wp.needsUpdate=true}
let cellOps=0;
// Press the tool into the stock at (x, y, z). Returns the volume removed (cubic inches).
function stamp(x,y,z,t){if(z>=FACE-1e-6)return 0;const R=t.d/2,{nx,ny,cx,cy,h,cut}=HM;
  const i0=Math.max(0,Math.ceil((x-R)/cx)),i1=Math.min(nx-1,Math.floor((x+R)/cx)),j0=Math.max(0,Math.ceil((y-R)/cy)),j1=Math.min(ny-1,Math.floor((y+R)/cy));if(i0>i1||j0>j1)return 0;
  const slope=t.kind==='drill'?.6:t.kind==='spot'?1:0;let rem=0;cellOps+=(i1-i0+1)*(j1-j0+1);
  for(let j=j0;j<=j1;j++){const dy=j*cy-y;for(let i=i0;i<=i1;i++){const dx=i*cx-x,dd=dx*dx+dy*dy;if(dd>R*R)continue;const zz=slope?z+slope*Math.sqrt(dd):z,k=j*nx+i;if(zz<h[k]){rem+=h[k]-zz;h[k]=zz;cut[k]=1}}}
  if(rem>0){const D=HM.dirty;if(!D)HM.dirty={i0,i1,j0,j1};else{D.i0=Math.min(D.i0,i0);D.i1=Math.max(D.i1,i1);D.j0=Math.min(D.j0,j0);D.j1=Math.max(D.j1,j1)}}
  return rem*cx*cy}
// The finished part as the drawing describes it (for §02 and §07): faced top, pockets, holes, a 1/4 in channel around the outline.
function idealStock(p){const {nx,ny,cx,cy,h,cut}=HM;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=i*cx-M,y=j*cy-M,k=j*nx+i,dOut=sd(p.out,x,y);let z=0;
    if(dOut<=0){for(const f of p.feats){if(f.k==='pocket'&&sd(f.sh,x,y)<=0)z=Math.min(z,-pocketDepth(p,f));if(f.k==='hole'&&Math.hypot(x-f.x,y-f.y)<=f.d/2)z=Math.min(z,-(p.T+.1))}}
    else if(dOut<.25)z=-(p.T+.02);h[k]=z;cut[k]=1}
  HM.dirty={i0:0,i1:nx-1,j0:0,j1:ny-1};flushStock()}

/* work-zero axes */
const axes=new THREE.Group();scene.add(axes);
function setAxes(){axes.clear();const o=W(0,0,FACE+.01),L=.8;
  [[V(1,0,0),0xC92A2A,'X'],[V(0,0,-1),0x2B8A3E,'Y'],[V(0,1,0),0x1971C2,'Z']].forEach(([d,c,t])=>{const a=new THREE.ArrowHelper(d,o,L,c,.16,.09);axes.add(a);
    const s=textSprite(t,{fg:'#fff',bg:'#'+c.toString(16).padStart(6,'0'),h:.24});s.position.copy(o).addScaledVector(d,L+.18);axes.add(s)})}

/* chips */
const CHIPS=260,chipMesh=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.035),new THREE.MeshStandardMaterial({color:0xCCCCCC,roughness:.4,metalness:.4}),CHIPS);
chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(chipMesh);
const chips=Array.from({length:CHIPS},()=>({p:V(0,-99,0),v:V(0,0,0),life:0,r:0}));let chipNext=0;const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=V(1,1,1),_e=new THREE.Euler();
function emitChips(n,at,r){for(let k=0;k<n;k++){const c=chips[chipNext];chipNext=(chipNext+1)%CHIPS;const a=Math.random()*Math.PI*2;
  c.p.copy(at).add(V(Math.cos(a)*r,.02,Math.sin(a)*r));c.v.set(Math.cos(a+1.4)*(1.5+Math.random()*2),1+Math.random()*2.2,Math.sin(a+1.4)*(1.5+Math.random()*2));c.life=2+Math.random()*2;c.r=Math.random()*6}}
function updateChips(dt){const floor=HM.bot-.5;let any=false;
  chips.forEach((c,i)=>{if(c.life>0){any=true;c.life-=dt;c.v.y-=12*dt;c.p.addScaledVector(c.v,dt);c.r+=dt*8;
      if(c.p.y<floor){c.p.y=floor;c.v.multiplyScalar(.3);c.v.y=0}if(c.life<=0)c.p.y=-99}
    _e.set(c.r,c.r*.7,0);_q.setFromEuler(_e);_m.compose(c.p,_q,_s);chipMesh.setMatrixAt(i,_m)});
  if(any||chipMesh.userData.any)chipMesh.instanceMatrix.needsUpdate=true;chipMesh.userData.any=any}

/* toolpath lines for the current program */
const pathGroup=new THREE.Group();scene.add(pathGroup);
function showPaths(prog,sel){pathGroup.children.slice().forEach(o=>{pathGroup.remove(o);o.geometry.dispose();o.material.dispose()});if(!prog)return;
  const byOp=new Map();let p0={x:0,y:ST.Wy+.6,z:TCZ};
  for(const q of prog.moves){if(q.kind==='tc'||q.kind==='sp')continue;if(q.op<0){p0=q;continue}
    if(!byOp.has(q.op))byOp.set(q.op,{f:[],r:[]});const b=byOp.get(q.op),a=W(p0.x,p0.y,p0.z),c=W(q.x,q.y,q.z);(q.kind==='r'?b.r:b.f).push(a.x,a.y,a.z,c.x,c.y,c.z);p0=q}
  byOp.forEach((b,op)=>{const o=plan()[op];if(!o)return;const dim=sel!=null&&sel!==op,col=new THREE.Color(OPS[o.type].color);
    const gf=new THREE.BufferGeometry();gf.setAttribute('position',new THREE.Float32BufferAttribute(b.f,3));
    const lf=new THREE.LineSegments(gf,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:dim?.15:.95,depthTest:false}));lf.renderOrder=dim?3:4;pathGroup.add(lf);
    const gr=new THREE.BufferGeometry();gr.setAttribute('position',new THREE.Float32BufferAttribute(b.r,3));
    const lr=new THREE.LineSegments(gr,new THREE.LineDashedMaterial({color:0x56616C,dashSize:.08,gapSize:.06,transparent:true,opacity:dim?.08:.6,depthTest:false}));lr.renderOrder=3;lr.computeLineDistances();pathGroup.add(lr)})}

/* ---------- state: part, material, plans ---------- */
const DS0={name:'My part',kind:'rect',w:2.5,h:1.5,r:.25,T:.25,holes:[{x:.4,y:.75,d:.25}],pockets:[{k:'rect',cx:1.5,cy:.75,w:1.1,h:.7,r:.125,depth:.06,thru:false}]};
function partFromDesign(D){const w=D.kind==='circle'?D.w:D.w,h=D.kind==='circle'?D.w:D.h;
  const out=D.kind==='circle'?{k:'circle',cx:w/2,cy:w/2,r:w/2}:{k:'rect',cx:w/2,cy:h/2,w,h,r:D.kind==='slot'?Math.min(w,h)/2:Math.min(D.r,Math.min(w,h)/2)};
  const feats=[];D.pockets.forEach((q,i)=>feats.push({id:'P'+(i+1),k:'pocket',sh:q.k==='circle'?{k:'circle',cx:q.cx,cy:q.cy,r:q.w/2}:{k:'rect',cx:q.cx,cy:q.cy,w:q.w,h:q.h,r:Math.min(q.r,Math.min(q.w,q.h)/2)},depth:q.depth,thru:!!q.thru,name:'pocket'}));
  D.holes.forEach((q,i)=>feats.push({id:'H'+(i+1),k:'hole',x:q.x,y:q.y,d:q.d,name:'hole'}));
  return {name:D.name||'My part',mat:'wax',T:D.T,out,feats,mine:true}}
let DS=store.get('design',null);if(!DS||typeof DS!=='object'||!Array.isArray(DS.holes)||!Array.isArray(DS.pockets))DS=JSON.parse(JSON.stringify(DS0));
if(store.get('mineOn',false))PARTS.mine=partFromDesign(DS);
let partId=store.get('part','tag');if(!PARTS[partId])partId='tag';
let matKey=store.get('mat',PARTS[partId].mat);if(!MATS[matKey])matKey='wax';
const plans={};
{const saved=store.get('plans',{});for(const k in saved){if(!Array.isArray(saved[k]))continue;
  plans[k]=saved[k].filter(o=>o&&OPS[o.type]).map(o=>({uid:opUid++,type:o.type,feat:String(o.feat||''),tool:+o.tool||0,step:+o.step||0,feed:+o.feed||0,peck:!!o.peck,tabs:o.tabs!==false}))}}
const part=()=>PARTS[partId],mat=()=>MATS[matKey];
const plan=()=>plans[partId]||(plans[partId]=[]);
const savePlans=()=>{const o={};for(const k in plans)o[k]=plans[k].map(q=>({type:q.type,feat:q.feat,tool:q.tool,step:q.step,feed:q.feed,peck:q.peck,tabs:q.tabs}));store.set('plans',o)};
let LAST=store.get('last',null);
const best=store.get('best',{});

/* ---------- 7. simulation ---------- */
const RUN={state:'idle',prog:null,i:0,pos:{x:0,y:2,z:TCZ},clock:0,wait:0,curOp:-1,done:[],broken:false,loose:false,rpm:0,cutT:0,load:0,line:-1,feed:0,chipVol:0,badOp:-1};
let stockKind='raw';
function resetRun(quiet){Object.assign(RUN,{state:'idle',prog:null,i:0,clock:0,wait:0,curOp:-1,done:[],broken:false,loose:false,rpm:0,cutT:0,load:0,line:-1,feed:0,chipVol:0,badOp:-1});
  buildStock(part(),mat());stockKind='raw';RUN.pos={x:ST.Lx/2,y:ST.Wy+.6,z:TCZ};setTool(null);curTool=null;
  chips.forEach(c=>{c.life=0;c.p.y=-99});chipMesh.material.color.set(mat().cutc);banner(null);if(!quiet)log('Reset: new stock in the vise.');renderOpList();syncRun();refreshPaths()}
function cycleStart(){
  if(RUN.state==='hold'){RUN.state='running';log('Cycle resumed.');syncRun();return}
  if(RUN.state==='running')return;
  if(RUN.state!=='idle'||stockKind!=='raw')resetRun(true);
  const bad=checkPlan(part(),plan()).filter(x=>x[0]==='bad');
  if(bad.length){bad.forEach(b=>log(b[1],'bad'));log('Fix the plan in §03 first.','bad');banner('The plan has problems: see the Log, then fix them in §03.','bad',3500);rtab('log');return}
  RUN.prog=program(part(),mat(),plan());renderGcode(RUN.prog);RUN.state='running';RUN.i=0;RUN.pos={x:ST.Lx/2,y:ST.Wy+.6,z:TCZ};
  log(`Cycle start: ${part().name} in ${mat().short}, ${plan().length} operations, about ${mmss(RUN.prog.time)}.`);syncRun();refreshPaths()}
function opChange(n){
  if(RUN.curOp>=0){RUN.done.push(RUN.curOp);const o=plan()[RUN.curOp];
    if(o.type==='profile'&&!o.tabs){RUN.loose=true;RUN.badOp=RUN.curOp;stopRun('The part broke free as the outline was cut through, and the spinning cutter knocked it around. Scrap! Turn on tabs in the profile.','loose');return}}
  RUN.curOp=n;RUN.cutT=0;if(n>=0){const o=plan()[n];RUN.load=loadOf(o,mat());log(`Operation ${n+1}: ${OPS[o.type].name}, ${featLabel(part(),o)}, ${TOOL(o.tool).name}.`)}
  renderOpList()}
function stopRun(msg,why){RUN.state='stopped';RUN.rpm=0;log(msg,'bad');banner(msg,'bad');flash();recordResult(false);syncRun();renderOpList()}
function breakTool(msg){RUN.broken=true;RUN.badOp=RUN.curOp;breakToolLook();stopRun(msg,'broken')}
function finishRun(){RUN.state='done';RUN.rpm=0;recordResult(true);const r=LAST;
  const msg=r.status==='ok'?`Part finished in ${mmss(r.time)}. ${r.allPass?'Every size passes':'Some sizes are out of tolerance'}: see §05 Inspect.`:'Program finished, but the part was never cut out of the stock: see §05.';
  log(msg,r.allPass?'good':'bad');banner(msg,r.allPass?'good':'bad',6000);syncRun();renderOpList();setTool(null);RUN.pos.z=TCZ}
function recordResult(finished){const rec={done:RUN.done.slice(),broken:RUN.broken,loose:RUN.loose,finished,time:RUN.clock};
  LAST=Object.assign(inspect(part(),mat(),plan(),rec),{part:partId,partName:part().name,mat:matKey,badOp:RUN.badOp,load:RUN.load});store.set('last',LAST);
  if(LAST.status==='ok'&&LAST.stars>0){const k=partId+'|'+matKey,b=best[k];if(!b||LAST.stars>b.stars||(LAST.stars===b.stars&&LAST.time<b.time)){best[k]={stars:LAST.stars,time:+LAST.time.toFixed(1)};store.set('best',best);log(`New best for ${part().name} in ${mat().short}: ${'★'.repeat(LAST.stars)} ${mmss(LAST.time)}.`,'good')}}}
const CELLCAP=350000;
// Advance the machine by `budget` seconds of machine time. Without `free`, stop early when this frame has done enough cutting.
function step(budget,free){const P=RUN.prog,t=()=>TOOL(curTool);let vol=0;
  while(budget>1e-9&&RUN.state==='running'){
    if(!free&&cellOps>CELLCAP)break;
    const q=P.moves[RUN.i];if(!q){finishRun();break}
    if(q.op!==RUN.curOp){opChange(q.op);if(RUN.state!=='running')break}
    setLine(q.blk);
    if(q.kind==='tc'||q.kind==='sp'){if(RUN.wait===0){if(q.kind==='tc'){RUN.rpm=0;setTool(q.tool);log(`Tool change: ${TOOL(q.tool).name}.`)}else RUN.rpm=q.rpm}
      const use=Math.min(q.dur-RUN.wait,budget);RUN.wait+=use;budget-=use;RUN.clock+=use;if(RUN.wait>=q.dur-1e-9){RUN.wait=0;RUN.i++}continue}
    const p=RUN.pos,dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,dist=Math.hypot(dx,dy,dz),fr=q.kind==='r'?RAPID:q.f,v=fr/60;RUN.feed=fr;
    if(dist<1e-9){RUN.i++;continue}
    const adv=Math.min(dist,budget*v),tl=t();
    if(q.kind==='f'&&tl){const n=Math.max(1,Math.ceil(adv/.012));for(let s=1;s<=n;s++){const k=adv*s/n/dist;vol+=stamp(p.x+dx*k,p.y+dy*k,p.z+dz*k,tl)}}
    p.x+=dx*adv/dist;p.y+=dy*adv/dist;p.z+=dz*adv/dist;budget-=adv/v;RUN.clock+=adv/v;
    if(q.kind==='f'&&vol>0)RUN.cutT+=adv/v;
    if(adv>=dist-1e-9){RUN.i++;p.x=q.x;p.y=q.y;p.z=q.z}
    const o=plan()[RUN.curOp];
    if(o&&RUN.load>BREAK&&RUN.cutT>.6){breakTool(`Snap! The ${tl.name} broke: the tool load was ${Math.round(RUN.load*100)}%. Lower the feed or the depth per pass.`);break}
    if(o&&o.type==='drill'&&!o.peck&&tl&&p.z<-PECK*tl.d-.01&&q.kind==='f'){breakTool(`Snap! Chips packed into the hole and broke the ${tl.name}. Holes deeper than ${PECK} drill diameters need peck drilling.`);break}}
  RUN.chipVol+=vol;return vol}

/* ---------- 8. deck UI ---------- */
let deckMode='jog',camView='iso',selOp=null;
const JOG={pos:{x:1,y:1,z:1.5},goal:{x:1,y:1,z:1.5},done:[]};
const MODE_T={jog:'Jog',part:'Finished part',path:'Toolpaths',run:'Run'};
function setDeckMode(m){deckMode=m;$('#hudMode').textContent=MODE_T[m];$('#pJog').hidden=m!=='jog';$('#pRun').hidden=!(m==='path'||m==='run');
  if(m==='jog'||m==='part'){if(RUN.state==='running')RUN.state='hold';if(RUN.state!=='idle'||stockKind!=='raw')resetRun(true)}
  if(m==='jog'){setTool(4);JOG.goal=Object.assign({},JOG.pos);jogTasks()}
  if(m==='part'){setTool(null);idealStock(part());stockKind='ideal';RUN.pos={x:ST.Lx/2,y:ST.Wy+.6,z:TCZ}}
  if((m==='path'||m==='run')&&stockKind==='ideal')resetRun(true);
  axes.visible=m!=='run';target.visible=m==='jog';refreshPaths();syncRun();setView(camView)}
function setView(v){camView=v;$$('#views button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));camera.up.set(0,1,0);const d=Math.max(ST.Lx,ST.Wy);
  if(v==='iso'){camera.position.set(d*.75+2,d*.8+3.4,d*.85+3.6);controls.target.set(0,-.35,0)}
  if(v==='close'){const p=W(curPos().x,curPos().y,Math.min(curPos().z,.5));controls.target.copy(p);camera.position.copy(p).add(V(2,1.8,2.8))}
  if(v==='top'){camera.position.set(0,d*1.6+3,.01);controls.target.set(0,0,0)}
  if(v==='front'){camera.position.set(0,.9,d*1.5+3);controls.target.set(0,-.2,0)}
  controls.update()}
$$('#views button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.v)));
const curPos=()=>deckMode==='jog'?JOG.pos:RUN.pos;
function refreshPaths(){const show=(deckMode==='path'||deckMode==='run')&&$('#optPaths').checked;
  if(!show){showPaths(null);return}const bad=checkPlan(part(),plan()).some(x=>x[0]==='bad');
  showPaths(bad?null:(RUN.prog||program(part(),mat(),plan())),deckMode==='path'?selOp:null)}
$('#optPaths').addEventListener('change',refreshPaths);
function syncRun(){const s=RUN.state;$('#btnStart').disabled=s==='running';$('#btnStart').textContent=s==='hold'?'Resume':s==='done'||s==='stopped'?'Run again':'Cycle start';
  $('#btnHold').disabled=s!=='running';$('#btnSkip').disabled=s!=='running';
  $('#hudPhase').textContent=deckMode==='jog'?'Jog the axes':deckMode==='part'?`${part().name}: what you will make`:
    s==='running'?(RUN.curOp>=0?`Op ${RUN.curOp+1}: ${OPS[plan()[RUN.curOp].type].name}`:'Running'):s==='hold'?'Feed hold':s==='done'?'Finished':s==='stopped'?'Stopped':`${part().name} · ready`}
function renderOpList(){const L=plan();$('#opEmpty').hidden=L.length>0;
  $('#opList').innerHTML=L.map((o,i)=>{const c=RUN.badOp===i?'bad':RUN.done.includes(i)?'done':RUN.curOp===i&&RUN.state!=='idle'?'active':'';return `<li class="${c}">${esc(opTitle(part(),o,i))}</li>`}).join('')}
function renderGcode(prog){const pre=$('#gcode');RUN.line=-1;
  pre.innerHTML=prog.lines.map((l,n)=>`<div id="gl${n}"><span class="ln">${n+1}</span>${l.cm?`<span class="cm">${esc(l.t)}</span>`:esc(l.t)+(l.c?` <span class="cm">${esc(l.c)}</span>`:'')}</div>`).join('')}
function setLine(n){if(n===RUN.line)return;const pre=$('#gcode'),a=pre.querySelector('#gl'+RUN.line),b=pre.querySelector('#gl'+n);RUN.line=n;if(a)a.classList.remove('on');if(b){b.classList.add('on');
  if(!$('#r-gc').hidden)pre.scrollTop=b.offsetTop-pre.clientHeight/2}}
function log(msg,cls=''){const li=document.createElement('li');li.className=cls;li.innerHTML=`<time>${mmss(RUN.clock)}</time><span></span>`;li.lastChild.textContent=msg;const ul=$('#log');ul.prepend(li);while(ul.children.length>80)ul.lastChild.remove()}
let bannerT=0;function banner(msg,cls,ms){const b=$('#banner');clearTimeout(bannerT);if(!msg){b.hidden=true;return}b.hidden=false;b.className='banner '+(cls||'');b.textContent=msg;if(ms)bannerT=setTimeout(()=>b.hidden=true,ms)}
function flash(){const f=$('#flash');f.classList.add('on');setTimeout(()=>f.classList.remove('on'),80)}
function rtab(k){$$('.rtabs button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.r===k));['ops','gc','log'].forEach(n=>$('#r-'+n).hidden=n!==k);
  if(k==='gc'){const b=$('#gl'+RUN.line);if(b)$('#gcode').scrollTop=b.offsetTop-$('#gcode').clientHeight/2}}
$$('.rtabs button').forEach(b=>b.addEventListener('click',()=>rtab(b.dataset.r)));
let speedMul=+$('#optSpeed').value;$('#optSpeed').addEventListener('change',e=>speedMul=+e.target.value);
$('#btnStart').addEventListener('click',cycleStart);
$('#btnHold').addEventListener('click',()=>{if(RUN.state==='running'){RUN.state='hold';log('Feed hold.');syncRun()}});
$('#btnReset').addEventListener('click',()=>{resetRun(false);if(deckMode==='path'||deckMode==='run')renderGcode(program(part(),mat(),plan()))});
$('#btnSkip').addEventListener('click',()=>{const n=RUN.curOp;let guard=0;while(RUN.state==='running'&&RUN.curOp===n&&guard++<5000)step(5,true);flushStock()});
// jogging (§01)
const target=new THREE.Group();scene.add(target);
{const s=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:0x2B8A3E}));target.add(s);
  const g=new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,-3,0)]);const l=new THREE.Line(g,new THREE.LineDashedMaterial({color:0x2B8A3E,dashSize:.06,gapSize:.05}));l.computeLineDistances();target.add(l)}
const r1=v=>Math.round(v*10)/10;
const jogList=()=>[{x:0,y:0,z:.5,t:'Half an inch above the work zero, the front-left corner of the stock.'},{x:r1(ST.Lx/2),y:r1(ST.Wy/2),z:.1,t:'Just above the middle of the stock, 0.1 in up.'},{x:r1(ST.Lx),y:r1(ST.Wy),z:1,t:'One inch above the back-right corner of the stock.'}];
function jogTasks(){const L=jogList();$('#jogTasks').innerHTML=L.map((q,i)=>`<li class="${JOG.done.includes(i)?'ok':''}"><span class="coord">X ${f3(q.x)} · Y ${f3(q.y)} · Z ${f3(q.z)}</span><span class="small">${q.t}</span></li>`).join('');
  const n=L.findIndex((q,i)=>!JOG.done.includes(i));if(n>=0){target.visible=deckMode==='jog';target.position.copy(W(L[n].x,L[n].y,L[n].z))}else target.visible=false}
function jog(axis,dir){const st=+$('#jogStep').value,g=JOG.goal,lim={x:[-1,ST.Lx+1],y:[-1,ST.Wy+1],z:[.1,3]}[axis];g[axis]=clamp(Math.round((g[axis]+dir*st)*1e4)/1e4,lim[0],lim[1])}
$$('#pJog [data-j]').forEach(b=>b.addEventListener('click',()=>{const j=b.dataset.j;jog(j[0],j[1]==='+'?1:-1)}));
const typing=()=>{const a=document.activeElement;return a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'||a.tagName==='SELECT')};
window.addEventListener('keydown',e=>{if(deckMode!=='jog'||typing()||!view.offsetParent)return;const k={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',1],ArrowDown:['y',-1],PageUp:['z',1],PageDown:['z',-1]}[e.key];
  if(!k||document.activeElement!==canvas)return;e.preventDefault();jog(k[0],k[1])});
function jogCheck(){const L=jogList(),p=JOG.pos;L.forEach((q,i)=>{if(!JOG.done.includes(i)&&Math.abs(p.x-q.x)<1e-4&&Math.abs(p.y-q.y)<1e-4&&Math.abs(p.z-q.z)<1e-4){JOG.done.push(i);log(`Target ${i+1} reached.`,'good');jogTasks()}})}

/* ---------- 9. drawing ---------- */
let dwgN=0;
function shapeSVG(s,X,Y,sc,a){if(s.k==='circle')return `<circle cx="${X(s.cx)}" cy="${Y(s.cy)}" r="${s.r*sc}" ${a}/>`;
  return `<rect x="${X(s.cx-s.w/2)}" y="${Y(s.cy+s.h/2)}" width="${s.w*sc}" height="${s.h*sc}" rx="${Math.min(s.r,s.w/2,s.h/2)*sc}" ${a}/>`}
function drawingSVG(p,small){const b=bbox(p.out),id='m'+(dwgN++);
  const sc=small?Math.min(150/b.w,58/b.h):Math.min(400/b.w,210/b.h,160),Wd=small?170:620;
  const ox=small?(Wd-b.w*sc)/2:150,oy=small?(70-b.h*sc)/2:46,X=x=>+(ox+x*sc).toFixed(1),Y=y=>+(oy+(b.h-y)*sc).toFixed(1);
  const bg='#FBFCFD',ink='#17202A';let g='';
  g+=shapeSVG(p.out,X,Y,sc,`fill="#fff" stroke="${ink}" stroke-width="${small?1.5:2.2}"`);
  pocketsOf(p).forEach(f=>{g+=shapeSVG(f.sh,X,Y,sc,`fill="${f.thru?bg:'#E3EEF9'}" stroke="${ink}" stroke-width="${small?1:1.4}"`)});
  holesOf(p).forEach(h=>{g+=`<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${h.d/2*sc}" fill="${bg}" stroke="${ink}" stroke-width="${small?1:1.4}"/>`;
    if(!small){const e=h.d/2*sc+5;g+=`<path d="M${X(h.x)-e} ${Y(h.y)}H${X(h.x)+e}M${X(h.x)} ${Y(h.y)-e}V${Y(h.y)+e}" stroke="#868E96" stroke-width=".8" stroke-dasharray="6 2 2 2"/>`}});
  if(small)return `<svg viewBox="0 0 ${Wd} 70" aria-hidden="true">${g}</svg>`;
  const arrow=`<marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="${ink}"/></marker>`;
  const dim=(x1,y1,x2,y2,txt,tx,ty,rot)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width=".9" marker-start="url(#${id})" marker-end="url(#${id})"/><text x="${tx}" y="${ty}" text-anchor="middle"${rot?` transform="rotate(-90 ${tx} ${ty})"`:''}>${txt}</text>`;
  const ext=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#868E96" stroke-width=".7"/>`;
  const y0=Y(0),x0=X(0),x1=X(b.w),yT=Y(b.h);
  if(p.out.k==='circle'){g+=ext(x0,Y(b.h/2),x0,y0+34)+ext(x1,Y(b.h/2),x1,y0+34)+dim(x0,y0+28,x1,y0+28,`Ø${f3(b.w)} ±.010`,(x0+x1)/2,y0+23)}
  else{g+=ext(x0,y0+4,x0,y0+34)+ext(x1,y0+4,x1,y0+34)+dim(x0,y0+28,x1,y0+28,`${f3(b.w)} ±.010`,(x0+x1)/2,y0+23);
    g+=ext(x0-4,yT,x0-40,yT)+ext(x0-4,y0,x0-40,y0)+dim(x0-34,yT,x0-34,y0,`${f3(b.h)} ±.010`,x0-39,(yT+y0)/2,true)}
  // balloons
  p.feats.forEach(f=>{const cx=f.k==='hole'?f.x:f.sh.cx,cy=f.k==='hole'?f.y:f.sh.cy,ax=X(cx),ay=Y(cy),r=(f.k==='hole'?f.d/2:f.sh.k==='circle'?f.sh.r*.7:Math.min(f.sh.w,f.sh.h)*.35)*sc;
    const bx=Math.min(Wd-20,ax+r+22),by=Math.max(14,ay-r-16),col=f.k==='hole'?'#C2255C':'#7048E8';
    g+=`<line x1="${ax+r*.7}" y1="${ay-r*.7}" x2="${bx-10}" y2="${by+6}" stroke="${col}" stroke-width="1"/><rect x="${bx-15}" y="${by-9}" width="30" height="18" rx="9" fill="#fff" stroke="${col}" stroke-width="1.4"/><text x="${bx}" y="${by+4}" text-anchor="middle" fill="${col}" style="font-weight:700">${f.id}</text>`});
  // front view with hidden lines
  const fh=p.T*sc,fy=y0+60+fh,FY=z=>fy-z*sc;   // z up from the bottom of the part
  g+=`<text x="${x0}" y="${fy-fh-8}" class="t" style="font-size:10px;fill:#566370">FRONT VIEW</text><text x="${x0}" y="${yT-10}" class="t" style="font-size:10px;fill:#566370">TOP VIEW</text>`;
  g+=`<rect x="${x0}" y="${fy-fh}" width="${b.w*sc}" height="${fh}" fill="#fff" stroke="${ink}" stroke-width="2"/>`;
  pocketsOf(p).forEach(f=>{const a=X(f.sh.k==='circle'?f.sh.cx-f.sh.r:f.sh.cx-f.sh.w/2),c=X(f.sh.k==='circle'?f.sh.cx+f.sh.r:f.sh.cx+f.sh.w/2),d=Math.min(p.T,f.thru?p.T:f.depth);
    g+=`<path d="M${a} ${fy-fh}V${FY(p.T-d)}H${c}V${fy-fh}" fill="none" stroke="${ink}" stroke-width="1" stroke-dasharray="5 3"/>`});
  holesOf(p).forEach(h=>{g+=`<path d="M${X(h.x-h.d/2)} ${fy-fh}V${fy}M${X(h.x+h.d/2)} ${fy-fh}V${fy}" stroke="${ink}" stroke-width="1" stroke-dasharray="5 3"/>`});
  g+=ext(x0-4,fy-fh,x0-44,fy-fh)+ext(x0-4,fy,x0-44,fy)+`<line x1="${x0-38}" y1="${fy-fh-16}" x2="${x0-38}" y2="${fy-fh}" stroke="${ink}" stroke-width=".9" marker-end="url(#${id})"/><line x1="${x0-38}" y1="${fy+16}" x2="${x0-38}" y2="${fy}" stroke="${ink}" stroke-width=".9" marker-end="url(#${id})"/><text x="${x0-46}" y="${fy-fh/2+4}" text-anchor="end">${f3(p.T)} ±.005</text>`;
  const H=fy+56;
  g+=`<text x="${Wd-12}" y="${H-30}" text-anchor="end" class="t" style="font-size:13px">${esc(p.name.toUpperCase())}</text><text x="${Wd-12}" y="${H-14}" text-anchor="end" style="font-size:10px;fill:#566370">UNITS: INCH · TOLERANCE ±.010 UNLESS NOTED · DATUM: LOWER-LEFT CORNER</text>`;
  return `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Drawing of the ${esc(p.name)}"><defs>${arrow}</defs><rect x="1" y="1" width="${Wd-2}" height="${H-2}" fill="${bg}" stroke="#C6CFD7"/>${g}</svg>`}
const fname=(p,f)=>{if(f==='Outline')return 'Outline';const x=p.feats.find(q=>q.id===f);return x?`${f} ${x.name}`:f};
function dimTable(p,rows,measured){
  return `<thead><tr><th>Feature</th><th>Size</th><th>Drawing</th>${measured?'<th>Measured</th><th>Result</th>':''}</tr></thead><tbody>`+rows.map(r=>{
    const nom=`${r.dim==='Diameter'?'Ø':''}${f3(r.nom)} ±${f3(r.tol).replace(/^0/,'')}`;
    return `<tr class="${measured?(r.pass?'pass':'fail'):''}"><td>${esc(fname(p,r.f))}</td><td>${r.dim}</td><td class="t mono">${nom}</td>${measured?`<td class="t mono">${r.meas==null?esc(r.why):f3(r.meas)}</td><td>${r.pass?'✓ pass':'✗ fail'}</td>`:''}</tr>`}).join('')+'</tbody>'}
function renderDrawing(){const p=part();$('#dwg').innerHTML=drawingSVG(p);$('#dimTbl').innerHTML=dimTable(p,dimsOf(p),false);renderPicker();quiz2()}
function renderPicker(){const ids=PART_IDS.concat(PARTS.mine?['mine']:[]);
  $('#partPick').innerHTML=ids.map(k=>`<button data-part="${k}" aria-pressed="${k===partId}">${drawingSVG(PARTS[k],true)}<strong>${esc(PARTS[k].name)}</strong><small>${f3(PARTS[k].T)} in thick · ${PARTS[k].feats.length} features</small></button>`).join('');
  $$('#partPick [data-part]').forEach(b=>b.addEventListener('click',()=>choosePart(b.dataset.part)));
  $('#matPick').innerHTML=Object.keys(MATS).map(k=>`<button class="seg" data-mat="${k}" aria-pressed="${k===matKey}">${MATS[k].name}</button>`).join('');
  $$('#matPick [data-mat]').forEach(b=>b.addEventListener('click',()=>chooseMat(b.dataset.mat)));
  $('#matNote').textContent=`${mat().name}: ${matKey==='wax'?'soft and forgiving, used to try out programs.':matKey==='hdpe'?'a tough plastic; cuts easily but not as fast as wax.':'a real engineering metal: strong, but feeds must be much slower or tools break.'} Changing the material keeps your plan's feeds, so check the tool-load bars in §03.`}
function choosePart(k,keepMat){if(!PARTS[k])return;partId=k;if(!keepMat)matKey=PARTS[k].mat;store.set('part',k);store.set('mat',matKey);selOp=null;
  resetRun(true);if(deckMode==='part'){idealStock(part());stockKind='ideal'}renderDrawing();renderPlan();renderOpList();syncRun();setView(camView)}
function chooseMat(k){matKey=k;store.set('mat',k);resetRun(true);if(deckMode==='part'){idealStock(part());stockKind='ideal'}renderPicker();renderPlan();syncRun()}

/* ---------- 10. plan editor ---------- */
const ICON={
  face:'<svg viewBox="0 0 28 28"><rect x="3" y="15" width="22" height="9" fill="#C6CFD7"/><rect x="5" y="9" width="18" height="5" fill="#5C7CFA"/><rect x="11" y="3" width="6" height="6" fill="#868E96"/></svg>',
  spot:'<svg viewBox="0 0 28 28"><rect x="3" y="18" width="22" height="7" fill="#C6CFD7"/><path d="M10 6h8v8l-4 5-4-5z" fill="#E67700"/></svg>',
  drill:'<svg viewBox="0 0 28 28"><rect x="3" y="18" width="22" height="7" fill="#C6CFD7"/><rect x="12" y="15" width="4" height="10" fill="#fff"/><path d="M12 2h4v14l-2 3-2-3z" fill="#C2255C"/></svg>',
  pocket:'<svg viewBox="0 0 28 28"><path d="M3 12h6v6h10v-6h6v12H3z" fill="#C6CFD7"/><rect x="11" y="3" width="6" height="12" fill="#7048E8"/></svg>',
  profile:'<svg viewBox="0 0 28 28"><rect x="5" y="14" width="18" height="10" fill="#C6CFD7"/><rect x="2" y="14" width="3" height="10" fill="#fff"/><rect x="1" y="4" width="4" height="14" fill="#2B8A3E"/></svg>'};
$('#opPal').innerHTML=Object.keys(OPS).map(k=>`<button data-add="${k}" title="${esc(OPS[k].help)}">${ICON[k]}<span>${OPS[k].name}</span></button>`).join('');
$$('#opPal [data-add]').forEach(b=>b.addEventListener('click',()=>{plan().push(newOp(b.dataset.add,part(),mat(),plan()));selOp=plan().length-1;planChanged()}));
$('#planAuto').onclick=()=>{plans[partId]=autoPlan(part(),mat());selOp=null;planChanged();log('Example plan loaded.')};
$('#planClear').onclick=()=>{if(!plan().length||confirm('Clear every operation in the plan?')){plans[partId]=[];selOp=null;planChanged()}};
$('#planGo').onclick=()=>goTo('run');
function planChanged(){savePlans();if(RUN.state!=='idle'||stockKind!=='raw'){if(deckMode==='part')RUN.state='idle';else resetRun(true)}
  renderPlan();renderOpList();refreshPaths();if(!checkPlan(part(),plan()).some(x=>x[0]==='bad'))renderGcode(program(part(),mat(),plan()));else $('#gcode').innerHTML='<div><span class="cm">(fix the plan in §03 to see its G-code)</span></div>'}
function renderPlan(){const p=part(),m=mat(),L=plan();$('#planPart').textContent=`${p.name} in ${m.name}`;
  const chk=checkPlan(p,L),ok=!chk.some(x=>x[0]==='bad'),prog=ok?program(p,m,L):null;
  $('#opCards').innerHTML=L.length?L.map((o,i)=>{const t=TOOL(o.tool),O=OPS[o.type],load=loadOf(o,m),kinds=O.kinds;
    let feat='';if(o.type==='drill')feat=`<label>Holes<select data-k="feat">${holeGroups(p).map(g=>`<option value="${g.key}"${g.key===o.feat?' selected':''}>${g.holes.map(h=>h.id).join(', ')}: ${dia(g.d)}</option>`).join('')}</select></label>`;
    if(o.type==='pocket')feat=`<label>Pocket<select data-k="feat">${pocketsOf(p).map(f=>`<option value="${f.id}"${f.id===o.feat?' selected':''}>${f.id} (${f.name})</option>`).join('')}</select></label>`;
    const tools=`<label>Tool<select data-k="tool">${!t?`<option value="0" selected>choose a ${o.type==='drill'?'drill':'tool'}…</option>`:''}${TOOLS.filter(x=>kinds.includes(x.kind)).map(x=>`<option value="${x.id}"${x.id===o.tool?' selected':''}>T${x.id} ${x.name}</option>`).join('')}</select></label>`;
    const step=t&&(t.kind==='em'||t.kind==='face')?`<label>Depth per pass (in)<input type="number" data-k="step" min="0.005" max="1" step="0.01" value="${o.step}"></label>`:'';
    const feed=`<label>Feed (in/min)<input type="number" data-k="feed" min="1" max="400" step="1" value="${o.feed}"></label>`;
    const box=o.type==='drill'?`<label class="tog"><input type="checkbox" data-k="peck"${o.peck?' checked':''}> Peck drill</label>`:o.type==='profile'?`<label class="tog"><input type="checkbox" data-k="tabs"${o.tabs?' checked':''}> Leave tabs</label>`:'';
    const col=load>BREAK?'#C92A2A':load>RISKY?'#E67700':'#2B8A3E';
    const meta=t?`<span>${rpmOf(t,m).toLocaleString()} rpm</span>${prog?`<span>${mmss(prog.opTime[i])}</span>`:''}<span class="gauge"><span>Tool load <strong style="color:${col}">${Math.round(load*100)}%</strong>${load>BREAK?' · will break':load>RISKY?' · risky':''}</span><i><b style="width:${Math.min(100,load/1.25*100)}%;background:${col}"></b></i></span>`:'';
    return `<div class="opc${i===selOp?' sel':''}${RUN.state!=='idle'&&RUN.curOp===i?' run':''}" data-i="${i}" style="--c:${O.color}"><div class="hd"><span class="num">${i+1}</span><strong>${O.name}</strong><span class="small muted">${esc(featLabel(p,o))}</span>
      <span class="tools"><button data-mv="-1" aria-label="Move up">▲</button><button data-mv="1" aria-label="Move down">▼</button><button data-del aria-label="Delete">✕</button></span></div>
      <div class="flds">${feat}${tools}${step}${feed}${box}</div><div class="meta">${meta}</div><div class="small muted">${O.help}</div></div>`}).join(''):'<p class="small muted">No operations yet. Add them with the buttons on the left, in the order the machine should do them, or load the example plan.</p>';
  $('#planCheck').innerHTML=chk.length?chk.map(([c,t])=>`<li class="${c==='bad'?'bad':''}">${c==='bad'?'✗':'!'} ${esc(t)}</li>`).join(''):'<li class="ok">✓ Every feature is in the plan. Ready to machine.</li>';
  const tc=L.filter((o,i)=>i===0||o.tool!==L[i-1].tool).length;
  $('#planEst').innerHTML=prog?`Cycle time about <strong>${mmss(prog.time)}</strong> (target for three stars: ${mmss(targetTime(p,m))}). ${tc} tool change${tc===1?'':'s'}; ${prog.lines.length} lines of G-code.`:'Fix the problems marked ✗ to see the estimate.';
  $('#planGo').disabled=!ok}
$('#opCards').addEventListener('click',e=>{const c=e.target.closest('.opc');if(!c)return;const i=+c.dataset.i,L=plan();
  if(e.target.closest('[data-del]')){L.splice(i,1);selOp=null;planChanged();return}
  const mv=e.target.closest('[data-mv]');if(mv){const j=i+ +mv.dataset.mv;if(j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];selOp=j;planChanged();return}
  if(e.target.closest('input,select,label'))return;selOp=selOp===i?null:i;$$('#opCards .opc').forEach(x=>x.classList.toggle('sel',+x.dataset.i===selOp));refreshPaths()});
$('#opCards').addEventListener('change',e=>{const el=e.target,k=el.dataset.k;if(!k)return;const i=+el.closest('.opc').dataset.i,o=plan()[i];
  if(k==='tool'){o.tool=+el.value;speeds(o,mat())}else if(k==='feat')o.feat=el.value;else if(k==='peck'||k==='tabs')o[k]=el.checked;
  else{const v=parseFloat(el.value);if(isFinite(v)&&v>0)o[k]=k==='feed'?Math.round(Math.min(400,v)):Math.min(1,+v.toFixed(3))}
  selOp=i;planChanged()});

/* ---------- 11. designer (§07) ---------- */
const DRILL_OPTS=d=>DRILL_SIZES.map(x=>`<option value="${x}"${Math.abs(x-d)<1e-6?' selected':''}>Ø${f3(x)}</option>`).join('');
function designCheck(D){const p=partFromDesign(D),out=[],o=p.out;
  pocketsOf(p).forEach(f=>{const s=f.sh,mn=s.k==='circle'?2*s.r:Math.min(s.w,s.h);
    if(mn<.3)out.push(['bad',`${f.id} is too small: make it at least 0.3 in across so an end mill fits.`]);
    if(s.k==='rect'&&s.r<.0625-1e-9)out.push(['bad',`${f.id}: the corner radius must be at least 0.0625 in (the radius of the smallest end mill).`]);
    if(contourPts(contour(s,true),.05).some(q=>sd(o,q.x,q.y)>-.06))out.push(['bad',`${f.id} runs outside the part, or leaves a wall thinner than 0.06 in.`]);
    if(!f.thru&&(f.depth<.02||f.depth>p.T-.05))out.push(['bad',`${f.id}: the depth must be between 0.02 in and ${f3(p.T-.05)} in (or tick "through").`])});
  holesOf(p).forEach((h,i,a)=>{if(sd(o,h.x,h.y)>-(h.d/2+.06))out.push(['bad',`${h.id} is too close to the edge, or outside the part.`]);
    a.slice(i+1).forEach(g=>{if(Math.hypot(h.x-g.x,h.y-g.y)<(h.d+g.d)/2+.06)out.push(['bad',`${h.id} and ${g.id} overlap.`])});
    pocketsOf(p).forEach(f=>{const d=sd(f.sh,h.x,h.y);if(d>-h.d/2&&d<h.d/2+.06)out.push(['bad',`${h.id} cuts into the edge of ${f.id}: put it fully inside the pocket, or at least 0.06 in away.`])})});
  if(!out.length)out.push(['ok','The design is ready: press Use my part.']);return out}
function renderDesigner(){const D=DS,isC=D.kind==='circle';
  $('#dsgMain').innerHTML=`<label>Name<input type="text" data-ds="name" maxlength="28" value="${esc(D.name)}"></label>
    <label>Outline<select data-ds="kind">${[['rect','Rounded rectangle'],['slot','Slot (round ends)'],['circle','Circle']].map(([v,t])=>`<option value="${v}"${D.kind===v?' selected':''}>${t}</option>`).join('')}</select></label>
    <label>${isC?'Diameter':'Length'} (in)<input type="number" data-ds="w" step="0.05" min="1" max="${isC?3:4}" value="${D.w}"></label>
    ${isC?'':`<label>Width (in)<input type="number" data-ds="h" step="0.05" min="0.5" max="3" value="${D.h}"></label>`}
    ${D.kind==='rect'?`<label>Corner radius (in)<input type="number" data-ds="r" step="0.0625" min="0" max="1" value="${D.r}"></label>`:''}
    <label>Thickness<select data-ds="T">${[.25,.375,.5].map(t=>`<option value="${t}"${Math.abs(D.T-t)<1e-6?' selected':''}>${f3(t)} in</option>`).join('')}</select></label>`;
  $('#dsgHoles').innerHTML='<thead><tr><th></th><th>x</th><th>y</th><th>Size</th><th></th></tr></thead><tbody>'+D.holes.map((h,i)=>`<tr><td><span class="bal" style="color:#C2255C">H${i+1}</span></td><td><input type="number" step="0.05" data-h="${i}:x" value="${h.x}"></td><td><input type="number" step="0.05" data-h="${i}:y" value="${h.y}"></td><td><select data-h="${i}:d">${DRILL_OPTS(h.d)}</select></td><td><button data-hdel="${i}" aria-label="Delete H${i+1}">✕</button></td></tr>`).join('')+'</tbody>';
  $('#dsgPockets').innerHTML='<thead><tr><th></th><th>Shape</th><th>x</th><th>y</th><th>L / Ø</th><th>W</th><th>R</th><th>Depth</th><th>Thru</th><th></th></tr></thead><tbody>'+D.pockets.map((q,i)=>`<tr><td><span class="bal" style="color:#7048E8">P${i+1}</span></td>
    <td><select data-p="${i}:k" aria-label="P${i+1} shape"><option value="rect"${q.k==='rect'?' selected':''}>rect</option><option value="circle"${q.k==='circle'?' selected':''}>circle</option></select></td>
    <td><input type="number" step="0.05" data-p="${i}:cx" value="${q.cx}"></td><td><input type="number" step="0.05" data-p="${i}:cy" value="${q.cy}"></td><td><input type="number" step="0.05" min="0.3" data-p="${i}:w" value="${q.w}"></td>
    <td>${q.k==='rect'?`<input type="number" step="0.05" min="0.3" data-p="${i}:h" value="${q.h}">`:''}</td><td>${q.k==='rect'?`<input type="number" step="0.0625" min="0.0625" data-p="${i}:r" value="${q.r}">`:''}</td>
    <td>${q.thru?'':`<input type="number" step="0.01" min="0.02" data-p="${i}:depth" value="${q.depth}">`}</td><td><input type="checkbox" data-p="${i}:thru"${q.thru?' checked':''} aria-label="P${i+1} goes through"></td><td><button data-pdel="${i}" aria-label="Delete P${i+1}">✕</button></td></tr>`).join('')+'</tbody>';
  $('#dsgAddHole').disabled=D.holes.length>=6;$('#dsgAddPocket').disabled=D.pockets.length>=3;
  const chk=designCheck(D);$('#dsgCheck').innerHTML=chk.map(([c,t])=>`<li class="${c==='ok'?'ok':'bad'}">${c==='ok'?'✓':'✗'} ${esc(t)}</li>`).join('');$('#dsgUse').disabled=chk[0][0]!=='ok';
  $('#dsgDwg').innerHTML=drawingSVG(partFromDesign(D))}
const dsSave=()=>{store.set('design',DS);renderDesigner()};
$('#dsg').addEventListener('change',e=>{const el=e.target;const num=v=>{v=parseFloat(v);return isFinite(v)?Math.round(v*10000)/10000:null};
  if(el.dataset.ds){const k=el.dataset.ds;if(k==='name')DS.name=el.value.slice(0,28)||'My part';else if(k==='kind')DS.kind=el.value;else{const v=num(el.value);if(v!=null)DS[k]=k==='w'?clamp(v,1,DS.kind==='circle'?3:4):k==='h'?clamp(v,.5,3):k==='r'?clamp(v,0,1.5):v}dsSave();return}
  if(el.dataset.h){const [i,k]=el.dataset.h.split(':'),h=DS.holes[+i];const v=num(el.value);if(v!=null)h[k]=k==='d'?v:clamp(v,0,4);dsSave();return}
  if(el.dataset.p){const [i,k]=el.dataset.p.split(':'),q=DS.pockets[+i];if(k==='k')q.k=el.value;else if(k==='thru')q.thru=el.checked;else{const v=num(el.value);if(v!=null)q[k]=k==='depth'?clamp(v,.01,.5):k==='r'?clamp(v,.0625,1.5):clamp(v,0,4)}dsSave()}});
$('#dsg').addEventListener('click',e=>{const h=e.target.closest('[data-hdel]'),p=e.target.closest('[data-pdel]');if(h){DS.holes.splice(+h.dataset.hdel,1);dsSave()}if(p){DS.pockets.splice(+p.dataset.pdel,1);dsSave()}});
$('#dsgAddHole').onclick=()=>{const w=DS.w,h=DS.kind==='circle'?DS.w:DS.h;DS.holes.push({x:+(w*.2).toFixed(2),y:+(h/2).toFixed(2),d:.25});dsSave()};
$('#dsgAddPocket').onclick=()=>{const w=DS.w,h=DS.kind==='circle'?DS.w:DS.h;DS.pockets.push({k:'circle',cx:+(w/2).toFixed(2),cy:+(h/2).toFixed(2),w:.5,h:.5,r:.125,depth:.06,thru:false});dsSave()};
$('#dsgReset').onclick=()=>{if(confirm('Start your design over?')){DS=JSON.parse(JSON.stringify(DS0));dsSave()}};
$('#dsgUse').onclick=()=>{PARTS.mine=partFromDesign(DS);store.set('mineOn',true);plans.mine=[];savePlans();choosePart('mine');goTo('draw')};

/* ---------- 12. sections ---------- */
// §01 tool rack
const TOOL_ICON={face:'<svg viewBox="0 0 44 64"><rect x="16" y="2" width="12" height="34" fill="#AEB6BE"/><rect x="2" y="36" width="40" height="14" rx="2" fill="#3B434B"/><rect x="4" y="46" width="7" height="6" fill="#D4A72C"/><rect x="33" y="46" width="7" height="6" fill="#D4A72C"/></svg>',
  em:'<svg viewBox="0 0 44 64"><rect x="15" y="2" width="14" height="26" fill="#8E969E"/><rect x="15" y="28" width="14" height="32" fill="#9AA2AA"/><path d="M15 34l14-6M15 42l14-6M15 50l14-6M15 58l14-6" stroke="#4A5259" stroke-width="2.5"/></svg>',
  spot:'<svg viewBox="0 0 44 64"><rect x="14" y="2" width="16" height="34" fill="#8E969E"/><rect x="14" y="36" width="16" height="12" fill="#D4A72C"/><path d="M14 48h16l-8 10z" fill="#D4A72C"/></svg>',
  drill:'<svg viewBox="0 0 44 64"><rect x="17" y="2" width="10" height="18" fill="#8E969E"/><rect x="17" y="20" width="10" height="36" fill="#9AA2AA"/><path d="M17 26l10-5M17 34l10-5M17 42l10-5M17 50l10-5" stroke="#4A5259" stroke-width="2"/><path d="M17 56h10l-5 6z" fill="#9AA2AA"/></svg>'};
$('#toolRack').innerHTML=[TOOL(1),TOOL(2),TOOL(4),TOOL(5),TOOL(6)].map(t=>`<div>${TOOL_ICON[t.kind]}<span><strong>T${t.id} ${t.name}</strong><br><span class="muted">${t.job}</span></span></div>`).join('')+
  `<div>${TOOL_ICON.drill}<span><strong>T7–T13 drills</strong><br><span class="muted">Seven sizes from Ø0.125 to Ø0.500. A drill makes a hole exactly its own size.</span></span></div>`;
function quiz(box,Q,title){box.innerHTML=`<span class="eyebrow">${title}</span>`+Q.map((x,i)=>`<div class="q" data-q="${i}"><div><strong>${i+1}.</strong> ${x.q}</div><div class="opts">${x.o.map((o,j)=>`<button data-o="${j}">${o}</button>`).join('')}</div><div class="fb"></div></div>`).join('');
  box.querySelectorAll('.q').forEach(d=>{const x=Q[+d.dataset.q];d.querySelectorAll('[data-o]').forEach(b=>b.addEventListener('click',()=>{const j=+b.dataset.o,ok=j===x.a;
    d.querySelector('.fb').innerHTML=`<span class="${ok?'c-ok':'c-bad'}"><strong>${ok?'Yes.':'Not quite.'}</strong></span> ${x.why[j]}`;b.blur()}))})}
quiz($('#quiz1'),[
  {q:'Which axis moves the tool up and down?',o:['X','Y','Z'],a:2,why:['X moves left and right.','Y moves front and back.','Right: Z is up and down. Z 0 is the top of the finished part, so cutting depths are negative.']},
  {q:'What is decided in the CAM step?',o:['the sizes of the part','the cuts: which tools, in what order, how deep and how fast','what colour the machine is'],a:1,why:['The sizes come from the drawing (CAD).','Right: CAM turns the drawing into a cutting plan, and then into G-code.','No: CAM is about how the part is cut.']},
  {q:'The position shows X 0.0000, Y 0.0000. Where is the tool?',o:['over the work zero: the front-left corner of the stock','over the middle of the stock','at the back-right corner'],a:0,why:['Right: everything in the program is measured from that corner.','The middle is about half the stock\'s length and width.','The back-right corner has the largest X and Y.']}],'Quick check');
function quiz2(){const p=part(),h=holesOf(p)[0],Q=[];
  Q.push({q:`How thick must the finished ${p.name.toLowerCase()} be?`,o:[`${f3(p.T)} in`,`${f3(p.T+FACE)} in`,`${f3(stockOf(p).H)} in`],a:0,why:['Right: the front view says so, ±0.005 in.',`That is the part before the top is faced: 0.05 in too thick.`,'That is the whole block of stock, before machining.']});
  if(h){const others=DRILL_SIZES.filter(d=>Math.abs(d-h.d)>1e-6),o=[h.d,others[(others.findIndex(d=>d>h.d)+others.length)%others.length],others[0]===h.d?others[1]:others[0]];
    const order=[0,1,2].sort((a,b)=>o[a]-o[b]);Q.push({q:`Which drill makes hole ${h.id}?`,o:order.map(k=>`Ø${f3(o[k])}`),a:order.indexOf(0),why:order.map(k=>k===0?`Right: the table says ${h.id} is Ø${f3(h.d)}, and a drill makes a hole its own size.`:`A Ø${f3(o[k])} drill makes a Ø${f3(o[k])} hole: outside the ±0.003 tolerance.`)})}
  quiz($('#quiz2'),Q,'Read the drawing')}
// §05 inspection
function renderInspect(){const r=LAST,el=$('#inspOut');
  if(!r||!PARTS[r.part]){el.innerHTML='<div class="sheet"><p>No part yet. Plan one in §03, then press Cycle start in §04.</p></div>';return}
  const p=PARTS[r.part],m=MATS[r.mat],tips=[];
  const fails=r.rows.filter(x=>!x.pass),failKey=k=>fails.some(x=>x.key.endsWith(k));
  if(r.status==='broken')tips.push(`A tool broke in operation ${r.badOp+1}. Lower its feed or its depth per pass until the tool-load bar is out of the red.`);
  if(r.status==='loose')tips.push('The part came loose when the outline was cut through. Tick "Leave tabs" in the profile operation.');
  if(r.status==='notcut')tips.push('The outline was never cut, so the part is still part of the stock. Add a profile operation at the end.');
  if(r.status==='ok'||r.status==='stopped'){
    if(!r.faced&&fails.some(x=>x.key==='out:T'||x.key.endsWith(':Z')))tips.push('The part is 0.05 in too thick and the pockets 0.05 in too deep: the top was never faced. Face it first, so Z 0 is the real top.');
    if(fails.some(x=>/H\d:[XY]/.test(x.key))&&!r.plan.some(o=>o.type==='spot'))tips.push('Hole positions are off: without a spot drill, a drill wanders as it starts. Add a spot drill operation before the drills.');
    fails.filter(x=>/H\d:D/.test(x.key)&&x.meas!=null).forEach(x=>tips.push(`${x.f} came out Ø${f3(x.meas)}: the drill was the wrong size. Use the Ø${f3(x.nom)} drill.`));
    fails.filter(x=>/P\d:R/.test(x.key)&&x.meas!=null).forEach(x=>tips.push(`${x.f}'s corners are too round: an end mill leaves its own radius in a corner. Use a smaller end mill (radius ${f3(x.nom)} in or less).`));
    if(r.profI>=0&&r.plan.some((o,i)=>i>r.profI))tips.push('Some operations ran after the profile, while the part was held only by its tabs: it shook and those sizes are off. Cut the outline last.');
    fails.filter(x=>x.why).forEach(x=>tips.push(`${x.f}: ${x.why}. Add an operation for it.`))}
  if(r.status==='ok'&&r.allPass&&r.time>r.target)tips.push(`Every size passes. To earn the third star, cut the cycle time from ${mmss(r.time)} to under ${mmss(r.target)}: raise feeds and depths per pass, but keep the tool-load bars out of the red.`);
  const head={ok:r.allPass?'The part passes inspection.':'The part was made, but some sizes are out of tolerance.',broken:'Run stopped: a tool broke.',loose:'Scrap: the part came loose.',stopped:'The run did not finish.',notcut:'The part was never cut out.'}[r.status];
  el.innerHTML=`<div class="result ${r.status==='ok'&&r.allPass?'good':'bad'}"><div class="stars">${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(3-r.stars)}</span></div>
    <strong>${head}</strong><span class="small">${esc(p.name)} in ${m.name} · cycle time ${mmss(r.time)} (three-star target ${mmss(r.target)}) · ${r.rows.filter(x=>x.pass).length} of ${r.rows.length} sizes pass</span>
    ${tips.length?`<ul class="small">${[...new Set(tips)].map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
    <div class="btns"><button data-go="cam">◀ Change the plan (§03)</button><button class="primary" data-go="run">Machine it again (§04)</button></div></div>
    <div class="grid2"><div class="dwg">${drawingSVG(p)}</div><div class="sheet small"><span class="eyebrow">Measured</span><div class="tbl"><table class="dims">${dimTable(p,r.rows,true)}</table></div></div></div>`;
  el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.go)))}
// §06 best results
function renderBest(){const ids=PART_IDS.concat(PARTS.mine?['mine']:[]);let rows='';
  ids.forEach(k=>Object.keys(MATS).forEach(mk=>{const b=best[k+'|'+mk],t=targetTime(PARTS[k],MATS[mk]);
    rows+=`<tr><td>${esc(PARTS[k].name)}</td><td>${MATS[mk].name}</td><td><span class="stars" style="font-size:1.05rem">${'★'.repeat(b?b.stars:0)}<span class="off">${'★'.repeat(3-(b?b.stars:0))}</span></span></td><td class="t">${b?mmss(b.time):'—'}</td><td class="t">${mmss(t)}</td><td><button data-try="${k}|${mk}">Make it</button></td></tr>`}));
  $('#bestTbl').innerHTML='<thead><tr><th>Part</th><th>Material</th><th>Best</th><th>Time</th><th>Target</th><th></th></tr></thead><tbody>'+rows+'</tbody>';
  $$('#bestTbl [data-try]').forEach(b=>b.addEventListener('click',()=>{const [k,mk]=b.dataset.try.split('|');partId=k;matKey=mk;choosePart(k,true);store.set('mat',mk);goTo('cam')}))}

/* pages: one section at a time; the deck moves to the section shown */
const SHORT={plan:'Plan',meet:'Meet the machine',draw:'Read the drawing',cam:'Plan the job',run:'Machine it',insp:'Inspect',chal:'Challenges',dsg:'Design a part',exit:'Exit ticket'};
const SECS=[...document.querySelectorAll('.wrap > section')];
const nav={paged:store.get('paged',true)!==false,cur:null};
const secName=s=>s.querySelector('h2 .n').textContent+' '+(SHORT[s.id]||s.id);
$('#lnav').innerHTML=`<button id="navBack" aria-label="Previous section">◀</button><div class="tabsrow">${SECS.map(s=>`<button data-go="${s.id}">${secName(s)}</button>`).join('')}</div><button id="navNext" aria-label="Next section">▶</button><button id="navMode"></button>`;
SECS.forEach((s,i)=>{const d=document.createElement('div');d.className='pager';
  d.innerHTML=(i>0?`<button data-go="${SECS[i-1].id}">◀ ${secName(SECS[i-1])}</button>`:'')+(i<SECS.length-1?`<button class="primary nextbtn" data-go="${SECS[i+1].id}">Next: ${secName(SECS[i+1])} ▶</button>`:'<span class="muted small">End of the lesson.</span>');s.append(d)});
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.go)));
function placeDeck(sec){const slot=sec&&sec.querySelector('.deckslot');if(!slot)return;if(slot.firstChild!==$('#deck'))slot.appendChild($('#deck'));setDeckMode(slot.dataset.mode)}
function goTo(id,noscroll){
  const i=SECS.findIndex(s=>s.id===id);if(i<0)return;nav.cur=id;store.set('sec',id);
  document.body.classList.toggle('paged',nav.paged);SECS.forEach(s=>s.hidden=nav.paged&&s.id!==id);
  document.querySelector('header.top').hidden=nav.paged&&i>0;
  if(nav.paged)placeDeck(SECS[i]);else if(!$('#deck').parentNode.classList.contains('deckslot'))placeDeck(SECS.find(s=>s.querySelector('.deckslot')));
  navMark(id);$('#navBack').disabled=i===0;$('#navNext').disabled=i===SECS.length-1;$('#navMode').textContent=nav.paged?'Show all':'One at a time';
  if(id==='draw')renderDrawing();if(id==='cam')renderPlan();if(id==='insp')renderInspect();if(id==='chal')renderBest();if(id==='dsg')renderDesigner();
  resize();if(noscroll)return;if(nav.paged)window.scrollTo(0,0);else $('#'+id).scrollIntoView()}
function navMark(id){document.querySelectorAll('#lnav [data-go]').forEach(b=>b.setAttribute('aria-current',b.dataset.go===id));
  const row=document.querySelector('#lnav .tabsrow'),b=row.querySelector(`[data-go="${id}"]`);if(b)row.scrollLeft=b.offsetLeft-row.clientWidth/2+b.offsetWidth/2}
const stepSec=d=>{const i=SECS.findIndex(s=>s.id===nav.cur)+d;if(i>=0&&i<SECS.length)goTo(SECS[i].id)};
$('#navBack').onclick=()=>stepSec(-1);$('#navNext').onclick=()=>stepSec(1);
$('#navMode').onclick=()=>{nav.paged=!nav.paged;store.set('paged',nav.paged);goTo(nav.cur)};
{const io=new IntersectionObserver(es=>{if(nav.paged)return;const v=es.find(e=>e.isIntersecting);if(v){nav.cur=v.target.id;navMark(v.target.id);store.set('sec',v.target.id);
  const slot=v.target.querySelector('.deckslot');if(slot&&slot.firstChild!==$('#deck'))placeDeck(v.target)}},{rootMargin:'-70px 0px -60% 0px'});SECS.forEach(s=>io.observe(s))}

/* ---------- 13. loop / boot ---------- */
function resize(){const r=view.getBoundingClientRect();if(!r.width)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(view);
const _prev=V(0,0,0);let last=performance.now(),lastUI=0;
function ui(){const p=curPos();$('#dX').textContent=f4(p.x);$('#dY').textContent=f4(p.y);$('#dZ').textContent=f4(p.z);
  const t=TOOL(curTool);$('#mT').textContent=t?`T${t.id} ${t.kind==='drill'?dia(t.d):t.name.replace(/ (end|face) mill| spot drill/,m=>m===' spot drill'?' spot':' '+m.trim().split(' ')[0])}`:'—';
  $('#mS').textContent=`${(deckMode==='run'||deckMode==='path')?RUN.rpm.toLocaleString():0} rpm`;$('#mF').textContent=RUN.state==='running'?`${Math.round(RUN.feed)} in/min`:'—';
  const on=(RUN.state==='running'||RUN.state==='hold'||RUN.state==='stopped')&&RUN.curOp>=0&&(deckMode==='run'||deckMode==='path'),L=on?RUN.load:0,col=L>BREAK?'#C92A2A':L>RISKY?'#E67700':'#2B8A3E';
  $('#gLoad').style.width=`${Math.min(100,L/1.25*100)}%`;$('#gLoad').style.background=col;$('#gLoadT').textContent=on?`${Math.round(L*100)}%${L>BREAK?' · too much!':L>RISKY?' · risky':''}`:'—';
  $('#hudClock').textContent=`Cycle ${mmss(RUN.clock)}${RUN.prog?' / '+mmss(RUN.prog.time):''}`;syncRun()}
function frame(now){const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;requestAnimationFrame(frame);
  cellOps=0;if(RUN.state==='running')step(dt*speedMul,false);
  if(deckMode==='jog'){const p=JOG.pos,g=JOG.goal;let moving=false;['x','y','z'].forEach(a=>{const d=g[a]-p[a];if(Math.abs(d)>1e-6){moving=true;p[a]+=Math.sign(d)*Math.min(Math.abs(d),4*dt)}});if(!moving)jogCheck()}
  if(!view.offsetParent)return;
  flushStock();const p=curPos();_prev.copy(head.position);placeHead(p.x,p.y,p.z);
  if(toolObj){const spin=(deckMode==='run'||deckMode==='path')&&RUN.rpm>0&&RUN.state==='running';toolObj.rotation.y+=spin?dt*40:0}
  if(RUN.chipVol>0&&RUN.state==='running'){const t=TOOL(curTool);emitChips(Math.min(6,Math.ceil(RUN.chipVol*4000)),head.position,t?t.d/2:.1);RUN.chipVol=0}
  updateChips(dt);
  if(camView==='close'){const d=head.position.clone().sub(_prev);d.y=Math.min(0,d.y)*0;controls.target.add(d);camera.position.add(d)}
  controls.update();renderer.render(scene,camera);
  if(now-lastUI>100){lastUI=now;ui()}}
// boot
buildStock(part(),mat());resetRun(true);
renderPicker();renderPlan();renderOpList();renderGcode(checkPlan(part(),plan()).some(x=>x[0]==='bad')?{lines:[{t:'(build a plan in §03 to see its G-code)',cm:1}]}:program(part(),mat(),plan()));
log('Machine ready. Stock clamped in the vise.');
{const saved=store.get('sec',null);goTo(SECS.some(s=>s.id===saved)?saved:SECS[0].id,true)}
resize();setView('iso');requestAnimationFrame(frame);
})();
