// ---------------- Assembly in the 3D view: parts as edge outlines, CSYS as X / Y / Z arrows, click to pick ----------------
// Loaded after route-studio.js (rebuild, content, camera, orbit, addTag) and asm-ui.js (ASM). The outlines are the face loops
// StepAsm already reads, placed per instance into one LineSegments: one draw call even for a big frame. Segment → instance is
// kept, so a click on a line names the part. CSYS shown: 'off' | 'fix' (the ones on a hole) | 'all'.
// Pick actions: other modules push fn(pick, r) → [{label, go(pick) → message?, row?, on?, title?}] onto window.AV_ACTIONS
// (they load before this file). Items with a row are shown as one labelled group of toggles (on = pressed).
const AV={parts:true,csys:'fix',r:null,geo:null,pick:null,actions:window.AV_ACTIONS||(window.AV_ACTIONS=[]),msg:''};
{
const X=(M,p)=>[M.o[0]+M.x[0]*p[0]+M.y[0]*p[1]+M.z[0]*p[2],M.o[1]+M.x[1]*p[0]+M.y[1]*p[1]+M.z[1]*p[2],M.o[2]+M.x[2]*p[0]+M.y[2]*p[1]+M.z[2]*p[2]];
const asm=()=>typeof ASM!=='undefined'&&ASM&&ASM.r?ASM.r:null;

// every placed part's face loops in world coordinates; ranges[i] = [first segment, count] of instance i
function geometry(r){
  if(AV.r===r&&AV.geo)return AV.geo;
  let n=0;r.instances.forEach(inst=>{if(inst.part&&inst.solids)inst.part.solids.forEach(s=>s.faces.forEach(f=>(f.loops||[]).forEach(L=>n+=L.length)));});
  const pos=new Float32Array(n*6),seg=new Int32Array(n),ranges=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  let k=0;
  r.instances.forEach((inst,ii)=>{const k0=k;
    if(inst.part&&inst.solids)inst.part.solids.forEach(s=>s.faces.forEach(f=>(f.loops||[]).forEach(L=>{
      const W=L.map(p=>X(inst.M,p));
      for(let i=0;i<W.length;i++){const a=W[i],b=W[(i+1)%W.length],o=k*6;
        pos[o]=a[0];pos[o+1]=a[1];pos[o+2]=a[2];pos[o+3]=b[0];pos[o+4]=b[1];pos[o+5]=b[2];seg[k++]=ii;
        for(let j=0;j<3;j++){if(a[j]<min[j])min[j]=a[j];if(a[j]>max[j])max[j]=a[j];}}})));
    ranges[ii]=[k0,k-k0];});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  AV.r=r;AV.geo={g,seg,ranges,n,box:n?{min,max}:null};return AV.geo;
}
// CSYS for the current mode, each with the part it sits in and the hole it marks (if any)
function csysList(r){
  if(AV.csys==='off')return[];
  // the hole a CSYS marks: same name, origin on the hole's axis inside its length (the CSYS may sit in another instance)
  if(!r._avHole){const by=new Map();r.fixings.forEach(h=>{if(!h.csys)return;if(!by.has(h.csys))by.set(h.csys,[]);by.get(h.csys).push(h);});
    r._avHole=r.csys.map(c=>(by.get(c.name)||[]).find(h=>{const v=[0,1,2].map(k=>c.o[k]-h.c[k]),u=v[0]*h.d[0]+v[1]*h.d[1]+v[2]*h.d[2];
      return Math.hypot(v[0]-u*h.d[0],v[1]-u*h.d[1],v[2]-u*h.d[2])<0.5&&Math.abs(u)<=h.length/2+1;})||null);}
  return r.csys.map((c,i)=>({...c,hole:r._avHole[i]})).filter(c=>AV.csys==='all'||c.hole);
}
const axLen=()=>Math.max(diag/70,2);

// bounds for Fit when no route is shown
window.asmBounds=()=>{const r=asm();if(!r||!AV.parts)return null;return geometry(r).box;};

// called from rebuild(): the assembly layer under the routes
window.asmOverlay=(content,g)=>{
  // other layers on the routes (Suggest extra clamps) hang on window.VIEW_OVERLAYS
  (window.VIEW_OVERLAYS||[]).forEach(f=>{try{f(content,g);}catch(e){console.error(e);}});
  const r=asm();if(!r)return;
  if(AV.parts){const G=geometry(r);
    if(G.n){const lines=new THREE.LineSegments(G.g,new THREE.LineBasicMaterial({color:new THREE.Color(css('--muted')),transparent:true,opacity:0.35}));
      lines.userData.keep=true;lines.userData.asm=true;content.add(lines);AV.lines=lines;}
    if(AV.pick&&AV.pick.kind==='part'){const [s,c]=G.ranges[AV.pick.inst]||[0,0];
      if(c){const hg=new THREE.BufferGeometry();hg.setAttribute('position',G.g.getAttribute('position'));hg.setDrawRange(s*2,c*2);
        const hl=new THREE.LineSegments(hg,new THREE.LineBasicMaterial({color:new THREE.Color(css('--alt1'))}));hl.userData.keep=true;content.add(hl);}}}
  // CSYS made here (csys-make.js) are always drawn, named, and pickable
  const made=(typeof csysMade==='function'?csysMade():[]).map((c,i)=>({...c,made:true,i,inst:null}));
  const C=csysList(r).concat(made),L=axLen();AV.shown=C;
  if(C.length){const pos=new Float32Array(C.length*18),col=new Float32Array(C.length*18);
    const cx=[new THREE.Color('#E03131'),new THREE.Color('#2F9E44'),new THREE.Color('#1971C2')];
    C.forEach((c,i)=>{[c.x,c.y,c.z].forEach((a,j)=>{const o=i*18+j*6;
      pos.set([c.o[0],c.o[1],c.o[2],c.o[0]+a[0]*L,c.o[1]+a[1]*L,c.o[2]+a[2]*L],o);col.set([cx[j].r,cx[j].g,cx[j].b,cx[j].r,cx[j].g,cx[j].b],o);});});
    const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(pos,3));tg.setAttribute('color',new THREE.BufferAttribute(col,3));
    content.add(new THREE.LineSegments(tg,new THREE.LineBasicMaterial({vertexColors:true})));
    if(C.length-made.length<=60)C.forEach(c=>{if(!c.made)g.addTag(c.o,c.name,'t');});made.forEach(c=>g.addTag(c.o,c.name,'warn'));}
  if(AV.pick&&AV.pick.kind==='csys'){const c=AV.pick.c;g.addTag(c.o,c.name,'');
    const m=new THREE.Mesh(g.sg,new THREE.MeshBasicMaterial({color:new THREE.Color(css('--alt1'))}));
    m.position.set(...c.o);m.scale.setScalar(L*0.15);content.add(m);}
};

