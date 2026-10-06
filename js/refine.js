// Local refinement: reshape a cable around one point. Points outside the span never move;
// the span joins the rest with matching position and direction at both ends.
// Loaded after analysis.js; reuses the main script's globals.
function rfSt(m,bad){const e=$('statusRef');e.textContent=m;e.style.color=bad?'var(--bad)':'';}
function rfSpanOf(r){const n=r.Q.length,i=Math.min(n-1,Math.max(0,(+$('rfPt').value||1)-1)),N=Math.max(1,Math.round(+$('rfSpan').value||2));
  return{i,a:Math.max(0,i-N),b:Math.min(n-1,i+N),n};}
function rfEven(pts,K){const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+V.len(V.sub(pts[i],pts[i-1])));const L=s[s.length-1],out=[];
  for(let k=1;k<=K;k++){const t=L*k/(K+1);let i=1;while(i<s.length-1&&s[i]<t)i++;const w=(t-s[i-1])/((s[i]-s[i-1])||1);out.push(V.add(pts[i-1],V.mul(V.sub(pts[i],pts[i-1]),w)));}
  return out;}
function rfObstacles(r){
  const B=r.bundle&&bundles[r.bundle];if(B)return B.obstacles;
  if(r.kind==='analysis'&&r.waCfg)return r.waCfg.obs;
  if(r.kind==='analysis'&&typeof waRows==='function')return waRows($('aobs').value).filter(x=>x.length>=7).map(x=>{const v=x.slice(1,7).map(Number);
    return{id:x[0],min:[Math.min(v[0],v[3]),Math.min(v[1],v[4]),Math.min(v[2],v[5])],max:[Math.max(v[0],v[3]),Math.max(v[1],v[4]),Math.max(v[2],v[5])]};});
  return[];}
let rfBusy=false,rfRunState=null;
const rfStack=[];// undo entries: {label, items: Map(run -> hist depth before)}
const RF_CTRLS=['rfDel','rfPt','rfSpan','rfR','rfAdd','rfSp','rfDx','rfDy','rfDz','rfGo','rfZoom','rfAvoid','rfFixAll','rfStepAll','rfDrag','rfDragFit'];
// points to add to span a..b: the typed count, or enough for the typed spacing, whichever is more
function rfAddCount(r,a,b){const ua=Math.max(0,Math.round(+$('rfAdd').value||0)),sp=+$('rfSp').value;if(!(sp>0))return ua;
  return Math.min(Math.max(ua,Math.max(1,Math.round(pathLength(r.Q.slice(a,b+1))/sp))-(b-a)),Math.max(ua,10-(b-a-1)));}
function rfLock(on){rfBusy=on;RF_CTRLS.forEach(k=>$(k).disabled=on||!selected()||selected().kind==='arc');$('rfUndo').disabled=on||!rfStack.length;
  document.querySelectorAll('#iss .fixbtn,#issFixAll,#issStep').forEach(b=>b.disabled=on);}

