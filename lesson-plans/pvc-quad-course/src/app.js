/* PVC Quad Course lesson — application script.
   ============================================================
   TABLE OF CONTENTS
   1. Helpers         — DOM, storage, coordinates (students' x, y, height ↔ three.js x, y-up, z)
   2. Scene           — renderer, cage; the course as data (students' coordinates) and buildCourse()
   3. Drone model     — makeDrone(): body, props, thrust arrows, claw (used by the deck and the mini-lab)
   4. Geometry        — clearance, nearest obstacle
   5. Planner         — 3D A* on a 4 in grid with a recorded search, line-of-sight straightening
   6. Levels          — challenge levels, gate passing, scoring, best scores
   7. Missions        — autopilot and "my path" leg lists
   8. Flight          — sensors, path following, manual control, physics, collisions
   9. Deck UI         — modes, buttons, panels, cameras, drone-cam inset, autopilot "thinking" view (§04)
   10. Course maps    — top map and side view of the course (shared by §02 and §07), §02's course list
   11. Path editor    — §02 waypoints on the maps, waypoint table, pre-flight check
   12. Blocks         — §03 block editor, Python-style view, the program runner (a generator, one block at a time)
   13. Designer       — §07 course designer, course check, course code; applyCourse()
   14. Mini-lab       — §01 drone with four motor sliders
   15. Quiz           — §01 check questions
   16. Pages          — one section at a time; the deck moves to the section shown
   17. Loop / boot
   ============================================================ */
(function(){
"use strict";

/* ---------- 1. helpers ---------- */
const $=s=>document.querySelector(s);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const store={get(k,d){try{const v=localStorage.getItem('pvcq.'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('pvcq.'+k,JSON.stringify(v))}catch(e){/* storage unavailable */}}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1=x=>(Math.abs(x)<.05?0:x).toFixed(1);
// Students use (x east, y north, height); three.js uses (x, y up, z south). So world = (x, height, −y).
const W=(x,y,h)=>V(x,h,-y);
const S3=v=>({x:v.x,y:-v.z,h:v.y});
const fmtP=v=>{const s=S3(v);return `(${f1(s.x)}, ${f1(s.y)}, ${f1(s.h)})`};

const G=32.17;            // gravity, ft/s²
const DR=0.48;            // drone collision radius, ft
const INFL=0.62;          // planner clearance, ft
const RES=1/3, NX=30, NY=60, NZ=30;   // planner grid: 4 in cells over 10 × 20 × 10 ft
const CUBE=1/3, CUBE_H=CUBE/2, HOLD=0.45, GROUND=0.30;
const PAD_R=0.8;          // landing pad radius, ft

/* ---------- 2. scene ---------- */
const view=$('#view'), canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xE3E8ED);
const camera=new THREE.PerspectiveCamera(45,1,0.05,200);
camera.position.set(15,13,17);
const controls=new THREE.OrbitControls(camera,canvas);
controls.target.set(0,6,0); controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.495; controls.minDistance=1.5; controls.maxDistance=45; controls.update();
const pipCam=new THREE.PerspectiveCamera(70,1.6,0.05,100);

scene.add(new THREE.HemisphereLight(0xffffff,0xaab4be,0.78));
const sun=new THREE.DirectionalLight(0xffffff,0.72); sun.position.set(7,26,9); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:60}); sun.shadow.bias=-0.0008;
scene.add(sun);

const rayTargets=[];          // meshes the range sensors can see
const segs=[];                // PVC pipe capsules {a,b,r,name}
const boxes=[];               // solid boxes {min,max,name}

function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function textSprite(txt,{fg='#17202A',bg='rgba(255,255,255,0.9)',h=0.55}={}){
  const fs=72,pad=26,font=`700 ${fs}px Arial, sans-serif`;
  const m=document.createElement('canvas').getContext('2d');m.font=font;const w=Math.ceil(m.measureText(txt).width)+pad*2,H=112;
  const tex=canvasTex(w,H,(ctx)=>{ctx.fillStyle=bg;rrect(ctx,2,2,w-4,H-4,20);ctx.fill();ctx.font=font;ctx.fillStyle=fg;ctx.textBaseline='middle';ctx.fillText(txt,pad,H/2+4)});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false}));s.scale.set(h*w/H,h,1);return s}

/* floor: 1 ft grid, bold every 5 ft, compass letters */
const floorTex=canvasTex(1024,1024,(ctx,w)=>{ctx.fillStyle='#ECEFF2';ctx.fillRect(0,0,w,w);const s=w/10;
  for(let i=0;i<=10;i++){ctx.strokeStyle=i%5===0?'#94A2AF':'#C6CFD7';ctx.lineWidth=i%5===0?3:1.5;ctx.beginPath();ctx.moveTo(i*s,0);ctx.lineTo(i*s,w);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*s);ctx.lineTo(w,i*s);ctx.stroke()}
  ctx.fillStyle='#94A2AF';ctx.font='700 44px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',w/2,34);ctx.fillText('S',w/2,w-34);ctx.fillText('W',34,w/2);ctx.fillText('E',w-34,w/2)});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({map:floorTex,roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);rayTargets.push(floor);
const apron=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0xD5DCE2,roughness:1}));
apron.rotation.x=-Math.PI/2;apron.position.y=-0.01;apron.receiveShadow=true;scene.add(apron);

/* netting cage (lighter than before so the drone stands out) */
const netTex=canvasTex(64,64,(ctx,w)=>{ctx.clearRect(0,0,w,w);ctx.strokeStyle='rgba(40,52,64,0.85)';ctx.lineWidth=3;ctx.strokeRect(0,0,w,w)});
netTex.wrapS=netTex.wrapT=THREE.RepeatWrapping;
function netPlane(w,h,pos,rotY,rotX=0){const t=netTex.clone();t.needsUpdate=true;t.repeat.set(w*2,h*2);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
  m.position.copy(pos);m.rotation.y=rotY;m.rotation.x=rotX;scene.add(m);rayTargets.push(m);return m}
netPlane(10,20,V(0,10,-5),0);netPlane(10,20,V(0,10,5),0);netPlane(10,20,V(-5,10,0),Math.PI/2);netPlane(10,20,V(5,10,0),Math.PI/2);
netPlane(10,10,V(0,20,0),0,Math.PI/2);
const frameMat=new THREE.MeshStandardMaterial({color:0x56616C,roughness:.6});
function rod(a,b,r,mat,parent=scene){const d=b.clone().sub(a),L=d.length();const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,14),mat);
  m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
[[-5,-5],[5,-5],[5,5],[-5,5]].forEach(([x,z],i,a)=>{rod(V(x,0,z),V(x,20,z),.07,frameMat);const [x2,z2]=a[(i+1)%4];rod(V(x,20,z),V(x2,20,z2),.05,frameMat)});
for(let y=5;y<=20;y+=5){const s=textSprite(`${y} ft`,{h:.42});s.position.set(5.55,y,-5);scene.add(s);rod(V(5,y,-5.12),V(5.25,y,-5.12),.025,frameMat)}
const BASE_RAY=rayTargets.length;   // floor + nets; the course's meshes are added after these

/* The course is data, in students' coordinates (x east, y north, heights in ft), so §07 can redesign it.
   gates: {type:'v', x, y, dir (the way you fly through: E W N S), lo, hi (bottom and top bar heights), w (width)}
          {type:'h', x, y, h (height), s (side)}: a square hoop flown down through
   poles: {x, y, h, to (index of a pole joined by bars, or -1), bars (bar heights)} */
const COURSE0={pad:{x:-3.6,y:3.6},cube:{x:-3.8,y:-3.2},bin:{x:-0.8,y:3.4},
  gates:[{type:'v',x:-2,y:-3.2,dir:'E',lo:1.5,hi:4.5,w:2.6},{type:'v',x:1.8,y:-3.2,dir:'E',lo:8,hi:11,w:2.6},{type:'h',x:3.6,y:0,h:6,s:2.4},{type:'v',x:2,y:3.4,dir:'W',lo:.8,hi:3.2,w:2.4}],
  poles:[{x:.2,y:-.6,h:14,to:1,bars:[5,9]},{x:-1.4,y:.8,h:14,to:-1,bars:[]},{x:1.6,y:1.4,h:14,to:-1,bars:[]},{x:-3.4,y:-.2,h:20,to:-1,bars:[]}]};
const GATE_COL=[[0xE03131,'#E03131'],[0xF2A900,'#C99000'],[0x1C7ED6,'#1C7ED6'],[0x7048E8,'#7048E8'],[0x0CA678,'#0B8A6A'],[0xE8590C,'#D9480F'],[0xAE3EC9,'#9C36B5'],[0x495057,'#495057']];
const GDIR={E:[1,0],W:[-1,0],N:[0,1],S:[0,-1]};       // flying direction in students' (x, y)
const DIRWORD={E:'east',W:'west',N:'north',S:'south'};
// Tidy any course (typed in, pasted, or from storage) into a safe one.
function cleanCourse(c){c=c&&typeof c==='object'?c:{};
  const n=(v,a,b,d)=>{v=+v;return isFinite(v)?Math.round(Math.min(b,Math.max(a,v))*10)/10:d};
  const pt=(o,d)=>({x:n(o&&o.x,-4.5,4.5,d.x),y:n(o&&o.y,-4.5,4.5,d.y)});
  const gates=(Array.isArray(c.gates)?c.gates:[]).filter(g=>g&&typeof g==='object').slice(0,8).map(g=>{
    if(g.type==='h')return Object.assign({type:'h'},pt(g,{x:0,y:0}),{h:n(g.h,1,18,6),s:n(g.s,1,4,2.4)});
    const lo=n(g.lo,0,18,1.5);return Object.assign({type:'v'},pt(g,{x:0,y:0}),{dir:GDIR[g.dir]?g.dir:'E',lo,hi:n(g.hi,lo+.5,19.5,Math.min(19.5,lo+3)),w:n(g.w,1,5,2.6)})});
  gates.forEach(g=>{const k=v=>Math.round(v*10)/10,lim=h=>Math.max(0,4.8-h);   // keep the posts inside the nets
    if(g.type==='h'){const L=lim(g.s/2);g.x=k(Math.max(-L,Math.min(L,g.x)));g.y=k(Math.max(-L,Math.min(L,g.y)))}
    else{const a=g.dir==='E'||g.dir==='W'?'y':'x',L=lim(g.w/2);g[a]=k(Math.max(-L,Math.min(L,g[a])))}});
  const P=(Array.isArray(c.poles)?c.poles:[]).filter(p=>p&&typeof p==='object').slice(0,12);
  const poles=P.map((p,i)=>Object.assign(pt(p,{x:0,y:0}),{h:n(p.h,1,20,14),to:Number.isInteger(p.to)&&p.to>=0&&p.to<P.length&&p.to!==i?p.to:-1,
    bars:(Array.isArray(p.bars)?p.bars:[]).slice(0,4).map(v=>n(v,.5,19.5,5))}));
  return {pad:pt(c.pad,COURSE0.pad),cube:pt(c.cube,COURSE0.cube),bin:pt(c.bin,COURSE0.bin),gates,poles}}
const courseJSON=c=>JSON.stringify(cleanCourse(c));
let course=cleanCourse(store.get('course',COURSE0));

const PR=0.07;
const fitMat=new THREE.MeshStandardMaterial({color:0xF8F9FA,roughness:.4});
const pvcMat={};
function mat(c){return pvcMat[c]||(pvcMat[c]=new THREE.MeshStandardMaterial({color:c,roughness:.42}))}
const courseGroup=new THREE.Group();scene.add(courseGroup);
function pipe(a,b,color,name){const m=rod(a,b,PR,mat(color),courseGroup);rayTargets.push(m);segs.push({a:a.clone(),b:b.clone(),r:PR,name});return m}
function joint(p){const m=new THREE.Mesh(new THREE.SphereGeometry(PR*1.45,14,10),fitMat);m.position.copy(p);m.castShadow=true;courseGroup.add(m)}
const gates=[], poles=[];                       // built from the course, world coordinates
const bin={x:0,z:0,hw:0.8,h:1.2};
const PAD=V(0,0,0);
const binMat=new THREE.MeshStandardMaterial({color:0xD6336C,roughness:.55});

/* launch pad + pickup mat (moved, not rebuilt, when the course changes) */
const padMesh=(function(){const tex=canvasTex(256,256,(ctx,w)=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(w/2,w/2,w/2-2,0,7);ctx.fill();ctx.strokeStyle='#D9480F';ctx.lineWidth=10;ctx.beginPath();ctx.arc(w/2,w/2,w/2-18,0,7);ctx.stroke();
  ctx.fillStyle='#D9480F';ctx.font='700 150px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('H',w/2,w/2+8)});
  const m=new THREE.Mesh(new THREE.CircleGeometry(PAD_R,48),new THREE.MeshStandardMaterial({map:tex,transparent:true}));m.rotation.x=-Math.PI/2;m.position.y=.012;m.receiveShadow=true;scene.add(m);return m})();
const matTex=canvasTex(256,256,(ctx,w)=>{ctx.fillStyle='#40C057';ctx.fillRect(0,0,w,w);ctx.fillStyle='#EBFBEE';ctx.fillRect(26,26,w-52,w-52);ctx.fillStyle='#2B8A3E';ctx.font='700 46px Arial';ctx.textAlign='center';ctx.fillText('PICKUP',w/2,w/2+16)});
const pickMat=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1),new THREE.MeshStandardMaterial({map:matTex}));pickMat.rotation.x=-Math.PI/2;pickMat.position.y=.012;pickMat.receiveShadow=true;scene.add(pickMat);

/* the cube */
const cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(CUBE,CUBE,CUBE),[0xE03131,0x1C7ED6,0xF2A900,0x2F9E44,0x7048E8,0xF76707].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.45})));
cubeMesh.castShadow=true;scene.add(cubeMesh);
const cube={p:V(0,CUBE_H,0),v:V(0,0,0),held:false,rest:true,delivered:false,home:V(0,CUBE_H,0)};
function placeCubeMat(){pickMat.position.x=cube.home.x;pickMat.position.z=cube.home.z}

// (Re)build the 3D course from `course`: pipes, poles, bars, bin, pad, cube; the planner's map is redone on first use.
function buildCourse(c){
  courseGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.isSprite){o.material.map.dispose();o.material.dispose()}});
  courseGroup.clear();rayTargets.length=BASE_RAY;segs.length=0;boxes.length=0;gates.length=0;poles.length=0;
  c.gates.forEach((q,i)=>{
    const g={n:i+1,type:q.type,color:GATE_COL[i%8][0],css:GATE_COL[i%8][1]},cx=q.x,cz=-q.y,nm=`gate ${g.n}`;
    if(q.type==='v'){Object.assign(g,{lo:q.lo,hi:q.hi,w:q.w,dir:q.dir});
      const [dx,dy]=GDIR[q.dir],d=V(dx,0,-dy),l=V(-d.z,0,d.x),hw=g.w/2;g.dv=d;g.lv=l;
      const P=(s,y)=>V(cx+l.x*hw*s,y,cz+l.z*hw*s);
      [-1,1].forEach(s=>{pipe(P(s,0.07),P(s,g.hi),g.color,nm);
        const b=P(s,0.07);pipe(b.clone().addScaledVector(d,-.7),b.clone().addScaledVector(d,.7),g.color,nm);joint(b);joint(P(s,g.hi));if(g.lo>.3)joint(P(s,g.lo))});
      pipe(P(-1,g.hi),P(1,g.hi),g.color,nm);if(g.lo>.3)pipe(P(-1,g.lo),P(1,g.lo),g.color,nm);
      const cy=(Math.max(g.lo,.3)+g.hi)/2;g.center=V(cx,cy,cz);g.approach=g.center.clone().addScaledVector(d,-1.2);g.exit=g.center.clone().addScaledVector(d,1.2);
      const lab=textSprite(`GATE ${g.n}`,{h:.45});lab.position.set(cx,g.hi+.55,cz);courseGroup.add(lab);
    }else{Object.assign(g,{h:q.h,s:q.s});
      const hs=g.s/2,C=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[cx+a*hs,cz+b*hs]);
      C.forEach(([x,z],i)=>{pipe(V(x,0.07,z),V(x,g.h,z),g.color,nm);const [x2,z2]=C[(i+1)%4];pipe(V(x,g.h,z),V(x2,g.h,z2),g.color,nm);joint(V(x,g.h,z));joint(V(x,0.07,z))});
      g.center=V(cx,g.h,cz);g.approach=V(cx,Math.min(19,g.h+2),cz);g.exit=V(cx,Math.max(.8,g.h-2),cz);
      const lab=textSprite(`GATE ${g.n} ↓`,{h:.45});lab.position.set(cx,g.h+.7,cz);courseGroup.add(lab);
    }
    gates.push(g)});
  c.poles.forEach((q,i)=>{const tall=q.h>=19.5,p={x:q.x,z:-q.y,h:q.h,c:tall?0xF76707:0x2F9E44,css:tall?'#F76707':'#2F9E44'};poles.push(p);
    pipe(V(p.x,0,p.z),V(p.x,p.h,p.z),p.c,tall?'the orange pole':'a green pole');joint(V(p.x,p.h,p.z));
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.05,24),fitMat);base.position.set(p.x,.025,p.z);base.receiveShadow=true;courseGroup.add(base)});
  c.poles.forEach(q=>{if(q.to<0)return;const o=c.poles[q.to];q.bars.forEach(h=>{if(h>Math.min(q.h,o.h))return;
    const a=V(q.x,h,-q.y),b=V(o.x,h,-o.y);pipe(a,b,0x15AABF,'a cross bar');joint(a);joint(b)})});
  bin.x=c.bin.x;bin.z=-c.bin.y;
  {const t=.06,parts=[[bin.hw*2,t,bin.hw*2,0,t/2,0],[bin.hw*2,bin.h,t,0,bin.h/2,bin.hw-t/2],[bin.hw*2,bin.h,t,0,bin.h/2,-bin.hw+t/2],[t,bin.h,bin.hw*2,bin.hw-t/2,bin.h/2,0],[t,bin.h,bin.hw*2,-bin.hw+t/2,bin.h/2,0]];
    parts.forEach(([w,h,d,x,y,z])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),binMat);b.position.set(bin.x+x,y,bin.z+z);b.castShadow=b.receiveShadow=true;courseGroup.add(b);rayTargets.push(b)});
    boxes.push({min:V(bin.x-bin.hw,0,bin.z-bin.hw),max:V(bin.x+bin.hw,bin.h,bin.z+bin.hw),name:'the drop bin'});
    const s=textSprite('DROP',{h:.45,fg:'#fff',bg:'#D6336C'});s.position.set(bin.x,bin.h+.5,bin.z);courseGroup.add(s)}
  PAD.set(c.pad.x,0,-c.pad.y);padMesh.position.x=PAD.x;padMesh.position.z=PAD.z;
  cube.home.set(c.cube.x,CUBE_H,-c.cube.y);cube.p.copy(cube.home);cube.held=false;cube.rest=true;cube.delivered=false;cube.v.set(0,0,0);placeCubeMat();
  occDirty=true;
}
let occDirty=true;
buildCourse(course);

