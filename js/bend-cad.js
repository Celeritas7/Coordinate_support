// ---------------- Route through stations: straight where stations line up, keep clear of CAD parts ----------------
// Loaded after route-studio.js. runBend asks bendCad(P) for fixed directions (straight runs), obstacle boxes
// (faces of the parts the user keeps clear of) and a report on the finished route.
const BC={cad:null,sv:null,key:'',user:new Map(),focus:0};
{
const say=(m,bad)=>{const e=$('statusCad');e.textContent=m;e.style.color=bad?'var(--bad)':'';};
const opt=()=>({d:Math.max(0.1,+$('cdD').value||8),gap:Math.max(0,+$('cdGap').value||0),reach:Math.max(10,+$('cdReach').value||60)});
const stations=()=>parsePts($('pts').value).map(p=>[p[0],p[1],p[2]]);
const roleTxt=p=>p.role==='station'?`clip at ${p.stations.map(i=>'P'+(i+1)).join(', ')}`:p.role==='clip'?'small part on the station line, no station (clip, or screw?)':'frame / part';
const keepClear=p=>BC.user.has(p.sid)?BC.user.get(p.sid):p.role==='obstacle';
function survey(){if(!BC.cad)return null;const P=stations();if(P.length<2)return null;const o=opt(),key=JSON.stringify([P,o]);
  if(BC.key!==key){BC.sv=CadSolids.survey(BC.cad,P,o);BC.key=key;render();}return BC.sv;}
function render(){const sv=BC.sv,box=$('cdParts');if(!sv){box.innerHTML='';return;}
  const n=sv.parts.filter(keepClear).length;
  box.innerHTML=`<div class="presets" style="margin:6px 0 2px"><button type="button" data-t="def" title="Clips unticked, frame and other parts ticked">Default ticks</button><button type="button" data-t="frame" title="Only the parts that are not clips">Frame only</button><button type="button" data-t="all">Tick all</button><button type="button" data-t="none">Untick all</button></div>
    <p class="hint" style="margin:4px 0">${sv.parts.length} part${sv.parts.length===1?'':'s'} within ${fmt(sv.reach)} mm of the station line; gap checked to ${n} (ticked). Gap = hose surface to part. Press Check after changing ticks.</p>`+
    sv.parts.slice().sort((a,b)=>(keepClear(b)-keepClear(a))||(a.dLine-b.dLine)).slice(0,60).map((p,i,arr)=>(i===0||keepClear(arr[i-1])!==keepClear(p)?`<div class="cdhead">${keepClear(p)?'Gap checked (ticked)':'Not checked (clips, or unticked)'}</div>`:'')+`<div class="cdrow${BC.focus===p.sid?' on':''}"><label class="chk cdp"><input type="checkbox" data-sid="${p.sid}" ${keepClear(p)?'checked':''}><span><b>${esc(p.name)}</b> <span class="unit">${p.dims.map(v=>Math.round(v)).join('×')} mm · ${roleTxt(p)} · line ${fmt(p.dLine,1)} mm away · centre ${centre(p).map(v=>Math.round(v)).join(', ')}</span></span></label><button type="button" class="cdshow" data-show="${p.sid}" aria-pressed="${BC.focus===p.sid}" title="Show this part in 3D, zoomed">show</button></div>`).join('');
  box.querySelectorAll('input[data-sid]').forEach(el=>el.onchange=()=>{BC.user.set(+el.dataset.sid,el.checked);render();});
  box.querySelectorAll('button[data-show]').forEach(el=>el.onclick=()=>showPart(+el.dataset.show));
  box.querySelectorAll('button[data-t]').forEach(b=>b.onclick=()=>{const t=b.dataset.t;BC.user=new Map();
    if(t!=='def')sv.parts.forEach(p=>BC.user.set(p.sid,t==='all'||(t==='frame'&&p.role==='obstacle')));render();});}

// centre of a part's box (world mm) — to find it in Creo with Measure, or by eye
function centre(p){const so=BC.cad.solids.find(x=>x.sid===p.sid);return so.min.map((v,k)=>(v+so.max[k])/2);}
// show / hide one part in 3D: amber face boxes and its name; the view centres on it
function showPart(sid){BC.focus=BC.focus===sid?0:sid;render();rebuild(false);
  if(BC.focus){const p=BC.sv.parts.find(x=>x.sid===sid),c=centre(p);orbit.target.set(...c);orbit.dist=Math.max(250,Math.min(p.size,600)*5);}
  draw();}
window.bcShow=showPart;
// runs of 3+ stations on one straight line (within tol): fixed tangent along the line keeps every segment straight
function straightRuns(P,tol){const runs=[],n=P.length,dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];let i=0;
  while(i<n-2){let best=-1;
    for(let j=i+2;j<n;j++){const a=P[i],L=V.len(V.sub(P[j],a)),d=V.norm(V.sub(P[j],a));let ok=L>1e-6;
      for(let k=i+1;k<j&&ok;k++){const v=V.sub(P[k],a),t=dot(v,d);if(t<=0||t>=L||V.len(V.sub(v,V.mul(d,t)))>tol)ok=false;
        if(ok&&dot(V.sub(P[k],P[k-1]),d)<=0)ok=false;}
      if(!ok)break;best=j;}
    if(best>0){runs.push([i,best]);i=best+1;}else i++;}
  return runs;}