// ---- re-fit one span; resolves with a candidate, never applies it ----
function rfFit(r,o){return new Promise(done=>{
  const n=r.Q.length,i=o.i,a=Math.max(0,i-o.N),b=Math.min(n-1,i+o.N);
  if(b-a<2)return done({err:'Span too short. Widen it or pick a point further from the end.'});
  const SF=r.params.SF||1.5,locR=o.locR||r.params.R,add=o.add||0,mv=o.mv||[0,0,0],moved=mv.some(v=>v)||!!o.pin;
  if(moved&&(i===a||i===b))return done({err:'The moved point must sit inside the span, not at its end.'});
  const tanOut=(j,k)=>V.norm(V.sub(r.Q[j],r.Q[k])),tA=a>0?tanOut(a,a-1):null,tB=b<n-1?tanOut(b+1,b):null;
  const chord=V.sub(r.Q[b],r.Q[a]),ok=t=>!t||V.dot(t,chord)>0;
  const before=analyse(r.Q.slice(a,b+1)).minR;
  let inner=r.Q.slice(a+1,b).map(p=>p.slice()),iLoc=i-a-1;
  if(moved)inner[iLoc]=V.add(inner[iLoc],mv);
  else{inner=inner.filter((p,k)=>V.len(V.sub(p,k?inner[k-1]:r.Q[a]))>1e-6&&V.len(V.sub(p,r.Q[b]))>1e-6);if(!inner.length)inner=rfEven([r.Q[a],r.Q[b]],1);}
  // a kinked or looped span seeds badly; start from a straight line through the span instead
  const bent=before<r.params.R*0.5||inner.some((p,k)=>{const q=k?inner[k-1]:r.Q[a],s=k<inner.length-1?inner[k+1]:r.Q[b];
    const u=V.sub(p,q),w=V.sub(s,p);return V.dot(u,w)<Math.cos(Math.PI/3)*V.len(u)*V.len(w);});
  if(bent&&!moved)inner=rfEven([r.Q[a],r.Q[b]],inner.length);
  if(add){const K=inner.length+add,dense=bent&&!moved?[r.Q[a],r.Q[b]]:sampleSpline(naturalSpline([r.Q[a],...inner,r.Q[b]]),40).pts,seed=rfEven(dense,K);
    if(moved){let bi=0,bd=Infinity;seed.forEach((q,k)=>{const d=V.len(V.sub(q,inner[iLoc]));if(d<bd){bd=d;bi=k;}});seed[bi]=inner[iLoc];iLoc=bi;}
    inner=seed;}
  const P0=[r.Q[a],...inner,r.Q[b]],m=P0.length,fixDirs=P0.map(()=>null);
  if(a>0)fixDirs[0]=ok(tA)?tA:null;if(b<n-1)fixDirs[m-1]=ok(tB)?tB:null;
  const freePts=[];for(let k=1;k<m-1;k++)if(!(moved&&k===iLoc+1))freePts.push(k);
  const me={r:r.cable?r.cable.d/2:0,g:r.cable?r.cable.gap||0:0},avoid=[];
  if(o.avoid)new Set([...visible(),...(r.kind==='analysis'?waBatchRuns(r):[])]).forEach(ob=>{if(ob===r||ob.kind==='master')return;
    const orr=ob.cable?ob.cable.d/2:0,og=ob.cable?ob.cable.gap||0:0;for(let k=0;k<ob.d.pts.length;k+=3){const p=ob.d.pts[k];avoid.push([p[0],p[1],p[2],orr,og]);}});
  // keep the sample count per evaluation roughly constant, so long spans with many points stay responsive
  const route=makeRoute(P0,{fixDirs,freePts,obstacles:rfObstacles(r),rad:me.r+(r.bundle&&bundles[r.bundle]?bundles[r.bundle].keep||0:0),avoid,self:me,S:Math.max(6,Math.round(120/(m-1)))});
  const opt=optimiser(route,locR*SF);
  const tick=()=>{const t0=performance.now();let res;do{res=opt.step(2);}while(!res.done&&performance.now()-t0<40);
    if(o.onTick)o.onTick(res.minR,a,b);if(!res.done)return defer(tick);
    const newInner=route.pts(res.x).slice(1,-1).map(p=>p.map(c=>Math.round(c*100)/100)),Q=[...r.Q.slice(0,a+1),...newInner,...r.Q.slice(b)],delta=Q.length-n;
    const spanAfter=analyse(Q.slice(a,b+delta+1)).minR,reach=Math.max(...newInner.map(p=>closestOnSegment(p,r.Q[a],r.Q[b]).d)),far=reach>Math.max(V.len(chord)*1.5,locR*3);
    done({Q,a,b,delta,before,spanAfter,far,moved,add,iLoc});};
  defer(tick);});}

// ---- judge a candidate on bend, clearance and kink; ok = fewer failures, or a clean span that is no worse ----
function rfScore(E){let s=0,n=0;E.forEach(e=>e.issues.forEach(x=>{if(waFixable(x)){s+=x.sev===3?10:1;n++;}}));return{s,n};}
function rfInSpan(x,a,b){return x.a!=null&&x.a<=b&&x.b>=a;}
function rfJudge(r,fit,base){
  if(fit.far)return{ok:false,why:'points strayed from the cable'};
  if(r.kind==='analysis'&&base){const E=waEval(r,fit.Q);if(E){const sc=rfScore(E),b2=fit.b+fit.delta;
    const span=E.find(e=>e.run===r).issues.filter(x=>waFixable(x)&&rfInSpan(x,fit.a,b2));
    const ok=sc.s<base.s||(!span.length&&sc.s<=base.s);
    return{ok,E,sc,span,why:ok?'':span.length?`span still has ${span.length} issue${span.length>1?'s':''} (${[...new Set(span.map(x=>x.check.toLowerCase()))].join(', ')})`:'it created new issues elsewhere'};}}
  const R=r.params.R,ok=fit.spanAfter>=R||fit.spanAfter>=fit.before*0.98;
  return{ok,why:ok?'':`bend got tighter (R ${fmt(fit.spanAfter)} vs ${fmt(fit.before)} mm) and is below the ${R} mm minimum`};}
