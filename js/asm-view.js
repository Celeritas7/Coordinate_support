// ---------------- Assembly in the 3D view: parts as edge outlines, CSYS as X / Y / Z arrows, click to pick ----------------
// Loaded after route-studio.js (rebuild, content, camera, orbit, addTag) and asm-ui.js (ASM). The outlines are the face loops
// StepAsm already reads, placed per instance into one LineSegments: one draw call even for a big frame. Segment → instance is
// kept, so a click on a line names the part. CSYS shown: 'off' | 'fix' (the ones on a hole) | 'all'.
// Pick actions: other modules push fn(pick, r) → [{label, go(pick) → message?, group?, row?, on?, title?, primary?} | {fact}]
// onto window.AV_ACTIONS (they load before this file). Actions are shown in labelled groups (AV_GROUPS order); items with a
// row are one segmented control (on = checked); {fact} items are muted fact lines under the header.
// Other pickable points (Suggest extra clamps): fn() → [{o, pick}] on window.AV_POINTS; a pick of another kind brings its
// own header from window.AV_FACTS[kind](pick) → {name, kind, parent, grid:[html cells], facts:[text], lines (one fact per line)}.
const AV={parts:true,csys:'fix',r:null,geo:null,pick:null,actions:window.AV_ACTIONS||(window.AV_ACTIONS=[]),msg:''};
const AV_GROUPS=['Route','Keep clear of it','Route passes it','Creo · Library'];
{
const X=(M,p)=>[M.o[0]+M.x[0]*p[0]+M.y[0]*p[1]+M.z[0]*p[2],M.o[1]+M.x[1]*p[0]+M.y[1]*p[1]+M.z[1]*p[2],M.o[2]+M.x[2]*p[0]+M.y[2]*p[1]+M.z[2]*p[2]];
const asm=()=>typeof ASM!=='undefined'&&ASM&&ASM.r?ASM.r:null;

// Outline budget (Q4): a big assembly's outlines would take most of the tab's memory (a 633 MB file: ~25 M segments, ~0.7 GB).
// Up to OUTLINE_BUDGET segments every part is drawn in full, as before. Past it the parts near the route are drawn in full,
// nearest first, until the budget is spent, and every other part with solids as its box (12 edges). The route: the ticked
// stations (or the points as text) and the selected run, grown by NEAR mm; none yet → boxes only.
const OUTLINE_BUDGET=4e6,NEAR=500;
// a face loop is one Float64Array x, y, z, … (StepAsm): a closed loop of n points is n segments
const loopSegs=inst=>{let n=0;if(inst.part&&inst.solids)inst.part.solids.forEach(s=>s.faces.forEach(f=>(f.loops||[]).forEach(L=>n+=L.length/3)));return n;};
function routePts(){const T=typeof clampStationsTicked==='function'?clampStationsTicked():[];
  const P=T.length?T.map(s=>s.c):typeof parsePts==='function'?parsePts($('pts').value).map(p=>[p[0],p[1],p[2]]):[];
  const sel=typeof selected==='function'?selected():null;return sel&&sel.Q&&!sel.asm?P.concat(sel.Q):P;}
// null = every part in full; else the Set of instances drawn in full
function fullSet(r){if(!r._avSegs){r._avSegs=r.instances.map(loopSegs);r._avTotal=r._avSegs.reduce((a,b)=>a+b,0);}
  if(r._avTotal<=OUTLINE_BUDGET)return null;
  const P=routePts(),out=new Set();if(!P.length)return out;
  const lo=[0,1,2].map(k=>Math.min(...P.map(p=>p[k]))-NEAR),hi=[0,1,2].map(k=>Math.max(...P.map(p=>p[k]))+NEAR);
  const near=[];r.instances.forEach((inst,ii)=>{const b=inst.bbox;if(!r._avSegs[ii]||!b||[0,1,2].some(k=>b.max[k]<lo[k]||b.min[k]>hi[k]))return;
    let d=Infinity;for(const p of P){let q=0;for(let k=0;k<3;k++){const e=Math.max(b.min[k]-p[k],0,p[k]-b.max[k]);q+=e*e;}if(q<d)d=q;}
    if(d<=NEAR*NEAR)near.push([d,ii]);});
  near.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let left=OUTLINE_BUDGET;
  for(const [,ii] of near){if(r._avSegs[ii]>left)continue;left-=r._avSegs[ii];out.add(ii);}
  return out;}
const setKey=S=>S?[...S].join(','):'all';
// every placed part's face loops in world coordinates (or its box, see the budget); ranges[i] = [first segment, count] of
// instance i
function geometry(r){
  const F=fullSet(r),key=setKey(F);
  if(AV.r===r&&AV.geo&&AV.geo.key===key)return AV.geo;
  let n=0;r.instances.forEach((inst,ii)=>{n+=!F||F.has(ii)?r._avSegs[ii]:r._avSegs[ii]&&inst.bbox?12:0;});
  const pos=new Float32Array(n*6),seg=new Int32Array(n),ranges=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  let k=0;
  const put=(a,b,ii)=>{const o=k*6;pos[o]=a[0];pos[o+1]=a[1];pos[o+2]=a[2];pos[o+3]=b[0];pos[o+4]=b[1];pos[o+5]=b[2];seg[k++]=ii;
    for(let j=0;j<3;j++){if(a[j]<min[j])min[j]=a[j];if(a[j]>max[j])max[j]=a[j];}};
  r.instances.forEach((inst,ii)=>{const k0=k;
    if(F&&!F.has(ii)){if(r._avSegs[ii]&&inst.bbox){const b=inst.bbox,c=i=>[i&1?b.max[0]:b.min[0],i&2?b.max[1]:b.min[1],i&4?b.max[2]:b.min[2]];
        // the box's 12 edges: corners that differ in one axis bit
        for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))put(c(i),c(i|bit),ii);}}
    else if(inst.part&&inst.solids)inst.part.solids.forEach(s=>s.faces.forEach(f=>(f.loops||[]).forEach(L=>{
      const W=[];for(let i=0;i<L.length;i+=3)W.push(X(inst.M,[L[i],L[i+1],L[i+2]]));
      for(let i=0;i<W.length;i++)put(W[i],W[(i+1)%W.length],ii);})));
    ranges[ii]=[k0,k-k0];});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  AV.r=r;AV.geo={g,seg,ranges,n,box:n?{min,max}:null,key,full:F?F.size:null,boxes:F?r.instances.filter((inst,ii)=>!F.has(ii)&&r._avSegs[ii]&&inst.bbox).length:0};return AV.geo;
}
// a big assembly: what the budget did, for the status line after Open (shell.js); '' when every part is drawn in full
window.asmOutlineNote=()=>{const r=asm();if(!r)return'';const G=geometry(r);
  return G.full==null?'':`Big assembly: full outlines for the ${G.full} part${G.full===1?'':'s'} near the route, boxes for the other ${G.boxes}.`;};
