/* through.js — re-route a lines + arcs pipe so it runs straight through clamp bores.
 * The route is the polyline of corner points, every corner filleted with one radius R (Creo: Single radius).
 * Constraints: both ends and end directions fixed; every straight at least minStraight long; for each clamp,
 * one straight lies on the bore axis and covers the whole bore plus a margin each side.
 * Objective: move the existing corners as little as possible. An added corner costs as much as moving one by
 * addCost mm. Clamps the pipe already passes through are kept.
 * No DOM. Needs ArcRoute (arcroute.js). Browser: window.Through. Node: require('./through.js').
 */
(function (root) {
"use strict";
const AR = root.ArcRoute || (typeof require !== "undefined" ? require("./arcroute.js") : null);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-12;return[a[0]/l,a[1]/l,a[2]/l];};
const DEG=180/Math.PI;
const radial=(p,c,a)=>{const v=sub(p,c);return len(sub(v,mul(a,dot(v,a))));};
function segDist(p,a,b){const d=sub(b,a),L2=dot(d,d),t=L2?Math.max(0,Math.min(1,dot(sub(p,a),d)/L2)):0;return len(sub(p,add(a,mul(d,t))));}

function solveLin(A,b){const n=b.length,M=A.map((r,i)=>r.concat([b[i]]));
  for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-14)return null;
    [M[c],M[p]]=[M[p],M[c]];for(let r=c+1;r<n;r++){const f=M[r][c]/M[c][c];if(f)for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}
  const x=new Array(n).fill(0);for(let r=n-1;r>=0;r--){let s=M[r][n];for(let k=r+1;k<n;k++)s-=M[r][k]*x[k];x[r]=s/M[r][r];}return x;}

// vertex: {kind:'fixed'|'ray'|'axis'|'free', p, o,d (ray / axis line), anchor (original corner or null), init, ks:[clamp ids]}
const cloneV=V=>V.map(v=>({...v,ks:v.ks.slice()}));
function pack(V){const x=[];for(const v of V){if(v.kind==='fixed')continue;if(v.kind==='ray'||v.kind==='axis')x.push(dot(sub(v.p,v.o),v.d));else x.push(...v.p);}return x;}
function unpack(V,x){let i=0;return V.map(v=>{if(v.kind==='fixed')return v.p;if(v.kind==='ray'||v.kind==='axis')return add(v.o,mul(v.d,x[i++]));const p=[x[i],x[i+1],x[i+2]];i+=3;return p;});}
function clampLine(V,k){for(let j=0;j+1<V.length;j++)if(V[j].ks.includes(k)&&V[j+1].ks.includes(k))return j;return -1;}

