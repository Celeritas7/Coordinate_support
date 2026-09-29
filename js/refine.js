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
  if(r.kind==='analysis'&&typeof waRows==='function')return waRows($('aobs').value).filter(x=>x.length>=7).map(x=>{const v=x.slice(1,7).map(Number);
    return{id:x[0],min:[Math.min(v[0],v[3]),Math.min(v[1],v[4]),Math.min(v[2],v[5])],max:[Math.max(v[0],v[3]),Math.max(v[1],v[4]),Math.max(v[2],v[5])]};});
  return[];}
let rfBusy=false;
function rfApply(){
  const r=selected();if(!r)return rfSt('Select a run first.');if(rfBusy)return;
  const{i,a,b,n}=rfSpanOf(r);
  if(b-a<2)return rfSt('Span too short. Widen it or pick a point further from the end.',true);
  const SF=r.params.SF||1.5,locR=+$('rfR').value||r.params.R,add=Math.max(0,Math.round(+$('rfAdd').value||0));
  const mv=['rfDx','rfDy','rfDz'].map(k=>+$(k).value||0),moved=mv.some(v=>v);
  if(moved&&(i===a||i===b))return rfSt('The moved point must sit inside the span, not at its end.',true);
  const sp=naturalSpline(r.Q),tan=j=>V.norm(j<n-1?sp.at(j,0).d1:sp.at(j-1,sp.t[j]-sp.t[j-1]).d1);
  // end directions from the neighbours outside the span, so a bad span cannot corrupt them
  const tanOut=(j,k)=>V.norm(V.sub(r.Q[j],r.Q[k])),tA=a>0?tanOut(a,a-1):null,tB=b<n-1?tanOut(b+1,b):null;
  const chord=V.sub(r.Q[b],r.Q[a]),ok=t=>!t||V.dot(t,chord)>0;
  const before=analyse(r.Q.slice(a,b+1)).minR;
  let inner=r.Q.slice(a+1,b).map(p=>p.slice()),iLoc=i-a-1;
  if(moved)inner[iLoc]=V.add(inner[iLoc],mv);
  // a kinked or looped span seeds badly; start from a straight line through the span instead
  const bent=before<r.params.R*0.5||inner.some((p,k)=>{const q=k?inner[k-1]:r.Q[a],s=k<inner.length-1?inner[k+1]:r.Q[b];
    const u=V.sub(p,q),w=V.sub(s,p);return V.dot(u,w)<Math.cos(Math.PI/3)*V.len(u)*V.len(w);});
  if(bent&&!moved)inner=rfEven([r.Q[a],r.Q[b]],inner.length);
  if(add){const K=inner.length+add,dense=bent?[r.Q[a],r.Q[b]]:sampleSpline(naturalSpline([r.Q[a],...inner,r.Q[b]]),40).pts,seed=rfEven(dense,K);
    if(moved){let bi=0,bd=Infinity;seed.forEach((q,k)=>{const d=V.len(V.sub(q,inner[iLoc]));if(d<bd){bd=d;bi=k;}});seed[bi]=inner[iLoc];iLoc=bi;}
    inner=seed;}
  const P0=[r.Q[a],...inner,r.Q[b]],m=P0.length,fixDirs=P0.map(()=>null);
  if(a>0)fixDirs[0]=ok(tA)?tA:null;if(b<n-1)fixDirs[m-1]=ok(tB)?tB:null;
  const freePts=[];for(let k=1;k<m-1;k++)if(!(moved&&k===iLoc+1))freePts.push(k);
  const me={r:r.cable?r.cable.d/2:0,g:r.cable?r.cable.gap||0:0},avoid=[];
  if($('rfAvoid').checked)visible().forEach(o=>{if(o===r||o.kind==='master')return;const orr=o.cable?o.cable.d/2:0,og=o.cable?o.cable.gap||0:0;
    for(let k=0;k<o.d.pts.length;k+=3){const p=o.d.pts[k];avoid.push([p[0],p[1],p[2],orr,og]);}});
  const obstacles=rfObstacles(r),route=makeRoute(P0,{fixDirs,freePts,obstacles,rad:me.r+(r.bundle&&bundles[r.bundle]?bundles[r.bundle].keep||0:0),avoid,self:me});
  const o=optimiser(route,locR*SF);rfBusy=true;$('rfGo').disabled=true;
  const tick=()=>{const t0=performance.now();let res;do{res=o.step(6);}while(!res.done&&performance.now()-t0<40);
    rfSt(`Re-fitting points ${a+1}–${b+1}... tightest bend so far R ${fmt(res.minR)} mm`);if(!res.done)return defer(tick);
    const newInner=route.pts(res.x).slice(1,-1).map(p=>p.map(c=>Math.round(c*100)/100)),newQ=[...r.Q.slice(0,a+1),...newInner,...r.Q.slice(b)],delta=newQ.length-n;
    const spanAfter=analyse(newQ.slice(a,b+delta+1)).minR,reach=Math.max(...newInner.map(p=>closestOnSegment(p,r.Q[a],r.Q[b]).d)),far=reach>Math.max(V.len(chord)*1.5,locR*3);
    if(!moved&&!add&&spanAfter<before*0.98||far){rfBusy=false;$('rfGo').disabled=false;
      return rfSt(`Not applied: the re-fit made the span worse (R ${fmt(spanAfter)} vs ${fmt(before)} mm before${far?', points strayed from the cable':''}). Widen the span or add points.`,true);}
    r.hist=r.hist||[];r.hist.push({Q:r.Q,tidx:r.tidx,text:r.text,d:r.d,wi:r.wi,minR:r.minR,len:r.len,settings:r.settings,issues:r.issues,clear:r.clear,clearDense:r.clearDense,clr:r.clr,lastSpan:r.lastSpan});
    const A=analyse(newQ);Object.assign(r,{Q:newQ,d:A.d,wi:A.wi,minR:A.minR,len:A.len});
    if(r.tidx)r.tidx=[...new Set([...r.tidx.filter(t=>t<a),a,b+delta,...r.tidx.filter(t=>t>b).map(t=>t+delta)])].sort((x,y)=>x-y);
    delete r.clear;delete r.clearDense;delete r.clr;
    if(r.issues)r.issues=r.issues.filter(x=>x.a==null||x.b<a||x.a>b).map(x=>{if(x.a!=null&&x.a>b){x.a+=delta;x.b+=delta;x.w+=delta;}return x;});
    r.settings=`${r.hist[0].settings} · refined ×${r.hist.length}`;
    r.text=toPts(newQ,{R:r.params.R,designR:+(r.params.R*SF).toFixed(1),minR:r.minR,len:r.len,tidx:r.tidx||newQ.map((_,k)=>k)});
    r.lastSpan={a,b:b+delta,before:r.hist[r.hist.length-1].Q.slice(a,b+1)};
    const span=analyse(newQ.slice(a,b+delta+1)),bad=span.minR<r.params.R;
    rfBusy=false;$('rfGo').disabled=false;['rfDx','rfDy','rfDz'].forEach(k=>$(k).value=0);$('rfAdd').value=0;
    if(moved)$('rfPt').value=a+iLoc+2;
    renderRuns();rebuild(false);rfZoom();
    rfSt(`Points ${a+1}–${b+delta+1} re-fitted${add?`, ${add} added`:''}${moved?', point moved':''}. Span holds R ${fmt(span.minR)} mm${bad?` (below the ${r.params.R} mm minimum; try a wider span)`:''}; whole cable R ${fmt(r.minR)} mm.${r.kind==='analysis'?' Run Analyse again to re-check this cable.':''}`,bad);};
  defer(tick);
}
function rfUndo(){const r=selected();if(!r||!r.hist||!r.hist.length)return;
  const h=r.hist.pop();Object.assign(r,h);if(h.clear===undefined)delete r.clear;if(h.clearDense===undefined)delete r.clearDense;if(h.clr===undefined)delete r.clr;
  if(!r.hist.length)delete r.lastSpan;renderRuns();rebuild(false);rfSt(`Undone. ${r.hist.length?r.hist.length+' refinement'+(r.hist.length>1?'s':'')+' left':'Back to the original points'}.`);}