// the route changes (stations ticked, points typed): redraw only if another set of parts is drawn in full (a run selected
// rebuilds the view anyway, and geometry() looks again)
{let t=0;const again=()=>{clearTimeout(t);t=setTimeout(()=>{const r=asm();if(!r||!AV.parts||!AV.geo||AV.r!==r)return;if(setKey(fullSet(r))!==AV.geo.key)rebuild(false);},300);};
  document.addEventListener('cs:changed',again);$('pts').addEventListener('input',again);}
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
    // fainter under a route, so the route reads first
    if(G.n){const lines=new THREE.LineSegments(G.g,new THREE.LineBasicMaterial({color:new THREE.Color(css('--muted')),transparent:true,opacity:visible().length?0.2:0.35}));
      lines.userData.keep=true;lines.userData.asm=true;content.add(lines);AV.lines=lines;}
    if(AV.pick&&AV.pick.kind==='part'){const [s,c]=G.ranges[AV.pick.inst]||[0,0];
      if(c){const hg=new THREE.BufferGeometry();hg.setAttribute('position',G.g.getAttribute('position'));hg.setDrawRange(s*2,c*2);
        const hl=new THREE.LineSegments(hg,new THREE.LineBasicMaterial({color:new THREE.Color(css('--ink'))}));hl.userData.keep=true;content.add(hl);}}}
  // CSYS made here (csys-make.js) are always drawn, named, and pickable
  const made=(typeof csysMade==='function'?csysMade():[]).map((c,i)=>({...c,made:true,i,inst:null}));
  const C=csysList(r).concat(made),L=axLen();AV.shown=C;
  if(C.length){const pos=new Float32Array(C.length*18),col=new Float32Array(C.length*18);
    const cx=['--axis-x','--axis-y','--axis-z'].map(k=>new THREE.Color(css(k)));
    C.forEach((c,i)=>{[c.x,c.y,c.z].forEach((a,j)=>{const o=i*18+j*6;
      pos.set([c.o[0],c.o[1],c.o[2],c.o[0]+a[0]*L,c.o[1]+a[1]*L,c.o[2]+a[2]*L],o);col.set([cx[j].r,cx[j].g,cx[j].b,cx[j].r,cx[j].g,cx[j].b],o);});});
    const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(pos,3));tg.setAttribute('color',new THREE.BufferAttribute(col,3));
    content.add(new THREE.LineSegments(tg,new THREE.LineBasicMaterial({vertexColors:true})));
    // a made CSYS at the picked origin: its tag drops below the pick tag
    const pc=AV.pick&&AV.pick.kind==='csys'?AV.pick.c:null,same=c=>pc&&Math.hypot(...[0,1,2].map(k=>c.o[k]-pc.o[k]))<0.5;
    if(C.length-made.length<=60)C.forEach(c=>{if(!c.made&&!(pc&&!pc.made&&pc.name===c.name))g.addTag(c.o,c.name,'t');});
    made.forEach(c=>{if(!(pc&&pc.made&&pc.i===c.i))g.addTag(c.o,c.name,'warn'+(same(c)?' low':''));});}
  // the pick: an ink ring of fixed screen size and its name, always drawn
  if(AV.pick&&AV.pick.kind==='csys'){const c=AV.pick.c;g.addTag(c.o,'','ring pick');g.addTag(c.o,c.name,'pick');}
};