function residuals(V,W,o,wc){
  const G=AR.build(W,o.R),r=[],m=W.length-1;
  V.forEach((v,i)=>{
    if(v.anchor){const d=sub(W[i],v.anchor);r.push(d[0],d[1],d[2]);}
    else if(v.kind!=='fixed'){const d=sub(W[i],v.init);r.push(d[0]*0.03,d[1]*0.03,d[2]*0.03);}
    if(v.kind==='ray')r.push(wc*Math.max(0,1-dot(sub(W[i],v.o),v.d)));});
  G.lines.forEach((l,j)=>r.push(wc*Math.max(0,(j===0?o.needStart:j===m-1?o.needEnd:o.minStraight)+o.safe-l.gap)));
  o.clamps.forEach((c,k)=>{const j=clampLine(V,k);if(j<0){r.push(wc*1e3);return;}
    const s=dot(sub(W[j+1],W[j]),c.a)>=0?1:-1,d=mul(c.a,s);
    if(V[j].kind!=='axis')r.push(wc*radial(W[j],c.c,c.a));
    if(V[j+1].kind!=='axis')r.push(wc*radial(W[j+1],c.c,c.a));
    const tP=j>0?G.corners[j].t:0,tQ=j+1<m?G.corners[j+1].t:0;
    const uP=dot(sub(W[j],c.c),d)+tP,uQ=dot(sub(W[j+1],c.c),d)-tQ;
    r.push(wc*Math.max(0,uP+c.h+o.safe),wc*Math.max(0,c.h+o.safe-uQ));});
  return r;
}
function lm(V,o,wc,iters){
  const F=x=>residuals(V,unpack(V,x),o,wc),ss=r=>r.reduce((s,v)=>s+v*v,0);
  let x=pack(V),r=F(x),f=ss(r),lam=1e-3;const n=x.length,h=1e-5;
  for(let it=0;it<iters&&n;it++){
    const J=[];for(let i=0;i<n;i++){const xi=x.slice();xi[i]+=h;const ri=F(xi);J.push(ri.map((v,k)=>(v-r[k])/h));}
    const A=[],g=[];for(let i=0;i<n;i++){A.push(new Array(n));let gi=0;for(let k=0;k<r.length;k++)gi+=J[i][k]*r[k];g.push(-gi);
      for(let j=0;j<=i;j++){let s=0;const a=J[i],b=J[j];for(let k=0;k<r.length;k++)s+=a[k]*b[k];A[i][j]=s;A[j]&&(A[j][i]=s);}}
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)A[i][j]=A[j][i];
    let moved=false;
    for(let t=0;t<10;t++){const dx=solveLin(A.map((row,i)=>row.map((v,j)=>i===j?v*(1+lam)+1e-9:v)),g);if(!dx){lam*=10;continue;}
      const xn=x.map((v,i)=>v+dx[i]),rn=F(xn),fn=ss(rn);
      if(fn<f){moved=f-fn>1e-12*(1+f);x=xn;r=rn;f=fn;lam=Math.max(1e-9,lam/3);break;}lam*=4;}
    if(!moved)break;}
  const W=unpack(V,x);V.forEach((v,i)=>v.p=W[i]);return f;
}
function check(V,o){
  const W=V.map(v=>v.p),G=AR.build(W,o.R),m=W.length-1,bad=[];
  G.lines.forEach((l,j)=>{const need=j===0?o.needStart:j===m-1?o.needEnd:o.minStraight;if(l.gap<need-1e-3)bad.push(`straight ${j+1} is ${l.gap.toFixed(1)} mm, needs ${need}`);});
  G.corners.forEach((c,j)=>{if(c&&c.th>179/DEG)bad.push(`corner ${j+1} turns back on itself`);});
  V.forEach((v,j)=>{if(v.kind==='ray'&&dot(sub(v.p,v.o),v.d)<0.5)bad.push('an end straight flips over');});
  if(o.sd&&dot(norm(sub(W[1],W[0])),o.sd)<1-1e-9)bad.push('start direction changed');
  if(o.ed&&dot(norm(sub(W[m],W[m-1])),o.ed)<1-1e-9)bad.push('end direction changed');
  o.clamps.forEach((c,k)=>{const j=clampLine(V,k);if(j<0){bad.push(`${c.name}: no straight on its axis`);return;}
    const s=dot(sub(W[j+1],W[j]),c.a)>=0?1:-1,d=mul(c.a,s),tP=j>0?G.corners[j].t:0,tQ=j+1<m?G.corners[j+1].t:0;
    const from=dot(sub(W[j],c.c),d)+tP,to=dot(sub(W[j+1],c.c),d)-tQ,off=Math.max(radial(W[j],c.c,c.a),radial(W[j+1],c.c,c.a));
    if(off>0.01)bad.push(`${c.name}: straight ${off.toFixed(2)} mm off the bore axis`);
    if(from>-c.h+1e-3||to<c.h-1e-3)bad.push(`${c.name}: straight covers ${from.toFixed(1)}…${to.toFixed(1)} mm of the bore, needs ±${c.h.toFixed(1)}`);});
  return bad;
}
function fit(V,o){for(const wc of[1,10,100,1e3,1e4,1e5])lm(V,o,wc,wc<1e3?40:80);return check(V,o);}
function cost(V,o){let mx=0,sum=0,added=0;V.forEach(v=>{if(v.anchor){const d=len(sub(v.p,v.anchor));mx=Math.max(mx,d);sum+=d;}else if(v.kind!=='fixed')added++;});
  return{max:mx,sum,added,score:mx+0.1*sum+o.addCost*added};}