window.bendCad=function(P){
  const o=opt(),sv=$('cdUse').checked?survey():null;
  const faces=sv?sv.parts.filter(keepClear).flatMap(p=>p.faces):[],ix=faces.length?CadSolids.index(faces,50):null,rad=o.d/2+o.gap;
  const fixDirs=[],notes=[],straight=[],push=ix&&$('cdPush').checked;
  // a straight run is the designer's intent (stations in a line, often inside a channel) — kept even when a ticked part
  // sits on it; the clash is reported. Only with Push on is the run released so the route can bend round the part
  if($('straight').checked)straightRuns(P,1).forEach(([a,b])=>{const tag=`P${a+1}–P${b+1}`;
    if(ix){const w=CadSolids.clearance(CadSolids.along(P.slice(a,b+1),2),ix,o.d,rad+1);
      if(w.gap<o.gap-0.05){const p=sv.parts.find(x=>x.faces.includes(w.box)),nm=p?p.name:'a part',g=w.gap<0?`hose ${fmt(-w.gap,1)} mm into it`:`${fmt(w.gap,1)} mm from the hose`;
        if(push){notes.push(`${tag} line up, but ${nm} is on that line (${g}): released to bend round it`);return;}
        notes.push(`${tag} kept straight; ${nm} is on that line (${g}, gap ${fmt(o.gap)}). Move the part, or tick Push to bend round it`);}}
    const d=V.norm(V.sub(P[b],P[a]));for(let k=a;k<=b;k++)fixDirs[k]=d;straight.push(tag);});
  if(!fixDirs.length&&!faces.length)return null;
  return{fixDirs:fixDirs.length?fixDirs:null,boxes:push?faces:null,rad,
    thin:push?{ix,d:o.d,gap:o.gap,r:rad+1}:null,
    report(A){const parts=[],bits=[],holes=[],marks=[],out={};
      if(straight.length)bits.push(`straight ${straight.join(', ')}`);
      let msg=straight.length?`Straight ${straight.join(', ')}.`:'';
      if(ix&&!push&&faces.length)msg+=`\nThe route is generated from the stations only; the gap to parts is checked, not enforced — tick “Push the route away” to make it keep clear.`;
      if(notes.length)msg+=`\n${notes.join('.\n')}.`;
      if(ix){const w=CadSolids.clearance(A.d.pts,ix,o.d,o.d/2+o.gap+40),p=w.box&&sv.parts.find(x=>x.faces.includes(w.box));
        const near=A.Q.reduce((b,q,i)=>{const d=V.len(V.sub(q,w.p||q));return d<b.d?{d,i}:b;},{d:Infinity,i:0});
        const kept=sv.parts.filter(keepClear);kept.forEach(x=>x.faces.forEach(f=>parts.push({name:x.name,min:f.min,max:f.max})));
        bits.push(`${push?'pushed clear of':'gap checked to'} ${kept.length} CAD part${kept.length===1?'':'s'} (gap ${fmt(o.gap)}, Ø${fmt(o.d)})`);
        const open=throughOpenings(A,P,faces,o),spots=closeSpots(A,P,o,spanOf(A,P));
        msg+=spots.length?`\nToo close — below the ${fmt(o.gap)} mm gap (${spots.length} place${spots.length>1?'s':''}, marked in 3D: red = into the part, amber = too close; clips at stations not counted):`:`\nNowhere closer than the ${fmt(o.gap)} mm gap to the parts checked (clips at stations not counted).`;
        spots.forEach(x=>{msg+=`\n• ${x.msg}`;marks.push(x.mark);});
        // gap along the whole route, for the Clearance chart: to the same parts the spots use; capped where nothing is near
        const ixAll=CadSolids.index(sv.parts.filter(p=>keepClear(p)||p.role!=='station').flatMap(p=>p.faces),50),cap=o.gap*5+o.d;
        out.spots=spots.map(x=>x.spot);out.clearDense=A.d.pts.map(q=>Math.min(cap,ixAll.nearest(q,cap+o.d/2).d-o.d/2));out.gapLimit=o.gap;
        if(spots.some(x=>!x.ticked))msg+=`\nUnticked parts were taken as clips without a CSYS. Press “show” in the list to see one; tick it if it is a screw, bolt or bracket.`;if(open.length)msg+=`\nPlate crossings (marked in 3D):`;open.forEach(x=>{msg+=`\n• ${x.msg}`;if(x.hole)holes.push(x.hole);marks.push(x.mark);});
        msg+=isFinite(w.gap)?`\nSmallest gap to the kept-clear parts: ${fmt(w.gap,1)} mm${p?` (${p.name})`:''} near point ${near.i+1}${w.gap<o.gap-0.05?` — below the ${fmt(o.gap)} mm gap`:''}.`:`\nNo kept-clear part within ${fmt(o.d/2+o.gap+40)} mm of the route.`;}
      return{parts:parts.length?parts:undefined,holes:holes.length?holes:undefined,marks:marks.length?marks:undefined,clearDense:out.clearDense,gapLimit:out.gapLimit,spots:out.spots,note:bits.length?', '+bits.join(', '):'',msg:msg.trim(),bad:false};}};
};