/* ---------- 3. drone model ---------- */
// Builds a drone in `parent`. Motors in order M1 front-left, M2 front-right, M3 back-right, M4 back-left
// (x forward, z right). Props spin in opposite pairs: M1 & M3 one way, M2 & M4 the other.
function makeDrone(parent){
  const g=new THREE.Group();g.rotation.order='YXZ';parent.add(g);
  const props=[];
  const dark=new THREE.MeshStandardMaterial({color:0x2A3139,roughness:.55}),acc=new THREE.MeshStandardMaterial({color:0xD9480F,roughness:.5});
  const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
  add(new THREE.BoxGeometry(.42,.12,.30),dark,0,0,0);add(new THREE.BoxGeometry(.28,.07,.22),acc,-.02,.09,0);
  const M=[[.30,-.30],[.30,.30],[-.30,.30],[-.30,-.30]];
  M.forEach(([x,z],i)=>{const arm=add(new THREE.BoxGeometry(.42,.04,.05),dark,x/2,0,z/2);arm.rotation.y=Math.atan2(-z,x);
    add(new THREE.CylinderGeometry(.05,.05,.07,16),dark,x,.03,z);
    const pg=new THREE.Group();pg.position.set(x,.085,z);g.add(pg);const front=i<2;
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.40,.008,.045),new THREE.MeshStandardMaterial({color:front?0xE03131:0x343A40}));blade.castShadow=true;pg.add(blade);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(.2,32),new THREE.MeshBasicMaterial({color:front?0xE03131:0x495057,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.x=-Math.PI/2;pg.add(disc);
    const arrow=new THREE.ArrowHelper(V(0,1,0),V(x,.1,z),.5,0x2B8A3E,.12,.08);arrow.visible=false;g.add(arrow);
    props.push({pg,blade,disc,arrow,dir:(i%2?1:-1),sx:Math.sign(x),sz:Math.sign(z)});
    const led=new THREE.Mesh(new THREE.SphereGeometry(.022,10,8),new THREE.MeshBasicMaterial({color:front?0x37B24D:0xF03E3E}));led.position.set(x,-.03,z);g.add(led)});
  [-.14,.14].forEach(z=>{add(new THREE.BoxGeometry(.40,.025,.025),dark,0,-.29,z);add(new THREE.BoxGeometry(.025,.24,.025),dark,.1,-.17,z);add(new THREE.BoxGeometry(.025,.24,.025),dark,-.1,-.17,z)});
  add(new THREE.BoxGeometry(.04,.05,.09),new THREE.MeshStandardMaterial({color:0x1971C2}),.23,0,0);
  add(new THREE.CylinderGeometry(.028,.028,.03,12),new THREE.MeshStandardMaterial({color:0x111111}),.255,0,0).rotation.z=Math.PI/2;
  const fm=new THREE.MeshStandardMaterial({color:0x868E96,roughness:.4});
  const mk=s=>{const piv=new THREE.Group();piv.position.set(0,-.1,.19*s);g.add(piv);const f=new THREE.Mesh(new THREE.BoxGeometry(.12,.36,.035),fm);f.position.y=-.18;f.castShadow=true;piv.add(f);return piv};
  return {g,props,fingerL:mk(-1),fingerR:mk(1)};
}
// Spin the props and size the thrust arrows for motor levels m[0..3] (0..1).
function animateProps(D,m,dt,showArrows,arrowLen){
  D.props.forEach((p,i)=>{const v=m[i];p.pg.rotation.y+=p.dir*(v>0?(30+v*220):0)*dt;p.disc.material.opacity=v>0?.18+v*.18:0;
    p.arrow.visible=showArrows&&v>.01;if(p.arrow.visible){const L=Math.max(.05,v*arrowLen);p.arrow.setLength(L,Math.min(.14,L*.35),Math.min(.09,L*.25));
      p.arrow.setColor(v>.85?0xC92A2A:0x2B8A3E)}})}
const drone=makeDrone(scene);

/* ---------- 4. geometry ---------- */
const _ab=V(0,0,0),_ap=V(0,0,0);
function segClosest(p,a,b,out){_ab.subVectors(b,a);_ap.subVectors(p,a);const t=Math.max(0,Math.min(1,_ap.dot(_ab)/_ab.lengthSq()));out.copy(a).addScaledVector(_ab,t);return p.distanceTo(out)}
function boxClosest(p,b,out){out.set(Math.max(b.min.x,Math.min(p.x,b.max.x)),Math.max(b.min.y,Math.min(p.y,b.max.y)),Math.max(b.min.z,Math.min(p.z,b.max.z)));return p.distanceTo(out)}
const _q=V(0,0,0);
// Free space around point p (ft) and what is closest: nets, floor, ceiling, pipes, bin.
function nearest(p){let m=5-Math.abs(p.x),name='the side net';
  const c=[[5-Math.abs(p.z),'the side net'],[20-p.y,'the ceiling net'],[p.y,'the floor']];for(const [d,n] of c)if(d<m){m=d;name=n}
  for(const s of segs){const d=segClosest(p,s.a,s.b,_q)-s.r;if(d<m){m=d;name=s.name}}for(const b of boxes){const d=boxClosest(p,b,_q);if(d<m){m=d;name=b.name}}return {d:m,name}}
const clearance=p=>nearest(p).d;

/* ---------- 5. planner: 3D A* on a 4 in grid + straightening ---------- */
const occ=new Uint8Array(NX*NY*NZ);
const idx=(i,j,k)=>(j*NZ+k)*NX+i, cx=i=>-5+(i+.5)*RES, cy=j=>(j+.5)*RES;
// The no-fly map: every 4 in box where the drone would come within INFL of something. Redone after the course changes.
function ensureOcc(){if(!occDirty)return;occDirty=false;const p=V(0,0,0);for(let j=0;j<NY;j++)for(let k=0;k<NZ;k++)for(let i=0;i<NX;i++){p.set(cx(i),cy(j),cx(k));occ[idx(i,j,k)]=clearance(p)<INFL?1:0}}
const NB=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)if(a||b||c)NB.push([a,b,c,Math.hypot(a,b,c)]);
const dec=n=>[n%NX,Math.floor(n/(NX*NZ)),Math.floor(n/NX)%NZ];
const cellPos=n=>{const [i,j,k]=dec(n);return V(cx(i),cy(j),cx(k))};
function cellOf(p){return[Math.max(0,Math.min(NX-1,Math.floor((p.x+5)/RES))),Math.max(0,Math.min(NY-1,Math.floor(p.y/RES))),Math.max(0,Math.min(NZ-1,Math.floor((p.z+5)/RES)))]}
function nearestFree(p){const [i,j,k]=cellOf(p);for(let r=0;r<=5;r++)for(let dj=-r;dj<=r;dj++)for(let dk=-r;dk<=r;dk++)for(let di=-r;di<=r;di++){
  if(Math.max(Math.abs(di),Math.abs(dj),Math.abs(dk))!==r)continue;const a=i+di,b=j+dj,c=k+dk;if(a<0||b<0||c<0||a>=NX||b>=NY||c>=NZ)continue;const n=idx(a,b,c);if(!occ[n])return n}return -1}
// A* from A to B. With trace, also returns the cells in the order they were explored (for the §04 view).
function astar(A,B,trace){
  ensureOcc();const s=nearestFree(A),g=nearestFree(B);if(s<0||g<0)return null;
  const N=occ.length,gs=new Float32Array(N).fill(1e9),came=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
  const [gi,gj,gk]=dec(g);
  const h=n=>{const [i,j,k]=dec(n);return Math.hypot(i-gi,j-gj,k-gk)};
  const hi=[],hf=[];
  const push=(n,f)=>{hi.push(n);hf.push(f);let c=hi.length-1;while(c>0){const p=(c-1)>>1;if(hf[p]<=hf[c])break;[hi[p],hi[c]]=[hi[c],hi[p]];[hf[p],hf[c]]=[hf[c],hf[p]];c=p}};
  const pop=()=>{const top=hi[0],ln=hi.pop(),lf=hf.pop();if(hi.length){hi[0]=ln;hf[0]=lf;let c=0;for(;;){const l=2*c+1,r=l+1;let m=c;if(l<hi.length&&hf[l]<hf[m])m=l;if(r<hi.length&&hf[r]<hf[m])m=r;if(m===c)break;[hi[m],hi[c]]=[hi[c],hi[m]];[hf[m],hf[c]]=[hf[c],hf[m]];c=m}}return top};
  gs[s]=0;push(s,h(s));let found=s===g;const order=[];
  while(hi.length){const c=pop();if(c===g){found=true;break}if(closed[c])continue;closed[c]=1;if(trace)order.push(c);const [i,j,k]=dec(c);
    for(const [a,b,d,w] of NB){const ni=i+a,nj=j+b,nk=k+d;if(ni<0||nj<0||nk<0||ni>=NX||nj>=NY||nk>=NZ)continue;const n=idx(ni,nj,nk);if(occ[n]||closed[n])continue;
      const ng=gs[c]+w;if(ng<gs[n]){gs[n]=ng;came[n]=c;push(n,ng+h(n))}}}
  if(!found)return null;
  const out=[];for(let n=g;n!==-1;n=came[n]){out.push(cellPos(n));if(n===s)break}
  out.reverse();out[0]=A.clone();out.push(B.clone());return trace?{path:out,order}:out;
}
function clearLine(a,b){const n=Math.ceil(a.distanceTo(b)/0.1),p=V(0,0,0);for(let i=0;i<=n;i++){p.lerpVectors(a,b,i/n);if(clearance(p)<INFL-.06)return false}return true}
function shortcut(pts){const out=[pts[0]];let i=0;while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!clearLine(pts[i],pts[j]))j--;out.push(pts[j]);i=j}return out}
function plan(a,b){if(clearLine(a,b))return[a.clone(),b.clone()];const r=astar(a,b);return r?shortcut(r):null}

/* ---------- 6. levels and scoring ---------- */
// target: seconds for the third star. Goals are checked live during every flight, in any mode.
// g: which gates the level uses: the first one, none, or all of them in order (the course can be redesigned in §07).
const LEVELS=[
  {id:1,name:'First flight',g:'first',cube:false,target:20},
  {id:2,name:'Pick and drop',g:'none',cube:true,target:30},
  {id:3,name:'Full course',g:'all',cube:true,target:40},
  {id:4,name:'Windy day',g:'all',cube:true,wind:true,target:45},
  {id:5,name:'Surprise cube',g:'all',cube:true,moveCube:true,target:45},
];
function refreshLevels(){const N=gates.length,all=N>1?`fly Gates 1 → ${N} in order, `:N?'fly through Gate 1, ':'';
  LEVELS.forEach(l=>{l.gates=l.g==='first'?(N?[1]:[]):l.g==='all'?gates.map(g=>g.n):[]});
  LEVELS[0].desc=N?'Take off, fly through Gate 1 and land back on pad H.':'Take off and land back on pad H (this course has no gates).';
  LEVELS[1].desc='Pick up the cube, drop it in the bin and land on pad H.';
  LEVELS[2].desc=`Pick up the cube, ${all}drop the cube in the bin and land on pad H.`;
  LEVELS[3].desc=`The full course${N?'':' (pick and drop)'} with gusts of wind pushing the drone around.`;
  LEVELS[4].desc=`The full course${N?'':' (pick and drop)'}, but the cube starts somewhere new on every launch.`}
refreshLevels();
// Best scores are kept per course: the original course uses the plain level number.
const courseTag=()=>{const j=courseJSON(course);if(j===courseJSON(COURSE0))return '';let h=0;for(const ch of j)h=(h*31+ch.charCodeAt(0))|0;return '@'+(h>>>0).toString(36)};
const bestKey=id=>id+courseTag();
let level=LEVELS.find(l=>l.id===store.get('level',3))||LEVELS[2];
const best=store.get('best',{});      // best[levelId] = {score, stars, time, mode}
const goal={};                         // live goal state for the current flight
function resetGoals(){Object.assign(goal,{tookOff:false,next:0,passed:[],picked:false,delivered:false,onPad:false,landed:false});gates.forEach(g=>{g.prevS=null})}
// Goals of the current level with their state: ok, bad (failed for good) or open.
function goalList(){
  const L=[{t:'Take off',ok:goal.tookOff}];
  if(level.cube)L.push({t:'Pick up the cube',ok:goal.picked});
  level.gates.forEach(n=>L.push({t:`Gate ${n}${gates[n-1].type==='h'?' (down through the hoop)':''}`,ok:goal.passed.includes(n)}));
  if(level.cube)L.push({t:'Cube in the bin',ok:goal.delivered,bad:S.done&&!goal.delivered});
  L.push({t:'Land on pad H',ok:goal.landed&&goal.onPad,bad:goal.landed&&!goal.onPad&&S.done});
  return L;
}
function scoreNow(){const L=goalList(),met=L.filter(g=>g.ok).length,all=met===L.length;
  const bonus=all?Math.max(0,Math.round(2*(level.target-S.t))):0;
  const pts=Math.max(0,met*100-25*S.contacts+bonus);
  const stars=!met?0:!all?1:(S.contacts===0&&S.t<=level.target)?3:2;
  return {L,met,all,pts,stars,bonus}}
// Gate passing: crossing a gate's plane inside its opening, in level order. Called every physics step.
function checkGates(){
  for(const g of gates){let s,inside;
    if(g.type==='v'){const r=S.p.clone().sub(g.center);s=r.x*g.dv.x+r.z*g.dv.z;const lat=Math.abs(r.x*g.lv.x+r.z*g.lv.z);inside=lat<g.w/2&&S.p.y>g.lo&&S.p.y<g.hi}
    else{s=S.p.y-g.h;inside=Math.abs(S.p.x-g.center.x)<g.s/2&&Math.abs(S.p.z-g.center.z)<g.s/2}
    if(g.prevS!=null&&Math.sign(s)!==Math.sign(g.prevS)&&inside&&!goal.passed.includes(g.n)){
      const want=level.gates[goal.next];
      if(want===g.n){goal.passed.push(g.n);goal.next++;log(`Passed gate ${g.n}.`,'good')}
      else if(level.gates.includes(g.n))log(`Gate ${g.n} flown out of order${want?`: gate ${want} comes next`:''}.`,'bad')}
    g.prevS=s}
}
function setLevel(id){level=LEVELS.find(l=>l.id===id)||level;store.set('level',level.id);
  document.querySelectorAll('#levelBtns button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.l===level.id));
  $('#levelText').innerHTML=`<strong>Level ${level.id} · ${level.name}.</strong> ${level.desc} Three stars: every goal, no contacts, under ${level.target} s.`;
  $('#levelChip').innerHTML=`Scoring as <strong>Level ${level.id} · ${level.name}</strong> (change it in §06).`;
  if(!S.running)reset(true);renderScore()}
function recordBest(){const sc=scoreNow(),k=bestKey(level.id),b=best[k];
  if(!b||sc.pts>b.score){best[k]={score:sc.pts,stars:sc.stars,time:+S.t.toFixed(1),mode:MODE[S.mode].chip};store.set('best',best);log(`New best for level ${level.id}: ${sc.pts} points.`,'good')}
  renderBest()}
function renderBest(){$('#bestTbl').innerHTML='<thead><tr><th>Level</th><th>Best score</th><th>Stars</th><th>Time</th><th>Flown by</th></tr></thead><tbody>'+
  LEVELS.map(l=>{const b=best[bestKey(l.id)];return `<tr><td>${l.id} · ${l.name}</td><td class="t">${b?b.score:'—'}</td><td>${b?starHTML(b.stars):'—'}</td><td class="t">${b?b.time+' s':'—'}</td><td>${b?b.mode:'—'}</td></tr>`}).join('')+'</tbody>';
  $('#bestNote').textContent=courseTag()?'These are your scores on the course you designed in §07. Load the original course there to see its scores.':''}
const starHTML=n=>`<span class="stars" style="font-size:1.1rem">${'★'.repeat(n)}<span class="off">${'★'.repeat(3-n)}</span></span>`;

/* ---------- 7. missions ---------- */
const S={mode:'auto',running:false,paused:false,armed:false,p:V(PAD.x,GROUND,PAD.z),v:V(0,0,0),acmd:V(0,0,0),yaw:0,tx:0,tz:0,t:0,
  battery:100,contacts:0,lastHit:-9,legs:[],leg:0,motors:[0,0,0,0],claw:.5,wind:V(0,0,0),done:false,lowBat:false};
let speedMul=1,camView='follow';
const keys=new Set();
const fwdOf=y=>V(Math.cos(y),0,-Math.sin(y)), rightOf=y=>V(Math.sin(y),0,Math.cos(y));
function L(kind,step,pts,o={}){return Object.assign({kind,step,pts,vmax:3.5,look:.8},o)}
// The autopilot's mission for the current level: plan around the pipes, leg by leg.
function buildAuto(){
  const legs=[],H=3,padH=V(PAD.x,H,PAD.z),cubeH=V(cube.p.x,H,cube.p.z),grabY=CUBE_H+HOLD+.005;
  const addPlan=(step,a,b,extra=[])=>{let p=plan(a,b);if(!p){log(`The planner found no route for “${step}”; flying straight.`,'bad');p=[a.clone(),b.clone()]}legs.push(L('path',step,p.concat(extra)))};
  legs.push(L('path','Take off',[S.p.clone(),padH],{vmax:2}));
  let cur=padH;
  if(level.cube){addPlan('Fly to the cube',padH,cubeH);
    legs.push(L('path','Pick up the cube',[cubeH,V(cubeH.x,grabY,cubeH.z)],{vmax:1.3}));legs.push(L('grab','Pick up the cube'));
    legs.push(L('path','Pick up the cube',[V(cubeH.x,grabY,cubeH.z),cubeH],{vmax:1.6}));cur=cubeH}
  level.gates.forEach(n=>{const g=gates[n-1];addPlan(`Gate ${g.n}${g.type==='h'?' (down through the hoop)':''}`,cur,g.approach,[g.center.clone(),g.exit.clone()]);cur=g.exit});
  if(level.cube){const binH=V(bin.x,2.7,bin.z),binD=V(bin.x,2.05,bin.z);
    addPlan('Drop in the bin',cur,binH);legs.push(L('path','Drop in the bin',[binH,binD],{vmax:1.2}));legs.push(L('release','Drop in the bin'));
    legs.push(L('path','Fly home',[binD,V(bin.x,3.4,bin.z)],{vmax:2}));cur=V(bin.x,3.4,bin.z)}
  addPlan('Fly home',cur,padH);
  legs.push(L('land','Land'));
  return legs;
}
// "My path": straight lines through the editor's waypoints (world coordinates), with pick / drop / land tags.
function buildPath(wps){
  const legs=[],up=V(S.p.x,3,S.p.z);legs.push(L('path','Take off',[S.p.clone(),up],{vmax:2}));
  const hasPick=wps.some(w=>w.tag==='pick');let step=hasPick?'Fly to the cube':'Fly my path',seg=[up],landed=false;
  for(const w of wps){seg.push(w.p);
    if(w.tag==='pick'){legs.push(L('path',step,seg,{vmax:3,look:.55}));legs.push(L('grab','Pick up the cube'));seg=[w.p];step='Fly my path'}
    else if(w.tag==='drop'){legs.push(L('path',step,seg,{vmax:3,look:.55}));legs.push(L('release','Drop in the bin'));seg=[w.p];step='Fly home'}
    else if(w.tag==='land'){legs.push(L('path',step,seg,{vmax:3,look:.55}));legs.push(L('land','Land'));landed=true;break}}
  if(!landed){if(seg.length>1)legs.push(L('path',step,seg,{vmax:3,look:.55}));legs.push(L('land','Land'))}
  return legs}

/* path visuals: the planned line, waypoint dots, the flown trail */
let planLine=null,wpDots=null;
const trailMax=900,trailPos=new Float32Array(trailMax*3);let trailN=0,trailT=0;
const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));trailGeo.setDrawRange(0,0);
scene.add(new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0x17202A,transparent:true,opacity:.55})));
function clearPlanVis(){if(planLine){scene.remove(planLine);planLine.geometry.dispose();planLine=null}if(wpDots){scene.remove(wpDots);wpDots=null}}
// Draw a planned route. With `check`, legs that come too close to something are drawn red.
function showPlan(pts,dots,check){clearPlanVis();if(pts.length<2)return;
  const pos=[],col=[],red=new THREE.Color(0xC92A2A),org=new THREE.Color(0xD9480F),p=V(0,0,0);
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],n=Math.max(1,Math.ceil(a.distanceTo(b)/.1));
    for(let k=0;k<=n;k++){p.lerpVectors(a,b,k/n);pos.push(p.x,p.y,p.z);const c=check&&clearance(p)<DR?red:org;col.push(c.r,c.g,c.b)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  planLine=new THREE.Line(g,new THREE.LineDashedMaterial({vertexColors:true,dashSize:.22,gapSize:.12,linewidth:2}));planLine.computeLineDistances();scene.add(planLine);
  if(dots){wpDots=new THREE.Group();const m=new THREE.MeshBasicMaterial({color:0xD9480F});dots.forEach((q,i)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),m);s.position.copy(q);wpDots.add(s);
    const t=textSprite(String(i+1),{h:.3,fg:'#fff',bg:'#D9480F'});t.position.copy(q).add(V(0,.3,0));wpDots.add(t)});scene.add(wpDots)}}