function rfZoom(){const r=selected();if(!r)return;const{a,b}=r.lastSpan||rfSpanOf(r);
  const P=r.Q.slice(a,b+1),c=P.reduce((s,p)=>V.add(s,p),[0,0,0]).map(v=>v/P.length);
  orbit.target.set(...c);orbit.dist=Math.max(pathLength(P)*1.8,r.params.R*6);zoomed=true;$('zoom').textContent='Show whole route';draw();}
function renderRefine(){const r=selected();
  $('refname').textContent=r?`Refine · ${r.name}`:'Refine';
  ['rfPt','rfSpan','rfR','rfAdd','rfDx','rfDy','rfDz','rfGo','rfZoom','rfAvoid'].forEach(k=>$(k).disabled=!r);
  $('rfUndo').disabled=!(r&&r.hist&&r.hist.length);
  if(r){$('rfPt').max=r.Q.length;if(+$('rfPt').value>r.Q.length)$('rfPt').value=r.Q.length;$('rfR').placeholder=r.params.R;}}
function rfPick(i){$('rfPt').value=i+1;if(rfBusy)return;const r=selected();if(r)rfSt(`Point ${i+1} of ${r.Q.length} selected. Set the span and re-fit.`);}
function rfOverlay(){const r=selected();if(!r||!r.visible)return;
  if(r.lastSpan&&r.lastSpan.before.length>1){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.lastSpan.before.map(p=>new THREE.Vector3(...p))),
    new THREE.LineDashedMaterial({color:css('--muted'),dashSize:tubeR*2.5,gapSize:tubeR*1.5}));l.computeLineDistances();content.add(l);
    addTag(r.Q[r.lastSpan.a],'span start','t');addTag(r.Q[r.lastSpan.b],'span end','t');}
  if(dock==='ref'){const{i}=rfSpanOf(r);const m=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:new THREE.Color(css('--ink')),transparent:true,opacity:0.35,depthWrite:false}));
    m.scale.setScalar(tubeR*3);m.position.set(...r.Q[i]);content.add(m);}
  draw();}

