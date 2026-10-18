/* fixlib.js — the fixing library: clamps, clips and grommets known by part name.
 * A part counts as a fixing when its name matches an entry's pattern (case-insensitive; plain text = "name contains",
 * * and ? = wildcards over the whole name). The bore range is a check only: a bore outside it is still used, with a warning.
 * Saved in localStorage; export / import as JSON. Thumbnails are drawn from the open STEP (part box + bores).
 * Browser and Node: window.FixLib / module.exports.
 */
(function(root){
"use strict";
const KEY='routeStudio.fixLib.v1';
const TYPES=['clamp','clip','grommet'];
const SEED=[
  {pattern:'990224',type:'clamp',boreMin:21,boreMax:24,notes:'Seeded from piping2 practice.'},
  {pattern:'22402156',type:'clip',boreMin:12,boreMax:15,notes:'Twin clip: holds a Ø12 and a Ø15 pipe side by side (piping3 practice). No CSYS on its bores.'}];
const mem={v:null};
const ls=()=>{try{return root.localStorage||null;}catch(e){return null;}};
const uid=()=>'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clean=e=>({id:e.id||uid(),pattern:String(e.pattern||'').trim(),type:TYPES.includes(e.type)?e.type:'clamp',
  boreMin:+e.boreMin||0,boreMax:Math.max(+e.boreMin||0,+e.boreMax||0),notes:String(e.notes||''),thumb:typeof e.thumb==='string'&&e.thumb.startsWith('data:image/')?e.thumb:''});
function all(){if(mem.v)return mem.v;const s=ls();let v=null;
  if(s){try{v=JSON.parse(s.getItem(KEY)||'null');}catch(e){v=null;}}
  mem.v=Array.isArray(v)?v.map(clean):SEED.map(clean);if(!Array.isArray(v))save();return mem.v;}
function save(){const s=ls();if(s)try{s.setItem(KEY,JSON.stringify(mem.v));}catch(e){}changed();}
let hooks=[];const changed=()=>hooks.forEach(f=>{try{f();}catch(e){console.error(e);}});
function onChange(f){hooks.push(f);}
function reset(list){mem.v=(list||[]).map(clean);save();}