/* ---------- 8. flight ---------- */
const ray=new THREE.Raycaster();const beams=[];const beamMax=[8,8,8,8,20];
for(let i=0;i<5;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x2B8A3E}));scene.add(l);beams.push(l)}
const sense={d:[8,8,8,8,0],vision:'Camera: idle',seen:false};
function readSensors(){
  const f=fwdOf(S.yaw),r=rightOf(S.yaw),dirs=[f,r,f.clone().negate(),r.clone().negate(),V(0,-1,0)];
  const targets=cube.held?rayTargets:rayTargets.concat([cubeMesh]);
  dirs.forEach((d,i)=>{const o=S.p.clone();if(i===4)o.y-=.06;else o.addScaledVector(d,.22);
    ray.set(o,d);ray.far=beamMax[i];const h=ray.intersectObjects(targets,false)[0];const dist=h?h.distance:beamMax[i];
    sense.d[i]=i===4?dist+.06:dist+.22;
    const end=o.clone().addScaledVector(d,dist),a=beams[i].geometry.attributes.position;a.setXYZ(0,o.x,o.y,o.z);a.setXYZ(1,end.x,end.y,end.z);a.needsUpdate=true;
    beams[i].material.color.set(i===4?0x1971C2:dist<1?0xC92A2A:dist<2.5?0xE67700:0x2B8A3E);beams[i].visible=$('#optBeams').checked&&S.armed});
  if(cube.held){sense.vision='Camera: cube in the claw';sense.seen=true;return}
  const to=cube.p.clone().sub(S.p),rng=to.length(),hb=Math.atan2(to.dot(r),to.dot(f))*180/Math.PI,el=Math.atan2(to.y,Math.hypot(to.dot(f),to.dot(r)))*180/Math.PI;
  let seen=Math.abs(hb)<42&&el>-70&&rng<14;
  if(seen){ray.set(S.p,to.clone().normalize());ray.far=rng+.3;const h=ray.intersectObjects(rayTargets.concat([cubeMesh]),false)[0];seen=!!h&&h.object===cubeMesh}
  sense.seen=seen;
  sense.vision=seen?`Camera: cube ${rng.toFixed(1)} ft away, ${Math.abs(hb).toFixed(0)}° ${hb>=0?'right':'left'}`:'Camera: looking for the cube';
}
function startLeg(){const l=S.legs[S.leg];if(!l)return;l.t=0;l.s=0;l.seg=0;l.hold=S.p.clone();
  if(l.kind==='path'){l.cum=[0];for(let i=1;i<l.pts.length;i++)l.cum.push(l.cum[i-1]+l.pts[i].distanceTo(l.pts[i-1]))}
  if(S.mode==='blocks')blk.hl(l.bid);renderSteps();}
// In Program mode the legs come one block at a time: when they run out, ask the program for the next block.
function nextLeg(){S.leg++;if(S.leg>=S.legs.length){if(S.mode==='blocks'&&S.running&&blk.pull()){startLeg();return}finish();return}startLeg()}
const _c=V(0,0,0);
function pointAt(l,s){const n=l.pts.length;if(s>=l.cum[n-1])return l.pts[n-1].clone();let i=1;while(l.cum[i]<s)i++;const t=(s-l.cum[i-1])/Math.max(1e-6,l.cum[i]-l.cum[i-1]);return l.pts[i-1].clone().lerp(l.pts[i],t)}
function followPath(l){
  const n=l.pts.length,total=l.cum[n-1],end=l.pts[n-1];
  if(n<2||total<1e-3){nextLeg();return V(0,0,0)}
  let best=1e9,bs=l.s,bseg=l.seg;
  for(let i=l.seg;i<=Math.min(l.seg+3,n-2);i++){const d=segClosest(S.p,l.pts[i],l.pts[i+1],_c);if(d<best){best=d;bseg=i;bs=l.cum[i]+_c.distanceTo(l.pts[i])}}
  if(bs>=l.s){l.s=bs;l.seg=bseg}
  const rem=total-l.s;
  if(rem<.35){const e=end.clone().sub(S.p);const vd=e.clone().multiplyScalar(2.2);if(vd.length()>l.vmax)vd.setLength(l.vmax);
    if(e.length()<.1&&S.v.length()<.35)nextLeg();return vd}
  const tgt=pointAt(l,Math.min(l.s+l.look,total)),dir=tgt.sub(S.p);
  let spd=Math.min(l.vmax,.3+rem*1.5);
  const k=l.seg+1;if(k<n-1){const a=l.pts[k].clone().sub(l.pts[k-1]).normalize(),b=l.pts[k+1].clone().sub(l.pts[k]).normalize();
    const turn=Math.acos(Math.max(-1,Math.min(1,a.dot(b))));const vc=.6+(l.vmax-.6)*(1-turn/Math.PI);spd=Math.min(spd,vc+S.p.distanceTo(l.pts[k])*1.3)}
  return dir.lengthSq()>1e-8?dir.normalize().multiplyScalar(spd):V(0,0,0)}
function tryGrab(){const claw=S.p.clone().add(V(0,-HOLD,0)),d=claw.distanceTo(cube.p);
  if(!cube.held&&d<.32){cube.held=true;cube.rest=false;goal.picked=true;log('Claw closed: cube picked up.','good');return true}
  if(!cube.held)log(`Grab missed: the cube is ${d.toFixed(2)} ft from the claw.`,'bad');return false}
function release(){if(!cube.held){log('Release skipped: the claw is empty.','bad');return}cube.held=false;cube.rest=false;cube.v.copy(S.v);log('Claw opened: cube released.')}
function runLegs(dt){const l=S.legs[S.leg];if(!l)return V(0,0,0);
  switch(l.kind){
    case 'path':return followPath(l);
    case 'grab':case 'release':{l.t+=dt;if(!l.did){l.did=true;if(l.kind==='grab')tryGrab();else release()}if(l.t>.7)nextLeg();return l.hold.clone().sub(S.p).multiplyScalar(2)}
    case 'wait':{l.t+=dt;if(l.t>=l.dur)nextLeg();return l.hold.clone().sub(S.p).multiplyScalar(2)}
    case 'land':{const v=l.hold.clone().sub(S.p).multiplyScalar(2);v.y=S.p.y>1.2?-1.4:-.55;if(S.p.y<=GROUND+.005&&S.v.y>-.05){S.armed=false;touchdown();nextLeg()}return v}}
  return V(0,0,0)}
function touchdown(){goal.landed=true;goal.onPad=Math.hypot(S.p.x-PAD.x,S.p.z-PAD.z)<PAD_R;log(goal.onPad?'Touchdown on pad H: motors off.':'Touchdown, but not on pad H: motors off.',goal.onPad?'good':'bad')}
function manualCmd(dt){
  const f=fwdOf(S.yaw),r=rightOf(S.yaw),k=c=>keys.has(c)?1:0;
  const fw=k('KeyW')+k('ArrowUp')-k('KeyS')-k('ArrowDown'),rt=k('KeyD')+k('ArrowRight')-k('KeyA')-k('ArrowLeft'),up=k('KeyR')+k('Space')-k('KeyF')-k('ShiftLeft');
  S.yaw+=(k('KeyQ')-k('KeyE'))*1.6*dt;
  if(!S.armed&&up>0&&!S.done){S.armed=true;log('Motors on.')}
  if(S.armed&&S.p.y<=GROUND+.005&&up<=0&&goal.tookOff){S.groundT=(S.groundT||0)+dt;if(S.groundT>.8){S.armed=false;S.groundT=0;touchdown();finish()}}else S.groundT=0;
  return f.multiplyScalar(fw*4).addScaledVector(r,rt*4).add(V(0,up*3,0))}
function hit(name){if(S.t-S.lastHit<.6){S.lastHit=S.t;return}S.lastHit=S.t;S.contacts++;log(`Bumped ${name}.`,'bad');
  const f=$('#flash');f.classList.add('on');setTimeout(()=>f.classList.remove('on'),60)}
function step(dt){
  S.t+=dt;
  let vd=S.mode==='manual'?manualCmd(dt):(S.armed||S.mode==='blocks'?runLegs(dt):V(0,0,0));   // a program can wait or work the claw on the ground
  if(!S.armed&&S.p.y<=GROUND+.005){S.v.set(0,0,0);S.acmd.set(0,0,0)}
  else{
    if($('#optWind').checked){S.wind.x+=(-S.wind.x*.7)*dt+(Math.random()-.5)*9*Math.sqrt(dt);S.wind.z+=(-S.wind.z*.7)*dt+(Math.random()-.5)*9*Math.sqrt(dt)}else S.wind.multiplyScalar(.97);
    const a=vd.sub(S.v).multiplyScalar(4.2);const ah=Math.hypot(a.x,a.z);if(ah>10){a.x*=10/ah;a.z*=10/ah}a.y=Math.max(-8,Math.min(8,a.y));
    if(!S.armed)a.set(0,-G,0);
    S.acmd.copy(a);S.v.addScaledVector(a.add(S.wind),dt);S.p.addScaledVector(S.v,dt);
    if(S.mode!=='manual'||S.armed){const h=Math.hypot(S.v.x,S.v.z);if(S.mode!=='manual'&&h>.45){const yd=Math.atan2(-S.v.z,S.v.x);let e=yd-S.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));S.yaw+=Math.max(-2.2*dt,Math.min(2.2*dt,e*4*dt))}}
  }
  if(S.p.y>GROUND+.6)goal.tookOff=true;
  if(S.p.y<GROUND){S.p.y=GROUND;if(S.v.y<0)S.v.y=0;S.v.x*=.9;S.v.z*=.9}
  if(S.p.y>20-.2){S.p.y=20-.2;S.v.y=Math.min(0,S.v.y);hit('the ceiling net')}
  for(const ax of['x','z']){if(Math.abs(S.p[ax])>5-DR){S.p[ax]=Math.sign(S.p[ax])*(5-DR);S.v[ax]*=-.2;hit('the side net')}}
  for(const s of segs){const d=segClosest(S.p,s.a,s.b,_q),lim=DR+s.r;if(d<lim){const n=S.p.clone().sub(_q);if(n.lengthSq()<1e-9)n.set(0,1,0);n.normalize();S.p.copy(_q).addScaledVector(n,lim);const vn=S.v.dot(n);if(vn<0)S.v.addScaledVector(n,-vn*1.3);hit(s.name)}}
  for(const b of boxes){const d=boxClosest(S.p,b,_q);if(d<DR){const n=S.p.clone().sub(_q);if(n.lengthSq()<1e-9)n.set(0,1,0);n.normalize();S.p.copy(_q).addScaledVector(n,DR);const vn=S.v.dot(n);if(vn<0)S.v.addScaledVector(n,-vn*1.3);hit(b.name)}}
  if(S.armed)checkGates();
  // attitude + motors: the tilt the flight controller needs for the commanded acceleration
  const f=fwdOf(S.yaw),r=rightOf(S.yaw),tzT=-Math.atan(S.acmd.dot(f)/G),txT=Math.atan(S.acmd.dot(r)/G);
  const ez=tzT-S.tz,ex=txT-S.tx;S.tz+=ez*Math.min(1,dt*9);S.tx+=ex*Math.min(1,dt*9);
  if(S.armed){const base=(G+S.acmd.y)/(G*2.2)/Math.max(.6,Math.cos(S.tz)*Math.cos(S.tx));
    drone.props.forEach((p,i)=>{S.motors[i]=Math.max(.05,Math.min(1,base+p.sx*ez*1.6-p.sz*ex*1.6))});
    S.battery=Math.max(0,S.battery-dt*(S.motors.reduce((a,b)=>a+b,0)/4)*.18);
    if(S.battery<15&&!S.lowBat){S.lowBat=true;log('Battery below 15%.','bad')}}
  else S.motors=[0,0,0,0];
  if(cube.held){cube.p.copy(S.p).add(V(0,-HOLD,0))}
  else if(!cube.rest){cube.v.y-=G*dt;cube.v.x*=1-dt*.5;cube.v.z*=1-dt*.5;cube.p.addScaledVector(cube.v,dt);
    const dx=cube.p.x-bin.x,dz=cube.p.z-bin.z,outer=Math.abs(dx)<bin.hw+CUBE_H&&Math.abs(dz)<bin.hw+CUBE_H;
    if(outer&&cube.p.y<bin.h+CUBE_H){const lim=bin.hw-.06-CUBE_H;cube.p.x=bin.x+Math.max(-lim,Math.min(lim,dx));cube.p.z=bin.z+Math.max(-lim,Math.min(lim,dz))}
    const fy=outer?.06+CUBE_H:CUBE_H;
    if(cube.p.y<=fy){cube.p.y=fy;cube.v.set(0,0,0);cube.rest=true;
      if(outer){cube.delivered=true;goal.delivered=true;log('The cube landed in the drop bin.','good')}else log('The cube landed on the floor, outside the bin.','bad')}}
  trailT+=dt;if(S.armed&&trailT>.05){trailT=0;if(trailN>=trailMax){trailPos.copyWithin(0,3);trailN=trailMax-1}trailPos.set([S.p.x,S.p.y,S.p.z],trailN*3);trailN++;trailGeo.setDrawRange(0,trailN);trailGeo.attributes.position.needsUpdate=true}
}
function finish(){if(S.done)return;S.running=false;S.done=true;S.armed=false;if(S.mode==='blocks')blk.hl(null);
  const sc=scoreNow();
  log(`Flight over in ${S.t.toFixed(1)} s · ${S.contacts} contact${S.contacts===1?'':'s'} · ${sc.met}/${sc.L.length} goals · ${sc.pts} points.`,sc.all?'good':'');
  recordBest();renderSteps();renderScore();syncButtons()}