function rfBase(r){if(r.kind!=='analysis')return null;const E=waEval(r);return E?rfScore(E):null;}

// ---- apply / restore ----
function rfSnap(r){return{Q:r.Q,tidx:r.tidx,text:r.text,d:r.d,wi:r.wi,minR:r.minR,len:r.len,settings:r.settings,issues:r.issues,clear:r.clear,clearDense:r.clearDense,clr:r.clr,lastSpan:r.lastSpan};}
function rfCommit(r,fit,entry){
  const{a,b,delta,Q}=fit,SF=r.params.SF||1.5;
  if(entry&&!entry.items.has(r))entry.items.set(r,(r.hist||[]).length);
  r.hist=r.hist||[];r.hist.push(rfSnap(r));
  const A=analyse(Q);Object.assign(r,{Q,d:A.d,wi:A.wi,minR:A.minR,len:A.len});
  if(r.tidx)r.tidx=[...new Set([...r.tidx.filter(t=>t<a),a,b+delta,...r.tidx.filter(t=>t>b).map(t=>t+delta)])].sort((x,y)=>x-y);
  r.settings=`${r.hist[0].settings} · refined ×${r.hist.length}`;
  r.text=toPts(Q,{R:r.params.R,designR:+(r.params.R*SF).toFixed(1),minR:r.minR,len:r.len,tidx:r.tidx||Q.map((_,k)=>k)});
  r.lastSpan={a,b:b+delta,before:r.hist[r.hist.length-1].Q.slice(a,b+1)};
  if(r.kind==='analysis')waRecheck(r);
  else{delete r.clear;delete r.clearDense;delete r.clr;
    if(r.issues)r.issues=r.issues.filter(x=>x.a==null||x.b<a||x.a>b).map(x=>{if(x.a!=null&&x.a>b){x.a+=delta;x.b+=delta;x.w+=delta;}return x;});}
  // keep Point # on the same physical point after renumbering
  if(selected()===r){const p=+$('rfPt').value-1;if(p>b)$('rfPt').value=p+delta+1;else if(fit.moved)$('rfPt').value=a+fit.iLoc+2;}}
function rfRestore(r,depth){if(!r.hist||r.hist.length<=depth)return;let h;while(r.hist.length>depth)h=r.hist.pop();
  Object.assign(r,h);['clear','clearDense','clr','lastSpan'].forEach(k=>{if(h[k]===undefined)delete r[k];});
  if(!r.hist.length)delete r.lastSpan;if(r.kind==='analysis')waRecheck(r);}
function rfUndo(){if(rfBusy)return;const e=rfStack.pop();if(!e)return;
  e.items.forEach((d,r)=>{if(runs.includes(r))rfRestore(r,d);});
  $('rfSum').innerHTML='';renderRuns();rebuild(false);
  rfSt(`Undone: ${e.label}.${rfStack.length?` ${rfStack.length} more step${rfStack.length>1?'s':''} to undo.`:' Back to the original points.'}`);}
function rfPush(label,entry){if(entry.items.size){entry.label=label;rfStack.push(entry);}}

// ---- delete one point (never the start or end) ----
function rfDelete(r,i){if(rfBusy||!r)return;const n=r.Q.length;
  if(i<=0||i>=n-1)return rfSt('The start and end points cannot be deleted.',true);if(n<4)return rfSt('A cable needs at least three points.',true);
  const Q=r.Q.filter((_,k)=>k!==i),entry={items:new Map()};
  rfCommit(r,{Q,a:i-1,b:i+1,delta:-1,before:0,spanAfter:0,far:false,moved:false,add:0,iLoc:0},entry);rfPush(`delete of P${i+1}`,entry);
  $('rfPt').value=Math.min(i,Q.length);renderRuns();rebuild(false);
  rfSt(`P${i+1} deleted. Later points move up one number. Cable R ${fmt(r.minR)} mm.${rfNextNote(r)}`,r.minR<r.params.R);}