// ---------- picking: a click (not a drag) on the view ----------
const cv=$('gl');let down=null;
cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
cv.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved<4)pickAt(e);});
function pickAt(e){
  const r=asm();if(!r)return;
  const rc=cv.getBoundingClientRect(),px=e.clientX-rc.left,py=e.clientY-rc.top;
  // a CSYS origin within 10 px wins
  let best=null;(AV.shown||[]).forEach(c=>{const v=new THREE.Vector3(...c.o).project(camera);if(v.z>1)return;
    const d=Math.hypot((v.x+1)/2*rc.width-px,(1-v.y)/2*rc.height-py);if(d<10&&(!best||d<best.d))best={d,c};});
  if(best)return setPick({kind:'csys',c:best.c,inst:best.c.inst});
  if(AV.parts&&AV.lines){const hit=pickLine(r,px/rc.width*2-1,-(py/rc.height)*2+1,orbit.dist*Math.tan(camera.fov*Math.PI/360)*2/rc.height*6);
    if(hit)return setPick({kind:'part',inst:hit.inst,p:hit.p});}
  if(AV.pick)setPick(null);
}
// nearest outline segment to the click ray (within tol, world units): only the parts whose box the ray passes are tested
// (three's own LineSegments raycast tries all ~800 000 segments of a frame)
function pickLine(r,nx,ny,tol){
  const G=geometry(r),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(nx,ny),camera);
  const R=ray.ray,pos=G.g.getAttribute('position').array,a=new THREE.Vector3(),b=new THREE.Vector3(),q=new THREE.Vector3(),onSeg=new THREE.Vector3(),box=new THREE.Box3();
  let best=null;
  r.instances.forEach((inst,ii)=>{const rg=G.ranges[ii];if(!rg||!rg[1]||!inst.bbox)return;
    box.min.set(...inst.bbox.min).subScalar(tol);box.max.set(...inst.bbox.max).addScalar(tol);if(!R.intersectsBox(box))return;
    for(let k=rg[0];k<rg[0]+rg[1];k++){const o=k*6;a.set(pos[o],pos[o+1],pos[o+2]);b.set(pos[o+3],pos[o+4],pos[o+5]);
      const d2=R.distanceSqToSegment(a,b,q,onSeg);if(d2>tol*tol)continue;const t=R.origin.distanceTo(q);
      if(!best||t<best.t-tol)best={t,inst:ii,p:onSeg.toArray()};}});
  return best;
}
function setPick(p){AV.pick=p;AV.msg='';panel();rebuild(false);document.dispatchEvent(new CustomEvent('asm:pick',{detail:p}));}
window.asmPick=()=>AV.pick;window.asmSetPick=setPick;