/* ---------- 9. deck UI ---------- */
const MODE={auto:{chip:'Autopilot'},path:{chip:'My path'},blocks:{chip:'Program'},manual:{chip:'Manual'}};
function setMode(m){if(!MODE[m])return;if(S.running||S.done)reset(true);S.mode=m;
  document.querySelectorAll('.modes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  $('#hudMode').textContent=MODE[m].chip;$('#touchPad').hidden=m!=='manual';store.set('mode',m);
  if(m==='manual'&&camView!=='follow')setView('follow');
  if(m!=='path')clearPlanVis();previewPath();renderSteps()}
function renderSteps(){const ul=$('#steps');const names=[];S.legs.forEach(l=>{if(!names.includes(l.step))names.push(l.step)});
  $('#stepsEmpty').hidden=names.length>0;$('#stepsEmpty').textContent=S.mode==='manual'?'Press Launch, then climb with R or UP.':'Press Launch.';
  const cur=S.legs[S.leg];
  ul.innerHTML=names.map(n=>{const last=S.legs.map((l,i)=>l.step===n?i:-1).filter(i=>i>=0).pop();const st=S.done||S.leg>last?'done':cur&&cur.step===n?'active':'';return `<li class="${st}">${n}</li>`}).join('');
  $('#hudPhase').textContent=S.done?'Flight over':cur?cur.step:S.mode==='manual'&&S.running?'Manual flight':'On the pad'}
function renderScore(){const sc=scoreNow();
  $('#scoreCard').innerHTML=`<h4>Level ${level.id} · ${level.name}</h4><div class="stars">${'★'.repeat(sc.stars)}<span class="off">${'★'.repeat(3-sc.stars)}</span></div>
    <ul class="goals">${sc.L.map(g=>`<li class="${g.ok?'ok':g.bad?'bad':''}">${g.t}</li>`).join('')}</ul>
    <div class="small"><strong>${sc.pts}</strong> points <span class="muted">(100 per goal − 25 per contact${sc.all?` + ${sc.bonus} time bonus`:''})</span></div>`}
function log(msg,cls=''){const li=document.createElement('li');li.className=cls;li.innerHTML=`<time>T+${S.t.toFixed(1)}</time><span></span>`;li.lastChild.textContent=msg;const ul=$('#log');ul.prepend(li);while(ul.children.length>80)ul.lastChild.remove()}
function syncButtons(){$('#btnGo').disabled=S.running;$('#btnPause').disabled=!S.running;$('#btnPause').textContent=S.paused?'Resume':'Pause';$('#btnCube').disabled=S.running||cube.held}
function launch(){
  if(S.done)reset(true);
  if(level.wind)$('#optWind').checked=true;
  if(level.moveCube)moveCube();
  resetGoals();think(null);
  if(S.mode==='auto'){const t0=performance.now();S.legs=buildAuto();log(`Route planned in ${(performance.now()-t0).toFixed(0)} ms.`);
    showPlan(S.legs.filter(l=>l.kind==='path').flatMap(l=>l.pts),null,false)}
  else if(S.mode==='path'){const w=ped.world();if(!w.length){log('Your path is empty: plan it in §02 first.','bad');return}
    S.legs=buildPath(w);log(`Flying your ${w.length} waypoints.`);showPlan([V(PAD.x,GROUND,PAD.z),V(PAD.x,3,PAD.z)].concat(w.map(q=>q.p)),w.map(q=>q.p),true)}
  else if(S.mode==='blocks'){const n=blk.count();if(!n){log('Your program is empty: build it in §03 first.','bad');return}
    S.legs=[];blk.start();log(`Running your program (${n} block${n>1?'s':''}).`)}
  else S.legs=[];
  S.leg=0;S.running=true;S.paused=false;
  if(S.mode==='blocks'){if(blk.pull())startLeg();else finish()}
  else if(S.mode!=='manual'){S.armed=true;log('Motors on: taking off.');startLeg()}else{renderSteps();log('Manual control. Press R or UP to climb.');canvas.focus()}
  if(camView==='orbit'||camView==='follow')setView('follow');
  syncButtons();renderScore()}
function reset(quiet){Object.assign(S,{running:false,paused:false,armed:false,done:false,t:0,battery:100,contacts:0,lastHit:-9,legs:[],leg:0,yaw:0,tx:0,tz:0,lowBat:false,groundT:0});
  S.p.set(PAD.x,GROUND,PAD.z);S.v.set(0,0,0);S.acmd.set(0,0,0);S.wind.set(0,0,0);
  cube.held=false;cube.rest=true;cube.delivered=false;cube.v.set(0,0,0);cube.p.copy(cube.home);
  trailN=0;trailGeo.setDrawRange(0,0);clearPlanVis();resetGoals();blk.stop();
  renderSteps();renderScore();syncButtons();previewPath();if(!quiet){$('#log').innerHTML='';log('Reset: drone on pad H.')}}
function moveCube(){const p=V(0,0,0);for(let n=0;n<400;n++){p.set(-4.2+Math.random()*8.4,3,-4.2+Math.random()*8.4);
  if(p.distanceTo(V(PAD.x,3,PAD.z))<2.2||Math.hypot(p.x-bin.x,p.z-bin.z)<2)continue;
  if(clearance(p)<1||clearance(V(p.x,.62,p.z))<.6||clearance(V(p.x,1.5,p.z))<.7)continue;
  cube.home.set(+p.x.toFixed(1),CUBE_H,+p.z.toFixed(1));cube.p.copy(cube.home);cube.rest=true;cube.delivered=false;placeCubeMat();ped.draw();
  log(`Cube moved to x ${f1(cube.home.x)}, y ${f1(-cube.home.z)}.`);return}}
function previewPath(){if(S.running||S.done||S.mode!=='path'||!ped)return;const w=ped.world();
  if(w.length)showPlan([V(PAD.x,GROUND,PAD.z),V(PAD.x,3,PAD.z)].concat(w.map(q=>q.p)),w.map(q=>q.p),true);else clearPlanVis()}

document.querySelectorAll('.modes button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));
$('#btnGo').addEventListener('click',launch);
$('#btnPause').addEventListener('click',()=>{S.paused=!S.paused;syncButtons()});
$('#btnReset').addEventListener('click',()=>reset(false));
$('#btnCube').addEventListener('click',moveCube);
$('#optSpeed').addEventListener('change',e=>speedMul=+e.target.value);
document.querySelectorAll('.rtabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.rtabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  ['mission','instr','log'].forEach(k=>$('#r-'+k).hidden=k!==b.dataset.r)}));
const typing=()=>{const a=document.activeElement;return a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'||a.tagName==='SELECT')};
window.addEventListener('keydown',e=>{if(typing()||S.mode!=='manual'||!view.offsetParent)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.code==='KeyG'&&!e.repeat&&S.running){cube.held?release():tryGrab()}keys.add(e.code)});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('#touchPad button').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!S.running)return;if(k==='KeyG'){cube.held?release():tryGrab();return}keys.add(k)});
  ['pointerup','pointerleave','pointercancel'].forEach(t=>b.addEventListener(t,()=>keys.delete(k)))});

/* cameras: Follow (orbit around the drone, keeps up with it), Whole cage, Drone cam, Top; plus the drone-cam inset */
function setView(v){camView=v;document.querySelectorAll('#views button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===v));
  controls.enabled=v==='follow'||v==='orbit';camera.up.set(0,1,0);
  if(v==='orbit'){camera.position.set(15,13,17);controls.target.set(0,6,0);controls.update()}
  if(v==='follow'){controls.target.copy(S.p);camera.position.copy(followSpot());controls.update()}}
// Where to put the follow camera: of eight spots around the drone (3.6 ft out, 2.2 ft up, inside the cage), the one
// whose line of sight to the drone stays farthest from every pipe, post and the bin.
function followSpot(){let bestP=null,bestD=-1e9;const p=V(0,0,0);
  for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8,c=S.p.clone().add(V(Math.cos(a)*3.6,2.2,Math.sin(a)*3.6));
    c.x=Math.max(-4.7,Math.min(4.7,c.x));c.z=Math.max(-4.7,Math.min(4.7,c.z));
    let m=1e9;for(let i=1;i<=12;i++){p.lerpVectors(S.p,c,i/12);for(const s of segs)m=Math.min(m,segClosest(p,s.a,s.b,_q)-s.r);for(const b of boxes)m=Math.min(m,boxClosest(p,b,_q))}
    const d=m+.15*c.distanceTo(S.p);if(d>bestD){bestD=d;bestP=c}}
  return bestP}
document.querySelectorAll('#views button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.v)));
function fpvPose(cam){const f=fwdOf(S.yaw);cam.up.set(0,1,0);cam.position.copy(S.p).addScaledVector(f,.42);cam.lookAt(S.p.clone().addScaledVector(f,5).add(V(0,-.9,0)))}
const _d=V(0,0,0);
function updateCam(){
  if(camView==='orbit'){controls.update();return}
  if(camView==='follow'){_d.subVectors(S.p,controls.target).multiplyScalar(.15);controls.target.add(_d);camera.position.add(_d);controls.update();return}
  if(camView==='fpv'){fpvPose(camera);return}
  camera.position.set(0,27,.001);camera.up.set(0,0,-1);camera.lookAt(0,0,0)}

/* §04 "watch it think": no-fly cells, the search spreading, the straightened route (cube → last gate) */
const thinkGrp=new THREE.Group();scene.add(thinkGrp);
let thinkState=null;
// The demo plans from the cube to the last gate (Gate 4 on the original course), or to the bin on a course with no gates.
const thinkGoal=()=>{const g=gates[gates.length-1];return g?{p:g.approach.clone(),name:`Gate ${g.n}`}:{p:V(bin.x,2.7,bin.z),name:'the bin'}};
const THINK_TEXT=to=>[
  '<strong>1 · Map the no-fly zones.</strong> The autopilot splits the cage into 4-inch boxes (54,000 of them) and marks every box where the drone would come within 0.6 ft of a pipe or the bin. Those red boxes are off limits. (Boxes next to the nets, floor and ceiling are off limits too; they are hidden here.)',
  `<strong>2 · Search.</strong> A straight line from the cube (orange ball) to ${to} (green ball) would hit something. So, starting at the cube, it checks neighbouring boxes, always trying first the one that looks closest to the goal. Each blue box is one it checked: watch the search hit the obstacles and spread around them. When it reaches the goal, it traces back the chain of boxes: that is the orange route.`,
  '<strong>3 · Straighten.</strong> A route made of 4-inch steps zig-zags. So the autopilot joins far-apart points with straight lines wherever the straight line stays clear. Grey: the box-by-box route. Orange: the straightened route it will actually fly.'];
function think(stepN){
  thinkGrp.clear();if(thinkState&&thinkState.raf)cancelAnimationFrame(thinkState.raf);thinkState=null;
  document.querySelectorAll('[data-think]').forEach(b=>b.getAttribute('aria-pressed')!==null&&b.setAttribute('aria-pressed',b.dataset.think===String(stepN)));
  if(stepN==null){$('#thinkText').textContent='Pick a step to see it in the cage.';return}
  if(S.running){$('#thinkText').textContent='Wait for the flight to end (or press Reset), then try again.';return}
  const goalT=thinkGoal(),TT=THINK_TEXT(goalT.name);$('#thinkText').innerHTML=TT[stepN];
  if(camView!=='orbit')setView('orbit');
  ensureOcc();const A=V(cube.p.x,3,cube.p.z),B=goalT.p,box=new THREE.BoxGeometry(RES*.8,RES*.8,RES*.8);
  const m=new THREE.Matrix4();
  if(stepN===0){const cells=[];const p=V(0,0,0);for(let n=0;n<occ.length;n++)if(occ[n]){p.copy(cellPos(n));const nm=nearest(p).name;if(!/net|floor/.test(nm))cells.push(n)}
    const im=new THREE.InstancedMesh(box,new THREE.MeshBasicMaterial({color:0xE03131,transparent:true,opacity:.18,depthWrite:false}),cells.length);
    cells.forEach((n,i)=>{m.setPosition(cellPos(n));im.setMatrixAt(i,m)});thinkGrp.add(im);return}
  const r=astar(A,B,true);if(!r){$('#thinkText').textContent=`No route found from the cube to ${goalT.name}.`;return}
  const mark=(p,c)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),new THREE.MeshBasicMaterial({color:c}));s.position.copy(p);thinkGrp.add(s)};
  mark(A,0xD9480F);mark(B,0x2B8A3E);
  const line=(pts,c,o)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:c,transparent:true,opacity:o}));thinkGrp.add(l);return l};
  if(stepN===1){const im=new THREE.InstancedMesh(box,new THREE.MeshBasicMaterial({color:0x1971C2,transparent:true,opacity:.22,depthWrite:false}),r.order.length);
    r.order.forEach((n,i)=>{m.setPosition(cellPos(n));im.setMatrixAt(i,m)});im.count=0;thinkGrp.add(im);
    const total=r.order.length,dur=reduced?0:4500,t0=performance.now();thinkState={};
    const tick=t=>{const k=dur?Math.min(1,(t-t0)/dur):1;im.count=Math.floor(k*total);$('#thinkText').innerHTML=TT[1]+` <span class="mono">Boxes checked: ${im.count.toLocaleString()}</span>`;
      if(k<1)thinkState.raf=requestAnimationFrame(tick);else line(r.path,0xD9480F,1)};
    thinkState.raf=requestAnimationFrame(tick);return}
  line(r.path,0x56616C,.9);const sm=shortcut(r.path);line(sm,0xD9480F,1);
  sm.forEach(p=>mark(p,0xD9480F));
  $('#thinkText').innerHTML=TT[2]+` <span class="mono">${r.path.length} box-steps → ${sm.length-1} straight line${sm.length>2?'s':''}.</span>`;
}
document.querySelectorAll('[data-think]').forEach(b=>b.addEventListener('click',()=>think(b.dataset.think==='off'?null:+b.dataset.think)));