// ---- next open issue on a run ----
function rfOpen(r){return(r&&r.issues||[]).filter(waFixable).sort(waCmp);}
function rfPointAt(x){$('rfPt').value=x.w+1;$('rfSpan').value=Math.max(x.w-x.a,x.b-x.w)+2;waSel=x.uid;}
function rfNextNote(r){const nx=rfOpen(r)[0];if(!nx)return r.kind==='analysis'?' No open issues left on this cable.':'';
  rfPointAt(nx);return` Next: ${waPts(nx)} ${nx.check.toLowerCase()} (${nx.foundTxt}). Press Re-fit span or Fix.`;}

// ---- manual re-fit from the Refine fields ----
async function rfApply(){
  const r=selected();if(!r)return rfSt('Select a run first.');if(rfBusy)return;
  const{i,a,b}=rfSpanOf(r),N=Math.max(1,Math.round(+$('rfSpan').value||2));
  const locR=+$('rfR').value||r.params.R,add=rfAddCount(r,a,b),mv=['rfDx','rfDy','rfDz'].map(k=>+$(k).value||0);
  rfLock(true);const base=rfBase(r);
  const fit=await rfFit(r,{i,N,add,mv,locR,avoid:$('rfAvoid').checked,onTick:(R,a,b)=>rfSt(`Re-fitting points ${a+1}–${b+1}... tightest bend so far R ${fmt(R)} mm`)});
  rfLock(false);
  if(fit.err)return rfSt(fit.err,true);
  const j=rfJudge(r,fit,base),forced=(fit.moved||fit.add)&&!fit.far;
  if(!j.ok&&!forced)return rfSt(`Not applied: ${j.why}. Widen the span or add points.`,true);
  const entry={items:new Map()};rfCommit(r,fit,entry);rfPush(`re-fit of points ${fit.a+1}–${fit.b+1}`,entry);
  ['rfDx','rfDy','rfDz'].forEach(k=>$(k).value=0);$('rfAdd').value=0;
  const span=analyse(r.Q.slice(fit.a,fit.b+fit.delta+1)),bad=span.minR<r.params.R||(!j.ok&&forced);
  const clean=r.kind==='analysis'&&!rfOpen(r).some(x=>rfInSpan(x,fit.a,fit.b+fit.delta));
  const msg=`Points ${fit.a+1}–${fit.b+fit.delta+1} re-fitted${fit.add?`, ${fit.add} added`:''}${fit.moved?', point moved':''}. Span holds R ${fmt(span.minR)} mm; whole cable R ${fmt(r.minR)} mm.`
    +(!j.ok&&forced?` Applied as asked, but ${j.why}.`:'')+(clean?rfNextNote(r):'');
  renderRuns();rebuild(false);rfZoom();rfSt(msg,bad);}

// ---- automatic fix of one issue: widen, then add points, then give up ----
function rfTries(x){const base=Math.max(x.w-x.a,x.b-x.w)+2;return[[base,0],[base+1,0],[base+2,0],[base+4,0],[base+2,2],[base+4,4]];}
async function rfSolve(x,note){
  const r=x.runRef,base=rfBase(r),locR=+$('rfR').value||r.params.R,avoid=$('rfAvoid').checked||x.check==='Cable clearance';
  if(x.check==='Duplicate point'){const n=r.Q.length,k=x.w<n-1?x.w:x.w-1;if(k<=0||n<4)return{why:'at the cable end; delete it by hand'};
    const Q=r.Q.filter((_,i)=>i!==k),fit={Q,a:k-1,b:k+1,delta:-1,before:0,spanAfter:analyse(Q.slice(k-1,k+1)).minR,far:false,moved:false,add:0};
    return{fit,how:'deleted the duplicate'};}
  let why='no span passed';
  for(const[N,bump]of rfTries(x)){
    const n=r.Q.length,add=Math.max(bump,rfAddCount(r,Math.max(0,x.w-N),Math.min(n-1,x.w+N)));
    const fit=await rfFit(r,{i:x.w,N,add,locR,avoid,onTick:(R,a,b)=>note(`points ${a+1}–${b+1}${add?`, +${add} points`:''}, R ${fmt(R)} mm`)});
    if(fit.err){why=fit.err;continue;}
    const j=rfJudge(r,fit,base);if(!j.ok){why=j.why;continue;}
    if(j.span&&j.span.some(q=>q.check===x.check)){why=`${x.check.toLowerCase()} still fails`;continue;}
    return{fit,how:`span ±${N}${add?`, ${add} point${add>1?'s':''} added`:''}`};}
  return{why};}