const f1=v=>v.toFixed(1),vec=a=>`(${a.map(v=>(Math.abs(v)<5e-7?0:v).toFixed(3)).join(', ')})`;
function panel(){
  const el=$('avPick'),p=AV.pick,r=asm();
  if(!p||!r){el.hidden=true;el.innerHTML='';return;}
  const inst=r.instances[p.inst]||{},bb=inst.bbox;let h='';
  if(p.kind==='csys'){const c=p.c;
    h=`<b>${esc(c.name)}</b> <span class="unit">coordinate system</span><div class="unit">${c.made?'made here (CSYS made here, for export to Creo)':'in '+esc(inst.label||inst.name||'')}</div>
      <div class="avxyz">origin ${vec(c.o)}<br><span style="color:#E03131">X</span> ${vec(c.x)}<br><span style="color:#2F9E44">Y</span> ${vec(c.y)}<br><span style="color:#1971C2">Z</span> ${vec(c.z)}</div>
      ${c.hole?`<div class="unit">on a Ø${f1(c.hole.D)} × ${f1(c.hole.length)} mm hole</div>`:''}`;}
  else h=`<b>${esc(inst.name||'part')}</b> <span class="unit">part</span><div class="unit">${esc(inst.label||'')}</div>
      ${bb?`<div class="unit">${bb.max.map((v,k)=>Math.round(v-bb.min[k])).join(' × ')} mm</div>`:''}<div class="avxyz">clicked at ${vec(p.p)}</div>`;
  // order: lower first (stations 1, Library 2, toggles 5 by default)
  const acts=[].concat(...AV.actions.map(fn=>{try{return fn(p,r)||[];}catch(x){console.error(x);return[];}})).sort((a,b)=>(a.order||5)-(b.order||5));
  const btn=(a,i)=>`<button type="button" data-a="${i}"${a.row?` aria-pressed="${!!a.on}"`:''}${a.title?` title="${esc(a.title)}"`:''}>${esc(a.label)}</button>`;
  const rows=[...new Set(acts.filter(a=>a.row).map(a=>a.row))];
  el.innerHTML=h+`<div class="avacts">${acts.map((a,i)=>a.row?'':btn(a,i)).join('')}<button type="button" data-x>Close</button></div>`+
    rows.map(rw=>`<div class="avrow"><span class="unit">${esc(rw)}</span>${acts.map((a,i)=>a.row===rw?btn(a,i):'').join('')}</div>`).join('')+
    (AV.msg?`<div class="avmsg">${esc(AV.msg)}</div>`:'');
  el.hidden=false;
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const m=acts[+b.dataset.a].go(p);AV.msg=typeof m==='string'?m:'';panel();rebuild(false);});
  el.querySelector('[data-x]').onclick=()=>setPick(null);
}
window.asmPanel=panel;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AV.pick)setPick(null);});

// ---------- header controls ----------
$('avParts').onchange=e=>{AV.parts=e.target.checked;if(!AV.parts&&AV.pick&&AV.pick.kind==='part')AV.pick=null;panel();rebuild(false);};
$('avCsys').onchange=e=>{AV.csys=e.target.value;if(AV.pick&&AV.pick.kind==='csys'&&AV.csys==='off')AV.pick=null;panel();rebuild(false);};
document.addEventListener('asm:loaded',()=>{AV.geo=null;AV.r=null;AV.pick=null;panel();rebuild(true);});
}