/* ---------- 10. course maps: from above and from the south, drawn from `course` (used by §02 and §07) ---------- */
// Top map: 36 px/ft, x right, y (north) up. Side view (from the south): x right, height up, 18 px/ft.
const SVGNS='http://www.w3.org/2000/svg';
const mx=x=>200+36*x, my=y=>200-36*y, mh=h=>380-18*h;
function svgEl(svg,tag,a,txt){const e=document.createElementNS(SVGNS,tag);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;svg.appendChild(e);return e}
// The two posts of a gate, in students' (x, y).
function gatePosts(q){const [dx,dy]=GDIR[q.dir],hw=q.w/2;return[{x:q.x+dy*hw,y:q.y-dx*hw},{x:q.x-dy*hw,y:q.y+dx*hw}]}
const gateCss=i=>GATE_COL[i%8][1];
// o.sel: the selected item ('pad', 'cube', 'bin', 'g0', 'p2' …); o.grab: mark items so they can be dragged (§07).
function mapTop(svg,o={}){svg.innerHTML='';const E=(t,a,x,p=svg)=>svgEl(p,t,a,x),ar='ar-'+svg.id;
  const defs=E('defs',{}),mk=E('marker',{id:ar,viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'},null,defs);E('path',{d:'M0 0L10 5L0 10z',fill:'#56616C'},null,mk);
  E('rect',{x:20,y:20,width:360,height:360,fill:'#ECEFF2',stroke:'#56616C','stroke-width':2});
  for(let i=-5;i<=5;i++){const b=i%5===0;E('line',{x1:mx(i),y1:20,x2:mx(i),y2:380,stroke:b?'#94A2AF':'#D3DAE1','stroke-width':b?1.4:1});E('line',{x1:20,y1:my(i),x2:380,y2:my(i),stroke:b?'#94A2AF':'#D3DAE1','stroke-width':b?1.4:1});
    E('text',{x:mx(i),y:394,'text-anchor':'middle'},i);E('text',{x:12,y:my(i)+3,'text-anchor':'middle'},i)}
  E('rect',{x:29,y:29,width:342,height:342,fill:'none',stroke:'#C92A2A','stroke-opacity':.12,'stroke-width':18});   // 0.5 ft keep-out along the nets
  E('text',{x:200,y:14,'text-anchor':'middle',class:'lbl'},'N ↑');
  const G=k=>E('g',o.grab?{'data-item':k,class:'item'}:{});
  const C=course;
  C.poles.forEach(q=>{if(q.to<0||!q.bars.length)return;const b=C.poles[q.to];E('line',{x1:mx(q.x),y1:my(q.y),x2:mx(b.x),y2:my(b.y),stroke:'#15AABF','stroke-width':4})});
  C.poles.forEach((q,i)=>{const g=G('p'+i),css=q.h>=19.5?'#F76707':'#2F9E44';
    E('circle',{cx:mx(q.x),cy:my(q.y),r:36*(DR+PR),fill:'#C92A2A','fill-opacity':.1},null,g);E('circle',{cx:mx(q.x),cy:my(q.y),r:o.grab?7:5,fill:css},null,g);
    if(o.grab)E('text',{x:mx(q.x)+9,y:my(q.y)-7,class:'lbl',fill:css},`P${i+1}`,g)});
  C.gates.forEach((q,i)=>{const g=G('g'+i),css=gateCss(i);
    if(q.type==='v'){const [p1,p2]=gatePosts(q),[dx,dy]=GDIR[q.dir];
      E('line',{x1:mx(p1.x),y1:my(p1.y),x2:mx(p2.x),y2:my(p2.y),stroke:css,'stroke-width':3,'stroke-dasharray':'6 4'},null,g);
      [p1,p2].forEach(p=>E('circle',{cx:mx(p.x),cy:my(p.y),r:5,fill:css},null,g));
      E('line',{x1:mx(q.x-dx*.6),y1:my(q.y-dy*.6),x2:mx(q.x+dx*.6),y2:my(q.y+dy*.6),stroke:css,'stroke-width':1.5,'marker-end':`url(#${ar})`},null,g);
      const inner=Math.hypot(p1.x,p1.y)<Math.hypot(p2.x,p2.y)?p1:p2,ox=inner.x-q.x,oy=inner.y-q.y,L=Math.hypot(ox,oy)||1;   // label just past the post nearer the cage centre
      if(q.dir==='E'||q.dir==='W')E('text',{x:mx(inner.x)+ox/L*16,y:my(inner.y)-oy/L*16+4,'text-anchor':'middle',class:'lbl',fill:css},`Gate ${i+1}`,g);
      else E('text',{x:mx(q.x),y:my(q.y-dy*.6)+dy*14+4,'text-anchor':'middle',class:'lbl',fill:css},`Gate ${i+1}`,g);   // north/south gates: label on the side you fly in from
      if(o.grab)E('circle',{cx:mx(q.x),cy:my(q.y),r:13,fill:'transparent'},null,g)}
    else{const hs=q.s/2;E('rect',{x:mx(q.x-hs),y:my(q.y+hs),width:36*q.s,height:36*q.s,fill:css,'fill-opacity':.08,stroke:css,'stroke-width':3},null,g);
      E('text',{x:mx(q.x),y:my(q.y+hs)-5,'text-anchor':'middle',class:'lbl',fill:css},`Gate ${i+1} ↓`,g)}});
  {const b=C.bin,hw=bin.hw,g=G('bin');E('rect',{x:mx(b.x-hw),y:my(b.y+hw),width:72*hw,height:72*hw,fill:'#D6336C','fill-opacity':.25,stroke:'#D6336C','stroke-width':2},null,g);E('text',{x:mx(b.x),y:my(b.y-hw)+12,'text-anchor':'middle',class:'lbl',fill:'#A61E4D'},'DROP bin',g)}
  {const p=C.pad,g=G('pad');E('circle',{cx:mx(p.x),cy:my(p.y),r:36*PAD_R,fill:'#fff',stroke:'#D9480F','stroke-width':2},null,g);E('text',{x:mx(p.x),y:my(p.y)+5,'text-anchor':'middle',class:'lbl',fill:'#D9480F'},'H',g)}
  {const c=o.grab?C.cube:S3(cube.home),g=G('cube');E('rect',{x:mx(c.x)-20,y:my(c.y)-20,width:40,height:40,fill:'#40C057','fill-opacity':.25,stroke:'#2B8A3E'},null,g);E('rect',{x:mx(c.x)-6,y:my(c.y)-6,width:12,height:12,fill:'#E03131'},null,g);
    E('text',{x:mx(c.x),y:my(c.y)+32,'text-anchor':'middle',class:'lbl'},'cube',g)}
  if(o.sel){const n=svg.querySelector(`[data-item="${o.sel}"]`);if(n){const b=n.getBBox();E('rect',{x:b.x-5,y:b.y-5,width:b.width+10,height:b.height+10,rx:6,fill:'none',stroke:'#17202A','stroke-width':1.5,'stroke-dasharray':'4 3','pointer-events':'none'})}}
}
function mapSide(svg){svg.innerHTML='';const E=(t,a,x)=>svgEl(svg,t,a,x);
  E('rect',{x:20,y:20,width:360,height:360,fill:'#ECEFF2',stroke:'#56616C','stroke-width':2});
  for(let h=0;h<=20;h++){const b=h%5===0;E('line',{x1:20,y1:mh(h),x2:380,y2:mh(h),stroke:b?'#94A2AF':'#E1E6EB'});if(b)E('text',{x:14,y:mh(h)+3,'text-anchor':'middle'},h)}
  for(let i=-5;i<=5;i++){E('line',{x1:mx(i),y1:20,x2:mx(i),y2:380,stroke:i%5===0?'#94A2AF':'#E1E6EB'});E('text',{x:mx(i),y:394,'text-anchor':'middle'},i)}
  E('text',{x:26,y:32,class:'lbl'},'height (ft)');
  const C=course;
  C.poles.forEach(q=>E('line',{x1:mx(q.x),y1:mh(0),x2:mx(q.x),y2:mh(q.h),stroke:q.h>=19.5?'#F76707':'#2F9E44','stroke-width':4,'stroke-opacity':.55}));
  C.poles.forEach(q=>{if(q.to<0)return;const b=C.poles[q.to];q.bars.forEach(h=>{if(h<=Math.min(q.h,b.h))E('line',{x1:mx(q.x),y1:mh(h),x2:mx(b.x),y2:mh(h),stroke:'#15AABF','stroke-width':4})})});
  C.gates.forEach((q,i)=>{const css=gateCss(i);
    if(q.type==='v'){const lo=Math.max(q.lo,0);
      if(q.dir==='E'||q.dir==='W'){const x=mx(q.x);   // seen edge-on: the opening is the gap between the bars
        if(lo>.3)E('line',{x1:x,y1:mh(0),x2:x,y2:mh(lo),stroke:css,'stroke-width':5});
        E('rect',{x:x-6,y:mh(q.hi),width:12,height:mh(lo)-mh(q.hi),fill:'none',stroke:css,'stroke-width':2,'stroke-dasharray':'4 3'});
        E('line',{x1:x-8,y1:mh(q.hi),x2:x+8,y2:mh(q.hi),stroke:css,'stroke-width':5});
        E('text',{x:x+9,y:mh(q.hi)-4,class:'lbl',fill:css},`Gate ${i+1}`)}
      else{const a=mx(q.x-q.w/2),b=mx(q.x+q.w/2);   // seen face-on: a frame
        [a,b].forEach(x=>E('line',{x1:x,y1:mh(0),x2:x,y2:mh(q.hi),stroke:css,'stroke-width':4}));
        E('line',{x1:a,y1:mh(q.hi),x2:b,y2:mh(q.hi),stroke:css,'stroke-width':4});if(lo>.3)E('line',{x1:a,y1:mh(lo),x2:b,y2:mh(lo),stroke:css,'stroke-width':4});
        E('rect',{x:a+4,y:mh(q.hi)+3,width:b-a-8,height:mh(lo)-mh(q.hi)-6,fill:css,'fill-opacity':.08});
        E('text',{x:(a+b)/2,y:mh(q.hi)-5,'text-anchor':'middle',class:'lbl',fill:css},`Gate ${i+1}`)}}
    else{const a=mx(q.x-q.s/2),b=mx(q.x+q.s/2);E('line',{x1:a,y1:mh(q.h),x2:b,y2:mh(q.h),stroke:css,'stroke-width':5,'stroke-dasharray':'8 5'});
      [a,b].forEach(x=>E('line',{x1:x,y1:mh(0),x2:x,y2:mh(q.h),stroke:css,'stroke-width':3,'stroke-opacity':.6}));
      E('text',{x:(a+b)/2,y:mh(q.h)-6,'text-anchor':'middle',class:'lbl',fill:css},`Gate ${i+1} ↓`)}});
  E('rect',{x:mx(C.bin.x-bin.hw),y:mh(bin.h),width:72*bin.hw,height:mh(0)-mh(bin.h),fill:'#D6336C','fill-opacity':.35,stroke:'#D6336C'});
  E('rect',{x:mx(C.pad.x-PAD_R),y:mh(0)-3,width:72*PAD_R,height:3,fill:'#D9480F'});
}
// §02's list of what is on the course.
function renderLegend(){const C=course,num=v=>String(+v.toFixed(1));
  const L=C.gates.map((q,i)=>`<li><strong style="color:${gateCss(i)}">Gate ${i+1}</strong>: `+(q.type==='v'?`fly through between heights ${q.lo>.3?num(q.lo):'0 (the floor)'} and ${num(q.hi)} ft.`:`a hoop at ${num(q.h)} ft; fly <em>down</em> through it.`)+'</li>');
  if(!C.gates.length)L.push('<li>This course has no gates.</li>');
  const green=C.poles.filter(p=>p.h<19.5),orange=C.poles.length-green.length,hs=[...new Set(green.map(p=>num(p.h)))];
  const bars=C.poles.filter(p=>p.to>=0&&p.bars.length);
  if(C.poles.length){let t=[];if(green.length)t.push(`${green.length===1?'the green pole is':'green poles are'} ${hs.join(' or ')} ft tall`);if(orange)t.push(`${orange===1?'the orange pole reaches':'orange poles reach'} the ceiling (20 ft)`);
    L.push(`<li>${t.join(', ').replace(/^./,c=>c.toUpperCase())}${bars.length?`; cyan bars join ${bars.length===1?'two poles':'pairs of poles'} at ${[...new Set(bars.flatMap(p=>p.bars.map(num)))].join(' and ')} ft`:''}.</li>`)}
  L.push('<li>Pick up: hover about 0.7 ft above the floor, right over the cube. Drop: over the bin, about 2 ft up.</li>');
  $('#courseLegend').innerHTML=L.join('');
  const t=thinkGoal();$('#thinkTo').textContent=`How it would plan a shortcut from the cube to ${t.name}:`}

/* ---------- 11. path editor ---------- */
// Waypoints are kept in students' coordinates {x, y, h, tag}. Top map: 36 px/ft, x right, y (north) up.
// Side view (from the south): x right, height up, 18 px/ft.
const EX_FULL=[[-3.6,3.6,4],[-2.5,1.2,4],[-2.6,-1.4,4],[-3.8,-3.2,3],[-3.8,-3.2,.7,'pick'],[-3.8,-3.2,3],[-0.8,-3.2,3],[0.4,-3.2,9.5],[3.0,-3.2,9.5],
  [3.6,0,8],[3.6,0,4],[3.6,1.8,2.5],[3.2,3.4,2],[0.8,3.4,2],[-0.8,3.4,2,'drop'],[-0.8,3.4,4],[-3.6,3.6,4,'land']];
const EX_GATE1=[[-3.6,3.6,3],[-2.5,1.2,3],[-2.6,-1.4,3],[-3.6,-3.2,3],[-0.6,-3.2,3],[-3.6,-3.2,3],[-2.6,-1.4,3],[-2.5,1.2,3],[-3.6,3.6,3,'land']];
const toWps=a=>a.map(([x,y,h,tag])=>({x,y,h,tag:tag||''}));
const ped=(function(){
  const top=$('#pedTop'),side=$('#pedSide'),NS='http://www.w3.org/2000/svg';
  const tx=x=>200+36*x, ty=y=>200-36*y, sx=tx, sh=h=>380-18*h;
  const ix=X=>(X-200)/36, iy=Y=>(200-Y)/36, ih=Y=>(380-Y)/18;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), r1=v=>Math.round(v*10)/10;
  let wps=store.get('path',null);if(!Array.isArray(wps)||!wps.every(w=>w&&isFinite(w.x)&&isFinite(w.y)&&isFinite(w.h)))wps=toWps(EX_GATE1);
  let sel=-1,bad=[];
  const save=()=>store.set('path',wps);
  const fix=w=>{w.x=r1(clamp(w.x,-4.5,4.5));w.y=r1(clamp(w.y,-4.5,4.5));w.h=r1(clamp(w.h,.3,19.5))};
  const world=()=>wps.map(w=>({p:W(w.x,w.y,w.h),tag:w.tag}));
  // Pre-flight check: every leg sampled every 0.1 ft against every obstacle; plus pick / drop / land sanity checks.
  function check(){const out=[],pts=[V(PAD.x,3,PAD.z)].concat(world().map(q=>q.p)),p=V(0,0,0);bad=[];
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],n=Math.max(1,Math.ceil(a.distanceTo(b)/.1));let worst=null;
      for(let k=0;k<=n;k++){p.lerpVectors(a,b,k/n);const r=nearest(p);if(r.d<DR&&(!worst||r.d<worst.d))worst={d:r.d,name:r.name,at:p.clone()}}
      if(worst){bad.push(i);const leg=i===0?'Take-off → 1':`${i} → ${i+1}`;out.push(['bad',`Leg ${leg} hits ${worst.name} near ${fmtP(worst.at)}.`])}}
    const picks=wps.filter(w=>w.tag==='pick'),drops=wps.filter(w=>w.tag==='drop'),land=wps.findIndex(w=>w.tag==='land');
    if(level.cube&&!picks.length)out.push(['warn','No waypoint is tagged pick, so the drone will not grab the cube.']);
    picks.forEach(w=>{const c=S3(cube.home),dx=Math.hypot(w.x-c.x,w.y-c.y),clawH=w.h-HOLD-CUBE_H;
      if(dx>.3||clawH<-.15||clawH>.3)out.push(['bad',`Pick waypoint ${wps.indexOf(w)+1} is not over the cube: the claw would miss. The cube is at x ${f1(c.x)}, y ${f1(c.y)}; hover at a height of about 0.7 ft.`])});
    if(level.cube&&!drops.length)out.push(['warn','No waypoint is tagged drop, so the cube will not be released over the bin.']);
    drops.forEach(w=>{const b=S3(V(bin.x,0,bin.z));if(Math.abs(w.x-b.x)>bin.hw-.15||Math.abs(w.y-b.y)>bin.hw-.15)out.push(['bad',`Drop waypoint ${wps.indexOf(w)+1} is not over the bin (x ${f1(b.x)}, y ${f1(b.y)}).`])});
    if(land<0&&wps.length)out.push(['warn','No waypoint is tagged land: the drone will land at the last waypoint.']);
    else if(land>=0){const w=wps[land],pd=S3(PAD);if(Math.hypot(w.x-pd.x,w.y-pd.y)>PAD_R-.2)out.push(['warn',`The land waypoint is not over pad H (x ${f1(pd.x)}, y ${f1(pd.y)}).`])}
    if(level.gates.length){const miss=level.gates.filter(n=>!pathCrosses(n));if(miss.length)out.push(['warn',`Your path does not pass through gate${miss.length>1?'s':''} ${miss.join(', ')}.`])}
    if(!out.length&&wps.length)out.push(['ok','All clear: no leg hits anything. Press Launch on the flight deck below.']);
    if(!wps.length)out.push(['warn','Click the map to add your first waypoint.']);
    $('#pedCheck').innerHTML=out.map(([c,t])=>`<li class="${c==='ok'?'ok':c==='bad'?'bad':''}">${c==='ok'?'✓':c==='bad'?'✗':'!'} ${t}</li>`).join('')}
  // Does the planned path cross gate n inside its opening?
  function pathCrosses(n){const g=gates[n-1],pts=[V(PAD.x,3,PAD.z)].concat(world().map(q=>q.p)),p=V(0,0,0);let prev=null;
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],k=Math.max(1,Math.ceil(a.distanceTo(b)/.05));
      for(let j=0;j<=k;j++){p.lerpVectors(a,b,j/k);let s,inside;
        if(g.type==='v'){const r=p.clone().sub(g.center);s=r.x*g.dv.x+r.z*g.dv.z;inside=Math.abs(r.x*g.lv.x+r.z*g.lv.z)<g.w/2&&p.y>g.lo&&p.y<g.hi}
        else{s=p.y-g.h;inside=Math.abs(p.x-g.center.x)<g.s/2&&Math.abs(p.z-g.center.z)<g.s/2}
        if(prev!=null&&Math.sign(s)!==Math.sign(prev)&&inside)return true;prev=s}}return false}
  const el=(svg,tag,a,txt)=>{const e=document.createElementNS(NS,tag);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;svg.appendChild(e);return e};
  function drawTop(){mapTop(top);
    drawPath(top,w=>tx(w.x),w=>ty(w.y),{x:tx(S3(PAD).x),y:ty(S3(PAD).y)})}
  function drawSide(){mapSide(side);
    drawPath(side,w=>sx(w.x),w=>sh(w.h),{x:sx(S3(PAD).x),y:sh(3)})}
  // Path, red where a leg is bad, and numbered draggable waypoints.
  function drawPath(svg,fx,fy,start){const all=[start].concat(wps.map(w=>({x:fx(w),y:fy(w)})));
    for(let i=0;i<all.length-1;i++)el(svg,'line',{x1:all[i].x,y1:all[i].y,x2:all[i+1].x,y2:all[i+1].y,stroke:bad.includes(i)?'#C92A2A':'#D9480F','stroke-width':bad.includes(i)?4:2.5,'stroke-dasharray':i===0?'4 4':''});
    wps.forEach((w,i)=>{const g=el(svg,'g',{class:'wp','data-i':i});const on=i===sel;
      el(g,'circle',{cx:fx(w),cy:fy(w),r:on?11:9,fill:on?'#17202A':'#D9480F',stroke:'#fff','stroke-width':2,'data-i':i});
      el(g,'text',{x:fx(w),y:fy(w)+3.5,'text-anchor':'middle',style:'fill:#fff;font-weight:700;font-size:9px;font-family:var(--body)','data-i':i},i+1);
      if(w.tag)el(g,'text',{x:fx(w)+12,y:fy(w)-8,class:'lbl',fill:w.tag==='pick'?'#2B8A3E':w.tag==='drop'?'#D6336C':'#D9480F','data-i':i},w.tag)})}
  function drawTable(){const T=$('#pedTbl');
    T.innerHTML='<thead><tr><th>#</th><th>x (ft)</th><th>y (ft)</th><th>height (ft)</th><th>Tag</th><th></th></tr></thead><tbody>'+
      wps.map((w,i)=>`<tr class="${i===sel?'sel':''}" data-i="${i}"><td class="t">${i+1}</td>${['x','y','h'].map(k=>`<td><input type="number" step="0.1" data-k="${k}" data-i="${i}" value="${w[k].toFixed(1)}" aria-label="Waypoint ${i+1} ${k==='h'?'height':k}"></td>`).join('')}
        <td><select data-k="tag" data-i="${i}" aria-label="Waypoint ${i+1} tag">${['','pick','drop','land'].map(t=>`<option value="${t}"${w.tag===t?' selected':''}>${t||'—'}</option>`).join('')}</select></td>
        <td><button data-del="${i}" aria-label="Delete waypoint ${i+1}" style="padding:2px 8px">×</button></td></tr>`).join('')+'</tbody>';
    T.querySelectorAll('input,select').forEach(e=>e.addEventListener('change',()=>{const w=wps[+e.dataset.i];if(e.dataset.k==='tag')w.tag=e.value;else{const v=parseFloat(e.value);if(isFinite(v))w[e.dataset.k]=v}fix(w);sel=+e.dataset.i;changed()}));
    T.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{wps.splice(+b.dataset.del,1);sel=-1;changed()}));
    T.querySelectorAll('tr[data-i]').forEach(r=>r.addEventListener('focusin',()=>{if(sel!==+r.dataset.i){sel=+r.dataset.i;drawTop();drawSide();$('#pedDel').disabled=false;r.parentNode.querySelectorAll('tr').forEach(x=>x.classList.toggle('sel',x===r))}}))}
  function draw(){check();drawTop();drawSide();$('#pedDel').disabled=sel<0}
  function changed(){save();draw();drawTable();previewPath()}
  // pointer: top map adds / moves (x, y); side view moves (x, height)
  function pt(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
  let drag=null;
  function down(svg,isTop,e){const t=e.target.closest&&e.target.closest('[data-i]'),q=pt(svg,e);
    if(t){sel=+t.dataset.i;drag={svg,isTop};svg.setPointerCapture(e.pointerId);draw();drawTable();e.preventDefault();return}
    if(isTop&&q.x>=20&&q.x<=380&&q.y>=20&&q.y<=380){const prev=wps[wps.length-1];const w={x:ix(q.x),y:iy(q.y),h:prev?prev.h:3,tag:''};fix(w);wps.push(w);sel=wps.length-1;changed()}}
  function move(svg,isTop,e){const q=pt(svg,e);
    if(isTop)$('#pedHover').textContent=`x ${f1(clamp(ix(q.x),-5,5))}, y ${f1(clamp(iy(q.y),-5,5))}`;else $('#pedHover').textContent=`x ${f1(clamp(ix(q.x),-5,5))}, height ${f1(clamp(ih(q.y),0,20))}`;
    if(!drag||drag.svg!==svg||sel<0)return;const w=wps[sel];w.x=ix(q.x);if(isTop)w.y=iy(q.y);else w.h=ih(q.y);fix(w);draw()}
  function up(){if(drag){drag=null;changed()}}
  [[top,true],[side,false]].forEach(([svg,isTop])=>{svg.addEventListener('pointerdown',e=>down(svg,isTop,e));svg.addEventListener('pointermove',e=>move(svg,isTop,e));
    svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up)});
  $('#pedExample').onclick=()=>{wps=toWps(EX_FULL);sel=-1;setLevel(3);changed()};
  $('#pedGate1').onclick=()=>{wps=toWps(EX_GATE1);sel=-1;setLevel(1);changed()};
  $('#pedClear').onclick=()=>{if(!wps.length||confirm('Clear all waypoints?')){wps=[];sel=-1;changed()}};
  $('#pedDel').onclick=()=>{if(sel>=0){wps.splice(sel,1);sel=-1;changed()}};
  wps.forEach(fix);
  return {world,draw:()=>{draw();drawTable()}};
})();