// where the route crosses the plane of a flat face off its material — through a hole, or past the face's edge:
// station span, what it passes, and the gap to that part around the crossing (exact for flat and cylindrical faces)
// "P8–P9" for a dense-sample index of the route
function spanOf(A,P){const pts=A.d.pts,si=P.map(p=>{let bi=0,bd=Infinity;pts.forEach((q,i)=>{const d=V.len(V.sub(q,p));if(d<bd){bd=d;bi=i;}});return bi;});
  return i=>{let k=0;while(k<si.length-2&&si[k+1]<=i)k++;return`P${k+1}–P${k+2}`;};}
// every stretch of the route closer than the gap to a part: ticked parts, and unticked parts away from any station
// (clips at a station are left out unless ticked — the hose sits in them). One entry per part per stretch, with the
// smallest gap, its station span and how long the stretch is. Sorted along the route.
function closeSpots(A,P,o,span){const sv=BC.sv,pts=A.d.pts,s=A.d.s,out=[];
  sv.parts.filter(p=>keepClear(p)||p.role!=='station').forEach(p=>{const ix=CadSolids.index(p.faces,50);let run=null;
    const close=()=>{if(run){out.push(run);run=null;}};
    pts.forEach((q,i)=>{const n=ix.nearest(q,o.d/2+o.gap+5),gap=n.d-o.d/2;
      if(gap<o.gap-0.05){if(!run)run={part:p,i0:i,i,gap,p:q,exact:!!(n.box&&n.box.shape)};if(gap<run.gap){run.gap=gap;run.i=i;run.p=q;run.exact=!!(n.box&&n.box.shape);}run.i1=i;}
      else close();});
    close();});
  return out.sort((x,y)=>x.i-y.i).map(r=>{const len=s[r.i1]-s[r.i0],ticked=keepClear(r.part),bad=r.gap<0;
    return{msg:`${span(r.i)}: ${r.part.name} (${r.part.dims.map(v=>Math.round(v)).join('×')} mm${ticked?'':', unticked'}) — ${bad?`hose ${fmt(-r.gap,1)} mm into it`:`${fmt(r.gap,1)} mm clear`}${r.exact?'':' (to a face box)'}, over ${fmt(Math.max(len,2),0)} mm of route`,
      ticked,spot:{i0:r.i0,i1:r.i1,i:r.i,gap:r.gap,name:r.part.name,span:span(r.i)},mark:{p:r.p,text:`${r.part.name} · ${fmt(r.gap,1)} mm`,bad,warn:!bad}};});}