async function rfFixOne(x){
  if(rfBusy||!x)return;const r=x.runRef;selId=r.id;r.visible=true;dock='ref';showPane();rfPointAt(x);renderRuns();
  rfLock(true);$('rfSum').innerHTML='';
  const res=await rfSolve(x,t=>rfSt(`Fixing ${x.cable} ${waPts(x)} ${x.check.toLowerCase()}: ${t}`));rfLock(false);
  if(!res.fit){renderRuns();return rfSt(`Could not fix ${x.cable} ${waPts(x)} ${x.check.toLowerCase()}: ${res.why}. Try a wider span, more points or a move by hand.`,true);}
  const entry={items:new Map()};rfCommit(r,res.fit,entry);rfPush(`fix of ${x.cable} ${waPts(x)}`,entry);
  renderRuns();rebuild(false);rfZoom();
  rfSt(`Fixed ${x.cable} ${waPts(x)} ${x.check.toLowerCase()} (${res.how}). Cable R ${fmt(r.minR)} mm.${rfNextNote(r)}`);renderRuns();}

// ---- fix all / step through ----
function rfKey(x){return`${x.cable}|${x.check}|${x.p.map(v=>Math.round(v/5)).join(',')}`;}
function rfAsk(txt){$('rfStepTxt').textContent=txt;$('rfStep').hidden=false;
  return new Promise(res=>{const f=a=>{$('rfStep').hidden=true;res(a);};$('rfAccept').onclick=()=>f('accept');$('rfSkip').onclick=()=>f('skip');$('rfStop').onclick=()=>f('stop');});}
async function rfFixAll(step){
  if(rfBusy)return;const sel=selected();
  if(!runs.some(r=>r.kind==='analysis'))return rfSt('Analyse some cables first; Fix all works on the Issues list.',true);
  const inScope=x=>waFixable(x)&&(!waFilter.cable||x.cable===waFilter.cable)&&(!waFilter.check||x.check===waFilter.check);
  const tried=new Set(),fixed=[],failed=[],skipped=[],entry={items:new Map()},total=waAll().filter(inScope).length;
  dock='ref';showPane();rfLock(true);$('rfSum').innerHTML='';rfRunState={stop:false};
  for(let it=0;it<total*3+10&&!rfRunState.stop;it++){
    const open=waAll().filter(x=>inScope(x)&&!tried.has(rfKey(x))).sort(waCmp);if(!open.length)break;
    const x=open[0],r=x.runRef,tag=`${x.cable} ${waPts(x)} ${x.check.toLowerCase()}`;tried.add(rfKey(x));
    selId=r.id;r.visible=true;rfPointAt(x);renderRuns();rfLock(true);
    const res=await rfSolve(x,t=>rfSt(`${fixed.length+failed.length+skipped.length+1}/${total}+ · ${tag}: ${t}`));
    if(!res.fit){failed.push({tag,why:res.why});continue;}
    const depth=(r.hist||[]).length;rfCommit(r,res.fit,entry);
    if(step){renderRuns();rebuild(false);rfZoom();rfLock(true);
      const ans=await rfAsk(`${tag} (${x.foundTxt}): ${res.how}. Cable now R ${fmt(r.minR)} mm.`);
      if(ans!=='accept'){rfRestore(r,depth);if(entry.items.get(r)===depth)entry.items.delete(r);skipped.push({tag});
        if(ans==='stop'){rfRunState.stop=true;break;}continue;}}
    fixed.push({tag,how:res.how});}
  rfRunState=null;rfPush(step?'step-through fixes':'fix all',entry);rfLock(false);
  if(sel&&runs.includes(sel))selId=sel.id;renderRuns();rebuild(false);
  const left=waAll().filter(waFixable).length,li=(t,c)=>`<li${c?` style="color:var(${c})"`:''}>${t}</li>`;
  $('rfSum').innerHTML=`<p><b>${fixed.length} fixed</b> · ${failed.length} could not be fixed${skipped.length?` · ${skipped.length} skipped`:''} · ${left} open issue${left===1?'':'s'} left. ${fixed.length?'Undo reverts the whole batch.':''}</p><ul>`
    +fixed.map(f=>li(`Fixed ${f.tag}: ${f.how}`)).join('')+failed.map(f=>li(`Not fixed ${f.tag}: ${f.why}`,'--bad')).join('')+skipped.map(f=>li(`Skipped ${f.tag}`,'--muted')).join('')+'</ul>';
  rfSt(`${step?'Step through':'Fix all'} finished: ${fixed.length} fixed, ${failed.length} not fixed${skipped.length?`, ${skipped.length} skipped`:''}.`,failed.length>0);}