/* ---------- 12. blocks: program the drone (§03) ---------- */
// A program is a list of blocks {id, op, …fields, body, els}. It runs as a generator: each flying block becomes
// one or more legs, pulled only when the drone has finished the last one, so sensors and the camera are read live.
const blk=(function(){
  const SENS=['front','right','rear','left','down'];
  const NUM=(k,d,a,b,o={})=>Object.assign({k,t:'num',d,a,b},o), SEL=(k,o,d)=>({k,t:'sel',o,d});
  const CK=SEL('ck',[['sensor','distance sensor'],['seen','camera sees the cube'],['holding','claw is holding the cube']],'sensor');
  const CF=[SEL('s',SENS,'down'),SEL('cmp',[['<','<'],['>','>']],'<'),NUM('v',.4,0,20)];
  const BK={
    takeoff:{c:'move',f:['take off to height',NUM('h',3,.6,19.5),'ft']},
    flyto:{c:'move',f:['fly to x',NUM('x',0,-4.5,4.5),'y',NUM('y',0,-4.5,4.5),'height',NUM('h',3,.3,19.5)]},
    move:{c:'move',f:['move',SEL('dir',['north','south','east','west','up','down'],'up'),NUM('d',1,0,15),'ft']},
    land:{c:'move',f:['land']},
    over:{c:'go',f:['fly over',SEL('tg',[['cube','the cube'],['bin','the bin'],['pad','pad H']],'cube'),'at height',NUM('h',3,.3,19.5),'ft']},
    gate:{c:'go',f:['fly through gate',NUM('n',1,1,8,{int:1})]},
    grab:{c:'claw',f:['close the claw (grab)']},
    drop:{c:'claw',f:['open the claw (drop)']},
    repeat:{c:'ctl',f:['repeat',NUM('n',3,1,50,{int:1}),'times'],body:1},
    until:{c:'ctl',f:['repeat until','COND'],body:1},
    if:{c:'ctl',f:['if','COND'],body:1,els:1},
    wait:{c:'ctl',f:['wait',NUM('s',1,0,10),'seconds']},
    say:{c:'ctl',f:['say',{k:'txt',t:'txt',d:'Hello!'}]},
  };
  const CATS=[['move','Fly'],['go','Go to'],['claw','Claw'],['ctl','Control']];
  let nid=1;
  function make(op,v={}){const sp=BK[op],b={id:nid++,op};
    sp.f.forEach(x=>{if(typeof x==='object')b[x.k]=x.d});
    if(sp.f.includes('COND')){b.ck=op==='if'?'holding':'sensor';CF.forEach(x=>b[x.k]=x.d)}
    if(sp.body)b.body=[];if(sp.els)b.els=[];
    return Object.assign(b,v)}
  // Tidy a block from storage or an example: known blocks only, every number in range.
  function clean(b,depth=0){if(!b||!BK[b.op]||depth>8)return null;const sp=BK[b.op],o=make(b.op);
    const fit=(x,v)=>{if(x.t==='num'){v=+v;if(!isFinite(v))return x.d;v=Math.min(x.b,Math.max(x.a,v));return x.int?Math.round(v):Math.round(v*100)/100}
      if(x.t==='sel')return x.o.some(q=>(Array.isArray(q)?q[0]:q)===v)?v:x.d;return String(v==null?x.d:v).slice(0,40)};
    sp.f.forEach(x=>{if(typeof x==='object')o[x.k]=fit(x,b[x.k])});
    if(sp.f.includes('COND')){o.ck=fit(CK,b.ck);CF.forEach(x=>o[x.k]=fit(x,b[x.k]))}
    if(sp.body)o.body=(Array.isArray(b.body)?b.body:[]).map(c=>clean(c,depth+1)).filter(Boolean);
    if(sp.els)o.els=(Array.isArray(b.els)?b.els:[]).map(c=>clean(c,depth+1)).filter(Boolean);
    return o}
  const strip=list=>list.map(b=>{const o=Object.assign({},b);delete o.id;if(o.body)o.body=strip(o.body);if(o.els)o.els=strip(o.els);return o});
  const walk=(list,fn,parent)=>list.forEach((b,i)=>{fn(b,list,i);if(b.body)walk(b.body,fn);if(b.els)walk(b.els,fn)});
  const count=()=>{let n=0;walk(prog,()=>n++);return n};
  function find(id){let r=null;walk(prog,(b,list,i)=>{if(b.id===id)r={b,list,i}});return r}

  /* examples: the original course; [op, {fields}, [body], [else]] */
  const X=a=>a.map(([op,v,body,els])=>{const b=make(op,v||{});if(body)b.body=X(body);if(els)b.els=X(els);return b});
  const EXAMPLES={
    gate1:{level:1,prog:[['takeoff',{h:3}],['flyto',{x:-2.5,y:1.2,h:3}],['flyto',{x:-2.6,y:-1.4,h:3}],['flyto',{x:-3.6,y:-3.2,h:3}],['gate',{n:1}],['move',{dir:'west',d:2.8}],
      ['flyto',{x:-2.6,y:-1.4,h:3}],['flyto',{x:-2.5,y:1.2,h:3}],['over',{tg:'pad',h:3}],['land']]},
    pick:{level:2,prog:[['takeoff',{h:3}],['flyto',{x:-2.5,y:1.2,h:3}],['flyto',{x:-2.6,y:-1.4,h:3}],['over',{tg:'cube',h:3}],
      ['until',{ck:'sensor',s:'down',cmp:'<',v:.4},[['move',{dir:'down',d:.25}]]],['grab'],['move',{dir:'up',d:2.5}],
      ['flyto',{x:-2.6,y:-1.4,h:3}],['flyto',{x:-2.5,y:1.2,h:3}],['over',{tg:'bin',h:2.5}],
      ['if',{ck:'holding'},[['drop']],[['say',{txt:'Oops, I am not holding the cube!'}]]],['over',{tg:'pad',h:3}],['land']]},
    full:{level:3,prog:[['takeoff',{h:4}],['flyto',{x:-2.5,y:1.2,h:4}],['flyto',{x:-2.6,y:-1.4,h:4}],['over',{tg:'cube',h:3}],
      ['until',{ck:'sensor',s:'down',cmp:'<',v:.4},[['move',{dir:'down',d:.25}]]],['grab'],['move',{dir:'up',d:2.5}],
      ['gate',{n:1}],['flyto',{x:.4,y:-3.2,h:9.5}],['gate',{n:2}],['gate',{n:3}],['flyto',{x:3.6,y:1.8,h:2.5}],['gate',{n:4}],
      ['over',{tg:'bin',h:2}],['drop'],['over',{tg:'pad',h:4}],['land']]}};

  let prog=(Array.isArray(store.get('prog',null))?store.get('prog',[]):null);
  prog=prog?prog.map(b=>clean(b)).filter(Boolean):X(EXAMPLES.gate1.prog);
  let cur={list:prog,i:prog.length},lists=[],errId=null,showCode=false;
  const save=()=>store.set('prog',strip(prog));

  /* ---- editor ---- */
  const box=$('#blkProg'),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const optT=(x,v)=>{const q=x.o.find(q=>(Array.isArray(q)?q[0]:q)===v);return Array.isArray(q)?q[1]:q};
  function field(b,x){
    if(x.t==='num')return `<input type="number" step="${x.int?1:x.k==='d'||x.k==='v'?0.05:0.1}" min="${x.a}" max="${x.b}" data-k="${x.k}" value="${b[x.k]}" aria-label="${x.k}">`;
    if(x.t==='sel')return `<select data-k="${x.k}" aria-label="${x.k}">${x.o.map(q=>{const [v,t]=Array.isArray(q)?q:[q,q];return `<option value="${esc(v)}"${b[x.k]===v?' selected':''}>${esc(t)}</option>`}).join('')}</select>`;
    return `<input type="text" class="txt" maxlength="40" data-k="${x.k}" value="${esc(b[x.k])}" aria-label="words to say">`}
  const cond=b=>`<span class="cond">${field(b,CK)}${b.ck==='sensor'?CF.map(x=>field(b,x)).join('')+'<span>ft</span>':''}</span>`;
  function slot(l,i,empty){const on=cur.list===lists[l]&&cur.i===i;
    return `<div class="slot${on?' on':''}${empty?' empty':''}" data-l="${l}" data-i="${i}" role="button" tabindex="0" aria-label="Put new blocks here">${on?'▸ new blocks go here':empty?'empty: click here, then a block':''}</div>`}
  function listHTML(list){const l=lists.push(list)-1;let h='';list.forEach((b,i)=>{h+=slot(l,i)+blockHTML(b)});return h+slot(l,list.length,!list.length)}
  function blockHTML(b){const sp=BK[b.op];
    const row=sp.f.map(x=>x==='COND'?cond(b):typeof x==='string'?`<span>${x}</span>`:field(b,x)).join('');
    const tools=`<span class="bk-tools"><span class="grip" draggable="true" title="Drag to move" aria-hidden="true">⠿</span><button data-act="up" aria-label="Move up">▲</button><button data-act="dn" aria-label="Move down">▼</button><button data-act="del" aria-label="Delete block">✕</button></span>`;
    let h=`<div class="bk c-${sp.c}${b.id===errId?' err':''}" data-id="${b.id}"><div class="bk-row">${row}${tools}</div>`;
    if(sp.body)h+=`<div class="bk-body">${listHTML(b.body)}</div>`;
    if(sp.els)h+=`<div class="bk-row"><span>else</span></div><div class="bk-body">${listHTML(b.els)}</div>`;
    return h+'</div>'}
  function render(){
    const all=[prog];walk(prog,b=>{if(b.body)all.push(b.body);if(b.els)all.push(b.els)});
    if(!all.includes(cur.list))cur={list:prog,i:prog.length};cur.i=Math.min(cur.i,cur.list.length);
    lists=[];box.innerHTML=listHTML(prog);
    const n=count();$('#blkInfo').textContent=`${n} block${n===1?'':'s'}.`+(n>=200?' That is the most a program can have.':'');
    if(showCode)$('#blkCode').innerHTML=py(prog,'').replace(/\b(for|in|range|while|not|if|else|pass)\b/g,'<b>$1</b>')}
  function changed(){save();render()}
  function insert(b,list=cur.list,i=cur.i){if(count()>=200)return;list.splice(i,0,b);cur=BK[b.op].body?{list:b.body,i:0}:{list,i:i+1};errId=null;changed()}
  // palette
  const pv=x=>x==='COND'?'':typeof x==='string'?x:`<i>${x.t==='sel'?optT(x,x.d)+' ▾':x.t==='txt'?'…':x.d}</i>`;
  $('#blkPal').innerHTML=CATS.map(([c,t])=>`<h5>${t}</h5>`+Object.keys(BK).filter(op=>BK[op].c===c).map(op=>{const sp=BK[op];
    const words=sp.f.map(x=>x==='COND'?`<i class="cond">${op==='if'?'claw is holding the cube ▾':'down sensor &lt; 0.4'}</i>`:pv(x)).join(' ');
    return `<button class="bk c-${c}" data-op="${op}" draggable="true">${words}${sp.body?'<span class="pbody"></span>':''}</button>`}).join('')).join('');
  $('#blkPal').querySelectorAll('[data-op]').forEach(p=>{p.addEventListener('click',()=>insert(make(p.dataset.op)));
    p.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','new:'+p.dataset.op);e.dataTransfer.effectAllowed='copyMove';document.body.classList.add('bkdrag')});
    p.addEventListener('dragend',()=>document.body.classList.remove('bkdrag'))});
  // program: clicks, edits, drags
  box.addEventListener('click',e=>{const s=e.target.closest('.slot');if(s){cur={list:lists[+s.dataset.l],i:+s.dataset.i};render();return}
    const a=e.target.closest('[data-act]');if(!a)return;const f=find(+a.closest('.bk').dataset.id);if(!f)return;const {list,i}=f;
    if(a.dataset.act==='del'){list.splice(i,1);if(cur.list===list&&cur.i>i)cur.i--}
    else{const j=i+(a.dataset.act==='up'?-1:1);if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]]}
    errId=null;changed()});
  box.addEventListener('keydown',e=>{const s=e.target.closest('.slot');if(s&&(e.key==='Enter'||e.key===' ')){e.preventDefault();s.click()}});
  const edit=(e,final)=>{const t=e.target,k=t.dataset&&t.dataset.k;if(!k)return;const f=find(+t.closest('.bk').dataset.id);if(!f)return;const b=f.b;
    const x=BK[b.op].f.find(x=>typeof x==='object'&&x.k===k)||[CK,...CF].find(x=>x.k===k);if(!x)return;
    if(x.t==='num'){let v=parseFloat(t.value);if(!isFinite(v)){if(final)t.value=b[k];return}
      if(final){v=Math.min(x.b,Math.max(x.a,v));v=x.int?Math.round(v):Math.round(v*100)/100;t.value=v}b[k]=v}
    else b[k]=x.t==='txt'?t.value.slice(0,40):t.value;
    save();if(k==='ck')render();else if(showCode)$('#blkCode').innerHTML=py(prog,'').replace(/\b(for|in|range|while|not|if|else|pass)\b/g,'<b>$1</b>')};
  box.addEventListener('input',e=>edit(e,false));box.addEventListener('change',e=>edit(e,true));
  box.addEventListener('dragstart',e=>{const g=e.target.closest&&e.target.closest('.grip');if(!g)return;const el=g.closest('.bk');
    e.dataTransfer.setData('text/plain','mv:'+el.dataset.id);e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setDragImage(el,12,12)}catch(_){/* older browsers */}document.body.classList.add('bkdrag')});
  box.addEventListener('dragend',()=>document.body.classList.remove('bkdrag'));
  box.addEventListener('dragover',e=>{const s=e.target.closest('.slot');if(!s)return;e.preventDefault();box.querySelectorAll('.slot.drop').forEach(x=>x!==s&&x.classList.remove('drop'));s.classList.add('drop')});
  box.addEventListener('dragleave',e=>{const s=e.target.closest('.slot');if(s)s.classList.remove('drop')});
  box.addEventListener('drop',e=>{const s=e.target.closest('.slot');document.body.classList.remove('bkdrag');if(!s)return;e.preventDefault();
    const d=e.dataTransfer.getData('text/plain')||'',list=lists[+s.dataset.l];let i=+s.dataset.i;
    if(d.startsWith('new:')&&BK[d.slice(4)]){insert(make(d.slice(4)),list,i);return}
    if(!d.startsWith('mv:'))return;const f=find(+d.slice(3));if(!f)return;
    let inside=false;walk([f.b],(b)=>{if(b.body===list||b.els===list)inside=true});if(inside)return;   // not into itself
    f.list.splice(f.i,1);if(f.list===list&&f.i<i)i--;list.splice(i,0,f.b);cur={list,i:i+1};errId=null;changed()});
  // the program as Python-style code
  const nf=v=>String(+(+v).toFixed(2));
  const pc=b=>b.ck==='seen'?'camera_sees_cube()':b.ck==='holding'?'holding_cube()':`sensor("${b.s}") ${b.cmp} ${nf(b.v)}`;
  function py(list,ind){if(!list.length)return ind+'pass\n';const I=ind+'    ';return list.map(b=>{switch(b.op){
    case 'takeoff':return `${ind}take_off(height=${nf(b.h)})\n`;
    case 'flyto':return `${ind}fly_to(x=${nf(b.x)}, y=${nf(b.y)}, height=${nf(b.h)})\n`;
    case 'move':return `${ind}move("${b.dir}", ${nf(b.d)})\n`;
    case 'land':return `${ind}land()\n`;
    case 'over':return `${ind}fly_over("${b.tg}", height=${nf(b.h)})\n`;
    case 'gate':return `${ind}fly_through_gate(${b.n})\n`;
    case 'grab':return `${ind}close_claw()\n`;
    case 'drop':return `${ind}open_claw()\n`;
    case 'wait':return `${ind}wait(${nf(b.s)})\n`;
    case 'say':return `${ind}say("${esc(b.txt.replace(/"/g,"'"))}")\n`;
    case 'repeat':return `${ind}for i in range(${b.n}):\n`+py(b.body,I);
    case 'until':return `${ind}while not ${b.ck==='sensor'?'('+pc(b)+')':pc(b)}:\n`+py(b.body,I);
    case 'if':return `${ind}if ${pc(b)}:\n`+py(b.body,I)+(b.els.length?`${ind}else:\n`+py(b.els,I):'')}return ''}).join('')}
  // A block's words with its values, for the Steps list and the log.
  function label(b){return BK[b.op].f.map(x=>x==='COND'?'':typeof x==='string'?x:x.t==='sel'?optT(x,b[x.k]):x.t==='txt'?`“${b[x.k]}”`:nf(b[x.k])).join(' ').trim()}

  /* ---- running a program ---- */
  const R={gen:null,at:V(0,0,0),air:false,acts:0,evals:0};
  class BErr extends Error{constructor(b,m){super(m);this.b=b}}
  function test(b){if(b.ck==='holding')return cube.held;readSensors();if(b.ck==='seen')return sense.seen;const d=sense.d[SENS.indexOf(b.s)];return b.cmp==='<'?d<b.v:d>b.v}
  function* runList(list){for(const b of list)yield* runBlock(b)}
  function* runBlock(b){if(++R.evals>5000)throw new BErr(b,'the program went round its loops 5,000 times without flying. Is a loop empty?');
    if(b.op==='repeat'){for(let i=0;i<b.n;i++)yield* runList(b.body);return}
    if(b.op==='until'){while(!test(b)){if(++R.evals>5000)throw new BErr(b,'this “repeat until” never became true, and the loop inside it does not fly anywhere.');yield* runList(b.body)}return}
    if(b.op==='if'){yield* runList(test(b)?b.body:b.els);return}
    yield b}
  const MOVE={north:[0,0,-1],south:[0,0,1],east:[1,0,0],west:[-1,0,0],up:[0,1,0],down:[0,-1,0]};
  function toLegs(b){const lab=label(b);
    const need=()=>{if(!R.air)throw new BErr(b,'the drone is on the ground. Put a “take off” block before this one.')};
    const go=t=>{R.at.copy(t);return [L('path',lab,[S.p.clone(),t.clone()],{vmax:3,look:.55})]};
    switch(b.op){
      case 'takeoff':if(!R.air){R.air=true;S.armed=true;goal.landed=false;goal.onPad=false;R.at.copy(S.p);log('Motors on: taking off.')}
        {const t=V(R.at.x,b.h,R.at.z);R.at.copy(t);return [L('path',lab,[S.p.clone(),t],{vmax:2})]}
      case 'flyto':need();return go(W(b.x,b.y,b.h));
      case 'move':{need();const m=MOVE[b.dir],t=R.at.clone().add(V(m[0],m[1],m[2]).multiplyScalar(b.d));
        t.x=Math.max(-4.6,Math.min(4.6,t.x));t.z=Math.max(-4.6,Math.min(4.6,t.z));t.y=Math.max(GROUND+.02,Math.min(19.6,t.y));return go(t)}
      case 'over':{need();const p=b.tg==='cube'?cube.p:b.tg==='bin'?V(bin.x,0,bin.z):PAD;return go(V(p.x,b.h,p.z))}
      case 'gate':{need();const g=gates[b.n-1];if(!g)throw new BErr(b,`there is no gate ${b.n} on this course (it has ${gates.length}).`);
        R.at.copy(g.exit);return [L('path',lab,[S.p.clone(),g.approach.clone(),g.center.clone(),g.exit.clone()],{vmax:3,look:.55})]}
      case 'grab':return [L('grab',lab)];
      case 'drop':return [L('release',lab)];
      case 'land':if(!R.air){log('Land: the drone is already on the ground.');return []}R.air=false;return [L('land',lab)];
      case 'wait':return [L('wait',lab,null,{dur:b.s})];
      case 'say':hl(b.id);log(`Drone says: “${b.txt}”`,'good');return []}
    return []}
  function fail(e){errId=e.b?e.b.id:null;hl(null);const el=errId&&box.querySelector(`[data-id="${errId}"]`);if(el)el.classList.add('err');
    log(e.b?`Stopped at “${label(e.b)}”: ${e.message}`:`Program stopped: ${e.message}`,'bad');R.gen=null;
    if(R.air){R.air=false;S.legs.push(L('land','Land (program stopped)'));return true}return false}
  // Add the legs of the next flying block to S.legs. False when the program is over.
  function pull(){if(!R.gen)return false;
    for(;;){let r;try{r=R.gen.next()}catch(e){return fail(e)}
      if(r.done){R.gen=null;hl(null);if(R.air){R.air=false;log('End of the program, still flying: landing where it is.','bad');S.legs.push(L('land','Land (end of program)'));return true}log('End of the program.');return false}
      const b=r.value;if(++R.acts>400)return fail(new BErr(b,'the program has run 400 blocks. Is there a loop that never ends?'));
      let legs;try{legs=toLegs(b)}catch(e){return fail(e)}
      if(legs.length){legs.forEach(l=>l.bid=b.id);S.legs.push(...legs);return true}}}
  function start(){Object.assign(R,{gen:runList(prog),air:false,acts:0,evals:0});R.at.copy(S.p);errId=null;box.querySelectorAll('.bk.err').forEach(x=>x.classList.remove('err'))}
  function stop(){R.gen=null;R.air=false;hl(null)}
  function hl(id){box.querySelectorAll('.bk.run').forEach(x=>x.classList.remove('run'));if(id==null)return;const el=box.querySelector(`[data-id="${id}"]`);if(el)el.classList.add('run')}

  /* ---- buttons ---- */
  const load=k=>{const ex=EXAMPLES[k];prog=X(ex.prog);cur={list:prog,i:prog.length};errId=null;setLevel(ex.level);changed()};
  $('#blkEx1').onclick=()=>load('gate1');$('#blkEx2').onclick=()=>load('pick');$('#blkEx3').onclick=()=>load('full');
  $('#blkClear').onclick=()=>{if(!prog.length||confirm('Clear the whole program?')){prog=[];cur={list:prog,i:0};errId=null;changed()}};
  $('#blkCodeBtn').onclick=()=>{showCode=!showCode;$('#blkCodeBtn').setAttribute('aria-pressed',showCode);$('#blkCode').hidden=!showCode;render()};
  $('#blkRun').onclick=()=>{if(S.mode!=='blocks')setMode('blocks');launch();$('#deck').scrollIntoView({block:'nearest',behavior:reduced?'auto':'smooth'})};
  render();
  return {render,pull,start,stop,hl,count,py:()=>py(prog,''),load};
})();