function throughOpenings(A,P,faces,o){const pts=A.d.pts,s=A.d.s,sv=BC.sv,out=[],span=spanOf(A,P);
  CadSolids.openings(pts,faces,Math.max(o.reach,100)).forEach(c=>{const part=sv.parts.find(x=>x.faces.includes(c.face));if(!part)return;
    const g=out.find(g=>g.part===part&&Math.abs(s[g.i]-s[c.i])<40);
    if(g){if((!c.loop.outer&&g.c.loop.outer)||(c.loop.outer===g.c.loop.outer&&c.edge<g.c.edge))g.c=c;return;}
    if(c.loop.outer&&part.size<300)return;   // edge passes reported for frame-sized parts only; holes always
    out.push({part,i:c.i,c});});
  return out.sort((x,y)=>x.i-y.i).map(g=>{const L=g.c.loop,sh=g.c.face.shape,ix=CadSolids.index(g.part.faces,50),pn=CadSolids.planeName(sh);
    const half=L.outer?30:Math.min(150,Math.max(30,L.round?L.round.r*2:Math.max(L.bb[2]-L.bb[0],L.bb[3]-L.bb[1])));
    let gap=Infinity;pts.forEach((p,i)=>{if(Math.abs(s[i]-s[g.i])>half)return;const n=ix.nearest(p,o.d+60);if(n.d-o.d/2<gap)gap=n.d-o.d/2;});
    const low=gap<o.gap-0.05,T=sh.plate.t,other=CadSolids.planeName(sh.plate.other.shape),ax=pn&&other&&pn[0]===other[0]?`${pn[0]} ${[+pn.slice(2),+other.slice(2)].sort((x,y)=>x-y).join(' / ')}`:pn,
      face=`${fmt(T,T%1?1:0)} mm plate${ax?` at ${ax}`:''}`;
    if(!L.outer&&g.part.role==='station'){const at=g.part.stations.map(i=>'P'+(i+1)).join(', ');   // a ticked clip at a station: the hose is meant to sit in it
      return{msg:`${at}: through the ${L.round?`Ø${fmt(2*L.round.r,1)}`:`${Math.round(L.bb[2]-L.bb[0])}×${Math.round(L.bb[3]-L.bb[1])} mm`} opening of ${g.part.name}, the clip at ${at}, ${fmt(Math.max(gap,0),1)} mm clear. It is ticked, so it counts as an obstacle — untick it (the hose sits in it) unless it must keep clear`,
        hole:{pts:CadSolids.loop3(sh,L),bad:false},mark:{p:g.c.x,text:`${g.part.name} · clip at ${at}, ticked`,bad:false}};}
    const what=L.outer?`past the edge of the ${face} of ${g.part.name}, ${fmt(Math.max(gap,0),1)} mm clear`
      :`through ${L.round?`a Ø${fmt(2*L.round.r,1)} hole`:`a ${Math.round(L.bb[2]-L.bb[0])}×${Math.round(L.bb[3]-L.bb[1])} mm opening`} in the ${face} of ${g.part.name}, ${fmt(Math.max(gap,0),1)} mm clear all round`;
    return{msg:`${span(g.i)}: ${what}${gap<0?` (hose ${fmt(-gap,1)} mm into it)`:low?` — below the ${fmt(o.gap)} mm gap`:''}`,
      hole:L.outer?null:{pts:CadSolids.loop3(sh,L),bad:low},mark:{p:g.c.x,text:`${span(g.i)} · ${fmt(Math.max(gap,0),1)} mm`,bad:low}};});}

function load(f){say(`Reading ${f.name} (${(f.size/1e6).toFixed(1)} MB)...`);
  f.text().then(t=>setTimeout(()=>{const t0=performance.now();let cad;
    try{cad=CadSolids.read(t,f.name);}catch(e){return say(`${f.name}: ${e.message}`,true);}
    if(!cad.solids.length)return say(`${f.name}: no solids found. Export from Creo with solids (IGES: BREP / "Solid", or STEP AP214).`,true);
    BC.cad=cad;BC.key='';BC.user=new Map();$('cdClear').hidden=false;$('cdBox').open=true;survey();
    const ex=cad.faces.filter(x=>x.shape).length;
    say(`${f.name}: ${cad.solids.length} solids, ${cad.faces.length} faces (${cad.format}${ex?`; ${ex} flat or cylindrical, gap exact`:''}), read in ${((performance.now()-t0)/1000).toFixed(1)} s.${BC.sv?'':' Load the stations to see which parts are near.'}`);},30));}
$('cdLoad').onclick=()=>$('cdFile').click();
window.bcLoad=f=>{$('cdBox').open=true;load(f);};
$('cdFile').onchange=e=>{if(e.target.files[0])load(e.target.files[0]);e.target.value='';};
$('cdClear').onclick=()=>{BC.cad=null;BC.sv=null;BC.key='';BC.focus=0;$('cdClear').hidden=true;render();say('');};
['cdD','cdGap','cdReach'].forEach(k=>$(k).addEventListener('change',()=>{survey();}));
$('pts').addEventListener('change',()=>{survey();});
}