// ---------- picking: a click (not a drag) on the view ----------
const cv=$('gl');let down=null;
cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
cv.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved<4)pickAt(e);});
function pickAt(e){
  const r=asm(),rc=cv.getBoundingClientRect(),px=e.clientX-rc.left,py=e.clientY-rc.top;
  const px2=o=>{const v=new THREE.Vector3(...o).project(camera);return v.z>1?Infinity:Math.hypot((v.x+1)/2*rc.width-px,(1-v.y)/2*rc.height-py);};
  // a point from another module (a suggested clamp), then a CSYS origin, within 10 px
  let pt=null;(window.AV_POINTS||[]).forEach(f=>{try{f().forEach(q=>{const d=px2(q.o);if(d<10&&(!pt||d<pt.d))pt={d,pick:q.pick};});}catch(x){console.error(x);}});
  if(pt)return setPick(pt.pick);
  if(!r)return;
  let best=null;(AV.shown||[]).forEach(c=>{const d=px2(c.o);if(d<10&&(!best||d<best.d))best={d,c};});
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
function setPick(p){AV.pick=p;AV.msg='';panel();rebuild(false);
  // keyboard: the first action takes focus when the panel opens
  const b=p&&$('avPick').querySelector('.avgrp button');if(b)b.focus({preventScroll:true});
  document.dispatchEvent(new CustomEvent('asm:pick',{detail:p}));}
window.asmPick=()=>AV.pick;window.asmSetPick=setPick;

const f1=v=>v.toFixed(1),vec=a=>a.map(v=>(Math.abs(v)<5e-7?0:v).toFixed(3)).join('  '),last=n=>String(n||'').split(' / ').pop();
const axisCell=(k,v)=>`<span style="color:var(--axis-${k})">${k.toUpperCase()}</span><span>${vec(v)}</span>`;
// header of a pick: {name, kind, parent, grid, facts}
function facts(p,r){
  if(window.AV_FACTS&&AV_FACTS[p.kind])return AV_FACTS[p.kind](p);
  const inst=r.instances[p.inst]||{},bb=inst.bbox;
  if(p.kind==='csys'){const c=p.c;
    return{name:c.name,kind:'coordinate system',parent:c.made?'made here':last(inst.label||inst.name||''),
      grid:[`<span>origin</span><span>${vec(c.o)}</span>`,axisCell('x',c.x),axisCell('y',c.y),axisCell('z',c.z)],
      facts:[c.hole?`On a Ø${f1(c.hole.D)} × ${f1(c.hole.length)} mm hole`:'',c.made?'Listed under CSYS made here, for export to Creo':''].filter(Boolean)};}
  const path=String(inst.label||'').split(' / ');
  return{name:inst.name||'part',kind:'part',parent:path.length>1?path[path.length-2]:'',
    grid:[`<span>clicked</span><span>${vec(p.p)}</span>`],facts:[bb?`${bb.max.map((v,k)=>Math.round(v-bb.min[k])).join(' × ')} mm`:''].filter(Boolean)};
}
function panel(){
  const el=$('avPick'),p=AV.pick,r=asm();
  if(!p||(!r&&!(window.AV_FACTS&&AV_FACTS[p.kind]))){el.hidden=true;el.innerHTML='';return;}
  const all=[].concat(...AV.actions.map(fn=>{try{return fn(p,r)||[];}catch(x){console.error(x);return[];}}));
  const F=facts(p,r),acts=all.filter(a=>!a.fact),line=F.facts.concat(all.filter(a=>a.fact).map(a=>a.fact));
  if(line.length>1&&!F.lines)line[0]+=' · '+line.splice(1).map(t=>t.charAt(0).toLowerCase()+t.slice(1)).join(' · ');
  // groups in AV_GROUPS order, then any other; inside a group by order (lower first)
  const gname=a=>a.group||a.row||'Creo · Library',rank=g=>{const i=AV_GROUPS.findIndex(x=>g===x||g.startsWith(x+' ('));return i<0?99:i;};
  const names=[...new Set(acts.map(gname))].sort((a,b)=>rank(a)-rank(b));
  const btn=a=>`<button type="button" data-a="${acts.indexOf(a)}"${a.primary?' class="primary"':''}${a.title?` title="${esc(a.title)}"`:''}>${esc(a.label)}</button>`;
  const radio=a=>`<button type="button" role="radio" aria-checked="${!!a.on}" tabindex="${a.on?0:-1}" data-a="${acts.indexOf(a)}"${a.title?` title="${esc(a.title)}"`:''}>${esc(a.label)}</button>`;
  const grp=g=>{const A=acts.filter(a=>gname(a)===g).sort((a,b)=>(a.order||5)-(b.order||5)),rows=A.filter(a=>a.row),plain=A.filter(a=>!a.row);
    return`<div class="avgrp"><span class="unit">${esc(g)}</span>${plain.length?`<div class="avacts">${plain.map(btn).join('')}</div>`:''}${rows.length?`<div class="seg" role="radiogroup" aria-label="${esc(g)}">${rows.map(radio).join('')}</div>`:''}</div>`;};
  el.innerHTML=`<div class="avhead"><span><b>${esc(F.name)}</b> <span class="unit">· ${esc(F.kind)}</span></span><button type="button" class="avx" data-x aria-label="Close (Esc)" title="Close (Esc)">×</button></div>`+
    (F.parent?`<div class="avpar">${esc(F.parent)}</div>`:'')+
    (F.grid.length?`<div class="avgrid">${F.grid.join('')}</div>`:'')+line.map(t=>`<div class="avfact">${esc(t)}</div>`).join('')+
    names.map(grp).join('')+(AV.msg?`<div class="avmsg">${esc(AV.msg)}</div>`:'');
  el.hidden=false;
  const run=(b,focus)=>{const a=acts[+b.dataset.a];if(!a||!a.go)return;const m=a.go(p);if(AV.pick!==p)return;AV.msg=typeof m==='string'?m:'';panel();rebuild(false);
    if(focus){const nb=el.querySelector(`[data-a="${b.dataset.a}"]`);if(nb)nb.focus();}};
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>run(b,b.getAttribute('role')==='radio'));
  // segmented control: arrow keys move the choice
  el.querySelectorAll('[role=radiogroup]').forEach(g=>g.onkeydown=e=>{const B=[...g.querySelectorAll('[role=radio]')],i=B.indexOf(document.activeElement);
    const d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!d||i<0)return;e.preventDefault();run(B[(i+d+B.length)%B.length],true);});
  el.querySelector('[data-x]').onclick=()=>setPick(null);
}
window.asmPanel=panel;
// a module answers a pick itself (clamp-stations.js: an armed Start / End): its message under the panel, focus on a button
window.asmSay=(m,focus)=>{if(!AV.pick)return;AV.msg=m||'';panel();rebuild(false);
  const b=focus&&[...$('avPick').querySelectorAll('button')].find(x=>x.textContent===focus);if(b)b.focus({preventScroll:true});};