function rx(pat){const p=pat.toLowerCase();
  if(/[*?]/.test(p))return new RegExp('^'+p.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');
  return{test:s=>s.includes(p)};}
// first entry whose pattern matches any of the given names
function test(pattern,name){return!!pattern&&rx(pattern).test(String(name).toLowerCase());}
function match(...names){const N=names.filter(Boolean).map(n=>String(n).toLowerCase());
  return all().find(e=>e.pattern&&N.some(n=>rx(e.pattern).test(n)))||null;}
function add(e){const x=clean(e);all().push(x);save();return x;}
function update(id,patch){const x=all().find(e=>e.id===id);if(!x)return null;Object.assign(x,clean(Object.assign({},x,patch,{id})));save();return x;}
function remove(id){mem.v=all().filter(e=>e.id!==id);save();}
// suggested pattern for a part name: its last run of 5+ digits (U104904_990224 -> 990224), else the name
function suggest(name){const m=String(name).match(/(\d{5,})(?!.*\d{5,})/);return m?m[1]:String(name);}

// ---- JSON ----
function toJSON(){return JSON.stringify({app:'Route Studio',kind:'fixing-library',version:1,entries:all().map(({id,...e})=>e)},null,1);}
// merge by pattern: same pattern replaces, new ones are added
function fromJSON(text){const d=JSON.parse(text),list=Array.isArray(d)?d:d&&d.entries;
  if(!Array.isArray(list))throw new Error('not a fixing library (no entries)');
  let added=0,replaced=0;const A=all();
  list.forEach(e=>{const x=clean(e);if(!x.pattern)return;const i=A.findIndex(a=>a.pattern.toLowerCase()===x.pattern.toLowerCase());
    if(i>=0){x.id=A[i].id;if(!x.thumb)x.thumb=A[i].thumb;A[i]=x;replaced++;}else{A.push(x);added++;}});
  save();return{added,replaced};}

// ---- thumbnail. Shaded (three.js, from the part's flat and cylindrical faces) when THREE is loaded; else the part's
// box and its bores as a line drawing. Bores are tinted; their axis is dashed. ----
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],addv=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return mul(a,1/l);};
const viewDir=d0=>[[1,1,1],[-1,1,1],[1,-1,1],[-1,-1,1]].map(norm).sort((a,b)=>Math.abs(Math.abs(dot(a,d0))-0.55)-Math.abs(Math.abs(dot(b,d0))-0.55))[0];
const bores=(r,inst)=>(r.holes||r.fixings).filter(x=>x.inst===inst);
let GL=null;
function gl(){if(GL!==null)return GL;try{const R=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(1);GL=R;}catch(e){GL=false;}return GL;}
// triangles of one face in world coordinates, or null when the face kind is not drawn
function faceMesh(f,M,P){const pt=p=>P.pt(M,p),vec=v=>P.vec(M,v);
  if(f.kind==='plane'&&f.ax&&f.loops.length){const o=pt(f.ax.o),ex=norm(vec(f.ax.x)),ey=norm(vec(f.ax.y));
    const L=f.loops.map(lp=>{const q=lp.map(p=>{const w=sub(pt(p),o);return[dot(w,ex),dot(w,ey)];});let a=0;for(let i=0;i<q.length;i++){const j=(i+1)%q.length;a+=q[i][0]*q[j][1]-q[j][0]*q[i][1];}return{q,area:Math.abs(a)};}).sort((a,b)=>b.area-a.area);
    const shape=new THREE.Shape(L[0].q.map(v=>new THREE.Vector2(v[0],v[1])));L.slice(1).forEach(h=>shape.holes.push(new THREE.Path(h.q.map(v=>new THREE.Vector2(v[0],v[1])))));
    let g;try{g=new THREE.ShapeGeometry(shape);}catch(e){return null;}const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){const w=addv(o,addv(mul(ex,pos.getX(i)),mul(ey,pos.getY(i))));pos.setXYZ(i,w[0],w[1],w[2]);}g.computeVertexNormals();return g;}
  if(f.kind==='cylindrical'&&f.ax&&f.r>0&&f.loops.length){const o=pt(f.ax.o),z=norm(vec(f.ax.z)),ex=norm(vec(f.ax.x)),ey=cross(z,ex),TAU=Math.PI*2;
    let t0=Infinity,t1=-Infinity;const ang=[];f.loops.forEach(lp=>lp.forEach(p=>{const w=sub(pt(p),o),t=dot(w,z);t0=Math.min(t0,t);t1=Math.max(t1,t);ang.push(((Math.atan2(dot(w,ey),dot(w,ex))%TAU)+TAU)%TAU);}));
    if(!(t1-t0>1e-6))return null;ang.sort((a,b)=>a-b);let gap=ang[0]+TAU-ang[ang.length-1],th0=ang[0];for(let i=1;i<ang.length;i++){const d=ang[i]-ang[i-1];if(d>gap){gap=d;th0=ang[i];}}
    const full=gap<Math.PI/6,span=full?TAU:TAU-gap,a0=full?0:th0,N=Math.max(8,Math.ceil(span/TAU*48)),V=[],I=[];
    for(let i=0;i<=N;i++){const a=a0+span*i/N,rad=addv(mul(ex,f.r*Math.cos(a)),mul(ey,f.r*Math.sin(a)));[t0,t1].forEach(t=>{const w=addv(o,addv(rad,mul(z,t)));V.push(w[0],w[1],w[2]);});
      if(i<N){const b=2*i;I.push(b,b+1,b+2,b+1,b+3,b+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V,3));g.setIndex(I);g.computeVertexNormals();return g;}
  return null;}
