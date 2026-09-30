// Clearance tab: offset the slave from the master along chosen axes, with fixed start/end points
// and a smooth ramp out to the full gap. Loaded last; replaces the runClear handler.
function clPt(s){const p=parsePts(s||'');return p.length?p[0]:null;}
// push direction and travel per point: travel t along dir brings the true 3D distance to the gap
function clOffset(M,S,gap,mode,mask,smooth,locks){
  const info=S.map(p=>{const c=closestOnPath(p,M);return{d:c.d,v:V.sub(p,c.foot)};});
  let dirs=info.map(q=>{const u=[q.v[0]*mask[0],q.v[1]*mask[1],q.v[2]*mask[2]];return V.len(u)>1e-6*Math.max(1,q.d)?V.norm(u):null;});
  const sum=dirs.filter(Boolean).reduce((a,b)=>V.add(a,b),[0,0,0]);
  const fb=V.len(sum)>1e-9?V.norm(sum):(mask[2]?[0,0,1]:mask[1]?[0,1,0]:[1,0,0]);
  dirs=dirs.map(d=>d||fb);if(smooth)dirs=smoothDirs(dirs,smooth);
  dirs=dirs.map(d=>{const u=[d[0]*mask[0],d[1]*mask[1],d[2]*mask[2]];return V.len(u)>1e-9?V.norm(u):fb;});
  const t=[],short=[];
  S.forEach((p,i)=>{const d0=info[i].d;
    if(locks.has(i)||(mode==='min'&&d0>=gap)||Math.abs(d0-gap)<0.05){t.push(0);return;}
    const sg=d0<gap?1:-1,f=x=>closestOnPath(V.add(p,V.mul(dirs[i],sg*x)),M).d-gap,T=Math.max(gap*6,50),st=Math.max(gap/8,1);
    let lo=0,hi=null,best=0,bv=Math.abs(f(0));
    for(let x=st;x<=T;x+=st){const v=f(x);if(Math.abs(v)<bv){bv=Math.abs(v);best=x;}if(Math.sign(v)!==Math.sign(f(lo))){hi=x;break;}lo=x;}
    if(hi!=null){for(let k=0;k<30;k++){const m=(lo+hi)/2;if(Math.sign(f(m))===Math.sign(f(lo)))lo=m;else hi=m;}best=(lo+hi)/2;bv=Math.abs(f(best));}
    if(bv>0.5)short.push(i);t.push(sg*best);});
  return{dirs,t,short,before:info.map(q=>q.d)};}
// normal mode: same form (dir, travel) from the parallel offset
function clNormal(M,S,gap,mode,locks){const r=adjustNormal(M,S,gap,mode,locks,0),n=S.length;
  const D=r.moved.map((p,i)=>V.sub(p,S[i])),t=D.map(V.len),dirs=D.map(d=>V.len(d)>1e-9?V.norm(d):null);
  for(let i=0;i<n;i++)if(!dirs[i]){let k=1;while(k<n&&!dirs[i-k]&&!dirs[i+k])k++;dirs[i]=dirs[i-k]||dirs[i+k]||[0,0,1];}
  return{dirs,t,short:[],before:r.before};}
// even out the travel so neighbours move together; min mode never drops below what a point needs
function clFair(t,need,locks,passes,mode){let x=t.slice();const n=x.length;
  for(let p=0;p<passes;p++){const y=x.slice();for(let i=1;i<n-1;i++){if(locks.has(i))continue;const m=(x[i-1]+2*x[i]+x[i+1])/4;
    y[i]=mode==='min'?(need[i]>=0?Math.max(need[i],m):Math.min(need[i],m)):m;}x=y;}
  return x;}
// add points inside the ramp zones so the ramp has something to bend
function clDensify(S,rho){if(!(rho>0))return S.slice();
  const d=sampleSpline(naturalSpline(S),40),P=d.pts,s=d.s,L=s[s.length-1],step=rho/4;let j=0;
  const ks=S.map(p=>{let bj=j,bd=Infinity;for(let q=j;q<P.length;q++){const dd=V.len(V.sub(P[q],p));if(dd<bd){bd=dd;bj=q;}if(bd<1e-6)break;}j=bj;return s[bj];});
  const at=t=>{let q=1;while(q<s.length-1&&s[q]<t)q++;const w=(t-s[q-1])/((s[q]-s[q-1])||1);return V.add(P[q-1],V.mul(V.sub(P[q],P[q-1]),w));};
  const out=[S[0]];
  for(let i=1;i<S.length;i++){const a=ks[i-1],b=ks[i];
    if((a<rho||b>L-rho)&&b-a>step){const k=Math.ceil((b-a)/step)-1;for(let m=1;m<=k;m++)out.push(at(a+(b-a)*m/(k+1)));}
    out.push(S[i]);}
  return out;}
