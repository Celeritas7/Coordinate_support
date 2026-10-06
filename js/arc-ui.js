// ---------------- Bend tab: lines + arcs shape ----------------
// Loaded last. "Route shape" picks the spline solver (route-studio.js) or ArcRoute (arcroute.js).
// An arc run keeps its exact geometry in r.d; r.Q holds only the corner points written to the .pts file.

function arcParseNamed(text){
  const P=[],names=[];
  for(const raw of text.split(/\r?\n/)){
    const cut=raw.indexOf('!'),line=(cut<0?raw:raw.slice(0,cut)).trim();if(!line)continue;
    const v=line.replace(/,/g,' ').split(/\s+/).map(Number);
    if(v.length<3||!v.slice(0,3).every(Number.isFinite))continue;
    const p=v.slice(0,3);if(P.length&&V.len(V.sub(p,P[P.length-1]))<=1e-6)continue;
    P.push(p);names.push(cut<0?'':raw.slice(cut+1).trim());
  }
  return{P,names:names.map((n,i)=>n||'P'+(i+1))};
}

function arcPts(res,names,info){
  const f=c=>c.toFixed(3).padStart(15),m=res.W.length;
  const own=arcLabels(res,names).map((l,i)=>l&&i>0&&i<m-1?`${i+1}=${l}`:'').filter(Boolean);
  return["!","!       DATUM POINT ARRAY DATA FILE","!",
    `! Lines + arcs route through ${names.length} stations, corner points only.`,
    `! Creo: Curve through points, Single radius ${info.R} mm (hose minimum ${info.Rlim} mm).`,
    `! ${m} points, route length ~${Math.round(info.len)} mm. Every station within ${info.err.toFixed(3)} mm of the curve.`,
    `! Points 1 and ${m} are the end stations (${names[0]}, ${names[names.length-1]}); the others are corners, off the hose.`,
    ...(own.length?[`! Corner arcs through: ${own.join(', ')}`]:[]),
    "!","! Enter values with respect to datum arrays' coordinate system:","!",
    "!CARTESIAN coordinates:","!        X                Y                Z","!",
    ...res.W.map(q=>`${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n")+"\n";
}
// which stations each corner's arc passes through
function arcLabels(res,names){
  const L=res.W.map(()=>[]);L[0].push(names[0]);L[L.length-1].push(names[names.length-1]);
  res.owner.forEach((o,k)=>{if(o>0&&o<L.length-1)L[o].push(names[k]);});
  return L.map(l=>l.join(' '));
}

function arcRun(){
  const{P,names}=arcParseNamed($('pts').value);
  if(P.length<3)return $('statusBend').textContent='Paste at least three points.';
  const R=+$('r').value||65,SF=+$('sf').value||1.5,tol=Math.max(0.001,+$('arcTol').value||0.05);
  const frameNote=(typeof CAD!=='undefined'&&CAD.frame&&$('cadpick_pts')&&!$('cadpick_pts').hidden)?`, in ${CAD.frame.name} frame`:'';
  store.set('rs.pts',$('pts').value);
  $('statusBend').style.color='';$('statusBend').textContent=`Placing corners through ${P.length} stations...`;
  $('runBend').disabled=true;
  setTimeout(()=>{
    let res;const t0=performance.now();
    try{res=ArcRoute.solve(P,{R,Rmax:R*SF,tol,startDir:parseDir($('sd').value),endDir:parseDir($('ed').value)});}
    catch(e){$('runBend').disabled=false;$('statusBend').style.color='var(--bad)';return $('statusBend').textContent=e.message;}
    $('runBend').disabled=false;
    const ms=Math.round(performance.now()-t0);
    if(!res.ok){
      const off=res.errs.map((e,k)=>e>tol?`${names[k]} ${e.toFixed(1)} mm`:'').filter(Boolean);
      $('statusBend').style.color='var(--bad)';
      $('statusBend').textContent=`No lines + arcs route holds R ${R} through these stations: ${res.reason}.`+(off.length?` Off the curve: ${off.join(', ')}.`:'')+' Move those stations apart, or lower Min radius to see how far it gets.';
      return;}
    const W=res.W.map(q=>q.map(v=>Math.round(v*1000)/1000));
    const G=ArcRoute.build(W,res.R),d=ArcRoute.sample(G,10);
    const errs=P.map((p,k)=>{const w=[0,W.length-1];return ArcRoute.nearest(G,p,w[0],w[1]).d;}),err=Math.max(...errs);
    let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});
    const len=d.s[d.s.length-1],Rtxt=+res.R.toFixed(2);
    addRun({Q:W,d,wi,minR:res.R,len,tidx:[],qLabel:arcLabels(res,names),stations:P.map((p,i)=>({p,name:names[i]})),
      name:`Lines + arcs R${Rtxt}`,kind:'arc',kindLabel:'bend radius, lines + arcs',params:{R,SF},
      settings:`${W.length} corner points, single radius ${Rtxt} mm, stations within ${err.toFixed(3)} mm${frameNote}`,
      text:arcPts({W,owner:res.owner},names,{R:Rtxt,Rlim:R,len,err})});
    $('statusBend').textContent=`Added. One radius, R ${Rtxt} mm (${(res.R/R).toFixed(2)}x the limit), through all ${P.length} stations with ${W.length} points. Solved in ${ms} ms.`;
  },20);
}

{const spline=$('runBend').onclick,LABEL={spline:$('runBend').textContent,arc:'Solve lines + arcs, then add to comparison'};
  const sync=()=>{const arc=$('shape').value==='arc';
    $('splineOpts').hidden=arc;$('spBox').hidden=arc;$('arcTolBox').hidden=!arc;$('arcHint').hidden=!arc;$('bendHint').hidden=arc;
    if(!bendJob)$('runBend').textContent=LABEL[arc?'arc':'spline'];store.set('rs.shape',$('shape').value);};
  $('shape').onchange=sync;
  if(store.get('rs.shape')==='arc')$('shape').value='arc';sync();
  $('runBend').onclick=e=>{if($('shape').value==='arc'&&!bendJob)return arcRun();return spline(e);};}