function shaded(r,inst,w,h,entry){const R=gl();if(!R||typeof StepAsm==='undefined')return'';const I=r.instances[inst],P=StepAsm.F;
  // highlight the bores that matter: the ones with a CSYS, and those inside the entry's bore range
  const B=bores(r,inst).filter(x=>x.csys||(entry&&entry.boreMax>0&&x.D>=entry.boreMin-0.05&&x.D<=entry.boreMax+0.05));
  const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
  const mat=new THREE.MeshStandardMaterial({color:0xA9B8C8,metalness:0.1,roughness:0.75,side:THREE.DoubleSide});let nFaces=0;
  I.part.solids.forEach(s=>s.faces.forEach(f=>{const g=faceMesh(f,I.M,P);if(!g)return;nFaces++;root.add(new THREE.Mesh(g,mat));
    if(f.kind==='plane')root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,30),new THREE.LineBasicMaterial({color:0x3C4A5A,transparent:true,opacity:0.55})));}));
  if(!nFaces)return'';
  const box=new THREE.Box3().setFromObject(root);   // fit to the part itself, not to the bore axes
  B.forEach(x=>{const d=norm(x.d),L=x.length,g=new THREE.CylinderGeometry(x.r*0.97,x.r*0.97,L*1.02,40,1,false);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x2B6CB0,transparent:true,opacity:0.45,roughness:0.5}));
    m.position.set(...x.c);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...d));root.add(m);
    const ax=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...addv(x.c,mul(d,-L*0.9-x.r))),new THREE.Vector3(...addv(x.c,mul(d,L*0.9+x.r)))]),new THREE.LineDashedMaterial({color:0x2B6CB0,dashSize:L/6,gapSize:L/9}));ax.computeLineDistances();root.add(ax);});
  scene.add(new THREE.HemisphereLight(0xFFFFFF,0x6B7A8A,1.1));const key=new THREE.DirectionalLight(0xFFFFFF,1.4);key.position.set(1,1.6,1.2);scene.add(key);const fill=new THREE.DirectionalLight(0xFFFFFF,0.5);fill.position.set(-1.2,0.4,-0.6);scene.add(fill);
  const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length()||1;
  const v=viewDir(B.length?norm(B[0].d):[1,0,0]),cam=new THREE.OrthographicCamera(-1,1,1,-1,0.01,size*10);
  cam.position.copy(c).add(new THREE.Vector3(...v).multiplyScalar(size*2));cam.up.set(0,0,1);cam.lookAt(c);cam.updateMatrixWorld();
  // fit: project the box corners into camera space
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;const inv=cam.matrixWorldInverse;
  for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(inv);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
  const asp=w/h,pad=1.12;let hw=(x1-x0)/2*pad,hh=(y1-y0)/2*pad;if(hw/hh>asp)hh=hw/asp;else hw=hh*asp;const cx=(x0+x1)/2,cy=(y0+y1)/2;
  cam.left=cx-hw;cam.right=cx+hw;cam.top=cy+hh;cam.bottom=cy-hh;cam.updateProjectionMatrix();
  R.setSize(w*2,h*2,false);R.setClearColor(0,0);R.render(scene,cam);const url=R.domElement.toDataURL('image/png');
  root.traverse(o=>{if(o.geometry)o.geometry.dispose();});mat.dispose();return url;}
function thumb(r,inst,w,h,entry){w=w||320;h=h||200;if(typeof document==='undefined'||!r||!r.instances[inst])return'';
  if(typeof THREE!=='undefined'){try{const u=shaded(r,inst,w,h,entry);if(u)return u;}catch(e){console.warn('shaded thumbnail failed, using lines',e);}}
  return lineThumb(r,inst,w,h);}