/* ---------- 13. course designer (§07) ---------- */
const des=(function(){
  const top=$('#desTop'),side=$('#desSide');
  let sel=null,drag=null;
  const PRESETS={
    orig:{name:'Original',c:COURSE0},
    empty:{name:'Empty cage',c:{pad:COURSE0.pad,cube:COURSE0.cube,bin:COURSE0.bin,gates:[],poles:[]}},
    slalom:{name:'Slalom',c:{pad:{x:-3.6,y:-3.6},cube:{x:0,y:-3.6},bin:{x:3.6,y:3.6},
      gates:[{type:'v',x:-3,y:0,dir:'N',lo:.8,hi:4,w:2.4},{type:'v',x:0,y:0,dir:'S',lo:.8,hi:4,w:2.4},{type:'v',x:3,y:0,dir:'N',lo:.8,hi:4,w:2.4}],
      poles:[{x:-1.5,y:1.6,h:14,to:-1,bars:[]},{x:1.5,y:-1.6,h:14,to:-1,bars:[]},{x:-1.5,y:-3,h:14,to:-1,bars:[]},{x:1.5,y:3,h:14,to:-1,bars:[]}]}},
    high:{name:'Up high',c:{pad:{x:-3.6,y:-3.6},cube:{x:3.5,y:-3.5},bin:{x:-3.4,y:3.4},
      gates:[{type:'v',x:3.4,y:0,dir:'N',lo:5,hi:8,w:2.6},{type:'v',x:0,y:3.2,dir:'W',lo:12,hi:15,w:2.6},{type:'h',x:-3,y:0,h:10,s:2.6},{type:'v',x:0,y:-3.2,dir:'E',lo:.8,hi:3.2,w:2.4}],
      poles:[{x:0,y:0,h:20,to:-1,bars:[]},{x:1.6,y:1.6,h:14,to:3,bars:[6,11]},{x:-1.6,y:-1.6,h:14,to:-1,bars:[]},{x:-1.6,y:1.6,h:14,to:-1,bars:[]}]}},
  };
  $('#desPresets').innerHTML='<strong>Start from:</strong> '+Object.keys(PRESETS).map(k=>`<button data-pre="${k}">${PRESETS[k].name}</button>`).join('');
  $('#desPresets').querySelectorAll('[data-pre]').forEach(b=>b.addEventListener('click',()=>{sel=null;applyCourse(PRESETS[b.dataset.pre].c);msg([['ok',`Loaded “${PRESETS[b.dataset.pre].name}”. Press Check course, or Launch the autopilot.`]])}));
  const item=k=>k==='pad'||k==='cube'||k==='bin'?course[k]:k&&k[0]==='g'?course.gates[+k.slice(1)]:k&&k[0]==='p'?course.poles[+k.slice(1)]:null;
  const msg=L=>{$('#desCheck').innerHTML=L.map(([c,t])=>`<li class="${c==='ok'?'ok':c==='bad'?'bad':''}">${c==='ok'?'✓':c==='bad'?'✗':'!'} ${t}</li>`).join('')};
  function draw(){if(sel&&!item(sel))sel=null;mapTop(top,{sel,grab:true});mapSide(side);props();$('#desCode').value=courseJSON(course)}
  // the selected thing's settings
  function props(){const P=$('#desProps');
    if(!sel){P.innerHTML='<p class="small muted">Click something on the map to change it, or add a gate, hoop or pole. Drag things to move them.</p>';return}
    const q=item(sel),i=+sel.slice(1),F=[];let title,extra='';
    const num=(k,t,a,b,st=.1)=>F.push(`<label>${t}<input type="number" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${q[k]}"></label>`);
    num('x','x (ft, east)',-4.5,4.5);num('y','y (ft, north)',-4.5,4.5);
    if(sel==='pad')title='Pad H: take-off and landing';else if(sel==='cube')title='The cube, on its pickup mat';else if(sel==='bin')title='The drop bin';
    else if(sel[0]==='g'){title=q.type==='v'?`Gate ${i+1}`:`Gate ${i+1}: a hoop`;
      if(q.type==='v'){F.push(`<label>The autopilot flies through going<select data-k="dir">${Object.keys(GDIR).map(d=>`<option value="${d}"${q.dir===d?' selected':''}>${DIRWORD[d]}</option>`).join('')}</select></label>`);
        num('lo','Bottom bar height (0: no bar)',0,18);num('hi','Top bar height',1,19.5);num('w','Width',1,5)}
      else{num('h','Height',1,18);num('s','Size (each side)',1,4)}
      extra=`<button data-do="earlier"${i===0?' disabled':''}>Make it gate ${i}</button><button data-do="later"${i===course.gates.length-1?' disabled':''}>Make it gate ${i+2}</button><button data-do="del">Delete</button>`}
    else{title=`Pole P${i+1}`;num('h','Height (20: reaches the ceiling)',1,20,1);
      F.push(`<label>Cross bars to<select data-k="to"><option value="-1">no bars</option>${course.poles.map((p,j)=>j===i?'':`<option value="${j}"${q.to===j?' selected':''}>pole P${j+1}</option>`).join('')}</select></label>`);
      F.push(`<label>Bar heights (ft, commas)<input type="text" data-k="bars" value="${q.bars.join(', ')}" placeholder="5, 9"></label>`);
      extra='<button data-do="del">Delete</button>'}
    P.innerHTML=`<h3 style="font-size:1.05rem">${title}</h3><div class="dprops">${F.join('')}</div>${extra?`<div class="btns">${extra}</div>`:''}`;
    P.querySelectorAll('[data-k]').forEach(e=>e.addEventListener('change',()=>{const k=e.dataset.k;
      if(k==='dir')q.dir=e.value;else if(k==='to')q.to=+e.value;else if(k==='bars')q.bars=e.value.split(/[,;\s]+/).map(parseFloat).filter(isFinite);
      else{const v=parseFloat(e.value);if(!isFinite(v)){e.value=q[k];return}q[k]=v;if(k==='lo'&&q.hi<v+.5)q.hi=Math.min(19.5,v+3)}
      applyCourse(course)}));
    P.querySelectorAll('[data-do]').forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.do;
      if(sel[0]==='g'){const G=course.gates;
        if(d==='del'){G.splice(i,1);sel=null}else{const j=d==='earlier'?i-1:i+1;[G[i],G[j]]=[G[j],G[i]];sel='g'+j}}
      else{course.poles.splice(i,1);course.poles.forEach(p=>{if(p.to===i)p.to=-1;else if(p.to>i)p.to--});sel=null}
      applyCourse(course)}))}
  const add=(k,o)=>{const A=k==='g'?course.gates:course.poles;if(A.length>=(k==='g'?8:12)){msg([['bad',k==='g'?'A course can have up to 8 gates.':'A course can have up to 12 poles.']]);return}
    A.push(o);sel=k+(A.length-1);applyCourse(course);msg([['warn','Added in the middle of the cage: drag it where you want it.']])};
  $('#desAddGate').onclick=()=>add('g',{type:'v',x:0,y:0,dir:'E',lo:1.5,hi:4.5,w:2.4});
  $('#desAddHoop').onclick=()=>add('g',{type:'h',x:0,y:0,h:6,s:2.4});
  $('#desAddPole').onclick=()=>add('p',{x:0,y:0,h:14,to:-1,bars:[]});
  // drag on the map
  function pt(e){const p=top.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(top.getScreenCTM().inverse())}
  top.addEventListener('pointerdown',e=>{const t=e.target.closest&&e.target.closest('[data-item]');
    if(!t){if(sel){sel=null;draw()}return}
    sel=t.dataset.item;const q=item(sel),p=pt(e);drag={dx:q.x-(p.x-200)/36,dy:q.y-(200-p.y)/36,moved:false};top.setPointerCapture(e.pointerId);draw();e.preventDefault()});
  top.addEventListener('pointermove',e=>{const p=pt(e);$('#desHover').textContent=`x ${f1(Math.max(-5,Math.min(5,(p.x-200)/36)))}, y ${f1(Math.max(-5,Math.min(5,(200-p.y)/36)))}`;
    if(!drag||!sel)return;const q=item(sel),r=v=>Math.round(Math.max(-4.5,Math.min(4.5,v))*10)/10;
    q.x=r((p.x-200)/36+drag.dx);q.y=r((200-p.y)/36+drag.dy);drag.moved=true;mapTop(top,{sel,grab:true})});
  const up=()=>{if(!drag)return;const m=drag.moved;drag=null;if(m)applyCourse(course)};
  top.addEventListener('pointerup',up);top.addEventListener('pointercancel',up);
  // Check: openings big enough, pad and cube reachable, and a dry run of the autopilot's planning for the full course.
  function check(){const out=[],t0=performance.now();
    gates.forEach(g=>{if(g.type==='v'){if(g.w-2*PR<2*DR+.25)out.push(['bad',`Gate ${g.n} is too narrow for the drone: make it at least 1.4 ft wide.`]);
        if(g.hi-Math.max(g.lo,.3)<2*DR+.25)out.push(['bad',`Gate ${g.n}'s opening is too short: leave at least 1.3 ft between the floor or bottom bar and the top bar.`])}
      else if(g.s-2*PR<2*DR+.25)out.push(['bad',`The hoop (gate ${g.n}) is too small: make each side at least 1.4 ft.`])});
    if(Math.hypot(PAD.x-bin.x,PAD.z-bin.z)<PAD_R+bin.hw)out.push(['bad','Pad H is under the bin.']);
    if(clearance(V(PAD.x,1.5,PAD.z))<DR+.1)out.push(['bad','Something is too close to pad H: the drone could not take off.']);
    const pick=V(cube.home.x,CUBE_H+HOLD,cube.home.z);
    if(Math.abs(cube.home.x-bin.x)<bin.hw+.3&&Math.abs(cube.home.z-bin.z)<bin.hw+.3)out.push(['bad','The cube is in or against the bin.']);
    else if(clearance(pick)<DR)out.push(['bad',`The cube is too close to ${nearest(pick).name}: the drone cannot get down to it.`]);
    const leg=(what,a,b)=>{if(!plan(a,b))out.push(['bad',`The autopilot found no safe way ${what}.`])};
    let cur=V(PAD.x,3,PAD.z);const cubeH=V(cube.home.x,3,cube.home.z);leg('from pad H to the cube',cur,cubeH);cur=cubeH;
    gates.forEach(g=>{leg(`to gate ${g.n}`,cur,g.approach);if(!clearLine(g.approach,g.center)||!clearLine(g.center,g.exit))out.push(['bad',`Something blocks the way through gate ${g.n}, just in front of it or behind it.`]);cur=g.exit});
    leg('to the bin',cur,V(bin.x,2.7,bin.z));leg('from the bin back to pad H',V(bin.x,3.4,bin.z),V(PAD.x,3,PAD.z));
    if(!out.some(o=>o[0]==='bad'))out.push(['ok',`Flyable: the autopilot planned the full course${gates.length?` through all ${gates.length} gate${gates.length>1?'s':''}`:''} in ${(performance.now()-t0).toFixed(0)} ms. Press Launch below to watch it.`]);
    msg(out);return out}
  $('#desCheck0').onclick=check;
  $('#desCopy').onclick=()=>{const t=$('#desCode');t.select();const ok=()=>msg([['ok','Course code copied. Paste it into a message, or into this box on another computer.']]);
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t.value).then(ok,()=>{try{document.execCommand('copy');ok()}catch(_){msg([['warn','Select the code and copy it yourself (Ctrl+C).']])}});
    else{try{document.execCommand('copy');ok()}catch(_){msg([['warn','Select the code and copy it yourself (Ctrl+C).']])}}};
  $('#desLoad').onclick=()=>{let c;try{c=JSON.parse($('#desCode').value.trim())}catch(_){msg([['bad','That is not a course code. A course code starts with { and ends with }.']]);return}
    sel=null;applyCourse(c);msg([['ok','Course loaded.']])};
  return {draw,check};
})();
// Use a new course everywhere: 3D cage, planner, levels, scores, maps.
function applyCourse(c){course=cleanCourse(c);store.set('course',course);
  if(S.running||S.done)reset(true);think(null);buildCourse(course);refreshLevels();setLevel(level.id);reset(true);renderBest();renderLegend();ped.draw();des.draw();
  $('#desCheck').innerHTML='<li>Press <strong>Check course</strong> to test it.</li>'}