// candidate ways to put clamp k on the route
function variants(V,k,o){
  const c=o.clamps[k],W=V.map(v=>v.p),out=[],m=W.length-1,L0=c.h+o.R+o.safe;
  // already on the route: a straight whose ends both sit on the bore axis
  for(let j=0;j<m;j++)if(radial(W[j],c.c,c.a)<0.5&&radial(W[j+1],c.c,c.a)<0.5){const Vn=cloneV(V);Vn[j].ks.push(k);Vn[j+1].ks.push(k);out.push({V:Vn,how:'kept (pipe already passes through)'});}
  if(out.length)return out;
  const segs=[];for(let j=1;j<m-1;j++)segs.push({j,d:segDist(c.c,W[j],W[j+1])});segs.sort((a,b)=>a.d-b.d);   // never between an end and its direction corner
  for(const {j} of segs.slice(0,3)){const seg=norm(sub(W[j+1],W[j]));
    for(const s of[1,-1]){const d=mul(c.a,s);if(dot(d,seg)<-0.3)continue;
      const ax=(u,anchor)=>({kind:'axis',o:c.c,d,p:add(c.c,mul(d,u)),init:add(c.c,mul(d,u)),anchor:anchor||null,ks:[k]});
      const uOf=p=>dot(sub(p,c.c),d);
      const ins=(at,list)=>{const Vn=cloneV(V);Vn.splice(at,0,...list);return Vn;};
      out.push({V:ins(j+1,[ax(-L0),ax(L0)]),how:'two corners added on the bore axis'});
      if(V[j].kind==='free'){const Vn=cloneV(V);Vn[j]=ax(Math.min(-L0,uOf(W[j])),V[j].anchor);Vn.splice(j+1,0,ax(L0));out.push({V:Vn,how:`corner ${j+1} moved onto the bore axis, one corner added`});}
      if(V[j+1].kind==='free'){const Vn=cloneV(V);Vn[j+1]=ax(Math.max(L0,uOf(W[j+1])),V[j+1].anchor);Vn.splice(j+1,0,ax(-L0));out.push({V:Vn,how:`corner ${j+2} moved onto the bore axis, one corner added`});}
      if(V[j].kind==='free'&&V[j+1].kind==='free'){const Vn=cloneV(V);Vn[j]=ax(Math.min(-L0,uOf(W[j])),V[j].anchor);Vn[j+1]=ax(Math.max(L0,uOf(W[j+1])),V[j+1].anchor);out.push({V:Vn,how:`corners ${j+1} and ${j+2} moved onto the bore axis`});}}}
  return out;
}

// W0: corner points incl. both ends. opt: {R, clamps:[{c,a,length,name}], minStraight=30, margin=2, addCost=25}
function solve(W0,opt){
  const o=Object.assign({minStraight:30,margin:2,addCost:25,safe:0.02},opt);
  if(!AR)throw new Error('ArcRoute not loaded');
  if(W0.length<2)throw new Error('Need a start and an end point.');
  const m0=W0.length-1,G0=AR.build(W0,o.R);
  o.needStart=Math.max(0,Math.min(o.minStraight,G0.lines[0].gap));o.needEnd=Math.max(0,Math.min(o.minStraight,G0.lines[m0-1].gap));
  o.clamps=o.clamps.map(c=>({...c,a:norm(c.a),h:c.length/2+o.margin}));
  const sd=norm(sub(W0[1],W0[0])),ed=norm(sub(W0[m0],W0[m0-1]));o.sd=sd;o.ed=ed;
  let V=W0.map((p,i)=>i===0||i===m0?{kind:'fixed',p,anchor:null,ks:[]}:{kind:'free',p,anchor:p,init:p,ks:[]});
  if(m0>=2){V[1]={kind:'ray',o:W0[0],d:sd,p:W0[1],anchor:W0[1],init:W0[1],ks:[]};
    if(m0-1!==1)V[m0-1]={kind:'ray',o:W0[m0],d:mul(ed,-1),p:W0[m0-1],anchor:W0[m0-1],init:W0[m0-1],ks:[]};}
  const steps=[];
  // clamps the route already passes through first, so they are held while the others are added
  const order=o.clamps.map((c,k)=>({k,on:W0.some((p,j)=>j<m0&&radial(p,c.c,c.a)<0.5&&radial(W0[j+1],c.c,c.a)<0.5)})).sort((a,b)=>b.on-a.on).map(x=>x.k);
  const done=[];
  for(const k of order){
    let best=null;const tried=[];
    for(const cand of variants(V,k,o)){
      const bad=fitActive(cand.V,o,done.concat([k])),cs=cost(cand.V,o);tried.push({how:cand.how,bad,cs});
      if(!bad.length&&(!best||cs.score<best.cs.score))best={V:cand.V,how:cand.how,cs};}
    if(!best){const near=tried.sort((a,b)=>a.bad.length-b.bad.length)[0];
      return{ok:false,reason:`no route through ${o.clamps[k].name}`+(near?`: ${near.bad.slice(0,3).join('; ')}`:''),steps,tried};}
    V=best.V;done.push(k);steps.push({clamp:o.clamps[k].name,how:best.cs.max<1e-3?best.how.replace(/moved onto/,'already on'):best.how,maxMove:best.cs.max,added:best.cs.added});}
  const W=V.map(v=>v.p.map(x=>Math.round(x*1000)/1000));
  return{ok:true,W,R:o.R,steps,report:report(W0,V,W,o)};
}
// fit with only the clamps in `ks` active (renumbered so inactive clamps drop out)
function fitActive(V,o,ks){const map=[],cl=[];o.clamps.forEach((c,i)=>{if(ks.includes(i)){map[i]=cl.length;cl.push(c);}});
  const Vm=V.map(v=>({...v,ks:v.ks.filter(k=>ks.includes(k)).map(k=>map[k])}));
  const bad=fit(Vm,{...o,clamps:cl});Vm.forEach((v,i)=>V[i].p=v.p);return bad;}