function lineThumb(r,inst,w,h){
  const I=r.instances[inst],F=bores(r,inst);if(!F.length&&!I.bbox)return'';
  const d0=F.length?norm(F[0].d):[1,0,0];
  const v=viewDir(d0),rt=norm(cross([0,0,1],v)),up=cross(v,rt),P=p=>[dot(p,rt),-dot(p,up)];
  const lines=[],caps=[];
  if(I.bbox){const a=I.bbox.min,b=I.bbox.max,C=[0,1,2,3,4,5,6,7].map(k=>[k&1?b[0]:a[0],k&2?b[1]:a[1],k&4?b[2]:a[2]]);
    [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]].forEach(([i,j])=>lines.push([P(C[i]),P(C[j])]));}
  F.forEach(x=>{const d=norm(x.d),e1=norm(cross(d,Math.abs(d[2])<0.9?[0,0,1]:[1,0,0])),e2=cross(d,e1),L=x.length/2;
    const ring=c=>Array.from({length:40},(_,k)=>{const t=k/40*Math.PI*2;return P(addv(c,addv(mul(e1,x.r*Math.cos(t)),mul(e2,x.r*Math.sin(t)))));});
    caps.push({a:ring(addv(x.c,mul(d,-L))),b:ring(addv(x.c,mul(d,L))),ax:[P(addv(x.c,mul(d,-L*2.2-x.r))),P(addv(x.c,mul(d,L*2.2+x.r)))]});});
  const pts=lines.flat().concat(caps.flatMap(c=>c.a.concat(c.b,c.ax)));
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const pad=14,s=Math.min((w-2*pad)/((x1-x0)||1),(h-2*pad)/((y1-y0)||1)),ox=(w-(x1-x0)*s)/2-x0*s,oy=(h-(y1-y0)*s)/2-y0*s,S=p=>[p[0]*s+ox,p[1]*s+oy];
  const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const g=cv.getContext('2d');g.scale(2,2);g.lineCap='round';g.lineJoin='round';
  const poly=(Q,close)=>{g.beginPath();Q.forEach((q,k)=>{const[x,y]=S(q);k?g.lineTo(x,y):g.moveTo(x,y);});if(close)g.closePath();};
  g.strokeStyle='#8A97A6';g.lineWidth=1.25;lines.forEach(l=>{poly(l);g.stroke();});
  caps.forEach(c=>{g.setLineDash([5,4]);g.strokeStyle='#2B6CB0';g.lineWidth=1;poly(c.ax);g.stroke();g.setLineDash([]);
    // silhouette: the ring points furthest either side of the projected axis
    const ax2=[c.ax[1][0]-c.ax[0][0],c.ax[1][1]-c.ax[0][1]],al2=Math.hypot(...ax2)||1,n2=[-ax2[1]/al2,ax2[0]/al2],side=p=>p[0]*n2[0]+p[1]*n2[1];
    const ext=R=>{let lo=R[0],hi=R[0];R.forEach(p=>{if(side(p)<side(lo))lo=p;if(side(p)>side(hi))hi=p;});return[lo,hi];};
    const[al,ah]=ext(c.a),[bl,bh]=ext(c.b);
    g.fillStyle='rgba(43,108,176,.16)';poly([al,bl,bh,ah],true);g.fill();
    g.strokeStyle='#2B6CB0';g.lineWidth=1.6;[c.a,c.b].forEach(R=>{poly(R,true);g.fillStyle='rgba(43,108,176,.10)';g.fill();g.stroke();});
    poly([al,bl]);g.stroke();poly([ah,bh]);g.stroke();});
  return cv.toDataURL('image/png');}

// entries matched by a part of the open assembly but still without a picture get one
function fillThumbs(r){if(!r)return;let n=0;
  r.instances.forEach((I,i)=>{if(!I.bbox&&!(r.holes||r.fixings).some(x=>x.inst===i))return;const e=match(I.name,I.label,I.part&&I.part.name);
    if(e&&!e.thumb){const t=thumb(r,i,0,0,e);if(t){e.thumb=t;n++;}}});
  if(n)save();return n;}

// parts of the open assembly with a clamp-like hole whose name no entry matches (one row per part name)
function unknown(r,keep){if(!r)return[];const seen=new Map();
  r.fixings.forEach(x=>{const I=r.instances[x.inst];if(match(x.name,x.label,I&&I.part&&I.part.name))return;if(keep&&!keep(x))return;
    const k=x.name;if(!seen.has(k))seen.set(k,{name:x.name,inst:x.inst,bores:[]});seen.get(k).bores.push(x);});
  return[...seen.values()];}
function addFromPart(r,inst,type){const I=r.instances[inst],F=bores(r,inst).sort((a,b)=>(!!b.csys-!!a.csys)||(b.D-a.D)),D=F.length?F[0].D:0;
  const e={pattern:suggest(I.name),type:type||'clamp',boreMin:Math.round((D-0.5)*10)/10,boreMax:Math.round((D+0.5)*10)/10,
    notes:`Added from ${I.name}${F.length?`, bore Ø${(Math.round(D*100)/100)}`:''}.`};e.thumb=thumb(r,inst,0,0,e);return add(e);}

const API={KEY,TYPES,all,test,match,add,update,remove,reset,suggest,toJSON,fromJSON,thumb,fillThumbs,unknown,addFromPart,onChange};
root.FixLib=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