function clBuild(M,S0,o,rho){
  const S=clDensify(S0,rho),n=S.length,locks=new Set([0,n-1]);S.forEach((p,i)=>{if(o.lockPts.includes(p))locks.add(i);});
  const r=o.normal?clNormal(M,S,o.gap,o.mode,locks):clOffset(M,S,o.gap,o.mode,o.mask,o.smooth,locks),short=r.short,before=r.before;
  const t=o.mode!=='min'?r.t:clFair(r.t,r.t,locks,2+2*o.blend+(rho>0?Math.round(Math.max(0,S.length-S0.length)/2):0),o.mode);
  const cs=[0];for(let i=1;i<n;i++)cs.push(cs[i-1]+V.len(V.sub(S[i],S[i-1])));const L=cs[n-1];
  const w=cs.map(c=>{if(!(rho>0))return 1;const u=Math.min(1,Math.min(c,L-c)/rho);return u*u*(3-2*u);});
  const Q=S.map((p,i)=>locks.has(i)?p:V.add(p,V.mul(r.dirs[i],t[i]*w[i]))).map(p=>p.map(c=>Math.round(c*1000)/1000));
  const A=analyse(Q),Ld=A.d.s[A.d.s.length-1];let rampR=Infinity;
  if(rho>0)A.d.k.forEach((k,i)=>{const s=A.d.s[i];if((s<=rho||s>=Ld-rho)&&1/k<rampR)rampR=1/k;});
  const after=Q.map(p=>closestOnPath(p,M).d);
  return{Q,S,A,w,before,after,shift:Q.map((p,i)=>V.len(V.sub(p,S[i]))),short:short.filter(i=>w[i]>0.999),rampR,rho,L};}

$('runClear').onclick=()=>{
  const st=$('statusClear');st.style.color='';
  let M=parsePts($('mpts').value),S=parsePts($('spts').value);
  if(M.length<2||S.length<2)return st.textContent='Paste both routes, at least two points each.';
  let note='';
  if($('reorder').checked){const rm=reorderPath(M),rs=reorderPath(S);M=rm.pts;S=rs.pts;
    if(rm.moves||rs.moves)note=` Reordered ${rm.moves} master and ${rs.moves} slave point(s).`;}
  const p0=clPt($('cStart').value),p1=clPt($('cEnd').value);
  if($('cStart').value.trim()&&!p0)return st.textContent='Slave start needs three numbers: x y z.';
  if($('cEnd').value.trim()&&!p1)return st.textContent='Slave end needs three numbers: x y z.';
  S=S.map(p=>p.slice());if(p0)S[0]=p0;if(p1)S[S.length-1]=p1;
  const normal=$('cn').checked,mask=['cx','cy','cz'].map(k=>$(k).checked?1:0);
  if(!normal&&!mask.some(Boolean))return st.textContent='Tick at least one axis to push along, or Normal.';
  const axes=normal?'normal':'xyz'.split('').filter((_,k)=>mask[k]).join('');
  const gap=+$('gap').value||0,mode=$('mode').value,smooth=+$('smooth').value||0,blend=+$('blend').value||0,R=+$('cr').value||65;
  const lockTxt=$('lock').value.trim(),lockN=lockTxt.split(/[,\s]+/).filter(Boolean).map(Number).filter(v=>Number.isInteger(v)&&v>=1);
  const o={gap,mode,mask,normal,smooth,blend,lockPts:lockN.map(k=>S[k-1]).filter(Boolean)};
  const rampTxt=$('cRamp').value.trim(),L0=pathLength(S),maxRho=L0/2.2,auto=rampTxt==='';
  let b,rampNote='';
  const baseR=analyse(S).minR,goal=Math.min(R,baseR*0.98),good=t=>t.rampR>=R&&t.A.minR>=goal,score=t=>Math.min(t.rampR,t.A.minR/Math.max(goal,1e-9)*R);
  if(auto){let best=null;
    for(let rho=Math.min(R*0.5,maxRho);rho<=maxRho+1e-9;rho=rho*1.2){const t=clBuild(M,S,o,rho);if(good(t)){best=t;best.ok=true;break;}if(!best||score(t)>score(best))best=t;if(rho>=maxRho)break;if(rho*1.2>maxRho)rho=maxRho/1.2;}
    b=best;rampNote=b.ok?`Ramp ${fmt(b.rho,0)} mm (auto, shortest that passes).`:`No ramp up to ${fmt(maxRho,0)} mm passes the bend check; using ${fmt(b.rho,0)} mm (ramp R ${fmt(b.rampR)}, cable R ${fmt(b.A.minR)}).`;}
  else{let rho=Math.max(0,+rampTxt||0);if(rho>L0/2){rampNote=`Ramp cut to ${fmt(L0/2,0)} mm (half the cable). `;rho=L0/2;}
    b=clBuild(M,S,o,rho);rampNote+=rho>0?`Ramp ${fmt(rho,0)} mm (fixed).`:'No ramp.';}
  const A=b.A,base=analyse(S),out=b.after.filter((_,i)=>b.w[i]>0.999&&i>0&&i<b.Q.length-1),cMin=out.length?Math.min(...out):Infinity,cMax=out.length?Math.max(...out):-Infinity;
  const cchk={gap,mode,axes,R,rho:b.rho,auto,rampR:b.rampR,rampOk:!(b.rho>0)||b.rampR>=R,short:b.short,cMin,cMax,
    endGap:[b.after[0],b.after[b.after.length-1]],clrOk:!b.short.length&&(mode==='min'?!(cMin<gap-0.5):!(cMin<gap-1||cMax>gap+1)),bendOk:A.minR>=R,lenBefore:base.len,lenAfter:A.len,rampNote};
  const lockRe=lockN.length?', locked '+lockN.map(k=>'P'+k).join(' '):'';
  addRun(Object.assign(A,{name:`Gap ${gap} ${mode==='const'?'exact':mode} ${axes}`,kind:'clear',kindLabel:`clearance, ${mode==='const'?'exact':mode}`,
    master:M,clear:{gap,mode,plane:axes,before:b.before,after:b.after,shift:b.shift},cchk,
    params:{R,SF:1.5,gap,mode,plane:axes,smooth,blend,lock:lockTxt,ramp:rampTxt,start:$('cStart').value.trim(),end:$('cEnd').value.trim()},
    settings:`${mode==='const'?'exact':mode}, push ${axes}, ${b.rho>0?`ramp ${fmt(b.rho,0)}${auto?' auto':''}`:'no ramp'}, smooth ${smooth}, blend ${blend}${lockRe}`,
    text:toPts(b.Q,{R,designR:R*1.5,minR:A.minR,len:A.len,tidx:b.Q.map((_,i)=>i)})}));
  const r=runs[runs.length-1];r.clearDense=A.d.pts.map(p=>closestOnPath(p,M).d);renderRuns();rebuild(false);
  store.set('rs.master',$('mpts').value);store.set('rs.slave',$('spts').value);
  const fails=clFails(cchk);
  st.textContent=`${fails.length?'Fails: '+fails.join('; ')+'.':'Passes clearance, bend and ramp.'} Clearance ${fmt(Math.min(...b.after))}–${fmt(Math.max(...b.after))} mm. ${rampNote} Length ${fmt(cchk.lenBefore,0)} → ${fmt(cchk.lenAfter,0)} mm.${clEndNote(cchk)}${note}`;
  st.style.color=fails.length?'var(--bad)':'';};