// ---- drag a point in the 3D view, constrained to an axis, a plane or the screen ----
const RF_AX={x:[1,0,0],y:[0,1,0],z:[0,0,1]},RF_AXC={x:'#e0605a',y:'#4fb572',z:'#4a90e2'};
const rfDragSt={r:null};
function rfDragMode(){return dock==='ref'&&!rfBusy?$('rfDrag').value:'';}
function rfScreenPt(q,rc){const v=new THREE.Vector3(...q).project(camera);return v.z>1?null:[(v.x+1)/2*rc.width+rc.left,(1-v.y)/2*rc.height+rc.top];}
function rfHitPoint(e){const r=selected();if(!r||!r.visible||r.kind==='arc')return-1;const rc=$('gl').getBoundingClientRect();let bi=-1,bd=14;
  r.Q.forEach((q,i)=>{const s=rfScreenPt(q,rc);if(!s)return;const d=Math.hypot(s[0]-e.clientX,s[1]-e.clientY);if(d<bd){bd=d;bi=i;}});return bi;}
function rfDragPos(e){const{o,mode}=rfDragSt,rc=$('gl').getBoundingClientRect(),rc2=new THREE.Raycaster();
  rc2.setFromCamera(new THREE.Vector2((e.clientX-rc.left)/rc.width*2-1,1-(e.clientY-rc.top)/rc.height*2),camera);
  const ray=rc2.ray,O=ray.origin,D=ray.direction,P=new THREE.Vector3(...o);
  if(mode.length===1){const A=new THREE.Vector3(...RF_AX[mode]),w=P.clone().sub(O),a=A.dot(A),b=A.dot(D),c=D.dot(D),d=A.dot(w),e2=D.dot(w),den=a*c-b*b;
    if(Math.abs(den)<1e-9)return null;return P.clone().addScaledVector(A,(b*e2-c*d)/den);}
  const n=mode==='v'?camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(...RF_AX['xyz'.replace(mode[0],'').replace(mode[1],'')]);
  const hit=new THREE.Vector3();return ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,P),hit)?hit:null;}