// hooks
{const _rb=rebuild;rebuild=function(refit){_rb(refit);rfOverlay();};}
{const _rr=renderRuns;renderRuns=function(){_rr();renderRefine();};}
{const _rp=renderPts;renderPts=function(){_rp();const r=selected();if(!r)return;
  $('ptstable').querySelectorAll('tr[data-i]').forEach(tr=>{const o=tr.onclick,i=+tr.dataset.i;tr.onclick=e=>{o(e);rfPick(i);};});};}
if(typeof renderIssues==='function'){const _ri=renderIssues;renderIssues=function(){_ri();const box=$('iss');if(!box)return;
  box.querySelectorAll('tr[data-u]').forEach(tr=>{const x=waAll().find(q=>q.uid===+tr.dataset.u),o=tr.onclick;if(!x||x.a==null)return;tr.onclick=e=>{o(e);rfPick(x.w);renderRefine();};});};}
showPane=function(){
  $('paneChart').dataset.on=(dock==='rad'||dock==='clr')?1:0;
  [['cmp','paneCmp'],['pts','panePts'],['bun','paneBun'],['iss','paneIss'],['ref','paneRef']].forEach(([k,p])=>$(p).dataset.on=dock===k?1:0);
  ['dRad','dClr','dCmp','dPts','dBun','dIss','dRef'].forEach((id,i)=>$(id).setAttribute('aria-selected',['rad','clr','cmp','pts','bun','iss','ref'][i]===dock));
  rebuild(false);};
$('dRef').onclick=()=>{dock='ref';showPane();};
$('rfGo').onclick=rfApply;$('rfUndo').onclick=rfUndo;$('rfZoom').onclick=rfZoom;
['rfPt','rfSpan'].forEach(k=>$(k).oninput=()=>{if(dock==='ref')rebuild(false);});
renderRefine();