/* ---------- 14. mini-lab (§01) ---------- */
// Simple flight model: total thrust vs weight sets climb; front/back and left/right differences tilt the drone,
// and tilted thrust pushes it sideways; the two prop pairs' reaction twist turns it. Hover = 45% on every motor.
const lab=(function(){
  const cv=$('#cvLab'),r=new THREE.WebGLRenderer({canvas:cv,antialias:true});r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));r.shadowMap.enabled=true;
  const sc=new THREE.Scene();sc.background=new THREE.Color(0xE3E8ED);
  const cam=new THREE.PerspectiveCamera(40,1.5,.05,100);cam.position.set(2.6,1.9,3.2);
  const oc=new THREE.OrbitControls(cam,cv);oc.target.set(0,.8,0);oc.enableDamping=true;oc.minDistance=1.2;oc.maxDistance=12;oc.maxPolarAngle=Math.PI*.495;oc.update();
  sc.add(new THREE.HemisphereLight(0xffffff,0xaab4be,.85));const sl=new THREE.DirectionalLight(0xffffff,.7);sl.position.set(4,9,3);sl.castShadow=true;sc.add(sl);
  const ft=canvasTex(512,512,(c,w)=>{c.fillStyle='#ECEFF2';c.fillRect(0,0,w,w);for(let i=0;i<=8;i++){c.strokeStyle=i%4===0?'#94A2AF':'#C6CFD7';c.lineWidth=2;c.beginPath();c.moveTo(i*w/8,0);c.lineTo(i*w/8,w);c.stroke();c.beginPath();c.moveTo(0,i*w/8);c.lineTo(w,i*w/8);c.stroke()}});
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({map:ft}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;sc.add(fl);
  const D=makeDrone(sc);D.g.scale.setScalar(1.6);
  [['M1',.3,-.3],['M2',.3,.3],['M3',-.3,.3],['M4',-.3,-.3]].forEach(([t,x,z])=>{const s=textSprite(t,{h:.1,fg:'#fff',bg:'#17202A'});s.position.set(x*1.25,-.05,z*1.25);D.g.add(s)});
  const front=textSprite('FRONT',{h:.08,fg:'#fff',bg:'#E03131'});front.position.set(.38,.02,0);D.g.add(front);
  const st={p:V(0,.3*1.6,0),v:V(0,0,0),yaw:0,pitch:0,roll:0,m:[0,0,0,0]};const G0=.3*1.6;
  const ids=['m1','m2','m3','m4'];
  const PRESETS=[['Off',[0,0,0,0]],['Hover',[45,45,45,45]],['Climb',[55,55,55,55]],['Forward',[43,43,49,49]],['Backward',[49,49,43,43]],['Right',[49,43,43,49]],['Turn left',[51,39,51,39]],['Turn right',[39,51,39,51]]];
  $('#labPresets').innerHTML=PRESETS.map(([n],i)=>`<button data-pre="${i}">${n}</button>`).join('');
  $('#labPresets').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{PRESETS[+b.dataset.pre][1].forEach((v,i)=>$('#'+ids[i]).value=v);read();if(+b.dataset.pre===0)return;}));
  function read(){ids.forEach((id,i)=>{st.m[i]=+$('#'+id).value/100;$('#'+id+'v').textContent=$('#'+id).value+'%'})}
  ids.forEach(id=>$('#'+id).addEventListener('input',read));
  $('#labReset').onclick=()=>{st.p.set(0,G0,0);st.v.set(0,0,0);st.yaw=0;st.pitch=0;st.roll=0;ids.forEach(id=>$('#'+id).value=0);read()};
  read();
  let last=performance.now();
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;requestAnimationFrame(frame);
    if(!cv.offsetParent)return;
    const [m1,m2,m3,m4]=st.m,tot=m1+m2+m3+m4,HOV=1.8,air=st.p.y>G0+.01;
    const pitchT=Math.max(-.5,Math.min(.5,((m3+m4)-(m1+m2))*1.6)),rollT=Math.max(-.5,Math.min(.5,((m1+m4)-(m2+m3))*1.6)),yawRate=((m1+m3)-(m2+m4))*4.5;
    const lift=tot/HOV,canTilt=air||lift>1.02;
    st.pitch+=((canTilt?pitchT:0)-st.pitch)*Math.min(1,dt*6);st.roll+=((canTilt?rollT:0)-st.roll)*Math.min(1,dt*6);if(canTilt)st.yaw+=yawRate*dt;
    const ay=G*.25*(lift*Math.cos(st.pitch)*Math.cos(st.roll)-1);
    const fwd=V(Math.cos(st.yaw),0,-Math.sin(st.yaw)),rt=V(Math.sin(st.yaw),0,Math.cos(st.yaw));
    const ah=fwd.multiplyScalar(G*.25*lift*Math.sin(st.pitch)).addScaledVector(rt,G*.25*lift*Math.sin(st.roll));
    if(air||ay>0){st.v.x+=ah.x*dt;st.v.z+=ah.z*dt;st.v.y+=ay*dt;st.v.multiplyScalar(1-dt*.8);st.p.addScaledVector(st.v,dt)}
    if(st.p.y<=G0){st.p.y=G0;if(st.v.y<0)st.v.y=0;st.v.x*=.8;st.v.z*=.8}
    let wall=false;for(const ax of['x','z'])if(Math.abs(st.p[ax])>3.6){st.p[ax]=Math.sign(st.p[ax])*3.6;st.v[ax]=0;wall=true}
    if(st.p.y>6){st.p.y=6;st.v.y=Math.min(0,st.v.y);wall=true}
    D.g.position.copy(st.p);D.g.rotation.set(st.roll,st.yaw,-st.pitch);
    animateProps(D,st.m,dt,true,1.3);
    _d.subVectors(st.p,oc.target).multiplyScalar(.1);oc.target.add(_d);cam.position.add(_d);oc.update();
    const w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*r.getPixelRatio())||cv.height!==Math.round(h*r.getPixelRatio())){r.setSize(w,h,false);cam.aspect=w/Math.max(1,h);cam.updateProjectionMatrix()}
    r.render(sc,cam);
    // words for what is happening
    const pct=Math.round(lift*100),vs=st.v.y,hs=Math.hypot(st.v.x,st.v.z),parts=[];
    if(!air&&lift<=1.02)parts.push(tot>0?`Sitting on the floor: thrust is only ${pct}% of the drone's weight.`:'Motors off.');
    else parts.push(vs>.25?'Climbing':vs<-.25?'Sinking':'Hovering');
    if(canTilt&&Math.abs(pitchT)>.03)parts.push(pitchT>0?'nose tipped down → moving forward':'nose tipped up → moving backward');
    if(canTilt&&Math.abs(rollT)>.03)parts.push(rollT>0?'tilted right → sliding right':'tilted left → sliding left');
    if(canTilt&&Math.abs(yawRate)>.05)parts.push(yawRate>0?'turning left':'turning right');
    if(wall)parts.push('(it reached the edge of the lab: press "Put it back")');
    $('#labWhat').textContent=parts.join(', ')+'.';
    $('#labNums').textContent=`Total thrust ${pct}% of weight · height ${(st.p.y-G0).toFixed(1)} ft · speed ${hs.toFixed(1)} ft/s · tilt ${(st.pitch*57.3).toFixed(0)}° forward, ${(st.roll*57.3).toFixed(0)}° right`;
  }
  requestAnimationFrame(frame);
  return {};
})();

/* ---------- 15. quiz (§01) ---------- */
(function(){
  const Q=[
    {q:'To make a hovering drone climb straight up, you should…',o:['speed up all four props','speed up the two front props','speed up the two left props'],a:0,why:['Right: more total thrust than weight, and still level, so it goes straight up.','Faster front props tip the nose up: the drone would fly backward.','Faster left props tilt it to the right: it would slide sideways.']},
    {q:'To fly forward, the drone tips its nose down. Which props spin faster?',o:['the front ones','the back ones','all four the same'],a:1,why:['Faster front props lift the nose: that flies it backward.','Right: the back lifts, the nose tips down, and the tilted thrust pushes it forward.','With equal props it stays level and does not move forward.']},
    {q:'Why do two props spin one way and the other two spin the opposite way?',o:['so the drone does not spin on the spot','to make the drone louder','so it can fly upside down'],a:0,why:['Right: each prop twists the body the other way. Opposite pairs cancel the twist, and changing the balance between the pairs is how it turns.','Noise is not the reason.','Drones like this cannot fly upside down.']}];
  const box=$('#quiz1');box.innerHTML='<span class="eyebrow">Quick check</span>'+Q.map((x,i)=>`<div class="q" data-q="${i}"><div><strong>${i+1}.</strong> ${x.q}</div><div class="opts">${x.o.map((o,j)=>`<button data-o="${j}">${o}</button>`).join('')}</div><div class="fb"></div></div>`).join('');
  box.querySelectorAll('.q').forEach(d=>{const x=Q[+d.dataset.q];d.querySelectorAll('[data-o]').forEach(b=>b.addEventListener('click',()=>{const j=+b.dataset.o,ok=j===x.a;
    d.querySelector('.fb').innerHTML=`<span class="${ok?'c-ok':'c-bad'}"><strong>${ok?'Yes.':'Not quite.'}</strong></span> ${x.why[j]}`;b.blur()}))});
})();

/* ---------- 16. pages: one section at a time; the deck moves to the section shown ---------- */
const SHORT={plan:'Plan',meet:'Meet the drone',plan2:'Plan a path',prog:'Program it',auto:'Autopilot',manual:'Fly it yourself',chal:'Challenges',design:'Design a course',exit:'Exit ticket'};
const SECS=[...document.querySelectorAll('.wrap > section')];
const nav={paged:store.get('paged',true)!==false,cur:null};
const secName=s=>s.querySelector('h2 .n').textContent+' '+(SHORT[s.id]||s.id);
$('#lnav').innerHTML=`<button id="navBack" aria-label="Previous section">◀</button><div class="tabsrow">${SECS.map(s=>`<button data-go="${s.id}">${secName(s)}</button>`).join('')}</div><button id="navNext" aria-label="Next section">▶</button><button id="navMode"></button>`;
SECS.forEach((s,i)=>{const d=document.createElement('div');d.className='pager';
  d.innerHTML=(i>0?`<button data-go="${SECS[i-1].id}">◀ ${secName(SECS[i-1])}</button>`:'')+(i<SECS.length-1?`<button class="primary nextbtn" data-go="${SECS[i+1].id}">Next: ${secName(SECS[i+1])} ▶</button>`:'<span class="muted small">End of the lesson.</span>');s.append(d)});
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.go)));
// Put the deck in a section's slot and switch to that section's flying mode.
function placeDeck(sec){const slot=sec&&sec.querySelector('.deckslot');if(!slot)return;if(slot.firstChild!==$('#deck'))slot.appendChild($('#deck'));
  const m=slot.dataset.mode;if(m!=='keep'&&m!==S.mode)setMode(m);if(sec.id!=='auto')think(null)}
function goTo(id,noscroll){
  const i=SECS.findIndex(s=>s.id===id);if(i<0)return;nav.cur=id;store.set('sec',id);
  document.body.classList.toggle('paged',nav.paged);
  SECS.forEach(s=>s.hidden=nav.paged&&s.id!==id);
  document.querySelector('header.top').hidden=nav.paged&&i>0;
  if(nav.paged)placeDeck(SECS[i]);else if(!$('#deck').parentNode.classList.contains('deckslot'))placeDeck(SECS.find(s=>s.querySelector('.deckslot')));
  navMark(id);$('#navBack').disabled=i===0;$('#navNext').disabled=i===SECS.length-1;
  $('#navMode').textContent=nav.paged?'Show all':'One at a time';
  if(id==='plan2')ped.draw();if(id==='prog')blk.render();if(id==='design')des.draw();
  if(noscroll)return;if(nav.paged)window.scrollTo(0,0);else $('#'+id).scrollIntoView();
}
function navMark(id){document.querySelectorAll('#lnav [data-go]').forEach(b=>b.setAttribute('aria-current',b.dataset.go===id));
  const row=document.querySelector('#lnav .tabsrow'),b=row.querySelector(`[data-go="${id}"]`);if(b)row.scrollLeft=b.offsetLeft-row.clientWidth/2+b.offsetWidth/2}
const stepSec=d=>{const i=SECS.findIndex(s=>s.id===nav.cur)+d;if(i>=0&&i<SECS.length)goTo(SECS[i].id)};
$('#navBack').onclick=()=>stepSec(-1);$('#navNext').onclick=()=>stepSec(1);
$('#navMode').onclick=()=>{nav.paged=!nav.paged;store.set('paged',nav.paged);goTo(nav.cur)};
{const io=new IntersectionObserver(es=>{if(nav.paged)return;const v=es.find(e=>e.isIntersecting);if(v){nav.cur=v.target.id;navMark(v.target.id);store.set('sec',v.target.id)}},{rootMargin:'-70px 0px -60% 0px'});SECS.forEach(s=>io.observe(s))}

/* ---------- 17. loop / boot ---------- */
function setBar(id,frac,col){const b=$(id);b.style.width=(Math.max(0,Math.min(1,frac))*100).toFixed(1)+'%';if(col)b.style.background=col}
function ui(){
  $('#tAlt').innerHTML=`${(S.p.y-GROUND).toFixed(1)} <small>ft</small>`;
  $('#tSpd').innerHTML=`${S.v.length().toFixed(1)} <small>ft/s</small>`;
  $('#tHdg').textContent=String(Math.round(((90-S.yaw*180/Math.PI)%360+360)%360)).padStart(3,'0')+'°';
  $('#tPit').textContent=`${(-S.tz*180/Math.PI).toFixed(1)}°`;$('#tRol').textContent=`${(S.tx*180/Math.PI).toFixed(1)}°`;
  $('#tBat').textContent=`${S.battery.toFixed(0)}%`;$('#tBat').style.color=S.battery<15?'var(--bad)':'';
  $('#tPos').textContent=fmtP(V(S.p.x,S.p.y-GROUND,S.p.z));$('#tCol').textContent=S.contacts;$('#tCol').style.color=S.contacts?'var(--bad)':'';
  $('#tCube').textContent=cube.held?'in claw':cube.delivered?'in bin ✓':cube.rest?(cube.p.distanceTo(cube.home)<.05?'on mat':'on floor'):'falling';
  ['F','R','B','L','D'].forEach((k,i)=>{const d=sense.d[i],on=S.armed||i===4;
    $('#v'+k).textContent=on?`${d>=beamMax[i]-.01?'>'+beamMax[i]:d.toFixed(2)} ft`:'—';
    setBar('#b'+k,on?(i===4?d/20:1-d/beamMax[i]):0,i===4?'#1971C2':d<1?'#C92A2A':d<2.5?'#E67700':'#2B8A3E')});
  $('#vision').textContent=S.armed?sense.vision:'Camera: idle';
  S.motors.forEach((m,i)=>{setBar('#mb'+i,m,m>.85?'#C92A2A':'#D9480F');$('#mv'+i).textContent=`${Math.round(m*100)}%`});
  $('#hudClock').textContent=`T+ ${S.t.toFixed(1)} s${S.paused?' · paused':''}`;
  if(S.running)renderScore();
}
function resize(){const r=view.getBoundingClientRect();if(!r.width)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(view);resize();
let last=performance.now(),lastUI=0;
function frame(now){const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;requestAnimationFrame(frame);
  if(S.running&&!S.paused){const sd=dt*speedMul,n=Math.max(1,Math.ceil(sd/(1/240)));for(let i=0;i<n;i++){step(sd/n);if(!S.running)break}
    if(S.armed&&S.battery<=0){log('Battery empty.','bad');finish()}}
  else if(!S.running&&!cube.rest)step(dt*speedMul);
  if(!view.offsetParent)return;
  drone.g.position.copy(S.p);drone.g.rotation.set(S.tx,S.yaw,S.tz);
  const want=cube.held?0:.5;S.claw+=(want-S.claw)*Math.min(1,dt*10);drone.fingerL.rotation.x=S.claw;drone.fingerR.rotation.x=-S.claw;
  animateProps(drone,S.motors,S.paused?0:dt,$('#optThrust').checked,.9);
  cubeMesh.position.copy(cube.p);cubeMesh.rotation.y=cube.held?S.yaw:cubeMesh.rotation.y;
  readSensors();updateCam();
  const W0=renderer.domElement.clientWidth,H0=renderer.domElement.clientHeight;
  renderer.setScissorTest(false);renderer.setViewport(0,0,W0,H0);renderer.render(scene,camera);
  const pip=$('#pip'),pipOn=$('#optPip').checked&&camView!=='fpv';pip.hidden=!pipOn;
  if(pipOn){const vr=view.getBoundingClientRect(),pr=pip.getBoundingClientRect(),x=pr.left-vr.left,y=vr.bottom-pr.bottom,w=pr.width,h=pr.height;
    fpvPose(pipCam);pipCam.aspect=w/Math.max(1,h);pipCam.updateProjectionMatrix();
    beams.forEach(b=>b.userData.v=b.visible);beams.forEach(b=>b.visible=false);
    renderer.setScissorTest(true);renderer.setScissor(x,y,w,h);renderer.setViewport(x,y,w,h);renderer.render(scene,pipCam);renderer.setScissorTest(false);renderer.setViewport(0,0,W0,H0);
    beams.forEach(b=>b.visible=b.userData.v)}
  if(now-lastUI>100){lastUI=now;ui()}
}
$('#levelBtns').innerHTML=LEVELS.map(l=>`<button class="seg" data-l="${l.id}">${l.id} · ${l.name}</button>`).join('');
$('#levelBtns').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{setLevel(+b.dataset.l);ped.draw()}));
resetGoals();setLevel(level.id);renderBest();renderLegend();des.draw();$('#desCheck').innerHTML='<li>Press <strong>Check course</strong> to test it.</li>';
setMode(MODE[store.get('mode','auto')]?store.get('mode','auto'):'auto');reset(true);ped.draw();setView('follow');
log('Drone on pad H. Pick a mode and press Launch.');
{const saved=store.get('sec',null);goTo(SECS.some(s=>s.id===saved)?saved:SECS[0].id,true)}
requestAnimationFrame(frame);
})();