function rfLive(r){const A=analyse(r.Q);Object.assign(r,{d:A.d,wi:A.wi,minR:A.minR,len:A.len});rebuild(false);}
async function rfDragEnd(){const s=rfDragSt,r=s.r,i=s.i;rfDragSt.r=null;$('gl').style.cursor='';if(s.raf){cancelAnimationFrame(s.raf);s.raf=0;}
  if(!s.moved){r.Q=s.snap.Q;rfLive(r);return rfSt(`P${i+1} selected.`);}
  const Qn=r.Q,n=Qn.length;Object.assign(r,s.snap);
  const d=V.sub(Qn[i],s.o),entry={items:new Map()};
  rfCommit(r,{Q:Qn,a:Math.max(0,i-1),b:Math.min(n-1,i+1),delta:0,before:0,spanAfter:0,far:false,moved:true,add:0,iLoc:0},entry);
  let msg=`P${i+1} moved by X ${fmt(d[0])}, Y ${fmt(d[1])}, Z ${fmt(d[2])} mm.`,bad=false;
  if($('rfDragFit').checked&&i>0&&i<n-1){const N=Math.max(1,Math.round(+$('rfSpan').value||2)),a=Math.max(0,i-N),b=Math.min(n-1,i+N);
    rfLock(true);const fit=await rfFit(r,{i,N,pin:true,add:rfAddCount(r,a,b),locR:+$('rfR').value||r.params.R,avoid:$('rfAvoid').checked,onTick:(R,a,b)=>rfSt(`Re-fitting points ${a+1}–${b+1} around P${i+1}... R ${fmt(R)} mm`)});rfLock(false);
    if(fit.err)msg+=` Neighbours not re-fitted: ${fit.err}`;else if(fit.far)msg+=' Neighbours not re-fitted: the fit strayed from the cable. Try a wider span or add points, then Re-fit span.';else{const j=rfJudge(r,fit,rfBase(r));if(!j.ok){msg+=` Neighbours left as they were: the re-fit ${j.why}.`;bad=true;}else{rfCommit(r,fit,entry);
      msg+=` Neighbours ${fit.a+1}–${fit.b+fit.delta+1} re-fitted${fit.add?` with ${fit.add} added`:''}.`;}}}
  rfPush(`drag of P${i+1}`,entry);renderRuns();rebuild(false);
  rfSt(msg+` Cable R ${fmt(r.minR)} mm.`,bad||r.minR<r.params.R);}
{const vw=$('view'),gl=$('gl');
  vw.addEventListener('pointerdown',e=>{const mode=rfDragMode();if(!mode||e.button!==0||e.shiftKey)return;const i=rfHitPoint(e);if(i<0)return;
    const r=selected();e.stopPropagation();e.preventDefault();try{gl.setPointerCapture(e.pointerId);}catch(_){}
    Object.assign(rfDragSt,{mode,r,i,o:r.Q[i].slice(),snap:rfSnap(r),moved:false,raf:0});r.Q=r.Q.map(p=>p.slice());
    $('rfPt').value=i+1;gl.style.cursor='grabbing';rfSt(`Dragging P${i+1}. Release to place it.`);},true);
  vw.addEventListener('pointermove',e=>{const s=rfDragSt;
    if(s.r){e.stopPropagation();const p=rfDragPos(e);if(!p)return;const q=[p.x,p.y,p.z].map(v=>Math.round(v*10)/10);s.r.Q[s.i]=q;s.moved=true;
      const d=V.sub(q,s.o);rfSt(`P${s.i+1}: X ${d[0]>=0?'+':''}${fmt(d[0])}, Y ${d[1]>=0?'+':''}${fmt(d[1])}, Z ${d[2]>=0?'+':''}${fmt(d[2])} mm`);
      if(!s.raf)s.raf=requestAnimationFrame(()=>{s.raf=0;rfLive(s.r);});return;}
    if(rfDragMode())gl.style.cursor=rfHitPoint(e)>=0?'grab':'';},true);
  const up=e=>{if(!rfDragSt.r)return;e.stopPropagation();rfDragEnd();};
  vw.addEventListener('pointerup',up,true);vw.addEventListener('pointercancel',up,true);
  $('rfDrag').onchange=()=>rebuild(false);}

function rfZoom(){const r=selected();if(!r)return;const{a,b}=r.lastSpan||rfSpanOf(r);
  const P=r.Q.slice(a,b+1),c=P.reduce((s,p)=>V.add(s,p),[0,0,0]).map(v=>v/P.length);
  orbit.target.set(...c);orbit.dist=Math.max(pathLength(P)*1.8,r.params.R*6);zoomed=true;$('zoom').textContent='Show whole route';draw();}
function renderRefine(){const r=selected();
  $('refname').textContent=r?`Refine · ${r.name}`:'Refine';
  if(!rfBusy){RF_CTRLS.forEach(k=>$(k).disabled=!r||r.kind==='arc');if(r&&r.kind==='arc')rfSt('Lines + arcs runs are changed by solving again on the Bend tab; Refine works on spline and imported routes.');$('rfUndo').disabled=!rfStack.length;}
  const n=r?rfOpen(r).length:0;$('rfFixAll').textContent=n?`Fix all (${waAll().filter(waFixable).length})`:'Fix all';
  if(r){$('rfPt').max=r.Q.length;if(+$('rfPt').value>r.Q.length)$('rfPt').value=r.Q.length;$('rfR').placeholder=r.params.R;}}