// what changed, and an independent check on the rounded corners
function report(W0,V,W,o){
  const G=AR.build(W,o.R),m=W.length-1,S=AR.sample(G,0.25);
  const rows=W.map((p,i)=>{const v=V[i];const was=v.anchor?W0.findIndex(q=>q===v.anchor||len(sub(q,v.anchor))<1e-9):(v.kind==='fixed'?(i===0?0:W0.length-1):-1);
    return{p,was,moved:was>=0?len(sub(p,W0[was])):null,deg:i>0&&i<m&&G.corners[i]?G.corners[i].th*DEG:null,clamp:v.kind==='axis'};});
  const removed=W0.map((q,i)=>i).filter(i=>!rows.some(r=>r.was===i));
  const clamps=o.clamps.map(c=>{const a=c.a,half=c.length/2;let off=0,curved=false;
    S.pts.forEach((p,i)=>{const u=dot(sub(p,c.c),a),rr=radial(p,c.c,a);if(rr<c.length+5&&Math.abs(u)<=half){off=Math.max(off,rr);if(S.k[i]>1e-6)curved=true;}});
    const j=clampLine(V,o.clamps.indexOf(c));let lo=NaN,hi=NaN;
    if(j>=0){const s=dot(sub(W[j+1],W[j]),a)>=0?1:-1,tP=j>0?G.corners[j].t:0,tQ=j+1<m?G.corners[j+1].t:0,u1=s*(dot(sub(W[j],c.c),a))+tP,u2=s*(dot(sub(W[j+1],c.c),a))-tQ;lo=u1;hi=u2;}
    return{name:c.name,maxOff:off,covered:[lo,hi],half,curved,ok:off<=0.05&&!curved&&lo<=-half&&hi>=half};});
  const straights=G.lines.map(l=>l.gap),bends=G.corners.slice(1).map(c=>c.th*DEG);
  const endMove=Math.max(len(sub(W[0],W0[0])),len(sub(W[m],W0[W0.length-1])));
  const dirS=dot(norm(sub(W[1],W[0])),norm(sub(W0[1],W0[0]))),dirE=dot(norm(sub(W[m],W[m-1])),norm(sub(W0[W0.length-1],W0[W0.length-2])));
  return{rows,removed,clamps,straights,bends,length:S.s[S.s.length-1],minStraight:Math.min(...straights.slice(1,-1).concat(straights.length<=2?straights:[])),
    endMove,endDirErr:Math.max(Math.acos(Math.min(1,dirS)),Math.acos(Math.min(1,dirE)))*DEG,samples:S,G};
}

const API={solve,report};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.Through=API;
})(typeof globalThis!=="undefined"?globalThis:this);