// Esc closes the pick panel and gives focus back to the 3D view
$('gl').tabIndex=0;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AV.pick){setPick(null);$('gl').focus({preventScroll:true});}});

// ---------- header controls ----------
// ---------- view tools: Parts, No CSYS / On holes / All ----------
$('avParts').onclick=()=>{AV.parts=!AV.parts;$('avParts').setAttribute('aria-pressed',AV.parts);if(!AV.parts&&AV.pick&&AV.pick.kind==='part')AV.pick=null;panel();rebuild(false);};
const csysSet=v=>{AV.csys=v;$('avCsys').querySelectorAll('[data-v]').forEach(b=>{b.setAttribute('aria-checked',b.dataset.v===v);b.tabIndex=b.dataset.v===v?0:-1;});
  if(AV.pick&&AV.pick.kind==='csys'&&!AV.pick.c.made&&v==='off')AV.pick=null;panel();rebuild(false);};
$('avCsys').querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>csysSet(b.dataset.v));
$('avCsys').onkeydown=e=>{const V=['off','fix','all'],d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();
  const v=V[(V.indexOf(AV.csys)+d+3)%3];csysSet(v);$('avCsys').querySelector(`[data-v="${v}"]`).focus();};
window.asmCsys=csysSet;
document.addEventListener('asm:loaded',()=>{AV.geo=null;AV.r=null;AV.pick=null;$('avCsys').hidden=$('avParts').hidden=false;panel();rebuild(true);});
document.addEventListener('asm:removed',()=>{AV.geo=null;AV.r=null;AV.pick=null;$('avCsys').hidden=$('avParts').hidden=true;panel();rebuild(true);});
}