function rfPick(i){$('rfPt').value=i+1;if(rfBusy)return;const r=selected();if(r)rfSt(`Point ${i+1} of ${r.Q.length} selected. Set the span and re-fit.`);}
function rfOverlay(){const r=selected();if(!r||!r.visible)return;
  if(r.lastSpan&&r.lastSpan.before.length>1){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.lastSpan.before.map(p=>new THREE.Vector3(...p))),
    new THREE.LineDashedMaterial({color:css('--muted'),dashSize:tubeR*2.5,gapSize:tubeR*1.5}));l.computeLineDistances();content.add(l);
    addTag(r.Q[r.lastSpan.a],'span start','t');addTag(r.Q[r.lastSpan.b],'span end','t');}
  const mode=$('rfDrag').value,help=$('view').querySelector('.help');
  if(dock==='ref'){const{i}=rfSpanOf(r);const m=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:new THREE.Color(css('--ink')),transparent:true,opacity:0.35,depthWrite:false}));
    m.scale.setScalar(tubeR*3);m.position.set(...r.Q[i]);content.add(m);
    if(mode&&mode!=='v'){const L=Math.max(r.params.R*2,diag*0.08);for(const k of mode){const A=V.mul(RF_AX[k],L),p=r.Q[i];
      content.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...V.sub(p,A)),new THREE.Vector3(...V.add(p,A))]),new THREE.LineBasicMaterial({color:RF_AXC[k]})));}}}
  if(help)help.textContent=dock==='ref'&&mode?`Drag a point to move it ${mode==='v'?'in the screen plane':mode.length===1?'along '+mode.toUpperCase():'in the '+mode.toUpperCase()+' plane'}. Drag empty space to rotate.`:'Drag to rotate, shift-drag to pan, scroll to zoom';
  draw();}

// hooks
{const _rb=rebuild;rebuild=function(refit){_rb(refit);rfOverlay();};}
{const _rr=renderRuns;renderRuns=function(){_rr();renderRefine();};}
{const _rp=renderPts;renderPts=function(){_rp();const r=selected();if(!r)return;
  $('ptstable').querySelectorAll('tr[data-i]').forEach(tr=>{const o=tr.onclick,i=+tr.dataset.i;tr.onclick=e=>{o(e);rfPick(i);};});};}
if(typeof renderIssues==='function'){const _ri=renderIssues;renderIssues=function(){_ri();const box=$('iss');if(!box)return;
  box.querySelectorAll('tr[data-u]').forEach(tr=>{const x=waAll().find(q=>q.uid===+tr.dataset.u),o=tr.onclick;if(!x||x.a==null)return;tr.onclick=e=>{o(e);rfPick(x.w);renderRefine();};});
  box.querySelectorAll('.fixbtn').forEach(b=>{b.disabled=rfBusy;b.onclick=e=>{e.stopPropagation();const x=waAll().find(q=>q.uid===+(b.dataset.fix||b.dataset.del));if(!x)return;
    if(b.dataset.fix)return rfFixOne(x);selId=x.runRef.id;rfDelete(x.runRef,x.w);};});
  if($('issFixAll')){$('issFixAll').disabled=$('issStep').disabled=rfBusy;$('issFixAll').onclick=()=>rfFixAll(false);$('issStep').onclick=()=>rfFixAll(true);}};}
showPane=function(){
  $('paneChart').dataset.on=(dock==='rad'||dock==='clr')?1:0;
  [['cmp','paneCmp'],['pts','panePts'],['bun','paneBun'],['iss','paneIss'],['ref','paneRef']].forEach(([k,p])=>$(p).dataset.on=dock===k?1:0);
  ['dRad','dClr','dCmp','dPts','dBun','dIss','dRef'].forEach((id,i)=>$(id).setAttribute('aria-selected',['rad','clr','cmp','pts','bun','iss','ref'][i]===dock));
  rebuild(false);};
$('dRef').onclick=()=>{dock='ref';showPane();};
$('rfGo').onclick=rfApply;$('rfUndo').onclick=rfUndo;$('rfZoom').onclick=rfZoom;
$('rfFixAll').onclick=()=>rfFixAll(false);$('rfDel').onclick=()=>{const r=selected();if(r)rfDelete(r,rfSpanOf(r).i);};$('rfStepAll').onclick=()=>rfFixAll(true);
['rfPt','rfSpan'].forEach(k=>$(k).oninput=()=>{if(dock==='ref')rebuild(false);});
renderRefine();renderIssues();