function clFails(c){const f=[];
  if(!c.bendOk)f.push('bend below min radius');
  if(!c.rampOk)f.push(`ramp bends to R ${fmt(c.rampR)} mm`);
  if(c.short.length)f.push(`${c.axes.toUpperCase()} can't reach the gap at ${c.short.slice(0,8).map(i=>'P'+(i+1)).join(', ')}${c.short.length>8?'…':''}`);
  else if(!c.clrOk)f.push(c.mode==='min'||c.cMin<c.gap-1?`clearance ${fmt(c.cMin)} mm is under the ${c.gap} mm gap`:`clearance reaches ${fmt(c.cMax)} mm, over the exact ${c.gap} mm gap`);
  return f;}
function clEndNote(c){const e=c.endGap;if(!e)return'';const low=e.map((v,k)=>v<c.gap-0.5?`${k?'end':'start'} ${fmt(v)} mm`:null).filter(Boolean);return low.length?` Fixed ${low.join(', ')} from the master; only a ramp can open that.`:'';}

// headline pass/fail includes clearance and ramp for clearance runs
{const _ro=readout;readout=function(){_ro();const r=selected();if(!r||!r.cchk)return;const c=r.cchk,f=clFails(c),v=$('readout').querySelector('.verdict'),x=$('readout').querySelector('.facts');
  if(v&&f.length){v.textContent=`Fails: ${f.join('; ')}.`;v.style.color='var(--bad)';}
  if(x){const dl=c.lenAfter-c.lenBefore;x.textContent+=` ${c.rho>0?`Ramp ${fmt(c.rho,0)} mm${c.auto?' (auto)':''}, R ${fmt(c.rampR)}.`:'No ramp.'} Length ${dl>=0?'+':''}${fmt(dl)} mm vs the original slave.${clEndNote(c)}`;}};}
{const _ls=loadSettings;loadSettings=function(r){if(r.kind!=='clear'||!r.cchk&&!(r.params&&'ramp'in r.params))return _ls(r);
  const p=r.params;showPanel('clear');$('gap').value=p.gap;$('mode').value=p.mode;$('smooth').value=p.smooth;$('blend').value=p.blend;$('cr').value=p.R;$('lock').value=p.lock||'';
  $('cRamp').value=p.ramp||'';$('cStart').value=p.start||'';$('cEnd').value=p.end||'';
  $('cn').checked=p.plane==='normal';['x','y','z'].forEach(k=>$('c'+k).checked=p.plane!=='normal'&&p.plane.includes(k));clAxes();};}
function clAxes(){const n=$('cn').checked;['cx','cy','cz'].forEach(k=>$(k).disabled=n);}
$('cn').onchange=clAxes;clAxes();
